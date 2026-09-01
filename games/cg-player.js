/* Local player stats. localStorage only — never invent other players. */
(function (w) {
  'use strict';

  var KEY = 'cg-player-v1';

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function localYmd(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function ymdAdd(ymd, days) {
    var p = String(ymd || '').split('-');
    if (p.length < 3) return '';
    var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    if (isNaN(dt.getTime())) return '';
    dt.setDate(dt.getDate() + days);
    return localYmd(dt);
  }

  function empty() {
    return {
      lastPlayYmd: '',
      streak: 0,
      bestStreak: 0,
      gamesPlayed: 0,
      xp: 0,
      byGame: {}
    };
  }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object') return empty();
      var s = empty();
      s.lastPlayYmd = typeof raw.lastPlayYmd === 'string' ? raw.lastPlayYmd : '';
      s.streak = +raw.streak || 0;
      s.bestStreak = +raw.bestStreak || 0;
      s.gamesPlayed = +raw.gamesPlayed || 0;
      s.xp = +raw.xp || 0;
      if (raw.byGame && typeof raw.byGame === 'object') s.byGame = raw.byGame;
      return s;
    } catch (e) {
      return empty();
    }
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function levelOf(xp) {
    return Math.floor((+xp || 0) / 100) + 1;
  }

  function gameSlot(s, id) {
    if (!s.byGame[id] || typeof s.byGame[id] !== 'object') {
      s.byGame[id] = { last: 0, best: 0, plays: 0 };
    }
    var g = s.byGame[id];
    if (g.last == null || g.last === '') g.last = 0;
    if (g.best == null) g.best = 0;
    if (g.plays == null) g.plays = 0;
    return g;
  }

  function applyDailyStreak(s, ymd) {
    if (!ymd) return;
    if (s.lastPlayYmd === ymd) return;
    if (s.lastPlayYmd && ymdAdd(s.lastPlayYmd, 1) === ymd) {
      s.streak = (s.streak || 0) + 1;
    } else {
      s.streak = 1;
    }
    s.lastPlayYmd = ymd;
    if (s.streak > (s.bestStreak || 0)) s.bestStreak = s.streak;
  }

  function applyGameStreak(g, ymd) {
    if (g.lastDailyYmd === ymd) return;
    if (g.lastDailyYmd && ymdAdd(g.lastDailyYmd, 1) === ymd) {
      g.streak = (g.streak || 0) + 1;
    } else {
      g.streak = 1;
    }
    g.lastDailyYmd = ymd;
  }

  function todayPlayedMap() {
    try {
      if (!w.CGDaily || typeof w.CGDaily.playedMap !== 'function') return null;
      return w.CGDaily.playedMap();
    } catch (e) {
      return null;
    }
  }

  function anyDailyToday(map) {
    if (!map) return false;
    for (var k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k) && map[k]) return true;
    }
    return false;
  }

  function liveStreak(s) {
    var ymd = localYmd();
    var yest = ymdAdd(ymd, -1);
    var mapToday = anyDailyToday(todayPlayedMap());
    if (s.lastPlayYmd === ymd) return s.streak || 0;
    if (mapToday) {
      if (s.lastPlayYmd === yest) return (s.streak || 0) + 1;
      return 1;
    }
    if (s.lastPlayYmd === yest) return s.streak || 0;
    return 0;
  }

  function record(gameId, opts) {
    opts = opts || {};
    if (!gameId) return snapshot();
    var s = load();
    var ymd = localYmd();
    var g = gameSlot(s, gameId);
    var daily = !!opts.daily;
    var scoreNum = (opts.score != null && isFinite(+opts.score)) ? +opts.score : null;

    if (daily && g.lastDailyYmd === ymd) {
      if (scoreNum != null) {
        g.last = scoreNum;
        if (scoreNum > (+g.best || 0)) g.best = scoreNum;
        save(s);
      }
      return snapshot();
    }

    g.plays = (+g.plays || 0) + 1;
    s.gamesPlayed = (+s.gamesPlayed || 0) + 1;
    s.xp = (+s.xp || 0) + 10;
    g.lastYmd = ymd;
    if (scoreNum != null) {
      g.last = scoreNum;
      if (scoreNum > (+g.best || 0)) g.best = scoreNum;
    }

    if (daily) {
      s.xp += 25;
      applyDailyStreak(s, ymd);
      applyGameStreak(g, ymd);
    }

    save(s);
    return snapshot();
  }

  function syncFromPlayedMap() {
    var map = todayPlayedMap();
    if (!map) return snapshot();
    var ids = [];
    for (var id in map) {
      if (Object.prototype.hasOwnProperty.call(map, id) && map[id]) ids.push(id);
    }
    ids.forEach(function (id) { record(id, { daily: true }); });
    return snapshot();
  }

  function snapshot() {
    var s = load();
    return {
      lastPlayYmd: s.lastPlayYmd || '',
      streak: liveStreak(s),
      bestStreak: s.bestStreak || 0,
      gamesPlayed: s.gamesPlayed || 0,
      xp: s.xp || 0,
      level: levelOf(s.xp),
      byGame: s.byGame || {}
    };
  }

  w.CGPlayer = {
    record: record,
    snapshot: snapshot,
    syncFromPlayedMap: syncFromPlayedMap,
    localYmd: localYmd,
    KEY: KEY
  };
})(window);
