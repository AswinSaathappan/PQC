const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const port = 9389;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-debug-' + Date.now()
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
  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', data.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  console.log('Navigating to http://localhost:8443/?page=cbom:ECDAT-8F9C744B ...');
  await send('Page.navigate', { url: 'http://localhost:8443/?page=cbom:ECDAT-8F9C744B' });
  await new Promise(r => setTimeout(r, 8500));

  // Take screenshot
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/parent_container_verified.png', Buffer.from(ss.data, 'base64'));
  console.log('Screenshot saved to scratch/parent_container_verified.png');

  chrome.kill();
}
main().catch(console.error);
