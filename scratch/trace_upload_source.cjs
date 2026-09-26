const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  const port = 9399;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-debug-trace-' + Date.now()
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

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__stackTraces = [];
      const checkInterval = setInterval(() => {
        const m = window.cbomModel || window.model;
        if (m && m.codeOrigin) {
          clearInterval(checkInterval);
          let val = m.codeOrigin.uploadedFileName;
          Object.defineProperty(m.codeOrigin, 'uploadedFileName', {
            get() { return val; },
            set(newVal) {
              val = newVal;
              if (newVal) {
                try { throw new Error('SET uploadedFileName=' + newVal); } catch(e) { window.__stackTraces.push(e.stack); }
              }
            }
          });
        }
      }, 5);
    `
  });

  await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-1649B72B&targetType=source_code' });
  await new Promise(r => setTimeout(r, 3000));

  const traces = await send('Runtime.evaluate', {
    expression: 'window.__stackTraces',
    returnByValue: true
  });
  console.log('Stack traces of uploadedFileName:');
  console.log(traces.result.value);

  chrome.kill();
}
test().catch(console.error);
