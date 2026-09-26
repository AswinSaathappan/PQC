const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: 'TestGitEnterKey',
      targetType: 'source_code',
      sourceType: 'GIT_REPOSITORY'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log('Created Analysis:', analysisId);

  const port = 9392;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-git-enter-' + Date.now()
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

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=source_code`;
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Typing repository URL and pressing Enter...');
  const testRepoUrl = 'https://github.com/mafintosh/hypercore';
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      if (input) {
        input.value = '${testRepoUrl}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const m = window.cbomModel || window.model;
        if (m && m.codeOrigin) {
          m.codeOrigin.scanUrl = '${testRepoUrl}';
        }
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const afterEnterCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      const h4 = document.querySelector('.cv-tile h4, .main h4, h4');
      const tile = document.querySelector('.cv-tile, .main h1');
      return {
        showResults: m ? m.showResults : null,
        isScanningActive: window.__isScanningActive,
        subtitle: h4 ? h4.textContent.trim() : null,
        title: tile ? tile.textContent.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('After Enter Check:', afterEnterCheck.result.value);

  const backendCheck = await fetch(`http://localhost:3001/api/analyses/${analysisId}`);
  const backendAnalysis = await backendCheck.json();
  console.log('Backend Analysis after Enter:', {
    analysisId: backendAnalysis.analysisId,
    status: backendAnalysis.status,
    repositoryUrl: backendAnalysis.repositoryUrl
  });

  chrome.kill();
}
main().catch(console.error);
