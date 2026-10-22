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
    el.innerHTML =
      '<p class="hr-kicker">Office</p>' +
      '<h2>' + esc(active.name) + '</h2>' +
      '<p class="hr-bank">Register ' + money(books.cash) + ' · rent ' + money(econ.rentOf(books)) + ' · reviews ' + (Math.round(books.reputation * 10) / 10).toFixed(1) + '</p>' +
      '<p class="hr-lead">The tape is the business. A retry replaces that shift’s profit. It does not stack.</p>' +
      reviewHtml +
      '<section class="hr-office__block"><h3>Prices and the back room</h3>' + priceRows + send + '</section>' +
      '<section class="hr-office__block"><h3>Crew</h3>' + crew + '</section>' +
      '<section class="hr-office__block"><h3>Next build</h3>' + buildBlock + loanBlock +
      '<button type="button" class="btn" data-layout="1">Arrange the floor</button></section>' +
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
        var next = econ.priceOf(books, item) + (+btn.getAttribute('data-dir') || 0);
        msg = econ.setPrice(books, itemId, next).msg;
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
      : '<p class="hr-fine">Pale tiles are the path from the door. A walled-off till or gondola does not sell.</p>';
    el.innerHTML =
      '<p class="hr-kicker">Floor</p><h2>Arrange the fixtures</h2>' +
      warns +
      '<div class="hr-tools">' + buttons + '</div>' +
      '<div class="hr-board" style="--cols:' + model.cols + '">' + cells + '</div>' +
      '<div class="hr-cta"><button type="button" class="btn btn--primary" data-done="1">Back to the office</button></div>';
    el.onclick = function (ev) {
      var btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-tool')) {
        ctx.tool = btn.getAttribute('data-tool');
        mountLayout(el, ctx);
        return;
      }
      if (btn.hasAttribute('data-done')) {
        ctx.onDone();
        return;
      }
      if (!btn.hasAttribute('data-c')) return;
      var res = layoutApi().place(ctx.layout, ctx.tool || 'shelf-toys', +btn.getAttribute('data-c'), +btn.getAttribute('data-r'));
      ctx.onToast(res.msg);
      ctx.onPlaced();
      mountLayout(el, ctx);
    };
  }

  var api = { mountOffice: mountOffice, mountLayout: mountLayout, roster: roster };
  root.HRParts = root.HRParts || {};
  root.HRParts.ui = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
