const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationName: 'Test-Git-Typing', targetType: 'source_code' })
  });
  const analysis = await aRes.json();
  const port = 9398;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-git-type-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
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
  await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=' + analysis.analysisId + '&targetType=source_code' });
  await new Promise(r => setTimeout(r, 2500));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      if (input) {
        input.value = 'https://github.com/example/repo';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`
  });

  await new Promise(r => setTimeout(r, 2500));

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      return {
        inputValue: input ? input.value : null,
        scanBtnDisabled: scanBtn ? scanBtn.disabled : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Git typing verification:', check.result.value);
  if (check.result.value.inputValue === 'https://github.com/example/repo' && check.result.value.scanBtnDisabled === false) {
    console.log('>>> TEST PASSED: Git input retained and Scan button enabled!');
  } else {
    console.error('>>> TEST FAILED:', check.result.value);
  }
  chrome.kill();
}
main().catch(console.error);
