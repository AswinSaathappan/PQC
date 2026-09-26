const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\prane\\.gemini\\antigravity-ide\\brain\\d996186e-c1dc-4b7e-99b2-026c07e538dd\\scratch';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BACKEND = 'http://localhost:3001';

async function request(url, options = {}) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function sendMultipart(url, fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  for (const [k, f] of Object.entries(files)) {
    const fileContent = fs.readFileSync(f.path);
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${f.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(fileContent);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const fullBody = Buffer.concat(parts);

  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function main() {
  console.log('--- Testing Live Progressive Rendering During RUNNING ---');

  // 1. Create analysis for Git scan
  const createRes = await request(`${BACKEND}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: `Live-Test-${Date.now()}`,
      targetType: 'source_code'
    })
  });

  const analysisId = createRes.data.analysisId;
  console.log(`Created Analysis ID: ${analysisId}`);

  // 2. Launch Chrome
  const port = 9350 + Math.floor(Math.random() * 40);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    `--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-live-${Date.now()}`
  ]);
  let list = null;
  for (let i = 0; i < 15; i++) {
    try {
      list = await new Promise((resolve, reject) => {
        const r = http.get(`http://127.0.0.1:${port}/json`, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d)));
        });
        r.on('error', reject);
      });
      if (list && list.length > 0) break;
    } catch {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  if (!list || list.length === 0) {
    throw new Error('Could not connect to Chrome debugging port');
  }

  try {
    const pageTarget = list.find(t => t.type === 'page') || list[0];
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

    await send('Runtime.enable');
    await send('Page.enable');

    // 3. Open CBOMKit directly for this analysis ID
    console.log(`Navigating to CBOMKit: http://localhost:8001/?analysisId=${analysisId}...`);
    await send('Page.navigate', { url: `http://localhost:8001/?analysisId=${analysisId}` });
    await new Promise(r => setTimeout(r, 2000));

    // Initial state before scan
    let cbomkitState = await send('Runtime.evaluate', {
      expression: `({
        showResults: window.cbomModel?.showResults,
        isScanning: window.cbomModel?.scanning?.isScanning,
        scanningStatus: window.cbomModel?.scanning?.scanningStatus,
        componentsCount: window.cbomModel?.cbom?.components?.length
      })`,
      returnByValue: true
    });
    console.log('Initial CBOMKit state (before scan):', cbomkitState.result?.value);

    // 4. Trigger Scan on backend
    console.log('Triggering Git scan on backend...');
    sendMultipart(`${BACKEND}/api/analyses/${analysisId}/scan`, {
      targetType: 'source_code',
      repositoryUrl: 'https://github.com/sanman-shelar/post-quantum-cryptography.git'
    }, {}).then(r => console.log('Scan API call completed on backend.'));

    // 5. Monitor and verify CBOMKit state while RUNNING
    let capturedMidScan = false;
    let finalReached = false;
    const start = Date.now();

    while (Date.now() - start < 30000) {
      await new Promise(r => setTimeout(r, 400));
      const statusRes = await request(`${BACKEND}/api/analyses/${analysisId}/status`);
      const status = statusRes.data?.status;

      cbomkitState = await send('Runtime.evaluate', {
        expression: `({
          showResults: window.cbomModel?.showResults,
          isScanning: window.cbomModel?.scanning?.isScanning,
          scanningStatus: window.cbomModel?.scanning?.scanningStatus,
          componentsCount: window.cbomModel?.cbom?.components?.length,
          components: window.cbomModel?.cbom?.components?.map(c => c.name),
          liveDetectionsCount: window.cbomModel?.scanning?.liveDetections?.length,
          bodyExcerpt: document.body.innerText.substring(0, 200)
        })`,
        returnByValue: true
      });

      const s = cbomkitState.result?.value;
      console.log(`[T+${Date.now() - start}ms] Backend Status: ${status} | CBOMKit: showResults=${s?.showResults}, isScanning=${s?.isScanning}, components=${s?.componentsCount}, liveDetections=${s?.liveDetectionsCount}`);

      if (status === 'RUNNING' && s?.componentsCount > 0 && !capturedMidScan) {
        capturedMidScan = true;
        console.log(`>>> SUCCESS! Real cryptographic components detected and rendered in CBOMKit while status is RUNNING:`, s.components);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_live_running_graph.png'), Buffer.from(shot.data, 'base64'));
        console.log(`Saved screenshot during RUNNING to cbomkit_live_running_graph.png`);
      }

      if (status === 'COMPLETED') {
        finalReached = true;
        console.log(`Analysis reached COMPLETED at T+${Date.now() - start}ms! Final components:`, s?.components);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_completed_final_graph.png'), Buffer.from(shot.data, 'base64'));
        console.log(`Saved final screenshot to cbomkit_completed_final_graph.png`);
        break;
      }
    }

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log(`1. Captured mid-scan while RUNNING: ${capturedMidScan ? 'YES (PASSED)' : 'NO (FAILED)'}`);
    console.log(`2. Final state reached COMPLETED: ${finalReached ? 'YES (PASSED)' : 'NO (FAILED)'}`);

    ws.close();
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

main();
