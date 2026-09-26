const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  // 1. Create a container analysis
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: 'Test-Container-Input-Check',
      targetType: 'container',
      sourceType: 'CONTAINER_IMAGE'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log('Created Analysis:', analysisId, 'Status:', analysis.status);

  // 2. Launch headless Chrome and open CBOMKit
  const port = 9391;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-type-' + Date.now()
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
  await send('DOM.enable');

  ws.addEventListener('message', evt => {
    const d = JSON.parse(evt.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', d.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=container`;
  console.log('Navigating to', url);
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 4000));

  // 3. Type into the container input field
  console.log('Typing "nginx:alpine" into container image input...');
  const typeRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      if (!input) return { error: 'input not found' };
      input.value = 'nginx:alpine';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        initialVal: input.value,
        placeholder: input.placeholder
      };
    })()`,
    returnByValue: true
  });
  console.log('Input dispatched:', typeRes.result.value);

  // 4. Wait 3 seconds across multiple poll cycles
  console.log('Waiting 3000ms across multiple poll intervals...');
  await new Promise(r => setTimeout(r, 3000));

  // 5. Inspect if the value is STILL retained
  const checkRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      const m = window.cbomModel || window.model;
      const allInputs = Array.from(document.querySelectorAll('input')).map(i => ({
        className: i.className,
        placeholder: i.placeholder,
        value: i.value,
        id: i.id
      }));
      return {
        currentValue: input ? input.value : null,
        scanUrlInModel: m && m.codeOrigin ? m.codeOrigin.scanUrl : null,
        showResults: m ? m.showResults : null,
        isScanning: m && m.scanning ? m.scanning.isScanning : null,
        scanBtnDisabled: scanBtn ? scanBtn.disabled : null,
        allInputs: allInputs
      };
    })()`,
    returnByValue: true
  });
  console.log('Verification after 3s:', checkRes.result.value);

  if (checkRes.result.value.currentValue === 'nginx:alpine') {
    console.log('>>> SUCCESS: Container input "nginx:alpine" was retained and NOT erased!');
  } else {
    console.error('>>> FAILURE: Container input was erased! Current:', checkRes.result.value.currentValue);
  }

  chrome.kill();
}
main().catch(console.error);
