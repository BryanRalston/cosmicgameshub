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
const repo = normalize(process.env.BRIX_PLAYER_ROOT || join(here, '..', '..'));
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
  if (process.env.BRIX_PLAYER_ROOT) console.log('player root', repo);
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

async function openPage(browser, phone, tag, size) {
  const context = await browser.newContext(phone ? {
    viewport: size || { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    userAgent: phoneUA
  } : {
    viewport: size || { width: 1280, height: 800 },
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
  if (onCanvas) {
    await page.touchscreen.tap(x, y);
    return;
  }
  // One finger tap. Chrome usually synthesizes the click on the element
  // under the finger. A click on some other node must not count: Floor then
  // never receives a click, and a second mouse click would toggle it shut.
  // Canvas stays touch-only.
  await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    window.__playerHit = 0;
    window.__playerHitEl = el;
    window.__playerSameControl = window.__playerSameControl || function (want, target) {
      if (!want || !target) return false;
      if (target === want || (want.contains && want.contains(target))) return true;
      let node = want.parentElement;
      for (let i = 0; i < 4 && node; i++) {
        if (node === target) return true;
        node = node.parentElement;
      }
      return false;
    };
    if (!window.__playerHitBound) {
      window.__playerHitBound = true;
      document.addEventListener('click', (event) => {
        const want = window.__playerHitEl;
        const t = event.target;
        if (want && t && window.__playerSameControl(want, t)) window.__playerHit++;
      }, true);
    }
  }, [x, y]);
  const before = await page.evaluate(() => window.__playerHit);
  await page.touchscreen.tap(x, y);
  await page.evaluate(() => new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      document.removeEventListener('click', onClick, true);
      resolve();
    };
    const timer = setTimeout(finish, 400);
    const want = window.__playerHitEl;
    function onClick(event) {
      const t = event.target;
      if (want && t && window.__playerSameControl(want, t)) {
        clearTimeout(timer);
        finish();
      }
    }
    document.addEventListener('click', onClick, true);
  }));
  const after = await page.evaluate(() => window.__playerHit);
  if (after === before) await page.mouse.click(x, y, opts || {});
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
    if (page.__phone) await page.touchscreen.tap(x, y);
    await page.mouse.click(x, y, { clickCount: 3, delay: 35 });
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
    if (!window.__brixReadySince) window.__brixReadySince = Date.now();
    return Date.now() - window.__brixReadySince > 1500;
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

async function drawerOpen(page) {
  return page.locator('#controls').evaluate((el) => el.classList.contains('tray-open'));
}

async function ensureDrawer(page) {
  if (!page.__phone) return;
  if (!(await drawerOpen(page))) await clickSel(page, '#panelToggle');
}

async function closeDrawer(page) {
  if (!page.__phone) return;
  if (await drawerOpen(page)) await clickSel(page, '#panelToggle');
}

async function scrollUntil(page, locator) {
  const vp = page.viewportSize();
  const onScreen = (b) => b && b.width > 4 && b.height > 4 && b.y > 4 && b.y + b.height < vp.height - 4 && b.x > -2 && b.x + b.width < vp.width + 2;
  // A box inside the viewport can still sit under the phone HUD or above the
  // tray's clip. A player keeps scrolling until the control is the top hit.
  const hitInfo = async (b) => {
    if (!b) return { ok: false, cover: 'low' };
    const mid = b.y + b.height / 2;
    if (mid < 0 || mid > vp.height) return { ok: false, cover: mid < 0 ? 'high' : 'low' };
    if (!page.__phone) return { ok: onScreen(b), cover: onScreen(b) ? '' : 'low' };
    const x = b.x + b.width / 2;
    const y = mid;
    return locator.evaluate((el, pt) => {
      const top = document.elementFromPoint(pt.x, pt.y);
      const ok = !!(top && (top === el || el.contains(top)));
      let cover = '';
      if (top && top.closest) {
        if (top.closest('#buildHud')) cover = 'hud';
        else if (top.closest('#panelToggle')) cover = 'toggle';
        else if (top.closest('#projectSection') && !el.closest('#projectSection')) cover = 'project';
      }
      return { ok, cover };
    }, { x, y }).catch(() => ({ ok: false, cover: '' }));
  };
  let lastScroll = null;
  let stuck = 0;
  for (let i = 0; i < 24; i++) {
    const b = await locator.boundingBox().catch(() => null);
    const info = await hitInfo(b);
    if (info.ok) return b;
    const tray = await page.locator(page.__phone ? '.tray-scroll' : '#controls').first().boundingBox();
    if (!tray) break;
    if (!page.__phone) {
      const openTop = tray.y + 6;
      const openBot = Math.min(vp.height - 6, tray.y + tray.height - 6);
      const midY = b ? b.y + b.height / 2 : openBot + 80;
      const cover = info.cover || '';
      const fingerDown = cover === 'toggle' || cover === 'high' || cover === 'project' || midY < openTop;
      await page.mouse.move(tray.x + 36, Math.min(tray.y + 180, vp.height - 40));
      await page.mouse.wheel(0, fingerDown ? -420 : 420);
      continue;
    }
    // Move the control's center toward the middle of the open sheet.
    // A full reversal between the HUD and the handle never settled.
    const safeTop = tray.y + 10;
    const safeBot = Math.min(vp.height - 8, tray.y + tray.height - 10);
    const safeMid = (safeTop + safeBot) / 2;
    const midY = b ? b.y + b.height / 2 : safeBot + 40;
    const error = midY - safeMid;
    const mag = Math.max(28, Math.min(90, Math.abs(error) * 0.5));
    const client = await page.context().newCDPSession(page);
    const x = Math.round(tray.x + Math.min(36, tray.width * 0.35));
    const y0 = Math.round(Math.min(safeBot - 16, Math.max(safeTop + 20, safeMid)));
    const step = (error > 0 ? -mag : mag) / 4;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
    for (let s = 1; s <= 4; s++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + step * s), id: 1 }] });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach().catch(() => {});
    const scroll = await page.locator('.tray-scroll').evaluate((el) => Math.round(el.scrollTop)).catch(() => null);
    if (scroll != null && scroll === lastScroll) {
      stuck += 1;
      if (stuck >= 2) break;
    } else {
      stuck = 0;
      lastScroll = scroll;
    }
  }
  const last = await locator.boundingBox().catch(() => null);
  if ((await hitInfo(last)).ok) return last;
  const why = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const sc = el.closest('.tray-scroll');
    const sec = el.closest('.section');
    const up = document.getElementById('uploadPhotoBtn');
    const ur = up ? up.getBoundingClientRect() : null;
    return {
      id: el.id || (el.className || '').toString().slice(0, 24),
      y: Math.round(r.y),
      h: Math.round(r.height),
      hit: top ? (top.id || String(top.className).slice(0, 24)) : null,
      scroll: sc ? Math.round(sc.scrollTop) : null,
      max: sc ? Math.round(sc.scrollHeight - sc.clientHeight) : null,
      collapsed: sec ? sec.classList.contains('collapsed') : null,
      upY: ur ? Math.round(ur.y) : null,
      upH: ur ? Math.round(ur.height) : null
    };
  }).catch((err) => String(err && err.message ? err.message : err));
  throw new Error('could not reveal control ' + JSON.stringify(why));
}

async function openSection(page, label) {
  await ensureDrawer(page);
  const loc = page.locator('.section-title', { hasText: label }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await scrollUntil(page, loc);
    const info = await loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        collapsed: !!(el.parentElement && el.parentElement.classList.contains('collapsed')),
        x: r.left, y: r.top, w: r.width, h: r.height
      };
    });
    if (!info.collapsed) return;
    await clickAt(page, info.x + info.w / 2, info.y + info.h / 2);
    const still = await loc.evaluate((el) => !!(el.parentElement && el.parentElement.classList.contains('collapsed')));
    if (!still) return;
  }
  throw new Error('section stayed collapsed ' + label);
}

async function brickCount(page) {
  const t = await page.locator('#brickCount').textContent();
  return parseInt(t || '0', 10) || 0;
}

async function projectPlateCell(page, fx, fy) {
  return page.evaluate(({ fx, fy }) => {
    const cam = window.camera;
    const THREE = window.THREE;
    const canvas = document.querySelector('#container canvas');
    if (!cam || !THREE || !canvas) return null;
    cam.updateMatrixWorld();
    const STUD = 0.8;
    const N = 96;
    const rect = canvas.getBoundingClientRect();
    const world = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const wantX = rect.left + fx * rect.width;
    const wantY = rect.top + fy * rect.height;
    let best = null;
    let bestD = Infinity;
    for (let gz = 0; gz < N; gz++) {
      for (let gx = 0; gx < N; gx++) {
        world.set((gx + 0.5) * STUD, 0.2, (gz + 0.5) * STUD);
        ndc.copy(world).applyMatrix4(cam.matrixWorldInverse);
        if (ndc.z > -0.05) continue;
        ndc.copy(world).project(cam);
        if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y) || ndc.z < -1 || ndc.z > 1) continue;
        const nx = ndc.x * 0.5 + 0.5;
        const ny = -ndc.y * 0.5 + 0.5;
        const sx = rect.left + nx * rect.width;
        const sy = rect.top + ny * rect.height;
        if (sx < rect.left + 2 || sy < rect.top + 2 || sx > rect.right - 2 || sy > rect.bottom - 2) continue;
        const d = (sx - wantX) * (sx - wantX) + (sy - wantY) * (sy - wantY);
        if (d < bestD) {
          bestD = d;
          best = { x: sx, y: sy, gx, gz };
        }
      }
    }
    if (!best || bestD > 90 * 90) return null;
    return best;
  }, { fx: fx == null ? 0.5 : fx, fy: fy == null ? 0.62 : fy });
}

async function placeProjected(page, fx, fy) {
  const hit = await projectPlateCell(page, fx, fy);
  if (!hit) throw new Error('no plate cell at ' + fx + ',' + fy);
  await placeAt(page, hit.x, hit.y);
  return hit;
}

async function clickStud(page, fx, stack) {
  if (stack) {
    const shot = await grabCanvas(page);
    const blob = brickBlob(shot.img, plateInset(page, shot));
    if (blob.n > 12) {
      const x = shot.clip.x + blob.cx / shot.dpr;
      const y = shot.clip.y + blob.cy / shot.dpr;
      await placeAt(page, x, y);
      return { x, y };
    }
  }
  return placeProjected(page, fx, 0.62);
}

async function locateStud(page, fx) {
  const hit = await projectPlateCell(page, fx, 0.62);
  if (!hit) throw new Error('no plate cell in view at ' + fx);
  return { x: hit.x, y: hit.y };
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

function isPlateGreen(r, g, b) {
  return g > 55 && g > r + 6 && g > b + 6;
}

function fftAc(values) {
  const n = values.length;
  if (n < 16) return { ac: 0, band: 0 };
  let mean = 0;
  for (let i = 0; i < n; i++) mean += values[i];
  mean /= n;
  const k0 = Math.max(1, Math.floor(n / 48));
  const k1 = Math.min(Math.floor(n / 2), Math.ceil(n / 6));
  let ac = 0;
  let band = 0;
  for (let k = 1; k <= Math.floor(n / 2); k++) {
    let re = 0;
    let im = 0;
    const ang = -2 * Math.PI * k / n;
    for (let i = 0; i < n; i++) {
      const w = values[i] - mean;
      re += w * Math.cos(ang * i);
      im += w * Math.sin(ang * i);
    }
    const power = re * re + im * im;
    ac += power;
    if (k >= k0 && k <= k1) band += power;
  }
  return { ac, band };
}

function wholePlateBands(img) {
  const { width, height, data } = img;
  const lumAt = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isPlateGreen(r, g, b)) return null;
    return r * 0.3 + g * 0.5 + b * 0.2;
  };
  let top = -1;
  let bot = -1;
  const means = [];
  const vars = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    let s = 0;
    let s2 = 0;
    for (let x = 0; x < width; x += 2) {
      const lum = lumAt(x, y);
      if (lum == null) continue;
      n++;
      s += lum;
      s2 += lum * lum;
    }
    if (n <= width / 16) continue;
    const mean = s / n;
    means.push(mean);
    vars.push(Math.max(0, s2 / n - mean * mean));
    if (top < 0) top = y;
    bot = y;
  }
  let flatPeaks = 0;
  if (means.length >= 8) {
    let prevSign = 0;
    let prev = means[0];
    for (let i = 1; i < means.length; i++) {
      const d = means[i] - means[i - 1];
      const sign = d > 1.2 ? 1 : d < -1.2 ? -1 : 0;
      if (sign && prevSign && sign !== prevSign && Math.abs(means[i] - prev) > 5) {
        if (vars[i] < 12 && vars[i - 1] < 12) flatPeaks++;
        prev = means[i];
      }
      if (sign) prevSign = sign;
    }
  }
  const ySignals = [];
  const xSignals = [];
  if (top >= 0 && bot - top >= 24) {
    const yStep = Math.max(1, Math.floor((bot - top) / 180));
    for (let col = 0; col < 8; col++) {
      const x = Math.floor(width * (0.16 + col * 0.09));
      const column = [];
      for (let y = top; y <= bot; y += yStep) {
        const lum = lumAt(Math.min(width - 1, x), Math.min(height - 1, y));
        column.push(lum == null ? 0 : lum);
      }
      if (column.length >= 16) ySignals.push(fftAc(column));
    }
    const x0 = Math.floor(width * 0.08);
    const x1 = Math.floor(width * 0.92);
    const xStep = Math.max(1, Math.floor((x1 - x0) / 180));
    for (let row = 0; row < 8; row++) {
      const y = Math.floor(top + (bot - top) * (0.12 + row * 0.1));
      const across = [];
      for (let x = x0; x <= x1; x += xStep) {
        const lum = lumAt(Math.min(width - 1, x), Math.min(height - 1, y));
        across.push(lum == null ? 0 : lum);
      }
      if (across.length >= 16) xSignals.push(fftAc(across));
    }
  }
  const sumBand = (list) => list.reduce((s, item) => s + item.band, 0);
  const yBand = sumBand(ySignals);
  const xBand = sumBand(xSignals);
  const band = (yBand + xBand) > 0 ? yBand / (yBand + xBand) : 0;
  return { rows: means.length, peaks: flatPeaks, band };
}

function moirePeaks(img) {
  return wholePlateBands(img).peaks;
}

async function plateStudField(page, shot) {
  const img = shot.img;
  const cells = await page.evaluate(() => {
    const cam = window.camera;
    const THREE = window.THREE;
    const canvas = document.querySelector('#container canvas');
    if (!cam || !THREE || !canvas) return { cells: [], plateMin: 0, plateMax: 0 };
    cam.updateMatrixWorld();
    const STUD = 0.8;
    const N = 96;
    const rect = canvas.getBoundingClientRect();
    const world = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const salt = Math.abs(Math.round(cam.position.x * 4) + Math.round(cam.position.z * 7) + Math.round(cam.position.y)) % 3;
    const hits = [];
    let plateMin = 1;
    let plateMax = 0;
    const origin = 2 + salt;
    for (let gz = origin; gz < N - 2; gz += 4) {
      for (let gx = origin; gx < N - 2; gx += 4) {
        world.set((gx + 0.5) * STUD, 0.08, (gz + 0.5) * STUD);
        ndc.copy(world).applyMatrix4(cam.matrixWorldInverse);
        if (ndc.z > -0.2) continue;
        ndc.copy(world).project(cam);
        if (!Number.isFinite(ndc.x) || ndc.z < -1 || ndc.z > 1) continue;
        const nx = ndc.x * 0.5 + 0.5;
        const ny = -ndc.y * 0.5 + 0.5;
        if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) continue;
        if (nx < plateMin) plateMin = nx;
        if (nx > plateMax) plateMax = nx;
        if (nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.92) continue;
        const right = new THREE.Vector3((gx + 1.5) * STUD, 0.08, (gz + 0.5) * STUD).project(cam);
        const down = new THREE.Vector3((gx + 0.5) * STUD, 0.08, (gz + 1.5) * STUD).project(cam);
        const rx = (right.x * 0.5 + 0.5 - nx) * rect.width;
        const ry = (-right.y * 0.5 + 0.5 - ny) * rect.height;
        const zx = (down.x * 0.5 + 0.5 - nx) * rect.width;
        const zy = (-down.y * 0.5 + 0.5 - ny) * rect.height;
        const pitchX = Math.hypot(rx, ry);
        const pitchY = Math.hypot(zx, zy);
        if (pitchX < 5 || pitchY < 4) continue;
        // Halfway to the next stud is the gap between disks. Screen axes are
        // diagonal to the grid at the home camera, so a horizontal step misses it.
        hits.push({ nx, ny, pitchX, pitchY, gx: rx * 0.5, gy: ry * 0.5, zx: zx * 0.5, zy: zy * 0.5 });
      }
    }
    const span = Math.max(0.001, plateMax - plateMin);
    const buckets = [[], [], []];
    for (let i = 0; i < hits.length; i++) {
      const side = Math.min(2, Math.max(0, Math.floor(((hits[i].nx - plateMin) / span) * 3)));
      buckets[side].push(hits[i]);
    }
    const picked = [];
    for (let b = 0; b < 3; b++) {
      const bucket = buckets[b];
      const n = Math.min(6, bucket.length);
      if (bucket.length <= 6) {
        for (let i = 0; i < bucket.length; i++) picked.push(bucket[i]);
        continue;
      }
      const step = bucket.length / n;
      for (let i = 0; i < n; i++) picked.push(bucket[Math.min(bucket.length - 1, Math.floor((i + 0.5) * step))]);
    }
    return { cells: picked, plateMin, plateMax };
  });
  const plateMin = cells.plateMin;
  const plateMax = cells.plateMax;
  const samples = cells.cells || [];
  const bands = wholePlateBands(img);
  const lum = (x, y) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null;
    const i = (y * img.width + x) * 4;
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    if (!isPlateGreen(r, g, b)) return null;
    return r * 0.3 + g * 0.5 + b * 0.2;
  };
  const shades = [];
  let disks = 0;
  for (let i = 0; i < samples.length; i++) {
    const cell = samples[i];
    const x = Math.round(cell.nx * img.width);
    const y = Math.round(cell.ny * img.height);
    const s = shot.dpr;
    const at = (ox, oy) => lum(Math.round(x + ox * s), Math.round(y + oy * s));
    const c = lum(x, y);
    const left = at(-cell.gx, -cell.gy);
    const right = at(cell.gx, cell.gy);
    const up = at(-cell.zx, -cell.zy);
    const down = at(cell.zx, cell.zy);
    const axis = (a, b) => {
      if (c == null) return null;
      const vals = [];
      if (a != null) vals.push(c - a);
      if (b != null) vals.push(c - b);
      if (!vals.length) return null;
      return Math.min.apply(null, vals);
    };
    const hx = axis(left, right);
    const vy = axis(up, down);
    if (hx == null || vy == null) {
      samples[i].skip = true;
      continue;
    }
    // A cell under about 7 px on its short axis cannot show a gap on both
    // axes. It still has to be brighter than the gap along the resolved axis,
    // which a full-width stripe is not.
    const shortPitch = Math.min(cell.pitchX, cell.pitchY);
    const longC = cell.pitchX >= cell.pitchY ? hx : vy;
    const disk = shortPitch >= 7 ? (hx >= 8 && vy >= 8) : longC >= 8;
    samples[i].disk = disk;
    if (disk) {
      disks++;
      shades.push(shortPitch >= 7 ? Math.min(hx, vy) : longC);
    }
  }
  shades.sort((a, b) => a - b);
  const shade = shades.length ? shades[Math.floor(shades.length / 2)] : 0;
  const spanNx = Math.max(0.001, plateMax - plateMin);
  const sides = [
    { samples: 0, disks: 0 },
    { samples: 0, disks: 0 },
    { samples: 0, disks: 0 }
  ];
  let counted = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].skip) continue;
    counted++;
    const side = Math.min(2, Math.max(0, Math.floor(((samples[i].nx - plateMin) / spanNx) * 3)));
    sides[side].samples++;
    if (samples[i].disk) sides[side].disks++;
  }
  return {
    samples: counted,
    disks,
    shade,
    shadeN: shades.length,
    band: bands.band,
    peaks: bands.peaks,
    rows: bands.rows,
    sides
  };
}

function studFieldProblems(field) {
  const problems = [];
  if (!field || field.samples < 8) {
    problems.push('plate samples ' + (field ? field.samples : 0));
    return problems;
  }
  if (field.disks < 8 || field.disks * 2 < field.samples) problems.push('stud disks ' + field.disks + '/' + field.samples);
  if (!(field.band <= 0.68)) problems.push('row-band energy ' + field.band.toFixed(2));
  if (!(field.shade >= 8 && field.shadeN >= 6)) problems.push('stud shade ' + field.shade.toFixed(1) + ' n ' + field.shadeN);
  const sideNames = ['left', 'mid', 'right'];
  for (let i = 0; i < 3; i++) {
    const side = field.sides && field.sides[i];
    const disksOnSide = side ? side.disks : 0;
    const samplesOnSide = side ? side.samples : 0;
    if (samplesOnSide < 1 || disksOnSide < 1 || disksOnSide * 2 < samplesOnSide) {
      problems.push(sideNames[i] + ' studs ' + disksOnSide + '/' + samplesOnSide);
    }
  }
  return problems;
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

function gapPx(a, b) {
  if (!a || !b) return 999;
  const overlapX = a.x < b.x + b.width && b.x < a.x + a.width;
  const overlapY = a.y < b.y + b.height && b.y < a.y + a.height;
  if (overlapX && overlapY) return 0;
  const gx = a.x + a.width < b.x ? b.x - (a.x + a.width) : b.x + b.width < a.x ? a.x - (b.x + b.width) : 0;
  const gy = a.y + a.height < b.y ? b.y - (a.y + a.height) : b.y + b.height < a.y ? a.y - (b.y + b.height) : 0;
  if (overlapX) return gy;
  if (overlapY) return gx;
  return Math.hypot(gx, gy);
}

function relLuminance(rgb) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function contrastRatio(a, b) {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

async function camPose(page) {
  return page.evaluate(() => {
    const c = window.camera;
    const t = window.controls && window.controls.target;
    if (!c || !c.position || !t) return null;
    return { x: c.position.x, y: c.position.y, z: c.position.z, tx: t.x, ty: t.y, tz: t.z };
  });
}

function poseStill(a, b) {
  if (!a || !b) return false;
  return ['x', 'y', 'z', 'tx', 'ty', 'tz'].every((k) => Math.abs(a[k] - b[k]) < 0.05);
}

function poseShift(a, b) {
  if (!a || !b) return 999;
  return Math.max(
    Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z),
    Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty), Math.abs(a.tz - b.tz)
  );
}

function plateFraction(img) {
  const { width, height, data } = img;
  let n = 0;
  let plate = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      n++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > 70 && g > r + 8 && g > b + 8) plate++;
    }
  }
  return n ? plate / n : 0;
}

function plateBand(img) {
  const { width, height, data } = img;
  const span = plateSpan(img);
  const y0 = span.top >= 0 ? span.top : Math.floor(height * 0.5);
  const y1 = span.bot >= 0 ? span.bot : Math.floor(height * 0.88);
  const whole = wholePlateBands(img);
  function xPeaks(xa, xb, y) {
    let n = 0;
    let prev = 0;
    for (let x = xa + 2; x < xb - 2; x++) {
      const i = (y * width + x) * 4;
      const g = data[i + 1];
      const green = g > 70 && g > data[i] && g > data[i + 2];
      if (!green) { prev = 0; continue; }
      const left = data[(y * width + (x - 2)) * 4 + 1];
      const right = data[(y * width + (x + 2)) * 4 + 1];
      if (g >= left + 8 && g >= right + 8 && g >= prev) n++;
      prev = g;
    }
    return n;
  }
  const thirds = [];
  for (const fx of [0.14, 0.4, 0.66]) {
    const xa = Math.floor(width * fx);
    const xb = Math.floor(width * (fx + 0.2));
    const scores = [];
    for (let k = 1; k <= 5; k++) {
      const y = Math.floor(y0 + (y1 - y0) * (k / 6));
      scores.push(xPeaks(xa, xb, y));
    }
    scores.sort((a, b) => a - b);
    thirds.push(scores[Math.floor(scores.length / 2)]);
  }
  return { peaks: whole.peaks, rows: whole.rows, thirds, band: whole.band };
}

function brickRelief(img, blob) {
  if (!blob || blob.n < 8) return { spread: 0, studs: 0, n: blob ? blob.n : 0 };
  const { width, data } = img;
  const lumas = [];
  const lumaAt = (x, y) => {
    const i = (y * width + x) * 4;
    if (!isRed(data[i], data[i + 1], data[i + 2])) return -1;
    return data[i] * 0.25 + data[i + 1] * 0.65 + data[i + 2] * 0.1;
  };
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const l = lumaAt(x, y);
      if (l >= 0) lumas.push(l);
    }
  }
  if (lumas.length < 8) return { spread: 0, studs: 0, n: lumas.length };
  const sorted = lumas.slice().sort((a, b) => a - b);
  const spread = sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)];
  let studs = 0;
  for (let y = blob.minY + 2; y <= blob.maxY - 2; y += 2) {
    for (let x = blob.minX + 2; x <= blob.maxX - 2; x += 2) {
      const l = lumaAt(x, y);
      if (l < 0) continue;
      let higher = 0;
      let ok = true;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const n = lumaAt(x + dx, y + dy);
        if (n < 0) { ok = false; break; }
        if (l > n + 8) higher++;
      }
      if (ok && higher >= 3) studs++;
    }
  }
  return { spread, studs, n: lumas.length };
}

function viewAngle(a, b) {
  if (!a || !b) return 999;
  const ax = a.x - a.tx;
  const ay = a.y - a.ty;
  const az = a.z - a.tz;
  const bx = b.x - b.tx;
  const by = b.y - b.ty;
  const bz = b.z - b.tz;
  const na = Math.hypot(ax, ay, az) || 1;
  const nb = Math.hypot(bx, by, bz) || 1;
  const dot = (ax * bx + ay * by + az * bz) / (na * nb);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

async function modeSnap(page) {
  const pose = await camPose(page);
  const ui = await page.evaluate(() => {
    const cls = (id, c) => {
      const el = document.getElementById(id);
      return !!(el && el.classList.contains(c));
    };
    const toast = document.getElementById('toast');
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
      paint: cls('paintBtn', 'paint-active'),
      grav: cls('gravityBtn', 'active'),
      walk: cls('fpsModeUI', 'visible'),
      toast: toast ? (toast.textContent || '').replace(/\s+/g, ' ').trim() : ''
    };
  });
  ui.pose = pose;
  return ui;
}

function modeLeak(before, after, expected) {
  const problems = [];
  if (after.value !== expected) problems.push('value "' + after.value + '"');
  if (after.rot !== before.rot) problems.push('rot ' + after.rot);
  if (after.mirror !== before.mirror) problems.push('mirror');
  if (after.tool !== before.tool) problems.push('tool');
  if (after.move !== before.move) problems.push('move');
  if (after.del !== before.del) problems.push('delete');
  if (after.floor !== before.floor) problems.push('floor');
  if (after.wall !== before.wall) problems.push('wall');
  if (after.drop !== before.drop) problems.push('dropper');
  if (after.paint !== before.paint) problems.push('paint');
  if (after.grav !== before.grav) problems.push('gravity');
  if (after.walk !== before.walk) problems.push('walk');
  if (poseShift(before.pose, after.pose) > 0.2) problems.push('camera');
  const shouted = /floor|gravity|wall|mirror|delete|dropper|paint|move mode|pitch|roll|walk mode/i;
  if (after.toast !== before.toast && shouted.test(after.toast)) problems.push('toast ' + after.toast.slice(0, 40));
  return problems;
}

async function clickNameField(page) {
  const field = await page.locator('#projectName').boundingBox();
  if (!field || field.width < 8 || field.height < 8) throw new Error('name field missing');
  const x = field.x + Math.min(28, field.width / 2);
  const y = field.y + field.height / 2;
  await clickAt(page, x, y);
  const t0 = Date.now();
  let id = '';
  while (Date.now() - t0 < 2500) {
    id = await page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
    if (id === 'projectName') return;
  }
  throw new Error('name click did not focus, active ' + id);
}

async function settlePose(page) {
  let prev = await camPose(page);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => new Promise((r) => setTimeout(r, 60)));
    const now = await camPose(page);
    if (poseStill(prev, now)) return now;
    prev = now;
  }
  return prev;
}

async function topIsModal(page, sel, modalSel) {
  const box = await page.locator(sel).boundingBox();
  if (!box || box.width < 4 || box.height < 4) return sel + ' missing';
  const x = box.x + Math.min(box.width / 2, 18);
  const y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py, modal]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return 'none';
    const root = document.querySelector(modal);
    if (root && (el === root || root.contains(el))) return 'modal';
    return (el.id || el.className || el.tagName || 'node').toString().slice(0, 48);
  }, [x, y, modalSel]);
  return hit === 'modal' ? '' : sel + ' draws over the modal (' + hit + ')';
}

async function pointerSpace(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#container canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      dpr: window.devicePixelRatio || 1,
      pageScale: (window.visualViewport && window.visualViewport.scale) || 1
    };
  });
}

function mapPointer(space, shot, ix, iy) {
  // Screenshot pixels per CSS pixel, then the page scale. At scale 1.1 the
  // bitmap stays about 1280 wide while the drawn plate is scaled inside it,
  // and devicePixelRatio stays 1. Scale 0.9 reports visualViewport.scale 1.
  const dpr = (shot && shot.dpr) || (space && space.dpr) || 1;
  const pageScale = (space && space.pageScale) || 1;
  const originX = shot && shot.clip ? shot.clip.x : space.left;
  const originY = shot && shot.clip ? shot.clip.y : space.top;
  return {
    x: originX + ix / dpr / pageScale,
    y: originY + iy / dpr / pageScale
  };
}

function pixelShift(before, after) {
  if (!before || !after || before.width !== after.width || before.height !== after.height) {
    return { n: 0, size: (before && before.width) + 'x' + (before && before.height) + '/' + (after && after.width) + 'x' + (after && after.height) };
  }
  const w = before.width;
  const h = before.height;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dr = Math.abs(after.data[i] - before.data[i]);
      const dg = Math.abs(after.data[i + 1] - before.data[i + 1]);
      const db = Math.abs(after.data[i + 2] - before.data[i + 2]);
      if (dr + dg + db > 28) {
        n++;
        sx += x;
        sy += y;
      }
    }
  }
  if (!n) return { n: 0 };
  return { n, cx: sx / n, cy: sy / n };
}

function largestRedSide(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const seen = new Uint8Array(w * h);
  const isRedPx = (i) => data[i] > 140 && data[i] > data[i + 1] + 28 && data[i] > data[i + 2] + 28;
  let best = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || !isRedPx(start * 4)) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = (p - px) / w;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (px > 0 && !seen[p - 1] && isRedPx((p - 1) * 4)) { seen[p - 1] = 1; stack.push(p - 1); }
        if (px + 1 < w && !seen[p + 1] && isRedPx((p + 1) * 4)) { seen[p + 1] = 1; stack.push(p + 1); }
        if (py > 0 && !seen[p - w] && isRedPx((p - w) * 4)) { seen[p - w] = 1; stack.push(p - w); }
        if (py + 1 < h && !seen[p + w] && isRedPx((p + w) * 4)) { seen[p + w] = 1; stack.push(p + w); }
      }
      best = Math.max(best, maxX - minX + 1, maxY - minY + 1);
    }
  }
  return best;
}

function redSides(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const seen = new Uint8Array(w * h);
  const isRedPx = (i) => data[i] > 140 && data[i] > data[i + 1] + 28 && data[i] > data[i + 2] + 28;
  const sides = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || !isRedPx(start * 4)) continue;
      let n = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        const px = p % w;
        const py = (p - px) / w;
        n++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (px > 0 && !seen[p - 1] && isRedPx((p - 1) * 4)) { seen[p - 1] = 1; stack.push(p - 1); }
        if (px + 1 < w && !seen[p + 1] && isRedPx((p + 1) * 4)) { seen[p + 1] = 1; stack.push(p + 1); }
        if (py > 0 && !seen[p - w] && isRedPx((p - w) * 4)) { seen[p - w] = 1; stack.push(p - w); }
        if (py + 1 < h && !seen[p + w] && isRedPx((p + w) * 4)) { seen[p + w] = 1; stack.push(p + w); }
      }
      if (n >= 12) sides.push(Math.max(maxX - minX + 1, maxY - minY + 1));
    }
  }
  return sides;
}

function farPlate(img) {
  const { width, height, data } = img;
  function colPeaks(fx) {
    const x = Math.floor(width * fx);
    const y0 = Math.floor(height * 0.36);
    const y1 = Math.floor(height * 0.56);
    const vals = [];
    for (let y = y0; y < y1; y++) {
      const i = (y * width + x) * 4;
      const g = data[i + 1];
      vals.push(g > 60 && g > data[i] + 4 && g > data[i + 2] + 4 ? g : null);
    }
    let peaks = 0;
    let prevSign = 0;
    let prev = 0;
    let seen = 0;
    for (let i = 0; i < vals.length; i++) if (vals[i] != null) { prev = vals[i]; break; }
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] == null || vals[i - 1] == null) { prevSign = 0; continue; }
      seen++;
      const d = vals[i] - vals[i - 1];
      const sign = d > 1.2 ? 1 : d < -1.2 ? -1 : 0;
      if (sign && prevSign && sign !== prevSign && Math.abs(vals[i] - prev) > 8) {
        peaks++;
        prev = vals[i];
      }
      if (sign) prevSign = sign;
    }
    return { peaks, seen };
  }
  function studsAt(yf) {
    const y = Math.floor(height * yf);
    let best = 0;
    for (const fx of [0.36, 0.48, 0.6]) {
      const xa = Math.floor(width * fx);
      const xb = Math.floor(width * (fx + 0.14));
      let n = 0;
      let prev = 0;
      for (let x = xa + 2; x < xb - 2; x++) {
        const i = (y * width + x) * 4;
        const g = data[i + 1];
        if (!(g > 70 && g > data[i] && g > data[i + 2])) { prev = 0; continue; }
        const left = data[(y * width + (x - 2)) * 4 + 1];
        const right = data[(y * width + (x + 2)) * 4 + 1];
        if (g >= left + 8 && g >= right + 8 && g >= prev) n++;
        prev = g;
      }
      if (n > best) best = n;
    }
    return best;
  }
  let stripes = 0;
  let samples = 0;
  for (const fx of [0.4, 0.48, 0.56]) {
    const col = colPeaks(fx);
    samples += col.seen;
    if (col.seen > 12 && col.peaks > stripes) stripes = col.peaks;
  }
  return { stripes, farStuds: Math.max(studsAt(0.42), studsAt(0.48)), samples };
}

function topBlackLine(img) {
  const { width, height, data } = img;
  const x0 = Math.floor(width * 0.42);
  const x1 = Math.floor(width * 0.58);
  const yMax = Math.min(24, height);
  let run = 0;
  let best = 0;
  for (let y = 0; y < yMax; y++) {
    let dark = 0;
    let light = 0;
    let n = 0;
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * 4;
      const luma = data[i] * 0.3 + data[i + 1] * 0.5 + data[i + 2] * 0.2;
      n++;
      if (luma < 18) dark++;
      else if (luma > 80) light++;
    }
    if (n && dark > n * 0.7) run++;
    else {
      if (run >= 1 && run <= 3 && light > n * 0.4) best = Math.max(best, run);
      run = 0;
    }
  }
  return best;
}

function columnStripes(img, fx, y0f, y1f) {
  const { width, height, data } = img;
  const x = Math.max(2, Math.min(width - 3, Math.floor(width * fx)));
  const y0 = Math.floor(height * y0f);
  const y1 = Math.floor(height * y1f);
  const vals = [];
  for (let y = y0; y < y1; y++) {
    const i = (y * width + x) * 4;
    const g = data[i + 1];
    vals.push(g > 60 && g > data[i] + 4 && g > data[i + 2] + 4 ? g : null);
  }
  let peaks = 0;
  let prevSign = 0;
  let prev = 0;
  let seen = 0;
  for (let i = 0; i < vals.length; i++) if (vals[i] != null) { prev = vals[i]; break; }
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] == null || vals[i - 1] == null) { prevSign = 0; continue; }
    seen++;
    const d = vals[i] - vals[i - 1];
    const sign = d > 1.2 ? 1 : d < -1.2 ? -1 : 0;
    if (sign && prevSign && sign !== prevSign && Math.abs(vals[i] - prev) > 8) {
      peaks++;
      prev = vals[i];
    }
    if (sign) prevSign = sign;
  }
  return { peaks, seen };
}

function studPeaksIn(img, y0, y1, x0, x1) {
  const { width, data } = img;
  let best = 0;
  const ya = Math.max(2, y0);
  const yb = Math.min(img.height - 3, y1);
  for (let y = ya; y <= yb; y += 3) {
    let n = 0;
    let prev = 0;
    for (let x = Math.max(2, x0); x < Math.min(width - 2, x1); x++) {
      const i = (y * width + x) * 4;
      const g = data[i + 1];
      if (!(g > 70 && g > data[i] && g > data[i + 2])) { prev = 0; continue; }
      const left = data[(y * width + (x - 2)) * 4 + 1];
      const right = data[(y * width + (x + 2)) * 4 + 1];
      if (g >= left + 8 && g >= right + 8 && g >= prev) n++;
      prev = g;
    }
    if (n > best) best = n;
  }
  return best;
}

function plateSpan(img) {
  const { width, height, data } = img;
  let top = -1;
  let bot = -1;
  for (let y = 0; y < height; y++) {
    let n = 0;
    const step = 4;
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 1] > 60 && data[i + 1] > data[i] + 6 && data[i + 1] > data[i + 2] + 4) n++;
    }
    if (n > (width / step) * 0.22) {
      if (top < 0) top = y;
      bot = y;
    }
  }
  return { top, bot };
}

function solidSkyBar(img) {
  const { width, height, data } = img;
  const x0 = Math.floor(width * 0.28);
  const y0 = Math.floor(height * 0.04);
  const y1 = Math.min(height - 1, Math.floor(height * 0.18));
  let best = 0;
  let at = 0;
  for (let y = y0; y <= y1; y++) {
    let run = 0;
    let longest = 0;
    for (let x = x0; x < width - 8; x++) {
      const i = (y * width + x) * 4;
      const luma = data[i] * 0.3 + data[i + 1] * 0.5 + data[i + 2] * 0.2;
      if (luma < 22) {
        run++;
        if (run > longest) longest = run;
      } else run = 0;
    }
    if (longest > best) { best = longest; at = y; }
  }
  return { best, at };
}

function redFrame(img) {
  const blob = redBlob(img);
  if (!blob.n) return null;
  return {
    n: blob.n,
    cx: blob.cx / img.width,
    left: blob.minX / img.width,
    right: (img.width - 1 - blob.maxX) / img.width,
    span: blob.w / img.width
  };
}

function pitchDeg(pose) {
  if (!pose) return 0;
  const dx = pose.x - pose.tx;
  const dy = pose.y - pose.ty;
  const dz = pose.z - pose.tz;
  return Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
}

function topFaceRed(img, blob) {
  if (!blob || !blob.n) return 0;
  const { data, width } = img;
  const samples = [];
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const i = (y * width + x) * 4;
      if (!isRed(data[i], data[i + 1], data[i + 2])) continue;
      samples.push(data[i]);
    }
  }
  if (!samples.length) return 0;
  samples.sort((a, b) => a - b);
  const cut = Math.floor(samples.length * 0.7);
  let sum = 0;
  for (let i = cut; i < samples.length; i++) sum += samples[i];
  return sum / Math.max(1, samples.length - cut);
}

function horizonSeam(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const at = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const sky = (c) => c[2] > 130 && c[2] > c[1] + 18 && c[2] > c[0] + 8;
  const ground = (c) => c[1] > 55 && c[1] > c[2] + 6 && c[1] + 15 > c[0];
  let vertical = 0;
  let horizontal = 0;
  const x0 = 1080;
  const x1 = Math.min(w - 2, 1240);
  const y0 = 70;
  const y1 = Math.min(h - 2, 220);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const a = at(x, y);
      const right = at(x + 1, y);
      const down = at(x, y + 1);
      if ((sky(a) && ground(right)) || (ground(a) && sky(right))) vertical++;
      if ((sky(a) && ground(down)) || (ground(a) && sky(down))) horizontal++;
    }
  }
  return { vertical, horizontal };
}

// A hard plate edge is a shelf: ground color jumps, then holds.
// Studs oscillate, so a row of flickers does not count. Sky-on-green
// is horizonSeam's job and is not counted here.
function shelfSteps(img, y0, y1, x0, x1, vertical) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const groundAt = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = (y * w + x) * 4;
    const g = data[i + 1];
    const b = data[i + 2];
    return g > 45 && g + 8 > data[i] && g > b + 4;
  };
  const greenAt = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i + 1];
  };
  let worst = 0;
  let at = -1;
  if (!vertical) {
    const yStart = Math.max(0, y0);
    const yEnd = Math.min(h - 8, y1);
    const xStart = Math.max(0, x0);
    const xEnd = Math.min(w - 1, x1);
    for (let y = yStart; y < yEnd; y++) {
      let n = 0;
      for (let x = xStart; x < xEnd; x += 2) {
        if (!groundAt(x, y) || !groundAt(x, y + 2) || !groundAt(x, y + 6)) continue;
        const dg = Math.abs(greenAt(x, y) - greenAt(x, y + 2));
        const hold = Math.abs(greenAt(x, y + 2) - greenAt(x, y + 6));
        if (dg > 18 && hold < 12) n++;
      }
      if (n > worst) { worst = n; at = y; }
    }
    return { worst, at };
  }
  const xStart = Math.max(0, x0);
  const xEnd = Math.min(w - 8, x1);
  const yStart = Math.max(0, y0);
  const yEnd = Math.min(h - 1, y1);
  for (let x = xStart; x < xEnd; x++) {
    let n = 0;
    for (let y = yStart; y < yEnd; y += 2) {
      if (!groundAt(x, y) || !groundAt(x + 2, y) || !groundAt(x + 6, y)) continue;
      const dg = Math.abs(greenAt(x, y) - greenAt(x + 2, y));
      const hold = Math.abs(greenAt(x + 2, y) - greenAt(x + 6, y));
      if (dg > 18 && hold < 12) n++;
    }
    if (n > worst) { worst = n; at = x; }
  }
  return { worst, at };
}

function skyFraction(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  let sky = 0;
  let n = 0;
  const y1 = Math.floor(h * 0.92);
  for (let y = 0; y < y1; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      n++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (b > 150 && b > g + 15 && b > r + 10) sky++;
    }
  }
  return n ? sky / n : 1;
}

function studCentroid(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const cell = 24;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = cell; y < h - cell; y += cell) {
    for (let x = cell; x < w - cell; x += cell) {
      let sum = 0;
      let sum2 = 0;
      let c = 0;
      let sky = 0;
      for (let yy = y; yy < y + cell; yy += 3) {
        for (let xx = x; xx < x + cell; xx += 3) {
          const i = (yy * w + xx) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (b > g + 12 && b > 100) sky++;
          sum += g;
          sum2 += g * g;
          c++;
        }
      }
      const mean = sum / c;
      const variance = sum2 / c - mean * mean;
      if (sky > c * 0.4) continue;
      if (mean > 70 && variance > 280) {
        sx += x + cell / 2;
        sy += y + cell / 2;
        n++;
      }
    }
  }
  if (!n) return null;
  return { x: sx / n, y: sy / n, n };
}

function subjectSpan(img, frame) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  let n = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  const y0 = Math.floor(h * (frame && frame.y0 != null ? frame.y0 : 0.06));
  const y1 = Math.floor(h * (frame && frame.y1 != null ? frame.y1 : 0.9));
  const xLo = Math.floor(w * (frame && frame.x0 != null ? frame.x0 : 0));
  const xHi = Math.floor(w * (frame && frame.x1 != null ? frame.x1 : 1));
  for (let y = y0; y < y1; y += 2) {
    for (let x = Math.max(2, xLo); x < Math.min(w - 2, xHi); x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (b > 140 && b > g + 12 && b > r) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max < 1 ? 0 : (max - min) / max;
      if (sat < 0.28) continue;
      if (g > r + 25 && g > b + 15 && r < 130) continue;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (n < 12) return { n, span: 0 };
  return { n, span: Math.max(maxX - minX + 1, maxY - minY + 1) };
}

function centerSubject(img) {
  const w = img.width;
  const h = img.height;
  const data = img.data;
  const seen = new Uint8Array(w * h);
  const keep = (x, y) => {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (b > 140 && b > g + 12 && b > r) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max < 1 ? 0 : (max - min) / max;
    if (sat < 0.28) return false;
    if (g > r + 25 && g > b + 15 && r < 130) return false;
    return true;
  };
  let best = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || !keep(x, y)) continue;
      let n = 0;
      let sx = 0;
      let sy = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
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
        if (px > 0 && !seen[p - 1] && keep(px - 1, py)) { seen[p - 1] = 1; stack.push(p - 1); }
        if (px + 1 < w && !seen[p + 1] && keep(px + 1, py)) { seen[p + 1] = 1; stack.push(p + 1); }
        if (py > 0 && !seen[p - w] && keep(px, py - 1)) { seen[p - w] = 1; stack.push(p - w); }
        if (py + 1 < h && !seen[p + w] && keep(px, py + 1)) { seen[p + w] = 1; stack.push(p + w); }
      }
      if (n < 20) continue;
      const dist = Math.hypot(sx / n - w / 2, sy / n - h / 2);
      const span = Math.max(maxX - minX + 1, maxY - minY + 1);
      if (!best || dist < best.dist) best = { n, dist, span };
    }
  }
  return best || { n: 0, span: 0 };
}

async function projectRaw(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

async function cdpMove(page, x, y) {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  } finally {
    await client.detach().catch(() => {});
  }
}

async function cdpClick(page, x, y) {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  } finally {
    await client.detach().catch(() => {});
  }
}

async function settledInside(page, selector) {
  let last = '';
  let stable = 0;
  const deadline = Date.now() + 900;
  while (Date.now() < deadline) {
    try {
      const note = await inside(page, selector);
      if (note === last) {
        stable++;
        if (stable >= 2) return note;
      } else {
        last = note;
        stable = 1;
      }
    } catch {
      last = '';
      stable = 0;
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  return inside(page, selector);
}

async function blankModalPoint(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const r = root.getBoundingClientRect();
    for (let y = r.top + 10; y < r.bottom - 8; y += 14) {
      for (let x = r.left + 10; x < r.right - 8; x += 22) {
        const el = document.elementFromPoint(x, y);
        if (!el || !root.contains(el)) continue;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') continue;
        return { x, y };
      }
    }
    return { x: Math.max(2, r.left + 12), y: Math.max(2, r.top + 12) };
  }, selector);
}

async function assertModalQuiet(page, selector, label) {
  const before = await hotState(page);
  const pose = await camPose(page);
  const pt = await blankModalPoint(page, selector);
  assert(pt, label + ' has no box');
  await clickAt(page, pt.x, pt.y);
  await page.keyboard.press('m');
  await page.keyboard.press('n');
  await page.keyboard.press('x');
  await page.keyboard.press('q');
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.wheel(0, -120);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.move(pt.x + 36, pt.y + 18, { steps: 4 });
  await page.mouse.up();
  const after = await hotState(page);
  const pose2 = await camPose(page);
  const problems = [];
  if (after.mirror !== before.mirror) problems.push('mirror');
  if (after.move !== before.move) problems.push('move');
  if (after.del !== before.del) problems.push('delete');
  if (after.rot !== before.rot) problems.push('rotation ' + after.rot);
  if (!poseStill(pose, pose2)) problems.push('camera');
  const still = await page.locator(selector).evaluate((el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
  }).catch(() => false);
  if (!still) problems.push('closed by a hotkey');
  if (problems.length) throw new Error(label + ' ' + problems.join(', '));
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

function satOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < 1 ? 0 : (max - min) / max;
}

function faceSamples(img, pred) {
  const { width, height, data } = img;
  const chrome = (x, y) => y < 90 || y > height - 100 || x > width - 80 || (width > 500 && x < 300);
  function largest(allow) {
    const seen = new Uint8Array(width * height);
    let best = null;
    let huge = false;
    const stack = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const start = y * width + x;
        if (seen[start] || chrome(x, y)) continue;
        const i0 = start * 4;
        if (!allow(data[i0], data[i0 + 1], data[i0 + 2])) continue;
        let n = 0;
        let minX = x; let maxX = x; let minY = y; let maxY = y;
        stack.push(start);
        seen[start] = 1;
        while (stack.length) {
          const p = stack.pop();
          const px = p % width;
          const py = (p - px) / width;
          const i = p * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (!allow(r, g, b)) continue;
          n++;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          const next = [p - 1, p + 1, p - width, p + width];
          for (let k = 0; k < 4; k++) {
            const q = next[k];
            if (q < 0 || q >= seen.length || seen[q]) continue;
            const qx = q % width;
            const qy = (q - qx) / width;
            if (Math.abs(qx - px) + Math.abs(qy - py) !== 1) continue;
            seen[q] = 1;
            if (!chrome(qx, qy)) stack.push(q);
          }
        }
        const wide = maxX - minX > width * 0.85 && maxY - minY > height * 0.45;
        if (wide) { huge = true; continue; }
        if (!best || n > best.n) best = { n, seedX: x, seedY: y };
      }
    }
    return { best, huge };
  }
  function collect(allow, seedX, seedY) {
    const pts = [];
    const seen = new Uint8Array(width * height);
    const stack = [seedY * width + seedX];
    seen[stack[0]] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % width;
      const py = (p - px) / width;
      if (chrome(px, py)) continue;
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!allow(r, g, b)) continue;
      pts.push({ r, g, b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b, h: hueOf(r, g, b) });
      const next = [p - 1, p + 1, p - width, p + width];
      for (let k = 0; k < 4; k++) {
        const q = next[k];
        if (q < 0 || q >= seen.length || seen[q]) continue;
        const qx = q % width;
        const qy = (q - qx) / width;
        if (Math.abs(qx - px) + Math.abs(qy - py) !== 1) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    return pts;
  }
  let allow = pred;
  let found = largest(allow);
  if (!found.best && found.huge) {
    allow = (r, g, b) => pred(r, g, b) && satOf(r, g, b) >= 0.78;
    found = largest(allow);
  }
  if (!found.best || found.best.n < 40) return null;
  const pts = collect(allow, found.best.seedX, found.best.seedY);
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
        // The sheet covers the lower plate. A stud search on that shot
        // clicks grass above the sheet, so the brick is placed first.
        if (phone) await closeDrawer(page);
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
        const field = await plateStudField(phone.page, shot);
        for (const problem of studFieldProblems(field)) hits.push('phone ' + problem);
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
        const field = await plateStudField(page, shot);
        const problems = studFieldProblems(field);
        if (!(peaks < 5)) problems.push('moire peaks ' + peaks);
        assert(problems.length === 0, problems.join('; '));
        return 'peaks ' + peaks + ' disks ' + field.disks + '/' + field.samples + ' band ' + field.band.toFixed(2);
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
            notes.push(label + ' ' + await settledInside(page, item[1]));
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
        await page.keyboard.press('Escape');
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid button.delete').first().waitFor({ state: 'visible', timeout: 8000 });
        await probe('gallery trash', () => clickSel(page, '#galleryGrid button.delete'));
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await scrollUntil(page, page.locator('.saved-project-delete'));
        await probe('project trash', () => clickSel(page, '.saved-project-delete'));
        await page.keyboard.press('Escape');
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
        const emptyOk = await page.locator('#loadConfirmOk').boundingBox().catch(() => null);
        if (emptyOk && emptyOk.width > 4) await clickAt(page, emptyOk.x + emptyOk.width / 2, emptyOk.y + emptyOk.height / 2);
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

    await check('R18a-name-after-place', 'one click after a brick focuses the name, six types, and three is not overwritten', async () => {
      const { page, context } = await openPage(browser, false, 'r18a');
      try {
        const seed = JSON.stringify({
          name: 'three',
          bricks: [
            { type: '2x2', color: '#ff2200', rot: 0, grid: { gx: 2, gz: 2, gy: 0, w: 2, d: 2, hp: 3 } },
            { type: '2x2', color: '#ffe600', rot: 0, grid: { gx: 8, gz: 2, gy: 0, w: 2, d: 2, hp: 3 } },
            { type: '2x2', color: '#1e88e5', rot: 0, grid: { gx: 14, gz: 2, gy: 0, w: 2, d: 2, hp: 3 } }
          ]
        });
        await page.evaluate((raw) => localStorage.setItem('brickProject_three', raw), seed);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        const setup = await page.locator('#projectName').boundingBox();
        await typeInto(page, setup, 'three', 'click');
        const named = await hotState(page);
        assert(named.value === 'three', 'setup name "' + named.value + '"');
        const field = await page.locator('#projectName').boundingBox();
        assert(field && field.width > 8, 'name field missing');
        const stud = await projectPlateCell(page, 0.55, 0.62);
        assert(stud, 'no plate cell');
        const before = await hotState(page);
        const pose = await camPose(page);
        await clickAt(page, stud.x, stud.y);
        await clickAt(page, field.x + field.width - 12, field.y + field.height / 2);
        await page.keyboard.type('six', { delay: 40 });
        const after = await hotState(page);
        const active = await page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
        assert(active === 'projectName', 'first click did not focus, active ' + active);
        assert(after.value.indexOf('six') >= 0, 'value "' + after.value + '"');
        assert(!after.del && after.del === before.del, 'delete toggled');
        assert(!after.move && after.move === before.move, 'move toggled');
        assert(!after.mirror && after.mirror === before.mirror, 'mirror toggled');
        assert(poseStill(pose, await camPose(page)), 'a letter moved the camera');
        const beforeRaw = await projectRaw(page, 'brickProject_three');
        await clickSel(page, '#saveProjectBtn');
        let confirm = false;
        let afterRaw = beforeRaw;
        const t0 = Date.now();
        while (Date.now() - t0 < 1200) {
          confirm = await page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex').catch(() => false);
          afterRaw = await projectRaw(page, 'brickProject_three');
          if (confirm || afterRaw !== beforeRaw) break;
        }
        assert(afterRaw === beforeRaw, 'save silently overwrote project three');
        if (!confirm) {
          const names = await savedNames(page);
          assert(names.indexOf(after.value.trim()) >= 0, 'new name missing, saved ' + names.join(','));
        }
        return 'focused "' + after.value + '"' + (confirm ? ' confirm' : '');
      } finally { await context.close(); }
    });

    await check('R18b-zoom-90-110', 'ghost, placement, and delete stay within 4 px at 90% and 110%', async () => {
      const lines = [];
      for (const scale of [0.9, 1.1]) {
        const { page, context } = await openPage(browser, false, 'r18b' + scale);
        try {
          await ready(page);
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale });
          const rawStud = await projectPlateCell(page, 0.58, 0.6);
          assert(rawStud, 'no plate cell at scale ' + scale);
          const space = await pointerSpace(page);
          const aim = { x: rawStud.x, y: rawStud.y };
          const before = await grabCanvas(page);
          await cdpMove(page, aim.x, aim.y);
          const hovered0 = await grabCanvas(page);
          const ghost0 = pixelShift(before.img, hovered0.img);
          assert(ghost0.n > 12, 'no ghost at ' + scale + ' changed ' + ghost0.n + ' dpr ' + space.dpr + '/' + before.dpr + (ghost0.size ? ' ' + ghost0.size : ''));
          const center = mapPointer(space, hovered0, ghost0.cx, ghost0.cy);
          await cdpMove(page, center.x, center.y);
          const hovered = await grabCanvas(page);
          const ghost = pixelShift(before.img, hovered.img);
          assert(ghost.n > 12, 'ghost left the stud at ' + scale);
          const ghostAt = mapPointer(space, hovered, ghost.cx, ghost.cy);
          const ghostOff = Math.hypot(ghostAt.x - center.x, ghostAt.y - center.y);
          assert(ghostOff <= 4, 'ghost offset ' + ghostOff.toFixed(1) + ' at ' + scale);
          const count0 = await brickCount(page);
          await cdpClick(page, center.x, center.y);
          assert(await waitGrown(page, count0, 2500), 'place missed at ' + scale);
          const placed = await grabCanvas(page);
          const blob = brickBlob(placed.img, plateInset(page, placed));
          assert(blob.n > 8, 'no brick at ' + scale);
          const brickAt = mapPointer(space, placed, blob.cx, blob.cy);
          const placeOff = Math.hypot(brickAt.x - center.x, brickAt.y - center.y);
          assert(placeOff <= 4, 'place offset ' + placeOff.toFixed(1) + ' at ' + scale);
          await page.keyboard.press('x');
          const armed = await page.evaluate(() => document.body.classList.contains('delete-mode'));
          assert(armed, 'delete did not arm at ' + scale);
          const count1 = await brickCount(page);
          await cdpClick(page, brickAt.x, brickAt.y);
          const gone = await page.waitForFunction((n) => {
            const t = document.getElementById('brickCount');
            return (parseInt(t && t.textContent, 10) || 0) < n;
          }, count1, { timeout: 2500 }).then(() => true).catch(() => false);
          assert(gone, 'delete missed the brick at ' + scale);
          const cleared = await grabCanvas(page);
          const left = brickBlob(cleared.img, plateInset(page, cleared));
          if (left.n > 8) {
            const leftAt = mapPointer(space, cleared, left.cx, left.cy);
            const still = Math.hypot(leftAt.x - brickAt.x, leftAt.y - brickAt.y);
            assert(still > 4, 'delete left the brick ' + still.toFixed(1) + ' px from the cursor at ' + scale);
          }
          lines.push(scale + ' ghost ' + ghostOff.toFixed(1) + ' place ' + placeOff.toFixed(1));
        } finally { await context.close(); }
      }
      return lines.join(' | ');
    });

    await check('R18c-thumb-spread', 'gallery thumbs for 1, 6-spread, and 15-spread fill the frame without cropping', async () => {
      const { page, context } = await openPage(browser, false, 'r18c');
      try {
        await ready(page);
        const layouts = {
          one: [[0.55, 0.58]],
          six: [[0.44, 0.50], [0.56, 0.50], [0.44, 0.60], [0.56, 0.60], [0.50, 0.55], [0.50, 0.64]],
          fifteen: []
        };
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) {
            layouts.fifteen.push([0.40 + col * 0.04, 0.48 + row * 0.045]);
          }
        }
        const lines = [];
        for (const kind of ['one', 'six', 'fifteen']) {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await ready(page);
          for (const pair of layouts[kind]) {
            await placeProjected(page, pair[0], pair[1]);
          }
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
          writeFileSync(join(shots, 'r18-thumb-' + kind + '.png'), buf);
          const thumb = decodePng(buf);
          const stats = thumbStats(thumb);
          assert(stats.n >= 150, kind + ' red pixels ' + stats.n + ' (speck or empty)');
          assert(stats.extent >= 0.4 && stats.extent <= 0.75, kind + ' fill ' + (stats.extent * 100).toFixed(1) + '% outside 40-75');
          assert(stats.margin >= 0.02, kind + ' cropped, margin ' + stats.margin.toFixed(3));
          const side = largestRedSide(thumb);
          const share = side / Math.min(thumb.width, thumb.height);
          assert(share >= 0.12, kind + ' brick is a speck, ' + (share * 100).toFixed(1) + '% of the thumb');
          lines.push(kind + ' fill ' + (stats.extent * 100).toFixed(1) + '% brick ' + (share * 100).toFixed(1) + '%');
          await page.keyboard.press('Escape');
        }
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('R18d-ground-1152', 'no hard ground edge near x 1152 y 132 at 1280x800', async () => {
      const { page, context } = await openPage(browser, false, 'r18d');
      try {
        await ready(page);
        const buf = await page.screenshot({ type: 'png' });
        writeFileSync(join(shots, 'r18-ground.png'), buf);
        const seam = horizonSeam(decodePng(buf));
        assert(seam.vertical <= 12 && seam.horizontal <= 12, 'hard edge vertical ' + seam.vertical + ' horizontal ' + seam.horizontal);
        return 'vertical ' + seam.vertical + ' horizontal ' + seam.horizontal;
      } finally { await context.close(); }
    });

    await check('R18e-close-home', 'desktop 2x2 is 30-45 px, studs are quieter, and wheel zoom can inspect it', async () => {
      const { page, context } = await openPage(browser, false, 'r18e');
      try {
        await ready(page);
        const home = await grabCanvas(page, 'r18-home.png');
        const peaks = moirePeaks(home.img);
        const field = await plateStudField(page, home);
        const plateProblems = studFieldProblems(field);
        if (!(peaks < 3)) plateProblems.push('moire peaks ' + peaks);
        assert(plateProblems.length === 0, plateProblems.join('; '));
        const hit = await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r18-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        assert(px >= 30 && px <= 45, 'brick ' + px.toFixed(1) + ' px');
        const cx = shot.clip.x + blob.cx / shot.dpr;
        const cy = shot.clip.y + blob.cy / shot.dpr;
        await page.mouse.move(cx, cy);
        for (let i = 0; i < 14; i++) await page.mouse.wheel(0, -120);
        const close = await grabCanvas(page, 'r18-close.png');
        const blob2 = brickBlob(close.img, plateInset(page, close));
        assert(blob2.n > 8, 'brick left during close zoom');
        const px2 = Math.max(blob2.w, blob2.h) / close.dpr;
        const cx2 = close.clip.x + blob2.cx / close.dpr;
        const cy2 = close.clip.y + blob2.cy / close.dpr;
        const shift = Math.hypot(cx2 - cx, cy2 - cy);
        assert(px2 >= 80, 'close inspection ' + px2.toFixed(1) + ' px');
        assert(shift < 36, 'zoom target moved ' + shift.toFixed(1) + ' px');
        assert(hit.x > 0, 'click missing');
        return 'home ' + px.toFixed(1) + ' close ' + px2.toFixed(1) + ' peaks ' + peaks + ' shift ' + shift.toFixed(1);
      } finally { await context.close(); }
    });

    await check('R18f-modal-keys', 'hotkeys and the camera stay put while a modal is open, and one Esc closes the gallery', async () => {
      const { page, context } = await openPage(browser, false, 'r18f');
      try {
        await page.waitForFunction(() => {
          const m = document.getElementById('tutorialModal');
          return m && m.classList.contains('visible');
        }, null, { timeout: 20000 });
        await assertModalQuiet(page, '#tutorialModal', 'tutorial');
        await ready(page);
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryModal').waitFor({ state: 'visible', timeout: 8000 });
        await assertModalQuiet(page, '#galleryModal', 'gallery');
        await page.keyboard.press('Escape');
        const galleryOpen = await page.locator('#galleryModal').evaluate((el) => el.style.display === 'flex');
        assert(!galleryOpen, 'one Esc left the gallery open');
        await clickStud(page, 0.5, false);
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirm').waitFor({ state: 'visible', timeout: 4000 });
        await assertModalQuiet(page, '#loadConfirm', 'new project');
        return 'tutorial, gallery, new project';
      } finally { await context.close(); }
    });

    await check('R18g-labels-m', 'toolbar labels are 12 px and WCAG AA, and m shows the mirror panel', async () => {
      const { page, context } = await openPage(browser, false, 'r18g');
      try {
        await ready(page);
        const rows = await page.locator('#buildHud .hud-label').evaluateAll((els) => {
          function bgOf(el) {
            let n = el;
            while (n) {
              const s = getComputedStyle(n);
              const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(s.backgroundColor || '');
              if (m && (m[4] == null || Number(m[4]) >= 0.9)) return [Number(m[1]), Number(m[2]), Number(m[3])];
              n = n.parentElement;
            }
            return [0, 0, 0];
          }
          return els.map((el) => {
            const s = getComputedStyle(el);
            const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s.color || '');
            return { size: parseFloat(s.fontSize), color: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0], bg: bgOf(el) };
          });
        });
        assert(rows.length > 0, 'no toolbar labels');
        let worst = 99;
        for (const row of rows) {
          assert(row.size >= 12, 'label ' + row.size + ' px');
          const ratio = contrastRatio(row.color, row.bg);
          if (ratio < worst) worst = ratio;
          assert(ratio >= 4.5, 'contrast ' + ratio.toFixed(2) + ' on ' + row.bg.join(','));
        }
        const canvas = await page.locator('#container canvas').boundingBox();
        await clickAt(page, canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.45);
        await page.keyboard.press('m');
        const note = await settledInside(page, '#mirrorPopup');
        return 'contrast ' + worst.toFixed(2) + ' ' + note;
      } finally { await context.close(); }
    });

    await check('R18h-name-during-open', 'a tap on the name during the drawer open focuses it and saves one', async () => {
      const { page, context } = await openPage(browser, true, 'r18h');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const handle = await page.locator('#panelToggle').boundingBox();
        assert(handle && handle.width > 4, 'no drawer handle');
        await page.touchscreen.tap(handle.x + handle.width / 2, handle.y + handle.height / 2);
        let field = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 700) {
          const box = await page.locator('#projectName').boundingBox().catch(() => null);
          if (box && box.width > 8 && box.y >= -1 && box.y < 820) {
            field = box;
            break;
          }
        }
        assert(field, 'name field not tappable during open');
        await page.touchscreen.tap(field.x + field.width / 2, field.y + field.height / 2);
        await page.keyboard.type('one', { delay: 40 });
        const state = await hotState(page);
        const active = await page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
        assert(active === 'projectName', 'name tap did not focus, active ' + active);
        assert(state.value.indexOf('one') >= 0, 'value "' + state.value + '"');
        assert(!state.move, 'move mode toggled');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('brickProject_')) continue;
            try { if (JSON.parse(localStorage.getItem(k)).name === 'one') return true; } catch { /* skip */ }
          }
          return false;
        }, null, { timeout: 4000 });
        const names = await savedNames(page);
        assert(names.indexOf('Untitled') < 0, 'saved ' + names.join(','));
        return 'saved one';
      } finally { await context.close(); }
    });

    await check('R18i-phone-camera', 'phone home centers the plate with 15-30% sky and the cottage is large', async () => {
      const { page, context } = await openPage(browser, true, 'r18i');
      try {
        await ready(page);
        const home = await grabCanvas(page, 'r18-phone-home.png');
        const sky = skyFraction(home.img);
        assert(sky >= 0.15 && sky <= 0.3, 'sky ' + (sky * 100).toFixed(1) + '%');
        const plate = studCentroid(home.img);
        assert(plate, 'plate not in frame');
        const dx = Math.abs(plate.x - home.img.width / 2) / home.img.width;
        const dy = Math.abs(plate.y - home.img.height / 2) / home.img.height;
        assert(dx < 0.15 && dy < 0.18, 'plate off center dx ' + dx.toFixed(2) + ' dy ' + dy.toFixed(2));
        await clickSel(page, '#starterBar [data-starter="cottage"]');
        await page.waitForFunction(() => {
          const t = document.getElementById('brickCount');
          return (parseInt(t && t.textContent, 10) || 0) > 4;
        }, null, { timeout: 8000 });
        const shot = await grabCanvas(page, 'r18-cottage.png');
        const span = centerSubject(shot.img);
        const css = span.span / shot.dpr;
        assert(css >= 48, 'cottage ' + css.toFixed(1) + ' px');
        return 'sky ' + (sky * 100).toFixed(1) + '% cottage ' + css.toFixed(0) + ' px';
      } finally { await context.close(); }
    });

    await check('R18j-single-tap', 'one phone tap places a brick', async () => {
      const { page, context } = await openPage(browser, true, 'r18j');
      try {
        await ready(page);
        const p = await locateStud(page, 0.5);
        const before = await brickCount(page);
        await page.touchscreen.tap(p.x, p.y);
        assert(await waitGrown(page, before, 2000), 'single tap did not place');
        return 'placed';
      } finally { await context.close(); }
    });

    await check('R18k-hud-overlap', 'rotation, starters, quality, and the drawer do not cover each other', async () => {
      const { page, context } = await openPage(browser, true, 'r18k');
      try {
        await ready(page);
        const minus = () => page.locator('#zoomOutBtn').boundingBox();
        const rot = () => page.locator('.rotation-ind').boundingBox();
        let zoom = await minus();
        let pill = await rot();
        assert(zoom && pill && !overlaps(pill, zoom), 'rotation covers zoom with the drawer closed');
        const starters = await page.locator('#starterBar').boundingBox();
        assert(starters && gapPx(starters, zoom) >= 2, 'starter bar touches zoom, gap ' + (starters ? gapPx(starters, zoom).toFixed(1) : 'none'));
        await clickSel(page, '#panelToggle');
        zoom = await minus();
        pill = await rot();
        assert(zoom && pill && !overlaps(pill, zoom), 'rotation covers zoom with the drawer open');
        const drawer = await page.locator('#controls').boundingBox();
        assert(drawer && drawer.height / 844 <= 0.42, 'drawer covers ' + (drawer ? (drawer.height / 844).toFixed(2) : '?'));
        assert(drawer.y > 844 * 0.45, 'drawer top ' + drawer.y.toFixed(0));
        for (const item of [['#floorBtn', '#buildToolPopup', 'floor'], ['#wallBtn', '#buildToolPopup', 'wall'], ['#mirrorBtn', '#mirrorPopup', 'mirror']]) {
          await openSection(page, /^Tools$/);
          await scrollUntil(page, page.locator(item[0]));
          await clickSel(page, item[0]);
          await settledInside(page, item[1]);
          const pop = await page.locator(item[1]).boundingBox();
          const quality = await page.locator('#qualityBar').boundingBox();
          if (overlaps(pop, quality)) {
            const bleed = await page.locator(item[1]).evaluate((el) => {
              const m = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([\d.]+))?/.exec(getComputedStyle(el).backgroundColor || '');
              if (!m) return 1;
              if (m[1] == null) return 1;
              return Number(m[1]);
            });
            assert(bleed >= 0.98, item[2] + ' shows the quality selector, alpha ' + bleed);
          }
          await page.keyboard.press('Escape');
        }
        return 'drawer ' + (drawer.height / 844).toFixed(3);
      } finally { await context.close(); }
    });

    await check('R18l-empty-save', 'saving a project with zero bricks warns before it writes', async () => {
      const { page, context } = await openPage(browser, false, 'r18l');
      try {
        await ready(page);
        assert((await brickCount(page)) === 0, 'plate was not empty');
        const before = await savedNames(page);
        const mark = page._dialogs.length;
        await clickSel(page, '#saveProjectBtn');
        const dialogs = badDialogs(page, mark);
        assert(dialogs.length === 0, 'native dialog ' + dialogs.join(' | '));
        const warning = await page.evaluate(() => {
          const nodes = document.body.querySelectorAll('*');
          for (const el of nodes) {
            if (el.childElementCount > 4) continue;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
            const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
            if (t.length < 6 || t.length > 180) continue;
            if (!/empty|no bricks|nothing to save|0 bricks|add a brick|brick first/i.test(t)) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 8 && r.height > 8) return t.slice(0, 120);
          }
          return '';
        });
        const after = await savedNames(page);
        assert(warning, 'no warning before an empty save');
        assert(JSON.stringify(after) === JSON.stringify(before), 'wrote ' + after.join(',') + ' before confirm');
        return warning;
      } finally { await context.close(); }
    });

    await check('R19a-arm-delete', 'the first toolbar Delete arms delete and does not remove a brick', async () => {
      const lines = [];
      for (const phone of [false, true]) {
        const { page, context } = await openPage(browser, phone, 'r19a' + (phone ? 'p' : 'd'));
        try {
          await ready(page);
          await clickStud(page, 0.55, false);
          const before = await brickCount(page);
          assert(before >= 1, (phone ? 'phone' : 'desktop') + ' place failed');
          await clickSel(page, '#hudDeleteBtn');
          const after = await brickCount(page);
          const armed = await page.evaluate(() => document.body.classList.contains('delete-mode'));
          assert(after === before, (phone ? 'phone' : 'desktop') + ' delete removed a brick ' + before + '->' + after);
          assert(armed, (phone ? 'phone' : 'desktop') + ' delete did not arm');
          lines.push((phone ? 'phone' : 'desktop') + ' kept ' + after);
        } finally { await context.close(); }
      }
      return lines.join(' | ');
    });

    await check('R19b-name-leak', 'twenty rapid click-then-type trials leak no key and keep every character', async () => {
      const { page, context } = await openPage(browser, false, 'r19b');
      try {
        await ready(page);
        const leaks = [];
        for (let trial = 1; trial <= 20; trial++) {
          const blur = await page.locator('#heightStat').boundingBox();
          assert(blur && blur.width > 2, 'no blur target');
          await page.mouse.click(blur.x + blur.width / 2, blur.y + blur.height / 2);
          const field = await page.locator('#projectName').boundingBox();
          assert(field && field.width > 8, 'name field missing');
          const x = field.x + Math.min(28, field.width / 2);
          const y = field.y + field.height / 2;
          await page.mouse.click(x, y);
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.mouse.click(blur.x + blur.width / 2, blur.y + blur.height / 2);
          const before = await hotState(page);
          await page.mouse.move(x, y);
          await page.mouse.down();
          const typed = page.keyboard.type('fifteen', { delay: 0 });
          await page.mouse.up();
          await typed;
          const after = await hotState(page);
          const dropped = after.value !== 'fifteen';
          const hot = after.floor !== before.floor || after.tool || after.del || after.wall || after.move;
          if (dropped || hot) {
            leaks.push(trial + ' "' + after.value + '"' + (after.floor ? ' floor' : '') + (after.tool ? ' tool' : ''));
            if (after.tool || after.floor) await page.keyboard.press('Escape');
          }
        }
        assert(leaks.length === 0, leaks.length + '/20 leaked ' + leaks.slice(0, 6).join('; '));
        return '0/20';
      } finally { await context.close(); }
    });

    await check('R19c-overwrite', 'saving an existing name asks before it writes', async () => {
      const { page, context } = await openPage(browser, false, 'r19c');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'cabin', 'click');
        await clickSel(page, '#saveProjectBtn');
        const firstConfirm = await page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex').catch(() => false);
        assert(!firstConfirm, 'first save asked');
        await page.waitForFunction(() => {
          const raw = localStorage.getItem('brickProject_cabin');
          if (!raw) return false;
          try { return JSON.parse(raw).bricks.length === 1; } catch { return false; }
        }, null, { timeout: 4000 });
        await clickStud(page, 0.62, false);
        const before = await projectRaw(page, 'brickProject_cabin');
        await clickSel(page, '#saveProjectBtn');
        let confirm = false;
        const t0 = Date.now();
        while (Date.now() - t0 < 1000) {
          confirm = await page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex').catch(() => false);
          if (confirm) break;
        }
        const after = await projectRaw(page, 'brickProject_cabin');
        assert(confirm, 'second save of cabin did not ask');
        assert(after === before, 'second save wrote before confirm');
        return 'asked, kept 1';
      } finally { await context.close(); }
    });

    await check('R19d-new-name', 'after New a typed name is what gets saved', async () => {
      const { page, context } = await openPage(browser, false, 'r19d');
      try {
        await ready(page);
        await clickStud(page, 0.48, false);
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => {
          const t = document.getElementById('brickCount');
          return (parseInt(t && t.textContent, 10) || 0) === 0;
        }, null, { timeout: 4000 });
        await clickStud(page, 0.52, false);
        const field = await page.locator('#projectName').boundingBox();
        assert(field && field.width > 8, 'name field missing after New');
        const x = field.x + Math.min(28, field.width / 2);
        const y = field.y + field.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        const typed = page.keyboard.type('g1build', { delay: 0 });
        await page.mouse.up();
        await typed;
        const state = await hotState(page);
        assert(state.value === 'g1build', 'typed "' + state.value + '"' + (state.tool ? ' tool' : ''));
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('brickProject_')) continue;
            try { if (JSON.parse(localStorage.getItem(k)).name === 'g1build') return true; } catch { /* skip */ }
          }
          return false;
        }, null, { timeout: 4000 });
        const names = await savedNames(page);
        assert(names.indexOf('Untitled') < 0, 'saved ' + names.join(','));
        const shown = await page.locator('#projectName').inputValue();
        assert(shown === 'g1build', 'field became "' + shown + '"');
        return 'saved g1build';
      } finally { await context.close(); }
    });

    await check('R19e-gallery-now', 'Save Current Build refreshes the gallery card immediately', async () => {
      const { page, context } = await openPage(browser, false, 'r19e');
      try {
        await ready(page);
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        for (const fx of [0.42, 0.55, 0.66]) await clickStud(page, fx, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'grow', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_grow'), null, { timeout: 4000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid .gallery-item-meta').first().waitFor({ state: 'visible', timeout: 8000 });
        await page.keyboard.press('Escape');
        await clickStud(page, 0.48, true);
        await clickStud(page, 0.7, false);
        const expectCount = await brickCount(page);
        await clickSel(page, '#galleryBtn');
        await page.locator('#gallerySaveNew').waitFor({ state: 'visible', timeout: 8000 });
        await clickSel(page, '#gallerySaveNew');
        await page.locator('#namePromptOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#namePromptOk');
        const t0 = Date.now();
        let meta = '';
        while (Date.now() - t0 < 1200) {
          meta = await page.locator('#galleryGrid .gallery-item-meta').first().innerText().catch(() => '');
          if (meta.indexOf(String(expectCount) + ' brick') >= 0) break;
        }
        assert(meta.indexOf(String(expectCount) + ' brick') >= 0, 'card still "' + meta + '" after ' + expectCount + ' bricks');
        return meta;
      } finally { await context.close(); }
    });

    await check('R19f-thumb-spread', 'gallery thumbs for 3-spread and 6-spread bricks are framed to the bricks', async () => {
      const { page, context } = await openPage(browser, false, 'r19f');
      try {
        await ready(page);
        const layouts = {
          three: [[0.36, 0.42], [0.64, 0.46], [0.5, 0.68]],
          six: [[0.32, 0.4], [0.5, 0.38], [0.68, 0.42], [0.36, 0.62], [0.55, 0.58], [0.7, 0.66]]
        };
        const lines = [];
        for (const kind of ['three', 'six']) {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await ready(page);
          for (const pair of layouts[kind]) {
            await placeProjected(page, pair[0], pair[1]);
          }
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, kind, 'click');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction((n) => localStorage.getItem('brickProject_' + n), kind, { timeout: 8000 });
          await clickSel(page, '#galleryBtn');
          await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
          const buf = await page.locator('#galleryGrid img').first().screenshot();
          writeFileSync(join(shots, 'r19-thumb-' + kind + '.png'), buf);
          const thumb = decodePng(buf);
          const stats = thumbStats(thumb);
          assert(stats.n >= 150, kind + ' red pixels ' + stats.n + ' (speck or empty)');
          assert(stats.extent >= 0.4 && stats.extent <= 0.75, kind + ' fill ' + (stats.extent * 100).toFixed(1) + '% outside 40-75');
          assert(stats.margin >= 0.02, kind + ' cropped, margin ' + stats.margin.toFixed(3));
          const side = largestRedSide(thumb);
          const share = side / Math.min(thumb.width, thumb.height);
          assert(share >= 0.12, kind + ' brick is a speck, ' + (share * 100).toFixed(1) + '% of the thumb');
          lines.push(kind + ' fill ' + (stats.extent * 100).toFixed(1) + '% brick ' + (share * 100).toFixed(1) + '%');
          await page.keyboard.press('Escape');
        }
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('R19g-ground-band', 'no hard plate edge on the desktop top or right, or on the phone horizon', async () => {
      const lines = [];
      const desk = await openPage(browser, false, 'r19g-d');
      try {
        await ready(desk.page);
        const shot = await grabCanvas(desk.page, 'r19-ground-desk.png');
        const img = shot.img;
        const top = shelfSteps(img, Math.floor(img.height * 0.06), Math.floor(img.height * 0.42), Math.floor(img.width * 0.24), img.width - 8, false);
        const right = shelfSteps(img, Math.floor(img.height * 0.08), Math.floor(img.height * 0.72), Math.floor(img.width * 0.72), img.width - 8, true);
        assert(top.worst < 70, 'desktop top edge y ' + top.at + ' sharp ' + top.worst);
        assert(right.worst < 50, 'desktop right edge x ' + right.at + ' sharp ' + right.worst);
        lines.push('desk top ' + top.worst + ' right ' + right.worst);
      } finally { await desk.context.close(); }
      const phone = await openPage(browser, true, 'r19g-p');
      try {
        await ready(phone.page);
        const shot = await grabCanvas(phone.page, 'r19-ground-phone.png');
        const img = shot.img;
        const y0 = Math.floor(img.height * (280 / 844));
        const y1 = Math.floor(img.height * (320 / 844));
        const band = shelfSteps(img, y0, y1, 8, img.width - 8, false);
        assert(band.worst < 40, 'phone horizon y ' + band.at + ' sharp ' + band.worst);
        lines.push('phone ' + band.worst + ' @ ' + band.at);
      } finally { await phone.context.close(); }
      return lines.join(' | ');
    });

    await check('R19h-tutorial-body', 'every desktop tutorial page shows its body text', async () => {
      const { page, context } = await openPage(browser, false, 'r19h');
      try {
        await page.waitForFunction(() => {
          const modal = document.getElementById('tutorialModal');
          return modal && modal.classList.contains('visible');
        }, null, { timeout: 20000 });
        const bodyOf = () => page.locator('.tutorial-page.active').evaluate((el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const parked = el.classList.contains('brix-park') || el.classList.contains('brix-cold') || s.display === 'none' || s.contentVisibility === 'hidden';
          return { text: (el.innerText || '').replace(/\s+/g, ' ').trim(), h: r.height, parked };
        });
        const lines = [];
        for (let n = 1; n <= 3; n++) {
          let body = { text: '', h: 0, parked: true };
          const t0 = Date.now();
          while (Date.now() - t0 < 2500) {
            body = await bodyOf();
            if (!body.parked && body.h > 40 && body.text.length > 24) break;
          }
          assert(!body.parked && body.h > 40 && body.text.length > 24, 'page ' + n + ' body "' + body.text.slice(0, 40) + '" h ' + body.h);
          lines.push(n + ' ' + body.text.slice(0, 24));
          if (n < 3) await clickSel(page, '#tutorialNext');
        }
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('R19i-phone-frame', 'the phone shows the brick count, a starter, bricks at least 25 px, and 15-30% sky', async () => {
      const { page, context } = await openPage(browser, true, 'r19i');
      try {
        await ready(page);
        const counter = await page.locator('#hudBrickCount').boundingBox().catch(() => null);
        const counterText = await page.locator('#hudStats').innerText().catch(() => '');
        assert(counter && counter.width > 6 && counter.height > 8 && counter.y > 0 && counter.y < 844, 'brick counter hidden');
        const starters = await page.locator('#starterBar').boundingBox();
        assert(starters && starters.width > 40 && starters.y > 0 && starters.y < 844, 'starter build hidden');
        const home = await grabCanvas(page, 'r19-phone-home.png');
        const sky = skyFraction(home.img);
        await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r19-phone-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        assert(px >= 25, 'brick ' + px.toFixed(1) + ' px');
        assert(sky >= 0.15 && sky <= 0.3, 'sky ' + (sky * 100).toFixed(1) + '%');
        return 'counter "' + counterText.trim() + '" brick ' + px.toFixed(1) + ' sky ' + (sky * 100).toFixed(1) + '%';
      } finally { await context.close(); }
    });

    await check('R19j-drawer-hit', 'a name tap while the drawer opens does not hit a saved build', async () => {
      const { page, context } = await openPage(browser, true, 'r19j');
      try {
        const seed = (name, gx) => JSON.stringify({
          name,
          bricks: [{ type: '2x2', color: '#ff2200', rot: 0, grid: { gx, gz: 4, gy: 0, w: 2, d: 2, hp: 3 } }]
        });
        await page.evaluate(([one, untitled]) => {
          localStorage.setItem('brickProject_one', one);
          localStorage.setItem('brickProject_untitled', untitled);
        }, [seed('one', 4), seed('Untitled', 12)]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        await clickSel(page, '#panelToggle');
        const openField = await page.locator('#projectName').boundingBox();
        assert(openField && openField.width > 8 && openField.y > 0 && openField.y < 820, 'name field not in the open drawer');
        const tx = openField.x + openField.width / 2;
        const ty = openField.y + openField.height / 2;
        await clickSel(page, '#panelToggle');
        const handle = await page.locator('#panelToggle').boundingBox();
        await page.touchscreen.tap(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.touchscreen.tap(tx, ty);
        const confirm = await page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex').catch(() => false);
        assert(!confirm, 'name tap opened Load confirm');
        await page.keyboard.type('named', { delay: 0 });
        const value = await page.locator('#projectName').inputValue();
        assert(value.indexOf('named') >= 0, 'typed "' + value + '"');
        return 'named';
      } finally { await context.close(); }
    });

    await check('R19k-one-brick', 'one saved brick reads 1 brick', async () => {
      const { page, context } = await openPage(browser, false, 'r19k');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'solo', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          const list = document.getElementById('savedProjectsList');
          return list && list.innerText.indexOf('solo') >= 0;
        }, null, { timeout: 4000 });
        const list = await page.locator('#savedProjectsList').innerText();
        const hud = await page.locator('#hudStats').innerText();
        assert(list.indexOf('1 brick') >= 0 && list.indexOf('1 bricks') < 0, 'list "' + list.replace(/\s+/g, ' ') + '"');
        assert(hud.indexOf('1 brick') >= 0 && hud.indexOf('1 bricks') < 0, 'hud "' + hud.replace(/\s+/g, ' ') + '"');
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid .gallery-item-meta').first().waitFor({ state: 'visible', timeout: 8000 });
        const meta = await page.locator('#galleryGrid .gallery-item-meta').first().innerText();
        assert(meta.indexOf('1 brick') >= 0 && meta.indexOf('1 bricks') < 0, 'gallery "' + meta + '"');
        return '1 brick';
      } finally { await context.close(); }
    });

    await check('R19l-overlaps', 'the week badge misses the hint and the float misses zoom minus', async () => {
      const { page, context } = await openPage(browser, true, 'r19l');
      try {
        await ready(page);
        await page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 });
        const toast = await page.locator('#toast').boundingBox();
        const badge = await page.locator('.gotw-tag').boundingBox();
        assert(toast && toast.height > 8, 'hint hidden');
        assert(badge && !overlaps(badge, toast), 'week badge overlaps the hint');
        await clickSel(page, '#panelToggle');
        const minus = await page.locator('#zoomOutBtn').boundingBox();
        const floats = ['.brix-more', '.brix-more__toggle', '#phoneViewBtn', '.gotw-tag', '#panelToggle'];
        for (const sel of floats) {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          assert(!box || !overlaps(box, minus), sel + ' overlaps zoom minus');
        }
        const hit = await page.evaluate(() => {
          const el = document.getElementById('zoomOutBtn');
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return top ? (top.id || top.className || top.tagName) : 'none';
        });
        assert(/zoomOutBtn|zoom-btn/.test(String(hit)), 'zoom minus hit ' + hit);
        return 'clear, hit ' + hit;
      } finally { await context.close(); }
    });

    await check('R20a-name-hotkey', 'every hotkey letter stays in a focused empty or selected name field', async () => {
      const { page, context } = await openPage(browser, false, 'r20a');
      const letters = ['w', 'a', 's', 'd', 'r', 'x', 'c', 'p', 'f', 'b', 'g', 't', 'y', 'm', 'n', 'q', 'e', 'v'];
      try {
        await ready(page);
        const leaks = [];
        const quiet = async () => {
          await page.keyboard.press('Escape');
          const blur = await page.locator('#heightStat').boundingBox().catch(() => null);
          if (blur && blur.width > 2) await page.mouse.click(blur.x + blur.width / 2, blur.y + blur.height / 2);
          await page.keyboard.press('Escape');
        };
        for (const letter of letters) {
          for (const selected of [false, true]) {
            await quiet();
            await clickNameField(page);
            if (selected) {
              await page.keyboard.type('zz', { delay: 20 });
              await page.keyboard.press('Control+A');
            } else {
              await page.keyboard.press('Control+A');
              await page.keyboard.press('Backspace');
            }
            const focused = await page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
            if (focused !== 'projectName') {
              leaks.push(letter + (selected ? ' sel' : ' empty') + ' focus ' + focused);
              continue;
            }
            await settlePose(page);
            const before = await modeSnap(page);
            await page.keyboard.type(letter, { delay: 30 });
            const after = await modeSnap(page);
            const problems = modeLeak(before, after, letter);
            if (problems.length) leaks.push(letter + (selected ? ' sel' : ' empty') + ' ' + problems.join(' '));
          }
        }
        assert(leaks.length === 0, leaks.length + ' leaks ' + leaks.slice(0, 8).join('; '));
        return '0/' + (letters.length * 2);
      } finally { await context.close(); }
    });

    await check('R20b-replace-m', 'm does not toggle Mirror while Replace is open', async () => {
      const { page, context } = await openPage(browser, false, 'r20b');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'keep', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_keep'), null, { timeout: 4000 });
        await clickStud(page, 0.62, false);
        await clickSel(page, '#saveProjectBtn');
        await page.locator('#loadConfirm').waitFor({ state: 'visible', timeout: 4000 });
        const before = await modeSnap(page);
        await page.keyboard.press('m');
        const after = await modeSnap(page);
        const open = await page.locator('#loadConfirm').evaluate((el) => el.style.display === 'flex');
        assert(open, 'Replace closed');
        assert(!after.mirror && after.mirror === before.mirror, 'm toggled Mirror behind Replace');
        assert(!after.move, 'm toggled Move');
        return 'replace held';
      } finally { await context.close(); }
    });

    await check('R20c-thumb-angle', 'saves of 1, 3, 6, 8, and 15 bricks share one overhead frame', async () => {
      const { page, context } = await openPage(browser, false, 'r20c');
      try {
        await ready(page);
        const layouts = {
          one: [[0.55, 0.58]],
          three: [[0.46, 0.52], [0.58, 0.52], [0.52, 0.62]],
          six: [[0.44, 0.50], [0.56, 0.50], [0.44, 0.60], [0.56, 0.60], [0.50, 0.55], [0.50, 0.64]],
          eight: [[0.42, 0.48], [0.50, 0.48], [0.58, 0.48], [0.66, 0.48], [0.42, 0.58], [0.50, 0.58], [0.58, 0.58], [0.66, 0.58]],
          fifteen: []
        };
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) layouts.fifteen.push([0.40 + col * 0.04, 0.48 + row * 0.045]);
        }
        const skies = [];
        const lines = [];
        for (const kind of ['one', 'three', 'six', 'eight', 'fifteen']) {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await ready(page);
          for (const pair of layouts[kind]) {
            await placeProjected(page, pair[0], pair[1]);
          }
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
          writeFileSync(join(shots, 'r20-thumb-' + kind + '.png'), buf);
          const thumb = decodePng(buf);
          const sky = skyFraction(thumb);
          const stats = thumbStats(thumb);
          const share = largestRedSide(thumb) / Math.min(thumb.width, thumb.height);
          skies.push(sky);
          assert(sky >= 0.08 && sky <= 0.32, kind + ' sky ' + (sky * 100).toFixed(1) + '%');
          assert(share >= 0.12, kind + ' brick ' + (share * 100).toFixed(1) + '%');
          assert(stats.extent >= 0.4 && stats.extent <= 0.75, kind + ' fill ' + (stats.extent * 100).toFixed(1) + '%');
          lines.push(kind + ' sky ' + (sky * 100).toFixed(0) + ' brick ' + (share * 100).toFixed(0));
          await page.keyboard.press('Escape');
        }
        const spread = Math.max.apply(null, skies) - Math.min.apply(null, skies);
        assert(spread <= 0.1, 'angle spread ' + (spread * 100).toFixed(1) + '%');
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('R20d-desktop-home', 'true desktop home shows a 25-45 px brick and the whole plate', async () => {
      const { page, context } = await openPage(browser, false, 'r20d', { width: 1440, height: 900 });
      try {
        await ready(page);
        const home = await grabCanvas(page, 'r20-desktop-home.png');
        const problems = [];
        const peaks = moirePeaks(home.img);
        if (!(peaks < 3)) problems.push('plate moire peaks ' + peaks);
        const field = await plateStudField(page, home);
        for (const problem of studFieldProblems(field)) problems.push(problem);
        const corners = await page.evaluate(() => {
          const mesh = window.baseplateRef;
          const cam = window.camera;
          const THREE = window.THREE;
          if (!mesh || !cam || !THREE) return null;
          const box = new THREE.Box3().setFromObject(mesh);
          const y = box.max.y;
          const out = [];
          for (const x of [box.min.x, box.max.x]) {
            for (const z of [box.min.z, box.max.z]) {
              const p = new THREE.Vector3(x, y, z).project(cam);
              out.push({
                x: (p.x * 0.5 + 0.5) * window.innerWidth,
                y: (-p.y * 0.5 + 0.5) * window.innerHeight,
                nx: p.x,
                ny: p.y
              });
            }
          }
          return out;
        });
        if (!corners || corners.length !== 4) problems.push('plate corners missing');
        else {
          const clipped = [];
          for (let i = 0; i < corners.length; i++) {
            const c = corners[i];
            const inside = c.nx > -0.98 && c.nx < 0.98 && c.ny > -0.98 && c.ny < 0.98
              && c.x >= home.clip.x + 2 && c.x <= home.clip.x + home.clip.width - 2
              && c.y >= home.clip.y + 2 && c.y <= home.clip.y + home.clip.height - 2;
            if (!inside) clipped.push(i + '@' + c.nx.toFixed(2) + ',' + c.ny.toFixed(2));
          }
          if (clipped.length) problems.push('plate corner clipped ' + clipped.join(' '));
        }
        await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r20-desktop-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        const px = blob.n > 8 ? Math.max(blob.w, blob.h) / shot.dpr : 0;
        if (!(px >= 25 && px <= 45)) problems.push('brick ' + px.toFixed(1) + ' px');
        assert(problems.length === 0, problems.join('; '));
        return 'brick ' + px.toFixed(1) + ' peaks ' + peaks;
      } finally { await context.close(); }
    });

    await check('R20e-counter-studs', 'the brick counter is 13 px and studs read as cylinders', async () => {
      const { page, context } = await openPage(browser, false, 'r20e', { width: 1440, height: 900 });
      try {
        await ready(page);
        const style = await page.locator('#hudStats').evaluate((el) => {
          function bgOf(node) {
            let n = node;
            while (n) {
              const s = getComputedStyle(n);
              const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(s.backgroundColor || '');
              if (m && (m[4] == null || Number(m[4]) >= 0.85)) return [Number(m[1]), Number(m[2]), Number(m[3])];
              n = n.parentElement;
            }
            return [12, 14, 20];
          }
          const s = getComputedStyle(el);
          const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/.exec(s.color || '');
          const box = el.getBoundingClientRect();
          return {
            size: parseFloat(s.fontSize),
            h: box.height,
            color: m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [255, 255, 255],
            alpha: m && m[4] != null ? Number(m[4]) : 1,
            bg: bgOf(el)
          };
        });
        const ink = [
          Math.round(style.color[0] * style.alpha + style.bg[0] * (1 - style.alpha)),
          Math.round(style.color[1] * style.alpha + style.bg[1] * (1 - style.alpha)),
          Math.round(style.color[2] * style.alpha + style.bg[2] * (1 - style.alpha))
        ];
        const ratio = contrastRatio(ink, style.bg);
        const problems = [];
        if (!(style.size >= 13 && style.h >= 13)) problems.push('counter ' + style.size + ' px h ' + style.h.toFixed(1));
        if (!(ratio >= 4.5)) problems.push('counter contrast ' + ratio.toFixed(2));
        const shot = await grabCanvas(page, 'r20-studs.png');
        const field = await plateStudField(page, shot);
        const cylinders = await page.evaluate(() => {
          let mesh = null;
          if (window.scene) window.scene.traverse((obj) => { if (obj.name === 'nearPlateStuds') mesh = obj; });
          return mesh ? mesh.count : 0;
        });
        if (!(cylinders >= 30)) problems.push('cylinder studs ' + cylinders);
        for (const problem of studFieldProblems(field)) problems.push(problem);
        assert(problems.length === 0, problems.join('; '));
        return 'counter ' + style.size + ' px contrast ' + ratio.toFixed(2) + ' studs ' + cylinders + ' shade ' + field.shade.toFixed(1);
      } finally { await context.close(); }
    });

    await check('R20f-phone-drawer', 'an open drawer leaves the plate visible and clear of zoom minus', async () => {
      const { page, context } = await openPage(browser, true, 'r20f');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await clickSel(page, '#panelToggle');
        const open = await drawerOpen(page);
        assert(open, 'drawer stayed closed');
        const shot = await grabCanvas(page, 'r20-drawer.png');
        const plate = plateFraction(shot.img);
        assert(plate >= 0.45, 'plate visible ' + (plate * 100).toFixed(1) + '%');
        const minus = await page.locator('#zoomOutBtn').boundingBox();
        assert(minus && minus.width > 4, 'zoom minus missing');
        const blockers = ['#panelToggle', '.brix-more', '.brix-more__toggle', '.gotw-tag', '#phoneViewBtn'];
        for (const sel of blockers) {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          assert(!box || !overlaps(box, minus), sel + ' overlaps zoom minus');
        }
        const hit = await page.evaluate(() => {
          const el = document.getElementById('zoomOutBtn');
          const r = el.getBoundingClientRect();
          const points = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + r.width / 2, r.top + 3],
            [r.right - 3, r.top + r.height / 2],
            [r.left + r.width / 2, r.bottom - 3]
          ];
          return points.map(([x, y]) => {
            const top = document.elementFromPoint(x, y);
            return top ? (top.id || String(top.className).slice(0, 24) || top.tagName) : 'none';
          }).join(' ');
        });
        assert(/zoomOutBtn/.test(hit), 'zoom minus hit ' + hit);
        return 'plate ' + (plate * 100).toFixed(1) + '% ' + hit;
      } finally { await context.close(); }
    });

    await check('R20g-phone-frame', 'phone sky is 15-30%, the 2x2 is at least 30 px, and the starter is in frame', async () => {
      const { page, context } = await openPage(browser, true, 'r20g');
      try {
        await ready(page);
        const starters = await page.locator('#starterBar').boundingBox();
        assert(starters && starters.width > 40 && starters.y > 0 && starters.y < 800, 'starter build hidden');
        const home = await grabCanvas(page, 'r20-phone-home.png');
        const sky = skyFraction(home.img);
        const y0 = Math.floor(home.img.height * (280 / 844));
        const y1 = Math.floor(home.img.height * (320 / 844));
        const band = shelfSteps(home.img, y0, y1, 8, home.img.width - 8, false);
        assert(band.worst < 40, 'horizon wedge y ' + band.at + ' sharp ' + band.worst);
        assert(sky >= 0.15 && sky <= 0.3, 'sky ' + (sky * 100).toFixed(1) + '%');
        await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r20-phone-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        assert(px >= 30, 'brick ' + px.toFixed(1) + ' px');
        return 'sky ' + (sky * 100).toFixed(1) + '% brick ' + px.toFixed(1) + ' wedge ' + band.worst;
      } finally { await context.close(); }
    });

    await check('R20h-modal-modes', 'badges stay under modals, Save blur ignores keys, and mode banners have an exit', async () => {
      const problems = [];
      const desk = await openPage(browser, false, 'r20h-d');
      try {
        await ready(desk.page);
        await clickStud(desk.page, 0.52, false);
        const field = await desk.page.locator('#projectName').boundingBox();
        await typeInto(desk.page, field, 'ab', 'click');
        await clickSel(desk.page, '#saveProjectBtn');
        await desk.page.waitForFunction(() => localStorage.getItem('brickProject_ab'), null, { timeout: 4000 });
        await desk.page.keyboard.press('n');
        await desk.page.keyboard.press('m');
        await desk.page.keyboard.press('f');
        const leaked = await modeSnap(desk.page);
        if (leaked.move || leaked.mirror || leaked.floor || leaked.tool) {
          problems.push('desktop save blur ' + (leaked.move ? 'move ' : '') + (leaked.mirror ? 'mirror ' : '') + (leaked.floor ? 'floor' : ''));
        }
        await desk.page.keyboard.press('Escape');
        const canvas = await desk.page.locator('#container canvas').boundingBox();
        await desk.page.mouse.click(canvas.x + canvas.width * 0.62, canvas.y + canvas.height * 0.4);
        const banners = [
          ['m', '#mirrorPopup', 'mirror'],
          ['f', '#buildToolPopup', 'floor'],
          ['n', '#moveModeIndicator', 'move'],
          ['x', '#deleteModeBanner', 'delete']
        ];
        for (const row of banners) {
          await desk.page.keyboard.press('Escape');
          await desk.page.mouse.click(canvas.x + canvas.width * 0.62, canvas.y + canvas.height * 0.4);
          await desk.page.keyboard.press(row[0]);
          const host = await desk.page.locator(row[1]).boundingBox().catch(() => null);
          const btn = host ? await desk.page.locator(row[1] + ' button').first().boundingBox().catch(() => null) : null;
          if (!host || host.width < 8 || !btn || btn.width < 8) {
            problems.push(row[2] + ' banner has no exit');
            continue;
          }
          await clickAt(desk.page, btn.x + btn.width / 2, btn.y + btn.height / 2);
          const snap = await modeSnap(desk.page);
          const still = row[2] === 'mirror' ? snap.mirror : row[2] === 'floor' ? (snap.floor || snap.tool) : row[2] === 'move' ? snap.move : snap.del;
          if (still) problems.push(row[2] + ' exit left the mode on');
        }
        await clickSel(desk.page, '#galleryBtn');
        await desk.page.locator('#galleryModal').waitFor({ state: 'visible', timeout: 8000 });
        await desk.page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 }).catch(() => {});
        for (const sel of ['.gotw-tag', '.brix-more__toggle']) {
          const over = await topIsModal(desk.page, sel, '#galleryModal');
          if (over) problems.push('desktop ' + over);
        }
      } finally { await desk.context.close(); }
      const phone = await openPage(browser, true, 'r20h-p');
      try {
        await ready(phone.page);
        await phone.page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 }).catch(() => {});
        await clickSel(phone.page, '#galleryBtn');
        await phone.page.locator('#galleryModal').waitFor({ state: 'visible', timeout: 8000 });
        for (const sel of ['.gotw-tag', '.brix-more__toggle']) {
          const over = await topIsModal(phone.page, sel, '#galleryModal');
          if (over) problems.push('phone ' + over);
        }
        await phone.page.keyboard.press('Escape');
        await clickStud(phone.page, 0.55, false);
        await clickSel(phone.page, '#panelToggle');
        await clickNameField(phone.page);
        await phone.page.keyboard.type('ab', { delay: 30 });
        await clickSel(phone.page, '#saveProjectBtn');
        await phone.page.keyboard.press('n');
        const snap = await modeSnap(phone.page);
        if (snap.move || snap.mirror || snap.floor) problems.push('phone save blur enabled a mode');
      } finally { await phone.context.close(); }
      assert(problems.length === 0, problems.join('; '));
      return 'modals cover badges, modes exit';
    });

    await check('R20i-delete-exit', 'delete mode has a visible exit after a brick is removed', async () => {
      const lines = [];
      for (const phone of [false, true]) {
        const { page, context } = await openPage(browser, phone, 'r20i' + (phone ? 'p' : 'd'));
        try {
          await ready(page);
          const hit = await clickStud(page, 0.55, false);
          const placed = await brickCount(page);
          assert(placed >= 1, (phone ? 'phone' : 'desktop') + ' place failed');
          await clickSel(page, '#hudDeleteBtn');
          const armed = await brickCount(page);
          assert(armed === placed, (phone ? 'phone' : 'desktop') + ' arm deleted');
          await clickAt(page, hit.x, hit.y);
          let left = armed;
          const t0 = Date.now();
          while (Date.now() - t0 < 2000) {
            left = await brickCount(page);
            if (left < placed) break;
          }
          assert(left < placed, (phone ? 'phone' : 'desktop') + ' brick stayed ' + placed);
          const banner = await page.locator('#deleteModeBanner').boundingBox().catch(() => null);
          const btn = banner ? await page.locator('#deleteModeBanner button').first().boundingBox().catch(() => null) : null;
          assert(banner && banner.width > 20 && banner.height > 12, (phone ? 'phone' : 'desktop') + ' no delete exit');
          assert(btn && btn.width > 8, (phone ? 'phone' : 'desktop') + ' exit control missing');
          const label = await page.locator('#deleteModeBanner').innerText();
          assert(/exit/i.test(label), (phone ? 'phone' : 'desktop') + ' exit label "' + label.replace(/\s+/g, ' ') + '"');
          await clickAt(page, btn.x + btn.width / 2, btn.y + btn.height / 2);
          const still = await page.evaluate(() => document.body.classList.contains('delete-mode'));
          const kept = await brickCount(page);
          assert(!still, (phone ? 'phone' : 'desktop') + ' exit left delete on');
          assert(kept === left, (phone ? 'phone' : 'desktop') + ' exit changed the count');
          lines.push((phone ? 'phone' : 'desktop') + ' exit');
        } finally { await context.close(); }
      }
      return lines.join(' | ');
    });

    await check('R20j-phone-ghost', 'the phone ghost is a 2x2 brick preview', async () => {
      const { page, context } = await openPage(browser, true, 'r20j');
      try {
        await ready(page);
        const pt = await projectPlateCell(page, 0.55, 0.62);
        assert(pt, 'no plate cell');
        const x = Math.round(pt.x);
        const y = Math.round(pt.y);
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const span = await page.evaluate(() => {
          const g = window.ghost;
          const cam = window.camera;
          const THREE = window.THREE;
          if (!g || !g.visible || !cam || !THREE) return null;
          const box = new THREE.Box3().setFromObject(g);
          if (!box || box.isEmpty()) return null;
          const xs = [box.min.x, box.max.x];
          const ys = [box.min.y, box.max.y];
          const zs = [box.min.z, box.max.z];
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          let n = 0;
          for (const px of xs) {
            for (const py of ys) {
              for (const pz of zs) {
                const p = new THREE.Vector3(px, py, pz).project(cam);
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
                const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
                const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
                n++;
                if (sx < minX) minX = sx;
                if (sx > maxX) maxX = sx;
                if (sy < minY) minY = sy;
                if (sy > maxY) maxY = sy;
              }
            }
          }
          if (n < 4) return null;
          return { w: maxX - minX, h: maxY - minY };
        });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        assert(span, 'no ghost preview');
        assert(span.w >= 24 && span.h >= 14, 'ghost ' + span.w.toFixed(1) + 'x' + span.h.toFixed(1));
        return 'ghost ' + span.w.toFixed(0) + 'x' + span.h.toFixed(0);
      } finally { await context.close(); }
    });

    await check('R21a-plate-moire', 'desktop home plate has no horizontal stripes and studs across the plate', async () => {
      const { page, context } = await openPage(browser, false, 'r21a', { width: 1440, height: 900 });
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'r21-plate.png');
        const band = plateBand(shot.img);
        const field = await plateStudField(page, shot);
        const problems = studFieldProblems(field);
        if (!(band.peaks < 3)) problems.push('horizontal moire peaks ' + band.peaks + ' rows ' + band.rows);
        if (!(band.band <= 0.68)) problems.push('row-band energy ' + band.band.toFixed(2));
        assert(problems.length === 0, problems.join('; '));
        const sideText = (field.sides || []).map((s) => s.disks + '/' + s.samples).join(' ');
        return 'peaks ' + band.peaks + ' disks ' + field.disks + '/' + field.samples + ' sides ' + sideText;
      } finally { await context.close(); }
    });

    await check('R21b-brick-shade', 'a placed brick at the desktop home zoom shows studs and face shading', async () => {
      const { page, context } = await openPage(browser, false, 'r21b', { width: 1440, height: 900 });
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r21-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const relief = brickRelief(shot.img, blob);
        const problems = [];
        if (!(relief.spread >= 22)) problems.push('flat face spread ' + relief.spread.toFixed(1));
        if (!(relief.studs >= 2)) problems.push('studs ' + relief.studs);
        assert(problems.length === 0, problems.join('; '));
        return 'spread ' + relief.spread.toFixed(1) + ' studs ' + relief.studs;
      } finally { await context.close(); }
    });

    await check('R21c-thumb-res', 'thumbs are at least 400x300 and 3, 6, and 15 spreads stay readable', async () => {
      const { page, context } = await openPage(browser, false, 'r21c');
      try {
        await ready(page);
        const layouts = {
          three: [[0.36, 0.42], [0.64, 0.46], [0.5, 0.68]],
          six: [[0.32, 0.4], [0.5, 0.38], [0.68, 0.42], [0.36, 0.62], [0.55, 0.58], [0.7, 0.66]],
          fifteen: []
        };
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 5; col++) layouts.fifteen.push([0.40 + col * 0.04, 0.48 + row * 0.045]);
        }
        const skies = [];
        const lines = [];
        const problems = [];
        for (const kind of ['three', 'six', 'fifteen']) {
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'domcontentloaded' });
          await ready(page);
          for (const pair of layouts[kind]) {
            await placeProjected(page, pair[0], pair[1]);
          }
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, kind, 'click');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction((n) => localStorage.getItem('brickProject_' + n), kind, { timeout: 8000 });
          await clickSel(page, '#galleryBtn');
          await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
          const dim = await page.locator('#galleryGrid img').first().evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight }));
          if (!(dim.w >= 400 && dim.h >= 300)) problems.push(kind + ' thumb ' + dim.w + 'x' + dim.h);
          const buf = await page.locator('#galleryGrid img').first().screenshot();
          writeFileSync(join(shots, 'r21-thumb-' + kind + '.png'), buf);
          const thumb = decodePng(buf);
          const sky = skyFraction(thumb);
          const stats = thumbStats(thumb);
          const share = largestRedSide(thumb) / Math.min(thumb.width, thumb.height);
          skies.push(sky);
          if (!(sky >= 0.08 && sky <= 0.32)) problems.push(kind + ' sky ' + (sky * 100).toFixed(1) + '%');
          if (!(stats.n >= 150)) problems.push(kind + ' red pixels ' + stats.n);
          if (!(stats.extent >= 0.4 && stats.extent <= 0.75)) problems.push(kind + ' fill ' + (stats.extent * 100).toFixed(1) + '% outside 40-75');
          if (!(stats.margin >= 0.02)) problems.push(kind + ' cropped, margin ' + stats.margin.toFixed(3));
          if (!(share >= 0.12)) problems.push(kind + ' brick ' + (share * 100).toFixed(1) + '%');
          lines.push(kind + ' ' + dim.w + 'x' + dim.h + ' sky ' + (sky * 100).toFixed(0) + ' brick ' + (share * 100).toFixed(1));
          await page.keyboard.press('Escape');
        }
        const spread = Math.max.apply(null, skies) - Math.min.apply(null, skies);
        if (!(spread <= 0.1)) problems.push('angle spread ' + (spread * 100).toFixed(1) + '%');
        assert(problems.length === 0, problems.join('; '));
        return lines.join(' | ');
      } finally { await context.close(); }
    });

    await check('R21d-load-btn', 'the Load button loads the saved project on desktop and on the phone', async () => {
      const lines = [];
      for (const phone of [false, true]) {
        const { page, context } = await openPage(browser, phone, 'r21d' + (phone ? 'p' : 'd'));
        const tag = phone ? 'phone' : 'desktop';
        try {
          await ready(page);
          await clickStud(page, 0.55, false);
          if (phone) await ensureDrawer(page);
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, 'cabin', 'click');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction(() => {
            const raw = localStorage.getItem('brickProject_cabin');
            if (!raw) return false;
            try { return JSON.parse(raw).bricks.length >= 1; } catch { return false; }
          }, null, { timeout: 8000 });
          if (phone) await ensureDrawer(page);
          await clickSel(page, '#newProjectBtn');
          await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
          await clickSel(page, '#loadConfirmOk');
          await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
          if (phone) await ensureDrawer(page);
          await clickSel(page, '#loadProjectBtn');
          await page.locator('.saved-project-name').first().waitFor({ state: 'visible', timeout: 4000 });
          const listed = await page.locator('.saved-project-name').first().innerText();
          assert(listed.trim() === 'cabin', tag + ' list "' + listed + '"');
          const mid = await brickCount(page);
          assert(mid === 0, tag + ' opening the list loaded ' + mid);
          await clickSel(page, '#loadProjectBtn');
          let back = 0;
          const t0 = Date.now();
          while (Date.now() - t0 < 2000) {
            back = await brickCount(page);
            if (back >= 1) break;
          }
          const name = await page.locator('#projectName').inputValue();
          assert(back >= 1 && name === 'cabin', tag + ' Load left ' + back + ' bricks named "' + name + '"');
          lines.push(tag + ' loaded');
        } finally { await context.close(); }
      }
      return lines.join(' | ');
    });

    await check('R21e-phone-orbit', 'phone orbit is gentle and a Recenter button is on screen', async () => {
      const { page, context } = await openPage(browser, true, 'r21e');
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        const problems = [];
        const frame = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const hit = buttons.find((b) => /recenter|frame\s*build|frame-build/i.test((b.textContent || '').replace(/\s+/g, ' ')));
          if (!hit) return null;
          const r = hit.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
          return {
            text: (hit.textContent || '').replace(/\s+/g, ' ').trim(),
            x: r.x, y: r.y, w: r.width, h: r.height,
            onTop: !!(top && (top === hit || hit.contains(top))),
            inTray: !!hit.closest('.tray-scroll, #controls')
          };
        });
        const vp = page.viewportSize();
        if (!frame || frame.w < 8 || frame.h < 8) problems.push('no Recenter button');
        else if (frame.inTray || frame.y < 0 || frame.y + frame.h > vp.height || frame.x < 0 || frame.x + frame.w > vp.width || !frame.onTop) {
          problems.push('Recenter not on the play screen "' + frame.text + '"');
        }
        const spot = await page.evaluate(() => {
          const canvas = document.querySelector('#container canvas');
          const tries = [[220, 200], [200, 260], [180, 320]];
          for (let i = 0; i < tries.length; i++) {
            const el = document.elementFromPoint(tries[i][0], tries[i][1]);
            if (el && el.tagName === 'CANVAS') return tries[i];
          }
          return null;
        });
        assert(spot, 'no empty canvas for the drag');
        const before = await camPose(page);
        const client = await page.context().newCDPSession(page);
        const x0 = spot[0];
        const y0 = spot[1];
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
        for (let s = 1; s <= 4; s++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + 9 * s, y: y0, id: 1 }] });
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        await settlePose(page);
        const angle = viewAngle(before, await camPose(page));
        if (!(angle < 0.18)) problems.push('orbit swing ' + angle.toFixed(3) + ' rad');
        if (!(angle > 0.02)) problems.push('drag did not orbit ' + angle.toFixed(3));
        assert(problems.length === 0, problems.join('; '));
        return 'swing ' + angle.toFixed(3) + ' ' + (frame ? frame.text : '');
      } finally { await context.close(); }
    });

    await check('R21f-drawer-room', 'the phone drawer scrolls smoothly and Hide tools stays put', async () => {
      const { page, context } = await openPage(browser, true, 'r21f');
      try {
        await ready(page);
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        const hideHit = async () => page.evaluate(() => {
          const el = document.getElementById('panelToggle');
          if (!el) return 'missing';
          const r = el.getBoundingClientRect();
          const vpH = window.innerHeight;
          const vpW = window.innerWidth;
          if (r.top < 0 || r.left < 0 || r.bottom > vpH + 1 || r.right > vpW + 1 || r.height < 8) return 'offscreen';
          const pts = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + 8, r.top + r.height / 2],
            [r.right - 8, r.top + r.height / 2]
          ];
          for (let i = 0; i < pts.length; i++) {
            const top = document.elementFromPoint(pts[i][0], pts[i][1]);
            if (!top || (top !== el && !el.contains(top))) return 'covered ' + (top ? (top.id || top.className || top.tagName) : 'none');
          }
          return '';
        });
        const problems = [];
        const atTop = await hideHit();
        if (atTop) problems.push('Hide tools at top ' + atTop);
        const room = await page.locator('.tray-scroll').evaluate((el) => {
          const buttons = el.querySelectorAll('button');
          const last = buttons[buttons.length - 1];
          const scroll = el.getBoundingClientRect();
          const lastRect = last ? last.getBoundingClientRect() : null;
          const lastBottom = lastRect ? (lastRect.bottom - scroll.top) + el.scrollTop : 0;
          return {
            tail: el.scrollHeight - lastBottom,
            ch: el.clientHeight,
            label: last ? (last.id || (last.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 24) : ''
          };
        });
        if (!(room.tail < 80)) problems.push('blank tail ' + Math.round(room.tail) + ' after ' + room.label);
        const tray = await page.locator('.tray-scroll').boundingBox();
        assert(tray && tray.height > 8, 'tray missing');
        await page.mouse.move(tray.x + Math.min(36, tray.width * 0.35), tray.y + Math.min(24, tray.height / 2));
        const before = await page.locator('.tray-scroll').evaluate((el) => ({ top: el.scrollTop, ch: el.clientHeight }));
        await page.mouse.wheel(0, 100);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const after = await page.locator('.tray-scroll').evaluate((el) => el.scrollTop);
        const delta = after - before.top;
        if (delta > before.ch + 1) problems.push('wheel jump ' + Math.round(delta) + ' > ' + before.ch);
        let stuck = 0;
        let prev = after;
        for (let i = 0; i < 40 && stuck < 2; i++) {
          await page.mouse.wheel(0, Math.max(80, before.ch));
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
          const now = await page.locator('.tray-scroll').evaluate((el) => el.scrollTop);
          if (now === prev) stuck += 1;
          else stuck = 0;
          prev = now;
        }
        const reached = await page.locator('.tray-scroll').evaluate((el) => {
          const buttons = el.querySelectorAll('button');
          const last = buttons[buttons.length - 1];
          if (!last) return false;
          const scroll = el.getBoundingClientRect();
          const r = last.getBoundingClientRect();
          const cy = r.top + r.height / 2;
          return cy >= scroll.top && cy <= scroll.bottom;
        });
        if (!reached) problems.push('last tool stays outside the scroll');
        const atEnd = await hideHit();
        if (atEnd) problems.push('Hide tools at end ' + atEnd);
        assert(problems.length === 0, problems.join('; '));
        return 'tail ' + Math.round(room.tail) + ' wheel ' + Math.round(delta) + ' port ' + before.ch;
      } finally { await context.close(); }
    });

    await check('R21g-phone-shade', 'phone default quality shows studs and face shading on a placed brick', async () => {
      const { page, context } = await openPage(browser, true, 'r21g');
      try {
        await ready(page);
        const quality = await page.locator('#qualityBar button.active').innerText().catch(() => '');
        const home = await grabCanvas(page, 'r21-phone-plate.png');
        const field = await plateStudField(page, home);
        await clickStud(page, 0.55, false);
        const shot = await grabCanvas(page, 'r21-phone-brick.png');
        const blob = brickBlob(shot.img, 0);
        assert(blob.n > 8, 'no brick');
        const relief = brickRelief(shot.img, blob);
        const problems = studFieldProblems(field);
        if (!(relief.spread >= 22)) problems.push('flat face spread ' + relief.spread.toFixed(1));
        if (!(relief.studs >= 2)) problems.push('studs ' + relief.studs);
        assert(problems.length === 0, problems.join('; ') + (quality ? ' quality ' + quality.trim() : ''));
        return (quality || 'quality').trim() + ' spread ' + relief.spread.toFixed(1) + ' studs ' + relief.studs;
      } finally { await context.close(); }
    });

    await check('R21h-modal-float', 'Gallery and New cover the float controls, and the trash is fully on screen', async () => {
      const problems = [];
      async function floatsOver(page, modalSel) {
        const sels = ['.gotw-tag', '.brix-more__toggle', '#phoneViewBtn', '#zoomInBtn'];
        const lines = [];
        for (const sel of sels) {
          const over = await (async () => {
            const box = await page.locator(sel).boundingBox().catch(() => null);
            if (!box || box.width < 4 || box.height < 4) return '';
            return topIsModal(page, sel, modalSel);
          })();
          if (over) lines.push(over);
        }
        const stray = await page.evaluate((modal) => {
          const root = document.querySelector(modal);
          const w = window.innerWidth;
          const h = window.innerHeight;
          const pts = [[w - 20, 60], [w - 20, 447], [w - 28, Math.max(80, h - 280)], [24, 120]];
          const bad = [];
          for (let i = 0; i < pts.length; i++) {
            const x = pts[i][0];
            const y = pts[i][1];
            const el = document.elementFromPoint(x, y);
            if (!el) { bad.push(Math.round(x) + ',' + Math.round(y) + ' none'); continue; }
            if (root && (el === root || root.contains(el))) continue;
            bad.push(Math.round(x) + ',' + Math.round(y) + ' ' + (el.id || el.className || el.tagName).toString().slice(0, 40));
          }
          return bad.join(' | ');
        }, modalSel);
        if (stray) lines.push('stray ' + stray);
        return lines;
      }
      for (const phone of [false, true]) {
        const { page, context } = await openPage(browser, phone, 'r21h' + (phone ? 'p' : 'd'));
        const tag = phone ? 'phone' : 'desktop';
        try {
          await ready(page);
          await page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 }).catch(() => {});
          await clickStud(page, 0.55, false);
          if (phone) await ensureDrawer(page);
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, 'cabin', 'click');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction(() => localStorage.getItem('brickProject_cabin'), null, { timeout: 8000 });
          if (phone) await closeDrawer(page);
          await clickSel(page, '#galleryBtn');
          await page.locator('#galleryModal').waitFor({ state: 'visible', timeout: 8000 });
          await page.locator('#galleryGrid .delete').first().waitFor({ state: 'visible', timeout: 8000 });
          const overGallery = await floatsOver(page, '#galleryModal');
          for (const line of overGallery) problems.push(tag + ' gallery ' + line);
          const trash = await page.locator('#galleryGrid .delete').first().boundingBox();
          const vp = page.viewportSize();
          if (!trash || trash.width < 8) problems.push(tag + ' trash missing');
          else if (trash.x < -1 || trash.y < -1 || trash.x + trash.width > vp.width + 1 || trash.y + trash.height > vp.height + 1) {
            problems.push(tag + ' trash clipped');
          } else {
            const corners = await page.locator('#galleryGrid .delete').first().evaluate((el) => {
              const r = el.getBoundingClientRect();
              const pts = [
                [r.left + 2, r.top + 2],
                [r.right - 2, r.top + 2],
                [r.left + 2, r.bottom - 2],
                [r.right - 2, r.bottom - 2]
              ];
              return pts.map(([x, y]) => {
                const top = document.elementFromPoint(x, y);
                return top && (top === el || el.contains(top));
              });
            });
            if (corners.some((ok) => !ok)) problems.push(tag + ' trash corner covered');
          }
          const bars = await page.locator('.gallery-content').evaluate((el) => ({
            sw: el.scrollWidth,
            cw: el.clientWidth,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth
          }));
          if (bars.sw > bars.cw + 1) problems.push(tag + ' gallery scrollbar ' + bars.sw + '>' + bars.cw);
          if (bars.page > 1) problems.push(tag + ' page scrollbar ' + bars.page);
          await page.keyboard.press('Escape');
          if (phone) await ensureDrawer(page);
          await clickSel(page, '#newProjectBtn');
          await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
          const title = await page.locator('#loadConfirm h2').innerText();
          if (!/new project/i.test(title)) problems.push(tag + ' new title "' + title + '"');
          const overNew = await floatsOver(page, '#loadConfirm');
          for (const line of overNew) problems.push(tag + ' new ' + line);
          const beside = await page.evaluate(() => {
            const btn = document.getElementById('loadConfirmOk');
            const root = document.getElementById('loadConfirm');
            if (!btn || !root) return 'missing';
            const r = btn.getBoundingClientRect();
            const pts = [[r.right - 2, r.top + r.height / 2], [Math.min(window.innerWidth - 2, r.right + 6), r.top + r.height / 2]];
            const bad = [];
            for (let i = 0; i < pts.length; i++) {
              const el = document.elementFromPoint(pts[i][0], pts[i][1]);
              if (el && (el === btn || btn.contains(el) || root.contains(el))) continue;
              bad.push((el && (el.id || el.className || el.tagName) || 'none').toString().slice(0, 40));
            }
            return bad.join(' ');
          });
          if (beside) problems.push(tag + ' new button ' + beside);
        } finally { await context.close(); }
      }
      assert(problems.length === 0, problems.join('; '));
      return 'modals cover the floats and the trash fits';
    });

    await check('R21i-view-badge', 'the phone View stats panel does not cover the week badge', async () => {
      const { page, context } = await openPage(browser, true, 'r21i');
      try {
        await ready(page);
        await page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 });
        await clickSel(page, '#phoneViewBtn');
        const open = await page.evaluate(() => document.body.classList.contains('phone-view-open'));
        assert(open, 'View did not open');
        const badge = await page.locator('.gotw-tag').boundingBox();
        assert(badge && badge.width > 8, 'week badge missing');
        const problems = [];
        for (const sel of ['#stats', '#fps', '#qualityBar']) {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          if (!box || box.width < 4 || box.height < 4) {
            problems.push(sel + ' hidden');
            continue;
          }
          if (overlaps(box, badge)) problems.push(sel + ' overlaps the badge');
        }
        assert(problems.length === 0, problems.join('; '));
        return 'view clear of the badge';
      } finally { await context.close(); }
    });

    await check('R21j-esc-delete', 'Escape leaves Delete mode without removing a brick', async () => {
      const lines = [];
      for (const phone of [false, true]) {
        const { page, context } = await openPage(browser, phone, 'r21j' + (phone ? 'p' : 'd'));
        const tag = phone ? 'phone' : 'desktop';
        try {
          await ready(page);
          await clickStud(page, 0.55, false);
          const placed = await brickCount(page);
          assert(placed >= 1, tag + ' place failed');
          await clickSel(page, '#hudDeleteBtn');
          const armed = await brickCount(page);
          const on = await page.evaluate(() => document.body.classList.contains('delete-mode'));
          assert(armed === placed, tag + ' arm deleted');
          assert(on, tag + ' Delete did not arm');
          await page.keyboard.press('Escape');
          const still = await page.evaluate(() => document.body.classList.contains('delete-mode'));
          const banner = await page.locator('#deleteModeBanner').evaluate((el) => el.classList.contains('visible')).catch(() => false);
          const kept = await brickCount(page);
          assert(!still && !banner, tag + ' Escape left delete ' + (still ? 'on' : 'off') + (banner ? ' banner' : ''));
          assert(kept === placed, tag + ' Escape changed the count to ' + kept);
          lines.push(tag + ' esc');
        } finally { await context.close(); }
      }
      return lines.join(' | ');
    });

    await check('R21g-plate-stripes', 'the default desktop camera has no far-plate stripes, or the far studs resolve', async () => {
      const { page, context } = await openPage(browser, false, 'r21gs');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'r21g-plate.png');
        const far = farPlate(shot.img);
        assert(far.samples > 30, 'far plate not in frame, samples ' + far.samples);
        const resolved = far.farStuds >= 3;
        const smooth = far.stripes < 3;
        assert(resolved || smooth, 'far stripes ' + far.stripes + ' studs ' + far.farStuds);
        return 'stripes ' + far.stripes + ' studs ' + far.farStuds;
      } finally { await context.close(); }
    });

    await check('R21g-mirror-plate', 'a mirrored brick and its ghost stay on the plate, and the axis crosses the plate center', async () => {
      const { page, context } = await openPage(browser, false, 'r21gm');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        const stud = await locateStud(page, 0.55);
        await page.mouse.move(stud.x, stud.y);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const hover = await page.evaluate(() => {
          const THREE = window.THREE;
          const plate = window.baseplateRef;
          if (!THREE || !plate || !window.scene) return null;
          const box = new THREE.Box3().setFromObject(plate);
          const ghosts = [];
          const lines = [];
          window.scene.traverse((obj) => {
            const data = obj.userData && obj.userData.ghostData;
            if (data && obj.position) ghosts.push({ x: obj.position.x, z: obj.position.z });
            if (!obj.isLine || !obj.geometry || !obj.geometry.attributes || !obj.geometry.attributes.position) return;
            const color = obj.material && obj.material.color;
            if (!color || color.r < 0.7 || color.b < 0.7 || color.g > 0.3) return;
            const pos = obj.geometry.attributes.position;
            lines.push({ x0: pos.getX(0), z0: pos.getZ(0), x1: pos.getX(1), z1: pos.getZ(1) });
          });
          return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, ghosts, lines };
        });
        assert(hover, 'plate missing');
        const inside = (x, z) => x >= hover.minX - 0.4 && x <= hover.maxX + 0.4 && z >= hover.minZ - 0.4 && z <= hover.maxZ + 0.4;
        const problems = [];
        if (!hover.ghosts.length) problems.push('no mirror ghost');
        else if (!hover.ghosts.every((g) => inside(g.x, g.z))) problems.push('ghost off plate ' + hover.ghosts.map((g) => g.x.toFixed(1) + ',' + g.z.toFixed(1)).join(' '));
        const upright = hover.lines.find((line) => Math.abs(line.x0 - line.x1) < 1);
        const midX = (hover.minX + hover.maxX) / 2;
        if (!upright) problems.push('no left-right axis');
        else if (Math.abs(upright.x0 - midX) > 4) problems.push('axis x ' + upright.x0.toFixed(1) + ' center ' + midX.toFixed(1));
        await clickAt(page, stud.x, stud.y);
        assert(await waitGrown(page, 0, 2500), 'mirror place failed');
        const placed = await page.evaluate(() => {
          const THREE = window.THREE;
          const plate = window.baseplateRef;
          const box = new THREE.Box3().setFromObject(plate);
          return {
            n: window.bricks.length,
            bricks: window.bricks.map((b) => ({ x: b.position.x, z: b.position.z })),
            minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z
          };
        });
        if (placed.n < 2) problems.push('count ' + placed.n);
        const on = (x, z) => x >= placed.minX - 0.4 && x <= placed.maxX + 0.4 && z >= placed.minZ - 0.4 && z <= placed.maxZ + 0.4;
        const off = placed.bricks.filter((b) => !on(b.x, b.z));
        if (off.length) problems.push('twin off plate ' + off.map((b) => b.x.toFixed(1) + ',' + b.z.toFixed(1)).join(' '));
        assert(problems.length === 0, problems.join('; '));
        return 'on plate ' + placed.n;
      } finally { await context.close(); }
    });

    await check('R21g-type-before-focus', 'Mad typed as the name UI opens stays in the field and does not toggle Mirror', async () => {
      const problems = [];
      async function typed(page, label) {
        await page.keyboard.type('Mad', { delay: 0 });
        const state = await hotState(page);
        if (state.value.indexOf('Mad') < 0) problems.push(label + ' value "' + state.value + '"');
        if (state.mirror) problems.push(label + ' mirror');
      }
      {
        const { page, context } = await openPage(browser, false, 'r21gt');
        try {
          await ready(page);
          await typed(page, 'open');
          await page.mouse.click(760, 70);
          const field = await page.locator('#projectName').boundingBox();
          assert(field && field.width > 4, 'name field missing');
          const x = field.x + field.width / 2;
          const y = field.y + field.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down({ clickCount: 3 });
          await page.keyboard.type('Mad', { delay: 0 });
          await page.mouse.up({ clickCount: 3 });
          const state = await hotState(page);
          if (state.value.indexOf('Mad') < 0) problems.push('triple value "' + state.value + '"');
          if (state.mirror) problems.push('triple mirror');
        } finally { await context.close(); }
      }
      {
        const { page, context } = await openPage(browser, true, 'r21gtp');
        try {
          await ready(page);
          await ensureDrawer(page);
          await typed(page, 'drawer');
        } finally { await context.close(); }
      }
      assert(problems.length === 0, problems.join('; '));
      return 'Mad stayed put';
    });

    await check('R21g-wide-thumb', 'a spread-out mirrored build frames every brick in the thumbnail', async () => {
      const { page, context } = await openPage(browser, false, 'r21gw');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await clickStud(page, 0.38, false);
        await clickStud(page, 0.68, false);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => {
          const pop = document.getElementById('mirrorPopup');
          return !pop || !pop.classList.contains('visible');
        }, null, { timeout: 2000 }).catch(() => {});
        await scrollUntil(page, page.locator('#projectName'));
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'spread', 'click');
        await scrollUntil(page, page.locator('#saveProjectBtn'));
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_spread'), null, { timeout: 8000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
        const buf = await page.locator('#galleryGrid img').first().screenshot();
        writeFileSync(join(shots, 'r21g-wide-thumb.png'), buf);
        const thumb = decodePng(buf);
        const sides = redSides(thumb);
        const shortSide = Math.min(thumb.width, thumb.height);
        assert(sides.length >= 1, 'no brick in the thumb');
        const small = sides.filter((side) => side / shortSide < 0.12);
        assert(small.length === 0, 'bricks ' + sides.map((side) => (side / shortSide * 100).toFixed(1) + '%').join(' '));
        return sides.map((side) => (side / shortSide * 100).toFixed(1) + '%').join(' ');
      } finally { await context.close(); }
    });

    await check('R21g-panel-load', 'one click on the panel Load button shows a load confirm or a load toast', async () => {
      const { page, context } = await openPage(browser, false, 'r21gl');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'cabin', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_cabin'), null, { timeout: 8000 });
        await page.waitForFunction(() => {
          const toast = document.getElementById('toast');
          return toast && !toast.classList.contains('show');
        }, null, { timeout: 4000 }).catch(() => {});
        const before = await page.locator('#toast').innerText();
        await clickSel(page, '#loadProjectBtn');
        let saw = '';
        const t0 = Date.now();
        while (Date.now() - t0 < 900) {
          saw = await page.evaluate(() => {
            const confirm = document.getElementById('loadConfirm');
            const body = document.getElementById('loadConfirmBody');
            const open = confirm && (confirm.style.display === 'flex' || confirm.style.display === 'block' || confirm.classList.contains('visible'));
            if (open && body && /load/i.test(body.textContent || '')) return 'confirm ' + body.textContent.replace(/\s+/g, ' ').trim();
            const toast = document.getElementById('toast');
            const text = toast ? (toast.textContent || '') : '';
            if (toast && toast.classList.contains('show') && /load/i.test(text)) return 'toast ' + text.replace(/\s+/g, ' ').trim();
            return '';
          });
          if (saw) break;
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        }
        assert(saw, 'Load click left "' + before.replace(/\s+/g, ' ').trim() + '"');
        return saw;
      } finally { await context.close(); }
    });

    await check('R21g-singular', 'the load confirm for one brick says 1 brick', async () => {
      const { page, context } = await openPage(browser, false, 'r21gq');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'solo', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_solo'), null, { timeout: 8000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid .gallery-item-actions button').first().waitFor({ state: 'visible', timeout: 8000 });
        await clickSel(page, '#galleryGrid .gallery-item-actions button');
        await page.locator('#loadConfirmBody').waitFor({ state: 'visible', timeout: 4000 });
        const text = (await page.locator('#loadConfirmBody').innerText()).replace(/\s+/g, ' ');
        assert(text.indexOf('1 bricks') < 0, 'confirm "' + text + '"');
        assert(/1 brick\b/.test(text), 'confirm "' + text + '"');
        return text;
      } finally { await context.close(); }
    });

    await check('R21g-toast-line', 'a mode toast misses the banner and the top center stays clear', async () => {
      const { page, context } = await openPage(browser, false, 'r21gline');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await page.locator('#moveModeIndicator.visible').waitFor({ state: 'visible', timeout: 4000 });
        const toast = await page.locator('#toast').boundingBox();
        const banner = await page.locator('#moveModeIndicator').boundingBox();
        const problems = [];
        if (!toast || toast.height < 8) problems.push('toast hidden');
        else if (overlaps(toast, banner)) problems.push('toast overlaps the banner');
        const shot = await page.screenshot({ type: 'png' });
        const line = topBlackLine(decodePng(shot));
        if (line) problems.push('black line ' + line + 'px');
        assert(problems.length === 0, problems.join('; '));
        return 'clear';
      } finally { await context.close(); }
    });

    await check('R21g-drawer-visible', 'the phone tools sheet shows Mirror and Move before any scroll', async () => {
      const { page, context } = await openPage(browser, true, 'r21gd');
      try {
        await ready(page);
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        const view = await page.evaluate(() => {
          const scroll = document.querySelector('.tray-scroll');
          const controls = document.getElementById('controls');
          const hide = document.getElementById('panelToggle');
          if (!scroll || !controls) return null;
          const sr = scroll.getBoundingClientRect();
          const cr = controls.getBoundingClientRect();
          const top = Math.max(sr.top, cr.top, 0);
          const bottom = Math.min(sr.bottom, cr.bottom, window.innerHeight);
          const left = Math.max(sr.left, cr.left, 0);
          const right = Math.min(sr.right, cr.right, window.innerWidth);
          const hit = (id) => {
            const el = document.getElementById(id);
            if (!el) return 'missing';
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cy < top || cy > bottom || cx < left || cx > right) return 'outside';
            const node = document.elementFromPoint(cx, cy);
            if (!node || (node !== el && !el.contains(node))) return 'covered';
            return '';
          };
          const hr = hide ? hide.getBoundingClientRect() : null;
          let hideHit = 'missing';
          if (hr && hr.height > 8) {
            const node = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
            hideHit = node && (node === hide || hide.contains(node)) ? '' : 'covered';
          }
          return {
            h: bottom - top,
            scrollTop: scroll.scrollTop,
            max: scroll.scrollHeight - scroll.clientHeight,
            mirror: hit('mirrorBtn'),
            move: hit('moveBtn'),
            hide: hideHit
          };
        });
        assert(view, 'tray missing');
        const problems = [];
        if (!(view.h >= 200)) problems.push('visible ' + Math.round(view.h) + 'px');
        if (view.mirror) problems.push('mirror ' + view.mirror);
        if (view.move) problems.push('move ' + view.move);
        if (view.hide) problems.push('hide tools ' + view.hide);
        const tray = await page.locator('.tray-scroll').boundingBox();
        const client = await page.context().newCDPSession(page);
        const x = Math.round(tray.x + 28);
        const y0 = Math.round(tray.y + Math.min(36, tray.height / 2));
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
        for (let s = 1; s <= 6; s++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - 50 * s, id: 1 }] });
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        const scrolled = await page.locator('.tray-scroll').evaluate((el) => ({
          top: el.scrollTop,
          max: el.scrollHeight - el.clientHeight
        }));
        if (scrolled.top > scrolled.max + 1) problems.push('scroll ' + Math.round(scrolled.top) + ' past ' + Math.round(scrolled.max));
        assert(problems.length === 0, problems.join('; '));
        return 'visible ' + Math.round(view.h) + 'px';
      } finally { await context.close(); }
    });

    await check('R21g-badge-overlap', 'the week badge and the quality row miss Mirror, Move, and Delete', async () => {
      const { page, context } = await openPage(browser, true, 'r21gb');
      try {
        await ready(page);
        await page.waitForFunction(() => document.querySelector('.gotw-tag'), null, { timeout: 8000 });
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await page.locator('#mirrorPopup.visible').waitFor({ state: 'visible', timeout: 4000 });
        const problems = [];
        const clash = async (sel, label) => {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          if (!box || box.width < 4 || box.height < 4) return;
          const badge = await page.locator('.gotw-tag').boundingBox();
          const quality = await page.locator('#qualityBar').boundingBox();
          if (badge && overlaps(badge, box)) problems.push('badge overlaps ' + label);
          if (quality && overlaps(quality, box)) problems.push('quality overlaps ' + label);
        };
        await clash('#mirrorPopup', 'mirror');
        const toast = await page.locator('#toast').boundingBox();
        const header = await page.locator('.mirror-popup-header').boundingBox().catch(() => null);
        if (toast && header && overlaps(toast, header)) problems.push('toast overlaps the mirror header');
        await page.keyboard.press('Escape');
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await page.locator('#moveModeIndicator.visible').waitFor({ state: 'visible', timeout: 4000 });
        const lines = await page.locator('#moveModeLabel').evaluate((el) => {
          const style = getComputedStyle(el);
          const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
          return Math.round(el.getBoundingClientRect().height / Math.max(1, lh));
        });
        if (lines > 2) problems.push('move banner wraps ' + lines + ' lines');
        await clash('#moveModeIndicator', 'move');
        await page.keyboard.press('Escape');
        await clickSel(page, '#hudDeleteBtn');
        await page.locator('#deleteModeBanner.visible').waitFor({ state: 'visible', timeout: 4000 });
        await clash('#deleteModeBanner', 'delete');
        assert(problems.length === 0, problems.join('; '));
        return 'clear';
      } finally { await context.close(); }
    });

    await check('R21g-stud-home', 'phone plate studs match brick studs at the home camera', async () => {
      const { page, context } = await openPage(browser, true, 'r21gu');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const shot = await grabCanvas(page, 'r21g-stud-home.png');
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
        const blob = brickBlob(img, 0);
        assert(blob.n > 40, 'brick too small to measure studs');
        const brickPitch = pitch(Math.floor((blob.minY + blob.maxY) / 2), (r, g) => r > 120 && r > g);
        const plateY = Math.min(img.height - 4, blob.maxY + 12);
        const platePitch = pitch(plateY, (r, g) => g > 70 && g > r);
        const ratio = platePitch / Math.max(1, brickPitch);
        assert(brickPitch > 4 && platePitch > 4, 'pitch brick ' + brickPitch + ' plate ' + platePitch);
        assert(ratio < 1.7 && ratio > 0.6, 'plate/brick stud pitch ' + ratio.toFixed(2));
        return 'ratio ' + ratio.toFixed(2);
      } finally { await context.close(); }
    });

    await check('R21g-stray-tap', 'a 14 px finger move on the far plate does not place, and a still tap does', async () => {
      const { page, context } = await openPage(browser, true, 'r21gy');
      try {
        await ready(page);
        const far = await locateStud(page, 0.78);
        const before = await brickCount(page);
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: far.x, y: far.y, id: 1 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: far.x + 14, y: far.y + 2, id: 1 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        await page.evaluate(() => new Promise((r) => setTimeout(r, 350)));
        assert((await brickCount(page)) === before, 'stray drag placed a brick');
        const near = await locateStud(page, 0.48);
        await page.touchscreen.tap(near.x, near.y);
        assert(await waitGrown(page, before, 2500), 'still tap did not place');
        return 'drag ignored, tap placed';
      } finally { await context.close(); }
    });

    await check('R21g-one-store', 'the gallery and the project list read one saved-build store', async () => {
      const { page, context } = await openPage(browser, true, 'r21go');
      try {
        await ready(page);
        const brick = [{ type: '2x2', color: '#ff2200', rot: 0, grid: { gx: 20, gz: 20, gy: 0, w: 2, d: 2, hp: 3 } }];
        async function namesOf() {
          await clickSel(page, '#galleryBtn');
          await page.locator('#galleryModal').waitFor({ state: 'visible', timeout: 8000 });
          await page.waitForFunction(() => {
            const grid = document.getElementById('galleryGrid');
            return grid && (grid.querySelector('.gallery-item-name') || grid.querySelector('.gallery-empty'));
          }, null, { timeout: 4000 });
          const gallery = await page.locator('#galleryGrid').innerText();
          await page.keyboard.press('Escape');
          await ensureDrawer(page);
          const list = await page.locator('#savedProjectsList').innerText();
          return { gallery: gallery.replace(/\s+/g, ' ').trim(), list: list.replace(/\s+/g, ' ').trim() };
        }
        await page.evaluate((row) => {
          localStorage.clear();
          localStorage.setItem('brickProject_cabin', JSON.stringify({ v: 4, name: 'Cabin', savedAt: new Date().toISOString(), bricks: row }));
        }, brick);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        const fromProject = await namesOf();
        const problems = [];
        if (fromProject.gallery.indexOf('Cabin') < 0 || /no saved builds/i.test(fromProject.gallery)) problems.push('gallery missed Cabin "' + fromProject.gallery.slice(0, 80) + '"');
        if (fromProject.list.indexOf('Cabin') < 0) problems.push('list missed Cabin "' + fromProject.list.slice(0, 80) + '"');
        await page.evaluate((row) => {
          localStorage.clear();
          localStorage.setItem('brickBuilderGallery', JSON.stringify([{
            name: 'Shed', thumbnail: '', brickCount: 1, date: '10/26/2026', data: row
          }]));
        }, brick);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        const fromGallery = await namesOf();
        if (fromGallery.gallery.indexOf('Shed') < 0 || /no saved builds/i.test(fromGallery.gallery)) problems.push('gallery missed Shed "' + fromGallery.gallery.slice(0, 80) + '"');
        if (fromGallery.list.indexOf('Shed') < 0) problems.push('list missed Shed "' + fromGallery.list.slice(0, 80) + '"');
        assert(problems.length === 0, problems.join('; '));
        return 'Cabin and Shed agree';
      } finally { await context.close(); }
    });

    await check('R21g-save-toast', 'Save on the phone shows a toast the player can see', async () => {
      const { page, context } = await openPage(browser, true, 'r21gv');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'phone', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => {
          const toast = document.getElementById('toast');
          return toast && toast.classList.contains('show') && /saved/i.test(toast.textContent || '');
        }, null, { timeout: 4000 });
        const box = await page.locator('#toast').boundingBox();
        assert(box && box.height > 8 && box.y >= -1 && box.y < 844, 'toast box missing');
        const hit = await page.evaluate(() => {
          const toast = document.getElementById('toast');
          const r = toast.getBoundingClientRect();
          const node = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (node && (node === toast || toast.contains(node))) return '';
          return node ? (node.id || node.className || node.tagName).toString().slice(0, 40) : 'none';
        });
        assert(!hit, 'toast covered by ' + hit);
        const text = (await page.locator('#toast').innerText()).replace(/\s+/g, ' ').trim();
        return text;
      } finally { await context.close(); }
    });

    await check('R21g-toast-top', 'a phone toast misses More games and the Games link', async () => {
      const { page, context } = await openPage(browser, true, 'r21gp');
      try {
        await ready(page);
        const recenter = page.locator('button', { hasText: /recenter/i }).first();
        await clickLoc(page, recenter);
        await page.waitForFunction(() => {
          const toast = document.getElementById('toast');
          return toast && toast.classList.contains('show');
        }, null, { timeout: 4000 });
        const toast = await page.locator('#toast').boundingBox();
        assert(toast && toast.height > 8, 'toast hidden');
        const problems = [];
        for (const sel of ['#brixBack', '.brix-more__toggle', '.brix-more']) {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          if (box && overlaps(toast, box)) problems.push('toast overlaps ' + sel);
        }
        assert(problems.length === 0, problems.join('; '));
        return 'clear';
      } finally { await context.close(); }
    });

    await check('R21g-phone-starters', 'the phone tutorial card offers Cottage, Tower, and Buggy', async () => {
      const { page, context } = await openPage(browser, true, 'r21gh');
      try {
        await page.waitForFunction(() => {
          const card = document.getElementById('phoneTutorial');
          return window.brixCanPlace && card && !card.hidden;
        }, null, { timeout: 45000 });
        const text = await page.locator('#phoneTutorial').innerText();
        const problems = [];
        if (!/cottage/i.test(text)) problems.push('no Cottage');
        if (!/tower/i.test(text)) problems.push('no Tower');
        if (!/buggy/i.test(text)) problems.push('no Buggy');
        assert(problems.length === 0, problems.join('; ') + ' card "' + text.replace(/\s+/g, ' ').slice(0, 80) + '"');
        return 'starters on the card';
      } finally { await context.close(); }
    });

    await check('R22-desk-plate', 'the default desktop plate is a stud grid without horizontal stripes, and the 2x2 is readable', async () => {
      const { page, context } = await openPage(browser, false, 'r22plate');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'r22-desk-plate.png');
        const problems = studFieldProblems(await plateStudField(page, shot));
        const span = plateSpan(shot.img);
        const near0 = span.top >= 0 ? Math.floor(span.bot - (span.bot - span.top) * 0.28) : Math.floor(shot.img.height * 0.72);
        const near1 = span.top >= 0 ? Math.floor(span.bot - (span.bot - span.top) * 0.06) : Math.floor(shot.img.height * 0.9);
        let worst = 0;
        const studs = [];
        for (const fx of [0.32, 0.48, 0.56]) {
          const col = columnStripes(shot.img, fx, near0 / shot.img.height, near1 / shot.img.height);
          if (col.peaks > worst) worst = col.peaks;
          const x = Math.floor(shot.img.width * fx);
          const peaks = studPeaksIn(shot.img, near0, near1, x - 80, x + 80);
          studs.push(peaks);
          if (peaks < 2) problems.push('studs x' + fx + ' ' + peaks);
          else if (col.seen > 12 && col.peaks >= 8 && peaks < 3) problems.push('stripes x' + fx + ' ' + col.peaks);
        }
        await clickStud(page, 0.55, false);
        const brickShot = await grabCanvas(page, 'r22-desk-brick.png');
        const blob = brickBlob(brickShot.img, plateInset(page, brickShot));
        const px = blob.n > 8 ? Math.max(blob.w, blob.h) / brickShot.dpr : 0;
        if (!(px >= 18 && px <= 55)) problems.push('2x2 ' + px.toFixed(1) + ' px');
        assert(problems.length === 0, problems.join('; '));
        return 'stripes ' + worst + ' studs ' + studs.join('/') + ' brick ' + px.toFixed(1) + ' px';
      } finally { await context.close(); }
    });

    await check('R22-spread-frame', 'a one-brick thumb and a spread thumb both frame the build in the middle', async () => {
      const { page, context } = await openPage(browser, false, 'r22frame');
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        let field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'solo', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_solo'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        const spots = [[0.62, 0.60], [0.72, 0.64], [0.62, 0.80]];
        for (const pair of spots) {
          const pt = await projectPlateCell(page, pair[0], pair[1]);
          assert(pt, 'right plate cell missing at ' + pair.join(','));
          await placeAt(page, pt.x, pt.y);
        }
        assert(await brickCount(page) >= 3, 'right cluster placed ' + await brickCount(page));
        await scrollUntil(page, page.locator('#projectName'));
        field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'wide', 'click');
        await scrollUntil(page, page.locator('#saveProjectBtn'));
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_wide'), null, { timeout: 8000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid img').nth(1).waitFor({ state: 'visible', timeout: 8000 });
        const problems = [];
        for (const name of ['solo', 'wide']) {
          const card = page.locator('.gallery-item', { hasText: name }).first();
          const buf = await card.locator('img').screenshot();
          writeFileSync(join(shots, 'r22-frame-' + name + '.png'), buf);
          const frame = redFrame(decodePng(buf));
          if (!frame) { problems.push(name + ' has no red brick'); continue; }
          if (Math.abs(frame.cx - 0.5) > 0.12) problems.push(name + ' center ' + frame.cx.toFixed(2));
          if (frame.left < 0.04 || frame.right < 0.04) problems.push(name + ' edge left ' + frame.left.toFixed(2) + ' right ' + frame.right.toFixed(2));
          if (frame.left > 0.34 || frame.right > 0.34) problems.push(name + ' jammed left ' + frame.left.toFixed(2) + ' right ' + frame.right.toFixed(2));
          if (frame.span < 0.28) problems.push(name + ' span ' + frame.span.toFixed(2));
        }
        assert(problems.length === 0, problems.join('; '));
        return 'framed';
      } finally { await context.close(); }
    });

    await check('R22-toast-bar', 'a mode toast does not leave a black bar across the sky', async () => {
      const { page, context } = await openPage(browser, false, 'r22bar');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await page.locator('#toast.show').waitFor({ state: 'visible', timeout: 4000 });
        const buf = await page.screenshot({ type: 'png' });
        writeFileSync(join(shots, 'r22-toast-bar.png'), buf);
        const bar = solidSkyBar(decodePng(buf));
        assert(bar.best < 180, 'black bar ' + bar.best + ' px at y ' + bar.at);
        return 'clear ' + bar.best + 'px';
      } finally { await context.close(); }
    });

    await check('R22-load-select', 'a project row selects and only Load loads it', async () => {
      const { page, context } = await openPage(browser, false, 'r22load');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'cabin', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_cabin'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        await clickSel(page, '#loadProjectBtn');
        await page.locator('.saved-project-name').first().waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '.saved-project-name');
        const row = await page.evaluate(() => {
          const confirm = document.getElementById('loadConfirm');
          const open = !!(confirm && confirm.style.display === 'flex');
          const sel = document.querySelector('.saved-project-item.selected');
          const outline = sel ? parseFloat(getComputedStyle(sel).outlineWidth) || 0 : 0;
          return {
            open,
            selected: document.querySelectorAll('.saved-project-item.selected').length,
            outline,
            n: parseInt(document.getElementById('brickCount').textContent, 10) || 0
          };
        });
        const problems = [];
        if (row.open) problems.push('row click opened Load');
        if (row.n !== 0) problems.push('row click loaded ' + row.n);
        if (row.selected !== 1) problems.push('selected ' + row.selected);
        if (!(row.outline >= 2)) problems.push('selected outline ' + row.outline);
        assert(problems.length === 0, problems.join('; '));
        await clickSel(page, '#loadProjectBtn');
        let back = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 2500) {
          back = await brickCount(page);
          if (back >= 1) break;
        }
        const name = await page.locator('#projectName').inputValue();
        assert(back >= 1 && name === 'cabin', 'Load left ' + back + ' named "' + name + '"');
        return 'selected then loaded';
      } finally { await context.close(); }
    });

    await check('R22-save-name', 'sidebar Save of an unnamed build asks for a name before it writes', async () => {
      const { page, context } = await openPage(browser, false, 'r22name');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await clickSel(page, '#saveProjectBtn');
        await page.waitForTimeout(300);
        const state = await page.evaluate(() => {
          const prompt = document.getElementById('namePrompt');
          const open = !!(prompt && (prompt.style.display === 'flex' || prompt.style.display === 'block'));
          let untitled = false;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || '';
            if (key.indexOf('Untitled') >= 0 || key.indexOf('untitled') >= 0) untitled = true;
          }
          return { open, untitled };
        });
        assert(state.open && !state.untitled, 'prompt ' + state.open + ' untitled ' + state.untitled);
        return 'name dialog';
      } finally { await context.close(); }
    });

    await check('R22-mirror-axis', 'the mirror line stays on the plate and the axis controls are not duplicated', async () => {
      const { page, context } = await openPage(browser, false, 'r22axis');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await page.locator('#mirrorPopup.visible').waitFor({ state: 'visible', timeout: 4000 });
        const view = await page.evaluate(() => {
          const THREE = window.THREE;
          const plate = window.baseplateRef;
          if (!THREE || !plate) return null;
          const box = new THREE.Box3().setFromObject(plate);
          const lines = [];
          window.scene.traverse((obj) => {
            if (!obj.isLine || !obj.geometry || !obj.geometry.attributes || !obj.geometry.attributes.position) return;
            const color = obj.material && obj.material.color;
            if (!color || color.r < 0.7 || color.b < 0.7 || color.g > 0.3) return;
            const pos = obj.geometry.attributes.position;
            lines.push({ x0: pos.getX(0), z0: pos.getZ(0), x1: pos.getX(1), z1: pos.getZ(1) });
          });
          const shown = (id) => {
            const el = document.getElementById(id);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 8 && r.height > 8 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
          };
          return {
            minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z,
            lines,
            popup: shown('mirrorPopup'),
            side: shown('mirrorSettings')
          };
        });
        assert(view, 'plate missing');
        const problems = [];
        const upright = view.lines.find((line) => Math.abs(line.x0 - line.x1) < 1);
        if (!upright) problems.push('no axis');
        else {
          const midX = (view.minX + view.maxX) / 2;
          if (Math.abs(upright.x0 - midX) > 4) problems.push('axis x ' + upright.x0.toFixed(1));
          const inside = (x, z) => x >= view.minX - 0.8 && x <= view.maxX + 0.8 && z >= view.minZ - 0.8 && z <= view.maxZ + 0.8;
          if (!inside(upright.x0, upright.z0) || !inside(upright.x1, upright.z1)) {
            problems.push('axis leaves the plate ' + upright.z0.toFixed(1) + ' to ' + upright.z1.toFixed(1));
          }
        }
        const sets = (view.popup ? 1 : 0) + (view.side ? 1 : 0);
        if (sets !== 1) problems.push('control sets ' + sets);
        assert(problems.length === 0, problems.join('; '));
        return 'one axis on the plate';
      } finally { await context.close(); }
    });

    await check('R22-sidebar-type', 'sidebar tool labels are readable and the stat box sits clear of the icon buttons', async () => {
      const { page, context } = await openPage(browser, false, 'r22type');
      try {
        await ready(page);
        const view = await page.evaluate(() => {
          const label = document.querySelector('#controls .tool-label');
          const stats = document.getElementById('stats').getBoundingClientRect();
          const icons = document.getElementById('quickBar').getBoundingClientRect();
          return {
            font: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
            stats: { x: stats.x, y: stats.y, width: stats.width, height: stats.height },
            icons: { x: icons.x, y: icons.y, width: icons.width, height: icons.height }
          };
        });
        const problems = [];
        if (!(view.font >= 12)) problems.push('label ' + view.font + 'px');
        const gap = gapPx(view.stats, view.icons);
        if (!(gap >= 12)) problems.push('stat gap ' + gap.toFixed(1) + 'px');
        assert(problems.length === 0, problems.join('; '));
        return 'label ' + view.font + 'px gap ' + gap.toFixed(1) + 'px';
      } finally { await context.close(); }
    });

    await check('R22-gallery-pin', 'Save Current Build stays on screen after three saves', async () => {
      const { page, context } = await openPage(browser, false, 'r22pin');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        for (const name of ['one', 'two', 'three']) {
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, name, 'triple');
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction((key) => !!localStorage.getItem(key), 'brickProject_' + name, { timeout: 8000 });
        }
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid .gallery-item').nth(2).waitFor({ state: 'visible', timeout: 8000 });
        const vis = await page.evaluate(() => {
          const btn = document.getElementById('gallerySaveNew');
          const scroller = btn && btn.closest('.gallery-content');
          if (!btn || !scroller) return null;
          const br = btn.getBoundingClientRect();
          const sr = scroller.getBoundingClientRect();
          return {
            top: br.top, bottom: br.bottom, height: br.height,
            stop: sr.top, sbot: sr.bottom, scroll: scroller.scrollTop
          };
        });
        assert(vis && vis.height > 8, 'save button missing');
        assert(vis.scroll < 2 && vis.top >= vis.stop - 1 && vis.bottom <= vis.sbot + 1, 'save button y ' + Math.round(vis.top) + '-' + Math.round(vis.bottom) + ' in ' + Math.round(vis.stop) + '-' + Math.round(vis.sbot) + ' scroll ' + vis.scroll);
        return 'pinned';
      } finally { await context.close(); }
    });

    await check('R22-tutorial-next', 'tutorial Next stays in the same place from page to page', async () => {
      const { page, context } = await openPage(browser, false, 'r22next');
      try {
        await page.waitForFunction(() => {
          const modal = document.getElementById('tutorialModal');
          const loading = document.getElementById('loadingScreen');
          const gone = !loading || loading.classList.contains('hide') || getComputedStyle(loading).visibility === 'hidden' || parseFloat(getComputedStyle(loading).opacity) < 0.05;
          return window.brixCanPlace && gone && modal && modal.classList.contains('visible');
        }, null, { timeout: 45000 });
        const first = await page.locator('#tutorialNext').boundingBox();
        await clickSel(page, '#tutorialNext');
        await page.waitForFunction(() => document.getElementById('tutorialCurrentPage').textContent === '2', null, { timeout: 4000 });
        const second = await page.locator('#tutorialNext').boundingBox();
        const dy = Math.abs((first ? first.y : 0) - (second ? second.y : 0));
        assert(first && second && dy <= 8, 'Next jumped ' + dy.toFixed(1) + ' px');
        return 'shift ' + dy.toFixed(1) + ' px';
      } finally { await context.close(); }
    });

    await check('R22-load-wording', 'gallery load and the project list use the same load sentence', async () => {
      const { page, context } = await openPage(browser, false, 'r22word');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'cabin', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_cabin'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        async function readLoadToast() {
          let text = '';
          const t0 = Date.now();
          while (Date.now() - t0 < 2500) {
            text = await page.evaluate(() => {
              const toast = document.getElementById('toast');
              if (!toast || !toast.classList.contains('show')) return '';
              return (toast.textContent || '').replace(/\s+/g, ' ').trim();
            });
            if (/cabin/i.test(text) && /load/i.test(text)) return text;
          }
          return text;
        }
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid .gallery-item-actions button').first().waitFor({ state: 'visible', timeout: 8000 });
        await clickSel(page, '#galleryGrid .gallery-item-actions button');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        const gallery = await readLoadToast();
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        await clickSel(page, '#loadProjectBtn');
        await page.locator('.saved-project-name').first().waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadProjectBtn');
        const list = await readLoadToast();
        const bone = (s) => s.replace(/cabin/ig, 'NAME').replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, ' ').trim().toLowerCase();
        assert(/cabin/i.test(gallery) && /cabin/i.test(list), 'gallery "' + gallery + '" list "' + list + '"');
        assert(bone(gallery) === bone(list), 'gallery "' + gallery + '" list "' + list + '"');
        return gallery;
      } finally { await context.close(); }
    });

    await check('R22-phone-home', 'the phone home camera looks down enough that studs read above the near edge', async () => {
      const { page, context } = await openPage(browser, true, 'r22home');
      try {
        await ready(page);
        const pose = await camPose(page);
        const pitch = pitchDeg(pose);
        const shot = await grabCanvas(page, 'r22-phone-home.png');
        const span = plateSpan(shot.img);
        const problems = studFieldProblems(await plateStudField(page, shot));
        if (!(pitch >= 22)) problems.push('pitch ' + pitch.toFixed(1) + ' deg');
        if (span.top < 0 || span.bot - span.top < 40) problems.push('plate rows missing');
        else {
          const height = span.bot - span.top;
          const y1 = Math.floor(span.bot - height * 0.15);
          const y0 = Math.floor(span.bot - height * 0.45);
          const peaks = studPeaksIn(shot.img, y0, y1, Math.floor(shot.img.width * 0.2), Math.floor(shot.img.width * 0.8));
          if (peaks < 3) problems.push('mid-plate studs ' + peaks + ' y ' + y0 + '-' + y1);
        }
        assert(problems.length === 0, problems.join('; '));
        return 'pitch ' + pitch.toFixed(1) + ' deg';
      } finally { await context.close(); }
    });

    await check('R22-drawer-camera', 'opening the phone drawer keeps the build in view', async () => {
      const { page, context } = await openPage(browser, true, 'r22tray');
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        const before = await camPose(page);
        const beforeShot = await grabCanvas(page);
        const beforeRed = redBlob(beforeShot.img).n;
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const after = await camPose(page);
        const shift = poseShift(before, after);
        const afterShot = await grabCanvas(page, 'r22-drawer-open.png');
        const afterRed = redBlob(afterShot.img).n;
        const problems = [];
        if (shift > 1.5) problems.push('camera moved ' + shift.toFixed(1));
        if (beforeRed > 20 && afterRed < beforeRed * 0.25) problems.push('brick left the frame ' + beforeRed + ' to ' + afterRed);
        assert(problems.length === 0, problems.join('; '));
        return 'shift ' + shift.toFixed(2);
      } finally { await context.close(); }
    });

    await check('R22-phone-save-hold', 'a phone Save toast names the build and stays readable', async () => {
      const { page, context } = await openPage(browser, true, 'r22save');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'hut', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForTimeout(600);
        const toast = await page.evaluate(() => {
          const el = document.getElementById('toast');
          if (!el || !el.classList.contains('show')) return '';
          return (el.textContent || '').replace(/\s+/g, ' ').trim();
        });
        assert(/hut/i.test(toast) && /saved/i.test(toast), 'toast "' + toast + '"');
        const box = await page.locator('#toast').boundingBox();
        const hit = await page.evaluate(() => {
          const el = document.getElementById('toast');
          const r = el.getBoundingClientRect();
          const node = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return node && (node === el || el.contains(node));
        });
        assert(box && box.height > 8 && hit, 'toast not readable');
        return toast;
      } finally { await context.close(); }
    });

    await check('R22-phone-toast-view', 'a phone Move toast misses View and the quality row, says tap, and is not cut off', async () => {
      const { page, context } = await openPage(browser, true, 'r22toast');
      try {
        await ready(page);
        await ensureDrawer(page);
        await scrollUntil(page, page.locator('#moveBtn'));
        await clickSel(page, '#moveBtn');
        await page.locator('#toast.show').waitFor({ state: 'visible', timeout: 4000 });
        const toast = await page.locator('#toast').boundingBox();
        const problems = [];
        for (const sel of ['#phoneViewBtn', '#qualityBar']) {
          const box = await page.locator(sel).boundingBox().catch(() => null);
          if (box && overlaps(toast, box)) problems.push('toast overlaps ' + sel);
        }
        const text = await page.evaluate(() => {
          const el = document.getElementById('toast');
          return {
            text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
            cut: el.scrollWidth > el.clientWidth + 1
          };
        });
        if (/click/i.test(text.text)) problems.push('says click "' + text.text + '"');
        if (!/tap/i.test(text.text)) problems.push('missing tap "' + text.text + '"');
        if (text.cut) problems.push('truncated "' + text.text + '"');
        assert(problems.length === 0, problems.join('; '));
        return text.text;
      } finally { await context.close(); }
    });

    await check('R22-drawer-type', 'phone tool labels are readable, Mirror and Move are fully on the sheet, and Clear All is not an everyday tool', async () => {
      const { page, context } = await openPage(browser, true, 'r22draw');
      try {
        await ready(page);
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        const view = await page.evaluate(() => {
          const scroll = document.querySelector('.tray-scroll');
          const controls = document.getElementById('controls');
          const hud = document.getElementById('buildHud');
          const sr = scroll.getBoundingClientRect();
          const cr = controls.getBoundingClientRect();
          const hr = hud.getBoundingClientRect();
          const top = Math.max(sr.top, cr.top, 0);
          const bottom = Math.min(sr.bottom, cr.bottom, hr.top, window.innerHeight);
          const measure = (id) => {
            const el = document.getElementById(id);
            const label = el && el.querySelector('.tool-label');
            if (!label) return null;
            const r = label.getBoundingClientRect();
            return {
              font: parseFloat(getComputedStyle(label).fontSize),
              top: r.top,
              bottom: r.bottom,
              height: r.height
            };
          };
          const mirror = document.getElementById('mirrorBtn');
          const clear = document.getElementById('clearBtn');
          return {
            top, bottom,
            mirror: measure('mirrorBtn'),
            move: measure('moveBtn'),
            sameGrid: !!(mirror && clear && mirror.parentElement === clear.parentElement)
          };
        });
        const problems = [];
        for (const name of ['mirror', 'move']) {
          const row = view[name];
          if (!row) { problems.push(name + ' missing'); continue; }
          if (!(row.font >= 12)) problems.push(name + ' ' + row.font + 'px');
          if (row.top < view.top - 1 || row.bottom > view.bottom - 1 || row.height < 8) {
            problems.push(name + ' clipped ' + Math.round(row.top) + '-' + Math.round(row.bottom) + ' sheet ' + Math.round(view.top) + '-' + Math.round(view.bottom));
          }
        }
        if (view.sameGrid) problems.push('Clear All sits with Mirror');
        assert(problems.length === 0, problems.join('; '));
        return 'labels ' + view.mirror.font + 'px';
      } finally { await context.close(); }
    });

    await check('R22-phone-orbit', 'a 45 px phone drag turns the view by less than about 14 degrees', async () => {
      const { page, context } = await openPage(browser, true, 'r22orbit');
      try {
        await ready(page);
        const spot = await page.evaluate(() => {
          const tries = [[220, 200], [200, 260], [180, 320], [160, 180]];
          for (let i = 0; i < tries.length; i++) {
            const el = document.elementFromPoint(tries[i][0], tries[i][1]);
            if (el && el.tagName === 'CANVAS') return tries[i];
          }
          return null;
        });
        assert(spot, 'no empty canvas for the drag');
        const before = await camPose(page);
        const client = await page.context().newCDPSession(page);
        const x0 = spot[0];
        const y0 = spot[1];
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
        for (let s = 1; s <= 5; s++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + 9 * s, y: y0, id: 1 }] });
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        await settlePose(page);
        const angle = viewAngle(before, await camPose(page));
        const problems = [];
        if (!(angle < 0.25)) problems.push('orbit ' + angle.toFixed(3) + ' rad');
        if (!(angle > 0.02)) problems.push('drag did not orbit ' + angle.toFixed(3));
        assert(problems.length === 0, problems.join('; '));
        return 'swing ' + angle.toFixed(3) + ' rad';
      } finally { await context.close(); }
    });

    await check('R22-phone-list', 'the phone project list has room for more than one row', async () => {
      const { page, context } = await openPage(browser, true, 'r22list');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'hut', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_hut'), null, { timeout: 8000 });
        await ensureDrawer(page);
        const box = await page.evaluate(() => {
          const list = document.getElementById('savedProjectsList');
          const row = list && list.querySelector('.saved-project-item');
          if (!list || !row) return null;
          const lr = list.getBoundingClientRect();
          const rr = row.getBoundingClientRect();
          return { listH: lr.height, rowH: rr.height, client: list.clientHeight };
        });
        assert(box, 'project row missing');
        assert(box.client >= box.rowH * 2 + 4, 'list ' + Math.round(box.client) + ' px for a ' + Math.round(box.rowH) + ' px row');
        return 'list ' + Math.round(box.client) + ' px';
      } finally { await context.close(); }
    });

    await check('R22-phone-brick', 'the phone 2x2 at the default zoom is large enough and its top face is lit', async () => {
      const { page, context } = await openPage(browser, true, 'r22brick');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const shot = await grabCanvas(page, 'r22-phone-brick.png');
        const blob = brickBlob(shot.img, plateInset(page, shot));
        assert(blob.n > 8, 'no brick');
        const px = Math.max(blob.w, blob.h) / shot.dpr;
        const face = topFaceRed(shot.img, blob);
        const problems = [];
        if (!(px >= 36 && px <= 45)) problems.push('brick ' + px.toFixed(1) + ' px');
        if (!(face >= 160)) problems.push('top face ' + face.toFixed(0));
        assert(problems.length === 0, problems.join('; '));
        return px.toFixed(1) + ' px face ' + face.toFixed(0);
      } finally { await context.close(); }
    });

    await check('R23-gallery-card', 'clicking a gallery card loads that build', async () => {
      const { page, context } = await openPage(browser, false, 'r23card');
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'card', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_card'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
        await clickSel(page, '#galleryGrid img');
        await page.waitForTimeout(500);
        const open = await page.evaluate(() => {
          const confirm = document.getElementById('loadConfirm');
          return !!(confirm && confirm.style.display === 'flex');
        });
        assert(open, 'card click did not ask to load');
        return 'card asked';
      } finally { await context.close(); }
    });

    await check('R23-phone-card', 'tapping a phone gallery card loads that build', async () => {
      const { page, context } = await openPage(browser, true, 'r23pcard');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'card', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_card'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid img').first().waitFor({ state: 'visible', timeout: 8000 });
        await clickSel(page, '#galleryGrid img');
        await page.waitForTimeout(500);
        const open = await page.evaluate(() => {
          const confirm = document.getElementById('loadConfirm');
          return !!(confirm && confirm.style.display === 'flex');
        });
        assert(open, 'card tap did not ask to load');
        return 'card asked';
      } finally { await context.close(); }
    });

    await check('R23-load-selected', 'Load keeps a selected row and loads that build', async () => {
      const { page, context } = await openPage(browser, false, 'r23load');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'cabin', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_cabin'), null, { timeout: 8000 });
        await clickSel(page, '#newProjectBtn');
        await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmOk');
        await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        await clickSel(page, '.saved-project-name');
        await page.locator('#loadConfirmCancel').waitFor({ state: 'visible', timeout: 4000 });
        await clickSel(page, '#loadConfirmCancel');
        const armed = await page.evaluate(() => document.querySelectorAll('.saved-project-item.selected').length);
        assert(armed === 1, 'row lost its highlight before Load');
        await clickSel(page, '#loadProjectBtn');
        let back = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 2500) {
          back = await brickCount(page);
          if (back >= 1) break;
        }
        const still = await page.evaluate(() => document.querySelectorAll('.saved-project-item.selected').length);
        const problems = [];
        if (back < 1) problems.push('Load left ' + back + ' bricks');
        if (still !== 1) problems.push('highlight ' + still);
        assert(problems.length === 0, problems.join('; '));
        return 'loaded ' + back;
      } finally { await context.close(); }
    });

    await check('R23-save-focus', 'the first Save dialog takes typing without a click in the field', async () => {
      const { page, context } = await openPage(browser, false, 'r23focus');
      try {
        await ready(page);
        await clickStud(page, 0.55, false);
        await clickSel(page, '#saveProjectBtn');
        await page.locator('#namePromptInput').waitFor({ state: 'visible', timeout: 4000 });
        await page.keyboard.type('Hut', { delay: 20 });
        const value = await page.locator('#namePromptInput').inputValue();
        assert(value === 'Hut', 'field "' + value + '"');
        return 'focused';
      } finally { await context.close(); }
    });

    await check('R23-toast-bar', 'a Mirror toast does not paint a black bar on the sky', async () => {
      const { page, context } = await openPage(browser, false, 'r23bar');
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await page.locator('#toast.show').waitFor({ state: 'visible', timeout: 4000 });
        const buf = await page.screenshot({ type: 'png' });
        writeFileSync(join(shots, 'r23-toast-bar.png'), buf);
        const bar = solidSkyBar(decodePng(buf));
        assert(bar.best < 80, 'black bar ' + bar.best + ' px at y ' + bar.at);
        return 'clear ' + bar.best + 'px';
      } finally { await context.close(); }
    });

    await check('R23-desk-bands', 'a wide desktop plate has no full-width stripes and the 2x2 is readable', async () => {
      const { page, context } = await openPage(browser, false, 'r23band', { width: 1920, height: 1000 });
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'r23-desk-bands.png');
        const bands = wholePlateBands(shot.img);
        const field = await plateStudField(page, shot);
        const peaks = bands.peaks;
        await clickStud(page, 0.55, false);
        const brickShot = await grabCanvas(page, 'r23-desk-brick.png');
        const blob = brickBlob(brickShot.img, plateInset(page, brickShot));
        const px = blob.n > 8 ? Math.max(blob.w, blob.h) / brickShot.dpr : 0;
        const problems = studFieldProblems(field);
        if (peaks >= 4) problems.push('stripes ' + peaks);
        if (!(px >= 36 && px <= 55)) problems.push('2x2 ' + px.toFixed(1) + ' px');
        assert(problems.length === 0, problems.join('; '));
        return 'stripes ' + peaks + ' brick ' + px.toFixed(1) + ' px';
      } finally { await context.close(); }
    });

    await check('R23-mirror-edge', 'a brick at the right edge of the plate mirrors onto the plate', async () => {
      const { page, context } = await openPage(browser, false, 'r23mir', { width: 1440, height: 900 });
      try {
        await ready(page);
        await openSection(page, /^Tools$/);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await page.locator('#mirrorPopup.visible').waitFor({ state: 'visible', timeout: 4000 });
        const spot = await page.evaluate(() => {
          const THREE = window.THREE;
          const plate = window.baseplateRef;
          const cam = window.camera;
          if (!THREE || !plate || !cam) return null;
          const box = new THREE.Box3().setFromObject(plate);
          const p = new THREE.Vector3(box.max.x - 2.4, box.max.y + 0.05, (box.min.z + box.max.z) * 0.5);
          const q = p.clone().project(cam);
          return {
            x: (q.x * 0.5 + 0.5) * window.innerWidth,
            y: (-q.y * 0.5 + 0.5) * window.innerHeight,
            shown: (document.getElementById('mirrorOffsetValue') || {}).textContent || ''
          };
        });
        assert(spot && spot.x > 0 && spot.y > 0, 'edge stud missing');
        await page.mouse.move(spot.x, spot.y);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await clickAt(page, spot.x, spot.y);
        assert(await waitGrown(page, 0, 2500), 'edge place failed');
        const placed = await page.evaluate(() => {
          const THREE = window.THREE;
          const plate = window.baseplateRef;
          const box = new THREE.Box3().setFromObject(plate);
          const inset = 1.6;
          return {
            n: window.bricks.length,
            off: window.bricks.filter((b) => b.position.x < box.min.x + inset || b.position.x > box.max.x - inset || b.position.z < box.min.z + inset || b.position.z > box.max.z - inset)
              .map((b) => b.position.x.toFixed(1) + ',' + b.position.z.toFixed(1)),
            center: ((document.getElementById('mirrorOffsetValue') || {}).textContent || '').trim()
          };
        });
        const problems = [];
        if (placed.n < 2) problems.push('count ' + placed.n);
        if (placed.off.length) problems.push('off plate ' + placed.off.join(' ') + ' label ' + placed.center);
        assert(problems.length === 0, problems.join('; '));
        return 'on plate ' + placed.n;
      } finally { await context.close(); }
    });

    await check('R23-thumb-fit', 'one brick, a tower, and a spread share one fixed frame', async () => {
      const { page, context } = await openPage(browser, false, 'r23thumb');
      try {
        await ready(page);
        async function saveNamed(name) {
          await scrollUntil(page, page.locator('#projectName'));
          const field = await page.locator('#projectName').boundingBox();
          await typeInto(page, field, name, 'click');
          await scrollUntil(page, page.locator('#saveProjectBtn'));
          await clickSel(page, '#saveProjectBtn');
          await page.waitForFunction((n) => localStorage.getItem('brickProject_' + n), name, { timeout: 8000 });
          await clickSel(page, '#newProjectBtn');
          await page.locator('#loadConfirmOk').waitFor({ state: 'visible', timeout: 4000 });
          await clickSel(page, '#loadConfirmOk');
          await page.waitForFunction(() => (parseInt(document.getElementById('brickCount').textContent, 10) || 0) === 0, null, { timeout: 4000 });
        }
        await clickStud(page, 0.55, false);
        await saveNamed('one');
        await clickStud(page, 0.55, false);
        await clickStud(page, 0.55, true);
        await clickStud(page, 0.55, true);
        await clickStud(page, 0.55, true);
        await saveNamed('tower');
        for (const fx of [0.42, 0.50, 0.62, 0.70]) await clickStud(page, fx, false);
        await saveNamed('spread');
        await clickSel(page, '#galleryBtn');
        await page.locator('#galleryGrid img').nth(2).waitFor({ state: 'visible', timeout: 8000 });
        const problems = [];
        const extents = [];
        for (const name of ['one', 'tower', 'spread']) {
          const card = page.locator('.gallery-item', { hasText: name }).first();
          const buf = await card.locator('img').screenshot();
          writeFileSync(join(shots, 'r23-thumb-' + name + '.png'), buf);
          const stats = thumbStats(decodePng(buf));
          extents.push(stats.extent);
          if (stats.extent < 0.42 || stats.extent > 0.72) problems.push(name + ' fill ' + (stats.extent * 100).toFixed(0) + '%');
          if (stats.margin < 0.03) problems.push(name + ' margin ' + stats.margin.toFixed(3));
        }
        const gap = Math.max.apply(null, extents) - Math.min.apply(null, extents);
        if (gap > 0.18) problems.push('fill gap ' + (gap * 100).toFixed(0));
        assert(problems.length === 0, problems.join('; '));
        return extents.map((n) => (n * 100).toFixed(0)).join('/');
      } finally { await context.close(); }
    });

    await check('R23-sidebar-read', 'project rows and Move sit where a player can read them', async () => {
      const { page, context } = await openPage(browser, false, 'r23side');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'row', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.locator('.saved-project-date').first().waitFor({ state: 'visible', timeout: 8000 });
        await openSection(page, /^Tools$/);
        const view = await page.evaluate(() => {
          const date = document.querySelector('.saved-project-date');
          const move = document.getElementById('moveBtn');
          const title = document.querySelector('.section-title');
          const mr = move.getBoundingClientRect();
          return {
            date: date ? parseFloat(getComputedStyle(date).fontSize) : 0,
            title: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
            moveY: mr.top,
            moveH: mr.height,
            vh: window.innerHeight
          };
        });
        const problems = [];
        if (!(view.date >= 12)) problems.push('row ' + view.date + 'px');
        if (!(view.title >= 13)) problems.push('heading ' + view.title + 'px');
        if (!(view.moveY + view.moveH < view.vh - 8)) problems.push('Move at y ' + Math.round(view.moveY));
        assert(problems.length === 0, problems.join('; '));
        return 'row ' + view.date + 'px';
      } finally { await context.close(); }
    });

    await check('R23-finish-width', 'tutorial Finish is as wide as Next', async () => {
      const { page, context } = await openPage(browser, false, 'r23fin');
      try {
        await page.waitForFunction(() => {
          const modal = document.getElementById('tutorialModal');
          const loading = document.getElementById('loadingScreen');
          const gone = !loading || loading.classList.contains('hide') || getComputedStyle(loading).visibility === 'hidden' || parseFloat(getComputedStyle(loading).opacity) < 0.05;
          return window.brixCanPlace && gone && modal && modal.classList.contains('visible');
        }, null, { timeout: 45000 });
        await clickSel(page, '#tutorialNext');
        await page.waitForFunction(() => document.getElementById('tutorialCurrentPage').textContent === '2', null, { timeout: 4000 });
        const next = await page.locator('#tutorialNext').boundingBox();
        await clickSel(page, '#tutorialNext');
        await page.waitForFunction(() => document.getElementById('tutorialCurrentPage').textContent === '3', null, { timeout: 4000 });
        const finish = await page.locator('#tutorialNext').boundingBox();
        const dw = (next ? next.width : 0) - (finish ? finish.width : 0);
        const dx = Math.abs((next ? next.x : 0) - (finish ? finish.x : 0));
        assert(next && finish && dw <= 2 && dx <= 2, 'Finish narrower by ' + dw.toFixed(1) + ' px, left ' + dx.toFixed(1));
        return 'delta ' + dw.toFixed(1) + ' px';
      } finally { await context.close(); }
    });

    await check('R23-phone-delete-tap', 'phone Delete tells the player to tap a brick', async () => {
      const { page, context } = await openPage(browser, true, 'r23del');
      try {
        await ready(page);
        await ensureDrawer(page);
        await scrollUntil(page, page.locator('#deleteBtn'));
        await clickSel(page, '#deleteBtn');
        await page.locator('#toast.show').waitFor({ state: 'visible', timeout: 4000 });
        const text = await page.evaluate(() => (document.getElementById('toast').textContent || '').replace(/\s+/g, ' ').trim());
        assert(/tap/i.test(text), 'toast "' + text + '"');
        return text;
      } finally { await context.close(); }
    });

    await check('R23-phone-hints', 'phone tool labels do not show desktop key hints', async () => {
      const { page, context } = await openPage(browser, true, 'r23hint');
      try {
        await ready(page);
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        const text = await page.locator('#mirrorBtn').innerText();
        assert(!/\([A-Z0-9⇧]/.test(text), 'label "' + text.replace(/\s+/g, ' ') + '"');
        return text.replace(/\s+/g, ' ');
      } finally { await context.close(); }
    });

    await check('R23-phone-toast-fit', 'a phone save toast is fully visible and clear of View', async () => {
      const { page, context } = await openPage(browser, true, 'r23fit');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'PhoneTest', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.locator('#toast.show').waitFor({ state: 'visible', timeout: 4000 });
        const view = await page.evaluate(() => {
          const toast = document.getElementById('toast');
          const btn = document.getElementById('phoneViewBtn');
          const tr = toast.getBoundingClientRect();
          const br = btn.getBoundingClientRect();
          const gap = br.left - tr.right;
          return {
            text: (toast.textContent || '').replace(/\s+/g, ' ').trim(),
            cut: toast.scrollWidth > toast.clientWidth + 1,
            gap
          };
        });
        const problems = [];
        if (view.cut) problems.push('clipped "' + view.text + '"');
        if (!/PhoneTest/.test(view.text) || !/saved/i.test(view.text)) problems.push('text "' + view.text + '"');
        if (!(view.gap >= 12)) problems.push('gap ' + view.gap.toFixed(0) + ' px');
        assert(problems.length === 0, problems.join('; '));
        return 'gap ' + view.gap.toFixed(0);
      } finally { await context.close(); }
    });

    await check('R23-phone-list-near', 'the phone project list sits with Load and its rows are readable', async () => {
      const { page, context } = await openPage(browser, true, 'r23list');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await ensureDrawer(page);
        const field = await page.locator('#projectName').boundingBox();
        await typeInto(page, field, 'hut', 'click');
        await clickSel(page, '#saveProjectBtn');
        await page.waitForFunction(() => localStorage.getItem('brickProject_hut'), null, { timeout: 8000 });
        await ensureDrawer(page);
        const view = await page.evaluate(() => {
          const list = document.getElementById('savedProjectsList');
          const load = document.getElementById('loadProjectBtn');
          const row = list && list.querySelector('.saved-project-date');
          const lr = list.getBoundingClientRect();
          const br = load.getBoundingClientRect();
          return {
            gap: lr.top - br.bottom,
            font: row ? parseFloat(getComputedStyle(row).fontSize) : 0,
            rowH: row ? row.getBoundingClientRect().height : 0
          };
        });
        const problems = [];
        if (!(view.gap >= -8 && view.gap <= 180)) problems.push('list ' + Math.round(view.gap) + ' px below Load');
        if (!(view.font >= 12)) problems.push('row ' + view.font + 'px');
        if (!(view.rowH >= 18)) problems.push('row height ' + view.rowH.toFixed(0));
        assert(problems.length === 0, problems.join('; '));
        return 'gap ' + Math.round(view.gap) + ' font ' + view.font;
      } finally { await context.close(); }
    });

    await check('R23-clear-gap', 'Clear All sits apart from the tools and asks before it deletes', async () => {
      const { page, context } = await openPage(browser, true, 'r23clear');
      try {
        await ready(page);
        await clickStud(page, 0.5, false);
        await clickSel(page, '#panelToggle');
        assert(await drawerOpen(page), 'drawer stayed closed');
        await scrollUntil(page, page.locator('#clearBtn'));
        const gap = await page.evaluate(() => {
          const grid = document.querySelector('.tool-grid:not(#rareToolGrid)');
          const clear = document.getElementById('clearBtn');
          return clear.getBoundingClientRect().top - grid.getBoundingClientRect().bottom;
        });
        const before = await brickCount(page);
        await clickSel(page, '#clearBtn');
        await page.waitForTimeout(400);
        const open = await page.evaluate(() => {
          const confirm = document.getElementById('loadConfirm');
          return !!(confirm && confirm.style.display === 'flex');
        });
        const after = await brickCount(page);
        const problems = [];
        if (!(gap >= 24)) problems.push('gap ' + gap.toFixed(0) + ' px');
        if (!open) problems.push('no confirm');
        if (after !== before) problems.push('cleared before confirm ' + before + ' to ' + after);
        assert(problems.length === 0, problems.join('; '));
        return 'gap ' + gap.toFixed(0);
      } finally { await context.close(); }
    });

    await check('R23-axis-thick', 'the mirror axis is a visible stroke, not a hairline', async () => {
      const { page, context } = await openPage(browser, true, 'r23axis');
      try {
        await ready(page);
        await ensureDrawer(page);
        await scrollUntil(page, page.locator('#mirrorBtn'));
        await clickSel(page, '#mirrorBtn');
        await page.locator('#mirrorPopup.visible').waitFor({ state: 'visible', timeout: 4000 });
        const shot = await grabCanvas(page, 'r23-axis.png');
        const img = shot.img;
        let n = 0;
        let minX = img.width;
        let maxX = 0;
        let minY = img.height;
        let maxY = 0;
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            const r = img.data[i];
            const g = img.data[i + 1];
            const b = img.data[i + 2];
            if (!(r > 160 && b > 140 && r > g + 40 && b > g + 20)) continue;
            n++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        const length = Math.hypot(Math.max(0, maxX - minX), Math.max(0, maxY - minY));
        const thick = length > 8 ? n / length : 0;
        assert(thick >= 6, 'axis ' + thick.toFixed(2) + ' px');
        return 'stroke ' + thick.toFixed(2) + ' px';
      } finally { await context.close(); }
    });

    await check('R23-phone-swing', 'a short phone drag does not hide the build under the side controls', async () => {
      const { page, context } = await openPage(browser, true, 'r23swing');
      try {
        await ready(page);
        await clickStud(page, 0.62, false);
        const beforePose = await camPose(page);
        const before = await grabCanvas(page);
        const blob = brickBlob(before.img, plateInset(page, before));
        assert(blob.n > 8, 'no brick');
        const spot = await page.evaluate(() => {
          const tries = [[120, 220], [100, 280], [140, 180]];
          for (let i = 0; i < tries.length; i++) {
            const el = document.elementFromPoint(tries[i][0], tries[i][1]);
            if (el && el.tagName === 'CANVAS') return tries[i];
          }
          return null;
        });
        assert(spot, 'no empty canvas');
        const client = await page.context().newCDPSession(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: spot[0], y: spot[1], id: 1 }] });
        for (let s = 1; s <= 8; s++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: spot[0] + 10 * s, y: spot[1], id: 1 }] });
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach().catch(() => {});
        await settlePose(page);
        const after = await grabCanvas(page);
        const moved = brickBlob(after.img, plateInset(page, after));
        const recenter = await page.locator('#recenterBtn').boundingBox();
        const problems = [];
        const beforeX = (blob.maxX / before.dpr).toFixed(0);
        const afterX = moved.n > 8 ? (moved.maxX / after.dpr).toFixed(0) : '0';
        const limitX = recenter ? (recenter.x - 8).toFixed(0) : 'none';
        if (!(moved.n > 8)) problems.push('brick left the frame from ' + beforeX);
        else if (recenter && (moved.maxX / after.dpr) > recenter.x - 8) {
          problems.push('brick under side controls from ' + beforeX + ' to ' + afterX + ' limit ' + limitX);
        }
        const angle = viewAngle(beforePose, await camPose(page));
        if (!(angle < 0.18)) problems.push('swing ' + angle.toFixed(3) + ' rad');
        if (!(angle > 0.02)) problems.push('drag did not orbit ' + angle.toFixed(3));
        assert(problems.length === 0, problems.join('; '));
        return 'swing ' + angle.toFixed(3);
      } finally { await context.close(); }
    });

    await check('R23-phone-far', 'phone studs read across the pale middle of the plate', async () => {
      const { page, context } = await openPage(browser, true, 'r23far');
      try {
        await ready(page);
        const shot = await grabCanvas(page, 'r23-phone-far.png');
        const span = plateSpan(shot.img);
        assert(span.top >= 0, 'no plate');
        const height = span.bot - span.top;
        const y0 = Math.floor(span.top + height * 0.18);
        const y1 = Math.floor(span.top + height * 0.42);
        const peaks = studPeaksIn(shot.img, y0, y1, Math.floor(shot.img.width * 0.25), Math.floor(shot.img.width * 0.75));
        const problems = studFieldProblems(await plateStudField(page, shot));
        if (!(peaks >= 3)) problems.push('mid studs ' + peaks + ' y ' + y0 + '-' + y1);
        assert(problems.length === 0, problems.join('; '));
        return 'studs ' + peaks;
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
      // The headed player window covers the debug Chrome, and Lighthouse
      // then reports no first paint. The functional checks are done.
      if (browser.isConnected()) await browser.close();
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
    if (browser.isConnected()) {
      await Promise.race([
        browser.close(),
        new Promise((resolve) => setTimeout(resolve, 4000))
      ]);
    }
    server.closeAllConnections?.();
    server.close();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('SUITE CRASH', err);
  process.exitCode = 1;
});
