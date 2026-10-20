/* Holiday Rush: Store Manager
   Floor frames: floor_chars_atlas.json (96px cells, 3 dirs × idle2/walk4/work4, left = mirrored side).
   Portraits: portraits_atlas.json. Icons: icons_ui_atlas.json.
   localStorage only. No accounts. */
(function (root) {
  'use strict';

  var ART = 'holiday-rush/';
  var WORLD_W = 1600;
  var WORLD_H = 900;
  var COLS = 21;
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday'];
  var SHIFT_NAMES = ['Open', 'Mid', 'Close'];
  var SHIFT_HOURS = ['8–12', '12–4', '4–8'];
  var STATIONS = ['reg1', 'reg2', 'floor', 'freight'];
  var STATION_LABEL = { reg1: 'Register A', reg2: 'Register B', floor: 'Floor', freight: 'Freight' };
  var ROLE_COLOR = { register: '#d64545', freight: '#3b78d0', floor: '#2f9e57', manager: '#e0a322' };
  var ROLE_LETTER = { register: 'R', freight: 'F', floor: 'L', manager: 'K' };
  var STAFF_EXPR = ['neutral', 'happy', 'stressed', 'angry', 'sick', 'proud'];
  var CUST_EXPR = ['neutral', 'impatient', 'angry', 'delighted'];

  var CONFIG = {
    daySeconds: 62,
    hoursBudget: 32,
    slotHours: 4,
    payBudget: 640,
    rate: 16,
    rateMgr: 26,
    goals: [1860, 2240, 2500],
    sprite: 78,
    custCap: 14,
    spawn: [0.64, 0.94, 0.72],
    basketMin: 42,
    basketMax: 108,
    stockStart: 0.84,
    stockPerSale: 0.03,
    freightRegen: 0.011,
    walkSpeed: 210,
    staffSpeed: 245,
    baseActions: 3,
    actionRegen: 9
  };

  var STAFF = [
    { id: 'staff_mgr', name: 'Maren Cole', role: 'manager', blurb: 'Key carrier. Covers any station. Costs more.' },
    { id: 'staff_reg1', name: 'Jun Park', role: 'register', blurb: 'Fast on a till.' },
    { id: 'staff_reg2', name: 'Priya Shah', role: 'register', blurb: 'Steady when the line gets loud.' },
    { id: 'staff_frt1', name: 'Ellis Ward', role: 'freight', blurb: 'Clears a truck.' },
    { id: 'staff_frt2', name: 'Noor Hale', role: 'freight', blurb: 'Keeps the shelves honest.' },
    { id: 'staff_flr1', name: 'Sam Ortiz', role: 'floor', blurb: 'Finds the right size.' },
    { id: 'staff_flr2', name: 'Bea Lin', role: 'floor', blurb: 'Makes the aisle shoppable.' },
    { id: 'staff_flr3', name: 'Theo Brooks', role: 'floor', blurb: 'Greets the rush.' }
  ];

  var CUST_IDS = ['cust_mom', 'cust_grandpa', 'cust_kid', 'cust_biz', 'cust_teen', 'cust_karen'];
  var BY_ID = {};
  STAFF.forEach(function (s) { BY_ID[s.id] = s; });

  var SPOTS = {
    reg1: { x: 496, y: 730 },
    reg2: { x: 752, y: 730 },
    floor: { x: 800, y: 470 },
    freight: { x: 1160, y: 200 },
    door: { x: 960, y: 855 },
    stock: { x: 420, y: 150 },
    truck: { x: 1200, y: 130 }
  };
  var SHELVES = [
    { x: 480, y: 460 },
    { x: 800, y: 260 },
    { x: 800, y: 520 },
    { x: 1140, y: 460 }
  ];
  var QUEUE = {
    reg1: { x: 496, y: 800, dy: 32 },
    reg2: { x: 752, y: 800, dy: 32 }
  };

  var PERKS = [
    { id: 'key', name: 'Better key carrier', icon: 'boss', body: 'Maren works any station like a specialist for the rest of the week.' },
    { id: 'freight', name: 'Faster freight', icon: 'truck', body: 'Truck and shelf work restocks about 60% faster.' },
    { id: 'action', name: 'Extra manager action', icon: 'stamp_0', body: 'Four manager actions each remaining day, instead of three.' },
    { id: 'cocoa', name: 'Break-room cocoa', icon: 'break', body: 'Morale jumps now, and shoppers wait a little longer before they leave.' }
  ];

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function utcYmd(d) {
    d = d || new Date();
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function ymdAdd(ymd, days) {
    var p = String(ymd).split('-');
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    dt.setUTCDate(dt.getUTCDate() + days);
    return utcYmd(dt);
  }

  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    var state = a | 0;
    function next() {
      state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.state = function () { return state >>> 0; };
    next.setState = function (s) { state = s | 0; };
    return next;
  }

  function blankShift() { return { reg1: null, reg2: null, floor: null, freight: null }; }
  function blankDay() { return [blankShift(), blankShift(), blankShift()]; }
  function blankWeek() { return [blankDay(), blankDay(), blankDay()]; }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function hoursOf(daySched) {
    var h = 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < STATIONS.length; i++) if (daySched[s][STATIONS[i]]) h += CONFIG.slotHours;
    }
    return h;
  }

  function shiftsOf(daySched, id) {
    var n = 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < STATIONS.length; i++) if (daySched[s][STATIONS[i]] === id) n++;
    }
    return n;
  }

  function payrollOf(daySched, extra) {
    var pay = extra || 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < STATIONS.length; i++) {
        var id = daySched[s][STATIONS[i]];
        if (!id || !BY_ID[id]) continue;
        pay += (BY_ID[id].role === 'manager' ? CONFIG.rateMgr : CONFIG.rate) * CONFIG.slotHours;
      }
    }
    return pay;
  }

  function scheduled(daySched, shift, id) {
    for (var i = 0; i < STATIONS.length; i++) {
      if (daySched[shift][STATIONS[i]] === id) return STATIONS[i];
    }
    return null;
  }

  function payScore(payroll, budget) {
    if (payroll <= budget) return 1;
    var over = (payroll - budget) / budget;
    return clamp(1 - over * 1.35, 0, 1);
  }

  function scoreSnapshot(sim) {
    var goalPct = sim.goal > 0 ? sim.sales / sim.goal : 0;
    var pay = payScore(sim.payroll, CONFIG.payBudget);
    var points = Math.round(1000 * (
      0.52 * Math.min(goalPct, 1.3) +
      0.16 * pay +
      0.18 * (clamp(sim.morale, 0, 100) / 100) +
      0.14 * (clamp(sim.stars, 1, 5) / 5)
    ));
    return {
      sales: Math.round(sim.sales),
      goal: sim.goal,
      goalPct: goalPct,
      payroll: Math.round(sim.payroll),
      payBudget: CONFIG.payBudget,
      morale: Math.round(sim.morale),
      stars: Math.round(sim.stars * 10) / 10,
      points: points,
      walkouts: sim.walkouts,
      checkouts: sim.checkouts,
      grade: points >= 900 ? 'A' : points >= 760 ? 'B' : points >= 620 ? 'C' : 'D'
    };
  }

  function rollAvail(rng) {
    var map = {};
    STAFF.forEach(function (s) {
      if (s.role === 'manager') {
        map[s.id] = [1, 1, 1];
        return;
      }
      var off = Math.floor(rng() * 3);
      var row = [1, 1, 1];
      row[off] = 0;
      if (rng() < 0.28) {
        var off2 = (off + 1 + Math.floor(rng() * 2)) % 3;
        row[off2] = 0;
      }
      if (row[0] + row[1] + row[2] === 0) row[off] = 1;
      map[s.id] = row;
    });
    return map;
  }

  function shuffleIds(rng, list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var EVENT_IDS = ['callout', 'truck', 'line', 'upset', 'boss', 'break', 'outstock', 'price', 'return', 'rush', 'spill', 'theft'];

  function newRun(ymd) {
    var rng = mulberry32(hashStr('hr:' + ymd));
    var days = [];
    for (var d = 0; d < 3; d++) {
      var ids = shuffleIds(rng, EVENT_IDS).slice(0, 4);
      var goal = Math.round(CONFIG.goals[d] * (1 - 0.05 + rng() * 0.1));
      days.push({ avail: rollAvail(rng), goal: goal, events: ids, callout: null });
    }
    var cday = rng() < 0.5 ? 1 : 2;
    var pool = STAFF.filter(function (s) { return s.role !== 'manager'; });
    var who = pool[Math.floor(rng() * pool.length)];
    days[cday].callout = who.id;
    days[cday].avail[who.id] = [0, 0, 0];
    days[cday].events = days[cday].events.filter(function (id) { return id !== 'callout'; });
    if (days[cday].events.length < 4) {
      EVENT_IDS.forEach(function (id) {
        if (days[cday].events.length >= 4) return;
        if (id !== 'callout' && days[cday].events.indexOf(id) < 0) days[cday].events.push(id);
      });
    }
    return {
      v: 1,
      ymd: ymd,
      day: 0,
      phase: 'intro',
      schedule: blankWeek(),
      perks: [],
      morale: 74,
      history: [],
      callouts: 0,
      acked: [false, false, false],
      calloutCounted: [false, false, false],
      days: days,
      celebrated: false
    };
  }

  function greedy(run, day) {
    var sched = blankDay();
    var avail = run.days[day].avail;
    var used = {};
    var order = [
      [1, 'reg1'], [1, 'reg2'], [1, 'floor'], [1, 'freight'],
      [0, 'reg1'], [0, 'floor'], [0, 'freight'],
      [2, 'reg1'], [2, 'floor'], [2, 'freight'],
      [0, 'reg2'], [2, 'reg2']
    ];
    var hours = 0;
    for (var n = 0; n < order.length; n++) {
      if (hours + CONFIG.slotHours > CONFIG.hoursBudget) break;
      var shift = order[n][0];
      var station = order[n][1];
      var best = null;
      var bestScore = -1;
      for (var i = 0; i < STAFF.length; i++) {
        var s = STAFF[i];
        if (!avail[s.id] || !avail[s.id][shift]) continue;
        if ((used[s.id] || 0) >= 2) continue;
        if (scheduled(sched, shift, s.id)) continue;
        var need = station.indexOf('reg') === 0 ? 'register' : station;
        var sc = s.role === need ? 4 : s.role === 'manager' ? 2.4 : 1;
        sc -= (used[s.id] || 0) * 0.8;
        if (sc > bestScore) { bestScore = sc; best = s.id; }
      }
      if (!best) continue;
      sched[shift][station] = best;
      used[best] = (used[best] || 0) + 1;
      hours += CONFIG.slotHours;
    }
    return sched;
  }

  function tryPlace(daySched, avail, id, shift, station, from) {
    if (!BY_ID[id]) return { ok: false, reason: 'Unknown name.' };
    if (!avail[id] || !avail[id][shift]) {
      return { ok: false, reason: BY_ID[id].name.split(' ')[0] + ' is not available for ' + SHIFT_NAMES[shift].toLowerCase() + '.' };
    }
    var copy = clone(daySched);
    if (from) copy[from.shift][from.station] = null;
    for (var i = 0; i < STATIONS.length; i++) {
      if (copy[shift][STATIONS[i]] === id) copy[shift][STATIONS[i]] = null;
    }
    copy[shift][station] = id;
    if (hoursOf(copy) > CONFIG.hoursBudget) {
      return { ok: false, reason: 'That is over the ' + CONFIG.hoursBudget + ' hour cap.' };
    }
    if (shiftsOf(copy, id) > 2) {
      return { ok: false, reason: BY_ID[id].name.split(' ')[0] + ' is already on two shifts.' };
    }
    return { ok: true, schedule: copy };
  }

  function makeActor(charId, x, y) {
    return {
      charId: charId,
      x: x, y: y,
      dir: 'down',
      face: 1,
      anim: 'idle',
      frame: 0,
      frameT: 0,
      arrived: false,
      path: null,
      pathI: 0,
      hidden: false,
      station: null,
      shelfI: 0,
      workT: 0,
      bubble: null
    };
  }

  function moveToward(a, tx, ty, dt, speed) {
    var dx = tx - a.x;
    var dy = ty - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) {
      a.x = tx; a.y = ty;
      return true;
    }
    var step = Math.min(dist, speed * dt);
    a.x += (dx / dist) * step;
    a.y += (dy / dist) * step;
    if (Math.abs(dx) > Math.abs(dy) * 0.8) {
      a.dir = 'side';
      a.face = dx < 0 ? -1 : 1;
    } else {
      a.dir = dy < 0 ? 'up' : 'down';
      a.face = 1;
    }
    a.anim = 'walk';
    return false;
  }

  function follow(a, dt, speed) {
    if (!a.path || a.pathI >= a.path.length) return true;
    var p = a.path[a.pathI];
    if (moveToward(a, p.x, p.y, dt, speed)) {
      a.pathI++;
      if (a.pathI >= a.path.length) {
        a.path = null;
        return true;
      }
    }
    return false;
  }

  function pathVia(x, y, tx, ty) {
    return [
      { x: x, y: Math.min(820, Math.max(y, 780)) },
      { x: tx, y: 810 },
      { x: tx, y: ty }
    ];
  }

  function shiftIndex(sim) {
    var u = sim.duration > 0 ? sim.t / sim.duration : 0;
    if (u < 1 / 3) return 0;
    if (u < 2 / 3) return 1;
    return 2;
  }

  function hasPerk(run, id) { return run.perks.indexOf(id) >= 0; }

  function skillMul(actor, station, run, sim) {
    var need = station === 'reg1' || station === 'reg2' ? 'register' : station;
    var m = 0.56;
    if (actor.role === need) m = 1.34;
    if (actor.role === 'manager') m = hasPerk(run, 'key') ? 1.75 : 1.2;
    if (actor.tired) m *= 0.84;
    var morale = sim ? sim.morale : 70;
    m *= 0.76 + clamp(morale, 0, 100) / 260;
    m *= actor.arrived ? 1 : 0.5;
    return m;
  }

  function stationPower(sim, run, station) {
    var p = 0;
    for (var i = 0; i < sim.staff.length; i++) {
      var a = sim.staff[i];
      if (a.hidden || a.station !== station) continue;
      p += skillMul(a, station, run, sim);
    }
    if (sim.you && sim.you.station === station && sim.t < sim.you.until) {
      p += skillMul(sim.you, station, run, sim);
    }
    return p;
  }

  function queueOf(sim, reg) {
    var list = [];
    for (var i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.dead) continue;
      if ((c.state === 'queue' || c.state === 'checkout') && c.reg === reg) list.push(c);
    }
    list.sort(function (a, b) { return a.seq - b.seq; });
    return list;
  }

  function floater(sim, x, y, text, color, big) {
    if (!sim.floats) sim.floats = [];
    if (sim.floats.length > 16) sim.floats.shift();
    sim.floats.push({ x: x, y: y, text: text, color: color || '#ffe08a', life: big ? 1.25 : 1.05, big: !!big });
  }

  var hooks = {
    kaching: function () {},
    horn: function () {},
    tap: function () {}
  };

  function burstCoins(sim, x, y) {
    if (!sim.coins) sim.coins = [];
    for (var i = 0; i < 5; i++) {
      if (sim.coins.length > 28) sim.coins.shift();
      sim.coins.push({
        x: x + (i - 2) * 6,
        y: y,
        vx: (i - 2) * 42,
        vy: -110 - (i % 3) * 16,
        life: 0.9
      });
    }
  }

  function flashAt(sim, x, y) {
    if (!sim.fx) sim.fx = [];
    if (sim.fx.length > 24) sim.fx.shift();
    sim.fx.push({ x: x, y: y, life: 0.38 });
  }

  function goalStars(pct) {
    if (pct >= 1) return 3;
    if (pct >= 0.7) return 2;
    if (pct >= 0.4) return 1;
    return 0;
  }

  function paceStars(sim) {
    if (!sim || sim.sales <= 0) return 0;
    var elapsed = clamp(sim.duration ? sim.t / sim.duration : 0, 0.12, 1);
    var projected = sim.sales / elapsed;
    var ratio = sim.goal ? projected / sim.goal : 0;
    if (ratio >= 1.02 || sim.sales >= sim.goal) return 3;
    if (ratio >= 0.7) return 2;
    return 1;
  }

  function note(sim, text) { sim.notes.push(text); }

  function effectiveStation(sim, run, id) {
    if (sim.removed[id]) return null;
    if (sim.breakUntil[id] && sim.t < sim.breakUntil[id]) return null;
    if (sim.overrideAll[id]) return sim.overrideAll[id];
    var sh = shiftIndex(sim);
    if (sim.override[id] && sim.overrideShift[id] === sh) return sim.override[id];
    return scheduled(run.schedule[run.day], sh, id);
  }

  function ensureStaff(sim, run, id, x, y) {
    for (var i = 0; i < sim.staff.length; i++) if (sim.staff[i].id === id) return sim.staff[i];
    var person = BY_ID[id];
    if (!person) return null;
    var a = makeActor(id, x || SPOTS.stock.x, y || SPOTS.stock.y);
    a.id = id;
    a.role = person.role;
    a.tired = !!sim.tired[id];
    a.kind = 'staff';
    sim.staff.push(a);
    return a;
  }

  function startDay(run) {
    var day = run.days[run.day];
    var sched = run.schedule[run.day];
    var sim = {
      t: 0,
      duration: CONFIG.daySeconds,
      sales: 0,
      goal: day.goal,
      payroll: payrollOf(sched, 0),
      morale: clamp(run.morale, 8, 100),
      stars: 4.05,
      stock: CONFIG.stockStart,
      actions: CONFIG.baseActions + (hasPerk(run, 'action') ? 1 : 0),
      actionMax: CONFIG.baseActions + (hasPerk(run, 'action') ? 1 : 0) + 1,
      actionFrac: 0,
      truck: 0,
      truckWork: 0,
      rushUntil: 0,
      slowUntil: 0,
      discountUntil: 0,
      spillUntil: 0,
      spillClean: 0,
      customers: [],
      staff: [],
      floats: [],
      notes: [],
      spawnAcc: 0.4,
      seq: 1,
      walkouts: 0,
      checkouts: 0,
      paused: false,
      pending: null,
      events: day.events.slice(),
      eventIndex: 0,
      eventTimes: [8.5, 22, 36, 49],
      removed: {},
      override: {},
      overrideShift: {},
      overrideAll: {},
      breakUntil: {},
      tired: {},
      you: null,
      done: false,
      lastShift: 0,
      coins: [],
      fx: [],
      pings: [],
      hornPlayed: false,
      nextPing: 5,
      live: false,
      coachHold: false,
      rng: mulberry32(hashStr(run.ymd + ':day:' + run.day))
    };
    var tiredN = 0;
    STAFF.forEach(function (s) {
      var n = shiftsOf(sched, s.id);
      if (n >= 2) { sim.tired[s.id] = true; tiredN++; }
      if (n > 0) ensureStaff(sim, run, s.id, SPOTS.stock.x + (tiredN * 18), SPOTS.stock.y);
    });
    sim.morale = clamp(sim.morale - tiredN * 3, 8, 100);
    for (var si = 0; si < sim.staff.length; si++) {
      var actor = sim.staff[si];
      var stNow = effectiveStation(sim, run, actor.id);
      if (stNow && SPOTS[stNow]) {
        actor.x = SPOTS[stNow].x;
        actor.y = SPOTS[stNow].y;
        actor.station = stNow;
        actor.arrived = true;
        actor.hidden = false;
      }
    }
    return sim;
  }

  function tickAnim(a, dt) {
    a.frameT += dt;
    var fps = a.anim === 'idle' ? 3.2 : 8;
    var count = a.anim === 'idle' ? 2 : 4;
    if (a.frameT >= 1 / fps) {
      a.frameT -= 1 / fps;
      a.frame = (a.frame + 1) % count;
    }
  }

  function updateStaffActor(sim, run, a, dt) {
    var st = a.id ? effectiveStation(sim, run, a.id) : a.station;
    if (a.kind === 'you') st = sim.t < a.until ? a.station : null;
    var prev = a.station;
    a.station = st;
    if (!st) {
      a.bubble = null;
      var homeX = SPOTS.stock.x;
      var homeY = SPOTS.stock.y;
      var nearHome = Math.abs(a.x - homeX) < 10 && Math.abs(a.y - homeY) < 10;
      if (nearHome) {
        a.hidden = true;
        a.path = null;
        a.anim = 'idle';
      } else {
        a.hidden = false;
        if (!a.path) {
          a.path = pathVia(a.x, a.y, homeX, homeY);
          a.pathI = 0;
        }
        if (follow(a, dt, CONFIG.staffSpeed)) a.hidden = true;
      }
      tickAnim(a, dt);
      return;
    }
    a.hidden = false;
    if (st !== prev) {
      a.arrived = false;
      a.workT = 0;
      a.path = null;
    }
    var target = SPOTS.stock;
    if (st === 'reg1' || st === 'reg2') target = SPOTS[st];
    else if (st === 'floor') target = SHELVES[a.shelfI % SHELVES.length];
    else if (st === 'freight') {
      var loop = [SPOTS.truck, SHELVES[0], SHELVES[1], SHELVES[3]];
      if (sim.truck) loop = [SPOTS.truck];
      target = loop[a.shelfI % loop.length];
    }
    var speed = CONFIG.staffSpeed * (a.rush > 1 ? a.rush : 1);
    if (!a.arrived) {
      if (moveToward(a, target.x, target.y, dt, speed)) {
        a.arrived = true;
        a.rush = 0;
        a.pop = 1;
      }
    } else {
      a.anim = 'work';
      a.workT += dt;
      var dwell = st === 'floor' ? 1.15 : 1.35;
      if (a.workT > dwell && st !== 'reg1' && st !== 'reg2') {
        a.workT = 0;
        a.arrived = false;
        a.shelfI++;
      }
      if (st === 'reg1' || st === 'reg2') {
        var qn = queueOf(sim, st).length;
        a.anim = qn > 0 ? 'work' : 'idle';
        a.bubble = qn >= 3 ? 'line' : null;
      } else if (st === 'freight') {
        a.bubble = sim.truck ? 'truck' : null;
      } else {
        a.bubble = null;
      }
    }
    if (a.kind === 'you') a.bubble = 'boss';
    tickAnim(a, dt);
  }

  function spawnCustomer(sim, run) {
    if (sim.customers.length >= CONFIG.custCap) return;
    var bag = ['cust_mom', 'cust_teen', 'cust_biz', 'cust_mom', 'cust_kid', 'cust_grandpa', 'cust_teen', 'cust_karen', 'cust_biz'];
    var id = bag[Math.floor(sim.rng() * bag.length)];
    var shelf = SHELVES[Math.floor(sim.rng() * SHELVES.length)];
    var patience = 0.86 + sim.rng() * 0.28;
    if (id === 'cust_karen') patience *= 0.7;
    if (id === 'cust_kid') patience *= 0.88;
    if (id === 'cust_grandpa') patience *= 1.18;
    if (hasPerk(run, 'cocoa')) patience *= 1.14;
    var c = makeActor(id, SPOTS.door.x + (sim.rng() * 50 - 25), SPOTS.door.y);
    c.kind = 'cust';
    c.state = 'enter';
    c.shelf = shelf;
    c.patience = patience;
    c.maxPatience = patience;
    c.path = pathVia(c.x, c.y, shelf.x, shelf.y);
    c.pathI = 0;
    c.seq = sim.seq++;
    c.reg = null;
    sim.customers.push(c);
  }

  function walkout(sim, c) {
    if (c.walked) return;
    c.walked = true;
    c.angry = true;
    sim.walkouts++;
    sim.stars = clamp(sim.stars - 0.075, 1, 5);
    sim.morale = clamp(sim.morale - 1.25, 0, 100);
    floater(sim, c.x, c.y - 50, 'left', '#ff8d8d');
    c.state = 'leave';
    c.path = pathVia(c.x, c.y, SPOTS.door.x, SPOTS.door.y);
    c.pathI = 0;
    c.bubble = 'angry';
  }

  function completeSale(sim, run, c) {
    if (c.sold) return;
    if (sim.stock <= 0.025) { walkout(sim, c); return; }
    c.sold = true;
    var basket = CONFIG.basketMin + sim.rng() * (CONFIG.basketMax - CONFIG.basketMin);
    if (stationPower(sim, run, 'floor') > 0.55) basket *= 1.1;
    if (sim.stock < 0.28) basket *= 0.64;
    if (sim.t < sim.discountUntil) basket *= 0.86;
    basket = Math.round(basket);
    sim.sales += basket;
    sim.checkouts++;
    sim.stock = Math.max(0, sim.stock - CONFIG.stockPerSale);
    sim.stars = clamp(sim.stars + 0.014, 1, 5);
    c.pop = 1;
    floater(sim, c.x, c.y - 70, '+$' + basket, '#ffe08a', true);
    burstCoins(sim, c.x, c.y - 40);
    flashAt(sim, c.x, c.y - 20);
    hooks.kaching();
    c.state = 'leave';
    c.bubble = 'price';
    c.path = pathVia(c.x, c.y, SPOTS.door.x + 20, SPOTS.door.y);
    c.pathI = 0;
  }

  function pickRegister(sim, run) {
    var best = 'reg1';
    var bestScore = 1e9;
    for (var i = 0; i < 2; i++) {
      var reg = i === 0 ? 'reg1' : 'reg2';
      var score = queueOf(sim, reg).length * 2 - stationPower(sim, run, reg) * 1.4;
      if (score < bestScore) { bestScore = score; best = reg; }
    }
    return best;
  }

  function updateCustomers(sim, run, dt) {
    var regs = ['reg1', 'reg2'];
    for (var r = 0; r < regs.length; r++) {
      var list = queueOf(sim, regs[r]);
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        c.qIndex = i;
        var base = QUEUE[regs[r]];
        var row = Math.min(i, 3);
        var col = i > 3 ? (i - 3) : 0;
        c.qx = base.x + col * 30;
        c.qy = base.y + row * base.dy;
      }
    }
    var speed = CONFIG.walkSpeed * (sim.t < sim.spillUntil ? 0.6 : 1);
    var cocoa = hasPerk(run, 'cocoa') ? 0.82 : 1;
    for (var n = 0; n < sim.customers.length; n++) {
      var cust = sim.customers[n];
      if (cust.dead) continue;
      if (sim.coachHold && cust.maxPatience && cust.state !== 'leave' && cust.patience < cust.maxPatience * 0.24) {
        cust.patience = cust.maxPatience * 0.24;
      }
      if (cust.state === 'enter') {
        if (follow(cust, dt, speed)) {
          cust.state = 'browse';
          cust.browseT = 0.85 + sim.rng() * 1.35;
          cust.anim = 'idle';
          cust.bubble = null;
        }
      } else if (cust.state === 'browse') {
        cust.anim = 'idle';
        cust.browseT -= dt * (stationPower(sim, run, 'floor') > 0.5 ? 1.25 : 1);
        cust.patience -= dt * 0.012 * cocoa;
        if (cust.patience <= 0) walkout(sim, cust);
        else if (cust.browseT <= 0) {
          if (sim.stock <= 0.04) walkout(sim, cust);
          else {
            cust.state = 'toQueue';
            cust.reg = pickRegister(sim, run);
            cust.path = null;
          }
        }
      } else if (cust.state === 'toQueue') {
        var slot = queueOf(sim, cust.reg).length;
        var pos = QUEUE[cust.reg];
        var dest = { x: pos.x, y: pos.y + Math.min(slot, 3) * pos.dy };
        if (moveToward(cust, dest.x, dest.y, dt, speed)) {
          if (slot >= 6) walkout(sim, cust);
          else cust.state = 'queue';
        }
      } else if (cust.state === 'queue' || cust.state === 'checkout') {
        var at = moveToward(cust, cust.qx || cust.x, cust.qy || cust.y, dt, speed);
        var power = stationPower(sim, run, cust.reg);
        var drain = (power > 0.45 ? 0.042 : 0.105) * cocoa;
        if (cust.qIndex > 0) drain += 0.01 * cust.qIndex;
        cust.patience -= dt * drain;
        if (cust.patience <= 0) walkout(sim, cust);
        else if (cust.qIndex === 0 && at) {
          cust.state = 'checkout';
          cust.anim = 'idle';
          var rate = power > 0.35 ? (0.55 + power * 0.85) : 0.2;
          cust.checkT = (cust.checkT == null ? 2.15 : cust.checkT) - dt * rate;
          if (cust.checkT <= 0) completeSale(sim, run, cust);
        } else {
          cust.anim = at ? 'idle' : 'walk';
          if (cust.checkT == null && cust.qIndex === 0) cust.checkT = 2.15;
        }
        cust.bubble = cust.patience < cust.maxPatience * 0.38 ? 'angry' : null;
      } else if (cust.state === 'leave') {
        cust.anim = 'walk';
        if (follow(cust, dt, speed * 1.05)) cust.dead = true;
      }
      tickAnim(cust, dt);
    }
    sim.customers = sim.customers.filter(function (c) { return !c.dead; });
  }

  function firstName(id) {
    var p = BY_ID[id];
    return p ? p.name.split(' ')[0] : 'Someone';
  }

  function workingIds(sim, run) {
    var ids = [];
    for (var i = 0; i < sim.staff.length; i++) {
      var a = sim.staff[i];
      if (!a.id || sim.removed[a.id]) continue;
      if (effectiveStation(sim, run, a.id)) ids.push(a.id);
    }
    return ids;
  }

  function choice(label, cost, apply) { return { label: label, cost: cost, apply: apply }; }

  function buildEvent(id, sim, run, forced) {
    forced = forced || null;
    var card = { id: id, icon: id === 'upset' ? 'angry' : id, title: '', body: '', who: null, expr: 'neutral', choices: [] };
    if (id === 'callout') {
      var ids = workingIds(sim, run);
      if (!ids.length) {
        card.icon = 'callout';
        card.title = 'False alarm';
        card.body = 'A call-out rumor dies in the group chat. Everyone who is here stays.';
        card.choices = [choice('Back to the floor', 0, function () { sim.morale = clamp(sim.morale + 1, 0, 100); })];
        return card;
      }
      var who = forced && forced.who ? forced.who : ids[Math.floor(sim.rng() * ids.length)];
      card.who = who;
      card.expr = 'sick';
      card.title = firstName(who) + ' is sick';
      card.body = firstName(who) + ' texted from the parking lot. Fever. The rest of the shift is uncovered unless you move.';
      card.choices = [
        choice('Send them home', 0, function () {
          sim.removed[who] = true;
          sim.morale = clamp(sim.morale + 3, 0, 100);
          run.callouts++;
          note(sim, firstName(who) + ' went home.');
        }),
        choice('Ask them to stay', 0, function () {
          sim.tired[who] = true;
          var actor = ensureStaff(sim, run, who);
          if (actor) actor.tired = true;
          sim.morale = clamp(sim.morale - 8, 0, 100);
          note(sim, firstName(who) + ' stayed, unhappy.');
        }),
        choice('Cover it yourself', 1, function () {
          sim.removed[who] = true;
          run.callouts++;
          var st = scheduled(run.schedule[run.day], shiftIndex(sim), who) || 'reg1';
          sim.you = makeActor('staff_mgr', SPOTS.stock.x, SPOTS.stock.y);
          sim.you.kind = 'you';
          sim.you.role = 'manager';
          sim.you.station = st;
          sim.you.until = sim.t + 14;
          sim.morale = clamp(sim.morale + 1, 0, 100);
        })
      ];
      return card;
    }
    if (id === 'truck') {
      card.title = 'Truck in the bay';
      card.body = 'A holiday drop is sitting on the dock. Shelves will thin out until somebody works it.';
      card.choices = [
        choice('Leave it', 0, function () { sim.truck = 1; sim.truckWork = 0; note(sim, 'The truck is still on the dock.'); }),
        choice('Pull someone to freight', 0, function () {
          sim.truck = 1; sim.truckWork = 0;
          var pull = null;
          for (var i = 0; i < sim.staff.length; i++) {
            var a = sim.staff[i];
            if (a.station === 'floor' || a.station === 'reg2') { pull = a; break; }
          }
          if (pull) {
            sim.override[pull.id] = 'freight';
            sim.overrideShift[pull.id] = shiftIndex(sim);
            note(sim, firstName(pull.id) + ' is on the truck.');
          } else note(sim, 'Nobody free. The truck waits.');
        }),
        choice('Unload it yourself', 1, function () {
          sim.truck = 0;
          sim.stock = clamp(sim.stock + 0.2, 0, 1);
          sim.you = makeActor('staff_mgr', SPOTS.truck.x, SPOTS.truck.y + 40);
          sim.you.kind = 'you'; sim.you.role = 'manager'; sim.you.station = 'freight'; sim.you.until = sim.t + 8; sim.you.arrived = true;
          note(sim, 'You cleared the dock.');
        })
      ];
      return card;
    }
    if (id === 'line') {
      card.icon = 'line';
      card.title = 'Line at the registers';
      card.body = 'Baskets are stacking up. A second till, or you, would keep the stars from slipping.';
      card.choices = [
        choice('Let them wait', 0, function () {
          sim.stars = clamp(sim.stars - 0.16, 1, 5);
          sim.morale = clamp(sim.morale - 2, 0, 100);
        }),
        choice('Pull someone to a till', 0, function () {
          var pull = null;
          for (var i = 0; i < sim.staff.length; i++) {
            if (sim.staff[i].station === 'floor' || sim.staff[i].station === 'freight') { pull = sim.staff[i]; break; }
          }
          if (!pull) { note(sim, 'No one to pull.'); return; }
          var reg = queueOf(sim, 'reg1').length >= queueOf(sim, 'reg2').length ? 'reg1' : 'reg2';
          sim.override[pull.id] = reg;
          sim.overrideShift[pull.id] = shiftIndex(sim);
          note(sim, firstName(pull.id) + ' jumped on a till.');
        }),
        choice('Hop on a till', 1, function () {
          var reg = queueOf(sim, 'reg1').length >= queueOf(sim, 'reg2').length ? 'reg1' : 'reg2';
          sim.you = makeActor('staff_mgr', SPOTS[reg].x, SPOTS[reg].y + 30);
          sim.you.kind = 'you'; sim.you.role = 'manager'; sim.you.station = reg; sim.you.until = sim.t + 12;
        })
      ];
      return card;
    }
    if (id === 'upset') {
      card.icon = 'angry';
      card.who = 'cust_karen';
      card.expr = 'angry';
      card.title = 'Upset at the service desk';
      card.body = 'A shopper says the shelf price and the till do not match. The line behind them is watching.';
      card.choices = [
        choice('Stand firm', 0, function () { sim.stars = clamp(sim.stars - 0.2, 1, 5); sim.morale = clamp(sim.morale - 1, 0, 100); }),
        choice('Take 10% off for a bit', 0, function () {
          sim.discountUntil = sim.t + 14;
          sim.stars = clamp(sim.stars + 0.08, 1, 5);
          note(sim, 'Discount running.');
        }),
        choice('Calm them yourself', 1, function () {
          sim.stars = clamp(sim.stars + 0.12, 1, 5);
          sim.morale = clamp(sim.morale + 2, 0, 100);
          for (var i = 0; i < sim.customers.length; i++) {
            if (sim.customers[i].patience < sim.customers[i].maxPatience) {
              sim.customers[i].patience = sim.customers[i].maxPatience;
              break;
            }
          }
        })
      ];
      return card;
    }
    if (id === 'boss') {
      card.who = 'cust_biz';
      card.expr = 'impatient';
      card.title = 'District manager on the floor';
      card.body = 'Adler from district is walking the aisles with a clipboard. Holiday Rush Mart is the stop today.';
      card.choices = [
        choice('Hide in the office', 0, function () { sim.morale = clamp(sim.morale - 4, 0, 100); sim.stars = clamp(sim.stars - 0.12, 1, 5); }),
        choice('Point at the best aisle', 0, function () {
          var ok = stationPower(sim, run, 'floor') > 0.7 && sim.stock > 0.45;
          sim.stars = clamp(sim.stars + (ok ? 0.12 : -0.18), 1, 5);
          note(sim, ok ? 'Adler nods.' : 'Adler is not impressed.');
        }),
        choice('Walk the floor with them', 1, function () { sim.stars = clamp(sim.stars + 0.22, 1, 5); sim.morale = clamp(sim.morale + 2, 0, 100); })
      ];
      return card;
    }
    if (id === 'break') {
      var idsB = workingIds(sim, run);
      var whoB = forced && forced.who ? forced.who : (idsB.length ? idsB[Math.floor(sim.rng() * idsB.length)] : null);
      card.who = whoB;
      card.expr = 'stressed';
      card.title = whoB ? firstName(whoB) + ' needs a break' : 'Break request';
      card.body = whoB ? firstName(whoB) + ' has been on since open. Ten minutes would help. The station would not cover itself.' : 'The break board is quiet.';
      card.choices = [
        choice('Deny it', 0, function () { sim.morale = clamp(sim.morale - 7, 0, 100); }),
        choice('Approve the break', 0, function () {
          if (whoB) sim.breakUntil[whoB] = sim.t + 10;
          sim.morale = clamp(sim.morale + 5, 0, 100);
        }),
        choice('Cover the break', 1, function () {
          if (whoB) sim.breakUntil[whoB] = sim.t + 10;
          var stB = whoB ? (effectiveStation(sim, run, whoB) || 'floor') : 'floor';
          sim.you = makeActor('staff_mgr', SPOTS.stock.x, SPOTS.stock.y);
          sim.you.kind = 'you'; sim.you.role = 'manager'; sim.you.station = stB; sim.you.until = sim.t + 10;
          sim.morale = clamp(sim.morale + 4, 0, 100);
        })
      ];
      return card;
    }
    if (id === 'outstock') {
      card.title = 'Hole on an endcap';
      card.body = 'The holiday endcap is down to tags. Shoppers are walking past it.';
      card.choices = [
        choice('Raincheck them', 0, function () { sim.stars = clamp(sim.stars - 0.12, 1, 5); sim.morale = clamp(sim.morale - 1, 0, 100); }),
        choice('Rush whoever is on freight', 0, function () {
          if (stationPower(sim, run, 'freight') > 0.4) {
            sim.stock = clamp(sim.stock + 0.16, 0, 1);
            note(sim, 'Freight filled the hole.');
          } else {
            sim.stock = clamp(sim.stock + 0.04, 0, 1);
            note(sim, 'Nobody really on freight.');
          }
        }),
        choice('Fill it yourself', 1, function () { sim.stock = clamp(sim.stock + 0.22, 0, 1); })
      ];
      return card;
    }
    if (id === 'price') {
      card.who = 'cust_mom';
      card.expr = 'impatient';
      card.title = 'Price check';
      card.body = 'The shelf tag is lower than the scanner. A small crowd wants to know which one is real.';
      card.choices = [
        choice('Hold the scanner price', 0, function () { sim.stars = clamp(sim.stars - 0.18, 1, 5); }),
        choice('Honor the shelf tag', 0, function () { sim.discountUntil = sim.t + 12; sim.stars = clamp(sim.stars + 0.1, 1, 5); }),
        choice('Fix the sign yourself', 1, function () { sim.stars = clamp(sim.stars + 0.06, 1, 5); sim.morale = clamp(sim.morale + 1, 0, 100); })
      ];
      return card;
    }
    if (id === 'return') {
      card.who = 'cust_grandpa';
      card.expr = 'neutral';
      card.title = 'Return with no receipt';
      card.body = 'A shopper wants to return a gift. The line at the desk is now part of the front end.';
      card.choices = [
        choice('Refuse it', 0, function () { sim.stars = clamp(sim.stars - 0.22, 1, 5); sim.morale = clamp(sim.morale - 2, 0, 100); }),
        choice('Pull a cashier to the desk', 0, function () {
          var pull = null;
          for (var i = 0; i < sim.staff.length; i++) if (sim.staff[i].station === 'reg1' || sim.staff[i].station === 'reg2') { pull = sim.staff[i]; break; }
          if (pull) {
            sim.breakUntil[pull.id] = sim.t + 8;
            note(sim, firstName(pull.id) + ' is on the desk.');
          }
          sim.stars = clamp(sim.stars + 0.08, 1, 5);
        }),
        choice('Handle the return', 1, function () {
          sim.sales = Math.max(0, sim.sales - 40);
          sim.stars = clamp(sim.stars + 0.12, 1, 5);
          floater(sim, SPOTS.door.x, SPOTS.door.y - 80, '-$40', '#ffb4b4');
        })
      ];
      return card;
    }
    if (id === 'rush') {
      card.title = 'The rush hits';
      card.body = 'School let out and the parking lot filled. You can ride it, slow the door, or pay someone to come in.';
      card.choices = [
        choice('Ride the rush', 0, function () { sim.rushUntil = sim.t + 14; sim.stars = clamp(sim.stars + 0.04, 1, 5); }),
        choice('Cap the door', 0, function () { sim.slowUntil = sim.t + 14; sim.morale = clamp(sim.morale + 2, 0, 100); sim.stars = clamp(sim.stars - 0.05, 1, 5); }),
        choice('Call in a closer', 0, function () {
          var pick = null;
          for (var i = 0; i < STAFF.length; i++) {
            var idS = STAFF[i].id;
            if (sim.removed[idS]) continue;
            if (effectiveStation(sim, run, idS)) continue;
            if (run.days[run.day].callout === idS) continue;
            pick = idS;
            break;
          }
          sim.payroll += 64;
          if (pick) {
            ensureStaff(sim, run, pick, SPOTS.door.x, SPOTS.door.y);
            sim.overrideAll[pick] = 'reg2';
            note(sim, firstName(pick) + ' came in. Payroll +$64.');
          } else note(sim, 'Nobody answered. Payroll still moved +$64.');
        })
      ];
      return card;
    }
    if (id === 'spill') {
      card.title = 'Spill in aisle 3';
      card.body = 'Soda across the tile. People are stepping around it, slowly.';
      card.choices = [
        choice('Cone it off', 0, function () { sim.spillUntil = sim.duration + 5; sim.stars = clamp(sim.stars - 0.08, 1, 5); }),
        choice('Call the floor', 0, function () {
          if (stationPower(sim, run, 'floor') > 0.45) {
            sim.spillUntil = sim.t + 6;
            note(sim, 'Floor is on the way.');
          } else {
            sim.spillUntil = sim.duration + 5;
            note(sim, 'No floor coverage. The cone stays.');
          }
        }),
        choice('Mop it yourself', 1, function () { sim.spillUntil = 0; sim.morale = clamp(sim.morale + 1, 0, 100); })
      ];
      return card;
    }
    if (id === 'theft') {
      card.who = 'cust_teen';
      card.expr = 'neutral';
      card.title = 'Something in a pocket';
      card.body = 'You are not sure. A shopper by the endcap keeps looking at the cameras.';
      card.choices = [
        choice('Let them go', 0, function () {
          sim.sales = Math.max(0, sim.sales - 70);
          sim.stock = Math.max(0, sim.stock - 0.02);
          floater(sim, 900, 400, '-$70', '#ffb4b4');
        }),
        choice('Accuse them out loud', 0, function () {
          if (sim.rng() < 0.5) {
            sim.stars = clamp(sim.stars - 0.05, 1, 5);
            note(sim, 'You were right. It is awkward anyway.');
          } else {
            sim.stars = clamp(sim.stars - 0.26, 1, 5);
            sim.morale = clamp(sim.morale - 6, 0, 100);
            note(sim, 'Wrong person. The aisle goes quiet.');
          }
        }),
        choice('Approach kindly', 1, function () { sim.morale = clamp(sim.morale + 1, 0, 100); note(sim, 'They put it back.'); })
      ];
      return card;
    }
    card.title = 'Store radio';
    card.body = 'Static. Nothing to do.';
    card.choices = [choice('Okay', 0, function () {})];
    return card;
  }

  function resolvePending(sim, run, index) {
    if (!sim.pending) return { ok: false, msg: '' };
    var ch = sim.pending.choices[index];
    if (!ch) return { ok: false, msg: 'Pick a response.' };
    if (ch.cost && sim.actions < ch.cost) return { ok: false, msg: 'No manager action left for that.' };
    if (ch.cost) sim.actions -= ch.cost;
    ch.apply();
    sim.pending = null;
    sim.paused = false;
    return { ok: true, msg: '' };
  }

  function maybeEvent(sim, run) {
    if (sim.coachHold) return;
    if (sim.paused || sim.pending) return;
    if (sim.eventIndex >= sim.events.length) return;
    var when = sim.eventTimes[sim.eventIndex];
    if (sim.t + 1e-4 < when) return;
    var id = sim.events[sim.eventIndex];
    sim.eventIndex++;
    sim.pending = buildEvent(id, sim, run);
    sim.paused = true;
  }

  function step(sim, run, dt) {
    if (!sim || sim.done || sim.paused) return sim;
    if (!(dt > 0)) return sim;
    var limit = sim.duration;
    if (sim.eventIndex < sim.events.length) {
      var when = sim.eventTimes[sim.eventIndex];
      if (when > sim.t && when < limit) limit = when;
    }
    var next = sim.t + dt;
    if (next > limit) next = limit;
    var used = next - sim.t;
    sim.t = next;
    if (!(used > 0)) {
      maybeEvent(sim, run);
      if (!sim.paused && sim.t >= sim.duration - 1e-4) sim.done = true;
      return sim;
    }
    var sh = shiftIndex(sim);
    if (sh !== sim.lastShift) {
      sim.lastShift = sh;
      note(sim, SHIFT_NAMES[sh] + ' shift.');
      for (var i = 0; i < sim.staff.length; i++) sim.staff[i].arrived = false;
    }
    for (var s = 0; s < sim.staff.length; s++) updateStaffActor(sim, run, sim.staff[s], used);
    if (sim.you) {
      if (sim.t >= sim.you.until) sim.you = null;
      else updateStaffActor(sim, run, sim.you, used);
    }
    updateCustomers(sim, run, used);
    var fp = stationPower(sim, run, 'freight');
    var regen = CONFIG.freightRegen * fp * (hasPerk(run, 'freight') ? 1.6 : 1);
    if (sim.truck) {
      sim.stock = Math.max(0, sim.stock - used * 0.01);
      if (fp > 0.35) sim.truckWork += used * fp;
      if (sim.truckWork > 5.5) {
        sim.truck = 0;
        sim.stock = clamp(sim.stock + 0.12, 0, 1);
        note(sim, 'Truck is cleared.');
      }
    } else {
      sim.stock = clamp(sim.stock + used * regen, 0, 1);
    }
    if (sim.spillUntil > sim.t) {
      sim.stars = clamp(sim.stars - used * 0.01, 1, 5);
      if (stationPower(sim, run, 'floor') > 0.65) {
        sim.spillClean += used;
        if (sim.spillClean > 6) { sim.spillUntil = 0; note(sim, 'Spill is gone.'); }
      }
    } else sim.spillClean = 0;
    sim.morale = clamp(sim.morale + used * 0.03, 0, 100);
    var rate = CONFIG.spawn[sh];
    if (sim.t < sim.rushUntil) rate *= 1.72;
    if (sim.t < sim.slowUntil) rate *= 0.62;
    rate *= 0.74 + Math.min(stationPower(sim, run, 'floor'), 1.6) * 0.2;
    if (sim.stock < 0.22) rate *= 0.58;
    sim.spawnAcc += used * rate;
    var guard = 0;
    while (sim.spawnAcc >= 1 && guard < 4) {
      sim.spawnAcc -= 1;
      spawnCustomer(sim, run);
      guard++;
    }
    for (var f = sim.floats.length - 1; f >= 0; f--) {
      sim.floats[f].life -= used;
      sim.floats[f].y -= used * 36;
      if (sim.floats[f].life <= 0) sim.floats.splice(f, 1);
    }
    if (!sim.coins) sim.coins = [];
    for (var ci = sim.coins.length - 1; ci >= 0; ci--) {
      var coin = sim.coins[ci];
      coin.life -= used;
      coin.x += coin.vx * used;
      coin.y += coin.vy * used;
      coin.vy += 50 * used;
      if (coin.life <= 0) sim.coins.splice(ci, 1);
    }
    if (!sim.fx) sim.fx = [];
    for (var fi = sim.fx.length - 1; fi >= 0; fi--) {
      sim.fx[fi].life -= used;
      if (sim.fx[fi].life <= 0) sim.fx.splice(fi, 1);
    }
    if (!sim.pings) sim.pings = [];
    for (var pi = sim.pings.length - 1; pi >= 0; pi--) {
      sim.pings[pi].life -= used;
      if (sim.pings[pi].pop > 0) sim.pings[pi].pop = Math.max(0, sim.pings[pi].pop - used * 2.4);
      if (sim.pings[pi].life <= 0 || sim.pings[pi].dead) sim.pings.splice(pi, 1);
    }
    function coolPop(a) { if (a && a.pop > 0) a.pop = Math.max(0, a.pop - used * 2.4); if (a && a.heart > 0) a.heart = Math.max(0, a.heart - used); }
    for (var sp = 0; sp < sim.staff.length; sp++) coolPop(sim.staff[sp]);
    for (var cp = 0; cp < sim.customers.length; cp++) coolPop(sim.customers[cp]);
    coolPop(sim.you);
    var maxA = sim.actionMax || (CONFIG.baseActions + 1);
    if (sim.actions < maxA) {
      sim.actionFrac = (sim.actionFrac || 0) + used;
      if (sim.actionFrac >= CONFIG.actionRegen) {
        var gain = Math.floor(sim.actionFrac / CONFIG.actionRegen);
        sim.actionFrac -= gain * CONFIG.actionRegen;
        sim.actions = Math.min(maxA, sim.actions + gain);
      }
    }
    if (sim.truck && !sim.hornPlayed) {
      sim.hornPlayed = true;
      hooks.horn();
      if (sim.live) floater(sim, SPOTS.truck.x, SPOTS.truck.y - 36, 'Truck', '#ffe08a', true);
    } else if (!sim.truck) sim.hornPlayed = false;
    maybePing(sim);
    maybeEvent(sim, run);
    if (!sim.paused && sim.t >= sim.duration - 1e-4) sim.done = true;
    return sim;
  }

  function maybePing(sim) {
    if (!sim.live || sim.coachHold || sim.paused || sim.done) return;
    if (!sim.pings) sim.pings = [];
    if (!sim.nextPing) sim.nextPing = sim.t + 4;
    if (sim.t + 1e-4 < sim.nextPing) return;
    sim.nextPing = sim.t + 6.5;
    if (sim.pings.length >= 2) return;
    var kinds = ['basket', 'box', 'help'];
    var kind = kinds[Math.floor(sim.rng() * kinds.length)];
    var spot = kind === 'basket'
      ? { x: SPOTS.reg1.x + 78, y: SPOTS.reg1.y + 8 }
      : kind === 'box'
        ? { x: SPOTS.truck.x + 16, y: SPOTS.truck.y + 78 }
        : SHELVES[Math.floor(sim.rng() * SHELVES.length)];
    sim.pings.push({ kind: kind, x: spot.x, y: spot.y, life: 14, pop: 1, dead: false });
    flashAt(sim, spot.x, spot.y);
  }

  function resolvePing(sim, ping) {
    if (!ping || ping.dead) return;
    ping.dead = true;
    ping.pop = 1;
    flashAt(sim, ping.x, ping.y);
    if (ping.kind === 'basket') {
      var amt = 18 + Math.round(sim.rng() * 18);
      sim.sales += amt;
      sim.checkouts++;
      burstCoins(sim, ping.x, ping.y);
      floater(sim, ping.x, ping.y - 28, '+$' + amt, '#ffe08a', true);
      hooks.kaching();
      return;
    }
    if (ping.kind === 'box') {
      sim.stock = clamp(sim.stock + 0.1, 0, 1);
      floater(sim, ping.x, ping.y - 28, 'Stocked', '#b6f0c8', true);
      return;
    }
    var best = null;
    var bestD = 1e9;
    for (var i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.dead || c.state === 'leave') continue;
      var dx = c.x - ping.x;
      var dy = c.y - ping.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      best.patience = best.maxPatience;
      best.pop = 1;
      best.heart = 0.8;
      best.bubble = null;
    }
    sim.morale = clamp(sim.morale + 2, 0, 100);
    floater(sim, ping.x, ping.y - 28, 'Helped', '#b6f0c8', true);
  }

  function primeShift(sim, run) {
    if (!sim || sim._primed) return;
    sim._primed = true;
    sim.live = true;
    var reg = 'reg1';
    if (stationPower(sim, run, 'reg1') < 0.2 && stationPower(sim, run, 'reg2') > 0.2) reg = 'reg2';
    var ids = ['cust_mom', 'cust_teen', 'cust_biz', 'cust_karen'];
    for (var i = 0; i < 4; i++) {
      var c = makeActor(ids[i], QUEUE[reg].x, QUEUE[reg].y + i * QUEUE[reg].dy);
      c.kind = 'cust';
      c.state = i === 0 ? 'checkout' : 'queue';
      c.reg = reg;
      c.patience = 0.96;
      c.maxPatience = 1;
      c.seq = sim.seq++;
      c.qIndex = i;
      c.checkT = i === 0 ? 0.32 : null;
      sim.customers.push(c);
    }
  }

  function exportSim(sim) {
    var pendingMeta = sim.pending ? { id: sim.pending.id, who: sim.pending.who || null } : null;
    return JSON.parse(JSON.stringify({
      t: sim.t,
      duration: sim.duration,
      sales: sim.sales,
      goal: sim.goal,
      payroll: sim.payroll,
      morale: sim.morale,
      stars: sim.stars,
      stock: sim.stock,
      actions: sim.actions,
      actionMax: sim.actionMax,
      actionFrac: sim.actionFrac || 0,
      truck: sim.truck,
      truckWork: sim.truckWork,
      rushUntil: sim.rushUntil,
      slowUntil: sim.slowUntil,
      discountUntil: sim.discountUntil,
      spillUntil: sim.spillUntil,
      spillClean: sim.spillClean,
      customers: sim.customers,
      staff: sim.staff,
      floats: sim.floats,
      coins: sim.coins || [],
      fx: sim.fx || [],
      pings: sim.pings || [],
      spawnAcc: sim.spawnAcc,
      seq: sim.seq,
      walkouts: sim.walkouts,
      checkouts: sim.checkouts,
      events: sim.events,
      eventIndex: sim.eventIndex,
      eventTimes: sim.eventTimes,
      removed: sim.removed,
      override: sim.override,
      overrideShift: sim.overrideShift,
      overrideAll: sim.overrideAll,
      breakUntil: sim.breakUntil,
      tired: sim.tired,
      you: sim.you,
      done: sim.done,
      lastShift: sim.lastShift,
      hornPlayed: !!sim.hornPlayed,
      nextPing: sim.nextPing || 0,
      _primed: !!sim._primed,
      live: !!sim.live,
      coachHold: !!sim.coachHold,
      rngState: sim.rng && sim.rng.state ? sim.rng.state() : 0,
      pendingMeta: pendingMeta
    }));
  }

  function restoreSim(data, run) {
    var sim = data;
    sim.notes = [];
    sim.rng = mulberry32(1);
    if (sim.rng.setState) sim.rng.setState(data.rngState || 1);
    sim.floats = sim.floats || [];
    sim.coins = sim.coins || [];
    sim.fx = sim.fx || [];
    sim.pings = sim.pings || [];
    sim.pending = null;
    sim.paused = false;
    if (data.pendingMeta && data.pendingMeta.id) {
      sim.pending = buildEvent(data.pendingMeta.id, sim, run, { who: data.pendingMeta.who });
      sim.paused = true;
    }
    return sim;
  }

  function doAction(sim, run, name, target) {
    target = target || {};
    if (!sim || sim.done) return { ok: false, msg: 'The day is over.' };
    if (sim.paused && sim.pending) return { ok: false, msg: 'Answer the card first.' };
    var free = !!target.free;
    if (!free && sim.actions <= 0) return { ok: false, msg: 'Actions are refilling.' };
    function spend() { if (!free) sim.actions--; }
    if (name === 'pull') {
      var reg = (target.station === 'reg1' || target.station === 'reg2') ? target.station
        : (queueOf(sim, 'reg1').length >= queueOf(sim, 'reg2').length ? 'reg1' : 'reg2');
      var pull = null;
      for (var p = 0; p < sim.staff.length; p++) {
        var cand = sim.staff[p];
        if (!cand.id || sim.removed[cand.id]) continue;
        if (cand.station === reg) continue;
        if (cand.station === 'floor' || cand.station === 'freight' || cand.station === 'reg1' || cand.station === 'reg2') {
          pull = cand;
          if (cand.station === 'floor' || cand.station === 'freight') break;
        }
      }
      if (!pull) {
        name = 'cover';
        target = { station: reg, free: free };
      } else {
        spend();
        sim.override[pull.id] = reg;
        sim.overrideShift[pull.id] = shiftIndex(sim);
        pull.arrived = false;
        pull.path = null;
        pull.rush = 3.4;
        pull.pop = 1;
        var dest = SPOTS[reg];
        floater(sim, pull.x, pull.y - 48, firstName(pull.id) + ' →', '#b6f0c8', true);
        floater(sim, dest.x, dest.y - 48, 'Till', '#e0a322', true);
        flashAt(sim, pull.x, pull.y);
        flashAt(sim, dest.x, dest.y);
        return { ok: true, msg: firstName(pull.id) + ' is heading to ' + STATION_LABEL[reg] + '.' };
      }
    }
    if (name === 'cover') {
      var worst = target.station;
      if (!worst || !SPOTS[worst]) {
        worst = 'reg1';
        var worstScore = 1e9;
        var options = ['reg1', 'reg2', 'floor', 'freight'];
        for (var i = 0; i < options.length; i++) {
          var st = options[i];
          var score = stationPower(sim, run, st);
          if (st === 'freight' && (sim.truck || sim.stock < 0.35)) score -= 0.8;
          if ((st === 'reg1' || st === 'reg2') && queueOf(sim, st).length >= 2) score -= 0.5;
          if (score < worstScore) { worstScore = score; worst = st; }
        }
      }
      spend();
      var spot = SPOTS[worst];
      sim.you = makeActor('staff_mgr', spot.x, spot.y);
      sim.you.kind = 'you';
      sim.you.role = 'manager';
      sim.you.station = worst;
      sim.you.until = sim.t + 12;
      sim.you.arrived = true;
      sim.you.pop = 1;
      floater(sim, spot.x, spot.y - 52, 'Cover', '#e0a322', true);
      flashAt(sim, spot.x, spot.y);
      return { ok: true, msg: 'You are on ' + STATION_LABEL[worst] + '.' };
    }
    if (name === 'freight') {
      spend();
      var hadTruck = sim.truck > 0;
      sim.truck = 0;
      sim.hornPlayed = false;
      sim.stock = clamp(sim.stock + 0.22, 0, 1);
      sim.you = makeActor('staff_mgr', SPOTS.truck.x, SPOTS.truck.y + 36);
      sim.you.kind = 'you';
      sim.you.role = 'manager';
      sim.you.station = 'freight';
      sim.you.until = sim.t + 8;
      sim.you.arrived = true;
      sim.you.pop = 1;
      if (sim.pings) {
        for (var bx = 0; bx < sim.pings.length; bx++) if (sim.pings[bx].kind === 'box') sim.pings[bx].dead = true;
      }
      floater(sim, SPOTS.truck.x, SPOTS.truck.y - 20, hadTruck ? 'Unloaded' : 'Stocked', '#ffe08a', true);
      flashAt(sim, SPOTS.truck.x, SPOTS.truck.y);
      return { ok: true, msg: hadTruck ? 'You cleared the truck.' : 'You stocked the shelf.' };
    }
    if (name === 'calm') {
      var upset = target.cust || null;
      if (upset && (upset.dead || upset.state === 'leave')) upset = null;
      if (!upset) {
        var low = 1e9;
        for (var c = 0; c < sim.customers.length; c++) {
          var cust = sim.customers[c];
          if (cust.state === 'leave' || cust.dead) continue;
          if (cust.patience < low) { low = cust.patience; upset = cust; }
        }
      }
      if (!upset) return { ok: false, msg: 'Nobody needs calming.' };
      spend();
      upset.patience = upset.maxPatience;
      upset.bubble = null;
      upset.pop = 1;
      upset.heart = 0.9;
      sim.stars = clamp(sim.stars + 0.06, 1, 5);
      sim.morale = clamp(sim.morale + 2, 0, 100);
      floater(sim, upset.x, upset.y - 56, 'Calm', '#b6f0c8', true);
      flashAt(sim, upset.x, upset.y);
      return { ok: true, msg: 'You calmed a shopper.' };
    }
    return { ok: false, msg: 'Unknown action.' };
  }

  function autoChoice(card, sim) {
    var pick = 0;
    for (var i = card.choices.length - 1; i >= 0; i--) {
      if (!card.choices[i].cost) { pick = i; break; }
    }
    if (card.choices[pick] && card.choices[pick].cost && sim.actions <= 0) {
      for (var k = 0; k < card.choices.length; k++) if (!card.choices[k].cost) return k;
    }
    return pick;
  }

  function smartChoice(card, sim) {
    if (sim.actions > 1) {
      for (var i = 0; i < card.choices.length; i++) if (card.choices[i].cost) return i;
    }
    for (var j = 0; j < card.choices.length; j++) if (!card.choices[j].cost) return j;
    return 0;
  }

  function simulate(ymd, mode) {
    var run = newRun(ymd || '2026-10-19');
    var history = [];
    for (var d = 0; d < 3; d++) {
      run.day = d;
      run.schedule[d] = mode === 'empty' ? blankDay() : greedy(run, d);
      if (mode === 'empty') {
        /* one person so the doors can open in the UI; the empty sim is truly empty */
      }
      var sim = startDay(run);
      if (mode === 'empty') sim.staff = [];
      var guard = 0;
      while (!sim.done && guard < 8000) {
        if (sim.paused && sim.pending) {
          var pick = mode === 'smart' ? smartChoice(sim.pending, sim) : autoChoice(sim.pending, sim);
          resolvePending(sim, run, pick);
        }
        step(sim, run, 0.1);
        guard++;
      }
      var snap = scoreSnapshot(sim);
      snap.done = sim.done;
      snap.guard = guard;
      snap.staff = sim.staff.length;
      history.push(snap);
      run.morale = sim.morale;
      if (mode === 'smart' && d === 0) run.perks.push('action', 'freight');
      if (mode === 'smart' && d === 1 && run.perks.indexOf('key') < 0) run.perks.push('key');
    }
    return history;
  }

  function verifyAtlases() {
    if (typeof require === 'undefined') return { ok: true, skipped: true };
    var fs = require('fs');
    var path = require('path');
    var dir = path.join(__dirname, 'holiday-rush');
    var floor = JSON.parse(fs.readFileSync(path.join(dir, 'floor_chars_atlas.json'), 'utf8'));
    var portraits = JSON.parse(fs.readFileSync(path.join(dir, 'portraits_atlas.json'), 'utf8'));
    var icons = JSON.parse(fs.readFileSync(path.join(dir, 'icons_ui_atlas.json'), 'utf8'));
    var chars = STAFF.map(function (s) { return s.id; }).concat(CUST_IDS);
    var anims = [];
    ['down', 'side', 'up'].forEach(function (dir) {
      anims.push(dir + '_idle_0', dir + '_idle_1');
      for (var w = 0; w < 4; w++) anims.push(dir + '_walk_' + w);
      for (var k = 0; k < 4; k++) anims.push(dir + '_work_' + k);
    });
    if (anims.length !== 30) throw new Error('anim count');
    for (var ci = 0; ci < chars.length; ci++) {
      for (var ai = 0; ai < anims.length; ai++) {
        var key = chars[ci] + '/' + anims[ai];
        var rect = floor.frames[key];
        if (!rect) throw new Error('missing ' + key);
        var i = ci * 30 + ai;
        var col = i % COLS;
        var row = (i / COLS) | 0;
        if (rect[0] !== col * 96 || rect[1] !== row * 96 || rect[2] !== 96 || rect[3] !== 96) {
          throw new Error('grid mismatch ' + key);
        }
      }
    }
    if (floor.left.indexOf('mirror') < 0) throw new Error('left mirror note missing');
    STAFF.forEach(function (s) {
      STAFF_EXPR.forEach(function (ex) {
        if (!portraits[s.id + '_' + ex]) throw new Error('portrait ' + s.id + '_' + ex);
      });
    });
    CUST_IDS.forEach(function (id) {
      CUST_EXPR.forEach(function (ex) {
        if (!portraits[id + '_' + ex]) throw new Error('portrait ' + id + '_' + ex);
      });
    });
    ['angry', 'boss', 'break', 'callout', 'line', 'outstock', 'price', 'return', 'rush', 'spill', 'theft', 'truck'].forEach(function (name) {
      if (!icons['icons/' + name + '.png']) throw new Error('icon ' + name);
    });
    return { ok: true, frames: Object.keys(floor.frames).length, portraits: Object.keys(portraits).length };
  }

  function clockLabel(t, dur) {
    var hours = 8 + (dur > 0 ? t / dur : 0) * 12;
    if (hours >= 20) hours = 19.99;
    var h = Math.floor(hours);
    var m = Math.floor((hours - h) * 60);
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }

  function money(n) {
    n = Math.round(n || 0);
    var s = String(Math.abs(n));
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s.charAt(i);
    }
    return (n < 0 ? '-$' : '$') + out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var onAsset = function () {};

  function loadJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url);
      return r.json();
    }).then(function (data) { onAsset(); return data; });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { onAsset(); resolve(img); };
      img.onerror = function () { reject(new Error(url)); };
      img.src = url;
    });
  }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function metaGet() {
    var m = readJSON('hr_meta_v1') || {};
    return { streak: +m.streak || 0, bestStreak: +m.bestStreak || 0, lastYmd: m.lastYmd || '', played: +m.played || 0 };
  }
  function bestGet(ymd) {
    var b = readJSON('hr_best_v1') || {};
    return +b[ymd] || 0;
  }
  function bestPut(ymd, score) {
    var b = readJSON('hr_best_v1') || {};
    var prev = +b[ymd] || 0;
    if (score > prev) b[ymd] = score;
    writeJSON('hr_best_v1', b);
    return Math.max(prev, score);
  }
  function bumpStreak(ymd) {
    var m = metaGet();
    if (m.lastYmd === ymd) return m;
    if (m.lastYmd && ymdAdd(m.lastYmd, 1) === ymd) m.streak += 1;
    else m.streak = 1;
    m.lastYmd = ymd;
    m.played += 1;
    if (m.streak > m.bestStreak) m.bestStreak = m.streak;
    writeJSON('hr_meta_v1', m);
    return m;
  }

  function track(name, params) {
    if (typeof root.gtag === 'function') {
      root.gtag('event', name, params || {});
    }
  }

  function isQA() {
    return typeof location !== 'undefined' && /(?:\?|&)qa=1(?:&|$)/.test(location.search);
  }

  var booted = false;

  function boot() {
    if (booted) return;
    var app = document.getElementById('hr-app');
    if (!app) return;
    booted = true;

    var els = {
      intro: document.getElementById('hr-intro'),
      plan: document.getElementById('hr-plan'),
      sim: document.getElementById('hr-sim'),
      score: document.getElementById('hr-score'),
      final: document.getElementById('hr-final'),
      toast: document.getElementById('hr-toast'),
      modal: document.getElementById('hr-modal'),
      event: document.getElementById('hr-event'),
      canvas: document.getElementById('hr-canvas'),
      stage: document.getElementById('hr-stage'),
      live: document.getElementById('hr-live'),
      streak: document.getElementById('hr-streak'),
      best: document.getElementById('hr-best'),
      seed: document.getElementById('hr-seed')
    };
    var ctx = els.canvas.getContext('2d', { alpha: false });
    var ymd = utcYmd(new Date());
    var run = null;
    var sim = null;
    var assets = null;
    var armed = null;
    var undo = null;
    var qaSpeed = 1;
    var shownEvent = null;
    var raf = 0;
    var lastTs = 0;
    var cam = { x: 0, y: 0, follow: true };
    var drag = null;
    var moved = false;
    var suppressClick = false;
    var floors = [];
    var toastTimer = 0;
    var liveAcc = 0;
    var simSaveAcc = 0;
    var coach = null;
    var planEditing = false;
    var loadCount = 0;
    var actx = null;
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    els.seed.textContent = ymd;
    paintMeta();

    function paintMeta() {
      var m = metaGet();
      els.streak.textContent = String(m.streak);
      els.best.textContent = bestGet(ymd) ? String(bestGet(ymd)) : '—';
    }

    function toast(msg) {
      if (!msg) return;
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 2400);
    }

    function showFatal(msg) {
      var loading = document.getElementById('hr-loading');
      if (loading) loading.hidden = true;
      els.intro.hidden = false;
      els.intro.innerHTML = '<p class="hr-lead">' + esc(msg) + '</p>';
    }

    function sfx(name) {
      if (root.CGSfx && root.CGSfx.play) root.CGSfx.play(name);
    }
    function buzz(ms) {
      if (root.CGSfx && root.CGSfx.haptic) root.CGSfx.haptic(ms || 12);
    }

    function saveRun() {
      if (!run) return;
      if (sim && run.phase === 'sim' && !sim.done) {
        try { run.simState = exportSim(sim); } catch (e) { run.simState = null; }
      }
      writeJSON('hr_run_v1', run);
    }

    function show(which) {
      var loading = document.getElementById('hr-loading');
      if (loading) loading.hidden = true;
      els.intro.hidden = which !== 'intro';
      els.plan.hidden = which !== 'plan';
      els.sim.hidden = which !== 'sim';
      els.score.hidden = which !== 'score' && which !== 'perk';
      els.final.hidden = which !== 'final';
      document.body.dataset.hrPhase = which;
      if (which !== 'sim') stopLoop();
    }

    function tutDone() {
      try { return localStorage.getItem('hr_tut_done') === '1'; } catch (e) { return false; }
    }

    function hrAudio() {
      if (root.CGSfx && root.CGSfx.isMuted && root.CGSfx.isMuted()) return null;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      if (!actx) {
        try { actx = new AC(); } catch (e) { return null; }
      }
      if (actx.state === 'suspended') {
        try { actx.resume(); } catch (e2) {}
      }
      return actx;
    }

    function tone(a, freq, t, dur, type, vol) {
      var o = a.createOscillator();
      var g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(40, freq), t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    hooks.kaching = function () {
      var a = hrAudio();
      if (!a) return;
      var t = a.currentTime;
      tone(a, 1480, t, 0.06, 'square', 0.045);
      tone(a, 1980, t + 0.055, 0.08, 'square', 0.04);
      tone(a, 2960, t + 0.1, 0.05, 'sine', 0.03);
    };
    hooks.horn = function () {
      var a = hrAudio();
      if (!a) return;
      var t = a.currentTime;
      tone(a, 180, t, 0.18, 'sawtooth', 0.05);
      tone(a, 140, t + 0.08, 0.22, 'square', 0.04);
      tone(a, 180, t + 0.28, 0.16, 'sawtooth', 0.045);
    };
    hooks.tap = function () {
      var a = hrAudio();
      if (!a) return;
      tone(a, 740, a.currentTime, 0.035, 'triangle', 0.035);
    };

    function portraitStyle(id, expr, size) {
      if (!assets) return '';
      var rec = assets.portraits[id + '_' + expr] || assets.portraits[id + '_neutral'] || assets.portraits[id + '_impatient'];
      if (!rec) return '';
      var img = rec[0] === 'staff' ? assets.img.staff : assets.img.cust;
      var scale = size / rec[3];
      return 'background-image:url(' + img.src + ');background-size:' + (img.naturalWidth * scale) + 'px ' + (img.naturalHeight * scale) + 'px;background-position:' + (-rec[1] * scale) + 'px ' + (-rec[2] * scale) + 'px;width:' + size + 'px;height:' + size + 'px;';
    }

    function iconStyle(name, size) {
      var rec = assets.icons['icons/' + name + '.png'] || assets.icons['ui/' + name + '.png'];
      if (!rec) return '';
      var img = assets.img.icons;
      var scale = size / rec[2];
      return 'background-image:url(' + img.src + ');background-size:' + (img.naturalWidth * scale) + 'px ' + (img.naturalHeight * scale) + 'px;background-position:' + (-rec[0] * scale) + 'px ' + (-rec[1] * scale) + 'px;width:' + size + 'px;height:' + size + 'px;';
    }

    function chipHTML(id, from) {
      var s = BY_ID[id];
      var expr = 'neutral';
      if (run.days[run.day].callout === id) expr = 'sick';
      else if (run.morale < 42) expr = 'stressed';
      else if (run.morale > 82) expr = 'happy';
      var avail = run.days[run.day].avail[id] || [0, 0, 0];
      var pips = avail.map(function (on, i) {
        return '<i class="' + (on ? 'on' : '') + '" title="' + SHIFT_NAMES[i] + '"></i>';
      }).join('');
      var fromAttr = from ? ' data-from-shift="' + from.shift + '" data-from-station="' + from.station + '"' : '';
      return '<button type="button" class="hr-chip role-' + s.role + (armed === id ? ' armed' : '') + '" data-staff="' + s.id + '"' + fromAttr + '>' +
        '<span class="hr-avatar" style="' + portraitStyle(s.id, expr, 40) + '"></span>' +
        '<span class="hr-chip__text"><span class="hr-chip__name">' + esc(s.name) + '</span>' +
        '<span class="hr-chip__role"><b style="background:' + ROLE_COLOR[s.role] + '">' + ROLE_LETTER[s.role] + '</b> ' + esc(s.role) + '</span></span>' +
        '<span class="hr-pips" aria-hidden="true">' + pips + '</span></button>';
    }

    function beginFresh() {
      coach = null;
      run = newRun(ymd);
      run.phase = 'sim';
      run.schedule[0] = greedy(run, 0);
      run.acked[0] = true;
      run.suggested = [true, false, false];
      sim = startDay(run);
      saveRun();
      track('holiday_rush_start', { seed: ymd });
      renderSim({ resume: false });
    }

    function ensureSuggested() {
      if (!run.suggested) run.suggested = [false, false, false];
      if (run.day === 0) return;
      if (run.suggested[run.day]) return;
      if (hoursOf(run.schedule[run.day]) === 0) run.schedule[run.day] = greedy(run, run.day);
      run.suggested[run.day] = true;
    }

    function enterPhase() {
      if (!run) return;
      if (run.phase === 'intro') {
        beginFresh();
        return;
      }
      if (run.phase === 'plan') {
        ensureSuggested();
        planEditing = true;
        renderPlan();
      } else if (run.phase === 'sim') {
        var snap = run.simState;
        if (snap && typeof snap.t === 'number' && !snap.done) {
          try {
            sim = restoreSim(snap, run);
            renderSim({ resume: true });
            if (snap.t > 0.4) toast('Shift resumed.');
          } catch (err) {
            sim = startDay(run);
            renderSim({ resume: false });
          }
        } else {
          if (run.day === 0 && hoursOf(run.schedule[0]) < 1) run.schedule[0] = greedy(run, 0);
          sim = startDay(run);
          renderSim({ resume: false });
        }
      } else if (run.phase === 'score' || run.phase === 'perk') renderScore();
      else if (run.phase === 'final') renderFinal();
      else {
        ensureSuggested();
        renderPlan();
      }
      saveRun();
    }

    function renderPlan() {
      show('plan');
      stopLoop();
      var day = run.day;
      var info = run.days[day];
      if (day > 0 && info.callout && !run.acked[day]) {
        var person = BY_ID[info.callout];
        els.modal.hidden = false;
        els.modal.innerHTML =
          '<div class="hr-card" role="dialog" aria-modal="true" aria-labelledby="hr-call-title">' +
          '<div class="hr-card__art"><span class="hr-portrait" style="' + portraitStyle(person.id, 'sick', 96) + '"></span>' +
          '<span class="hr-icon" style="' + iconStyle('callout', 64) + '"></span></div>' +
          '<h2 id="hr-call-title">' + esc(person.name) + ' called out</h2>' +
          '<p>' + esc(person.name.split(' ')[0]) + ' is out for ' + DAY_NAMES[day] + '. Rewrite the board before you open.</p>' +
          '<button type="button" class="btn btn--primary" id="hr-ack">Rewrite the board</button></div>';
        document.getElementById('hr-ack').addEventListener('click', function () {
          run.acked[day] = true;
          if (!run.calloutCounted[day]) {
            run.calloutCounted[day] = true;
            run.callouts++;
          }
          for (var s = 0; s < 3; s++) {
            for (var i = 0; i < STATIONS.length; i++) {
              if (run.schedule[day][s][STATIONS[i]] === person.id) run.schedule[day][s][STATIONS[i]] = null;
            }
          }
          els.modal.hidden = true;
          saveRun();
          renderPlan();
        });
      } else els.modal.hidden = true;

      var hours = hoursOf(run.schedule[day]);
      var pay = payrollOf(run.schedule[day], 0);
      var cells = '';
      cells += '<div class="hr-grid__corner"></div>';
      for (var h = 0; h < 3; h++) {
        cells += '<div class="hr-grid__head">' + SHIFT_NAMES[h] + '<small>' + SHIFT_HOURS[h] + '</small></div>';
      }
      STATIONS.forEach(function (st) {
        var role = st.indexOf('reg') === 0 ? 'register' : st;
        cells += '<div class="hr-grid__label"><i style="background:' + ROLE_COLOR[role] + '"></i>' + STATION_LABEL[st] + '</div>';
        for (var sh = 0; sh < 3; sh++) {
          var sid = run.schedule[day][sh][st];
          cells += '<div class="hr-drop" data-shift="' + sh + '" data-station="' + st + '">';
          if (sid) cells += chipHTML(sid, { shift: sh, station: st });
          else cells += '<button type="button" class="hr-cell" data-shift="' + sh + '" data-station="' + st + '">Empty</button>';
          cells += '</div>';
        }
      });
      var tray = '';
      STAFF.forEach(function (s) {
        var out = info.callout === s.id;
        if (out) {
          tray += '<div class="hr-chip hr-chip--out role-' + s.role + '"><span class="hr-avatar" style="' + portraitStyle(s.id, 'sick', 40) + '"></span><span class="hr-chip__text"><span class="hr-chip__name">' + esc(s.name) + '</span><span class="hr-chip__role">Out today</span></span></div>';
        } else tray += chipHTML(s.id, null);
      });
      var planTitle = day === 0 ? 'Monday crew' : 'Plan tomorrow';
      var planBlurb = day === 0
        ? 'Monday can open with any crew. Tap a name, then a cell.'
        : DAY_NAMES[day] + ' · goal ' + money(info.goal) + '. Auto-schedule fills the board, or edit the crew, then open.';
      var gated = day > 0 && hours < CONFIG.slotHours;
      var showBoard = day === 0 || planEditing;
      els.plan.innerHTML =
        '<div class="hr-plan__head"><div><h2>' + planTitle + '</h2><p>' + esc(planBlurb) + '</p></div>' +
        '<div class="hr-meters"><div><span>Hours</span><strong id="hr-hours">' + hours + ' / ' + CONFIG.hoursBudget + '</strong><div class="hr-bar"><i style="width:' + Math.min(100, hours / CONFIG.hoursBudget * 100) + '%"></i></div></div>' +
        '<div><span>Payroll</span><strong>' + money(pay) + ' / ' + money(CONFIG.payBudget) + '</strong><div class="hr-bar hr-bar--pay"><i style="width:' + Math.min(100, pay / CONFIG.payBudget * 100) + '%"></i></div></div>' +
        '<div><span>Morale</span><strong>' + Math.round(run.morale) + '</strong></div></div></div>' +
        '<p class="hr-legend"><span class="hr-pips" aria-hidden="true"><i class="on"></i><i class="on"></i><i></i></span><span>All 8 people are on this board. Dots run Open, Mid, Close. A gold dot means that shift will take them. A gray dot will refuse the placement. Two shifts max.</span></p>' +
        '<p class="hr-plan-note" id="hr-plan-note" hidden></p>' +
        (showBoard
          ? '<div class="hr-grid" id="hr-grid">' + cells + '</div><div class="hr-tray" id="hr-tray">' + tray + '</div>'
          : '<div class="hr-crew" id="hr-crew">' + [0, 1, 2].map(function (sh) {
            var names = [];
            STATIONS.forEach(function (st) {
              var id = run.schedule[day][sh][st];
              if (id && BY_ID[id]) names.push(firstName(id));
            });
            return '<div><b>' + SHIFT_NAMES[sh] + '</b><span>' + (names.length ? esc(names.join(' · ')) : 'Empty') + '</span></div>';
          }).join('') + '</div>') +
        '<div class="hr-plan__actions">' +
        '<button type="button" class="btn" id="hr-auto">Auto-schedule</button>' +
        '<button type="button" class="btn" id="hr-edit">' + (showBoard ? 'Hide schedule' : 'Edit schedule') + '</button>' +
        '<button type="button" class="btn" id="hr-copy"' + (day === 0 ? ' disabled' : '') + '>Copy yesterday</button>' +
        '<button type="button" class="btn" id="hr-clear">Clear</button>' +
        '<button type="button" class="btn btn--primary" id="hr-open"' + (gated ? ' disabled' : '') + '>Open ' + DAY_NAMES[day] + '</button>' +
        '</div>';
      document.getElementById('hr-auto').addEventListener('click', function () {
        undo = clone(run.schedule[day]);
        run.schedule[day] = greedy(run, day);
        if (!run.suggested) run.suggested = [false, false, false];
        run.suggested[day] = true;
        planEditing = true;
        saveRun();
        renderPlan();
        toast('Schedule filled.');
        sfx('place');
      });
      document.getElementById('hr-edit').addEventListener('click', function () {
        planEditing = !planEditing;
        renderPlan();
      });
      document.getElementById('hr-copy').addEventListener('click', copyYesterday);
      document.getElementById('hr-clear').addEventListener('click', function () {
        undo = clone(run.schedule[day]);
        run.schedule[day] = blankDay();
        saveRun();
        renderPlan();
        toast('Board cleared.');
      });
      document.getElementById('hr-open').addEventListener('click', openDoors);
      if (isQA()) {
        var q = document.createElement('button');
        q.type = 'button';
        q.className = 'btn';
        q.id = 'hr-qa-fill';
        q.textContent = 'QA fill';
        els.plan.querySelector('.hr-plan__actions').appendChild(q);
        q.addEventListener('click', function () {
          run.schedule[day] = greedy(run, day);
          saveRun();
          renderPlan();
        });
      }
    }

    function copyYesterday() {
      if (run.day === 0) return;
      var prev = run.schedule[run.day - 1];
      var avail = run.days[run.day].avail;
      var next = blankDay();
      for (var sh = 0; sh < 3; sh++) {
        for (var i = 0; i < STATIONS.length; i++) {
          var id = prev[sh][STATIONS[i]];
          if (!id) continue;
          var placed = tryPlace(next, avail, id, sh, STATIONS[i], null);
          if (placed.ok) next = placed.schedule;
        }
      }
      undo = clone(run.schedule[run.day]);
      run.schedule[run.day] = next;
      saveRun();
      renderPlan();
      toast('Copied what still fits today.');
    }

    function openDoors() {
      if (run.day > 0 && hoursOf(run.schedule[run.day]) < CONFIG.slotHours) return;
      run.phase = 'sim';
      run.simState = null;
      sim = startDay(run);
      saveRun();
      track('holiday_rush_day_start', { seed: run.ymd, day: run.day + 1 });
      sfx('correct');
      renderSim({ resume: false });
    }

    function renderSim(opts) {
      opts = opts || {};
      show('sim');
      els.modal.hidden = true;
      els.event.hidden = true;
      var ops = run.day >= 1;
      var hud =
        '<div class="hr-clock" id="hr-clock" style="--p:0"><span id="hr-clock-label">8:00 AM</span></div>' +
        '<div class="hr-sales"><div class="hr-sales__top"><span>Sales</span><strong id="hr-sales-text"></strong></div><div class="hr-bar"><i id="hr-sales-bar"></i></div></div>' +
        '<div class="hr-stat hr-stat--stars"><span>Stars</span><strong id="hr-star-text" class="hr-stars"></strong></div>' +
        (ops ? '<div class="hr-stat"><span>Payroll</span><strong id="hr-pay-text"></strong></div><div class="hr-stat"><span>Morale</span><strong id="hr-mor-text"></strong></div>' : '');
      var actions =
        '<button type="button" data-act="cover">Cover a gap</button>' +
        '<button type="button" data-act="pull">Pull to register</button>' +
        '<button type="button" data-act="freight">Work freight</button>' +
        '<button type="button" data-act="calm">Calm a customer</button>';
      els.sim.querySelector('.hr-hud').innerHTML = hud;
      els.sim.querySelector('.hr-actions').innerHTML = actions;
      sim.live = true;
      primeShift(sim, run);
      if (tutDone()) sim.coachHold = false;
      resize();
      requestAnimationFrame(function () { resize(); if (sim && !els.sim.hidden) draw(); });
      focusCam(SPOTS.reg1.x, QUEUE.reg1.y);
      if (!opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else if (opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else paintCoach();
      paintHud();
      draw();
      saveRun();
      if (!root.__hrReadyAt) root.__hrReadyAt = root.performance ? root.performance.now() : 0;
      startLoop();
    }

    function starGlyph(n) {
      var s = '';
      for (var i = 0; i < 3; i++) s += '<i' + (i < n ? ' class="on"' : '') + '>★</i>';
      return s;
    }

    function paintHud() {
      if (!sim) return;
      var label = document.getElementById('hr-clock-label');
      var clock = document.getElementById('hr-clock');
      var salesText = document.getElementById('hr-sales-text');
      if (!label || !salesText) return;
      label.textContent = clockLabel(sim.t, sim.duration);
      if (clock) clock.style.setProperty('--p', String(clamp(sim.t / sim.duration, 0, 1)));
      if (sim._paintSales != null && sim.sales > sim._paintSales && root.CGSfx && root.CGSfx.juice) {
        root.CGSfx.juice(salesText, 'pop');
      }
      sim._paintSales = sim.sales;
      salesText.textContent = money(sim.sales) + ' / ' + money(sim.goal);
      var bar = document.getElementById('hr-sales-bar');
      if (bar) bar.style.width = Math.min(100, sim.goal ? (sim.sales / sim.goal) * 100 : 0) + '%';
      var payEl = document.getElementById('hr-pay-text');
      var morEl = document.getElementById('hr-mor-text');
      if (payEl) payEl.textContent = money(sim.payroll);
      if (morEl) morEl.textContent = String(Math.round(sim.morale));
      var starEl = document.getElementById('hr-star-text');
      if (starEl) starEl.innerHTML = starGlyph(paceStars(sim));
      var act = document.getElementById('hr-actline');
      if (act) {
        var maxA = sim.actionMax || CONFIG.baseActions;
        var fill = sim.actions >= maxA ? 1 : clamp((sim.actionFrac || 0) / CONFIG.actionRegen, 0, 1);
        act.textContent = sim.actions + ' / ' + maxA + ' actions · refills every ' + CONFIG.actionRegen + 's' + (sim.actions < maxA ? ' · ' + Math.round(fill * 100) + '% to the next' : '');
      }
      var buttons = els.sim.querySelectorAll('[data-act]');
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = !!sim.pending;
    }

    function renderEvent() {
      var card = sim.pending;
      if (!card) { els.event.hidden = true; return; }
      els.event.hidden = false;
      var art = '';
      if (card.who) art = '<span class="hr-portrait" style="' + portraitStyle(card.who, card.expr || 'neutral', 96) + '"></span>';
      art += '<span class="hr-icon" style="' + iconStyle(card.icon, 72) + '"></span>';
      var buttons = card.choices.map(function (ch, i) {
        var disabled = ch.cost && sim.actions < ch.cost;
        var cost = ch.cost
          ? '<span class="hr-choice-cost">1 action</span>'
          : '<span class="hr-choice-cost hr-choice-cost--free">Free</span>';
        return '<button type="button" data-choice="' + i + '"' + (disabled ? ' disabled' : '') + '>' + cost + '<span>' + esc(ch.label) + '</span></button>';
      }).join('');
      els.event.innerHTML = '<div class="hr-card" role="dialog" aria-modal="true" aria-labelledby="hr-ev-title"><div class="hr-card__art">' + art + '</div><h2 id="hr-ev-title">' + esc(card.title) + '</h2><p>' + esc(card.body) + '</p><div class="hr-choices">' + buttons + '</div><p class="hr-fine">Paused. You have ' + sim.actions + ' action' + (sim.actions === 1 ? '' : 's') + '. They refill every ' + CONFIG.actionRegen + ' seconds. The cost is on each option.</p></div>';
      els.event.querySelector('.hr-choices').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-choice]');
        if (!btn) return;
        var res = resolvePending(sim, run, +btn.getAttribute('data-choice'));
        if (!res.ok) { toast(res.msg); sfx('miss'); return; }
        sfx('place');
        els.event.hidden = true;
        paintHud();
      });
      if (els.live) els.live.textContent = card.title + '. ' + card.body;
    }

    function finishDay() {
      var snap = scoreSnapshot(sim);
      run.history.push(snap);
      run.morale = clamp(sim.morale, 0, 100);
      run.phase = run.day >= 2 ? 'final' : 'score';
      run.simState = null;
      coach = null;
      sim = null;
      saveRun();
      sfx('correct');
      if (run.phase === 'final') renderFinal();
      else renderScore();
    }

    function renderScore() {
      show('score');
      var snap = run.history[run.history.length - 1];
      var perkBlock = '';
      if (run.phase === 'score') {
        var left = PERKS.filter(function (p) { return run.perks.indexOf(p.id) < 0; });
        perkBlock = '<h3>Pick a perk</h3><div class="hr-perks">' + left.map(function (p) {
          return '<article class="hr-perk"><span class="hr-icon" style="' + iconStyle(p.icon, 56) + '"></span><h4>' + esc(p.name) + '</h4><p>' + esc(p.body) + '</p><button type="button" class="btn btn--primary" data-perk="' + p.id + '">Take this</button></article>';
        }).join('') + '</div>';
      }
      els.score.innerHTML =
        '<p class="hr-kicker">' + DAY_NAMES[run.day] + ' scorecard</p>' +
        '<div class="hr-grade">' + snap.grade + '</div>' +
        '<p class="hr-stars hr-stars--big">' + starGlyph(goalStars(snap.goalPct)) + '</p>' +
        scoreTable([snap], run.day) +
        '<p class="hr-scorebig">' + snap.points + ' pts</p>' +
        perkBlock;
      if (run.phase === 'score') {
        els.score.querySelector('.hr-perks').addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-perk]');
          if (!btn) return;
          var id = btn.getAttribute('data-perk');
          if (run.perks.indexOf(id) < 0) run.perks.push(id);
          if (id === 'cocoa') run.morale = clamp(run.morale + 10, 0, 100);
          run.day += 1;
          run.phase = 'plan';
          ensureSuggested();
          planEditing = true;
          saveRun();
          sfx('correct');
          renderPlan();
        });
      }
    }

    function scoreTable(rows, startIndex) {
      var start = startIndex || 0;
      return '<table class="hr-table"><thead><tr><th>Day</th><th>Sales</th><th>Goal</th><th>Payroll</th><th>Morale</th><th>Stars</th></tr></thead><tbody>' +
        rows.map(function (snap, i) {
          var pct = Math.round(snap.goalPct * 100);
          return '<tr><td>' + DAY_NAMES[start + i] + '</td><td>' + money(snap.sales) + ' · ' + pct + '%</td><td>' + money(snap.goal) + '</td><td>' + money(snap.payroll) + '</td><td>' + snap.morale + '</td><td>' + snap.stars.toFixed(1) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    function shareText(total, pct) {
      var calls = run.callouts;
      return 'Holiday Rush: I hit ' + pct + '% of goal with ' + calls + ' call-out' + (calls === 1 ? '' : 's') + '. Score ' + total + '.';
    }

    function renderFinal() {
      show('final');
      var rows = run.history;
      var total = 0;
      var sales = 0;
      var goal = 0;
      rows.forEach(function (r) { total += r.points; sales += r.sales; goal += r.goal; });
      var pct = goal ? Math.round(100 * sales / goal) : 0;
      var best = bestPut(run.ymd, total);
      var isBest = total >= best && total > 0;
      if (!run.celebrated) {
        run.celebrated = true;
        bumpStreak(run.ymd);
        paintMeta();
        if (root.CGPlayer && root.CGPlayer.record) root.CGPlayer.record('holiday-rush', { score: total, daily: true });
        track('holiday_rush_complete', { seed: run.ymd, score: total, goal_pct: pct });
        if (root.CGDaily && root.CGDaily.mountStreakHints) root.CGDaily.mountStreakHints();
        saveRun();
      }
      var text = shareText(total, pct);
      var finalBody = document.getElementById('hr-final-body');
      var finalHTML =
        '<p class="hr-kicker">Week scorecard · ' + esc(run.ymd) + '</p>' +
        '<h2>Holiday Rush Mart</h2>' +
        '<p class="hr-scorebig">' + total + '</p>' +
        '<p class="hr-lead">' + pct + '% of goal · ' + run.callouts + ' call-out' + (run.callouts === 1 ? '' : 's') + (isBest ? ' · best on this device' : ' · best ' + best) + '</p>' +
        scoreTable(rows, 0) +
        '<pre class="share-box" id="hr-share-box"></pre>' +
        '<button type="button" class="btn btn--primary" id="hr-share">Copy &amp; share</button>' +
        '<button type="button" class="btn" id="hr-again">Run this seed again</button>' +
        '<div class="hr-more"><a href="/games/rift">RIFT</a><a href="/games/gamerdle">Gamerdle</a><a href="/games">All games</a></div>';
      if (finalBody) finalBody.innerHTML = finalHTML;
      else els.final.innerHTML = finalHTML;
      document.getElementById('hr-share-box').textContent = text + '\ncosmicgameshub.com/games/holiday-rush';
      document.getElementById('hr-share').addEventListener('click', function () {
        var payload = { title: 'Holiday Rush: Store Manager', text: text, url: 'https://www.cosmicgameshub.com/games/holiday-rush' };
        var done = function () { toast('Copied.'); sfx('share'); };
        if (root.CGDaily && root.CGDaily.shareResult) {
          Promise.resolve(root.CGDaily.shareResult(payload)).then(done).catch(done);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text + '\ncosmicgameshub.com/games/holiday-rush').then(done).catch(function () { toast('Copy failed.'); });
        }
      });
      document.getElementById('hr-again').addEventListener('click', function () {
        beginFresh();
      });
      if (root.CGDaily && root.CGDaily.mountAll) root.CGDaily.mountAll();
      else if (root.CGDaily && root.CGDaily.mountStreakHints) root.CGDaily.mountStreakHints();
      paintMeta();
    }

    function bakeFloors() {
      floors = [0.45, 0.78, 1].map(function (alpha) {
        var c = document.createElement('canvas');
        c.width = WORLD_W;
        c.height = WORLD_H;
        var g = c.getContext('2d');
        g.drawImage(assets.img.empty, 0, 0, WORLD_W, WORLD_H);
        g.globalAlpha = alpha;
        g.drawImage(assets.img.layout, 0, 0, WORLD_W, WORLD_H);
        g.globalAlpha = 1;
        return c;
      });
    }

    function resize() {
      var stage = els.stage;
      var rect = stage.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(280, Math.round(rect.width));
      var h = Math.max(200, Math.round(rect.height));
      els.canvas.width = Math.round(w * dpr);
      els.canvas.height = Math.round(h * dpr);
      els.canvas.style.width = w + 'px';
      els.canvas.style.height = h + 'px';
      els.canvas._cssW = w;
      els.canvas._cssH = h;
      els.canvas._dpr = dpr;
    }

    function showPlanNote(text) {
      var note = document.getElementById('hr-plan-note');
      if (!note) return;
      note.hidden = !text;
      note.textContent = text || '';
    }

    function markInput() {
      if (!root.__hrInputAt && root.performance) root.__hrInputAt = root.performance.now();
    }

    function focusCam(x, y) {
      var view = viewSize();
      cam.x = clamp(x - view.viewW * 0.5, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(y - view.viewH * 0.62, 0, Math.max(0, WORLD_H - view.viewH));
    }

    function coachFocus() {
      if (!coach || !sim) return null;
      if (coach.step === 0) return { x: SPOTS.reg1.x, y: QUEUE.reg1.y + 20, label: 'Tap the long line' };
      if (coach.step === 1) return { x: SPOTS.truck.x, y: SPOTS.truck.y + 30, label: 'Tap the truck' };
      var angry = null;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        if (c.bubble === 'angry' || (c.maxPatience && c.patience < c.maxPatience * 0.4)) angry = c;
      }
      if (angry) return { x: angry.x, y: angry.y - 10, label: 'Tap the angry shopper' };
      return { x: SPOTS.reg1.x, y: QUEUE.reg1.y, label: 'Tap the angry shopper' };
    }

    function paintCoach() {
      var cap = document.getElementById('hr-coach');
      var skip = document.getElementById('hr-skip');
      var focus = coach ? coachFocus() : null;
      if (cap) {
        cap.hidden = !focus;
        if (focus) cap.textContent = focus.label;
      }
      if (skip) skip.hidden = !coach;
      if (sim) sim.coachHold = !!coach;
      if (focus && els.live) els.live.textContent = focus.label + '. Skip is available.';
    }

    function beginCoach() {
      if (!sim || tutDone() || run.day !== 0) {
        coach = null;
        paintCoach();
        return;
      }
      coach = { step: 0 };
      sim.coachHold = true;
      paintCoach();
      focusCam(SPOTS.reg1.x, QUEUE.reg1.y);
    }

    function endCoach() {
      coach = null;
      if (sim) {
        sim.coachHold = false;
        sim.nextPing = sim.t + 3;
      }
      try { localStorage.setItem('hr_tut_done', '1'); } catch (e) {}
      paintCoach();
      cam.follow = true;
      saveRun();
    }

    function angerSomeone() {
      var pick = null;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        pick = c;
        if (c.charId === 'cust_karen') break;
      }
      if (!pick) return;
      pick.patience = pick.maxPatience * 0.32;
      pick.bubble = 'angry';
      if (pick.state !== 'checkout') pick.state = pick.reg ? 'queue' : 'browse';
      pick.pop = 1;
    }

    function onCoachProgress(name) {
      if (!coach) return;
      var step = coach.step;
      var ok = (step === 0 && (name === 'pull' || name === 'cover')) ||
        (step === 1 && name === 'freight') ||
        (step === 2 && name === 'calm');
      if (!ok) return;
      coach.step++;
      if (coach.step === 1) {
        sim.truck = 1;
        sim.truckWork = 0;
        sim.hornPlayed = false;
      } else if (coach.step === 2) angerSomeone();
      else endCoach();
      var next = coach ? coachFocus() : null;
      if (next) focusCam(next.x, next.y);
      paintCoach();
      draw();
    }

    function coachMatches(name) {
      if (!coach) return false;
      if (coach.step === 0 && (name === 'pull' || name === 'cover')) return true;
      if (coach.step === 1 && name === 'freight') return true;
      if (coach.step === 2 && name === 'calm') return true;
      return false;
    }

    function playerAct(name, target) {
      target = target || {};
      markInput();
      if (!sim) return;
      var point = target.point || { x: SPOTS.reg1.x, y: SPOTS.reg1.y };
      flashAt(sim, point.x, point.y);
      hooks.tap();
      var res = doAction(sim, run, name, {
        station: target.station,
        cust: target.cust,
        free: coachMatches(name),
        point: point
      });
      if (res.ok) {
        if (res.msg) toast(res.msg);
        sfx('place');
        buzz(12);
        onCoachProgress(name);
      } else {
        floater(sim, point.x, point.y - 36, res.msg || 'Nope', '#ffb4b4', true);
        sfx('miss');
        if (res.msg) toast(res.msg);
      }
      paintHud();
      draw();
      saveRun();
    }

    function eventWorld(ev) {
      var rect = els.canvas.getBoundingClientRect();
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      return {
        x: (ev.clientX - rect.left) / scale + cam.x,
        y: (ev.clientY - rect.top) / scale + cam.y
      };
    }

    function screenDist(wx, wy, ev) {
      var rect = els.canvas.getBoundingClientRect();
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      var sx = (wx - cam.x) * scale + rect.left;
      var sy = (wy - cam.y) * scale + rect.top;
      var dx = ev.clientX - sx;
      var dy = ev.clientY - sy;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function pickHit(ev) {
      var best = null;
      var bestD = 36;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        var d = screenDist(c.x, c.y - 36, ev);
        if (d < bestD) { bestD = d; best = { cust: c }; }
      }
      if (best) return best;
      if (sim.pings) {
        for (var p = 0; p < sim.pings.length; p++) {
          var ping = sim.pings[p];
          if (ping.dead) continue;
          if (screenDist(ping.x, ping.y, ev) < 40) return { ping: ping };
        }
      }
      var zones = [
        { station: 'reg1', x: SPOTS.reg1.x, y: (SPOTS.reg1.y + QUEUE.reg1.y) * 0.5 },
        { station: 'reg2', x: SPOTS.reg2.x, y: (SPOTS.reg2.y + QUEUE.reg2.y) * 0.5 },
        { station: 'freight', x: SPOTS.truck.x, y: SPOTS.truck.y + 20 },
        { station: 'floor', x: SPOTS.floor.x, y: SPOTS.floor.y }
      ];
      var zone = null;
      var zoneD = 44;
      for (var z = 0; z < zones.length; z++) {
        var dist = screenDist(zones[z].x, zones[z].y, ev);
        if (dist < zoneD) { zoneD = dist; zone = zones[z]; }
      }
      return zone;
    }

    function onStageTap(ev) {
      if (!sim || els.sim.hidden) return;
      markInput();
      var w = eventWorld(ev);
      var hit = pickHit(ev);
      if (hit && hit.ping) {
        flashAt(sim, hit.ping.x, hit.ping.y);
        hooks.tap();
        resolvePing(sim, hit.ping);
        paintHud();
        draw();
        saveRun();
        return;
      }
      if (!hit) {
        flashAt(sim, w.x, w.y);
        floater(sim, w.x, w.y - 24, '…', '#f6f0e4');
        hooks.tap();
        draw();
        return;
      }
      var act;
      if (hit.cust) {
        var c = hit.cust;
        var angry = c.bubble === 'angry' || (c.maxPatience && c.patience < c.maxPatience * 0.38);
        if (angry || c.state === 'browse' || c.state === 'enter') act = { name: 'calm', cust: c, point: { x: c.x, y: c.y } };
        else if (c.reg) act = { name: 'pull', station: c.reg, point: { x: c.x, y: c.y } };
        else act = { name: 'calm', cust: c, point: { x: c.x, y: c.y } };
      } else if (hit.station === 'freight') act = { name: 'freight', point: { x: SPOTS.truck.x, y: SPOTS.truck.y } };
      else if (hit.station === 'floor') act = { name: 'cover', station: 'floor', point: { x: SPOTS.floor.x, y: SPOTS.floor.y } };
      else act = { name: 'pull', station: hit.station, point: { x: SPOTS[hit.station].x, y: SPOTS[hit.station].y } };
      playerAct(act.name, act);
    }

    function drawTag(text, x, y) {
      ctx.font = '800 16px Outfit, Inter, sans-serif';
      ctx.textAlign = 'center';
      var w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(20,12,16,0.88)';
      ctx.fillRect(x - w / 2, y - 14, w, 18);
      ctx.fillStyle = '#f6f0e4';
      ctx.fillText(text, x, y);
    }

    function drawPatience(x, y, p) {
      var r = 16;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(246,240,228,0.28)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = p > 0.5 ? '#2f9e57' : p > 0.25 ? '#e0a322' : '#d64545';
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.stroke();
    }

    function drawIconAt(name, x, y, size) {
      var ir = assets.icons['icons/' + name + '.png'];
      if (!ir) return;
      ctx.drawImage(assets.img.icons, ir[0], ir[1], ir[2], ir[3], x - size / 2, y - size / 2, size, size);
    }

    function drawPings() {
      if (!sim.pings) return;
      for (var i = 0; i < sim.pings.length; i++) {
        var ping = sim.pings[i];
        if (ping.dead) continue;
        var bob = reduceMotion ? 0 : Math.sin(Date.now() / 200 + i) * 4;
        var icon = ping.kind === 'basket' ? 'price' : ping.kind === 'box' ? 'truck' : 'line';
        var label = ping.kind === 'basket' ? '+$' : ping.kind === 'box' ? 'Box' : 'Help';
        ctx.strokeStyle = 'rgba(224,163,34,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ping.x, ping.y + bob, 26, 0, Math.PI * 2);
        ctx.stroke();
        drawIconAt(icon, ping.x, ping.y + bob, 36);
        drawTag(label, ping.x, ping.y + bob - 28);
      }
    }

    function drawTrouble() {
      var regs = ['reg1', 'reg2'];
      for (var i = 0; i < regs.length; i++) {
        var n = queueOf(sim, regs[i]).length;
        if (n >= 3) {
          drawIconAt('line', SPOTS[regs[i]].x, SPOTS[regs[i]].y - 108, 36);
          drawTag('Line ' + n, SPOTS[regs[i]].x, SPOTS[regs[i]].y - 132);
        }
      }
      if (sim.truck) {
        drawIconAt('truck', SPOTS.truck.x, SPOTS.truck.y - 24, 40);
        drawTag('Truck', SPOTS.truck.x, SPOTS.truck.y - 52);
      }
      if (sim.stock < 0.34) {
        drawIconAt('outstock', SHELVES[0].x, SHELVES[0].y - 70, 34);
        drawTag('Low', SHELVES[0].x, SHELVES[0].y - 96);
      }
    }

    function drawHand(x, y) {
      var bob = reduceMotion ? 0 : Math.sin(Date.now() / 160) * 8;
      ctx.save();
      ctx.translate(x, y + 62 + bob);
      ctx.fillStyle = '#f6f0e4';
      ctx.strokeStyle = '#2b1d2e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(9, -2);
      ctx.lineTo(4, -2);
      ctx.lineTo(4, 18);
      ctx.lineTo(-4, 18);
      ctx.lineTo(-4, -2);
      ctx.lineTo(-9, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function publishCoach(focus) {
      if (!focus || !coach) {
        if (els.stage) {
          delete els.stage.dataset.tx;
          delete els.stage.dataset.ty;
          delete els.stage.dataset.coach;
        }
        return;
      }
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      els.stage.dataset.tx = String(Math.round((focus.x - cam.x) * scale));
      els.stage.dataset.ty = String(Math.round((focus.y - cam.y) * scale));
      els.stage.dataset.coach = String(coach.step);
    }

    function viewSize() {
      var cssW = els.canvas._cssW || 800;
      var cssH = els.canvas._cssH || 450;
      var target = cssW < 720 ? 84 : 96;
      var viewW = CONFIG.sprite * cssW / target;
      if (viewW > WORLD_W) viewW = WORLD_W;
      var viewH = viewW * cssH / cssW;
      if (viewH > WORLD_H) {
        viewH = WORLD_H;
        viewW = viewH * cssW / cssH;
        if (viewW > WORLD_W) viewW = WORLD_W;
      }
      return { viewW: viewW, viewH: viewH, cssW: cssW, cssH: cssH };
    }

    function draw() {
      if (!assets || !els.canvas._cssW) return;
      var dpr = els.canvas._dpr || 1;
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      var focus = sim && coach ? coachFocus() : null;
      if (focus) {
        cam.x = focus.x - view.viewW * 0.5;
        cam.y = focus.y - view.viewH * 0.62;
      } else if (sim && cam.follow) {
        var fx = 0;
        var fy = 0;
        var nCust = 0;
        for (var i = 0; i < sim.customers.length; i++) {
          if (sim.customers[i].state === 'leave') continue;
          fx += sim.customers[i].x;
          fy += sim.customers[i].y;
          nCust++;
        }
        if (!nCust) { fx = SPOTS.reg1.x; fy = QUEUE.reg1.y; nCust = 1; }
        else { fx /= nCust; fy /= nCust; }
        cam.x += ((fx - view.viewW * 0.5) - cam.x) * 0.08;
        cam.y += ((fy - view.viewH * 0.58) - cam.y) * 0.08;
      }
      cam.x = clamp(cam.x, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H - view.viewH));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1a1412';
      ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
      var band = !sim ? 2 : sim.stock < 0.34 ? 0 : sim.stock < 0.67 ? 1 : 2;
      if (floors[band]) ctx.drawImage(floors[band], 0, 0);
      if (sim) {
        SHELVES.forEach(function (sh) {
          ctx.fillStyle = 'rgba(43,29,46,0.35)';
          ctx.fillRect(sh.x - 28, sh.y - 46, 56, 8);
          ctx.fillStyle = sim.stock > 0.66 ? '#2f9e57' : sim.stock > 0.33 ? '#e0a322' : '#d64545';
          ctx.fillRect(sh.x - 28, sh.y - 46, 56 * clamp(sim.stock, 0, 1), 8);
        });
        var drawList = [];
        for (var s = 0; s < sim.staff.length; s++) if (!sim.staff[s].hidden) drawList.push(sim.staff[s]);
        for (var c = 0; c < sim.customers.length; c++) drawList.push(sim.customers[c]);
        if (sim.you) drawList.push(sim.you);
        drawList.sort(function (a, b) { return a.y - b.y; });
        for (var d = 0; d < drawList.length; d++) drawActor(drawList[d]);
        drawPings();
        drawTrouble();
        if (sim.coins) {
          for (var ci = 0; ci < sim.coins.length; ci++) {
            var coin = sim.coins[ci];
            ctx.globalAlpha = clamp(coin.life, 0, 1);
            ctx.fillStyle = '#e0a322';
            ctx.beginPath();
            ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2b1d2e';
            ctx.font = '800 11px Outfit, Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('$', coin.x, coin.y + 4);
          }
        }
        if (sim.fx) {
          for (var fi = 0; fi < sim.fx.length; fi++) {
            var burst = sim.fx[fi];
            var u = 1 - clamp(burst.life / 0.38, 0, 1);
            ctx.globalAlpha = clamp(burst.life / 0.38, 0, 1);
            ctx.strokeStyle = '#ffe08a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(burst.x, burst.y, 10 + u * 36, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        for (var f = 0; f < sim.floats.length; f++) {
          var fl = sim.floats[f];
          ctx.globalAlpha = clamp(fl.life, 0, 1);
          ctx.fillStyle = fl.color;
          ctx.font = (fl.big ? '800 28px ' : '700 20px ') + 'Outfit, Inter, sans-serif';
          ctx.fillText(fl.text, fl.x, fl.y);
        }
        ctx.globalAlpha = 1;
        if (focus) {
          ctx.strokeStyle = 'rgba(224,163,34,0.95)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(focus.x, focus.y, 28 + (reduceMotion ? 0 : Math.sin(Date.now() / 180) * 4), 0, Math.PI * 2);
          ctx.stroke();
          drawHand(focus.x, focus.y);
          publishCoach(focus);
        } else publishCoach(null);
      }
    }

    function drawActor(a) {
      var dir = a.face < 0 ? 'side' : a.dir;
      if (a.face < 0) dir = 'side';
      var count = a.anim === 'idle' ? 2 : 4;
      var frame = a.frame % count;
      var key = a.charId + '/' + dir + '_' + a.anim + '_' + frame;
      var rect = assets.floor.frames[key];
      if (!rect) return;
      var size = CONFIG.sprite;
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.face < 0) ctx.scale(-1, 1);
      if (a.anim === 'walk' && !reduceMotion) {
        var squash = 1 + Math.sin(a.frame * 1.4) * 0.05;
        ctx.scale(1, squash);
      }
      if (!reduceMotion && a.pop > 0) ctx.scale(1 + a.pop * 0.22, 1 + a.pop * 0.22);
      if (a.role && ROLE_COLOR[a.role]) {
        ctx.fillStyle = ROLE_COLOR[a.role];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(0, -4, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(assets.img.floor, rect[0], rect[1], rect[2], rect[3], -size / 2, -size + 8, size, size);
      ctx.restore();
      if (a.kind === 'cust' && a.state !== 'leave' && a.maxPatience) {
        drawPatience(a.x, a.y - size - 8, clamp(a.patience / a.maxPatience, 0, 1));
      }
      if (a.bubble) {
        var ir = assets.icons['icons/' + a.bubble + '.png'];
        if (ir) {
          ctx.drawImage(assets.img.icons, ir[0], ir[1], ir[2], ir[3], a.x - 16, a.y - size - 46, 32, 32);
        }
      }
      if (a.kind === 'staff' && a.id) {
        var tag = firstName(a.id);
        if (a.rush > 1) tag += ' →';
        drawTag(tag, a.x, a.y - size - 16);
      } else if (a.kind === 'you') {
        drawTag('YOU', a.x, a.y - size - 16);
      }
      if (a.heart > 0) drawTag('♥', a.x, a.y - size - 40);
    }

    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      if (dt > 0.05) dt = 0.05;
      if (sim && !sim.paused && !sim.done) {
        var speed = isQA() ? qaSpeed : 1;
        if (coach && sim.sales > 0) speed *= 0.34;
        step(sim, run, dt * speed);
        while (sim.notes.length) toast(sim.notes.shift());
        if (sim.pending && shownEvent !== sim.pending) {
          shownEvent = sim.pending;
          renderEvent();
        }
        if (!sim.pending) shownEvent = null;
        paintHud();
        liveAcc += dt;
        if (liveAcc > 5 && els.live) {
          liveAcc = 0;
          els.live.textContent = DAY_NAMES[run.day] + ' ' + clockLabel(sim.t, sim.duration) + ', sales ' + money(sim.sales) + ' of ' + money(sim.goal) + ', morale ' + Math.round(sim.morale) + ', ' + (Math.round(sim.stars * 10) / 10) + ' stars.';
        }
        if (sim.done) finishDay();
        simSaveAcc += dt;
        if (simSaveAcc > 1) { simSaveAcc = 0; saveRun(); }
      }
      if (!els.sim.hidden) draw();
    }

    function startLoop() {
      if (raf) return;
      lastTs = 0;
      raf = requestAnimationFrame(loop);
    }
    function stopLoop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        saveRun();
        stopLoop();
      } else if (sim && !els.sim.hidden) {
        lastTs = 0;
        startLoop();
      }
    });
    window.addEventListener('pagehide', saveRun);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { resize(); if (!els.sim.hidden) draw(); });
      ro.observe(els.stage);
    } else {
      window.addEventListener('resize', resize);
    }

    els.stage.addEventListener('pointerdown', function (ev) {
      if (els.sim.hidden || ev.button > 0) return;
      if (ev.target.closest && ev.target.closest('button')) return;
      cam.drag = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, moved: false };
      if (!coach) cam.follow = false;
      try { els.stage.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    els.stage.addEventListener('pointermove', function (ev) {
      if (!cam.drag) return;
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      var mx = ev.clientX - cam.drag.x;
      var my = ev.clientY - cam.drag.y;
      if (Math.abs(mx) + Math.abs(my) > 14) cam.drag.moved = true;
      if (!cam.drag.moved) return;
      cam.x = clamp(cam.drag.cx - mx / scale, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(cam.drag.cy - my / scale, 0, Math.max(0, WORLD_H - view.viewH));
    });
    function endPan(ev) {
      var wasTap = cam.drag && !cam.drag.moved;
      if (cam.drag && cam.drag.moved) {
        setTimeout(function () { if (!coach) cam.follow = true; }, 2200);
      } else if (!coach) cam.follow = true;
      cam.drag = null;
      if (wasTap && ev && !(ev.target && ev.target.closest && ev.target.closest('button'))) onStageTap(ev);
    }
    els.stage.addEventListener('pointerup', endPan);
    els.stage.addEventListener('pointercancel', endPan);

    var skipBtn = document.getElementById('hr-skip');
    if (skipBtn) skipBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      markInput();
      endCoach();
      hooks.tap();
    });

    els.sim.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn || !sim) return;
      if (root.CGSfx && root.CGSfx.juice) root.CGSfx.juice(btn, 'pop');
      var name = btn.getAttribute('data-act');
      var point = name === 'freight' ? { x: SPOTS.truck.x, y: SPOTS.truck.y }
        : name === 'calm' ? { x: SPOTS.reg1.x, y: QUEUE.reg1.y }
        : { x: SPOTS.reg1.x, y: SPOTS.reg1.y };
      playerAct(name, { point: point });
    });

    els.plan.addEventListener('pointerdown', function (ev) {
      var chip = ev.target.closest('.hr-chip[data-staff]');
      if (!chip || chip.classList.contains('hr-chip--out')) return;
      moved = false;
      drag = {
        id: chip.getAttribute('data-staff'),
        from: chip.hasAttribute('data-from-shift') ? {
          shift: +chip.getAttribute('data-from-shift'),
          station: chip.getAttribute('data-from-station')
        } : null,
        x: ev.clientX,
        y: ev.clientY,
        pointerId: ev.pointerId
      };
      chip.setPointerCapture(ev.pointerId);
    });
    document.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 8) {
        moved = true;
        if (!drag.ghost) {
          drag.ghost = document.createElement('div');
          drag.ghost.className = 'hr-ghost';
          drag.ghost.innerHTML = chipHTML(drag.id, null);
          document.body.appendChild(drag.ghost);
        }
        drag.ghost.style.left = ev.clientX + 'px';
        drag.ghost.style.top = ev.clientY + 'px';
      }
    });
    document.addEventListener('pointerup', function (ev) {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      var id = drag.id;
      var from = drag.from;
      var ghost = drag.ghost;
      var px = ev.clientX;
      var py = ev.clientY;
      drag = null;
      if (ghost) ghost.remove();
      if (!moved) return;
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      var under = document.elementFromPoint(px, py);
      var drop = under && under.closest('[data-shift][data-station]');
      var tray = under && under.closest('#hr-tray');
      if (tray || !drop) {
        if (from) {
          undo = clone(run.schedule[run.day]);
          run.schedule[run.day][from.shift][from.station] = null;
          saveRun();
          sfx('place');
          renderPlan();
          toast(firstName(id) + ' is off the board.');
        }
        return;
      }
      placeId(id, +drop.getAttribute('data-shift'), drop.getAttribute('data-station'), from);
    });

    els.plan.addEventListener('click', function (ev) {
      if (suppressClick) { suppressClick = false; return; }
      var chip = ev.target.closest('.hr-chip[data-staff]');
      var cell = ev.target.closest('[data-shift][data-station]');
      if (chip && !cell) {
        var id = chip.getAttribute('data-staff');
        armed = armed === id ? null : id;
        renderPlan();
        return;
      }
      if (!cell) return;
      var shift = +cell.getAttribute('data-shift');
      var station = cell.getAttribute('data-station');
      var occupied = cell.querySelector('.hr-chip[data-staff]');
      var occId = occupied ? occupied.getAttribute('data-staff') : null;
      var from = occupied && occupied.hasAttribute('data-from-shift') ? {
        shift: +occupied.getAttribute('data-from-shift'),
        station: occupied.getAttribute('data-from-station')
      } : null;
      if (armed) {
        placeId(armed, shift, station, null);
        armed = null;
        return;
      }
      if (occId && from) {
        undo = clone(run.schedule[run.day]);
        run.schedule[run.day][from.shift][from.station] = null;
        saveRun();
        sfx('place');
        renderPlan();
        toast(firstName(occId) + ' is off the board.');
      }
    });

    function placeId(id, shift, station, from) {
      var avail = run.days[run.day].avail;
      if (from && from.shift === shift && from.station === station) return;
      var res = tryPlace(run.schedule[run.day], avail, id, shift, station, from);
      if (!res.ok) {
        var row = (run.days[run.day].avail && run.days[run.day].avail[id]) || [0, 0, 0];
        var msg = res.reason;
        if (!row[shift]) {
          var bits = [0, 1, 2].map(function (i) {
            return SHIFT_NAMES[i] + (row[i] ? ' (gold)' : ' (gray)');
          }).join(', ');
          msg = firstName(id) + ': dots are ' + bits + '. ' + SHIFT_NAMES[shift] + ' is gray, so that cell will not take them.';
        }
        showPlanNote(msg);
        sfx('miss');
        var cell = els.plan.querySelector('[data-shift="' + shift + '"][data-station="' + station + '"]');
        if (cell) cell.classList.add('shake');
        return;
      }
      undo = clone(run.schedule[run.day]);
      run.schedule[run.day] = res.schedule;
      saveRun();
      sfx('place');
      buzz(8);
      renderPlan();
      var drop = els.plan.querySelector('[data-shift="' + shift + '"][data-station="' + station + '"]');
      if (drop) drop.classList.add('stamped');
    }

    onAsset = function () {
      loadCount++;
      var bar = document.getElementById('hr-loadbar');
      var lab = document.getElementById('hr-load-label');
      var pct = Math.min(100, Math.round(100 * loadCount / 9));
      if (bar) bar.style.width = pct + '%';
      if (bar && bar.parentNode) bar.parentNode.setAttribute('aria-valuenow', String(pct));
      if (lab) lab.textContent = pct < 100 ? 'Setting the floor' : 'Doors open';
    };

    Promise.all([
      loadImage(ART + 'floor_chars.png8.png'),
      loadImage(ART + 'portraits_staff.png8.png'),
      loadImage(ART + 'portraits_customers.png8.png'),
      loadImage(ART + 'icons_ui.png8.png'),
      loadImage(ART + 'store_layout_1600.webp'),
      loadImage(ART + 'store_empty_1600.webp'),
      loadJSON(ART + 'floor_chars_atlas.json'),
      loadJSON(ART + 'portraits_atlas.json'),
      loadJSON(ART + 'icons_ui_atlas.json')
    ]).then(function (all) {
      assets = {
        img: { floor: all[0], staff: all[1], cust: all[2], icons: all[3], layout: all[4], empty: all[5] },
        floor: all[6],
        portraits: all[7],
        icons: all[8]
      };
      bakeFloors();
      resize();
      var saved = readJSON('hr_run_v1');
      if (saved && saved.ymd === ymd && saved.phase && saved.phase !== 'intro') {
        run = saved;
        if (!run.suggested) run.suggested = [false, false, false];
        track('holiday_rush_resume', { seed: ymd });
        enterPhase();
      } else {
        beginFresh();
      }
      track('holiday_rush_open', { seed: ymd });
    }).catch(function () {
      showFatal('The store art did not load. Refresh the page to try again.');
    });

    root.HolidayRush._debug = {
      turbo: function (n) { if (isQA()) qaSpeed = n || 1; },
      fill: function () {
        if (!isQA() || !run) return;
        run.schedule[run.day] = greedy(run, run.day);
        saveRun();
        if (run.phase === 'plan') renderPlan();
      },
      ack: function () {
        if (!isQA() || !run) return;
        var day = run.day;
        var info = run.days[day];
        if (info.callout && !run.acked[day]) {
          run.acked[day] = true;
          if (!run.calloutCounted[day]) { run.calloutCounted[day] = true; run.callouts++; }
          renderPlan();
        }
      }
    };
  }

  var api = {
    boot: boot,
    newRun: newRun,
    greedy: greedy,
    simulate: simulate,
    verifyAtlases: verifyAtlases,
    startDay: startDay,
    step: step,
    scoreSnapshot: scoreSnapshot,
    CONFIG: CONFIG,
    STAFF: STAFF,
    _debug: {}
  };
  root.HolidayRush = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  if (typeof process !== 'undefined' && process.argv && process.argv.indexOf('--self-test') >= 0) {
    var atlas = verifyAtlases();
    var greedyRun = simulate('2026-10-19', 'greedy');
    var emptyRun = simulate('2026-10-19', 'empty');
    var bad = false;
    function check(list, label) {
      list.forEach(function (row, i) {
        if (!row.done || !isFinite(row.points) || row.points < 0) bad = true;
        console.log(label, i, 'sales', row.sales, 'goal', row.goal, 'pct', Math.round(row.goalPct * 100), 'pts', row.points, 'out', row.walkouts, 'in', row.checkouts, 'morale', row.morale, 'stars', row.stars, 'pay', row.payroll);
      });
    }
    console.log('atlas', JSON.stringify(atlas));
    check(greedyRun, 'greedy');
    check(emptyRun, 'empty');
    var gPct = greedyRun.reduce(function (s, r) { return s + r.goalPct; }, 0) / 3;
    var ePct = emptyRun.reduce(function (s, r) { return s + r.goalPct; }, 0) / 3;
    console.log('avgPct', Math.round(gPct * 100), Math.round(ePct * 100), 'bad', bad);
    if (bad || gPct < 0.9 || ePct > 0.45 || ePct > gPct) process.exit(1);
  }
})(typeof window !== 'undefined' ? window : globalThis);
