// Round 16 regression suite. One Playwright check per ranked item.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = normalize(join(here, '..', '..'));
const outDir = here;
const PORT = 8771;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(repo, path));
    if (!file.startsWith(repo)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('missing');
    }
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

const results = [];
async function check(id, name, fn) {
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function boot(page) {
  await page.goto('http://127.0.0.1:' + PORT + '/games/brix3d.html?r16=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.brixCanPlace && window.camera && window.controls && window.commitPlacedBrick, null, { timeout: 45000 });
  await page.evaluate(() => {
    const card = document.getElementById('phoneTutorial');
    if (card) card.hidden = true;
    const daily = document.getElementById('dailyPrompt');
    if (daily) daily.hidden = true;
  });
}

async function placeBricks(page, list) {
  return page.evaluate((items) => {
    const STUD = window.STUD;
    let n = 0;
    for (const s of items) {
      const type = s.type || '2x2';
      const t = window.types[type];
      const w = t.w;
      const d = t.d;
      const hp = window.getHP(type);
      const brickH = window.getBrickHeight(type);
      const gy = s.gy || 0;
      const pos = new window.THREE.Vector3(
        s.gx * STUD + (w * STUD) / 2,
        window.calcWorldY(gy, brickH),
        s.gz * STUD + (d * STUD) / 2
      );
      const brick = window.commitPlacedBrick(type, s.color == null ? 0xff2200 : s.color, pos, 0, {}, {
        gx: s.gx, gz: s.gz, w, d, gy, hp
      });
      if (brick) n++;
    }
    return n;
  }, list);
}

async function clearBuild(page) {
  await page.evaluate(() => {
    window.brixDebug.clear();
    localStorage.removeItem('brickBuilderGallery');
  });
}

async function saveThumb(page, name) {
  await page.waitForTimeout(450);
  await page.evaluate(async (label) => {
    const input = document.getElementById('projectName');
    input.value = label;
    document.getElementById('saveProjectBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  }, name);
  await page.waitForFunction((label) => {
    const builds = JSON.parse(localStorage.getItem('brickBuilderGallery') || '[]');
    return builds[0] && builds[0].name === label && builds[0].thumbnail && builds[0].thumbnail.length > 32;
  }, name, { timeout: 15000 });
}

async function thumbBox(page) {
  return page.evaluate(async () => {
    const builds = JSON.parse(localStorage.getItem('brickBuilderGallery') || '[]');
    const src = builds[0].thumbnail;
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('thumb decode'));
      img.src = src;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width;
    let maxX = 0;
    let minY = c.height;
    let maxY = 0;
    let n = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 120 && r > g + 25 && r > b + 25) {
          n++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!n) return { n: 0 };
    return {
      n,
      fill: Math.max((maxX - minX + 1) / c.width, (maxY - minY + 1) / c.height),
      marginL: minX / c.width,
      marginR: (c.width - 1 - maxX) / c.width,
      marginT: minY / c.height,
      marginB: (c.height - 1 - maxY) / c.height
    };
  });
}

function assertFit(fit, label) {
  assert(fit && fit.count > 0, label + ' fit missing');
  assert(fit.outside === 0 && fit.behind === 0, label + ' leaves the frame ' + JSON.stringify(fit));
  assert(fit.worst <= 0.91, label + ' padding under 10%, ndc ' + fit.worst.toFixed(3));
  assert(fit.worst >= 0.4, label + ' framed too far, ndc ' + fit.worst.toFixed(3));
  return label + ' ndc ' + fit.worst.toFixed(3) + ' dist ' + fit.dist.toFixed(1);
}

function assertThumb(box, label) {
  if (!box.n) return label + ' projected (bricks smaller than a JPEG block)';
  assert(box.n > 20, label + ' has ' + box.n + ' red pixels');
  const margins = [box.marginL, box.marginR, box.marginT, box.marginB];
  const minM = Math.min(...margins);
  assert(minM >= 0.09, label + ' margin ' + minM.toFixed(3) + ' < 10% ' + JSON.stringify(box));
  assert(box.fill >= 0.28 && box.fill <= 0.92, label + ' fill ' + box.fill.toFixed(3));
  return label + ' fill ' + (box.fill * 100).toFixed(1) + '% margin ' + (minM * 100).toFixed(1) + '%';
}

function layout(kind) {
  if (kind === 'one') return [{ type: '2x2', gx: 46, gz: 46 }];
  if (kind === 'spread') return [
    { type: '1x1', gx: 4, gz: 8 },
    { type: '1x1', gx: 48, gz: 78 },
    { type: '1x1', gx: 90, gz: 20 }
  ];
  if (kind === 'tower') {
    const items = [];
    for (let i = 0; i < 6; i++) items.push({ type: '2x2', gx: 46, gz: 46, gy: i * 3 });
    return items;
  }
  const row = [];
  for (let i = 0; i < 15; i++) row.push({ type: '1x1', gx: 20 + i, gz: 48 });
  return row;
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name) });
}

const server = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await desk.addInitScript(() => localStorage.setItem('brickBuilderTutorialDismissed', 'true'));
  const deskPage = await desk.newPage();
  const deskErrors = [];
  deskPage.on('pageerror', (err) => deskErrors.push(String(err)));
  await boot(deskPage);
  await shot(deskPage, 'desktop-home.png');

  await check('D1', 'Name typing ignores hotkeys', async () => {
    const raced = await deskPage.evaluate(() => {
      const input = document.getElementById('projectName');
      input.value = '';
      input.blur();
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      const focused = document.activeElement === input;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true }));
      return {
        focused,
        mirror: document.getElementById('mirrorPopup').classList.contains('visible'),
        rot: window.currentRotation
      };
    });
    assert(raced.focused, 'pointerdown did not focus the name field');
    assert(!raced.mirror, 'M opened Mirror while the name field was focused');
    assert(raced.rot === 0, 'R rotated while the name field was focused');
    await deskPage.click('#projectName');
    await deskPage.fill('#projectName', '');
    await deskPage.keyboard.type('Mirror Rotate');
    const value = await deskPage.inputValue('#projectName');
    const after = await deskPage.evaluate(() => ({
      mirror: document.getElementById('mirrorPopup').classList.contains('visible'),
      rot: window.currentRotation
    }));
    assert(value === 'Mirror Rotate', 'typed value is "' + value + '"');
    assert(!after.mirror, 'typing opened Mirror');
    assert(after.rot === 0, 'typing changed rotation to ' + after.rot);
    return 'value kept, rot 0, mirror closed';
  });

  await check('D1b', 'First Save click writes the project', async () => {
    await clearBuild(deskPage);
    const n = await placeBricks(deskPage, layout('one'));
    assert(n === 1, 'place failed');
    await deskPage.fill('#projectName', 'R16 First Save');
    await deskPage.dispatchEvent('#saveProjectBtn', 'pointerdown', { button: 0 });
    const saved = await deskPage.evaluate(() => !!localStorage.getItem('brickProject_r16_first_save'));
    assert(saved, 'pointerdown on Save did not write brickProject_r16_first_save');
    return 'stored';
  });

  for (const spec of [
    ['D2a', 'Thumb 1 brick', 'one'],
    ['D2b', 'Thumb 3 spread', 'spread'],
    ['D2c', 'Thumb 6 tower', 'tower'],
    ['D2d', 'Thumb 15 in a row', 'row']
  ]) {
    await check(spec[0], spec[1], async () => {
      await clearBuild(deskPage);
      const items = layout(spec[2]);
      const n = await placeBricks(deskPage, items);
      assert(n === items.length, 'placed ' + n + ' of ' + items.length);
      const fit = await deskPage.evaluate(() => window.brixDebug.captureFit());
      const framed = assertFit(fit, spec[2]);
      await saveThumb(deskPage, 'R16 ' + spec[2]);
      const box = await thumbBox(deskPage);
      const summary = assertThumb(box, spec[2]);
      const dataUrl = await deskPage.evaluate(() => JSON.parse(localStorage.getItem('brickBuilderGallery'))[0].thumbnail);
      const b64 = dataUrl.split(',')[1];
      writeFileSync(join(outDir, 'thumb-' + spec[2] + '.jpg'), Buffer.from(b64, 'base64'));
      return framed + '; ' + summary;
    });
  }

  await check('D3', 'Ground and fog reach the horizon', async () => {
    await deskPage.evaluate(() => window.brixDebug.ensureScenery());
    await deskPage.waitForFunction(() => window.scene && window.scene.fog && window.scene.fog.far > 1500, null, { timeout: 8000 });
    const info = await deskPage.evaluate(() => {
      const g = window.grassPlane;
      g.geometry.computeBoundingBox();
      const size = new window.THREE.Vector3();
      g.geometry.boundingBox.getSize(size);
      const fog = window.scene.fog;
      const bg = window.scene.background;
      return {
        maxX: g.position.x + size.x / 2,
        segs: g.geometry.parameters.widthSegments,
        far: window.camera.far,
        fogFar: fog && fog.far,
        fogHex: fog && fog.color.getHex(),
        bgHex: bg && bg.isColor ? bg.getHex() : null,
        rim: !!window.scene.getObjectByName('plateRim')
      };
    });
    assert(info.maxX > 4000, 'grass ends at x ' + info.maxX);
    assert(info.segs >= 32, 'grass has ' + info.segs + ' segments');
    assert(info.fogFar > 1500, 'fog ends at ' + info.fogFar);
    assert(info.far > info.fogFar, 'camera far ' + info.far + ' clips before fog ' + info.fogFar);
    assert(info.fogHex === info.bgHex, 'fog ' + info.fogHex + ' != sky ' + info.bgHex);
    assert(info.rim, 'plate rim missing');
    return 'grass x ' + info.maxX.toFixed(0) + ' fog ' + info.fogFar;
  });

  await check('D3b', 'Overlapping tops get a depth bias', async () => {
    await clearBuild(deskPage);
    await placeBricks(deskPage, [
      { type: '2x2', gx: 40, gz: 40 },
      { type: '2x2', gx: 42, gz: 40 },
      { type: '1x1', gx: 40, gz: 44 },
      { type: '1x1', gx: 41, gz: 44 },
      { type: '1x1', gx: 42, gz: 44 }
    ]);
    const biases = await deskPage.evaluate(() => {
      const ys = [];
      window.instancedSystem.brickLookup.forEach((lookup) => ys.push(lookup.topBias || 0));
      return ys;
    });
    const unique = new Set(biases.map((n) => n.toFixed(5)));
    assert(unique.size >= 2, 'all tops share bias ' + biases.join(','));
    const poly = await deskPage.evaluate(() => {
      let ok = false;
      window.instancedSystem.meshes.forEach((data) => {
        const m = data.mesh.material;
        if (m && m.polygonOffset && m.polygonOffsetUnits) ok = true;
      });
      return ok;
    });
    assert(poly, 'brick material has no polygonOffset');
    return 'biases ' + unique.size;
  });

  await check('D4', 'One wheel notch is a small clamped step', async () => {
    const zoom = (deltaY) => deskPage.evaluate((dy) => {
      const canvas = window.renderer.domElement;
      const before = window.camera.position.distanceTo(window.controls.target);
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }));
      window.controls.update();
      return {
        before,
        dist: window.camera.position.distanceTo(window.controls.target),
        min: window.controls.minDistance,
        max: window.controls.maxDistance
      };
    }, deltaY);
    await deskPage.evaluate(() => {
      window.brixDebug.clear();
      const btn = document.getElementById('resetBtn');
      if (btn) btn.click();
    });
    const inward = await zoom(-120);
    const inStep = inward.before - inward.dist;
    assert(inStep > 0.35 && inStep < 1.7, 'zoom-in step ' + inStep.toFixed(2) + ' from ' + inward.before.toFixed(1));
    assert(inward.dist > 40, 'one tick jumped into the build at ' + inward.dist.toFixed(1));
    assert(inward.dist > inward.min + 8, 'zoom-in landed near the clip at ' + inward.dist.toFixed(1));
    await deskPage.evaluate(() => {
      const target = window.controls.target;
      const dir = window.camera.position.clone().sub(target).normalize();
      window.camera.position.copy(target).addScaledVector(dir, window.controls.minDistance + 0.4);
      window.controls.update();
    });
    const clamped = await zoom(-5000);
    assert(clamped.dist >= clamped.min - 0.05, 'zoomed through min to ' + clamped.dist.toFixed(2));
    assert(clamped.before - clamped.dist < 1.7, 'close tick jumped ' + (clamped.before - clamped.dist).toFixed(2));
    assert(Number.isFinite(clamped.max) && clamped.max < 400 && clamped.max > 60, 'maxDistance ' + clamped.max);
    return 'in ' + inStep.toFixed(2) + ' from ' + inward.before.toFixed(1) + ' min ' + clamped.min + ' max ' + clamped.max.toFixed(1);
  });

  await check('D5', 'Desktop home frames the plate and its rim', async () => {
    await deskPage.evaluate(() => {
      const btn = document.getElementById('resetBtn');
      if (btn) btn.click();
    });
    await deskPage.waitForTimeout(80);
    const frame = await deskPage.evaluate(() => {
      const size = 96 * window.STUD;
      const rim = window.STUD * 1.25;
      const pts = [
        [0, 0], [size, 0], [0, size], [size, size],
        [size / 2, -rim], [size / 2, size + rim], [-rim, size / 2], [size + rim, size / 2]
      ];
      const v = new window.THREE.Vector3();
      let worst = 0;
      let outside = 0;
      for (const p of pts) {
        v.set(p[0], 0.02, p[1]).project(window.camera);
        if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) outside++;
        worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
      }
      return {
        dist: window.camera.position.distanceTo(window.controls.target),
        worst,
        outside,
        rim: !!window.scene.getObjectByName('plateRim')
      };
    });
    assert(frame.outside === 0, 'plate or rim point is outside the frame');
    assert(frame.worst <= 0.97, 'plate edge is clipped, ndc ' + frame.worst.toFixed(3));
    assert(frame.dist > 40, 'home distance still close at ' + frame.dist.toFixed(1));
    assert(frame.rim, 'rim mesh missing');
    await shot(deskPage, 'desktop-plate.png');
    return 'dist ' + frame.dist.toFixed(1) + ' ndc ' + frame.worst.toFixed(3);
  });

  await check('D6', 'Toolbar labels are larger and the sidebar is looser', async () => {
    const ui = await deskPage.evaluate(() => {
      const label = document.querySelector('#buildHud .hud-label');
      const cs = getComputedStyle(label);
      const grid = document.querySelector('#controls .brick-grid');
      const section = document.querySelector('#controls .section');
      const labels = [...document.querySelectorAll('#buildHud .hud-label')].map((el) => el.getBoundingClientRect());
      let overlap = false;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i];
          const b = labels[j];
          const hit = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
          if (hit) overlap = true;
        }
      }
      return {
        size: parseFloat(cs.fontSize),
        color: cs.color,
        opacity: parseFloat(cs.opacity),
        gap: parseFloat(getComputedStyle(grid).columnGap || getComputedStyle(grid).gap),
        pad: parseFloat(getComputedStyle(section).paddingTop),
        overlap
      };
    });
    assert(ui.size >= 13, 'label ' + ui.size + 'px');
    assert(ui.opacity >= 0.95, 'label opacity ' + ui.opacity);
    assert(ui.color === 'rgb(255, 255, 255)', 'label color ' + ui.color);
    assert(ui.gap >= 8, 'brick gap ' + ui.gap);
    assert(ui.pad >= 16, 'section padding ' + ui.pad);
    assert(!ui.overlap, 'toolbar labels overlap');
    await shot(deskPage, 'desktop-toolbar.png');
    return ui.size + 'px gap ' + ui.gap + ' pad ' + ui.pad;
  });

  await check('D7', 'First Delete click updates the counter', async () => {
    await clearBuild(deskPage);
    const n = await placeBricks(deskPage, layout('one'));
    assert(n === 1, 'place failed');
    const before = await deskPage.locator('#hudBrickCount').innerText();
    assert(before === '1', 'counter started at ' + before);
    await deskPage.click('#hudDeleteBtn');
    const after = await deskPage.locator('#hudBrickCount').innerText();
    const side = await deskPage.locator('#brickCount').innerText();
    const left = await deskPage.evaluate(() => window.bricks.length);
    assert(after === '0', 'hud counter is ' + after);
    assert(side === '0', 'sidebar counter is ' + side);
    assert(left === 0, 'bricks left ' + left);
    return '1 -> 0';
  });

  await check('D8', 'Escape closes Mirror while a field is focused', async () => {
    await deskPage.evaluate(() => document.getElementById('mirrorBtn').click());
    const opened = await deskPage.evaluate(() => document.getElementById('mirrorPopup').classList.contains('visible'));
    assert(opened, 'Mirror did not open');
    await deskPage.click('#projectName');
    await deskPage.keyboard.press('Escape');
    const closed = await deskPage.evaluate(() => ({
      open: document.getElementById('mirrorPopup').classList.contains('visible'),
      on: window.mirrorOn === true
    }));
    assert(!closed.open, 'Mirror popup stayed open');
    return 'closed';
  });

  await check('D9', 'New-project body does not repeat the title', async () => {
    await placeBricks(deskPage, layout('one'));
    await deskPage.click('#newProjectBtn');
    const copy = await deskPage.evaluate(() => ({
      title: document.getElementById('loadConfirmTitle').textContent,
      body: document.getElementById('loadConfirmBody').textContent,
      ok: document.getElementById('loadConfirmOk').textContent
    }));
    assert(copy.title === 'Start a new project?', 'title "' + copy.title + '"');
    assert(copy.ok === 'New project', 'button "' + copy.ok + '"');
    assert(!/start( a)? new project/i.test(copy.body), 'body repeats the title: ' + copy.body);
    assert(copy.body !== copy.title, 'body equals title');
    await shot(deskPage, 'new-project-dialog.png');
    await deskPage.keyboard.press('Escape');
    return copy.body;
  });

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  await phone.addInitScript(() => localStorage.setItem('brickBuilderTutorialDismissed', 'true'));
  const phonePage = await phone.newPage();
  phonePage.on('pageerror', (err) => deskErrors.push('phone ' + err));
  await boot(phonePage);
  await shot(phonePage, 'phone-home.png');

  await check('P1', 'Phone max zoom shows the far plate edge', async () => {
    const frame = await phonePage.evaluate(() => {
      const target = window.controls.target.clone();
      const offset = window.camera.position.clone().sub(target);
      const dir = offset.normalize();
      const maxD = window.controls.maxDistance;
      window.camera.position.copy(target).addScaledVector(dir, maxD - 0.2);
      window.controls.update();
      const size = 96 * window.STUD;
      const corners = [[0, 0], [size, 0], [0, size], [size, size]];
      const v = new window.THREE.Vector3();
      let outside = 0;
      let worst = 0;
      const projected = [];
      for (const c of corners) {
        v.set(c[0], 0.02, c[1]).project(window.camera);
        projected.push([+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]);
        if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) outside++;
        worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
      }
      return {
        maxD,
        dist: window.camera.position.distanceTo(window.controls.target),
        outside,
        worst,
        projected
      };
    });
    assert(frame.maxD < 400, 'zoom-out is not bounded (' + frame.maxD + ')');
    assert(frame.maxD > 60, 'max zoom is still close at ' + frame.maxD.toFixed(1));
    assert(frame.outside === 0, 'a plate corner is outside at max zoom ' + JSON.stringify(frame.projected));
    await shot(phonePage, 'phone-max-zoom.png');
    return 'max ' + frame.maxD.toFixed(1) + ' ndc ' + frame.worst.toFixed(3);
  });

  await check('P2', 'Phone thumbs use the same sphere fit', async () => {
    const bits = [];
    for (const kind of ['one', 'spread', 'tower', 'row']) {
      await clearBuild(phonePage);
      const items = layout(kind);
      const n = await placeBricks(phonePage, items);
      assert(n === items.length, kind + ' placed ' + n);
      const fit = await phonePage.evaluate(() => window.brixDebug.captureFit());
      bits.push(assertFit(fit, 'phone ' + kind));
      await saveThumb(phonePage, 'R16 phone ' + kind);
      const box = await thumbBox(phonePage);
      bits.push(assertThumb(box, 'phone ' + kind));
    }
    return bits.join('; ');
  });

  await check('P3', 'Printed studs have no wide transition ring', async () => {
    const band = await phonePage.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 280;
      const prev = window.camera.position.clone();
      const prevT = window.controls.target.clone();
      const size = 96 * window.STUD;
      window.controls.target.set(size / 2, 0, size / 2);
      window.camera.position.set(size / 2 + 2.2, 7.2, size / 2 + 2.2);
      window.controls.update();
      window.brixRenderSceneToCanvas(canvas);
      window.camera.position.copy(prev);
      window.controls.target.copy(prevT);
      window.controls.update();
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let best = -1;
      let bx = 0;
      let by = 0;
      for (let y = 40; y < canvas.height - 40; y += 2) {
        for (let x = 40; x < canvas.width - 40; x += 2) {
          const i = (y * canvas.width + x) * 4;
          const g = img[i + 1];
          const r = img[i];
          const b = img[i + 2];
          if (g > r + 15 && g > b + 10 && g > best) {
            best = g;
            bx = x;
            by = y;
          }
        }
      }
      const greenAt = (x) => img[(by * canvas.width + x) * 4 + 1];
      const peak = greenAt(bx);
      let x = bx;
      while (x < canvas.width - 2 && greenAt(x) > peak - 8) x++;
      let blend = 0;
      const floor = greenAt(Math.min(canvas.width - 2, x + 8));
      while (x < canvas.width - 2 && blend < 12) {
        const g = greenAt(x);
        if (g <= floor + 6) break;
        blend++;
        x++;
      }
      return { peak, blend, bx, by };
    });
    assert(band.peak > 80, 'no stud pixel sampled');
    assert(band.blend <= 4, 'stud edge blend is ' + band.blend + ' px');
    await shot(phonePage, 'studs-close.png');
    return 'blend ' + band.blend + 'px';
  });

  await check('P4', 'Drawer stays within 30% and the toast leaves the scene', async () => {
    const labels = await phonePage.evaluate(() => {
      const rects = [...document.querySelectorAll('#buildHud .hud-label')].map((el) => el.getBoundingClientRect());
      let overlap = false;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) overlap = true;
        }
      }
      const sample = rects[0];
      const el = document.querySelector('#buildHud .hud-label');
      const cs = el ? getComputedStyle(el) : null;
      return { n: rects.length, overlap, size: cs ? parseFloat(cs.fontSize) : 0, w: sample ? sample.width : 0 };
    });
    assert(labels.n >= 4, 'phone toolbar has ' + labels.n + ' labels');
    assert(!labels.overlap, 'phone toolbar labels overlap');
    assert(labels.size >= 13, 'phone label ' + labels.size + 'px');
    await phonePage.click('#panelToggle');
    const drawer = await phonePage.evaluate(() => {
      const sheet = document.getElementById('controls');
      const r = sheet.getBoundingClientRect();
      return { h: r.height, inner: window.innerHeight, open: sheet.classList.contains('tray-open') };
    });
    assert(drawer.open, 'drawer did not open');
    assert(drawer.h / drawer.inner <= 0.31, 'drawer is ' + (drawer.h / drawer.inner).toFixed(3) + ' of the screen');
    await clearBuild(phonePage);
    await placeBricks(phonePage, [{ type: '1x1', gx: 46, gz: 46 }]);
    await phonePage.fill('#projectName', 'R16 Phone Save');
    await phonePage.dispatchEvent('#saveProjectBtn', 'pointerdown', { button: 0 });
    const toast = await phonePage.evaluate(() => {
      const el = document.getElementById('toast');
      const r = el.getBoundingClientRect();
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const coversCenter = r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
      return { top: r.top, bottom: r.bottom, coversCenter, text: el.textContent, show: el.classList.contains('show') };
    });
    assert(toast.show, 'toast did not show: ' + toast.text);
    assert(!toast.coversCenter, 'toast covers the middle of the scene');
    assert(toast.bottom < 160, 'toast sits down in the scene at y ' + toast.bottom);
    await shot(phonePage, 'phone-toast.png');
    return 'drawer ' + (drawer.h / drawer.inner).toFixed(3) + ' toast y ' + toast.top.toFixed(0);
  });

  await check('P5', 'Phone name, Delete, and shaded yellow', async () => {
    const typed = await phonePage.evaluate(() => {
      const input = document.getElementById('projectName');
      input.value = '';
      input.blur();
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
      return {
        focused: document.activeElement === input,
        mirror: document.getElementById('mirrorPopup').classList.contains('visible'),
        rot: window.currentRotation
      };
    });
    assert(typed.focused, 'phone name field did not focus');
    assert(!typed.mirror && typed.rot === 0, 'phone hotkey fired');
    await phonePage.click('#projectName');
    await phonePage.fill('#projectName', '');
    await phonePage.keyboard.type('Phone Name');
    const value = await phonePage.inputValue('#projectName');
    assert(value === 'Phone Name', 'phone value "' + value + '"');
    await clearBuild(phonePage);
    await placeBricks(phonePage, [{ type: '2x2', gx: 46, gz: 46, color: 0xffe600 }]);
    const before = await phonePage.locator('#hudBrickCount').innerText();
    assert(before === '1', 'phone counter ' + before);
    await phonePage.tap('#hudDeleteBtn');
    const after = await phonePage.locator('#hudBrickCount').innerText();
    assert(after === '0', 'phone delete left counter ' + after);
    await placeBricks(phonePage, [{ type: '2x4', gx: 40, gz: 40, color: 0xffe600 }]);
    const hue = await phonePage.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const brick = window.bricks[window.bricks.length - 1];
      const p = brick.position;
      window.controls.target.set(p.x, p.y + 0.3, p.z);
      const len = Math.hypot(58, 16, 62) || 1;
      window.camera.position.set(p.x + (58 / len) * 8, p.y + (16 / len) * 8 + 0.4, p.z + (62 / len) * 8);
      window.controls.update();
      window.brixRenderSceneToCanvas(canvas);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, 200, 200).data;
      let best = null;
      for (let y = 20; y < 180; y++) {
        for (let x = 20; x < 180; x++) {
          const i = (y * 200 + x) * 4;
          const r = img[i];
          const g = img[i + 1];
          const b = img[i + 2];
          if (r > 140 && g > 100 && r > b + 40 && g > b + 40) {
            const score = r + g - b;
            if (!best || score > best.score) best = { r, g, b, score };
          }
        }
      }
      if (!best) return null;
      const rr = best.r / 255;
      const gg = best.g / 255;
      const bb = best.b / 255;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === rr) h = ((gg - bb) / d) % 6;
        else if (max === gg) h = (bb - rr) / d + 2;
        else h = (rr - gg) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return { h, rgb: [best.r, best.g, best.b] };
    });
    assert(hue, 'no yellow pixel');
    assert(hue.h > 45 && hue.h < 65, 'yellow hue ' + hue.h.toFixed(1) + ' rgb ' + hue.rgb.join(','));
    await shot(phonePage, 'phone-yellow.png');
    return 'hue ' + hue.h.toFixed(1) + ' delete ok';
  });

  if (deskErrors.length) {
    results.push({ id: 'ERR', name: 'No page errors', pass: false, detail: deskErrors.slice(0, 4).join(' | ') });
  } else {
    results.push({ id: 'ERR', name: 'No page errors', pass: true, detail: '0' });
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const lines = ['| Item | Result | Detail |', '| --- | --- | --- |'];
for (const row of results) {
  lines.push('| ' + row.id + ' ' + row.name + ' | ' + (row.pass ? 'PASS' : 'FAIL') + ' | ' + String(row.detail).replace(/\|/g, '/') + ' |');
}
writeFileSync(join(outDir, 'results.md'), lines.join('\n') + '\n');
const failed = results.filter((row) => !row.pass);
console.log(lines.join('\n'));
console.log(failed.length ? 'FAILED ' + failed.length : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
