/* Holiday Rush: Store Manager
   People are the v10 per-type sprite packs in games/holiday-rush/sprites/.
   The room is assembled from games/holiday-rush/objects/ (floor kit, fixtures,
   props). Glow overlays use additive blending. A missing type draws as a
   silhouette. localStorage only. No accounts. */
(function (root) {
  'use strict';
  if (typeof document === 'undefined' && typeof require === 'function') {
    var hrJoin = require('path');
    var hrSrc = hrJoin.join(__dirname, 'holiday-rush', 'src');
    require(hrJoin.join(hrSrc, 'data.js'));
    require(hrJoin.join(hrSrc, 'entities.js'));
    require(hrJoin.join(hrSrc, 'economy.js'));
    require(hrJoin.join(hrSrc, 'layout.js'));
    require(hrJoin.join(hrSrc, 'world.js'));
    require(hrJoin.join(hrSrc, 'save.js'));
    require(hrJoin.join(hrSrc, 'sprites.js'));
    require(hrJoin.join(hrSrc, 'sim.js'));
    require(hrJoin.join(hrSrc, 'render.js'));
    require(hrJoin.join(hrSrc, 'room.js'));
    require(hrJoin.join(hrSrc, 'ui.js'));
  }
  var HR = root.HRParts || {};

  var ART = 'holiday-rush/';
  var WORLD_W = 1600;
  var WORLD_H = 900;
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  var SHIFT_NAMES = ['Open', 'Mid', 'Close'];
  var SHIFT_HOURS = ['8–12', '12–4', '4–8'];
  var STATIONS = ['reg1', 'reg2', 'floor', 'freight'];
  var STATION_LABEL = { reg1: 'Register A', reg2: 'Register B', reg3: 'Register C', floor: 'Floor', freight: 'Freight' };
  var reg3Live = false;
  var activeLayout = null;
  var spriteSession = null;
  var floorDirty = false;
  var PAL = {
    ink: '#2a1c18',
    cream: '#f6f0e4',
    gold: '#e0a322',
    red: '#c4363a',
    green: '#2f7d4a',
    blue: '#2d4c7c',
    wood: '#6b4228',
    woodDark: '#3e2618',
    floorA: '#e4c7a0',
    floorB: '#d1aa78',
    wall: '#5c2c38',
    trim: '#f3e6d0'
  };
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
    goals: [6400, 7600, 9000],
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
    actionRegen: 9,
    comboWindow: 3.4,
    comboMax: 10,
    star1: 0.75,
    star2: 1,
    star3: 1.2,
    earnRate: 0.1
  };

  var SHIFT_COUNT = 15;
  var WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3'];
  var SHIFT_DEFS = (function () {
    var defs = [];
    for (var i = 0; i < SHIFT_COUNT; i++) {
      var t = i / (SHIFT_COUNT - 1);
      defs.push({
        name: DAY_NAMES[i % 5],
        short: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i % 5],
        week: WEEK_LABELS[(i / 5) | 0],
        label: WEEK_LABELS[(i / 5) | 0] + ' · ' + DAY_NAMES[i % 5],
        goal: Math.round(7500 * Math.pow(1.062, i)),
        spawn: +(0.86 + t * 0.52).toFixed(3),
        patience: +(1.12 - t * 0.46).toFixed(3),
        rushAt: +(0.58 - t * 0.1).toFixed(3)
      });
    }
    return defs;
  })();

  var UPGRADES = [
    { id: 'stock', name: 'Faster stocking', max: 3, costs: [500, 950, 1600], icon: 'truck', blurb: 'The truck unloads faster and shelves refill between sales.' },
    { id: 'register', name: 'Extra register', max: 2, costs: [750, 1500], icon: 'line', blurb: 'A backup cashier. Both lines check out faster.' },
    { id: 'patience', name: 'Patience boost', max: 3, costs: [450, 850, 1400], icon: 'break', blurb: 'Shoppers wait longer before they walk out.' },
    { id: 'hustle', name: 'Quicker actions', max: 2, costs: [600, 1100], icon: 'boss', blurb: 'Manager actions come back sooner.' },
    { id: 'baskets', name: 'Upsell baskets', max: 2, costs: [650, 1200], icon: 'price', blurb: 'Every checkout rings a little higher.' }
  ];

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
  var LOOKS = {
    staff_mgr: { scale: 1.06, skin: '#e7b896', hair: '#2a1a14', style: 'bun', top: '#6d2740', bottom: '#241820', shoes: '#1a120c', vest: '#4a1a2c' },
    staff_reg1: { scale: 1, skin: '#c68642', hair: '#1a120c', style: 'short', top: '#f4f0e8', bottom: '#2c2428', shoes: '#1a120c', vest: '#c4363a' },
    staff_reg2: { scale: 0.98, skin: '#8d5524', hair: '#1a120c', style: 'pony', top: '#f4f0e8', bottom: '#3a2a3a', shoes: '#1a120c', vest: '#c4363a', glasses: 1 },
    staff_frt1: { scale: 1.05, skin: '#f0c8a0', hair: '#5a3a28', style: 'cap', top: '#2d4c7c', bottom: '#24344c', shoes: '#1a120c', beard: 1 },
    staff_frt2: { scale: 1, skin: '#c68642', hair: '#0e3d38', style: 'hijab', top: '#2d4c7c', bottom: '#24344c', shoes: '#1a120c' },
    staff_flr1: { scale: 1, skin: '#e0ac7a', hair: '#3a2418', style: 'curly', top: '#2f7d4a', bottom: '#243028', shoes: '#1a120c' },
    staff_flr2: { scale: 0.96, skin: '#f3d0b0', hair: '#c47a3a', style: 'bob', top: '#f6f0e4', bottom: '#5c3a4a', shoes: '#3a2418', vest: '#2f7d4a' },
    staff_flr3: { scale: 1.08, skin: '#6b3e2a', hair: '#1a120c', style: 'fade', top: '#1e2a24', bottom: '#1e2a24', shoes: '#1a120c', vest: '#246b40' },
    cust_mom: { scale: 1, skin: '#e0ac7a', hair: '#4a2c20', style: 'bun', top: '#c46a3a', bottom: '#6b2438', shoes: '#2a1c18', wide: 1 },
    cust_grandpa: { scale: 0.94, skin: '#e7c4a0', hair: '#d9d3c7', style: 'bald', top: '#6e7a4a', bottom: '#4a4038', shoes: '#2a241c', cane: 1, stoop: 1 },
    cust_kid: { scale: 0.68, skin: '#f0c8a0', hair: '#6b3a22', style: 'short', top: '#e23b3b', bottom: '#2a4e96', shoes: '#f2d15a' },
    cust_biz: { scale: 1.04, skin: '#d2a679', hair: '#2a241c', style: 'neat', top: '#243656', bottom: '#1c2740', shoes: '#141820', tie: 1 },
    cust_teen: { scale: 1.02, skin: '#c68642', hair: '#1a120c', style: 'hood', top: '#2a2a32', bottom: '#3a3a44', shoes: '#f6f0e4' },
    cust_karen: { scale: 1, skin: '#f3d0b0', hair: '#e6c878', style: 'big', top: '#7a3e86', bottom: '#3a2444', shoes: '#2a1c18', wide: 1 },
    cust_sweater: { scale: 1, skin: '#e7b896', hair: '#c45a28', style: 'short', top: '#c4363a', bottom: '#c4a574', shoes: '#6b4228' }
  };
  // Body frames are <type>/<anim>_<dir>_<index>.png. Portraits are
  // portraits/<type>_<expr>.png. Indexed PNGs with a tRNS chunk count as
  // transparent. Feet sit on source y=158. displayH matches CONFIG.sprite
  // so the whole cast shares one scale and the camera stays sharp.
  var SPRITE_PACK = {
    perTypeBudget: 110 * 1024,
    budget: 110 * 1024,
    displayH: 78,
    footY: 158,
    types: ['rusher', 'haggle', 'family', 'lift', 'regular', 'kid', 'crew_manager', 'crew_register', 'crew_freight', 'crew_floor'],
    crewExpr: ['neutral', 'happy', 'stressed', 'angry', 'sick', 'proud'],
    custExpr: ['neutral', 'impatient', 'angry', 'delighted']
  };
  var SPRITE_TYPE_BY_ID = {
    staff_mgr: 'crew_manager',
    staff_reg1: 'crew_register',
    staff_reg2: 'crew_register',
    staff_frt1: 'crew_freight',
    staff_frt2: 'crew_freight',
    staff_flr1: 'crew_floor',
    staff_flr2: 'crew_floor',
    staff_flr3: 'crew_floor',
    cust_mom: 'family',
    cust_grandpa: 'regular',
    cust_kid: 'kid',
    cust_biz: 'rusher',
    cust_teen: 'lift',
    cust_karen: 'haggle',
    cust_sweater: 'ugly_sweater'
  };

  function spriteTypeFor(actor) {
    if (!actor) return 'regular';
    if (actor.charId === 'cust_kid') return 'kid';
    if (actor.charId === 'cust_sweater') return 'ugly_sweater';
    if (actor.kind === 'you') return 'crew_manager';
    if (actor.kind === 'staff' || (actor.id && BY_ID[actor.id])) {
      var role = actor.role || (BY_ID[actor.id] && BY_ID[actor.id].role) || 'floor';
      if (role === 'manager') return 'crew_manager';
      if (role === 'register') return 'crew_register';
      if (role === 'freight') return 'crew_freight';
      return 'crew_floor';
    }
    if (actor.arch === 'rusher') return 'rusher';
    if (actor.arch === 'haggle' || actor.haggling) return 'haggle';
    if (actor.arch === 'family') return 'family';
    if (actor.arch === 'lift') return 'lift';
    return 'regular';
  }

  function classifySpriteFile(rel) {
    if (HR.sprites && HR.sprites.classify) {
      var spec = HR.sprites.classify(rel);
      if (!spec) return null;
      if (spec.kind === 'frame') return { kind: 'frame', type: spec.type, anim: spec.anim, dir: spec.dir, index: spec.index };
      if (spec.kind === 'portrait') return { kind: 'portrait', key: spec.key, expr: spec.expr };
      return spec;
    }
    var name = String(rel || '').replace(/\\/g, '/').replace(/^\//, '');
    var frame = name.match(/^([a-z0-9_]+)\/(idle|walk|work)_(down|side|up)_(\d+)\.png$/);
    if (frame) {
      if (SPRITE_PACK.types.indexOf(frame[1]) < 0) return null;
      return { kind: 'frame', type: frame[1], anim: frame[2], dir: frame[3], index: +frame[4] };
    }
    var port = name.match(/^portraits\/([a-z0-9_]+)_([a-z]+)\.png$/);
    if (!port) return null;
    var key = port[1];
    var expr = port[2];
    var crew = key.indexOf('crew_') === 0 || key.indexOf('staff_') === 0;
    var allowed = crew ? SPRITE_PACK.crewExpr : SPRITE_PACK.custExpr;
    if (allowed.indexOf(expr) < 0) return null;
    if (SPRITE_PACK.types.indexOf(key) < 0 && !SPRITE_TYPE_BY_ID[key]) return null;
    return { kind: 'portrait', key: key, expr: expr };
  }

  function pngInfo(bytes) {
    if (!bytes || bytes.length < 26) return null;
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
    var w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    var h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { w: w >>> 0, h: h >>> 0, color: bytes[25] };
  }

  function pngHasAlpha(bytes) {
    var info = pngInfo(bytes);
    if (!info) return false;
    if (info.color === 4 || info.color === 6) return true;
    if (info.color !== 3) return false;
    var i = 8;
    var n = bytes.length;
    while (i + 12 <= n) {
      var len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      var kind = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (kind === 'tRNS') return true;
      if (kind === 'IDAT' || kind === 'IEND') return false;
      if (len > n) return false;
      i += 12 + len;
    }
    return false;
  }

  function spriteFrameList(sheet, anim, dir) {
    if (!sheet) return null;
    var tries = [
      anim + '|' + dir,
      anim + '|down',
      (anim === 'work' ? 'idle' : anim) + '|' + dir,
      'idle|' + dir,
      'idle|down',
      'walk|down'
    ];
    for (var i = 0; i < tries.length; i++) {
      var list = sheet[tries[i]];
      if (list && list.length) return list;
    }
    return null;
  }

  function spritePackComplete(types, portraits) {
    for (var i = 0; i < SPRITE_PACK.types.length; i++) {
      var t = SPRITE_PACK.types[i];
      var sheet = types[t];
      if (!sheet || !sheet['idle|down'] || !sheet['idle|down'].length) return false;
      if (!sheet['walk|down'] || !sheet['walk|down'].length) return false;
      if (!portraits[t] || !portraits[t].neutral) return false;
    }
    return true;
  }
  var ARCH_ORDER = [
    { id: 'rusher', day: 5, who: 'cust_biz' },
    { id: 'haggle', day: 7, who: 'cust_karen' },
    { id: 'family', day: 10, who: 'cust_mom' },
    { id: 'lift', day: 12, who: 'cust_teen' }
  ];
  var ARCH_CARD = {
    rusher: {
      title: 'New shopper: Rusher',
      icon: 'rush',
      body: 'Red streaks, small basket. They cut through the aisle and leave if the line looks slow. Pull a cashier onto the till before they bail.'
    },
    haggle: {
      title: 'New shopper: Coupon haggler',
      icon: 'price',
      body: 'They stop at the register with a coupon. Tap them to honor it and keep the full sale. Leave them and they pay less.'
    },
    family: {
      title: 'New shopper: Big-cart family',
      icon: 'line',
      body: 'A parent, a kid, and a cart that fills the aisle. Slow, but the basket is huge. Keep a till clear for them.'
    },
    lift: {
      title: 'New shopper: Shoplifter',
      icon: 'theft',
      body: 'Hood up, no basket, heading for the door. Tap them to catch the item. If they leave, you lose stock and a star.'
    }
  };
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
    { id: 'g1', type: 'gondola', dept: 'toys', x: 480, y: 460, label: 'TOYS' },
    { id: 'g2', type: 'gondola', dept: 'seasonal', x: 800, y: 260, label: 'TREATS' },
    { id: 'g3', type: 'gondola', dept: 'seasonal', x: 800, y: 520, label: 'WRAP' },
    { id: 'g4', type: 'gondola', dept: 'toys', x: 1140, y: 460, label: 'CARDS' }
  ];

  function primarySku(sh) {
    var label = (sh && sh.label) || '';
    var dept = (sh && sh.dept) || '';
    if (dept === 'electronics' || label === 'LIGHTS') return 'lights';
    if (dept === 'cafe' || label === 'CAFE') return 'cocoa';
    if (label === 'SEASON') return 'globe';
    if (label === 'TREATS') return 'cocoa';
    if (label === 'WRAP') return 'paper';
    if (label === 'CARDS' || label === 'TOYS' || label === 'PLUSH' || dept === 'toys') return 'candy';
    if (dept === 'seasonal') return 'paper';
    return 'cocoa';
  }

  function shelfPriceTag(sh, books) {
    if (!books || !HR.economy || !HR.data || !HR.data.get()) return null;
    var item = HR.data.get().items.byId[primarySku(sh)];
    if (!item || !HR.economy.itemUnlocked(books, item)) return null;
    var price = HR.economy.priceOf(books, item);
    return { item: item, price: price, markup: item.msrp ? price / item.msrp : 1 };
  }

  function priceTurn(sim, cust) {
    if (!sim.books || !HR.economy || !HR.economy.shelfReaction || !cust.shelf) return false;
    var tag = shelfPriceTag(cust.shelf, sim.books);
    if (!tag) return false;
    var reaction = HR.economy.shelfReaction(tag.item, tag.price, sim.rng());
    if (reaction.act === 'refuse') {
      walkout(sim, cust);
      cust.bubble = 'price';
      floater(sim, cust.x, cust.y - 78, tag.item.name + ' ' + money(tag.price), '#ffb4b4', true);
      sim.priceWalks = (sim.priceWalks || 0) + 1;
      return true;
    }
    if (reaction.act === 'grumble') {
      cust.patience *= reaction.patience || 0.72;
      cust.maxPatience = Math.max(cust.maxPatience || 0, cust.patience);
      cust.bubble = 'price';
      cust.pop = 1;
      sim.grumbles = (sim.grumbles || 0) + 1;
      floater(sim, cust.x, cust.y - 78, 'Too steep', '#ffd0a8');
      if (sim.floorOn && !sim._grumbleTold) {
        sim._grumbleTold = true;
        note(sim, 'Too steep. They still queue, and their patience drops.');
      }
    }
    return false;
  }

  var QUEUE = {
    reg1: { x: 496, y: 800, dy: 32 },
    reg2: { x: 752, y: 800, dy: 32 }
  };

  function stationList() {
    if (!reg3Live) return STATIONS;
    return ['reg1', 'reg2', 'reg3', 'floor', 'freight'];
  }

  function isTill(st) {
    return st === 'reg1' || st === 'reg2' || st === 'reg3';
  }

  function registers() {
    var list = [];
    if (SPOTS.reg1) list.push('reg1');
    if (SPOTS.reg2) list.push('reg2');
    if (SPOTS.reg3) list.push('reg3');
    return list;
  }

  function trafficBlocked(id) {
    if (!id || !activeLayout || !HR.layout || !HR.layout.wantsGrid(activeLayout)) return false;
    if (trafficBlocked._layout !== activeLayout || trafficBlocked._n !== activeLayout.fixtures.length) {
      trafficBlocked._layout = activeLayout;
      trafficBlocked._n = activeLayout.fixtures.length;
      trafficBlocked._set = {};
      var report = HR.layout.traffic(activeLayout);
      for (var i = 0; i < report.blocked.length; i++) trafficBlocked._set[report.blocked[i]] = true;
    }
    return !!trafficBlocked._set[id];
  }

  function busiestRegister(sim) {
    var regs = registers();
    var best = regs[0] || 'reg1';
    var n = -1;
    for (var i = 0; i < regs.length; i++) {
      if (trafficBlocked(regs[i])) continue;
      var q = queueOf(sim, regs[i]).length;
      if (q > n) { n = q; best = regs[i]; }
    }
    return best;
  }

  var PERKS = [
    { id: 'key', name: 'Better key carrier', icon: 'boss', body: 'Maren works any station like a specialist for the rest of the week.' },
    { id: 'freight', name: 'Faster freight', icon: 'truck', body: 'Truck and shelf work restocks about 60% faster.' },
    { id: 'action', name: 'Extra manager action', icon: 'stamp_0', body: 'Four manager actions each remaining day, instead of three.' },
    { id: 'cocoa', name: 'Break-room cocoa', icon: 'break', body: 'Morale jumps now, and shoppers wait a little longer before they leave.' }
  ];

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

  function traceRound(g, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }
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

  function blankShift() { return { reg1: null, reg2: null, reg3: null, floor: null, freight: null }; }
  function blankDay() { return [blankShift(), blankShift(), blankShift()]; }
  function blankCampaign() {
    var days = [];
    for (var i = 0; i < SHIFT_COUNT; i++) days.push(blankDay());
    return days;
  }
  function shiftDef(index) {
    if (index < 0) index = 0;
    if (index >= SHIFT_DEFS.length) index = SHIFT_DEFS.length - 1;
    return SHIFT_DEFS[index];
  }
  function shiftLabel(index) { return shiftDef(index).label; }
  function upgradeLevel(run, id) {
    if (!run || !run.upgrades) return 0;
    var n = +run.upgrades[id] || 0;
    if (n < 0) return 0;
    return n;
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function hoursOf(daySched) {
    var stations = stationList();
    var h = 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < stations.length; i++) if (daySched[s][stations[i]]) h += CONFIG.slotHours;
    }
    return h;
  }

  function shiftsOf(daySched, id) {
    var stations = stationList();
    var n = 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < stations.length; i++) if (daySched[s][stations[i]] === id) n++;
    }
    return n;
  }

  function payrollOf(daySched, extra) {
    var stations = stationList();
    var pay = extra || 0;
    for (var s = 0; s < 3; s++) {
      for (var i = 0; i < stations.length; i++) {
        var id = daySched[s][stations[i]];
        if (!id || !BY_ID[id]) continue;
        var person = BY_ID[id];
        var rate = person.wage || (person.role === 'manager' ? CONFIG.rateMgr : CONFIG.rate);
        pay += rate * CONFIG.slotHours;
      }
    }
    return pay;
  }

  function scheduled(daySched, shift, id) {
    var stations = stationList();
    for (var i = 0; i < stations.length; i++) {
      if (daySched[shift][stations[i]] === id) return stations[i];
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
      grumbles: sim.grumbles || 0,
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
    for (var d = 0; d < SHIFT_COUNT; d++) {
      var prof = shiftDef(d);
      var nEvents = Math.min(5, 2 + Math.floor(d / 4));
      var ids = shuffleIds(rng, EVENT_IDS).slice(0, nEvents);
      var wobble = 0.98 + rng() * 0.04;
      var goal = Math.round(prof.goal * wobble);
      days.push({ avail: rollAvail(rng), goal: goal, events: ids, callout: null });
    }
    var cday = 5 + Math.floor(rng() * 7);
    var pool = STAFF.filter(function (s) { return s.role !== 'manager'; });
    var who = pool[Math.floor(rng() * pool.length)];
    days[cday].callout = who.id;
    days[cday].avail[who.id] = [0, 0, 0];
    days[cday].events = days[cday].events.filter(function (id) { return id !== 'callout'; });
    for (var et = 0; et < days.length; et++) days[et].eventTimes = rushSlots(days[et].events.length);
    return {
      v: 3,
      ymd: ymd,
      day: 0,
      phase: 'sim',
      schedule: blankCampaign(),
      perks: [],
      upgrades: {},
      morale: 78,
      history: [],
      callouts: 0,
      acked: [],
      calloutCounted: [],
      suggested: [],
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
    if (reg3Live) order.push([1, 'reg3'], [0, 'reg3'], [2, 'reg3']);
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
    var clearStations = stationList();
    for (var i = 0; i < clearStations.length; i++) {
      if (copy[shift][clearStations[i]] === id) copy[shift][clearStations[i]] = null;
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

  function makeActor(charId, x, y, pooled) {
    var a = pooled || {};
    a.charId = charId;
    a.x = x; a.y = y;
    a.dir = 'down';
    a.face = 1;
    a.anim = 'idle';
    a.frame = 0;
    a.frameT = 0;
    a.arrived = false;
    a.path = null;
    a.pathI = 0;
    a.hidden = false;
    a.station = null;
    a.shelfI = 0;
    a.workT = 0;
    a.bubble = null;
    a.dead = false;
    a.sold = false;
    a.walked = false;
    a.arch = '';
    a.receipt = '';
    a.haggling = false;
    a.haggleT = 0;
    a.checkT = null;
    a.intro = false;
    a.angry = false;
    a.saleMul = 1;
    a.basketMul = 1;
    a.speedMul = 1;
    a.reg = null;
    a.heart = 0;
    a.caught = false;
    a.prowlT = 0;
    a.state = '';
    a.kind = '';
    a.id = null;
    a.role = null;
    a.qIndex = 0;
    a.pop = 0;
    a.tired = false;
    a.rush = 0;
    return a;
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
    if (activeLayout && HR.layout) {
      var routed = HR.layout.route(activeLayout, x, y, tx, ty);
      if (routed && routed.length) return routed;
    }
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

  function rushSlots(count) {
    var seg = CONFIG.daySeconds / 3;
    var peaks = [
      seg * 0.8,
      seg + seg * 0.8,
      seg * 2 + seg * 0.8,
      seg * 0.46,
      seg + seg * 0.42
    ];
    var times = [];
    var n = count > peaks.length ? peaks.length : count;
    for (var i = 0; i < n; i++) times.push(Math.round(peaks[i] * 10) / 10);
    times.sort(function (a, b) { return a - b; });
    return times;
  }

  function heatOf(sim, run) {
    var idx = run && typeof run.day === 'number' ? run.day : 0;
    var prof = shiftDef(idx);
    var seg = (sim.duration || CONFIG.daySeconds) / 3;
    var local = seg > 0 ? (sim.t % seg) / seg : 0;
    var rushAt = prof.rushAt > 0.3 ? prof.rushAt : 0.58;
    var wave;
    var rush = false;
    if (local < rushAt) wave = 0.68 + (local / rushAt) * 0.42;
    else {
      rush = true;
      var span = 1 - rushAt;
      var r = span > 0 ? (local - rushAt) / span : 1;
      if (r < 0) r = 0;
      if (r > 1) r = 1;
      wave = 1.08 + Math.sin(r * Math.PI) * (0.92 + idx * 0.012);
    }
    var close = sim.duration ? sim.t / sim.duration : 0;
    if (close > 0.84) {
      rush = true;
      wave *= 1.1 + Math.min(0.08, idx * 0.006);
    }
    var patience = prof.patience * (rush ? 0.82 : 1);
    patience *= 1 + 0.11 * upgradeLevel(run, 'patience');
    var drain = (1 / Math.max(0.55, prof.patience)) * (rush ? 1.34 : 0.92);
    if (sim.coachHold) {
      wave *= 0.5;
      rush = false;
      patience = prof.patience > 1 ? prof.patience : 1;
      drain = 0.45;
    }
    return { spawn: prof.spawn * wave, patience: patience, drain: drain, rush: rush, wave: wave, day: idx };
  }

  function comboMult(n) {
    if (n <= 1) return 1;
    var m = 1 + (n - 1) * 0.35;
    return m > 4 ? 4 : m;
  }

  function multLabel(n) {
    var tenths = Math.round(comboMult(n) * 10) / 10;
    if (Math.abs(tenths - Math.round(tenths)) < 0.05) return '×' + Math.round(tenths);
    return '×' + tenths.toFixed(1);
  }

  function hasPerk(run, id) { return run.perks.indexOf(id) >= 0; }

  function skillMul(actor, station, run, sim) {
    var need = isTill(station) ? 'register' : station;
    var m = 0.56;
    if (actor.role === need) m = 1.34;
    if (actor.role === 'manager') m = hasPerk(run, 'key') ? 1.75 : 1.2;
    if (actor.tired) m *= 0.84;
    var morale = sim ? sim.morale : 70;
    m *= 0.76 + clamp(morale, 0, 100) / 260;
    m *= actor.arrived ? 1 : 0.5;
    if (sim && sim.books && actor && actor.id && HR.sim) m *= HR.sim.trainMul(sim.books, actor.id);
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
    if (isTill(station)) p += 0.62 * upgradeLevel(run, 'register');
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
    var cap = sim.customers && sim.customers.length > 40 ? 6 : 16;
    if (sim.floats.length > cap) sim.floats.shift();
    sim.floats.push({ x: x, y: y, text: text, color: color || '#ffe08a', life: big ? 1.25 : 1.05, big: !!big });
  }

  var hooks = {
    kaching: function () {},
    horn: function () {},
    tap: function () {},
    sale: function () {},
    coin: function () {},
    angry: function () {},
    goal: function () {},
    fanfare: function () {},
    rush: function () {},
    action: function () {},
    alert: function () {},
    heat: function () {}
  };

  var reduceMotion = false;
  try {
    if (typeof matchMedia === 'function') reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e1) {}

  function burstCoins(sim, x, y) {
    if (sim.customers && sim.customers.length > 40) return;
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

  function addShake(sim, mag) {
    if (!sim || reduceMotion) return;
    sim.shake = Math.max(sim.shake || 0, mag);
  }

  function addPunch(sim, sec, tint) {
    if (!sim) return;
    sim.punch = Math.max(sim.punch || 0, reduceMotion ? Math.min(sec, 0.035) : sec);
    sim.flash = Math.max(sim.flash || 0, reduceMotion ? 0.18 : 0.55);
    sim.flashTint = tint || 'gold';
  }

  function spawnConfetti(sim, x, y) {
    if (sim.customers && sim.customers.length > 40) return;
    if (!sim.confetti) sim.confetti = [];
    var n = reduceMotion ? 8 : 40;
    var colors = ['#d64545', '#2f9e57', '#e0a322', '#f6f0e4', '#7ec8ff'];
    for (var i = 0; i < n; i++) {
      if (sim.confetti.length > 48) sim.confetti.shift();
      var ang = (i / n) * Math.PI * 2;
      var speed = reduceMotion ? 0 : 150 + (i % 5) * 34;
      sim.confetti.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - (reduceMotion ? 0 : 70),
        life: reduceMotion ? 0.55 : 1.2,
        color: colors[i % colors.length],
        rot: ang,
        vr: reduceMotion ? 0 : (i % 2 ? 7 : -7),
        w: 5 + (i % 3) * 3,
        h: 8 + (i % 2) * 3
      });
    }
  }

  function markGoal(sim, x, y) {
    if (!sim || sim.goalBurst) return;
    if (!(sim.goal > 0) || sim.sales < sim.goal) return;
    sim.goalBurst = true;
    var gx = x || SPOTS.reg1.x;
    var gy = y || (SPOTS.reg1.y - 30);
    spawnConfetti(sim, gx, gy);
    addShake(sim, 16);
    addPunch(sim, 0.14, 'gold');
    floater(sim, gx, gy - 78, 'GOAL', '#fff4c2', true);
    hooks.goal();
  }

  function tapFx(sim, x, y) {
    if (!sim) return;
    if (!sim.taps) sim.taps = [];
    if (sim.taps.length > 12) sim.taps.shift();
    sim.taps.push({ x: x, y: y, life: 0.32 });
  }

  function decayFx(sim, used) {
    if (!sim || !(used > 0)) return;
    if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - used * 22);
    if (sim.flash > 0) sim.flash = Math.max(0, sim.flash - used * 1.7);
    if (sim.floats) {
      for (var f = sim.floats.length - 1; f >= 0; f--) {
        sim.floats[f].life -= used;
        sim.floats[f].y -= used * 36;
        if (sim.floats[f].life <= 0) sim.floats.splice(f, 1);
      }
    }
    if (sim.coins) {
      for (var ci = sim.coins.length - 1; ci >= 0; ci--) {
        var coin = sim.coins[ci];
        coin.life -= used;
        coin.x += coin.vx * used;
        coin.y += coin.vy * used;
        coin.vy += 50 * used;
        if (coin.life <= 0) sim.coins.splice(ci, 1);
      }
    }
    if (sim.fx) {
      for (var fi = sim.fx.length - 1; fi >= 0; fi--) {
        sim.fx[fi].life -= used;
        if (sim.fx[fi].life <= 0) sim.fx.splice(fi, 1);
      }
    }
    if (sim.confetti) {
      for (var k = sim.confetti.length - 1; k >= 0; k--) {
        var bit = sim.confetti[k];
        bit.life -= used;
        bit.x += bit.vx * used;
        bit.y += bit.vy * used;
        bit.vy += (reduceMotion ? 0 : 280) * used;
        bit.rot += bit.vr * used;
        if (bit.life <= 0) sim.confetti.splice(k, 1);
      }
    }
    if (sim.taps) {
      for (var ti = sim.taps.length - 1; ti >= 0; ti--) {
        sim.taps[ti].life -= used;
        if (sim.taps[ti].life <= 0) sim.taps.splice(ti, 1);
      }
    }
    if (sim.pings) {
      for (var pp = 0; pp < sim.pings.length; pp++) {
        if (sim.pings[pp].pop > 0) sim.pings[pp].pop = Math.max(0, sim.pings[pp].pop - used * 2.4);
      }
    }
    function coolPop(a) {
      if (a && a.pop > 0) a.pop = Math.max(0, a.pop - used * 2.4);
      if (a && a.heart > 0) a.heart = Math.max(0, a.heart - used);
    }
    if (sim.staff) for (var sp = 0; sp < sim.staff.length; sp++) coolPop(sim.staff[sp]);
    if (sim.customers) for (var cp = 0; cp < sim.customers.length; cp++) coolPop(sim.customers[cp]);
    coolPop(sim.you);
  }

  function goalStars(pct) {
    if (pct >= CONFIG.star3) return 3;
    if (pct >= CONFIG.star2) return 2;
    if (pct >= CONFIG.star1) return 1;
    return 0;
  }

  function paceStars(sim) {
    if (!sim || sim.sales <= 0) return 0;
    if (sim.goal && sim.sales >= sim.goal * CONFIG.star3) return 3;
    var elapsed = clamp(sim.duration ? sim.t / sim.duration : 0, 0.16, 1);
    var projected = sim.sales / elapsed;
    var ratio = sim.goal ? projected / sim.goal : 0;
    return goalStars(ratio);
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
      eventTimes: (day.eventTimes && day.eventTimes.length) ? day.eventTimes.slice() : rushSlots(day.events.length || 4),
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
      combo: 0,
      bestCombo: 0,
      lastSaleAt: -99,
      goalBurst: false,
      shake: 0,
      flash: 0,
      flashTint: 'gold',
      punch: 0,
      confetti: [],
      taps: [],
      rushOn: false,
      rushTold: false,
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
    sim.pool = HR.entities ? HR.entities.createPool() : null;
    sim.spatial = HR.entities ? HR.entities.createSpatial(96) : null;
    return sim;
  }

  function tickAnim(a, dt) {
    if (a.anim === 'work') {
      a.frame = 0;
      a.frameT = 0;
      return;
    }
    a.frameT += dt;
    var fps = a.anim === 'walk' ? 8 : 2;
    var count = a.anim === 'walk' ? 4 : 2;
    if (a.frameT >= 1 / fps) {
      a.frameT -= 1 / fps;
      if (a.frameT > 1 / fps) a.frameT = 0;
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
    if (isTill(st) && SPOTS[st]) target = SPOTS[st];
    else if (st === 'floor' && SHELVES.length) target = SHELVES[(a.shelfI || 0) % SHELVES.length];
    else if (st === 'freight') {
      var loop = [SPOTS.truck, SHELVES[0], SHELVES[1], SHELVES[3]].filter(function (spot) { return spot && spot.x != null; });
      if (sim.truck || !loop.length) loop = [SPOTS.truck];
      target = loop[(a.shelfI || 0) % loop.length];
    }
    if (!target) target = SPOTS.stock;
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
      if (a.workT > dwell && !isTill(st)) {
        a.workT = 0;
        a.arrived = false;
        a.shelfI++;
      }
      if (isTill(st)) {
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

  function archDef(id) {
    for (var i = 0; i < ARCH_ORDER.length; i++) if (ARCH_ORDER[i].id === id) return ARCH_ORDER[i];
    return null;
  }

  function archKnown(run, id) {
    if (run && run.met && run.met[id]) return true;
    var camp = campaignGet();
    return !!(camp.met && camp.met[id]);
  }

  function dueIntro(run) {
    var day = run && run.day ? run.day : 0;
    for (var i = 0; i < ARCH_ORDER.length; i++) {
      var row = ARCH_ORDER[i];
      if (day >= row.day && !archKnown(run, row.id)) return row.id;
    }
    return '';
  }

  function lifterAlive(sim) {
    for (var i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.arch === 'lift' && !c.dead && c.state !== 'leave') return true;
    }
    return false;
  }

  function rollArch(sim, run) {
    var day = run && run.day ? run.day : 0;
    var bag = [];
    if (archKnown(run, 'rusher') && day >= 5) bag.push('rusher');
    if (archKnown(run, 'haggle') && day >= 7) bag.push('haggle');
    if (archKnown(run, 'family') && day >= 10) bag.push('family', 'family');
    if (archKnown(run, 'lift') && day >= 12 && !lifterAlive(sim)) bag.push('lift');
    if (!bag.length) return '';
    var weighted = ['', '', '', '', '', ''].concat(bag);
    return weighted[Math.floor(sim.rng() * weighted.length)];
  }

  function tuneArch(c, arch) {
    c.arch = arch || '';
    if (arch === 'rusher') {
      c.speedMul = 1.72;
      c.basketMul = 0.74;
      c.patience *= 0.5;
      c.maxPatience = c.patience;
    } else if (arch === 'haggle') {
      c.speedMul = 0.92;
      c.patience *= 0.95;
      c.maxPatience = c.patience;
    } else if (arch === 'family') {
      c.speedMul = 0.64;
      c.basketMul = 2.25;
      c.patience *= 1.45;
      c.maxPatience = c.patience;
    } else if (arch === 'lift') {
      c.speedMul = 1.08;
      c.state = 'prowl';
      c.prowlT = 2.4;
      c.path = null;
      c.bubble = null;
    }
  }

  function applyTenantTune(sim, c) {
    if (!sim || !sim.tenant || !c) return;
    var mechanic = sim.tenant.mechanic;
    if (mechanic === 'demo' && c.arch === 'family') c.saleMul *= 1.35;
    else if (mechanic === 'bench') {
      c.patience *= 1.35;
      c.maxPatience = c.patience;
      c.saleMul *= 1.45;
    } else if (mechanic === 'cups') c.saleMul *= 0.65;
  }

  function spawnCustomer(sim, run, forcedArch) {
    var cap = HR.sim ? HR.sim.custCap(sim, CONFIG.custCap) : CONFIG.custCap;
    if (sim.customers.length >= cap) {
      if (!forcedArch) return;
      var dropped = false;
      for (var n = sim.customers.length - 1; n >= 0; n--) {
        if (sim.customers[n].state === 'leave' || !sim.customers[n].arch) {
          sim.customers.splice(n, 1);
          dropped = true;
          break;
        }
      }
      if (!dropped) return;
    }
    var arch = forcedArch || rollArch(sim, run);
    if (!forcedArch && sim.tenant && sim.tenant.bias && sim.rng() < 0.4) arch = sim.tenant.bias;
    var spec = arch ? archDef(arch) : null;
    var dayN = run && run.day ? run.day : 0;
    var bag = ['cust_mom', 'cust_teen', 'cust_biz', 'cust_mom', 'cust_kid', 'cust_grandpa', 'cust_teen', 'cust_karen', 'cust_biz'];
    if (sim.live) {
      bag = ['cust_grandpa', 'cust_mom', 'cust_kid', 'cust_mom', 'cust_grandpa'];
      if (dayN >= 1) bag.push('cust_sweater');
      if (dayN >= 5) bag.push('cust_biz', 'cust_biz');
      if (dayN >= 7) bag.push('cust_karen');
      if (dayN >= 12) bag.push('cust_teen', 'cust_teen');
    }
    var id = spec ? spec.who : bag[Math.floor(sim.rng() * bag.length)];
    var shelf = SHELVES[Math.floor(sim.rng() * SHELVES.length)];
    if (sim.live && shelf && shelf.id && trafficBlocked(shelf.id)) {
      for (var si = 0; si < SHELVES.length; si++) {
        if (!trafficBlocked(SHELVES[si].id)) { shelf = SHELVES[si]; break; }
      }
    }
    var heat = sim._heat || { patience: 1, rush: false };
    var patience = (0.86 + sim.rng() * 0.28) * heat.patience;
    if (id === 'cust_karen') patience *= 0.7;
    if (id === 'cust_kid') patience *= 0.88;
    if (id === 'cust_grandpa') patience *= 1.18;
    if (hasPerk(run, 'cocoa')) patience *= 1.14;
    var c = makeActor(id, SPOTS.door.x + (sim.rng() * 50 - 25), SPOTS.door.y, sim.pool ? sim.pool.acquire() : null);
    c.kind = 'cust';
    c.state = 'enter';
    c.shelf = shelf;
    c.patience = patience;
    c.maxPatience = patience;
    c.path = pathVia(c.x, c.y, shelf.x, shelf.y);
    c.pathI = 0;
    c.seq = sim.seq++;
    c.reg = null;
    c.speedMul = 1;
    c.basketMul = 1;
    c.saleMul = 1;
    tuneArch(c, arch);
    applyTenantTune(sim, c);
    if (forcedArch) {
      c.x = SPOTS.floor.x + 36;
      c.y = SPOTS.floor.y + 16;
      c.intro = true;
      if (c.arch !== 'lift') {
        c.state = 'enter';
        c.path = pathVia(c.x, c.y, shelf.x, shelf.y);
        c.pathI = 0;
      }
    }
    sim.customers.push(c);
    return c;
  }

  function dismissTypeCard(sim, run) {
    if (!sim || !sim.typeCard) return '';
    var metId = sim.typeCard;
    sim.typeCard = '';
    sim.typeUntil = 0;
    if (run) {
      if (!run.met) run.met = {};
      run.met[metId] = 1;
    }
    var camp = campaignGet();
    if (!camp.met) camp.met = {};
    camp.met[metId] = 1;
    campaignPut(camp);
    return metId;
  }

  function maybeTypeIntro(sim, run) {
    if (!sim.floorOn || sim.coachHold || sim.paused || sim.done || sim.typeCard || sim._introDone) return;
    var id = dueIntro(run);
    if (!id || sim.t < 5.5) return;
    var born = spawnCustomer(sim, run, id);
    if (!born) return;
    sim._introDone = true;
    sim.typeCard = id;
    sim.typeUntil = sim.t + 5.5;
    hooks.alert();
  }

  function walkout(sim, c) {
    if (c.walked) return;
    c.walked = true;
    c.angry = true;
    sim.walkouts++;
    sim.stars = clamp(sim.stars - 0.075, 1, 5);
    sim.morale = clamp(sim.morale - 1.25, 0, 100);
    var broke = (sim.combo || 0) > 1;
    sim.combo = 0;
    sim.lastSaleAt = -99;
    floater(sim, c.x, c.y - 50, broke ? 'Walkout' : 'Left', '#ff8d8d', true);
    if (broke) floater(sim, c.x, c.y - 80, 'Combo lost', '#ffb4b4');
    addShake(sim, broke ? 12 : 8);
    addPunch(sim, 0.08, 'red');
    hooks.angry();
    c.state = 'leave';
    c.path = pathVia(c.x, c.y, SPOTS.door.x, SPOTS.door.y);
    c.pathI = 0;
    c.bubble = 'angry';
    c.pop = 1;
  }

  function completeSale(sim, run, c) {
    if (c.sold) return;
    if (sim.stock <= 0.025) {
      if (sim.books) {
        sim.stockouts = (sim.stockouts || 0) + 1;
        floater(sim, c.x, c.y - 96, 'Empty shelf', '#ffb4b4', true);
      }
      walkout(sim, c);
      return;
    }
    var basket;
    if (sim.books && HR.sim && HR.economy) {
      var bag = sim.tenant && sim.tenant.stock;
      var quoted = HR.sim.checkout(sim.books, c, sim.rng, bag);
      if (!quoted.ok) {
        sim.stockouts = (sim.stockouts || 0) + 1;
        floater(sim, c.x, c.y - 96, 'Back room is empty', '#ffb4b4', true);
        walkout(sim, c);
        return;
      }
      HR.economy.consume(sim.books, quoted, bag);
      basket = quoted.revenue;
      if (stationPower(sim, run, 'floor') > 0.55) basket *= 1.1;
      if (sim.stock < 0.28) basket *= 0.64;
      if (sim.t < sim.discountUntil) basket *= 0.86;
      basket *= 1 + 0.09 * upgradeLevel(run, 'baskets');
      if (c.saleMul) basket *= c.saleMul;
      sim.cogs = (sim.cogs || 0) + quoted.cogs;
      c.receipt = quoted.label;
    } else {
      basket = CONFIG.basketMin + sim.rng() * (CONFIG.basketMax - CONFIG.basketMin);
      if (stationPower(sim, run, 'floor') > 0.55) basket *= 1.1;
      if (sim.stock < 0.28) basket *= 0.64;
      if (sim.t < sim.discountUntil) basket *= 0.86;
      basket *= 1 + 0.09 * upgradeLevel(run, 'baskets');
      if (c.basketMul) basket *= c.basketMul;
      if (c.saleMul) basket *= c.saleMul;
    }
    c.sold = true;
    var gap = sim.t - (sim.lastSaleAt == null ? -999 : sim.lastSaleAt);
    if (gap <= CONFIG.comboWindow && (sim.combo || 0) >= 1) {
      if (sim.combo < CONFIG.comboMax) sim.combo += 1;
    } else sim.combo = 1;
    sim.lastSaleAt = sim.t;
    if (sim.combo > (sim.bestCombo || 0)) sim.bestCombo = sim.combo;
    var mult = comboMult(sim.combo);
    basket = Math.round(basket * mult);
    if (sim.floorOn && sim.doubleUntil && sim.t < sim.doubleUntil) basket *= 2;
    sim.sales += basket;
    sim.checkouts++;
    sim.stock = Math.max(0, sim.stock - CONFIG.stockPerSale);
    sim.stars = clamp(sim.stars + 0.014, 1, 5);
    c.pop = 1;
    var tag = '+$' + basket + (sim.combo > 1 ? '  ' + multLabel(sim.combo) : '');
    floater(sim, c.x, c.y - 70, tag, sim.combo >= 4 ? '#ffd0e8' : '#ffe08a', true);
    burstCoins(sim, c.x, c.y - 40);
    flashAt(sim, c.x, c.y - 20);
    hooks.sale(sim.combo);
    if (sim.combo >= 3) {
      addShake(sim, 6 + Math.min(8, sim.combo));
      addPunch(sim, 0.05 + Math.min(0.06, sim.combo * 0.012), 'gold');
    }
    markGoal(sim, c.x, c.y - 30);
    c.state = 'leave';
    c.bubble = 'price';
    c.path = pathVia(c.x, c.y, SPOTS.door.x + 20, SPOTS.door.y);
    c.pathI = 0;
  }

  function pickRegister(sim, run) {
    var regs = registers();
    var best = regs[0] || 'reg1';
    var bestScore = 1e9;
    var any = false;
    for (var i = 0; i < regs.length; i++) {
      var reg = regs[i];
      if (trafficBlocked(reg)) continue;
      any = true;
      var score = queueOf(sim, reg).length * 2 - stationPower(sim, run, reg) * 1.4;
      if (score < bestScore) { bestScore = score; best = reg; }
    }
    return any ? best : regs[0];
  }

  function updateCustomers(sim, run, dt) {
    var regs = registers();
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
    var drainMul = (sim._heat && sim._heat.drain) ? sim._heat.drain : 1;
    if (sim.flickerUntil && sim.t < sim.flickerUntil) drainMul *= 1.85;
    for (var n = 0; n < sim.customers.length; n++) {
      var cust = sim.customers[n];
      if (cust.dead) continue;
      if (sim._shed && cust.state === 'browse' && cust.browseT > 30) continue;
      var custSpeed = speed * (cust.speedMul || 1);
      if (sim.coachHold && cust.maxPatience && cust.state !== 'leave' && cust.patience < cust.maxPatience * 0.24) {
        cust.patience = cust.maxPatience * 0.24;
      }
      if (cust.arch === 'lift') {
        cust.bubble = cust.state === 'flee' ? 'theft' : null;
        if (cust.state === 'leave') {
          cust.anim = 'walk';
          if (follow(cust, dt, custSpeed)) cust.dead = true;
        } else if (cust.state === 'flee') {
          cust.anim = 'walk';
          if (follow(cust, dt, custSpeed * 1.18)) {
            cust.dead = true;
            if (!cust.caught) {
              sim.stock = Math.max(0, sim.stock - 0.07);
              sim.stars = clamp(sim.stars - 0.2, 1, 5);
              sim.walkouts++;
              floater(sim, SPOTS.door.x, SPOTS.door.y - 40, 'Got away', '#ff8d8d', true);
              hooks.angry();
              addShake(sim, 8);
            }
          }
        } else {
          cust.state = 'prowl';
          cust.anim = 'idle';
          cust.prowlT = (cust.prowlT == null ? 2.2 : cust.prowlT) - dt;
          cust.dir = ((cust.prowlT * 2) | 0) % 2 === 0 ? 'side' : 'down';
          cust.face = 1;
          if (cust.prowlT <= 0) {
            cust.state = 'flee';
            cust.bubble = 'theft';
            cust.path = pathVia(cust.x, cust.y, SPOTS.door.x, SPOTS.door.y);
            cust.pathI = 0;
            cust.pop = 1;
          }
        }
        tickAnim(cust, dt);
        continue;
      }
      if (cust.state === 'enter') {
        if (follow(cust, dt, custSpeed)) {
          cust.state = 'browse';
          var browse = 0.85 + sim.rng() * 1.35;
          if (cust.arch === 'rusher') browse = 0.22 + sim.rng() * 0.2;
          if (cust.arch === 'family') browse = 1.8 + sim.rng() * 1.1;
          cust.browseT = browse;
          cust.anim = 'idle';
          cust.bubble = null;
        }
      } else if (cust.state === 'browse') {
        cust.anim = 'idle';
        cust.dir = 'up';
        cust.face = 1;
        cust.browseT -= dt * (stationPower(sim, run, 'floor') > 0.5 ? 1.25 : 1);
        cust.patience -= dt * 0.012 * cocoa * drainMul * (cust.arch === 'rusher' ? 1.8 : 1);
        if (cust.patience <= 0) walkout(sim, cust);
        else if (cust.browseT <= 0) {
          if (sim.stock <= 0.04) walkout(sim, cust);
          else {
            cust.reg = pickRegister(sim, run);
            if (trafficBlocked(cust.reg)) walkout(sim, cust);
            else if (!priceTurn(sim, cust)) {
              cust.state = 'toQueue';
              cust.path = null;
            }
          }
        }
      } else if (cust.state === 'toQueue') {
        var slot = queueOf(sim, cust.reg).length;
        var pos = QUEUE[cust.reg];
        var dest = { x: pos.x, y: pos.y + Math.min(slot, 3) * pos.dy };
        if (moveToward(cust, dest.x, dest.y, dt, custSpeed)) {
          var lineCap = cust.arch === 'rusher' ? 3 : 6;
          if (slot >= lineCap) walkout(sim, cust);
          else cust.state = 'queue';
        }
      } else if (cust.state === 'queue' || cust.state === 'checkout') {
        var at = moveToward(cust, cust.qx || cust.x, cust.qy || cust.y, dt, custSpeed);
        var power = stationPower(sim, run, cust.reg);
        var drain = (power > 0.45 ? 0.042 : 0.105) * cocoa;
        if (cust.qIndex > 0) drain += 0.01 * cust.qIndex;
        if (cust.arch === 'rusher') drain *= 1.65;
        if (cust.arch === 'haggle' && cust.qIndex === 0 && at) {
          cust.state = 'checkout';
          cust.anim = 'idle';
          if (!cust.haggling) {
            cust.haggling = true;
            cust.haggleT = 3.6;
            cust.bubble = 'price';
            cust.pop = 1;
          }
          cust.haggleT -= dt;
          cust.patience -= dt * 0.03 * cocoa * drainMul;
          if (cust.patience <= 0) walkout(sim, cust);
          else if (cust.haggleT <= 0 && !cust.sold) {
            cust.saleMul = 0.62;
            cust.haggling = false;
            sim.morale = clamp(sim.morale - 2, 0, 100);
            sim.stars = clamp(sim.stars - 0.04, 1, 5);
            note(sim, 'The coupon went through at a discount.');
            completeSale(sim, run, cust);
          }
        } else {
          cust.patience -= dt * drain * drainMul;
          if (cust.patience <= 0) walkout(sim, cust);
          else if (cust.qIndex === 0 && at && !cust.haggling) {
            cust.state = 'checkout';
            cust.anim = 'idle';
            var rate = power > 0.35 ? (0.55 + power * 0.85) : 0.2;
            if (cust.arch === 'rusher') rate *= 1.65;
            if (cust.arch === 'family') rate *= 0.7;
            var checkStart = cust.arch === 'family' ? 3.3 : 2.15;
            cust.checkT = (cust.checkT == null ? checkStart : cust.checkT) - dt * rate;
            if (cust.checkT <= 0) completeSale(sim, run, cust);
          } else {
            cust.anim = at ? 'idle' : 'walk';
            if (cust.checkT == null && cust.qIndex === 0 && cust.arch !== 'haggle') cust.checkT = cust.arch === 'family' ? 3.3 : 2.15;
          }
          if (!cust.haggling) cust.bubble = cust.patience < cust.maxPatience * 0.38 ? 'angry' : null;
        }
      } else if (cust.state === 'leave') {
        cust.anim = 'walk';
        if (follow(cust, dt, custSpeed * 1.05)) cust.dead = true;
      }
      tickAnim(cust, dt);
    }
    if (sim.pool) sim.pool.compact(sim.customers);
    else sim.customers = sim.customers.filter(function (c) { return !c.dead; });
    if (sim.spatial) {
      sim._spatialN = (sim._spatialN || 0) + 1;
      if (!(sim._shed && sim.customers.length > 60 && (sim._spatialN % 3) !== 0)) {
        sim.spatial.rebuild(sim.customers.concat(sim.staff));
      }
    }
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
          var reg = busiestRegister(sim);
          sim.override[pull.id] = reg;
          sim.overrideShift[pull.id] = shiftIndex(sim);
          note(sim, firstName(pull.id) + ' jumped on a till.');
        }),
        choice('Hop on a till', 1, function () {
          var reg = busiestRegister(sim);
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

  function persistBooks(books) {
    if (!books) return;
    if (HR.save) HR.save.save(writeJSON, books);
    var camp = campaignGet();
    camp.bank = books.cash;
    campaignPut(camp);
  }

  function buildMallCard(sim) {
    if (!sim || !sim.books || !HR.world || !HR.world.nextComplaint) return null;
    var row = HR.world.nextComplaint(sim.books);
    if (!row) return null;
    var cost = row.cost || 0;
    var label = (HR.world.commonName ? HR.world.commonName(row.wants) : row.wants) + ' · ' + money(cost);
    var card = {
      id: 'mall',
      icon: 'boss',
      title: row.name,
      body: row.complaint + ' Opening ' + (HR.world.commonName ? HR.world.commonName(row.wants) : row.wants).toLowerCase() + ' is ' + money(cost) + '.',
      who: null,
      expr: 'neutral',
      choices: [
        choice(label, 0, function () {
          var res = HR.world.buyCommon(sim.books, row.wants);
          note(sim, res.msg);
          if (res.ok) persistBooks(sim.books);
        }),
        choice('Let them grumble', 0, function () {
          note(sim, row.name + ' stays unhappy. The door stays thinner and they pay 85%.');
        })
      ]
    };
    return card;
  }

  function applyMallRetune(sim) {
    if (!sim || sim.tenant || !sim.books || !sim.books.mall || !sim.books.mall.retune) return;
    var ret = sim.books.mall.retune;
    sim.mallRetune = ret.kind || 'visit';
    sim.plazaMul = ret.door || 1;
    if (ret.kind === 'parade') sim.paradeUntil = sim.duration;
    if (ret.kind === 'blackout') sim.flickerUntil = sim.duration;
    sim.books.mall.retune = null;
    note(sim, ret.note || 'The plaza retuned the flagship.');
    persistBooks(sim.books);
  }

  function applyCalendar(sim, dayIndex) {
    if (!sim || !sim.books || !sim.books.mall || !HR.world || !HR.world.calendarEvent) return;
    var ev = HR.world.calendarEvent(dayIndex || 0);
    if (!ev) return;
    sim.calendarDoor = ev.door || 1;
    sim.calendarName = ev.name || '';
    sim.calendarId = ev.id || '';
    sim.calendarMul = sim.tenant ? 1 : (ev.door || 1);
  }

  function mechanicLabel(id) {
    if (id === 'demo') return 'Demo table';
    if (id === 'bench') return 'Repair bench';
    if (id === 'cups') return 'Cup line';
    if (id === 'window') return 'Window';
    return id || '';
  }

  function maybeMallCard(sim) {
    if (!sim.live || !sim.books || sim._mallShown || sim.coachHold || sim.pending || sim.paused) return;
    if (sim.t < 2.2) return;
    sim._mallShown = true;
    var card = buildMallCard(sim);
    if (!card) return;
    sim.pending = card;
    sim.pendingUntil = sim.t + 9;
  }

  function resolvePending(sim, run, index) {
    if (!sim.pending) return { ok: false, msg: '' };
    var ch = sim.pending.choices[index];
    if (!ch) return { ok: false, msg: 'Pick a response.' };
    if (ch.cost && sim.actions < ch.cost) return { ok: false, msg: 'No manager action left for that.' };
    if (ch.cost) sim.actions -= ch.cost;
    ch.apply();
    sim.pending = null;
    sim.pendingUntil = 0;
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
    sim.pendingUntil = sim.t + 7;
  }

  function step(sim, run, dt) {
    if (!sim || sim.done || sim.paused) return sim;
    if (sim.pending && sim.pendingUntil && sim.t >= sim.pendingUntil - 1e-4) {
      resolvePending(sim, run, autoChoice(sim.pending, sim));
      if (sim.live) note(sim, 'The aisle moved on.');
    }
    if (sim.typeCard && sim.typeUntil && sim.t >= sim.typeUntil - 1e-4) {
      var metName = dismissTypeCard(sim, run);
      if (sim.live && metName) note(sim, 'New shopper is on the floor.');
    }
    if (!(dt > 0)) return sim;
    if (sim.punch > 0) {
      var held = Math.min(sim.punch, dt);
      sim.punch -= held;
      decayFx(sim, held);
      dt -= held;
      if (dt <= 1e-4) return sim;
    }
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
    sim._heat = heatOf(sim, run);
    if (sim._heat.rush && !sim.rushOn) {
      sim.rushOn = true;
      hooks.rush();
      if (!sim.rushTold && sim.live) {
        sim.rushTold = true;
        note(sim, 'Rush hour. Lines grow and patience drops.');
      }
    } else if (!sim._heat.rush) sim.rushOn = false;
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
    var stockLv = upgradeLevel(run, 'stock');
    var regen = CONFIG.freightRegen * fp * (hasPerk(run, 'freight') ? 1.6 : 1) * (1 + 0.45 * stockLv);
    var warehouseBag = sim.tenant && sim.tenant.stock;
    var warehouseOpen = !(sim.books && HR.economy && HR.economy.unitsLeft(sim.books, warehouseBag) <= 0);
    var frozen = sim.stockFreeze && sim.t < sim.stockFreeze;
    if (frozen) {
      /* count holds the shelf still */
    } else if (warehouseOpen && sim.truck) {
      sim.stock = Math.max(0, sim.stock - used * 0.01);
      if (fp > 0.35) sim.truckWork += used * fp;
      if (sim.truckWork > 5.5 / (1 + 0.25 * stockLv)) {
        sim.truck = 0;
        sim.stock = clamp(sim.stock + 0.12, 0, 1);
        note(sim, 'Truck is cleared.');
      }
    } else if (warehouseOpen) {
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
    var rate = CONFIG.spawn[sh] * (sim._heat ? sim._heat.spawn : 1);
    if (sim.t < sim.rushUntil) rate *= 1.72;
    if (sim.t < sim.slowUntil) rate *= 0.62;
    if (sim.paradeUntil && sim.t < sim.paradeUntil) rate *= 1.4;
    if (sim.plazaMul && sim.plazaMul !== 1) rate *= sim.plazaMul;
    if (!sim.tenant && sim.calendarMul && sim.calendarMul !== 1) rate *= sim.calendarMul;
    if (sim.tenant && sim.tenant.spawnMul) rate *= sim.tenant.spawnMul;
    if (sim.tenant && sim.tenant.mechanic === 'cups') rate *= 1.25;
    if (sim.tenant && sim.tenant.mechanic === 'window') rate *= (sim.calendarDoor > 1 ? 1.25 : 0.78);
    rate *= 0.74 + Math.min(stationPower(sim, run, 'floor'), 1.6) * 0.2;
    if (sim.books && HR.sim) rate *= HR.sim.demandMul(sim.books);
    if (sim.books && sim.books.mall && sim.books.mall.door) rate *= sim.books.mall.door;
    if (sim.stock < 0.22) rate *= 0.58;
    sim.spawnAcc += used * rate;
    var guard = 0;
    while (sim.spawnAcc >= 1 && guard < 4) {
      sim.spawnAcc -= 1;
      spawnCustomer(sim, run);
      guard++;
    }
    decayFx(sim, used);
    if (!sim.pings) sim.pings = [];
    for (var pi = sim.pings.length - 1; pi >= 0; pi--) {
      sim.pings[pi].life -= used;
      if (sim.pings[pi].life <= 0 || sim.pings[pi].dead) sim.pings.splice(pi, 1);
    }
    var maxA = sim.actionMax || (CONFIG.baseActions + 1);
    if (sim.actions < maxA) {
      sim.actionFrac = (sim.actionFrac || 0) + used;
      var regenNeed = CONFIG.actionRegen / (1 + 0.28 * upgradeLevel(run, 'hustle'));
      if (sim.actionFrac >= regenNeed) {
        var gain = Math.floor(sim.actionFrac / regenNeed);
        sim.actionFrac -= gain * regenNeed;
        sim.actions = Math.min(maxA, sim.actions + gain);
      }
    }
    if (sim.truck && !sim.hornPlayed) {
      sim.hornPlayed = true;
      hooks.horn();
      if (sim.live) floater(sim, SPOTS.truck.x, SPOTS.truck.y - 36, 'Truck', '#ffe08a', true);
    } else if (!sim.truck) sim.hornPlayed = false;
    maybePing(sim);
    maybeTypeIntro(sim, run);
    if (sim.live) maybeMallCard(sim);
    if (sim.floorOn) maybeLiveBeat(sim, run);
    if (sim.paused) return sim;
    maybeEvent(sim, run);
    if (!sim.paused && sim.t >= sim.duration - 1e-4) sim.done = true;
    return sim;
  }

  function beatCard(sim, id, title, body, choices) {
    sim.pending = { id: id, icon: 'line', title: title, body: body, who: null, expr: 'neutral', choices: choices };
    sim.pendingUntil = sim.t + 8;
  }

  function tagIsSteep(books) {
    if (!books || !HR.economy || !HR.data || !HR.data.get()) return false;
    var items = HR.data.get().items.items;
    for (var i = 0; i < items.length; i++) {
      if (!HR.economy.itemUnlocked(books, items[i])) continue;
      if (HR.economy.markup(items[i], HR.economy.priceOf(books, items[i])) > 1.12) return true;
    }
    return false;
  }

  var FLOOR_BEATS = [
    {
      id: 'sample', t: 22, title: 'Sample tray',
      body: 'Cocoa samples are on the wrap table. Hand them out and the aisle lingers. Wave them off and the line keeps its pace.',
      choices: function (sim) {
        return [
          choice('Hand out samples', 1, function () {
            sim.slowUntil = Math.max(sim.slowUntil || 0, sim.t + 14);
            note(sim, 'Samples out. Shoppers linger in the aisle.');
          }),
          choice('Wave them off', 0, function () { note(sim, 'No samples. The line keeps its pace.'); })
        ];
      }
    },
    {
      id: 'bus', t: 26, title: 'Tour bus',
      body: 'A bus is at the curb. Open the door and three families come in with full carts. Hold the door and the rush waits.',
      choices: function (sim, run) {
        return [
          choice('Open the door', 0, function () {
            spawnCustomer(sim, run, 'family');
            spawnCustomer(sim, run, 'family');
            spawnCustomer(sim, run, 'family');
            note(sim, 'Three families just walked in.');
          }),
          choice('Hold the door', 0, function () { note(sim, 'The door stays shut. The rush waits.'); })
        ];
      }
    },
    {
      id: 'double', t: 24, title: 'Double ring',
      body: 'Call it and the next sales ring twice for a few seconds. Let it pass and the till stays on one ring.',
      choices: function (sim) {
        return [
          choice('Call the double', 1, function () {
            sim.doubleUntil = sim.t + 12;
            note(sim, 'Sales ring twice for a few seconds.');
          }),
          choice('Let it pass', 0, function () { note(sim, 'The till stays on a single ring.'); })
        ];
      }
    },
    {
      id: 'flash', t: 22, title: 'Flash the wrap table',
      body: 'The wrap table can run a short sale. Flash it and baskets ring lighter. Leave the tags and the aisle stays on the sticker.',
      choices: function (sim) {
        return [
          choice('Flash the tags', 0, function () {
            sim.discountUntil = sim.t + 14;
            note(sim, 'Wrap-table tags are lighter for a few seconds.');
          }),
          choice('Leave the tags', 0, function () { note(sim, 'The stickers stay.'); })
        ];
      }
    },
    {
      id: 'flicker', t: 30, title: 'Lights flicker',
      body: 'The bay lights hiccup. Kill them for a moment and patience drains. Leave them on and the aisle keeps shopping.',
      choices: function (sim) {
        return [
          choice('Kill the lights', 0, function () {
            sim.flickerUntil = sim.t + 12;
            note(sim, 'The bay is dim. Patience drains faster.');
          }),
          choice('Leave them on', 0, function () { note(sim, 'The lights stay up.'); })
        ];
      }
    },
    {
      id: 'lost', t: 28, title: 'Lost kid',
      body: 'A kid is at the door without a cart. Call them in and they join the aisle. Let the parent look and the door stays as it is.',
      choices: function (sim, run) {
        return [
          choice('Call the kid in', 0, function () {
            spawnCustomer(sim, run, 'family');
            note(sim, 'A family followed the kid in.');
          }),
          choice('Let the parent look', 0, function () { note(sim, 'The door stays as it is.'); })
        ];
      }
    },
    {
      id: 'inspector', t: 32, title: 'Aisle inspector',
      body: 'Someone with a clipboard wants the seasonal bay. Walk them and the stars tick up. Wave them through and nothing on the floor changes.',
      choices: function (sim) {
        return [
          choice('Walk the aisle', 1, function () {
            sim.stars = clamp(sim.stars + 0.12, 1, 5);
            note(sim, 'You walked the aisle. The clipboard is happy.');
          }),
          choice('Wave them through', 0, function () { note(sim, 'They left without a note.'); })
        ];
      }
    },
    {
      id: 'return', t: 24, title: 'Open return',
      body: 'A shopper wants money back on a cocoa tin. Take it and the drawer dips. The tag says no, and the line keeps moving.',
      choices: function (sim) {
        return [
          choice('Take the return', 0, function () {
            sim.sales = Math.max(0, sim.sales - 40);
            sim.stars = clamp(sim.stars + 0.05, 1, 5);
            note(sim, 'Cocoa return. The drawer is $40 lighter.');
          }),
          choice('The tag says no', 0, function () { note(sim, 'No return. The line keeps moving.'); })
        ];
      }
    },
    {
      id: 'carol', t: 26, title: 'Carolers',
      body: 'Three singers are in the doorway. Let them sing and morale jumps while the door slows. Ask them to move and the floor stays put.',
      choices: function (sim) {
        return [
          choice('Let them sing', 0, function () {
            sim.morale = clamp(sim.morale + 8, 0, 100);
            sim.slowUntil = Math.max(sim.slowUntil || 0, sim.t + 8);
            note(sim, 'The carolers are in. Morale is up and the door is slower.');
          }),
          choice('Ask them to move', 0, function () { note(sim, 'The doorway stays clear.'); })
        ];
      }
    },
    {
      id: 'hold', t: 22, title: 'Hold the door',
      body: 'The curb is packed. Hold the door and the next stretch is quieter. Keep it open and the spawn stays on the clock.',
      choices: function (sim) {
        return [
          choice('Hold the door', 0, function () {
            sim.slowUntil = Math.max(sim.slowUntil || 0, sim.t + 16);
            note(sim, 'The door is held. Fewer shoppers for a stretch.');
          }),
          choice('Keep it open', 0, function () { note(sim, 'The door stays on the clock.'); })
        ];
      }
    },
    {
      id: 'rain', t: 30, title: 'Rain on the curb',
      body: 'Rain is pushing people inside. Pull the mats and a rush comes in. Leave the mats and the curb waits it out.',
      choices: function (sim) {
        return [
          choice('Pull the mats', 0, function () {
            sim.rushUntil = Math.max(sim.rushUntil || 0, sim.t + 12);
            note(sim, 'Mats are down. A rush just came in.');
          }),
          choice('Leave the mats', 0, function () { note(sim, 'The curb waits out the rain.'); })
        ];
      }
    },
    {
      id: 'coupon', t: 28, title: 'Expired coupon',
      body: 'A coupon for the treat gondola is a week old. Honor it and the next baskets ring lighter. Call it expired and the sticker stands.',
      choices: function (sim) {
        return [
          choice('Honor the coupon', 0, function () {
            sim.discountUntil = sim.t + 10;
            note(sim, 'The coupon is honored. Baskets ring lighter.');
          }),
          choice('It is expired', 0, function () { note(sim, 'The sticker stands.'); })
        ];
      }
    },
    {
      id: 'jam', t: 24, title: 'Jammed dock',
      body: 'The truck is stuck in the bay. Unjam it and the dock has to be worked before the shelf refills. Let it wait and stocking stays as it is.',
      choices: function (sim) {
        return [
          choice('Unjam the dock', 1, function () {
            sim.truck = 1;
            sim.truckWork = 0;
            sim.hornPlayed = false;
            note(sim, 'The truck is in the bay. Work the dock.');
          }),
          choice('Let the dock wait', 0, function () { note(sim, 'Stocking stays as it is.'); })
        ];
      }
    },
    {
      id: 'freeze', t: 32, title: 'Back-room count',
      body: 'The count sheet is out. Count the back room and the shelf stops refilling. Skip it and freight keeps the pace.',
      choices: function (sim) {
        return [
          choice('Count the back room', 0, function () {
            sim.stockFreeze = sim.t + 14;
            note(sim, 'Count is on. The shelf holds still.');
          }),
          choice('Skip the count', 0, function () { note(sim, 'Freight keeps the pace.'); })
        ];
      }
    },
    {
      id: 'parade', t: 26, title: 'Parade on the curb',
      body: 'A parade is passing the door. Open for it and the next stretch is busier. Keep the door steady and the clock does not change.',
      choices: function (sim) {
        return [
          choice('Open for the parade', 0, function () {
            sim.paradeUntil = sim.t + 14;
            note(sim, 'The parade is in the door. More shoppers.');
          }),
          choice('Keep the door steady', 0, function () { note(sim, 'The door stays on its clock.'); })
        ];
      }
    }
  ];

  function maybeLiveBeat(sim, run) {
    if (!sim.floorOn || sim.coachHold || sim.paused || sim.pending || sim.done) return;
    if (!sim._beats) sim._beats = {};
    var dayN = run && run.day ? run.day : 0;
    var beat = FLOOR_BEATS[dayN] || FLOOR_BEATS[dayN % FLOOR_BEATS.length];
    if (beat && !sim._beats[beat.id] && sim.t >= beat.t) {
      sim._beats[beat.id] = 1;
      beatCard(sim, beat.id, beat.title, beat.body, beat.choices(sim, run));
      return;
    }
    if (sim._beats.priceTalk || sim.t < 48 || !sim.books || !tagIsSteep(sim.books)) return;
    sim._beats.priceTalk = 1;
    beatCard(sim, 'priceTalk', 'Price talk', 'A shopper is staring at a tag above the sticker. Drop cocoa a notch, or hold the tag and let them grumble.', [
      choice('Drop cocoa a notch', 0, function () {
        var item = HR.data.get().items.byId.cocoa;
        if (!item) return;
        var next = HR.economy.priceOf(sim.books, item) - 1;
        var res = HR.economy.setPrice(sim.books, 'cocoa', next);
        persistBooks(sim.books);
        note(sim, res.msg || 'Cocoa moved.');
      }),
      choice('Hold the tag', 0, function () { note(sim, 'The tag stays. They can grumble.'); })
    ]);
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
      hooks.coin();
      markGoal(sim, ping.x, ping.y);
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
    var ids = ['cust_grandpa', 'cust_mom', 'cust_kid', 'cust_mom'];
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
      cogs: sim.cogs || 0,
      stockouts: sim.stockouts || 0,
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
      combo: sim.combo || 0,
      bestCombo: sim.bestCombo || 0,
      lastSaleAt: sim.lastSaleAt == null ? -99 : sim.lastSaleAt,
      goalBurst: !!sim.goalBurst,
      rushTold: !!sim.rushTold,
      typeCard: sim.typeCard || '',
      _introDone: !!sim._introDone,
      priceWalks: sim.priceWalks || 0,
      grumbles: sim.grumbles || 0,
      _mallShown: !!sim._mallShown,
      _beats: sim._beats || {},
      _grumbleTold: !!sim._grumbleTold,
      doubleUntil: sim.doubleUntil || 0,
      flickerUntil: sim.flickerUntil || 0,
      stockFreeze: sim.stockFreeze || 0,
      paradeUntil: sim.paradeUntil || 0,
      plazaMul: sim.plazaMul == null ? 1 : sim.plazaMul,
      mallRetune: sim.mallRetune || '',
      tenant: sim.tenant || null,
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
    sim.confetti = [];
    sim.taps = [];
    sim.shake = 0;
    sim.flash = 0;
    sim.punch = 0;
    sim.combo = sim.combo || 0;
    sim.bestCombo = sim.bestCombo || 0;
    if (sim.lastSaleAt == null) sim.lastSaleAt = -99;
    sim.pending = null;
    sim.paused = false;
    sim.typeCard = data.typeCard || '';
    sim._introDone = !!data._introDone;
    if (sim.typeCard) sim.typeUntil = sim.t + 5.5;
    sim.priceWalks = data.priceWalks || 0;
    sim.grumbles = data.grumbles || 0;
    sim._mallShown = !!data._mallShown;
    sim._beats = data._beats || {};
    sim._grumbleTold = !!data._grumbleTold;
    sim.doubleUntil = data.doubleUntil || 0;
    sim.flickerUntil = data.flickerUntil || 0;
    sim.stockFreeze = data.stockFreeze || 0;
    sim.paradeUntil = data.paradeUntil || 0;
    sim.plazaMul = data.plazaMul == null ? 1 : data.plazaMul;
    sim.mallRetune = data.mallRetune || '';
    sim.tenant = data.tenant || null;
    var beatPending = { mall: 1, priceTalk: 1 };
    for (var bi = 0; bi < FLOOR_BEATS.length; bi++) beatPending[FLOOR_BEATS[bi].id] = 1;
    if (data.pendingMeta && data.pendingMeta.id && !beatPending[data.pendingMeta.id]) {
      sim.pending = buildEvent(data.pendingMeta.id, sim, run, { who: data.pendingMeta.who });
      sim.pendingUntil = sim.t + 7;
    }
    return sim;
  }

  function doAction(sim, run, name, target) {
    target = target || {};
    if (!sim || sim.done) return { ok: false, msg: 'The day is over.' };
    if (sim.paused && sim._hold === 'crew') return { ok: false, msg: 'Crew board is open.' };
    var free = !!target.free;
    if (!free && sim.actions <= 0) return { ok: false, msg: 'Actions are refilling.' };
    function spend() { if (!free) sim.actions--; }
    if (name === 'pull') {
      var reg = (isTill(target.station) && SPOTS[target.station]) ? target.station : busiestRegister(sim);
      var pull = null;
      for (var p = 0; p < sim.staff.length; p++) {
        var cand = sim.staff[p];
        if (!cand.id || sim.removed[cand.id]) continue;
        if (cand.station === reg) continue;
        if (cand.station === 'floor' || cand.station === 'freight' || isTill(cand.station)) {
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
      sim.stock = clamp(sim.stock + 0.22 + 0.06 * upgradeLevel(run, 'stock'), 0, 1);
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
        for (var li = 0; li < sim.customers.length; li++) {
          var lifter = sim.customers[li];
          if (lifter.arch === 'lift' && !lifter.dead && !lifter.caught && lifter.state !== 'leave') { upset = lifter; break; }
        }
      }
      if (!upset) {
        for (var hi = 0; hi < sim.customers.length; hi++) {
          if (sim.customers[hi].haggling && !sim.customers[hi].sold && !sim.customers[hi].dead) { upset = sim.customers[hi]; break; }
        }
      }
      if (!upset) {
        var low = 1e9;
        for (var c = 0; c < sim.customers.length; c++) {
          var cust = sim.customers[c];
          if (cust.state === 'leave' || cust.dead) continue;
          if (cust.patience < low) { low = cust.patience; upset = cust; }
        }
      }
      if (!upset) return { ok: false, msg: 'Nobody needs calming.' };
      if (upset.arch === 'lift' && !upset.caught && upset.state !== 'leave') {
        spend();
        upset.caught = true;
        upset.state = 'leave';
        upset.bubble = null;
        upset.pop = 1;
        upset.path = pathVia(upset.x, upset.y, SPOTS.door.x, SPOTS.door.y);
        upset.pathI = 0;
        sim.stars = clamp(sim.stars + 0.1, 1, 5);
        sim.morale = clamp(sim.morale + 3, 0, 100);
        sim.stock = clamp(sim.stock + 0.04, 0, 1);
        floater(sim, upset.x, upset.y - 56, 'Caught', '#b6f0c8', true);
        flashAt(sim, upset.x, upset.y);
        hooks.coin();
        return { ok: true, msg: 'You caught a shoplifter.' };
      }
      if (upset.haggling && !upset.sold) {
        spend();
        upset.haggling = false;
        upset.haggleT = 99;
        upset.saleMul = 1.08;
        upset.bubble = null;
        upset.pop = 1;
        sim.stars = clamp(sim.stars + 0.05, 1, 5);
        completeSale(sim, run, upset);
        floater(sim, upset.x, upset.y - 78, 'Coupon', '#ffe08a', true);
        return { ok: true, msg: 'Coupon honored. Full sale.' };
      }
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

  function driveActive(sim, run) {
    if (!sim || sim.done) return;
    if (sim.paused && sim.pending) {
      resolvePending(sim, run, smartChoice(sim.pending, sim));
      return;
    }
    if (sim.pings && sim.pings.length) resolvePing(sim, sim.pings[0]);
    if (sim.actions <= 0) return;
    if ((sim._nextAct || 0) > sim.t) return;
    sim._nextAct = sim.t + 0.45;
    for (var li = 0; li < sim.customers.length; li++) {
      var lifter = sim.customers[li];
      if (lifter.arch === 'lift' && !lifter.dead && !lifter.caught && (lifter.state === 'flee' || lifter.state === 'prowl')) {
        doAction(sim, run, 'calm', { cust: lifter });
        return;
      }
    }
    for (var hi = 0; hi < sim.customers.length; hi++) {
      if (sim.customers[hi].haggling && !sim.customers[hi].sold && !sim.customers[hi].dead) {
        doAction(sim, run, 'calm', { cust: sim.customers[hi] });
        return;
      }
    }
    if (sim.truck || sim.stock < 0.34) {
      doAction(sim, run, 'freight');
      return;
    }
    var upset = null;
    var low = 1e9;
    for (var i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.dead || c.state === 'leave' || !c.maxPatience) continue;
      if (c.patience < low) { low = c.patience; upset = c; }
    }
    if (upset && upset.patience < upset.maxPatience * 0.42) {
      doAction(sim, run, 'calm', { cust: upset });
      return;
    }
    var qSum = 0;
    var qRegs = registers();
    for (var qi = 0; qi < qRegs.length; qi++) qSum += queueOf(sim, qRegs[qi]).length;
    if (qSum >= 3) doAction(sim, run, 'pull');
    else if (sim.stock < 0.55) doAction(sim, run, 'freight');
    else doAction(sim, run, 'cover', { station: busiestRegister(sim) });
  }

  function simulate(ymd, mode, onlyShift) {
    var run = newRun(ymd || '2026-10-19');
    if (mode === 'upgraded') {
      run.upgrades = { stock: 3, register: 2, patience: 3, hustle: 2, baskets: 2 };
    }
    if (mode === 'mid') run.upgrades = { stock: 1, register: 1, patience: 1 };
    var indexes = onlyShift == null ? [0, 4, 9, 14] : [onlyShift];
    var history = [];
    for (var n = 0; n < indexes.length; n++) {
      var d = indexes[n];
      run.day = d;
      run.schedule[d] = mode === 'empty' ? blankDay() : greedy(run, d);
      var sim = startDay(run);
      if (mode === 'empty') sim.staff = [];
      if (mode === 'active' || mode === 'upgraded' || mode === 'mid') {
        sim.live = true;
        primeShift(sim, run);
      }
      var guard = 0;
      while (!sim.done && guard < 9000) {
        var heldCard = false;
        if (sim.pending) {
          var pick = (mode === 'active' || mode === 'upgraded' || mode === 'mid' || mode === 'smart')
            ? smartChoice(sim.pending, sim)
            : autoChoice(sim.pending, sim);
          resolvePending(sim, run, pick);
          heldCard = true;
        }
        if (!heldCard && (mode === 'active' || mode === 'upgraded' || mode === 'mid')) driveActive(sim, run);
        step(sim, run, 0.1);
        guard++;
      }
      var snap = scoreSnapshot(sim);
      snap.done = sim.done;
      snap.guard = guard;
      snap.staff = sim.staff.length;
      snap.shiftStars = goalStars(snap.goalPct);
      snap.shift = d;
      history.push(snap);
      run.morale = sim.morale;
    }
    return history;
  }

  function verifyAtlases() {
    if (typeof require === 'undefined') return { ok: true, skipped: true };
    var fs = require('fs');
    var path = require('path');
    var dir = path.join(__dirname, 'holiday-rush');
    var portraits = JSON.parse(fs.readFileSync(path.join(dir, 'portraits_atlas.json'), 'utf8'));
    var icons = JSON.parse(fs.readFileSync(path.join(dir, 'icons_ui_atlas.json'), 'utf8'));
    var chars = STAFF.map(function (s) { return s.id; }).concat(CUST_IDS);
    for (var ci = 0; ci < chars.length; ci++) {
      var look = LOOKS[chars[ci]];
      if (!look || !look.skin || !look.top || !look.hair || !look.style) throw new Error('look ' + chars[ci]);
    }
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
    return { ok: true, looks: chars.length, portraits: Object.keys(portraits).length };
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
  var loadGoal = 5;

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

  function revokeSpriteRows(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].url && typeof URL !== 'undefined') URL.revokeObjectURL(rows[i].url);
    }
  }

  function loadSpritePng(url, spec) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        var missing = new Error(url);
        missing.reject = 'missing';
        throw missing;
      }
      return res.arrayBuffer();
    }).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var png = pngInfo(bytes);
      if (!png) return { reject: 'not-png', file: url, bytes: buf.byteLength, spec: spec };
      if (!pngHasAlpha(bytes)) return { reject: 'no-alpha', file: url, bytes: buf.byteLength, spec: spec };
      if (png.w < 32 || png.h < 32 || png.w > 512 || png.h > 512) return { reject: 'dimensions', file: url, bytes: buf.byteLength, spec: spec };
      onAsset();
      var blob = new Blob([buf], { type: 'image/png' });
      var src = URL.createObjectURL(blob);
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          resolve({ img: img, url: src, bytes: buf.byteLength, w: png.w, h: png.h, spec: spec });
        };
        img.onerror = function () {
          URL.revokeObjectURL(src);
          resolve({ reject: 'decode', file: url, bytes: buf.byteLength, spec: spec });
        };
        img.src = src;
      });
    });
  }

  function loadSpriteFiles(listed) {
    var jobs = [];
    for (var i = 0; i < listed.length; i++) {
      var spec = classifySpriteFile(listed[i]);
      if (!spec) return Promise.resolve({ ready: false, reason: 'bad-name', file: listed[i], bytes: 0 });
      jobs.push(loadSpritePng(ART + 'sprites/' + listed[i], spec));
    }
    return Promise.all(jobs).then(function (rows) {
      var bytes = 0;
      var types = {};
      var portraits = {};
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (!row || row.reject) {
          revokeSpriteRows(rows);
          return { ready: false, reason: (row && row.reject) || 'missing', file: row && row.file, bytes: bytes };
        }
        bytes += row.bytes;
        if (row.spec.kind === 'frame') {
          if (!types[row.spec.type]) types[row.spec.type] = {};
          var key = row.spec.anim + '|' + row.spec.dir;
          if (!types[row.spec.type][key]) types[row.spec.type][key] = [];
          types[row.spec.type][key].push(row);
        } else {
          if (!portraits[row.spec.key]) portraits[row.spec.key] = {};
          portraits[row.spec.key][row.spec.expr] = row;
        }
      }
      Object.keys(types).forEach(function (type) {
        Object.keys(types[type]).forEach(function (key) {
          types[type][key].sort(function (a, b) { return a.spec.index - b.spec.index; });
        });
      });
      if (bytes > SPRITE_PACK.budget) {
        revokeSpriteRows(rows);
        return { ready: false, reason: 'over-budget', bytes: bytes, budget: SPRITE_PACK.budget };
      }
      if (!spritePackComplete(types, portraits)) {
        revokeSpriteRows(rows);
        return { ready: false, reason: 'incomplete', bytes: bytes, budget: SPRITE_PACK.budget };
      }
      return { ready: true, reason: 'ready', bytes: bytes, budget: SPRITE_PACK.budget, types: types, portraits: portraits };
    }).catch(function (err) {
      return { ready: false, reason: (err && err.reject) || 'load-failed', file: err && err.message, bytes: 0 };
    });
  }

  function loadPhotoArt(iconImg, iconJson, status) {
    return Promise.all([
      loadImage(ART + 'portraits_staff.png8.png'),
      loadImage(ART + 'portraits_customers.png8.png'),
      iconImg,
      loadJSON(ART + 'portraits_atlas.json'),
      iconJson
    ]).then(function (all) {
      return {
        img: { staff: all[0], cust: all[1], icons: all[2] },
        portraits: all[3],
        icons: all[4],
        spritePack: null,
        spriteStatus: status || { ready: false, reason: 'empty', bytes: 0 }
      };
    });
  }

  function deliverArt(kind, payload) {
    if (kind === 'sprites') {
      if (root.__hrApplyPack) root.__hrApplyPack(payload);
      else root.__hrPendingPack = payload;
      return;
    }
    if (root.__hrApplyObjects) root.__hrApplyObjects(payload);
    else root.__hrPendingObjects = payload;
  }

  function loadGameArt() {
    var iconImg = loadImage(ART + 'icons_ui.png8.png');
    var iconJson = loadJSON(ART + 'icons_ui_atlas.json');
    if (!HR.sprites) return loadPhotoArt(iconImg, iconJson, { ready: false, reason: 'empty', bytes: 0 });
    var types = HR.sprites.typesForDay(0, null);
    spriteSession = HR.sprites.createSession(ART, function () {});
    if (!HR.room) return loadPhotoArt(iconImg, iconJson, { ready: false, reason: 'empty', bytes: 0 });
    return spriteSession.loadManifest().then(function () {
      loadGoal = 24;
      spriteSession.ensure(types).then(function (pack) {
        deliverArt('sprites', pack);
      }).catch(function () {});
      HR.room.load(ART, function () {}, { rest: true }).then(function (more) {
        if (more) deliverArt('objects', more);
      }).catch(function () {});
      return HR.room.load(ART, function () {
        if (typeof onAsset === 'function') onAsset();
      }, { critical: true });
    }).then(function (objects) {
      return Promise.all([iconImg, iconJson]).then(function (icons) {
        var pack = spriteSession.pack();
        var ready = !!(pack && pack.types && Object.keys(pack.types).length);
        return {
          img: { staff: null, cust: null, icons: icons[0] },
          portraits: pack && pack.portraits,
          icons: icons[1],
          spritePack: ready ? pack : null,
          spriteStatus: {
            ready: ready,
            reason: ready ? 'ready' : 'streaming',
            bytes: (pack && pack.bytes) || 0,
            partial: true
          },
          session: spriteSession,
          objects: objects
        };
      });
    });
  }

  function verifySpritePack() {
    if (SPRITE_PACK.types.length !== 10 || SPRITE_PACK.perTypeBudget !== 110 * 1024 || SPRITE_PACK.displayH !== 78 || SPRITE_PACK.footY !== 158) {
      throw new Error('sprite spec');
    }
    var sample = classifySpriteFile('rusher/walk_side_3.png');
    if (!sample || sample.kind !== 'frame' || sample.index !== 3 || sample.dir !== 'side') throw new Error('frame name');
    var port = classifySpriteFile('portraits/crew_register_sick.png');
    if (!port || port.kind !== 'portrait' || port.expr !== 'sick') throw new Error('portrait name');
    if (classifySpriteFile('rusher/jump_down_0.png')) throw new Error('bad anim accepted');
    if (classifySpriteFile('../secrets.png')) throw new Error('path accepted');
    var rusher = spriteTypeFor({ kind: 'cust', charId: 'cust_biz', arch: 'rusher' });
    var regular = spriteTypeFor({ kind: 'cust', charId: 'cust_grandpa' });
    var crew = spriteTypeFor({ kind: 'staff', id: 'staff_frt1', role: 'freight' });
    var kid = spriteTypeFor({ charId: 'cust_kid', arch: 'family' });
    if (rusher !== 'rusher' || regular !== 'regular' || crew !== 'crew_freight' || kid !== 'kid') throw new Error('sprite type');
    if (!HR.sprites) throw new Error('sprites module');
    return HR.sprites.verify(typeof __dirname !== 'undefined' ? __dirname : '');
  }

  function campaignDefault() {
    return { v: 1, stars: [], bestEarn: [], bank: 0, upgrades: {}, seen: false, current: 0, met: {} };
  }
  function campaignGet() {
    var c = readJSON('hr_campaign_v1');
    if (!c || c.v !== 1) c = campaignDefault();
    if (!c.stars) c.stars = [];
    if (!c.bestEarn) c.bestEarn = [];
    if (!c.upgrades) c.upgrades = {};
    if (!c.met) c.met = {};
    return c;
  }
  function campaignPut(c) { writeJSON('hr_campaign_v1', c); }

  function bankCopy(snap) {
    if (snap && snap.tenant) {
      return 'You keep 15% of their drawer (' + money(snap.cut || 0) + ' of ' + money(snap.sales) + '). The other 85% stays on their tape. This close does not replace the flagship profit.';
    }
    if (snap && snap.tape) {
      var tape = snap.tape;
      var loanBit = tape.loanPay ? ' − loan ' + money(tape.loanPay) : '';
      return 'Sales ' + money(tape.sales) + ' − goods ' + money(tape.cogs) + ' − wages ' + money(tape.wages) + ' − rent ' + money(tape.rent) + loanBit + ' = ' + money(tape.profit) + '. The register holds ' + money(tape.cash) + '.';
    }
    var rate = Math.round(CONFIG.earnRate * 100);
    var gross = snap.earnGross || 0;
    var prev = snap.earnPrev || 0;
    var gain = snap.earned || 0;
    if (gain > 0 && prev <= 0) {
      return 'The bank keeps ' + rate + '% of sales, so ' + money(gross) + ' from this shift is in the shop bank.';
    }
    if (gain > 0) {
      return 'The bank keeps ' + rate + '% of sales (' + money(gross) + ' this time). ' + money(prev) + ' was already saved on this shift, so ' + money(gain) + ' is new.';
    }
    return 'The bank keeps ' + rate + '% of sales (' + money(gross) + ' this time). This shift already saved ' + money(prev) + ', and a replay never shrinks the bank.';
  }

  function crewSummary(sched) {
    var reg = 0;
    var floor = 0;
    var freight = 0;
    for (var sh = 0; sh < 3; sh++) {
      if (sched[sh].reg1) reg++;
      if (sched[sh].reg2) reg++;
      if (sched[sh].floor) floor++;
      if (sched[sh].freight) freight++;
    }
    return reg + ' till blocks · ' + floor + ' floor · ' + freight + ' freight. A color match works faster. Two blocks max per person.';
  }

  function applyCrewPreset(run, day, mode) {
    if (mode === 'balanced') return greedy(run, day);
    var avail = run.days[day].avail;
    var sched = blankDay();
    var order = mode === 'stock'
      ? [[0, 'freight'], [0, 'floor'], [1, 'freight'], [1, 'floor'], [2, 'freight'], [2, 'floor'], [0, 'reg1'], [1, 'reg1'], [2, 'reg1']]
      : [[0, 'reg1'], [0, 'reg2'], [1, 'reg1'], [1, 'reg2'], [2, 'reg1'], [2, 'reg2'], [0, 'floor'], [2, 'floor'], [1, 'freight']];
    var used = {};
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
        var sc = s.role === need ? 5 : s.role === 'manager' ? 3 : 1;
        sc -= (used[s.id] || 0) * 0.7;
        if (sc > bestScore) { bestScore = sc; best = s.id; }
      }
      if (!best) continue;
      var placed = tryPlace(sched, avail, best, shift, station, null);
      if (!placed.ok) continue;
      sched = placed.schedule;
      used[best] = (used[best] || 0) + 1;
      hours += CONFIG.slotHours;
    }
    return sched;
  }

  function retargetCrew(sim, run) {
    if (!sim) return;
    sim.override = {};
    sim.overrideShift = {};
    for (var i = 0; i < STAFF.length; i++) {
      var id = STAFF[i].id;
      if (shiftsOf(run.schedule[run.day], id) <= 0) continue;
      var actor = ensureStaff(sim, run, id);
      if (!actor) continue;
      actor.hidden = false;
      actor.arrived = false;
      actor.path = null;
      actor.rush = 2.2;
    }
  }
  function shiftUnlocked(camp, index) {
    if (index <= 0) return true;
    return (camp.stars[index - 1] || 0) >= 1;
  }
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  var bootToken = '';
  function armStorage() {
    bootToken = String(Date.now()) + Math.random().toString(36).slice(2);
    try { localStorage.setItem('hr_boot', bootToken); } catch (e) { bootToken = ''; }
  }
  function storageLive() {
    if (!bootToken) return false;
    try { return localStorage.getItem('hr_boot') === bootToken; } catch (e2) { return false; }
  }
  function writeJSON(key, val) {
    if (!storageLive()) return;
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

  function previewSeed() {
    if (typeof location === 'undefined') return '';
    var host = (location.hostname || '').toLowerCase();
    if (host === 'cosmicgameshub.com' || host === 'www.cosmicgameshub.com') return '';
    var match = /(?:\?|&)seed=([a-z0-9_-]+)(?:&|$)/.exec(location.search || '');
    return match ? match[1] : '';
  }

  var MELODY = [392, 493.88, 587.33, 659.25, 587.33, 493.88, 440, 392, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88, 440];
  var BASSLINE = [98, 98, 73.42, 73.42, 82.41, 82.41, 73.42, 98];
  var PAD = [196, 196, 146.83, 146.83, 164.81, 164.81, 146.83, 196];

  function noiseBuffer(ctx, seconds, seed) {
    var frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var s = seed || 1;
    for (var i = 0; i < frames; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      data[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
    return buf;
  }

  function mixTone(ctx, dest, freq, t, dur, type, vol, slide) {
    if (!(vol > 0) || !(dur > 0.01)) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    var f0 = Math.max(48, freq);
    o.frequency.setValueAtTime(f0, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, slide), t + dur);
    var attack = Math.min(0.018, dur * 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function mixNoise(ctx, dest, t, dur, vol, freq, q) {
    if (!(vol > 0) || !(dur > 0.01)) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, dur + 0.02, 3 + Math.floor(t * 1000));
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq || 1400, t);
    filter.Q.value = q || 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function mixBeat(ctx, dest, t, index, rush) {
    var i = index % MELODY.length;
    var bar = Math.floor(index / 8) % BASSLINE.length;
    var eighth = rush ? 0.22 : 0.3;
    var mel = MELODY[i];
    mixTone(ctx, dest, mel, t, Math.min(0.24, eighth * 0.9), 'triangle', rush ? 0.028 : 0.022, null);
    mixTone(ctx, dest, mel * 2, t, 0.08, 'sine', rush ? 0.008 : 0.006, null);
    if (rush) mixTone(ctx, dest, mel * 1.5, t + 0.02, 0.1, 'sine', 0.01, null);
    if (index % 2 === 0) mixNoise(ctx, dest, t, 0.025, rush ? 0.01 : 0.006, 2800, 0.65);
    if (index % 8 === 0) {
      mixTone(ctx, dest, BASSLINE[bar], t, eighth * 6.4, 'sine', rush ? 0.05 : 0.04, null);
      mixTone(ctx, dest, PAD[bar], t, eighth * 5.5, 'sine', 0.012, null);
      mixTone(ctx, dest, PAD[bar] * 1.498, t, eighth * 5.5, 'triangle', 0.008, null);
    }
    if (rush && index % 4 === 0) mixTone(ctx, dest, 142, t, 0.11, 'sine', 0.042, 52);
    if (rush && index % 4 === 2) {
      mixNoise(ctx, dest, t, 0.06, 0.016, 1400, 0.55);
      mixTone(ctx, dest, 180, t, 0.04, 'triangle', 0.014, 120);
    }
  }

  function mixSfx(ctx, dest, name, t, extra) {
    extra = extra || {};
    var combo = extra.combo || 1;
    if (name === 'scan' || name === 'sale' || name === 'combo') {
      mixNoise(ctx, dest, t, 0.028, 0.02, 1800, 0.8);
      mixTone(ctx, dest, 740, t + 0.012, 0.05, 'triangle', 0.045, null);
      mixTone(ctx, dest, 1180, t + 0.05, 0.07, 'sine', 0.032, null);
    }
    if (name === 'coin' || name === 'sale' || name === 'combo') {
      var at = name === 'coin' ? t : t + 0.07;
      mixTone(ctx, dest, 1318, at, 0.055, 'sine', 0.04, null);
      mixTone(ctx, dest, 1760, at + 0.04, 0.07, 'triangle', 0.026, null);
    }
    if (name === 'combo') {
      var f = 523 * Math.pow(1.05, Math.min(combo, 8));
      mixTone(ctx, dest, f, t + 0.12, 0.12, 'triangle', 0.032, null);
      mixTone(ctx, dest, f * 1.25, t + 0.18, 0.1, 'sine', 0.02, null);
    }
    if (name === 'truck') {
      mixTone(ctx, dest, 174, t, 0.16, 'triangle', 0.05, 98);
      mixTone(ctx, dest, 130, t + 0.1, 0.16, 'sine', 0.028, 82);
    }
    if (name === 'tap') mixTone(ctx, dest, 520, t, 0.03, 'sine', 0.022, null);
    if (name === 'angry') {
      mixTone(ctx, dest, 233, t, 0.16, 'triangle', 0.04, 110);
      mixTone(ctx, dest, 155, t + 0.04, 0.16, 'sine', 0.026, 82);
    }
    if (name === 'goal' || name === 'fanfare') {
      var notes = [523, 659, 784, 1046];
      for (var i = 0; i < notes.length; i++) {
        mixTone(ctx, dest, notes[i], t + i * 0.09, name === 'fanfare' ? 0.18 : 0.12, 'triangle', 0.036, null);
        if (name === 'fanfare') mixTone(ctx, dest, notes[i] * 1.5, t + i * 0.09, 0.1, 'sine', 0.012, null);
      }
    }
    if (name === 'rush') {
      mixTone(ctx, dest, 196, t, 0.22, 'triangle', 0.03, 392);
      mixTone(ctx, dest, 294, t + 0.06, 0.18, 'sine', 0.022, 466);
    }
    if (name === 'alert') {
      mixTone(ctx, dest, 622, t, 0.07, 'triangle', 0.03, null);
      mixTone(ctx, dest, 830, t + 0.07, 0.08, 'sine', 0.024, null);
    }
    if (name === 'freight') {
      mixNoise(ctx, dest, t, 0.07, 0.03, 240, 0.7);
      mixTone(ctx, dest, 110, t, 0.1, 'triangle', 0.04, 62);
    }
    if (name === 'calm') {
      mixTone(ctx, dest, 523, t, 0.09, 'sine', 0.03, null);
      mixTone(ctx, dest, 659, t + 0.05, 0.12, 'triangle', 0.024, null);
    }
    if (name === 'pull') {
      mixTone(ctx, dest, 340, t, 0.06, 'triangle', 0.03, 680);
      mixTone(ctx, dest, 510, t + 0.04, 0.06, 'sine', 0.02, null);
    }
    if (name === 'cover') {
      mixTone(ctx, dest, 392, t, 0.08, 'sine', 0.028, null);
      mixTone(ctx, dest, 523, t + 0.05, 0.09, 'triangle', 0.022, null);
      mixTone(ctx, dest, 784, t + 0.1, 0.1, 'sine', 0.016, null);
    }
    if (name === 'action') mixNoise(ctx, dest, t, 0.04, 0.02, 480, 0.6);
  }

  function mixCrowd(ctx, dest, start, dur, rushAt) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2, 11);
    src.loop = true;
    var low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.007, start);
    if (rushAt != null && rushAt > start && rushAt < start + dur) {
      g.gain.setValueAtTime(0.007, rushAt);
      g.gain.linearRampToValueAtTime(0.016, rushAt + 0.35);
    }
    src.connect(low);
    low.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur);
    return g;
  }

  function buildMixGraph(ctx) {
    var now = ctx.currentTime || 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-8, now);
    comp.knee.setValueAtTime(6, now);
    comp.ratio.setValueAtTime(2.4, now);
    comp.attack.setValueAtTime(0.008, now);
    comp.release.setValueAtTime(0.2, now);
    var shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 5600;
    shelf.gain.value = -3.5;
    var musicLp = ctx.createBiquadFilter();
    musicLp.type = 'lowpass';
    musicLp.frequency.value = 5200;
    musicLp.Q.value = 0.4;
    var music = ctx.createGain();
    music.gain.setValueAtTime(1, now);
    var lift = ctx.createGain();
    lift.gain.setValueAtTime(1, now);
    var sfx = ctx.createGain();
    sfx.gain.setValueAtTime(1.35, now);
    var makeup = ctx.createGain();
    makeup.gain.setValueAtTime(2.5, now);
    music.connect(musicLp);
    musicLp.connect(lift);
    lift.connect(shelf);
    sfx.connect(shelf);
    shelf.connect(makeup);
    makeup.connect(comp);
    comp.connect(ctx.destination);
    return { music: music, sfx: sfx, lift: lift, comp: comp };
  }

  function mixDrone(ctx, dest, start, dur, rushAt) {
    var freqs = [196, 246.94, 293.66];
    var vols = [0.042, 0.02, 0.016];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(freqs[i], start);
      g.gain.setValueAtTime(vols[i], start);
      if (rushAt != null) {
        g.gain.setValueAtTime(vols[i], rushAt);
        g.gain.linearRampToValueAtTime(vols[i] * 1.55, Math.min(start + dur, rushAt + 0.4));
      }
      o.connect(g);
      g.connect(dest);
      o.start(start);
      if (dur) o.stop(start + dur);
    }
  }

  function goertzelPower(data, i0, n, freq, rate) {
    var k = Math.round(freq * n / rate);
    var w = 2 * Math.PI * k / n;
    var coeff = 2 * Math.cos(w);
    var s1 = 0;
    var s2 = 0;
    for (var i = 0; i < n; i++) {
      var s0 = data[i0 + i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return s1 * s1 + s2 * s2 - coeff * s1 * s2;
  }

  function analyzeMix(buffer, cues) {
    var data = buffer.getChannelData(0);
    var rate = buffer.sampleRate;
    var peak = 0;
    var sum = 0;
    var clips = 0;
    for (var i = 0; i < data.length; i++) {
      var a = data[i];
      var abs = a < 0 ? -a : a;
      if (abs > peak) peak = abs;
      if (abs >= 0.999) clips++;
      sum += a * a;
    }
    function rangeRms(t0, t1) {
      var i0 = Math.max(0, Math.floor(t0 * rate));
      var i1 = Math.min(data.length, Math.floor(t1 * rate));
      var s = 0;
      var n = 0;
      var p = 0;
      for (var j = i0; j < i1; j++) {
        s += data[j] * data[j];
        n++;
        var absj = data[j] < 0 ? -data[j] : data[j];
        if (absj > p) p = absj;
      }
      return { rms: Math.sqrt(s / Math.max(1, n)), peak: p };
    }
    function highRatio(t) {
      var n = 2048;
      var i0 = Math.floor(t * rate);
      if (i0 + n >= data.length) i0 = data.length - n - 1;
      if (i0 < 0) return 0;
      var bands = [150, 400, 1000, 2000, 5000, 8000, 11000];
      var powers = [];
      var total = 0;
      var high = 0;
      for (var b = 0; b < bands.length; b++) {
        var pwr = goertzelPower(data, i0, n, bands[b], rate);
        powers.push(pwr);
        total += pwr;
        if (bands[b] >= 5000) high += pwr;
      }
      return { ratio: total > 0 ? high / total : 0, bands: powers };
    }
    function db(v) { return 20 * Math.log10(Math.max(v, 1e-8)); }
    var calm = rangeRms(0.4, 3.0);
    var rush = rangeRms(3.6, 7.4);
    var cueStats = [];
    for (var c = 0; c < cues.length; c++) {
      var window = rangeRms(cues[c].t, cues[c].t + 0.38);
      cueStats.push({ name: cues[c].name, peak: window.peak, peakDb: db(window.peak) });
    }
    var calmHigh = highRatio(1.2);
    var rushHigh = highRatio(5.2);
    return {
      sampleRate: rate,
      seconds: data.length / rate,
      peak: peak,
      peakDb: db(peak),
      rms: Math.sqrt(sum / data.length),
      rmsDb: db(Math.sqrt(sum / data.length)),
      clips: clips,
      calmRms: calm.rms,
      calmRmsDb: db(calm.rms),
      rushRms: rush.rms,
      rushRmsDb: db(rush.rms),
      rushOverCalmDb: db(rush.rms) - db(calm.rms),
      highRatioCalm: calmHigh.ratio,
      highRatioRush: rushHigh.ratio,
      cues: cueStats,
      clipped: clips > 0 || peak >= 0.999,
      harsh: calmHigh.ratio > 0.22 || rushHigh.ratio > 0.22
    };
  }

  function encodeWavB64(buffer) {
    var data = buffer.getChannelData(0);
    var n = data.length;
    var bytes = 44 + n * 2;
    var ab = new ArrayBuffer(bytes);
    var view = new DataView(ab);
    function writeStr(offset, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, n * 2, true);
    var off = 44;
    for (var i = 0; i < n; i++) {
      var s = data[i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    var u8 = new Uint8Array(ab);
    var bin = '';
    var step = 8192;
    for (var j = 0; j < u8.length; j += step) {
      var slice = u8.subarray(j, Math.min(u8.length, j + step));
      bin += String.fromCharCode.apply(null, slice);
    }
    return root.btoa(bin);
  }

  function renderMixdown(seconds, opts) {
    seconds = seconds || 8;
    opts = opts || {};
    var AC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!AC) return Promise.reject(new Error('OfflineAudioContext missing'));
    var rate = 44100;
    var ctx = new AC(1, Math.ceil(rate * seconds), rate);
    var buses = buildMixGraph(ctx);
    var cues = [
      { name: 'scan', t: 0.45 },
      { name: 'coin', t: 0.95 },
      { name: 'truck', t: 1.35 },
      { name: 'angry', t: 1.75 },
      { name: 'goal', t: 2.2 },
      { name: 'fanfare', t: 2.7 },
      { name: 'rush', t: 3.25 },
      { name: 'freight', t: 3.75 },
      { name: 'calm', t: 4.2 },
      { name: 'pull', t: 4.6 },
      { name: 'cover', t: 5.0 },
      { name: 'alert', t: 5.4 },
      { name: 'sale', t: 5.85 },
      { name: 'combo', t: 6.45 },
      { name: 'tap', t: 7.15 }
    ];
    var t = 0.06;
    var step = 0;
    while (t < 3.2) {
      mixBeat(ctx, buses.music, t, step, false);
      t += 0.3;
      step++;
    }
    while (t < seconds - 0.05) {
      mixBeat(ctx, buses.music, t, step, true);
      t += 0.22;
      step++;
    }
    for (var c = 0; c < cues.length; c++) {
      mixSfx(ctx, buses.sfx, cues[c].name, cues[c].t, { combo: cues[c].name === 'combo' ? 6 : 1 });
    }
    mixCrowd(ctx, buses.music, 0, seconds, 3.2);
    mixDrone(ctx, buses.music, 0, seconds, 3.2);
    buses.lift.gain.setValueAtTime(1, 0);
    buses.lift.gain.setValueAtTime(1, 3.2);
    buses.lift.gain.linearRampToValueAtTime(1.32, 3.65);
    return ctx.startRendering().then(function (buffer) {
      var stats = analyzeMix(buffer, cues);
      if (opts.wav) stats.wavBase64 = encodeWavB64(buffer);
      return stats;
    });
  }

  var booted = false;

  function boot() {
    if (booted) return;
    var app = document.getElementById('hr-app');
    if (!app) return;
    booted = true;
    armStorage();

    var els = {
      intro: document.getElementById('hr-intro'),
      plan: document.getElementById('hr-plan'),
      sim: document.getElementById('hr-sim'),
      score: document.getElementById('hr-score'),
      shop: document.getElementById('hr-shop'),
      map: document.getElementById('hr-map'),
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
    if (els.stage && els.event && els.event.parentNode !== els.stage) els.stage.appendChild(els.event);
    if (!document.getElementById('hr-feel-css')) {
      var feelCss = document.createElement('style');
      feelCss.id = 'hr-feel-css';
      feelCss.textContent = [
        '#hr-event.hr-inline{position:absolute;left:8px;right:8px;bottom:8px;top:auto;z-index:6;background:transparent;padding:0;display:flex;justify-content:center;align-items:flex-end;pointer-events:none;}',
        '#hr-event.hr-inline[hidden]{display:none !important;}',
        '#hr-event.hr-inline .hr-card{pointer-events:auto;width:min(560px,100%);max-height:70%;padding:0.45rem 0.6rem 0.55rem;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,0.35);overflow:auto;}',
        '#hr-event.hr-inline .hr-card h2{font-size:1rem;margin:0 0 0.15rem;}',
        '#hr-event.hr-inline .hr-card p{font-size:0.8rem;margin:0 0 0.35rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
        '#hr-event.hr-inline .hr-choices{flex-direction:row;flex-wrap:wrap;gap:6px;}',
        '#hr-event.hr-inline .hr-choices button{width:auto;flex:1 1 0;min-width:0;min-height:44px;font-size:0.8rem;padding:0.35rem 0.45rem;white-space:normal;}',
        '#hr-event.hr-inline .hr-card__art .hr-portrait,#hr-event.hr-inline .hr-card__art .hr-icon{width:36px !important;height:36px !important;border-radius:8px;}',
        '@media (max-width:720px){',
        '#hr-event.hr-inline{left:6px;right:6px;bottom:6px;max-height:42%;overflow:hidden;}',
        '#hr-event.hr-inline .hr-card{max-height:100%;padding:0.28rem 0.4rem 0.32rem;overflow:hidden;}',
        '#hr-event.hr-inline .hr-card h2{font-size:0.92rem;line-height:1.15;margin:0 0 0.08rem;}',
        '#hr-event.hr-inline .hr-card p{font-size:0.72rem;line-height:1.25;margin:0 0 0.22rem;-webkit-line-clamp:2;}',
        '#hr-event.hr-inline .hr-card__art{display:none;}',
        '#hr-event.hr-inline .hr-card__timer{margin:0 0 0.2rem;}',
        '#hr-event.hr-inline .hr-choices{flex-wrap:nowrap;gap:6px;}',
        '#hr-event.hr-inline .hr-choices button{min-height:44px;font-size:0.74rem;padding:0.25rem 0.35rem;}',
        '#hr-event.hr-inline .hr-choice-cost{font-size:0.58rem;padding:0.08rem 0.28rem;}',
        '}',
        '.hr-card__timer{height:4px;border-radius:99px;background:rgba(43,29,46,0.15);overflow:hidden;margin:0 0 0.35rem;}',
        '.hr-card__timer i{display:block;height:100%;width:100%;background:#e0a322;}',
        '.hr-actions button{transition:transform 0.05s linear;}',
        '.hr-actions button.is-down{transform:translateY(1px) scale(0.98);filter:brightness(1.12);}'
      ].join('');
      document.head.appendChild(feelCss);
    }
    if (els.event) {
      els.event.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      els.event.addEventListener('pointerup', function (ev) { ev.stopPropagation(); });
    }
    var ymd = utcYmd(new Date());
    var run = null;
    var books = null;
    var sim = null;
    var assets = null;
    var armed = null;
    var undo = null;
    var qaSpeed = 1;
    var shownEvent = null;
    var raf = 0;
    var lastTs = 0;
    var cam = { x: 0, y: 0, follow: true };
    var frameView = { w: 1600, h: 900 };
    var drag = null;
    var moved = false;
    var suppressClick = false;
    var storePlate = null;
    var bakedKey = '';
    var fixtureGlows = null;
    var toastTimer = 0;
    var liveAcc = 0;
    var simSaveAcc = 0;
    var coach = null;
    var shownType = null;
    var crewMode = '';
    var crewArm = null;
    var planEditing = false;
    var loadCount = 0;
    var actx = null;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    els.seed.textContent = ymd;
    paintMeta();

    function paintMeta() {
      var m = metaGet();
      els.streak.textContent = String(m.streak);
      els.best.textContent = bestGet(ymd) ? String(bestGet(ymd)) : '—';
    }

    var toastQueue = [];
    var toastOn = false;
    function toast(msg, first, ms) {
      if (!msg) return;
      if (msg === 'Actions are refilling.') {
        if (els.sim && els.sim.hidden) return;
        if (toastQueue.indexOf(msg) >= 0) return;
        if (toastOn && els.toast && els.toast.textContent === msg) return;
      }
      if (first) toastQueue.unshift(msg);
      else toastQueue.push(msg);
      if (!toastOn) playToast(ms);
      else if (first) {
        clearTimeout(toastTimer);
        if (els.toast) els.toast.classList.remove('show');
        toastOn = false;
        playToast(ms);
      }
    }
    function playToast(ms) {
      if (!els.toast || !toastQueue.length) { toastOn = false; return; }
      toastOn = true;
      els.toast.textContent = toastQueue.shift();
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        els.toast.classList.remove('show');
        setTimeout(function () {
          if (toastQueue.length) playToast();
          else toastOn = false;
        }, 160);
      }, ms || 2200);
    }
    function clearRefillNotice() {
      toastQueue = toastQueue.filter(function (m) { return m !== 'Actions are refilling.'; });
      var line = document.getElementById('hr-actline');
      if (line) line.textContent = '';
      if (els.toast && els.toast.textContent === 'Actions are refilling.') {
        els.toast.classList.remove('show');
        els.toast.textContent = '';
        clearTimeout(toastTimer);
        toastOn = false;
        if (toastQueue.length) playToast();
      }
    }
    if (HR.economy && HR.economy.listenMilestones && HR.data) {
      HR.economy.listenMilestones(function (booksNow, id) {
        var data = HR.data.get();
        var list = data && data.goals && data.goals.achievements || [];
        var row = null;
        for (var mi = 0; mi < list.length; mi++) if (list[mi].id === id) row = list[mi];
        if (id === 'profit' || id === 'streak-3') return;
        toast(row ? ('Achievement: ' + row.name + '. ' + row.blurb) : 'Achievement unlocked.', true);
      });
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
      if (els.shop) els.shop.hidden = which !== 'shop';
      if (els.map) els.map.hidden = which !== 'map';
      els.final.hidden = which !== 'final';
      if (which !== 'sim') {
        els.event.hidden = true;
        els.modal.hidden = true;
        clearRefillNotice();
      }
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

    var music = { timer: 0, next: 0, step: 0, master: null, sfx: null, crowd: null, rush: false, started: false };

    function audioMuted() {
      if (root.CGSfx && root.CGSfx.isMuted) return !!root.CGSfx.isMuted();
      return false;
    }

    function heard(name) {
      if (!root.__hrSfx) root.__hrSfx = {};
      root.__hrSfx[name] = (root.__hrSfx[name] || 0) + 1;
    }

    function duckMusic(a, dip, backAfter) {
      if (!music.master || !a) return;
      var now = a.currentTime;
      try {
        music.master.gain.setTargetAtTime(dip, now, 0.02);
        music.master.gain.setTargetAtTime(1, now + (backAfter || 0.28), 0.08);
      } catch (eDuck) {}
    }

    function playSfx(name, extra) {
      if (audioMuted()) return;
      ensureMusic();
      var a = hrAudio();
      if (!a || !music.sfx) return;
      mixSfx(a, music.sfx, name, a.currentTime, extra || {});
    }

    function paintMute() {
      var btn = document.getElementById('hr-mute');
      if (!btn) return;
      var off = audioMuted();
      btn.setAttribute('aria-pressed', off ? 'true' : 'false');
      btn.setAttribute('aria-label', off ? 'Unmute sound' : 'Mute sound');
      btn.textContent = off ? 'Muted' : 'Sound';
    }

    function scheduleMusic() {
      var a = hrAudio();
      if (!a || !music.master || audioMuted()) return;
      var horizon = a.currentTime + 0.45;
      var eighth = music.rush ? 0.22 : 0.3;
      var guard = 0;
      while (music.next < horizon && guard < 10) {
        guard++;
        mixBeat(a, music.master, music.next, music.step, music.rush);
        music.next += eighth;
        music.step++;
      }
    }

    function ensureMusic() {
      if (audioMuted()) return;
      var a = hrAudio();
      if (!a) return;
      if (!music.master) {
        try {
          var buses = buildMixGraph(a);
          music.master = buses.music;
          music.sfx = buses.sfx;
          music.lift = buses.lift;
          mixDrone(a, buses.music, a.currentTime, 0, null);
          var src = a.createBufferSource();
          src.buffer = noiseBuffer(a, 2, 11);
          src.loop = true;
          var low = a.createBiquadFilter();
          low.type = 'lowpass';
          low.frequency.value = 380;
          music.crowd = a.createGain();
          music.crowd.gain.setValueAtTime(0.006, a.currentTime);
          src.connect(low);
          low.connect(music.crowd);
          music.crowd.connect(music.master);
          src.start();
        } catch (err) { return; }
      }
      if (music.started) {
        try { music.master.gain.setTargetAtTime(1, a.currentTime, 0.05); } catch (eGain) {}
        if (music.sfx) {
          try { music.sfx.gain.setTargetAtTime(1, a.currentTime, 0.03); } catch (eSfx) {}
        }
        if (!music.timer) music.timer = setInterval(scheduleMusic, 100);
        return;
      }
      music.started = true;
      heard('music');
      music.next = a.currentTime + 0.05;
      music.timer = setInterval(scheduleMusic, 100);
      scheduleMusic();
    }

    function setAudioMuted(flag) {
      var off = !!flag;
      if (root.CGSfx && root.CGSfx.setMuted) root.CGSfx.setMuted(off);
      if (off) {
        if (music.timer) { clearInterval(music.timer); music.timer = 0; }
        if (music.master && actx) {
          try { music.master.gain.setTargetAtTime(0.0001, actx.currentTime, 0.03); } catch (e2) {}
        }
        if (music.sfx && actx) {
          try { music.sfx.gain.setTargetAtTime(0.0001, actx.currentTime, 0.02); } catch (e3) {}
        }
      } else {
        ensureMusic();
      }
      paintMute();
    }

    hooks.heat = function (customers, rush) {
      music.rush = !!rush;
      if (!actx || audioMuted()) return;
      if (music.crowd) {
        var target = Math.min(0.028, 0.008 + customers * 0.0008 + (rush ? 0.012 : 0));
        try { music.crowd.gain.setTargetAtTime(target, actx.currentTime, 0.3); } catch (eHeat) {}
      }
      if (music.lift) {
        try { music.lift.gain.setTargetAtTime(rush ? 1.32 : 1, actx.currentTime, 0.28); } catch (eLift) {}
      }
    };
    hooks.sale = function (combo) {
      heard('scan');
      heard('coin');
      heard(combo > 1 ? 'combo' : 'sale');
      var a = hrAudio();
      if (a) duckMusic(a, 0.62, combo > 1 ? 0.42 : 0.26);
      playSfx(combo > 1 ? 'combo' : 'sale', { combo: combo || 1 });
    };
    hooks.coin = function () {
      heard('coin');
      playSfx('coin');
    };
    hooks.kaching = function () { hooks.sale(1); };
    hooks.horn = function () {
      heard('truck');
      var a = hrAudio();
      if (a) duckMusic(a, 0.7, 0.4);
      playSfx('truck');
    };
    hooks.tap = function () { playSfx('tap'); };
    hooks.angry = function () {
      heard('angry');
      var a = hrAudio();
      if (a) duckMusic(a, 0.68, 0.34);
      playSfx('angry');
    };
    hooks.goal = function () {
      heard('goal');
      var a = hrAudio();
      if (a) duckMusic(a, 0.6, 0.5);
      playSfx('goal');
    };
    hooks.fanfare = function () {
      heard('fanfare');
      var a = hrAudio();
      if (a) duckMusic(a, 0.55, 0.7);
      playSfx('fanfare');
    };
    hooks.rush = function () {
      heard('rush');
      var a = hrAudio();
      if (a) duckMusic(a, 0.72, 0.4);
      playSfx('rush');
    };
    hooks.alert = function () { playSfx('alert'); };
    hooks.action = function (name) {
      heard(name || 'action');
      if (name === 'freight' || name === 'calm' || name === 'pull' || name === 'cover') playSfx(name);
      else playSfx('action');
    };

    document.addEventListener('pointerdown', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#hr-mute')) return;
      ensureMusic();
    });

    function portraitStyle(id, expr, size) {
      if (!assets) return '';
      var pack = assets.spritePack;
      if (pack && pack.ready) {
        var bucket = pack.portraits[id] || pack.portraits[SPRITE_TYPE_BY_ID[id] || ''];
        var drawn = bucket && (bucket[expr] || bucket.neutral || bucket.impatient);
        if (drawn) {
          return 'background-image:url(' + drawn.url + ');background-size:' + size + 'px ' + size + 'px;background-position:0 0;width:' + size + 'px;height:' + size + 'px;';
        }
      }
      if (!assets.portraits) return '';
      var rec = assets.portraits[id + '_' + expr] || assets.portraits[id + '_neutral'] || assets.portraits[id + '_impatient'];
      if (!rec || !assets.img) return '';
      var img = rec[0] === 'staff' ? assets.img.staff : assets.img.cust;
      if (!img) return '';
      var scale = size / rec[3];
      return 'background-image:url(' + img.src + ');background-size:' + (img.naturalWidth * scale) + 'px ' + (img.naturalHeight * scale) + 'px;background-position:' + (-rec[1] * scale) + 'px ' + (-rec[2] * scale) + 'px;width:' + size + 'px;height:' + size + 'px;';
    }

    function iconStyle(name, size) {
      var illustrated = {
        angry: 1, boss: 1, break: 1, callout: 1, line: 1, outstock: 1,
        price: 1, return: 1, rush: 1, spill: 1, theft: 1, truck: 1
      };
      if (illustrated[name]) {
        return 'background-image:url(' + ART + 'objects/icons/' + name + '.png);background-size:contain;background-repeat:no-repeat;background-position:center;width:' + size + 'px;height:' + size + 'px;';
      }
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

    function applyCampaign(runObj) {
      var camp = campaignGet();
      runObj.upgrades = camp.upgrades || {};
      return camp;
    }

    function layoutApi() {
      return {
        spots: SPOTS,
        shelves: SHELVES,
        queue: QUEUE,
        setWorld: function (w, h) { WORLD_W = w; WORLD_H = h; },
        setReg3: function (on) { reg3Live = !!on; }
      };
    }

    function syncFloor(force) {
      if (!books || !HR.layout || !HR.world || !HR.data.get()) return;
      var layout = HR.world.activeLayout(books);
      var custom = layout && (layout.edited || layout.worldW > 1600 || books.active !== 'mart');
      if (!custom && !floorDirty && !force) {
        activeLayout = null;
        reg3Live = false;
        return;
      }
      var source = custom ? layout : HR.data.get().layouts.starter;
      HR.layout.apply(source, layoutApi());
      activeLayout = HR.layout.wantsGrid(source) ? source : null;
      floorDirty = !!custom;
      trafficBlocked._layout = null;
      bakeStorePlate();
    }

    function syncHires() {
      if (!books || !HR.data.get()) return;
      var hires = HR.data.get().staff.hires;
      hires.forEach(function (h) {
        var rec = books.staff[h.id];
        var employed = !!(rec && rec.employed);
        var idx = -1;
        for (var i = 0; i < STAFF.length; i++) if (STAFF[i].id === h.id) idx = i;
        if (!employed) {
          if (idx >= 0) STAFF.splice(idx, 1);
          delete BY_ID[h.id];
          if (run && run.schedule) {
            for (var d = 0; d < run.schedule.length; d++) {
              for (var s = 0; s < 3; s++) {
                var stations = stationList();
                for (var k = 0; k < stations.length; k++) {
                  if (run.schedule[d][s][stations[k]] === h.id) run.schedule[d][s][stations[k]] = null;
                }
              }
            }
          }
          return;
        }
        if (idx < 0) {
          var twin = h.role === 'manager' ? 'staff_mgr' : h.role === 'register' ? 'staff_reg1' : h.role === 'freight' ? 'staff_frt1' : 'staff_flr1';
          var person = { id: h.id, name: h.name, role: h.role, blurb: h.blurb, wage: h.wage };
          STAFF.push(person);
          BY_ID[h.id] = person;
          LOOKS[h.id] = LOOKS[twin];
          SPRITE_TYPE_BY_ID[h.id] = h.sprite;
        }
        if (run && run.days) {
          for (var day = 0; day < run.days.length; day++) {
            if (!run.days[day].avail[h.id]) run.days[day].avail[h.id] = [1, 1, 1];
          }
        }
      });
    }

    function prepareFloor(index) {
      if (!books || !HR.economy || !HR.sim) return;
      HR.economy.beginShiftBooks(books);
      var away = HR.economy.awayIds(books);
      var pulled = HR.sim.pullAway(run.schedule[index], away);
      run._awayNote = pulled || [];
      syncFloor(false);
      if (spriteSession && HR.sprites) spriteSession.ensure(HR.sprites.typesForDay(index, books));
    }

    function beginShift(index, opts) {
      opts = opts || {};
      coach = null;
      if (!run || !run.days || run.days.length !== SHIFT_COUNT) run = newRun(ymd);
      if (index < 0) index = 0;
      if (index >= SHIFT_COUNT) index = SHIFT_COUNT - 1;
      var camp = applyCampaign(run);
      if (!shiftUnlocked(camp, index)) {
        toast('Clear the previous shift first.');
        renderMap();
        return;
      }
      run.day = index;
      run.phase = 'sim';
      var keepCrew = (opts && opts.keepCrew) || (run.crewLock && run.crewLock[index]);
      syncHires();
      if (!keepCrew) run.schedule[index] = greedy(run, index);
      prepareFloor(index);
      if (!run.met) run.met = campaignGet().met || {};
      run.simState = null;
      sim = startDay(run);
      if (books) {
        sim.books = books;
        sim.cogs = 0;
        sim.stockouts = 0;
      }
      camp.seen = true;
      camp.current = index;
      campaignPut(camp);
      saveRun();
      track('holiday_rush_day_start', { seed: ymd, day: index + 1 });
      renderSim({ resume: false });
    }

    function beginFresh() { beginShift(0); }

    function beginTenantShift(slotId) {
      if (!books || !books.mall || !books.mall.leases || !books.mall.leases[slotId]) {
        toast('That unit is empty.');
        return;
      }
      if (!HR.world || !HR.world.tenantLayout || !HR.layout || !HR.data.get()) return;
      var row = books.mall.leases[slotId];
      var tenant = HR.data.get().tenants.byId[row.tenantId];
      var layout = HR.world.tenantLayout(row.tenantId);
      if (!tenant || !layout) return;
      coach = null;
      if (!run || !run.days || run.days.length !== SHIFT_COUNT) run = newRun(ymd);
      run.phase = 'sim';
      run._tenantSlot = slotId;
      HR.layout.apply(layout, layoutApi());
      floorDirty = true;
      activeLayout = layout;
      trafficBlocked._layout = null;
      bakeStorePlate();
      if (spriteSession && HR.sprites) spriteSession.ensure(HR.sprites.typesForDay(run.day || 0, books));
      sim = startDay(run);
      sim.books = books;
      sim.cogs = 0;
      sim.stockouts = 0;
      sim.tenant = {
        slot: slotId,
        tenantId: row.tenantId,
        name: tenant.name,
        spawnMul: layout.spawnMul || 1,
        bias: layout.bias || '',
        mechanic: layout.mechanic || ''
      };
      sim.goal = Math.max(900, Math.round((sim.goal || 7500) * (layout.goalMul || 0.45)));
      if (HR.economy && HR.economy.ensureTenantStock) {
        var seeded = HR.economy.ensureTenantStock(row);
        sim.tenant.stock = seeded.stock;
        if (seeded.filled) toast('Their back room was empty. A starter delivery is on the shelf. It is not the mart\'s stock.', true);
      }
      saveRun();
      renderSim({ resume: false });
    }

    function finishTenant() {
      var who = sim.tenant;
      var snap = scoreSnapshot(sim);
      var cut = Math.round((snap.sales || 0) * 0.15);
      books.cash = Math.round((books.cash || 0) + cut);
      if (!books.tenantRuns) books.tenantRuns = [];
      books.tenantRuns.unshift({
        name: who.name,
        tenantId: who.tenantId,
        slot: who.slot,
        sales: Math.round(snap.sales || 0),
        cut: cut
      });
      if (books.tenantRuns.length > 8) books.tenantRuns.length = 8;
      persistBooks(books);
      snap.tenant = who.name;
      snap.tenantId = who.tenantId;
      snap.slot = who.slot;
      snap.cut = cut;
      snap.sales = Math.round(snap.sales || 0);
      snap.earned = cut;
      snap.bank = books.cash;
      snap.bestCombo = sim.bestCombo || 0;
      snap.shiftStars = goalStars(snap.goalPct || 0);
      snap.closeNote = announceClose(cut > 0);
      var tenantCamp = campaignGet();
      if (tenantCamp.playedDay !== (run && run.ymd)) {
        tenantCamp.playedDay = run.ymd;
      }
      campaignPut(tenantCamp);
      hooks.fanfare();
      run.history.push(snap);
      run.phase = 'score';
      run.simState = null;
      run.lastSnap = snap;
      run._tenantSlot = '';
      coach = null;
      sim = null;
      floorDirty = false;
      activeLayout = null;
      trafficBlocked._layout = null;
      syncFloor(true);
      saveRun();
      sfx('correct');
      renderScore();
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
      if (run.phase === 'plan' || run.phase === 'perk') {
        renderMap();
      } else if (run.phase === 'shop') {
        renderShop();
      } else if (run.phase === 'map') {
        renderMap();
      } else if (run.phase === 'sim') {
        var snap = run.simState;
        if (snap && typeof snap.t === 'number' && !snap.done) {
          try {
            sim = restoreSim(snap, run);
            if (books) sim.books = books;
            sim._snapSales = Math.round(snap.sales || 0);
            if (els.stage) els.stage.dataset.snapSales = String(sim._snapSales);
            if (snap.tenant && HR.world && HR.world.tenantLayout && HR.layout) {
              var tLayout = HR.world.tenantLayout(snap.tenant.tenantId);
              if (tLayout) {
                HR.layout.apply(tLayout, layoutApi());
                floorDirty = true;
                activeLayout = tLayout;
                bakeStorePlate();
              }
              var leaseHold = books && books.mall && books.mall.leases && books.mall.leases[snap.tenant.slot];
              if (leaseHold && sim.tenant) {
                if (sim.tenant.stock) leaseHold.stock = sim.tenant.stock;
                else if (leaseHold.stock) sim.tenant.stock = leaseHold.stock;
                if (leaseHold.stock) sim.tenant.stock = leaseHold.stock;
              }
            }
            if (snap.pendingMeta && snap.pendingMeta.id === 'mall') {
              sim.pending = buildMallCard(sim);
              if (sim.pending) sim.pendingUntil = sim.t + 9;
              sim._mallShown = true;
            }
            sim.cogs = sim.cogs || 0;
            sim.stockouts = sim.stockouts || 0;
            renderSim({ resume: true });
            if (snap.t > 0.4) toast('Shift resumed.');
          } catch (err) {
            sim = startDay(run);
            renderSim({ resume: false });
          }
        } else {
          if (run.day === 0 && hoursOf(run.schedule[0]) < 1) run.schedule[0] = greedy(run, 0);
          prepareFloor(run.day);
          sim = startDay(run);
          if (books) {
            sim.books = books;
            sim.cogs = 0;
            sim.stockouts = 0;
          }
          renderSim({ resume: false });
        }
      } else if (run.phase === 'score' || run.phase === 'perk') renderScore();
      else if (run.phase === 'final') renderMap();
      else renderMap();
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
            for (var i = 0; i < stationList().length; i++) {
              if (run.schedule[day][s][stationList()[i]] === person.id) run.schedule[day][s][stationList()[i]] = null;
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
      stationList().forEach(function (st) {
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
            stationList().forEach(function (st) {
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
        for (var i = 0; i < stationList().length; i++) {
          var id = prev[sh][stationList()[i]];
          if (!id) continue;
          var placed = tryPlace(next, avail, id, sh, stationList()[i], null);
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
      revealTop();
      els.modal.hidden = true;
      els.event.hidden = true;
      if (!opts.resume) applyMallRetune(sim);
      applyCalendar(sim, run ? run.day : 0);
      var storeName = books && books.locations[books.active] ? books.locations[books.active].name : '';
      var ops = run.day >= 1;
      var hud =
        '<div class="hr-hud__stats">' +
        '<div class="hr-clock" id="hr-clock" style="--p:0"><span id="hr-clock-label">8:00 AM</span></div>' +
        '<div class="hr-sales"><div class="hr-sales__top"><span>Sales</span><strong id="hr-sales-text"></strong></div><div class="hr-bar"><i id="hr-sales-bar"></i></div></div>' +
        '<div class="hr-stat hr-stat--stars hr-hud__extra"><span>Stars</span><strong id="hr-star-text" class="hr-stars"></strong></div>' +
        '<div class="hr-combo is-idle" id="hr-combo" aria-hidden="true">×1</div>' +
        '<div class="hr-rush" id="hr-rush" aria-hidden="true">RUSH</div>' +
        (ops ? '<div class="hr-stat hr-hud__extra"><span>Payroll</span><strong id="hr-pay-text"></strong></div><div class="hr-stat hr-hud__extra"><span>Morale</span><strong id="hr-mor-text"></strong></div>' : '') +
        (storeName ? '<div class="hr-stat hr-hud__extra"><span>Store</span><strong id="hr-store-name">' + esc(storeName) + '</strong></div>' : '') +
        (sim.tenant ? '<div class="hr-stat"><span>Floor</span><strong id="hr-tenant-name">' + esc(sim.tenant.name) + (sim.tenant.mechanic ? ' · ' + esc(mechanicLabel(sim.tenant.mechanic)) : '') + '</strong></div>' : '') +
        (sim.calendarName && !sim.tenant ? '<div class="hr-stat hr-hud__extra"><span>Today</span><strong id="hr-cal-name">' + esc(sim.calendarName) + '</strong></div>' : '') +
        (sim.mallRetune ? '<div class="hr-stat hr-hud__extra"><span>Plaza</span><strong id="hr-plaza-text">' + esc(sim.mallRetune) + '</strong></div>' : '') +
        (books ? '<div class="hr-stat hr-aisle hr-hud__extra"><span>Aisle</span><strong id="hr-aisle-text">Steady</strong></div>' : '') +
        '</div>' +
        '<div class="hr-hud__tools">' +
        '<button type="button" id="hr-crew-btn" class="hr-mute">Crew</button>' +
        '<button type="button" id="hr-mute" class="hr-mute" aria-pressed="false" aria-label="Mute sound">Sound</button>' +
        '</div>';
      function actButton(name, label, icon) {
        return '<button type="button" data-act="' + name + '"><span class="hr-icon" style="' + iconStyle(icon, 28) + '" aria-hidden="true"></span><span>' + label + '</span></button>';
      }
      var actions =
        actButton('cover', 'Cover a gap', 'boss') +
        actButton('pull', 'Pull to register', 'line') +
        actButton('freight', 'Work freight', 'truck') +
        actButton('calm', 'Calm a customer', 'angry');
      els.sim.querySelector('.hr-hud').innerHTML = hud;
      els.sim.querySelector('.hr-actions').innerHTML = actions;
      sim.live = true;
      sim.floorOn = true;
      if (run._awayNote && run._awayNote.length) {
        toast(run._awayNote.map(firstName).join(', ') + ' is off this floor.');
        run._awayNote = [];
      }
      primeShift(sim, run);
      if (tutDone()) sim.coachHold = false;
      resize();
      requestAnimationFrame(function () { resize(); if (sim && !els.sim.hidden) draw(); });
      focusCam(SPOTS.reg1.x, QUEUE.reg1.y);
      if (sim.tenant) sim.coachHold = false;
      if (!sim.tenant && !opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else if (!sim.tenant && opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else paintCoach();
      paintHud();
      paintMute();
      draw();
      saveRun();
      if (!root.__hrReadyAt) root.__hrReadyAt = root.performance ? root.performance.now() : 0;
      startLoop();
    }

    function starGlyph(n) {
      var lit = (n == null || n !== n) ? 0 : n;
      var s = '';
      for (var i = 0; i < 3; i++) s += '<i' + (i < lit ? ' class="on"' : '') + '>' + (i < lit ? '★' : '☆') + '</i>';
      return s;
    }

    function paintHud() {
      if (!sim) return;
      var label = document.getElementById('hr-clock-label');
      var clock = document.getElementById('hr-clock');
      var salesText = document.getElementById('hr-sales-text');
      if (!label || !salesText) return;
      label.textContent = clockLabel(sim.t, sim.duration);
      var rushing = !!(sim._qaRush || (sim._heat && sim._heat.rush && !sim.coachHold));
      if (clock) {
        clock.style.setProperty('--p', String(clamp(sim.t / sim.duration, 0, 1)));
        clock.classList.toggle('rush', rushing);
      }
      var salesLab = salesText.parentNode && salesText.parentNode.querySelector('span');
      if (salesLab) {
        var rushWord = rushing;
        try { if (window.matchMedia('(max-width: 720px)').matches) rushWord = false; } catch (eRushWord) {}
        salesLab.textContent = shiftLabel(run.day) + ' · ' + SHIFT_NAMES[shiftIndex(sim)] + (rushWord ? ' rush' : '');
      }
      if (sim._paintSales != null && sim.sales > sim._paintSales && root.CGSfx && root.CGSfx.juice) {
        root.CGSfx.juice(salesText, 'pop');
      }
      sim._paintSales = sim.sales;
      salesText.textContent = money(sim.sales) + ' / ' + money(sim.goal);
      var bar = document.getElementById('hr-sales-bar');
      if (bar) {
        bar.style.width = Math.min(100, sim.goal ? (sim.sales / sim.goal) * 100 : 0) + '%';
        bar.style.background = sim.goalBurst ? '#e0a322' : '#2f9e57';
      }
      var comboEl = document.getElementById('hr-combo');
      if (comboEl) {
        var showCombo = (sim.combo || 0) > 1;
        comboEl.hidden = false;
        comboEl.classList.toggle('is-idle', !showCombo);
        comboEl.setAttribute('aria-hidden', showCombo ? 'false' : 'true');
        if (showCombo) {
          var comboLabel = multLabel(sim.combo);
          var atCap = sim.combo >= CONFIG.comboMax || comboMult(sim.combo) >= 4;
          comboEl.classList.toggle('is-max', atCap);
          comboEl.setAttribute('aria-label', atCap ? 'Combo capped at ×4 pay' : 'Combo ' + comboLabel);
          if (comboEl.textContent !== comboLabel) {
            comboEl.textContent = comboLabel;
            if (!reduceMotion && root.CGSfx && root.CGSfx.juice) root.CGSfx.juice(comboEl, 'pop');
          }
        } else {
          comboEl.classList.remove('is-max');
          comboEl.setAttribute('aria-label', 'Combo ×1');
          if (comboEl.textContent !== '×1') comboEl.textContent = '×1';
        }
      }
      var rushEl = document.getElementById('hr-rush');
      if (rushEl) {
        rushEl.hidden = false;
        rushEl.classList.toggle('is-on', rushing);
        rushEl.setAttribute('aria-hidden', rushing ? 'false' : 'true');
      }
      if (els.stage) {
        els.stage.dataset.rush = rushing ? '1' : '0';
        els.stage.dataset.combo = String(sim.combo || 0);
        els.stage.dataset.sales = String(Math.round(sim.sales));
          if (sim._snapSales != null) els.stage.dataset.snapSales = String(sim._snapSales);
          if (sim.tenant) els.stage.dataset.tenant = sim.tenant.name;
          else delete els.stage.dataset.tenant;
          if (sim.books && sim.books.locations && sim.books.locations[sim.books.active]) {
            els.stage.dataset.store = sim.books.locations[sim.books.active].name;
          }
          if (sim.tenant && sim.tenant.stock && HR.economy && HR.economy.stockUnits) {
            els.stage.dataset.warehouse = String(HR.economy.stockUnits(sim.tenant.stock));
          } else if (els.stage.dataset.warehouse) {
            delete els.stage.dataset.warehouse;
          }
          els.stage.dataset.mechanic = (sim.tenant && sim.tenant.mechanic) || '';
          els.stage.dataset.calendar = sim.calendarName || '';
        els.stage.dataset.clock = label.textContent;
        fitHud();
        if (isQA()) {
          var arches = [];
          for (var ai = 0; ai < sim.customers.length; ai++) if (sim.customers[ai].arch) arches.push(sim.customers[ai].arch);
          els.stage.dataset.arches = arches.join(',');
          els.stage.dataset.typecard = sim.typeCard || '';
          var upKids = 0;
          var kidSpot = '';
          for (var uk = 0; uk < sim.customers.length; uk++) {
            var ukc = sim.customers[uk];
            if ((ukc.charId === 'cust_kid' || ukc.arch === 'family') && ukc.dir === 'up' && ukc.state !== 'leave') {
              upKids++;
              if (!kidSpot) kidSpot = Math.round(ukc.x) + ',' + Math.round(ukc.y);
            }
          }
          els.stage.dataset.upkids = String(upKids);
          els.stage.dataset.kidspot = kidSpot;
          var dirBits = [];
          for (var di = 0; di < sim.customers.length && dirBits.length < 6; di++) {
            var dc = sim.customers[di];
            dirBits.push(dc.charId.replace('cust_', '') + (dc.arch ? '/' + dc.arch : '') + ':' + dc.dir);
          }
          els.stage.dataset.dirs = dirBits.join(' ');
          els.stage.dataset.paused = sim.paused ? '1' : '0';
          els.stage.dataset.prompt = sim.pending ? (sim.pending.id || 'card') : (sim.typeCard || '');
        }
      }
      var payEl = document.getElementById('hr-pay-text');
      var morEl = document.getElementById('hr-mor-text');
      if (payEl) payEl.textContent = money(sim.payroll);
      if (morEl) morEl.textContent = String(Math.round(sim.morale));
      var aisleEl = document.getElementById('hr-aisle-text');
      if (aisleEl && sim.books && HR.economy) {
        var moodMul = HR.economy.demandMul(sim.books);
        var mood = moodMul < 0.9 ? 'Thin' : moodMul > 1.08 ? 'Busy' : 'Steady';
        aisleEl.textContent = mood;
        if (isQA() && els.stage) {
          els.stage.dataset.aisle = mood;
          els.stage.dataset.demand = String(Math.round(moodMul * 100) / 100);
          els.stage.dataset.priceWalks = String(sim.priceWalks || 0);
          els.stage.dataset.grumbles = String(sim.grumbles || 0);
          els.stage.dataset.beat = sim.pending ? (sim.pending.id || '') : '';
          els.stage.dataset.retune = sim.mallRetune || '';
          els.stage.dataset.plaza = String(sim.plazaMul == null ? 1 : sim.plazaMul);
          var cocoaItem = HR.data && HR.data.get() && HR.data.get().items.byId.cocoa;
          if (cocoaItem) els.stage.dataset.cocoa = String(HR.economy.priceOf(sim.books, cocoaItem));
        }
      }
      var starEl = document.getElementById('hr-star-text');
      if (starEl) starEl.innerHTML = starGlyph(paceStars(sim));
      var act = document.getElementById('hr-actline');
      var crewBtn = document.getElementById('hr-crew-btn');
      if (crewBtn) crewBtn.hidden = !!coach;
      if (act) {
        if (coach) {
          act.textContent = 'Tutorial · clock is paused · step ' + (coach.step + 1) + ' of 3. Skip is there if you want the floor now.';
        } else {
          var maxA = sim.actionMax || CONFIG.baseActions;
          var regenSec = CONFIG.actionRegen / (1 + 0.28 * upgradeLevel(run, 'hustle'));
          var fill = sim.actions >= maxA ? 1 : clamp((sim.actionFrac || 0) / regenSec, 0, 1);
          act.textContent = sim.actions + ' / ' + maxA + ' actions · refills every ' + (Math.round(regenSec * 10) / 10) + 's' + (sim.actions < maxA ? ' · ' + Math.round(fill * 100) + '% to the next' : '');
        }
      }
    }

    function paintPromptTimer() {
      var bar = document.getElementById('hr-prompt-bar');
      if (!bar || !sim) return;
      var until = sim.pending ? sim.pendingUntil : sim.typeUntil;
      var total = sim.pending ? 7 : 5.5;
      var left = until ? (until - sim.t) / total : 1;
      bar.style.width = (Math.max(0, Math.min(1, left)) * 100) + '%';
    }

    function renderEvent() {
      var card = sim.pending;
      if (!card) { els.event.hidden = true; return; }
      els.event.classList.add('hr-inline');
      els.event.hidden = false;
      var art = '';
      if (card.who) art = '<span class="hr-portrait" style="' + portraitStyle(card.who, card.expr || 'neutral', 36) + '"></span>';
      art += '<span class="hr-icon" style="' + iconStyle(card.icon, 36) + '"></span>';
      var buttons = card.choices.map(function (ch, i) {
        var disabled = ch.cost && sim.actions < ch.cost;
        var cost = ch.cost
          ? '<span class="hr-choice-cost">1 action</span>'
          : '<span class="hr-choice-cost hr-choice-cost--free">Free</span>';
        return '<button type="button" data-choice="' + i + '"' + (disabled ? ' disabled' : '') + '>' + cost + '<span>' + esc(ch.label) + '</span></button>';
      }).join('');
      els.event.innerHTML = '<div class="hr-card" role="region" aria-labelledby="hr-ev-title"><div class="hr-card__timer" aria-hidden="true"><i id="hr-prompt-bar"></i></div><div class="hr-card__art">' + art + '</div><h2 id="hr-ev-title">' + esc(card.title) + '</h2><p>' + esc(card.body) + '</p><div class="hr-choices">' + buttons + '</div></div>';
      hooks.alert();
      paintPromptTimer();
      els.event.querySelector('.hr-choices').addEventListener('pointerdown', function (ev) {
        var btn = ev.target.closest('[data-choice]');
        if (!btn || btn.disabled) return;
        ev.preventDefault();
        ev.stopPropagation();
        var res = resolvePending(sim, run, +btn.getAttribute('data-choice'));
        if (!res.ok) { toast(res.msg); sfx('miss'); return; }
        sfx('place');
        buzz(8);
        els.event.hidden = true;
        paintHud();
        draw();
      });
      if (els.live) els.live.textContent = card.title + '. ' + card.body + ' The floor keeps moving.';
    }

    function announceClose(inBlack, camp) {
      camp = camp || campaignGet();
      if (run && (!camp.playedDay || camp.playedDay !== run.ymd)) {
        var streakNow = bumpStreak(run.ymd);
        camp.playedDay = run.ymd;
        paintMeta();
        if (books && streakNow && streakNow.streak >= 3 && HR.economy && HR.economy.milestone) {
          HR.economy.milestone(books, 'streak-3');
        }
      }
      var meta = metaGet();
      var parts = [];
      if (inBlack) parts.push('In the black.');
      if (meta.streak >= 1) parts.push('Streak ' + meta.streak + '.');
      var line = parts.join(' ');
      if (line) {
        toastQueue = toastQueue.filter(function (m) { return m !== 'Actions are refilling.'; });
        if (els.toast && els.toast.textContent === 'Actions are refilling.') {
          els.toast.classList.remove('show');
          els.toast.textContent = '';
          clearTimeout(toastTimer);
          toastOn = false;
        }
        toast(line, true, 4200);
      }
      return line;
    }

    function bankShift(snap) {
      var camp = campaignGet();
      var stars = goalStars(snap.goalPct);
      var prevStars = camp.stars[run.day] || 0;
      if (stars > prevStars) camp.stars[run.day] = stars;
      if (books && sim && HR.economy) {
        var postKey = String(run.day);
        books.posted = books.posted || {};
        books.closed = books.closed || {};
        var firstClose = !books.closed[postKey];
        var prevPost = books.posted[postKey] || 0;
        var tape = HR.economy.closeShift(books, {
          sales: snap.sales,
          cogs: sim.cogs || 0,
          wages: snap.payroll,
          walkouts: snap.walkouts,
          checkouts: snap.checkouts,
          stockouts: sim.stockouts || 0,
          goalPct: snap.goalPct
        });
        if (!firstClose) books.cash = Math.round(books.cash - prevPost);
        else if (HR.world) {
          snap.background = HR.world.closeBackground(books);
        }
        books.posted[postKey] = tape.profit;
        books.closed[postKey] = 1;
        if (HR.world && HR.world.claimDaily && run.ymd) {
          var daily = HR.world.claimDaily(books, run.ymd, {
            walkouts: snap.walkouts || 0,
            goalPct: snap.goalPct || 0,
            bestCombo: snap.bestCombo || 0
          });
          snap.daily = { claimed: !!daily.claimed, bonus: daily.bonus || 0, goal: daily.goal || null };
        }
        if (books.active === 'kiosk' && HR.economy.milestone) HR.economy.milestone(books, 'two-floors');
        tape.cash = books.cash;
        snap.tape = tape;
        snap.earned = tape.profit;
        snap.bank = books.cash;
        camp.bank = books.cash;
        if (HR.save) HR.save.save(writeJSON, books);
      } else {
        var earned = Math.round((snap.sales || 0) * CONFIG.earnRate);
        var prevEarn = camp.bestEarn[run.day] || 0;
        var gain = Math.max(0, earned - prevEarn);
        if (earned > prevEarn) camp.bestEarn[run.day] = earned;
        camp.bank = (camp.bank || 0) + gain;
        snap.earnGross = earned;
        snap.earnPrev = prevEarn;
        snap.earned = gain;
        snap.bank = camp.bank;
      }
      camp.seen = true;
      camp.current = run.day;
      var inBlack = !!(snap.tape && snap.tape.profit > 0);
      snap.closeNote = announceClose(inBlack, camp);
      campaignPut(camp);
      snap.shiftStars = stars;
      snap.bestComboLabel = (snap.bestCombo || 0) > 1 ? multLabel(snap.bestCombo) : '';
      return snap;
    }

    function finishDay() {
      if (sim && sim.tenant) {
        finishTenant();
        return;
      }
      var snap = scoreSnapshot(sim);
      snap.bestCombo = sim.bestCombo || 0;
      hooks.fanfare();
      bankShift(snap);
      run.history.push(snap);
      run.morale = clamp(sim.morale, 0, 100);
      run.phase = 'score';
      run.simState = null;
      run.lastSnap = snap;
      coach = null;
      sim = null;
      saveRun();
      sfx('correct');
      var totalStars = 0;
      var camp = campaignGet();
      for (var i = 0; i < SHIFT_COUNT; i++) totalStars += camp.stars[i] ? 1 : 0;
      if (totalStars >= SHIFT_COUNT && !run.celebrated) {
        run.celebrated = true;
        if (root.CGPlayer && root.CGPlayer.record) root.CGPlayer.record('holiday-rush', { score: snap.points, daily: true });
      }
      renderScore();
    }

    function renderTypeCard() {
      var id = sim && sim.typeCard;
      var card = id && ARCH_CARD[id];
      var spec = id && archDef(id);
      if (!card || !spec) return;
      els.event.classList.add('hr-inline');
      els.event.hidden = false;
      var art = '<span class="hr-portrait" style="' + portraitStyle(spec.who, 'impatient', 36) + '"></span><span class="hr-icon" style="' + iconStyle(card.icon, 36) + '"></span>';
      els.event.innerHTML = '<div class="hr-card" role="region" aria-labelledby="hr-type-title"><div class="hr-card__timer" aria-hidden="true"><i id="hr-prompt-bar"></i></div><div class="hr-card__art">' + art + '</div><p class="hr-kicker">Week ' + (((run.day / 5) | 0) + 1) + '</p><h2 id="hr-type-title">' + esc(card.title) + '</h2><p>' + esc(card.body) + '</p><div class="hr-choices"><button type="button" id="hr-type-ok">Got it</button></div></div>';
      paintPromptTimer();
      document.getElementById('hr-type-ok').addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var title = card.title;
        dismissTypeCard(sim, run);
        els.event.hidden = true;
        shownType = null;
        toast(title.replace('New shopper: ', '') + ' is on the floor.');
        sfx('place');
        saveRun();
      });
      if (els.live) els.live.textContent = card.title + '. ' + card.body + ' The floor keeps moving.';
    }

    function openCrew(mode) {
      if (!run) return;
      if (mode === 'live') {
        if (!sim || sim.done || coach || sim.pending || sim.typeCard) return;
        sim.paused = true;
        sim._hold = 'crew';
      }
      crewMode = mode;
      crewArm = null;
      paintCrew();
    }

    function paintCrew() {
      var day = run.day;
      var sh = crewMode === 'live' && sim ? shiftIndex(sim) : 0;
      var sched = run.schedule[day];
      var avail = run.days[day].avail;
      var stations = stationList().map(function (st) {
        var sid = sched[sh][st];
        var who = sid && BY_ID[sid] ? firstName(sid) : 'Empty';
        var match = sid && BY_ID[sid] && ((st.indexOf('reg') === 0 && BY_ID[sid].role === 'register') || BY_ID[sid].role === st || BY_ID[sid].role === 'manager');
        return '<button type="button" class="hr-station' + (match ? ' is-match' : '') + '" data-crew-station="' + st + '"><small>' + STATION_LABEL[st] + '</small><b>' + esc(who) + '</b></button>';
      }).join('');
      var names = STAFF.map(function (s) {
        var on = avail[s.id] && avail[s.id][sh];
        var armed = crewArm === s.id ? ' is-armed' : '';
        return '<button type="button" class="hr-name role-' + s.role + armed + '" data-crew-id="' + s.id + '"' + (on ? '' : ' disabled') + '>' + esc(firstName(s.id)) + '</button>';
      }).join('');
      var block = SHIFT_NAMES[sh];
      var lead = crewMode === 'live'
        ? block + ' is paused. Presets rewrite the whole day. A tap assigns this block only.'
        : 'Choose who runs the retry. Presets fill Open, Mid, and Close. Then run this crew.';
      els.modal.hidden = false;
      els.modal.innerHTML =
        '<div class="hr-card hr-card--crew" role="dialog" aria-modal="true" aria-labelledby="hr-crew-title">' +
        '<p class="hr-kicker">Crew board</p><h2 id="hr-crew-title">' + (crewMode === 'live' ? block + ' crew' : 'Set the crew') + '</h2>' +
        '<p>' + esc(lead) + '</p>' +
        '<div class="hr-presets">' +
        '<button type="button" data-preset="tills">Tills</button>' +
        '<button type="button" data-preset="balanced">Balanced</button>' +
        '<button type="button" data-preset="stock">Stock</button></div>' +
        '<p class="hr-fine" id="hr-crew-sum">' + esc(crewSummary(sched)) + '</p>' +
        '<div class="hr-stations">' + stations + '</div>' +
        '<div class="hr-names">' + names + '</div>' +
        '<p class="hr-fine">Tap a name, then a station. Gray names are off this block. Tills shorten lines and thin the shelves. Stock does the opposite.</p>' +
        '<div class="hr-cta">' +
        (crewMode === 'live'
          ? '<button type="button" class="btn btn--primary" id="hr-crew-done">Back to the floor</button>'
          : '<button type="button" class="btn btn--primary" id="hr-crew-run">Run this crew</button><button type="button" class="btn" id="hr-crew-done">Close</button>') +
        '</div></div>';
      els.modal.querySelector('.hr-presets').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-preset]');
        if (!btn) return;
        var preset = btn.getAttribute('data-preset');
        run.schedule[day] = applyCrewPreset(run, day, preset);
        if (!run.crewLock) run.crewLock = {};
        run.crewLock[day] = true;
        if (crewMode === 'live') retargetCrew(sim, run);
        saveRun();
        sfx('place');
        var said = preset === 'tills' ? 'Tills heavy. Lines move, shelves thin.' : preset === 'stock' ? 'Stock heavy. Shelves hold, lines grow.' : 'Balanced crew.';
        toast(said);
        paintCrew();
      });
      els.modal.querySelector('.hr-names').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-crew-id]');
        if (!btn || btn.disabled) return;
        crewArm = btn.getAttribute('data-crew-id');
        paintCrew();
      });
      els.modal.querySelector('.hr-stations').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-crew-station]');
        if (!btn) return;
        var station = btn.getAttribute('data-crew-station');
        if (!crewArm) {
          var occ = sched[sh][station];
          if (!occ) { toast('Tap a name first.'); return; }
          run.schedule[day][sh][station] = null;
          if (!run.crewLock) run.crewLock = {};
          run.crewLock[day] = true;
          if (crewMode === 'live') retargetCrew(sim, run);
          saveRun();
          sfx('place');
          paintCrew();
          return;
        }
        var from = null;
        for (var i = 0; i < stationList().length; i++) {
          if (sched[sh][stationList()[i]] === crewArm) from = { shift: sh, station: stationList()[i] };
        }
        var res = tryPlace(run.schedule[day], avail, crewArm, sh, station, from);
        if (!res.ok) { toast(res.reason); sfx('miss'); return; }
        run.schedule[day] = res.schedule;
        if (!run.crewLock) run.crewLock = {};
        run.crewLock[day] = true;
        if (sim && crewMode === 'live') {
          delete sim.override[crewArm];
          retargetCrew(sim, run);
        }
        toast(firstName(crewArm) + ' is on ' + STATION_LABEL[station] + '.');
        crewArm = null;
        saveRun();
        sfx('place');
        paintCrew();
      });
      document.getElementById('hr-crew-done').addEventListener('click', function () {
        els.modal.hidden = true;
        crewArm = null;
        if (crewMode === 'live' && sim && sim._hold === 'crew') {
          sim.paused = false;
          sim._hold = '';
        }
        crewMode = '';
      });
      var runBtn = document.getElementById('hr-crew-run');
      if (runBtn) runBtn.addEventListener('click', function () {
        if (!run.crewLock) run.crewLock = {};
        run.crewLock[day] = true;
        els.modal.hidden = true;
        crewMode = '';
        beginShift(day, { keepCrew: true });
      });
    }

    function renderScore() {
      show('score');
      var snap = run.lastSnap || run.history[run.history.length - 1];
      var pct = Math.round(snap.goalPct * 100);
      var comboBit = snap.bestComboLabel || ((snap.bestCombo || 0) > 1 ? multLabel(snap.bestCombo) : '—');
      els.score.innerHTML =
        '<p class="hr-kicker">' + esc(shiftLabel(run.day)) + '</p>' +
        '<h2>' + pct + '% of goal</h2>' +
        '<p class="hr-stars hr-stars--big">' + starGlyph(snap.shiftStars == null ? goalStars(snap.goalPct || 0) : snap.shiftStars) + '</p>' +
        '<p class="hr-thresholds">1★ ' + Math.round(CONFIG.star1 * 100) + '% · 2★ ' + Math.round(CONFIG.star2 * 100) + '% · 3★ ' + Math.round(CONFIG.star3 * 100) + '%</p>' +
        (snap.tenant ? '<p class="hr-lead">You ran ' + esc(snap.tenant) + '. Their drawer did ' + money(snap.sales) + '. You keep 15% (' + money(snap.cut || 0) + '). The other 85% stays on their tape.</p>' : '') +
        (snap.closeNote ? '<p class="hr-lead" id="hr-close-note">' + esc(snap.closeNote) + '</p>' : '') +
        '<p class="hr-lead">Best combo ' + esc(comboBit) + ' · ' + (snap.walkouts || 0) + ' walkouts · ' + money(snap.sales) + ' / ' + money(snap.goal) + '</p>' +
        '<p class="hr-bank">' + (snap.tape ? money(snap.tape.profit) + ' profit' : (snap.earned > 0 ? '+' + money(snap.earned) + ' banked' : 'Register unchanged')) + ' · ' + money(snap.bank || 0) + ' in the register</p>' +
        '<p class="hr-fine">' + esc(bankCopy(snap)) + '</p>' +
        (snap.daily && snap.daily.claimed ? '<p class="hr-fine" id="hr-daily-bonus">Morning bonus ' + money(snap.daily.bonus) + ' for ' + esc(snap.daily.goal && snap.daily.goal.name) + '.</p>' : '') +
        (snap.grumbles ? '<p class="hr-fine">Shoppers grumbled at the tag ' + snap.grumbles + ' time' + (snap.grumbles === 1 ? '' : 's') + '.</p>' : '') +
        (snap.tape && snap.tape.leaseIn ? '<p class="hr-fine">Mall rent collected ' + money(snap.tape.leaseIn) + '.</p>' : '') +
        (snap.tape && snap.tape.reviews ? snap.tape.reviews.map(function (line) { return '<p class="hr-fine">“' + esc(line) + '”</p>'; }).join('') : '') +
        (snap.background && snap.background.tapes && snap.background.tapes.length ? snap.background.tapes.map(function (row) {
          return '<p class="hr-fine">' + esc(row.name) + ' posted ' + money(row.profit) + (row.complaints && row.complaints[0] ? '. ' + esc(row.complaints[0]) : '.') + '</p>';
        }).join('') : '') +
        '<p class="hr-scorebig">' + snap.points + ' pts</p>' +
        '<div class="hr-cta">' +
        (snap.tenant
          ? '<button type="button" class="btn btn--primary" id="hr-retry">Back to the plaza</button>' +
            '<button type="button" class="btn" id="hr-tenant-again">Play their floor again</button>'
          : '<button type="button" class="btn btn--primary" id="hr-retry">Retry shift</button>') +
        '<button type="button" class="btn" id="hr-to-crew">Set crew</button>' +
        '<button type="button" class="btn" id="hr-to-shop">Office</button>' +
        '<button type="button" class="btn" id="hr-to-map">Shift map</button>' +
        '</div>';
      document.getElementById('hr-retry').addEventListener('click', function () {
        if (snap.tenant) renderMall();
        else beginShift(run.day);
      });
      var again = document.getElementById('hr-tenant-again');
      if (again) again.addEventListener('click', function () { beginTenantShift(snap.slot); });
      document.getElementById('hr-to-crew').addEventListener('click', function () {
        openCrew('score');
      });
      document.getElementById('hr-to-shop').addEventListener('click', function () {
        run.phase = 'shop';
        saveRun();
        renderShop();
      });
      if (spriteSession && HR.sprites && books) {
        var tomorrow = HR.sprites.typesForDay(Math.min(SHIFT_COUNT - 1, run.day + 1), books);
        var packNow = spriteSession.pack();
        var waiting = [];
        for (var ti = 0; ti < tomorrow.length; ti++) {
          if (!packNow.types[tomorrow[ti]]) waiting.push(tomorrow[ti]);
        }
        if (waiting.length) {
          var noteEl = document.createElement('p');
          noteEl.className = 'hr-fine';
          noteEl.id = 'hr-preload';
          noteEl.textContent = 'Next shift’s new shoppers are loading in the back.';
          var cta = els.score.querySelector('.hr-cta');
          if (cta) els.score.insertBefore(noteEl, cta);
        }
        spriteSession.preload(tomorrow);
        document.body.dataset.preload = tomorrow.join(',');
      }
      document.getElementById('hr-to-map').addEventListener('click', function () {
        run.phase = 'map';
        saveRun();
        renderMap();
      });
    }

    function officeCoachNeeded(which) {
      try { return !localStorage.getItem(which === 'mall' ? 'hr_coach_mall' : 'hr_coach_price'); } catch (e) { return false; }
    }

    function dismissOfficeCoach(which) {
      try { localStorage.setItem(which === 'mall' ? 'hr_coach_mall' : 'hr_coach_price', '1'); } catch (e) {}
    }

    function revealTop() {
      try {
        document.documentElement.style.overflowAnchor = 'none';
        document.body.style.overflowAnchor = 'none';
        document.documentElement.style.scrollBehavior = 'auto';
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch (e) {}
    }

    function renderShop() {
      show('shop');
      revealTop();
      if (!books || !HR.ui) return renderShopLegacy();
      syncHires();
      var camp = campaignGet();
      camp.bank = books.cash;
      if (run) run.upgrades = camp.upgrades;
      HR.ui.mountOffice(els.shop, {
        books: books,
        coachPrice: officeCoachNeeded('price'),
        upgrades: UPGRADES,
        upgradeLevel: function (id) { return (camp.upgrades && camp.upgrades[id]) || 0; },
        onToast: toast,
        onDirty: function () {
          camp.bank = books.cash;
          campaignPut(camp);
          if (HR.save) HR.save.save(writeJSON, books);
          syncHires();
          saveRun();
        },
        onUpgrade: function (id) {
          var def = null;
          for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) def = UPGRADES[i];
          if (!def) return;
          var live = campaignGet();
          var lvl = live.upgrades[id] || 0;
          if (lvl >= def.max) return;
          var cost = def.costs[lvl];
          if (books.cash < cost) { toast('Not enough in the register.'); return; }
          books.cash -= cost;
          live.bank = books.cash;
          live.upgrades[id] = lvl + 1;
          campaignPut(live);
          if (run) run.upgrades = live.upgrades;
          if (HR.save) HR.save.save(writeJSON, books);
          sfx('correct');
          toast(def.name + ' is on the floor.');
          renderShop();
        },
        onLayout: function () { renderLayout(); },
        onMall: function () { renderMall(); },
        onCoachPrice: function () { dismissOfficeCoach('price'); },
        onBack: function () {
          if (run) { run.phase = 'map'; saveRun(); }
          renderMap();
        }
      });
    }

    function renderMall() {
      show('shop');
      if (!books || !HR.ui || !HR.ui.mountMall || !HR.world) return renderShop();
      if (!HR.economy.has(books, 'knock')) {
        toast('Knock through the east wall first.');
        renderShop();
        return;
      }
      revealTop();
      HR.ui.mountMall(els.shop, {
        books: books,
        coachMall: officeCoachNeeded('mall'),
        slot: 'a',
        day: run ? run.day : 0,
        onCoachMall: function () { dismissOfficeCoach('mall'); },
        onPlayTenant: function (slotId) { beginTenantShift(slotId); },
        onKiosk: function (mode) {
          if (mode !== 'play') {
            var kioskBuild = HR.data.get().economy.buildById.kiosk;
            if (kioskBuild && HR.economy.canBuild(books, kioskBuild).ok) renderShop();
            return;
          }
          var switched = HR.economy.switchLocation(books, 'kiosk');
          toast(switched.ok ? 'Plaza Kiosk is the floor you play next.' : switched.msg);
          var kioskCamp = campaignGet();
          kioskCamp.bank = books.cash;
          campaignPut(kioskCamp);
          if (HR.save) HR.save.save(writeJSON, books);
          if (run) { run.phase = 'map'; saveRun(); }
          renderMap();
        },
        onToast: toast,
        onDirty: function () {
          var campNow = campaignGet();
          campNow.bank = books.cash;
          campaignPut(campNow);
          if (HR.save) HR.save.save(writeJSON, books);
          saveRun();
        },
        onBack: function () { renderShop(); }
      });
      revealTop();
      requestAnimationFrame(revealTop);
      setTimeout(revealTop, 0);
    }

    function renderLayout() {
      show('shop');
      if (!books || !HR.ui || !HR.layout) return;
      var loc = books.locations[books.active];
      HR.ui.mountLayout(els.shop, {
        layout: loc.layout,
        tool: 'shelf-toys',
        onToast: toast,
        onPlaced: function () {
          trafficBlocked._layout = null;
          syncFloor(true);
          if (HR.save) HR.save.save(writeJSON, books);
        },
        onDone: function () { renderShop(); }
      });
    }

    function renderShopLegacy() {
      show('shop');
      var camp = campaignGet();
      if (run) run.upgrades = camp.upgrades;
      var cards = UPGRADES.map(function (u) {
        var lvl = camp.upgrades[u.id] || 0;
        var maxed = lvl >= u.max;
        var cost = maxed ? 0 : u.costs[lvl];
        var afford = !maxed && camp.bank >= cost;
        var pips = '';
        for (var i = 0; i < u.max; i++) pips += '<i' + (i < lvl ? ' class="on"' : '') + '></i>';
        return '<article class="hr-upgrade"><span class="hr-icon" style="' + iconStyle(u.icon, 48) + '"></span><div><h3>' + esc(u.name) + '</h3><p>' + esc(u.blurb) + '</p><span class="hr-pips" aria-label="Level ' + lvl + ' of ' + u.max + '">' + pips + '</span></div><button type="button" class="btn btn--primary" data-buy="' + u.id + '"' + (afford ? '' : ' disabled') + '>' + (maxed ? 'Maxed' : money(cost)) + '</button></article>';
      }).join('');
      els.shop.innerHTML =
        '<p class="hr-kicker">Between shifts</p>' +
        '<h2>Upgrade shop</h2>' +
        '<p class="hr-bank">Bank ' + money(camp.bank) + '</p>' +
        '<p class="hr-lead">Each shift saves 10% of its sales. Replaying a shift only adds the amount above the best already saved for it. Upgrades stay on this device.</p>' +
        '<div class="hr-shop" id="hr-shop-list">' + cards + '</div>' +
        '<div class="hr-cta"><button type="button" class="btn btn--primary" id="hr-shop-map">Shift map</button></div>';
      document.getElementById('hr-shop-list').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-buy]');
        if (!btn || btn.disabled) return;
        var id = btn.getAttribute('data-buy');
        var def = null;
        for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) def = UPGRADES[i];
        if (!def) return;
        var live = campaignGet();
        var lvl = live.upgrades[id] || 0;
        if (lvl >= def.max) return;
        var cost = def.costs[lvl];
        if (live.bank < cost) { toast('Not enough in the bank.'); return; }
        live.bank -= cost;
        live.upgrades[id] = lvl + 1;
        campaignPut(live);
        if (run) run.upgrades = live.upgrades;
        sfx('correct');
        toast(def.name + ' upgraded.');
        renderShop();
      });
      document.getElementById('hr-shop-map').addEventListener('click', function () {
        if (run) { run.phase = 'map'; saveRun(); }
        renderMap();
      });
    }

    function renderMap() {
      show('map');
      var camp = campaignGet();
      var purse = books ? books.cash : camp.bank;
      var dailyLine = '';
      if (books && HR.world && HR.world.dailyGoal) {
        var todayGoal = HR.world.dailyGoal(ymd);
        var streak = metaGet();
        if (todayGoal) {
          var already = books.dailyClaimed === ymd;
          dailyLine = '<p class="hr-fine" id="hr-daily">Today: ' + esc(todayGoal.name) + '. ' + esc(todayGoal.blurb) + ' Bonus ' + money(todayGoal.bonus) + (already ? '. Already in the register.' : '.') + ' Streak ' + streak.streak + '.</p>';
        }
      }
      var locName = (books && books.locations[books.active] && books.locations[books.active].name) || 'Holiday Rush Mart';
      var html = '<p class="hr-kicker">' + esc(locName) + '</p><h2>Shift map</h2><p class="hr-lead">Earn one star to unlock the next shift. Locked days stay blank. Replay any open shift. A retry replaces that shift’s profit in the register.</p><p class="hr-bank">Register ' + money(purse) + '</p>' + dailyLine + '<div class="hr-map">';
      var week = '';
      for (var i = 0; i < SHIFT_COUNT; i++) {
        var def = shiftDef(i);
        if (def.week !== week) {
          week = def.week;
          html += '<div class="hr-week">' + esc(week) + '</div>';
        }
        var open = shiftUnlocked(camp, i);
        var stars = camp.stars[i] || 0;
        var next = open && !(camp.stars[i] > 0) && (i === 0 || (camp.stars[i - 1] || 0) >= 1);
        var mark = open
          ? '<span class="hr-stars">' + starGlyph(stars) + '</span>'
          : '<span class="hr-lock" aria-label="Locked">Lock</span>';
        html += '<button type="button" class="hr-node' + (open ? '' : ' is-locked') + (next ? ' is-next' : '') + '" data-shift="' + i + '"' + (open ? '' : ' disabled') + '><b>' + esc(def.short) + '</b><small>' + (i + 1) + '</small>' + mark + '</button>';
      }
      html += '</div><div class="hr-cta"><button type="button" class="btn" id="hr-map-shop">Upgrades</button></div>';
      els.map.innerHTML = html;
      els.map.querySelector('.hr-map').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-shift]');
        if (!btn || btn.disabled) return;
        beginShift(+btn.getAttribute('data-shift'));
      });
      document.getElementById('hr-map-shop').addEventListener('click', function () {
        if (run) { run.phase = 'shop'; saveRun(); }
        renderShop();
      });
    }

    function scoreTable(rows, startIndex) {
      var start = startIndex || 0;
      return '<table class="hr-table"><thead><tr><th>Day</th><th>Sales</th><th>Goal</th><th>Payroll</th><th>Morale</th><th>Stars</th></tr></thead><tbody>' +
        rows.map(function (snap, i) {
          var pct = Math.round(snap.goalPct * 100);
          return '<tr><td>' + esc(shiftLabel(start + i)) + '</td><td>' + money(snap.sales) + ' · ' + pct + '%</td><td>' + money(snap.goal) + '</td><td>' + money(snap.payroll) + '</td><td>' + snap.morale + '</td><td>' + snap.stars.toFixed(1) + '</td></tr>';
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

    function plateKey() {
      var band = sim && sim.stock < 0.25 ? 0 : sim && sim.stock < 0.7 ? 1 : 2;
      var art = assets && assets.objects && assets.objects['floor/floor_tile.png'] ? 1 : 0;
      return WORLD_W + 'x' + WORLD_H + ':' + band + ':' + (SPOTS.reg3 ? 1 : 0) + ':' + SHELVES.length + ':' + art;
    }

    function bakeStorePlate() {
      var objs = assets && assets.objects;
      var c = document.createElement('canvas');
      if (objs && HR.room && objs['floor/floor_tile.png'] && objs['floor/wall_back.png']) {
        c.width = WORLD_W;
        c.height = WORLD_H;
        var g = c.getContext('2d');
        HR.room.paint(g, objs, WORLD_W, WORLD_H, {
          entranceX: SPOTS.door.x,
          arch: WORLD_W > 1600,
          archX: 1600
        });
        var regs = registers().map(function (id) {
          return { x: SPOTS[id].x, y: SPOTS[id].y, station: id };
        });
        fixtureGlows = HR.room.paintFixtures(g, objs, {
          shelves: SHELVES,
          registers: regs,
          stock: sim ? sim.stock : 1,
          stockSpot: SPOTS.stock,
          truck: SPOTS.truck,
          door: SPOTS.door,
          worldH: WORLD_H
        });
      } else {
        c.width = WORLD_W * 2;
        c.height = WORLD_H * 2;
        var fallback = c.getContext('2d');
        fallback.scale(2, 2);
        fallback.lineJoin = 'round';
        fallback.lineCap = 'round';
        paintStorePlate(fallback);
        fixtureGlows = null;
      }
      storePlate = c;
      bakedKey = plateKey();
      if (els.stage) els.stage.dataset.art = fixtureGlows ? 'v10' : 'code';
    }

    function plateHash(x, y) {
      var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }

    function paintStorePlate(g) {
      g.fillStyle = PAL.floorB;
      g.fillRect(0, 0, WORLD_W, WORLD_H);
      if (WORLD_W > 1600) {
        g.fillStyle = 'rgba(224,163,34,0.16)';
        g.fillRect(1600, 124, WORLD_W - 1600, WORLD_H - 124);
        g.fillStyle = PAL.floorA;
        g.fillRect(1576, 400, 48, 180);
        g.fillStyle = PAL.gold;
        g.fillRect(1576, 400, 48, 6);
        g.fillRect(1576, 574, 48, 6);
      }
      var rowH = 28;
      for (var y = 118; y < WORLD_H; y += rowH) {
        var row = ((y - 118) / rowH) | 0;
        var shift = (row % 2) * 46;
        for (var x = -46 + shift; x < WORLD_W; x += 92) {
          var h = plateHash(x + 80, row);
          g.fillStyle = h > 0.66 ? PAL.floorA : h > 0.33 ? PAL.floorB : '#c89a68';
          g.fillRect(x, y, 90, rowH - 2);
          g.fillStyle = 'rgba(255,244,220,0.18)';
          g.fillRect(x + 2, y + 2, 86, 4);
        }
      }
      g.fillStyle = '#6e2d3c';
      g.fillRect(430, 150, 520, WORLD_H - 180);
      g.fillStyle = PAL.gold;
      g.fillRect(430, 150, 8, WORLD_H - 180);
      g.fillRect(942, 150, 8, WORLD_H - 180);
      g.fillStyle = PAL.wall;
      g.fillRect(0, 0, WORLD_W, 124);
      g.fillStyle = PAL.wallDark || '#3d1c26';
      g.fillRect(0, 0, WORLD_W, 18);
      g.fillStyle = PAL.trim;
      g.fillRect(0, 112, WORLD_W, 12);
      g.fillStyle = PAL.gold;
      g.fillRect(0, 108, WORLD_W, 4);
      function windowPane(x) {
        var grd = g.createLinearGradient(x, 28, x, 100);
        grd.addColorStop(0, '#f7e2b8');
        grd.addColorStop(1, '#e0a322');
        g.fillStyle = '#2a1c18';
        traceRound(g, x, 28, 150, 72, 8);
        g.fill();
        g.fillStyle = grd;
        traceRound(g, x + 6, 34, 138, 60, 6);
        g.fill();
        g.strokeStyle = 'rgba(255,244,220,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 75, 34);
        g.lineTo(x + 75, 94);
        g.moveTo(x + 6, 64);
        g.lineTo(x + 144, 64);
        g.stroke();
      }
      windowPane(80);
      windowPane(1370);
      g.fillStyle = PAL.cream;
      traceRound(g, 560, 26, 480, 70, 12);
      g.fill();
      g.strokeStyle = PAL.ink;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = PAL.wall;
      g.font = '800 28px Outfit, Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText('HOLIDAY RUSH', 800, 70);
      g.font = '700 12px Outfit, Inter, sans-serif';
      g.fillStyle = '#8a5a32';
      g.fillText('MART', 800, 86);
      for (var b = 0; b < 22; b++) {
        var bx = 70 + b * 68;
        var by = 18 + Math.sin(b * 0.85) * 6;
        g.fillStyle = '#1f6b3a';
        g.beginPath();
        g.arc(bx, by + 8, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = b % 3 === 0 ? PAL.red : b % 3 === 1 ? PAL.gold : PAL.cream;
        g.beginPath();
        g.arc(bx, by, 4.5, 0, Math.PI * 2);
        g.fill();
      }
      function tree(x, y) {
        g.fillStyle = 'rgba(42,24,18,0.25)';
        g.beginPath();
        g.ellipse(x + 6, y + 4, 28, 8, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#6b4228';
        g.fillRect(x - 6, y - 16, 12, 22);
        g.fillStyle = '#1d5c34';
        g.beginPath();
        g.moveTo(x, y - 96);
        g.lineTo(x + 38, y - 14);
        g.lineTo(x - 38, y - 14);
        g.closePath();
        g.fill();
        g.strokeStyle = PAL.ink;
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = '#2f7d4a';
        g.beginPath();
        g.moveTo(x, y - 78);
        g.lineTo(x + 26, y - 30);
        g.lineTo(x - 26, y - 30);
        g.closePath();
        g.fill();
        var bulbs = [PAL.red, PAL.gold, PAL.cream, PAL.red];
        for (var i = 0; i < 4; i++) {
          g.fillStyle = bulbs[i];
          g.beginPath();
          g.arc(x + (i - 1.5) * 12, y - 42 - (i % 2) * 16, 4, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = PAL.gold;
        g.beginPath();
        g.moveTo(x, y - 104);
        g.lineTo(x + 8, y - 88);
        g.lineTo(x - 8, y - 88);
        g.closePath();
        g.fill();
      }
      tree(168, 250);
      g.fillStyle = '#8d8680';
      g.fillRect(1040, 124, 560, 150);
      g.fillStyle = '#d7dde4';
      traceRound(g, 1288, 132, 250, 110, 6);
      g.fill();
      g.strokeStyle = PAL.ink;
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = '#8aa0b4';
      g.lineWidth = 4;
      for (var stripe = 0; stripe < 5; stripe++) {
        g.beginPath();
        g.moveTo(1300, 150 + stripe * 18);
        g.lineTo(1524, 150 + stripe * 18);
        g.stroke();
      }
      g.fillStyle = '#6b4228';
      g.fillRect(1100, 210, 70, 14);
      g.fillStyle = PAL.red;
      g.fillRect(1110, 188, 22, 22);
      g.fillStyle = PAL.green;
      g.fillRect(1134, 194, 22, 16);
      g.fillStyle = '#c4a882';
      traceRound(g, 860, 820, 220, 70, 8);
      g.fill();
      g.strokeStyle = PAL.gold;
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = PAL.ink;
      g.font = '800 16px Outfit, Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText('IN', 970, 860);
      g.fillStyle = '#3e2618';
      traceRound(g, 900, 790, 48, 70, 4);
      g.fill();
      traceRound(g, 992, 790, 48, 70, 4);
      g.fill();
      g.fillStyle = 'rgba(255,244,220,0.25)';
      g.fillRect(908, 798, 32, 6);
      g.fillRect(1000, 798, 32, 6);
      function gondola(x, y, label) {
        g.fillStyle = 'rgba(42,24,18,0.28)';
        traceRound(g, x - 64, y - 98, 136, 108, 10);
        g.fill();
        g.fillStyle = '#4a2e1c';
        traceRound(g, x - 70, y - 112, 140, 108, 8);
        g.fill();
        g.fillStyle = PAL.wood;
        traceRound(g, x - 70, y - 118, 140, 100, 8);
        g.fill();
        g.strokeStyle = PAL.ink;
        g.lineWidth = 2.5;
        g.stroke();
        g.fillStyle = 'rgba(255,244,220,0.16)';
        g.fillRect(x - 62, y - 112, 124, 8);
        g.fillStyle = PAL.gold;
        g.fillRect(x - 62, y - 92, 124, 5);
        g.fillRect(x - 62, y - 66, 124, 5);
        g.fillRect(x - 62, y - 40, 124, 5);
        g.fillStyle = PAL.cream;
        traceRound(g, x - 42, y - 138, 84, 20, 6);
        g.fill();
        g.strokeStyle = PAL.ink;
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = PAL.wall;
        g.font = '800 12px Outfit, Inter, sans-serif';
        g.textAlign = 'center';
        g.fillText(label, x, y - 124);
      }
      var bayName = ['TOYS', 'TREATS', 'WRAP', 'CARDS'];
      for (var si = 0; si < SHELVES.length; si++) gondola(SHELVES[si].x, SHELVES[si].y, SHELVES[si].label || bayName[si] || 'AISLE');
      function counter(x, y, accent) {
        g.fillStyle = 'rgba(42,24,18,0.28)';
        traceRound(g, x - 62, y + 8, 132, 48, 8);
        g.fill();
        g.fillStyle = '#3e2618';
        traceRound(g, x - 68, y - 6, 136, 52, 8);
        g.fill();
        g.fillStyle = '#6b4228';
        traceRound(g, x - 68, y - 12, 136, 46, 8);
        g.fill();
        g.strokeStyle = PAL.ink;
        g.lineWidth = 2.5;
        g.stroke();
        g.fillStyle = 'rgba(255,244,220,0.2)';
        g.fillRect(x - 60, y - 8, 120, 6);
        g.fillStyle = '#1a120c';
        g.fillRect(x - 48, y + 4, 70, 12);
        g.fillStyle = accent;
        g.fillRect(x - 44, y + 6, 16, 8);
        g.fillStyle = PAL.cream;
        traceRound(g, x + 28, y - 28, 28, 22, 3);
        g.fill();
        g.fillStyle = '#9fd0ff';
        g.fillRect(x + 32, y - 24, 20, 10);
        g.fillStyle = PAL.gold;
        g.beginPath();
        g.arc(x - 78, y + 36, 6, 0, Math.PI * 2);
        g.arc(x + 78, y + 36, 6, 0, Math.PI * 2);
        g.fill();
      }
      counter(SPOTS.reg1.x, 748, PAL.red);
      if (SPOTS.reg2) counter(SPOTS.reg2.x, 748, PAL.blue);
      if (SPOTS.reg3) counter(SPOTS.reg3.x, 748, PAL.gold);
      g.fillStyle = 'rgba(42,24,18,0.2)';
      g.fillRect(SPOTS.reg1.x - 18, 800, 36, 70);
      if (SPOTS.reg2) g.fillRect(SPOTS.reg2.x - 18, 800, 36, 70);
      function pool(x, y, r, color) {
        var grd = g.createRadialGradient(x - 20, y - 24, 8, x, y, r);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'screen';
      pool(500, 680, 200, 'rgba(255,214,150,0.28)');
      pool(760, 680, 180, 'rgba(255,214,150,0.22)');
      pool(800, 420, 260, 'rgba(255,226,180,0.16)');
      pool(250, 240, 120, 'rgba(255,220,160,0.14)');
      pool(1240, 180, 150, 'rgba(186,208,224,0.2)');
      g.globalCompositeOperation = 'source-over';
      var vig = g.createRadialGradient(800, 460, 220, 800, 480, 980);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(42,16,18,0.28)');
      g.fillStyle = vig;
      g.fillRect(0, 0, WORLD_W, WORLD_H);
    }

    function pixelBudget() {
      if (sim && sim._dprCap) return sim._dprCap;
      if (sim && sim.customers && sim.customers.length > 70) return 0.5;
      return 2;
    }

    function resize() {
      var stage = els.stage;
      var rect = stage.getBoundingClientRect();
      var cap = pixelBudget();
      var dpr = Math.min(window.devicePixelRatio || 1, cap);
      if (dpr < 0.5) dpr = 0.5;
      els.canvas._dprCap = cap;
      var w = Math.max(280, Math.round(rect.width));
      var h = Math.max(200, Math.round(rect.height));
      els.canvas.width = Math.round(w * dpr);
      els.canvas.height = Math.round(h * dpr);
      els.canvas.style.width = w + 'px';
      els.canvas.style.height = h + 'px';
      els.canvas._cssW = w;
      els.canvas._cssH = h;
      els.canvas._dpr = dpr;
      placeChrome();
      fitHud();
    }

    function fitHud() {
      var hud = els.sim && els.sim.querySelector('.hr-hud');
      if (!hud || els.sim.hidden) return;
      if (document.fonts && !hud._fontHook) {
        hud._fontHook = 1;
        document.fonts.ready.then(function () {
          hud._fitKey = '';
          fitHud();
        });
      }
      var salesLab = hud.querySelector('.hr-sales__top span');
      var salesText = document.getElementById('hr-sales-text');
      var key = [
        hud.clientWidth,
        salesLab ? salesLab.textContent : '',
        salesText ? salesText.textContent : '',
        hud.querySelectorAll('.hr-combo:not([hidden]), .hr-rush:not([hidden]), #hr-tenant-name').length
      ].join('|');
      if (hud._fitKey === key) return;
      var extras = hud.querySelectorAll('.hr-hud__extra');
      var i;
      for (i = 0; i < extras.length; i++) extras[i].classList.remove('is-hud-off');
      function overflows() {
        return hud.scrollWidth > hud.clientWidth + 1;
      }
      for (i = extras.length - 1; i >= 0 && overflows(); i--) extras[i].classList.add('is-hud-off');
      hud._fitKey = key;
      if (isQA() && els.stage) {
        var weekClip = !!(salesLab && salesLab.scrollWidth > salesLab.clientWidth + 1);
        var moneyClip = !!(salesText && salesText.scrollWidth > salesText.clientWidth + 1);
        els.stage.dataset.hudOverflow = overflows() ? '1' : '0';
        els.stage.dataset.weekClip = weekClip ? '1' : '0';
        els.stage.dataset.moneyClip = moneyClip ? '1' : '0';
        els.stage.dataset.weekText = salesLab ? salesLab.textContent : '';
        els.stage.dataset.moneyText = salesText ? salesText.textContent : '';
        els.stage.dataset.hudHidden = String(hud.querySelectorAll('.hr-hud__extra.is-hud-off').length);
      }
    }

    function placeChrome() {
      var zoom = document.getElementById('hr-zoom');
      var skip = document.getElementById('hr-skip');
      var coachEl = document.getElementById('hr-coach');
      var stage = els.stage;
      if (!zoom || !stage) return;
      var z = zoom.getBoundingClientRect();
      var stageBox = stage.getBoundingClientRect();
      if (z.width < 8 || stageBox.width < 8) return;
      var clearance = Math.round(stageBox.right - z.left + 8);
      if (skip) skip.style.right = clearance + 'px';
      if (!coachEl) return;
      var skipW = skip && !skip.hidden ? skip.offsetWidth + 8 : 0;
      if (stageBox.width < 720) {
        coachEl.style.top = Math.round(z.height + 14) + 'px';
        coachEl.style.right = '8px';
        coachEl.style.left = '8px';
      } else {
        coachEl.style.top = '8px';
        coachEl.style.left = '8px';
        coachEl.style.right = (clearance + skipW) + 'px';
      }
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
      if (coach.step === 0) return { x: SPOTS.reg1.x, y: QUEUE.reg1.y - 40, r: 52, label: '1/3  Tap the line\nA cashier keeps the sale.' };
      if (coach.step === 1) return { x: SPOTS.truck.x, y: SPOTS.truck.y + 10, r: 58, label: '2/3  Tap the truck\nUnload it before shelves thin out.' };
      var angry = null;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        if (c.bubble === 'angry' || (c.maxPatience && c.patience < c.maxPatience * 0.4)) angry = c;
      }
      if (angry) return { x: angry.x, y: angry.y - 40, r: 48, label: '3/3  Tap the upset shopper\nA calm keeps the star.' };
      return { x: SPOTS.floor.x, y: SPOTS.floor.y - 40, r: 48, label: '3/3  Tap the upset shopper\nA calm keeps the star.' };
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
      placeChrome();
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
      var c = makeActor('cust_karen', SPOTS.floor.x - 20, SPOTS.floor.y + 10);
      c.kind = 'cust';
      c.state = 'browse';
      c.browseT = 99;
      c.patience = 0.22;
      c.maxPatience = 1;
      c.bubble = 'angry';
      c.seq = sim.seq++;
      c.pop = 1;
      c.reg = null;
      sim.customers.push(c);
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
      else {
        toast('Floor is yours. Chain checkouts for a combo.');
        endCoach();
      }
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
      tapFx(sim, point.x, point.y);
      flashAt(sim, point.x, point.y);
      hooks.tap();
      hooks.action(name);
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
      var bestD = 64;
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
          if (screenDist(ping.x, ping.y, ev) < 48) return { ping: ping };
        }
      }
      var zones = [
        { station: 'freight', x: SPOTS.truck.x, y: SPOTS.truck.y + 20 },
        { station: 'floor', x: SPOTS.floor.x, y: SPOTS.floor.y }
      ];
      registers().forEach(function (reg) {
        zones.unshift({ station: reg, x: SPOTS[reg].x, y: (SPOTS[reg].y + QUEUE[reg].y) * 0.5 });
      });
      var zone = null;
      var zoneD = 72;
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
        tapFx(sim, hit.ping.x, hit.ping.y);
        flashAt(sim, hit.ping.x, hit.ping.y);
        hooks.tap();
        hooks.coin();
        resolvePing(sim, hit.ping);
        paintHud();
        draw();
        saveRun();
        return;
      }
      if (!hit) {
        tapFx(sim, w.x, w.y);
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
        if (c.arch === 'lift' && c.state !== 'leave') act = { name: 'calm', cust: c, point: { x: c.x, y: c.y } };
        else if (c.haggling) act = { name: 'calm', cust: c, point: { x: c.x, y: c.y } };
        else if (angry || c.state === 'browse' || c.state === 'enter' || c.state === 'prowl') act = { name: 'calm', cust: c, point: { x: c.x, y: c.y } };
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
      var r = 20;
      ctx.lineWidth = 5;
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
      var regs = registers();
      for (var i = 0; i < regs.length; i++) {
        var n = queueOf(sim, regs[i]).length;
        if (n >= 3) {
          drawIconAt('line', SPOTS[regs[i]].x, SPOTS[regs[i]].y - 112, 44);
          drawTag('Line ' + n, SPOTS[regs[i]].x, SPOTS[regs[i]].y - 142);
        }
      }
      if (sim.truck) {
        var need = 5.5;
        var done = clamp((sim.truckWork || 0) / need, 0, 1);
        var left = Math.max(0, need - (sim.truckWork || 0));
        var fp = stationPower(sim, run, 'freight');
        drawIconAt('truck', SPOTS.truck.x, SPOTS.truck.y - 24, 44);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(246,240,228,0.4)';
        ctx.beginPath();
        ctx.arc(SPOTS.truck.x, SPOTS.truck.y - 24, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.arc(SPOTS.truck.x, SPOTS.truck.y - 24, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
        ctx.stroke();
        drawTag(fp > 0.35 ? left.toFixed(1) + 's' : 'Unload', SPOTS.truck.x, SPOTS.truck.y - 68);
      }
      if (sim.stock < 0.34) {
        drawIconAt('outstock', SHELVES[0].x, SHELVES[0].y - 78, 40);
        drawTag('Low stock', SHELVES[0].x, SHELVES[0].y - 108);
      }
    }

    function drawHand(x, y) {
      var bob = reduceMotion ? 0 : Math.sin(Date.now() / 160) * 8;
      ctx.save();
      ctx.translate(x, y + 8 + bob);
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
      if (HR.render) return HR.render.view(cssW, cssH, WORLD_W, WORLD_H, cam.zoom || 1, CONFIG.sprite);
      var target = cssW < 520 ? 118 : cssW < 900 ? 112 : 108;
      var viewW = CONFIG.sprite * cssW / target;
      if (viewW > WORLD_W) viewW = WORLD_W;
      var viewH = viewW * cssH / cssW;
      if (viewH > WORLD_H) {
        viewH = WORLD_H;
        viewW = viewH * cssW / cssH;
        if (viewW > WORLD_W) viewW = WORLD_W;
      }
      return { viewW: viewW, viewH: viewH, cssW: cssW, cssH: cssH, spritePx: CONFIG.sprite * cssW / viewW, productPx: 46 * cssW / viewW, zoom: 1 };
    }

    function paintEdges(view) {
      if (els.stage) {
        els.stage.dataset.spritePx = String(Math.round(view.spritePx || 0));
        els.stage.dataset.productPx = String(Math.round(view.productPx || 0));
        els.stage.dataset.zoom = String(view.zoom || cam.zoom || 1);
        els.stage.dataset.world = WORLD_W + 'x' + WORLD_H;
        els.stage.dataset.framed = cam.overview ? '1' : '0';
        els.stage.dataset.minimap = cam.overview ? '1' : '0';
        var doorY = SPOTS.door ? SPOTS.door.y : 855;
        var holdsDoor = !!cam.overview || (cam.y <= 80 && cam.y + view.viewH >= doorY);
        els.stage.dataset.span = holdsDoor ? '1' : '0';
      }
      if (!HR.render) return;
      var edge = HR.render.edges(cam.x, cam.y, view.viewW, view.viewH, WORLD_W, WORLD_H);
      var map = { left: 'hr-pan-left', right: 'hr-pan-right', up: 'hr-pan-up', down: 'hr-pan-down' };
      Object.keys(map).forEach(function (key) {
        var node = document.getElementById(map[key]);
        if (node) node.hidden = !edge[key];
      });
      var east = document.getElementById('hr-east');
      if (east) east.hidden = WORLD_W <= 1600;
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
      } else if (sim && cam.follow && !cam.fit) {
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
      paintEdges(view);
      if (isQA() && els.stage && sim) {
        els.stage.dataset.cam = Math.round(cam.x) + ',' + Math.round(cam.y);
        els.stage.dataset.view = Math.round(view.viewW) + ',' + Math.round(view.viewH);
        els.stage.dataset.paused = sim.paused ? '1' : '0';
        var cast = [];
        function pushCast(actor) {
          if (!actor || actor.hidden || cast.length >= 14) return;
          cast.push(Math.round(actor.x) + ',' + Math.round(actor.y) + ',' + spriteTypeFor(actor) + ',' + (actor.anim || 'idle') + ',' + (actor.face < 0 ? 'L' : 'R'));
        }
        for (var cc = 0; cc < sim.customers.length; cc++) pushCast(sim.customers[cc]);
        for (var cs = 0; cs < sim.staff.length; cs++) pushCast(sim.staff[cs]);
        if (sim.you) pushCast(sim.you);
        els.stage.dataset.cast = cast.join(' ');
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1a1412';
      ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
      var shakeX = 0;
      var shakeY = 0;
      if (sim && sim.shake > 0 && !reduceMotion) {
        var buzz = Date.now() / 16;
        shakeX = Math.sin(buzz) * sim.shake;
        shakeY = Math.cos(buzz * 1.3) * sim.shake * 0.65;
      }
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (-cam.x + shakeX) * dpr * scale, (-cam.y + shakeY) * dpr * scale);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      frameView.w = view.viewW;
      frameView.h = view.viewH;
      if (sim && HR.render && HR.render.adapt) {
        var shown = sim.customers.length + sim.staff.length + (sim.you ? 1 : 0);
        var frameSample = sim._frameMs || 0;
        sim._frameEma = sim._frameEma == null ? frameSample : sim._frameEma * 0.65 + frameSample * 0.35;
        var adapted = HR.render.adapt({
          tier: sim._tier == null ? 3 : sim._tier,
          hot: sim._qHot || 0,
          cool: sim._qCool || 0,
          cssW: view.cssW,
          cssH: view.cssH,
          spritePx: view.spritePx || 108,
          shown: shown,
          frameMs: sim._frameEma
        });
        sim._tier = adapted.tier;
        sim._qHot = adapted.hot;
        sim._qCool = adapted.cool;
        sim._shed = adapted.shed;
        sim._dprCap = adapted.dpr;
        sim._fullSprites = adapted.fullSprites;
        sim._glowCap = adapted.glows;
        sim._fill = adapted.fill;
        sim._fillBudget = adapted.budget;
        sim._qReason = adapted.reason;
        sim._glow = 0;
      } else if (sim) {
        sim._shed = (sim._frameMs || 0) > 18 || sim.customers.length > 70;
        sim._glow = 0;
      }
      ctx.imageSmoothingEnabled = !(sim && sim._shed);
      if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = (sim && (sim.customers.length > 40 || sim._shed)) ? 'low' : 'medium';
      }
      if (plateKey() !== bakedKey) bakeStorePlate();
      if (storePlate) ctx.drawImage(storePlate, 0, 0, WORLD_W, WORLD_H);
      else {
        ctx.fillStyle = PAL.floorB;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }
      if (sim && sim.stock < 0.67 && !fixtureGlows) {
        ctx.fillStyle = sim.stock < 0.34 ? 'rgba(62,32,24,0.16)' : 'rgba(62,32,24,0.07)';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }
      if (sim && !sim._shed) drawStoreDress();
      if (sim) {
        if (isQA() && els.stage) els.stage.dataset.sils = '0';
        SHELVES.forEach(function (sh) {
          if (sim._shed) return;
          if (!worldOn(sh.x, sh.y, 80)) return;
          var pct = Math.round(clamp(sim.stock, 0, 1) * 100);
          ctx.fillStyle = 'rgba(20,12,16,0.78)';
          ctx.fillRect(sh.x - 36, sh.y - 108, 72, 14);
          ctx.fillStyle = sim.stock > 0.66 ? '#2f9e57' : sim.stock > 0.33 ? '#e0a322' : '#d64545';
          ctx.fillRect(sh.x - 34, sh.y - 106, 68 * clamp(sim.stock, 0, 1), 10);
          ctx.font = '800 12px Outfit, Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f6f0e4';
          ctx.fillText(pct + '%', sh.x, sh.y - 112);
          var tag = shelfPriceTag(sh, sim.books);
          if (tag) {
            var label = tag.markup >= 1.45 ? 'WON\'T PAY ' + money(tag.price) : money(tag.price);
            ctx.font = '800 16px Outfit, Inter, sans-serif';
            var tw = ctx.measureText(label).width + 18;
            var ty = sh.y - 142;
            ctx.fillStyle = tag.markup >= 1.45 ? '#8a1e22' : tag.markup > 1.2 ? '#8a5a22' : '#2a1c18';
            ctx.fillRect(sh.x - tw / 2, ty, tw, 22);
            ctx.fillStyle = '#fff4d2';
            ctx.fillText(label, sh.x, ty + 16);
          }
        });
        var drawList = [];
        for (var s = 0; s < sim.staff.length; s++) if (!sim.staff[s].hidden) drawList.push(sim.staff[s]);
        for (var c = 0; c < sim.customers.length; c++) drawList.push(sim.customers[c]);
        if (sim.you) drawList.push(sim.you);
        drawList.push(jackPose());
        drawList.sort(function (a, b) { return a.y - b.y; });
        var heavy = sim.customers.length > 40;
        var drawn = 0;
        for (var d = 0; d < drawList.length; d++) {
          var actor = drawList[d];
          actor._drew = '';
          var visible = !heavy || actor.kind === 'jack' || !HR.render || HR.render.onScreen(actor, cam.x, cam.y, view.viewW, view.viewH, sim._shed ? 24 : 140);
          if (!visible) continue;
          drawn++;
          if (actor.kind === 'jack') {
            if (!sim._shed) drawPalletJack(actor);
            continue;
          }
          drawActor(actor);
        }
        if (isQA() && els.stage) {
          var qSprite = 0;
          var qBlob = 0;
          var qSil = 0;
          var qN = 0;
          for (var qi = 0; qi < sim.customers.length; qi++) {
            var queued = sim.customers[qi];
            if (queued.state !== 'queue' && queued.state !== 'checkout') continue;
            qN++;
            if (queued._drew === 'sprite') qSprite++;
            else if (queued._drew === 'blob') qBlob++;
            else if (queued._drew === 'sil') qSil++;
          }
          var pN = 0;
          var pSprite = 0;
          var pBlob = 0;
          var pSil = 0;
          var pFig = 0;
          var browseBlob = 0;
          var staffBlob = 0;
          function tallyPerson(person) {
            if (!person || !person._drew) return;
            if (person.kind !== 'cust' && person.kind !== 'staff' && person.kind !== 'you') return;
            pN++;
            if (person._drew === 'sprite') pSprite++;
            else if (person._drew === 'blob') {
              pBlob++;
              if (person.kind === 'staff') staffBlob++;
              else if (person.state !== 'queue' && person.state !== 'checkout' && person.state !== 'toQueue') browseBlob++;
            } else if (person._drew === 'sil') pSil++;
            else if (person._drew === 'figure') pFig++;
          }
          for (var pi = 0; pi < sim.customers.length; pi++) tallyPerson(sim.customers[pi]);
          for (var ps = 0; ps < sim.staff.length; ps++) tallyPerson(sim.staff[ps]);
          tallyPerson(sim.you);
          els.stage.dataset.queueN = String(qN);
          els.stage.dataset.queueSprites = String(qSprite);
          els.stage.dataset.queueBlobs = String(qBlob);
          els.stage.dataset.queueSils = String(qSil);
          els.stage.dataset.peopleN = String(pN);
          els.stage.dataset.peopleSprites = String(pSprite);
          els.stage.dataset.peopleBlobs = String(pBlob);
          els.stage.dataset.peopleSils = String(pSil);
          els.stage.dataset.peopleFigures = String(pFig);
          els.stage.dataset.browseBlobs = String(browseBlob);
          els.stage.dataset.staffBlobs = String(staffBlob);
          els.stage.dataset.drawCount = String(drawn);
          els.stage.dataset.simCount = String(sim.customers.length + sim.staff.length);
          els.stage.dataset.shed = sim._shed ? '1' : '0';
          els.stage.dataset.frameMs = String(Math.round(sim._frameMs || 0));
          els.stage.dataset.frameEma = String(Math.round(sim._frameEma || 0));
          els.stage.dataset.smooth = sim._shed ? 'off' : (sim.customers.length > 40 ? 'low' : 'medium');
          els.stage.dataset.glow = String(sim._glow || 0);
          els.stage.dataset.tier = sim._tier == null ? '' : String(sim._tier);
          els.stage.dataset.fill = String(sim._fill || 0);
          els.stage.dataset.budget = String(sim._fillBudget || 0);
          els.stage.dataset.qdpr = String(sim._dprCap == null ? '' : sim._dprCap);
          els.stage.dataset.qreason = sim._qReason || '';
        }
        if (!sim._shed) {
          drawPings();
          drawTrouble();
        }
        if (sim.coins && !sim._shed) {
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
        if (sim.fx && !sim._shed) {
          for (var fi = 0; fi < sim.fx.length; fi++) {
            var burst = sim.fx[fi];
            var u = 1 - clamp(burst.life / 0.38, 0, 1);
            ctx.globalAlpha = clamp(burst.life / 0.38, 0, 1);
            ctx.strokeStyle = '#ffe08a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(burst.x, burst.y, reduceMotion ? 22 : 10 + u * 36, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (sim.taps && !sim._shed) {
          for (var ti = 0; ti < sim.taps.length; ti++) {
            var tapRing = sim.taps[ti];
            var tu = 1 - clamp(tapRing.life / 0.32, 0, 1);
            ctx.globalAlpha = clamp(tapRing.life / 0.32, 0, 0.9);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(tapRing.x, tapRing.y, reduceMotion ? 18 : 8 + tu * 30, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (sim.confetti && !sim._shed) {
          for (var ck = 0; ck < sim.confetti.length; ck++) {
            var bit = sim.confetti[ck];
            ctx.save();
            ctx.globalAlpha = clamp(bit.life, 0, 1);
            ctx.translate(bit.x, bit.y);
            if (!reduceMotion) ctx.rotate(bit.rot);
            ctx.fillStyle = bit.color;
            ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        var floatBig = view.cssW < 720 ? 15 : 28;
        var floatSm = view.cssW < 720 ? 12 : 20;
        var floatScale = scale || 1;
        if (els.stage) els.stage.dataset.floatPx = String(floatBig);
        if (!sim._shed) for (var f = 0; f < sim.floats.length; f++) {
          var fl = sim.floats[f];
          ctx.globalAlpha = clamp(fl.life, 0, 1);
          ctx.fillStyle = fl.color;
          ctx.font = (fl.big ? '800 ' + (floatBig / floatScale) + 'px ' : '700 ' + (floatSm / floatScale) + 'px ') + 'Outfit, Inter, sans-serif';
          ctx.fillText(fl.text, fl.x, fl.y);
        }
        ctx.globalAlpha = 1;
        if (focus) {
          ctx.strokeStyle = 'rgba(224,163,34,0.95)';
          ctx.lineWidth = 4;
          var ringR = (focus.r || 48) + (reduceMotion ? 0 : Math.sin(Date.now() / 180) * 4);
          ctx.beginPath();
          ctx.arc(focus.x, focus.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
          drawHand(focus.x + ringR * 0.35, focus.y);
          publishCoach(focus);
        } else publishCoach(null);
        ctx.globalAlpha = 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (sim.flash > 0) {
          var alpha = Math.min(0.22, sim.flash * 0.45);
          ctx.fillStyle = sim.flashTint === 'red' ? 'rgba(214,69,69,' + alpha + ')' : 'rgba(255,224,138,' + alpha + ')';
          if (reduceMotion) ctx.fillRect(0, 0, view.cssW, 8);
          else ctx.fillRect(0, 0, view.cssW, view.cssH);
        }
        if (sim._heat && sim._heat.rush && !sim.coachHold) {
          ctx.fillStyle = 'rgba(196,54,58,0.35)';
          ctx.fillRect(0, 0, view.cssW, 4);
          ctx.fillRect(0, view.cssH - 4, view.cssW, 4);
          ctx.font = '800 22px Outfit, Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(20,12,16,0.72)';
          var rushW = 92;
          ctx.fillRect(view.cssW / 2 - rushW / 2, 8, rushW, 28);
          ctx.fillStyle = '#ffb4b4';
          ctx.fillText('RUSH', view.cssW / 2, 28);
        }
      }
      if (cam.overview) drawMinimap(view);
    }

    function drawMinimap(view) {
      if (!storePlate || !view) return;
      var dpr = els.canvas._dpr || 1;
      var cssW = view.cssW;
      var cssH = view.cssH;
      var mapW = Math.min(cssW * 0.42, 220);
      var mapH = mapW * (WORLD_H / Math.max(1, WORLD_W));
      if (mapH > cssH * 0.34) {
        mapH = cssH * 0.34;
        mapW = mapH * (WORLD_W / Math.max(1, WORLD_H));
      }
      var x = Math.max(8, cssW - mapW - 10);
      var y = Math.max(8, cssH - mapH - 10);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(26,20,18,0.9)';
      ctx.fillRect(x - 4, y - 4, mapW + 8, mapH + 8);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 4, y - 4, mapW + 8, mapH + 8);
      ctx.drawImage(storePlate, 0, 0, WORLD_W, WORLD_H, x, y, mapW, mapH);
      var vx = x + (cam.x / WORLD_W) * mapW;
      var vy = y + (cam.y / WORLD_H) * mapH;
      var vw = Math.max(4, (view.viewW / WORLD_W) * mapW);
      var vh = Math.max(4, (view.viewH / WORLD_H) * mapH);
      ctx.strokeStyle = '#fff4d2';
      ctx.lineWidth = 2;
      ctx.strokeRect(vx, vy, vw, vh);
      ctx.font = '700 11px Outfit, Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffe08a';
      ctx.fillText('Floor', x, y - 8);
    }

    function roundBox(x, y, w, h, r) {
      var rad = Math.min(r || 3, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }

    function shelfSku(sh, col) {
      var label = sh.label || '';
      var dept = sh.dept || '';
      if (dept === 'electronics' || label === 'LIGHTS') return ['lights', 'lights', 'candle'][col];
      if (dept === 'cafe' || label === 'CAFE') return ['mug', 'cocoa', 'candy'][col];
      if (label === 'SEASON') return ['globe', 'candle', 'lights'][col];
      if (label === 'TREATS') return ['candy', 'cocoa', 'candy'][col];
      if (label === 'WRAP') return ['paper', 'candle', 'paper'][col];
      if (label === 'CARDS') return ['candle', 'paper', 'mug'][col];
      if (label === 'PLUSH') return ['plush', 'plush', 'candy'][col];
      return ['cocoa', 'plush', 'candy'][col];
    }

    function drawChunky(x, y, sku) {
      var pack = assets && assets.spritePack;
      var obj = pack && pack.objects && pack.objects[sku];
      if (obj && obj.img) {
        ctx.drawImage(obj.img, x, y, 46, 54);
        return;
      }
      ctx.save();
      ctx.translate(x + 23, y + 27);
      ctx.lineWidth = 2;
      ctx.strokeStyle = PAL.ink;
      if (sku === 'paper') {
        ctx.fillStyle = '#f6f0e4';
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c4363a';
        ctx.fillRect(-4, -22, 8, 44);
      } else if (sku === 'candy') {
        ctx.fillStyle = '#d64545';
        roundBox(-16, -18, 32, 36, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f6f0e4';
        ctx.fillRect(-10, -4, 20, 6);
      } else if (sku === 'candle') {
        ctx.fillStyle = '#f3e6c8';
        roundBox(-10, -8, 20, 28, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e0a322';
        ctx.fillRect(-2, -22, 4, 14);
      } else if (sku === 'lights') {
        ctx.strokeStyle = '#2f7d4a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 4, 16, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#e0a322';
        ctx.beginPath();
        ctx.arc(-12, 4, 4, 0, Math.PI * 2);
        ctx.arc(0, -10, 4, 0, Math.PI * 2);
        ctx.arc(12, 4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (sku === 'plush') {
        ctx.fillStyle = '#c46a3a';
        ctx.beginPath();
        ctx.arc(0, 4, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-12, -10, 7, 0, Math.PI * 2);
        ctx.arc(12, -10, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (sku === 'globe') {
        ctx.fillStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.arc(0, -2, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#6b4228';
        roundBox(-14, 14, 28, 8, 2);
        ctx.fill();
      } else if (sku === 'mug') {
        ctx.fillStyle = '#f6f0e4';
        roundBox(-14, -12, 24, 28, 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(12, 2, 8, -1, 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#6b2438';
        roundBox(-14, -16, 28, 34, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e0a322';
        ctx.fillRect(-14, -4, 28, 6);
      }
      ctx.restore();
    }

    function worldOn(x, y, pad) {
      var margin = pad == null ? 48 : pad;
      return x >= cam.x - margin && x <= cam.x + frameView.w + margin && y >= cam.y - margin && y <= cam.y + frameView.h + margin;
    }

    function drawLighter(image, x, y, w, h) {
      if (!image) return;
      if (sim && (sim._glowCap === 0 || (sim._glowCap != null && (sim._glow || 0) >= sim._glowCap))) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(image, x, y, w, h);
      ctx.restore();
      if (sim) sim._glow = (sim._glow || 0) + 1;
    }

    function drawStoreDress() {
      var objs = assets && assets.objects;
      if (objs && fixtureGlows) {
        var t = sim.t || 0;
        var rollers = [objs['anim/belt_rollers_0.png'], objs['anim/belt_rollers_1.png'], objs['anim/belt_rollers_2.png']];
        var roll = rollers[Math.floor(t * 8) % rollers.length];
        var sweeps = [objs['anim/scanner_sweep_0.png'], objs['anim/scanner_sweep_1.png'], objs['anim/scanner_sweep_2.png']];
        var sweep = sweeps[Math.floor(t * 12) % sweeps.length];
        var regs = fixtureGlows.registers || [];
        var shed = !!(sim && sim._shed);
        for (var r = 0; r < regs.length; r++) {
          var belt = regs[r];
          if (!worldOn(belt.x, belt.y, 80)) continue;
          if (roll) ctx.drawImage(roll, belt.x, belt.y, belt.w, belt.h);
          var line = belt.station && queueOf(sim, belt.station).length;
          if (line && sweep) drawLighter(sweep, belt.x, belt.y - 6, belt.w, belt.h + 12);
        }
        if (!shed) {
          var twinkles = [objs['anim/tree_twinkle_0.png'], objs['anim/tree_twinkle_1.png'], objs['anim/tree_twinkle_2.png']];
          var twinkle = twinkles[Math.floor(t * 4) % twinkles.length];
          if (fixtureGlows.tree && twinkle && worldOn(fixtureGlows.tree.x, fixtureGlows.tree.y, 40)) {
            drawLighter(twinkle, fixtureGlows.tree.x, fixtureGlows.tree.y, fixtureGlows.tree.w, fixtureGlows.tree.h);
          }
          if (fixtureGlows.tower && sim.stock >= 0.85 && worldOn(fixtureGlows.tower.x, fixtureGlows.tower.y, 40)) {
            var spark = objs['gift_tower/sparkle.png'];
            if (spark && Math.floor(t * 4) % 2 === 0) drawLighter(spark, fixtureGlows.tower.x, fixtureGlows.tower.y, fixtureGlows.tower.w, fixtureGlows.tower.h);
          }
        }
        if (!reduceMotion && !shed) {
          var on = objs['anim/string_bulb_0.png'];
          var off = objs['anim/string_bulb_1.png'];
          var phase = Math.floor(t * 4);
          for (var b = 240; b < WORLD_W - 200; b += 150) {
            if (!worldOn(b, 62, 24)) continue;
            var lit = ((phase + (b / 150)) | 0) % 2 === 0;
            if (lit) drawLighter(on, b, 62, 18, 20);
            else if (off) ctx.drawImage(off, b, 64, 16, 18);
          }
        }
        return;
      }
      var stock = clamp(sim.stock, 0, 1);
      var heroes = stock <= 0.04 ? 0 : stock < 0.34 ? 1 : stock < 0.67 ? 2 : 3;
      var t = sim.t || 0;
      ctx.save();
      SHELVES.forEach(function (sh) {
        var slots = [-48, 0, 48];
        for (var col = 0; col < heroes; col++) drawChunky(sh.x + slots[col] - 23, sh.y - 108, shelfSku(sh, col));
      });
      var regs = registers();
      for (var r = 0; r < regs.length; r++) {
        var belt = SPOTS[regs[r]];
        var slide = reduceMotion ? 10 : ((t * 42 + r * 18) % 46);
        ctx.fillStyle = r === 0 ? PAL.red : PAL.blue;
        ctx.fillRect(belt.x - 40 + slide, 754, 14, 8);
        if (queueOf(sim, regs[r]).length) {
          ctx.strokeStyle = 'rgba(255,224,138,0.9)';
          ctx.lineWidth = 2;
          var scan = reduceMotion ? 0 : (t * 56) % 52;
          ctx.beginPath();
          ctx.moveTo(belt.x - 44 + scan, 748);
          ctx.lineTo(belt.x - 44 + scan, 766);
          ctx.stroke();
        }
      }
      if (!reduceMotion) {
        for (var b = 0; b < 8; b++) {
          var pulse = 0.45 + Math.sin(t * 4 + b) * 0.4;
          ctx.globalAlpha = pulse;
          ctx.fillStyle = b % 2 ? PAL.gold : PAL.cream;
          ctx.beginPath();
          ctx.arc(120 + b * 180, 20, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function jackPose() {
      var best = null;
      for (var i = 0; i < sim.staff.length; i++) {
        var a = sim.staff[i];
        if (a.hidden || a.station !== 'freight') continue;
        best = a;
        break;
      }
      if (sim.you && sim.you.station === 'freight') best = sim.you;
      if (!best) {
        return { kind: 'jack', x: SPOTS.truck.x - 54, y: SPOTS.truck.y + 86, face: 1, roll: (sim.t || 0) * 2, parked: true };
      }
      var face = best.face || 1;
      return {
        kind: 'jack',
        x: best.x + (face < 0 ? 30 : -30),
        y: best.y + 8,
        face: face,
        roll: best.anim === 'walk' ? (sim.t || 0) * 14 : (sim.t || 0) * 2,
        parked: false
      };
    }

    function drawPalletJack(j) {
      var jack = assets && assets.objects && assets.objects['props/pallet_jack.png'];
      if (jack) {
        ctx.save();
        ctx.translate(j.x, j.y);
        if (j.face < 0) ctx.scale(-1, 1);
        ctx.drawImage(jack, -36, -64, 74, 84);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(j.x, j.y);
      if (j.face < 0) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(20,12,16,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-26, -2);
      ctx.lineTo(8, -2);
      ctx.moveTo(-26, 4);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.fillStyle = '#8a5a32';
      roundBox(-24, -14, 36, 12, 2);
      ctx.fill();
      ctx.strokeStyle = '#5c3a22';
      ctx.stroke();
      var boxes = ['#d64545', '#2f9e57', '#e0a322'];
      for (var i = 0; i < 3; i++) {
        ctx.fillStyle = boxes[i];
        ctx.fillRect(-20 + i * 11, -28, 10, 14);
        ctx.fillStyle = 'rgba(246,240,228,0.8)';
        ctx.fillRect(-18 + i * 11, -24, 6, 2);
      }
      ctx.fillStyle = '#e0a322';
      roundBox(4, -18, 16, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#2b1d2e';
      ctx.fillRect(8, -8, 8, 3);
      var spin = reduceMotion ? 0 : j.roll;
      function wheel(wx, wy) {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(spin);
        ctx.fillStyle = '#1a120c';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f6f0e4';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.moveTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.stroke();
        ctx.restore();
      }
      wheel(-16, 6);
      wheel(14, 6);
      ctx.strokeStyle = '#c9842a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(12, -16);
      ctx.lineTo(22, -40);
      ctx.stroke();
      ctx.fillStyle = '#2b1d2e';
      roundBox(16, -46, 14, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#d64545';
      ctx.fillRect(18, -44, 10, 3);
      ctx.restore();
    }

    function drawCarry(a, size) {
      if (a.kind !== 'cust' || a.state === 'leave') return;
      var s = size / 78;
      var sway = (!reduceMotion && a.anim === 'walk') ? Math.sin(a.frame * 1.2) * 3 : 0;
      ctx.save();
      ctx.translate((a.face < 0 ? -18 : 16) * s, -20 * s + sway);
      if (a.arch === 'lift') {
        ctx.fillStyle = '#1a120c';
        roundBox(-8, -10, 16, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#e0a322';
        ctx.fillRect(-5, -7, 10, 3);
      } else if (a.arch === 'family') {
        ctx.fillStyle = '#5c3a22';
        roundBox(-16, -6, 34, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#d64545';
        ctx.fillRect(-12, -16, 10, 12);
        ctx.fillStyle = '#2f9e57';
        ctx.fillRect(-1, -18, 10, 14);
        ctx.fillStyle = '#e0a322';
        ctx.fillRect(8, -12, 8, 8);
        ctx.strokeStyle = '#2b1d2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16, 4);
        ctx.lineTo(-20, 14);
        ctx.moveTo(18, 4);
        ctx.lineTo(22, 14);
        ctx.stroke();
      } else if (a.arch === 'haggle') {
        ctx.fillStyle = '#f6e27a';
        roundBox(-10, -16, 20, 14, 2);
        ctx.fill();
        ctx.strokeStyle = '#2b1d2e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#2b1d2e';
        ctx.font = '800 9px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('%', 0, -5);
      } else if (a.arch !== 'rusher') {
        ctx.fillStyle = '#c9842a';
        roundBox(-8, -4, 16, 10, 3);
        ctx.fill();
        ctx.strokeStyle = '#5c3a22';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 7, Math.PI, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSpritePerson(a) {
      var pack = assets && assets.spritePack;
      if (!pack || !pack.ready) return false;
      var type = spriteTypeFor(a);
      var sheet = pack.types[type];
      var anim = a.anim === 'walk' || a.anim === 'work' ? a.anim : 'idle';
      var dir = (a.face < 0 || a.dir === 'side') ? 'side' : (a.dir === 'up' ? 'up' : 'down');
      var list = spriteFrameList(sheet, anim, dir);
      if (!list) return false;
      var index = (a.frame || 0) % list.length;
      var frame = list[index];
      if (!frame || !frame.img) return false;
      var dh = SPRITE_PACK.displayH;
      var dw = dh * (frame.w / frame.h);
      var foot = (SPRITE_PACK.footY / frame.h) * dh;
      ctx.drawImage(frame.img, Math.round(-dw / 2), Math.round(-foot), Math.round(dw), Math.round(dh));
      return true;
    }

    function drawGhostPose(a) {
      var pack = assets && assets.spritePack;
      if (!pack || !pack.ghosts) return false;
      var type = spriteTypeFor(a);
      var sheet = pack.ghosts[type];
      if (!sheet) return false;
      var anim = a.anim === 'walk' || a.anim === 'work' ? a.anim : 'idle';
      var dir = (a.face < 0 || a.dir === 'side') ? 'side' : (a.dir === 'up' ? 'up' : 'down');
      var list = spriteFrameList(sheet, anim, dir);
      if (!list) return false;
      var frame = list[(a.frame || 0) % list.length];
      if (!frame || !frame.img) return false;
      var dh = SPRITE_PACK.displayH;
      var dw = dh * (frame.w / frame.h);
      var foot = (SPRITE_PACK.footY / frame.h) * dh;
      var gw = Math.max(1, Math.round(dw));
      var gh = Math.max(1, Math.round(dh));
      var key = gw + 'x' + gh;
      if (!frame._ghost || frame._ghostKey !== key) {
        var plate = document.createElement('canvas');
        plate.width = gw;
        plate.height = gh;
        var g = plate.getContext('2d');
        g.drawImage(frame.img, 0, 0, gw, gh);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = 'rgb(36,24,48)';
        g.fillRect(0, 0, gw, gh);
        frame._ghost = plate;
        frame._ghostKey = key;
      }
      ctx.drawImage(frame._ghost, Math.round(-dw / 2), Math.round(-foot));
      if (isQA() && els.stage) els.stage.dataset.pose = '1';
      return true;
    }

    function drawSilhouette(a) {
      if (!drawGhostPose(a)) {
        ctx.save();
        ctx.fillStyle = 'rgba(36,24,48,0.94)';
        ctx.strokeStyle = '#ffe08a';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.ellipse(0, -62, 20, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, -16, 28, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffe08a';
        ctx.font = '800 28px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', 0, -6);
        ctx.restore();
      }
      if (a) a._sil = 1;
      if (isQA() && els.stage) els.stage.dataset.sils = String((+els.stage.dataset.sils || 0) + 1);
    }

    function paintPerson(a) {
      if (drawSpritePerson(a)) {
        if (a) a._drew = 'sprite';
        return;
      }
      var pack = assets && assets.spritePack;
      if (!pack || !pack.ready) {
        if (a) a._drew = 'figure';
        drawFigure(a);
        return;
      }
      if (a) a._drew = 'sil';
      drawSilhouette(a);
    }

    function drawFigure(a) {
      var look = LOOKS[a.charId] || LOOKS.cust_mom;
      var sc = look.scale || 1;
      var walking = a.anim === 'walk' && !reduceMotion;
      var working = a.anim === 'work';
      var phase = (walking || working) ? Math.sin((a.frame || 0) * Math.PI / 2) : 0;
      var dir = (a.face < 0 || a.dir === 'side') ? 'side' : (a.dir === 'up' ? 'up' : 'down');
      var mood = (a.bubble === 'angry' || a.angry) ? 'angry' : (a.heart > 0 ? 'happy' : 'ok');
      var blink = a.anim === 'idle' && ((a.frame || 0) % 2 === 1);
      var bob = walking ? Math.abs(phase) * -3.2 : (!reduceMotion && a.anim === 'idle' ? Math.sin(Date.now() / 420 + (a.seq || 0)) * 1.05 : 0);
      var hoodUp = a.arch === 'lift';
      ctx.save();
      ctx.scale(sc, sc);
      ctx.translate(0, bob);
      if (look.stoop) ctx.translate(2, 4);
      if (a.arch === 'rusher' && walking) ctx.rotate(-0.12);
      if (walking) {
        var sq = 1 + Math.cos((a.frame || 0) * Math.PI) * 0.045;
        ctx.scale(1 / sq, sq);
      }
      ctx.fillStyle = 'rgba(42,24,18,0.3)';
      ctx.beginPath();
      ctx.ellipse(3, 3, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      function limb(x, y, w, h, fill) {
        traceRound(ctx, x, y, w, h, Math.min(4, Math.abs(w) / 2, Math.abs(h) / 2));
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      function head(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = look.skin;
        ctx.fill();
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.7;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,244,220,0.3)';
        ctx.beginPath();
        ctx.arc(x - r * 0.28, y - r * 0.34, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      function hair(x, y) {
        ctx.fillStyle = look.hair;
        if (look.style === 'hijab') {
          ctx.fillStyle = '#14584a';
          if (dir === 'down') {
            ctx.beginPath();
            ctx.arc(x, y + 2, 14, Math.PI, 0);
            ctx.fill();
            limb(x - 16, y - 2, 6, 26, '#14584a');
            limb(x + 10, y - 2, 6, 26, '#14584a');
          } else {
            traceRound(ctx, x - 14, y - 8, 28, 32, 12);
            ctx.fill();
            ctx.strokeStyle = PAL.ink;
            ctx.stroke();
          }
          return;
        }
        if (look.style === 'cap') {
          ctx.fillStyle = PAL.blue;
          ctx.beginPath();
          ctx.arc(x, y, 13, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x - 2, y - 1, 16, 4);
          return;
        }
        if (look.style === 'hood' || hoodUp) {
          ctx.fillStyle = hoodUp ? '#16141a' : look.top;
          ctx.beginPath();
          ctx.arc(x, y, 14, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x - 14, y - 2, 28, 8);
          return;
        }
        if (look.style === 'bald') {
          ctx.beginPath();
          ctx.arc(x, y - 6, 7, Math.PI, 0);
          ctx.fill();
          return;
        }
        var extra = look.style === 'big' ? 5 : look.style === 'curly' ? 3 : 0;
        ctx.beginPath();
        ctx.arc(x, y, 12 + extra, Math.PI, 0);
        ctx.fill();
        if (look.style === 'bun') {
          ctx.beginPath();
          ctx.arc(x, y - 12, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (look.style === 'pony' && dir !== 'up') ctx.fillRect(dir === 'side' ? x + 6 : x - 2, y + 2, 5, 14);
        if (look.style === 'curly') {
          ctx.beginPath();
          ctx.arc(x - 10, y + 2, 4, 0, Math.PI * 2);
          ctx.arc(x + 10, y + 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      function face(x, y) {
        if (look.style === 'hijab' && dir !== 'down') return;
        if (hoodUp && dir !== 'side') return;
        ctx.fillStyle = PAL.ink;
        if (dir === 'side') {
          if (!blink && mood !== 'happy') ctx.fillRect(x + 5, y - 2, 3, 3);
          ctx.strokeStyle = mood === 'angry' ? PAL.red : PAL.ink;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x + 4, y + 5, 3, mood === 'angry' ? 1.15 * Math.PI : 0.2 * Math.PI, mood === 'angry' ? 1.85 * Math.PI : 0.8 * Math.PI);
          ctx.stroke();
          return;
        }
        if (blink || mood === 'happy') {
          ctx.strokeStyle = PAL.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x - 5, y, 3, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + 5, y, 3, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        } else {
          ctx.fillRect(x - 7, y - 2, 3.2, 3.2);
          ctx.fillRect(x + 4, y - 2, 3.2, 3.2);
        }
        if (mood === 'angry') {
          ctx.strokeStyle = PAL.ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x - 8, y - 7);
          ctx.lineTo(x - 3, y - 4);
          ctx.moveTo(x + 8, y - 7);
          ctx.lineTo(x + 3, y - 4);
          ctx.stroke();
        }
        ctx.strokeStyle = mood === 'angry' ? PAL.red : PAL.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (mood === 'angry') ctx.arc(x, y + 8, 3.5, 1.15 * Math.PI, 1.85 * Math.PI);
        else ctx.arc(x, y + 6, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        if (look.glasses) {
          ctx.strokeStyle = PAL.ink;
          ctx.lineWidth = 1.3;
          ctx.strokeRect(x - 8, y - 4, 7, 5);
          ctx.strokeRect(x + 2, y - 4, 7, 5);
        }
        if (look.beard) {
          ctx.fillStyle = look.hair;
          ctx.beginPath();
          ctx.arc(x, y + 6, 6, 0, Math.PI);
          ctx.fill();
        }
      }
      var leg = phase * 5.5;
      var wide = look.wide ? 3 : 0;
      if (dir === 'side') {
        limb(-4 + leg, -24, 9, 20, look.bottom);
        limb(-1 - leg * 0.5, -22, 8, 18, look.bottom);
        limb(-6 + leg, -7, 12, 6, look.shoes);
        limb(working ? 4 : -2, -42, working ? 14 : 8, working ? 7 : 16, look.skin);
        limb(-11, -50, 22, 28, look.top);
        if (look.vest) limb(-9, -48, 16, 16, look.vest);
        if (look.tie) {
          ctx.fillStyle = PAL.gold;
          ctx.fillRect(4, -44, 3, 10);
        }
        head(2, -62, 12);
        hair(2, -68);
        face(2, -62);
      } else if (dir === 'up') {
        limb(-12 + leg, -24, 10, 20, look.bottom);
        limb(2 - leg, -24, 10, 20, look.bottom);
        limb(-14 + leg, -7, 12, 6, look.shoes);
        limb(2 - leg, -7, 12, 6, look.shoes);
        limb(-16 - phase * 4, -46, 8, 16, look.top);
        limb(8 + phase * 4, -46, 8, 16, look.top);
        limb(-14, -52, 28, 28, look.top);
        if (look.vest) limb(-12, -50, 24, 16, look.vest);
        head(0, -64, 13);
        hair(0, -70);
      } else {
        limb(-12 - wide + leg, -24, 10, 20, look.bottom);
        limb(2 + wide - leg, -24, 10, 20, look.bottom);
        limb(-14 - wide + leg, -8, 13, 7, look.shoes);
        limb(1 + wide - leg, -8, 13, 7, look.shoes);
        limb(-18 - wide, -50, 8, 18, look.skin);
        limb(10 + wide, -50 + (working ? 6 : 0), 8, working ? 12 : 18, look.skin);
        limb(-14 - wide, -52, 28 + wide * 2, 28, look.top);
        if (look.vest) limb(-12, -50, 24, 18, look.vest);
        if (look.tie) {
          ctx.fillStyle = PAL.red;
          ctx.beginPath();
          ctx.moveTo(0, -48);
          ctx.lineTo(3, -36);
          ctx.lineTo(0, -32);
          ctx.lineTo(-3, -36);
          ctx.closePath();
          ctx.fill();
        }
        head(0, -66, 13);
        hair(0, -72);
        face(0, -66);
        if (look.cane) {
          ctx.strokeStyle = '#6b4228';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(16, -36);
          ctx.quadraticCurveTo(22, -20, 18, 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawActor(a) {
      var dir = a.face < 0 ? 'side' : a.dir;
      if (a.face < 0) dir = 'side';
      var size = CONFIG.sprite;
      var reactX = 0;
      if ((a.bubble === 'angry' || a.angry) && !reduceMotion) reactX = Math.sin(Date.now() / 70) * 1.8;
      ctx.save();
      ctx.translate(a.x + reactX, a.y);
      if (a.face < 0) ctx.scale(-1, 1);
      if (a.pop > 0) {
        var popS = 1 + a.pop * (reduceMotion ? 0.08 : 0.22);
        ctx.scale(popS, popS);
      }
      if (a.role && ROLE_COLOR[a.role] && !(assets && assets.spritePack && assets.spritePack.ready)) {
        ctx.fillStyle = ROLE_COLOR[a.role];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(0, -2, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      paintPerson(a);
      if (!(assets && assets.spritePack && assets.spritePack.ready)) drawCarry(a, size);
      if (a.arch === 'rusher' && a.anim === 'walk') {
        ctx.strokeStyle = 'rgba(214,69,69,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-18, -30);
        ctx.lineTo(-32, -26);
        ctx.moveTo(-16, -18);
        ctx.lineTo(-34, -16);
        ctx.stroke();
      }
      ctx.restore();
      if (a.arch === 'family' && a.state !== 'leave') {
        var beside = dir === 'up' ? 52 : 46;
        var kx = a.x + (a.face < 0 ? -beside : beside);
        var ky = a.y + (dir === 'up' ? 12 : 6);
        ctx.save();
        ctx.translate(kx, ky);
        if (a.face < 0) ctx.scale(-1, 1);
        paintPerson({
          charId: 'cust_kid',
          dir: a.dir,
          face: 1,
          anim: a.anim,
          frame: a.frame,
          bubble: null
        });
        ctx.restore();
      }
      if (a.kind === 'cust' && a.arch !== 'lift' && a.state !== 'leave' && a.maxPatience) {
        drawPatience(a.x, a.y - size - 8, clamp(a.patience / a.maxPatience, 0, 1));
      }
      if (a.bubble === 'angry' && !reduceMotion) {
        var puff = (Date.now() / 280 + (a.seq || 0)) % 1;
        ctx.globalAlpha = 1 - puff;
        ctx.fillStyle = '#ffd0d0';
        ctx.beginPath();
        ctx.arc(a.x + 18, a.y - size - 6 - puff * 18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (a.bubble) {
        var objIcon = assets.objects && assets.objects['icons/' + a.bubble + '.png'];
        if (objIcon) {
          var objPx = a.bubble === 'angry' || a.bubble === 'theft' ? 44 : 34;
          ctx.drawImage(objIcon, a.x - objPx / 2, a.y - size - 18 - objPx, objPx, objPx);
        }
        var ir = objIcon ? null : assets.icons['icons/' + a.bubble + '.png'];
        if (ir) {
          var iconPx = a.bubble === 'angry' || a.bubble === 'theft' ? 44 : 34;
          ctx.drawImage(assets.img.icons, ir[0], ir[1], ir[2], ir[3], a.x - iconPx / 2, a.y - size - 18 - iconPx, iconPx, iconPx);
        }
      }
      if (a.arch === 'rusher') drawTag('Rush', a.x, a.y - size - 36);
      else if (a.arch === 'family') drawTag('Family', a.x, a.y - size - 36);
      else if (a.arch === 'lift') drawTag(a.state === 'flee' ? 'Catch' : 'Watch', a.x, a.y - size - 28);
      else if (a.haggling) drawTag('Coupon', a.x, a.y - size - 36);
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
      var rawMs = lastTs ? ts - lastTs : 16;
      var dt = rawMs / 1000;
      lastTs = ts;
      if (dt > 0.05) dt = 0.05;
      if (sim) sim._frameMs = rawMs;
        if (sim && !sim.paused && !sim.done) {
        if (coach) {
          for (var cs = 0; cs < sim.staff.length; cs++) updateStaffActor(sim, run, sim.staff[cs], dt);
          if (sim.you) updateStaffActor(sim, run, sim.you, dt);
          for (var cc = 0; cc < sim.customers.length; cc++) tickAnim(sim.customers[cc], dt);
          decayFx(sim, dt);
        } else {
        var speed = isQA() ? qaSpeed : 1;
        var stepDt = dt * speed;
        if (sim._shed && sim.customers.length > 100) {
          sim._stepAcc = (sim._stepAcc || 0) + stepDt;
          if (sim._stepAcc < 0.05) stepDt = 0;
          else {
            stepDt = sim._stepAcc;
            sim._stepAcc = 0;
          }
        }
        if (stepDt > 0) step(sim, run, stepDt);
        }
        while (sim.notes.length) toast(sim.notes.shift());
        if (sim.pending && shownEvent !== sim.pending) {
          shownEvent = sim.pending;
          shownType = null;
          renderEvent();
        }
        if (!sim.pending && shownEvent) {
          shownEvent = null;
          if (!sim.typeCard) els.event.hidden = true;
        }
        paintPromptTimer();
        if (!sim._shed || ((sim._frames || 0) % 4) === 0) paintHud();
        liveAcc += dt;
        if (liveAcc > 5 && els.live) {
          liveAcc = 0;
          els.live.textContent = shiftLabel(run.day) + ' ' + clockLabel(sim.t, sim.duration) + ', sales ' + money(sim.sales) + ' of ' + money(sim.goal) + ', morale ' + Math.round(sim.morale) + '.';
        }
        if (hooks.heat) hooks.heat(sim.customers.length, !!(sim._heat && sim._heat.rush && !sim.coachHold));
        if (!coach && sim.done) finishDay();
        simSaveAcc += dt;
        if (simSaveAcc > 1) { simSaveAcc = 0; saveRun(); }
      }
      if (sim && sim.typeCard && !sim.pending && shownType !== sim.typeCard) {
        shownType = sim.typeCard;
        renderTypeCard();
      }
      if (sim && els.canvas && pixelBudget() !== els.canvas._dprCap) resize();
      if (isQA() && sim && els.stage) {
        sim._frames = (sim._frames || 0) + 1;
        if (!sim._fpsT) sim._fpsT = ts;
        if (ts - sim._fpsT >= 1000) {
          els.stage.dataset.fps = String(sim._frames);
          sim._frames = 0;
          sim._fpsT = ts;
        }
      }
      if (sim && !sim.typeCard && shownType) {
        shownType = null;
        if (!sim.pending) els.event.hidden = true;
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

    var pointers = {};
    function zoomBy(mult) {
      var before = cam.zoom || 1;
      var cssW = els.canvas._cssW || 800;
      var next = HR.render ? HR.render.clampZoom(cssW, before * mult) : before * mult;
      if (Math.abs(next - before) < 0.005) {
        if (mult < 1 && cssW < 720 && !cam.overview) {
          toggleFrame();
          toast('Phone view stays close so people stay readable. The map is the whole floor.');
          return;
        }
        toast(mult < 1 ? 'That is as far as the camera pulls back.' : 'That is as close as the camera goes.');
        return;
      }
      cam.fit = false;
      cam.overview = false;
      var frameBtn = document.getElementById('hr-frame');
      if (frameBtn) frameBtn.setAttribute('aria-pressed', 'false');
      cam.zoom = next;
      draw();
    }
    function toggleFrame() {
      cam.overview = !cam.overview;
      cam.fit = false;
      var frameBtn = document.getElementById('hr-frame');
      if (frameBtn) frameBtn.setAttribute('aria-pressed', cam.overview ? 'true' : 'false');
      cam.follow = !cam.overview;
      draw();
    }
    var zoomIn = document.getElementById('hr-zoom-in');
    var zoomOut = document.getElementById('hr-zoom-out');
    var frameBtn = document.getElementById('hr-frame');
    var eastBtn = document.getElementById('hr-east');
    function bindZoom(node, mult) {
      if (!node) return;
      node.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        zoomBy(mult);
      });
      node.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });
    }
    bindZoom(zoomIn, 1.12);
    bindZoom(zoomOut, 0.88);
    if (frameBtn) frameBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleFrame(); });
    if (eastBtn) eastBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var view = viewSize();
      cam.fit = false;
      cam.overview = false;
      var frameNow = document.getElementById('hr-frame');
      if (frameNow) frameNow.setAttribute('aria-pressed', 'false');
      cam.x = Math.max(0, WORLD_W - view.viewW);
      cam.follow = false;
      setTimeout(function () { if (!coach) cam.follow = true; }, 2600);
      draw();
    });
    ['left', 'right', 'up', 'down'].forEach(function (dir) {
      var node = document.getElementById('hr-pan-' + dir);
      if (!node) return;
      node.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var view = viewSize();
        var stepX = view.viewW * 0.34;
        var stepY = view.viewH * 0.34;
        if (dir === 'left') cam.x -= stepX;
        if (dir === 'right') cam.x += stepX;
        if (dir === 'up') cam.y -= stepY;
        if (dir === 'down') cam.y += stepY;
        cam.x = clamp(cam.x, 0, Math.max(0, WORLD_W - view.viewW));
        cam.y = clamp(cam.y, 0, Math.max(0, WORLD_H - view.viewH));
        cam.follow = false;
        setTimeout(function () { if (!coach) cam.follow = true; }, 2600);
        draw();
      });
    });
    els.stage.addEventListener('wheel', function (ev) {
      if (els.sim.hidden) return;
      var cssW = els.canvas._cssW || window.innerWidth;
      if (cssW < 720) return;
      ev.preventDefault();
      zoomBy(ev.deltaY > 0 ? 0.92 : 1.08);
    }, { passive: false });

    els.stage.addEventListener('pointerdown', function (ev) {
      if (els.sim.hidden || ev.button > 0) return;
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (Object.keys(pointers).length >= 2) return;
      if (ev.target.closest && ev.target.closest('button, .hr-card')) return;
      var phonePan = (els.canvas._cssW || window.innerWidth) < 720;
      if (phonePan && ev.pointerType === 'touch') return;
      if (sim && !phonePan) {
        var preview = pickHit(ev);
        var at = eventWorld(ev);
        var px = at.x;
        var py = at.y;
        if (preview && preview.cust) { px = preview.cust.x; py = preview.cust.y; }
        else if (preview && preview.ping) { px = preview.ping.x; py = preview.ping.y; }
        else if (preview && preview.x != null) { px = preview.x; py = preview.y; }
        tapFx(sim, px, py);
        draw();
      }
      cam.drag = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, moved: false, phone: phonePan, locked: phonePan ? '' : 'pan' };
      if (!phonePan) {
        if (!coach) cam.follow = false;
        try { els.stage.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    }, { passive: true });
    els.stage.addEventListener('pointermove', function (ev) {
      if (pointers[ev.pointerId]) pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && HR.render) {
        var a = pointers[ids[0]];
        var b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (!cam.pinch) cam.pinch = dist;
        else if (cam.pinch > 0) zoomBy(dist / cam.pinch);
        cam.pinch = dist;
        return;
      }
      if (!cam.drag) return;
      if (cam.drag.phone && !cam.drag.locked) {
        var dx0 = ev.clientX - cam.drag.x;
        var dy0 = ev.clientY - cam.drag.y;
        if (Math.abs(dx0) < 10 && Math.abs(dy0) < 10) return;
        if (Math.abs(dy0) >= Math.abs(dx0)) {
          cam.drag = null;
          return;
        }
        cam.drag.locked = 'pan';
        cam.drag.moved = true;
        if (!coach) cam.follow = false;
        try { els.stage.setPointerCapture(ev.pointerId); } catch (eCap) {}
      }
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      var mx = ev.clientX - cam.drag.x;
      var my = ev.clientY - cam.drag.y;
      if (Math.abs(mx) + Math.abs(my) > 10) cam.drag.moved = true;
      if (!cam.drag.moved) return;
      cam.x = clamp(cam.drag.cx - mx / scale, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(cam.drag.cy - my / scale, 0, Math.max(0, WORLD_H - view.viewH));
    }, { passive: true });
    function endPan(ev) {
      if (ev && ev.pointerId != null) delete pointers[ev.pointerId];
      if (Object.keys(pointers).length < 2) cam.pinch = 0;
      var wasTap = cam.drag && !cam.drag.moved;
      if (cam.drag && cam.drag.moved) {
        setTimeout(function () { if (!coach) cam.follow = true; }, 2600);
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

    var lastActAt = 0;
    function actPoint(name) {
      if (name === 'freight') return { x: SPOTS.truck.x, y: SPOTS.truck.y };
      if (name === 'calm') return { x: SPOTS.reg1.x, y: QUEUE.reg1.y };
      return { x: SPOTS.reg1.x, y: SPOTS.reg1.y };
    }
    function pressAct(name, btn) {
      if (!sim) return;
      lastActAt = root.performance ? root.performance.now() : Date.now();
      if (btn) btn.classList.add('is-down');
      if (root.CGSfx && root.CGSfx.juice && btn) root.CGSfx.juice(btn, 'pop');
      playerAct(name, { point: actPoint(name) });
    }
    els.sim.addEventListener('pointerdown', function (ev) {
      if (ev.button > 0) return;
      if (ev.target.closest('#hr-crew-btn')) {
        ev.preventDefault();
        lastActAt = root.performance ? root.performance.now() : Date.now();
        openCrew('live');
        return;
      }
      if (ev.target.closest('#hr-mute')) {
        ev.preventDefault();
        lastActAt = root.performance ? root.performance.now() : Date.now();
        setAudioMuted(!audioMuted());
        return;
      }
      var btn = ev.target.closest('[data-act]');
      if (!btn || !sim) return;
      ev.preventDefault();
      pressAct(btn.getAttribute('data-act'), btn);
    });
    document.addEventListener('pointerup', function () {
      var downs = document.querySelectorAll('.hr-actions button.is-down');
      for (var di = 0; di < downs.length; di++) downs[di].classList.remove('is-down');
    });
    els.sim.addEventListener('click', function (ev) {
      if ((root.performance ? root.performance.now() : Date.now()) - lastActAt < 450) return;
      if (ev.target.closest('#hr-crew-btn')) {
        openCrew('live');
        return;
      }
      if (ev.target.closest('#hr-mute')) {
        setAudioMuted(!audioMuted());
        return;
      }
      var btn = ev.target.closest('[data-act]');
      if (!btn || !sim) return;
      pressAct(btn.getAttribute('data-act'), btn);
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
      var pct = Math.min(100, Math.round(100 * loadCount / loadGoal));
      if (bar) bar.style.width = pct + '%';
      if (bar && bar.parentNode) bar.parentNode.setAttribute('aria-valuenow', String(pct));
      if (lab) lab.textContent = pct < 100 ? 'Setting the floor' : 'Doors open';
    };

    var bootData = HR.data ? HR.data.load(ART + 'data/') : Promise.resolve(null);
    bootData.then(function () {
      books = HR.save ? HR.save.load(readJSON) : null;
      if (books) {
        var campNow = campaignGet();
        campNow.bank = books.cash;
        campaignPut(campNow);
      }
      return loadGameArt();
    }).then(function (loaded) {
      assets = loaded;
      function paintSpriteStatus() {
        if (!els.stage || !assets || !assets.spriteStatus) return;
        els.stage.dataset.sprites = assets.spriteStatus.ready ? 'ready' : assets.spriteStatus.reason;
        els.stage.dataset.spriteBytes = String(assets.spriteStatus.bytes || 0);
      }
      root.__hrApplyPack = function (pack) {
        if (!assets || !pack) return;
        assets.spritePack = pack;
        assets.portraits = pack.portraits || assets.portraits;
        var n = Object.keys(pack.types || {}).length;
        assets.spriteStatus = {
          ready: !!(pack.ready && n),
          reason: n ? 'ready' : 'streaming',
          bytes: pack.bytes || 0,
          partial: true
        };
        paintSpriteStatus();
        if (sim && !els.sim.hidden) draw();
      };
      root.__hrApplyObjects = function (more) {
        if (!assets || !assets.objects || !more) return;
        Object.keys(more).forEach(function (key) { assets.objects[key] = more[key]; });
        bakedKey = '';
        if (sim && !els.sim.hidden) {
          bakeStorePlate();
          draw();
        }
      };
      if (root.__hrPendingPack) root.__hrApplyPack(root.__hrPendingPack);
      if (root.__hrPendingObjects) root.__hrApplyObjects(root.__hrPendingObjects);
      paintSpriteStatus();
      bakeStorePlate();
      resize();
      var saved = readJSON('hr_run_v1');
      var campBoot = campaignGet();
      var resumable = saved && saved.v === 3 && saved.ymd === ymd && saved.phase && saved.phase !== 'intro' && saved.days && saved.days.length === SHIFT_COUNT;
      if (previewSeed() === 'kiosk' && books && HR.economy) {
        books.cash = Math.max(books.cash || 0, 20000);
        ['knock', 'lane', 'kiosk'].forEach(function (id) {
          if (!HR.economy.has(books, id)) HR.economy.expand(books, id);
        });
        if (books.locations.kiosk && books.locations.kiosk.open) HR.economy.switchLocation(books, 'kiosk');
        if (books.locations.mart && books.active !== 'mart') HR.economy.assignManager(books, 'mart', 'staff_mgr');
        if (HR.save) HR.save.save(writeJSON, books);
        try {
          localStorage.setItem('hr_tut_done', '1');
          localStorage.setItem('hr_coach_price', '1');
          localStorage.setItem('hr_coach_mall', '1');
          localStorage.removeItem('hr_run_v1');
        } catch (eSeed) {}
        var seedCamp = campaignGet();
        seedCamp.seen = true;
        seedCamp.bank = books.cash;
        campaignPut(seedCamp);
        run = newRun(ymd);
        applyCampaign(run);
        run.phase = 'map';
        syncFloor(true);
        renderMap();
        toast('Plaza Kiosk is unlocked. Pick a shift to play that floor.', true);
        if (els.stage) els.stage.dataset.seed = 'kiosk';
      } else if (resumable) {
        run = saved;
        applyCampaign(run);
        if (!run.suggested) run.suggested = [];
        track('holiday_rush_resume', { seed: ymd });
        enterPhase();
      } else if (!campBoot.seen) {
        beginShift(0);
      } else {
        run = newRun(ymd);
        applyCampaign(run);
        run.day = campBoot.current || 0;
        run.phase = 'map';
        renderMap();
      }
      track('holiday_rush_open', { seed: ymd });
    }).catch(function () {
      showFatal('The store did not load. Refresh the page to try again.');
    });

    root.HolidayRush._debug = {
      cam: function () { return { x: cam.x, y: cam.y, zoom: cam.zoom || 1 }; },
      zeroFinish: function (sales) {
        if (!isQA() || !sim) return;
        sim.sales = sales == null ? 0 : sales;
        sim.done = true;
        finishDay();
      },
      turbo: function (n) { if (isQA()) qaSpeed = n || 1; },
      combo: function (n) {
        if (!isQA() || !sim) return;
        sim.combo = n == null ? 4 : n;
        paintHud();
      },
      rush: function (on) {
        if (!isQA() || !sim) return;
        sim._qaRush = on !== false;
        sim.coachHold = false;
        paintHud();
      },
      setSales: function (sales, goal) {
        if (!isQA() || !sim) return;
        if (sales != null) sim.sales = sales;
        if (goal != null) sim.goal = goal;
        sim._paintSales = sim.sales;
        paintHud();
      },
      hold: function (on) {
        if (!isQA() || !sim) return;
        sim.paused = on !== false;
      },
      forceTier: function (n) {
        if (!isQA() || !sim) return null;
        sim._tier = n;
        sim._qHot = 0;
        sim._qCool = 0;
        sim._frameMs = 0;
        sim._frameEma = 0;
        sim._fullSprites = n <= 1 ? 0 : 999;
        draw();
        return {
          tier: els.stage ? els.stage.dataset.tier : '',
          queueN: els.stage ? els.stage.dataset.queueN : '',
          queueSprites: els.stage ? els.stage.dataset.queueSprites : '',
          queueBlobs: els.stage ? els.stage.dataset.queueBlobs : '',
          queueSils: els.stage ? els.stage.dataset.queueSils : '',
          peopleN: els.stage ? els.stage.dataset.peopleN : '',
          peopleSprites: els.stage ? els.stage.dataset.peopleSprites : '',
          peopleBlobs: els.stage ? els.stage.dataset.peopleBlobs : '',
          browseBlobs: els.stage ? els.stage.dataset.browseBlobs : '',
          staffBlobs: els.stage ? els.stage.dataset.staffBlobs : ''
        };
      },
      grant: function (n) {
        if (!isQA() || !books) return;
        books.cash += n || 0;
        var campNow = campaignGet();
        campNow.bank = books.cash;
        campaignPut(campNow);
        if (HR.save) HR.save.save(writeJSON, books);
      },
      stress: function (n) {
        if (!isQA() || !sim) return;
        var count = n || 150;
        sim.stressCap = count;
        sim.paused = false;
        var i;
        for (i = 0; i < count; i++) spawnCustomer(sim, run);
        while (sim.staff.length < 20) {
          var actor = makeActor('staff_flr1', 80 + sim.staff.length * 30, 240);
          actor.kind = 'staff';
          actor.id = 'stress_' + sim.staff.length;
          actor.role = 'floor';
          actor.hidden = false;
          actor.arrived = true;
          sim.staff.push(actor);
        }
        for (i = 0; i < sim.customers.length; i++) {
          var cust = sim.customers[i];
          cust.x = (i * 97) % Math.max(1, WORLD_W);
          cust.y = 180 + ((i * 53) % 640);
          cust.state = 'browse';
          cust.patience = 999;
          cust.maxPatience = 999;
          cust.dead = false;
          cust.browseT = 999;
        }
        sim._tier = 3;
        sim._qHot = 0;
        sim._qCool = 0;
        sim._shed = false;
        sim._frameMs = 0;
        sim._frameEma = 0;
        if (sim.spatial) sim.spatial.rebuild(sim.customers.concat(sim.staff));
        resize();
        if (els.stage) els.stage.dataset.simCount = String(sim.customers.length + sim.staff.length);
        return { customers: sim.customers.length, staff: sim.staff.length };
      },
      books: function () { return books; },
      fill: function () {
        if (!isQA() || !run) return;
        run.schedule[run.day] = greedy(run, run.day);
        saveRun();
        if (run.phase === 'plan') renderPlan();
      },
      roomPNG: function () {
        if (!isQA() || !storePlate) return '';
        return storePlate.toDataURL('image/png');
      },
      roomPlate: function () {
        if (!isQA() || !assets || !HR.room) return '';
        var plate = document.createElement('canvas');
        plate.width = 1600;
        plate.height = 900;
        var g = plate.getContext('2d');
        HR.room.paint(g, assets.objects, 1600, 900, { entranceX: 960, arch: false });
        return plate.toDataURL('image/png');
      },
      silhouette: function (type) {
        if (!isQA() || !spriteSession) return false;
        var name = type || 'regular';
        spriteSession.hold(name);
        var pack = spriteSession.pack();
        return { held: !pack.types[name], pose: !!(pack.ghosts && pack.ghosts[name]) };
      },
      flush: function () {
        if (!isQA()) return null;
        saveRun();
        return { sales: sim ? Math.round(sim.sales) : 0, cash: books ? Math.round(books.cash) : 0 };
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
    verifySpritePack: verifySpritePack,
    SPRITE_PACK: SPRITE_PACK,
    renderMixdown: renderMixdown,
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
    var sprites = verifySpritePack();
    var active0 = simulate('2026-10-19', 'active', 0)[0];
    var greedy0 = simulate('2026-10-19', 'greedy', 0)[0];
    var empty0 = simulate('2026-10-19', 'empty', 0)[0];
    var active8 = simulate('2026-10-19', 'active', 8)[0];
    var active14 = simulate('2026-10-19', 'active', 14)[0];
    var up14 = simulate('2026-10-19', 'upgraded', 14)[0];
    var mid8 = simulate('2026-10-19', 'mid', 8)[0];
    var bad = false;
    function line(label, row) {
      if (!row.done || !isFinite(row.points) || row.points < 0) bad = true;
      console.log(label, 'shift', row.shift, 'sales', row.sales, 'goal', row.goal, 'pct', Math.round(row.goalPct * 100), 'stars', row.shiftStars, 'out', row.walkouts, 'in', row.checkouts);
    }
    console.log('atlas', JSON.stringify(atlas));
    console.log('sprites', JSON.stringify(sprites));
    line('active0', active0);
    line('greedy0', greedy0);
    line('empty0', empty0);
    line('active8', active8);
    line('active14', active14);
    line('up14', up14);
    line('mid8', mid8);
    if (comboMult(10) !== 4 || comboMult(40) !== 4 || multLabel(10) !== '×4' || multLabel(24) !== '×4') bad = true;
    if (goalStars(0.74) !== 0 || goalStars(0.75) !== 1 || goalStars(1) !== 2 || goalStars(1.2) !== 3) bad = true;
    if (SHIFT_COUNT < 15) bad = true;
    if (FLOOR_BEATS.length < SHIFT_COUNT) bad = true;
    var beatSeen = {};
    for (var beatI = 0; beatI < FLOOR_BEATS.length; beatI++) {
      var beatRow = FLOOR_BEATS[beatI];
      if (!beatRow || beatSeen[beatRow.id] || beatRow.t < 18 || beatRow.t > 44) bad = true;
      beatSeen[beatRow.id] = 1;
    }
    var impliedGood = greedy0.goalPct * 1.45;
    if (greedy0.goalPct < 0.78 || greedy0.goalPct > 0.94) bad = true;
    if (impliedGood < 1.1 || impliedGood > 1.32) bad = true;
    if (!(active0.goalPct > greedy0.goalPct)) bad = true;
    if (active0.goalPct > 1.32) bad = true;
    if (empty0.goalPct > 0.45) bad = true;
    if (!(active14.goal > active0.goal * 1.5)) bad = true;
    if (!(active14.goalPct < active0.goalPct - 0.15)) bad = true;
    if (up14.goalPct < 1) bad = true;
    if (mid8.goalPct < 0.9) bad = true;
    ['entities', 'economy', 'layout', 'world', 'sprites', 'render', 'room'].forEach(function (name) {
      var part = HR[name];
      if (!part || !part.selfTest) { bad = true; console.log(name, 'missing'); return; }
      var res = part.selfTest();
      console.log(name, JSON.stringify(res));
      if (!res.ok) bad = true;
    });
    console.log('impliedGood', Math.round(impliedGood * 100));
    console.log('combo', multLabel(10), 'bad', bad);
    if (bad) process.exit(1);
  }
})(typeof window !== 'undefined' ? window : globalThis);
