(function (root) {
  'use strict';

  function defs() {
    var data = root.HRParts && root.HRParts.data;
    if (!data) throw new Error('data');
    return data.get();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
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

  function has(books, id) {
    return books.expansions.indexOf(id) >= 0;
  }

  function activeLoc(books) {
    return books.locations[books.active];
  }

  function itemUnlocked(books, item) {
    if (!item.unlock || item.unlock === 'start') return true;
    if (item.unlock === 'cafe') return hasFixture(books, 'cafe');
    return has(books, item.unlock);
  }

  function hasFixture(books, type) {
    var loc = activeLoc(books);
    if (!loc || !loc.layout) return false;
    for (var i = 0; i < loc.layout.fixtures.length; i++) {
      if (loc.layout.fixtures[i].type === type) return true;
    }
    return false;
  }

  function availableItems(books) {
    var list = [];
    var items = defs().items.items;
    for (var i = 0; i < items.length; i++) {
      if (itemUnlocked(books, items[i])) list.push(items[i]);
    }
    return list;
  }

  function priceOf(books, item) {
    var n = books.prices[item.id];
    if (n == null) return item.msrp;
    return n;
  }

  function markup(item, price) {
    return item.msrp > 0 ? price / item.msrp : 1;
  }

  function priceDemand(item, price) {
    var econ = defs().economy;
    var m = markup(item, price);
    if (m >= econ.refuseMarkup) return 0;
    return clamp(1 - (m - 1) * econ.priceElasticity, 0.42, 1.22);
  }

  function shelfReaction(item, price, roll) {
    if (!item) return { act: 'take' };
    if (priceDemand(item, price) === 0) return { act: 'refuse', bubble: 'price' };
    if (markup(item, price) > 1.2 && roll < 0.55) return { act: 'grumble', bubble: 'price', patience: 0.72 };
    return { act: 'take' };
  }

  function priceHint(item, price) {
    var m = markup(item, price);
    if (m >= 1.45) return 'They will not pay this.';
    if (m > 1.25) return 'Steep. Most shoppers pick something else.';
    if (m > 1.08) return 'Above the tag. You will hear about it.';
    if (m < 0.85) return 'A deal. The aisle gets louder and the margin thins.';
    if (m < 0.97) return 'A notch under the tag.';
    return 'On the tag. This is the price they expect.';
  }

  function demandMul(books) {
    var econ = defs().economy;
    var d = econ.demand;
    var rep = 1 + ((books.reputation || d.anchor) - d.anchor) * d.perPoint;
    var items = availableItems(books);
    var weight = 0;
    var press = 0;
    var loc = activeLoc(books);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var onHand = loc && loc.stock ? (loc.stock[it.id] || 0) : 0;
      if (!it.unlock || it.unlock === 'start' || onHand > 0 || has(books, it.unlock) || (it.unlock === 'cafe' && hasFixture(books, 'cafe'))) {
        var w = it.weight || 1;
        weight += w;
        press += w * priceDemand(it, priceOf(books, it));
      }
    }
    var price = weight ? press / weight : 1;
    return clamp(rep * price, d.min, d.max);
  }

  function trainMul(books, id) {
    var rec = books.staff && books.staff[id];
    var skill = rec && rec.skill ? rec.skill : 2;
    return 1 + (skill - 2) * 0.08;
  }

  function martRent(books) {
    var rent = defs().economy.rent;
    var n = rent.base;
    if (has(books, 'knock')) n = rent.knock;
    if (has(books, 'lane')) n = rent.lane;
    if (has(books, 'departments')) n = rent.departments;
    if (has(books, 'flagship')) n = rent.flagship;
    return n;
  }

  function rentOf(books) {
    if (books && books.active === 'kiosk') return defs().economy.rent.kiosk || 520;
    return martRent(books);
  }

  function custCap(books) {
    var caps = defs().economy.custCap;
    var n = caps.base;
    if (has(books, 'knock')) n = caps.knock;
    if (has(books, 'lane')) n = caps.lane;
    if (has(books, 'departments')) n = caps.departments;
    if (has(books, 'flagship')) n = caps.flagship;
    var layout = activeLoc(books).layout;
    var regs = 0;
    for (var i = 0; i < layout.fixtures.length; i++) {
      if (layout.fixtures[i].type === 'register') regs++;
    }
    var expected = 1;
    if (books.active === 'mart') expected = has(books, 'lane') ? 3 : 2;
    if (regs > expected) n += (regs - expected) * 3;
    return n;
  }

  function profileId(cust) {
    if (!cust) return 'regular';
    if (cust.profile) return cust.profile;
    if (cust.charId === 'cust_kid') return 'kid';
    if (cust.arch === 'family' || cust.charId === 'cust_mom') return 'family';
    if (cust.arch === 'rusher' || cust.charId === 'cust_biz') return 'rusher';
    if (cust.arch === 'haggle' || cust.charId === 'cust_karen') return 'haggle';
    if (cust.arch === 'lift' || cust.charId === 'cust_teen') return 'lift';
    return 'regular';
  }

  function quote(books, cust, rng, stockBag) {
    var loc = activeLoc(books);
    var source = stockBag || (loc && loc.stock) || {};
    var stock = {};
    var key;
    for (key in source) stock[key] = source[key] || 0;
    var items = availableItems(books);
    var profile = defs().customers.byId[profileId(cust)] || defs().customers.byId.regular;
    var units = Math.max(1, Math.round((2.4 + rng() * 1.8) * (cust.basketMul || 1) * (profile.units || 1)));
    var revenue = 0;
    var cogs = 0;
    var taken = {};
    var any = false;
    for (var n = 0; n < units; n++) {
      var pick = pickItem(items, stock, profile, books, rng);
      if (!pick) break;
      any = true;
      stock[pick.id] -= 1;
      revenue += priceOf(books, pick);
      cogs += pick.wholesale;
      taken[pick.id] = (taken[pick.id] || 0) + 1;
    }
    if (!any) return { ok: false, reason: 'warehouse' };
    return { ok: true, revenue: revenue, cogs: cogs, taken: taken, label: labelOf(taken) };
  }

  function pickItem(items, stock, profile, books, rng) {
    var total = 0;
    var rolls = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if ((stock[it.id] || 0) < 1) continue;
      var demand = priceDemand(it, priceOf(books, it));
      if (demand <= 0) continue;
      var pref = (profile.prefs && profile.prefs[it.id]) || 0.35;
      var w = (it.weight || 1) * pref * demand;
      if (w <= 0) continue;
      total += w;
      rolls.push({ item: it, w: total });
    }
    if (!total) return null;
    var roll = rng() * total;
    for (var r = 0; r < rolls.length; r++) {
      if (roll <= rolls[r].w) return rolls[r].item;
    }
    return rolls[rolls.length - 1].item;
  }

  function labelOf(taken) {
    var best = '';
    var n = 0;
    var id;
    for (id in taken) {
      if (taken[id] > n) {
        n = taken[id];
        best = id;
      }
    }
    if (!best) return '';
    var item = defs().items.byId[best];
    var extra = 0;
    for (id in taken) if (id !== best) extra += taken[id];
    var name = item ? item.name : best;
    if (extra > 0) return name + ' ×' + n + ' +' + extra;
    return name + ' ×' + n;
  }

  function consume(books, quoted, stockBag) {
    if (!quoted || !quoted.ok) return;
    var stock = stockBag || activeLoc(books).stock;
    var id;
    for (id in quoted.taken) stock[id] = Math.max(0, (stock[id] || 0) - quoted.taken[id]);
  }

  function stockUnits(stock) {
    var n = 0;
    var id;
    if (!stock) return 0;
    for (id in stock) n += +stock[id] || 0;
    return n;
  }

  function unitsLeft(books, stockBag) {
    var loc = activeLoc(books);
    return stockUnits(stockBag || (loc && loc.stock) || {});
  }

  function ensureTenantStock(lease) {
    if (!lease) return { stock: {}, units: 0, filled: false };
    var units = stockUnits(lease.stock);
    if (units >= 1) return { stock: lease.stock, units: units, filled: false };
    lease.stock = starterStock(1);
    return { stock: lease.stock, units: stockUnits(lease.stock), filled: true };
  }

  function shiftUse(books, id) {
    var items = availableItems(books);
    var item = defs().items.byId[id];
    if (!item) return 0;
    var sum = 0;
    for (var i = 0; i < items.length; i++) sum += items[i].weight || 1;
    if (!sum) return 0;
    var econ = defs().economy;
    return Math.max(4, Math.round(econ.checkoutsPerShift * econ.unitsPerBasket * (item.weight || 1) / sum));
  }

  function caseCost(item) {
    return item.wholesale * defs().economy.caseUnits;
  }

  var milestoneListener = null;

  function milestone(books, id) {
    if (!books.milestones) books.milestones = [];
    if (books.milestones.indexOf(id) >= 0) return false;
    books.milestones.push(id);
    if (milestoneListener) milestoneListener(books, id);
    return true;
  }

  function listenMilestones(fn) {
    milestoneListener = fn;
  }

  function serviceScore(books, report) {
    var wait = report.checkouts > 0 ? report.walkouts / report.checkouts : (report.walkouts > 0 ? 1 : 0.2);
    var stock = report.stockouts > 0 ? Math.min(1, report.stockouts / 8) : 0;
    var items = availableItems(books);
    var weight = 0;
    var mark = 0;
    for (var i = 0; i < items.length; i++) {
      var w = items[i].weight || 1;
      weight += w;
      mark += w * markup(items[i], priceOf(books, items[i]));
    }
    var avg = weight ? mark / weight : 1;
    var pricePen = Math.max(0, avg - 1) * 1.1;
    var goal = clamp(report.goalPct || 0, 0, 1);
    var score = 5 * (
      0.46 * clamp(1 - wait * 1.35, 0, 1) +
      0.28 * goal +
      0.18 * (1 - stock) +
      0.08 * clamp(1 - pricePen, 0, 1)
    );
    if (avg < 0.95) score += 0.15;
    return clamp(score, 1, 5);
  }

  function reviewLines(books, report, score) {
    var lines = [];
    var wait = report.checkouts > 0 ? report.walkouts / report.checkouts : 0;
    if (wait > 0.18) lines.push('I left. The line did not move, and the kid behind me left too.');
    if ((report.stockouts || 0) > 0) lines.push('The shelf I wanted was a hole. The back room did not have it either.');
    var items = availableItems(books);
    var steep = null;
    var deal = null;
    for (var i = 0; i < items.length; i++) {
      var m = markup(items[i], priceOf(books, items[i]));
      if (m > 1.12 && !steep) steep = items[i];
      if (m < 0.9 && !deal) deal = items[i];
    }
    if (steep) lines.push(steep.name + ' is ' + money(priceOf(books, steep)) + '. The tag in my head was ' + money(steep.msrp) + '.');
    if (deal) lines.push(deal.name + ' is a deal at ' + money(priceOf(books, deal)) + '. I will bring the cousins.');
    if (!lines.length && score >= 4) lines.push('Checked out with a full basket. The till knew the drawer.');
    if (!lines.length) lines.push('It was a store. I got what I came for and I did not tell anyone.');
    return lines.slice(0, 3);
  }

  function closeShift(books, report) {
    var sales = Math.round(report.sales || 0);
    var cogs = Math.round(report.cogs || 0);
    var wages = Math.round(report.wages || 0);
    var rent = rentOf(books);
    var loanPay = 0;
    if (books.loan && books.loan.left > 0) {
      loanPay = Math.min(books.loan.payment, books.loan.remaining);
    }
    var leaseIn = 0;
    if (books.mall && books.mall.leases && root.HRParts.world && root.HRParts.world.income) {
      leaseIn = root.HRParts.world.income(books);
    }
    var profit = sales - cogs - wages - rent - loanPay + leaseIn;
    books.cash = Math.round((books.cash || 0) + profit);
    if (books.loan && loanPay > 0) {
      books.loan.remaining -= loanPay;
      books.loan.left -= 1;
      if (books.loan.remaining <= 0 || books.loan.left <= 0) {
        books.loan = null;
        milestone(books, 'loan-paid');
      }
    }
    if (books.cash < 0) {
      books.reputation = clamp(books.reputation - 0.35, 1, 5);
      books.cash = 0;
    }
    var score = serviceScore(books, report);
    var econ = defs().economy;
    books.reputation = clamp(books.reputation * econ.repMemory + score * (1 - econ.repMemory), 1, 5);
    var lines = reviewLines(books, report, score);
    books.reviews.unshift({ score: Math.round(score * 10) / 10, lines: lines, profit: profit });
    if (books.reviews.length > 6) books.reviews.length = 6;
    books.shifts += 1;
    books.lifetimeProfit = Math.round((books.lifetimeProfit || 0) + profit);
    if (profit > 0) milestone(books, 'profit');
    Object.keys(books.staff).forEach(function (id) {
      var rec = books.staff[id];
      if (rec.trainingNow) {
        rec.trainingNow = false;
        rec.skill = Math.min(econ.maxSkill, (rec.skill || 1) + 1);
        milestone(books, 'trained');
      }
    });
    var loc = activeLoc(books);
    loc.reputation = books.reputation;
    return {
      sales: sales,
      cogs: cogs,
      wages: wages,
      rent: rent,
      loanPay: loanPay,
      leaseIn: leaseIn,
      profit: profit,
      cash: books.cash,
      reputation: Math.round(books.reputation * 100) / 100,
      score: Math.round(score * 10) / 10,
      reviews: lines
    };
  }

  function bounds(item) {
    var econ = defs().economy;
    return {
      min: Math.round(item.msrp * econ.priceMin),
      max: Math.round(item.msrp * econ.priceMax)
    };
  }

  function setPrice(books, id, next) {
    var item = defs().items.byId[id];
    if (!item || !itemUnlocked(books, item)) return { ok: false, msg: 'That item is not on the floor.' };
    var box = bounds(item);
    next = Math.round(next);
    if (next < box.min || next > box.max) return { ok: false, msg: item.name + ' stays between ' + money(box.min) + ' and ' + money(box.max) + '.' };
    books.prices[id] = next;
    books.playedPrice = true;
    milestone(books, 'price');
    return { ok: true, msg: item.name + ' is ' + money(next) + '. ' + priceHint(item, next) };
  }

  function buyCase(books, id, locId) {
    var item = defs().items.byId[id];
    if (!item || !itemUnlocked(books, item)) return { ok: false, msg: 'Not on the floor yet.' };
    var cost = caseCost(item);
    if (books.cash < cost) return { ok: false, msg: 'A case of ' + item.name + ' is ' + money(cost) + '.' };
    var loc = books.locations[locId || books.active];
    if (!loc) return { ok: false, msg: 'No store.' };
    books.cash -= cost;
    loc.stock[id] = (loc.stock[id] || 0) + defs().economy.caseUnits;
    milestone(books, 'stock');
    return { ok: true, msg: 'A case of ' + item.name + ' is in the back. ' + money(cost) + '.' };
  }

  function transferStock(books, id, fromId, toId) {
    var item = defs().items.byId[id];
    if (!item) return { ok: false, msg: 'That item is not in the catalog.' };
    var from = books.locations[fromId];
    var to = books.locations[toId];
    if (!from || !to || fromId === toId) return { ok: false, msg: 'Both stores have to be open.' };
    var units = defs().economy.caseUnits;
    if ((from.stock[id] || 0) < units) return { ok: false, msg: from.name + ' does not have a full case of ' + item.name + '.' };
    from.stock[id] -= units;
    to.stock[id] = (to.stock[id] || 0) + units;
    milestone(books, 'transfer');
    return { ok: true, msg: 'A case of ' + item.name + ' moved to ' + to.name + '. The register did not move.' };
  }

  function hireDef(id) {
    return defs().staff.byId[id] || null;
  }

  function ensureStaff(books, id, skill, employed) {
    if (!books.staff[id]) {
      books.staff[id] = { skill: skill, employed: employed, trainQueued: false, trainingNow: false };
    }
    return books.staff[id];
  }

  function employedCount(books, role) {
    var n = 0;
    var starters = defs().staff.starters;
    for (var i = 0; i < starters.length; i++) {
      var rec = books.staff[starters[i].id];
      if (rec && rec.employed) n++;
    }
    var hires = defs().staff.hires;
    for (var h = 0; h < hires.length; h++) {
      var row = books.staff[hires[h].id];
      if (!row || !row.employed) continue;
      if (!role || hires[h].role === role) n++;
    }
    return n;
  }

  function registerCover(books) {
    var n = 0;
    function count(id, role) {
      var rec = books.staff[id];
      if (rec && rec.employed && (role === 'register' || role === 'manager')) n++;
    }
    var starters = {
      staff_mgr: 'manager', staff_reg1: 'register', staff_reg2: 'register',
      staff_frt1: 'freight', staff_frt2: 'freight', staff_flr1: 'floor', staff_flr2: 'floor', staff_flr3: 'floor'
    };
    Object.keys(starters).forEach(function (id) { count(id, starters[id]); });
    defs().staff.hires.forEach(function (h) { count(h.id, h.role); });
    return n;
  }

  function hire(books, id) {
    var row = hireDef(id);
    if (!row) return { ok: false, msg: 'Nobody by that name.' };
    var rec = books.staff[id];
    if (rec && rec.employed) return { ok: false, msg: row.name + ' already has a badge.' };
    if (row.needsRep && books.reputation < row.needsRep) {
      return { ok: false, msg: row.name + ' waits until the reviews are stronger.' };
    }
    var cost = row.signing || 0;
    if (books.cash < cost) return { ok: false, msg: 'Signing ' + row.name + ' costs ' + money(cost) + '.' };
    books.cash -= cost;
    rec = ensureStaff(books, id, row.skill, true);
    rec.employed = true;
    rec.skill = rec.skill || row.skill;
    milestone(books, 'hire');
    return { ok: true, msg: row.name + ' is on the crew. ' + money(row.wage) + '/hr, skill ' + rec.skill + '.' };
  }

  function roleOf(id) {
    var hireRow = hireDef(id);
    if (hireRow) return hireRow.role;
    if (id === 'staff_mgr') return 'manager';
    if (id.indexOf('reg') >= 0) return 'register';
    if (id.indexOf('frt') >= 0) return 'freight';
    if (id.indexOf('flr') >= 0) return 'floor';
    return 'floor';
  }

  function nameOf(id) {
    var hireRow = hireDef(id);
    if (hireRow && hireRow.name) return hireRow.name;
    var starters = defs().staff.starters;
    for (var i = 0; i < starters.length; i++) {
      if (starters[i].id === id && starters[i].name) return starters[i].name;
    }
    return id;
  }

  function fire(books, id) {
    var rec = books.staff[id];
    if (!rec || !rec.employed) return { ok: false, msg: 'They are not on the crew.' };
    if ((roleOf(id) === 'register' || roleOf(id) === 'manager') && registerCover(books) <= 1) {
      return { ok: false, msg: 'Someone has to run a till.' };
    }
    var wage = wageOf(id);
    var due = wage * 4 * defs().economy.severanceShifts;
    if (books.cash < due) return { ok: false, msg: 'Severance is ' + money(due) + '.' };
    books.cash -= due;
    rec.employed = false;
    rec.trainQueued = false;
    rec.trainingNow = false;
    books.reputation = clamp(books.reputation - defs().economy.fireRep, 1, 5);
    clearManager(books, id);
    return { ok: true, msg: nameOf(id) + ' is off the crew. Severance ' + money(due) + '. The reviews noticed.' };
  }

  function wageOf(id) {
    var hireRow = hireDef(id);
    if (hireRow) return hireRow.wage;
    if (id === 'staff_mgr') return 26;
    return 16;
  }

  function clearManager(books, id) {
    Object.keys(books.locations).forEach(function (locId) {
      var loc = books.locations[locId];
      if (loc && loc.managerId === id) loc.managerId = null;
    });
  }

  function train(books, id) {
    var rec = books.staff[id];
    if (!rec || !rec.employed) return { ok: false, msg: 'Hire them first.' };
    var econ = defs().economy;
    if ((rec.skill || 1) >= econ.maxSkill) return { ok: false, msg: 'Nothing left to teach.' };
    if ((roleOf(id) === 'register' || roleOf(id) === 'manager') && registerCover(books) <= 1) {
      return { ok: false, msg: 'Training them empties the only till.' };
    }
    var cost = econ.trainCostPerSkill * (rec.skill || 1);
    if (books.cash < cost) return { ok: false, msg: 'The class is ' + money(cost) + '.' };
    if (rec.trainQueued) return { ok: false, msg: 'Already on the list for the next shift.' };
    books.cash -= cost;
    rec.trainQueued = true;
    return { ok: true, msg: nameOf(id) + ' is off the floor next shift. They come back sharper.' };
  }

  function managerSkill(books) {
    var best = 0;
    Object.keys(books.staff).forEach(function (id) {
      var rec = books.staff[id];
      if (!rec || !rec.employed) return;
      if (roleOf(id) !== 'manager') return;
      if ((rec.skill || 0) > best) best = rec.skill;
    });
    return best;
  }

  function nextBuild(books) {
    var builds = defs().economy.builds;
    for (var i = 0; i < builds.length; i++) {
      if (has(books, builds[i].id)) continue;
      return builds[i];
    }
    return null;
  }

  function needsMet(books, build) {
    if (!build || !build.needs) return false;
    for (var i = 0; i < build.needs.length; i++) {
      if (!has(books, build.needs[i])) return false;
    }
    return true;
  }

  function offeredBuilds(books) {
    var builds = defs().economy.builds;
    var out = [];
    var next = nextBuild(books);
    if (next) out.push(next);
    for (var i = 0; i < builds.length; i++) {
      var row = builds[i];
      if (has(books, row.id)) continue;
      if (next && row.id === next.id) continue;
      if (needsMet(books, row)) out.push(row);
    }
    return out;
  }

  function canBuild(books, build) {
    if (!build) return { ok: false, msg: 'The floor is as large as it gets.' };
    for (var i = 0; i < build.needs.length; i++) {
      if (!has(books, build.needs[i])) return { ok: false, msg: 'Not yet.' };
    }
    if (build.needsRep && books.reputation < build.needsRep) {
      return { ok: false, msg: 'Reviews have to reach ' + build.needsRep.toFixed(1) + ' first.' };
    }
    if (build.needsSkill && managerSkill(books) < build.needsSkill) {
      return { ok: false, msg: 'A manager needs skill ' + build.needsSkill + '. Train Maren or Andre, and they miss a shift.' };
    }
    if (books.cash < build.cost) return { ok: false, msg: money(build.cost) + ' in the register first.' };
    return { ok: true };
  }

  function starterStock(scale) {
    var stock = {};
    defs().items.items.forEach(function (it) {
      if (it.unlock === 'start') stock[it.id] = Math.round((it.startUnits || 0) * scale);
    });
    return stock;
  }

  function expand(books, id) {
    var build = defs().economy.buildById[id];
    var gate = canBuild(books, build);
    if (!gate.ok) return gate;
    books.cash -= build.cost;
    books.expansions.push(id);
    if (id === 'kiosk') {
      var layout = clone(defs().layouts.kiosk);
      books.locations.kiosk = {
        id: 'kiosk',
        name: 'Plaza Kiosk',
        open: true,
        kind: 'store',
        stock: starterStock(0.55),
        layout: layout,
        managerId: null
      };
      milestone(books, 'kiosk');
    } else {
      var add = defs().layouts.adds[id];
      var layoutMart = books.locations.mart.layout;
      if (add) {
        if (add.owned) layoutMart.owned = layoutMart.owned.concat(clone(add.owned));
        if (add.fixtures) layoutMart.fixtures = layoutMart.fixtures.concat(clone(add.fixtures));
        if (add.worldW) layoutMart.worldW = Math.max(layoutMart.worldW, add.worldW);
      }
      if (id === 'knock') {
        books.locations.mart.stock.lights = (books.locations.mart.stock.lights || 0) + 24;
        books.locations.mart.stock.plush = (books.locations.mart.stock.plush || 0) + 16;
      }
      if (id === 'departments') books.locations.mart.stock.globe = (books.locations.mart.stock.globe || 0) + 12;
      milestone(books, id);
    }
    return { ok: true, msg: build.name + ' is open. ' + build.blurb };
  }

  function loanOffer(books) {
    if (books.loan) return null;
    if ((books.shifts || 0) < 1) return null;
    var build = nextBuild(books);
    if (!build) return null;
    if (books.cash >= build.cost) return null;
    if (books.cash + defs().economy.loan.principal < build.cost * 0.7) return null;
    return defs().economy.loan;
  }

  function takeLoan(books) {
    var offer = loanOffer(books);
    if (!offer) return { ok: false, msg: 'The district is not offering a bridge.' };
    if (books.loan) return { ok: false, msg: 'One loan at a time.' };
    books.cash += offer.principal;
    books.loan = { id: offer.id, remaining: offer.payment * offer.terms, payment: offer.payment, left: offer.terms };
    milestone(books, 'loan');
    return { ok: true, msg: money(offer.principal) + ' in the register. ' + money(offer.payment) + ' comes off each of the next ' + offer.terms + ' closes.' };
  }

  function assignManager(books, locId, staffId) {
    var loc = books.locations[locId];
    if (!loc || locId === books.active) return { ok: false, msg: 'That store is the one you are running.' };
    if (staffId) {
      var rec = books.staff[staffId];
      if (!rec || !rec.employed) return { ok: false, msg: 'They are not on the crew.' };
      if (roleOf(staffId) !== 'manager' && roleOf(staffId) !== 'register') {
        return { ok: false, msg: 'Put a till lead or a manager in the other store.' };
      }
    }
    loc.managerId = staffId || null;
    return { ok: true, msg: staffId ? nameOf(staffId) + ' runs ' + loc.name + ' while you are on this floor.' : loc.name + ' is unsupervised.' };
  }

  function switchLocation(books, locId) {
    var loc = books.locations[locId];
    if (!loc || !loc.open) return { ok: false, msg: 'That store is not open.' };
    books.active = locId;
    return { ok: true, msg: 'Next shift is ' + loc.name + '. The other store runs on its lead.' };
  }

  function awayIds(books) {
    var ids = [];
    Object.keys(books.staff).forEach(function (id) {
      var rec = books.staff[id];
      if (rec && (rec.trainingNow || rec.trainQueued)) ids.push(id);
    });
    Object.keys(books.locations).forEach(function (locId) {
      if (locId === books.active) return;
      var loc = books.locations[locId];
      if (loc && loc.managerId && ids.indexOf(loc.managerId) < 0) ids.push(loc.managerId);
    });
    return ids;
  }

  function beginShiftBooks(books) {
    Object.keys(books.staff).forEach(function (id) {
      var rec = books.staff[id];
      if (rec.trainQueued) {
        rec.trainQueued = false;
        rec.trainingNow = true;
      }
    });
  }

  function blankBooks() {
    var d = defs();
    var prices = {};
    var stock = {};
    d.items.items.forEach(function (it) {
      prices[it.id] = it.msrp;
      if (it.unlock === 'start') stock[it.id] = it.startUnits;
    });
    var staff = {};
    d.staff.starters.forEach(function (s) {
      staff[s.id] = { skill: s.skill, employed: true, trainQueued: false, trainingNow: false };
    });
    return {
      v: 4,
      cash: 0,
      reputation: d.economy.startReputation,
      prices: prices,
      staff: staff,
      expansions: [],
      loan: null,
      active: 'mart',
      locations: {
        mart: {
          id: 'mart',
          name: 'Holiday Rush Mart',
          open: true,
          kind: 'flagship',
          stock: stock,
          layout: clone(d.layouts.starter),
          managerId: null
        }
      },
      reviews: [],
      milestones: [],
      posted: {},
      closed: {},
      shifts: 0,
      lifetimeProfit: 0,
      playedPrice: false,
      mall: null,
      tenantRuns: [],
      dailyClaimed: ''
    };
  }

  function normalize(raw) {
    var books = blankBooks();
    if (!raw || raw.v !== 4) return books;
    Object.keys(books).forEach(function (key) {
      if (raw[key] != null) books[key] = raw[key];
    });
    if (!books.locations || !books.locations.mart) books.locations = blankBooks().locations;
    if (!books.staff) books.staff = blankBooks().staff;
    defs().staff.starters.forEach(function (s) {
      if (!books.staff[s.id]) books.staff[s.id] = { skill: s.skill, employed: true, trainQueued: false, trainingNow: false };
    });
    return books;
  }

  function migrate(camp) {
    var books = blankBooks();
    if (camp && camp.bank) books.cash = Math.max(0, Math.round(camp.bank));
    books.migratedFrom = camp && camp.v ? ('hr_campaign_v' + camp.v) : 'new';
    return books;
  }

  function selfTest() {
    var data = root.HRParts.data;
    data.loadSync();
    var books = blankBooks();
    var reasons = [];
    function fail(msg) { reasons.push(msg); }
    if (Math.abs(demandMul(books) - 1) > 0.02) fail('demand ' + demandMul(books));
    var steepBooks = blankBooks();
    var steepCocoa = data.get().items.byId.cocoa;
    setPrice(steepBooks, 'cocoa', Math.round(steepCocoa.msrp * 1.45));
    var steepDemand = demandMul(steepBooks);
    if (!(steepDemand < 0.78)) fail('steep demand ' + steepDemand);
    if (trainMul(books, 'staff_reg1') !== 1) fail('train');
    if (custCap(books) !== 14) fail('cap');
    var rngState = 1;
    function rng() {
      rngState = (rngState + 0x6D2B79F5) | 0;
      var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var sum = 0;
    var n = 0;
    for (var i = 0; i < 240; i++) {
      var q = quote(books, { profile: 'regular', basketMul: 1 }, rng);
      if (!q.ok) continue;
      sum += q.revenue;
      n++;
    }
    var mean = n ? sum / n : 0;
    if (mean < 64 || mean > 88) fail('basket ' + mean);
    var tape = closeShift(books, { sales: 7500, cogs: 3750, wages: 520, walkouts: 2, checkouts: 30, stockouts: 0, goalPct: 1 });
    if (tape.profit !== 3010) fail('profit ' + tape.profit);
    if (tape.rent !== 220) fail('rent');
    var moved = migrate({ v: 1, bank: 1800 });
    if (moved.cash !== 1800 || moved.v !== 4) fail('migrate');
    var broke = setPrice(books, 'cocoa', 5);
    if (broke.ok) fail('price floor');
    var steep = setPrice(blankBooks(), 'cocoa', 26);
    if (!steep.ok) fail('msrp');
    var cocoa = data.get().items.byId.cocoa;
    var refused = shelfReaction(cocoa, Math.round(cocoa.msrp * 1.45), 0);
    if (refused.act !== 'refuse') fail('refuse');
    if (shelfReaction(cocoa, cocoa.msrp, 0).act !== 'take') fail('take');
    if (shelfReaction(cocoa, Math.round(cocoa.msrp * 1.3), 0.1).act !== 'grumble') fail('grumble');
    if (shelfReaction(cocoa, Math.round(cocoa.msrp * 1.3), 0.9).act !== 'take') fail('grumble pass');
    var leased = blankBooks();
    leased.mall = { leases: { a: { rentPaid: 400 } } };
    var withRent = closeShift(leased, { sales: 7500, cogs: 3750, wages: 520, walkouts: 0, checkouts: 30, stockouts: 0, goalPct: 1 });
    if (withRent.profit !== 3410 || withRent.leaseIn !== 400) fail('lease profit ' + withRent.profit);
    var kioskBooks = blankBooks();
    kioskBooks.active = 'kiosk';
    if (rentOf(kioskBooks) !== 520) fail('kiosk rent ' + rentOf(kioskBooks));
    if (rentOf(blankBooks()) !== 220) fail('mart rent');
    var movedBooks = blankBooks();
    var cocoaBefore = movedBooks.locations.mart.stock.cocoa;
    var cashBefore = movedBooks.cash;
    movedBooks.locations.kiosk = { id: 'kiosk', name: 'Plaza Kiosk', stock: { cocoa: 0 }, layout: { fixtures: [] } };
    var movedCase = transferStock(movedBooks, 'cocoa', 'mart', 'kiosk');
    if (!movedCase.ok) fail('transfer');
    if (movedBooks.cash !== cashBefore) fail('transfer cash');
    if (movedBooks.locations.mart.stock.cocoa !== cocoaBefore - 40) fail('transfer mart');
    if (movedBooks.locations.kiosk.stock.cocoa !== 40) fail('transfer kiosk');
    var bagBooks = blankBooks();
    var bagCocoa = bagBooks.locations.mart.stock.cocoa;
    var bag = starterStock(1);
    var bagQuote = quote(bagBooks, { profile: 'regular', basketMul: 1 }, rng, bag);
    if (!bagQuote.ok) fail('tenant bag quote');
    consume(bagBooks, bagQuote, bag);
    if (bagBooks.locations.mart.stock.cocoa !== bagCocoa) fail('tenant bag drained mart');
    if (stockUnits(bag) >= stockUnits(starterStock(1))) fail('tenant bag unused');
    var emptyLease = {};
    var seeded = ensureTenantStock(emptyLease);
    if (!seeded.filled || seeded.units < 40) fail('tenant seed');
    var mug = data.get().items.byId.mug;
    if (itemUnlocked(blankBooks(), mug)) fail('mug early');
    var cafeBooks = blankBooks();
    cafeBooks.locations.kiosk = { id: 'kiosk', layout: data.get().layouts.kiosk, stock: {} };
    cafeBooks.active = 'kiosk';
    if (!itemUnlocked(cafeBooks, mug)) fail('mug kiosk');
    var kioskDef = data.get().economy.buildById.kiosk;
    if (!kioskDef || kioskDef.needs.indexOf('lane') < 0 || kioskDef.needs.indexOf('flagship') >= 0) fail('kiosk needs');
    if (kioskDef.needsRep || kioskDef.needsSkill) fail('kiosk gate');
    if (!(kioskDef.cost > 0) || kioskDef.cost > 8000) fail('kiosk cost ' + kioskDef.cost);
    var earlyKiosk = blankBooks();
    earlyKiosk.cash = 20000;
    expand(earlyKiosk, 'knock');
    expand(earlyKiosk, 'lane');
    if (earlyKiosk.cash !== 20000 - 1600 - 3200) fail('kiosk spent ' + earlyKiosk.cash);
    var kioskGate = canBuild(earlyKiosk, kioskDef);
    if (!kioskGate.ok) fail('kiosk early ' + (kioskGate.msg || ''));
    var offered = offeredBuilds(earlyKiosk);
    var sawKiosk = false;
    for (var oi = 0; oi < offered.length; oi++) if (offered[oi].id === 'kiosk') sawKiosk = true;
    if (!sawKiosk) fail('kiosk offer');
    return { ok: reasons.length === 0, reason: reasons.join('; '), mean: Math.round(mean * 10) / 10 };
  }

  var api = {
    money: money,
    blankBooks: blankBooks,
    normalize: normalize,
    migrate: migrate,
    demandMul: demandMul,
    trainMul: trainMul,
    custCap: custCap,
    quote: quote,
    consume: consume,
    unitsLeft: unitsLeft,
    stockUnits: stockUnits,
    ensureTenantStock: ensureTenantStock,
    starterStock: starterStock,
    shiftUse: shiftUse,
    caseCost: caseCost,
    priceOf: priceOf,
    priceDemand: priceDemand,
    markup: markup,
    shelfReaction: shelfReaction,
    priceHint: priceHint,
    bounds: bounds,
    availableItems: availableItems,
    itemUnlocked: itemUnlocked,
    setPrice: setPrice,
    buyCase: buyCase,
    transferStock: transferStock,
    milestone: milestone,
    markMilestone: milestone,
    listenMilestones: listenMilestones,
    martRent: martRent,
    hire: hire,
    fire: fire,
    train: train,
    expand: expand,
    nextBuild: nextBuild,
    offeredBuilds: offeredBuilds,
    canBuild: canBuild,
    loanOffer: loanOffer,
    takeLoan: takeLoan,
    rentOf: rentOf,
    closeShift: closeShift,
    assignManager: assignManager,
    switchLocation: switchLocation,
    awayIds: awayIds,
    beginShiftBooks: beginShiftBooks,
    wageOf: wageOf,
    nameOf: nameOf,
    roleOf: roleOf,
    managerSkill: managerSkill,
    activeLoc: activeLoc,
    has: has,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.economy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
