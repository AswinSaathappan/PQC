const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testScenario(name, setupFn) {
  console.log(`\n=== Testing: ${name} ===`);
  const port = 9390 + Math.floor(Math.random() * 50);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-verify-' + Date.now()
  ]);

  let list;
  for (let attempt = 0; attempt < 25; attempt++) {
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
      await new Promise(r => setTimeout(r, 400));
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

  const result = await setupFn(send);

  chrome.kill();
  return result;
}

async function main() {
  const inputTypes = [
    { type: 'git', app: 'test-git-app', msg: 'GIT_SCAN_STARTED' },
    { type: 'folder', app: 'test-folder-app', msg: 'FOLDER_SCAN_STARTED' },
    { type: 'binary', app: 'test-binary-app', msg: 'BINARY_SCAN_STARTED' },
    { type: 'container', app: 'cont', msg: 'CONTAINER_SCAN_STARTED' }
  ];

  let allPassed = true;

  for (const item of inputTypes) {
    const passed = await testScenario(`${item.type.toUpperCase()} Input Scan`, async (send) => {
      // 1. Create analysis
      const aRes = await fetch('http://localhost:3001/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationName: item.app,
          targetType: item.type,
          sourceType: item.type === 'git' ? 'GIT_REPOSITORY' :
                      item.type === 'folder' ? 'PROJECT_FOLDER' :
                      item.type === 'binary' ? 'BINARY_FILE' : 'CONTAINER_IMAGE'
        })
      });
      const an = await aRes.json();
      const analysisId = an.analysisId;

      // 2. Open CBOMKit iframe directly
      const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=${item.type}`;
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 2000));

      // 3. Trigger scan event as CryptaVista does when user inputs and clicks scan
      await send('Runtime.evaluate', {
        expression: `window.postMessage({
          type: '${item.msg}',
          analysisId: '${analysisId}',
          applicationName: '${item.app}'
        }, '*')`
      });
      await new Promise(r => setTimeout(r, 600));

      // Check text when scan is active and findings are 0
      const subRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const h4 = document.querySelector('.cv-tile h4, .main h4, h4');
          return h4 ? h4.textContent.trim() : '';
        })()`,
        returnByValue: true
      });

      const subtitle = subRes.result.value;
      console.log(`[${item.type}] Subtitle before asset discovery: "${subtitle}"`);

      const hasScanningMsg = subtitle.includes('Scanning (just a second)...');
      const hasPrematureNoCrypto = subtitle.includes('No cryptographic asset has been found.');

      console.log(`[${item.type}] Has "Scanning (just a second)...":`, hasScanningMsg);
      console.log(`[${item.type}] Premature "No cryptographic asset..." avoided:`, !hasPrematureNoCrypto);

      return hasScanningMsg && !hasPrematureNoCrypto;
    });

    if (!passed) {
      allPassed = false;
    }
  }

  console.log('\n=============================================');
  console.log('FINAL RESULT FOR ALL 4 INPUT TYPES:', allPassed ? 'ALL PASSED!' : 'SOME FAILED');
  console.log('=============================================');
}

main().catch(console.error);
