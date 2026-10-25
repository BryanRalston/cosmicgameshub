(function (root) {
  'use strict';

  function economy() {
    return root.HRParts.economy;
  }

  function activeLayout(books) {
    var loc = books.locations[books.active];
    return loc && loc.layout;
  }

  function fidelity(books, locId) {
    return locId === books.active ? 'full' : 'aggregate';
  }

  function tickAggregate(books, loc, ctx) {
    ctx = ctx || {};
    var econ = economy();
    var manager = null;
    if (loc.managerId && books.staff[loc.managerId] && books.staff[loc.managerId].employed) {
      manager = books.staff[loc.managerId];
      manager.id = loc.managerId;
    }
    var skill = manager ? (manager.skill || 1) : 1;
    var eff = manager ? Math.max(0.45, Math.min(0.9, 0.62 + (skill - 2) * 0.08)) : 0.34;
    var demand = econ.demandMul(books);
    var units = 0;
    var id;
    for (id in loc.stock) units += loc.stock[id] || 0;
    var stockMul = units < 20 ? 0.25 : units < 80 ? 0.7 : 1;
    var kindMul = loc.kind === 'flagship' ? 1 : 0.72;
    var day = ctx.day != null ? ctx.day : 0;
    var ymd = ctx.ymd || '';
    var cal = calendarEvent(day);
    var eventMul = cal && cal.door ? cal.door : 1;
    var swing = ((ymdHash(String(ymd) + ':' + day + ':' + (loc.id || '')) % 37) - 18) / 100;
    var sales = Math.round(4200 * demand * eff * stockMul * kindMul * eventMul * (1 + swing));
    if (sales < 0) sales = 0;
    var cogsRate = 0.5;
    var items = econ.availableItems(books);
    if (items.length) {
      var cost = 0;
      var price = 0;
      for (var i = 0; i < items.length; i++) {
        var w = items[i].weight || 1;
        cost += w * items[i].wholesale;
        price += w * econ.priceOf(books, items[i]);
      }
      if (price > 0) cogsRate = cost / price;
    }
    var cogs = Math.round(sales * cogsRate);
    var wage = manager ? econ.wageOf(loc.managerId) * 8 : 0;
    var rent = (root.HRParts.data.get().economy.rent.kiosk) || 520;
    if (loc.kind === 'flagship' && econ.martRent) rent = econ.martRent(books);
    var profit = sales - cogs - wage - rent;
    if (units >= 20) {
      var burn = Math.min(units, 70);
      var left = burn;
      for (id in loc.stock) {
        if (left <= 0) break;
        var take = Math.min(loc.stock[id] || 0, left);
        loc.stock[id] -= take;
        left -= take;
      }
    }
    var complaints = [];
    if (!manager) complaints.push(loc.name + ' had nobody on the till. Sales fell apart.');
    else if (skill < 3) complaints.push(econ.nameOf(loc.managerId) + ' kept ' + loc.name + ' open and dropped two baskets.');
    if (units < 20) complaints.push(loc.name + ' ran out. The back room was bare.');
    return {
      id: loc.id,
      name: loc.name,
      fidelity: 'aggregate',
      sales: sales,
      cogs: cogs,
      wages: wage,
      rent: rent,
      profit: profit,
      complaints: complaints,
      eff: Math.round(eff * 100) / 100
    };
  }

  function closeBackground(books, ctx) {
    var tapes = [];
    var profit = 0;
    Object.keys(books.locations).forEach(function (id) {
      if (id === books.active) return;
      var loc = books.locations[id];
      if (!loc || !loc.open) return;
      var tape = tickAggregate(books, loc, ctx);
      tapes.push(tape);
      profit += tape.profit;
    });
    if (profit) books.cash = Math.round(books.cash + profit);
    return { tapes: tapes, profit: profit };
  }

  function lease(state, slotId, tenantId, rent, commons) {
    var data = root.HRParts.data.get();
    var tenant = data.tenants.byId[tenantId];
    var slot = null;
    for (var i = 0; i < data.mall.slots.length; i++) {
      if (data.mall.slots[i].id === slotId) slot = data.mall.slots[i];
    }
    if (!tenant || !slot || slot.kind !== 'lease') {
      return { accepted: false, reason: 'That unit is not for lease.' };
    }
    if (rent > tenant.maxRent) {
      return { accepted: false, reason: tenant.name + ' will not pay ' + rent + '. Their ceiling is ' + tenant.maxRent + '.' };
    }
    var complaints = [];
    var traffic = tenant.traffic;
    var level = commons && commons[tenant.wants] ? commons[tenant.wants] : 0;
    if (level < 1) {
      complaints.push(tenant.complaint);
      traffic = Math.round(traffic * 0.7 * 100) / 100;
    }
    state.leases = state.leases || {};
    state.leases[slotId] = { tenantId: tenantId, rent: rent };
    var rentPaid = complaints.length ? Math.round(rent * 0.85) : rent;
    return {
      accepted: true,
      tenant: tenant.name,
      rentPaid: rentPaid,
      traffic: traffic,
      complaints: complaints
    };
  }

  function blankMall() {
    var data = root.HRParts.data.get();
    var commons = {};
    var list = data.mall.commons || [];
    for (var i = 0; i < list.length; i++) commons[list[i]] = 0;
    return { leases: {}, commons: commons, door: 1 };
  }

  function ensureMall(books) {
    if (!books.mall) books.mall = blankMall();
    if (!books.mall.leases) books.mall.leases = {};
    if (!books.mall.commons) books.mall.commons = blankMall().commons;
    return books.mall;
  }

  function commonCost(id) {
    var costs = root.HRParts.data.get().mall.commonCosts || {};
    return costs[id] || 0;
  }

  function commonName(id) {
    var names = root.HRParts.data.get().mall.commonNames || {};
    return names[id] || id;
  }

  function remember(row, res) {
    row.rentPaid = res.rentPaid;
    row.traffic = res.traffic;
    row.openComplaint = res.complaints && res.complaints[0] ? res.complaints[0] : '';
  }

  function refreshMall(books) {
    var mall = books.mall;
    if (!mall || !mall.leases) return 1;
    var keys = Object.keys(mall.leases);
    var bump = 0;
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      var slotId = keys[i];
      var row = mall.leases[slotId];
      if (!row) continue;
      var res = lease(mall, slotId, row.tenantId, row.rent, mall.commons);
      if (!res.accepted) continue;
      remember(mall.leases[slotId], res);
      bump += res.traffic - 1;
      n++;
    }
    mall.door = n ? Math.max(0.62, Math.min(1.55, 1 + bump)) : 1;
    return mall.door;
  }

  function signLease(books, slotId, tenantId, rent) {
    var mall = ensureMall(books);
    var res = lease(mall, slotId, tenantId, rent, mall.commons);
    if (!res.accepted) return res;
    remember(mall.leases[slotId], res);
    refreshMall(books);
    return res;
  }

  function endLease(books, slotId) {
    if (!books.mall || !books.mall.leases || !books.mall.leases[slotId]) {
      return { ok: false, msg: 'That unit is empty.' };
    }
    delete books.mall.leases[slotId];
    refreshMall(books);
    return { ok: true, msg: 'The unit is empty again.' };
  }

  function buyCommon(books, id) {
    var mall = ensureMall(books);
    var cost = commonCost(id);
    if (!cost) return { ok: false, msg: 'That common is not on the map.' };
    if ((mall.commons[id] || 0) >= 1) return { ok: true, msg: commonName(id) + ' is already open.' };
    if ((books.cash || 0) < cost) return { ok: false, msg: commonName(id) + ' is ' + cost + '. The register is short.' };
    books.cash -= cost;
    mall.commons[id] = 1;
    refreshMall(books);
    return { ok: true, msg: commonName(id) + ' is open. A tenant who wanted it pays full rent from this close.' };
  }

  function income(books) {
    if (!books || !books.mall || !books.mall.leases) return 0;
    var sum = 0;
    Object.keys(books.mall.leases).forEach(function (id) {
      var row = books.mall.leases[id];
      sum += row.rentPaid || 0;
    });
    return sum;
  }

  function tenantLayout(tenantId) {
    var data = root.HRParts.data.get();
    var tenants = data.layouts && data.layouts.tenants;
    if (!tenants) return null;
    return tenants[tenantId] || tenants.toys_pop || null;
  }

  function retune(books, kind) {
    var mall = ensureMall(books);
    var commons = mall.commons || {};
    var ids = ['decor', 'security', 'parking', 'foodcourt', 'events'];
    var openN = 0;
    for (var i = 0; i < ids.length; i++) if ((commons[ids[i]] || 0) >= 1) openN++;
    if (kind === 'parade') {
      if ((commons.events || 0) < 1) {
        return { ok: false, msg: 'Open the holiday event. Then the parade can pass the flagship.' };
      }
      mall.retune = {
        kind: 'parade',
        door: 1,
        note: 'Parade is set. The next flagship shift draws a bigger crowd the whole day.'
      };
      return { ok: true, msg: mall.retune.note, retune: mall.retune };
    }
    if (kind === 'blackout') {
      var lit = (commons.parking || 0) >= 1 && (commons.security || 0) >= 1;
      if (lit) return { ok: false, msg: 'Parking lights and security are on. The plaza stays lit.' };
      mall.retune = {
        kind: 'blackout',
        door: 0.84,
        note: 'Blackout is set. The next flagship shift is dim, patience drains, and the door is thinner.'
      };
      return { ok: true, msg: mall.retune.note, retune: mall.retune };
    }
    if (kind === 'visit') {
      var door = Math.round((0.9 + openN * 0.06) * 100) / 100;
      mall.retune = {
        kind: 'visit',
        door: door,
        note: 'You walked the plaza. ' + openN + ' commons are open, so the next flagship door is ' + Math.round(door * 100) + '%.'
      };
      return { ok: true, msg: mall.retune.note, retune: mall.retune };
    }
    return { ok: false, msg: 'That plaza action is not on the map.' };
  }

  function negotiate(books, slotId, tenantId, rent, prior) {
    var data = root.HRParts.data.get();
    var tenant = data.tenants.byId[tenantId];
    if (!tenant) return { status: 'walk', reason: 'That tenant is not on the list.' };
    var ask = Math.round(tenant.maxRent * 0.9);
    var floor = Math.round(tenant.maxRent * 0.62);
    var perk = tenant.wants;
    var perkLabel = commonName(perk);
    rent = Math.round(rent || 0);
    if (prior && prior.status === 'perk') {
      return { status: 'walk', ask: ask, floor: floor, perk: perk, tenant: tenant.name, reason: tenant.name + ' walks. You pushed past the perk.' };
    }
    if (prior && prior.status === 'counter') {
      if (rent >= prior.rent) {
        return { status: 'accept', rent: rent, ask: ask, floor: floor, tenant: tenant.name, reason: tenant.name + ' takes ' + rent + '.' };
      }
      if (rent >= floor && rent >= prior.rent - 100) {
        return {
          status: 'perk',
          rent: rent,
          ask: ask,
          floor: floor,
          perk: perk,
          tenant: tenant.name,
          reason: tenant.name + ' will take ' + rent + ' only if ' + perkLabel + ' is open. Push again and they walk.'
        };
      }
      return { status: 'walk', ask: ask, floor: floor, tenant: tenant.name, reason: tenant.name + ' walks. ' + rent + ' is too far under ' + prior.rent + '.' };
    }
    if (rent > tenant.maxRent) {
      return { status: 'refuse', ask: ask, floor: floor, reason: tenant.name + ' will not pay ' + rent + '. Their ceiling is ' + tenant.maxRent + '.' };
    }
    if (rent >= ask) {
      var atCap = rent >= tenant.maxRent;
      return {
        status: 'accept',
        rent: rent,
        ask: ask,
        floor: floor,
        tenant: tenant.name,
        reason: atCap
          ? tenant.name + ' is at their cap of ' + tenant.maxRent + '. They sign, and the number does not go higher.'
          : tenant.name + ' takes ' + rent + '.'
      };
    }
    if (rent >= floor) {
      var counter = Math.round((rent + ask) / 2);
      if (counter > tenant.maxRent) counter = tenant.maxRent;
      return { status: 'counter', rent: counter, ask: ask, floor: floor, tenant: tenant.name, reason: tenant.name + ' counters at ' + counter + '.' };
    }
    return { status: 'walk', ask: ask, floor: floor, tenant: tenant.name, reason: tenant.name + ' walks. ' + rent + ' is under their floor.' };
  }

  function calendarEvent(dayIndex) {
    var list = root.HRParts.data.get().mall.calendar || [];
    if (!list.length) return null;
    var n = list.length;
    var i = ((dayIndex % n) + n) % n;
    return list[i];
  }

  function ymdHash(ymd) {
    var s = String(ymd || '');
    var n = 0;
    for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) * (i + 1);
    return n % 997;
  }

  function dailyList() {
    var goals = root.HRParts.data.get().goals;
    return (goals && goals.daily) || [];
  }

  function dailyGoal(ymd) {
    var list = dailyList();
    if (!list.length) return null;
    return list[ymdHash(ymd) % list.length];
  }

  function comboPay(n) {
    if (n <= 1) return 1;
    var m = 1 + (n - 1) * 0.35;
    return m > 4 ? 4 : m;
  }

  function dailyMet(goal, report) {
    if (!goal || !report) return false;
    if (goal.walkoutsMax != null) return (report.walkouts || 0) <= goal.walkoutsMax;
    if (goal.goalMin != null) return (report.goalPct || 0) >= goal.goalMin;
    if (goal.comboMin != null) return comboPay(report.bestCombo || 0) >= goal.comboMin;
    return false;
  }

  function claimDaily(books, ymd, report) {
    if (!books) return { claimed: false, bonus: 0 };
    if (books.dailyClaimed === ymd) return { claimed: false, bonus: 0, reason: 'already', goal: dailyGoal(ymd) };
    var goal = dailyGoal(ymd);
    if (!goal) return { claimed: false, bonus: 0 };
    if (!dailyMet(goal, report)) return { claimed: false, bonus: 0, goal: goal, reason: 'miss' };
    var bonus = goal.bonus || 0;
    books.cash = Math.round((books.cash || 0) + bonus);
    books.dailyClaimed = ymd;
    var econ = economy();
    if (econ && econ.milestone) econ.milestone(books, 'daily');
    return { claimed: true, bonus: bonus, goal: goal, cash: books.cash };
  }

  function nextComplaint(books) {
    if (!books || !books.mall || !books.mall.leases) return null;
    var data = root.HRParts.data.get();
    var keys = Object.keys(books.mall.leases);
    for (var i = 0; i < keys.length; i++) {
      var row = books.mall.leases[keys[i]];
      if (!row || !row.openComplaint) continue;
      var tenant = data.tenants.byId[row.tenantId];
      if (!tenant) continue;
      return {
        slotId: keys[i],
        tenantId: row.tenantId,
        name: tenant.name,
        complaint: row.openComplaint,
        wants: tenant.wants,
        cost: commonCost(tenant.wants)
      };
    }
    return null;
  }

  function selfTest() {
    var data = root.HRParts.data;
    data.loadSync();
    var econ = root.HRParts.economy;
    var reasons = [];
    var books = econ.blankBooks();
    books.locations.kiosk = {
      id: 'kiosk',
      name: 'Plaza Kiosk',
      open: true,
      kind: 'store',
      stock: { cocoa: 40, paper: 30, candy: 30, candle: 20 },
      layout: data.get().layouts.kiosk,
      managerId: 'staff_mgr'
    };
    var tape = tickAggregate(books, books.locations.kiosk);
    if (!(tape.profit > 0 && tape.profit < tape.sales)) reasons.push('agg ' + tape.profit);
    if (fidelity(books, 'kiosk') !== 'aggregate') reasons.push('fidelity');
    if (fidelity(books, 'mart') !== 'full') reasons.push('full');
    var bare = tickAggregate(books, {
      id: 'empty',
      name: 'Empty',
      open: true,
      kind: 'store',
      stock: { cocoa: 2 },
      managerId: null
    });
    if (!bare.complaints.length || bare.sales > tape.sales) reasons.push('bare');
    var mall = { leases: {} };
    var no = lease(mall, 'a', 'repair', 5000, { security: 1 });
    if (no.accepted) reasons.push('overpay accepted');
    var yes = lease(mall, 'a', 'repair', 1000, { security: 0 });
    if (!yes.accepted || !yes.complaints.length || yes.traffic >= 0.82) reasons.push('complaint');
    var happy = lease(mall, 'b', 'repair', 1000, { security: 1 });
    if (!happy.accepted || happy.complaints.length) reasons.push('happy');
    var player = econ.blankBooks();
    player.cash = 5000;
    var signed = signLease(player, 'a', 'repair', 1000);
    if (!signed.accepted || !signed.complaints.length) reasons.push('sign');
    if (income(player) !== signed.rentPaid) reasons.push('income ' + income(player));
    var card = nextComplaint(player);
    if (!card || card.wants !== 'security' || card.cost !== 900) reasons.push('card');
    if (!(player.mall.door < 0.9)) reasons.push('door ' + player.mall.door);
    var bought = buyCommon(player, 'security');
    if (!bought.ok || nextComplaint(player) || player.mall.leases.a.rentPaid !== 1000) reasons.push('bought');
    if (player.cash !== 4100) reasons.push('cash ' + player.cash);
    var floor = tenantLayout('toys_pop');
    var door = false;
    var reg = false;
    if (!floor || floor.worldW !== 1280) reasons.push('tenant size');
    else floor.fixtures.forEach(function (f) {
      if (f.type === 'door') door = true;
      if (f.type === 'register') reg = true;
    });
    if (!door || !reg) reasons.push('tenant floor');
    if (!tenantLayout('repair') || !tenantLayout('cafe_chain') || !tenantLayout('seasonal')) reasons.push('tenant set');
    var paradeEarly = retune(player, 'parade');
    if (paradeEarly.ok) reasons.push('parade early');
    player.mall.commons.events = 1;
    var parade = retune(player, 'parade');
    if (!parade.ok || !player.mall.retune || player.mall.retune.kind !== 'parade' || player.mall.retune.door !== 1) reasons.push('parade');
    var black = retune(player, 'blackout');
    if (!black.ok || player.mall.retune.kind !== 'blackout' || Math.abs(player.mall.retune.door - 0.84) > 0.001) reasons.push('blackout');
    player.mall.commons.parking = 1;
    if (retune(player, 'blackout').ok) reasons.push('lit blackout');
    var visit = retune(player, 'visit');
    if (!visit.ok || player.mall.retune.kind !== 'visit') reasons.push('visit');
    if (!(player.mall.retune.door > 1 && player.mall.retune.door < 1.2)) reasons.push('visit door ' + (player.mall.retune && player.mall.retune.door));
    if (player.cash !== 4100) reasons.push('retune cash');
    if (tape.rent !== 520) reasons.push('kiosk rent ' + tape.rent);
    var flagTape = tickAggregate(books, {
      id: 'back',
      name: 'Back mart',
      open: true,
      kind: 'flagship',
      stock: { cocoa: 90, paper: 70 },
      managerId: 'staff_mgr'
    });
    if (flagTape.rent !== 220) reasons.push('flag rent ' + flagTape.rent);
    var martLoc = function () {
      return {
        id: 'mart',
        name: 'Holiday Rush Mart',
        open: true,
        kind: 'flagship',
        stock: { cocoa: 90, paper: 80, candy: 70 },
        managerId: 'staff_mgr'
      };
    };
    var dayA = tickAggregate(econ.blankBooks(), martLoc(), { day: 0, ymd: '2026-10-22' });
    var dayB = tickAggregate(econ.blankBooks(), martLoc(), { day: 6, ymd: '2026-10-22' });
    if (!(dayA.profit > 0 && dayB.profit > 0) || dayA.profit === dayB.profit) reasons.push('flat day ' + dayA.profit + ' ' + dayB.profit);
    var skilledBooks = econ.blankBooks();
    skilledBooks.staff.staff_mgr.skill = 5;
    var trained = tickAggregate(skilledBooks, martLoc(), { day: 1, ymd: '2026-10-22' });
    var greenBooks = econ.blankBooks();
    greenBooks.staff.staff_mgr.skill = 1;
    var green = tickAggregate(greenBooks, martLoc(), { day: 1, ymd: '2026-10-22' });
    if (!(trained.sales > green.sales)) reasons.push('staff ' + trained.sales + ' ' + green.sales);
    var walked = negotiate(econ.blankBooks(), 'a', 'repair', 500);
    if (walked.status !== 'walk') reasons.push('walk ' + walked.status);
    var countered = negotiate(econ.blankBooks(), 'a', 'repair', 1000);
    if (countered.status !== 'counter' || countered.rent !== 1130) reasons.push('counter ' + countered.rent);
    var taken = negotiate(econ.blankBooks(), 'a', 'repair', 1300);
    if (taken.status !== 'accept' || taken.rent !== 1300) reasons.push('accept');
    var refused = negotiate(econ.blankBooks(), 'a', 'repair', 1500);
    if (refused.status !== 'refuse') reasons.push('neg refuse');
    var perk = negotiate(econ.blankBooks(), 'a', 'repair', 1050, countered);
    if (perk.status !== 'perk' || perk.perk !== 'security') reasons.push('perk ' + perk.status);
    var perkWalk = negotiate(econ.blankBooks(), 'a', 'repair', 1050, perk);
    if (perkWalk.status !== 'walk') reasons.push('perk walk ' + perkWalk.status);
    var lowPush = negotiate(econ.blankBooks(), 'a', 'repair', 900, countered);
    if (lowPush.status !== 'walk') reasons.push('low push ' + lowPush.status);
    var cap = negotiate(econ.blankBooks(), 'a', 'repair', 1400);
    if (cap.status !== 'accept' || !cap.reason || cap.reason.indexOf('cap') < 0) reasons.push('cap');
    var toysGoal = tenantLayout('toys_pop');
    if (!toysGoal || Math.abs(toysGoal.goalMul - 1.59) > 0.02) reasons.push('toys goal');
    var repairGoal = tenantLayout('repair');
    if (!repairGoal || Math.abs(repairGoal.goalMul - 1.12) > 0.02) reasons.push('repair goal');
    var cafeGoal = tenantLayout('cafe_chain');
    if (!cafeGoal || Math.abs(cafeGoal.goalMul - 1) > 0.02) reasons.push('cafe goal');
    var seasonGoal = tenantLayout('seasonal');
    if (!seasonGoal || Math.abs(seasonGoal.goalMul - 1.12) > 0.02) reasons.push('season goal');
    var kioskLayout = data.get().layouts.kiosk;
    if (!kioskLayout || Math.abs(kioskLayout.goalMul - 0.54) > 0.02) reasons.push('kiosk goal');
    if (!kioskLayout || kioskLayout.mechanic !== 'wrap') reasons.push('kiosk mechanic');
    if (!kioskLayout || kioskLayout.crowd !== 'gift') reasons.push('kiosk crowd');
    var ev0 = calendarEvent(0);
    if (!ev0 || ev0.id !== 'lighting') reasons.push('cal');
    var goal = dailyGoal('2026-10-22');
    var goalAgain = dailyGoal('2026-10-22');
    if (!goal || goal.id !== goalAgain.id) reasons.push('daily');
    var shyBooks = econ.blankBooks();
    shyBooks.cash = 80;
    var shy = claimDaily(shyBooks, '2026-10-22', { walkouts: 0, goalPct: 1, bestCombo: 4 });
    if (shy.claimed || shyBooks.cash !== 80) reasons.push('hot till');
    var payer = econ.blankBooks();
    payer.cash = 100;
    var met = { walkouts: 0, goalPct: 1, bestCombo: 7 };
    var first = claimDaily(payer, '2026-10-22', met);
    if (!first.claimed || first.bonus !== goal.bonus || payer.cash !== 100 + goal.bonus) reasons.push('claim ' + payer.cash);
    var second = claimDaily(payer, '2026-10-22', met);
    if (second.claimed || second.reason !== 'already' || payer.cash !== 100 + goal.bonus) reasons.push('twice');
    var missBooks = econ.blankBooks();
    missBooks.cash = 50;
    var miss = claimDaily(missBooks, '2026-10-23', { walkouts: 99, goalPct: 0, bestCombo: 0 });
    if (miss.claimed || missBooks.cash !== 50) reasons.push('miss');
    if (player.cash !== 4100) reasons.push('neg cash');
    return { ok: reasons.length === 0, reason: reasons.join('; '), sample: tape.profit };
  }

  var api = {
    activeLayout: activeLayout,
    fidelity: fidelity,
    tickAggregate: tickAggregate,
    closeBackground: closeBackground,
    lease: lease,
    ensureMall: ensureMall,
    signLease: signLease,
    endLease: endLease,
    buyCommon: buyCommon,
    refreshMall: refreshMall,
    income: income,
    nextComplaint: nextComplaint,
    commonCost: commonCost,
    commonName: commonName,
    tenantLayout: tenantLayout,
    retune: retune,
    negotiate: negotiate,
    calendarEvent: calendarEvent,
    dailyGoal: dailyGoal,
    dailyMet: dailyMet,
    claimDaily: claimDaily,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.world = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
