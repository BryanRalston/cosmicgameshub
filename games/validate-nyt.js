/* Flagship NYT-bar validator. node games/validate-nyt.js  — exit 1 on fail. */
'use strict';
var fs = require('fs');
var path = require('path');
var root = __dirname;
var fails = [];

function fail(msg) { fails.push(msg); console.error('FAIL', msg); }
function ok(msg) { console.log('OK  ', msg); }

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

(function pixle() {
  var t = read('pixle-words.js');
  var m = t.match(/window\.PIXLE_ANSWERS = \[([\s\S]*?)\];/);
  if (!m) return fail('PIXLE_ANSWERS missing');
  var ans = m[1].match(/'([A-Z]+)'/g).map(function (s) { return s.slice(1, -1); });
  var seen = Object.create(null);
  ans.forEach(function (w) {
    if (w.length !== 5) fail('Pixle answer len ' + w);
    if (!/^[A-Z]{5}$/.test(w)) fail('Pixle answer charset ' + w);
    if (seen[w]) fail('Pixle duplicate ' + w);
    seen[w] = 1;
  });
  ['REYNA', 'GEKKO', 'ASTRA', 'CLOVE', 'STEPP',
   'INHIB', 'MOLLY', 'GANKS', 'CREEP', 'LEASH', 'ROAMS', 'SHOVE',
   'WARDS', 'LANES', 'NEXUS', 'BARON', 'PROMO', 'PWNED', 'NOOBS',
   'HASTE', 'VIGOR', 'GLOCK', 'GSYNC', 'VSYNC', 'HERTZ', 'GLYPH',
   'LUNGE', 'FEINT', 'MAINS', 'PEEKS', 'NERFS', 'SMURF', 'STUNS',
   'TILTS', 'TOXIC', 'TROLL', 'AGGRO', 'FLASK', 'CACHE', 'FRAGS'].forEach(function (w) {
    if (seen[w]) fail('Pixle banned ' + w);
  });
  var g = t.match(/window\.PIXLE_GUESSES = \[([\s\S]*?)\];/);
  var guesses = g ? g[1].match(/'([A-Z]+)'/g).length : 0;
  if (ans.length < 150) fail('Pixle answers ' + ans.length + ' < 150');
  if (guesses < 5000) fail('Pixle guesses ' + guesses + ' < 5000');
  ok('Pixle answers ' + ans.length + ' guesses ' + guesses);
})();

(function mini() {
  var t = read('crossword-puzzles.js');
  var blocks = t.split('rows:').slice(1);
  if (blocks.length < 45) fail('Mini count ' + blocks.length + ' < 45');
  var geo = ['OMAHA', 'ESSEX', 'HELEN', 'KENYA', 'GHANA', 'IDAHO', 'YUKON', 'SPAIN', 'TAMPA', 'PARIS', 'SAMOA', 'INDIA', 'MALTA'];
  geo.forEach(function (g) {
    if (t.indexOf("'" + g + "'") >= 0) fail('Mini geo filler ' + g);
  });
  if (/gaming term for/i.test(t)) fail('Mini slop clue');
  var oneWord = (t.match(/clue:'[A-Za-z]{2,12}'/g) || []).concat(t.match(/clue:"[A-Za-z]{2,12}"/g) || []);
  if (oneWord.length) fail('Mini one-word clues ' + oneWord.slice(0, 8).join(', '));
  var bad = 0;
  blocks.forEach(function (b, i) {
    var rows = (b.match(/'([A-Z]{5})'/g) || []).slice(0, 5).map(function (s) { return s.slice(1, -1); });
    if (rows.length !== 5) { bad++; return; }
    for (var c = 0; c < 5; c++) {
      var down = rows.map(function (r) { return r[c]; }).join('');
      if (down.length !== 5) bad++;
    }
    var across = (b.match(/num:\d,clue:/g) || []).length;
    var downClues = (b.match(/col:\d,clue:/g) || []).length;
    if (across < 5 || downClues < 5) bad++;
  });
  if (bad) fail('Mini unchecked grids ' + bad);
  else ok('Mini ' + blocks.length + ' fully checked 5x5');
})();

(function link() {
  var t = read('link-puzzles.js');
  var days = t.split('{ groups:').slice(1);
  if (days.length < 180) fail('Link days ' + days.length + ' < 180');
  days.forEach(function (d, i) {
    var titles = d.match(/title: '([^']+)'/g) || [];
    var wordBlocks = d.match(/words: \[([\s\S]*?)\]/g) || [];
    if (wordBlocks.length !== 4) fail('Link day ' + (i + 1) + ' groups ' + wordBlocks.length);
    var tiles = [];
    wordBlocks.forEach(function (wb) {
      var ws = wb.match(/'((?:\\'|[^'])*)'/g) || [];
      if (ws.length !== 4) fail('Link day ' + (i + 1) + ' tile count ' + ws.length);
      ws.forEach(function (w) { tiles.push(w.slice(1, -1).toLowerCase()); });
    });
    var seen = Object.create(null);
    tiles.forEach(function (w) {
      if (seen[w]) fail('Link day ' + (i + 1) + ' dup ' + w);
      seen[w] = 1;
    });
    if (tiles.length !== 16) fail('Link day ' + (i + 1) + ' tiles ' + tiles.length);
  });
  ok('Link ' + days.length + ' days');
})();

(function decode() {
  var t = read('rift.html');
  var n = (t.match(/gaming: true/g) || []).length;
  if (n < 120) fail('Decode gaming sets ' + n + ' < 120');
  if (/TYPES OF PASTA|TYPES OF CLOUD|COLORS OF THE RAINBOW/.test(t)) fail('Decode filler leak');
  var start = t.indexOf('const DECODE_PUZZLES');
  var end = t.indexOf('// ── GAME STATE');
  var block = start >= 0 && end > start ? t.slice(start, end) : '';
  var allowShort = {
    'TETRIS PIECES': 1, 'SPEEDRUN TERMS': 1, 'RHYTHM TERMS': 1, 'RHYTHM JUDGE': 1,
    'CS UTILITY': 1, 'FGC INPUTS': 1, 'DND STATS': 1, 'POKEMON STATS': 1,
    'MULTIPLAYER MODES': 1, 'DIFFICULTY NAMES': 1, 'GPU BRANDS': 1, 'GUILD RANKS': 1,
    'HUD PIECES': 1, 'CHAT COMMANDS': 1, 'TOURNAMENT BRACKET': 1, 'CROSSPLAY': 1
  };
  var sets = block.split(/\n  \{\n    connection:/).slice(1);
  sets.forEach(function (s) {
    var titleM = s.match(/'([^']+)'/);
    var title = titleM ? titleM[1] : '?';
    var answers = s.match(/answer: '([^']+)'/g) || [];
    answers.forEach(function (a) {
      var w = a.slice(9, -1);
      if (w.length <= 2 && !allowShort[title]) fail('Decode short ' + w + ' in ' + title);
    });
  });
  ok('Decode ' + n + ' gaming sets');
})();

if (fails.length) {
  console.error(fails.length + ' failure(s)');
  process.exit(1);
}
console.log('validate-nyt: pass');
process.exit(0);
