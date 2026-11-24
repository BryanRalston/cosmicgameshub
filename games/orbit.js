/* Orbit — daily word rings. Data: /games/orbit-puzzles.js (generated, every puzzle proven unique).
   Rules: 4 rings x 8 spokes. Inner ring fixed. Turn rings 2-4 in 45deg steps until every spoke,
   read from the core outward, is a word. A move = one 45deg step (a drag counts its net steps).
   Stars: 3 within 2.5x par (2x par after a ring check), 2 within 5x par, else 1; locking a ring
   caps it at 2. Hints (once each a day): ring check = which moving rings are in place right now;
   ring lock = snap the ring furthest off into place, charged as the shortest turn it skips (so a
   score can never beat par). Puzzles ramp up Mon -> Sat (generator). */
(function () {
  'use strict';
  var D = window.ORBIT_DATA;
  if (!D) return;
  var N = D.spokes, R = D.rings, STEP = 360 / N;
  var LIGHT = new Set(D.light.split(' '));
  var RAD = [0.165, 0.262, 0.358, 0.452];   // ring radius / board size
  var TILE = 0.088;                           // tile diameter / board size
  var BEAM_IN = 0.11, BEAM_OUT = 0.452;
  // Optional generated art. Leave a path null to keep the CSS/SVG fallback (no request, no 404).
  // Drop the file in /images/orbit/ and set its path here to switch it on.
  var ART = {
    backdrop: '/images/orbit/orbit-backdrop.webp',   // page space backdrop (Imagine, 1280x720)
    core: '/images/orbit/orbit-core.webp',           // glowing core sphere (Imagine, 512x512 RGBA, rim feathered)
    rings: null       // e.g. '/images/orbit/orbit-rings.webp'     (faint ring texture under the tiles, 1200x1200, transparent)
  };
  var STATE_KEY = 'orbit-state-v2', STATS_KEY = 'orbit-stats-v1', HELP_KEY = 'orbit-seen-help';
  var $ = function (id) { return document.getElementById(id); };
  var sfx = function () { return window.CGSfx; };
  function muted() { return !sfx() || (sfx().isMuted && sfx().isMuted()); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function cdist(a, b) { var d = mod(a - b, N); return Math.min(d, N - d); }
  function jget(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---- which puzzle -------------------------------------------------------
  // Same UTC day as the other dailies (Pixle, Link, Gamerdle) and the shared countdown.
  function dayIdx(t) { return Math.floor(((t || Date.now()) - Date.UTC(2026, 0, 1)) / 86400000); }
  var ep = D.epoch.split('-');
  var EPOCH = dayIdx(Date.UTC(+ep[0], +ep[1] - 1, +ep[2]));
  var qs = new URLSearchParams(location.search);
  var PRACTICE = qs.has('practice');
  var todayNum = Math.max(1, dayIdx() - EPOCH + 1);
  // Practice draws from its own pool (orbit-practice.js), generated so that no practice
  // puzzle uses the same eight words as any daily: practice can never preview a future day.
  var PRAC = (window.ORBIT_PRACTICE && window.ORBIT_PRACTICE.puzzles) || [];
  var num, pIndex, P;
  if (PRACTICE && PRAC.length) {
    var want = parseInt(qs.get('n'), 10);
    pIndex = want >= 1 && want <= PRAC.length ? want - 1 : Math.floor(Math.random() * PRAC.length);
    num = pIndex + 1;
    P = PRAC[pIndex];
  } else {
    PRACTICE = false;
    num = todayNum;
    pIndex = (num - 1) % D.puzzles.length;
    P = D.puzzles[pIndex];
  }
  var WORDS = P[0].split(' ');
  var SCR = String(P[1]).split('').map(Number);
  var RINGS = [];
  for (var r0 = 0; r0 < R; r0++) RINGS.push(WORDS.map(function (w) { return w[r0]; }).join(''));
  var START = [0].concat(SCR);
  var PAR = START.reduce(function (s, o) { return s + Math.min(o, N - o); }, 0);
  var THREE_STAR = Math.ceil(PAR * 2.5), TWO_STAR = PAR * 5, THREE_STAR_CHECKED = PAR * 2;
  var WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(2026, 0, 1) + (EPOCH + todayNum - 1) * 86400000).getUTCDay()];

  // ---- state --------------------------------------------------------------
  // turns = moves spent on each ring (kept in the save; not shown on the share card).
  // path = the rings in the order they were worked on, a digit per switch ("2342"), for the share card.
  // hint = locked ring (-1 = unused). check = move count when the ring check was used (-1 = unused);
  // checkOffs = ring offsets at that moment (a ring's mark holds while it stays where it was checked).
  var st = { p: num, offs: START.slice(), moves: 0, elapsed: 0, hint: -1, check: -1, checkOffs: null, done: false, stars: 0, turns: [0, 0, 0, 0], path: '' };
  if (!PRACTICE) {
    var saved = jget(STATE_KEY);
    if (saved && saved.p === num && Array.isArray(saved.offs) && saved.offs.length === R) {
      st.offs = saved.offs.map(function (o) { return mod(o | 0, N); });
      st.offs[0] = 0;
      st.moves = saved.moves | 0; st.elapsed = +saved.elapsed || 0;
      st.hint = typeof saved.hint === 'number' ? saved.hint : -1;
      st.done = !!saved.done; st.stars = saved.stars | 0;
      if (Array.isArray(saved.turns) && saved.turns.length === R) st.turns = saved.turns.map(function (t) { return t | 0; });
      // Saves from before the route line have no path: the card just leaves that line out.
      if (typeof saved.path === 'string' && /^[123]{0,40}$/.test(saved.path)) st.path = saved.path;
      // Saves from before the ring check have no check fields: treat as unused.
      if (typeof saved.check === 'number' && saved.check >= 0) {
        st.check = saved.check | 0;
        st.checkOffs = Array.isArray(saved.checkOffs) && saved.checkOffs.length === R ? saved.checkOffs.map(function (o) { return mod(o | 0, N); }) : null;
      }
    }
  }
  function save() { if (!PRACTICE) jset(STATE_KEY, st); }

  var sel = 1;
  var ang = [], tgt = [];
  for (var r1 = 0; r1 < R; r1++) { ang[r1] = st.offs[r1] * STEP; tgt[r1] = ang[r1]; }
  var lit = [], prevLit = null;

  // ---- DOM ----------------------------------------------------------------
  var board = $('obBoard'), ringsEl = $('obRings'), tray = $('obTray'), pick = $('obPick');
  var NS = 'http://www.w3.org/2000/svg';
  var ringEls = [], tiles = [], tracks = [], beams = [], chips = [], pickBtns = [];

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function pt(aDeg, rr) { var a = aDeg * Math.PI / 180; return [Math.sin(a) * rr, -Math.cos(a) * rr]; }

  (function build() {
    var gT = $('obTracks'), gS = $('obSpokes'), gB = $('obBeams');
    for (var r = 0; r < R; r++) {
      svgEl('circle', { r: RAD[r] * 1000, 'class': 'ob-track ob-track--band', 'stroke-width': 88 }, gT);
      tracks.push(svgEl('circle', { r: RAD[r] * 1000, 'class': 'ob-track' + (r === 0 ? ' ob-track--fixed' : '') }, gT));
    }
    for (var k = 0; k < N; k++) {
      var a = pt(k * STEP, BEAM_IN * 1000), b = pt(k * STEP, 0.5 * 1000), c = pt(k * STEP, BEAM_OUT * 1000);
      svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'class': 'ob-spoke' }, gS);
      beams.push(svgEl('line', { x1: a[0], y1: a[1], x2: c[0], y2: c[1], 'class': 'ob-beam' }, gB));
    }
    for (var r2 = 0; r2 < R; r2++) {
      var ring = document.createElement('div');
      ring.className = 'ob-ring' + (r2 === 0 ? ' ob-ring--fixed' : '');
      tiles[r2] = [];
      for (var j = 0; j < N; j++) {
        var t = document.createElement('div');
        t.className = 'ob-tile';
        var s = document.createElement('span');
        s.textContent = RINGS[r2][j];
        t.appendChild(s);
        ring.appendChild(t);
        tiles[r2].push(t);
      }
      ringsEl.appendChild(ring);
      ringEls.push(ring);
    }
    for (var k2 = 0; k2 < N; k2++) {
      var li = document.createElement('li');
      li.className = 'ob-chip';
      li.innerHTML = '<small>' + (k2 + 1) + '</small><span></span>';
      (function (kk) {
        li.addEventListener('mouseenter', function () { beams[kk].classList.add('is-peek'); });
        li.addEventListener('mouseleave', function () { beams[kk].classList.remove('is-peek'); });
      })(k2);
      tray.appendChild(li);
      chips.push(li);
    }
    for (var r3 = 1; r3 < R; r3++) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.innerHTML = '<i style="transform:scale(' + (0.55 + r3 * 0.2).toFixed(2) + ')"></i>Ring ' + (r3 + 1) + '<b class="ob-mark" aria-hidden="true"></b>';
      bt.setAttribute('aria-label', 'Select ring ' + (r3 + 1) + (r3 === R - 1 ? ' (outer)' : ''));
      (function (rr) { bt.addEventListener('click', function () { select(rr); board.focus({ preventScroll: true }); }); })(r3);
      pick.appendChild(bt);
      pickBtns[r3] = bt;
    }
  })();

  // ---- geometry + render ----------------------------------------------------
  var size = 0;
  function layout() {
    size = board.clientWidth || 340;
    board.style.setProperty('--t', Math.round(size * TILE) + 'px');
    drawAll();
  }
  function drawRing(r) {
    var a = ang[r];
    ringEls[r].style.transform = 'rotate(' + a.toFixed(3) + 'deg)';
    var rr = RAD[r] * size;
    for (var j = 0; j < N; j++) {
      var base = j * STEP;
      tiles[r][j].style.transform = 'rotate(' + base + 'deg) translateY(' + (-rr).toFixed(2) + 'px) rotate(' + (-base - a).toFixed(3) + 'deg)';
    }
  }
  function drawAll() { for (var r = 0; r < R; r++) drawRing(r); }

  var raf = 0, lastT = 0, dragging = null;
  function tick(t) {
    raf = 0;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    var moving = false;
    for (var r = 0; r < R; r++) {
      if (dragging && dragging.r === r) { drawRing(r); continue; }
      var d = tgt[r] - ang[r];
      if (Math.abs(d) > 0.04) {
        ang[r] += d * (1 - Math.exp(-dt / 0.07));
        moving = true;
        drawRing(r);
      } else if (d !== 0) { ang[r] = tgt[r]; drawRing(r); }
    }
    if (moving || dragging) raf = requestAnimationFrame(tick); else lastT = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  // ---- words + lighting -----------------------------------------------------
  function spokes(offs) {
    var out = [];
    for (var k = 0; k < N; k++) {
      var s = '';
      for (var r = 0; r < R; r++) s += RINGS[r][mod(k - offs[r], N)];
      out.push(s);
    }
    return out;
  }
  var live = $('obLive');
  function evaluate(offs, quiet) {
    var sp = spokes(offs);
    lit = sp.map(function (w) { return LIGHT.has(w); });
    var count = 0, newly = [];
    for (var r = 0; r < R; r++) for (var j = 0; j < N; j++) tiles[r][j].classList.remove('is-lit');
    for (var k = 0; k < N; k++) {
      if (lit[k]) {
        count++;
        for (var r2 = 0; r2 < R; r2++) tiles[r2][mod(k - offs[r2], N)].classList.add('is-lit');
        if (prevLit && !prevLit[k]) newly.push(k);
      }
      beams[k].classList.toggle('is-lit', lit[k]);
      chips[k].classList.toggle('is-lit', lit[k]);
      chips[k].querySelector('span').textContent = sp[k];
      chips[k].setAttribute('aria-label', 'Spoke ' + (k + 1) + ': ' + sp[k].split('').join(' ') + (lit[k] ? ', lit' : ''));
    }
    $('obLit').textContent = count + '/' + N;
    if (!quiet && newly.length) {
      newly.forEach(function (k) {
        for (var r3 = 0; r3 < R; r3++) {
          var el = tiles[r3][mod(k - offs[r3], N)];
          el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
        }
      });
      if (!muted() && count < N) sfx().play('correct');
      if (sfx()) sfx().haptic(12);
      live.textContent = newly.map(function (k) { return 'Spoke ' + (k + 1) + ' lit: ' + sp[k]; }).join('. ');
    }
    prevLit = lit.slice();
    return count;
  }

  // ---- HUD + timer ----------------------------------------------------------
  function fmtT(sec) { sec = Math.floor(sec); return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  var runAt = 0;
  function running() { return runAt > 0; }
  function startClock() { if (!st.done && !runAt && st.moves > 0 && !document.hidden) runAt = performance.now(); }
  function stopClock() { if (runAt) { st.elapsed += (performance.now() - runAt) / 1000; runAt = 0; } }
  function elapsedNow() { return st.elapsed + (runAt ? (performance.now() - runAt) / 1000 : 0); }
  function hud() {
    $('obMoves').textContent = st.moves;
    $('obPar').textContent = PAR;
    $('obTime').textContent = fmtT(elapsedNow());
    $('obMoves').parentNode.classList.toggle('is-over', st.moves > TWO_STAR);
  }
  setInterval(function () { if (running()) hud(); }, 250);
  setInterval(function () { if (running()) save(); }, 4000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopClock(); save(); } else startClock();
  });
  window.addEventListener('pagehide', function () { stopClock(); save(); startClock(); });

  // ---- selection + moves ----------------------------------------------------
  function movable(r) { return r > 0 && r < R && r !== st.hint && !st.done; }
  function select(r) {
    if (!movable(r)) return;
    sel = r;
    for (var i = 0; i < R; i++) {
      tracks[i].classList.toggle('is-sel', i === sel && !st.done);
      ringEls[i].classList.toggle('is-sel', i === sel && !st.done);
      if (pickBtns[i]) pickBtns[i].setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    }
  }
  function stepSel(dir) {
    for (var n = 1; n < R; n++) {
      var c = mod(sel - 1 + dir * n, R - 1) + 1;
      if (movable(c)) { select(c); return; }
    }
  }
  function nudge() {
    board.classList.remove('is-nudge'); void board.offsetWidth; board.classList.add('is-nudge');
    if (!muted()) sfx().play('miss');
  }
  // Every 45-degree step a ring passes costs one move, however it was turned (button, key,
  // drag, undo). A drag pays as it goes, so a full spin costs 8 even if it ends where it began.
  function spend(r, n) {
    if (n <= 0) return;
    st.moves += n; st.turns[r] += n;
    if (st.path.slice(-1) !== String(r) && st.path.length < 40) st.path += r;
    startClock();
    hud();
  }
  function commit(r, newOff) {
    st.offs[r] = newOff;
    var c = evaluate(st.offs);
    hud(); save(); syncUndo(); renderMarks();
    if (c === N) solve();
  }
  // Undo history: one entry per button/key step, one per drag gesture (its net turn).
  var undoStack = [];
  function pushUndo(r, net) {
    if (mod(net, N) === 0) return;
    undoStack.push({ r: r, net: net });
    if (undoStack.length > 200) undoStack.shift();
  }
  function rotate(r, dir) {
    if (!movable(r)) { nudge(); return; }
    tgt[r] += dir * STEP;
    kick();
    spend(r, 1);
    if (!muted()) sfx().play('tick');
    pushUndo(r, dir);
    commit(r, mod(st.offs[r] + dir, N));
  }
  function undo() {
    if (st.done || dragging) return;
    var u;
    while ((u = undoStack.pop()) && !movable(u.r)) {}
    if (!u) { syncUndo(); return; }
    var back = mod(-u.net, N); if (back > N / 2) back -= N;
    tgt[u.r] += back * STEP;
    kick();
    spend(u.r, Math.abs(back));
    if (!muted()) sfx().play('tick');
    select(u.r);
    live.textContent = 'Undo: ring ' + (u.r + 1) + ' turned back.';
    commit(u.r, mod(st.offs[u.r] + back, N));
  }
  var undoBtn = $('obUndo');
  function syncUndo() {
    if (!undoBtn) return;
    undoBtn.disabled = st.done || !undoStack.some(function (u) { return movable(u.r); });
  }
  if (undoBtn) undoBtn.addEventListener('click', undo);

  // ---- drag -----------------------------------------------------------------
  function polar(e) {
    var b = board.getBoundingClientRect();
    var x = e.clientX - (b.left + b.width / 2), y = e.clientY - (b.top + b.height / 2);
    return { d: Math.sqrt(x * x + y * y) / b.width, a: Math.atan2(x, -y) * 180 / Math.PI };
  }
  function ringAt(d) {
    var best = -1, bd = 1;
    for (var r = 0; r < R; r++) { var dd = Math.abs(d - RAD[r]); if (dd < bd) { bd = dd; best = r; } }
    return bd <= 0.06 ? best : -1;
  }
  board.addEventListener('pointerdown', function (e) {
    if (st.done || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // A second contact (thumb, palm, another finger) must never silently discard the turn in
    // progress: settle the current drag first, exactly as if that finger had lifted.
    if (dragging && e.pointerId !== dragging.id) { endDrag(); if (st.done) return; }
    var p = polar(e), r = ringAt(p.d);
    if (r < 0) return;
    if (!movable(r)) { nudge(); return; }
    e.preventDefault();
    select(r);
    var s0 = Math.round(ang[r] / STEP);
    dragging = { r: r, id: e.pointerId, lastA: p.a, total: 0, s0: s0, step: s0 };
    tgt[r] = ang[r];
    try { board.setPointerCapture(e.pointerId); } catch (x) {}
    board.classList.add('is-dragging');
    kick();
  });
  board.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragging.id) return;
    var p = polar(e), da = p.a - dragging.lastA;
    if (da > 180) da -= 360; else if (da < -180) da += 360;
    dragging.lastA = p.a;
    dragging.total += Math.abs(da);
    ang[dragging.r] += da; tgt[dragging.r] = ang[dragging.r];
    var step = Math.round(ang[dragging.r] / STEP);
    if (step !== dragging.step) {
      spend(dragging.r, Math.abs(step - dragging.step));
      dragging.step = step;
      var o = st.offs.slice(); o[dragging.r] = mod(step, N);
      var c = evaluate(o, true);
      if (!muted()) sfx().play('tick');
      // All eight lit mid-drag: the orbit locks right here. The win must not wait for the lift
      // (a lift the page never hears about used to leave a lit-but-unsolved board).
      if (c === N) { endDrag(); return; }
    }
    kick();
  });
  // Ends the drag: on its finger's lift/cancel (e given), or forced (no e) by a second contact,
  // a mid-drag solve, the page hiding, or the window losing focus. Always commits the turn.
  function endDrag(e) {
    if (!dragging || (e && e.pointerId !== dragging.id)) return;
    var r = dragging.r, steps = dragging.step, id = dragging.id;
    tgt[r] = steps * STEP;
    pushUndo(r, steps - dragging.s0);
    dragging = null;
    board.classList.remove('is-dragging');
    try { if (board.hasPointerCapture && board.hasPointerCapture(id)) board.releasePointerCapture(id); } catch (x) {}
    kick();
    commit(r, mod(steps, N));
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);
  board.addEventListener('lostpointercapture', endDrag);
  // Safety nets in case the board never hears the lift (capture refused, OS gesture, app switch).
  window.addEventListener('pointerup', endDrag, true);
  window.addEventListener('pointercancel', endDrag, true);
  window.addEventListener('blur', function () { endDrag(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) endDrag(); });

  $('obCw').addEventListener('click', function () { rotate(sel, 1); });
  $('obCcw').addEventListener('click', function () { rotate(sel, -1); });

  // ---- keyboard -------------------------------------------------------------
  function modalOpen() { return !$('obResult').hidden || !$('obHelp').hidden || menuOpen(); }
  document.addEventListener('keydown', function (e) {
    if (menuOpen() && menuKey(e)) return;
    if (e.key === 'Escape') { closeModal($('obResult')); closeModal($('obHelp')); return; }
    if (modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (t && t !== document.body && t !== board && !(t.closest && t.closest('.ob-wrap'))) return;
    var k = e.key, used = true;
    if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'e' || k === 'E') rotate(sel, 1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'q' || k === 'Q') rotate(sel, -1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') stepSel(1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') stepSel(-1);
    else if (k >= '2' && k <= String(R)) select(+k - 1);
    else if (k === 'z' || k === 'Z' || k === 'u' || k === 'U' || k === 'Backspace') undo();
    else used = false;
    if (used) e.preventDefault();
  });

  // ---- hints ----------------------------------------------------------------
  // The Hint button opens a small menu (a bottom sheet on phones) with two once-a-day hints:
  //  🔍 Check rings: shows which moving rings are already in place and moves nothing. 3 stars
  //     stay possible but need 2x par instead of 2.5x par.
  //  🔒 Lock a ring: snaps the ring furthest off into place and locks it; the steps it skips (the
  //     shortest way round) count as moves, so a locked solve never shows fewer moves than par; max 2 stars.
  var hintBtn = $('obHint'), menu = $('obHintMenu'), sheetBg = $('obSheetBg');
  var checkBtn = $('obCheckBtn'), lockBtn = $('obLockBtn');
  function threeStar() { return st.check >= 0 ? THREE_STAR_CHECKED : THREE_STAR; }
  function syncHint() {
    var allUsed = st.hint >= 0 && st.check >= 0;
    hintBtn.hidden = st.done;
    hintBtn.disabled = allUsed;
    hintBtn.textContent = allUsed ? '💡 Hints used' : '💡 Hint';
    if (allUsed || st.done) closeMenu(false);
    checkBtn.disabled = st.check >= 0;
    lockBtn.disabled = st.hint >= 0;
    $('obCheckSub').textContent = st.check >= 0
      ? 'Used · 3★ now needs ' + THREE_STAR_CHECKED + ' moves or fewer'
      : 'See which rings are already in place · 3★ still possible (' + THREE_STAR_CHECKED + ' moves or fewer)';
    $('obLockSub').textContent = st.hint >= 0
      ? 'Used · ring ' + (st.hint + 1) + ' is locked · max 2★'
      : 'Snaps the furthest ring into place · counts its turns · max 2★';
    for (var r = 1; r < R; r++) {
      ringEls[r].classList.toggle('is-locked', r === st.hint);
      if (pickBtns[r]) pickBtns[r].disabled = r === st.hint || st.done;
    }
    renderMarks();
  }
  function menuOpen() { return !menu.hidden; }
  function menuItems() { return [checkBtn, lockBtn].filter(function (b) { return !b.disabled; }); }
  function openMenu() {
    if (st.done || hintBtn.disabled) return;
    syncHint();
    menu.hidden = false; sheetBg.hidden = false;
    hintBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { menu.classList.add('is-open'); sheetBg.classList.add('is-open'); });
    var f = menuItems()[0];
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
  }
  function closeMenu(focusBack) {
    if (menu.hidden) return;
    menu.classList.remove('is-open'); sheetBg.classList.remove('is-open');
    menu.hidden = true; sheetBg.hidden = true;
    hintBtn.setAttribute('aria-expanded', 'false');
    if (focusBack && !hintBtn.hidden && !hintBtn.disabled) try { hintBtn.focus({ preventScroll: true }); } catch (e) {}
  }
  function menuKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return true; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var items = menuItems(), i = items.indexOf(document.activeElement);
      if (items.length) items[mod(i + (e.key === 'ArrowDown' ? 1 : -1), items.length)].focus();
      return true;
    }
    if (e.key === 'Tab') { setTimeout(function () { if (!menu.contains(document.activeElement)) closeMenu(false); }, 0); return true; }
    return true;   // nothing else reaches the board while the menu is open
  }
  hintBtn.addEventListener('click', function () { if (menuOpen()) closeMenu(true); else openMenu(); });
  sheetBg.addEventListener('click', function () { closeMenu(true); });
  document.addEventListener('pointerdown', function (e) {
    if (menuOpen() && !menu.contains(e.target) && !hintBtn.contains(e.target) && e.target !== sheetBg) closeMenu(false);
  });
  checkBtn.addEventListener('click', function () { closeMenu(true); ringCheck(); });
  lockBtn.addEventListener('click', function () { closeMenu(true); lockRing(); });

  // Ring check: one look at which moving rings sit in their solved position right now. A ring's
  // mark stays while the ring is where it was checked (the mark describes that position only).
  function checkMark(r) {
    if (!st.checkOffs || st.done || r === st.hint) return '';
    if (st.offs[r] !== st.checkOffs[r]) return '';
    return st.checkOffs[r] === 0 ? 'ok' : 'no';
  }
  function renderMarks() {
    for (var r = 1; r < R; r++) {
      var m = checkMark(r), b = pickBtns[r];
      if (!b) continue;
      b.classList.toggle('is-ok', m === 'ok');
      b.classList.toggle('is-no', m === 'no');
      b.querySelector('.ob-mark').textContent = m === 'ok' ? '✓' : m === 'no' ? '✗' : '';
      b.setAttribute('aria-label', 'Select ring ' + (r + 1) + (r === R - 1 ? ' (outer)' : '') +
        (m === 'ok' ? ', in place at ring check' : m === 'no' ? ', not in place at ring check' : ''));
    }
  }
  function checkSummary() {
    var ok = [], no = [];
    for (var r = 1; r < R; r++) { if (r === st.hint) continue; (st.checkOffs[r] === 0 ? ok : no).push(r + 1); }
    var list = function (a) { return a.length > 1 ? 'rings ' + a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : 'ring ' + a[0]; };
    var spoken = !ok.length ? 'No rings are in place yet.' :
      list(ok).replace(/^r/, 'R') + (ok.length > 1 ? ' are' : ' is') + ' in place' +
      (no.length ? '; ' + list(no) + (no.length > 1 ? ' are' : ' is') + ' not.' : '.');
    var shown = !ok.length ? 'No rings in place yet' :
      ok.length + ' of ' + (ok.length + no.length) + ' in place: ' + ok.map(function (n) { return 'ring ' + n + ' ✓'; }).join(', ');
    return { spoken: spoken, shown: shown, ok: ok };
  }
  var toast = $('obToast'), toastTimer = 0;
  function showToast(t, ms) {
    toast.textContent = t; toast.hidden = false;
    requestAnimationFrame(function () { toast.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-on');
      setTimeout(function () { if (!toast.classList.contains('is-on')) toast.hidden = true; }, 300);
    }, ms || 4200);
  }
  function ringCheck() {
    if (st.done || st.check >= 0) return;
    st.check = st.moves;
    st.checkOffs = st.offs.slice();
    save(); syncHint(); startClock();
    var sm = checkSummary();
    sm.ok.forEach(function (n) {
      var t = tracks[n - 1];
      t.classList.remove('is-check'); void t.getBoundingClientRect(); t.classList.add('is-check');
      setTimeout(function () { t.classList.remove('is-check'); }, 1800);
    });
    showToast('🔍 ' + sm.shown);
    live.textContent = 'Ring check: ' + sm.spoken;
    if (!muted()) sfx().play(sm.ok.length ? 'correct' : 'tick');
  }
  function lockRing() {
    if (st.done || st.hint >= 0) return;
    var best = -1, bd = -1;
    for (var r = R - 1; r >= 1; r--) { var d = cdist(st.offs[r], 0); if (d > bd) { bd = d; best = r; } }
    if (best < 0 || bd === 0) return;
    var o = st.offs[best];
    tgt[best] += (o <= N / 2 ? -o : N - o) * STEP;
    st.offs[best] = 0;
    st.hint = best;
    // The snap is not free: it costs the turns it skipped, the shortest way round (bd steps).
    spend(best, bd);
    if (sel === best) stepSel(1);
    syncHint(); syncUndo(); kick(); startClock();
    var c = evaluate(st.offs);
    hud(); save();
    showToast('🔒 Ring ' + (best + 1) + ' locked in place · +' + bd + (bd === 1 ? ' move' : ' moves'), 3000);
    live.textContent = 'Hint: ring ' + (best + 1) + ' is locked in place. That counts ' + bd + (bd === 1 ? ' move.' : ' moves.');
    if (c === N) solve();
  }

  // ---- solve ----------------------------------------------------------------
  function starsFor() {
    var s = st.moves <= threeStar() ? 3 : st.moves <= TWO_STAR ? 2 : 1;
    if (st.hint >= 0) s = Math.min(s, 2);
    return s;
  }
  function fx() {
    var fxEl = $('obFx');
    fxEl.innerHTML = '';
    for (var w = 0; w < 3; w++) {
      var wave = document.createElement('div');
      wave.className = 'ob-wave';
      wave.style.animationDelay = (w * 0.16) + 's';
      fxEl.appendChild(wave);
    }
    var half = size / 2;
    for (var i = 0; i < 28; i++) {
      var sp = document.createElement('div');
      sp.className = 'ob-spark';
      var a = Math.random() * Math.PI * 2, dist = half * (0.55 + Math.random() * 0.5);
      sp.style.setProperty('--dx', (Math.sin(a) * dist).toFixed(1) + 'px');
      sp.style.setProperty('--dy', (-Math.cos(a) * dist).toFixed(1) + 'px');
      sp.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
      fxEl.appendChild(sp);
    }
    setTimeout(function () { fxEl.innerHTML = ''; }, 1800);
    beams.forEach(function (b, k) {
      setTimeout(function () { b.classList.add('is-peek'); setTimeout(function () { b.classList.remove('is-peek'); }, 380); }, k * 70);
    });
  }
  function recordStats() {
    if (PRACTICE) return;
    var s = jget(STATS_KEY) || { played: 0, streak: 0, best: 0, last: 0, stars: [0, 0, 0] };
    if (s.last === num) return;
    s.played++;
    s.streak = s.last === num - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best || 0, s.streak);
    s.last = num;
    s.stars = s.stars || [0, 0, 0];
    s.stars[st.stars - 1]++;
    jset(STATS_KEY, s);
    try { if (window.CGPlayer && window.CGPlayer.record) window.CGPlayer.record('orbit', { daily: true }); } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', 'orbit_solve', { puzzle: num, moves: st.moves, par: PAR, stars: st.stars, hint: st.hint >= 0 ? 1 : 0, check: st.check >= 0 ? 1 : 0 }); } catch (e) {}
  }
  function lockBoard() {
    board.classList.add('is-solved');
    for (var i = 0; i < R; i++) { tracks[i].classList.remove('is-sel'); ringEls[i].classList.remove('is-sel'); }
    syncHint(); syncUndo();
  }
  // Order matters: state + the way forward first, effects last, each effect fenced, so a failing
  // sound/vibration/animation/stat call can never leave a solved board without its result.
  function safely(f) { try { f(); } catch (e) { if (window.console) console.warn('orbit:', e); } }
  function solve() {
    if (st.done) return;
    stopClock();
    st.done = true;
    st.stars = starsFor();
    save();
    setTimeout(function () { safely(openResult); syncSolvedBar(); }, 1250);
    safely(recordStats);
    safely(hud);
    safely(lockBoard);
    safely(syncSolvedBar);
    safely(fx);
    safely(function () { if (!muted()) sfx().softWin(); });
    safely(function () { if (sfx()) sfx().haptic(30); });
    live.textContent = 'Orbit locked! All ' + N + ' spokes are words.';
  }
  // Inline "Solved" bar under the board (it replaces the turn controls): shown whenever the orbit is
  // solved, so even with the result modal closed, tapped away or failed, a solved board is never a
  // dead end.
  var solvedBar = $('obSolved');
  function syncSolvedBar() {
    if (!solvedBar) return;
    var show = st.done;
    if (show) {
      $('obSolvedStars').textContent = '★★★'.slice(0, st.stars) + '☆☆☆'.slice(0, 3 - st.stars);
      $('obSolvedStars').setAttribute('aria-label', st.stars + ' of 3 stars');
      $('obSolvedMoves').textContent = st.moves + ' moves · par ' + PAR;
      var nx = $('obSolvedNext');
      nx.hidden = PRACTICE;
      $('obSolvedPractice').textContent = PRACTICE ? 'New practice orbit' : 'Practice orbit';
      if (!PRACTICE) {
        var g = null;
        // same pick as the result card's "Up next" (daily-kit), so both point at the same game
        try { g = window.CGDaily && window.CGDaily.upNextModel ? window.CGDaily.upNextModel('orbit').next : null; } catch (e) { g = null; }
        nx.href = g ? g.href : '/games/daily';
        nx.textContent = g ? 'Next daily: ' + g.name + ' →' : 'All dailies →';
      }
    }
    solvedBar.hidden = !show;
    document.body.classList.toggle('ob-is-solved', show);
  }

  // ---- modals ---------------------------------------------------------------
  var lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.openedAt = Date.now();
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('is-open'); });
    var f = m.querySelector('.ob-btn--primary') || m.querySelector('button');
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
  }
  function closeModal(m) {
    if (m.hidden) return;
    m.classList.remove('is-open');
    m.hidden = true;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    if (m.id === 'obResult') syncSolvedBar();
  }
  [$('obResult'), $('obHelp')].forEach(function (m) {
    m.addEventListener('click', function (e) {
      // A backdrop tap in the first 700 ms is a finger still finishing its turn, not a dismiss.
      if (e.target === m && Date.now() - (m.openedAt || 0) < 700) return;
      if (e.target === m || (e.target.closest && e.target.closest('[data-close]'))) closeModal(m);
    });
  });
  $('obHelpBtn').addEventListener('click', function () { openModal($('obHelp')); });
  $('obSolvedRes').addEventListener('click', openResult);

  function starStr(n) { var s = ''; for (var i = 0; i < 3; i++) s += i < n ? '⭐' : '☆'; return s; }
  // Spoiler-free share, Wordle-style: a 10-cell efficiency bar (par / moves, coloured by stars),
  // then the route (the order the rings were worked on) and a time bucket. Two solvers rarely match
  // on route and time. Nothing per ring is shown: no turn counts, letters, words or directions.
  var CIRC = ['①', '②', '③', '④'];
  function timeBucket(sec) { return sec < 60 ? '⚡' : sec < 120 ? '🚀' : sec < 300 ? '⏱️' : '🐢'; }
  function routeLine() {
    if (!st.path) return '';
    var steps = st.path.split('').map(function (d) { return CIRC[+d]; });
    return 'Route ' + (steps.length > 8 ? steps.slice(0, 8).join('') + '…' : steps.join(''));
  }
  function shareBits() {
    var cell = st.stars === 3 ? '🟩' : st.stars === 2 ? '🟨' : '🟧';
    var fill = Math.max(1, Math.min(10, Math.round(10 * PAR / Math.max(st.moves, 1))));
    var bar = new Array(fill + 1).join(cell) + new Array(11 - fill).join('⬛');
    var eff = Math.min(100, Math.round(100 * PAR / Math.max(st.moves, 1)));
    return { eff: eff, bar: bar, route: routeLine(), time: timeBucket(st.elapsed) + ' ' + fmtT(st.elapsed) };
  }
  function openResult() {
    var s = jget(STATS_KEY) || {};
    $('obResNum').textContent = PRACTICE ? 'Practice orbit #' + num : 'Orbit #' + num;
    $('obResTitle').textContent = st.stars === 3 ? 'Perfect orbit!' : 'Orbit locked!';
    var stars = '';
    for (var i = 0; i < 3; i++) stars += '<span class="' + (i < st.stars ? 'on' : 'off') + '">★</span>';
    $('obResStars').innerHTML = stars;
    $('obResStars').setAttribute('aria-label', st.stars + ' of 3 stars');
    $('obResWords').innerHTML = WORDS.map(function (w) { return '<span>' + w + '</span>'; }).join('');
    $('obResMoves').textContent = st.moves;
    $('obResPar').textContent = PAR;
    $('obResTime').textContent = fmtT(st.elapsed);
    $('obResStreak').textContent = PRACTICE ? '–' : (s.streak || 0);
    var lim = threeStar();
    var note = st.moves <= PAR ? 'Solved at par. Flawless.' :
      st.stars === 3 ? 'Within ' + lim + ' moves: 3 stars' + (st.check >= 0 ? ', even with a ring check.' : '.') :
      st.hint >= 0 ? 'Ring locked, so 2 stars max.' :
      st.check >= 0 ? 'After a ring check, 3 stars need ' + lim + ' moves or fewer.' :
      'Finish within ' + lim + ' moves for 3 stars.';
    $('obResNote').textContent = note;
    var hu = [];
    if (st.check >= 0) hu.push('🔍 Ring check used');
    if (st.hint >= 0) hu.push('💡 Ring ' + (st.hint + 1) + ' locked');
    $('obResHints').textContent = hu.join(' · ');
    $('obShare').hidden = PRACTICE;
    $('obResNext').hidden = PRACTICE;
    $('obNewPractice').hidden = !PRACTICE;
    openModal($('obResult'));
  }

  var shareBtn = $('obShare'), shareTimer = 0;
  function sayShare(t) { shareBtn.textContent = t; clearTimeout(shareTimer); shareTimer = setTimeout(function () { shareBtn.textContent = 'Share'; }, 2000); }
  // Hints used, for the share card: 🔍 = ring check, 💡 = ring locked.
  function hintMarks() { return (st.check >= 0 ? ' 🔍' : '') + (st.hint >= 0 ? ' 💡' : ''); }
  function hintWords() {
    var h = [];
    if (st.check >= 0) h.push('🔍 ring check');
    if (st.hint >= 0) h.push('💡 ring lock');
    return h.length ? ' · ' + h.join(' · ') : '';
  }
  function shareFull() {
    var b = shareBits();
    var line = st.moves + ' moves (par ' + PAR + ') · ' + b.eff + '% · ' + b.time;
    return '🪐 Orbit #' + num + ' ' + starStr(st.stars) + hintMarks() + '\n' + line + '\n' + b.bar + (b.route ? '\n' + b.route : '') + '\n\ncosmicgameshub.com/games/orbit';
  }
  function shareOpts() {
    var b = shareBits();
    return {
      title: 'Orbit',
      subtitle: '#' + num + '  ·  ' + st.stars + '/3 stars' + hintMarks(),
      grid: starStr(st.stars) + '\n' + b.bar,
      lines: [st.moves + ' moves · par ' + PAR + ' · ' + b.eff + '% efficient', b.route, 'Solved in ' + b.time + hintWords()].filter(Boolean),
      url: 'cosmicgameshub.com/games/orbit',
      filename: 'orbit-' + num,
      text: shareFull()
    };
  }
  shareBtn.addEventListener('click', function () {
    var opts = shareOpts(), text = opts.text;
    if (sfx() && typeof sfx().shareNow === 'function') {
      Promise.resolve(sfx().shareNow(opts)).then(function (r) {
        if (!r) return;
        if (r.via === 'native') sayShare('Shared');
        else if (r.via === 'cancel') return;
        else if (r.via === 'copy') {
          if (r.copied) sayShare(r.card ? 'Copied + card' : 'Copied');
          else if (r.card) sayShare('🖼️ Card saved');
        } else sayShare('🖼️ Card saved');
      }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { sayShare('Copied'); }, function () {});
    }
  });

  // ---- init -----------------------------------------------------------------
  var practiceHref = location.pathname + '?practice=1';
  $('obNewPractice').href = practiceHref;
  $('obResPractice').href = practiceHref;
  $('obSolvedPractice').href = practiceHref;
  var pl = $('obPracticeLink');
  if (PRACTICE) {
    pl.textContent = "Today's orbit";
    pl.href = location.pathname;
    $('obResPractice').hidden = true;
    $('obSub').innerHTML = 'Practice · <b>#' + num + '</b>';
  } else {
    pl.href = practiceHref;
    $('obSub').innerHTML = 'Daily word rings · <b>#' + num + '</b> · ' + WEEKDAY;
    $('obSub').title = 'Puzzles ramp up through the week: gentlest Monday, toughest Saturday';
  }
  if (st.done) { st.offs = START.map(function () { return 0; }); for (var r4 = 0; r4 < R; r4++) { ang[r4] = tgt[r4] = mod(ang[r4], 360); ang[r4] = tgt[r4] = Math.round(ang[r4] / 360) * 360; } }
  (function applyArt() {
    if (ART.backdrop) { document.body.style.setProperty('--ob-art-backdrop', 'url("' + ART.backdrop + '")'); document.body.classList.add('ob-has-backdrop'); }
    if (ART.core) { $('obCore').style.setProperty('--ob-art-core', 'url("' + ART.core + '")'); $('obCore').classList.add('ob-core--art'); }
    if (ART.rings) {
      var img = document.createElement('img');
      img.className = 'ob-art-rings'; img.alt = ''; img.src = ART.rings; img.decoding = 'async';
      board.insertBefore(img, ringsEl);
    }
  })();
  layout();
  if (window.ResizeObserver) new ResizeObserver(layout).observe(board);
  else window.addEventListener('resize', layout);
  evaluate(st.offs, true);
  select(st.hint === 1 ? 2 : 1);
  syncHint(); syncUndo(); hud();
  if (st.done) { lockBoard(); syncSolvedBar(); }
  window.addEventListener('load', syncSolvedBar);   // daily-kit (deferred) is ready by now: fill in Next daily
  if (!st.done && !localStorage.getItem(HELP_KEY)) {
    try { localStorage.setItem(HELP_KEY, '1'); } catch (e) {}
    setTimeout(function () { openModal($('obHelp')); }, 350);
  }
  // Read-only hook for QA scripts.
  window.OrbitGame = {
    info: function () { return { num: num, practice: PRACTICE, index: pIndex, weekday: PRACTICE ? null : WEEKDAY, par: PAR, offs: st.offs.slice(), moves: st.moves, done: st.done, stars: st.stars, lit: lit.filter(Boolean).length, sel: sel, hint: st.hint, check: st.check, checkOffs: st.checkOffs && st.checkOffs.slice(), marks: [1, 2, 3].map(checkMark), threeStar: threeStar(), menu: menuOpen(), turns: st.turns.slice(), path: st.path, undo: undoStack.length }; },
    shareText: function () { var b = shareBits(); return b.bar + (b.route ? '\n' + b.route : ''); },
    shareFull: shareFull,
    shareOpts: shareOpts,
    dragging: function () { return !!dragging; }
  };
})();
