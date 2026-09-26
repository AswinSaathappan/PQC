const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const port = 9395;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-parent-dett-' + Date.now()
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

  console.log('Navigating to http://localhost:8443/?page=cbom...');
  await send('Page.navigate', { url: 'http://localhost:8443/?page=cbom' });
  await new Promise(r => setTimeout(r, 2000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('cryptavista_selected_analysis_id', 'ECDAT-1649B72B');
      localStorage.setItem('cryptavista_target_type_ECDAT-1649B72B', 'source_code');
    })()`
  });
  await send('Page.navigate', { url: 'http://localhost:8443/?page=cbom' });
  await new Promise(r => setTimeout(r, 5000));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/cbom_dett_fixed.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved screenshot to scratch/cbom_dett_fixed.png');

  chrome.kill();
}
main().catch(console.error);
