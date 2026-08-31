/* Shared daily-set helpers. Keep hamburger ids. Pixle is a Wordle. */
(function (w) {
  'use strict';

  var ORDER = [
    { id: 'gamerdle', name: 'Gamerdle', href: '/games/gamerdle' },
    { id: 'pixle', name: 'Pixle', href: '/games/pixle' },
    { id: 'rift', name: 'RIFT', href: '/games/rift' },
    { id: 'hardware-timeline', name: 'Hardware Timeline', href: '/games/hardware-timeline' },
    { id: 'spec-match', name: 'Spec Match', href: '/games/spec-match' },
    { id: 'gear-quiz', name: 'Gear Quiz', href: '/games/gear-quiz' },
    { id: 'gaming-trivia', name: 'Gaming Trivia', href: '/games/gaming-trivia' },
    { id: 'word-scramble', name: 'Word Scramble', href: '/games/word-scramble' },
    { id: 'crossword', name: 'Crossword', href: '/games/crossword' },
    { id: 'sudoku', name: 'Sudoku', href: '/games/sudoku' },
    { id: 'price-guesser', name: 'Price Guesser', href: '/games/price-guesser' },
    { id: 'daily-challenge', name: 'Pro Kit Daily', href: '/games/daily-challenge' }
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
      map.gamerdle = !!(gs.history && gs.history[ymd]);
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
    map.sudoku = localStorage.getItem('sdk_solved_' + iso) === '1' || localStorage.getItem('sdk_solved_' + ymd) === '1';
    map.crossword = safeInt('cw_last_day', -1) === dayOfYear();
    map['price-guesser'] = safeInt('pg_last_day', -1) === dayOfYear();
    try {
      var ss = safeJSON('scramble-state-v1') || {};
      var scrambleIso = localStorage.getItem('scramble_last_date');
      map['word-scramble'] = scrambleIso === iso || scrambleIso === ymd ||
        (ss.dayIndex === unixDay() && (ss.status === 'won' || ss.status === 'lost'));
    } catch (e) { map['word-scramble'] = false; }
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

  function leftover() {
    var m = playedMap();
    return ORDER.filter(function (g) { return !m[g.id]; });
  }

  function playedCount() {
    return ORDER.length - leftover().length;
  }

  function mountDock(el) {
    if (!el) return;
    var slug = el.getAttribute('data-slug') || '';
    var next = nextUnplayed(slug);
    var left = leftover().length;
    var html = '<div class="cg-dock">';
    if (next) {
      html += '<a class="cg-dock__next" href="' + next.href + '">Play next daily — ' + next.name + ' →</a>';
      html += '<div class="cg-dock__left">' + left + ' of 12 still open today</div>';
    } else {
      html += '<div class="cg-dock__done">Set complete. Next UTC day in <span data-cd></span></div>';
    }
    html += '<a class="cg-dock__all" href="/games/daily">Today\'s 12 →</a>';
    html += '<button type="button" class="cg-dock__mute" data-cg-mute></button>';
    html += '</div>';
    el.innerHTML = html;
    var mb = el.querySelector('[data-cg-mute]');
    function syncMute() {
      if (!mb) return;
      var on = !(w.CGSfx && w.CGSfx.isMuted());
      mb.textContent = on ? 'Sound on' : 'Muted';
    }
    syncMute();
    if (mb) mb.addEventListener('click', function () {
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
      '.cg-dock{margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:.55rem;}',
      '.cg-dock__next{display:block;text-align:center;background:var(--accent,#00d4ff);color:#06060a;font-weight:800;padding:.75rem 1rem;border-radius:10px;text-decoration:none;min-height:44px;line-height:1.2;}',
      '.cg-dock__next:hover{text-decoration:none;opacity:.92;}',
      '.cg-dock__all{text-align:center;font-size:.82rem;font-weight:700;color:var(--accent,#00d4ff);}',
      '.cg-dock__done{text-align:center;color:var(--text-mid,#aaa);font-size:.9rem;}',
      '.cg-dock__left{text-align:center;font-size:.8rem;color:var(--text-mid,#aaa);}',
      '.cg-dock__mute{margin:0 auto;min-height:40px;padding:.35rem .8rem;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:var(--text-mid,#aaa);font:inherit;cursor:pointer;}'
    ].join('');
    document.head.appendChild(s);
  }

  function mountAll() {
    injectStyles();
    document.querySelectorAll('.cg-daily-dock').forEach(mountDock);
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
    mountAll: mountAll,
    isoToday: isoToday
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mountAll(); tickCountdowns(); });
  } else {
    mountAll(); tickCountdowns();
  }
  setInterval(tickCountdowns, 1000);
})(window);
