/**
 * Unify all nav patterns to use the premium `.nav .nav__inner` markup.
 * Three patterns get replaced:
 *   1. <header class="site-header">…</header>
 *   2. <nav class="site-nav">…</nav>
 *   3. Any <nav class="nav"> missing the logo icon / hamburger
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);

const PREMIUM_NAV = `<nav class="nav" role="navigation" aria-label="Main navigation">
  <div class="container">
    <div class="nav__inner">
      <a href="/" class="nav__logo" aria-label="CosmicGamesHub home">
        <span class="nav__logo-icon">🎮</span>
        <span class="nav__logo-text">Cosmic<span>Games</span>Hub</span>
      </a>
      <ul class="nav__links">
        <li><a href="/guides/best-gaming-headsets-2026">Headsets</a></li>
        <li><a href="/guides/best-gaming-mice-2026">Mice</a></li>
        <li><a href="/guides/best-gaming-chairs">Chairs</a></li>
        <li><a href="/guides/best-gaming-keyboards-2026">Keyboards</a></li>
        <li><a href="/guides/best-gaming-monitors-2026">Monitors</a></li>
        <li><a href="/games">Games</a></li>
        <li><a href="/versus">Comparisons</a></li>
        <li><a href="/tools/gaming-fps-calculator" class="nav__cta btn">Free Tools</a></li>
      </ul>
      <button class="nav__hamburger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>`;

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

let changed = 0;
const files = getAllHtml(ROOT);

for (const file of files) {
  // skip homepage — it has the correct full nav with hero modifier
  if (path.basename(path.dirname(file)) === path.basename(ROOT) && path.basename(file) === 'index.html') {
    continue;
  }

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Pattern 1: <header class="site-header">…</header>
  const siteHeaderMatch = content.match(/<header\s+class="site-header"[\s\S]*?<\/header>/);
  if (siteHeaderMatch) {
    content = content.replace(siteHeaderMatch[0], PREMIUM_NAV);
    modified = true;
    console.log('[site-header]', path.relative(ROOT, file));
  }

  // Pattern 2: <nav class="site-nav">…</nav>  (exact class, no other classes)
  const siteNavMatch = content.match(/<nav\s+class="site-nav"[\s\S]*?<\/nav>/);
  if (siteNavMatch) {
    content = content.replace(siteNavMatch[0], PREMIUM_NAV);
    modified = true;
    console.log('[site-nav]', path.relative(ROOT, file));
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
}

console.log(`\nTotal files updated: ${changed}`);
