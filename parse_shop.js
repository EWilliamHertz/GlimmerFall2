const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('frontend/src/pages/Shop.jsx', 'utf-8');
try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("No syntax errors found!");
} catch (e) {
  console.error("Syntax Error:", e.message);
  console.error("Loc:", e.loc);
}
