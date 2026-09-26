const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  // 1. Create a container analysis
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: 'Test-Container-Scanning-Msg',
      targetType: 'container',
      sourceType: 'CONTAINER_IMAGE'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log('Created Analysis:', analysisId, 'Status:', analysis.status);

  // 2. Launch headless Chrome and open CBOMKit
  const port = 9399;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-msg-' + Date.now()
  ]);
  let list;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      list = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + port + '/json', r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
      });
      if (list && list.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  const page = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === msgId) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=container`;
  console.log('Navigating to', url);
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 3000));

  // 3. Trigger container scan via backend API (simulating user clicking Scan)
  console.log('Triggering container scan for', analysisId);
  const formData = new URLSearchParams();
  formData.append('targetType', 'container');
  formData.append('imageReference', 'redis:alpine');
  await fetch(`http://localhost:3001/api/analyses/${analysisId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });

  // Post message to iframe as CryptaVista does
  await send('Runtime.evaluate', {
    expression: `window.postMessage({ type: 'CONTAINER_SCAN_STARTED', analysisId: '${analysisId}', applicationName: 'redis:alpine' }, '*')`
  });

  // 4. Sample the subtitle text during RUNNING at 500ms intervals
  console.log('Sampling subtitle text during RUNNING...');
  let sawScanningMsg = false;
  let sawNoCryptoFoundPrematurely = false;

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const sample = await send('Runtime.evaluate', {
      expression: `(() => {
        const h4 = document.querySelector('.cv-tile h4, .main h4, h4');
        const m = window.cbomModel || window.model;
        return {
          subtitleText: h4 ? h4.textContent.trim() : null,
          isScanning: m && m.scanning ? m.scanning.isScanning : null,
          scanningStatus: m && m.scanning ? m.scanning.scanningStatus : null,
          compCount: m && m.cbom && m.cbom.components ? m.cbom.components.length : 0
        };
      })()`,
      returnByValue: true
    });

    const sub = sample.result.value.subtitleText;
    console.log(`[Sample ${i+1}] Subtitle: "${sub}" | Components: ${sample.result.value.compCount}`);

    if (sub && sub.includes('Scanning (just a second)...')) {
      sawScanningMsg = true;
    }
    if (sub && sub.includes('No cryptographic asset has been found.') && sample.result.value.compCount === 0) {
      sawNoCryptoFoundPrematurely = true;
    }
  }

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log('1. Displayed "Scanning (just a second)...":', sawScanningMsg ? 'YES (PASSED)' : 'NO (FAILED)');
  console.log('2. Premature "No cryptographic asset has been found." avoided:', !sawNoCryptoFoundPrematurely ? 'YES (PASSED)' : 'NO (FAILED)');

  chrome.kill();
}
main().catch(console.error);
