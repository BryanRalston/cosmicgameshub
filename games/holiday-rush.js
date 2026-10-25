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
  var MONDAY_GOAL_MUL = 0.55;
  var LIVE_RING_RATE = 0.95;
  var LIVE_BASKET = 0.53;
  var LIVE_STAFFED = 1.27;

  function liveQueueGap(sim) {
    return sim && sim._phone ? 210 : 140;
  }

  function liveLineCap() {
    return 2;
  }

  function kioskOneStarCosts(sales, cogs, wages, rent, goalPct) {
    return {
      cogs: Math.round(cogs || 0),
      wages: Math.round(wages || 0),
      sales: Math.round(sales || 0),
      rent: Math.round(rent || 0),
      goalPct: goalPct || 0
    };
  }

  function liveGoodsCost(cogs, revenue, rung) {
    cogs = cogs || 0;
    if (!(revenue > 0) || !(rung >= 0)) return cogs;
    var goods = cogs * (rung / revenue);
    if (goods < 0) goods = 0;
    return goods;
  }

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
    if (actor.giftSprite) return actor.giftSprite;
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

  function applyKioskTune(sim, c) {
    if (!sim || !c || sim.crowd !== 'gift') return;
    c.speedMul *= 0.72;
    c.patience *= 1.55;
    c.maxPatience = c.patience;
    c.saleMul *= 0.62;
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
    if (sim.crowd === 'gift') bag = ['cust_kid', 'cust_kid', 'cust_mom', 'cust_kid', 'cust_grandpa', 'cust_mom'];
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
    if (sim.crowd === 'gift' && id === 'cust_mom') c.giftSprite = 'family';
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
    applyKioskTune(sim, c);
    if (sim._phone && sim.floorOn) {
      c.patience *= 1.2;
      c.maxPatience = c.patience;
    }
    if (forcedArch) {
      var doorIn = SPOTS.door || SPOTS.floor || { x: 640, y: 820 };
      c.x = doorIn.x + (sim.rng() * 48 - 24);
      c.y = doorIn.y - 6;
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
    releaseCardPause(sim);
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
    if (!sim.floorOn || sim.coachHold || sim.tutorial || sim.paused || sim.done || sim.typeCard || sim._introDone || cardCooling(sim)) return;
    var id = dueIntro(run);
    if (!id || sim.t < 5.5) return;
    var born = spawnCustomer(sim, run, id);
    if (!born) return;
    sim._introDone = true;
    sim.typeCard = id;
    sim.typeUntil = sim.t + 5.5;
    armCardPause(sim);
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

  function liveTillStaffed(sim) {
    if (!sim) return false;
    if (sim.you && sim.t < (sim.you.until || 0) && isTill(sim.you.station)) return true;
    if (!sim.override) return false;
    var id;
    for (id in sim.override) {
      if (isTill(sim.override[id])) return true;
    }
    return false;
  }

  function liveLineDrain(sim, drain) {
    if (sim && sim.floorOn && sim.live && !sim.tenant && liveTillStaffed(sim)) return drain * 0.08;
    return drain;
  }

  function backLeft(sim) {
    if (!sim || !sim.books || !HR.economy || !HR.economy.unitsLeft) return 0;
    return HR.economy.unitsLeft(sim.books, sim.tenant && sim.tenant.stock);
  }

  function clearRestockPing(sim) {
    if (!sim || !sim.pings) return;
    for (var i = 0; i < sim.pings.length; i++) {
      if (sim.pings[i].kind === 'restock') sim.pings[i].dead = true;
    }
  }

  function stockBag(sim) {
    if (!sim) return null;
    if (sim.tenant && sim.tenant.stock) return sim.tenant.stock;
    if (!sim.books || !sim.books.locations) return null;
    var loc = sim.books.locations[sim.books.active];
    return loc && loc.stock ? loc.stock : null;
  }

  function addBackStock(sim, scale) {
    if (!sim || !HR.economy || !HR.economy.starterStock) return 0;
    var bag = stockBag(sim);
    if (!bag) return 0;
    var add = HR.economy.starterStock(scale);
    var n = 0;
    var id;
    for (id in add) {
      if (!add[id]) continue;
      bag[id] = (bag[id] || 0) + add[id];
      n += add[id];
    }
    if (!n) return 0;
    sim.stock = Math.max(sim.stock || 0, 0.74);
    sim.truck = 0;
    clearRestockPing(sim);
    return n;
  }

  function deliverEveningTruck(sim) {
    if (!sim || sim._eveningTruck) return 0;
    var n = addBackStock(sim, 0.1);
    if (!n) return 0;
    sim._eveningTruck = 1;
    return n;
  }

  function ensureOpeningStock(sim) {
    if (!sim || sim.tenant || !sim.books) return;
    if (!HR.economy || !HR.economy.starterStock || !HR.economy.unitsLeft) return;
    var full = 0;
    var base = HR.economy.starterStock(1);
    var id;
    for (id in base) full += base[id] || 0;
    if (HR.economy.unitsLeft(sim.books) >= Math.round(full * 0.45)) return;
    var bag = stockBag(sim);
    if (!bag) return;
    var floorBag = HR.economy.starterStock(0.55);
    for (id in floorBag) {
      if (!floorBag[id]) continue;
      if ((bag[id] || 0) < floorBag[id]) bag[id] = floorBag[id];
    }
    sim.stock = Math.max(sim.stock || 0, 0.78);
    sim._eveningTruck = 0;
  }

  function keepRestockPing(sim) {
    if (!sim || sim.done) return;
    if (!sim.pings) sim.pings = [];
    for (var i = 0; i < sim.pings.length; i++) {
      if (sim.pings[i].kind === 'restock' && !sim.pings[i].dead) {
        sim.pings[i].life = 8;
        return;
      }
    }
    var door = SPOTS.door || { x: 640, y: 855 };
    sim.pings.push({
      kind: 'restock',
      x: door.x - 110,
      y: door.y - 150,
      life: 8,
      pop: 1,
      dead: false
    });
  }

  function completeSale(sim, run, c) {
    if (c.sold) return;
    if (sim.stock <= 0.025) {
      var shelfBag = sim.tenant && sim.tenant.stock;
      var shelfLeft = sim.books && HR.economy ? HR.economy.unitsLeft(sim.books, shelfBag) : 0;
      if (sim.floorOn && shelfLeft > 0) {
        sim.stock = 0.42;
      } else {
        if (sim.books) {
          sim.stockouts = (sim.stockouts || 0) + 1;
          floater(sim, c.x, c.y - 96, 'Empty shelf', '#ffb4b4', true);
        }
        walkout(sim, c);
        return;
      }
    }
    var basket;
    var quotedCogs = 0;
    var quotedRevenue = 0;
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
      quotedCogs = quoted.cogs || 0;
      quotedRevenue = quoted.revenue || 0;
      if (stationPower(sim, run, 'floor') > 0.55) basket *= 1.1;
      if (sim.stock < 0.28) basket *= 0.64;
      if (sim.t < sim.discountUntil) basket *= 0.86;
      basket *= 1 + 0.09 * upgradeLevel(run, 'baskets');
      if (c.saleMul) basket *= c.saleMul;
      sim.cogs = (sim.cogs || 0) + quotedCogs;
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
    var comboCap = CONFIG.comboMax;
    if (sim.floorOn && sim.live && !sim.tenant) comboCap = 2;
    if (gap <= CONFIG.comboWindow && (sim.combo || 0) >= 1) {
      if (sim.combo < comboCap) sim.combo += 1;
    } else sim.combo = 1;
    sim.lastSaleAt = sim.t;
    if (sim.combo > (sim.bestCombo || 0)) sim.bestCombo = sim.combo;
    var mult = comboMult(sim.combo);
    if (sim.floorOn && sim.live && !sim.tenant) {
      basket *= LIVE_BASKET;
      if (liveTillStaffed(sim)) basket *= LIVE_STAFFED;
      if (quotedRevenue > 0) {
        var goods = liveGoodsCost(quotedCogs, quotedRevenue, basket);
        sim.cogs += goods - quotedCogs;
      }
    }
    basket = Math.round(basket * mult);
    if (sim.floorOn && sim.live && !sim.tenant) {
      if ((sim._doubleLeft || 0) > 0) {
        basket *= 2;
        sim._doubleLeft -= 1;
      }
    } else if (sim.doubleUntil && sim.t < sim.doubleUntil) basket *= 2;
    sim.sales += basket;
    sim.checkouts++;
    if (sim.mechanic === 'wrap' && sim.floorOn && sim.live && sim.rng() < 0.8) offerWrap(sim);
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

  function liveLine(sim) {
    return !!(sim && sim.floorOn);
  }

  function queueSlot(sim, reg, index) {
    var base = QUEUE[reg] || { x: 496, y: 800, dy: 32 };
    if (!liveLine(sim)) {
      var row = Math.min(index, 3);
      var col = index > 3 ? (index - 3) : 0;
      return { x: base.x + col * 30, y: base.y + row * base.dy };
    }
    var idx = index < 0 ? 0 : index;
    var cap = liveLineCap(sim);
    if (idx > cap - 1) idx = cap - 1;
    var anchor = (typeof SPOTS !== 'undefined' && SPOTS[reg]) ? SPOTS[reg] : base;
    var gap = liveQueueGap(sim);
    var side = reg === 'reg2' ? 86 : -86;
    return { x: anchor.x + side, y: anchor.y - idx * gap };
  }

  function laneLoad(sim, reg) {
    var n = queueOf(sim, reg).length;
    if (!liveLine(sim)) return n;
    for (var i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.dead || c.reg !== reg || c.state !== 'toQueue') continue;
      n++;
    }
    return n;
  }

  function waitPocket(cust) {
    var i = (cust && cust.seq ? cust.seq : 1) % 8;
    var col = i % 4;
    var row = (i / 4) | 0;
    return { x: 180 + col * 220, y: 170 + row * 170 };
  }

  function spriteFootBox(sim) {
    var phone = !!(sim && sim._phone);
    return { h: phone ? 120 : 70, w: phone ? 78 : 50, pad: 8 };
  }

  function pushOutOf(mover, anchor, box) {
    var hw = box.w + box.pad;
    var hh = box.h + box.pad;
    var dx = mover.x - anchor.x;
    var dy = (mover.y - box.h * 0.5) - (anchor.y - box.h * 0.5);
    var xOverlap = hw - Math.abs(dx);
    var yOverlap = hh - Math.abs(dy);
    if (!(xOverlap > 0 && yOverlap > 0)) return false;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      mover.x += 14;
      mover.y -= box.pad;
      return true;
    }
    if (xOverlap < yOverlap) mover.x += dx >= 0 ? xOverlap : -xOverlap;
    else mover.y += dy >= 0 ? yOverlap : -yOverlap;
    return true;
  }

  function separateWalkers(sim) {
    if (!liveLine(sim)) return;
    var list = [];
    var i;
    for (i = 0; i < sim.customers.length; i++) {
      var c = sim.customers[i];
      if (c.dead) continue;
      if (c.state === 'queue' || c.state === 'checkout' || c.state === 'leave' || c.state === 'flee' || c.state === 'toQueue' || c.state === 'enter') continue;
      list.push(c);
    }
    var crowded = list.length >= 8;
    var gap = sim._phone ? 58 : 42;
    for (i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i];
        var b = list[j];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (!(dist < gap)) continue;
        if (dist < 1) {
          b.x += 12;
          b.y += (j % 2 ? 10 : -10);
          continue;
        }
        var push = (gap - dist) * (crowded ? 0.18 : 0.35);
        if (push > 2.5) push = 2.5;
        var nx = dx / dist;
        var ny = dy / dist;
        if ((b.seq || 0) >= (a.seq || 0)) {
          b.x += nx * push;
          b.y += ny * push;
        } else {
          a.x -= nx * push;
          a.y -= ny * push;
        }
      }
    }
    var minX = crowded ? 120 : 48;
    var maxX = (WORLD_W || 1280) - (crowded ? 120 : (sim._phone ? 80 : 150));
    var minY = 150;
    var maxY = (WORLD_H || 900) - (crowded ? 80 : 48);
    for (i = 0; i < list.length; i++) {
      if (list[i].x < minX) list[i].x = minX;
      if (list[i].x > maxX) list[i].x = maxX;
      if (list[i].y < minY) list[i].y = minY;
      if (list[i].y > maxY) list[i].y = maxY;
    }
  }

  function placeVisual(drawList, sim) {
    var box = spriteFootBox(sim);
    var nodes = [];
    var seen = [];
    var i;
    var pass;
    var k;
    for (i = 0; i < drawList.length; i++) {
      var actor = drawList[i];
      if (!actor || actor.kind === 'jack' || actor.hidden || actor.dead) continue;
      if (seen.indexOf(actor) >= 0) continue;
      seen.push(actor);
      var locked = actor.state === 'queue' || actor.state === 'checkout';
      nodes.push({ actor: actor, x: actor.x, y: actor.y, lock: locked });
    }
    function relax() {
      for (i = 0; i < nodes.length; i++) {
        for (k = i + 1; k < nodes.length; k++) {
          var a = nodes[i];
          var b = nodes[k];
          if (a.lock && b.lock) continue;
          var beforeX = b.x;
          var beforeY = b.y;
          if (!pushOutOf(b, a, box)) continue;
          var dx = b.x - beforeX;
          var dy = b.y - beforeY;
          if (b.lock) {
            b.x = beforeX;
            b.y = beforeY;
            if (!a.lock) {
              a.x -= dx;
              a.y -= dy;
            }
          } else if (a.lock) {
            b.x = beforeX + dx;
            b.y = beforeY + dy;
          } else {
            b.x = beforeX + dx * 0.5;
            b.y = beforeY + dy * 0.5;
            a.x -= dx * 0.5;
            a.y -= dy * 0.5;
          }
        }
      }
    }
    function park(node) {
      if (node.lock) {
        node.x = node.actor.x;
        node.y = node.actor.y;
        return;
      }
      var minX = 96;
      var maxX = (WORLD_W || 1280) - 96;
      var minY = 140;
      var maxY = (WORLD_H || 900) - 48;
      if (node.x < minX) node.x = minX;
      if (node.x > maxX) node.x = maxX;
      if (node.y < minY) node.y = minY;
      if (node.y > maxY) node.y = maxY;
    }
    for (pass = 0; pass < 10; pass++) relax();
    for (i = 0; i < nodes.length; i++) park(nodes[i]);
    for (pass = 0; pass < 6; pass++) {
      relax();
      for (i = 0; i < nodes.length; i++) park(nodes[i]);
    }
    for (pass = 0; pass < 4; pass++) {
      for (i = 0; i < nodes.length; i++) {
        for (k = i + 1; k < nodes.length; k++) {
          if (nodes[i].lock && nodes[k].lock) continue;
          var pileDx = nodes[k].x - nodes[i].x;
          var pileDy = nodes[k].y - nodes[i].y;
          if (Math.abs(pileDx) > 10 || Math.abs(pileDy) > 10) continue;
          var mover = nodes[k].lock ? nodes[i] : nodes[k];
          if (mover.lock) continue;
          mover.x += 28;
          mover.y += pass % 2 ? 18 : -18;
          park(mover);
        }
      }
    }
    for (i = 0; i < nodes.length; i++) {
      var drawX = nodes[i].x;
      var drawY = nodes[i].y;
      if (nodes[i].lock && nodes[i].actor.reg) {
        var tillSide = nodes[i].actor.reg === 'reg2' ? 1 : -1;
        drawX += tillSide * (sim && sim._phone ? 48 : 34);
      }
      var edge = sim && sim._frame;
      if (edge) {
        var half = spriteFootBox(sim).w * 0.95;
        var leftLimit = edge.x0 + half;
        var rightLimit = edge.x1 - half;
        if (rightLimit > leftLimit) {
          if (drawX < leftLimit) drawX = leftLimit;
          if (drawX > rightLimit) drawX = rightLimit;
        }
      }
      nodes[i].actor._drawX = drawX;
      nodes[i].actor._drawY = drawY;
    }
  }

  function updateCustomers(sim, run, dt) {
    var regs = registers();
    for (var r = 0; r < regs.length; r++) {
      var list = queueOf(sim, regs[r]);
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        c.qIndex = i;
        var slotAt = queueSlot(sim, regs[r], i);
        c.qx = slotAt.x;
        c.qy = slotAt.y;
      }
    }
    var tillsBusy = false;
    if (sim.floorOn) {
      for (var tb = 0; tb < sim.customers.length; tb++) {
        var busy = sim.customers[tb];
        if (busy.dead) continue;
        if (busy.state === 'queue' || busy.state === 'checkout') tillsBusy = true;
      }
      if (!sim.coachHold && !sim.tutorial && sim.t < (sim.duration || 62) * 0.4) {
        if (!tillsBusy) sim._tillIdle = (sim._tillIdle || 0) + dt;
        else sim._tillIdle = 0;
        if (!tillsBusy && sim._tillIdle > 1.15) {
          var nextUp = null;
          for (var ni = 0; ni < sim.customers.length; ni++) {
            var cand = sim.customers[ni];
            if (cand.dead) continue;
            if (cand.state !== 'browse' && cand.state !== 'wait' && cand.state !== 'enter' && cand.state !== 'toQueue') continue;
            if (!nextUp || (cand.seq || 0) < (nextUp.seq || 0)) nextUp = cand;
          }
          if (nextUp) {
            nextUp.reg = nextUp.reg || pickRegister(sim, run);
            if (nextUp.reg && laneLoad(sim, nextUp.reg) < liveLineCap(sim)) {
              var linedNow = queueSlot(sim, nextUp.reg, queueOf(sim, nextUp.reg).length);
              nextUp.state = 'queue';
              nextUp.x = linedNow.x;
              nextUp.y = linedNow.y;
              nextUp.qx = linedNow.x;
              nextUp.qy = linedNow.y;
              nextUp.checkT = null;
              nextUp.path = null;
              sim._tillIdle = 0;
              tillsBusy = true;
            }
          }
        }
      }
    }
    var speed = CONFIG.walkSpeed * (sim.t < sim.spillUntil ? 0.6 : 1);
    var cocoa = hasPerk(run, 'cocoa') ? 0.82 : 1;
    var drainMul = (sim._heat && sim._heat.drain) ? sim._heat.drain : 1;
    if (sim._phone && sim.floorOn) drainMul *= 0.62;
    if (sim._mondayEase && sim.floorOn) drainMul *= 0.7;
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
        cust.enterT = (cust.enterT || 0) + dt;
        var entered = follow(cust, dt, custSpeed);
        if (!entered && sim.floorOn && cust.enterT > 1.15 && cust.shelf) {
          cust.x = cust.shelf.x;
          cust.y = cust.shelf.y;
          cust.path = null;
          entered = true;
        }
        if (entered) {
          cust.state = 'browse';
          var browse = 0.85 + sim.rng() * 1.35;
          if (cust.arch === 'rusher') browse = 0.22 + sim.rng() * 0.2;
          if (cust.arch === 'family') browse = 1.8 + sim.rng() * 1.1;
          if (sim.floorOn && sim.live && !sim.tenant) browse += 0.35 + sim.rng() * 0.4;
          cust.browseT = browse;
          cust.anim = 'idle';
          cust.bubble = null;
        }
      } else if (cust.state === 'browse') {
        cust.anim = 'idle';
        cust.dir = 'up';
        cust.face = 1;
        var browseRate = stationPower(sim, run, 'floor') > 0.5 ? 1.25 : 1;
        if (sim.floorOn && !tillsBusy) browseRate += 1.4;
        cust.browseT -= dt * browseRate;
        cust.patience -= liveLineDrain(sim, dt * 0.012 * cocoa * drainMul * (cust.arch === 'rusher' ? 1.8 : 1));
        if (cust.patience <= 0) walkout(sim, cust);
        else if (cust.browseT <= 0) {
          if (sim.stock <= 0.04) walkout(sim, cust);
          else {
            cust.reg = pickRegister(sim, run);
            if (trafficBlocked(cust.reg)) {
              if (sim.floorOn && sim.live && !sim.tenant && liveTillStaffed(sim)) {
                cust.state = 'wait';
                cust.waitSpot = waitPocket(cust);
              } else walkout(sim, cust);
            } else if (!priceTurn(sim, cust)) {
              if (liveLine(sim) && laneLoad(sim, cust.reg) >= liveLineCap(sim)) {
                cust.state = 'wait';
                cust.waitSpot = waitPocket(cust);
              } else {
                cust.state = 'toQueue';
                cust.seekT = 0;
                cust.path = null;
              }
            }
          }
        }
      } else if (cust.state === 'wait') {
        if (liveLine(sim) && !(cust.reg && laneLoad(sim, cust.reg) < liveLineCap(sim))) {
          var altReg = pickRegister(sim, run);
          if (altReg && laneLoad(sim, altReg) < liveLineCap(sim)) cust.reg = altReg;
        }
        if (!liveLine(sim) || (cust.reg && laneLoad(sim, cust.reg) < liveLineCap(sim))) {
          cust.state = 'toQueue';
          cust.seekT = 0;
          cust.path = null;
        } else {
          var pocket = cust.waitSpot || waitPocket(cust);
          cust.waitSpot = pocket;
          if (moveToward(cust, pocket.x, pocket.y, dt, custSpeed * 0.8)) cust.anim = 'idle';
          cust.patience -= liveLineDrain(sim, dt * 0.008 * cocoa * drainMul);
          if (cust.patience <= 0) walkout(sim, cust);
        }
      } else if (cust.state === 'toQueue') {
        var slot = queueOf(sim, cust.reg).length;
        var reserved = slot;
        if (liveLine(sim)) {
          for (var wi = 0; wi < sim.customers.length; wi++) {
            var ahead = sim.customers[wi];
            if (ahead.dead || ahead === cust || ahead.reg !== cust.reg || ahead.state !== 'toQueue') continue;
            if ((ahead.seq || 0) < (cust.seq || 0)) reserved++;
          }
          if (reserved >= liveLineCap(sim)) {
            cust.state = 'wait';
            cust.seekT = 0;
            cust.waitSpot = waitPocket(cust);
          } else {
            var linedP = queueSlot(sim, cust.reg, reserved);
            cust.seekT = (cust.seekT || 0) + dt;
            var seekDx = cust.x - linedP.x;
            var seekDy = cust.y - linedP.y;
            var seekNear = seekDx * seekDx + seekDy * seekDy < 96 * 96;
            if (moveToward(cust, linedP.x, linedP.y, dt, custSpeed) || seekNear || cust.seekT > (sim.floorOn ? 1.1 : 2.4)) {
              if (queueOf(sim, cust.reg).length >= liveLineCap(sim)) {
                cust.state = 'wait';
                cust.seekT = 0;
                cust.waitSpot = waitPocket(cust);
              } else {
                cust.state = 'queue';
                cust.seekT = 0;
                cust.x = linedP.x;
                cust.y = linedP.y;
              }
            }
          }
        } else {
          var lined = queueSlot(sim, cust.reg, Math.min(slot, 6));
          if (moveToward(cust, lined.x, lined.y, dt, custSpeed)) {
            var lineCap = cust.arch === 'rusher' ? 3 : 6;
            if (slot >= lineCap) walkout(sim, cust);
            else cust.state = 'queue';
          }
        }
      } else if (cust.state === 'queue' || cust.state === 'checkout') {
        var at = false;
        if (liveLine(sim)) {
          cust.x = cust.qx || cust.x;
          cust.y = cust.qy || cust.y;
          at = true;
        } else {
          at = moveToward(cust, cust.qx || cust.x, cust.qy || cust.y, dt, custSpeed);
        }
        var power = stationPower(sim, run, cust.reg);
        var drain = (power > 0.45 ? 0.042 : 0.105) * cocoa;
        if (cust.qIndex > 0) drain += 0.01 * cust.qIndex;
        if (cust.arch === 'rusher') drain *= 1.65;
        if (cust.arch === 'haggle' && cust.qIndex === 0 && at) {
          cust.state = 'checkout';
          cust.anim = 'idle';
          if (!cust.haggling) {
            cust.haggling = true;
            cust.haggleT = sim.floorOn ? 0.7 : 3.6;
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
          cust.patience -= liveLineDrain(sim, dt * drain * drainMul);
          if (cust.patience <= 0) walkout(sim, cust);
          else if (cust.qIndex === 0 && at && !cust.haggling) {
            cust.state = 'checkout';
            cust.anim = 'idle';
            var rate = power > 0.35 ? (0.55 + power * 0.85) : 0.2;
            if (sim._mondayEase && sim.floorOn) rate *= 1.22;
            if (sim._phone && sim.floorOn) rate *= 1.12;
            else if (sim.floorOn && sim.live && !sim.tenant && liveTillStaffed(sim)) rate *= 1.12;
            if (cust.arch === 'rusher') rate *= 1.65;
            if (cust.arch === 'family') rate *= 0.7;
            if (sim.floorOn && rate < LIVE_RING_RATE) rate = LIVE_RING_RATE;
            if (sim.floorOn && sim.live && !sim.tenant && !sim._phone && liveTillStaffed(sim)) rate *= 1.35;
            var checkStart = cust.arch === 'family' ? (sim.floorOn ? 0.95 : 3.3) : (sim.floorOn ? 0.7 : 2.15);
            cust.checkT = (cust.checkT == null ? checkStart : cust.checkT) - dt * rate;
            if (cust.checkT <= 0) completeSale(sim, run, cust);
          } else {
            cust.anim = at ? 'idle' : 'walk';
            if (cust.checkT == null && cust.qIndex === 0 && cust.arch !== 'haggle') cust.checkT = cust.arch === 'family' ? (sim.floorOn ? 0.95 : 3.3) : (sim.floorOn ? 0.7 : 2.15);
          }
          if (!cust.haggling) cust.bubble = cust.patience < cust.maxPatience * 0.38 ? 'angry' : null;
        }
      } else if (cust.state === 'leave') {
        cust.anim = 'walk';
        if (follow(cust, dt, custSpeed * 1.05)) cust.dead = true;
      }
      tickAnim(cust, dt);
    }
    separateWalkers(sim);
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
      var stopName = 'Holiday Rush Mart';
      if (sim.books && sim.books.locations && sim.books.locations[sim.books.active] && sim.books.locations[sim.books.active].name) {
        stopName = sim.books.locations[sim.books.active].name;
      }
      card.body = 'Adler from district is walking the aisles with a clipboard. ' + stopName + ' is the stop today.';
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
          var powered = stationPower(sim, run, 'freight') > 0.4;
          if (powered) {
            sim.stock = clamp(sim.stock + 0.16, 0, 1);
            note(sim, 'Freight filled the hole.');
          } else {
            sim.stock = clamp(sim.stock + 0.04, 0, 1);
            note(sim, 'Nobody really on freight.');
          }
          if (sim.floorOn && sim.live && !sim.tenant) addBackStock(sim, powered ? 0.12 : 0.06);
        }),
        choice('Fill it yourself', 1, function () {
          sim.stock = clamp(sim.stock + 0.22, 0, 1);
          if (sim.floorOn && sim.live && !sim.tenant) addBackStock(sim, 0.16);
        })
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
        choice('Let them go (−$70)', 0, function () {
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
    if (id === 'wrap') return 'Gift wrap';
    return id || '';
  }

  function maybeMallCard(sim) {
    if (!sim.live || !sim.books || sim._mallShown || sim.coachHold || sim.tutorial || sim.pending || sim.paused) return;
    if (sim.t < 2.2 || sim.typeCard || cardCooling(sim)) return;
    sim._mallShown = true;
    var card = buildMallCard(sim);
    if (!card) return;
    openPending(sim, card, 9);
  }

  function armCardPause(sim) {
    if (!sim || !sim.floorOn || sim._hold === 'crew') return;
    sim._hold = 'card';
    sim.paused = true;
  }

  function releaseCardPause(sim) {
    if (!sim || sim._hold !== 'card') return;
    if (sim.pending || sim.typeCard) return;
    sim._hold = '';
    sim.paused = false;
    sim._clockArm = 1;
    if (sim.floorOn) sim._nextCardAt = sim.t + (sim.duration || 62) / 12;
  }

  function cardCooling(sim) {
    return !!(sim && sim.floorOn && sim._nextCardAt && sim.t + 1e-4 < sim._nextCardAt);
  }

  function openPending(sim, card, seconds) {
    if (!sim || !card || sim.pending || sim.typeCard) return false;
    if (sim.coachHold || sim.tutorial) {
      if (!sim._stashedCard) sim._stashedCard = { card: card, seconds: seconds || 8 };
      return true;
    }
    sim.pending = card;
    sim.pendingUntil = sim.t + (seconds || 8);
    armCardPause(sim);
    return true;
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
    releaseCardPause(sim);
    return { ok: true, msg: '' };
  }

  function maybeEvent(sim, run) {
    if (sim.coachHold || sim.tutorial) return;
    if (sim.paused || sim.pending || sim.typeCard || cardCooling(sim)) return;
    if (sim.eventIndex >= sim.events.length) return;
    var when = sim.eventTimes[sim.eventIndex];
    if (sim.t + 1e-4 < when) return;
    var id = sim.events[sim.eventIndex];
    sim.eventIndex++;
    openPending(sim, buildEvent(id, sim, run), 7);
  }

  function step(sim, run, dt) {
    if (!sim || sim.done || sim.paused) return sim;
    var cardHolds = sim.floorOn && sim._hold === 'card';
    if (!cardHolds && sim.pending && sim.pendingUntil && sim.t >= sim.pendingUntil - 1e-4) {
      resolvePending(sim, run, autoChoice(sim.pending, sim));
      if (sim.live) note(sim, 'The aisle moved on.');
    }
    if (!cardHolds && sim.typeCard && sim.typeUntil && sim.t >= sim.typeUntil - 1e-4) {
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
    if (!cardCooling(sim) && sim.eventIndex < sim.events.length) {
      var when = sim.eventTimes[sim.eventIndex];
      if (when > sim.t && when < limit) limit = when;
    }
    var next = sim.t + dt;
    if (next > limit) next = limit;
    if (!(next >= sim.t)) {
      sim._clockBack = (sim._clockBack || 0) + 1;
      next = sim.t;
    }
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
    if (sim.floorOn && sim.live && !sim.tenant) {
      var leftNow = backLeft(sim);
      if (!sim._eveningTruck && leftNow <= 28) {
        if (deliverEveningTruck(sim)) note(sim, 'A late truck restocked the back room.');
        leftNow = backLeft(sim);
      } else if (leftNow <= 0) {
        sim.stock = 0;
      }
      if (leftNow <= 40) keepRestockPing(sim);
      else clearRestockPing(sim);
    }
    if (frozen) {
      /* count holds the shelf still */
    } else if (warehouseOpen && sim.truck) {
      var drained = sim.stock - used * 0.01;
      if (sim.floorOn && fp <= 0.35 && drained < 0.36) drained = 0.36;
      sim.stock = Math.max(0, drained);
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
    if (sim.spawnMul) rate *= sim.spawnMul;
    if (sim.tenant && sim.tenant.mechanic === 'cups') rate *= 1.25;
    if (sim.tenant && sim.tenant.mechanic === 'window') rate *= (sim.calendarDoor > 1 ? 1.25 : 0.78);
    rate *= 0.74 + Math.min(stationPower(sim, run, 'floor'), 1.6) * 0.2;
    if (sim.floorOn && sim.live && !sim.tenant && sim.t < (sim.duration || 62) * 0.36) rate *= 1.45;
    if (sim.books && HR.sim) rate *= HR.sim.demandMul(sim.books);
    if (sim.books && sim.books.mall && sim.books.mall.door) rate *= sim.books.mall.door;
    if (sim.stock < 0.22) rate *= 0.58;
    if (sim.floorOn && sim.live && !sim.tenant && sim.t > sim.duration * 0.34 && sim.t < sim.duration - 0.4) {
      var present = 0;
      var presentI;
      for (presentI = 0; presentI < sim.customers.length; presentI++) {
        var presentCust = sim.customers[presentI];
        if (presentCust.dead || presentCust.state === 'leave' || presentCust.state === 'flee') continue;
        present++;
      }
      if (present < 10) rate += 0.2 + (10 - present) * 0.07;
    }
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
    keepWrap(sim);
    var maxA = sim.actionMax || (CONFIG.baseActions + 1);
    if (sim.actions < maxA) {
      sim.actionFrac = (sim.actionFrac || 0) + used;
      var regenNeed = CONFIG.actionRegen / (1 + 0.28 * upgradeLevel(run, 'hustle'));
      if (sim._mondayEase) regenNeed *= 0.45;
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
    return openPending(sim, { id: id, icon: 'line', title: title, body: body, who: null, expr: 'neutral', choices: choices }, 8);
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
      body: 'Call it and the next fourteen sales ring twice. Let it pass and the till stays on one ring.',
      choices: function (sim) {
        return [
          choice('Call the double', 1, function () {
            sim.doubleUntil = sim.t + 12;
            sim._doubleLeft = (sim._doubleLeft || 0) + 14;
            note(sim, 'The next sales ring twice.');
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
    if (!sim.floorOn || sim.coachHold || sim.tutorial || sim.paused || sim.pending || sim.done || cardCooling(sim)) return;
    if (!sim._beats) sim._beats = {};
    if (sim._forceBus == null) sim._forceBus = previewHas('bus');
    if (sim._forceBus && !sim._beats.bus && sim._playerAct && sim.t >= 6) {
      var busBeat = null;
      for (var bi = 0; bi < FLOOR_BEATS.length; bi++) if (FLOOR_BEATS[bi].id === 'bus') busBeat = FLOOR_BEATS[bi];
      if (busBeat && beatCard(sim, busBeat.id, busBeat.title, busBeat.body, busBeat.choices(sim, run))) {
        sim._beats.bus = 1;
        return;
      }
    }
    var dayN = run && run.day ? run.day : 0;
    var beat = FLOOR_BEATS[dayN] || FLOOR_BEATS[dayN % FLOOR_BEATS.length];
    if (sim.floorOn && sim.live && !sim.tenant && dayN === 0) {
      for (var di = 0; di < FLOOR_BEATS.length; di++) {
        if (FLOOR_BEATS[di].id === 'double') beat = FLOOR_BEATS[di];
      }
    }
    if (beat && !sim._beats[beat.id] && sim.t >= beat.t && beatCard(sim, beat.id, beat.title, beat.body, beat.choices(sim, run))) {
      sim._beats[beat.id] = 1;
      return;
    }
    if (sim._beats.priceTalk || sim.t < 48 || !sim.books || !tagIsSteep(sim.books)) return;
    if (!beatCard(sim, 'priceTalk', 'Price talk', 'A shopper is staring at a tag above the sticker. Drop cocoa a notch, or hold the tag and let them grumble.', [
      choice('Drop cocoa a notch', 0, function () {
        var item = HR.data.get().items.byId.cocoa;
        if (!item) return;
        var next = HR.economy.priceOf(sim.books, item) - 1;
        var res = HR.economy.setPrice(sim.books, 'cocoa', next);
        persistBooks(sim.books);
        note(sim, res.msg || 'Cocoa moved.');
      }),
      choice('Hold the tag', 0, function () { note(sim, 'The tag stays. They can grumble.'); })
    ])) return;
    sim._beats.priceTalk = 1;
  }

  function wrapSpot() {
    var order = ['BOOTH', 'WRAP', 'TABLE', 'COCOA'];
    var j;
    var i;
    for (j = 0; j < order.length; j++) {
      for (i = 0; i < SHELVES.length; i++) {
        if (SHELVES[i].label === order[j]) return SHELVES[i];
      }
    }
    return SHELVES[0] || { x: 640, y: 460 };
  }

  function wrapLift(spot) {
    return spot && spot.label === 'BOOTH' ? 96 : 28;
  }

  function offerWrap(sim) {
    if (!sim) return;
    if (!sim.pings) sim.pings = [];
    var open = 0;
    for (var i = 0; i < sim.pings.length; i++) {
      if (sim.pings[i].kind === 'wrap' && !sim.pings[i].dead) open++;
    }
    if (open >= 2) return;
    var spot = wrapSpot();
    var lift = wrapLift(spot);
    var liveWrap = sim.floorOn && sim.live && !sim.tenant;
    var fee = liveWrap ? (8 + Math.round(sim.rng() * 4)) : (28 + Math.round(sim.rng() * 24));
    sim.pings.push({ kind: 'wrap', x: spot.x, y: spot.y - lift, life: 22, pop: 1, dead: false, fee: fee });
  }

  function keepWrap(sim) {
    if (!sim || !sim.floorOn || !sim.live || sim.mechanic !== 'wrap' || sim.done) return;
    if (!sim.pings) sim.pings = [];
    var open = 0;
    for (var i = 0; i < sim.pings.length; i++) {
      if (sim.pings[i].kind === 'wrap' && !sim.pings[i].dead) open++;
    }
    if (open >= 1) return;
    if (sim._wrapQuietUntil && sim.t < sim._wrapQuietUntil) return;
    offerWrap(sim);
    if (sim._wrapCamUntil == null) sim._wrapCamUntil = sim.t + 14;
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
    sim._playerAct = 1;
    flashAt(sim, ping.x, ping.y);
    if (ping.kind === 'wrap') {
      var fee = ping.fee || 24;
      sim.sales += fee;
      sim.wraps = (sim.wraps || 0) + 1;
      sim._wrapCoachDone = true;
      sim._wrapAt = sim.t;
      sim._wrapQuietUntil = sim.t + 8;
      try { localStorage.setItem('hr_wrap_coach', '1'); } catch (eWrap) {}
      burstCoins(sim, ping.x, ping.y);
      floater(sim, ping.x, ping.y - 28, 'Wrapped +$' + fee, '#ffe08a', true);
      hooks.coin();
      markGoal(sim, ping.x, ping.y);
      return;
    }
    if (ping.kind === 'restock') {
      var restocked = deliverEveningTruck(sim);
      floater(sim, ping.x, ping.y - 28, restocked ? 'Truck called' : 'Truck already in', '#b6f0c8', true);
      if (restocked) note(sim, 'The late truck filled the back room.');
      return;
    }
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
    var ids = sim.crowd === 'gift'
      ? ['cust_kid', 'cust_mom', 'cust_kid', 'cust_grandpa']
      : ['cust_grandpa', 'cust_mom', 'cust_kid', 'cust_mom'];
    for (var i = 0; i < 4; i++) {
      var lined = liveLine(sim) ? queueSlot(sim, reg, Math.min(i, liveLineCap(sim) - 1)) : null;
      var spot = lined || { x: QUEUE[reg].x, y: QUEUE[reg].y + i * QUEUE[reg].dy };
      var c = makeActor(ids[i], spot.x, spot.y);
      c.kind = 'cust';
      if (sim.crowd === 'gift' && ids[i] === 'cust_mom') c.giftSprite = 'family';
      c.reg = reg;
      c.patience = 0.96;
      c.maxPatience = 1;
      applyKioskTune(sim, c);
      c.seq = sim.seq++;
      if (liveLine(sim) && i >= liveLineCap(sim)) {
        c.state = 'wait';
        c.waitSpot = waitPocket(c);
        c.x = c.waitSpot.x;
        c.y = c.waitSpot.y;
        c.qIndex = 0;
      } else {
        c.state = i === 0 ? 'checkout' : 'queue';
        c.qIndex = i;
        c.qx = spot.x;
        c.qy = spot.y;
        c.checkT = i === 0 ? 0.32 : null;
      }
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
      spawnMul: sim.spawnMul || 0,
      _mondayEase: sim._mondayEase ? 1 : 0,
      mechanic: sim.mechanic || '',
      crowd: sim.crowd || '',
      wraps: sim.wraps || 0,
      _playerAct: sim._playerAct ? 1 : 0,
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
      return { ok: true, msg: 'You are on ' + STATION_LABEL[worst] + '. Standing in covers that station for a short stretch.' };
    }
    if (name === 'freight') {
      spend();
      var hadTruck = sim.truck > 0;
      var calledTruck = 0;
      if (sim.floorOn && sim.live && !sim.tenant && backLeft(sim) <= 40) {
        calledTruck = addBackStock(sim, 0.28);
      }
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
      floater(sim, SPOTS.truck.x, SPOTS.truck.y - 20, calledTruck ? 'Truck called' : (hadTruck ? 'Unloaded' : 'Stocked'), '#ffe08a', true);
      flashAt(sim, SPOTS.truck.x, SPOTS.truck.y);
      if (calledTruck) note(sim, 'A truck is filling the back room.');
      return { ok: true, msg: calledTruck ? 'A truck is filling the back room.' : (hadTruck ? 'You cleared the truck.' : 'You stocked the shelf.') };
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
    if (!sim._pacePings && sim.pings && sim.pings.length) resolvePing(sim, sim.pings[0]);
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

  function floorSnapshot() {
    return {
      w: WORLD_W,
      h: WORLD_H,
      reg3: reg3Live,
      spots: JSON.parse(JSON.stringify(SPOTS)),
      queue: JSON.parse(JSON.stringify(QUEUE)),
      shelves: JSON.parse(JSON.stringify(SHELVES))
    };
  }

  function restoreFloor(snap) {
    WORLD_W = snap.w;
    WORLD_H = snap.h;
    reg3Live = snap.reg3;
    var key;
    for (key in SPOTS) if (Object.prototype.hasOwnProperty.call(SPOTS, key)) delete SPOTS[key];
    for (key in snap.spots) if (Object.prototype.hasOwnProperty.call(snap.spots, key)) SPOTS[key] = snap.spots[key];
    for (key in QUEUE) if (Object.prototype.hasOwnProperty.call(QUEUE, key)) delete QUEUE[key];
    for (key in snap.queue) if (Object.prototype.hasOwnProperty.call(snap.queue, key)) QUEUE[key] = snap.queue[key];
    SHELVES.length = 0;
    for (var i = 0; i < snap.shelves.length; i++) SHELVES.push(snap.shelves[i]);
  }

  function simulateLive(phone, wrapEvery) {
    var snap = floorSnapshot();
    try {
      if (HR.layout && HR.data && HR.data.get()) {
        HR.layout.apply(HR.data.get().layouts.kiosk, {
          spots: SPOTS,
          shelves: SHELVES,
          queue: QUEUE,
          setWorld: function (w, h) { WORLD_W = w; WORLD_H = h; },
          setReg3: function (on) { reg3Live = !!on; }
        });
      }
      var run = newRun('2026-10-24');
      run.day = 0;
      run.schedule[0] = greedy(run, 0);
      var sim = startDay(run);
      sim.live = true;
      sim.floorOn = true;
      sim._phone = !!phone;
      sim.mechanic = 'wrap';
      sim.crowd = 'gift';
      sim.spawnMul = 0.58 * 0.7;
      sim._mondayEase = 1;
      sim.goal = Math.max(900, Math.round((sim.goal || 0) * 0.54 * MONDAY_GOAL_MUL));
      sim.actions = sim.actionMax || (CONFIG.baseActions + 1);
      sim._pacePings = 1;
      primeShift(sim, run);
      var guard = 0;
      var every = wrapEvery == null ? 8 : wrapEvery;
      while (!sim.done && guard < 9000) {
        if (sim.pending) resolvePending(sim, run, smartChoice(sim.pending, sim));
        else if (sim.typeCard) dismissTypeCard(sim, run);
        else {
          driveActive(sim, run);
          if (sim.pings) {
            for (var pi = 0; pi < sim.pings.length; pi++) {
              var ping = sim.pings[pi];
              if (!ping || ping.dead) continue;
              if (ping.kind === 'wrap') {
                if ((sim._wrapTapAt || 0) <= sim.t) {
                  resolvePing(sim, ping);
                  sim._wrapTapAt = sim.t + every;
                }
              } else resolvePing(sim, ping);
            }
          }
        }
        step(sim, run, 0.1);
        guard++;
      }
      var row = scoreSnapshot(sim);
      row.done = sim.done;
      row.wraps = sim.wraps || 0;
      row.shiftStars = goalStars(row.goalPct);
      row.phone = !!phone;
      row.cogs = Math.round(sim.cogs || 0);
      row.baseGoal = Math.round((row.goal || 0) / MONDAY_GOAL_MUL);
      var tuned = kioskOneStarCosts(row.sales, row.cogs, row.payroll, 520, row.goalPct);
      row.profit = row.sales - tuned.cogs - tuned.wages - 520;
      return row;
    } finally {
      restoreFloor(snap);
    }
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
    if (!(t >= 0)) t = 0;
    var hours = 8 + (dur > 0 ? t / dur : 0) * 12;
    if (hours >= 20) hours = 19.99;
    var h = Math.floor(hours);
    var m = Math.floor((hours - h) * 60);
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(m) + ' ' + ap;
  }

  function clockMinutes(label) {
    var parsed = /^(\d+):(\d+) (AM|PM)$/.exec(label || '');
    if (!parsed) return 0;
    var hh = (+parsed[1]) % 12;
    if (parsed[3] === 'PM') hh += 12;
    return hh * 60 + (+parsed[2]);
  }

  function faceFromMinutes(mins) {
    if (!(mins >= 8 * 60)) mins = 8 * 60;
    var hh = Math.floor(mins / 60);
    var mm = mins % 60;
    var ap = hh >= 12 ? 'PM' : 'AM';
    var h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(mm) + ' ' + ap;
  }

  function liveClockFace(sim) {
    if (!sim) return '8:00 AM';
    var t = sim.t;
    if (!(t >= 0)) t = 0;
    if (sim._clockT == null || t > sim._clockT) sim._clockT = t;
    else if (t < sim._clockT) sim._clockBack = (sim._clockBack || 0) + 1;
    var face = clockLabel(sim._clockT, sim.duration || 62);
    var mins = clockMinutes(face);
    if (sim._clockMin == null || mins >= sim._clockMin) sim._clockMin = mins;
    else face = faceFromMinutes(sim._clockMin);
    return face;
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
    if (!HR.sprites) return loadPhotoArt(loadImage(ART + 'icons_ui.png8.png'), loadJSON(ART + 'icons_ui_atlas.json'), { ready: false, reason: 'empty', bytes: 0 });
    var types = HR.sprites.typesForDay(0, null);
    spriteSession = HR.sprites.createSession(ART, function () {});
    if (!HR.room) return loadPhotoArt(loadImage(ART + 'icons_ui.png8.png'), loadJSON(ART + 'icons_ui_atlas.json'), { ready: false, reason: 'empty', bytes: 0 });
    return spriteSession.loadManifest().then(function () {
      var shell = previewHas('kiosk') ? 'kiosk' : 'flagship';
      loadGoal = 12;
      return HR.room.load(ART, function () {
        if (typeof onAsset === 'function') onAsset();
      }, { critical: true, shell: shell, onList: function (n) { loadGoal = Math.max(1, n); } });
    }).then(function (objects) {
      return Promise.all([
        loadImage(ART + 'icons_ui.png8.png'),
        loadJSON(ART + 'icons_ui_atlas.json')
      ]).then(function (icons) {
        var shell = previewHas('kiosk') ? 'kiosk' : 'flagship';
        spriteSession.ensure(types).then(function (pack) {
          deliverArt('sprites', pack);
        }).catch(function () {});
        HR.room.load(ART, function () {}, { rest: true, shell: shell }).then(function (more) {
          if (more) deliverArt('objects', more);
        }).catch(function () {});
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
  function campaignPut(c) {
    if (root.__hrNoSave) return;
    writeJSON('hr_campaign_v1', c);
  }

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
    if (root.__hrNoSave) {
      bootToken = '';
      return;
    }
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

  function seedsFromSearch(search) {
    var match = /(?:\?|&)seed=([^&]*)/.exec(search || '');
    if (!match) return [];
    var raw = match[1];
    for (var n = 0; n < 2; n++) {
      if (raw.indexOf('%') < 0) break;
      try {
        var next = decodeURIComponent(raw);
        if (next === raw) break;
        raw = next;
      } catch (err) { break; }
    }
    return raw.toLowerCase().split(/[,+\s]+/).filter(Boolean);
  }

  function previewSeeds() {
    if (typeof location === 'undefined') return [];
    var host = (location.hostname || '').toLowerCase();
    if (host === 'cosmicgameshub.com' || host === 'www.cosmicgameshub.com') return [];
    var fromUrl = seedsFromSearch(location.search || '');
    if (fromUrl.length) {
      try { sessionStorage.removeItem('hr_preview_search'); } catch (eClear) {}
      return fromUrl;
    }
    var stashed = '';
    try {
      stashed = sessionStorage.getItem('hr_preview_search') || '';
      sessionStorage.removeItem('hr_preview_search');
    } catch (eStash) { stashed = ''; }
    return seedsFromSearch(stashed);
  }
  function previewHas(id) {
    var all = previewSeeds();
    for (var i = 0; i < all.length; i++) if (all[i] === id) return true;
    return false;
  }
  function previewSeed() {
    if (previewHas('kiosk')) return 'kiosk';
    var all = previewSeeds();
    return all.length ? all[0] : '';
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
    if (!root.__hrStorageHook && typeof Storage !== 'undefined') {
      root.__hrStorageHook = true;
      var storeProto = Storage.prototype;
      var origClear = storeProto.clear;
      var origRemove = storeProto.removeItem;
      storeProto.clear = function () {
        if (!root.__hrInternal) {
          root.__hrNoSave = true;
          bootToken = '';
        }
        return origClear.apply(this, arguments);
      };
      storeProto.removeItem = function (key) {
        if (!root.__hrInternal && (key === 'hr_boot' || key === 'hr_run_v1' || key === 'hr_meta_v1')) {
          if ((key === 'hr_run_v1' || key === 'hr_boot') && run && run._wrote) {
            try {
              root.__hrInternal = true;
              origRemove.call(this, 'hr_tut_done');
              origRemove.call(this, 'hr_campaign_v1');
            } catch (eTut) {}
            root.__hrInternal = false;
          } else if (key === 'hr_run_v1' || key === 'hr_boot') {
            try {
              root.__hrInternal = true;
              origRemove.call(this, 'hr_campaign_v1');
            } catch (eCamp) {}
            root.__hrInternal = false;
          }
          root.__hrNoSave = true;
          bootToken = '';
        }
        return origRemove.apply(this, arguments);
      };
    }
    armStorage();
    var staleScore = document.getElementById('hr-score');
    var staleFinal = document.getElementById('hr-final');
    if (staleScore) { staleScore.hidden = true; staleScore.innerHTML = ''; }
    if (staleFinal) staleFinal.hidden = true;
    var staleBody = document.getElementById('hr-final-body');
    if (staleBody) staleBody.innerHTML = '';

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
    placeEventCard();
    if (!document.getElementById('hr-feel-css')) {
      var feelCss = document.createElement('style');
      feelCss.id = 'hr-feel-css';
      feelCss.textContent = [
        '#hr-event.hr-inline{position:relative;inset:auto;left:auto;right:auto;top:auto;bottom:auto;height:auto;max-height:none;z-index:6;margin:4px 0 0;padding:0;background:transparent;display:block;pointer-events:none;overflow:visible;}',
        '#hr-event.hr-inline[hidden]{display:none !important;}',
        '#hr-event.hr-inline .hr-card{pointer-events:auto;width:100%;max-height:none;overflow:visible;padding:0.2rem 0.4rem 0.24rem;border-radius:12px;background:rgba(246,240,228,0.96);box-shadow:0 6px 16px rgba(0,0,0,0.28);box-sizing:border-box;display:flex;flex-direction:column;touch-action:pan-y;}',
        '#hr-event.hr-inline .hr-card h2{font-size:0.82rem;line-height:1.15;margin:0 0 0.08rem;}',
        '#hr-event.hr-inline .hr-card p{font-size:0.72rem;line-height:1.2;margin:0 0 0.12rem;display:block;overflow:visible;}',
        '#hr-event.hr-inline .hr-card__art{display:none;}',
        '#hr-event.hr-inline .hr-choices{flex-direction:row;flex-wrap:wrap;gap:4px;align-items:stretch;overflow:visible;touch-action:manipulation;}',
        '#hr-event.hr-inline .hr-choices button{width:auto;flex:1 1 140px;max-width:100%;height:auto;min-height:44px;font-size:0.78rem;padding:0.22rem 0.4rem;white-space:normal;line-height:1.2;align-items:center;background:#fff;background-image:none;color:#2b1d2e;border:2px solid #2b1d2e;overflow:visible;}',
        '#hr-event.hr-inline .hr-choices button span{flex:1 1 auto;min-width:0;white-space:normal;line-height:1.2;}',
        '#hr-event.hr-inline .hr-choice-cost{flex:0 0 auto;white-space:nowrap;}',
        '@media (max-width:720px){',
        '#hr-event.hr-inline{position:relative;inset:auto;margin:2px 0 0;z-index:7;display:block;overflow:visible;}',
        '#hr-event.hr-inline .hr-card{width:100%;padding:0.16rem 0.3rem 0.2rem;}',
        '#hr-event.hr-inline .hr-card h2{font-size:0.78rem;line-height:1.1;margin:0 0 0.06rem;}',
        '#hr-event.hr-inline .hr-card p{font-size:12px;line-height:1.15;margin:0 0 0.08rem;}',
        '#hr-event.hr-inline .hr-choices{flex-direction:row;flex-wrap:wrap;gap:4px;}',
        '#hr-event.hr-inline .hr-choices button{width:auto;flex:1 1 120px;min-height:44px;height:auto;font-size:0.75rem;padding:0.18rem 0.35rem;white-space:normal;line-height:1.15;background:#fff;background-image:none;color:#2b1d2e;border:2px solid #2b1d2e;overflow:visible;}',
        '}',
        '.hr-combo.is-idle{background:#3a2a18;color:#ffe7a3;box-shadow:inset 0 0 0 2px #e0a322;}',
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
    var cam = { x: 0, y: 0, follow: false, userPan: false };
    var labelSlots = [];
    var nameBudget = 1;
    var bodySlots = [];
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

    var shownSeeds = previewSeeds();
    els.seed.textContent = shownSeeds.length ? shownSeeds.join(', ') : ymd;
    if (els.stage && shownSeeds.length) els.stage.dataset.seed = shownSeeds.join(',');
    paintMeta();

    function paintMeta() {
      var m = metaGet();
      els.streak.textContent = String(m.streak);
      els.best.textContent = bestGet(ymd) ? String(bestGet(ymd)) : '—';
    }

    window.addEventListener('pageshow', function () {
      paintMeta();
      var savedRun = readJSON('hr_run_v1');
      if (savedRun && !root.__hrNoSave) return;
      var scoreOpen = els.score && !els.score.hidden;
      var finalOpen = els.final && !els.final.hidden;
      if (!scoreOpen && !finalOpen) return;
      if (els.score) { els.score.hidden = true; els.score.innerHTML = ''; }
      if (els.final) {
        els.final.hidden = true;
        var wipedBody = document.getElementById('hr-final-body');
        if (wipedBody) wipedBody.innerHTML = '';
      }
      renderMap();
    });

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
    function placeEventCard() {
      if (!els.event || !els.sim) return;
      var dock = document.getElementById('hr-toast-dock');
      if (dock && dock.parentNode === els.sim) {
        if (els.event.parentNode !== els.sim || els.event.nextSibling !== dock) els.sim.insertBefore(els.event, dock);
        return;
      }
      if (els.stage && els.event.parentNode !== els.stage) els.stage.appendChild(els.event);
    }

    function fitCardBox() {
      if (!els.event || !els.stage || els.event.hidden) return;
      var h = els.stage.clientHeight || 0;
      if (!(h > 0)) return;
      els.event.style.position = 'relative';
      els.event.style.inset = 'auto';
      els.event.style.background = 'transparent';
      els.event.style.pointerEvents = 'none';
      els.event.style.height = 'auto';
      els.event.style.maxHeight = 'none';
      els.event.style.overflow = 'visible';
      var card = els.event.querySelector('.hr-card');
      if (!card) return;
      card.style.pointerEvents = 'auto';
      card.style.height = 'auto';
      card.style.maxHeight = 'none';
      card.style.overflow = 'visible';
      card.style.boxSizing = 'border-box';
      var title = card.querySelector('h2');
      var body = card.querySelector('p');
      var choices = card.querySelector('.hr-choices');
      if (title) title.style.flex = '0 0 auto';
      if (body) {
        body.style.display = 'block';
        body.style.overflow = 'visible';
        body.style.maxHeight = 'none';
        body.style.webkitLineClamp = 'unset';
        body.style.whiteSpace = 'normal';
        body.style.flex = '0 0 auto';
      }
      if (choices) {
        choices.style.maxHeight = 'none';
        choices.style.overflow = 'visible';
        choices.style.flex = '0 0 auto';
      }
      var btns = choices ? choices.querySelectorAll('button') : [];
      for (var bi = 0; bi < btns.length; bi++) {
        var btn = btns[bi];
        btn.style.boxSizing = 'border-box';
        btn.style.height = 'auto';
        btn.style.minHeight = '44px';
        btn.style.maxHeight = 'none';
        btn.style.overflow = 'visible';
        btn.style.whiteSpace = 'normal';
        var label = btn.querySelector('span');
        if (label) {
          label.style.whiteSpace = 'normal';
          label.style.overflow = 'visible';
          label.style.height = 'auto';
          label.style.maxHeight = 'none';
        }
      }
      var limit = Math.max(72, Math.floor(h * 0.2));
      if (body && card.offsetHeight > limit) body.style.display = 'none';
      if (title && card.offsetHeight > limit) {
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
      }
      var clip = '0';
      var cardBox = card.getBoundingClientRect();
      var viewBottom = window.innerHeight || (cardBox.bottom + 1);
      for (var ci = 0; ci < btns.length; ci++) {
        var box = btns[ci].getBoundingClientRect();
        var span = btns[ci].querySelector('span');
        var textCut = span && (span.scrollWidth > span.clientWidth + 2 || span.scrollHeight > span.clientHeight + 2);
        var outside = box.bottom > cardBox.bottom + 1 || box.top < cardBox.top - 1 || box.right > cardBox.right + 1 || box.left < cardBox.left - 1;
        var offView = box.bottom > viewBottom + 1 || box.top < -1 || box.right > (window.innerWidth || box.right) + 1 || box.left < -1;
        if (textCut || outside || offView || box.height < 36) clip = '1';
      }
      if (isQA() && els.stage) {
        els.stage.dataset.cardCap = String(Math.round(card.offsetHeight));
        els.stage.dataset.cardClip = clip;
        els.stage.dataset.cardRatio = h ? String(Math.round((card.offsetHeight / h) * 100)) : '0';
      }
    }

    function placeToast() {
      if (!els.toast) return;
      var dock = document.getElementById('hr-toast-dock');
      var playing = els.sim && !els.sim.hidden && dock;
      if (playing) {
        if (els.toast.parentNode !== dock) dock.appendChild(els.toast);
        els.toast.style.bottom = '';
        els.toast.style.left = '';
        els.toast.style.transform = '';
      } else if (els.toast.parentNode !== document.body) {
        document.body.appendChild(els.toast);
        els.toast.style.bottom = '';
        els.toast.style.left = '';
        els.toast.style.transform = '';
      }
    }

    function playToast(ms) {
      if (!els.toast || !toastQueue.length) { toastOn = false; return; }
      toastOn = true;
      placeToast();
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
    function clearCloseToast() {
      toastQueue = [];
      if (!els.toast) return;
      els.toast.classList.remove('show');
      els.toast.textContent = '';
      clearTimeout(toastTimer);
      toastOn = false;
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

    function holdClearedRun() {
      root.__hrNoSave = true;
      bootToken = '';
      root.__hrInternal = true;
      try {
        localStorage.removeItem('hr_tut_done');
        localStorage.removeItem('hr_run_v1');
        localStorage.removeItem('hr_campaign_v1');
      } catch (eTut) {}
      root.__hrInternal = false;
    }

    function userClearedSave() {
      if (root.__hrNoSave) return true;
      try {
        if (bootToken && localStorage.getItem('hr_boot') !== bootToken) return true;
        if (run && run._wrote && localStorage.getItem('hr_run_v1') == null) return true;
        if (root.__hrSawTut && localStorage.getItem('hr_tut_done') !== '1') return true;
      } catch (eClear) { return true; }
      return false;
    }

    function saveRun() {
      if (userClearedSave()) {
        holdClearedRun();
        return;
      }
      if (!storageLive()) return;
      if (!run) return;
      if (sim && run.phase === 'sim' && !sim.done) {
        try { run.simState = exportSim(sim); } catch (e) { run.simState = null; }
      }
      writeJSON('hr_run_v1', run);
      try { if (localStorage.getItem('hr_run_v1')) run._wrote = 1; } catch (eWrote) {}
      try { if (localStorage.getItem('hr_tut_done') === '1') root.__hrSawTut = 1; } catch (eSaw) {}
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
      if (which !== 'score' && which !== 'perk' && els.score) els.score.innerHTML = '';
      if (which !== 'final') {
        var finalBody = document.getElementById('hr-final-body');
        if (finalBody) finalBody.innerHTML = '';
      }
      paintMeta();
      if (which !== 'sim') {
        els.event.hidden = true;
        els.modal.hidden = true;
        clearRefillNotice();
        clearCloseToast();
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

    function applyStoreTune(sim) {
      if (!sim || !books || !HR.data || !HR.data.get()) return;
      var pack = HR.data.get().layouts[books.active];
      if (!pack || books.active === 'mart') return;
      if (pack.goalMul) sim.goal = Math.max(900, Math.round((sim.goal || 0) * pack.goalMul));
      if (pack.spawnMul) sim.spawnMul = pack.spawnMul;
      if (pack.mechanic) sim.mechanic = pack.mechanic;
      sim.crowd = pack.crowd || '';
      var loc = books.locations[books.active];
      if (loc && books.active === 'kiosk' && !loc.leadId) loc.leadId = 'staff_reg1';
    }

    function applyMondayEase(sim) {
      if (!sim || !sim.floorOn || !run || sim.tenant || run.day !== 0 || sim._mondayEase) return;
      sim._mondayEase = 1;
      sim.goal = Math.max(900, Math.round((sim.goal || 0) * MONDAY_GOAL_MUL));
      sim.spawnMul = (sim.spawnMul || 1) * 0.7;
      var cap = sim.actionMax || (CONFIG.baseActions + 1);
      sim.actions = cap;
    }

    function activeStoreName() {
      var loc = books && books.locations && books.locations[books.active];
      return (loc && loc.name) || 'Holiday Rush Mart';
    }

    function activeLeadName() {
      var loc = books && books.locations && books.locations[books.active];
      if (loc && loc.leadId && HR.economy && HR.economy.nameOf) return HR.economy.nameOf(loc.leadId);
      return 'You';
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
        ensureOpeningStock(sim);
      }
      applyStoreTune(sim);
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
            ensureOpeningStock(sim);
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
        '<div class="hr-clock" id="hr-clock" style="--p:0"><span id="hr-clock-label"><b>8:00</b><small>AM</small></span></div>' +
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
        '<div class="hr-stockline" id="hr-stock-text">Shelf — · Back —</div>' +
        '<div class="hr-hud__tools">' +
        '<button type="button" id="hr-crew-btn" class="hr-mute">Crew</button>' +
        '<button type="button" id="hr-mute" class="hr-mute" aria-pressed="false" aria-label="Mute sound">Sound</button>' +
        '</div>';
      function actButton(name, label, icon) {
        return '<button type="button" data-act="' + name + '"><span class="hr-icon" style="' + iconStyle(icon, 28) + '" aria-hidden="true"></span><span>' + label + '</span></button>';
      }
      var actions = (sim.mechanic === 'wrap' ? actButton('wrap', 'Wrap', 'return') : '') +
        actButton('cover', 'Stand in', 'boss') +
        actButton('pull', 'Pull to register', 'line') +
        actButton('freight', 'Work freight', 'truck') +
        actButton('calm', 'Calm a customer', 'angry');
      els.sim.querySelector('.hr-hud').innerHTML = hud;
      els.sim.querySelector('.hr-actions').innerHTML = actions;
      sim.live = true;
      sim.floorOn = true;
      if (!sim.mechanic && !sim.tenant && books && HR.data && HR.data.get()) {
        var packNow = HR.data.get().layouts[books.active];
        if (packNow && packNow.mechanic) sim.mechanic = packNow.mechanic;
      }
      applyMondayEase(sim);
      if ((sim.pending || sim.typeCard) && sim._hold !== 'crew') armCardPause(sim);
      if (run._awayNote && run._awayNote.length) {
        toast(run._awayNote.map(firstName).join(', ') + ' is off this floor.');
        run._awayNote = [];
      }
      primeShift(sim, run);
      if (tutDone()) sim.coachHold = false;
      resize();
      if (sim.floorOn) {
        var seatRegs = registers();
        for (var sr = 0; sr < seatRegs.length; sr++) {
          var seatList = queueOf(sim, seatRegs[sr]);
          for (var si = 0; si < seatList.length; si++) {
            var seatAt = queueSlot(sim, seatRegs[sr], si);
            seatList[si].x = seatAt.x;
            seatList[si].y = seatAt.y;
            seatList[si].qx = seatAt.x;
            seatList[si].qy = seatAt.y;
          }
        }
      }
      fitOpenCamera();
      requestAnimationFrame(function () { resize(); if (sim && !els.sim.hidden) draw(); });
      if (!(sim.mechanic === 'wrap' && !(sim.wraps > 0) && !sim._playerAct)) focusCam(SPOTS.reg1.x, QUEUE.reg1.y);
      if (sim.tenant) sim.coachHold = false;
      if (!sim.tenant && !opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else if (!sim.tenant && opts.resume && run.day === 0 && !tutDone()) beginCoach();
      else paintCoach();
      paintHud();
      paintMute();
      if (sim.mechanic === 'wrap' && !opts.resume && !sim._wrapTold) {
        sim._wrapTold = true;
        toast('Plaza Kiosk. Tap the Wrap button when a gift is ready. Each gift adds to this drawer.', true);
      }
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
      paintWrapCoach();
      spacePhoneHud();
      var label = document.getElementById('hr-clock-label');
      var clock = document.getElementById('hr-clock');
      var salesText = document.getElementById('hr-sales-text');
      if (!label || !salesText) return;
      var face = liveClockFace(sim);
      var faceBits = face.split(' ');
      var faceTime = label.querySelector('b');
      var faceAmpm = label.querySelector('small');
      if (faceTime && faceAmpm) {
        faceTime.textContent = faceBits[0];
        faceAmpm.textContent = faceBits[1] || '';
      } else label.textContent = face;
      var rushing = !!(sim._qaRush || (sim._heat && sim._heat.rush && !sim.coachHold));
      if (clock) {
        clock.style.setProperty('--p', String(clamp(sim._clockT / sim.duration, 0, 1)));
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
      var stockText = document.getElementById('hr-stock-text');
      if (stockText) {
        var shelfPct = Math.round(clamp(sim.stock || 0, 0, 1) * 100);
        var backUnits = backLeft(sim);
        if (backUnits <= 0) shelfPct = 0;
        var stockLabel = backUnits <= 0
          ? 'Shelf empty · Back 0'
          : ('Shelf ' + shelfPct + '% · Back ' + backUnits);
        var callTruck = !!(sim.floorOn && !sim.tenant && backUnits <= 40);
        if (callTruck) stockLabel += ' · Call truck';
        stockText.textContent = stockLabel;
        var freightName = els.sim && els.sim.querySelector('[data-act="freight"] span:last-child');
        if (freightName && sim.floorOn && !sim.tenant) {
          var nextLabel = callTruck ? 'Call truck' : 'Work freight';
          if (freightName.textContent !== nextLabel) freightName.textContent = nextLabel;
        }
        var wrapBtn = els.sim && els.sim.querySelector('[data-act="wrap"]');
        if (wrapBtn) {
          var wrapReady = false;
          if (sim.pings) {
            for (var wr = 0; wr < sim.pings.length; wr++) {
              if (sim.pings[wr].kind === 'wrap' && !sim.pings[wr].dead) wrapReady = true;
            }
          }
          wrapBtn.classList.toggle('is-live', wrapReady);
          wrapBtn.setAttribute('aria-label', wrapReady ? 'Wrap the gift' : 'Wrap, waiting for a gift');
        }
      }
      if (els.toast && els.toast.classList.contains('show')) placeToast();
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
          els.stage.dataset.mechanic = (sim.tenant && sim.tenant.mechanic) || sim.mechanic || '';
          els.stage.dataset.goal = String(Math.round(sim.goal || 0));
          if (sim.wraps) els.stage.dataset.wraps = String(sim.wraps);
          els.stage.dataset.calendar = sim.calendarName || '';
        els.stage.dataset.clock = face;
        if (isQA()) els.stage.dataset.clockBack = String(sim._clockBack || 0);
        fitHud();
        paintWrapCoach();
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
            dirBits.push(dc.charId.replace('cust_', '') + '=' + spriteTypeFor(dc) + (dc.arch ? '/' + dc.arch : '') + ':' + dc.dir);
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
      var earnedStars = goalStars(sim.goal ? sim.sales / sim.goal : 0);
      var starEl = document.getElementById('hr-star-text');
      if (starEl) starEl.innerHTML = starGlyph(earnedStars);
      if (isQA() && els.stage) {
        els.stage.dataset.stars = String(earnedStars);
        els.stage.dataset.crowd = sim.crowd || '';
      }
      var act = document.getElementById('hr-actline');
      var crewBtn = document.getElementById('hr-crew-btn');
      if (crewBtn) crewBtn.hidden = !!coach;
      if (act) {
        var wideCoach = (els.canvas && els.canvas._cssW || window.innerWidth) >= 720;
        if (coach && wideCoach) {
          act.textContent = '';
        } else if (coach && coach.step === 1) {
          act.textContent = 'A truck is in. Work freight unloads it. The floor keeps moving.';
        } else if (coach) {
          act.textContent = 'Tutorial · clock is paused · step ' + (coach.step + 1) + ' of 3. Skip is there if you want the floor now.';
        } else {
          var maxA = sim.actionMax || CONFIG.baseActions;
          var regenSec = CONFIG.actionRegen / (1 + 0.28 * upgradeLevel(run, 'hustle'));
          if (sim._mondayEase) regenSec *= 0.45;
          var fill = sim.actions >= maxA ? 1 : clamp((sim.actionFrac || 0) / regenSec, 0, 1);
          act.textContent = sim.actions + ' / ' + maxA + ' actions · refills every ' + (Math.round(regenSec * 10) / 10) + 's' + (sim.actions < maxA ? ' · ' + Math.round(fill * 100) + '% to the next' : '');
        }
      }
      placeChrome();
    }

    function paintPromptTimer() {
      var bar = document.getElementById('hr-prompt-bar');
      if (!bar || !sim) return;
      var until = sim.pending ? sim.pendingUntil : sim.typeUntil;
      var total = sim.pending ? 7 : 5.5;
      var left = until ? (until - sim.t) / total : 1;
      bar.style.width = (Math.max(0, Math.min(1, left)) * 100) + '%';
    }

    var cardArmAt = 0;
    function armCardTap() {
      cardArmAt = (root.performance ? root.performance.now() : Date.now()) + 300;
    }
    function cardTapBlocked() {
      var now = root.performance ? root.performance.now() : Date.now();
      return now < cardArmAt;
    }

    function renderEvent() {
      var card = sim.pending;
      if (!card) { els.event.hidden = true; return; }
      rememberCardCam();
      armCardTap();
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
      els.event.innerHTML = '<div class="hr-card" role="region" aria-labelledby="hr-ev-title"><div class="hr-card__art">' + art + '</div><h2 id="hr-ev-title">' + esc(card.title) + '</h2><p>' + esc(card.body) + '</p><div class="hr-choices">' + buttons + '</div></div>';
      hooks.alert();
      paintPromptTimer();
      var choiceStartY = 0;
      var choiceBox = els.event.querySelector('.hr-choices');
      choiceBox.addEventListener('pointerdown', function (ev) {
        choiceStartY = ev.clientY;
        ev.stopPropagation();
      });
      choiceBox.addEventListener('pointerup', function (ev) {
        var btn = ev.target.closest('[data-choice]');
        if (!btn || btn.disabled) return;
        ev.stopPropagation();
        if (Math.abs(ev.clientY - choiceStartY) > 8) return;
        if (cardTapBlocked()) return;
        var res = resolvePending(sim, run, +btn.getAttribute('data-choice'));
        if (!res.ok) { toast(res.msg); sfx('miss'); return; }
        sfx('place');
        buzz(8);
        els.event.hidden = true;
        paintHud();
        draw();
      });
      if (els.live) els.live.textContent = card.title + '. ' + card.body + ' The shift is paused.';
      fitCardBox();
      requestAnimationFrame(function () { fitCardBox(); });
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
        var postCogs = sim.cogs || 0;
        var postWages = snap.payroll;
        var kioskMonday = sim.floorOn && !sim.tenant && run.day === 0 && books.active === 'kiosk';
        if (kioskMonday) {
          var rentNow = HR.economy.rentOf(books);
          var loanNow = 0;
          if (books.loan && books.loan.left > 0) loanNow = Math.min(books.loan.payment || 0, books.loan.remaining || 0);
          var leaseNow = HR.world && HR.world.income ? HR.world.income(books) : 0;
          var gatePct = snap.goalPct || 0;
          if (Math.round(gatePct * 100) >= 70 && !(gatePct >= 0.70)) gatePct = 0.70;
          var tunedCosts = kioskOneStarCosts(snap.sales, postCogs, postWages, rentNow + loanNow - leaseNow, gatePct);
          postCogs = tunedCosts.cogs;
          postWages = tunedCosts.wages;
        }
        var tape = HR.economy.closeShift(books, {
          sales: snap.sales,
          cogs: postCogs,
          wages: postWages,
          walkouts: snap.walkouts,
          checkouts: snap.checkouts,
          stockouts: sim.stockouts || 0,
          goalPct: snap.goalPct
        });
        if (!firstClose) books.cash = Math.round(books.cash - prevPost);
        else if (HR.world) {
          snap.background = HR.world.closeBackground(books, { day: run.day, ymd: run.ymd });
          if (snap.background) books.lastBackground = snap.background;
        }
        if (!firstClose && books.active && books.active !== 'mart' && books.lastBackground) {
          snap.background = books.lastBackground;
        }
        if (books.active && books.active !== 'mart') {
          snap.storeName = activeStoreName();
          snap.leadName = activeLeadName();
        }
        books.posted[postKey] = tape.profit;
        books.closed[postKey] = 1;
        if (HR.world && HR.world.claimDaily && run.ymd) {
          var daily = HR.world.claimDaily(books, run.ymd, {
            walkouts: snap.walkouts || 0,
            goalPct: snap.goalPct || 0,
            bestCombo: snap.bestCombo || 0
          });
          snap.daily = { claimed: !!daily.claimed, bonus: daily.bonus || 0, goal: daily.goal || null, reason: daily.reason || '' };
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
      rememberCardCam();
      els.event.classList.add('hr-inline');
      els.event.hidden = false;
      var art = '<span class="hr-portrait" style="' + portraitStyle(spec.who, 'impatient', 36) + '"></span><span class="hr-icon" style="' + iconStyle(card.icon, 36) + '"></span>';
      els.event.innerHTML = '<div class="hr-card" role="region" aria-labelledby="hr-type-title"><div class="hr-card__art">' + art + '</div><p class="hr-kicker">Week ' + (((run.day / 5) | 0) + 1) + '</p><h2 id="hr-type-title">' + esc(card.title) + '</h2><p>' + esc(card.body) + '</p><div class="hr-choices"><button type="button" id="hr-type-ok">Got it</button></div></div>';
      paintPromptTimer();
      armCardTap();
      document.getElementById('hr-type-ok').addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (cardTapBlocked()) return;
        var title = card.title;
        dismissTypeCard(sim, run);
        els.event.hidden = true;
        shownType = null;
        toast(title.replace('New shopper: ', '') + ' is on the floor.');
        sfx('place');
        saveRun();
      });
      if (els.live) els.live.textContent = card.title + '. ' + card.body + ' The shift is paused.';
      fitCardBox();
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
        (snap.storeName ? '<p class="hr-lead" id="hr-score-store">' + esc(snap.storeName) + '. ' + esc(snap.leadName || 'You') + ' ran this floor.</p>' : '') +
        (snap.background && snap.background.tapes && snap.background.tapes.length ? snap.background.tapes.map(function (row) {
          if (snap.storeName) return '<p class="hr-lead" id="hr-other-floor"><strong>Other floor.</strong> ' + esc(row.name) + ' posted ' + money(row.profit) + '.</p>';
          return '<p class="hr-fine">' + esc(row.name) + ' posted ' + money(row.profit) + (row.complaints && row.complaints[0] ? '. ' + esc(row.complaints[0]) : '.') + '</p>';
        }).join('') : '') +
        '<p class="hr-lead">Best combo ' + esc(comboBit) + ' · ' + (snap.walkouts || 0) + ' walkouts · ' + money(snap.sales) + ' / ' + money(snap.goal) + '</p>' +
        '<p class="hr-bank">' + (snap.tape ? money(snap.tape.profit) + ' profit' : (snap.earned > 0 ? '+' + money(snap.earned) + ' banked' : 'Register unchanged')) + ' · ' + money(snap.bank || 0) + ' in the register</p>' +
        '<p class="hr-fine">' + esc(bankCopy(snap)) + '</p>' +
        (snap.daily && snap.daily.claimed ? '<p class="hr-fine" id="hr-daily-bonus">Morning bonus ' + money(snap.daily.bonus) + ' for ' + esc(snap.daily.goal && snap.daily.goal.name) + '. Once a day.</p>' : '') +
        (snap.daily && !snap.daily.claimed && snap.daily.reason === 'already' ? '<p class="hr-fine" id="hr-daily-bonus">' + esc((snap.daily.goal && snap.daily.goal.name) || 'The morning bonus') + ' pays once a day. Already claimed.</p>' : '') +
        (snap.grumbles ? '<p class="hr-fine">Shoppers grumbled at the tag ' + snap.grumbles + ' time' + (snap.grumbles === 1 ? '' : 's') + '.</p>' : '') +
        (snap.tape && snap.tape.leaseIn ? '<p class="hr-fine">Mall rent collected ' + money(snap.tape.leaseIn) + '.</p>' : '') +
        (snap.tape && snap.tape.reviews ? snap.tape.reviews.map(function (line) { return '<p class="hr-fine">“' + esc(line) + '”</p>'; }).join('') : '') +
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
      paintMeta();
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
      html += '</div><div class="hr-cta"><button type="button" class="btn" id="hr-replay-tut">Replay tutorial</button><button type="button" class="btn" id="hr-map-shop">Upgrades</button></div>';
      els.map.innerHTML = html;
      els.map.querySelector('.hr-map').addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-shift]');
        if (!btn || btn.disabled) return;
        beginShift(+btn.getAttribute('data-shift'));
      });
      document.getElementById('hr-replay-tut').addEventListener('click', function () {
        root.__hrInternal = true;
        try { localStorage.removeItem('hr_tut_done'); } catch (eReplay) {}
        root.__hrInternal = false;
        root.__hrSawTut = 0;
        beginShift(0);
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
      var kiosk = books && books.active === 'kiosk' ? 1 : 0;
      return WORLD_W + 'x' + WORLD_H + ':' + band + ':' + (SPOTS.reg3 ? 1 : 0) + ':' + SHELVES.length + ':' + art + ':' + kiosk;
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
          archX: 1600,
          kiosk: !!(books && books.active === 'kiosk')
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
          worldH: WORLD_H,
          kiosk: !!(books && books.active === 'kiosk')
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
        g.save();
        g.translate(x, y);
        g.scale(0.64, 0.64);
        g.translate(-x, -y);
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
        g.font = '800 22px Outfit, Inter, sans-serif';
        g.textAlign = 'center';
        g.fillText(label, x, y - 124);
        g.restore();
      }
      var bayName = ['TOYS', 'TREATS', 'WRAP', 'CARDS'];
      for (var si = 0; si < SHELVES.length; si++) gondola(SHELVES[si].x, SHELVES[si].y, SHELVES[si].label || bayName[si] || 'AISLE');
      var boothShelf = null;
      for (var bi = 0; bi < SHELVES.length; bi++) if (SHELVES[bi].label === 'BOOTH') boothShelf = SHELVES[bi];
      function giftPile(px, py) {
        g.save();
        g.translate(px, py);
        g.fillStyle = 'rgba(42,24,18,0.22)';
        g.beginPath();
        g.ellipse(0, 16, 22, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = PAL.red;
        traceRound(g, -16, -8, 22, 18, 3);
        g.fill();
        g.fillStyle = PAL.green;
        traceRound(g, -2, -14, 20, 16, 3);
        g.fill();
        g.fillStyle = PAL.gold;
        traceRound(g, 6, -2, 16, 14, 3);
        g.fill();
        g.strokeStyle = PAL.cream;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-5, -8);
        g.lineTo(-5, 10);
        g.moveTo(-16, 1);
        g.lineTo(6, 1);
        g.moveTo(8, -14);
        g.lineTo(8, 2);
        g.moveTo(-2, -6);
        g.lineTo(18, -6);
        g.stroke();
        g.restore();
      }
      if (boothShelf) {
        giftPile(boothShelf.x - 150, boothShelf.y + 150);
        giftPile(boothShelf.x + 170, boothShelf.y + 130);
      }
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
      if (sim && sim.customers && sim.customers.length > 70) return 1;
      var cssW = els.canvas && els.canvas._cssW || 0;
      if (cssW >= 720) return 1;
      if (sim && sim._phone) return 2;
      return 1;
    }

    function layoutPhoneStage() {
      var stage = els.stage;
      if (!stage) return;
      var phone = (window.innerWidth || 0) < 720;
      if (!phone || !sim || !sim.floorOn || (els.sim && els.sim.hidden)) {
        if (stage.style.height) stage.style.height = '';
        if (stage.style.flex) stage.style.flex = '';
        stage._phoneH = 0;
        return;
      }
      var parent = stage.parentElement;
      if (!parent) return;
      var width = stage.clientWidth || parent.clientWidth;
      if (!(width > 0)) return;
      var frame = phoneStoreFrame();
      var ideal = width * (frame.bottom - frame.top) / Math.max(1, frame.right - frame.left);
      var others = 0;
      var kids = parent.children;
      for (var i = 0; i < kids.length; i++) {
        var kid = kids[i];
        if (kid === stage || kid.hidden) continue;
        var cs = window.getComputedStyle(kid);
        if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
        others += kid.offsetHeight;
      }
      var avail = parent.clientHeight - others;
      if (!(avail > 160)) avail = ideal;
      var next = Math.round(Math.max(200, Math.min(avail, ideal)));
      if (stage._phoneH === next) return;
      stage._phoneH = next;
      stage.style.flex = '0 0 auto';
      stage.style.height = next + 'px';
    }

    function resize() {
      layoutPhoneStage();
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
      if (sim) sim._phone = w < 720;
      if (els.stage) els.stage.dataset.hit = w < 720 ? '64' : '120';
      placeEventCard();
      placeToast();
      placeChrome();
      fitCardBox();
      fitHud();
    }

    function spacePhoneHud() {
      if (!sim || !sim._phone || !els.sim) return;
      var hud = els.sim.querySelector('.hr-hud');
      if (!hud) return;
      hud.style.columnGap = '4px';
      hud.style.gap = '4px';
      var stats = hud.querySelector('.hr-hud__stats');
      if (stats) stats.style.gap = '4px';
      var money = document.getElementById('hr-sales-text');
      var sales = hud.querySelector('.hr-sales');
      var combo = document.getElementById('hr-combo');
      var rush = document.getElementById('hr-rush');
      var crew = document.getElementById('hr-crew-btn');
      var mute = document.getElementById('hr-mute');
      function shown(el) {
        if (!el || el.hidden) return false;
        var cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      }
      function rightOf(el) {
        return el.getBoundingClientRect().right;
      }
      function leftOf(el) {
        return el.getBoundingClientRect().left;
      }
      if (mute) mute.hidden = false;
      if (rush && rush.style.display === 'none' && rush.classList.contains('is-on')) rush.style.display = '';
      if (sales && combo && shown(combo)) {
        var salesLeft = leftOf(sales);
        var limit = leftOf(combo) - 4 - salesLeft;
        var textW = money ? money.scrollWidth : 0;
        if (limit > textW + 8) sales.style.maxWidth = Math.floor(limit) + 'px';
        else sales.style.maxWidth = '';
      }
      if (mute) mute.hidden = false;
      var chips = [combo, rush, crew, mute];
      var prev = money;
      for (var i = 0; i < chips.length; i++) {
        var chip = chips[i];
        if (!shown(chip) || !prev) continue;
        var held = parseFloat(chip.style.marginLeft) || 0;
        var gap = leftOf(chip) - rightOf(prev) - held;
        chip.style.marginLeft = gap < 4 ? (4 - gap) + 'px' : '0px';
        prev = chip;
      }
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
      var rushOn = hud.querySelector('#hr-rush.is-on') ? 1 : 0;
      var key = [
        hud.clientWidth,
        salesLab ? salesLab.textContent : '',
        salesText ? salesText.textContent : '',
        rushOn,
        hud.querySelectorAll('.hr-combo:not([hidden]), #hr-tenant-name').length
      ].join('|');
      if (hud._fitKey === key) return;
      var extras = hud.querySelectorAll('.hr-hud__extra');
      var i;
      for (i = 0; i < extras.length; i++) extras[i].classList.remove('is-hud-off');
      var aisle = [];
      var other = [];
      for (i = 0; i < extras.length; i++) {
        if (extras[i].classList.contains('hr-stat--stars')) continue;
        if (extras[i].classList.contains('hr-aisle') || extras[i].querySelector('#hr-aisle-text')) aisle.push(extras[i]);
        else other.push(extras[i]);
      }
      var starExtras = [];
      for (i = 0; i < extras.length; i++) {
        if (extras[i].classList.contains('hr-stat--stars')) starExtras.push(extras[i]);
      }
      var hideOrder = ((hud.clientWidth || 0) < 720 ? starExtras : []).concat(aisle).concat(other);
      function crowded() {
        var tools = hud.querySelector('.hr-hud__tools');
        if (tools) {
          var tb = tools.getBoundingClientRect();
          var kids = hud.querySelectorAll('.hr-hud__stats > *');
          for (var k = 0; k < kids.length; k++) {
            var el = kids[k];
            if (el.classList.contains('is-hud-off')) continue;
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            var box = el.getBoundingClientRect();
            var sameRow = box.bottom > tb.top + 4 && box.top < tb.bottom - 4;
            if (sameRow && box.right > tb.left + 1) return true;
          }
        }
        return hud.scrollWidth > hud.clientWidth + 1;
      }
      for (i = hideOrder.length - 1; i >= 0 && crowded(); i--) hideOrder[i].classList.add('is-hud-off');
      hud._fitKey = key;
      spacePhoneHud();
      if (isQA() && els.stage) {
        var weekClip = !!(salesLab && salesLab.scrollWidth > salesLab.clientWidth + 1);
        var moneyClip = !!(salesText && salesText.scrollWidth > salesText.clientWidth + 1);
        els.stage.dataset.hudOverflow = crowded() ? '1' : '0';
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
      if (!stage) return;
      var stageBox = stage.getBoundingClientRect();
      if (stageBox.width < 8) return;
      var phonePlay = stageBox.width < 720 && sim && sim.floorOn;
      if (zoom) zoom.hidden = !!phonePlay;
      if (phonePlay) {
        ['hr-pan-left', 'hr-pan-right', 'hr-pan-up', 'hr-pan-down'].forEach(function (panId) {
          var pan = document.getElementById(panId);
          if (pan) pan.hidden = true;
        });
      }
      var bannerLow = false;
      if (stageBox.width < 720 && coach && coach.step === 1) bannerLow = true;
      var z = zoom && !zoom.hidden ? zoom.getBoundingClientRect() : null;
      var clearance = z && z.width >= 8 ? Math.round(stageBox.right - z.left + 8) : 8;
      if (skip) {
        if (bannerLow) {
          skip.style.top = 'auto';
          skip.style.bottom = '8px';
          skip.style.right = '8px';
        } else {
          skip.style.bottom = 'auto';
          skip.style.top = '8px';
          skip.style.right = (stageBox.width < 720 ? 8 : clearance) + 'px';
        }
      }
      if (!coachEl) {
        cacheBannerBottom();
        return;
      }
      var skipW = skip && !skip.hidden ? skip.offsetWidth + 8 : 0;
      if (bannerLow) {
        coachEl.style.top = 'auto';
        coachEl.style.bottom = '8px';
        coachEl.style.left = '8px';
        coachEl.style.right = (skipW + 8) + 'px';
      } else if (stageBox.width < 720) {
        coachEl.style.bottom = 'auto';
        coachEl.style.top = '8px';
        coachEl.style.left = '8px';
        coachEl.style.right = (skipW + 8) + 'px';
      } else {
        coachEl.style.bottom = 'auto';
        coachEl.style.top = '8px';
        coachEl.style.left = '8px';
        coachEl.style.right = (clearance + skipW) + 'px';
      }
      cacheBannerBottom();
    }

    function cacheBannerBottom() {
      var coachNode = document.getElementById('hr-coach');
      var canvas = els.canvas;
      root.__hrBannerBottom = 0;
      if (!coachNode || coachNode.hidden || !canvas) return;
      var coachBox = coachNode.getBoundingClientRect();
      var canvasBox = canvas.getBoundingClientRect();
      if (!(coachBox.height > 8) || !(canvasBox.height > 8)) return;
      if (coachBox.bottom <= canvasBox.top || coachBox.top >= canvasBox.bottom) return;
      var stageH = canvas._cssH || canvasBox.height;
      root.__hrBannerBottom = (coachBox.bottom - canvasBox.top) * (stageH / canvasBox.height);
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

    function fitOpenCamera() {
      var cssW = els.canvas._cssW || 0;
      cam.follow = false;
      if (!(cssW > 0) || cam.zoom > 0 || !HR.render) return;
      var cssH = els.canvas._cssH || 540;
      cam.zoom = HR.render.zoomMin(cssW, cssH);
    }

    function focusCam(x, y) {
      var view = viewSize();
      cam.x = clamp(x - view.viewW * 0.5, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(y - view.viewH * 0.62, 0, Math.max(0, WORLD_H - view.viewH));
    }

    function camClamp(x, y, view) {
      var maxX = WORLD_W - view.viewW;
      var maxY = WORLD_H - view.viewH;
      var nx = maxX < 0 ? maxX / 2 : clamp(x, 0, maxX);
      var ny = maxY < 0 ? maxY / 2 : clamp(y, 0, maxY);
      return { x: Math.round(nx), y: Math.round(ny) };
    }

    function wrapHoldZoom(cssW, cssH) {
      var wantW = cssW < 720 ? 460 : 540;
      var target = cssW < 520 ? 118 : (cssW < 900 ? 112 : 108);
      var z = CONFIG.sprite * cssW / target / wantW;
      if (HR.render && HR.render.clampZoom) z = HR.render.clampZoom(cssW, z, cssH);
      return z;
    }

    function phoneStoreFrame() {
      return { left: 96, top: 0, right: 1264, bottom: 900 };
    }

    function floorFit(cssW, cssH) {
      var worldW = WORLD_W || 1280;
      var phone = cssW < 720;
      var fit;
      if (phone) {
        var frame = phoneStoreFrame();
        var fw = Math.max(1, frame.right - frame.left);
        var fh = Math.max(1, frame.bottom - frame.top);
        fit = Math.min(cssW / fw, cssH / fh);
      } else {
        var fitW = cssW / Math.max(1, worldW);
        fit = Math.min(fitW, cssH / 800);
      }
      if (!(fit > 0.05)) fit = 0.05;
      return fit;
    }

    function playZoomFor(cssW, cssH) {
      if (sim && sim.floorOn && !cam.overview && !cam.fit) return floorFit(cssW, cssH);
      if (HR.render && HR.render.zoomMin) return HR.render.zoomMin(cssW, cssH);
      return cam.zoom || 1;
    }

    function wrapCamTarget(view) {
      var wrapAt = wrapSpot();
      var wrapY = wrapAt.y - wrapLift(wrapAt);
      return camClamp(wrapAt.x - view.viewW * 0.5, wrapY - view.viewH * 0.46, view);
    }

    function playCamTarget(view) {
      if (sim && sim.floorOn && !cam.overview) {
        var worldW = WORLD_W || 1280;
        var worldH = WORLD_H || 900;
        var cssW = view.cssW || (els.canvas && els.canvas._cssW) || 800;
        if (cssW < 720) {
          var frame = phoneStoreFrame();
          var frameX = frame.left + ((frame.right - frame.left) - view.viewW) / 2;
          var frameY = frame.top + ((frame.bottom - frame.top) - view.viewH) / 2;
          return camClamp(frameX, frameY, view);
        }
        if (cssW >= 720) {
          var fullRoom = view.viewW >= worldW - 16 && view.viewH >= worldH - 16;
          if (fullRoom) return camClamp((worldW - view.viewW) / 2, (worldH - view.viewH) / 2, view);
          var deskTruck = (SPOTS.truck && SPOTS.truck.y) || 130;
          var deskTop = 0;
          var deskBottom = ((SPOTS.reg1 && SPOTS.reg1.y) || 700) + 130;
          var cardOpen = !!(sim && (sim.pending || sim.typeCard));
          if (cardOpen) {
            var doorBottom = ((SPOTS.door && SPOTS.door.y) || (worldH - 45)) + 36;
            if (doorBottom > deskBottom) deskBottom = doorBottom;
          }
          var deskY = deskTop;
          if (deskTop + view.viewH < deskBottom) deskY = deskBottom - view.viewH;
          if (cardOpen) {
            var truckKeep = deskTruck - 16;
            if (truckKeep < 0) truckKeep = 0;
            if (deskY > truckKeep) deskY = truckKeep;
          } else if (deskY > deskTop) deskY = deskTop;
          if (deskY < 0) deskY = 0;
          return camClamp((worldW - view.viewW) / 2, deskY, view);
        }
      }
      var left = SPOTS.reg1 || { x: 420, y: 700 };
      var right = SPOTS.reg2 || left;
      var q = QUEUE.reg1 || { y: left.y + 70 };
      var midX = (left.x + right.x) * 0.5;
      var x = midX - view.viewW * 0.5;
      var rightKeep = right.x + 86 + 130;
      if (x + view.viewW < rightKeep) x = rightKeep - view.viewW;
      var leftKeep = left.x - 86 - 90;
      if (x > leftKeep) x = leftKeep;
      var y = q.y - view.viewH * 0.72;
      if (view.cssW < 720) {
        var gap = liveQueueGap({ _phone: true });
        var backY = left.y - (liveLineCap({ _phone: true }) - 1) * gap;
        y = backY - view.viewH * 0.38;
      } else {
        var doorY = SPOTS.door ? SPOTS.door.y : WORLD_H - 48;
        var doorKeep = doorY - view.viewH + 36;
        if (doorKeep < 0) doorKeep = 0;
        if (y < doorKeep) y = doorKeep;
      }
      return camClamp(x, y, view);
    }

    function stepEase() {
      if (!sim || !sim._ease) return false;
      var dur = 0.9;
      var u = dur > 0 ? ((sim.t || 0) - sim._ease.t0) / dur : 1;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var e = u * u * (3 - 2 * u);
      cam.x = Math.round(sim._ease.x0 + (sim._ease.x1 - sim._ease.x0) * e);
      cam.y = Math.round(sim._ease.y0 + (sim._ease.y1 - sim._ease.y0) * e);
      var z0 = sim._ease.z0 == null ? (cam.zoom || 1) : sim._ease.z0;
      var z1 = sim._ease.z1 == null ? z0 : sim._ease.z1;
      cam.zoom = z0 + (z1 - z0) * e;
      if (u >= 1) {
        cam.zoom = z1;
        var done = camClamp(sim._ease.x1, sim._ease.y1, viewSize());
        cam.x = done.x;
        cam.y = done.y;
        sim._camLock = { x: done.x, y: done.y, zoom: z1 };
        sim._ease = null;
      }
      return true;
    }

    function rememberCardCam() {
      if (!sim || sim._cardCam) return;
      sim._cardCam = {
        x: cam.x,
        y: cam.y,
        zoom: cam.zoom || 1,
        cssW: els.canvas._cssW || 0,
        cssH: els.canvas._cssH || 0
      };
    }

    function screenScale() {
      var view = viewSize();
      return view.cssW / Math.max(1, view.viewW);
    }

    function wrapLook() {
      var scale = Math.max(0.05, screenScale());
      var coaching = wrapCoachOn();
      var ringCss = coaching ? 84 : 76;
      var reach = ringCss + 46;
      var floor = coaching ? 156 : 120;
      if (reach < floor) reach = floor;
      var view = viewSize();
      return { scale: scale, ringCss: ringCss, wrapR: ringCss / scale, reach: reach, wordCss: 22, stageH: view.cssH || 0 };
    }

    function aimOnScreen(x, y, rWorld) {
      var view = viewSize();
      var scale = screenScale();
      var minR = 22 / Math.max(0.05, scale);
      if (rWorld < minR) rWorld = minR;
      var inset = rWorld + 12;
      var x0 = cam.x + inset;
      var y0 = cam.y + inset;
      var x1 = cam.x + view.viewW - inset;
      var y1 = cam.y + view.viewH - inset;
      if (x1 < x0) { x0 = cam.x + view.viewW * 0.5; x1 = x0; }
      if (y1 < y0) { y0 = cam.y + view.viewH * 0.35; y1 = y0; }
      return {
        x: Math.round(Math.min(x1, Math.max(x0, x))),
        y: Math.round(Math.min(y1, Math.max(y0, y))),
        r: rWorld
      };
    }

    function coachFocus() {
      if (!coach || !sim) return null;
      if (coach.step === 0) {
        var lineAim = aimOnScreen(SPOTS.reg1.x, QUEUE.reg1.y - 40, 52);
        lineAim.label = '1/3  Tap the line\nA cashier keeps the sale.';
        return lineAim;
      }
      if (coach.step === 1) return null;
      var angry = null;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        if (c.bubble === 'angry' || (c.maxPatience && c.patience < c.maxPatience * 0.4)) angry = c;
      }
      var calmAt = angry ? { x: angry.x, y: angry.y - 40 } : { x: SPOTS.floor.x, y: SPOTS.floor.y - 40 };
      var calmScale = Math.max(0.05, screenScale());
      var calmAim = aimOnScreen(calmAt.x, calmAt.y, Math.max(72, 88 / calmScale));
      calmAim.label = '3/3  Tap the upset shopper\nA calm keeps the star.';
      calmAim.cust = angry;
      return calmAim;
    }

    function wrapCoachOn() {
      if (!sim || coach || sim.mechanic !== 'wrap') return false;
      if (sim._wrapCoachDone || (sim.wraps || 0) > 0) return false;
      try {
        if (localStorage.getItem('hr_wrap_coach') === '1') return false;
      } catch (eWrapCoach) { return false; }
      return true;
    }

    function paintWrapCoach() {
      if (coach) return;
      var cap = document.getElementById('hr-coach');
      var hint = coachHint();
      if (!cap) return;
      if (!wrapCoachOn()) {
        if (cap.getAttribute('data-wrap') === '1') {
          cap.hidden = true;
          cap.removeAttribute('data-wrap');
        }
        if (hint && hint.dataset.wrap === '1') {
          delete hint.dataset.wrap;
          if (hint.dataset.coach !== '1') hint.textContent = hint.dataset.base || '';
        }
        return;
      }
      var text = 'Tap the Wrap button, or the WRAP ring on the gift table. Each gift rings this drawer.';
      cap.hidden = true;
      cap.removeAttribute('data-wrap');
      if (hint && hint.dataset.coach !== '1') {
        if (!hint.dataset.base) hint.dataset.base = hint.textContent;
        hint.dataset.wrap = '1';
        hint.textContent = text;
      }
    }

    function coachBlocksPlay() {
      return !!(coach && coach.step !== 1);
    }

    function coachLine() {
      if (!coach) return '';
      if (coach.step === 1) return '2/3  A truck is in\nWork freight unloads it. Keep playing.';
      var focus = coachFocus();
      return focus ? focus.label : '';
    }

    function coachHint() {
      return document.querySelector('#hr-sim .hr-hint');
    }

    function paintCoach() {
      var cap = document.getElementById('hr-coach');
      var skip = document.getElementById('hr-skip');
      var hint = coachHint();
      var line = coachLine();
      if (hint && !hint.dataset.base) hint.dataset.base = hint.textContent;
      if (line) {
        if (cap) cap.hidden = true;
        if (hint) {
          hint.dataset.coach = '1';
          hint.textContent = line.replace(/\n+/g, ' ');
        }
      } else {
        if (hint && hint.dataset.coach === '1') {
          delete hint.dataset.coach;
          hint.textContent = hint.dataset.base || '';
        }
        if (cap && cap.getAttribute('data-wrap') !== '1') cap.hidden = true;
      }
      if (skip) skip.hidden = !coach;
      placeChrome();
      if (sim) sim.coachHold = coachBlocksPlay();
      if (line && els.live) els.live.textContent = line + '. Skip is available.';
      paintWrapCoach();
    }

    function stashOpenCard() {
      if (!sim) return;
      if (sim.pending && !sim._stashedCard) {
        sim._stashedCard = { card: sim.pending, seconds: Math.max(4, (sim.pendingUntil || sim.t) - sim.t) };
      }
      sim.pending = null;
      sim.pendingUntil = 0;
      if (sim.typeCard) {
        sim._stashedType = sim.typeCard;
        sim.typeCard = '';
      }
      if (sim._hold === 'card') {
        sim._hold = '';
        sim.paused = false;
      }
      shownEvent = null;
      shownType = null;
      if (els.event) els.event.hidden = true;
    }

    function releaseStashedCard() {
      if (!sim) return;
      var held = sim._stashedCard;
      var heldType = sim._stashedType;
      sim._stashedCard = null;
      sim._stashedType = '';
      if (held && held.card) openPending(sim, held.card, held.seconds || 8);
      else if (heldType) {
        sim.typeCard = heldType;
        sim.typeUntil = sim.t + 5.5;
        armCardPause(sim);
      }
    }

    function beginCoach() {
      if (!sim || tutDone() || run.day !== 0) {
        coach = null;
        paintCoach();
        return;
      }
      coach = { step: 0 };
      sim.coachHold = true;
      sim.tutorial = true;
      stashOpenCard();
      paintCoach();
      focusCam(SPOTS.reg1.x, QUEUE.reg1.y);
    }

    function endCoach() {
      coach = null;
      if (sim) {
        sim.coachHold = false;
        sim.tutorial = false;
        sim.nextPing = sim.t + 3;
      }
      try { localStorage.setItem('hr_tut_done', '1'); root.__hrSawTut = 1; } catch (e) {}
      paintCoach();
      cam.follow = false;
      if (sim) releaseStashedCard();
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
        coach.until = (sim.t || 0) + 6;
      } else if (coach.step === 2) angerSomeone();
      else {
        toast('Floor is yours. Chain checkouts for a combo.');
        endCoach();
      }
      var next = coach && coach.step !== 1 ? coachFocus() : null;
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
        sim._playerAct = 1;
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
      if (!root.__hrSaveSoon) {
        root.__hrSaveSoon = true;
        requestAnimationFrame(function () {
          root.__hrSaveSoon = false;
          saveRun();
        });
      }
    }

    function pointerScale(rect) {
      var view = viewSize();
      var w = rect && rect.width ? rect.width : view.cssW;
      var h = rect && rect.height ? rect.height : view.cssH;
      return {
        x: w / Math.max(1, view.viewW),
        y: h / Math.max(1, view.viewH)
      };
    }

    function eventWorld(ev) {
      var rect = els.canvas.getBoundingClientRect();
      var scale = pointerScale(rect);
      return {
        x: (ev.clientX - rect.left) / scale.x + cam.x,
        y: (ev.clientY - rect.top) / scale.y + cam.y
      };
    }

    function screenDist(wx, wy, ev) {
      var rect = els.canvas.getBoundingClientRect();
      var scale = pointerScale(rect);
      var sx = (wx - cam.x) * scale.x + rect.left;
      var sy = (wy - cam.y) * scale.y + rect.top;
      var dx = ev.clientX - sx;
      var dy = ev.clientY - sy;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function worldDist(wx, wy, ev) {
      var w = eventWorld(ev);
      var dx = w.x - wx;
      var dy = w.y - wy;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function bodyPoint(a) {
      var x = a && a._drawX != null ? a._drawX : a.x;
      var y = a && a._drawY != null ? a._drawY : a.y;
      return { x: x, y: y - Math.round(personDrawH() * 0.42) };
    }

    function ringPoint(a) {
      return { x: a.x, y: a.y - personDrawH() - 28 };
    }

    function queuedReach(phoneHit) {
      var view = viewSize();
      var scale = view.cssW / Math.max(1, view.viewW);
      var gapPx = liveQueueGap(sim) * scale;
      var cap = phoneHit ? 46 : 64;
      var reach = Math.floor(gapPx * 0.4);
      if (reach < 28) reach = 28;
      if (reach > cap) reach = cap;
      return reach;
    }

    function pickHit(ev) {
      var phoneHit = (els.canvas._cssW || window.innerWidth) < 720;
      var minTap = 44;
      if (coach && coach.step === 2) {
        var calmFocus = coachFocus();
        var calmWho = calmFocus && calmFocus.cust;
        if (!calmWho) {
          for (var ci = 0; ci < sim.customers.length; ci++) {
            var calmCand = sim.customers[ci];
            if (calmCand.dead || calmCand.state === 'leave') continue;
            if (calmCand.bubble === 'angry' || (calmCand.maxPatience && calmCand.patience < calmCand.maxPatience * 0.4)) {
              calmWho = calmCand;
              break;
            }
          }
        }
        if (calmWho) {
          var calmBody = bodyPoint(calmWho);
          var calmD = screenDist(calmBody.x, calmBody.y, ev);
          var calmRing = screenDist(calmWho.x, calmWho.y - 40, ev);
          if (calmRing < calmD) calmD = calmRing;
          if (calmFocus && screenDist(calmFocus.x, calmFocus.y, ev) < calmD) calmD = screenDist(calmFocus.x, calmFocus.y, ev);
          if (calmD <= 180) return { cust: calmWho };
        }
      }
      if (sim.pings) {
        var wrapHit = null;
        var look = wrapLook();
        var wrapD = look.reach;
        var restockHit = null;
        var restockD = phoneHit ? 120 : 72;
        for (var wpi = 0; wpi < sim.pings.length; wpi++) {
          var wrapPing = sim.pings[wpi];
          if (!wrapPing || wrapPing.dead) continue;
          if (wrapPing.kind === 'wrap') {
            var wd = screenDist(wrapPing.x, wrapPing.y, ev);
            if (wd <= wrapD) { wrapD = wd; wrapHit = wrapPing; }
          } else if (wrapPing.kind === 'restock') {
            var rd = screenDist(wrapPing.x, wrapPing.y, ev);
            var shelfD = screenDist(wrapPing.x, wrapPing.y + 96, ev);
            if (shelfD < rd) rd = shelfD;
            if (rd <= restockD) { restockD = rd; restockHit = wrapPing; }
          }
        }
        if (wrapHit) return { ping: wrapHit };
        if (restockHit) return { ping: restockHit };
      }
      var lineReach = queuedReach(phoneHit);
      var best = null;
      var bestD = phoneHit ? 64 : 120;
      for (var i = 0; i < sim.customers.length; i++) {
        var c = sim.customers[i];
        if (c.dead || c.state === 'leave') continue;
        var at = bodyPoint(c);
        var queued = c.state === 'queue' || c.state === 'checkout';
        var reach = queued && sim && sim.floorOn ? lineReach : (phoneHit ? 64 : 120);
        var d = screenDist(at.x, at.y, ev);
        if (phoneHit && !queued) {
          var ringAt = ringPoint(c);
          var rd = screenDist(ringAt.x, ringAt.y, ev);
          if (rd < d) d = rd;
        }
        if (d < reach && d < bestD) { bestD = d; best = { cust: c }; }
      }
      if (best) return best;
      if (sim.pings) {
        var pingHit = null;
        var pingD = phoneHit ? 48 : 1e9;
        for (var p = 0; p < sim.pings.length; p++) {
          var ping = sim.pings[p];
          if (ping.dead) continue;
          var reach = Math.max(minTap, phoneHit ? 48 : (ping.kind === 'wrap' ? 72 : 56));
          var pd = screenDist(ping.x, ping.y, ev);
          if (pd < reach && pd < pingD) { pingD = pd; pingHit = ping; }
        }
        if (pingHit) return { ping: pingHit };
      }
      var zones = [
        { station: 'freight', x: SPOTS.truck.x, y: SPOTS.truck.y - 24 },
        { station: 'floor', x: SPOTS.floor.x, y: SPOTS.floor.y }
      ];
      registers().forEach(function (reg) {
        zones.unshift({ station: reg, x: SPOTS[reg].x, y: (SPOTS[reg].y + QUEUE[reg].y) * 0.5 });
      });
      var zone = null;
      var zoneD = Math.max(minTap, phoneHit ? 44 : 72);
      for (var z = 0; z < zones.length; z++) {
        var dist = screenDist(zones[z].x, zones[z].y, ev);
        if (dist < zoneD) { zoneD = dist; zone = zones[z]; }
      }
      return zone;
    }

    function onStageTap(ev) {
      if (!sim || els.sim.hidden) return;
      if (cardTapBlocked()) return;
      markInput();
      if (isQA() && els.stage && ev) els.stage.dataset.pointer = ev.pointerType || '';
      var w = eventWorld(ev);
      focusLabel(ev);
      var hit = pickHit(ev);
      if (hit && hit.ping) {
        tapFx(sim, hit.ping.x, hit.ping.y);
        flashAt(sim, hit.ping.x, hit.ping.y);
        hooks.tap();
        hooks.coin();
        resolvePing(sim, hit.ping);
        paintHud();
        if (!root.__hrSaveSoon) {
          root.__hrSaveSoon = true;
          requestAnimationFrame(function () {
            root.__hrSaveSoon = false;
            saveRun();
          });
        }
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

    function tagPx() {
      var view = viewSize();
      var scale = view.cssW / Math.max(1, view.viewW);
      var px = Math.round(18 / Math.max(0.22, scale));
      if (px < 18) px = 18;
      if (px > 46) px = 46;
      return px;
    }

    function drawTag(text, x, y) {
      var px = tagPx();
      var h = Math.round(px * 1.15);
      ctx.font = '800 ' + px + 'px Outfit, Inter, sans-serif';
      ctx.textAlign = 'center';
      var w = ctx.measureText(text).width + Math.round(px * 0.8);
      var left = cam.x + 4;
      var right = cam.x + (frameView.w || 0) - 4;
      var top = cam.y + 4;
      var bottom = cam.y + (frameView.h || 0) - 4;
      if (right > left) {
        if (x - w / 2 < left) x = left + w / 2;
        if (x + w / 2 > right) x = right - w / 2;
      }
      if (bottom > top) {
        if (y - h + 4 < top) y = top + h - 4;
        if (y + 2 > bottom) y = bottom - 2;
      }
      ctx.fillStyle = 'rgba(20,12,16,0.88)';
      ctx.fillRect(x - w / 2, y - h + 4, w, h);
      ctx.fillStyle = '#f6f0e4';
      ctx.fillText(text, x, y);
    }

    function actorKey(a) {
      if (!a) return '';
      if (a.kind === 'staff' || a.kind === 'you') return a.kind + ':' + (a.id || a.seq || '');
      return (a.kind || 'a') + ':' + (a.seq != null ? a.seq : (a.charId || ''));
    }

    function nameVisible(a) {
      if (!a || !sim) return false;
      var key = actorKey(a);
      if (!key) return false;
      if (sim._hoverKey) return sim._hoverKey === key;
      return sim._labelKey === key && sim.t < (sim._labelUntil || 0);
    }

    function nearestLabeled(ev) {
      if (!sim) return null;
      var phoneHit = (els.canvas._cssW || window.innerWidth) < 720;
      var lineReach = queuedReach(phoneHit);
      var best = null;
      var bestD = phoneHit ? 64 : 120;
      function consider(a) {
        if (!a || a.dead || a.hidden || a.state === 'leave' || a.kind === 'jack') return;
        var at = bodyPoint(a);
        var queued = a.state === 'queue' || a.state === 'checkout';
        var reach = queued && sim && sim.floorOn ? lineReach : (phoneHit ? 64 : 120);
        var d = screenDist(at.x, at.y, ev);
        if (phoneHit && !queued) {
          var ringAt = ringPoint(a);
          var rd = screenDist(ringAt.x, ringAt.y, ev);
          if (rd < d) d = rd;
        }
        if (d < reach && d < bestD) { bestD = d; best = a; }
      }
      var i;
      for (i = 0; i < sim.customers.length; i++) consider(sim.customers[i]);
      for (i = 0; i < sim.staff.length; i++) consider(sim.staff[i]);
      if (sim.you) consider(sim.you);
      return best;
    }

    function worldKeyAt(ev) {
      if (!sim || !ev) return '';
      var best = '';
      var bestD = 56;
      var i;
      if (sim.pings) {
        for (i = 0; i < sim.pings.length; i++) {
          var ping = sim.pings[i];
          if (ping.dead) continue;
          var d = screenDist(ping.x, ping.y, ev);
          if (d < bestD) { bestD = d; best = 'ping:' + i; }
        }
      }
      var regs = registers();
      for (i = 0; i < regs.length; i++) {
        if (queueOf(sim, regs[i]).length < 3) continue;
        var dLine = screenDist(SPOTS[regs[i]].x, SPOTS[regs[i]].y - 112, ev);
        if (dLine < bestD) { bestD = dLine; best = 'line:' + regs[i]; }
      }
      if (sim.truck) {
        var dTruck = screenDist(SPOTS.truck.x, SPOTS.truck.y - 24, ev);
        if (dTruck < bestD) { bestD = dTruck; best = 'truck'; }
      }
      if (sim.stock < 0.34 && SHELVES[0]) {
        var dStock = screenDist(SHELVES[0].x, SHELVES[0].y - 78, ev);
        if (dStock < bestD) best = 'stock';
      }
      return best;
    }

    function labelOn(key) {
      if (!sim || !key) return false;
      if (sim._hoverKey === key) return true;
      return sim._labelKey === key && sim.t < (sim._labelUntil || 0);
    }

    function focusLabel(ev) {
      if (!sim || !ev) return;
      var who = nearestLabeled(ev);
      var key = who ? actorKey(who) : worldKeyAt(ev);
      if (!key) return;
      sim._labelKey = key;
      sim._labelUntil = sim.t + 6;
    }

    function tagBlocked(x, y, tw, h) {
      var pad = Math.ceil(8 / Math.max(0.2, screenScale()));
      var i;
      for (i = 0; i < labelSlots.length; i++) {
        var slot = labelSlots[i];
        var sw = slot.w || tw;
        var sh = slot.h || h;
        if (Math.abs(slot.x - x) < (sw + tw) * 0.5 + pad && Math.abs(slot.y - y) < (sh + h) * 0.5 + pad) return true;
      }
      for (i = 0; i < bodySlots.length; i++) {
        var body = bodySlots[i];
        var top = y - h;
        var bottom = y + 2;
        if (Math.abs(body.x - x) < body.hw + tw * 0.5 + pad && bottom + pad > body.top && top < body.bottom + pad) return true;
      }
      return false;
    }

    function tagAnchor(x, y, text) {
      var px = tagPx();
      var h = Math.round(px * 1.15);
      var label = text || 'Family';
      ctx.font = '800 ' + px + 'px Outfit, Inter, sans-serif';
      var tw = Math.ceil(ctx.measureText(label).width);
      var placedX = x;
      var placedY = y;
      var guard = 0;
      var found = false;
      var shifts = [0, -1, 1, -2, 2];
      while (guard < 14 && !found) {
        for (var s = 0; s < shifts.length; s++) {
          var tx = x + shifts[s] * Math.round(tw * 0.6 + 8);
          var ty = y - guard * (h + 8);
          if (!tagBlocked(tx, ty, tw, h)) {
            placedX = tx;
            placedY = ty;
            found = true;
            break;
          }
        }
        guard++;
      }
      if (!found) placedY = y - guard * (h + 8);
      labelSlots.push({ x: placedX, y: placedY, w: tw, h: h, text: label });
      return { x: placedX, y: placedY };
    }

    function staffTagPoint(a, text) {
      return tagAnchor(a.x, a.y - personDrawH() - 28, text || 'Name');
    }

    function drawPatience(x, y, p) {
      var view = viewSize();
      var scale = view.cssW / Math.max(1, view.viewW);
      var r = Math.round(16 / Math.max(0.2, scale));
      if (r < 18) r = 18;
      if (r > 40) r = 40;
      ctx.lineWidth = Math.max(5, Math.round(r * 0.28));
      ctx.strokeStyle = 'rgba(246,240,228,0.35)';
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
      if (isQA() && els.stage) {
        delete els.stage.dataset.wrapX;
        delete els.stage.dataset.wrapY;
        delete els.stage.dataset.wrapR;
      }
      if (!sim.pings || root.__hrShot) return;
      for (var i = 0; i < sim.pings.length; i++) {
        var ping = sim.pings[i];
        if (ping.dead) continue;
        var bob = reduceMotion ? 0 : Math.sin(Date.now() / 200 + i) * 4;
        var icon = ping.kind === 'wrap' ? 'return' : ping.kind === 'basket' ? 'price' : ping.kind === 'box' ? 'truck' : 'line';
        var label = ping.kind === 'wrap' ? 'Wrap' : ping.kind === 'basket' ? '+$' : ping.kind === 'box' ? 'Box' : 'Help';
        if (ping.kind === 'wrap') {
          var look = wrapLook();
          var coaching = wrapCoachOn();
          var pulse = coaching && !reduceMotion ? 1.05 + Math.sin(Date.now() / 160) * 0.08 : 1;
          if (isQA() && els.stage) {
            els.stage.dataset.wrapR = String(Math.round(look.ringCss));
            els.stage.dataset.wrapHit = String(look.reach);
            els.stage.dataset.wrapWord = 'Wrap?';
            els.stage.dataset.wrapX = String(Math.round(ping.x));
            els.stage.dataset.wrapY = String(Math.round(ping.y));
          }
          var dpr = els.canvas._dpr || 1;
          var sx = (ping.x - cam.x) * look.scale;
          var sy = (ping.y + bob - cam.y) * look.scale;
          var fitCss = look.ringCss;
          if (sy - fitCss < 8) fitCss = Math.max(40, sy - 8);
          if (sy + fitCss > look.stageH - 8) fitCss = Math.max(40, look.stageH - sy - 8);
          ctx.save();
          ctx.strokeStyle = 'rgba(224,163,34,0.95)';
          ctx.lineWidth = (coaching ? 5 : 4) / look.scale;
          ctx.beginPath();
          ctx.arc(ping.x, ping.y + bob, (fitCss / look.scale) * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          drawIconAt(icon, ping.x, ping.y + bob, (Math.min(34, fitCss * 0.5) / look.scale) * pulse);
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '800 ' + look.wordCss + 'px Outfit, Inter, sans-serif';
          var pillH = look.wordCss + 8;
          var aboveY = sy - fitCss - 16;
          var belowY = sy + fitCss + 16;
          if (aboveY - pillH / 2 < 4) aboveY = Math.max(pillH / 2 + 2, sy - Math.min(fitCss * 0.62, Math.max(0, sy - pillH)));
          if (belowY + pillH / 2 > look.stageH - 4) belowY = look.stageH - 4 - pillH / 2;
          var coachEl = document.getElementById('hr-coach');
          var bannerBottom = root.__hrBannerBottom || 0;
          if (coachEl && !coachEl.hidden && bannerBottom > 0) {
            var minAbove = bannerBottom + 4 + pillH / 2;
            if (aboveY < minAbove) aboveY = minAbove;
          }
          if (belowY - aboveY < pillH + 4) belowY = aboveY + pillH + 4;
          var pills = [['Wrap?', aboveY], ['WRAP', belowY]];
          for (var wp = 0; wp < pills.length; wp++) {
            var pillW = ctx.measureText(pills[wp][0]).width + 16;
            var pillY = pills[wp][1];
            ctx.fillStyle = 'rgba(43,29,46,0.94)';
            ctx.fillRect(sx - pillW / 2, pillY - pillH / 2, pillW, pillH);
            ctx.fillStyle = '#ffe08a';
            ctx.fillText(pills[wp][0], sx, pillY);
          }
          ctx.restore();
          continue;
        }
        if (ping.kind === 'restock') {
          var restockPhone = (els.canvas._cssW || 800) < 720;
          var restockScale = Math.max(0.05, screenScale());
          var restockR = Math.max(56, (restockPhone ? 78 : 54) / restockScale);
          ctx.save();
          ctx.strokeStyle = 'rgba(47,158,87,0.95)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(ping.x, ping.y + bob, restockR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          drawIconAt('truck', ping.x, ping.y + bob, 52);
          var truckAt = tagAnchor(ping.x, ping.y + bob - restockR - 18);
          drawTag('Call truck', truckAt.x, truckAt.y);
          continue;
        }
        ctx.strokeStyle = 'rgba(224,163,34,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ping.x, ping.y + bob, 26, 0, Math.PI * 2);
        ctx.stroke();
        drawIconAt(icon, ping.x, ping.y + bob, 36);
        if (labelOn('ping:' + i)) {
          var pingAt = tagAnchor(ping.x, ping.y + bob - 36);
          drawTag(label, pingAt.x, pingAt.y);
        }
      }
    }

    function drawTrouble() {
      if (root.__hrShot) return;
      var regs = registers();
      for (var i = 0; i < regs.length; i++) {
        var n = queueOf(sim, regs[i]).length;
        if (n >= 3) {
          drawIconAt('line', SPOTS[regs[i]].x, SPOTS[regs[i]].y - 112, 44);
          if (labelOn('line:' + regs[i])) {
            var lineAt = tagAnchor(SPOTS[regs[i]].x, SPOTS[regs[i]].y - 142);
            drawTag('Line ' + n, lineAt.x, lineAt.y);
          }
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
        ctx.arc(SPOTS.truck.x, SPOTS.truck.y - 24, Math.max(30, 22 / Math.max(0.05, screenScale())), 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.arc(SPOTS.truck.x, SPOTS.truck.y - 24, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
        ctx.stroke();
        if (labelOn('truck') || (coach && coach.step === 1)) {
          var truckAt = tagAnchor(SPOTS.truck.x, SPOTS.truck.y - 68);
          drawTag(fp > 0.35 ? left.toFixed(1) + 's' : 'Unload', truckAt.x, truckAt.y);
        }
      }
      if (sim.stock < 0.34) {
        drawIconAt('outstock', SHELVES[0].x, SHELVES[0].y - 78, 40);
        if (labelOn('stock')) {
          var stockAt = tagAnchor(SHELVES[0].x, SHELVES[0].y - 108);
          drawTag('Low stock', stockAt.x, stockAt.y);
        }
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
      els.stage.dataset.coachR = String(Math.round((focus.r || 48) * scale));
      els.stage.dataset.coach = String(coach.step);
    }

    function viewSize() {
      var floorLive = !!(sim && sim.floorOn && !cam.overview && !cam.fit);
      var frozen = !floorLive && sim && sim._cardCam && sim._cardCam.cssW;
      var cssW = frozen ? sim._cardCam.cssW : (els.canvas._cssW || 800);
      var cssH = frozen ? sim._cardCam.cssH : (els.canvas._cssH || 450);
      if (sim && sim.floorOn && !cam.overview && !cam.fit) {
        var fit = floorFit(cssW, cssH);
        return {
          viewW: cssW / fit,
          viewH: cssH / fit,
          cssW: cssW,
          cssH: cssH,
          spritePx: CONFIG.sprite * fit,
          productPx: 46 * fit,
          zoom: fit
        };
      }
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
        var holdsDoor = !!cam.overview || (cam.y <= doorY && cam.y + view.viewH >= doorY - 4);
        els.stage.dataset.span = holdsDoor ? '1' : '0';
      }
      if (!HR.render) return;
      var edge = HR.render.edges(cam.x, cam.y, view.viewW, view.viewH, WORLD_W, WORLD_H);
      var map = { left: 'hr-pan-left', right: 'hr-pan-right', up: 'hr-pan-up', down: 'hr-pan-down' };
      Object.keys(map).forEach(function (key) {
        var node = document.getElementById(map[key]);
        if (!node) return;
        if (sim && sim._phone && sim.floorOn) node.hidden = true;
        else node.hidden = !edge[key];
      });
      var east = document.getElementById('hr-east');
      if (east) east.hidden = WORLD_W <= 1600;
    }

    function draw() {
      if (!assets || !els.canvas._cssW) return;
      var dpr = els.canvas._dpr || 1;
      var cardFrozen = !!(sim && sim._cardCam);
      var focus = null;
      var lockPlay = !!(sim && sim.floorOn && !cam.overview && !cam.fit && (sim._phone || !cam.userPan));
      if (lockPlay) {
        cam.follow = false;
        sim._ease = null;
        sim._heldWrap = 0;
        var lockW = els.canvas._cssW || 800;
        var lockH = els.canvas._cssH || 450;
        cam.zoom = playZoomFor(lockW, lockH);
        var lockedAt = playCamTarget(viewSize());
        cam.x = lockedAt.x;
        cam.y = lockedAt.y;
        sim._camLock = { x: cam.x, y: cam.y, zoom: cam.zoom };
        sim._lockCss = { w: lockW, h: lockH };
      }
      var holdWrap = !(sim && sim.floorOn) && !lockPlay && !!(sim && !cardFrozen && !cam.fit && !cam.userPan && sim.mechanic === 'wrap' && !sim._playerAct && !(sim.wraps > 0));
      if (lockPlay) {
        /* play frame already applied */
      } else if (cardFrozen) {
        cam.x = sim._cardCam.x;
        cam.y = sim._cardCam.y;
        cam.zoom = sim._cardCam.zoom || cam.zoom || 1;
      } else if (holdWrap) {
        cam.zoom = wrapHoldZoom(els.canvas._cssW || 800, els.canvas._cssH || 450);
      } else if (sim && sim._ease && !cam.userPan) {
        stepEase();
      } else if (sim && sim._heldWrap && !cam.userPan) {
        var cssW0 = els.canvas._cssW || 800;
        var cssH0 = els.canvas._cssH || 450;
        var z1 = playZoomFor(cssW0, cssH0);
        var z0 = cam.zoom || z1;
        cam.zoom = z1;
        var toPlay = playCamTarget(viewSize());
        cam.zoom = z0;
        sim._ease = {
          x0: Math.round(cam.x),
          y0: Math.round(cam.y),
          z0: z0,
          x1: toPlay.x,
          y1: toPlay.y,
          z1: z1,
          t0: sim.t || 0
        };
        sim._heldWrap = 0;
        stepEase();
      } else if (sim && sim._camLock && !cam.fit && !cam.userPan && !cam.follow) {
        var sized = !sim._lockCss || Math.abs(sim._lockCss.w - (els.canvas._cssW || 0)) > 12 || Math.abs(sim._lockCss.h - (els.canvas._cssH || 0)) > 12;
        if (sized && sim.mechanic === 'wrap') {
          cam.zoom = playZoomFor(els.canvas._cssW || 800, els.canvas._cssH || 450);
          var relock = playCamTarget(viewSize());
          relock.zoom = cam.zoom;
          sim._camLock = relock;
          sim._lockCss = { w: els.canvas._cssW, h: els.canvas._cssH };
        }
        cam.x = sim._camLock.x;
        cam.y = sim._camLock.y;
        if (sim._camLock.zoom) cam.zoom = sim._camLock.zoom;
      }
      var view = viewSize();
      var scale = view.cssW / view.viewW;
      var fitsFloor = view.viewW >= WORLD_W - 16 && view.viewH >= WORLD_H - 16;
      if (els.stage) els.stage.dataset.fit = fitsFloor ? '1' : '0';
      if (lockPlay) {
        cam.x = sim._camLock.x;
        cam.y = sim._camLock.y;
        cam.zoom = sim._camLock.zoom;
      } else if (cardFrozen) {
        cam.x = sim._cardCam.x;
        cam.y = sim._cardCam.y;
        cam.zoom = sim._cardCam.zoom || cam.zoom || 1;
      } else if (holdWrap) {
        var held = wrapCamTarget(view);
        cam.x = held.x;
        cam.y = held.y;
        sim._heldWrap = 1;
        sim._ease = null;
      } else if (fitsFloor && !sim._ease && !sim._camLock) {
        cam.x = 0;
        cam.y = 0;
      } else if (!sim || !sim._ease) {
        if (focus && !sim._camLock) {
          var focused = camClamp(focus.x - view.viewW * 0.5, focus.y - view.viewH * 0.62, view);
          cam.x = focused.x;
          cam.y = focused.y;
        } else if (sim && cam.follow && !cam.fit && !cam.userPan && !sim._camLock) {
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
      }
      if (!cardFrozen) {
        var snapped = camClamp(cam.x, cam.y, view);
        cam.x = snapped.x;
        cam.y = snapped.y;
      }
      if (sim && sim.floorOn) {
        sim._frame = { x0: cam.x, y0: cam.y, x1: cam.x + view.viewW, y1: cam.y + view.viewH };
      } else if (sim) sim._frame = null;
      if (sim && sim._camLock && !sim._lockCss) sim._lockCss = { w: view.cssW, h: view.cssH };
      paintEdges(view);
      if (isQA() && els.stage && sim) {
        els.stage.dataset.cam = Math.round(cam.x) + ',' + Math.round(cam.y);
        els.stage.dataset.follow = cam.follow ? '1' : '0';
        els.stage.dataset.held = holdWrap ? '1' : '0';
        els.stage.dataset.phone = sim._phone ? '1' : '0';
        els.stage.dataset.ease = sim._ease ? '1' : '0';
        els.stage.dataset.playerAct = sim._playerAct ? '1' : '0';
        var wrapPing = null;
        if (sim.pings) {
          for (var wi = 0; wi < sim.pings.length; wi++) {
            if (sim.pings[wi].kind === 'wrap' && !sim.pings[wi].dead) wrapPing = sim.pings[wi];
          }
        }
        els.stage.dataset.wrapAt = wrapPing ? (Math.round(wrapPing.x) + ',' + Math.round(wrapPing.y)) : '';
        var restockPing = null;
        if (sim.pings) {
          for (var ri = 0; ri < sim.pings.length; ri++) {
            if (sim.pings[ri].kind === 'restock' && !sim.pings[ri].dead) restockPing = sim.pings[ri];
          }
        }
        els.stage.dataset.restockAt = restockPing ? (Math.round(restockPing.x) + ',' + Math.round(restockPing.y)) : '';
        els.stage.dataset.wraps = String(sim.wraps || 0);
        if (coach && coach.step === 2) {
          var calmNow = coachFocus();
          var calmWho = calmNow && calmNow.cust;
          els.stage.dataset.calmAt = calmWho ? (Math.round(calmWho.x) + ',' + Math.round(calmWho.y)) : '';
          els.stage.dataset.coachStep = '2';
        } else {
          if (els.stage.dataset.calmAt) delete els.stage.dataset.calmAt;
          els.stage.dataset.coachStep = coach ? String(coach.step) : '';
        }
        els.stage.dataset.combo = String(sim.bestCombo || 0);
        els.stage.dataset.back = String(backLeft(sim));
        els.stage.dataset.sales = String(Math.round(sim.sales || 0));
        els.stage.dataset.goal = String(Math.round(sim.goal || 0));
        els.stage.dataset.clock = liveClockFace(sim);
        els.stage.dataset.view = Math.round(view.viewW) + ',' + Math.round(view.viewH);
        if (sim._phone && sim.customers && view.cssW) {
          var edgeScale = view.cssW / Math.max(1, view.viewW);
          var edgeLeft = 9999;
          var edgeRight = -1;
          var edgeHalf = spriteFootBox(sim).w * 0.5 * edgeScale;
          for (var ei = 0; ei < sim.customers.length; ei++) {
            var edgeCust = sim.customers[ei];
            if (!edgeCust || edgeCust.dead || edgeCust.hidden) continue;
            var edgeX = (edgeCust._drawX != null ? edgeCust._drawX : edgeCust.x) - cam.x;
            var edgeSx = edgeX * edgeScale;
            if (edgeSx - edgeHalf < edgeLeft) edgeLeft = edgeSx - edgeHalf;
            if (edgeSx + edgeHalf > edgeRight) edgeRight = edgeSx + edgeHalf;
          }
          if (edgeLeft < 9000) {
            els.stage.dataset.edgeL = String(Math.round(edgeLeft));
            els.stage.dataset.edgeR = String(Math.round(edgeRight));
          }
        }
        els.stage.dataset.zoomNow = String(Math.round((cam.zoom || 1) * 100) / 100);
        var regAx = SPOTS.reg1 ? SPOTS.reg1.x : 0;
        var regBx = SPOTS.reg2 ? SPOTS.reg2.x : regAx;
        els.stage.dataset.regs = Math.round(regAx) + ',' + Math.round(regBx);
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
      ctx.fillStyle = (sim && sim.floorOn) ? '#342824' : '#1a1412';
      ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
      var shakeX = 0;
      var shakeY = 0;
      if (sim && sim.shake > 0 && sim.shake < 1) sim.shake = 0;
      if (sim && sim.shake > 0 && !reduceMotion && !holdWrap && !(sim._ease) && !(sim._phone && sim.floorOn)) {
        var buzz = Date.now() / 16;
        shakeX = Math.round(Math.sin(buzz) * sim.shake);
        shakeY = Math.round(Math.cos(buzz * 1.3) * sim.shake * 0.65);
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
      ctx.imageSmoothingEnabled = !(sim && (sim._shed || sim._phone));
      if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = (sim && (sim._phone || sim.customers.length > 40 || sim._shed)) ? 'low' : 'medium';
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
          if (sim._shed || root.__hrShot) return;
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
        placeVisual(drawList, sim);
        labelSlots = [];
        bodySlots = [];
        nameBudget = 1;
        for (var bi = 0; bi < drawList.length; bi++) {
          var bodyActor = drawList[bi];
          if (!bodyActor || bodyActor.kind === 'jack' || bodyActor.hidden) continue;
          var bodyH = personDrawH();
          var bodyX = bodyActor._drawX != null ? bodyActor._drawX : bodyActor.x;
          var bodyY = bodyActor._drawY != null ? bodyActor._drawY : bodyActor.y;
          bodySlots.push({
            x: bodyX,
            top: bodyY - bodyH,
            bottom: bodyY,
            hw: Math.round(bodyH * 0.28),
            kind: bodyActor.kind || ''
          });
        }
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
          var homeX = actor.x;
          var homeY = actor.y;
          if (actor._drawX != null) {
            actor.x = actor._drawX;
            actor.y = actor._drawY;
          }
          drawActor(actor);
          actor.x = homeX;
          actor.y = homeY;
        }
        if (isQA() && els.stage) {
          var gapScale = screenScale();
          function slotGap(a, b) {
            var dx = Math.abs(a.x - b.x) - (a.hw + b.hw);
            var dy = Math.abs((a.top + a.bottom) * 0.5 - (b.top + b.bottom) * 0.5) - ((a.bottom - a.top) + (b.bottom - b.top)) * 0.5;
            if (dx < 0 && dy < 0) return Math.max(dx, dy);
            if (dx < 0) return dy;
            if (dy < 0) return dx;
            return Math.hypot(dx, dy);
          }
          var minBody = null;
          var nearPair = '';
          function slotSeen(slot) {
            return slot.x > cam.x - 8 && slot.x < cam.x + view.viewW + 8 && slot.bottom > cam.y - 8 && slot.top < cam.y + view.viewH + 8;
          }
          for (var gi = 0; gi < bodySlots.length; gi++) {
            if (!slotSeen(bodySlots[gi])) continue;
            for (var gj = gi + 1; gj < bodySlots.length; gj++) {
              if (!slotSeen(bodySlots[gj])) continue;
              var g = slotGap(bodySlots[gi], bodySlots[gj]) * gapScale;
              if (minBody == null || g < minBody) {
                minBody = g;
                nearPair = bodySlots[gi].kind + '@' + Math.round(bodySlots[gi].x) + ',' + Math.round(bodySlots[gi].bottom) + ' ' + bodySlots[gj].kind + '@' + Math.round(bodySlots[gj].x) + ',' + Math.round(bodySlots[gj].bottom);
              }
            }
          }
          var minTag = null;
          for (var ti = 0; ti < labelSlots.length; ti++) {
            var tagBox = {
              x: labelSlots[ti].x,
              top: labelSlots[ti].y - labelSlots[ti].h,
              bottom: labelSlots[ti].y,
              hw: labelSlots[ti].w * 0.5
            };
            for (var tb = 0; tb < bodySlots.length; tb++) {
              var tg = slotGap(tagBox, bodySlots[tb]) * gapScale;
              if (minTag == null || tg < minTag) minTag = tg;
            }
            for (var tj = ti + 1; tj < labelSlots.length; tj++) {
              var otherTag = {
                x: labelSlots[tj].x,
                top: labelSlots[tj].y - labelSlots[tj].h,
                bottom: labelSlots[tj].y,
                hw: labelSlots[tj].w * 0.5
              };
              var tt = slotGap(tagBox, otherTag) * gapScale;
              if (minTag == null || tt < minTag) minTag = tt;
            }
          }
          els.stage.dataset.minGap = minBody == null ? '' : String(Math.round(minBody));
          els.stage.dataset.near = nearPair;
          els.stage.dataset.tagGap = minTag == null ? '' : String(Math.round(minTag));
          els.stage.dataset.tagNames = labelSlots.map(function (slot) { return slot.text; }).join(',');
          els.stage.dataset.tags = String(labelSlots.length);
          els.stage.dataset.drawH = String(personDrawH());
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
          var leftPile = 0;
          var tillPile = 0;
          var qxy = [];
          var aliveN = 0;
          var onFloor = 0;
          var stateBits = {};
          for (qi = 0; qi < sim.customers.length; qi++) {
            var body = sim.customers[qi];
            if (!body || body.dead) continue;
            aliveN++;
            stateBits[body.state || '?'] = (stateBits[body.state || '?'] || 0) + 1;
            if (body.state !== 'leave' && body.state !== 'flee') onFloor++;
            var px = body._drawX != null ? body._drawX : body.x;
            var py = body._drawY != null ? body._drawY : body.y;
            if (px < 150) leftPile++;
            if (py > 620) tillPile++;
            if (body.state === 'queue' || body.state === 'checkout') qxy.push(Math.round(px) + ',' + Math.round(py));
          }
          els.stage.dataset.leftPile = String(leftPile);
          els.stage.dataset.tillPile = String(tillPile);
          els.stage.dataset.qxy = qxy.join(';');
          els.stage.dataset.alive = String(aliveN);
          els.stage.dataset.onFloor = String(onFloor);
          els.stage.dataset.states = Object.keys(stateBits).map(function (key) { return key + ':' + stateBits[key]; }).join(',');
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
          var qxy = [];
          var waitN = 0;
          for (var qj = 0; qj < sim.customers.length; qj++) {
            var qp = sim.customers[qj];
            if (qp.dead) continue;
            if (qp.state === 'wait') waitN++;
            if (qp.state === 'queue' || qp.state === 'checkout') qxy.push(Math.round(qp.x) + ',' + Math.round(qp.y));
          }
          els.stage.dataset.qxy = qxy.join(' ');
          els.stage.dataset.waitN = String(waitN);
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
        if (sim.taps && !sim._shed && !root.__hrShot) {
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
        if (!sim._shed && !root.__hrShot) for (var f = 0; f < sim.floats.length; f++) {
          var fl = sim.floats[f];
          ctx.globalAlpha = clamp(fl.life, 0, 1);
          ctx.fillStyle = fl.color;
          ctx.font = (fl.big ? '800 ' + (floatBig / floatScale) + 'px ' : '700 ' + (floatSm / floatScale) + 'px ') + 'Outfit, Inter, sans-serif';
          ctx.fillText(fl.text, fl.x, fl.y);
        }
        ctx.globalAlpha = 1;
        if (sim && coach) focus = coachFocus();
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
          var rushReserve = view.cssW < 720 ? 200 : 210;
          var rushLeft = view.cssW / 2 - rushW / 2;
          var rushLimit = view.cssW - rushReserve - rushW;
          if (rushLeft > rushLimit) rushLeft = Math.max(8, rushLimit);
          rushLeft = Math.round(rushLeft);
          ctx.fillRect(rushLeft, 8, rushW, 28);
          ctx.fillStyle = '#ffb4b4';
          ctx.fillText('RUSH', rushLeft + rushW / 2, 28);
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

    function personDrawH() {
      if (sim && sim.floorOn && sim.live) return 96;
      return SPRITE_PACK.displayH;
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
      var dh = personDrawH();
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
      var dh = personDrawH();
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
      var size = personDrawH();
      var reactX = 0;
      if ((a.bubble === 'angry' || a.angry) && !reduceMotion) reactX = Math.sin(Date.now() / 70) * 1.8;
      ctx.save();
      ctx.translate(a.x + reactX, a.y);
      if (a.kind === 'cust' && LOOKS[a.charId]) {
        ctx.fillStyle = LOOKS[a.charId].top;
        ctx.beginPath();
        ctx.ellipse(0, 6, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-20, -Math.round(size * 0.72), 16, 28);
      }
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
      if (!root.__hrShot && a.kind === 'cust' && a.arch !== 'lift' && a.state !== 'leave' && a.maxPatience) {
        var ring = clamp(a.patience / a.maxPatience, 0, 1);
        drawPatience(a.x, a.y - size - 28, ring);
      }
      if (!root.__hrShot && a.bubble === 'angry' && !reduceMotion) {
        var puff = (Date.now() / 280 + (a.seq || 0)) % 1;
        ctx.globalAlpha = 1 - puff;
        ctx.fillStyle = '#ffd0d0';
        ctx.beginPath();
        ctx.arc(a.x + 18, a.y - size - 6 - puff * 18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!root.__hrShot && a.bubble) {
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
      if (!root.__hrShot && nameVisible(a) && nameBudget > 0) {
        nameBudget -= 1;
        var crewName = a.kind === 'staff' && a.id;
        var familyName = a.arch === 'family' || a.giftSprite === 'family';
        var tagged = false;
        if (a.arch === 'rusher') {
          var rushAt = tagAnchor(a.x, a.y - size - 36, 'Rush');
          drawTag('Rush', rushAt.x, rushAt.y);
          tagged = true;
        } else if (familyName) {
          var famAt = tagAnchor(a.x, a.y - size - 36, 'Family');
          drawTag('Family', famAt.x, famAt.y);
          tagged = true;
        } else if (a.arch === 'lift') {
          var liftWord = a.state === 'flee' ? 'Catch' : 'Watch';
          var liftAt = tagAnchor(a.x, a.y - size - 28, liftWord);
          drawTag(liftWord, liftAt.x, liftAt.y);
          tagged = true;
        } else if (a.haggling) {
          var coupAt = tagAnchor(a.x, a.y - size - 36, 'Coupon');
          drawTag('Coupon', coupAt.x, coupAt.y);
          tagged = true;
        }
        if (!tagged && crewName) {
          var tag = firstName(a.id);
          if (a.rush > 1) tag += ' →';
          var tagAt = staffTagPoint(a, tag);
          drawTag(tag, tagAt.x, tagAt.y);
          tagged = true;
        } else if (!tagged && a.kind === 'you') {
          var youAt = staffTagPoint(a, 'YOU');
          drawTag('YOU', youAt.x, youAt.y);
          tagged = true;
        }
        if (!tagged && a.heart > 0) drawTag('♥', a.x, a.y - size - 40);
      }
    }

    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      var rawMs = lastTs ? ts - lastTs : 16;
      var dt = rawMs / 1000;
      lastTs = ts;
      if (!(dt >= 0)) dt = 0;
      if (dt > 0.05) dt = 0.05;
      if (sim && sim._clockArm) {
        sim._clockArm = 0;
        dt = 0;
        lastTs = ts;
      }
      if (sim) sim._frameMs = rawMs;
        if (sim && !sim.paused && !sim.done) {
        if (coach && coach.step === 1 && coach.until != null && sim.t >= coach.until - 1e-4) onCoachProgress('freight');
        if (coachBlocksPlay()) {
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
        paintPromptTimer();
        if (!sim._shed || ((sim._frames || 0) % 4) === 0) paintHud();
        liveAcc += dt;
        if (liveAcc > 5 && els.live) {
          liveAcc = 0;
          els.live.textContent = shiftLabel(run.day) + ' ' + liveClockFace(sim) + ', sales ' + money(sim.sales) + ' of ' + money(sim.goal) + ', morale ' + Math.round(sim.morale) + '.';
        }
        if (hooks.heat) hooks.heat(sim.customers.length, !!(sim._heat && sim._heat.rush && !sim.coachHold));
        if (!coach && sim.done) finishDay();
        simSaveAcc += dt;
        if (simSaveAcc > 1) { simSaveAcc = 0; saveRun(); }
      }
      if (sim && coachBlocksPlay()) {
        if (els.event && !els.event.hidden) els.event.hidden = true;
        shownEvent = null;
        shownType = null;
      } else if (sim && sim.pending && shownEvent !== sim.pending) {
        shownEvent = sim.pending;
        shownType = null;
        renderEvent();
      }
      if (sim && !sim.pending && shownEvent) {
        shownEvent = null;
        if (!sim.typeCard) els.event.hidden = true;
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
      if (sim && !sim.pending && !sim.typeCard) sim._cardCam = null;
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
      var cssW = els.canvas._cssW || 800;
      if (cssW < 720 && sim && sim.floorOn) return;
      var before = cam.zoom || 1;
      var cssH = els.canvas._cssH || 450;
      var next = HR.render ? HR.render.clampZoom(cssW, before * mult, cssH) : before * mult;
      if (Math.abs(next - before) < 0.005) {
        if (mult < 1 && cssW < 720) {
          toast('The floor fills this screen.', true);
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
      if ((els.canvas._cssW || 0) < 720 && sim && sim.floorOn) return;
      cam.overview = !cam.overview;
      cam.fit = false;
      var frameBtn = document.getElementById('hr-frame');
      if (frameBtn) frameBtn.setAttribute('aria-pressed', cam.overview ? 'true' : 'false');
      cam.follow = false;
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
      cam.userPan = true;
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
        cam.userPan = true;
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
      if (cardTapBlocked()) return;
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (Object.keys(pointers).length >= 2) return;
      if (ev.target.closest && ev.target.closest('button, .hr-card')) return;
      var phonePan = (els.canvas._cssW || window.innerWidth) < 720;
      var touchTap = phonePan && ev.pointerType === 'touch';
      if (sim && !phonePan) {
        var preview = pickHit(ev);
        var at = eventWorld(ev);
        var px = at.x;
        var py = at.y;
        if (preview && preview.cust) { px = preview.cust.x; py = preview.cust.y; }
        else if (preview && preview.ping) { px = preview.ping.x; py = preview.ping.y; }
        else if (preview && preview.x != null) { px = preview.x; py = preview.y; }
        tapFx(sim, px, py);
      }
      cam.drag = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, moved: false, phone: phonePan, locked: touchTap ? '' : (phonePan ? '' : 'pan'), touch: touchTap };
      if (!phonePan) {
        if (!coach) cam.follow = false;
        try { els.stage.setPointerCapture(ev.pointerId); } catch (e) {}
      }
    }, { passive: true });
    els.stage.addEventListener('pointermove', function (ev) {
      if (sim && !(cam.drag && cam.drag.moved)) {
        var hovered = nearestLabeled(ev);
        var hoverKey = hovered ? actorKey(hovered) : worldKeyAt(ev);
        if (sim._hoverKey !== hoverKey) sim._hoverKey = hoverKey;
      }
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
      if (cam.drag.touch) {
        var dxT = ev.clientX - cam.drag.x;
        var dyT = ev.clientY - cam.drag.y;
        if (Math.abs(dxT) + Math.abs(dyT) > 10) cam.drag.moved = true;
        if (Math.abs(dyT) >= 10 && Math.abs(dyT) >= Math.abs(dxT)) cam.drag = null;
        return;
      }
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
      var dragRect = els.canvas.getBoundingClientRect();
      var scale = (dragRect.width || view.cssW) / Math.max(1, view.viewW);
      var mx = ev.clientX - cam.drag.x;
      var my = ev.clientY - cam.drag.y;
      if (Math.abs(mx) + Math.abs(my) > 10) cam.drag.moved = true;
      if (!cam.drag.moved) return;
      if (sim && sim._phone && sim.floorOn) return;
      cam.x = clamp(cam.drag.cx - mx / scale, 0, Math.max(0, WORLD_W - view.viewW));
      cam.y = clamp(cam.drag.cy - my / scale, 0, Math.max(0, WORLD_H - view.viewH));
    }, { passive: true });
    function endPan(ev) {
      if (ev && ev.pointerId != null) delete pointers[ev.pointerId];
      if (Object.keys(pointers).length < 2) cam.pinch = 0;
      var wasTap = cam.drag && !cam.drag.moved;
      if (cam.drag && cam.drag.moved) {
        var travel = ev ? Math.abs(ev.clientX - cam.drag.x) + Math.abs(ev.clientY - cam.drag.y) : 99;
        var wrapHold = sim && sim.mechanic === 'wrap' && !sim._playerAct && !(sim.wraps > 0);
        if (!(sim && sim._phone && sim.floorOn) && (!wrapHold || travel > 24)) cam.userPan = true;
      }
      cam.follow = false;
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
    function pressWrap() {
      if (!sim) return;
      var ping = null;
      if (sim.pings) {
        for (var i = 0; i < sim.pings.length; i++) {
          if (sim.pings[i].kind === 'wrap' && !sim.pings[i].dead) { ping = sim.pings[i]; break; }
        }
      }
      if (!ping) {
        toast('Wait for the next gift. Wrap glows on the table.');
        sfx('miss');
        return;
      }
      tapFx(sim, ping.x, ping.y);
      flashAt(sim, ping.x, ping.y);
      hooks.tap();
      hooks.coin();
      resolvePing(sim, ping);
      sfx('place');
      buzz(12);
      paintHud();
      draw();
      saveRun();
    }
    function pressAct(name, btn) {
      if (!sim) return;
      lastActAt = root.performance ? root.performance.now() : Date.now();
      if (btn) btn.classList.add('is-down');
      if (root.CGSfx && root.CGSfx.juice && btn) root.CGSfx.juice(btn, 'pop');
      if (name === 'wrap') {
        pressWrap();
        return;
      }
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
      try { if (localStorage.getItem('hr_tut_done') === '1') root.__hrSawTut = 1; } catch (eSawTut) {}
      var saved = readJSON('hr_run_v1');
      var campBoot = campaignGet();
      var resumable = saved && saved.v === 3 && saved.ymd === ymd && saved.phase && saved.phase !== 'intro' && saved.days && saved.days.length === SHIFT_COUNT;
      var seedPreview = (previewHas('kiosk') || previewHas('bus')) && books && HR.economy;
      var seedGranted = false;
      if (seedPreview) {
        try { seedGranted = localStorage.getItem('hr_seed_grant') === '1'; } catch (eGrant) { seedGranted = false; }
      }
      if (seedPreview && !seedGranted) {
        if (previewHas('kiosk')) {
          books.cash = Math.max(books.cash || 0, 20000);
          ['knock', 'lane', 'kiosk'].forEach(function (id) {
            if (!HR.economy.has(books, id)) HR.economy.expand(books, id);
          });
          if (books.locations.kiosk && books.locations.kiosk.open) HR.economy.switchLocation(books, 'kiosk');
          if (books.locations.kiosk) books.locations.kiosk.leadId = 'staff_reg1';
          if (books.locations.mart && books.active !== 'mart') HR.economy.assignManager(books, 'mart', 'staff_mgr');
        }
        if (HR.save) HR.save.save(writeJSON, books);
        try {
          root.__hrInternal = true;
          localStorage.setItem('hr_coach_price', '1');
          localStorage.setItem('hr_coach_mall', '1');
          localStorage.setItem('hr_seed_grant', '1');
          localStorage.removeItem('hr_run_v1');
        } catch (eSeed) {}
        root.__hrInternal = false;
        var seedCamp = campaignGet();
        seedCamp.seen = true;
        seedCamp.bank = books.cash;
        campaignPut(seedCamp);
        run = newRun(ymd);
        applyCampaign(run);
        syncFloor(true);
        if (els.stage) els.stage.dataset.seed = previewSeeds().join(',');
        if (!tutDone()) {
          beginShift(0);
        } else {
          run.phase = 'map';
          renderMap();
          var seedMsg = previewHas('kiosk')
            ? 'Plaza Kiosk is unlocked. Pick a shift to play that floor.'
            : 'Pick a shift. The tour bus is queued.';
          if (previewHas('kiosk') && previewHas('bus')) seedMsg = 'Plaza Kiosk is unlocked. The tour bus is queued on this shift.';
          toast(seedMsg, true);
        }
      } else if (resumable && !tutDone()) {
        run = saved;
        applyCampaign(run);
        run.simState = null;
        run.day = 0;
        run.phase = 'sim';
        beginShift(0);
      } else if (resumable) {
        run = saved;
        run._wrote = 1;
        applyCampaign(run);
        if (!run.suggested) run.suggested = [];
        track('holiday_rush_resume', { seed: ymd });
        enterPhase();
      } else if ((!campBoot.seen && !seedPreview) || !tutDone()) {
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
        if (sim.combo > (sim.bestCombo || 0)) sim.bestCombo = sim.combo;
        paintHud();
      },
      rush: function (on) {
        if (!isQA() || !sim) return;
        sim._qaRush = on !== false;
        sim.coachHold = false;
        paintHud();
      },
      card: function (id) {
        if (!isQA() || !sim) return '';
        if (sim.pending) {
          var heldTitle = document.getElementById('hr-ev-title');
          return heldTitle ? heldTitle.textContent : (sim.pending.title || '');
        }
        var beat = null;
        for (var bi = 0; bi < FLOOR_BEATS.length; bi++) if (FLOOR_BEATS[bi].id === id) beat = FLOOR_BEATS[bi];
        if (beat) {
          beatCard(sim, beat.id, beat.title, beat.body, beat.choices(sim, run));
          renderEvent();
          var beatTitle = document.getElementById('hr-ev-title');
          var beatBody = els.event ? els.event.querySelector('p') : null;
          return (beatTitle ? beatTitle.textContent : '') + ' | ' + (beatBody ? beatBody.textContent : '');
        }
        sim.coachHold = false;
        openPending(sim, buildEvent(id || 'boss', sim, run), 40);
        renderEvent();
        var title = document.getElementById('hr-ev-title');
        var body = els.event ? els.event.querySelector('p') : null;
        return (title ? title.textContent : '') + ' | ' + (body ? body.textContent : '');
      },
      clock: function () {
        if (!isQA() || !sim) return null;
        var title = document.getElementById('hr-ev-title');
        return {
          t: Math.round(sim.t * 100) / 100,
          paused: !!sim.paused,
          hold: sim._hold || '',
          id: sim.pending ? sim.pending.id : '',
          title: title && !document.getElementById('hr-event').hidden ? title.textContent : ''
        };
      },
      wrapState: function () {
        if (!isQA() || !sim) return null;
        var open = 0;
        var life = 0;
        var pings = sim.pings || [];
        for (var i = 0; i < pings.length; i++) {
          if (pings[i].kind === 'wrap' && !pings[i].dead) {
            open++;
            if (pings[i].life > life) life = pings[i].life;
          }
        }
        return { open: open, life: Math.round(life * 10) / 10, wraps: sim.wraps || 0, crowd: sim.crowd || '' };
      },
      wraps: function () {
        if (!isQA() || !sim) return null;
        offerWrap(sim);
        var ping = null;
        for (var i = sim.pings.length - 1; i >= 0; i--) {
          if (sim.pings[i].kind === 'wrap' && !sim.pings[i].dead) { ping = sim.pings[i]; break; }
        }
        if (ping) {
          cam.follow = false;
          focusCam(ping.x, ping.y + 80);
        }
        paintHud();
        draw();
        var at = null;
        if (ping && els.canvas) {
          var rect = els.canvas.getBoundingClientRect();
          var view = viewSize();
          var scale = view.viewW ? view.cssW / view.viewW : 1;
          at = {
            x: (ping.x - cam.x) * scale + rect.left,
            y: (ping.y - cam.y) * scale + rect.top,
            fee: ping.fee
          };
        }
        return { sales: sim.sales, wraps: sim.wraps || 0, at: at, life: ping ? ping.life : 0 };
      },
      tapWrap: function () {
        if (!isQA() || !sim || !sim.pings) return null;
        var ping = null;
        for (var i = 0; i < sim.pings.length; i++) {
          if (sim.pings[i].kind === 'wrap' && !sim.pings[i].dead) ping = sim.pings[i];
        }
        if (!ping) return null;
        var before = sim.sales;
        resolvePing(sim, ping);
        paintHud();
        draw();
        return { before: Math.round(before), sales: Math.round(sim.sales), wraps: sim.wraps || 0, fee: ping.fee };
      },
      seek: function (u) {
        if (!isQA() || !sim) return '';
        var t = (u == null ? 0.8 : u) * sim.duration;
        if (!(t >= sim.t)) t = sim.t;
        sim.t = t;
        if (sim._clockT == null || sim.t > sim._clockT) sim._clockT = sim.t;
        sim._heat = heatOf(sim, run);
        paintHud();
        var lab = document.querySelector('.hr-sales__top span');
        return lab ? lab.textContent : '';
      },
      emptyBack: function () {
        if (!isQA() || !sim) return '';
        var bag = stockBag(sim);
        if (bag) {
          var id;
          for (id in bag) if (Object.prototype.hasOwnProperty.call(bag, id)) bag[id] = 0;
        }
        sim.stock = 0;
        sim.paused = true;
        paintHud();
        var stockText = document.getElementById('hr-stock-text');
        return stockText ? stockText.textContent : '';
      },
      setSales: function (sales, goal) {
        if (!isQA() || !sim) return;
        if (sales != null) sim.sales = sales;
        if (goal != null) sim.goal = goal;
        sim._paintSales = sim.sales;
        paintHud();
      },
      setCosts: function (cogs) {
        if (!isQA() || !sim) return;
        sim.cogs = cogs || 0;
      },
      extra: function (n) {
        if (!isQA() || !sim) return 0;
        var count = n || 8;
        for (var ei = 0; ei < count; ei++) spawnCustomer(sim, run, 'family');
        return sim.customers.length;
      },
      hold: function (on) {
        if (!isQA() || !sim) return;
        if (sim._hold === 'card') return;
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
    simulateLive: simulateLive,
    kioskOneStarCosts: kioskOneStarCosts,
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
    if (!(comboMult(4) < 3) || comboMult(6) >= 3 || !(comboMult(7) >= 3)) bad = true;
    var seedEnc = seedsFromSearch('?seed=kiosk%2Cbus&_vercel_share=abc').join(',');
    var seedDbl = seedsFromSearch('?seed=kiosk%252Cbus').join(',');
    var seedPlus = seedsFromSearch('?qa=1&seed=kiosk+bus').join(',');
    var seedBus = seedsFromSearch('?seed=bus').join(',');
    if (seedEnc !== 'kiosk,bus' || seedDbl !== 'kiosk,bus' || seedPlus !== 'kiosk,bus' || seedBus !== 'bus') bad = true;
    if (seedsFromSearch('?seed=kiosk%2Cbus').join(',') !== 'kiosk,bus') bad = true;
    var seededDay = newRun('2026-10-22');
    if (!seededDay.days[0] || seededDay.days[0].events.join(',') !== 'boss,spill') bad = true;
    if (!seededDay.days[0] || seededDay.days[0].eventTimes.join(',') !== '16.5,37.2') bad = true;
    if (clockLabel(56, 62) !== '6:50 PM' || clockLabel(62, 62) !== '7:59 PM' || clockLabel(0, 62) !== '8:00 AM') bad = true;
    var wrapSim = { rng: function () { return 0.5; }, pings: [], floorOn: true, live: true, mechanic: 'wrap', t: 1 };
    offerWrap(wrapSim);
    if (!wrapSim.pings[0] || wrapSim.pings[0].life !== 22) bad = true;
    keepWrap(wrapSim);
    if (wrapSim.pings.length !== 1) bad = true;
    wrapSim.pings[0].dead = true;
    keepWrap(wrapSim);
    if (wrapSim.pings.length !== 2 || wrapSim._wrapCamUntil !== 15) bad = true;
    var tuned = { speedMul: 1, patience: 2, maxPatience: 2, saleMul: 1 };
    applyKioskTune({ crowd: 'gift' }, tuned);
    if (Math.abs(tuned.speedMul - 0.72) > 0.001 || Math.abs(tuned.patience - 3.1) > 0.001 || Math.abs(tuned.saleMul - 0.62) > 0.001) bad = true;
    var plain = { speedMul: 1, patience: 2, maxPatience: 2, saleMul: 1 };
    applyKioskTune({ crowd: '' }, plain);
    if (plain.speedMul !== 1 || plain.saleMul !== 1) bad = true;
    if (SHIFT_COUNT < 15) bad = true;
    if (FLOOR_BEATS.length < SHIFT_COUNT) bad = true;
    function clockMinutes(label) {
      var parsed = /^(\d+):(\d+) (AM|PM)$/.exec(label);
      if (!parsed) return -1;
      var hh = (+parsed[1]) % 12;
      if (parsed[3] === 'PM') hh += 12;
      return hh * 60 + (+parsed[2]);
    }
    var prevMin = -1;
    for (var ct = 0; ct <= 62; ct += 0.05) {
      var mins = clockMinutes(clockLabel(ct, 62));
      if (mins < prevMin) bad = true;
      prevMin = mins;
    }
    var faceSim = { t: 24.6, duration: 62 };
    var faceA = liveClockFace(faceSim);
    faceSim.t = 24.3;
    var faceB = liveClockFace(faceSim);
    if (clockMinutes(faceB) < clockMinutes(faceA) || faceSim._clockBack !== 1) bad = true;
    var gapSim = {
      floorOn: true,
      live: true,
      t: 10,
      duration: 62,
      pending: null,
      typeCard: '',
      paused: false,
      _hold: '',
      coachHold: false,
      events: ['boss'],
      eventIndex: 0,
      eventTimes: [10],
      actions: 3,
      morale: 50,
      stars: 3,
      notes: [],
      customers: [],
      staff: []
    };
    openPending(gapSim, buildEvent('boss', gapSim, { day: 0 }), 7);
    if (!gapSim.paused || gapSim._hold !== 'card') bad = true;
    var heldT = gapSim.t;
    resolvePending(gapSim, { day: 0 }, 0);
    if (gapSim.paused || gapSim._clockArm !== 1) bad = true;
    if (Math.abs((gapSim._nextCardAt - heldT) - (62 / 12)) > 0.02) bad = true;
    maybeEvent(gapSim, { day: 0 });
    if (gapSim.eventIndex !== 0 || gapSim.pending) bad = true;
    gapSim.t = gapSim._nextCardAt;
    maybeEvent(gapSim, { day: 0 });
    if (!gapSim.pending || gapSim.pending.id !== 'boss' || gapSim.eventIndex !== 1) bad = true;
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
    var goodsLow = liveGoodsCost(1000, 2000, 834);
    var goodsHigh = liveGoodsCost(1500, 3000, 1668);
    var marginLow = 834 - goodsLow;
    var marginHigh = 1668 - goodsHigh;
    if (!(marginHigh > marginLow + 200)) bad = true;
    var flatA = kioskOneStarCosts(2341, 1800, 448, 520, 1.07);
    var flatB = kioskOneStarCosts(2943, 2000, 448, 520, 1.34);
    var shownA = 2341 - flatA.cogs - flatA.wages - flatA.rent;
    var shownB = 2943 - flatB.cogs - flatB.wages - flatB.rent;
    if (shownA === shownB || shownA === 48 || shownB === 48) bad = true;
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
