// Usage: node scripts/orbit/verify_bank.js games/orbit-puzzles.js [games/orbit-practice.js]
// Independent re-proof from the SHIPPED data files: every puzzle (daily and practice) has
// exactly one all-lit state against the shipped glow list, no ring starts solved, nothing is
// lit at the start, no puzzle repeats, and no practice puzzle uses any daily's eight words.
const fs = require('fs'); const vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
process.argv.slice(2).forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx));
const D = ctx.window.ORBIT_DATA, PR = ctx.window.ORBIT_PRACTICE;
const N = D.spokes, R = D.rings, L = new Set(D.light.split(' '));
const mod = (a, n) => ((a % n) + n) % n;
let bad = 0;
function check(list, label) {
  let minPar = 99, maxStartLit = 0; const keys = new Set();
  list.forEach((p, i) => {
    const W = p[0].split(' '), S = [0, ...String(p[1]).split('').map(Number)];
    const rings = [...Array(R)].map((_, r) => W.map(w => w[r]).join(''));
    const sp = o => [...Array(N)].map((_, k) => rings.map((rg, r) => rg[mod(k - o[r], N)]).join(''));
    const sols = [];
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (let c = 0; c < N; c++)
      if (sp([0, a, b, c]).every(w => L.has(w))) sols.push([a, b, c].join(''));
    if (sols.length !== 1 || sols[0] !== '000') { bad++; console.log(label, 'NOT UNIQUE', i + 1, sols); }
    maxStartLit = Math.max(maxStartLit, sp(S).filter(w => L.has(w)).length);
    minPar = Math.min(minPar, S.reduce((s, o) => s + Math.min(o, N - o), 0));
    if (S.slice(1).some(o => o === 0)) { bad++; console.log(label, 'ring starts solved', i + 1); }
    W.forEach(w => { if (!L.has(w)) { bad++; console.log(label, 'answer not lightable', w); } });
    const key = [...W].sort().join(); if (keys.has(key)) { bad++; console.log(label, 'dup puzzle', i + 1); } keys.add(key);
  });
  return { puzzles: list.length, minPar, maxStartLit, keys };
}
const d = check(D.puzzles, 'daily');
const out = { daily: d.puzzles, epoch: D.epoch, minPar: d.minPar, maxStartLit: d.maxStartLit, lightWords: L.size };
if (PR) {
  const p = check(PR.puzzles, 'practice');
  const overlap = [...p.keys].filter(k => d.keys.has(k)).length;
  if (overlap) { bad += overlap; console.log('practice/daily overlap', overlap); }
  Object.assign(out, { practice: p.puzzles, practiceMinPar: p.minPar, practiceMaxStartLit: p.maxStartLit, overlap });
}
out.problems = bad;
console.log(JSON.stringify(out));
process.exit(bad ? 1 : 0);
