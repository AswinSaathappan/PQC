const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  console.log('=== Step 1: Creating fresh Git Analysis ===');
  const aRes = await fetch('http://localhost:3001/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: 'dett-final-test',
      targetType: 'source_code',
      sourceType: 'GIT_REPOSITORY'
    })
  });
  const analysis = await aRes.json();
  const analysisId = analysis.analysisId;
  console.log('Analysis Created:', analysisId, 'Status:', analysis.status, 'TargetType:', analysis.targetType);

  console.log('\n=== Step 2: Opening CBOMKit in Chrome for created Git analysis ===');
  const port = 9388;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,1200',
    '--user-data-dir=C:\\Users\\prane\\AppData\\Local\\Temp\\chrome-git-final-' + Date.now()
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

  const url = `http://localhost:8001/?analysisId=${analysisId}&targetType=source_code`;
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 3000));

  // 1. Verify that before input is given, the input card is displayed and analysis has NOT started
  const beforeInput = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      const searchInput = document.querySelector('.search-bar input.bx--search-input');
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      const h4 = document.querySelector('h4');
      const resultsView = document.querySelector('.cv-tile');
      return {
        showResults: m ? m.showResults : null,
        hasSearchInput: !!searchInput,
        scanBtnDisabled: scanBtn ? scanBtn.disabled : null,
        isScanningVar: typeof isScanning !== 'undefined' ? isScanning : null,
        isScanningActive: window.__isScanningActive,
        h4: h4 ? h4.textContent.trim() : null,
        hasResultsView: !!resultsView
      };
    })()`,
    returnByValue: true
  });

  console.log('State BEFORE input is given:');
  console.log(' - Shows input card (showResults === false):', beforeInput.result.value.showResults === false);
  console.log(' - Search input present:', beforeInput.result.value.hasSearchInput);
  console.log(' - Premature scanning prevented:', !beforeInput.result.value.isScanningActive && !beforeInput.result.value.hasResultsView);

  // Take screenshot of input card
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/git_before_input.png', Buffer.from(ss1.data, 'base64'));

  // 2. Type Git repository URL
  console.log('\n=== Step 3: Providing Git repository input ===');
  const testRepo = 'https://github.com/mafintosh/hypercore';
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      if (input) {
        input.value = '${testRepo}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  const afterTyping = await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-bar input.bx--search-input');
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      return {
        inputValue: input ? input.value : '',
        btnDisabled: scanBtn ? scanBtn.disabled : true
      };
    })()`,
    returnByValue: true
  });
  console.log('After typing input value:', afterTyping.result.value.inputValue);
  console.log('Scan button enabled:', !afterTyping.result.value.btnDisabled);

  // 3. Click Scan button
  console.log('\n=== Step 4: Starting Scan ===');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scanBtn = document.querySelector('.search-button, button.search-button, .search button');
      if (scanBtn) scanBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1200));

  // 4. Check state immediately after scanning started
  const afterStart = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = window.cbomModel || window.model;
      const h4 = document.querySelector('.cv-tile h4, .main h4, h4');
      const tile = document.querySelector('.cv-tile, .main h1');
      return {
        showResults: m ? m.showResults : null,
        isScanningActive: window.__isScanningActive,
        subtitle: h4 ? h4.textContent.trim() : null,
        title: tile ? tile.textContent.trim() : null,
        componentsCount: m && m.cbom && m.cbom.components ? m.cbom.components.length : 0
      };
    })()`,
    returnByValue: true
  });

  console.log('State AFTER scan started:');
  console.log(' - showResults is true:', afterStart.result.value.showResults === true);
  console.log(' - Subtitle is "Scanning (just a second)...":', afterStart.result.value.subtitle === 'Scanning (just a second)...');
  console.log(' - Does NOT contain "(uploaded)":', !afterStart.result.value.title?.includes('(uploaded)'));

  // 5. Check backend status
  const backendCheck = await fetch(`http://localhost:3001/api/analyses/${analysisId}`);
  const backendStatus = await backendCheck.json();
  console.log('Backend Analysis status:', backendStatus.status, '| Repo URL:', backendStatus.repositoryUrl);

  // Take screenshot of scanning state
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/git_after_scan_start.png', Buffer.from(ss2.data, 'base64'));

  console.log('\n=== VERIFICATION SUMMARY ===');
  const check1 = beforeInput.result.value.showResults === false && beforeInput.result.value.hasSearchInput;
  const check2 = afterStart.result.value.showResults === true && afterStart.result.value.subtitle === 'Scanning (just a second)...';
  const check3 = backendStatus.status === 'RUNNING' && backendStatus.repositoryUrl === testRepo;

  console.log('1. Waits for input before starting analysis:', check1 ? 'PASSED' : 'FAILED');
  console.log('2. Successfully receives input and starts scan:', check2 ? 'PASSED' : 'FAILED');
  console.log('3. Backend receives scan with repo URL and runs:', check3 ? 'PASSED' : 'FAILED');

  chrome.kill();
  return check1 && check2 && check3;
}

main().catch(console.error);
