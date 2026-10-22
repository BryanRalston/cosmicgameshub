(function (root) {
  'use strict';

  function createPool() {
    var free = [];
    function acquire() {
      return free.length ? free.pop() : {};
    }
    function release(actor) {
      if (!actor) return;
      actor.path = null;
      actor.dead = true;
      actor.bubble = null;
      free.push(actor);
    }
    function compact(list) {
      var w = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].dead) release(list[i]);
        else list[w++] = list[i];
      }
      list.length = w;
      return list;
    }
    return {
      acquire: acquire,
      release: release,
      compact: compact,
      freeCount: function () { return free.length; }
    };
  }

  function createSpatial(cell) {
    var size = cell || 96;
    var buckets = Object.create(null);
    function key(x, y) {
      return ((x / size) | 0) + ':' + ((y / size) | 0);
    }
    function rebuild(list) {
      buckets = Object.create(null);
      for (var i = 0; i < list.length; i++) {
        var actor = list[i];
        if (!actor || actor.dead || actor.hidden) continue;
        var k = key(actor.x, actor.y);
        var bucket = buckets[k];
        if (bucket) bucket.push(actor);
        else buckets[k] = [actor];
      }
    }
    function near(x, y, radius) {
      var out = [];
      var reach = Math.max(1, Math.ceil(radius / size));
      var c0 = (x / size) | 0;
      var r0 = (y / size) | 0;
      for (var cy = r0 - reach; cy <= r0 + reach; cy++) {
        for (var cx = c0 - reach; cx <= c0 + reach; cx++) {
          var bucket = buckets[cx + ':' + cy];
          if (!bucket) continue;
          for (var i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
      return out;
    }
    return { rebuild: rebuild, near: near };
  }

  function selfTest() {
    var pool = createPool();
    var a = pool.acquire();
    var b = pool.acquire();
    a.dead = true;
    b.dead = false;
    b.x = 10;
    var list = pool.compact([a, b]);
    var spatial = createSpatial(96);
    spatial.rebuild(list);
    var hit = spatial.near(10, 0, 40);
    var ok = list.length === 1 && list[0] === b && pool.freeCount() === 1 && hit.length === 1;
    return { ok: ok, reason: ok ? '' : 'pool or spatial' };
  }

  var api = { createPool: createPool, createSpatial: createSpatial, selfTest: selfTest };
  root.HRParts = root.HRParts || {};
  root.HRParts.entities = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
