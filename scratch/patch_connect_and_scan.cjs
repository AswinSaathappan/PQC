const fs = require('fs');
const filePath = 'cbomkit/frontend/dist/js/app.658baae5.js';
let content = fs.readFileSync(filePath, 'utf8');
const target = 'function j(e,t,a){const _p=new URLSearchParams(window.location.search);if(_p.get("targetType")==="folder"||window.__targetType==="folder"||_p.get("targetType")==="binary"||window.__targetType==="binary"||_p.get("targetType")==="container"||window.__targetType==="container")return;';
const replacement = 'function j(e,t,a){if(typeof window!=="undefined"&&typeof window.__startGitScan==="function"){const _s=document.querySelector(".search-bar input.bx--search-input");const _v=(_s?_s.value:"")||(o.codeOrigin&&o.codeOrigin.scanUrl)||"";if(_v&&_v.trim()){window.__startGitScan(_v.trim());return;}}const _p=new URLSearchParams(window.location.search);if(_p.get("targetType")==="folder"||window.__targetType==="folder"||_p.get("targetType")==="binary"||window.__targetType==="binary"||_p.get("targetType")==="container"||window.__targetType==="container")return;';

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully patched function j in app.658baae5.js');
} else {
  console.log('Target not found in app.658baae5.js');
}
