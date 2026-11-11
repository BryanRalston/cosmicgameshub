/* Flagship NYT-bar validator. node games/validate-nyt.js  — exit 1 on fail. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
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
  var miniFile = process.env.MINI_FILE || path.join(root, 'crossword-puzzles.js');
  var t = fs.readFileSync(miniFile, 'utf8');
  var geo = ['OMAHA', 'ESSEX', 'HELEN', 'KENYA', 'GHANA', 'IDAHO', 'YUKON', 'SPAIN', 'TAMPA', 'PARIS', 'SAMOA', 'INDIA', 'MALTA'];
  geo.forEach(function (g) {
    if (t.indexOf("'" + g + "'") >= 0) fail('Mini geo filler ' + g);
  });
  if (/gaming term for/i.test(t)) fail('Mini slop clue');
  var oneWord = (t.match(/clue:'[A-Za-z]{2,12}'/g) || []).concat(t.match(/clue:"[A-Za-z]{2,12}"/g) || []);
  if (oneWord.length) fail('Mini one-word clues ' + oneWord.slice(0, 8).join(', '));

  var sandbox = { window: {} };
  var puzzles;
  try {
    vm.runInNewContext(t, sandbox, { timeout: 2000, filename: path.basename(miniFile) });
    puzzles = sandbox.window.CROSSWORD_PUZZLES;
  } catch (err) {
    fail('Mini parse ' + err.message);
    return;
  }
  if (!Array.isArray(puzzles)) return fail('Mini puzzles missing');
  console.log('Mini file puzzles ' + puzzles.length + ' (' + path.basename(miniFile) + ')');
  if (puzzles.length < 90) fail('Mini count ' + puzzles.length + ' < 90');

  var wordSquares = 0;
  var collisions = 0;
  var dupAnswers = 0;
  var dupClues = 0;
  var clueHasAnswer = 0;
  var unchecked = 0;
  var shortRuns = 0;
  var mismatches = 0;
  var clueCount = 0;

  function spell(grid, entry, dir) {
    var len = entry.len | 0;
    var row = entry.row | 0;
    var col = entry.col | 0;
    var s = '';
    for (var k = 0; k < len; k++) {
      var r = dir === 'across' ? row : row + k;
      var c = dir === 'across' ? col + k : col;
      if (r < 0 || c < 0 || r > 4 || c > 4) return '';
      s += grid[r][c];
    }
    return s;
  }

  puzzles.forEach(function (p, i) {
    var grid = (p && p.rows ? p.rows : []).map(function (row) { return String(row); });
    if (grid.length !== 5 || grid.some(function (row) { return !/^[A-Z#]{5}$/.test(row); })) {
      mismatches++;
      fail('Mini ' + i + ' grid');
      return;
    }
    var across = (p.across || []).slice();
    var down = (p.down || []).slice();
    var legacy = across.length && across[0].row == null && across[0].len == null;
    if (legacy) {
      across = across.map(function (entry, ri) {
        return { num: entry.num, row: ri, col: 0, len: 5, clue: entry.clue || '', answer: grid[ri] };
      });
      var srcDown = p.down || [];
      down = [];
      for (var c = 0; c < 5; c++) {
        var ans = '';
        for (var r = 0; r < 5; r++) ans += grid[r][c];
        var src = srcDown[c] || {};
        down.push({ num: src.num, row: 0, col: c, len: 5, clue: src.clue || '', answer: ans });
      }
    }

    var aAns = [];
    var dAns = [];
    var clues = [];
    var puzzleBad = false;

    function take(entry, dir, bucket) {
      if (!entry || typeof entry.clue !== 'string' || !entry.clue.length) {
        mismatches++;
        puzzleBad = true;
        return;
      }
      clueCount++;
      clues.push(entry.clue);
      var word = spell(grid, entry, dir);
      if (!word || !/^[A-Z]{3,5}$/.test(word)) {
        mismatches++;
        puzzleBad = true;
        return;
      }
      if (entry.answer && String(entry.answer) !== word) {
        mismatches++;
        puzzleBad = true;
      }
      var beforeBlack = dir === 'across'
        ? (entry.col === 0 || grid[entry.row][entry.col - 1] === '#')
        : (entry.row === 0 || grid[entry.row - 1][entry.col] === '#');
      var afterR = dir === 'across' ? entry.row : entry.row + entry.len;
      var afterC = dir === 'across' ? entry.col + entry.len : entry.col;
      var afterBlack = dir === 'across'
        ? (afterC >= 5 || grid[entry.row][afterC] === '#')
        : (afterR >= 5 || grid[afterR][entry.col] === '#');
      if (!beforeBlack || !afterBlack) {
        mismatches++;
        puzzleBad = true;
      }
      if (entry.clue.toUpperCase().indexOf(word) >= 0) {
        clueHasAnswer++;
        puzzleBad = true;
      }
      bucket.push(word);
    }
    across.forEach(function (entry) { take(entry, 'across', aAns); });
    down.forEach(function (entry) { take(entry, 'down', dAns); });

    var aligned = aAns.length > 0 && aAns.length === dAns.length && aAns.every(function (word, idx) { return word === dAns[idx]; });
    if (aligned) wordSquares++;
    else {
      var aSet = Object.create(null);
      aAns.forEach(function (word) { aSet[word] = 1; });
      if (dAns.some(function (word) { return aSet[word]; })) collisions++;
    }

    var seenWord = Object.create(null);
    var dup = false;
    aAns.concat(dAns).forEach(function (word) {
      if (seenWord[word]) dup = true;
      seenWord[word] = 1;
    });
    if (dup) dupAnswers++;

    var seenClue = Object.create(null);
    var repeated = false;
    clues.forEach(function (clue) {
      if (seenClue[clue]) repeated = true;
      seenClue[clue] = 1;
    });
    if (repeated) dupClues++;

    var covA = Object.create(null);
    var covD = Object.create(null);
    function cover(entry, dir, map) {
      if (!entry || !entry.len) return;
      for (var k = 0; k < entry.len; k++) {
        var r = dir === 'across' ? entry.row : entry.row + k;
        var c = dir === 'across' ? entry.col + k : entry.col;
        map[r + ',' + c] = 1;
      }
    }
    across.forEach(function (entry) { cover(entry, 'across', covA); });
    down.forEach(function (entry) { cover(entry, 'down', covD); });

    var runsA = 0;
    var runsD = 0;
    for (var r = 0; r < 5; r++) {
      var run = 0;
      for (var c = 0; c <= 5; c++) {
        var white = c < 5 && grid[r][c] !== '#';
        if (white) {
          run++;
          if (!covA[r + ',' + c] || !covD[r + ',' + c]) unchecked++;
        } else if (run) {
          runsA++;
          if (run < 3) shortRuns++;
          run = 0;
        }
      }
    }
    for (var c2 = 0; c2 < 5; c2++) {
      var run2 = 0;
      for (var r2 = 0; r2 <= 5; r2++) {
        var white2 = r2 < 5 && grid[r2][c2] !== '#';
        if (white2) run2++;
        else if (run2) {
          runsD++;
          if (run2 < 3) shortRuns++;
          run2 = 0;
        }
      }
    }
    if (!puzzleBad && (across.length !== runsA || down.length !== runsD)) mismatches++;
    if (puzzleBad) { /* counted above */ }
  });

  console.log('Mini counts puzzles=' + puzzles.length + ' clues=' + clueCount +
    ' wordSquares=' + wordSquares + ' collisions=' + collisions +
    ' dupAnswers=' + dupAnswers + ' dupClues=' + dupClues +
    ' clueHasAnswer=' + clueHasAnswer + ' unchecked=' + unchecked +
    ' shortRuns=' + shortRuns + ' mismatches=' + mismatches);

  if (wordSquares) fail('Mini word squares ' + wordSquares);
  if (collisions) fail('Mini across/down collisions ' + collisions);
  if (dupAnswers) fail('Mini duplicate answers ' + dupAnswers);
  if (dupClues) fail('Mini repeated clues ' + dupClues);
  if (clueHasAnswer) fail('Mini clue contains answer ' + clueHasAnswer);
  if (unchecked) fail('Mini unchecked cells ' + unchecked);
  if (shortRuns) fail('Mini short runs ' + shortRuns);
  if (mismatches) fail('Mini grid mismatches ' + mismatches);
  if (!wordSquares && !collisions && !dupAnswers && !dupClues && !clueHasAnswer && !unchecked && !shortRuns && !mismatches && puzzles.length >= 90) {
    ok('Mini ' + puzzles.length + ' checked minis, ' + clueCount + ' clues');
  }
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
