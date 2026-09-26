const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const port = 9397;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-trace-' + Date.now()
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
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const interval = setInterval(() => {
        const m = window.cbomModel || window.model;
        if (m) {
          clearInterval(interval);
          let val = m.showResults;
          Object.defineProperty(m, 'showResults', {
            get() { return val; },
            set(newV) {
              console.log('[TRACE showResults] changed to:', newV, (new Error().stack || ''));
              val = newV;
            }
          });
        }
      }, 5);
    `
  });

  ws.addEventListener('message', evt => {
    const d = JSON.parse(evt.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', d.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  console.log('Navigating to ECDAT-7759700F...');
  await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-7759700F&targetType=container' });
  await new Promise(r => setTimeout(r, 4500));

  chrome.kill();
}
main().catch(console.error);
