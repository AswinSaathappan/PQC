const http = require('http');
const fs = require('fs');
const path = require('path');

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
  const parsed = new URL(url);

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

async function verifyWorkflow(name, targetType, scanTriggerFn) {
  console.log(`\n========================================`);
  console.log(`TESTING WORKFLOW: ${name} (targetType=${targetType})`);
  console.log(`========================================`);

  // 1. Create analysis
  const createRes = await request(`${BACKEND}/api/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationName: `Test-${name}-${Date.now()}`,
      targetType: targetType
    })
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error(`Failed to create analysis:`, createRes.data);
    return { ok: false, error: 'Creation failed' };
  }

  const analysisId = createRes.data.analysisId;
  console.log(`Created analysis: ${analysisId}`);

  // Check initial CBOM endpoint - MUST NOT return 404
  const initCbom = await request(`${BACKEND}/api/analyses/${analysisId}/cbom`);
  console.log(`Initial CBOM status code: ${initCbom.status} (components: ${initCbom.data?.components?.length || 0})`);
  if (initCbom.status === 404) {
    console.error(`CRITICAL: GET /cbom returned 404 before scan!`);
    return { ok: false, error: '404 on initial CBOM' };
  }

  // 2. Start scan
  console.log(`Triggering scan for ${analysisId}...`);
  const scanRes = await scanTriggerFn(analysisId);
  console.log(`Scan response status: ${scanRes.status}`);

  // 3. Monitor polling while RUNNING
  let runningSamples = 0;
  let seenComponentsWhileRunning = [];
  let reachedCompleted = false;
  let finalCbom = null;

  const startTime = Date.now();
  const maxWait = targetType === 'container' ? 65000 : 45000;
  while (Date.now() - startTime < maxWait) {
    const statusRes = await request(`${BACKEND}/api/analyses/${analysisId}/status`);
    const status = statusRes.data?.status;
    const cbomRes = await request(`${BACKEND}/api/analyses/${analysisId}/cbom`);
    const components = cbomRes.data?.components || [];

    if (status === 'RUNNING') {
      runningSamples++;
      if (components.length > 0) {
        seenComponentsWhileRunning.push({
          time: Date.now() - startTime,
          count: components.length,
          names: components.map(c => c.name)
        });
        console.log(`  [RUNNING at ${Date.now() - startTime}ms] CBOM available! Components (${components.length}): ${components.map(c => c.name).join(', ')}`);
      } else {
        console.log(`  [RUNNING at ${Date.now() - startTime}ms] CBOM available with 0 components (scanning/loading state)`);
      }
    } else if (status === 'COMPLETED') {
      reachedCompleted = true;
      finalCbom = cbomRes.data;
      console.log(`  [COMPLETED at ${Date.now() - startTime}ms] Final CBOM reached! Total components: ${components.length}`);
      break;
    } else if (status === 'FAILED') {
      console.error(`  [FAILED] Analysis failed:`, statusRes.data?.errorMessage);
      return { ok: false, error: 'Analysis failed: ' + statusRes.data?.errorMessage };
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Verify duplicates in final CBOM
  const refs = (finalCbom?.components || []).map(c => c['bom-ref']);
  const uniqueRefs = new Set(refs);
  const hasDuplicates = refs.length !== uniqueRefs.size;

  console.log(`Results for ${name}:`);
  console.log(`- Running samples observed: ${runningSamples}`);
  console.log(`- Components observed while RUNNING: ${seenComponentsWhileRunning.length > 0 ? 'YES (' + seenComponentsWhileRunning.length + ' progressive updates)' : 'No intermediate updates before completion'}`);
  console.log(`- Reached COMPLETED: ${reachedCompleted}`);
  console.log(`- Total final components: ${finalCbom?.components?.length || 0}`);
  console.log(`- Any duplicate bom-refs: ${hasDuplicates ? 'YES (BUG)' : 'NO (PASSED)'}`);

  return {
    ok: reachedCompleted && !hasDuplicates,
    name,
    targetType,
    runningObserved: runningSamples > 0,
    incrementalObserved: seenComponentsWhileRunning.length > 0,
    finalComponentCount: finalCbom?.components?.length || 0,
    hasDuplicates
  };
}

async function runAll() {
  console.log('Testing All 4 Workflows for Incremental CBOM Availability...');

  // 1. Folder
  const folderRes = await verifyWorkflow('Folder Upload', 'folder', (id) => {
    return sendMultipart(`${BACKEND}/api/analyses/${id}/scan`, { targetType: 'folder' }, {
      file: { path: path.join(__dirname, 'test_inputs', 'folder_test.zip'), filename: 'folder_test.zip' }
    });
  });

  // 2. Binary
  const binaryRes = await verifyWorkflow('Binary Upload', 'binary', (id) => {
    return sendMultipart(`${BACKEND}/api/analyses/${id}/scan`, { targetType: 'binary' }, {
      file: { path: path.join(__dirname, 'test_inputs', 'binary_test', 'libcryptotest.so'), filename: 'libcryptotest.so' }
    });
  });

  // 3. Source Code (Git)
  const gitRes = await verifyWorkflow('Source Code (Git)', 'source_code', (id) => {
    return sendMultipart(`${BACKEND}/api/analyses/${id}/scan`, {
      targetType: 'source_code',
      repositoryUrl: 'https://github.com/sanman-shelar/post-quantum-cryptography.git'
    }, {});
  });

  // 4. Container
  const containerRes = await verifyWorkflow('Container Image', 'container', (id) => {
    return sendMultipart(`${BACKEND}/api/analyses/${id}/scan`, {
      targetType: 'container',
      imageReference: 'redis:alpine'
    }, {});
  });

  console.log('\n========================================');
  console.log('FINAL VERIFICATION SUMMARY');
  console.log('========================================');
  console.table([folderRes, binaryRes, gitRes, containerRes]);
}

runAll();
