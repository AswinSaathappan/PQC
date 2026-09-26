const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const port = 9398;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-disc-test-' + Date.now()
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

  const url = `http://localhost:8001/?targetType=git`;
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 3000));

  // Emulate scan start with 0 findings
  console.log('Testing scan start state...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__isScanningActive = true;
      window.__isAnalysisCompleted = false;
      if (window.updateScanningSubtitle) window.updateScanningSubtitle();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  const startCheck = await send('Runtime.evaluate', {
    expression: `document.querySelector('.cv-tile h4, .main h4, h4')?.textContent?.trim()`,
    returnByValue: true
  });
  console.log('Scan Start Subtitle:', startCheck.result.value);

  // Emulate asset arrival
  console.log('Testing asset discovery arrival...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      if (m && m.scanning) {
        m.scanning.liveDetections = [{
          id: 'test-1',
          name: 'AES-GCM',
          type: 'algorithm',
          primitive: 'symmetric',
          location: 'src/crypto.ts'
        }];
      }
      if (window.updateScanningSubtitle) window.updateScanningSubtitle();
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  const discCheck = await send('Runtime.evaluate', {
    expression: `document.querySelector('.cv-tile h4, .main h4, h4')?.textContent?.trim()`,
    returnByValue: true
  });
  console.log('Asset Discovery Subtitle:', discCheck.result.value);

  chrome.kill();
}

main().catch(console.error);
