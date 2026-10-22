(function (root) {
  'use strict';

  function economy() { return root.HRParts.economy; }
  function layoutApi() { return root.HRParts.layout; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return economy().money(n);
  }

  function roster(books) {
    var data = root.HRParts.data.get();
    var rows = [];
    data.staff.starters.forEach(function (s) {
      var rec = books.staff[s.id];
      if (!rec || !rec.employed) return;
      rows.push({
        id: s.id,
        name: s.name,
        role: s.role,
        skill: rec.skill || s.skill,
        wage: economy().wageOf(s.id),
        employed: true,
        trainQueued: !!rec.trainQueued,
        trainingNow: !!rec.trainingNow,
        hire: false
      });
    });
    data.staff.hires.forEach(function (h) {
      var rec = books.staff[h.id];
      rows.push({
        id: h.id,
        name: h.name,
        role: h.role,
        skill: rec && rec.skill ? rec.skill : h.skill,
        wage: h.wage,
        employed: !!(rec && rec.employed),
        trainQueued: !!(rec && rec.trainQueued),
        trainingNow: !!(rec && rec.trainingNow),
        hire: true,
        signing: h.signing || 0,
        needsRep: h.needsRep || 0,
        blurb: h.blurb || ''
      });
    });
    return rows;
  }

  function otherLocation(books) {
    var ids = Object.keys(books.locations);
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] !== books.active && books.locations[ids[i]].open) return books.locations[ids[i]];
    }
    return null;
  }

  function mountOffice(el, ctx) {
    var books = ctx.books;
    var econ = economy();
    var items = econ.availableItems(books);
    var build = econ.nextBuild(books);
    var gate = econ.canBuild(books, build);
    var loan = econ.loanOffer(books);
    var other = otherLocation(books);
    var active = books.locations[books.active];
    var rows = roster(books);
    var priceRows = items.map(function (item) {
      var price = econ.priceOf(books, item);
      var onHand = active.stock[item.id] || 0;
      var box = econ.bounds(item);
      return '<div class="hr-sku">' +
        '<div class="hr-sku__name"><b>' + esc(item.name) + '</b><span>' + onHand + ' in back · case ' + money(econ.caseCost(item)) + '</span></div>' +
        '<div class="hr-step">' +
        '<button type="button" data-price="' + esc(item.id) + '" data-dir="-1" aria-label="Lower ' + esc(item.name) + '">−</button>' +
        '<strong>' + money(price) + '</strong>' +
        '<button type="button" data-price="' + esc(item.id) + '" data-dir="1" aria-label="Raise ' + esc(item.name) + '">+</button>' +
        '</div>' +
        '<p class="hr-fine">' + esc(econ.priceHint(item, price)) + ' Tag ' + money(item.msrp) + '. Range ' + money(box.min) + '–' + money(box.max) + '.</p>' +
        '<button type="button" class="btn" data-case="' + esc(item.id) + '">Buy a case for this floor</button>' +
        '</div>';
    }).join('');
    var crew = rows.map(function (row) {
      var state = row.trainingNow ? 'In class this shift' : row.trainQueued ? 'Off the floor next shift' : 'Skill ' + row.skill;
      if (!row.employed) {
        return '<div class="hr-crewline"><div><b>' + esc(row.name) + '</b><span>' + esc(row.role) + ' · ' + money(row.wage) + '/hr · ' + esc(row.blurb) + '</span></div>' +
          '<button type="button" class="btn btn--primary" data-hire="' + esc(row.id) + '">Hire ' + money(row.signing) + '</button></div>';
      }
      return '<div class="hr-crewline"><div><b>' + esc(row.name) + '</b><span>' + esc(row.role) + ' · ' + money(row.wage) + '/hr · ' + esc(state) + '</span></div>' +
        '<div class="hr-crewline__act">' +
        '<button type="button" class="btn" data-train="' + esc(row.id) + '">Train</button>' +
        '<button type="button" class="btn" data-fire="' + esc(row.id) + '">Fire</button></div></div>';
    }).join('');
    var buildBlock = build
      ? '<article class="hr-upgrade"><div><h3>' + esc(build.name) + '</h3><p>' + esc(build.blurb) + '</p><p class="hr-fine">' + esc(gate.ok ? 'Ready.' : gate.msg) + '</p></div>' +
        '<button type="button" class="btn btn--primary" data-build="' + esc(build.id) + '"' + (gate.ok ? '' : ' disabled') + '>' + money(build.cost) + '</button></article>'
      : '<p class="hr-fine">The mart is as large as this building gets. The plaza kiosk is the second floor.</p>';
    var loanBlock = '';
    if (books.loan && books.loan.left > 0) {
      loanBlock = '<p class="hr-fine">District bridge: ' + money(books.loan.payment) + ' off each close, ' + books.loan.left + ' left.</p>';
    } else if (loan) {
      loanBlock = '<article class="hr-upgrade"><div><h3>' + esc(loan.name) + '</h3><p>' + money(loan.principal) + ' now. ' + money(loan.payment) + ' off each of the next ' + loan.terms + ' closes.</p></div>' +
        '<button type="button" class="btn btn--primary" data-loan="1">Take the bridge</button></article>';
    }
    var locBlock = '';
    var ids = Object.keys(books.locations);
    if (ids.length > 1) {
      var switches = ids.map(function (id) {
        var loc = books.locations[id];
        var on = id === books.active ? ' is-on' : '';
        return '<button type="button" class="btn' + on + '" data-switch="' + esc(id) + '">' + esc(loc.name) + '</button>';
      }).join('');
      var leads = '<option value="">Nobody on the till</option>';
      rows.forEach(function (row) {
        if (!row.employed) return;
        if (row.role !== 'manager' && row.role !== 'register') return;
        if (!other) return;
        var sel = other.managerId === row.id ? ' selected' : '';
        leads += '<option value="' + esc(row.id) + '"' + sel + '>' + esc(row.name) + ' · skill ' + row.skill + '</option>';
      });
      locBlock = '<section class="hr-office__block"><h3>Stores</h3><p class="hr-fine">You play one floor at full speed. The other store posts a tape from its lead. Prices are shared. Stock is not.</p><div class="hr-row">' + switches + '</div>' +
        (other ? '<label class="hr-leadpick">Lead at ' + esc(other.name) + '<select id="hr-lead">' + leads + '</select></label><button type="button" class="btn" data-assign="' + esc(other.id) + '">Send them over</button><p class="hr-fine">They leave the floor you are about to play.</p>' : '') +
        '</section>';
    }
    var send = '';
    if (other) {
      var opts = items.map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>';
      }).join('');
      send = '<div class="hr-send"><label>Stock ' + esc(other.name) + '<select id="hr-send-sku">' + opts + '</select></label><button type="button" class="btn" data-send="' + esc(other.id) + '">Send one case</button></div>';
    }
    var review = books.reviews && books.reviews[0];
    var reviewHtml = review
      ? '<section class="hr-office__block"><h3>Last close · ' + review.score + '/5</h3>' + review.lines.map(function (line) {
        return '<p class="hr-fine">“' + esc(line) + '”</p>';
      }).join('') + '</section>'
      : '';
    var upgrades = (ctx.upgrades || []).map(function (u) {
      var lvl = ctx.upgradeLevel(u.id);
      var maxed = lvl >= u.max;
      var cost = maxed ? 0 : u.costs[lvl];
      var afford = !maxed && books.cash >= cost;
      return '<article class="hr-upgrade"><div><h3>' + esc(u.name) + '</h3><p>' + esc(u.blurb) + '</p><p class="hr-fine">Level ' + lvl + ' of ' + u.max + '</p></div>' +
        '<button type="button" class="btn btn--primary" data-upgrade="' + esc(u.id) + '"' + (afford ? '' : ' disabled') + '>' + (maxed ? 'Maxed' : money(cost)) + '</button></article>';
    }).join('');
    var priceCoach = ctx.coachPrice
      ? '<p class="hr-coachbar" id="hr-coach-price">The tag on the gondola is the price they see. Past the sticker they grumble and lose patience. At the ceiling they walk out. Move a price and this note goes away.</p>'
      : '';
    el.innerHTML =
      priceCoach +
      '<p class="hr-kicker">Office</p>' +
      '<h2>' + esc(active.name) + '</h2>' +
      '<p class="hr-bank">Register ' + money(books.cash) + ' · rent ' + money(econ.rentOf(books)) + ' · reviews ' + (Math.round(books.reputation * 10) / 10).toFixed(1) + '</p>' +
      '<p class="hr-lead">The tape is the business. A retry replaces that shift’s profit. It does not stack.</p>' +
      reviewHtml +
      '<section class="hr-office__block"><h3>Prices and the back room</h3>' + priceRows + send + '</section>' +
      '<section class="hr-office__block"><h3>Crew</h3>' + crew + '</section>' +
      '<section class="hr-office__block"><h3>Next build</h3>' + buildBlock + loanBlock +
      '<button type="button" class="btn" data-layout="1">Arrange the floor</button>' +
      '<button type="button" class="btn" data-mall="1"' + (econ.has(books, 'knock') ? '' : ' disabled') + '>Mall map</button>' +
      (econ.has(books, 'knock') ? '' : '<p class="hr-fine">The plaza units open after you knock through the east wall.</p>') +
      '</section>' +
      locBlock +
      '<section class="hr-office__block"><h3>Floor tools</h3><p class="hr-fine">These hit the shift you are about to run: faster stocking, a hotter till, longer patience.</p>' + upgrades + '</section>' +
      '<div class="hr-cta"><button type="button" class="btn btn--primary" data-back="1">Shift map</button></div>';
    el.onclick = function (ev) {
      var btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      var msg = '';
      if (btn.hasAttribute('data-price')) {
        var itemId = btn.getAttribute('data-price');
        var item = root.HRParts.data.get().items.byId[itemId];
        var before = econ.priceOf(books, item);
        var next = before + (+btn.getAttribute('data-dir') || 0);
        var priced = econ.setPrice(books, itemId, next);
        msg = priced.msg;
        if (priced.ok && econ.priceOf(books, item) !== before) {
          ctx.coachPrice = false;
          if (ctx.onCoachPrice) ctx.onCoachPrice();
        }
      } else if (btn.hasAttribute('data-case')) {
        msg = econ.buyCase(books, btn.getAttribute('data-case'), books.active).msg;
      } else if (btn.hasAttribute('data-send')) {
        var sku = document.getElementById('hr-send-sku');
        msg = econ.buyCase(books, sku ? sku.value : '', btn.getAttribute('data-send')).msg;
      } else if (btn.hasAttribute('data-hire')) {
        msg = econ.hire(books, btn.getAttribute('data-hire')).msg;
      } else if (btn.hasAttribute('data-fire')) {
        msg = econ.fire(books, btn.getAttribute('data-fire')).msg;
      } else if (btn.hasAttribute('data-train')) {
        msg = econ.train(books, btn.getAttribute('data-train')).msg;
      } else if (btn.hasAttribute('data-build')) {
        msg = econ.expand(books, btn.getAttribute('data-build')).msg;
      } else if (btn.hasAttribute('data-loan')) {
        msg = econ.takeLoan(books).msg;
      } else if (btn.hasAttribute('data-switch')) {
        msg = econ.switchLocation(books, btn.getAttribute('data-switch')).msg;
      } else if (btn.hasAttribute('data-assign')) {
        var lead = document.getElementById('hr-lead');
        msg = econ.assignManager(books, btn.getAttribute('data-assign'), lead ? lead.value : '').msg;
      } else if (btn.hasAttribute('data-upgrade')) {
        ctx.onUpgrade(btn.getAttribute('data-upgrade'));
        return;
      } else if (btn.hasAttribute('data-layout')) {
        ctx.onLayout();
        return;
      } else if (btn.hasAttribute('data-mall')) {
        if (ctx.onMall) ctx.onMall();
        return;
      } else if (btn.hasAttribute('data-back')) {
        ctx.onBack();
        return;
      }
      if (msg) ctx.onToast(msg);
      ctx.onDirty();
      mountOffice(el, ctx);
    };
  }

  function mountLayout(el, ctx) {
    var model = layoutApi().editorModel(ctx.layout);
    var tools = [
      ['shelf-toys', 'Toys'],
      ['shelf-electronics', 'Lights'],
      ['shelf-seasonal', 'Seasonal'],
      ['register', 'Register'],
      ['cafe', 'Cafe'],
      ['wall', 'Wall'],
      ['erase', 'Erase']
    ];
    var tool = ctx.tool || 'shelf-toys';
    var buttons = tools.map(function (row) {
      var on = row[0] === tool ? ' is-on' : '';
      return '<button type="button" class="btn' + on + '" data-tool="' + row[0] + '">' + row[1] + '</button>';
    }).join('');
    var cells = model.cells.map(function (cell) {
      var cls = 'hr-tile';
      if (!cell.owned) cls += ' is-void';
      else if (cell.walk) cls += ' is-walk';
      else cls += ' is-block';
      if (cell.type) cls += ' is-' + cell.type;
      if (model.blocked.indexOf(cell.fixture) >= 0) cls += ' is-shut';
      var label = cell.label || (cell.type === 'wall' ? '' : cell.type ? cell.type.slice(0, 3) : '');
      return '<button type="button" class="' + cls + '" data-c="' + cell.c + '" data-r="' + cell.r + '" aria-label="Tile ' + cell.c + ' ' + cell.r + '">' + esc(label) + '</button>';
    }).join('');
    var warns = model.warnings.length
      ? model.warnings.map(function (w) { return '<p class="hr-warn">' + esc(w) + '</p>'; }).join('')
      : '<p class="hr-fine">Pale tiles are the path from the door. Drag a tool across the tiles. A walled-off till or gondola does not sell.</p>';
    el.innerHTML =
      '<p class="hr-kicker">Floor</p><h2>Arrange the fixtures</h2>' +
      '<div class="hr-warns">' + warns + '</div>' +
      '<div class="hr-tools">' + buttons + '</div>' +
      '<div class="hr-board" style="--cols:' + model.cols + '">' + cells + '</div>' +
      '<div class="hr-cta"><button type="button" class="btn btn--primary" data-done="1">Back to the office</button></div>';
    var dragOn = false;
    var lastKey = '';
    function paintBoard() {
      var fresh = layoutApi().editorModel(ctx.layout);
      var by = {};
      fresh.cells.forEach(function (cell) { by[cell.c + ',' + cell.r] = cell; });
      var tiles = el.querySelectorAll('.hr-board [data-c]');
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var cell = by[tile.getAttribute('data-c') + ',' + tile.getAttribute('data-r')];
        if (!cell) continue;
        var cls = 'hr-tile';
        if (!cell.owned) cls += ' is-void';
        else if (cell.walk) cls += ' is-walk';
        else cls += ' is-block';
        if (cell.type) cls += ' is-' + cell.type;
        if (fresh.blocked.indexOf(cell.fixture) >= 0) cls += ' is-shut';
        tile.className = cls;
        tile.textContent = cell.label || (cell.type === 'wall' ? '' : cell.type ? cell.type.slice(0, 3) : '');
      }
      var warn = el.querySelector('.hr-warns');
      if (warn) {
        warn.innerHTML = fresh.warnings.length
          ? fresh.warnings.map(function (w) { return '<p class="hr-warn">' + esc(w) + '</p>'; }).join('')
          : '<p class="hr-fine">Pale tiles are the path from the door. Drag a tool across the tiles. A walled-off till or gondola does not sell.</p>';
      }
    }
    function stamp(tile) {
      if (!tile) return;
      var key = tile.getAttribute('data-c') + ',' + tile.getAttribute('data-r');
      if (key === lastKey) return;
      lastKey = key;
      var res = layoutApi().place(ctx.layout, ctx.tool || 'shelf-toys', +tile.getAttribute('data-c'), +tile.getAttribute('data-r'));
      ctx.onToast(res.msg);
      ctx.onPlaced();
      paintBoard();
    }
    var board = el.querySelector('.hr-board');
    board.addEventListener('pointerdown', function (ev) {
      var tile = ev.target.closest('[data-c]');
      if (!tile || !board.contains(tile)) return;
      ev.preventDefault();
      dragOn = true;
      lastKey = '';
      stamp(tile);
      try { board.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    board.addEventListener('pointermove', function (ev) {
      if (!dragOn) return;
      var hit = document.elementFromPoint(ev.clientX, ev.clientY);
      var tile = hit && hit.closest ? hit.closest('[data-c]') : null;
      if (tile && board.contains(tile)) stamp(tile);
    });
    function endDrag() {
      if (!dragOn) return;
      dragOn = false;
      lastKey = '';
      mountLayout(el, ctx);
    }
    board.addEventListener('pointerup', endDrag);
    board.addEventListener('pointercancel', endDrag);
    el.onclick = function (ev) {
      var btn = ev.target.closest('button');
      if (!btn || btn.hasAttribute('data-c')) return;
      if (btn.hasAttribute('data-tool')) {
        ctx.tool = btn.getAttribute('data-tool');
        mountLayout(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-done')) ctx.onDone();
    };
  }

  var UI = '/games/holiday-rush/objects/ui/';
  var CHIP = {
    flagship: 'chips_4.png',
    court: 'chips_5.png',
    toys_pop: 'chips_0.png',
    repair: 'chips_1.png',
    cafe_chain: 'chips_2.png',
    seasonal: 'chips_3.png',
    vacant: 'chips_4.png'
  };

  function chipUrl(name) {
    return UI + (CHIP[name] || CHIP.vacant);
  }

  function mountMall(el, ctx) {
    var books = ctx.books;
    var world = root.HRParts.world;
    var data = root.HRParts.data.get();
    var mall = world.ensureMall(books);
    var slotId = ctx.slot || 'a';
    var slot = null;
    for (var i = 0; i < data.mall.slots.length; i++) {
      if (data.mall.slots[i].id === slotId) slot = data.mall.slots[i];
    }
    if (!slot) slot = data.mall.slots[1];
    var leaseRow = mall.leases[slot.id] || null;
    var tenant = leaseRow ? data.tenants.byId[leaseRow.tenantId] : null;
    var fronts = data.mall.slots.map(function (row) {
      var held = row.kind === 'player' ? { name: 'Your mart' } : (mall.leases[row.id] ? data.tenants.byId[mall.leases[row.id].tenantId] : null);
      var face = row.kind === 'player' ? 'flagship' : row.kind === 'common' ? 'court' : (held ? held.id : 'vacant');
      var title = row.kind === 'player' ? 'Your mart' : row.kind === 'common' ? row.name : (held ? held.name : 'Vacant');
      var sub = row.kind === 'lease'
        ? (held ? money(mall.leases[row.id].rent) + (mall.leases[row.id].openComplaint ? ' · unhappy' : '') : 'For lease')
        : (row.kind === 'player' ? 'Flagship' : 'Commons');
      var cls = 'hr-front' + (row.id === slot.id ? ' is-on' : '') + (row.kind === 'player' ? ' is-you' : '') +
        (mall.leases[row.id] && mall.leases[row.id].openComplaint ? ' is-mad' : '');
      return '<button type="button" class="' + cls + '" data-slot="' + esc(row.id) + '" style="background-image:url(' + chipUrl(face) + ')">' +
        '<b>' + esc(title) + '</b><small>' + esc(sub) + '</small></button>';
    }).join('');
    var commons = data.mall.commons.map(function (id) {
      var on = (mall.commons[id] || 0) >= 1;
      var cost = world.commonCost(id);
      return '<button type="button" class="hr-common' + (on ? ' is-on' : '') + '" data-common="' + esc(id) + '">' +
        '<i class="hr-seal" aria-hidden="true"></i><span>' + esc(world.commonName(id)) + '<small>' + (on ? 'Open' : money(cost)) + '</small></span></button>';
    }).join('');
    var panel = '';
    if (slot.kind === 'player') {
      panel = '<p class="hr-lead">This is the floor you play. The units beside it pay rent into the same register.</p>';
    } else if (slot.kind === 'common') {
      panel = '<p class="hr-lead">The food court is a common. Second Cup will not pay full rent until it is open.</p>';
    } else if (tenant) {
      panel = '<p class="hr-lead">' + esc(tenant.blurb) + '</p>' +
        '<p class="hr-fine">Rent ' + money(leaseRow.rent) + ' · they pay ' + money(leaseRow.rentPaid || 0) + ' this close.' +
        (leaseRow.openComplaint ? ' “' + esc(leaseRow.openComplaint) + '”' : ' The common they wanted is open.') + '</p>' +
        '<button type="button" class="btn btn--primary" data-play="' + esc(slot.id) + '">Play their floor</button>' +
        '<button type="button" class="btn" data-end="' + esc(slot.id) + '">End the lease</button>';
    } else {
      var pick = ctx.tenant || data.tenants.tenants[0].id;
      var chosen = data.tenants.byId[pick];
      ctx.rents = ctx.rents || {};
      if (ctx.rents[pick] == null) ctx.rents[pick] = Math.round(chosen.maxRent * 0.85);
      var rent = ctx.rents[pick];
      var chips = data.tenants.tenants.map(function (row) {
        var on = row.id === pick ? ' is-on' : '';
        return '<button type="button" class="hr-tenant' + on + '" data-tenant="' + esc(row.id) + '" style="background-image:url(' + chipUrl(row.id) + ')">' +
          '<b>' + esc(row.name) + '</b><small>up to ' + money(row.maxRent) + '</small></button>';
      }).join('');
      var want = world.commonName(chosen.wants);
      var ready = (mall.commons[chosen.wants] || 0) >= 1;
      panel = '<div class="hr-tenants">' + chips + '</div>' +
        '<p class="hr-lead">' + esc(chosen.blurb) + '</p>' +
        '<p class="hr-fine">They want ' + esc(want) + (ready ? ', and it is open.' : '. It is dark, so they will complain on the next shift and pay 85%.') + '</p>' +
        '<div class="hr-step"><button type="button" data-rent="-50" aria-label="Lower rent">−</button><strong>' + money(rent) + '</strong><button type="button" data-rent="50" aria-label="Raise rent">+</button></div>' +
        '<button type="button" class="btn btn--primary" data-sign="' + esc(slot.id) + '">Hand them the keys</button>';
    }
    var door = mall.door && Object.keys(mall.leases).length ? Math.round(mall.door * 100) : 100;
    var mallCoach = ctx.coachMall
      ? '<p class="hr-coachbar" id="hr-coach-mall">This is the plaza. Lease a unit, set the rent, and open the common they asked for. Leave it dark and they pay 85% with a thinner door. Hand someone the keys and this note goes away.</p>'
      : '';
    el.innerHTML =
      mallCoach +
      '<p class="hr-kicker">Mall</p><h2>' + esc(data.mall.name) + '</h2>' +
      '<p class="hr-bank">Register ' + money(books.cash) + ' · door ' + door + '%</p>' +
      '<p class="hr-lead">You still run the flagship. A leased unit posts rent at close. If the common they asked for is shut, the next shift opens with their complaint.</p>' +
      '<div class="hr-rowfront">' + fronts + '</div>' +
      '<section class="hr-office__block"><h3>' + esc(slot.name) + '</h3>' + panel + '</section>' +
      '<section class="hr-office__block"><h3>Commons</h3><div class="hr-commons">' + commons + '</div></section>' +
      '<div class="hr-cta"><button type="button" class="btn btn--primary" data-back="1">Back to the office</button></div>';
    el.onclick = function (ev) {
      var btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.hasAttribute('data-slot')) {
        ctx.slot = btn.getAttribute('data-slot');
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-tenant')) {
        ctx.tenant = btn.getAttribute('data-tenant');
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-rent')) {
        var id = ctx.tenant || data.tenants.tenants[0].id;
        var who = data.tenants.byId[id];
        var next = (ctx.rents[id] || 0) + (+btn.getAttribute('data-rent') || 0);
        if (next < 50) next = 50;
        if (next > who.maxRent) next = who.maxRent;
        ctx.rents[id] = next;
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-sign')) {
        var tid = ctx.tenant || data.tenants.tenants[0].id;
        var res = world.signLease(books, btn.getAttribute('data-sign'), tid, ctx.rents[tid]);
        if (res.accepted) {
          ctx.coachMall = false;
          if (ctx.onCoachMall) ctx.onCoachMall();
        }
        ctx.onToast(res.accepted ? (res.tenant + ' has the keys. ' + (res.complaints[0] || 'They are settled.')) : res.reason);
        ctx.onDirty();
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-play')) {
        if (ctx.onPlayTenant) ctx.onPlayTenant(btn.getAttribute('data-play'));
        return;
      }
      if (btn.hasAttribute('data-end')) {
        ctx.onToast(world.endLease(books, btn.getAttribute('data-end')).msg);
        ctx.onDirty();
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-common')) {
        var bought = world.buyCommon(books, btn.getAttribute('data-common'));
        ctx.onToast(bought.msg);
        if (bought.ok) ctx.onDirty();
        mountMall(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-back')) ctx.onBack();
    };
  }

  var api = { mountOffice: mountOffice, mountLayout: mountLayout, mountMall: mountMall, roster: roster };
  root.HRParts = root.HRParts || {};
  root.HRParts.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
