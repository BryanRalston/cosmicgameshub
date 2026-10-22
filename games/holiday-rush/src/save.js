(function (root) {
  'use strict';
  var KEY = 'hr_books_v4';

  function economy() { return root.HRParts.economy; }

  function load(readJSON) {
    var raw = readJSON(KEY);
    if (raw && raw.v === 4) return economy().normalize(raw);
    var camp = readJSON('hr_campaign_v1');
    return economy().migrate(camp);
  }

  function save(writeJSON, books) {
    var copy = JSON.parse(JSON.stringify(books));
    copy.v = 4;
    writeJSON(KEY, copy);
  }

  var api = { KEY: KEY, load: load, save: save };
  root.HRParts = root.HRParts || {};
  root.HRParts.save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
