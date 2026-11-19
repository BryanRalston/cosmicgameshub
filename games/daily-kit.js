/* Shared daily-set helpers. Keep hamburger ids. Pixle is a Wordle. */
(function (w) {
  'use strict';

  var ORDER = [
    { id: 'gamerdle', name: 'Gamerdle', href: '/games/gamerdle', icon: '🎮', mins: 2 },
    { id: 'pixle', name: 'Pixle', href: '/games/pixle', icon: '🟩', mins: 2 },
    { id: 'rift', name: 'RIFT', href: '/games/rift', icon: '🌀', mins: 3 },
    { id: 'hardware-timeline', name: 'Hardware Timeline', href: '/games/hardware-timeline', icon: '📅', mins: 2 },
    { id: 'spec-match', name: 'Spec Match', href: '/games/spec-match', icon: '🔍', mins: 2 },
    { id: 'gear-quiz', name: 'Gear Quiz', href: '/games/gear-quiz', icon: '🎧', mins: 3 },
    { id: 'gaming-trivia', name: 'Gaming Trivia', href: '/games/gaming-trivia', icon: '🧠', mins: 3 },
    { id: 'link', name: 'Link', href: '/games/link', icon: '🟨', mins: 3 },
    { id: 'crossword', name: 'Crossword', href: '/games/crossword', icon: '✏️', mins: 3 },
    { id: 'sudoku', name: 'Sudoku', href: '/games/sudoku', icon: '🔢', mins: 5 },
    { id: 'price-guesser', name: 'Price Guesser', href: '/games/price-guesser', icon: '💰', mins: 2 },
    { id: 'daily-challenge', name: 'Pro Kit Daily', href: '/games/daily-challenge', icon: '⭐', mins: 2 }
  ];

  function now() { return new Date(); }
  function isoToday() { return now().toISOString().slice(0, 10); }
  function ymdLocal() {
    var n = now();
    return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
  }
  function dayOfYear() {
    var n = now();
    return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000);
  }
  function dayIndex2026() {
    return Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000);
  }
  function unixDay() { return Math.floor(Date.now() / 86400000); }
  function safeJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function safeInt(key, fb) {
    var v = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(v) ? v : (fb || 0);
  }

  function playedMap() {
    var ymd = ymdLocal();
    var iso = isoToday();
    var yest = new Date(); yest.setDate(yest.getDate() - 1);
    var map = {};
    try {
      var gs = safeJSON('gamerdle-stats') || {};
      var gd = gs.history && gs.history['d' + dayIndex2026()];
      map.gamerdle = !!(gd && gd.done);
    } catch (e) { map.gamerdle = false; }
    try {
      var ts = safeJSON('trivia-stats') || {};
      map['gaming-trivia'] = !!(ts.history && ts.history[ymd]);
    } catch (e) { map['gaming-trivia'] = false; }
    map['hardware-timeline'] = localStorage.getItem('ht_last_date') === iso;
    map['gear-quiz'] = localStorage.getItem('gq_last_date') === iso;
    map['spec-match'] = localStorage.getItem('sm_last_date') === iso;
    try {
      var ps = safeJSON('pixle-state-v1') || {};
      map.pixle = ps.dayIndex === dayIndex2026() && (ps.status === 'won' || ps.status === 'lost');
    } catch (e) { map.pixle = false; }
    map.sudoku = (function () {
      var n = now();
      var mm = n.getMonth() + 1;
      var dd = n.getDate();
      var padded = n.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
      var loose = n.getFullYear() + '-' + mm + '-' + dd;
      return localStorage.getItem('sdk_solved_' + padded) === '1' || localStorage.getItem('sdk_solved_' + loose) === '1';
    })();
    map.crossword = (function () {
      try {
        var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        var y = '', m = '', d = '';
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].type === 'year') y = parts[i].value;
          else if (parts[i].type === 'month') m = parts[i].value;
          else if (parts[i].type === 'day') d = parts[i].value;
        }
        return localStorage.getItem('cw_last_date') === y + '-' + m + '-' + d;
      } catch (e) { return false; }
    })();
    map['price-guesser'] = safeInt('pg_last_day', -1) === dayOfYear();
    try {
      var ls = safeJSON('link-state-v1') || {};
      map.link = ls.day === dayIndex2026() && (ls.status === 'won' || ls.status === 'lost');
    } catch (e) { map.link = false; }
    try {
      var rs = safeJSON('rift_state_' + dayIndex2026());
      if (!rs) rs = safeJSON('rift_state_' + dayOfYear());
      map.rift = !!(rs && (rs.zone >= 3 || rs.chainDone && rs.growDone && rs.decodeDone));
    } catch (e) { map.rift = false; }
    try {
      var hist = safeJSON('cgx-dc-history') || [];
      map['daily-challenge'] = Array.isArray(hist) && hist.some(function (h) { return h && (h.date === iso || h.date === ymd); });
    } catch (e) { map['daily-challenge'] = false; }
    return map;
  }

  function nextUnplayed(fromId) {
    var m = playedMap();
    var i = 0;
    for (var k = 0; k < ORDER.length; k++) if (ORDER[k].id === fromId) i = k;
    for (var n = 1; n <= ORDER.length; n++) {
      var g = ORDER[(i + n) % ORDER.length];
      if (!m[g.id]) return g;
    }
    return null;
  }

  function msToUtcMidnight() {
    var n = now();
    return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime();
  }

  function fmtCd(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject();
  }

  function absUrl(url) {
    if (!url) return 'https://www.cosmicgameshub.com';
    if (url.indexOf('http') === 0) return url;
    return 'https://' + String(url).replace(/^\/\//, '');
  }

  // Native share payload: phone sheets join text + url, so never send url when
  // text already carries the site link (or can carry it); keeps one URL.
  function nativePayload(title, text, url) {
    var p = { title: title || 'CosmicGamesHub' };
    if (!text) { p.url = url; return p; }
    p.text = text.indexOf('cosmicgameshub.com') === -1
      ? text.replace(/\s+$/, '') + '\n' + url.replace(/^https?:\/\//, '')
      : text;
    return p;
  }

  function shareResult(opts) {
    opts = typeof opts === 'string' ? { text: opts } : (opts || {});
    var text = opts.text || '';
    var url = absUrl(opts.url);
    if (text && text.indexOf('cosmicgameshub.com') === -1) {
      text = text.replace(/\s+$/, '') + '\n' + url.replace(/^https?:\/\//, '');
    }
    // Optional opts.onResult(kind): 'shared' (native sheet), 'cancelled', 'copied' (clipboard write
    // succeeded) or 'saved' (image card only). Callers that ignore it behave exactly as before.
    function told(kind) { try { if (typeof opts.onResult === 'function') opts.onResult(kind); } catch (e) {} }
    function fallback() {
      if (w.CGSfx && w.CGSfx.shareNow && !w.CGSfx.__phoneShare) {
        var wrote = copyText(text).then(function () { return true; }, function () { return false; });
        var card = w.CGSfx.shareNow(Object.assign({}, opts, { text: text, url: url }));
        return Promise.all([wrote, card]).then(function (r) { told(r[0] ? 'copied' : 'saved'); return r[1]; });
      }
      return copyText(text).then(function (r) { told('copied'); return r; });
    }
    if (navigator.share) {
      return navigator.share(nativePayload(opts.title, text, url)).then(function (r) {
        told('shared');
        return r;
      }, function (err) {
        if (err && err.name === 'AbortError') { told('cancelled'); return null; }
        return fallback();
      });
    }
    return fallback();
  }

  function ensureViewportFit() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    var c = meta.getAttribute('content') || '';
    if (!/viewport-fit\s*=\s*cover/i.test(c)) {
      meta.setAttribute('content', c.replace(/\s*$/, '') + ', viewport-fit=cover');
    }
  }

  function patchShareNow() {
    if (!w.CGSfx || typeof w.CGSfx.shareNow !== 'function' || w.CGSfx.__phoneShare) return;
    var orig = w.CGSfx.shareNow.bind(w.CGSfx);
    w.CGSfx.shareNow = function (opts) {
      opts = opts || {};
      var text = opts.text || '';
      var url = absUrl(opts.url);
      // Resolves {via:'native'} on a native share, {via:'cancel'} when the user
      // dismisses the sheet, or {via:'copy', copied, card} on the copy+card path.
      function viaCopy() {
        var copied = (text && navigator.clipboard && navigator.clipboard.writeText)
          ? navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; })
          : Promise.resolve(false);
        var card = Promise.resolve().then(function () { return orig(opts); }).catch(function () { return null; });
        return Promise.all([copied, card]).then(function (r) { return { via: 'copy', copied: r[0], card: r[1] }; });
      }
      if (navigator.share) {
        return navigator.share(nativePayload(opts.title, text, url)).then(function () {
          return { via: 'native' };
        }, function (err) {
          if (err && err.name === 'AbortError') return { via: 'cancel' };
          return viaCopy();
        });
      }
      return viaCopy();
    };
    w.CGSfx.__phoneShare = true;
  }

  function leftover() {
    var m = playedMap();
    return ORDER.filter(function (g) { return !m[g.id]; });
  }

  function readGameStreak(source) {
    if (source === 'rift') {
      var rm = safeJSON('rift_meta') || {};
      return +rm.streak || 0;
    }
    if (source === 'gamerdle') {
      var gs = safeJSON('gamerdle-stats') || {};
      return +gs.streak || 0;
    }
    if (source === 'pixle') {
      var ps = safeJSON('pixle-stats-v1') || {};
      return +ps.streak || 0;
    }
    if (source === 'holiday-rush') {
      var hm = safeJSON('hr_meta_v1') || {};
      return +hm.streak || 0;
    }
    if (w.CGPlayer && typeof w.CGPlayer.snapshot === 'function') {
      return +w.CGPlayer.snapshot().streak || 0;
    }
    return 0;
  }

  function streakLabel(source) {
    var streak = readGameStreak(source);
    return streak > 0
      ? '🔥 Streak ' + streak + ' ' + (streak === 1 ? 'day' : 'days')
      : '🔥 Streak starts today';
  }

  function fillStreakHint(el) {
    if (!el) return;
    var source = el.getAttribute('data-streak-source') || '';
    el.innerHTML =
      '<div class="result-loop__streak" data-streak-label>' + streakLabel(source) + '</div>' +
      '<div class="result-loop__hint">Come back tomorrow. Next UTC puzzle in <span class="result-loop__cd" data-cd></span></div>';
  }

  function mountStreakHints() {
    document.querySelectorAll('[data-cg-streak-hint]').forEach(function (el) {
      var source = el.getAttribute('data-streak-source') || '';
      if (!el.getAttribute('data-cg-streak-ready')) {
        el.setAttribute('data-cg-streak-ready', '1');
        if (!el.classList.contains('result-loop')) el.classList.add('result-loop');
        fillStreakHint(el);
        return;
      }
      var lab = el.querySelector('[data-streak-label]');
      var next = streakLabel(source);
      if (lab && lab.textContent !== next) lab.textContent = next;
    });
  }

  function playedCount() {
    return ORDER.length - leftover().length;
  }


  // ---- "Up next" (end-of-game CTA + homepage "Today's puzzles") -------------
  var ARCADE = [
    { name: 'Aim Trainer', href: '/games/aim-trainer' },
    { name: 'Minesweeper', href: '/games/minesweeper' },
    { name: 'Memory Match', href: '/games/memory-match' },
    { name: 'Reaction Time', href: '/games/reaction-trainer' },
    { name: 'Word Scramble', href: '/games/word-scramble' },
    { name: 'Color Memory', href: '/games/color-memory' }
  ];

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Overall daily streak (any daily counts). CGPlayer is loaded lazily, so 0 can mean "not ready".
  function dailyStreak() {
    try { return (w.CGPlayer && w.CGPlayer.snapshot) ? (+w.CGPlayer.snapshot().streak || 0) : 0; } catch (e) { return 0; }
  }

  // Rollover is UTC midnight: 7 PM EST / 8 PM EDT. Say the real ET hour.
  function resetLabel() {
    try {
      var n = now();
      var t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: true })
        .format(t).replace(/[\u202f\u00a0]/g, ' ') + ' ET';
    } catch (e) { return 'midnight UTC'; }
  }

  function arcadePick() { return ARCADE[dayIndex2026() % ARCADE.length]; }

  function gameById(id) {
    for (var i = 0; i < ORDER.length; i++) if (ORDER[i].id === id) return ORDER[i];
    return null;
  }

  function fmtMins(g) { return (g && g.mins ? g.mins : 2) + ' min'; }

  function trackNext(where, to) {
    try { if (typeof w.gtag === 'function') w.gtag('event', 'up_next_click', { where: where, to: to }); } catch (e) {}
  }

  function bindTrack(root, where) {
    var a = root.querySelectorAll('[data-up-next]');
    for (var i = 0; i < a.length; i++) {
      a[i].addEventListener('click', function () { trackNext(where, this.getAttribute('data-up-next')); });
    }
  }

  // One model for both surfaces. exclude = the game just finished (skipped as a target).
  function upNextModel(exclude) {
    var m = playedMap();
    var left = ORDER.filter(function (g) { return !m[g.id] && g.id !== exclude; });
    var done = ORDER.filter(function (g) { return m[g.id]; }).length;
    return { map: m, next: left[0] || null, left: left.length, done: done, total: ORDER.length, streak: dailyStreak() };
  }

  function streakChip(n) {
    return n > 0 ? '🔥 Streak ' + n + (n === 1 ? ' day' : ' days') : '';
  }

  function dockCardHtml(slug) {
    var u = upNextModel(slug);
    if (!u.map[slug]) return null; // current game not finished: keep the small dock
    // Gamerdle shows its own streak (matches the streak line above); other games keep the overall daily streak.
    if (slug === 'gamerdle') u.streak = readGameStreak('gamerdle');
    var sc = streakChip(u.streak);
    if (u.next) {
      return '<div class="cg-next" role="region" aria-label="Up next">' +
        '<div class="cg-next__eyebrow">Up next · ' + u.done + ' of ' + u.total + ' done today</div>' +
        '<a class="cg-dock__next cg-next__cta" data-up-next="' + u.next.id + '" href="' + u.next.href + '">Next: Today\'s ' + esc(u.next.name) + ' <span class="cg-next__m">· ' + fmtMins(u.next) + ' →</span></a>' +
        '<div class="cg-next__sub">' + (sc ? sc + ' · ' : '') + u.left + ' still open</div>' +
        '</div>';
    }
    var ar = arcadePick();
    return '<div class="cg-next cg-next--done" role="region" aria-label="Up next">' +
      '<div class="cg-next__title">All done today!' + (u.streak > 0 ? ' Streak ' + u.streak + ' 🔥' : '') + '</div>' +
      '<div class="cg-next__sub">Back tomorrow at ' + resetLabel() + ' · <span data-cd></span></div>' +
      '<a class="cg-dock__next cg-next__cta" data-up-next="arcade:' + ar.href.split('/').pop() + '" href="' + ar.href + '">Play ' + esc(ar.name) + ' while you wait →</a>' +
      '</div>';
  }

  function mountToday(el) {
    if (!el) return;
    var u = upNextModel('');
    var sc = streakChip(u.streak);
    var html = '<div class="hub-today__head"><h2>Today\'s puzzles</h2>' +
      '<div class="hub-today__stats"><span>' + u.done + '/' + u.total + '</span>' +
      (u.streak > 0 ? '<span class="hub-today__streak" title="' + esc(sc) + '" aria-label="' + esc(sc.replace('🔥 ', '')) + '">🔥 ' + u.streak + '</span>' : '') + '</div></div>';
    if (u.next) {
      html += '<a class="hub-today__cta" data-up-next="' + u.next.id + '" href="' + u.next.href + '">' +
        (u.done ? 'Next: ' : 'Play ') + esc(u.next.name) + ' · ' + fmtMins(u.next) + ' <span aria-hidden="true">→</span></a>';
    } else {
      var ar = arcadePick();
      html += '<div class="hub-today__alldone">All done today! Back tomorrow at ' + resetLabel() + '</div>' +
        '<a class="hub-today__cta" data-up-next="arcade:' + ar.href.split('/').pop() + '" href="' + ar.href + '">Play ' + esc(ar.name) + ' <span aria-hidden="true">→</span></a>';
    }
    html += '<div class="hub-today__grid">';
    ORDER.forEach(function (g) {
      var p = !!u.map[g.id];
      html += '<a class="hub-today__tile' + (p ? ' is-done' : '') + '" href="' + g.href + '" data-up-next="' + g.id + '">' +
        '<span class="hub-today__ico" aria-hidden="true">' + g.icon + '</span>' +
        '<span class="hub-today__name">' + esc(g.name) + '<small>' + (p ? 'Played today' : fmtMins(g)) + '</small></span>' +
        '<span class="hub-today__chk" role="img" aria-label="' + (p ? 'Played' : 'Not played yet') + '">' + (p ? '✓' : '') + '</span></a>';
    });
    html += '</div>';
    el.innerHTML = html;
    bindTrack(el, 'home');
  }

  // Re-render the CTA surfaces whenever a game flips to finished (or the streak changes).
  var lastSig = '';
  function refreshNext(force) {
    var sig;
    try { sig = JSON.stringify(playedMap()) + '|' + dailyStreak() + '|' + hostSig(); } catch (e) { return; }
    if (!force && sig === lastSig) return;
    lastSig = sig;
    document.querySelectorAll('.cg-daily-dock').forEach(mountDock);
    document.querySelectorAll('[data-cg-today]').forEach(mountToday);
    tickCountdowns();
  }

  // Some pages have two docks for one game (one by the share button, one at the page bottom).
  // The Up next card goes in only one: the first dock that is on screen, else the first dock.
  function dockHost(slug) {
    var all = document.querySelectorAll('.cg-daily-dock[data-slug="' + slug + '"]');
    for (var i = 0; i < all.length; i++) if (all[i].getClientRects().length) return all[i];
    return all[0] || null;
  }

  function hostSig() {
    var all = document.querySelectorAll('.cg-daily-dock'), out = '';
    for (var i = 0; i < all.length; i++) out += all[i].getClientRects().length ? '1' : '0';
    return out;
  }

  function mountDock(el) {
    if (!el) return;
    var slug = el.getAttribute('data-slug') || '';
    var next = nextUnplayed(slug);
    var left = leftover().length;
    var isHost = dockHost(slug) === el;
    var card = isHost ? dockCardHtml(slug) : null;
    var played = !!playedMap()[slug];
    var html = '<div class="cg-dock">';
    if (card) {
      html += card;
    } else if (played && !isHost) {
      // Finished game, card lives in the other dock: no second CTA here.
    } else if (next) {
      html += '<a class="cg-dock__next" href="' + next.href + '">Play next daily — ' + next.name + ' →</a>';
      html += '<div class="cg-dock__left">' + left + ' of 12 still open today</div>';
    } else {
      html += '<div class="cg-dock__done">Set complete. Next UTC day in <span data-cd></span></div>';
    }
    html += '<a class="cg-dock__all" href="/games/daily">Today\'s 12 →</a>';
    html += '<button type="button" class="cg-dock__mute" data-cg-mute></button>';
    html += '</div>';
    el.innerHTML = html;
    bindTrack(el, 'dock');
    var mb = el.querySelector('[data-cg-mute]');
    function sudokuSoundOn() {
      try {
        var raw = JSON.parse(localStorage.getItem('sdk_settings') || 'null');
        return !!(raw && raw.sound);
      } catch (e) { return false; }
    }
    function syncMute() {
      if (!mb) return;
      if (slug === 'sudoku') {
        var gameOn = sudokuSoundOn();
        mb.textContent = gameOn ? 'Sound on' : 'Sound off';
        mb.setAttribute('aria-pressed', gameOn ? 'true' : 'false');
        return;
      }
      var on = !(w.CGSfx && w.CGSfx.isMuted());
      mb.textContent = on ? 'Sound on' : 'Muted';
    }
    syncMute();
    if (mb) mb.addEventListener('click', function () {
      if (slug === 'sudoku') {
        var next = !sudokuSoundOn();
        if (typeof w.sdkSetSound === 'function') w.sdkSetSound(next);
        else {
          try {
            var raw = JSON.parse(localStorage.getItem('sdk_settings') || '{}') || {};
            raw.sound = next;
            localStorage.setItem('sdk_settings', JSON.stringify(raw));
          } catch (e) {}
        }
        syncMute();
        return;
      }
      if (!w.CGSfx) return;
      w.CGSfx.setMuted(!w.CGSfx.isMuted());
      syncMute();
    });
  }

  function injectStyles() {
    if (document.getElementById('cg-daily-kit-css')) return;
    var s = document.createElement('style');
    s.id = 'cg-daily-kit-css';
    s.textContent = [
      '.cg-dock{margin-top:1rem;padding-top:1rem;padding-bottom:max(0.35rem,env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:.55rem;}',
      '.cg-dock__next{display:flex;align-items:center;justify-content:center;text-align:center;background:var(--accent,#00d4ff);color:#06060a;font-weight:800;padding:.75rem 1rem;border-radius:10px;text-decoration:none;min-height:44px;line-height:1.2;box-sizing:border-box;}',
      '.cg-dock__next:hover{text-decoration:none;opacity:.92;}',
      '.cg-dock__all{text-align:center;font-size:.82rem;font-weight:700;color:var(--accent,#00d4ff);min-height:44px;display:flex;align-items:center;justify-content:center;}',
      '.cg-dock__done{text-align:center;color:var(--text-mid,#aaa);font-size:.9rem;}',
      '.cg-dock__left{text-align:center;font-size:.8rem;color:var(--text-mid,#aaa);}',
      '.cg-dock__mute{margin:0 auto;min-height:44px;padding:.35rem .8rem;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:var(--text-mid,#aaa);font:inherit;cursor:pointer;}',
      '.cg-next{display:flex;flex-direction:column;gap:.45rem;padding:.8rem .85rem;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);box-sizing:border-box;min-width:0;}',
      '.cg-next__eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent,#00d4ff);text-align:center;}',
      '.cg-next__title{font-size:1.1rem;font-weight:800;text-align:center;color:var(--text-hi,#fff);}',
      '.cg-next__sub{font-size:.82rem;text-align:center;color:var(--text-mid,#aaa);overflow-wrap:anywhere;}',
      '.cg-next__cta{white-space:normal;overflow-wrap:anywhere;}',
      '.cg-next__m{white-space:nowrap;margin-left:.3em;}',
      'html{overflow-x:clip;}',
      '@media (max-width:480px){',
      'body{padding-bottom:max(0.5rem,env(safe-area-inset-bottom,0px));}',
      '.breadcrumb{display:none;}',
      'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]),select,textarea{font-size:16px!important;}',
      '.kb-key{height:44px;min-height:44px;box-sizing:border-box;}',
      '.share-btn,.sc-share-btn,.cw-share-btn,.lk-btn,.pg-share-btn,.pg-submit,.pg-play-again,.pg-next-btn,.gq-btn,.sm-btn,.ht-btn,.btn-guess,.btn-shuffle,.btn-share,#pkCopy,#guessBtn,.cw-controls button,.num-btn,.diff-btn,.answer-btn,.gq-choice,.sm-choice,.ht-choice,.pk-choice{min-height:44px;box-sizing:border-box;}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function syncPlayer() {
    if (!w.CGPlayer || typeof w.CGPlayer.record !== 'function') return;
    var map = playedMap();
    Object.keys(map).forEach(function (id) {
      if (map[id]) w.CGPlayer.record(id, { daily: true });
    });
  }

  function ensurePlayer() {
    if (w.CGPlayer) {
      syncPlayer();
      return;
    }
    if (w.__cgPlayerLoading) return;
    var existing = document.querySelector('script[src*="cg-player.js"]');
    function go() { if (w.CGPlayer) syncPlayer(); }
    if (existing) {
      existing.addEventListener('load', go);
      setTimeout(go, 40);
      return;
    }
    w.__cgPlayerLoading = true;
    var s = document.createElement('script');
    s.src = '/games/cg-player.js';
    s.onload = function () { w.__cgPlayerLoading = false; syncPlayer(); };
    s.onerror = function () { w.__cgPlayerLoading = false; };
    document.head.appendChild(s);
  }

  function mountAll() {
    injectStyles();
    ensureViewportFit();
    patchShareNow();
    document.querySelectorAll('.cg-daily-dock').forEach(mountDock);
    mountStreakHints();
    ensurePlayer();
    refreshNext(true);
  }

  function tickCountdowns() {
    var cd = fmtCd(msToUtcMidnight());
    document.querySelectorAll('[data-cd]').forEach(function (el) { el.textContent = cd; });
  }

  w.CGDaily = {
    ORDER: ORDER,
    playedMap: playedMap,
    nextUnplayed: nextUnplayed,
    leftover: leftover,
    playedCount: playedCount,
    fmtCd: fmtCd,
    msToUtcMidnight: msToUtcMidnight,
    copyText: copyText,
    shareResult: shareResult,
    mountAll: mountAll,
    mountStreakHints: mountStreakHints,
    isoToday: isoToday,
    syncPlayer: syncPlayer,
    upNextModel: upNextModel,
    mountToday: mountToday
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mountAll(); tickCountdowns(); });
  } else {
    mountAll(); tickCountdowns();
  }
  setInterval(function () {
    tickCountdowns();
    mountStreakHints();
    if (w.CGPlayer) syncPlayer();
    patchShareNow();
    refreshNext(false);
  }, 1000);
})(window);
