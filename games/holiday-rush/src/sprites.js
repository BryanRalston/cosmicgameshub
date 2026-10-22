(function (root) {
  'use strict';
  var PER_TYPE = 110 * 1024;
  var CREW_EXPR = ['neutral', 'happy', 'stressed', 'angry', 'sick', 'proud'];
  var CUST_EXPR = ['neutral', 'impatient', 'angry', 'delighted'];
  var REQUIRED = ['rusher', 'haggle', 'family', 'lift', 'regular', 'kid', 'crew_manager', 'crew_register', 'crew_freight', 'crew_floor'];

  function classify(rel) {
    var name = String(rel || '').replace(/\\/g, '/').replace(/^\//, '');
    if (name.indexOf('..') >= 0 || name.indexOf('\0') >= 0) return null;
    var frame = name.match(/^([a-z0-9_]+)\/(idle|walk|work)_(down|side|up)_(\d+)\.(png|webp)$/);
    if (frame) {
      return { kind: 'frame', type: frame[1], anim: frame[2], dir: frame[3], index: +frame[4], ext: frame[5] };
    }
    var port = name.match(/^portraits\/([a-z0-9_]+)_([a-z]+)\.(png|webp)$/);
    if (port) {
      var key = port[1];
      var expr = port[2];
      var allowed = key.indexOf('crew_') === 0 ? CREW_EXPR : CUST_EXPR;
      if (allowed.indexOf(expr) < 0) return null;
      return { kind: 'portrait', key: key, expr: expr, ext: port[3] };
    }
    var state = name.match(/^objects\/([a-z0-9_]+)\/([a-z0-9_]+)\.(png|webp)$/);
    if (state) return { kind: 'state', type: state[1], state: state[2], ext: state[3] };
    var obj = name.match(/^(products|objects)\/([a-z0-9_]+)\.(png|webp)$/);
    if (obj) return { kind: 'object', bucket: obj[1], type: obj[2], ext: obj[3] };
    return null;
  }

  function group(man) {
    var types = {};
    function add(type, file) {
      if (!types[type]) types[type] = [];
      if (types[type].indexOf(file) < 0) types[type].push(file);
    }
    var listed = man && man.types ? man.types : {};
    Object.keys(listed).forEach(function (type) {
      var entry = listed[type] || [];
      var files = entry.files || entry;
      for (var i = 0; i < files.length; i++) add(type, files[i]);
    });
    var files = (man && man.files) || [];
    for (var f = 0; f < files.length; f++) {
      var spec = classify(files[f]);
      if (!spec) continue;
      if (spec.kind === 'frame') add(spec.type, files[f]);
      else if (spec.kind === 'portrait') add(spec.key, files[f]);
    }
    var objects = {};
    ['objects', 'products'].forEach(function (bucket) {
      var src = (man && man[bucket]) || {};
      Object.keys(src).forEach(function (id) { objects[id] = src[id]; });
    });
    return {
      types: types,
      objects: objects,
      perTypeBudget: (man && man.perTypeBudget) || PER_TYPE,
      raw: man || {}
    };
  }

  function typesForDay(day, books) {
    var types = ['regular', 'kid', 'family', 'crew_manager', 'crew_register', 'crew_freight', 'crew_floor'];
    if (day >= 1) types.push('ugly_sweater');
    if (day >= 5) types.push('rusher');
    if (day >= 7) types.push('haggle');
    if (day >= 12) types.push('lift');
    if (books && books.staff) {
      var hires = root.HRParts.data && root.HRParts.data.get() && root.HRParts.data.get().staff.hires;
      (hires || []).forEach(function (hire) {
        var rec = books.staff[hire.id];
        if (rec && rec.employed && hire.sprite && types.indexOf(hire.sprite) < 0) types.push(hire.sprite);
      });
    }
    return types;
  }

  function pngInfo(bytes) {
    if (!bytes || bytes.length < 26) return null;
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
    var w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    var h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { w: w >>> 0, h: h >>> 0, color: bytes[25], format: 'png' };
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

  function isWebp(bytes) {
    return bytes && bytes.length > 16 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  function webpHasAlpha(bytes) {
    if (!isWebp(bytes)) return false;
    var i = 12;
    while (i + 8 <= bytes.length) {
      var kind = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
      var len = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24);
      if (kind === 'VP8L') return true;
      if (kind === 'VP8X' && i + 8 < bytes.length) return (bytes[i + 8] & 0x10) !== 0;
      if (len < 0 || i + 8 + len > bytes.length) return false;
      i += 8 + len + (len % 2);
    }
    return false;
  }

  function hasAlpha(bytes) {
    if (pngInfo(bytes)) return pngHasAlpha(bytes);
    if (isWebp(bytes)) return webpHasAlpha(bytes);
    return false;
  }

  function verify(gameDir) {
    var sample = classify('rusher/walk_side_3.png');
    if (!sample || sample.kind !== 'frame' || sample.index !== 3 || sample.dir !== 'side') throw new Error('frame name');
    var port = classify('portraits/crew_register_sick.png');
    if (!port || port.kind !== 'portrait' || port.expr !== 'sick') throw new Error('portrait name');
    if (classify('rusher/jump_down_0.png')) throw new Error('bad anim accepted');
    if (classify('../secrets.png')) throw new Error('path accepted');
    var extra = classify('lantern/idle_down_0.png');
    if (!extra || extra.type !== 'lantern') throw new Error('new type');
    var product = classify('products/cocoa.webp');
    if (!product || product.kind !== 'object' || product.type !== 'cocoa') throw new Error('product name');
    var files = [];
    var bytes = 0;
    var perType = {};
    if (gameDir && typeof require !== 'undefined') {
      var fs = require('fs');
      var path = require('path');
      var manPath = path.join(gameDir, 'holiday-rush', 'sprites', 'manifest.json');
      var man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
      if (man.perTypeBudget !== PER_TYPE) throw new Error('per-type budget');
      var grouped = group(man);
      files = man.files || [];
      Object.keys(grouped.types).forEach(function (type) {
        var list = grouped.types[type];
        var sum = 0;
        for (var i = 0; i < list.length; i++) {
          if (!classify(list[i])) throw new Error('manifest name ' + list[i]);
          var abs = path.join(gameDir, 'holiday-rush', 'sprites', list[i]);
          if (!fs.existsSync(abs)) throw new Error('missing ' + list[i]);
          var buf = fs.readFileSync(abs);
          if (!hasAlpha(buf)) throw new Error('alpha ' + list[i]);
          var info = pngInfo(buf);
          if (info && (info.w < 32 || info.h < 32 || info.w > 512 || info.h > 512)) throw new Error('dim ' + list[i]);
          sum += buf.length;
          bytes += buf.length;
        }
        perType[type] = sum;
        if (sum > PER_TYPE) throw new Error('type budget ' + type + ' ' + sum);
        var sheet = {};
        var portraits = {};
        for (var s = 0; s < list.length; s++) {
          var spec = classify(list[s]);
          if (spec.kind === 'frame') sheet[spec.anim + '|' + spec.dir] = true;
          if (spec.kind === 'portrait') portraits[spec.expr] = true;
        }
        if (REQUIRED.indexOf(type) >= 0) {
          if (!sheet['idle|down'] || !sheet['walk|down'] || !portraits.neutral) throw new Error('incomplete ' + type);
        }
      });
      for (var r = 0; r < REQUIRED.length; r++) {
        if (!grouped.types[REQUIRED[r]]) throw new Error('required ' + REQUIRED[r]);
      }
    }
    return {
      ok: true,
      perTypeBudget: PER_TYPE,
      budget: PER_TYPE,
      listed: files.length,
      present: files.length,
      bytes: bytes,
      perType: perType
    };
  }

  function createSession(art, onAsset) {
    var pack = {
      ready: false,
      partial: true,
      types: {},
      portraits: {},
      objects: {},
      bytes: 0,
      perTypeBudget: PER_TYPE
    };
    var manifest = null;
    var loading = {};
    var failed = {};

    function notify() {
      if (typeof onAsset === 'function') onAsset();
    }

    function loadManifest() {
      return fetch(art + 'sprites/manifest.json').then(function (res) {
        if (!res.ok) return { files: [] };
        return res.json();
      }).then(function (man) {
        manifest = group(man);
        pack.perTypeBudget = manifest.perTypeBudget;
        return manifest;
      }).catch(function () {
        manifest = group({ files: [] });
        return manifest;
      });
    }

    function decodeFile(file, spec) {
      return fetch(art + 'sprites/' + file).then(function (res) {
        if (!res.ok) throw new Error(file);
        return res.arrayBuffer();
      }).then(function (buf) {
        var bytes = new Uint8Array(buf);
        if (!hasAlpha(bytes)) throw new Error('alpha ' + file);
        notify();
        var blob = new Blob([buf], { type: spec.ext === 'webp' ? 'image/webp' : 'image/png' });
        var src = URL.createObjectURL(blob);
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve({ img: img, url: src, bytes: buf.byteLength, w: img.naturalWidth, h: img.naturalHeight, spec: spec }); };
          img.onerror = function () { URL.revokeObjectURL(src); reject(new Error(file)); };
          img.src = src;
        });
      });
    }

    function loadType(type) {
      if (pack.types[type] || loading[type] || failed[type]) return loading[type] || Promise.resolve(!!pack.types[type]);
      var entry = (manifest && manifest.types[type]) || [];
      var files = entry.files || entry;
      if (!files.length) {
        failed[type] = true;
        return Promise.resolve(false);
      }
      var job = Promise.all(files.map(function (file) {
        var spec = classify(file);
        if (!spec) return Promise.reject(new Error(file));
        return decodeFile(file, spec);
      })).then(function (rows) {
        var sheet = {};
        var portraits = {};
        var states = {};
        var frames = 0;
        var sum = 0;
        for (var i = 0; i < rows.length; i++) {
          sum += rows[i].bytes;
          var spec = rows[i].spec;
          if (spec.kind === 'frame') {
            frames++;
            var frameKey = spec.anim + '|' + spec.dir;
            if (!sheet[frameKey]) sheet[frameKey] = [];
            sheet[frameKey].push(rows[i]);
          } else if (spec.kind === 'portrait') {
            portraits[spec.expr] = rows[i];
          } else if (spec.kind === 'state') {
            states[spec.state] = rows[i];
          }
        }
        if (sum > pack.perTypeBudget) throw new Error('budget ' + type);
        Object.keys(sheet).forEach(function (k) {
          sheet[k].sort(function (a, b) { return a.spec.index - b.spec.index; });
        });
        if (frames) {
          if (!sheet['idle|down'] || !sheet['walk|down']) throw new Error('frames ' + type);
          pack.types[type] = sheet;
          pack.portraits[type] = portraits;
        } else if (!Object.keys(states).length) {
          throw new Error('frames ' + type);
        }
        if (Object.keys(states).length) pack.objects[type] = states;
        pack.bytes += sum;
        pack.ready = true;
        return true;
      }).catch(function () {
        failed[type] = true;
        return false;
      });
      loading[type] = job;
      return job;
    }

    function ensure(typeIds) {
      var start = manifest ? Promise.resolve(manifest) : loadManifest();
      return start.then(function () {
        return Promise.all(typeIds.map(loadType));
      }).then(function () {
        pack.ready = true;
        pack.partial = true;
        return pack;
      });
    }

    function preload(typeIds) {
      ensure(typeIds).catch(function () {});
    }

    function fileCount(typeIds) {
      if (!manifest) return typeIds.length;
      var n = 0;
      for (var i = 0; i < typeIds.length; i++) {
        var entry = manifest.types[typeIds[i]] || [];
        var list = entry.files || entry;
        n += list.length;
      }
      return n;
    }

    return {
      pack: function () { return pack; },
      ensure: ensure,
      preload: preload,
      loadManifest: loadManifest,
      fileCount: fileCount,
      ready: function (type) { return !!(pack.types[type]); }
    };
  }

  function selfTest() {
    var reasons = [];
    if (classify('lantern/idle_down_0.webp').type !== 'lantern') reasons.push('webp type');
    if (typesForDay(0).indexOf('rusher') >= 0) reasons.push('day0 rusher');
    if (typesForDay(0).indexOf('ugly_sweater') >= 0) reasons.push('day0 sweater');
    if (typesForDay(1).indexOf('ugly_sweater') < 0) reasons.push('day1 sweater');
    if (!classify('objects/gift_tower/sparkle.png') || classify('objects/gift_tower/sparkle.png').kind !== 'state') reasons.push('gift state');
    if (typesForDay(5).indexOf('rusher') < 0) reasons.push('day5');
    if (typesForDay(7).indexOf('haggle') < 0) reasons.push('day7');
    if (typesForDay(12).indexOf('lift') < 0) reasons.push('day12');
    var early = typesForDay(0);
    var later = typesForDay(12);
    if (early.length >= later.length) reasons.push('preload set');
    return { ok: reasons.length === 0, reason: reasons.join('; ') };
  }

  var api = {
    PER_TYPE: PER_TYPE,
    REQUIRED: REQUIRED,
    classify: classify,
    group: group,
    typesForDay: typesForDay,
    verify: verify,
    createSession: createSession,
    hasAlpha: hasAlpha,
    selfTest: selfTest
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.sprites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
