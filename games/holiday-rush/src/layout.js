(function (root) {
  'use strict';

  function cellSize() {
    var data = root.HRParts && root.HRParts.data && root.HRParts.data.get();
    return (data && data.fixtures && data.fixtures.cell) || 80;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function cellOf(x, y, cell) {
    return { c: Math.floor(x / cell), r: Math.floor(y / cell) };
  }

  function center(c, r, cell) {
    return { x: c * cell + cell / 2, y: r * cell + cell / 2 };
  }

  function insideOwned(layout, x, y) {
    for (var i = 0; i < layout.owned.length; i++) {
      var rect = layout.owned[i];
      if (x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h) return true;
    }
    return false;
  }

  function fixtureAt(layout, c, r, cell) {
    for (var i = 0; i < layout.fixtures.length; i++) {
      var f = layout.fixtures[i];
      var at = cellOf(f.x, f.y, cell);
      if (at.c === c && at.r === r) return f;
    }
    return null;
  }

  function blocks(type) {
    return type === 'gondola' || type === 'register' || type === 'cafe' || type === 'wall' || type === 'freight';
  }

  function walkable(layout, c, r, cell) {
    var mid = center(c, r, cell);
    if (!insideOwned(layout, mid.x, mid.y)) return false;
    var fixture = fixtureAt(layout, c, r, cell);
    if (!fixture) return true;
    if (fixture.type === 'door') return true;
    return !blocks(fixture.type);
  }

  function key(c, r) {
    return c + ',' + r;
  }

  function neighbors(c, r) {
    return [{ c: c + 1, r: r }, { c: c - 1, r: r }, { c: c, r: r + 1 }, { c: c, r: r - 1 }];
  }

  function doorCell(layout, cell) {
    for (var i = 0; i < layout.fixtures.length; i++) {
      if (layout.fixtures[i].type === 'door') return cellOf(layout.fixtures[i].x, layout.fixtures[i].y, cell);
    }
    return { c: 0, r: 0 };
  }

  function flood(layout) {
    var cell = cellSize();
    var cols = Math.max(1, Math.ceil(layout.worldW / cell));
    var rows = Math.max(1, Math.ceil(layout.worldH / cell));
    var seen = Object.create(null);
    var door = doorCell(layout, cell);
    var queue = [door];
    seen[key(door.c, door.r)] = true;
    if (!walkable(layout, door.c, door.r, cell)) {
      var found = null;
      for (var r = 0; r < rows && !found; r++) {
        for (var c = 0; c < cols; c++) {
          if (walkable(layout, c, r, cell)) { found = { c: c, r: r }; break; }
        }
      }
      if (!found) return { seen: seen, cols: cols, rows: rows, cell: cell };
      queue = [found];
      seen = {};
      seen[key(found.c, found.r)] = true;
    }
    while (queue.length) {
      var cur = queue.shift();
      var next = neighbors(cur.c, cur.r);
      for (var i = 0; i < next.length; i++) {
        var n = next[i];
        if (n.c < 0 || n.r < 0 || n.c >= cols || n.r >= rows) continue;
        var k = key(n.c, n.r);
        if (seen[k] || !walkable(layout, n.c, n.r, cell)) continue;
        seen[k] = true;
        queue.push(n);
      }
    }
    return { seen: seen, cols: cols, rows: rows, cell: cell };
  }

  function fixtureReachable(layout, fixture, floodMap) {
    var cell = floodMap.cell;
    var at = cellOf(fixture.x, fixture.y, cell);
    if (fixture.type === 'door' || fixture.type === 'truck' || fixture.type === 'aisle' || fixture.type === 'floor') {
      return !!floodMap.seen[key(at.c, at.r)] || walkable(layout, at.c, at.r, cell);
    }
    var around = neighbors(at.c, at.r);
    for (var i = 0; i < around.length; i++) {
      if (floodMap.seen[key(around[i].c, around[i].r)]) return true;
    }
    return !!floodMap.seen[key(at.c, at.r)];
  }

  function traffic(layout) {
    var map = flood(layout);
    var blocked = [];
    var warnings = [];
    for (var i = 0; i < layout.fixtures.length; i++) {
      var fixture = layout.fixtures[i];
      if (fixture.type !== 'register' && fixture.type !== 'gondola' && fixture.type !== 'cafe') continue;
      if (fixtureReachable(layout, fixture, map)) continue;
      blocked.push(fixture.id);
      var label = fixture.label || fixture.station || fixture.type;
      warnings.push(label + ' is walled off. Shoppers cannot reach it, so it does not sell.');
    }
    return { blocked: blocked, warnings: warnings, map: map };
  }

  function wantsGrid(layout) {
    return !!(layout && (layout.edited || layout.worldW > 1600));
  }

  function hasStation(layout, station) {
    if (!layout) return false;
    for (var i = 0; i < layout.fixtures.length; i++) {
      if (layout.fixtures[i].station === station) return true;
    }
    return false;
  }

  function route(layout, x, y, tx, ty) {
    if (!wantsGrid(layout)) return null;
    var cell = cellSize();
    var map = flood(layout);
    var start = cellOf(x, y, cell);
    var goal = cellOf(tx, ty, cell);
    if (!map.seen[key(start.c, start.r)]) {
      var nearest = nearestSeen(map, start);
      if (!nearest) return [];
      start = nearest;
    }
    var targets = [];
    if (map.seen[key(goal.c, goal.r)]) targets.push(goal);
    var around = neighbors(goal.c, goal.r);
    for (var i = 0; i < around.length; i++) {
      if (map.seen[key(around[i].c, around[i].r)]) targets.push(around[i]);
    }
    if (!targets.length) return [];
    var best = null;
    for (var t = 0; t < targets.length; t++) {
      var path = bfs(map, start, targets[t]);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return [];
    var points = best.map(function (step) { return center(step.c, step.r, cell); });
    points[0] = { x: x, y: y };
    points.push({ x: tx, y: ty });
    return compress(points);
  }

  function nearestSeen(map, start) {
    var best = null;
    var bestD = 1e9;
    Object.keys(map.seen).forEach(function (k) {
      var parts = k.split(',');
      var c = +parts[0];
      var r = +parts[1];
      var d = Math.abs(c - start.c) + Math.abs(r - start.r);
      if (d < bestD) { bestD = d; best = { c: c, r: r }; }
    });
    return best;
  }

  function bfs(map, start, goal) {
    var queue = [start];
    var prev = {};
    prev[key(start.c, start.r)] = null;
    while (queue.length) {
      var cur = queue.shift();
      if (cur.c === goal.c && cur.r === goal.r) break;
      var next = neighbors(cur.c, cur.r);
      for (var i = 0; i < next.length; i++) {
        var n = next[i];
        var k = key(n.c, n.r);
        if (!map.seen[k] || prev[k] !== undefined) continue;
        prev[k] = cur;
        queue.push(n);
      }
    }
    if (prev[key(goal.c, goal.r)] === undefined) return null;
    var path = [];
    var walk = goal;
    while (walk) {
      path.push(walk);
      walk = prev[key(walk.c, walk.r)];
    }
    path.reverse();
    return path;
  }

  function compress(points) {
    if (points.length < 3) return points;
    var out = [points[0]];
    for (var i = 1; i < points.length - 1; i++) {
      var a = out[out.length - 1];
      var b = points[i];
      var c = points[i + 1];
      var cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (cross !== 0) out.push(b);
    }
    out.push(points[points.length - 1]);
    return out;
  }

  function apply(layout, api) {
    var shelves = api.shelves;
    shelves.length = 0;
    var keep = {};
    var queueDy = 32;
    for (var i = 0; i < layout.fixtures.length; i++) {
      var f = layout.fixtures[i];
      if (f.type === 'gondola' || f.type === 'cafe') {
        shelves.push({ x: f.x, y: f.y, id: f.id, dept: f.dept || '', label: f.label || 'AISLE' });
      } else if (f.type === 'register' && f.station) {
        keep[f.station] = true;
        api.spots[f.station] = { x: f.x, y: f.y };
        api.queue[f.station] = { x: f.x, y: f.y + 70, dy: queueDy };
      } else if (f.type === 'door') {
        api.spots.door = { x: f.x, y: f.y };
      } else if (f.type === 'freight') {
        api.spots.freight = { x: f.x, y: f.y };
      } else if (f.type === 'truck') {
        api.spots.truck = { x: f.x, y: f.y };
      } else if (f.type === 'floor') {
        api.spots.floor = { x: f.x, y: f.y };
      }
    }
    ['reg1', 'reg2', 'reg3'].forEach(function (st) {
      if (keep[st]) return;
      delete api.spots[st];
      delete api.queue[st];
    });
    api.setWorld(layout.worldW, layout.worldH);
    if (api.setReg3) api.setReg3(!!api.spots.reg3);
  }

  function editorModel(layout) {
    var cell = cellSize();
    var flow = traffic(layout);
    var cols = flow.map.cols;
    var rows = flow.map.rows;
    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var mid = center(c, r, cell);
        var fixture = fixtureAt(layout, c, r, cell);
        var owned = insideOwned(layout, mid.x, mid.y);
        cells.push({
          c: c,
          r: r,
          owned: owned,
          walk: !!flow.map.seen[key(c, r)],
          fixture: fixture ? fixture.id : '',
          type: fixture ? fixture.type : '',
          label: fixture ? (fixture.label || fixture.station || '') : ''
        });
      }
    }
    return { cols: cols, rows: rows, cell: cell, cells: cells, warnings: flow.warnings, blocked: flow.blocked };
  }

  function place(layout, tool, c, r) {
    var cell = cellSize();
    var mid = center(c, r, cell);
    if (!insideOwned(layout, mid.x, mid.y)) return { ok: false, msg: 'That tile is not your floor. Knock through the wall first.' };
    var existing = fixtureAt(layout, c, r, cell);
    if (existing && (existing.type === 'door' || existing.type === 'truck')) {
      return { ok: false, msg: 'The door and the dock stay.' };
    }
    if (tool === 'erase') {
      if (!existing) return { ok: false, msg: 'Empty tile.' };
      if (existing.type === 'register' && countType(layout, 'register') <= 1) {
        return { ok: false, msg: 'The store needs a register.' };
      }
      layout.fixtures = layout.fixtures.filter(function (f) { return f !== existing; });
      layout.edited = true;
      return { ok: true, msg: 'Cleared.' };
    }
    var type = 'gondola';
    var dept = 'toys';
    var label = 'TOYS';
    var station = '';
    if (tool === 'shelf-electronics') { dept = 'electronics'; label = 'LIGHTS'; }
    else if (tool === 'shelf-seasonal') { dept = 'seasonal'; label = 'SEASON'; }
    else if (tool === 'register') {
      type = 'register';
      label = '';
      station = nextStation(layout, existing);
      if (!station) return { ok: false, msg: 'Three registers is the lane. Move one instead of adding a fourth.' };
    } else if (tool === 'cafe') {
      type = 'cafe';
      dept = 'cafe';
      label = 'CAFE';
    } else if (tool === 'wall') {
      type = 'wall';
      label = '';
    }
    if (existing && existing.type === 'register' && type !== 'register' && countType(layout, 'register') <= 1) {
      return { ok: false, msg: 'The store needs a register.' };
    }
    if (existing) layout.fixtures = layout.fixtures.filter(function (f) { return f !== existing; });
    var fixture = { id: 'f' + c + 'x' + r, type: type, x: mid.x, y: mid.y, dept: dept, label: label };
    if (station) fixture.station = station;
    if (existing && existing.station && type === 'register') fixture.station = existing.station;
    layout.fixtures.push(fixture);
    layout.edited = true;
    var report = traffic(layout);
    return { ok: true, msg: report.warnings.length ? report.warnings[0] : 'Placed. The pale tiles are where shoppers walk.' };
  }

  function countType(layout, type) {
    var n = 0;
    for (var i = 0; i < layout.fixtures.length; i++) if (layout.fixtures[i].type === type) n++;
    return n;
  }

  function nextStation(layout, existing) {
    if (existing && existing.station) return existing.station;
    var used = {};
    for (var i = 0; i < layout.fixtures.length; i++) {
      if (layout.fixtures[i].station) used[layout.fixtures[i].station] = true;
    }
    if (!used.reg1) return 'reg1';
    if (!used.reg2) return 'reg2';
    if (!used.reg3) return 'reg3';
    return '';
  }

  function shelvesOf(layout) {
    var list = [];
    for (var i = 0; i < layout.fixtures.length; i++) {
      var f = layout.fixtures[i];
      if (f.type === 'gondola' || f.type === 'cafe') list.push(f);
    }
    return list;
  }

  function selfTest() {
    var data = root.HRParts.data;
    data.loadSync();
    var reasons = [];
    var starter = clone(data.get().layouts.starter);
    var open = traffic(starter);
    if (open.blocked.length) reasons.push('starter blocked ' + open.blocked.join(','));
    if (route(starter, 100, 100, 200, 200) !== null) reasons.push('starter routed');
    var walled = clone(starter);
    var cell = cellSize();
    var reg = null;
    for (var i = 0; i < walled.fixtures.length; i++) if (walled.fixtures[i].station === 'reg2') reg = walled.fixtures[i];
    var at = cellOf(reg.x, reg.y, cell);
    var around = neighbors(at.c, at.r);
    for (var n = 0; n < around.length; n++) {
      var mid = center(around[n].c, around[n].r, cell);
      walled.fixtures.push({ id: 'wall' + n, type: 'wall', x: mid.x, y: mid.y });
    }
    walled.edited = true;
    var shut = traffic(walled);
    if (shut.blocked.indexOf('reg2') < 0) reasons.push('wall did not block reg2');
    var knocked = clone(starter);
    var add = data.get().layouts.adds.knock;
    knocked.owned = knocked.owned.concat(clone(add.owned));
    knocked.fixtures = knocked.fixtures.concat(clone(add.fixtures));
    knocked.worldW = add.worldW;
    var bay = traffic(knocked);
    if (bay.blocked.indexOf('g_elec') >= 0) reasons.push('elec bay blocked');
    var path = route(knocked, 960, 855, 1840, 420);
    if (!path || path.length < 2) reasons.push('no path to bay');
    return { ok: reasons.length === 0, reason: reasons.join('; ') };
  }

  var api = {
    traffic: traffic,
    route: route,
    wantsGrid: wantsGrid,
    hasStation: hasStation,
    apply: apply,
    editorModel: editorModel,
    place: place,
    shelvesOf: shelvesOf,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.layout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
