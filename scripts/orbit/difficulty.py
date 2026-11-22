#!/usr/bin/env python3
"""Orbit difficulty metrics for a puzzle bank (games/orbit-puzzles.js or a JSON dump).

    python3 scripts/orbit/difficulty.py [games/orbit-puzzles.js] [--sample 120] [--runs 40]

Metrics per puzzle (averaged over a sample):
- par: fewest 1-step turns from the scramble.
- start_lit: spokes lit at the start.
- max_wrong_lit: most spokes lit by any WRONG state (near-miss / hill-climb risk).
- decoys: wrong states that light 2+ spokes.
- common_decoys: per spoke, how many WRONG states make that spoke a common (answer-list)
  word. These are the "looks right, isn't" words a player rotates into and has to undo.
- wordfinder: simulated player. Picks a spoke, tries the words it can spell there (common
  words first, in random order), turns the rings to each (counting moves), and stops when
  all spokes light. Reports mean moves and mean words tried. A rough proxy for time:
  ~8 s to spot + set a candidate word, ~0.6 s per turn.
- smart: the same player, but starting on the spoke with the fewest possible words.
- greedy: hill-climber taking the 1-step turn that lights the most spokes (random among
  ties, random turn when nothing improves); mean moves, capped at 2000.
"""
import json, os, random, re, sys
from itertools import product

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def load_bank(path):
    src = open(path).read()
    spokes = int(re.search(r'spokes:\s*(\d+)', src).group(1))
    rings = int(re.search(r'rings:\s*(\d+)', src).group(1))
    light = set(re.search(r'light:\s*"([^"]*)"', src).group(1).split())
    puzzles = []
    for m in re.finditer(r'\["([A-Z ]+)",(\d+)\]', src):
        puzzles.append((m.group(1).split(), [0] + [int(c) for c in m.group(2)]))
    return spokes, rings, light, puzzles


def words_in(name):
    out = []
    for line in open(os.path.join(HERE, name)):
        out += [w.strip().upper() for w in line.split('#', 1)[0].split() if w.strip()]
    return out


class Board:
    def __init__(self, words, N, R, light, common):
        self.N, self.R, self.light, self.common = N, R, light, common
        self.rings = [''.join(w[r] for w in words) for r in range(R)]
        self.states = [(0,) + o for o in product(range(N), repeat=R - 1)]
        self.solved = tuple([0] * R)

    def spokes(self, offs):
        N = self.N
        return [''.join(self.rings[r][(k - offs[r]) % N] for r in range(self.R)) for k in range(N)]

    def lit(self, offs):
        return sum(s in self.light for s in self.spokes(offs))

    def dist(self, a, b):
        N = self.N
        return sum(min((x - y) % N, (y - x) % N) for x, y in zip(a, b))


def static_metrics(b, start):
    wrong = [s for s in b.states if s != b.solved]
    lits = {s: b.lit(s) for s in b.states}
    common_dec = []
    for k in range(b.N):
        common_dec.append(sum(1 for s in wrong if b.spokes(s)[k] in b.common))
    return {
        'par': b.dist(start, b.solved),
        'start_lit': lits[tuple(start)],
        'max_wrong_lit': max(lits[s] for s in wrong),
        'decoys': sum(1 for s in wrong if lits[s] >= 2),
        'common_decoys': sum(common_dec) / b.N,
    }


def wordfinder(b, start, rng, smart=False):
    cur, moves, tried = tuple(start), 0, 0
    order = list(range(b.N)); rng.shuffle(order)
    if smart:  # start on the spoke with the fewest words to try (best case for a sharp player)
        order.sort(key=lambda k: sum(1 for s in b.states if b.spokes(s)[k] in b.light))
    seen = set()
    for k in order:
        cands = [s for s in b.states if b.spokes(s)[k] in b.light]
        com = [s for s in cands if b.spokes(s)[k] in b.common]; rng.shuffle(com)
        rare = [s for s in cands if s not in com]; rng.shuffle(rare)
        for s in com + rare:
            if s in seen:
                continue
            seen.add(s)
            moves += b.dist(cur, s); cur = s; tried += 1
            if s == b.solved:
                return moves, tried
            # a player whose turn lights several spokes may switch to one of them; ignored here
    return moves, tried


def greedy(b, start, rng, cap=2000):
    cur, moves = list(start), 0
    while moves < cap:
        if tuple(cur) == b.solved:
            return moves
        base = b.lit(cur)
        best, bl = [], -1
        for r in range(1, b.R):
            for d in (1, -1):
                n = cur[:]; n[r] = (n[r] + d) % b.N
                l = b.lit(n)
                if l > bl: best, bl = [n], l
                elif l == bl: best.append(n)
        nxt = rng.choice(best) if bl > base else [cur[:]][0]
        if bl <= base:
            r = rng.randrange(1, b.R); nxt = cur[:]; nxt[r] = (nxt[r] + rng.choice((1, -1))) % b.N
        cur = nxt; moves += 1
    return cap


def report(path, sample=120, runs=40, seed=7):
    N, R, light, puzzles = load_bank(path)
    common = set(words_in('answers.txt'))
    rng = random.Random(seed)
    idx = list(range(len(puzzles)))
    pick = idx if sample >= len(idx) else sorted(rng.sample(idx, sample))
    agg = {}
    def add(k, v): agg.setdefault(k, []).append(v)
    for i in pick:
        words, start = puzzles[i]
        b = Board(words, N, R, light, common)
        for k, v in static_metrics(b, start).items(): add(k, v)
        wf = [wordfinder(b, start, rng) for _ in range(runs)]
        add('wf_moves', sum(m for m, _ in wf) / runs)
        add('wf_words', sum(t for _, t in wf) / runs)
        sm = [wordfinder(b, start, rng, smart=True) for _ in range(max(4, runs // 3))]
        add('smart_moves', sum(m for m, _ in sm) / len(sm))
        add('smart_words', sum(t for _, t in sm) / len(sm))
        add('greedy_moves', sum(greedy(b, start, rng) for _ in range(max(4, runs // 8))) / max(4, runs // 8))
    out = {'bank': len(puzzles), 'spokes': N, 'rings': R, 'states': N ** (R - 1), 'sampled': len(pick)}
    for k, v in agg.items():
        out[k] = round(sum(v) / len(v), 2)
    out['max_wrong_lit_worst'] = max(agg['max_wrong_lit'])
    out['est_minutes'] = round((out['wf_words'] * 8 + out['wf_moves'] * 0.6) / 60, 1)
    return out


if __name__ == '__main__':
    argv = sys.argv[1:]
    args = [a for i, a in enumerate(argv) if not a.startswith('--') and not (i and argv[i - 1] in ('--sample', '--runs'))]
    path = args[0] if args else os.path.join(ROOT, 'games/orbit-puzzles.js')
    sample = int(sys.argv[sys.argv.index('--sample') + 1]) if '--sample' in sys.argv else 120
    runs = int(sys.argv[sys.argv.index('--runs') + 1]) if '--runs' in sys.argv else 40
    print(json.dumps(report(path, sample, runs), indent=1))
