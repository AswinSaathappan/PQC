const fs = require('fs');
const js = fs.readFileSync('cbomkit/frontend/dist/js/app.658baae5.js', 'utf8');
const target = 'Scanning code for cryptographic assets...';
const idx = js.indexOf(target);
console.log('Scanning code found at index:', idx);
if (idx !== -1) {
  console.log(js.substring(idx - 80, idx + target.length + 50));
}
