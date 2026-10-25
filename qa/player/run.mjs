// Player suite. Real coordinates, immediate typing, pixel checks.
// No element.click() and no evaluate() used to perform a player action.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { decodePng, hueOf } from './png.mjs';
import { measureFps, measureLighthouse } from './perf.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = normalize(join(here, '..', '..'));
const shots = join(here, 'shots');
const PORT = 8772;
const SMOKE = process.argv.includes('smoke');
const SKIP_PERF = process.argv.includes('--skip-perf');
const ONLY = process.argv.filter((arg) => arg.startsWith('only:')).map((arg) => arg.slice(5));
const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const NAMES = ['fifteen', 'mirror tower', 'zxc rdt', 'rrr mmm fgh', 'one brick', 'three far', 'six zebra', 'fifteen spread', 'qwerty mx'];
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

mkdirSync(shots, { recursive: true });
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(id, name, fn) {
  if (ONLY.length && !ONLY.some((part) => id.indexOf(part) >= 0)) return;
  try {
    const detail = await fn();
    results.push({ id, name, pass: true, detail: detail || '' });
    console.log('PASS', id, name, detail || '');
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    results.push({ id, name, pass: false, detail });
    console.log('FAIL', id, name, detail);
  }
}

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(repo, path));
    if (!file.startsWith(repo)) {
      res.writeHead(403); res.end(); return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('missing');
    }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function gameUrl(tag) {
  return 'http://127.0.0.1:' + PORT + '/games/brix3d.html?player=' + tag + '&t=' + Date.now();
}

function watch(page) {
  page._dialogs = [];
  page._errors = [];
  page.on('dialog', async (d) => {
    page._dialogs.push(d.type() + ':' + d.message());
    try { await d.dismiss(); } catch { /* already handled */ }
  });
  page.on('pageerror', (e) => page._errors.push(String(e && e.message ? e.message : e)));
}

function badDialogs(page, from) {
  return page._dialogs.slice(from || 0).filter((s) => !s.startsWith('beforeunload'));
}

async function launch() {
  const opts = { headless: false, args: ['--force-color-profile=srgb'] };
  try {
    return await chromium.launch({ ...opts, channel: 'chrome' });
  } catch (err) {
    console.log('chrome channel unavailable', err.message);
    return chromium.launch(opts);
  }
}

async function openPage(browser, phone, tag) {
  const context = await browser.newContext(phone ? {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    userAgent: phoneUA
  } : {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  page.__phone = !!phone;
  watch(page);
  await page.goto(gameUrl(tag), { waitUntil: 'domcontentloaded' });
  return { context, page };
}

async function clickAt(page, x, y, opts) {
  if (!page.__phone) {
    await page.mouse.click(x, y, opts || {});
    return;
  }
  const onCanvas = await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    return !!(el && el.tagName === 'CANVAS');
  }, [x, y]);
  await page.touchscreen.tap(x, y);
  if (!onCanvas) await page.mouse.click(x, y, opts || {});
}

async function clickLoc(page, locator, opts) {
  const box = await locator.boundingBox();
  if (!box || box.width < 2 || box.height < 2) throw new Error('no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await clickAt(page, x, y, opts);
  return { x, y, box };
}

async function clickSel(page, selector, opts) {
  return clickLoc(page, page.locator(selector).first(), opts);
}

async function typeInto(page, box, name, how) {
  const x = how === 'append' ? box.x + Math.max(8, box.width - 8) : box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (how === 'triple') {
    if (page.__phone) {
      await clickAt(page, x, y);
      await clickAt(page, x, y);
      await clickAt(page, x, y);
    } else {
      await page.mouse.click(x, y, { clickCount: 3, delay: 35 });
    }
  } else {
    await clickAt(page, x, y);
  }
  await page.keyboard.type(name, { delay: 40 });
}

async function armName(page) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const phoneOk = await page.locator('#phoneTutorialOk').boundingBox().catch(() => null);
    if (phoneOk && phoneOk.width > 4) {
      await clickAt(page, phoneOk.x + phoneOk.width / 2, phoneOk.y + phoneOk.height / 2);
    }
    if (page.__phone) {
      const toggle = await page.locator('#panelToggle').boundingBox().catch(() => null);
      if (!toggle || toggle.width < 4) continue;
      await clickAt(page, toggle.x + toggle.width / 2, toggle.y + toggle.height / 2);
      const open = await page.locator('#controls').evaluate((el) => el.classList.contains('tray-open')).catch(() => false);
      if (!open) continue;
      const field = await page.locator('#projectName').boundingBox();
      if (field && field.width > 4) return field;
      continue;
    }
    const skip = await page.locator('#tutorialSkip').boundingBox().catch(() => null);
    if (skip && skip.width > 4) {
      await clickAt(page, skip.x + skip.width / 2, skip.y + skip.height / 2);
    }
    const field = await page.locator('#projectName').boundingBox().catch(() => null);
    if (field && field.width > 4 && field.y >= 0 && field.y < page.viewportSize().height) return field;
  }
  throw new Error('name field never became clickable');
}

async function hotState(page) {
  return page.evaluate(() => {
    const cls = (id, c) => {
      const el = document.getElementById(id);
      return !!(el && el.classList.contains(c));
    };
    return {
      value: (document.getElementById('projectName') || {}).value || '',
      rot: ((document.getElementById('hudRotLabel') || {}).textContent || '').trim(),
      mirror: cls('mirrorPopup', 'visible'),
      tool: cls('buildToolPopup', 'visible'),
      move: cls('moveModeIndicator', 'visible'),
      del: document.body.classList.contains('delete-mode'),
      floor: cls('floorBtn', 'floor-active'),
      wall: cls('wallBtn', 'wall-active'),
      drop: cls('dropperBtn', 'dropper-active'),
      paint: cls('paintBtn', 'paint-active')
    };
  });
}

function assertClean(state, expected, dialogs) {
  const problems = [];
  if (state.value !== expected) problems.push('value "' + state.value + '" != "' + expected + '"');
  if (state.rot && state.rot !== '0°') problems.push('rotation ' + state.rot);
  if (state.mirror) problems.push('mirror');
  if (state.tool) problems.push('floor/wall panel');
  if (state.move) problems.push('move');
  if (state.del) problems.push('delete');
  if (state.floor) problems.push('floor');
  if (state.wall) problems.push('wall');
  if (state.drop) problems.push('dropper');
  if (state.paint) problems.push('paint');
  if (dialogs.length) problems.push('dialog ' + dialogs.join(' | '));
  if (problems.length) throw new Error(problems.join('; '));
}

async function ready(page) {
  await page.waitForFunction(() => {
    if (!window.brixCanPlace || !window.camera || !document.querySelector('#container canvas')) return false;
    const loading = document.getElementById('loadingScreen');
    const loadingGone = !loading || loading.classList.contains('hide') || loading.style.display === 'none';
    if (!loadingGone) return false;
    const modal = document.getElementById('tutorialModal');
    const phone = document.getElementById('phoneTutorial');
    if (modal && modal.classList.contains('visible')) return true;
    if (phone && !phone.hidden) return true;
    try { if (localStorage.getItem('brickBuilderTutorialDismissed') === 'true') return true; } catch (e) {}
    return false;
  }, null, { timeout: 45000 });
  const skip = await page.locator('#tutorialSkip').boundingBox().catch(() => null);
  if (skip && skip.width > 4) await clickAt(page, skip.x + skip.width / 2, skip.y + skip.height / 2);
  const phoneOk = await page.locator('#phoneTutorialOk').boundingBox().catch(() => null);
  if (phoneOk && phoneOk.width > 4) await clickAt(page, phoneOk.x + phoneOk.width / 2, phoneOk.y + phoneOk.height / 2);
  const daily = await page.locator('[data-daily-dismiss]').boundingBox().catch(() => null);
  if (daily && daily.width > 4 && daily.y > 0 && daily.y < page.viewportSize().height) {
    await clickAt(page, daily.x + daily.width / 2, daily.y + daily.height / 2);
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function ensureDrawer(page) {
  if (!page.__phone) return;
  const open = await page.locator('#controls').evaluate((el) => el.classList.contains('tray-open'));
  if (!open) await clickSel(page, '#panelToggle');
}

async function scrollUntil(page, locator) {
  const vp = page.viewportSize();
  for (let i = 0; i < 16; i++) {
    const b = await locator.boundingBox().catch(() => null);
    if (b && b.width > 4 && b.height > 4 && b.y > 4 && b.y + b.height < vp.height - 4 && b.x > -2 && b.x + b.width < vp.width + 2) return b;
    const tray = await page.locator(page.__phone ? '.tray-scroll' : '#controls').first().boundingBox();
    if (!tray) break;
    if (page.__phone) {
      const client = await page.context().newCDPSession(page);
      const x = tray.x + Math.min(40, tray.width / 2);
      const y = Math.min(vp.height - 30, tray.y + Math.min(70, tray.height / 2));
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 120, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(tray.x + 36, Math.min(tray.y + 180, vp.height - 40));
      await page.mouse.wheel(0, 360);
    }
  }
  const last = await locator.boundingBox().catch(() => null);
  if (last && last.width > 4) return last;
  throw new Error('could not reveal control');
}

async function openSection(page, label) {
  await ensureDrawer(page);
  const loc = page.locator('.section-title', { hasText: label }).first();
  const b = await scrollUntil(page, loc);
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2);
}

async function brickCount(page) {
  const t = await page.locator('#brickCount').textContent();
  return parseInt(t || '0', 10) || 0;
}

function findStud(img, fx) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const y0 = Math.floor(h * 0.5);
  const y1 = Math.floor(h * 0.7);
  const xMid = Math.floor(w * (0.22 + fx * 0.56));
  let best = null;
  let bestScore = 0;
  for (let y = y0; y < y1; y += 3) {
    for (let x = Math.max(2, xMid - 80); x < Math.min(w - 2, xMid + 80); x += 3) {
      const i = (y * w + x) * 4;
      const g = data[i + 1];
      if (!(g > 80 && g > data[i] && g > data[i + 2] + 4)) continue;
      const diff = Math.abs(data[(y * w + x + 2) * 4 + 1] - g);
      if (diff > bestScore) {
        bestScore = diff;
        best = { x, y };
      }
    }
  }
  return bestScore > 12 ? best : null;
}

async function clickStud(page, fx, stack) {
  const shot = await grabCanvas(page);
  let pt = null;
  if (stack) {
    const blob = brickBlob(shot.img, plateInset(page, shot));
    if (blob.n > 12) pt = { x: blob.cx, y: blob.cy };
  }
  if (!pt) pt = findStud(shot.img, fx);
  if (!pt) throw new Error('no stud in view at ' + fx);
  const x = shot.clip.x + pt.x / shot.dpr;
  const y = shot.clip.y + pt.y / shot.dpr;
  await placeAt(page, x, y);
  return { x, y };
}

async function locateStud(page, fx) {
  const shot = await grabCanvas(page);
  const pt = findStud(shot.img, fx);
  if (!pt) throw new Error('no stud in view at ' + fx);
  return { x: shot.clip.x + pt.x / shot.dpr, y: shot.clip.y + pt.y / shot.dpr };
}

async function waitGrown(page, before, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await brickCount(page)) > before) return true;
  }
  return false;
}

async function placeAt(page, x, y) {
  const before = await brickCount(page);
  await clickAt(page, x, y);
  if (await waitGrown(page, before, 1600)) return;
  await clickAt(page, x, Math.min(page.viewportSize().height - 8, y + 18));
  if (await waitGrown(page, before, 2200)) return;
  throw new Error('no brick at ' + Math.round(x) + ',' + Math.round(y) + ' count ' + before);
}

async function grabCanvas(page, file) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = await page.locator('#container canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const vp = page.viewportSize();
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(1, Math.min(box.x + box.width, vp.width) - Math.max(0, box.x)),
    height: Math.max(1, Math.min(box.y + box.height, vp.height) - Math.max(0, box.y))
  };
  const buf = await page.screenshot({ type: 'png', clip });
  if (file) writeFileSync(join(shots, file), buf);
  const img = decodePng(buf);
  const dpr = img.width / clip.width;
  return { img, clip, dpr };
}

function isRed(r, g, b) {
  return r > 140 && r > g + 28 && r > b + 28;
}

function redBlob(img) {
  const { width, height, data } = img;
  let n = 0;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!isRed(data[i], data[i + 1], data[i + 2])) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sx += x;
      sy += y;
    }
  }
  if (!n) return { n: 0 };
  return { n, minX, maxX, minY, maxY, cx: sx / n, cy: sy / n, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function brickBlob(img, insetLeft) {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const y0 = Math.floor(h * 0.18);
  const y1 = Math.floor(h * 0.84);
  const x0 = insetLeft || 0;
  let best = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start]) continue;
      const si = start * 4;
      if (!isRed(data[si], data[si + 1], data[si + 2])) continue;
      let n = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sx = 0;
      let sy = 0;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = (p - px) / w;
        n++;
        sx += px;
        sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (px > 0 && !seen[p - 1]) {
          const i = (p - 1) * 4;
          if (isRed(data[i], data[i + 1], data[i + 2])) { seen[p - 1] = 1; stack.push(p - 1); }
        }
        if (px + 1 < w && !seen[p + 1]) {
          const i = (p + 1) * 4;
          if (isRed(data[i], data[i + 1], data[i + 2])) { seen[p + 1] = 1; stack.push(p + 1); }
        }
        if (py > 0 && !seen[p - w]) {
          const i = (p - w) * 4;
          if (isRed(data[i], data[i + 1], data[i + 2])) { seen[p - w] = 1; stack.push(p - w); }
        }
        if (py + 1 < h && !seen[p + w]) {
          const i = (p + w) * 4;
          if (isRed(data[i], data[i + 1], data[i + 2])) { seen[p + w] = 1; stack.push(p + w); }
        }
      }
      const cx = sx / n;
      const cy = sy / n;
      if (n < 8 || cy < y0 || cy > y1 || cx < x0) continue;
      if (!best || n > best.n) best = { n, minX, maxX, minY, maxY, cx, cy, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }
  return best || { n: 0 };
}

function plateInset(page, shot) {
  return page.__phone ? 0 : Math.round(260 * shot.dpr);
}

function redParts(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const seen = new Uint8Array(w * h);
  const sizes = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (seen[p] || !isRed(data[i], data[i + 1], data[i + 2])) continue;
      let n = 0;
      const q = [[x, y]];
      seen[p] = 1;
      while (q.length) {
        const [cx, cy] = q.pop();
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          const ni = np * 4;
          if (seen[np] || !isRed(data[ni], data[ni + 1], data[ni + 2])) continue;
          seen[np] = 1;
          q.push([nx, ny]);
        }
      }
      sizes.push(n);
    }
  }
  sizes.sort((a, b) => b - a);
  return sizes;
}

function thumbStats(img) {
  const blob = redBlob(img);
  if (!blob.n) return { n: 0, extent: 0, solidity: 0, margin: 0 };
  const extent = Math.max(blob.w / img.width, blob.h / img.height);
  const solidity = blob.n / (blob.w * blob.h);
  const margin = Math.min(
    blob.minX / img.width,
    blob.minY / img.height,
    (img.width - 1 - blob.maxX) / img.width,
    (img.height - 1 - blob.maxY) / img.height
  );
  return { n: blob.n, extent, solidity, margin };
}

function assertThumb(stats, label) {
  assert(stats.n >= 150, label + ' red pixels ' + stats.n + ' (speck or empty)');
  assert(stats.extent >= 0.4 && stats.extent <= 0.75, label + ' fill ' + (stats.extent * 100).toFixed(1) + '% outside 40-75');
  assert(stats.solidity >= 0.05, label + ' solidity ' + stats.solidity.toFixed(3) + ' (spread specks)');
  assert(stats.margin >= 0.02, label + ' cropped, margin ' + stats.margin.toFixed(3));
  return label + ' fill ' + (stats.extent * 100).toFixed(1) + '% n ' + stats.n;
}

function hardEdge(img) {
  const { width, height, data } = img;
  const green = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 1] > 70 && data[i + 1] > data[i] + 8 && data[i + 1] > data[i + 2] + 8;
  };
  const blue = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 2] > 120 && data[i + 2] > data[i + 1] + 25 && data[i + 2] > data[i] + 15;
  };
  for (let y = 4; y < height - 8; y += 2) {
    let sharp = 0;
    for (let x = 4; x < width - 4; x += 3) {
      if (!green(x, y)) continue;
      for (let k = 1; k <= 4; k++) {
        if (y + k < height && blue(x, y + k)) { sharp++; break; }
      }
    }
    if (sharp > width * 0.12) return 'horizontal y ' + y + ' sharp ' + sharp;
  }
  for (let x = 4; x < width - 8; x += 2) {
    let sharp = 0;
    for (let y = 4; y < height - 4; y += 3) {
      if (!green(x, y)) continue;
      for (let k = 1; k <= 4; k++) {
        if (x + k < width && blue(x + k, y)) { sharp++; break; }
      }
    }
    if (sharp > height * 0.12) return 'vertical x ' + x + ' sharp ' + sharp;
  }
  return '';
}

function plateEdgeRows(img, insetLeft) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const cell = 28;
  const cols = Math.floor(w / cell);
  const rows = Math.floor(h / cell);
  const kind = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let n = 0;
      let sg = 0;
      let sg2 = 0;
      let sky = 0;
      const x0 = cx * cell;
      const y0 = cy * cell;
      for (let y = y0; y < y0 + cell; y += 2) {
        for (let x = x0; x < x0 + cell; x += 2) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (b > g + 12 && b > 100) sky++;
          sg += g;
          sg2 += g * g;
          n++;
        }
      }
      const mean = sg / n;
      const variance = sg2 / n - mean * mean;
      if (sky > n * 0.45) kind[cy * cols + cx] = 0;
      else if (mean > 70 && variance > 280) kind[cy * cols + cx] = 1;
      else if (mean > 50 && variance < 160) kind[cy * cols + cx] = 2;
    }
  }
  const yMax = Math.floor(rows * 0.62);
  const xSkip = Math.floor((insetLeft || 0) / cell);
  let evidence = 0;
  for (let cy = 1; cy < yMax; cy++) {
    let first = -1;
    let last = -1;
    for (let cx = xSkip; cx < cols; cx++) {
      if (kind[cy * cols + cx] !== 1) continue;
      if (first < 0) first = cx;
      last = cx;
    }
    if (first < 0 || last - first < 2) continue;
    let left = 0;
    let right = 0;
    for (let cx = xSkip; cx < first; cx++) if (kind[cy * cols + cx] === 2) left++;
    for (let cx = last + 1; cx < cols; cx++) if (kind[cy * cols + cx] === 2) right++;
    if (left >= 2 || right >= 2) evidence++;
  }
  return evidence;
}

function moirePeaks(img) {
  const { width, height, data } = img;
  let y0 = 0;
  for (let y = 0; y < height; y++) {
    let g = 0;
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      if (data[i + 1] > data[i] + 8 && data[i + 1] > data[i + 2] + 8) g++;
    }
    if (g > width / 10) { y0 = y; break; }
  }
  const y1 = Math.min(height - 1, y0 + Math.floor(height * 0.22));
  const means = [];
  for (let y = y0; y <= y1; y++) {
    let s = 0;
    let n = 0;
    for (let x = 0; x < width; x += 2) {
      s += data[(y * width + x) * 4 + 1];
      n++;
    }
    means.push(s / n);
  }
  let peaks = 0;
  let prevSign = 0;
  let prev = means[0] || 0;
  for (let i = 1; i < means.length; i++) {
    const d = means[i] - means[i - 1];
    const sign = d > 1.2 ? 1 : d < -1.2 ? -1 : 0;
    if (sign && prevSign && sign !== prevSign && Math.abs(means[i] - prev) > 5) {
      peaks++;
      prev = means[i];
    }
    if (sign) prevSign = sign;
  }
  return peaks;
}

function stripeScore(img) {
  const blob = brickBlob(img, 0);
  if (!blob.n || blob.w < 20) return { score: -1, n: blob.n };
  const { width, data } = img;
  let flips = 0;
  let samples = 0;
  for (let y = blob.minY; y <= blob.maxY; y += 2) {
    let prev = -1;
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const i = (y * width + x) * 4;
      if (!isRed(data[i], data[i + 1], data[i + 2])) { prev = -1; continue; }
      const luma = data[i] * 0.25 + data[i + 1] * 0.6 + data[i + 2] * 0.15;
      if (prev >= 0) {
        samples++;
        if (Math.abs(luma - prev) > 26) flips++;
      }
      prev = luma;
    }
  }
  return { score: samples ? flips / samples : 0, n: blob.n };
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width - 1 && a.x + a.width - 1 > b.x && a.y < b.y + b.height - 1 && a.y + a.height - 1 > b.y;
}

async function inside(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const vp = page.viewportSize();
  if (!box || box.width < 8) throw new Error(selector + ' not on screen');
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  if (box.x < -1 || box.y < -1 || right > vp.width + 1 || bottom > vp.height + 1) {
    throw new Error(selector + ' clipped x ' + box.x.toFixed(0) + ' y ' + box.y.toFixed(0) + ' r ' + right.toFixed(0) + ' b ' + bottom.toFixed(0) + ' vp ' + vp.width + 'x' + vp.height);
  }
  return selector + ' ' + Math.round(box.width) + 'x' + Math.round(box.height) + ' at ' + Math.round(box.x) + ',' + Math.round(box.y);
}

async function savedNames(page) {
  return page.evaluate(() => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('brickProject_')) continue;
      try { out.push(JSON.parse(localStorage.getItem(k)).name); } catch { /* skip */ }
    }
    return out;
  });
}

async function zoomClicks(page, selector, times) {
  for (let i = 0; i < times; i++) await clickSel(page, selector);
}

function faceSamples(img, pred) {
  const pts = [];
  const { width, height, data } = img;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!pred(r, g, b)) continue;
      pts.push({ r, g, b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b, h: hueOf(r, g, b) });
    }
  }
  if (pts.length < 40) return null;
  pts.sort((a, b) => a.y - b.y);
  const k = Math.max(8, Math.floor(pts.length * 0.12));
  const avg = (list) => {
    let r = 0; let g = 0; let b = 0; let h = 0;
    for (const p of list) { r += p.r; g += p.g; b += p.b; h += p.h; }
    const n = list.length;
    return { r: r / n, g: g / n, b: b / n, h: h / n, y: 0.2126 * r / n + 0.7152 * g / n + 0.0722 * b / n };
  };
  return { lit: avg(pts.slice(-k)), shade: avg(pts.slice(0, k)), n: pts.length };
}

async function runTyping(browser, phone) {
  const tag = phone ? 'P' : 'D';
  const hows = ['fresh', 'triple', 'triple', 'append', 'after', 'fresh', 'triple', 'triple', 'triple'];
  let session = null;
  for (let i = 0; i < NAMES.length; i++) {
    const how = hows[i];
    const id = tag + '-type-' + (i + 1);
    await check(id, (phone ? 'phone' : 'desktop') + ' type "' + NAMES[i] + '" (' + how + ')', async () => {
      if (how === 'fresh' || !session) {
        if (session) await session.context.close();
        session = await openPage(browser, phone, id);
      }
      const page = session.page;
      const mark = page._dialogs.length;
      let expected = NAMES[i];
      let box;
      let howType = 'click';
      if (how === 'after') {
        await ready(page);
        if (phone) await ensureDrawer(page);
        await clickStud(page, 0.5, false);
        if (phone) await ensureDrawer(page);
        box = await page.locator('#projectName').boundingBox();
        howType = 'triple';
      } else if (how === 'append') {
        const prior = await page.locator('#projectName').inputValue();
        box = await page.locator('#projectName').boundingBox();
        expected = prior + NAMES[i];
        howType = 'append';
      } else if (how === 'fresh') {
        box = await armName(page);
        howType = 'click';
      } else {
        box = await page.locator('#projectName').boundingBox();
        howType = 'triple';
      }
      if (!box || box.width < 4) throw new Error('name field has no box');
      const before = await hotState(page);
      await typeInto(page, box, NAMES[i], howType);
      const after = await hotState(page);
      const problems = [];
      if (after.value !== expected) problems.push('value "' + after.value + '" != "' + expected + '"');
      for (const key of ['rot', 'mirror', 'tool', 'move', 'del', 'floor', 'wall', 'drop', 'paint']) {
        if (before[key] !== after[key]) problems.push(key + ' ' + JSON.stringify(before[key]) + ' -> ' + JSON.stringify(after[key]));
      }
      const dialogs = badDialogs(page, mark);
      if (dialogs.length) problems.push('dialog ' + dialogs.join(' | '));
      if (problems.length) throw new Error(problems.join('; '));
      return 'kept "' + expected + '"';
    });
    if (SMOKE && results.length >= 2) {
      if (session) await session.context.close();
      return;
    }
  }
  if (session) await session.context.close();
}

async function main() {
  const server = await startServer();
  const browser = await launch();
  try {
    await runTyping(browser, false);
    if (SMOKE) return;
    await runTyping(browser, true);

    await check('D-save-first', 'desktop first Save writes the name and is not a delete confirm', async () => {
      const { page, context } = await openPage(browser, false, 'dsave');
      try {
        const mark = page._dialogs.length;
        const box = await armName(page);
        await typeInto(page, box, 'fifteen', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('brickProject_')) continue;
            try { if (JSON.parse(localStorage.getItem(k)).name === 'fifteen') return true; } catch { /* skip */ }
          }
          return false;
        }, null, { timeout: 4000 });
        const dialogs = badDialogs(page, mark);
        assert(dialogs.length === 0, 'native dialog ' + dialogs.join(' | '));
        return 'saved fifteen';
      } finally { await context.close(); }
    });

    await check('P-save-first', 'phone first Save writes the name and is not a delete confirm', async () => {
      const { page, context } = await openPage(browser, true, 'psave');
      try {
        const mark = page._dialogs.length;
        const box = await armName(page);
        await typeInto(page, box, 'fifteen', 'click');
        await clickSel(page, '#saveProjectBtn');
        const names = await savedNames(page);
        assert(names.indexOf('fifteen') >= 0, 'saved ' + JSON.stringify(names));
        const dialogs = badDialogs(page, mark);
        assert(dialogs.length === 0, 'native dialog ' + dialogs.join(' | '));
        const list = await page.locator('#savedProjectsList').innerText();
        assert(list.indexOf('fifteen') >= 0, 'phone saved list missing: ' + list.slice(0, 80));
        return 'saved and listed';
      } finally { await context.close(); }
    });

    await check('thumbs', 'gallery thumbs for 1, 3-spread, 6-tower, 15-row fill 40-75%', async () => {
      const { page, context } = await openPage(browser, false, 'thumbs');
      try {
        await ready(page);
        const layouts = {
          one: [0.55],
          spread: [0.12, 0.5, 0.88],
          tower: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          row: Array.from({ length: 15 }, (_, i) => 0.06 + i * 0.06)
        };
        const lines = [];
        for (const kind of ['one', 'spread', 'tower', 'row']) {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await ready(page);
          for (let i = 0; i < layouts[kind].length; i++) await clickStud(page, layouts[kind][i], kind === 'tower' && i > 0);
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, kind, 'click');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction((n) => {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k || !k.startsWith('brickProject_')) continue;
              try { if (JSON.parse(localStorage.getItem(k)).name === n) return true; } catch { /* skip */ }
            }
            return false;
          }, kind, { timeout: 8000 });
          await clickSel(page, '#galleryBtn');
          await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
          const buf = await page.locator('#galleryGrid img').first().screenshot();
          writeFileSync(join(shots, 'thumb-' + kind + '.png'), buf);
          const stats = thumbStats(decodePng(buf));
          if (kind === 'one') {
            const parts = redParts(decodePng(buf));
            const ghost = parts.filter((n, idx) => idx > 0 && n > 25);
            assert(ghost.length === 0, 'ghost baked, extra red parts ' + parts.join(','));
          }
          lines.push(assertThumb(stats, kind));
          await page.keyboard.press('Escape');
        }
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('D-brick-px', 'desktop first brick is 25-45 px at the default camera', async () => {
      const { page, context } = await openPage(browser, false, 'dbrick');
      try {
        await ready(page);
        const hit = await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'desktop-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no red brick in the frame');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        assert(px >= 25 && px <= 45, 'brick ' + px.toFixed(1) + ' px');
        const cx = shot.clip.x + blob.cx / shot.dpr;
        const cy = shot.clip.y + blob.cy / shot.dpr;
        const dist = Math.hypot(cx - hit.x, cy - hit.y);
        assert(dist <= 12, 'brick centroid ' + dist.toFixed(1) + ' px from the click');
        return px.toFixed(1) + ' px, offset ' + dist.toFixed(1);
      } finally { await context.close(); }
    });

    await check('P-brick-px', 'phone first brick is 25-45 px at the default camera', async () => {
      const { page, context } = await openPage(browser, true, 'pbrick');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const shot = await grabCanvas(page, 'phone-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no red brick in the frame');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        assert(px >= 25 && px <= 45, 'brick ' + px.toFixed(1) + ' px');
        return px.toFixed(1) + ' px';
      } finally { await context.close(); }
    });

    await check('D-plate-edge', 'desktop default camera shows the plate edge', async () => {
      const { page, context } = await openPage(browser, false, 'dplate');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'desktop-plate.png');
        const rows = plateEdgeRows(shot.img, 280);
        assert(rows >= 1, 'plate edge not in frame, edge rows ' + rows);
        return 'edge rows ' + rows;
      } finally { await context.close(); }
    });

    await check('P-plate-edge', 'phone default camera shows the plate edge', async () => {
      const { page, context } = await openPage(browser, true, 'pplate');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'phone-plate.png');
        const rows = plateEdgeRows(shot.img, 0);
        assert(rows >= 1, 'plate edge not in frame, edge rows ' + rows);
        return 'edge rows ' + rows;
      } finally { await context.close(); }
    });

    await check('ground-edge', 'ground has no hard edge on desktop or phone', async () => {
      const hits = [];
      const desk = await openPage(browser, false, 'ground');
      try {
        await ready(desk.page);
        let shot = await grabCanvas(desk.page, 'ground-1280.png');
        let edge = hardEdge(shot.img);
        if (edge) hits.push('1280 ' + edge);
        await desk.page.setViewportSize({ width: 1422, height: 889 });
        await desk.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        shot = await grabCanvas(desk.page, 'ground-90.png');
        edge = hardEdge(shot.img);
        if (edge) hits.push('90% layout ' + edge);
        try {
          const cdp = await desk.page.context().newCDPSession(desk.page);
          await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 0.9 });
          shot = await grabCanvas(desk.page, 'ground-scale.png');
          edge = hardEdge(shot.img);
          if (edge) hits.push('page scale ' + edge);
        } catch (err) {
          console.log('page scale skipped', err.message);
        }
      } finally { await desk.context.close(); }
      const phone = await openPage(browser, true, 'pground');
      try {
        await ready(phone.page);
        const shot = await grabCanvas(phone.page, 'ground-phone.png');
        const edge = hardEdge(shot.img);
        if (edge) hits.push('phone ' + edge);
        const peaks = moirePeaks(shot.img);
        writeFileSync(join(shots, 'moire-phone.txt'), String(peaks));
        if (peaks >= 5) hits.push('phone moire peaks ' + peaks);
      } finally { await phone.context.close(); }
      assert(hits.length === 0, hits.join('; '));
      return 'no hard edge';
    });

    await check('D-stud-moire', 'desktop studs have no rings or moire', async () => {
      const { page, context } = await openPage(browser, false, 'dmoire');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'moire-desktop.png');
        const peaks = moirePeaks(shot.img);
        assert(peaks < 5, 'moire peaks ' + peaks);
        return 'peaks ' + peaks;
      } finally { await context.close(); }
    });

    await check('D-zfight', 'adjacent brick tops do not z-fight', async () => {
      const { page, context } = await openPage(browser, false, 'zfight');
      try {
        await ready(page);
        await clickStud(page, 0.42, false);
        await clickStud(page, 0.62, false);
        for (let i = 0; i < 16; i++) await clickSel(page, '#zoomInBtn');
        const s1 = await grabCanvas(page, 'zfight-1.png');
        const s2 = await grabCanvas(page, 'zfight-2.png');
        const aScore = stripeScore(s1.img);
        const bScore = stripeScore(s2.img);
        assert(aScore.n > 80 && bScore.n > 80, 'tops left the frame n ' + aScore.n + '/' + bScore.n);
        assert(aScore.score >= 0 && aScore.score < 0.18, 'stripes ' + aScore.score.toFixed(3));
        assert(bScore.score < 0.18, 'stripes ' + bScore.score.toFixed(3));
        return 'stripe ' + aScore.score.toFixed(3);
      } finally { await context.close(); }
    });

    await check('D-zoom-cursor', 'wheel zoom stays on the brick under the cursor', async () => {
      const { page, context } = await openPage(browser, false, 'zoom');
      try {
        await ready(page);
        await clickStud(page, 0.18, false);
        const before = await grabCanvas(page, 'zoom-before.png');
        const blob = brickBlob(before.img, plateInset(page, before));
        assert(blob.n > 8, 'brick missing before zoom');
        const cx = before.clip.x + blob.cx / before.dpr;
        const cy = before.clip.y + blob.cy / before.dpr;
        const size0 = Math.max(blob.w, blob.h) / before.dpr;
        await page.mouse.move(cx, cy);
        for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
        const after = await grabCanvas(page, 'zoom-after.png');
        const blob2 = brickBlob(after.img, plateInset(page, after));
        assert(blob2.n > 8, 'brick left the screen');
        const cx2 = after.clip.x + blob2.cx / after.dpr;
        const cy2 = after.clip.y + blob2.cy / after.dpr;
        const shift = Math.hypot(cx2 - cx, cy2 - cy);
        const size1 = Math.max(blob2.w, blob2.h) / after.dpr;
        assert(size1 > size0 + 2, 'brick did not grow ' + size0.toFixed(1) + ' -> ' + size1.toFixed(1));
        assert(shift < 36, 'zoom target moved ' + shift.toFixed(1) + ' px off the cursor');
        const vp = page.viewportSize();
        assert(cx2 > 8 && cy2 > 8 && cx2 < vp.width - 8 && cy2 < vp.height - 8, 'brick not fully on screen');
        return 'shift ' + shift.toFixed(1) + ' size ' + size0.toFixed(0) + '->' + size1.toFixed(0);
      } finally { await context.close(); }
    });

    await check('P-zoom-sign', 'phone + enlarges the brick and - shrinks it', async () => {
      const { page, context } = await openPage(browser, true, 'pzoom');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const z0 = await grabCanvas(page, 'pzoom-0.png');
        const s0 = brickBlob(z0.img, plateInset(page, z0));
        await clickSel(page, '#zoomInBtn');
        const z1 = await grabCanvas(page, 'pzoom-1.png');
        const s1 = brickBlob(z1.img, plateInset(page, z1));
        await clickSel(page, '#zoomOutBtn');
        const z2 = await grabCanvas(page, 'pzoom-2.png');
        const s2 = brickBlob(z2.img, plateInset(page, z2));
        const w = (b) => (b.n ? Math.max(b.w, b.h) : 0);
        assert(w(s1) > w(s0) + 3, '+ changed ' + w(s0) + ' to ' + w(s1));
        assert(w(s2) < w(s1) - 3, '- changed ' + w(s1) + ' to ' + w(s2));
        return w(s0) + ' -> ' + w(s1) + ' -> ' + w(s2);
      } finally { await context.close(); }
    });

    await check('panels-fit', 'Floor, Wall, and Mirror panels sit fully inside the phone and desktop view', async () => {
      const notes = [];
      for (const phone of [true, false]) {
        const { page, context } = await openPage(browser, phone, phone ? 'ppanel' : 'dpanel');
        try {
          await ready(page);
          const label = phone ? 'phone' : 'desktop';
          for (const item of [['#floorBtn', '#buildToolPopup', 'floor'], ['#wallBtn', '#buildToolPopup', 'wall'], ['#mirrorBtn', '#mirrorPopup', 'mirror']]) {
            await openSection(page, /^Tools$/);
            await scrollUntil(page, page.locator(item[0]));
            await clickSel(page, item[0]);
            notes.push(label + ' ' + await inside(page, item[1]));
            await page.keyboard.press('Escape');
          }
        } finally { await context.close(); }
      }
      return notes.join(' | ');
    });

    await check('D-delete-exit', 'delete mode ends on a placement and Color still changes the swatch', async () => {
      const { page, context } = await openPage(browser, false, 'ddel');
      try {
        await ready(page);
        await clickStud(page, 0.45, false);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#deleteBtn'));
        await clickSel(page, '#deleteBtn');
        const armed = await page.evaluate(() => document.body.classList.contains('delete-mode') || document.getElementById('deleteBtn').classList.contains('delete-active'));
        assert(armed, 'delete mode did not arm');
        const before = await brickCount(page);
        await clickStud(page, 0.72, false);
        const afterArm = await page.evaluate(() => document.body.classList.contains('delete-mode') || document.getElementById('deleteBtn').classList.contains('delete-active'));
        assert(!afterArm, 'delete mode stayed on after a placement');
        assert((await brickCount(page)) > before, 'placement did not add a brick');
        await openSection(page, /^Tools$/);
        await clickSel(page, '#deleteBtn');
        await openSection(page, /^Color$/);
        await scrollUntil(page, page.locator('.color-preset:not(.trans)[data-color="#ffe600"]'));
        await clickSel(page, '.color-preset:not(.trans)[data-color="#ffe600"]');
        const selected = await page.locator('.color-preset.selected').first().getAttribute('data-color');
        const still = await page.evaluate(() => document.body.classList.contains('delete-mode'));
        assert(!still, 'delete mode swallowed the color click');
        assert(selected === '#ffe600', 'color is ' + selected);
        return 'exits and color ' + selected;
      } finally { await context.close(); }
    });

    await check('P-delete-exit', 'phone delete mode ends when Color is tapped', async () => {
      const { page, context } = await openPage(browser, true, 'pdel');
      try {
        await ready(page);
        await clickSel(page, '#hudDeleteBtn');
        await ensureDrawer(page);
        await openSection(page, /^Color$/);
        await scrollUntil(page, page.locator('.color-preset:not(.trans)[data-color="#1e88e5"]'));
        await clickSel(page, '.color-preset:not(.trans)[data-color="#1e88e5"]');
        const selected = await page.locator('.color-preset.selected').first().getAttribute('data-color');
        const still = await page.evaluate(() => document.body.classList.contains('delete-mode') || document.getElementById('hudDeleteBtn').classList.contains('delete-active'));
        assert(selected === '#1e88e5', 'color ' + selected);
        assert(!still, 'delete mode still on');
        return 'color ' + selected;
      } finally { await context.close(); }
    });

    await check('esc-panels', 'Escape closes tutorial, gallery, new project, mirror, floor, wall, delete, and move', async () => {
      const failures = [];
      async function expectClosed(page, label, pred) {
        await page.keyboard.press('Escape');
        const open = await pred();
        if (open) failures.push(label);
      }
      const desk = await openPage(browser, false, 'esc');
      try {
        const page = desk.page;
        await page.waitForFunction(() => {
          const m = document.getElementById('tutorialModal');
          return m && m.classList.contains('visible');
        }, null, { timeout: 20000 }).catch(() => {});
        await expectClosed(page, 'desktop tutorial', () => page.locator('#tutorialModal').evaluate((el) => el.classList.contains('visible')));
        await ready(page);
        await clickSel(page, '#galleryBtn');
        await expectClosed(page, 'desktop gallery', () => page.locator('#galleryModal').evaluate((el) => el.style.display === 'flex'));
        await clickSel(page, '#newProjectBtn');
        await expectClosed(page, 'desktop new', () => page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex'));
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await expectClosed(page, 'desktop mirror', () => page.locator('#mirrorPopup').evaluate((el) => el.classList.contains('visible')));
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#floorBtn'));
        await clickSel(page, '#floorBtn');
        await expectClosed(page, 'desktop floor', () => page.locator('#buildToolPopup').evaluate((el) => el.classList.contains('visible')));
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#wallBtn'));
        await clickSel(page, '#wallBtn');
        await expectClosed(page, 'desktop wall', () => page.locator('#buildToolPopup').evaluate((el) => el.classList.contains('visible')));
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#deleteBtn'));
        await clickSel(page, '#deleteBtn');
        await expectClosed(page, 'desktop delete', () => page.evaluate(() => document.body.classList.contains('delete-mode') || document.getElementById('deleteBtn').classList.contains('delete-active')));
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await expectClosed(page, 'desktop move', () => page.locator('#moveModeIndicator').evaluate((el) => el.classList.contains('visible') || document.getElementById('moveBtn').classList.contains('move-active')));
      } finally { await desk.context.close(); }
      const phone = await openPage(browser, true, 'pesc');
      try {
        const page = phone.page;
        await page.waitForFunction(() => {
          const p = document.getElementById('phoneTutorial');
          return p && !p.hidden;
        }, null, { timeout: 20000 }).catch(() => {});
        await expectClosed(page, 'phone tutorial', () => page.locator('#phoneTutorial').evaluate((el) => !el.hidden).catch(() => false));
        await ready(page);
        await clickSel(page, '#galleryBtn');
        await expectClosed(page, 'phone gallery', () => page.locator('#galleryModal').evaluate((el) => el.style.display === 'flex'));
        await ensureDrawer(page);
        await clickSel(page, '#newProjectBtn');
        await expectClosed(page, 'phone new', () => page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex'));
        await ensureDrawer(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#floorBtn'));
        await clickSel(page, '#floorBtn');
        await expectClosed(page, 'phone floor', () => page.locator('#buildToolPopup').evaluate((el) => el.classList.contains('visible')));
        await ensureDrawer(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await expectClosed(page, 'phone move', () => page.locator('#moveModeIndicator').evaluate((el) => el.classList.contains('visible')));
      } finally { await phone.context.close(); }
      assert(failures.length === 0, 'still open: ' + failures.join(', '));
      return 'all closed';
    });

    await check('native-dialogs', 'Clear, gallery trash, project trash, and paste-code do not call native dialogs', async () => {
      const { page, context } = await openPage(browser, false, 'native');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'keepme', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('brickProject_')) return true;
          }
          return false;
        }, null, { timeout: 8000 });
        const hits = [];
        async function probe(label, fn) {
          const mark = page._dialogs.length;
          await fn();
          const d = badDialogs(page, mark);
          if (d.length) hits.push(label + ' ' + d.join(','));
        }
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#clearBtn'));
        await probe('clear', () => clickSel(page, '#clearBtn'));
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid button.delete').first().waitFor({ state: 'visible', timeout: 8000 });
        await probe('gallery trash', () => clickSel(page, '#galleryGrid button.delete'));
        await page.keyboard.press('Escape');
        await scrollUntil(page, page.locator('.saved-project-delete'));
        await probe('project trash', () => clickSel(page, '.saved-project-delete'));
        await clickSel(page, '#galleryBtn');
        await clickSel(page, '.gallery-tab[data-tab="share"]');
        await probe('paste code', () => clickSel(page, '#shareLoadCode'));
        assert(hits.length === 0, hits.join(' | '));
        return 'custom only';
      } finally { await context.close(); }
    });

    await check('colors', 'lit and shaded red, yellow, blue, and green match the swatches', async () => {
      const { page, context } = await openPage(browser, false, 'color');
      try {
        await ready(page);
        const specs = [
          ['#ff2200', 'red', (r, g, b) => r > 90 && r > g + 25 && r > b + 25, (lit, shade) => {
            assert(lit.h < 22 && lit.r > 180 && lit.b < 90, 'red lit ' + JSON.stringify(lit));
            assert(shade.h < 28 && shade.r > 110 && shade.r > shade.g + 25, 'red shade ' + JSON.stringify(shade));
          }],
          ['#ffe600', 'yellow', (r, g, b) => r > 90 && g > 70 && b < 130 && r > b && g > b, (lit, shade) => {
            assert(lit.h > 45 && lit.h < 68 && lit.r > 190 && lit.g > 160 && lit.b < 100 && lit.g < lit.r + 20, 'yellow lit ' + JSON.stringify(lit));
            assert(shade.h > 40 && shade.h < 72 && shade.r > 90 && shade.g > 60 && shade.r + 10 >= shade.g && shade.b < 110, 'yellow shade ' + JSON.stringify(shade));
          }],
          ['#1e88e5', 'blue', (r, g, b) => b > 80 && b > r && b > g - 10, (lit, shade) => {
            assert(lit.h > 190 && lit.h < 230 && lit.b > 140, 'blue lit ' + JSON.stringify(lit));
            assert(shade.h > 185 && shade.h < 235 && shade.b > 70 && shade.b > shade.r, 'blue shade ' + JSON.stringify(shade));
          }],
          ['#00c853', 'green', (r, g, b) => g > 80 && g > r + 10 && g > b, (lit, shade) => {
            assert(lit.h > 120 && lit.h < 165 && lit.g > 140 && lit.g > lit.r, 'green lit ' + JSON.stringify(lit));
            assert(shade.h > 115 && shade.h < 168 && shade.g > 60 && shade.g > shade.r, 'green shade ' + JSON.stringify(shade));
          }]
        ];
        const lines = [];
        for (const [hex, name, pred, rule] of specs) {
          await openSection(page, /^Color$/);
          const sw = page.locator('.color-preset:not(.trans)[data-color="' + hex + '"]').first();
          await scrollUntil(page, sw);
          await clickLoc(page, sw);
          await clickStud(page, 0.35 + lines.length * 0.1, false);
        }
        for (let i = 0; i < 14; i++) await clickSel(page, '#zoomInBtn');
        const shot = await grabCanvas(page, 'colors.png');
        for (const [hex, name, pred, rule] of specs) {
          const faces = faceSamples(shot.img, pred);
          assert(faces, name + ' brick not sampled');
          const lit = { h: faces.lit.h, r: faces.lit.r, g: faces.lit.g, b: faces.lit.b };
          const shade = { h: faces.shade.h, r: faces.shade.r, g: faces.shade.g, b: faces.shade.b };
          rule(lit, shade);
          lines.push(name + ' lit ' + lit.h.toFixed(0) + ' shade ' + shade.h.toFixed(0));
        }
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('D-click-90', 'a click at 90% page scale places the brick on the cursor', async () => {
      const { page, context } = await openPage(browser, false, 'scale');
      try {
        await ready(page);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 0.9 });
        const p = await locateStud(page, 0.6);
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
        assert(await waitGrown(page, 0, 3000), 'scaled click did not place');
        const shot = await grabCanvas(page, 'click-90.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const cx = shot.clip.x + blob.cx / shot.dpr;
        const cy = shot.clip.y + blob.cy / shot.dpr;
        const dist = Math.hypot(cx - p.x, cy - p.y);
        assert(dist <= 12, 'offset ' + dist.toFixed(1) + ' px');
        return 'offset ' + dist.toFixed(1);
      } finally { await context.close(); }
    });

    await check('D-drag', 'a 2 px press places and a 20 px drag does not', async () => {
      const { page, context } = await openPage(browser, false, 'drag');
      try {
        await ready(page);
        const p = await locateStud(page, 0.4);
        const before = await brickCount(page);
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x + 24, p.y + 8, { steps: 6 });
        await page.mouse.up();
        assert((await brickCount(page)) === before, 'drag placed a brick');
        await page.mouse.move(p.x + 40, p.y);
        await page.mouse.down();
        await page.mouse.move(p.x + 42, p.y, { steps: 2 });
        await page.mouse.up();
        assert(await waitGrown(page, before, 2500), '2 px press did not place');
        return 'drag ignored, click placed';
      } finally { await context.close(); }
    });

    await check('D-share', 'share link loads the build with no tutorial and no letterbox', async () => {
      const { page, context } = await openPage(browser, false, 'share');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await clickSel(page, '#galleryBtn');
        await clickSel(page, '.gallery-tab[data-tab="share"]');
        await page.waitForFunction(() => {
          const v = document.getElementById('shareBuildCode').value || '';
          return v.indexOf('#b=') >= 0;
        }, null, { timeout: 8000 });
        const buf = await page.locator('#sharePreviewCanvas').screenshot();
        writeFileSync(join(shots, 'share-preview.png'), buf);
        const img = decodePng(buf);
        const colMean = (x0, x1) => {
          let s = 0; let n = 0;
          for (let y = 0; y < img.height; y += 2) {
            for (let x = x0; x < x1; x += 2) {
              const i = (y * img.width + x) * 4;
              s += img.data[i] + img.data[i + 1] + img.data[i + 2];
              n++;
            }
          }
          return s / n;
        };
        const left = colMean(0, Math.floor(img.width * 0.08));
        const mid = colMean(Math.floor(img.width * 0.4), Math.floor(img.width * 0.6));
        assert(!(left < 25 && mid > 80), 'letterbox bars, edge ' + left.toFixed(0) + ' mid ' + mid.toFixed(0));
        const link = await page.locator('#shareBuildCode').inputValue();
        const hash = link.slice(link.indexOf('#b='));
        const fresh = await context.newPage();
        watch(fresh);
        await fresh.goto('http://127.0.0.1:' + PORT + '/games/brix3d.html' + hash, { waitUntil: 'domcontentloaded' });
        await fresh.waitForFunction(() => window.brixCanPlace && window.bricks && window.bricks.length > 0, null, { timeout: 45000 });
        const tut = await fresh.locator('#tutorialModal').evaluate((el) => el.classList.contains('visible')).catch(() => false);
        const phoneTut = await fresh.locator('#phoneTutorial').evaluate((el) => !el.hidden).catch(() => false);
        assert(!tut && !phoneTut, 'tutorial showed on the share link');
        const n = await fresh.locator('#brickCount').textContent();
        assert(parseInt(n, 10) >= 1, 'share loaded ' + n);
        return 'loaded ' + n;
      } finally { await context.close(); }
    });

    await check('D-copy', 'new-project and load dialogs use the player wording', async () => {
      const { page, context } = await openPage(browser, false, 'copy');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const count = await brickCount(page);
        await clickSel(page, '#newProjectBtn');
        const title = (await page.locator('#loadConfirmTitle').innerText()).trim();
        const body = (await page.locator('#loadConfirmBody').innerText()).trim();
        const ok = (await page.locator('#loadConfirmOk').innerText()).trim();
        assert(title === 'Start a new project?', 'title ' + title);
        assert(body === 'The bricks on the plate will be cleared. Save first if you want to keep them.', 'body ' + body);
        assert(ok === 'New project', 'ok ' + ok);
        await page.keyboard.press('Escape');
        assert((await brickCount(page)) === count, 'esc cleared bricks');
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'copyme', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForTimeout(500);
        await scrollUntil(page, page.locator('.saved-project-name'));
        await clickSel(page, '.saved-project-name');
        const loadBody = (await page.locator('#loadConfirmBody').innerText()).trim();
        const loadTitle = (await page.locator('#loadConfirmTitle').innerText()).trim();
        assert(loadTitle === 'Load this build?', loadTitle);
        assert(loadBody === 'Load "copyme" (' + count + ' bricks)? This will replace your current build.', loadBody);
        return 'copy ok';
      } finally { await context.close(); }
    });

    await check('chrome-fit', 'toolbar, top icons, quality chips, toast, starters, and the default brick', async () => {
      const { page, context } = await openPage(browser, false, 'chrome');
      try {
        await ready(page);
        const type = (await page.locator('#hudBrickType').textContent()) || '';
        assert(/2\s*[×x]\s*2/.test(type), 'default brick ' + type);
        const icons = await page.locator('#quickBar .quick-btn').count();
        assert(icons === 5, 'top icons ' + icons);
        const pages = (await page.locator('#tutorialTotalPages').textContent()) || '';
        assert(pages.trim() === '3', 'tutorial pages ' + pages);
        const labels = page.locator('#buildHud .hud-label');
        const n = await labels.count();
        const boxes = [];
        for (let i = 0; i < n; i++) boxes.push(await labels.nth(i).boundingBox());
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            assert(!overlaps(boxes[i], boxes[j]), 'toolbar labels overlap');
          }
        }
        const style = await labels.first().evaluate((el) => {
          const s = getComputedStyle(el);
          return { size: parseFloat(s.fontSize), color: s.color };
        });
        assert(style.size >= 12, 'label ' + style.size + 'px');
        assert(/255,\s*255,\s*255/.test(style.color) || style.color === '#fff' || style.color === 'rgb(255, 255, 255)', 'label color ' + style.color);
        const chips = page.locator('#qualityBar button');
        const cn = await chips.count();
        const vp = page.viewportSize();
        for (let i = 0; i < cn; i++) {
          const b = await chips.nth(i).boundingBox();
          assert(b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, 'quality chip clipped');
        }
        const toastTop = await page.locator('#toast').evaluate((el) => parseFloat(getComputedStyle(el).top));
        assert(toastTop >= 40 && toastTop <= 80, 'toast top ' + toastTop);
        const bar = await page.locator('#starterBar').boundingBox();
        assert(bar && bar.width > 10, 'starters missing before the first brick');
        await clickStud(page, 0.55, false);
        const hidden = await page.locator('#starterBar').evaluate((el) => el.classList.contains('hidden') || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden');
        assert(hidden, 'starters stayed after the first brick');
        return 'labels ' + style.size + 'px toast ' + toastTop;
      } finally { await context.close(); }
    });

    await check('P-chrome', 'phone drawer, project title, zoom, rotation, quality, and toolbar', async () => {
      const { page, context } = await openPage(browser, true, 'pchrome');
      try {
        await ready(page);
        const type = (await page.locator('#hudBrickType').textContent()) || '';
        assert(/2\s*[×x]\s*2/.test(type), 'default ' + type);
        await clickSel(page, '#panelToggle');
        const controls = await page.locator('#controls').boundingBox();
        assert(controls.height / 844 <= 0.305, 'drawer ' + (controls.height / 844).toFixed(3));
        const title = await page.locator('#projectSection .section-title').boundingBox();
        const toggle = await page.locator('#panelToggle').boundingBox();
        assert(title && !overlaps(title, toggle), 'project title covered by the tray bar');
        assert(title.y >= -1 && title.y + title.height <= 844, 'project title off screen');
        const zoom = await page.locator('#zoomInBtn').boundingBox();
        const menu = await page.locator('.brix-more__toggle').boundingBox();
        assert(zoom && menu && !overlaps(zoom, menu), 'zoom covered by the menu');
        const rot = await page.locator('.rotation-ind').boundingBox();
        const handle = await page.locator('#panelToggle').boundingBox();
        assert(rot && handle && !overlaps(rot, handle), 'rotation pill covers the drawer handle');
        const saveBox = await page.locator('#saveProjectBtn').boundingBox();
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'phone list', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => (document.getElementById('savedProjectsList') || {}).innerText && document.getElementById('savedProjectsList').innerText.indexOf('phone list') >= 0, null, { timeout: 5000 });
        const saveAfter = await page.locator('#saveProjectBtn').boundingBox();
        assert(Math.abs(saveAfter.y - saveBox.y) < 8, 'save shifted ' + (saveAfter.y - saveBox.y).toFixed(1) + 'px');
        const labels = page.locator('#buildHud .hud-label');
        const n = await labels.count();
        const boxes = [];
        for (let i = 0; i < n; i++) boxes.push(await labels.nth(i).boundingBox());
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) assert(!overlaps(boxes[i], boxes[j]), 'phone labels overlap');
        }
        const chips = page.locator('#qualityBar button');
        for (let i = 0; i < await chips.count(); i++) {
          const b = await chips.nth(i).boundingBox();
          assert(b && b.x >= -1 && b.x + b.width <= 391 && b.y >= -1 && b.y + b.height <= 845, 'quality chip off screen');
        }
        return 'drawer ' + (controls.height / 844).toFixed(3);
      } finally { await context.close(); }
    });

    await check('P-stud-scale', 'plate studs are not about twice the brick studs', async () => {
      const { page, context } = await openPage(browser, true, 'studs');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        for (let i = 0; i < 2; i++) await clickSel(page, '#zoomInBtn');
        const shot = await grabCanvas(page, 'stud-scale.png');
        const img = shot.img;
        const pitch = (y, pred) => {
          const row = [];
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            row.push(pred(img.data[i], img.data[i + 1], img.data[i + 2]) ? img.data[i + 1] + img.data[i] : 0);
          }
          let best = 0;
          let bestLag = 0;
          for (let lag = 6; lag < 80; lag++) {
            let s = 0;
            for (let x = 0; x < row.length - lag; x++) s += row[x] * row[x + lag];
            if (s > best) { best = s; bestLag = lag; }
          }
          return bestLag;
        };
        const blob = brickBlob(img, plateInset(page, shot));
        assert(blob.n > 40, 'brick too small to measure studs');
        const brickPitch = pitch(Math.floor((blob.minY + blob.maxY) / 2), (r, g, b) => r > 120 && r > g);
        let plateY = Math.min(img.height - 4, blob.maxY + 12);
        const platePitch = pitch(plateY, (r, g, b) => g > 70 && g > r);
        const ratio = platePitch / Math.max(1, brickPitch);
        assert(brickPitch > 4 && platePitch > 4, 'pitch brick ' + brickPitch + ' plate ' + platePitch);
        assert(ratio < 1.7 && ratio > 0.6, 'plate/brick stud pitch ' + ratio.toFixed(2));
        return 'ratio ' + ratio.toFixed(2);
      } finally { await context.close(); }
    });

    await check('boot-x5', 'five fresh boots after localStorage.clear have no errors', async () => {
      const { page, context } = await openPage(browser, false, 'boot');
      try {
        const errors = [];
        for (let i = 0; i < 5; i++) {
          const mark = page._errors.length;
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.brixCanPlace, null, { timeout: 45000 });
          errors.push(...page._errors.slice(mark));
        }
        assert(errors.length === 0, errors.join(' | '));
        return '5 boots clean';
      } finally { await context.close(); }
    });

    if (!SKIP_PERF) {
      const base = 'http://127.0.0.1:' + PORT;
      let ownedChrome = 0;
      await check('fps', 'desktop 520 bricks at 90+ FPS and phone at 165 FPS', async () => {
        const row = await measureFps(base);
        ownedChrome = row.ownedPid || 0;
        writeFileSync(join(here, 'gpu-player.json'), JSON.stringify({ desk: row.desk, phone: row.phone }, null, 2));
        assert(row.ok, row.detail);
        return row.detail;
      });
      await check('lighthouse', 'TBT 0 and no simulated task over 50 ms on three runs', async () => {
        let port = 9333;
        try {
          const ping = await fetch('http://127.0.0.1:9333/json/version');
          if (!ping.ok) port = 9334;
        } catch {
          port = 9334;
        }
        try {
          return await measureLighthouse(base, port, here);
        } finally {
          if (ownedChrome) {
            try { process.kill(ownedChrome); } catch { /* chrome already closed */ }
          }
        }
      });
    }
  } finally {
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);
    const summary = {
      passed,
      failed: failed.length,
      total: results.length,
      rows: results
    };
    writeFileSync(join(here, 'last-run.json'), JSON.stringify(summary, null, 2));
    console.log('SUITE', passed + '/' + results.length, 'failed', failed.map((r) => r.id).join(', '));
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error('SUITE CRASH', err);
  process.exitCode = 1;
});
