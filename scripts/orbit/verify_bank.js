// Usage: node scripts/orbit/verify_bank.js games/orbit-puzzles.js [games/orbit-practice.js]
//          [--frozen LIVE_BANK.js] [--through YYYY-MM-DD]
// Independent re-proof from the SHIPPED data files:
// - every puzzle (daily and practice) has exactly one all-lit state against the shipped glow list;
// - nothing is lit at the start, no ring starts solved, par >= 9;
// - no wrong state lights more than 5 of 8 spokes (no near-miss);
// - no puzzle repeats, and no practice puzzle uses any daily's eight words;
// - the daily bank is whole weeks (364 days) with #1 on a Sunday, so weekdays survive the wrap;
// - no answer word repeats within 30 days, nor within 7 days across the wrap (day 364 -> day 1);
// - with --frozen: days #1 .. --through (default FREEZE_THROUGH in gen_orbit.py) are
//   byte-identical to the live bank, so no player ever sees a played day change.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const files = argv.filter((a, i) => !a.startsWith('--') && !['--frozen', '--through'].includes(argv[i - 1]));
const load = list => { const ctx = { window: {} }; vm.createContext(ctx); list.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx)); return ctx.window; };
const W0 = load(files);
const D = W0.ORBIT_DATA, PR = W0.ORBIT_PRACTICE;
const N = D.spokes, R = D.rings, L = new Set(D.light.split(' '));
const RECENT = 30, WRAP_RECENT = 7, MAX_WRONG_LIT = N - 3, MIN_PAR = 9;
const mod = (a, n) => ((a % n) + n) % n;
let bad = 0;
const fail = (...m) => { bad++; console.log(...m); };
function check(list, label) {
  let minPar = 99, maxStartLit = 0, worstWrong = 0; const keys = new Set();
  list.forEach((p, i) => {
    const W = p[0].split(' '), S = [0, ...String(p[1]).split('').map(Number)];
    const rings = [...Array(R)].map((_, r) => W.map(w => w[r]).join(''));
    const sp = o => [...Array(N)].map((_, k) => rings.map((rg, r) => rg[mod(k - o[r], N)]).join(''));
    const sols = []; let wrongMax = 0;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (let c = 0; c < N; c++) {
      const n = sp([0, a, b, c]).filter(w => L.has(w)).length;
      if (n === N) sols.push([a, b, c].join('')); else wrongMax = Math.max(wrongMax, n);
    }
    if (sols.length !== 1 || sols[0] !== '000') fail(label, 'NOT UNIQUE', i + 1, sols);
    if (wrongMax > MAX_WRONG_LIT) fail(label, 'near-miss: a wrong state lights', wrongMax, 'spokes on', i + 1);
    worstWrong = Math.max(worstWrong, wrongMax);
    const startLit = sp(S).filter(w => L.has(w)).length;
    if (startLit) fail(label, 'lit at start', i + 1, startLit);
    maxStartLit = Math.max(maxStartLit, startLit);
    const par = S.reduce((s, o) => s + Math.min(o, N - o), 0);
    if (par < MIN_PAR) fail(label, 'par below', MIN_PAR, i + 1, par);
    minPar = Math.min(minPar, par);
    if (S.slice(1).some(o => o === 0)) fail(label, 'ring starts solved', i + 1);
    W.forEach(w => { if (!L.has(w)) fail(label, 'answer not lightable', w); });
    const key = [...W].sort().join(); if (keys.has(key)) fail(label, 'dup puzzle', i + 1); keys.add(key);
  });
  return { puzzles: list.length, minPar, maxStartLit, worstWrongLit: worstWrong, keys };
}
const d = check(D.puzzles, 'daily');
const out = { daily: d.puzzles, epoch: D.epoch, minPar: d.minPar, maxStartLit: d.maxStartLit, worstWrongLit: d.worstWrongLit, lightWords: L.size };

// Whole weeks, #1 on a Sunday.
const ep = D.epoch.split('-').map(Number);
if (new Date(Date.UTC(ep[0], ep[1] - 1, ep[2])).getUTCDay() !== 0) fail('epoch is not a Sunday', D.epoch);
if (D.puzzles.length % 7) fail('daily bank is not whole weeks:', D.puzzles.length);

// Answer reuse: 30 days forward, and 7 days across the wrap.
const Pw = D.puzzles.map(p => p[0].split(' ')); const B = Pw.length;
let reuse30 = 0, reuseWrap = 0;
for (let i = 0; i < B; i++) for (let j = i + 1; j < B; j++) {
  const near = j - i <= RECENT, wrap = i + B - j <= WRAP_RECENT;
  if (!near && !wrap) continue;
  const shared = Pw[i].filter(w => Pw[j].includes(w));
  if (!shared.length) continue;
  if (near) { reuse30++; fail('answer reused within', RECENT, 'days: #' + (i + 1), '#' + (j + 1), shared.join(' ')); }
  else { reuseWrap++; fail('answer reused across the wrap: #' + (j + 1), '-> #' + (i + 1), shared.join(' ')); }
}
Object.assign(out, { reuseWithin30: reuse30, reuseAcrossWrap7: reuseWrap });

// Frozen days.
const frozenPath = opt('--frozen');
if (frozenPath) {
  let through = opt('--through');
  if (!through) {
    const g = fs.readFileSync(path.join(__dirname, 'gen_orbit.py'), 'utf8').match(/^FREEZE_THROUGH = '(\d{4}-\d{2}-\d{2})'/m);
    through = g && g[1];
  }
  const t = through.split('-').map(Number);
  const F = Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(ep[0], ep[1] - 1, ep[2])) / 86400000) + 1;
  const LV = load([frozenPath]).ORBIT_DATA;
  if (LV.epoch !== D.epoch) fail('epoch differs from the live bank', LV.epoch, D.epoch);
  // byte-level: the generated row lines themselves must match
  const rows = f => (fs.readFileSync(f, 'utf8').match(/^ {4}\["[A-Z ]+",\d+\]/gm) || []);
  const a = rows(files[0]), b = rows(frozenPath);
  let same = 0;
  for (let i = 0; i < F; i++) {
    if (a[i] === b[i] && JSON.stringify(D.puzzles[i]) === JSON.stringify(LV.puzzles[i])) same++;
    else fail('frozen day changed: #' + (i + 1), b[i], '->', a[i]);
  }
  Object.assign(out, { frozenThrough: through, frozenDays: F, frozenIdentical: same });
}
if (PR) {
  const p = check(PR.puzzles, 'practice');
  const overlap = [...p.keys].filter(k => d.keys.has(k)).length;
  if (overlap) fail('practice/daily overlap', overlap);
  Object.assign(out, { practice: p.puzzles, practiceMinPar: p.minPar, practiceMaxStartLit: p.maxStartLit, practiceWorstWrongLit: p.worstWrongLit, overlap });
}
out.problems = bad;
console.log(JSON.stringify(out));
process.exit(bad ? 1 : 0);
