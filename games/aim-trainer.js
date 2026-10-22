(function () {
  'use strict';

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function average(values) {
    if (!values.length) return null;
    var sum = 0;
    var i;
    for (i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  function medianOf(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function normalCdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? 1 - p : p;
  }

  // Static aim curve: 250 ms is elite, 400–500 ms is a typical average.
  // This is an estimate, not a live leaderboard.
  function percentileFromMs(ms) {
    var z = (460 - ms) / 105;
    var pct = Math.round(normalCdf(z) * 100);
    return clamp(pct, 1, 99);
  }

  function gradeFromRate(rate, scale) {
    var s = scale || 1;
    if (rate >= 1.35 * s) return 'S';
    if (rate >= 1.02 * s) return 'A';
    if (rate >= 0.72 * s) return 'B';
    if (rate >= 0.46 * s) return 'C';
    if (rate >= 0.26 * s) return 'D';
    return 'F';
  }

  function gradeFromMs(ms) {
    if (ms < 270) return 'S';
    if (ms < 340) return 'A';
    if (ms < 420) return 'B';
    if (ms < 520) return 'C';
    if (ms < 680) return 'D';
    return 'F';
  }

  function gradeFromHits(n) {
    if (n >= 26) return 'S';
    if (n >= 18) return 'A';
    if (n >= 12) return 'B';
    if (n >= 7) return 'C';
    if (n >= 3) return 'D';
    return 'F';
  }

  function gradeFromTrack(ratio) {
    if (ratio >= 0.72) return 'S';
    if (ratio >= 0.58) return 'A';
    if (ratio >= 0.44) return 'B';
    if (ratio >= 0.3) return 'C';
    if (ratio >= 0.16) return 'D';
    return 'F';
  }

  function effectiveRate(hits, misclicks, seconds) {
    var shots = hits + misclicks;
    if (seconds <= 0 || hits <= 0 || shots <= 0) return 0;
    return (hits / seconds) * (hits / shots);
  }

  function pointsForHit(reactionMs, lifeMs, dist, radius, combo) {
    var ref = (lifeMs && isFinite(lifeMs) && lifeMs > 0) ? lifeMs : 900;
    var speed = clamp(1 - reactionMs / ref, 0, 1);
    var bull = dist <= radius * 0.25 ? 40 : 0;
    var mult = 1 + Math.min(Math.max(combo - 1, 0), 8) * 0.05;
    return (100 + speed * 100 + bull) * mult;
  }

  function hashString(text) {
    var h = 2166136261;
    var i;
    for (i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ymd(date) {
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    if (m.length < 2) m = '0' + m;
    if (d.length < 2) d = '0' + d;
    return date.getFullYear() + '-' + m + '-' + d;
  }

  function dailySeedFor(date) {
    return 'd' + ymd(date).replace(/-/g, '');
  }

  function randomSeed() {
    var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    var out = '';
    var i;
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(6);
      window.crypto.getRandomValues(buf);
      for (i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    }
    for (i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  window.AimTrainer = {
    gradeFromRate: gradeFromRate,
    gradeFromMs: gradeFromMs,
    gradeFromHits: gradeFromHits,
    gradeFromTrack: gradeFromTrack,
    percentileFromMs: percentileFromMs,
    effectiveRate: effectiveRate,
    pointsForHit: pointsForHit,
    dailySeedFor: dailySeedFor,
    hashString: hashString
  };

  var MODES = {
    classic: {
      id: 'classic', name: 'Classic',
      blurb: 'Several targets. They shrink and expire faster as the clock runs down.',
      timed: true, durations: [30, 60, 90], dur: 30, sim: 'ramp', start: 1,
      life: [1200, 2400], lifeRamp: 0.5, radius: [22, 42], radiusRamp: 0.4,
      spawn: [300, 800], spawnRamp: 0.5, expire: true, rateScale: 1
    },
    benchmark: {
      id: 'benchmark', name: 'Benchmark',
      blurb: 'Thirty targets, one at a time, no timeout. The score is your average time.',
      timed: false, goal: 30, sim: 1, start: 1, radius: [34, 34], chain: true, kind: 'benchmark'
    },
    flick: {
      id: 'flick', name: 'Flick',
      blurb: 'One target. Hit it before it disappears. Speed is the whole drill.',
      timed: true, durations: [30, 60, 90], dur: 30, sim: 1, start: 1,
      life: [780, 1300], lifeRamp: 0.3, radius: [24, 38], radiusRamp: 0.2,
      chain: true, expire: true, rateScale: 0.9
    },
    gridshot: {
      id: 'gridshot', name: 'Gridshot',
      blurb: 'Three targets stay up until you hit them. Keep the field full.',
      timed: true, durations: [30, 60, 90], dur: 60, sim: 3, start: 3,
      radius: [28, 28], chain: true, expire: false, rateScale: 1.65
    },
    tracking: {
      id: 'tracking', name: 'Tracking',
      blurb: 'Hold on the moving target. Time on target is the score.',
      timed: true, durations: [20, 30, 45], dur: 30, kind: 'track', radius: [28, 28], start: 1
    },
    precision: {
      id: 'precision', name: 'Precision',
      blurb: 'Tiny targets, three lives. A misclick or a timeout costs a life.',
      timed: false, lives: 3, cap: 80, sim: 1, start: 1,
      life: [1300, 2000], radius: [12, 16], chain: true, expire: true,
      expireCostsLife: true, misclickCostsLife: true, kind: 'precision'
    },
    autobalance: {
      id: 'autobalance', name: 'Autobalance',
      blurb: 'How long targets last shifts to keep you near an 85% hit rate.',
      timed: true, durations: [30, 60, 90], dur: 60, sim: 'ramp', start: 1,
      life: [1400, 2200], lifeRamp: 0.15, radius: [24, 40], radiusRamp: 0.25,
      spawn: [340, 720], spawnRamp: 0.3, expire: true, adapt: true, rateScale: 1
    },
    daily: {
      id: 'daily', name: 'Daily',
      blurb: 'A 60-second classic board. Everyone gets the same targets today.',
      timed: true, durations: [60], dur: 60, lockDur: true, sim: 'ramp', start: 1,
      life: [1200, 2400], lifeRamp: 0.5, radius: [22, 42], radiusRamp: 0.4,
      spawn: [300, 800], spawnRamp: 0.5, expire: true, daily: true, rateScale: 1
    }
  };

  var GRADE_COPY = {
    click: {
      S: 'Elite rate. Clean and fast.',
      A: 'Excellent. You are in the top band.',
      B: 'Solid aim. Competitive pace.',
      C: 'Average. Cleaner clicks raise the grade.',
      D: 'Below the pace. Hit more, miss less.',
      F: 'Keep practicing. The grade follows clean hits per second.'
    },
    benchmark: {
      S: 'Elite. Few players hold this average.',
      A: 'Very fast.',
      B: 'Quicker than a typical average.',
      C: 'Around the published average.',
      D: 'Slower than average. Nothing on screen is about to expire.',
      F: 'Click each target as soon as you see it.'
    },
    track: {
      S: 'Locked on. Excellent tracking.',
      A: 'Strong tracking.',
      B: 'You held the target for a solid share of the round.',
      C: 'Average tracking.',
      D: 'The target spent most of the round off your pointer.',
      F: 'Hold down on the target and follow it.'
    },
    precision: {
      S: 'Remarkable precision.',
      A: 'Very clean.',
      B: 'Good control.',
      C: 'A fair run.',
      D: 'The small targets are winning.',
      F: 'Slow down. Each misclick costs a life.'
    }
  };

  var REGION_NAMES = ['Top left', 'Top', 'Top right', 'Left', 'Center', 'Right', 'Bottom left', 'Bottom', 'Bottom right'];

  var canvas = document.getElementById('atCanvas');
  var ctx = canvas.getContext('2d');
  var wrap = document.getElementById('atCanvasWrap');
  var startOverlay = document.getElementById('startOverlay');
  var resultOverlay = document.getElementById('resultOverlay');
  var pauseOverlay = document.getElementById('pauseOverlay');
  var countShield = document.getElementById('countShield');
  var modeList = document.getElementById('modeList');
  var durList = document.getElementById('durList');
  var modeBlurb = document.getElementById('modeBlurb');
  var atBanner = document.getElementById('atBanner');
  var startBest = document.getElementById('startBest');
  var histWrap = document.getElementById('atHistory');
  var spark = document.getElementById('spark');
  var histNote = document.getElementById('histNote');
  var btnPause = document.getElementById('btnPause');
  var btnResume = document.getElementById('btnResume');
  var btnMute = document.getElementById('btnMute');
  var btnMutePause = document.getElementById('btnMutePause');
  var statExp = document.getElementById('statExp');
  var resHeat = document.getElementById('resHeat');
  var atShareLink = document.getElementById('atShareLink');
  var atShareMsg = document.getElementById('atShareMsg');

  var mode = MODES.classic;
  var duration = 30;
  var runSeconds = 30;
  var phase = 'idle';
  var queuedSeed = null;
  var urlMode = '';
  var urlSeed = '';
  var runSeed = '';
  var lastSeed = '';

  var viewW = 0;
  var viewH = 0;
  var gridLayer = null;
  var layoutQueued = false;

  var hits = 0;
  var misclicks = 0;
  var expired = 0;
  var combo = 0;
  var bestCombo = 0;
  var bullseyes = 0;
  var pointSum = 0;
  var reactions = [];
  var clicks = [];
  var targets = [];
  var fx = [];
  var trackMs = 0;
  var lives = 3;
  var adapt = 1;
  var recent = [];
  var specs = [];
  var specIndex = 0;
  var rng = Math.random;
  var nextSpawn = 0;
  var runOrigin = 0;
  var pauseDebt = 0;
  var pauseMark = 0;
  var pausedFrom = '';
  var countLeft = 0;
  var countEndsAt = 0;
  var countShown = '';
  var lastFrame = 0;
  var holding = false;
  var pointerOn = false;
  var pointer = { x: 0, y: 0 };
  var inputLock = 0;
  var resumeGate = 0;
  var ended = false;
  var loopOn = false;
  var raf = 0;
  var shareText = '';
  var shareUrl = '';
  var cardBlob = null;
  var hudCache = {};
  var muted = false;

  var settings = loadSettings();

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) {}
  }

  function loadSettings() {
    var raw = readJSON('at_settings_v1', {});
    return {
      size: raw.size === 'sm' || raw.size === 'lg' ? raw.size : 'md',
      crosshair: raw.crosshair === 'off' || raw.crosshair === 'dot' ? raw.crosshair : 'cross',
      palette: raw.palette === 'safe' ? 'safe' : 'classic',
      motion: raw.motion === 'reduce' || raw.motion === 'full' ? raw.motion : 'auto'
    };
  }

  function loadDaily() {
    var raw = readJSON('at_daily_v1', {});
    return {
      last: typeof raw.last === 'string' ? raw.last : '',
      streak: +raw.streak || 0,
      best: +raw.best || 0
    };
  }

  function motionReduced() {
    if (settings.motion === 'reduce') return true;
    if (settings.motion === 'full') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMuted() {
    if (window.CGSfx) return window.CGSfx.isMuted();
    return muted;
  }

  function sfx(name) {
    if (isMuted()) return;
    if (window.CGSfx) window.CGSfx.play(name);
  }

  function haptic(ms) {
    if (window.CGSfx) window.CGSfx.haptic(ms);
    else {
      try { if (navigator.vibrate) navigator.vibrate(ms); } catch (err) {}
    }
  }

  function toggleMute() {
    var next = !isMuted();
    muted = next;
    if (window.CGSfx) window.CGSfx.setMuted(next);
    renderMute();
  }

  function renderMute() {
    var label = isMuted() ? 'Sound off' : 'Sound on';
    btnMute.textContent = label;
    btnMutePause.textContent = label;
    btnMute.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
    btnMutePause.setAttribute('aria-pressed', isMuted() ? 'true' : 'false');
  }

  function setText(id, text) {
    var value = String(text);
    if (hudCache[id] === value) return;
    hudCache[id] = value;
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function gameNow() {
    var t = performance.now();
    if (phase === 'paused') return pauseMark - pauseDebt;
    return t - pauseDebt;
  }

  function elapsed() {
    if (!runOrigin) return 0;
    return Math.max(0, gameNow() - runOrigin);
  }

  function progress() {
    if (!mode.timed || !runSeconds) return 0;
    return clamp(elapsed() / (runSeconds * 1000), 0, 1);
  }

  function shotAccuracy() {
    var shots = hits + misclicks;
    if (shots <= 0) return null;
    return hits / shots;
  }

  function currentScore() {
    var acc = shotAccuracy();
    if (acc == null) return 0;
    return Math.round(pointSum * acc);
  }

  function trackRatio() {
    if (!runSeconds) return 0;
    return trackMs / (runSeconds * 1000);
  }

  function trackScore() {
    var penalty = misclicks === 0 ? 1 : Math.max(0.4, 1 - misclicks * 0.08);
    return Math.round((trackMs / 10) * penalty);
  }

  function runningAvg() {
    return average(reactions);
  }

  function sizeMul() {
    if (settings.size === 'sm') return 0.82;
    if (settings.size === 'lg') return 1.2;
    return 1;
  }

  function maxLive(p) {
    if (mode.sim === 'ramp') return Math.round(3 + p * 2);
    return mode.sim || 1;
  }

  function liveCount() {
    var n = 0;
    var i;
    for (i = 0; i < targets.length; i++) if (!targets[i].hit) n += 1;
    return n;
  }

  function computeHeight() {
    var rect = wrap.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var top = rect.top + scrollY;
    var available = Math.floor(window.innerHeight - top - 12);
    if (available < 320) return Math.max(180, available);
    return Math.min(640, available);
  }

  function rebuildGrid(dpr) {
    gridLayer = document.createElement('canvas');
    gridLayer.width = Math.max(1, Math.round(viewW * dpr));
    gridLayer.height = Math.max(1, Math.round(viewH * dpr));
    var g = gridLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1;
    var x;
    var y;
    for (x = 0.5; x < viewW; x += 48) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, viewH);
      g.stroke();
    }
    for (y = 0.5; y < viewH; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(viewW, y);
      g.stroke();
    }
  }

  function reflowTargets(prevW, prevH) {
    var sx = prevW ? viewW / prevW : 1;
    var sy = prevH ? viewH / prevH : 1;
    var i;
    for (i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.tracking) {
        t.x = clamp(t.x * sx, t.r + 2, Math.max(t.r + 2, viewW - t.r - 2));
        t.y = clamp(t.y * sy, t.r + 2, Math.max(t.r + 2, viewH - t.r - 2));
      } else {
        var pad = t.r + 8;
        var spanX = Math.max(1, viewW - pad * 2);
        var spanY = Math.max(1, viewH - pad * 2);
        t.x = pad + clamp(t.nx, 0, 1) * spanX;
        t.y = pad + clamp(t.ny, 0, 1) * spanY;
      }
    }
    for (i = 0; i < fx.length; i++) {
      fx[i].x *= sx;
      fx[i].y *= sy;
    }
  }

  function applyLayout() {
    var w = wrap.clientWidth;
    if (w < 2) return;
    var h = computeHeight();
    if (w === viewW && h === viewH && canvas.width > 0) return;
    var prevW = viewW;
    var prevH = viewH;
    viewW = w;
    viewH = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildGrid(dpr);
    if (prevW > 0 && (phase === 'run' || phase === 'paused' || phase === 'countdown')) {
      reflowTargets(prevW, prevH);
    }
    draw();
  }

  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(function () {
      layoutQueued = false;
      applyLayout();
    });
  }

  function rollSpec(next) {
    return { nx: next(), ny: next(), nr: next(), nl: next(), nv: next(), na: next() };
  }

  function takeSpec() {
    if (specIndex >= specs.length) specs.push(rollSpec(rng));
    var spec = specs[specIndex];
    specIndex += 1;
    return spec;
  }

  function overlaps(x, y, r) {
    var i;
    for (i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.hit) continue;
      var dx = t.x - x;
      var dy = t.y - y;
      var min = t.r + r + 10;
      if (dx * dx + dy * dy < min * min) return true;
    }
    return false;
  }

  function place(spec, r) {
    var pad = r + 8;
    var spanX = Math.max(1, viewW - pad * 2);
    var spanY = Math.max(1, viewH - pad * 2);
    var x = pad + spec.nx * spanX;
    var y = pad + spec.ny * spanY;
    var tries = 0;
    while (overlaps(x, y, r) && tries < 8) {
      tries += 1;
      var ang = tries * 2.399963;
      var dist = r * 1.15 * tries;
      x = clamp(pad + spec.nx * spanX + Math.cos(ang) * dist, pad, Math.max(pad, viewW - pad));
      y = clamp(pad + spec.ny * spanY + Math.sin(ang) * dist, pad, Math.max(pad, viewH - pad));
    }
    return {
      x: x,
      y: y,
      nx: spanX ? (x - pad) / spanX : 0.5,
      ny: spanY ? (y - pad) / spanY : 0.5
    };
  }

  function fitRadius(r) {
    var maxR = Math.max(8, Math.min(viewW, viewH) / 2 - 12);
    return clamp(r, 8, maxR);
  }

  function radiusFor(spec, p) {
    var scale = (1 - p * (mode.radiusRamp || 0)) * sizeMul();
    return (mode.radius[0] + spec.nr * (mode.radius[1] - mode.radius[0])) * scale;
  }

  function lifeFor(spec, p) {
    var scale = (1 - p * (mode.lifeRamp || 0)) * (mode.adapt ? adapt : 1);
    return (mode.life[0] + spec.nl * (mode.life[1] - mode.life[0])) * scale;
  }

  function spawnTracking() {
    var spec = takeSpec();
    var r = fitRadius(mode.radius[0] * sizeMul());
    var pos = place(spec, r);
    var ang = spec.na * Math.PI * 2;
    var speed = 78 + spec.nv * 120;
    targets.push({
      x: pos.x, y: pos.y, nx: pos.nx, ny: pos.ny, r: r,
      born: gameNow(), life: null, hit: false, tracking: true,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      turnAt: gameNow(), on: false
    });
  }

  function spawnOne() {
    if (phase !== 'run') return;
    if (mode.kind === 'track') {
      if (liveCount() > 0) return;
      spawnTracking();
      return;
    }
    var p = progress();
    if (liveCount() >= maxLive(p)) return;
    var spec = takeSpec();
    var r = fitRadius(radiusFor(spec, p));
    var pos = place(spec, r);
    var life = mode.expire ? lifeFor(spec, p) : null;
    targets.push({
      x: pos.x, y: pos.y, nx: pos.nx, ny: pos.ny, r: r,
      born: gameNow(), life: life, hit: false, hitAt: 0
    });
  }

  function armSpawn(now) {
    var spec = takeSpec();
    var p = progress();
    var scale = 1 - p * (mode.spawnRamp || 0);
    var delay = (mode.spawn[0] + spec.nr * (mode.spawn[1] - mode.spawn[0])) * scale;
    nextSpawn = now + Math.max(120, delay);
  }

  function spawnOpening() {
    var n = mode.start || 1;
    var i;
    for (i = 0; i < n; i++) spawnOne();
    if (mode.spawn) armSpawn(gameNow());
  }

  function noteOutcome(hit) {
    if (!mode.adapt) return;
    recent.push(hit ? 1 : 0);
    if (recent.length > 8) recent.shift();
    if (recent.length < 6) return;
    var rate = 0;
    var i;
    for (i = 0; i < recent.length; i++) rate += recent[i];
    rate /= recent.length;
    if (rate > 0.9) adapt = Math.max(0.5, adapt * 0.88);
    else if (rate < 0.78) adapt = Math.min(1.55, adapt * 1.12);
  }

  function noteClick(x, y, hit, ms) {
    if (!viewW || !viewH) return;
    clicks.push({
      nx: clamp(x / viewW, 0, 1),
      ny: clamp(y / viewH, 0, 1),
      hit: hit,
      ms: ms
    });
    if (clicks.length > 800) clicks.shift();
  }

  function loseLife() {
    if (!mode.lives) return;
    lives -= 1;
    if (lives <= 0 && phase === 'run') finish();
  }

  function onExpire(t) {
    expired += 1;
    combo = 0;
    fx.push({ type: 'pop', x: t.x, y: t.y, r: t.r, at: gameNow() });
    noteOutcome(false);
    sfx('tick');
    if (mode.expireCostsLife) loseLife();
    if (phase === 'run' && mode.chain) spawnOne();
  }

  function expireDue(now) {
    var i;
    for (i = targets.length - 1; i >= 0; i--) {
      var t = targets[i];
      if (t.hit || t.life == null) continue;
      if (now - t.born <= t.life) continue;
      targets.splice(i, 1);
      onExpire(t);
      if (phase !== 'run') return;
    }
  }

  function dropResolved(now) {
    var life = motionReduced() ? 80 : 280;
    var i;
    for (i = targets.length - 1; i >= 0; i--) {
      if (targets[i].hit && now - targets[i].hitAt > life) targets.splice(i, 1);
    }
  }

  function onHit(t, dist, now) {
    var reaction = Math.max(0, now - t.born);
    t.hit = true;
    t.hitAt = now;
    hits += 1;
    combo += 1;
    if (combo > bestCombo) bestCombo = combo;
    reactions.push(reaction);
    if (dist <= t.r * 0.25) bullseyes += 1;
    pointSum += pointsForHit(reaction, t.life, dist, t.r, combo);
    noteClick(t.x, t.y, true, reaction);
    noteOutcome(true);
    sfx('correct');
    haptic(10);
    if (checkEnd()) return;
    if (mode.chain) spawnOne();
  }

  function onMiss(p) {
    misclicks += 1;
    combo = 0;
    noteClick(p.x, p.y, false, null);
    fx.push({ type: 'x', x: p.x, y: p.y, r: 0, at: gameNow() });
    sfx('miss');
    haptic(12);
    if (mode.misclickCostsLife) loseLife();
  }

  function checkEnd() {
    if (phase !== 'run') return true;
    if (mode.timed && elapsed() >= runSeconds * 1000) {
      finish();
      return true;
    }
    if (mode.goal && hits >= mode.goal) {
      finish();
      return true;
    }
    if (mode.cap && hits >= mode.cap) {
      finish();
      return true;
    }
    if (mode.lives && lives <= 0) {
      finish();
      return true;
    }
    return false;
  }

  function moveTracking(dt, now) {
    var t = targets[0];
    if (!t) return;
    if (now - t.turnAt > 1700) {
      var spec = takeSpec();
      var ang = spec.na * Math.PI * 2;
      var speed = 78 + spec.nv * 120;
      t.vx = Math.cos(ang) * speed;
      t.vy = Math.sin(ang) * speed;
      t.turnAt = now;
    }
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (t.x < t.r) { t.x = t.r; t.vx = Math.abs(t.vx); }
    if (t.x > viewW - t.r) { t.x = Math.max(t.r, viewW - t.r); t.vx = -Math.abs(t.vx); }
    if (t.y < t.r + 8) { t.y = t.r + 8; t.vy = Math.abs(t.vy); }
    if (t.y > viewH - t.r - 8) { t.y = Math.max(t.r + 8, viewH - t.r - 8); t.vy = -Math.abs(t.vy); }
  }

  function scoreTracking(dt) {
    var t = targets[0];
    if (!t) return;
    if (!holding) {
      t.on = false;
      return;
    }
    var dx = pointer.x - t.x;
    var dy = pointer.y - t.y;
    var reach = t.r + 6;
    t.on = dx * dx + dy * dy <= reach * reach;
    if (t.on) trackMs += dt * 1000;
  }

  function step() {
    var now = gameNow();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (mode.kind === 'track') {
      moveTracking(dt, now);
      scoreTracking(dt);
    } else {
      expireDue(now);
      if (phase !== 'run') return;
      if (mode.spawn && now >= nextSpawn) {
        spawnOne();
        armSpawn(now);
      }
    }
    dropResolved(now);
    checkEnd();
  }

  function palette() {
    if (settings.palette === 'safe') {
      return {
        fill: '#10243a',
        ring: '#56b4e9',
        inner: 'rgba(240,228,66,0.95)',
        center: '#f0e442',
        timer: '#009e73',
        hotFill: '#3a2f10',
        hotRing: '#e69f00',
        glow: 'rgba(86,180,233,0.75)',
        hotGlow: 'rgba(230,159,0,0.8)',
        on: '#56b4e9'
      };
    }
    return {
      fill: '#2a1216',
      ring: '#ff4d55',
      inner: 'rgba(255,170,170,0.8)',
      center: '#fff5f5',
      timer: '#00d4ff',
      hotFill: '#3a1c08',
      hotRing: '#ff9f1a',
      glow: 'rgba(255,77,85,0.72)',
      hotGlow: 'rgba(255,159,26,0.78)',
      on: '#00d4ff'
    };
  }

  var glowCache = {};
  function glowSprite(color) {
    if (glowCache[color]) return glowCache[color];
    var c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(48, 48, 8, 48, 48, 48);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(48, 48, 48, 0, Math.PI * 2);
    g.fill();
    glowCache[color] = c;
    return c;
  }

  function drawTarget(t, now) {
    var colors = palette();
    var reduce = motionReduced();
    if (t.hit) {
      var age = now - t.hitAt;
      var life = reduce ? 80 : 280;
      var alpha = clamp(1 - age / life, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.timer;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (1 + (reduce ? 0 : age / life) * 0.45), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    var pct = t.life ? clamp((now - t.born) / t.life, 0, 1) : 0;
    var urgency = pct > 0.7 ? (pct - 0.7) / 0.3 : 0;
    var hot = urgency > 0.15;
    ctx.save();
    var sprite = glowSprite(hot ? colors.hotGlow : colors.glow);
    var glowR = t.r + 10;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sprite, t.x - glowR, t.y - glowR, glowR * 2, glowR * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hot ? colors.hotFill : colors.fill;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.on ? colors.on : (hot ? colors.hotRing : colors.ring);
    ctx.lineWidth = t.r < 18 ? 2 : 2.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = colors.inner;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(3, t.r * 0.25), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = colors.center;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(2, t.r * 0.08), 0, Math.PI * 2);
    ctx.fill();
    if (t.life) {
      ctx.strokeStyle = hot ? colors.hotRing : colors.timer;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r + 5, -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2);
      ctx.stroke();
    }
    if (t.tracking && !reduce) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = colors.timer;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + t.vx * 0.12, t.y + t.vy * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFx(now) {
    var life = motionReduced() ? 90 : 340;
    var i;
    for (i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      var age = now - f.at;
      if (age > life) {
        fx.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = clamp(1 - age / life, 0, 1);
      if (f.type === 'x') {
        ctx.strokeStyle = '#ff5c5c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x - 7, f.y - 7);
        ctx.lineTo(f.x + 7, f.y + 7);
        ctx.moveTo(f.x + 7, f.y - 7);
        ctx.lineTo(f.x - 7, f.y + 7);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 + age / life), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBar() {
    if (phase !== 'run' && phase !== 'paused') return;
    var pct = 1;
    if (mode.timed) pct = 1 - clamp(elapsed() / (runSeconds * 1000), 0, 1);
    else if (mode.goal) pct = 1 - hits / mode.goal;
    else if (mode.lives) pct = Math.max(0, lives) / mode.lives;
    ctx.fillStyle = 'rgba(0,212,255,0.9)';
    ctx.fillRect(0, 0, Math.max(0, viewW * pct), 3);
  }

  function drawCombo() {
    if (phase !== 'run' || combo < 2) return;
    ctx.save();
    ctx.font = '700 18px Outfit, Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(combo + '×', viewW / 2, 12);
    ctx.restore();
  }

  function drawCountdown() {
    if (phase !== 'countdown' || !countShown) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.font = '800 ' + Math.round(Math.min(viewW, viewH) * 0.28) + 'px Outfit, Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countShown, viewW / 2, viewH / 2);
    ctx.restore();
  }

  function drawPace() {
    if (phase !== 'run' || !mode.adapt) return;
    var label = adapt < 0.85 ? 'Speeding up' : (adapt > 1.15 ? 'Easing off' : 'Holding pace');
    ctx.save();
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 12, viewH - 10);
    ctx.restore();
  }

  function drawCrosshair() {
    if (!pointerOn || phase !== 'run' || settings.crosshair === 'off') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 1.25;
    if (settings.crosshair === 'dot') {
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    var x = pointer.x;
    var y = pointer.y;
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 11);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (viewW < 2 || viewH < 2) return;
    var now = gameNow();
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, viewW, viewH);
    if (gridLayer) ctx.drawImage(gridLayer, 0, 0, viewW, viewH);
    drawBar();
    var i;
    for (i = 0; i < targets.length; i++) drawTarget(targets[i], now);
    drawFx(now);
    drawCombo();
    drawCountdown();
    drawPace();
    drawCrosshair();
  }

  function formatRemain(ms) {
    var s = Math.max(0, ms / 1000);
    if (s <= 5.05) return s.toFixed(1);
    return String(Math.ceil(s - 1e-4));
  }

  function updateHud() {
    var kind = mode.kind || 'click';
    if (phase === 'idle') {
      if (mode.timed) setText('hudTime', String(duration));
      else if (mode.goal) setText('hudTime', String(mode.goal));
      else setText('hudTime', String(mode.lives || '—'));
      setText('hudScore', '0');
      setText('hudHits', '0');
      setText('hudMiss', '0');
      setText('hudExp', '0');
      setText('hudAcc', '—');
      return;
    }
    if (mode.timed) setText('hudTime', formatRemain(runSeconds * 1000 - elapsed()));
    else if (mode.goal) setText('hudTime', String(Math.max(0, mode.goal - hits)));
    else setText('hudTime', String(Math.max(0, lives)));

    if (kind === 'benchmark') setText('hudScore', reactions.length ? String(Math.round(runningAvg())) : '—');
    else if (kind === 'track') setText('hudScore', String(trackScore()));
    else setText('hudScore', String(currentScore()));

    if (kind === 'track') setText('hudHits', (trackMs / 1000).toFixed(1) + 's');
    else setText('hudHits', String(hits));

    setText('hudMiss', String(misclicks));
    setText('hudExp', String(expired));

    if (kind === 'track') {
      var gone = elapsed();
      setText('hudAcc', gone < 250 ? '—' : Math.round(trackMs / gone * 100) + '%');
    } else {
      var acc = shotAccuracy();
      setText('hudAcc', acc == null ? '—' : Math.round(acc * 100) + '%');
    }
  }

  function configureLabels() {
    var kind = mode.kind || 'click';
    setText('hudTimeLbl', mode.timed ? 'Time' : (mode.goal ? 'Left' : 'Lives'));
    setText('hudScoreLbl', kind === 'benchmark' ? 'Avg ms' : 'Score');
    setText('hudHitsLbl', kind === 'track' ? 'Tracked' : 'Hits');
    setText('hudMissLbl', 'Misclick');
    setText('hudExpLbl', 'Expired');
    setText('hudAccLbl', kind === 'track' ? 'Track' : 'Accuracy');
    statExp.classList.toggle('is-off', !mode.expire);
  }

  function hide(el) { el.classList.add('hidden'); }
  function show(el) { el.classList.remove('hidden'); }

  function syncPauseButton() {
    var on = phase === 'run' || phase === 'countdown' || phase === 'paused';
    btnPause.hidden = !on;
    btnPause.textContent = phase === 'paused' ? 'Resume' : 'Pause';
    btnPause.setAttribute('aria-label', phase === 'paused' ? 'Resume' : 'Pause');
  }

  function pointFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (viewW / Math.max(1, rect.width)),
      y: (e.clientY - rect.top) * (viewH / Math.max(1, rect.height))
    };
  }

  function tryHit(p) {
    var now = gameNow();
    var i;
    for (i = targets.length - 1; i >= 0; i--) {
      var t = targets[i];
      var dx = p.x - t.x;
      var dy = p.y - t.y;
      var reach = t.r + 6;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (t.hit) return;
      onHit(t, Math.sqrt(dx * dx + dy * dy), now);
      return;
    }
    onMiss(p);
  }

  function onTrackDown(p) {
    var t = targets[0];
    if (!t) return;
    var dx = p.x - t.x;
    var dy = p.y - t.y;
    var reach = t.r + 6;
    if (dx * dx + dy * dy > reach * reach) onMiss(p);
  }

  function updateCountdown() {
    var left = countEndsAt - performance.now();
    if (left <= 0) {
      beginPlay();
      return;
    }
    var label = '';
    if (!motionReduced()) {
      if (left > 1000) label = '3';
      else if (left > 500) label = '2';
      else label = '1';
    }
    if (label !== countShown) {
      countShown = label;
      if (label) sfx('tick');
    }
  }

  function beginPlay() {
    phase = 'run';
    hide(countShield);
    runOrigin = gameNow();
    lastFrame = 0;
    inputLock = performance.now() + 90;
    applyLayout();
    spawnOpening();
    syncPauseButton();
    updateHud();
  }

  function ensureLoop() {
    if (loopOn) return;
    loopOn = true;
    raf = requestAnimationFrame(loop);
  }

  function loop() {
    if (phase === 'idle' || phase === 'results') {
      loopOn = false;
      return;
    }
    raf = requestAnimationFrame(loop);
    if (phase === 'countdown') {
      updateCountdown();
      if (phase !== 'countdown' && phase !== 'run') return;
      draw();
      return;
    }
    if (phase === 'paused') {
      draw();
      updateHud();
      return;
    }
    if (phase === 'run') {
      step();
      if (phase !== 'run') return;
      draw();
      updateHud();
    }
  }

  function resetRun() {
    hits = 0;
    misclicks = 0;
    expired = 0;
    combo = 0;
    bestCombo = 0;
    bullseyes = 0;
    pointSum = 0;
    reactions = [];
    clicks = [];
    targets = [];
    fx = [];
    trackMs = 0;
    lives = mode.lives || 0;
    adapt = 1;
    recent = [];
    specIndex = 0;
    nextSpawn = 0;
    runOrigin = 0;
    pauseDebt = 0;
    pauseMark = 0;
    lastFrame = 0;
    holding = false;
    countShown = '';
    ended = false;
    cardBlob = null;
    hudCache = {};
  }

  function seedFor(which) {
    if (which === 'retry' || (which === 'again' && mode.daily)) {
      return lastSeed || queuedSeed || dailySeedFor(new Date());
    }
    if (which === 'again') return randomSeed();
    if (queuedSeed) return queuedSeed;
    if (mode.daily) return dailySeedFor(new Date());
    return randomSeed();
  }

  function startRun(opts) {
    opts = opts || {};
    if (!opts.force && (phase === 'run' || phase === 'countdown' || phase === 'paused')) return;
    var which = opts.which || 'menu';
    if (opts.seed) runSeed = opts.seed;
    else runSeed = seedFor(which);
    lastSeed = runSeed;
    runSeconds = mode.timed ? duration : 0;
    resetRun();
    rng = mulberry32(hashString(mode.id + '|' + runSeed));
    specs = [];
    var i;
    for (i = 0; i < 420; i++) specs.push(rollSpec(rng));
    phase = 'countdown';
    hide(startOverlay);
    hide(resultOverlay);
    resultOverlay.classList.remove('show');
    hide(pauseOverlay);
    show(countShield);
    btnPause.hidden = false;
    syncPauseButton();
    configureLabels();
    applyLayout();
    var lead = motionReduced() ? 180 : 1500;
    countEndsAt = performance.now() + lead;
    countShown = motionReduced() ? '' : '3';
    if (!motionReduced()) sfx('tick');
    updateHud();
    ensureLoop();
    if (window.CGSfx && window.CGSfx.unlock) window.CGSfx.unlock();
  }

  function pause() {
    if (phase !== 'run' && phase !== 'countdown') return;
    if (phase === 'countdown') countLeft = Math.max(0, countEndsAt - performance.now());
    pauseMark = performance.now();
    pausedFrom = phase;
    phase = 'paused';
    holding = false;
    resumeGate = performance.now() + 350;
    show(pauseOverlay);
    syncPauseButton();
    draw();
  }

  function resume(fromPointer) {
    if (phase !== 'paused') return;
    if (fromPointer && performance.now() < resumeGate) return;
    var gap = performance.now() - pauseMark;
    if (pausedFrom === 'countdown') {
      countEndsAt = performance.now() + countLeft;
      phase = 'countdown';
    } else {
      pauseDebt += gap;
      phase = 'run';
      lastFrame = 0;
    }
    inputLock = performance.now() + (fromPointer ? 260 : 0);
    hide(pauseOverlay);
    syncPauseButton();
    ensureLoop();
  }

  function showMenu() {
    phase = 'idle';
    ended = true;
    loopOn = false;
    cancelAnimationFrame(raf);
    holding = false;
    hide(resultOverlay);
    resultOverlay.classList.remove('show');
    hide(pauseOverlay);
    hide(countShield);
    show(startOverlay);
    btnPause.hidden = true;
    configureLabels();
    renderModes();
    renderDurs();
    renderBanner();
    renderBest();
    renderHistory();
    updateHud();
    queueLayout();
    draw();
  }

  function historyRows() {
    var hist = readJSON('at_hist_v2', {});
    var rows = hist[mode.id] || [];
    var dur = mode.timed ? duration : 0;
    return rows.filter(function (row) { return (row.dur || 0) === dur; });
  }

  function renderHistory() {
    var rows = historyRows();
    if (rows.length < 2) {
      histWrap.hidden = true;
      return;
    }
    histWrap.hidden = false;
    drawSpark(rows.map(function (row) { return row.score || 0; }));
    if (mode.kind === 'benchmark') {
      var avgs = rows.filter(function (row) { return row.avg != null; });
      var mean = 0;
      var i;
      for (i = 0; i < avgs.length; i++) mean += avgs[i].avg;
      mean = avgs.length ? mean / avgs.length : 0;
      histNote.textContent = 'Last ' + rows.length + ' · average ' + Math.round(mean) + ' ms';
    } else {
      var total = 0;
      var j;
      for (j = 0; j < rows.length; j++) total += rows[j].score || 0;
      histNote.textContent = 'Last ' + rows.length + ' · average score ' + Math.round(total / rows.length).toLocaleString();
    }
  }

  function drawSpark(values) {
    while (spark.firstChild) spark.removeChild(spark.firstChild);
    var w = 240;
    var h = 36;
    spark.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var d = '';
    var i;
    for (i = 0; i < values.length; i++) {
      var x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 4) + 2;
      var y = h - 4 - ((values[i] - min) / span) * (h - 8);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#00d4ff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    spark.appendChild(path);
  }

  function renderBest() {
    var all = readJSON('at_pb_v2', {});
    var key = mode.timed ? String(duration) : 'x';
    var pb = all[mode.id] && all[mode.id][key];
    var parts = [];
    if (pb && mode.kind === 'benchmark' && pb.avg != null) parts.push('Best average ' + Math.round(pb.avg) + ' ms');
    else if (pb && pb.score) parts.push('Best score ' + Math.round(pb.score).toLocaleString());
    if (pb && pb.acc) parts.push('Best accuracy ' + Math.round(pb.acc * 100) + '%');
    if (pb && pb.avg != null && mode.kind !== 'benchmark') parts.push('Best reaction ' + Math.round(pb.avg) + ' ms');
    var text = parts.length ? parts.join(' · ') : 'No record yet.';
    if ((!pb || !pb.score) && (mode.id === 'classic' || mode.id === 'daily')) {
      var old = null;
      try { old = localStorage.getItem('at_best_' + duration); } catch (err) {}
      if (old) text += ' Earlier hit record: ' + old + '.';
    }
    startBest.textContent = text;
  }

  function renderBanner() {
    if (mode.daily) {
      var st = loadDaily();
      var todaySeed = dailySeedFor(new Date());
      var done = st.last === ymd(new Date());
      atBanner.hidden = false;
      if (queuedSeed && queuedSeed !== todaySeed) {
        atBanner.textContent = 'Shared daily board. It does not change today’s streak.';
      } else {
        atBanner.textContent = 'Today’s board is the same for everyone. Streak ' + (st.streak || 0) + (done ? ' · played today' : '');
      }
      return;
    }
    if (queuedSeed) {
      atBanner.hidden = false;
      atBanner.textContent = 'Shared challenge. This run uses the same target seed.';
      return;
    }
    atBanner.hidden = true;
    atBanner.textContent = '';
  }

  function renderModes() {
    modeList.replaceChildren();
    Object.keys(MODES).forEach(function (id) {
      var item = MODES[id];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'at-chip' + (id === mode.id ? ' is-on' : '');
      button.setAttribute('aria-pressed', id === mode.id ? 'true' : 'false');
      button.textContent = item.name;
      if (item.daily) {
        var streak = loadDaily().streak || 0;
        if (streak) button.textContent = 'Daily · ' + streak;
      }
      button.addEventListener('click', function () { selectMode(id); });
      modeList.appendChild(button);
    });
    modeBlurb.textContent = mode.blurb;
  }

  function renderDurs() {
    durList.replaceChildren();
    if (!mode.durations) {
      durList.hidden = true;
      return;
    }
    durList.hidden = false;
    mode.durations.forEach(function (d) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'at-chip' + (d === duration ? ' is-on' : '');
      button.setAttribute('aria-pressed', d === duration ? 'true' : 'false');
      button.textContent = d + 's';
      if (mode.lockDur) button.disabled = true;
      button.addEventListener('click', function () {
        if (mode.lockDur) return;
        duration = d;
        renderDurs();
        renderBest();
        renderHistory();
        updateHud();
      });
      durList.appendChild(button);
    });
  }

  function selectMode(id) {
    if (phase === 'run' || phase === 'countdown' || phase === 'paused') return;
    mode = MODES[id];
    if (!mode.durations || mode.durations.indexOf(duration) === -1) duration = mode.dur || (mode.durations ? mode.durations[0] : 30);
    if (mode.daily) queuedSeed = dailySeedFor(new Date());
    else if (id === urlMode && urlSeed) queuedSeed = urlSeed;
    else queuedSeed = null;
    renderModes();
    renderDurs();
    renderBanner();
    renderBest();
    renderHistory();
    configureLabels();
    updateHud();
  }

  function renderSettings() {
    var buttons = document.querySelectorAll('#atSettings button[data-value]');
    Array.prototype.forEach.call(buttons, function (button) {
      var key = button.parentElement.getAttribute('data-set');
      var on = settings[key] === button.getAttribute('data-value');
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function pbKey() {
    return mode.timed ? String(runSeconds || duration) : 'x';
  }

  function buildSummary() {
    var kind = mode.kind || 'click';
    var avg = runningAvg();
    var acc = kind === 'track' ? trackRatio() : shotAccuracy();
    var grade = 'F';
    var score = 0;
    if (kind === 'benchmark') {
      grade = avg == null ? 'F' : gradeFromMs(avg);
      score = avg == null ? 0 : Math.max(0, Math.round(1000 - avg));
    } else if (kind === 'track') {
      grade = gradeFromTrack(trackRatio());
      score = trackScore();
    } else if (kind === 'precision') {
      grade = gradeFromHits(hits);
      score = currentScore();
    } else {
      grade = gradeFromRate(effectiveRate(hits, misclicks, runSeconds), mode.rateScale || 1);
      score = currentScore();
    }
    return { kind: kind, avg: avg, acc: acc, grade: grade, score: score };
  }

  function saveRecords(summary) {
    var all = readJSON('at_pb_v2', {});
    if (!all[mode.id] || typeof all[mode.id] !== 'object') all[mode.id] = {};
    var key = pbKey();
    var prev = all[mode.id][key] || {};
    var next = {
      score: +prev.score || 0,
      avg: prev.avg == null ? null : +prev.avg,
      acc: +prev.acc || 0,
      at: prev.at || 0
    };
    var better = false;
    if (summary.kind === 'benchmark') {
      if (summary.avg != null && (next.avg == null || summary.avg < next.avg)) {
        next.avg = summary.avg;
        next.score = summary.score;
        better = true;
      }
    } else if (summary.score > next.score) {
      next.score = summary.score;
      better = true;
    }
    if (summary.acc != null && summary.acc > (next.acc || 0)) next.acc = summary.acc;
    if (summary.kind !== 'benchmark' && summary.avg != null && (next.avg == null || summary.avg < next.avg)) {
      next.avg = summary.avg;
    }
    if (better) next.at = Date.now();
    all[mode.id][key] = next;
    writeJSON('at_pb_v2', all);

    var hist = readJSON('at_hist_v2', {});
    if (!Array.isArray(hist[mode.id])) hist[mode.id] = [];
    hist[mode.id].push({
      at: Date.now(),
      dur: mode.timed ? runSeconds : 0,
      score: summary.score,
      acc: summary.acc,
      avg: summary.avg,
      grade: summary.grade,
      hits: hits,
      miss: misclicks,
      exp: expired
    });
    if (hist[mode.id].length > 20) hist[mode.id] = hist[mode.id].slice(-20);
    writeJSON('at_hist_v2', hist);
    return better;
  }

  function recordDaily(seed) {
    if (!mode.daily) return null;
    var todaySeed = dailySeedFor(new Date());
    var data = loadDaily();
    if (seed !== todaySeed) {
      return { streak: data.streak || 0, fresh: false, practice: true };
    }
    var today = ymd(new Date());
    if (data.last === today) return { streak: data.streak || 0, fresh: false, practice: false };
    var prev = new Date();
    prev.setDate(prev.getDate() - 1);
    var streak = data.last === ymd(prev) ? (data.streak || 0) + 1 : 1;
    var next = { last: today, streak: streak, best: Math.max(streak, data.best || 0) };
    writeJSON('at_daily_v1', next);
    return { streak: streak, fresh: true, practice: false };
  }

  function slowestRegion() {
    var cells = [];
    var i;
    for (i = 0; i < 9; i++) cells.push({ n: 0, ms: 0 });
    for (i = 0; i < clicks.length; i++) {
      var c = clicks[i];
      if (!c.hit || c.ms == null) continue;
      var col = Math.min(2, Math.floor(c.nx * 3));
      var row = Math.min(2, Math.floor(c.ny * 3));
      var cell = cells[row * 3 + col];
      cell.n += 1;
      cell.ms += c.ms;
    }
    var best = null;
    for (i = 0; i < cells.length; i++) {
      if (cells[i].n < 2) continue;
      var avg = cells[i].ms / cells[i].n;
      if (!best || avg > best.avg) best = { name: REGION_NAMES[i], avg: avg, n: cells[i].n };
    }
    return best;
  }

  function fillRows(pairs) {
    var host = document.getElementById('resRows');
    host.replaceChildren();
    pairs.forEach(function (pair) {
      var row = document.createElement('div');
      row.className = 'at-result-row';
      var label = document.createElement('span');
      label.textContent = pair[0];
      var value = document.createElement('span');
      value.textContent = pair[1];
      row.appendChild(label);
      row.appendChild(value);
      host.appendChild(row);
    });
  }

  function drawHeat(target, list) {
    var width = Math.max(120, target.clientWidth || 320);
    var height = Math.max(72, target.clientHeight || 110);
    var scale = 2;
    target.width = Math.round(width * scale);
    target.height = Math.round(height * scale);
    var g = target.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = '#12141c';
    g.fillRect(0, 0, width, height);
    var i;
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      g.fillStyle = p.hit ? 'rgba(0,212,255,0.9)' : 'rgba(255,92,92,0.9)';
      g.beginPath();
      g.arc(p.nx * width, p.ny * height, p.hit ? 3.2 : 2.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  function copyLines(summary) {
    var kind = summary.kind;
    var lines = [];
    if (kind === 'benchmark') {
      lines.push(['Targets', hits + ' / ' + (mode.goal || hits)]);
      lines.push(['Average', summary.avg == null ? '—' : Math.round(summary.avg) + ' ms']);
      lines.push(['Median', reactions.length ? Math.round(medianOf(reactions)) + ' ms' : '—']);
      lines.push(['Fastest', reactions.length ? Math.round(Math.min.apply(null, reactions)) + ' ms' : '—']);
      lines.push(['Misclicks', String(misclicks)]);
    } else if (kind === 'track') {
      lines.push(['On target', (trackMs / 1000).toFixed(1) + 's']);
      lines.push(['Track', Math.round(trackRatio() * 100) + '%']);
      lines.push(['Score', summary.score.toLocaleString()]);
      lines.push(['Misclicks', String(misclicks)]);
    } else if (kind === 'precision') {
      lines.push(['Hits', String(hits)]);
      lines.push(['Score', summary.score.toLocaleString()]);
      lines.push(['Accuracy', summary.acc == null ? '—' : Math.round(summary.acc * 100) + '%']);
      lines.push(['Misclicks', String(misclicks)]);
      lines.push(['Expired', String(expired)]);
      lines.push(['Bullseyes', String(bullseyes)]);
    } else {
      var rate = effectiveRate(hits, misclicks, runSeconds);
      lines.push(['Score', summary.score.toLocaleString()]);
      lines.push(['Accuracy', summary.acc == null ? '—' : Math.round(summary.acc * 100) + '%']);
      lines.push(['Misclicks', String(misclicks)]);
      lines.push(['Expired', String(expired)]);
      lines.push(['Hits/sec', runSeconds ? (hits / runSeconds).toFixed(2) : '—']);
      lines.push(['Rate', rate.toFixed(2)]);
      lines.push(['Bullseyes', String(bullseyes)]);
      lines.push(['Best combo', String(bestCombo)]);
    }
    if (summary.avg != null && kind !== 'benchmark') {
      lines.push(['Avg reaction', Math.round(summary.avg) + ' ms']);
      lines.push(['Median', Math.round(medianOf(reactions)) + ' ms']);
      lines.push(['Fastest', Math.round(Math.min.apply(null, reactions)) + ' ms']);
    }
    if (summary.avg != null && reactions.length >= 5) {
      lines.push(['Faster than', percentileFromMs(summary.avg) + '% est.']);
    }
    return lines;
  }

  function formulaText(kind) {
    if (kind === 'benchmark') return 'Lower average is better. The percentile uses a published aim curve, not a live board.';
    if (kind === 'track') return 'Score is time on target. Misclicks trim it. The grade is the share of the round you held.';
    if (kind === 'precision') return 'Accuracy is hits divided by hits plus misclicks. A timeout costs a life, not accuracy.';
    return 'Accuracy is hits ÷ (hits + misclicks). Expired targets are separate. Grade is hits per second × accuracy, so 30, 60, and 90 second runs match. Spam clicks lower both.';
  }

  function challengeUrl(seed) {
    var url = 'https://www.cosmicgameshub.com/games/aim-trainer?mode=' + encodeURIComponent(mode.id);
    if (mode.timed) url += '&dur=' + encodeURIComponent(String(runSeconds || duration));
    url += '&seed=' + encodeURIComponent(seed);
    return url;
  }

  function shareBody(summary) {
    var head = 'Aim Trainer · ' + mode.name;
    if (mode.timed) head += ' ' + runSeconds + 's';
    var bits = ['Grade ' + summary.grade];
    if (summary.kind === 'benchmark' && summary.avg != null) bits.push(Math.round(summary.avg) + ' ms avg');
    else bits.push(summary.score.toLocaleString() + ' pts');
    if (summary.acc != null && summary.kind !== 'benchmark') bits.push(Math.round(summary.acc * 100) + '%');
    if (summary.avg != null && reactions.length >= 5 && summary.kind !== 'track') {
      bits.push('faster than ' + percentileFromMs(summary.avg) + '% est.');
    }
    return head + '\n' + bits.join(' · ');
  }

  function renderCard(summary) {
    var card = document.createElement('canvas');
    card.width = 1080;
    card.height = 1080;
    var c = card.getContext('2d');
    c.fillStyle = '#10131a';
    c.fillRect(0, 0, 1080, 1080);
    var grad = c.createLinearGradient(0, 0, 1080, 900);
    grad.addColorStop(0, 'rgba(0,212,255,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 1080, 1080);
    c.fillStyle = '#00d4ff';
    c.fillRect(0, 0, 1080, 8);
    c.font = '700 28px Outfit, Inter, system-ui, sans-serif';
    c.fillStyle = '#00d4ff';
    c.fillText('COSMICGAMESHUB', 72, 88);
    c.fillStyle = '#ffffff';
    c.font = '800 64px Outfit, Inter, system-ui, sans-serif';
    c.fillText('Aim Trainer', 72, 170);
    c.fillStyle = '#a8a8c0';
    c.font = '500 30px Outfit, Inter, system-ui, sans-serif';
    var sub = mode.name + (mode.timed ? ' · ' + runSeconds + 's' : '');
    c.fillText(sub, 72, 220);
    c.fillStyle = '#ffe14a';
    c.font = '800 180px Outfit, Inter, system-ui, sans-serif';
    c.fillText(summary.grade, 72, 430);
    c.fillStyle = '#ffffff';
    c.font = '700 42px Outfit, Inter, system-ui, sans-serif';
    var hero = summary.kind === 'benchmark' && summary.avg != null
      ? Math.round(summary.avg) + ' ms average'
      : summary.score.toLocaleString() + ' pts';
    c.fillText(hero, 72, 500);
    c.font = '500 30px Inter, system-ui, sans-serif';
    c.fillStyle = '#d5d5e6';
    var line = 'Accuracy ' + (summary.acc == null ? '—' : Math.round(summary.acc * 100) + '%');
    if (summary.avg != null && summary.kind !== 'benchmark') line += '   ·   ' + Math.round(summary.avg) + ' ms';
    if (reactions.length >= 5 && summary.avg != null) line += '   ·   faster than ' + percentileFromMs(summary.avg) + '%';
    c.fillText(line, 72, 560);
    c.fillStyle = '#0c0e14';
    roundRect(c, 72, 620, 936, 280, 24);
    c.fill();
    var i;
    for (i = 0; i < clicks.length; i++) {
      var p = clicks[i];
      c.fillStyle = p.hit ? 'rgba(0,212,255,0.95)' : 'rgba(255,92,92,0.95)';
      c.beginPath();
      c.arc(72 + p.nx * 936, 620 + p.ny * 280, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#00d4ff';
    c.font = '600 22px Inter, system-ui, sans-serif';
    c.fillText(shareUrl.replace('https://', ''), 72, 1000);
    return new Promise(function (resolve) {
      card.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function setShareMsg(text) {
    atShareMsg.hidden = false;
    atShareMsg.textContent = text;
  }

  function finish() {
    if (ended || phase === 'results' || phase === 'idle') return;
    ended = true;
    phase = 'results';
    holding = false;
    loopOn = false;
    cancelAnimationFrame(raf);
    var summary = buildSummary();
    var better = saveRecords(summary);
    var daily = recordDaily(runSeed);
    var copy = (GRADE_COPY[summary.kind] || GRADE_COPY.click)[summary.grade] || '';
    var gradeEl = document.getElementById('resGrade');
    gradeEl.textContent = summary.grade;
    gradeEl.className = 'at-grade at-grade--' + summary.grade;
    document.getElementById('resNewBest').hidden = !better;
    var hero = document.getElementById('resHero');
    if (summary.kind === 'benchmark' && summary.avg != null) hero.textContent = Math.round(summary.avg) + ' ms';
    else if (summary.kind === 'track') hero.textContent = (trackMs / 1000).toFixed(1) + 's on target';
    else hero.textContent = summary.score.toLocaleString();
    document.getElementById('resDesc').textContent = copy;
    fillRows(copyLines(summary));
    var region = slowestRegion();
    var regionEl = document.getElementById('resRegion');
    if (region) {
      regionEl.hidden = false;
      regionEl.textContent = 'Slowest area: ' + region.name + ' · ' + Math.round(region.avg) + ' ms over ' + region.n + ' hits.';
    } else {
      regionEl.hidden = true;
    }
    var estimate = document.getElementById('resEstimate');
    if (summary.avg != null && reactions.length >= 5 && summary.kind !== 'track') {
      estimate.hidden = false;
      estimate.textContent = 'Faster than ' + percentileFromMs(summary.avg) + '% of typical players. Estimated from a published aim curve, not a live leaderboard.';
    } else {
      estimate.hidden = true;
    }
    document.getElementById('resFormula').textContent = formulaText(summary.kind);
    var streakEl = document.getElementById('resStreak');
    if (daily) {
      streakEl.hidden = false;
      if (daily.practice) streakEl.textContent = 'Practice board. Today’s streak stays ' + daily.streak + '.';
      else if (daily.fresh) streakEl.textContent = 'Daily streak ' + daily.streak + '.';
      else streakEl.textContent = 'Daily already counted today. Streak ' + daily.streak + '.';
    } else {
      streakEl.hidden = true;
    }
    shareUrl = challengeUrl(runSeed);
    shareText = shareBody(summary);
    atShareLink.value = shareUrl;
    atShareMsg.hidden = true;
    document.getElementById('btnRetry').hidden = !!mode.daily;
    hide(countShield);
    hide(pauseOverlay);
    btnPause.hidden = true;
    show(resultOverlay);
    resultOverlay.classList.add('show');
    if (clicks.length) {
      resHeat.hidden = false;
      requestAnimationFrame(function () { drawHeat(resHeat, clicks); });
    } else {
      resHeat.hidden = true;
    }
    updateHud();
    renderCard(summary).then(function (blob) { cardBlob = blob; }).catch(function () { cardBlob = null; });
    draw();
  }

  function copyFallback(failedShare) {
    var full = shareText + '\n' + shareUrl;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(function () {
        setShareMsg(failedShare ? 'Couldn’t open the share sheet. The link is copied.' : 'Link copied.');
      }).catch(function () {
        atShareLink.focus();
        atShareLink.select();
        setShareMsg('Couldn’t share or copy. The link is selected below.');
      });
      return;
    }
    atShareLink.focus();
    atShareLink.select();
    setShareMsg('Couldn’t open share. Select the link below.');
  }

  function onShare() {
    sfx('share');
    var payload = { title: 'Aim Trainer', text: shareText, url: shareUrl };
    var file = null;
    if (cardBlob) {
      try { file = new File([cardBlob], 'aim-trainer.png', { type: 'image/png' }); } catch (err) {}
    }
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ title: payload.title, text: payload.text, url: payload.url, files: [file] }).then(function () {
        setShareMsg('Shared.');
      }).catch(function (err) {
        if (err && err.name === 'AbortError') setShareMsg('Share canceled.');
        else copyFallback(true);
      });
      return;
    }
    if (navigator.share) {
      navigator.share(payload).then(function () {
        setShareMsg('Shared.');
      }).catch(function (err) {
        if (err && err.name === 'AbortError') setShareMsg('Share canceled.');
        else copyFallback(true);
      });
      return;
    }
    copyFallback(false);
  }

  function onCard() {
    if (!cardBlob) {
      setShareMsg('The card is still rendering. Try again in a moment.');
      return;
    }
    var url = URL.createObjectURL(cardBlob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'aim-trainer.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    setShareMsg('Card saved.');
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var requested = params.get('mode');
    if (requested && MODES[requested]) mode = MODES[requested];
    urlMode = mode.id;
    var dur = parseInt(params.get('dur'), 10);
    if (mode.durations && mode.durations.indexOf(dur) !== -1) duration = dur;
    else duration = mode.dur || 30;
    var seed = params.get('seed') || '';
    if (/^[a-zA-Z0-9_-]{1,40}$/.test(seed)) urlSeed = seed;
    if (mode.daily) queuedSeed = /^d\d{8}$/.test(urlSeed) ? urlSeed : dailySeedFor(new Date());
    else if (urlSeed) queuedSeed = urlSeed;
  }

  function ignoredKeyTarget(event) {
    var target = event.target;
    if (!target || !target.closest) return false;
    return !!target.closest('a, input, textarea, select, summary, .at-settings');
  }

  function onKey(event) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    var search = document.getElementById('siteSearch');
    if (search && !search.hidden) return;
    var navLinks = document.getElementById('navLinks');
    if (navLinks && navLinks.classList.contains('open') && event.key === 'Escape') return;
    if (event.key === 'Escape') {
      if (phase === 'run' || phase === 'countdown') pause();
      else if (phase === 'paused') resume(false);
      else if (phase === 'results') showMenu();
      return;
    }
    if (event.key === 'p' || event.key === 'P') {
      if (phase === 'run' || phase === 'countdown') pause();
      else if (phase === 'paused') resume(false);
      return;
    }
    if (ignoredKeyTarget(event)) return;
    if ((event.key === 'r' || event.key === 'R') && (phase === 'run' || phase === 'paused' || phase === 'countdown')) {
      event.preventDefault();
      startRun({ force: true, which: 'again' });
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'r' || event.key === 'R') {
      if (phase === 'idle' || phase === 'results') {
        event.preventDefault();
        startRun({ which: phase === 'results' ? 'again' : 'menu' });
      }
    }
  }

  function bind() {
    document.getElementById('btnStart').addEventListener('click', function () {
      startRun({ which: 'menu' });
    });
    document.getElementById('btnPlayAgain').addEventListener('click', function () {
      startRun({ which: 'again' });
    });
    document.getElementById('btnRetry').addEventListener('click', function () {
      startRun({ which: 'retry', seed: lastSeed });
    });
    document.getElementById('btnShare').addEventListener('click', onShare);
    document.getElementById('btnCard').addEventListener('click', onCard);
    btnPause.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (phase === 'paused') resume(true);
      else pause();
    });
    btnResume.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      resume(true);
    });
    document.getElementById('btnModes').addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      showMenu();
    });
    pauseOverlay.addEventListener('pointerdown', function (event) {
      if (event.target.closest && event.target.closest('button')) return;
      event.preventDefault();
      resume(true);
    });
    btnMute.addEventListener('click', toggleMute);
    btnMutePause.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleMute();
    });
    countShield.addEventListener('pointerdown', function (event) {
      event.preventDefault();
    });
    canvas.addEventListener('pointerdown', function (event) {
      if (phase !== 'run') return;
      if (performance.now() < inputLock) return;
      event.preventDefault();
      pointer = pointFromEvent(event);
      pointerOn = true;
      holding = true;
      try { canvas.setPointerCapture(event.pointerId); } catch (err) {}
      if (mode.kind === 'track') onTrackDown(pointer);
      else tryHit(pointer);
      updateHud();
    });
    canvas.addEventListener('pointermove', function (event) {
      pointer = pointFromEvent(event);
      pointerOn = true;
    });
    window.addEventListener('pointermove', function (event) {
      if (!holding) return;
      pointer = pointFromEvent(event);
      pointerOn = true;
    });
    window.addEventListener('pointerup', function () { holding = false; });
    window.addEventListener('pointercancel', function () { holding = false; });
    canvas.addEventListener('pointerleave', function () {
      if (!holding) pointerOn = false;
    });
    canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    document.addEventListener('keydown', onKey);
    document.getElementById('atSettings').addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('button[data-value]') : null;
      if (!button) return;
      var key = button.parentElement.getAttribute('data-set');
      if (!key) return;
      settings[key] = button.getAttribute('data-value');
      writeJSON('at_settings_v1', settings);
      renderSettings();
    });
    window.addEventListener('resize', queueLayout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', queueLayout);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });
    window.addEventListener('blur', function () { pause(); });
    var observer = new ResizeObserver(queueLayout);
    var nav = document.querySelector('.nav');
    var header = document.querySelector('.at-header');
    var hud = document.querySelector('.at-hud');
    if (nav) observer.observe(nav);
    if (header) observer.observe(header);
    if (hud) observer.observe(hud);
    window.addEventListener('load', queueLayout);
  }

  function snapshot() {
    var rect = canvas.getBoundingClientRect();
    return {
      phase: phase,
      viewW: viewW,
      viewH: viewH,
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      width: rect.width,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      hits: hits,
      misclicks: misclicks,
      expired: expired,
      combo: combo,
      lives: lives,
      score: mode.kind === 'track' ? trackScore() : currentScore(),
      acc: shotAccuracy(),
      targets: targets.filter(function (t) { return !t.hit; }).map(function (t) {
        return { x: t.x, y: t.y, r: t.r, life: t.life };
      }),
      hud: {
        time: document.getElementById('hudTime').textContent,
        score: document.getElementById('hudScore').textContent,
        hits: document.getElementById('hudHits').textContent,
        miss: document.getElementById('hudMiss').textContent,
        exp: document.getElementById('hudExp').textContent,
        acc: document.getElementById('hudAcc').textContent
      },
      seed: runSeed,
      spec0: specs[0] || null
    };
  }

  readUrl();
  renderSettings();
  renderMute();
  renderModes();
  renderDurs();
  renderBanner();
  renderBest();
  renderHistory();
  configureLabels();
  updateHud();
  bind();
  applyLayout();

  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    window.__AT = { snapshot: snapshot, start: startRun, pause: pause, resume: resume };
  }
})();
