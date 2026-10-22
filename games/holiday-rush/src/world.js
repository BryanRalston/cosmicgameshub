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

  function tickAggregate(books, loc) {
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
    var sales = Math.round(4200 * demand * eff * stockMul * (loc.kind === 'flagship' ? 1 : 0.72));
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
    else if (skill < 3) complaints.push(econ.nameOf(loc.managerId) + ' kept the kiosk open and dropped two baskets.');
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

  function closeBackground(books) {
    var tapes = [];
    var profit = 0;
    Object.keys(books.locations).forEach(function (id) {
      if (id === books.active) return;
      var loc = books.locations[id];
      if (!loc || !loc.open) return;
      var tape = tickAggregate(books, loc);
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
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.world = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
