const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\prane\\.gemini\\antigravity-ide\\brain\\d996186e-c1dc-4b7e-99b2-026c07e538dd\\scratch';

async function main() {
  console.log('--- Launching Chrome for Browser Flow Test ---');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-debug-flow-' + Date.now()
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await new Promise((resolve, reject) => {
      http.get('http://localhost:9224/json', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const target = listRes[0];
    const wsUrl = target.webSocketDebuggerUrl;
    console.log('Connected to Chrome DevTools at:', wsUrl);

    const ws = new WebSocket(wsUrl);
    await new Promise(resolve => ws.onopen = resolve);

    let reqId = 0;
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = ++reqId;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    // 1. Test existing analysis on CBOM page
    console.log('\nNavigating to CBOM page for ECDAT-042AC679 (Folder analysis with AES-256-GCM)...');
    await send('Page.navigate', { url: 'http://localhost:8443/?page=cbom%3AECDAT-042AC679' });
    await new Promise(r => setTimeout(r, 3000));

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbom_page_loaded.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured cbom_page_loaded.png');

    // Check iframe presence and metrics cards
    const pageCheck = await send('Runtime.evaluate', {
      expression: `({
        url: window.location.href,
        hasIframe: !!document.querySelector('iframe'),
        iframeSrc: document.querySelector('iframe')?.src,
        cardCount: document.querySelectorAll('.border').length,
        bodyExcerpt: document.body.innerText.substring(0, 300)
      })`,
      returnByValue: true
    });
    console.log('Parent Page Check:', pageCheck.result?.value);

    // 2. Direct inspection of CBOMKit in iframe URL
    console.log('\nNavigating directly to CBOMKit with analysis ID ECDAT-042AC679...');
    await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-042AC679' });
    await new Promise(r => setTimeout(r, 3000));

    const cbomkitCheck = await send('Runtime.evaluate', {
      expression: `({
        url: window.location.href,
        showResults: window.cbomModel?.showResults,
        componentCount: window.cbomModel?.cbom?.components?.length,
        components: window.cbomModel?.cbom?.components?.map(c => c.name),
        isScanning: window.cbomModel?.scanning?.isScanning,
        scanningStatus: window.cbomModel?.scanning?.scanningStatus,
        tableRows: document.querySelectorAll('table tbody tr').length,
        bodyExcerpt: document.body.innerText.substring(0, 300)
      })`,
      returnByValue: true
    });
    console.log('CBOMKit State:', cbomkitCheck.result?.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_rendered.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured cbomkit_rendered.png');

    // 3. Test Binary Analysis ECDAT-B1C7A58A
    console.log('\nNavigating directly to CBOMKit for Binary ECDAT-B1C7A58A...');
    await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-B1C7A58A' });
    await new Promise(r => setTimeout(r, 3000));

    const binCheck = await send('Runtime.evaluate', {
      expression: `({
        componentCount: window.cbomModel?.cbom?.components?.length,
        components: window.cbomModel?.cbom?.components?.map(c => c.name),
        showResults: window.cbomModel?.showResults
      })`,
      returnByValue: true
    });
    console.log('Binary CBOMKit State:', binCheck.result?.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_binary_rendered.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured cbomkit_binary_rendered.png');

    // 4. Test Git Analysis ECDAT-5DC75136
    console.log('\nNavigating directly to CBOMKit for Git ECDAT-5DC75136...');
    await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-5DC75136' });
    await new Promise(r => setTimeout(r, 3000));

    const gitCheck = await send('Runtime.evaluate', {
      expression: `({
        componentCount: window.cbomModel?.cbom?.components?.length,
        components: window.cbomModel?.cbom?.components?.map(c => c.name),
        showResults: window.cbomModel?.showResults
      })`,
      returnByValue: true
    });
    console.log('Git CBOMKit State:', gitCheck.result?.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_git_rendered.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured cbomkit_git_rendered.png');

    // 5. Test Container Analysis ECDAT-39A9CEE1
    console.log('\nNavigating directly to CBOMKit for Container ECDAT-39A9CEE1...');
    await send('Page.navigate', { url: 'http://localhost:8001/?analysisId=ECDAT-39A9CEE1' });
    await new Promise(r => setTimeout(r, 3000));

    const containerCheck = await send('Runtime.evaluate', {
      expression: `({
        componentCount: window.cbomModel?.cbom?.components?.length,
        components: window.cbomModel?.cbom?.components?.slice(0, 10).map(c => c.name),
        showResults: window.cbomModel?.showResults
      })`,
      returnByValue: true
    });
    console.log('Container CBOMKit State:', containerCheck.result?.value);

    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'cbomkit_container_rendered.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured cbomkit_container_rendered.png');

    ws.close();
    console.log('\n--- All Browser Flow Checks Completed Successfully! ---');
  } catch (err) {
    console.error('Browser Test Error:', err);
  } finally {
    chrome.kill();
  }
}

main();
