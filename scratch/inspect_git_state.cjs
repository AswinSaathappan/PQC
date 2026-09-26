const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  const port = 9397;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-debug-git-' + Date.now()
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

  const url = 'http://localhost:8001/?analysisId=ECDAT-1649B72B&targetType=source_code';
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 2000));

  const state = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      const h4 = document.querySelector('h4');
      const tile = document.querySelector('.cv-tile');
      const cardContainers = document.querySelectorAll('.card-container');
      const searchInput = document.querySelector('.search-bar input.bx--search-input');
      return {
        showResults: m ? m.showResults : null,
        codeOrigin: m ? m.codeOrigin : null,
        scanning: m ? m.scanning : null,
        cbom: m ? m.cbom : null,
        h4: h4 ? h4.textContent : null,
        tile: tile ? tile.textContent.slice(0, 100) : null,
        cardContainersCount: cardContainers.length,
        hasSearchInput: !!searchInput,
        isScanningVar: typeof isScanning !== 'undefined' ? isScanning : null,
        windowIsScanningActive: window.__isScanningActive,
        windowIsAnalysisCompleted: window.__isAnalysisCompleted
      };
    })()`,
    returnByValue: true
  });

  console.log('State:', JSON.stringify(state.result.value, null, 2));

  // Now simulate postMessage LOAD_ANALYSIS as CBOM.tsx does:
  console.log('Sending postMessage LOAD_ANALYSIS (status: CREATED)...');
  await send('Runtime.evaluate', {
    expression: `window.postMessage({
      type: 'LOAD_ANALYSIS',
      analysisId: 'ECDAT-1649B72B',
      targetType: 'source_code',
      status: 'CREATED',
      assets: []
    }, '*')`
  });
  await new Promise(r => setTimeout(r, 1000));

  const state2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      const h4 = document.querySelector('h4');
      const cardContainers = document.querySelectorAll('.card-container');
      const searchInput = document.querySelector('.search-bar input.bx--search-input');
      return {
        showResults: m ? m.showResults : null,
        codeOrigin: m ? m.codeOrigin : null,
        cardContainersCount: cardContainers.length,
        hasSearchInput: !!searchInput,
        h4: h4 ? h4.textContent : null
      };
    })()`,
    returnByValue: true
  });

  console.log('State after LOAD_ANALYSIS:', JSON.stringify(state2.result.value, null, 2));

  chrome.kill();
}
test().catch(console.error);
