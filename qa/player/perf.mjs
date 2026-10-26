// Headed Chrome FPS (median of 3) and Lighthouse x3. Does not close port 9333.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function debuggerUp(port) {
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/version');
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureChrome() {
  if (await debuggerUp(9333)) return { port: 9333, ownedPid: 0 };
  const dir = join(tmpdir(), 'brix-player-chrome');
  mkdirSync(dir, { recursive: true });
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const child = spawn(chrome, [
    '--remote-debugging-port=9334',
    '--user-data-dir=' + dir,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 40; i++) {
    if (await debuggerUp(9334)) return { port: 9334, ownedPid: child.pid || 0 };
    await sleep(250);
  }
  throw new Error('Chrome remote debugging did not open');
}

function allowClicker() {
  const child = spawn('powershell', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', 'C:\\Users\\bryma\\Temp\\click-chrome-allow.ps1'
  ], { stdio: 'ignore' });
  return child;
}

async function openTab(port) {
  const tab = await (await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('cdp websocket failed')));
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  });
  const send = (method, params = {}, timeout = 30000) => new Promise((resolve, reject) => {
    const n = ++id;
    const t = setTimeout(() => reject(new Error('timeout ' + method)), timeout);
    pending.set(n, {
      resolve: (v) => { clearTimeout(t); resolve(v); },
      reject: (e) => { clearTimeout(t); reject(e); }
    });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const ev = async (expression, timeout) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, timeout || 30000);
    if (result.exceptionDetails) {
      const d = result.exceptionDetails;
      throw new Error((d.exception && d.exception.description) || d.text || 'eval');
    }
    return result.result.value;
  };
  return { tab, ws, send, ev };
}

async function closeTab(port, tab) {
  try { await fetch('http://127.0.0.1:' + port + '/json/close/' + tab.id); } catch { /* tab already gone */ }
}

const SAMPLE = (count) => `(() => {
  brixDebug.clear();
  brixDebug.placeGrid(${count}, '2x4');
  return new Promise((resolve) => {
    const t0 = performance.now();
    let frames = 0;
    function tick(now) {
      frames++;
      try { brixDebug.orbitTick(); } catch (e) {}
      if (now - t0 < 2000) requestAnimationFrame(tick);
      else {
        const stats = brixDebug.getStats();
        resolve({
          measuredFps: Math.round(frames * 1000 / (now - t0)),
          hud: document.getElementById('fps') ? document.getElementById('fps').textContent : '',
          bricks: stats.bricks,
          draws: stats.draws
        });
      }
    }
    requestAnimationFrame(tick);
  });
})()`;

async function oneSample(port, base, phone, label) {
  const { tab, ws, send, ev } = await openTab(port);
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    if (phone) {
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
      await send('Emulation.setUserAgentOverride', { userAgent: phoneUA });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    } else {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    }
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.removeItem('brixQuality'); localStorage.setItem('brickBuilderTutorialDismissed','true'); } catch (e) {}`
    });
    await send('Page.navigate', { url: base + '/games/brix3d.html?playerfps=' + label + Date.now() });
    for (let i = 0; i < 90; i++) {
      const ok = await ev('!!(window.brixCanPlace && window.brixDebug && window.brixChromeReady)').catch(() => false);
      if (ok) break;
      await sleep(200);
    }
    await ev(`(() => { const m = document.getElementById('tutorialModal'); if (m) m.classList.remove('visible'); const p = document.getElementById('phoneTutorial'); if (p) p.hidden = true; brixDebug.ensureScenery(); brixDebug.ensureEnv(); return true; })()`);
    for (let i = 0; i < 40; i++) {
      if (await ev('!!window.scenerySettled').catch(() => false)) break;
      await sleep(200);
    }
    await sleep(800);
    const many = await ev(SAMPLE(520), 20000);
    const one = await ev(SAMPLE(1), 20000);
    return { one, many };
  } finally {
    ws.close();
    await closeTab(port, tab);
  }
}

export async function measureFps(base) {
  const clicker = allowClicker();
  try {
    const chrome = await ensureChrome();
    const desk = [];
    const phone = [];
    for (let i = 1; i <= 3; i++) desk.push(await oneSample(chrome.port, base, false, 'd' + i));
    for (let i = 1; i <= 3; i++) phone.push(await oneSample(chrome.port, base, true, 'p' + i));
    const deskFps = desk.map((r) => r.many.measuredFps);
    const phoneFps = phone.map((r) => r.many.measuredFps);
    const phoneOne = phone.map((r) => r.one.measuredFps);
    const dMed = median(deskFps);
    const pMed = median(phoneFps);
    const p1Med = median(phoneOne);
    const detail = 'desktop 520 median ' + dMed + ' [' + deskFps.join(',') + '] phone 520 median ' + pMed + ' [' + phoneFps.join(',') + '] phone 1 median ' + p1Med + ' [' + phoneOne.join(',') + '] port ' + chrome.port;
    return {
      detail,
      ok: dMed >= 90 && pMed >= 165 && p1Med >= 165,
      ownedPid: chrome.ownedPid,
      port: chrome.port,
      desk,
      phone
    };
  } finally {
    try { clicker.kill(); } catch { /* clicker already exited */ }
  }
}

async function blankBrixTabs(port) {
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  for (const t of list) {
    if (!t.webSocketDebuggerUrl || !t.url || t.url.indexOf('brix3d.html') < 0) continue;
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      ws.addEventListener('error', () => { clearTimeout(timer); resolve(); });
    });
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: 'about:blank' } }));
      await sleep(400);
      ws.close();
    }
  }
}

function startLoseHook(port) {
  const file = join(tmpdir(), 'brix-player-lose.mjs');
  writeFileSync(file, `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seen = new Set();
const end = Date.now() + 12 * 60 * 1000;
while (Date.now() < end) {
  let pages = [];
  try { pages = await (await fetch('http://127.0.0.1:${port}/json/list')).json(); } catch { await sleep(300); continue; }
  for (const t of pages) {
    if (!t.webSocketDebuggerUrl || !t.url || t.url.indexOf('brix3d.html') < 0 || seen.has(t.id)) continue;
    seen.add(t.id);
    try {
      const ws = new WebSocket(t.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('ws')), 4000);
        ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      });
      ws.send(JSON.stringify({ id: 2, method: 'Emulation.setFocusEmulationEnabled', params: { enabled: true } }));
      ws.send(JSON.stringify({ id: 3, method: 'Page.bringToFront' }));
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: \`(() => {
        if (window.__brixLoseHook) return 'already';
        window.__brixLoseHook = true;
        const lose = () => document.querySelectorAll('canvas').forEach((c) => {
          try {
            const gl = c.getContext('webgl2') || c.getContext('webgl');
            const ext = gl && gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
          } catch (e) {}
        });
        window.addEventListener('pagehide', lose);
        return 'hooked';
      })()\`, returnByValue: true } }));
      await sleep(200);
      ws.close();
    } catch { /* next page */ }
  }
  await sleep(250);
}
`);
  const child = spawn(process.execPath, [file], { stdio: 'ignore' });
  return child;
}

function raiseChrome(port) {
  const file = join(tmpdir(), 'brix-raise-chrome.ps1');
  writeFileSync(file, `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinF {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
'@
$procs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object { $_.CommandLine -match 'remote-debugging-port=${port}' }
foreach ($c in $procs) {
  $p = Get-Process -Id $c.ProcessId -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne 0) {
    [WinF]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
    [WinF]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [WinF]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    [WinF]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  }
}
`);
  spawnSync('powershell', ['-NoProfile', '-File', file], { stdio: 'ignore' });
}

export async function measureLighthouse(base, port, outDir) {
  mkdirSync(outDir, { recursive: true });
  const clicker = allowClicker();
  const lose = startLoseHook(port);
  const rows = [];
  try {
    for (let i = 1; i <= 3; i++) {
      raiseChrome(port);
      await blankBrixTabs(port);
      await sleep(8000);
      const out = join(outDir, 'lh-' + i + '.json');
      const url = base + '/games/brix3d.html?playerlh=' + i + Date.now();
      const args = [
        '--yes', 'lighthouse', url,
        '--port=' + port,
        '--only-categories=performance',
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        '--throttling-method=simulate',
        '--output=json',
        '--output-path=' + out,
        '--quiet'
      ];
      const r = spawnSync('npx', args, { stdio: 'inherit', shell: true, timeout: 180000 });
      const fs = await import('node:fs');
      if (!fs.existsSync(out)) throw new Error('lighthouse run ' + i + ' status ' + r.status + ' wrote no report');
      const j = JSON.parse(fs.readFileSync(out, 'utf8'));
      if (j.runtimeError) throw new Error('lighthouse run ' + i + ' ' + j.runtimeError.code);
      const a = j.audits;
      const items = (a['long-tasks'] && a['long-tasks'].details && a['long-tasks'].details.items) || [];
      const long = items.filter((it) => it.duration > 50).map((it) => Math.round(it.duration) + '@' + Math.round(it.startTime));
      const tbt = Math.round(a['total-blocking-time'].numericValue);
      rows.push({
        score: j.categories.performance.score,
        tbt,
        lcp: Math.round(a['largest-contentful-paint'].numericValue),
        long
      });
      console.log('LH', i, JSON.stringify(rows[rows.length - 1]));
    }
  } finally {
    try { lose.kill(); } catch { /* already gone */ }
    try { clicker.kill(); } catch { /* already gone */ }
  }
  const bad = rows.filter((row) => row.tbt !== 0 || row.long.length > 0);
  const detail = rows.map((row, n) => 'run' + (n + 1) + ' tbt ' + row.tbt + ' long ' + (row.long.join(',') || 'none') + ' score ' + row.score).join(' | ');
  if (bad.length) throw new Error(detail);
  return detail;
}
