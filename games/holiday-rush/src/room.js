/* Modular Holiday Rush room.
   Draw order matches objects_v9 (v9 / v9b / v9c):
   floor, then side walls, then back segments from x=222,
   then the 222x125 corners, then the front ledge,
   then each side-wall end piece, then that piece's bottom 14px
   band redrawn 6px lower onto the front ledge.
   wall_back_arch stays 125px tall. About 1 in 6 floor cells
   swap to a same-parity variation tile. */
(function (root) {
  'use strict';
  var SPEC = {
    backStartX: 222,
    cornerW: 222,
    cornerH: 125,
    archH: 125,
    archW: 427,
    sideW: 84,
    backW: 420,
    backH: 125,
    frontW: 198,
    frontH: 71,
    postW: 26,
    endH: 118,
    endBand: 14,
    endDrop: 6,
    tile: 128,
    varCell: 64,
    varChance: 1 / 6,
    entrance: 320,
    inset: 42,
    surround: '#342824',
    lightFirst: false
  };

  var DEPT = {
    toys: [
      'dept/toys/endcap_bear.png',
      'dept/toys/toy_bin.png',
      'dept/toys/doll_display.png',
      'dept/toys/train_table.png',
      'dept/toys/kite_rack.png',
      'dept/toys/shelf.png'
    ],
    electronics: [
      'dept/electronics/endcap_console.png',
      'dept/electronics/tv_wall.png',
      'dept/electronics/cable_rack.png',
      'dept/electronics/game_kiosk.png',
      'dept/electronics/glass_counter.png',
      'dept/electronics/shelf.png'
    ],
    seasonal: [
      'dept/seasonal/endcap_cocoa.png',
      'dept/seasonal/wrap_station.png',
      'dept/seasonal/ornament_bin.png',
      'dept/seasonal/tree_lot.png',
      'dept/seasonal/inflatable_display.png',
      'dept/seasonal/shelf.png'
    ],
    cafe: [
      'dept/cafe/counter.png',
      'dept/cafe/pastry_case.png',
      'dept/cafe/cocoa_cart.png',
      'dept/cafe/table_4.png',
      'dept/cafe/table_2.png',
      'dept/cafe/menu_board.png'
    ]
  };

  function cellHash(x, y) {
    var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function plan(worldW, worldH, opts) {
    opts = opts || {};
    var doorX = opts.entranceX == null ? Math.min(960, worldW / 2) : opts.entranceX;
    var gap0 = doorX - SPEC.entrance / 2;
    var gap1 = doorX + SPEC.entrance / 2;
    var ey = worldH - SPEC.frontH - SPEC.endH;
    var steps = [];
    steps.push({ op: 'floor', y0: SPEC.backH - 12 });
    steps.push({ op: 'inset', w: SPEC.inset });
    steps.push({ op: 'side', x: 0, y: 0, h: ey, side: 'left' });
    steps.push({ op: 'side', x: worldW - SPEC.sideW, y: 0, h: ey, side: 'right' });
    var x = SPEC.backStartX;
    var limit = worldW - SPEC.cornerW;
    var index = 0;
    while (x < limit - 1) {
      var span = Math.min(SPEC.backW, limit - x);
      var kind = 'back';
      if (index === 0) kind = 'door';
      else if (opts.arch && x <= opts.archX && x + span >= opts.archX) kind = 'arch';
      steps.push({
        op: 'back',
        x: x,
        w: kind === 'arch' ? SPEC.archW : span,
        h: kind === 'arch' ? SPEC.archH : SPEC.backH,
        kind: kind
      });
      x += SPEC.backW;
      index++;
      if (index > 24) break;
    }
    steps.push({ op: 'corner', x: 0, w: SPEC.cornerW, h: SPEC.cornerH, side: 'tl' });
    steps.push({ op: 'corner', x: worldW - SPEC.cornerW, w: SPEC.cornerW, h: SPEC.cornerH, side: 'tr' });
    steps.push({ op: 'front', y: worldH - SPEC.frontH, gap0: gap0, gap1: gap1 });
    steps.push({ op: 'end', x: 0, y: ey, h: SPEC.endH, side: 'left' });
    steps.push({ op: 'end', x: worldW - SPEC.sideW, y: ey, h: SPEC.endH, side: 'right' });
    var bandY = ey + SPEC.endH - SPEC.endBand + SPEC.endDrop;
    steps.push({ op: 'endBand', x: 0, y: bandY, h: SPEC.endBand, drop: SPEC.endDrop, side: 'left' });
    steps.push({ op: 'endBand', x: worldW - SPEC.sideW, y: bandY, h: SPEC.endBand, drop: SPEC.endDrop, side: 'right' });
    return steps;
  }

  function firstOp(steps, op) {
    for (var i = 0; i < steps.length; i++) if (steps[i].op === op) return i;
    return -1;
  }

  function img(images, key) {
    return images && images[key] ? images[key] : null;
  }

  function repeatY(ctx, image, x, y0, y1) {
    if (!image) return;
    var y = y0;
    while (y < y1) {
      var slice = Math.min(image.height, y1 - y);
      ctx.drawImage(image, 0, 0, image.width, slice, x, y, image.width, slice);
      y += image.height;
    }
  }

  function paint(ctx, images, worldW, worldH, opts) {
    var steps = plan(worldW, worldH, opts);
    var tile = img(images, 'floor/floor_tile.png');
    var wing = img(images, 'floor/floor_wing.png');
    var lights = [];
    var darks = [];
    Object.keys(images || {}).forEach(function (key) {
      if (key.indexOf('floor/floor_var_light_') === 0) lights.push(images[key]);
      else if (key.indexOf('floor/floor_var_dark_') === 0) darks.push(images[key]);
    });
    lights.sort(function (a, b) { return a.src < b.src ? -1 : 1; });
    darks.sort(function (a, b) { return a.src < b.src ? -1 : 1; });
    ctx.fillStyle = SPEC.surround;
    ctx.fillRect(0, 0, worldW, worldH);
    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      if (step.op === 'floor' && tile) {
        for (var y = step.y0; y < worldH; y += SPEC.tile) {
          for (var x = 0; x < worldW; x += SPEC.tile) ctx.drawImage(tile, x, y);
        }
        var y0 = step.y0;
        for (var cy = y0; cy < worldH; cy += SPEC.varCell) {
          for (var cx = 0; cx < worldW; cx += SPEC.varCell) {
            if (cellHash(cx, cy) >= SPEC.varChance) continue;
            var even = (((cx / SPEC.varCell) | 0) + (((cy - y0) / SPEC.varCell) | 0)) % 2 === 0;
            var lightCell = even === SPEC.lightFirst;
            var list = lightCell ? lights : darks;
            if (!list.length) continue;
            var pick = list[(cellHash(cx + 17, cy + 9) * list.length) | 0];
            ctx.drawImage(pick, cx, cy);
          }
        }
      } else if (step.op === 'inset') {
        ctx.fillStyle = SPEC.surround;
        ctx.fillRect(0, 0, step.w, worldH);
        ctx.fillRect(worldW - step.w, 0, step.w, worldH);
      } else if (step.op === 'side') {
        var sideName = step.side === 'left' ? 'floor/wall_side_left.png' : 'floor/wall_side_right.png';
        repeatY(ctx, img(images, sideName), step.x, step.y, step.y + step.h);
      } else if (step.op === 'back') {
        if (step.kind === 'arch' && wing) {
          for (var wy = 0; wy < SPEC.backH - 14; wy += wing.height) {
            for (var wx = step.x; wx < step.x + step.w; wx += wing.width) {
              ctx.drawImage(wing, wx, wy);
            }
          }
        }
        var backName = step.kind === 'door' ? 'floor/wall_back_door.png' : step.kind === 'arch' ? 'floor/wall_back_arch.png' : 'floor/wall_back.png';
        var back = img(images, backName) || img(images, 'floor/wall_back.png');
        if (back) ctx.drawImage(back, 0, 0, Math.min(back.width, step.w), back.height, step.x, 0, Math.min(back.width, step.w), step.h);
      } else if (step.op === 'corner') {
        var corner = img(images, step.side === 'tl' ? 'floor/wall_corner_tl.png' : 'floor/wall_corner_tr.png');
        if (corner) ctx.drawImage(corner, step.x, 0, SPEC.cornerW, SPEC.cornerH);
      } else if (step.op === 'front') {
        var front = img(images, 'floor/wall_front.png');
        var post = img(images, 'floor/wall_post.png');
        if (front) {
          var fx = 0;
          while (fx < worldW) {
            if (fx + front.width <= step.gap0 || fx >= step.gap1) ctx.drawImage(front, fx, step.y);
            else if (fx < step.gap0) ctx.drawImage(front, 0, 0, step.gap0 - fx, front.height, fx, step.y, step.gap0 - fx, front.height);
            else if (fx + front.width > step.gap1) {
              var cut = step.gap1 - fx;
              ctx.drawImage(front, cut, 0, front.width - cut, front.height, step.gap1, step.y, front.width - cut, front.height);
            }
            fx += front.width;
          }
        }
        if (post) {
          ctx.drawImage(post, step.gap0 - post.width, worldH - post.height);
          ctx.drawImage(post, step.gap1, worldH - post.height);
        }
      } else if (step.op === 'end') {
        var endName = step.side === 'left' ? 'floor/wall_side_left_end.png' : 'floor/wall_side_right_end.png';
        var end = img(images, endName);
        if (end) ctx.drawImage(end, step.x, step.y);
      } else if (step.op === 'endBand') {
        var bandName = step.side === 'left' ? 'floor/wall_side_left_end.png' : 'floor/wall_side_right_end.png';
        var band = img(images, bandName);
        if (band) {
          var sy = band.height - SPEC.endBand;
          ctx.drawImage(band, 0, sy, band.width, SPEC.endBand, step.x, step.y, band.width, SPEC.endBand);
        }
      }
    }
  }

  function contain(image, maxW, maxH) {
    var s = Math.min(maxW / image.width, maxH / image.height);
    return { w: image.width * s, h: image.height * s };
  }

  function deptFrame(sh) {
    var dept = sh.dept || (sh.type === 'cafe' ? 'cafe' : '');
    var list = DEPT[dept];
    if (!list) return '';
    var n = 0;
    var id = sh.id || sh.label || dept;
    for (var i = 0; i < id.length; i++) n += id.charCodeAt(i);
    return list[n % list.length];
  }

  function paintFixtures(ctx, images, model) {
    var glows = { tree: null, registers: [], bulbs: [] };
    if (!images || !model) return glows;
    var stock = model.stock == null ? 1 : model.stock;
    var shelves = model.shelves || [];
    for (var i = 0; i < shelves.length; i++) {
      var sh = shelves[i];
      var key = stock < 0.25 ? 'env/shelf_empty.png' : stock < 0.7 ? 'env/shelf_half.png' : (deptFrame(sh) || 'env/shelf_full.png');
      var shelf = img(images, key) || img(images, 'env/shelf_full.png');
      if (!shelf) continue;
      var box = contain(shelf, sh.type === 'cafe' || sh.dept === 'cafe' ? 200 : 150, 230);
      ctx.drawImage(shelf, sh.x - box.w / 2, sh.y - box.h, box.w, box.h);
    }
    var regs = model.registers || [];
    var counter = img(images, 'env/register_counter.png');
    for (var r = 0; r < regs.length; r++) {
      if (!counter) break;
      var boxR = contain(counter, 176, 150);
      var bottom = Math.min(regs[r].y + 52, model.worldH - SPEC.frontH - 6);
      var rx = regs[r].x - boxR.w / 2;
      var ry = bottom - boxR.h;
      ctx.drawImage(counter, rx, ry, boxR.w, boxR.h);
      glows.registers.push({ x: rx + boxR.w * 0.22, y: ry + boxR.h * 0.38, w: boxR.w * 0.46, h: boxR.h * 0.28, live: !!regs[r].live });
    }
    var tree = img(images, 'decor/tree.png');
    if (tree) {
      var boxT = contain(tree, 120, 168);
      var tx = 210;
      var ty = 300 - boxT.h;
      ctx.drawImage(tree, tx, ty, boxT.w, boxT.h);
      glows.tree = { x: tx + 4, y: ty + 8, w: boxT.w - 8, h: boxT.h * 0.72 };
    }
    var wreath = img(images, 'decor/wreath.png');
    if (wreath) {
      var boxW = contain(wreath, 72, 72);
      ctx.drawImage(wreath, 620, 18, boxW.w, boxW.h);
    }
    var boxes = img(images, 'props/stock_box_stack.png');
    if (boxes && model.stockSpot) {
      var boxB = contain(boxes, 78, 84);
      ctx.drawImage(boxes, model.stockSpot.x - boxB.w / 2, model.stockSpot.y - 10, boxB.w, boxB.h);
    }
    var truck = img(images, 'icons/truck.png');
    if (truck && model.truck) {
      var boxK = contain(truck, 130, 100);
      ctx.drawImage(truck, model.truck.x - boxK.w / 2, model.truck.y - 20, boxK.w, boxK.h);
    }
    var towerKey = stock < 0.25 ? 'gift_tower/empty_spot.png' : stock < 0.55 ? 'gift_tower/one_left.png' : stock < 0.85 ? 'gift_tower/two_left.png' : 'gift_tower/full.png';
    var tower = img(images, towerKey) || img(images, 'gift_tower/full.png');
    if (tower && model.door) {
      var boxG = contain(tower, 84, 84);
      var gx = model.door.x + 150;
      var gy = model.door.y - 150;
      ctx.drawImage(tower, gx - boxG.w / 2, gy - boxG.h, boxG.w, boxG.h);
      glows.tower = { x: gx - boxG.w / 2, y: gy - boxG.h, w: boxG.w, h: boxG.h };
    }
    var display = img(images, 'decor/gift_display.png');
    if (display && model.door) {
      var boxD = contain(display, 110, 120);
      ctx.drawImage(display, model.door.x - 220, model.door.y - 170, boxD.w, boxD.h);
    }
    return glows;
  }

  function load(art, onAsset) {
    return fetch(art + 'objects/files.json').then(function (res) {
      if (!res.ok) throw new Error('objects');
      return res.json();
    }).then(function (files) {
      var gift = ['full', 'two_left', 'one_left', 'empty_spot', 'sale_tag', 'sparkle', 'toppled', 'restocked'];
      gift.forEach(function (state) { files.push('sprites/objects/gift_tower/' + state + '.png'); });
      return Promise.all(files.map(function (file) {
        return new Promise(function (resolve) {
          var image = new Image();
          var src = file.indexOf('sprites/') === 0 ? art + file : art + 'objects/' + file;
          image.onload = function () {
            if (typeof onAsset === 'function') onAsset();
            resolve({ file: file, img: image });
          };
          image.onerror = function () { resolve({ file: file, img: null }); };
          image.src = src;
        });
      }));
    }).then(function (rows) {
      var images = {};
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].img) continue;
        var file = rows[i].file;
        if (file.indexOf('sprites/objects/gift_tower/') === 0) {
          images['gift_tower/' + file.replace('sprites/objects/gift_tower/', '')] = rows[i].img;
        } else if (file.indexOf('objects/') === 0) {
          images[file.slice('objects/'.length)] = rows[i].img;
        } else images[file] = rows[i].img;
      }
      return images;
    });
  }

  function pngSize(buf) {
    if (!buf || buf.length < 24) return null;
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  function selfTest() {
    var reasons = [];
    var steps = plan(1600, 900, { entranceX: 960, arch: false });
    var sideAt = firstOp(steps, 'side');
    var backAt = firstOp(steps, 'back');
    var cornerAt = firstOp(steps, 'corner');
    var endAt = firstOp(steps, 'end');
    var bandAt = firstOp(steps, 'endBand');
    if (!(sideAt >= 0 && sideAt < backAt && backAt < cornerAt && cornerAt < endAt && endAt < bandAt)) reasons.push('order');
    var backs = steps.filter(function (step) { return step.op === 'back'; });
    if (!backs.length || backs[0].x !== 222) reasons.push('back x');
    if (backs[0].kind !== 'door') reasons.push('stock door');
    var corners = steps.filter(function (step) { return step.op === 'corner'; });
    if (corners.length !== 2 || corners[0].w !== 222 || corners[0].h !== 125) reasons.push('corner');
    var band = steps.filter(function (step) { return step.op === 'endBand'; })[0];
    if (!band || band.h !== 14 || band.drop !== 6) reasons.push('end band');
    if (Math.abs(SPEC.varChance - (1 / 6)) > 0.0001) reasons.push('variation');
    var hits = 0;
    var cells = 0;
    for (var y = 0; y < 900; y += 64) {
      for (var x = 0; x < 1600; x += 64) {
        cells++;
        if (cellHash(x, y) < SPEC.varChance) hits++;
      }
    }
    var rate = hits / cells;
    if (rate < 0.1 || rate > 0.24) reasons.push('var rate ' + rate);
    var grown = plan(2080, 900, { entranceX: 960, arch: true, archX: 1600 });
    var arch = null;
    for (var i = 0; i < grown.length; i++) if (grown[i].kind === 'arch') arch = grown[i];
    if (!arch || arch.h !== 125) reasons.push('arch');
    if (typeof require !== 'undefined') {
      var fs = require('fs');
      var path = require('path');
      var archPath = path.join(__dirname, '..', 'objects', 'floor', 'wall_back_arch.png');
      var cornerPath = path.join(__dirname, '..', 'objects', 'floor', 'wall_corner_tl.png');
      if (fs.existsSync(archPath)) {
        var ah = pngSize(fs.readFileSync(archPath));
        if (!ah || ah.h !== 125) reasons.push('arch file');
      } else reasons.push('arch missing');
      if (fs.existsSync(cornerPath)) {
        var ch = pngSize(fs.readFileSync(cornerPath));
        if (!ch || ch.w !== 222 || ch.h !== 125) reasons.push('corner file');
      } else reasons.push('corner missing');
    }
    return { ok: reasons.length === 0, reason: reasons.join('; '), backStartX: 222, archH: 125, varChance: SPEC.varChance };
  }

  var api = {
    SPEC: SPEC,
    plan: plan,
    paint: paint,
    paintFixtures: paintFixtures,
    load: load,
    deptFrame: deptFrame,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.room = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
