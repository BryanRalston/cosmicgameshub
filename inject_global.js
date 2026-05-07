const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname);

function getAllHtml(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.git', 'screenshots'].includes(e.name)) {
      files.push(...getAllHtml(full));
    } else if (e.isFile() && e.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

const TAG = '<script src="/global.js" defer></script>';
let changed = 0;
const files = getAllHtml(ROOT);
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('/global.js')) {
    console.log('skip:', path.relative(ROOT, f));
    continue;
  }
  if (c.includes('</body>')) {
    c = c.replace('</body>', TAG + '\n</body>');
    fs.writeFileSync(f, c, 'utf8');
    changed++;
    console.log('injected:', path.relative(ROOT, f));
  }
}
console.log('\nTotal injected:', changed);
