const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testInputType(targetType, appName) {
  // 1. Create analysis
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: appName,
      targetType: targetType,
      sourceType: targetType === 'git' ? 'GIT_REPOSITORY' :
                  targetType === 'folder' ? 'PROJECT_FOLDER' :
                  targetType === 'binary' ? 'BINARY_FILE' : 'CONTAINER_IMAGE'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log(`\n[${targetType.toUpperCase()}] Created Analysis:`, analysisId);

  // 2. Open in headless chrome
  const port = 9390 + Math.floor(Math.random() * 50);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-test-' + targetType + '-' + Date.now()
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

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=${targetType}`;
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 2500));

  // Check initial scanning message
  const initialSubtitle = await send('Runtime.evaluate', {
    expression: `document.querySelector('.cv-tile h4, .main h4, h4')?.textContent?.trim()`,
    returnByValue: true
  });
  console.log(`[${targetType.toUpperCase()}] Initial Subtitle:`, initialSubtitle.result.value);

  // Simulate scanning state update message
  await send('Runtime.evaluate', {
    expression: `window.postMessage({
      type: 'ANALYSIS_STATE_UPDATE',
      detail: {
        analysisId: '${analysisId}',
        status: 'RUNNING',
        liveFindings: []
      }
    }, '*')`
  });
  await new Promise(r => setTimeout(r, 300));

  const runningZeroSubtitle = await send('Runtime.evaluate', {
    expression: `document.querySelector('.cv-tile h4, .main h4, h4')?.textContent?.trim()`,
    returnByValue: true
  });
  console.log(`[${targetType.toUpperCase()}] Running (0 findings) Subtitle:`, runningZeroSubtitle.result.value);

  // Simulate first findings arrival
  await send('Runtime.evaluate', {
    expression: `window.postMessage({
      type: 'ANALYSIS_STATE_UPDATE',
      detail: {
        analysisId: '${analysisId}',
        status: 'RUNNING',
        liveFindings: [
          {
            bomRef: 'pkg:crypto/algorithm/aes@256-gcm',
            name: 'AES-256-GCM',
            type: 'cryptographic-asset',
            cryptoProperties: { assetType: 'algorithm' },
            evidence: { occurrences: [{ location: 'sample.ts:15' }] }
          }
        ]
      }
    }, '*')`
  });
  await new Promise(r => setTimeout(r, 500));

  const runningFoundSubtitle = await send('Runtime.evaluate', {
    expression: `document.querySelector('.cv-tile h4, .main h4, h4')?.textContent?.trim()`,
    returnByValue: true
  });
  console.log(`[${targetType.toUpperCase()}] Running (1 finding) Subtitle:`, runningFoundSubtitle.result.value);

  const passed = runningZeroSubtitle.result.value.includes('Scanning (just a second)...') &&
                 !runningZeroSubtitle.result.value.includes('No cryptographic asset') &&
                 runningFoundSubtitle.result.value.includes('1 cryptographic asset found');

  console.log(`[${targetType.toUpperCase()}] RESULT:`, passed ? 'PASSED' : 'CHECK DETAILS');

  chrome.kill();
  return passed;
}

async function main() {
  const types = [
    { type: 'git', name: 'TestGit' },
    { type: 'folder', name: 'TestFolder' },
    { type: 'binary', name: 'TestBinary' },
    { type: 'container', name: 'TestContainer' }
  ];

  let allPassed = true;
  for (const t of types) {
    const res = await testInputType(t.type, t.name);
    if (!res) allPassed = false;
  }

  console.log('\n========================================');
  console.log('ALL FOUR INPUT TYPES TEST:', allPassed ? 'ALL PASSED!' : 'SOME FAILED');
  console.log('========================================');
}

main().catch(console.error);
