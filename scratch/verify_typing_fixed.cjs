const { spawn } = require('child_process');
const http = require('http');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  // 1. Create a container analysis
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: 'Test-Container-Typing',
      targetType: 'container',
      sourceType: 'CONTAINER_IMAGE'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log('Created Analysis:', analysisId, 'Status:', analysis.status);

  // 2. Launch headless Chrome and open CBOMKit in container mode
  const port = 9394;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-type-test-' + Date.now()
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

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=container`;
  console.log('Navigating to', url);
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 3000));

  // 3. Type "nginx:latest" into the container image input
  console.log('Simulating typing "nginx:latest" into the container input...');
  const textToType = 'nginx:latest';
  for (let i = 1; i <= textToType.length; i++) {
    const substr = textToType.substring(0, i);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('.search-bar input.bx--search-input');
        if (input) {
          input.value = ${JSON.stringify(substr)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 100)); // 100ms per character
  }

  // Final change event
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      if (input) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`
  });

  console.log('Finished typing. Now waiting 3.5 seconds across 7 poll / applyMode intervals...');
  await new Promise(r => setTimeout(r, 3500));

  // 4. Verify value is NOT erased
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      const m = window.cbomModel || window.model;
      return {
        inputValue: input ? input.value : null,
        inputPlaceholder: input ? input.placeholder : null,
        modelScanUrl: m && m.codeOrigin ? m.codeOrigin.scanUrl : null,
        scanBtnDisabled: scanBtn ? scanBtn.disabled : null,
        scanBtnHasClassDisabled: scanBtn ? scanBtn.classList.contains('bx--btn--disabled') : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Verification Result:', result.result.value);

  if (result.result.value.inputValue === 'nginx:latest') {
    console.log('>>> TEST PASSED: Container input was NOT erased after typing!');
  } else {
    console.error('>>> TEST FAILED: Container input was erased! Value is:', result.result.value.inputValue);
  }

  if (result.result.value.scanBtnDisabled === false) {
    console.log('>>> TEST PASSED: Scan button is ENABLED and ready to scan!');
  } else {
    console.error('>>> TEST FAILED: Scan button is still disabled!');
  }

  chrome.kill();
}
main().catch(console.error);
