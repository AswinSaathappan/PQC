const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\prane\\.gemini\\antigravity-ide\\brain\\d996186e-c1dc-4b7e-99b2-026c07e538dd\\scratch';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const port = 9300 + Math.floor(Math.random() * 50);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    `--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-test-${Date.now()}`
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const pageTarget = list.find(t => t.type === 'page') || list[0];
    console.log('Target found:', pageTarget.title, pageTarget.url);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = ++id;
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), 10000);
      const onMsg = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          clearTimeout(timeout);
          ws.removeEventListener('message', onMsg);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        console.log('[BROWSER CONSOLE]', msg.params.type, text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        console.error('[BROWSER EXCEPTION]', desc);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');

    const navigateAndWait = async (url) => {
      console.log(`Navigating to ${url}...`);
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1500));
      for (let i = 0; i < 30; i++) {
        const readyState = await send('Runtime.evaluate', { expression: 'document.readyState' });
        if (readyState.result?.value === 'complete') {
          console.log(`Page reached readyState=complete at ${(i + 1) * 500 + 1500}ms`);
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      await new Promise(r => setTimeout(r, 3000));
    };

    console.log('Navigating to CBOMKit for ECDAT-042AC679 (Folder scan)...');
    await navigateAndWait('http://localhost:8001/?analysisId=ECDAT-042AC679');

    const evalResult = await send('Runtime.evaluate', {
      expression: `({
        showResults: window.cbomModel?.showResults,
        componentCount: window.cbomModel?.cbom?.components?.length,
        components: window.cbomModel?.cbom?.components?.map(c => c.name),
        isScanning: window.cbomModel?.scanning?.isScanning,
        scanningStatus: window.cbomModel?.scanning?.scanningStatus,
        hasTable: !!document.querySelector('table'),
        bodyText: document.body.innerText.substring(0, 300)
      })`,
      returnByValue: true
    });
    console.log('Evaluated CBOMKit State:', evalResult.result?.value);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(ARTIFACTS_DIR, 'cbomkit_folder_verified.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to ${shotPath}`);

    // Now test parent Cryptavista app with embedded iframe
    await navigateAndWait('http://localhost:8443/?page=cbom%3AECDAT-042AC679');
    console.log('Waiting for splash screen to fade...');
    await new Promise(r => setTimeout(r, 4000));

    const parentEval = await send('Runtime.evaluate', {
      expression: `({
        url: window.location.href,
        hasIframe: !!document.querySelector('iframe'),
        iframeSrc: document.querySelector('iframe')?.getAttribute('src'),
        metricCardCount: document.querySelectorAll('.border').length,
        bodyExcerpt: document.body.innerText.substring(0, 400)
      })`,
      returnByValue: true
    });
    console.log('Evaluated Parent Page State:', parentEval.result?.value);

    const parentShot = await send('Page.captureScreenshot', { format: 'png' });
    const parentShotPath = path.join(ARTIFACTS_DIR, 'parent_cbom_page_verified.png');
    fs.writeFileSync(parentShotPath, Buffer.from(parentShot.data, 'base64'));
    console.log(`Saved screenshot to ${parentShotPath}`);

    ws.close();
    console.log('\n--- Direct Chrome CDP Test Succeeded! ---');
  } catch (e) {
    console.error('Test error:', e);
  } finally {
    chrome.kill();
  }
}

main();
