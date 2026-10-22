(function (root) {
  'use strict';

  function economy() { return root.HRParts.economy; }
  function sprites() { return root.HRParts.sprites; }

  function prepare(cust) {
    if (!cust.profile) cust.profile = economy().profileId ? economy().profileId(cust) : 'regular';
    return cust;
  }

  function checkout(books, cust, rng, stockBag) {
    prepare(cust);
    return economy().quote(books, cust, rng, stockBag);
  }

  function demandMul(books) {
    if (!books) return 1;
    return economy().demandMul(books);
  }

  function custCap(sim, base) {
    if (sim && sim.stressCap) return sim.stressCap;
    if (sim && sim.books) return economy().custCap(sim.books);
    return base;
  }

  function trainMul(books, id) {
    if (!books || !id) return 1;
    return economy().trainMul(books, id);
  }

  function typesForShift(day, books) {
    return sprites().typesForDay(day || 0, books);
  }

  function pullAway(schedule, ids) {
    if (!schedule || !ids || !ids.length) return [];
    var names = [];
    for (var s = 0; s < schedule.length; s++) {
      var shift = schedule[s];
      Object.keys(shift).forEach(function (station) {
        if (ids.indexOf(shift[station]) >= 0) {
          if (names.indexOf(shift[station]) < 0) names.push(shift[station]);
          shift[station] = null;
        }
      });
    }
    return names;
  }

  var api = {
    prepare: prepare,
    checkout: checkout,
    demandMul: demandMul,
    custCap: custCap,
    trainMul: trainMul,
    typesForShift: typesForShift,
    pullAway: pullAway
  };
  root.HRParts = root.HRParts || {};
  root.HRParts.sim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
