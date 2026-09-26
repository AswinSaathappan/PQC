const fs = require('fs');
let js = fs.readFileSync('cbomkit/frontend/dist/js/app.658baae5.js', 'utf8');
const oldSe = 'function Se(e,t){ke(e),he(e),o.codeOrigin.uploadedFileName=t,o.showResults=!0}';
const newSe = 'function Se(e,t){ke(e),he(e),((typeof resolveCurrentMode==="function"&&resolveCurrentMode()==="git")||(typeof window!=="undefined"&&(window.__targetType==="source_code"||window.__targetType==="git"))||(t&&(t.startsWith("http")||t.includes(".git")||t.includes("github")||t.includes("gitlab")))?(o.codeOrigin.uploadedFileName=null,o.codeOrigin.gitUrl=t,o.codeOrigin.projectIdentifier=t):(o.codeOrigin.uploadedFileName=t)),o.showResults=!0}';
if (js.includes(oldSe)) {
  js = js.replace(oldSe, newSe);
  fs.writeFileSync('cbomkit/frontend/dist/js/app.658baae5.js', js, 'utf8');
  console.log('Successfully updated Se in app.658baae5.js');
} else {
  console.log('oldSe not found');
}
