(function (root) {
  'use strict';
  var cache = null;

  function syncRead() {
    var fs = require('fs');
    var path = require('path');
    var dir = path.join(__dirname, '..', 'data');
    function read(name) {
      return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    }
    var defs = {
      items: read('items.json'),
      staff: read('staff.json'),
      customers: read('customers.json'),
      layouts: read('layouts.json'),
      economy: read('economy.json'),
      fixtures: read('fixtures.json'),
      tenants: read('tenants.json'),
      mall: read('mall.json')
    };
    index(defs);
    return defs;
  }

  function index(defs) {
    defs.items.byId = {};
    defs.items.items.forEach(function (it) { defs.items.byId[it.id] = it; });
    defs.customers.byId = {};
    defs.customers.types.forEach(function (t) { defs.customers.byId[t.id] = t; });
    defs.staff.byId = {};
    defs.staff.hires.forEach(function (h) { defs.staff.byId[h.id] = h; });
    defs.economy.buildById = {};
    defs.economy.builds.forEach(function (b) { defs.economy.buildById[b.id] = b; });
    defs.tenants.byId = {};
    defs.tenants.tenants.forEach(function (t) { defs.tenants.byId[t.id] = t; });
    defs.fixtures.byId = {};
    defs.fixtures.types.forEach(function (t) { defs.fixtures.byId[t.id] = t; });
  }

  function load(base) {
    if (cache) return Promise.resolve(cache);
    if (typeof fetch !== 'function') {
      cache = syncRead();
      return Promise.resolve(cache);
    }
    var names = ['items', 'staff', 'customers', 'layouts', 'economy', 'fixtures', 'tenants', 'mall'];
    return Promise.all(names.map(function (name) {
      return fetch(base + name + '.json').then(function (res) {
        if (!res.ok) throw new Error(name);
        return res.json();
      });
    })).then(function (rows) {
      var defs = {};
      names.forEach(function (name, i) { defs[name] = rows[i]; });
      index(defs);
      cache = defs;
      return defs;
    });
  }

  function loadSync() {
    if (!cache) cache = syncRead();
    return cache;
  }

  function get() {
    if (!cache && typeof require === 'function' && typeof document === 'undefined') return loadSync();
    return cache;
  }

  var api = { load: load, loadSync: loadSync, get: get };
  root.HRParts = root.HRParts || {};
  root.HRParts.data = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
