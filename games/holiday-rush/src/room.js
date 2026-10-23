/* Modular Holiday Rush room.
   Side walls, then back segments from x=222, then the 222x125
   corners. Ledge order matches qc_modular.py: each end piece's
   bottom 14px band is redrawn 6px lower, then the full end piece,
   then the front ledge on top. The stockroom door is pasted at its
   own 421x126 size, the same drop-in the art script composites,
   with no resample into the 420x125 segment. Scuffs use the art
   script's Random(3) stream at chance 0.17. light_first comes from
   the floor tile. wall_back_arch stays 125px tall. */
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
    varChance: 0.17,
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

  function mtRandom(seed) {
    var N = 624;
    var M = 397;
    var mt = new Uint32Array(N);
    var index = N;
    var prev;
    var mixed;
    mt[0] = 19650218;
    for (var mti = 1; mti < N; mti++) {
      prev = mt[mti - 1];
      mt[mti] = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + mti) >>> 0;
    }
    var key = [seed >>> 0];
    var i = 1;
    var j = 0;
    var k = N;
    for (; k; k--) {
      prev = mt[i - 1];
      mixed = Math.imul((prev ^ (prev >>> 30)) >>> 0, 1664525) >>> 0;
      mt[i] = ((mt[i] ^ mixed) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      prev = mt[i - 1];
      mixed = Math.imul((prev ^ (prev >>> 30)) >>> 0, 1566083941) >>> 0;
      mt[i] = ((mt[i] ^ mixed) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
    function gen() {
      var y;
      var kk;
      if (index >= N) {
        for (kk = 0; kk < N - M; kk++) {
          y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff);
          mt[kk] = (mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
        }
        for (; kk < N - 1; kk++) {
          y = (mt[kk] & 0x80000000) | (mt[kk + 1] & 0x7fffffff);
          mt[kk] = (mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
        }
        y = (mt[N - 1] & 0x80000000) | (mt[0] & 0x7fffffff);
        mt[N - 1] = (mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
        index = 0;
      }
      y = mt[index++];
      y ^= y >>> 11;
      y ^= (y << 7) & 0x9d2c5680;
      y ^= (y << 15) & 0xefc60000;
      y ^= y >>> 18;
      return y >>> 0;
    }
    return {
      random: function () {
        var a = gen() >>> 5;
        var b = gen() >>> 6;
        return (a * 67108864 + b) * (1 / 9007199254740992);
      },
      below: function (n) {
        if (n <= 1) return 0;
        var k = 0;
        var v = n >>> 0;
        while (v > 0) { v >>>= 1; k++; }
        var r = gen() >>> (32 - k);
        while (r >= n) r = gen() >>> (32 - k);
        return r;
      }
    };
  }

  function scuffMask(worldW, worldH) {
    var rnd = mtRandom(3);
    var fy0 = SPEC.backH - 12;
    var s = 0;
    var count = 0;
    var first = null;
    for (var y = fy0; y < worldH; y += SPEC.varCell) {
      for (var x = 0; x < worldW; x += SPEC.varCell) {
        if (rnd.random() >= SPEC.varChance) continue;
        var par = ((((x / SPEC.varCell) | 0) + (((y - fy0) / SPEC.varCell) | 0)) % 2 === 0) ? 1 : 0;
        var choice = rnd.below(8);
        if (!first) first = [x, y, par, choice];
        count++;
        s = (Math.imul(s, 131) + x + y * 3 + choice * 17) >>> 0;
      }
    }
    return { sum: s, count: count, first: first };
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
    var bandY = ey + SPEC.endH - SPEC.endBand + SPEC.endDrop;
    steps.push({ op: 'endBand', x: 0, y: bandY, h: SPEC.endBand, drop: SPEC.endDrop, side: 'left' });
    steps.push({ op: 'end', x: 0, y: ey, h: SPEC.endH, side: 'left' });
    steps.push({ op: 'endBand', x: worldW - SPEC.sideW, y: bandY, h: SPEC.endBand, drop: SPEC.endDrop, side: 'right' });
    steps.push({ op: 'end', x: worldW - SPEC.sideW, y: ey, h: SPEC.endH, side: 'right' });
    steps.push({ op: 'front', y: worldH - SPEC.frontH, gap0: gap0, gap1: gap1 });
    return steps;
  }

  function lightFirstOf(tile) {
    if (!tile || !tile.width) return SPEC.lightFirst;
    if (tile._lightFirst != null) return tile._lightFirst;
    tile._lightFirst = SPEC.lightFirst;
    if (typeof document === 'undefined') return tile._lightFirst;
    try {
      var c = document.createElement('canvas');
      c.width = tile.width;
      c.height = tile.height;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(tile, 0, 0);
      var a = g.getImageData(32, 32, 1, 1).data;
      var b = g.getImageData(96, 32, 1, 1).data;
      tile._lightFirst = (a[0] + a[1] + a[2]) > (b[0] + b[1] + b[2]);
    } catch (e) {
      tile._lightFirst = SPEC.lightFirst;
    }
    return tile._lightFirst;
  }

  function backBlit(step, imageW, imageH) {
    if (step.kind === 'door' || step.kind === 'arch') {
      return { sx: 0, sy: 0, sw: imageW, sh: imageH, dx: step.x, dy: 0, dw: imageW, dh: imageH };
    }
    var sw = Math.min(imageW, step.w);
    var sh = Math.min(imageH, step.h);
    return { sx: 0, sy: 0, sw: sw, sh: sh, dx: step.x, dy: 0, dw: sw, dh: sh };
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

  function kioskSkin(images) {
    var out = {};
    var keys = Object.keys(images || {});
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.indexOf('floor/floor_var_') === 0) continue;
      var alt = key.indexOf('floor/') === 0 ? 'floor/kiosk/' + key.slice('floor/'.length) : '';
      out[key] = (alt && images[alt]) ? images[alt] : images[key];
    }
    return out;
  }

  function paint(ctx, images, worldW, worldH, opts) {
    if (opts && opts.kiosk) images = kioskSkin(images);
    var steps = plan(worldW, worldH, opts);
    var tile = img(images, 'floor/floor_tile.png');
    var wing = img(images, 'floor/floor_wing.png');
    var lights = [];
    var darks = [];
    Object.keys(images || {}).forEach(function (key) {
      if (key.indexOf('floor/floor_var_light_') === 0) lights.push(images[key]);
      else if (key.indexOf('floor/floor_var_dark_') === 0) darks.push(images[key]);
    });
    function fileName(image) {
      var src = image && image.src ? image.src : '';
      var clean = src.split('?')[0];
      return clean.slice(clean.lastIndexOf('/') + 1);
    }
    lights.sort(function (a, b) {
      var na = fileName(a);
      var nb = fileName(b);
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    darks.sort(function (a, b) {
      var na = fileName(a);
      var nb = fileName(b);
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    var rnd = mtRandom(3);
    var lightFirst = lightFirstOf(tile);
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
            if (rnd.random() >= SPEC.varChance) continue;
            var even = (((cx / SPEC.varCell) | 0) + (((cy - y0) / SPEC.varCell) | 0)) % 2 === 0;
            var lightCell = even === lightFirst;
            var list = lightCell ? lights : darks;
            if (!list.length) continue;
            ctx.drawImage(list[rnd.below(list.length)], cx, cy);
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
        if (back) {
          var blit = backBlit(step, back.width, back.height);
          var prevSmooth = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(back, blit.sx, blit.sy, blit.sw, blit.sh, blit.dx, blit.dy, blit.dw, blit.dh);
          ctx.imageSmoothingEnabled = prevSmooth;
        }
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

  // Kiosk pieces share the main store's contain boxes.
  // table_4 into 200×230 is 200×165, so a kiosk table uses 200×165.
  // register_counter into 176×150 is 176×122, so the kiosk till uses 176×122.
  // wrap_station into 200×230 is 153×230, so the booth uses that height cap.
  function fixtureBox(kind, label, kiosk, image) {
    var maxW = 150;
    var maxH = 230;
    if (kind === 'register') {
      maxW = 176;
      maxH = kiosk ? 122 : 150;
    } else if (kiosk && label === 'TABLE') {
      maxW = 200;
      maxH = 165;
    } else if (kiosk && label === 'WRAP') {
      // Shoppers draw at 78px. 110px is 1.4×, inside the 1.2–1.5× band.
      maxW = 80;
      maxH = 110;
    } else if (kiosk && label === 'BOOTH') {
      maxW = 153;
      maxH = 230;
    } else if (label === 'BOOTH') {
      maxW = 360;
      maxH = 400;
    } else if (kind === 'cafe') {
      maxW = 200;
      maxH = 230;
    }
    return contain(image, maxW, maxH);
  }

  function deptFrame(sh, kiosk) {
    if (kiosk && sh.label === 'TABLE') return 'dept/cafe/kiosk_table.png';
    if (sh.label === 'BOOTH') return 'dept/cafe/kiosk_booth.png';
    if (sh.label === 'WRAP') return 'dept/seasonal/wrap_station.png';
    if (sh.label === 'COCOA') return 'dept/cafe/counter.png';
    if (sh.label === 'MENU') return 'dept/cafe/menu_board.png';
    if (sh.label === 'CART') return 'dept/cafe/cocoa_cart.png';
    if (sh.label === 'TABLE') return 'dept/cafe/table_4.png';
    if (sh.label === 'WINDOW') return 'dept/toys/endcap_bear.png';
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
      var pinned = sh.label === 'BOOTH' || sh.label === 'WRAP' || sh.label === 'COCOA' || sh.label === 'MENU' || sh.label === 'CART' || sh.label === 'TABLE' || sh.label === 'WINDOW';
      var key = pinned ? (deptFrame(sh, model.kiosk) || 'env/shelf_full.png') : (stock < 0.25 ? 'env/shelf_empty.png' : stock < 0.7 ? 'env/shelf_half.png' : (deptFrame(sh, model.kiosk) || 'env/shelf_full.png'));
      var shelf = img(images, key) || img(images, 'env/shelf_full.png');
      if (!shelf) continue;
      var cafePiece = sh.type === 'cafe' || sh.dept === 'cafe';
      var box = fixtureBox(cafePiece ? 'cafe' : 'shelf', sh.label, !!model.kiosk, shelf);
      ctx.drawImage(shelf, sh.x - box.w / 2, sh.y - box.h, box.w, box.h);
    }
    var regs = model.registers || [];
    var counter = img(images, model.kiosk ? 'env/kiosk_register.png' : 'env/register_counter.png') || img(images, 'env/register_counter.png');
    for (var r = 0; r < regs.length; r++) {
      if (!counter) break;
      var boxR = fixtureBox('register', '', !!model.kiosk, counter);
      var bottom = Math.min(regs[r].y + 52, model.worldH - SPEC.frontH - 6);
      var rx = regs[r].x - boxR.w / 2;
      var ry = bottom - boxR.h;
      ctx.drawImage(counter, rx, ry, boxR.w, boxR.h);
      glows.registers.push({ x: rx + boxR.w * 0.22, y: ry + boxR.h * 0.38, w: boxR.w * 0.46, h: boxR.h * 0.28, live: !!regs[r].live });
    }
    var tree = img(images, 'decor/tree.png');
    if (tree && !model.kiosk) {
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
    if (tower && model.door && !model.kiosk) {
      var boxG = contain(tower, 84, 84);
      var gx = model.door.x + 150;
      var gy = model.door.y - 150;
      ctx.drawImage(tower, gx - boxG.w / 2, gy - boxG.h, boxG.w, boxG.h);
      glows.tower = { x: gx - boxG.w / 2, y: gy - boxG.h, w: boxG.w, h: boxG.h };
    }
    var display = img(images, 'decor/gift_display.png');
    if (display && model.door && !model.kiosk) {
      var boxD = contain(display, 110, 120);
      ctx.drawImage(display, model.door.x - 220, model.door.y - 170, boxD.w, boxD.h);
    }
    return glows;
  }

  function isShellName(base) {
    return base === 'floor_tile.png' || base === 'floor_wing.png'
      || base === 'wall_back.png' || base === 'wall_back_door.png' || base === 'wall_back_arch.png'
      || base === 'wall_corner_tl.png' || base === 'wall_corner_tr.png'
      || base === 'wall_front.png' || base === 'wall_post.png'
      || base === 'wall_side_left.png' || base === 'wall_side_left_end.png'
      || base === 'wall_side_right.png' || base === 'wall_side_right_end.png';
  }

  function isBootFile(file, shell) {
    var slash = file.lastIndexOf('/');
    var base = slash < 0 ? file : file.slice(slash + 1);
    if (shell !== 'kiosk' && (file === 'env/register_counter.png' || file === 'env/shelf_full.png')) return true;
    if (!isShellName(base) || file.indexOf('floor/') !== 0) return false;
    if (shell === 'kiosk') {
      if (base === 'wall_back_arch.png') return false;
      return file.indexOf('floor/kiosk/') === 0;
    }
    return file.indexOf('floor/kiosk/') !== 0;
  }

  function load(art, onAsset, opts) {
    opts = opts || {};
    return fetch(art + 'objects/files.json').then(function (res) {
      if (!res.ok) throw new Error('objects');
      return res.json();
    }).then(function (files) {
      var gift = ['full', 'two_left', 'one_left', 'empty_spot', 'sale_tag', 'sparkle', 'toppled', 'restocked'];
      gift.forEach(function (state) { files.push('sprites/objects/gift_tower/' + state + '.png'); });
      var shell = opts.shell === 'kiosk' ? 'kiosk' : 'flagship';
      if (opts.critical) files = files.filter(function (file) { return isBootFile(file, shell); });
      else if (opts.rest) files = files.filter(function (file) { return !isBootFile(file, shell); });
      if (typeof opts.onList === 'function') opts.onList(files.length);
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

  function pngRGBA(buf) {
    if (typeof require === 'undefined' || !buf || buf.length < 24 || buf[0] !== 0x89) return null;
    var zlib = require('zlib');
    var o = 8;
    var w = 0;
    var h = 0;
    var ctype = 0;
    var parts = [];
    while (o + 8 <= buf.length) {
      var len = buf.readUInt32BE(o);
      o += 4;
      var type = buf.toString('ascii', o, o + 4);
      o += 4;
      var data = buf.slice(o, o + len);
      o += len + 4;
      if (type === 'IHDR') {
        w = data.readUInt32BE(0);
        h = data.readUInt32BE(4);
        ctype = data[9];
      } else if (type === 'IDAT') parts.push(data);
      else if (type === 'IEND') break;
    }
    var bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : 0;
    if (!bpp || !w || !h) return null;
    var raw = zlib.inflateSync(Buffer.concat(parts));
    var stride = w * bpp;
    var out = Buffer.alloc(w * h * 4);
    var prev = Buffer.alloc(stride);
    var p = 0;
    for (var y = 0; y < h; y++) {
      var filter = raw[p++];
      var src = raw.slice(p, p + stride);
      p += stride;
      var row = Buffer.alloc(stride);
      for (var i = 0; i < stride; i++) {
        var left = i >= bpp ? row[i - bpp] : 0;
        var up = prev[i];
        var ul = i >= bpp ? prev[i - bpp] : 0;
        var v = src[i];
        if (filter === 1) v = (v + left) & 255;
        else if (filter === 2) v = (v + up) & 255;
        else if (filter === 3) v = (v + ((left + up) >> 1)) & 255;
        else if (filter === 4) {
          var pred = left + up - ul;
          var pa = Math.abs(pred - left);
          var pb = Math.abs(pred - up);
          var pc = Math.abs(pred - ul);
          var pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
          v = (v + pr) & 255;
        }
        row[i] = v;
      }
      for (var x = 0; x < w; x++) {
        var s = x * bpp;
        var d = (y * w + x) * 4;
        out[d] = row[s];
        out[d + 1] = row[s + 1];
        out[d + 2] = row[s + 2];
        out[d + 3] = bpp === 4 ? row[s + 3] : 255;
      }
      prev = row;
    }
    return { w: w, h: h, data: out };
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
    var frontAt = firstOp(steps, 'front');
    if (!(sideAt >= 0 && sideAt < backAt && backAt < cornerAt && cornerAt < bandAt && bandAt < endAt && endAt < frontAt)) reasons.push('order');
    var backs = steps.filter(function (step) { return step.op === 'back'; });
    if (!backs.length || backs[0].x !== 222) reasons.push('back x');
    if (backs[0].kind !== 'door') reasons.push('stock door');
    var doorBlit = backBlit(backs[0], 421, 126);
    if (doorBlit.dw !== 421 || doorBlit.dh !== 126 || doorBlit.dx !== 222) reasons.push('door blit');
    var partial = backBlit({ kind: 'back', x: 1062, w: 316, h: 125 }, 420, 125);
    if (partial.dw !== 316 || partial.dh !== 125 || partial.sw !== 316) reasons.push('partial blit');
    var corners = steps.filter(function (step) { return step.op === 'corner'; });
    if (corners.length !== 2 || corners[0].w !== 222 || corners[0].h !== 125) reasons.push('corner');
    var band = steps.filter(function (step) { return step.op === 'endBand'; })[0];
    if (!band || band.h !== 14 || band.drop !== 6) reasons.push('end band');
    var kioskTable = fixtureBox('cafe', 'TABLE', true, { width: 260, height: 300 });
    var mainTable = fixtureBox('cafe', 'TABLE', false, { width: 298, height: 246 });
    if (Math.round(kioskTable.h) !== 165 || Math.round(kioskTable.w) !== 143) reasons.push('kiosk table');
    if (Math.abs(kioskTable.h - mainTable.h) > 1) reasons.push('table scale');
    var kioskBooth = fixtureBox('cafe', 'BOOTH', true, { width: 398, height: 500 });
    if (Math.round(kioskBooth.w) !== 153 || Math.round(kioskBooth.h) !== 192) reasons.push('kiosk booth');
    var kioskWrap = fixtureBox('shelf', 'WRAP', true, { width: 236, height: 356 });
    var mainWrap = fixtureBox('shelf', 'WRAP', false, { width: 236, height: 356 });
    if (Math.round(kioskWrap.h) !== 110 || Math.round(kioskWrap.w) !== 73) reasons.push('kiosk wrap ' + Math.round(kioskWrap.w) + 'x' + Math.round(kioskWrap.h));
    if (Math.round(mainWrap.h) < 200) reasons.push('flag wrap');
    var kioskReg = fixtureBox('register', '', true, { width: 480, height: 322 });
    var mainReg = fixtureBox('register', '', false, { width: 458, height: 317 });
    if (Math.round(kioskReg.w) !== 176 || Math.round(kioskReg.h) !== 118) reasons.push('kiosk reg');
    if (Math.abs(kioskReg.w - mainReg.w) > 1) reasons.push('reg scale');
    if (isBootFile('floor/floor_var_dark_1.png', 'flagship')) reasons.push('var boot');
    if (isBootFile('floor/kiosk/wall_back.png', 'flagship')) reasons.push('kiosk on flagship');
    if (!isBootFile('floor/kiosk/wall_back_door.png', 'kiosk')) reasons.push('kiosk door boot');
    if (isBootFile('floor/kiosk/wall_back_arch.png', 'kiosk')) reasons.push('kiosk arch boot');
    if (isBootFile('dept/cafe/kiosk_booth.png', 'kiosk')) reasons.push('booth boot');
    if (Math.abs(SPEC.varChance - 0.17) > 0.0001) reasons.push('variation');
    var probe = mtRandom(3);
    var expect = [0.23796462709189137, 0.5442292252959519, 0.36995516654807925, 0.6039200385961945, 0.625720304108054];
    for (var ri = 0; ri < expect.length; ri++) {
      if (Math.abs(probe.random() - expect[ri]) > 1e-12) reasons.push('scuff rng');
    }
    var mask = scuffMask(1600, 900);
    if (mask.count !== 54 || mask.sum !== 711889381) reasons.push('scuff hash ' + mask.count + ' ' + mask.sum);
    if (!mask.first || mask.first[0] !== 320 || mask.first[1] !== 113 || mask.first[3] !== 0) reasons.push('scuff first');
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
      var tilePath = path.join(__dirname, '..', 'objects', 'floor', 'floor_tile.png');
      if (fs.existsSync(tilePath)) {
        var rgba = pngRGBA(fs.readFileSync(tilePath));
        if (!rgba) reasons.push('tile decode');
        else {
          var ia = (32 + 32 * rgba.w) * 4;
          var ib = (96 + 32 * rgba.w) * 4;
          var light = (rgba.data[ia] + rgba.data[ia + 1] + rgba.data[ia + 2]) > (rgba.data[ib] + rgba.data[ib + 1] + rgba.data[ib + 2]);
          if (light) reasons.push('light first');
        }
      } else reasons.push('tile missing');
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
