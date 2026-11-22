// Usage: node scripts/orbit/verify_bank.js games/orbit-puzzles.js
// Independent re-proof from the SHIPPED data file: every puzzle has exactly one all-lit state.
const fs = require('fs'); const vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
const D = ctx.window.ORBIT_DATA, N = D.spokes, R = D.rings, L = new Set(D.light.split(' '));
const mod = (a, n) => ((a % n) + n) % n;
let bad = 0, minPar = 99, maxStartLit = 0; const seen = new Map();
D.puzzles.forEach((p, i) => {
  const W = p[0].split(' '), S = [0, ...String(p[1]).split('').map(Number)];
  const rings = [...Array(R)].map((_, r) => W.map(w => w[r]).join(''));
  const sp = o => [...Array(N)].map((_, k) => rings.map((rg, r) => rg[mod(k - o[r], N)]).join(''));
  let sols = [];
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (let c = 0; c < N; c++)
    if (sp([0, a, b, c]).every(w => L.has(w))) sols.push([a, b, c].join(''));
  if (sols.length !== 1 || sols[0] !== '000') { bad++; console.log('NOT UNIQUE', i + 1, sols); }
  const startLit = sp(S).filter(w => L.has(w)).length;
  maxStartLit = Math.max(maxStartLit, startLit);
  const par = S.reduce((s, o) => s + Math.min(o, N - o), 0); minPar = Math.min(minPar, par);
  if (S.slice(1).some(o => o === 0)) { bad++; console.log('ring starts solved', i + 1); }
  W.forEach(w => { if (!L.has(w)) { bad++; console.log('answer not lightable', w); } });
  const key = [...W].sort().join(); if (seen.has(key)) { bad++; console.log('dup puzzle', i + 1); } seen.set(key, 1);
});
console.log(JSON.stringify({ puzzles: D.puzzles.length, epoch: D.epoch, notUnique: bad, minPar, maxStartLit, lightWords: L.size }));
process.exit(bad ? 1 : 0);
