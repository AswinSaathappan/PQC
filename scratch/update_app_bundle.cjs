const fs = require('fs');
const filePath = 'cbomkit/frontend/dist/js/app.658baae5.js';
let js = fs.readFileSync(filePath, 'utf8');

// 1. Replace "Scanning code for cryptographic assets..."
const s1 = '"Scanning code for cryptographic assets..."';
const r1 = '"Scanning (just a second)..."';
if (js.includes(s1)) {
  js = js.replace(s1, r1);
  console.log('Replaced s1');
} else {
  console.log('s1 not found');
}

// 2. Replace fallback "No cryptographic asset has been found."
const s2 = ':"No cryptographic asset has been found."';
const r2 = ':(typeof window!=="undefined"&&(window.__isScanningActive||!window.__isAnalysisCompleted)?"Scanning (just a second)...":"No cryptographic asset has been found.")';
if (js.includes(s2)) {
  js = js.replace(s2, r2);
  console.log('Replaced s2');
} else {
  console.log('s2 not found');
}

fs.writeFileSync(filePath, js, 'utf8');
console.log('app.658baae5.js updated successfully!');
