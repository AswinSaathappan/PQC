const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\prane\\.gemini\\antigravity-ide\\brain\\d996186e-c1dc-4b7e-99b2-026c07e538dd\\scratch';

async function runTest() {
  console.log('--- Starting Automated Browser Verification Test ---');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-debug-verify-' + Date.now()
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await new Promise((resolve, reject) => {
      http.get('http://localhost:9223/json', res => {
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

    const consoleLogs = [];
    const jsErrors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push({ type: msg.params.type, text });
        console.log('[BROWSER CONSOLE]', msg.params.type, text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        jsErrors.push(desc);
        console.error('[BROWSER EXCEPTION]', desc);
      }
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    // ==========================================
    // TEST 1: GitHub Input Progressive Flow
    // ==========================================
    console.log('\n>>> Starting Test 1: GitHub Repository Input Flow');
    await send('Page.navigate', { url: 'http://localhost:8443/new-analysis' });
    await new Promise(r => setTimeout(r, 2000));

    // Fill form and submit
    const submitGitRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        // Switch to GitHub tab if needed
        const gitTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('GitHub'));
        if (gitTab) gitTab.click();
        await new Promise(r => setTimeout(r, 200));

        // Find repository input
        const inputs = Array.from(document.querySelectorAll('input'));
        const repoInput = inputs.find(i => i.placeholder && (i.placeholder.includes('github.com') || i.placeholder.includes('repo')));
        if (repoInput) {
          repoInput.value = 'https://github.com/sanman-shelar/post-quantum-cryptography.git';
          repoInput.dispatchEvent(new Event('input', { bubbles: true }));
          repoInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Click Start Analysis
        await new Promise(r => setTimeout(r, 300));
        const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Analysis'));
        if (startBtn) {
          startBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Form submission evaluation:', submitGitRes.result?.value);

    // Immediate state capture (1-2s after submit)
    await new Promise(r => setTimeout(r, 1500));
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test1_git_immediate.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured test1_git_immediate.png');

    // Wait and observe progressive updates
    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const pageInfo = await send('Runtime.evaluate', {
        expression: `({
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 400),
          cardsText: Array.from(document.querySelectorAll('.border')).map(c => c.innerText.trim()).filter(t => t.includes('Crypto') || t.includes('Quantum')).slice(0, 5)
        })`,
        returnByValue: true
      });
      console.log(`[Git Mid-Scan Step #${i}] URL:`, pageInfo.result?.value?.url);
      console.log('Card Texts:', pageInfo.result?.value?.cardsText);

      if (i === 3) {
        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test1_git_midscan.png'), Buffer.from(shot.data, 'base64'));
        console.log('Captured test1_git_midscan.png');
      }
    }

    // Capture final state
    await new Promise(r => setTimeout(r, 3000));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test1_git_final.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured test1_git_final.png');

    // ==========================================
    // TEST 2: Docker Container Progressive Flow
    // ==========================================
    console.log('\n>>> Starting Test 2: Docker Container Input Flow (redis:alpine)');
    await send('Page.navigate', { url: 'http://localhost:8443/new-analysis' });
    await new Promise(r => setTimeout(r, 2000));

    const submitDockerRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        // Switch to Docker Container tab
        const dockerTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Docker') || b.textContent.includes('Container'));
        if (dockerTab) dockerTab.click();
        await new Promise(r => setTimeout(r, 200));

        // Find container input
        const inputs = Array.from(document.querySelectorAll('input'));
        const containerInput = inputs.find(i => i.placeholder && (i.placeholder.includes('image') || i.placeholder.includes('redis') || i.placeholder.includes('nginx')));
        if (containerInput) {
          containerInput.value = 'redis:alpine';
          containerInput.dispatchEvent(new Event('input', { bubbles: true }));
          containerInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Click Start Analysis
        await new Promise(r => setTimeout(r, 300));
        const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Analysis'));
        if (startBtn) {
          startBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Docker submission evaluation:', submitDockerRes.result?.value);

    // Immediate state capture for Docker
    await new Promise(r => setTimeout(r, 1500));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test2_docker_immediate.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured test2_docker_immediate.png');

    // Wait and observe progressive updates for container scan
    for (let i = 1; i <= 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pageInfo = await send('Runtime.evaluate', {
        expression: `({
          url: window.location.href,
          cardsText: Array.from(document.querySelectorAll('.border')).map(c => c.innerText.trim()).filter(t => t.includes('Crypto') || t.includes('Quantum')).slice(0, 5)
        })`,
        returnByValue: true
      });
      console.log(`[Docker Mid-Scan Step #${i}] Cards:`, pageInfo.result?.value?.cardsText);
      if (i === 5) {
        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test2_docker_midscan.png'), Buffer.from(shot.data, 'base64'));
        console.log('Captured test2_docker_midscan.png');
      }
    }

    // Capture final Docker state
    await new Promise(r => setTimeout(r, 5000));
    shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test2_docker_final.png'), Buffer.from(shot.data, 'base64'));
    console.log('Captured test2_docker_final.png');

    // Summary of JS exceptions
    console.log('\n--- Test Verification Summary ---');
    console.log('Total JS Exceptions detected:', jsErrors.length);
    if (jsErrors.length > 0) {
      console.error('JS Exceptions:', jsErrors);
    } else {
      console.log('Clean execution: 0 ReferenceErrors or unhandled JS exceptions.');
    }

    ws.close();
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    chrome.kill();
  }
}

runTest();
