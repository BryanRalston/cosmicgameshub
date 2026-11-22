#!/usr/bin/env python3
"""Orbit puzzle bank generator (offline; run from the repo root).

    python3 scripts/orbit/gen_orbit.py               # rebuild games/orbit-puzzles.js
    python3 scripts/orbit/gen_orbit.py --rebuild-light   # also refresh light.txt (needs wordfreq)

Board: 4 rings x 8 spokes. Each spoke, read from the inner ring out, is a 4-letter word.
The inner ring is fixed; rings 2-4 rotate in 45-degree steps, so a board has 8^3 = 512 states.

Every puzzle is PROVEN to have exactly one solved state: all 512 relative rotations are
tried, and only the intended one may make all six spokes words in the LIGHT dictionary
(the same dictionary the page uses to light a spoke). A ring that repeats under rotation
would give a second identical solved state, so it fails the same check.
"""
import json, os, random, sys
from itertools import product

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPOKES, RINGS, BANK = 8, 4, 366
SEED = 20261122
EPOCH = '2026-11-22'          # puzzle #1 (UTC day). Change to launch day before shipping if wanted.
RECENT = 30                   # an answer word is not reused within this many days
MIN_PAR, MAX_START_LIT = 9, 0 # par 9-12 (each moving ring 2-4 steps off); nothing lit at the start
MAX_WRONG_LIT = SPOKES - 3    # no near-miss: a wrong state may light at most 5 of 8 spokes
MIN_SPOKE_DECOYS = 6          # every spoke can spell 6+ wrong common words (no giveaway spoke)
MIN_AVG_DECOYS = 16           # and spokes average 16+ wrong common words


def words_in(name):
    out = []
    for line in open(os.path.join(HERE, name)):
        line = line.split('#', 1)[0]
        out += [w.strip().upper() for w in line.split() if w.strip()]
    return out


def rebuild_light():
    from wordfreq import top_n_list, zipf_frequency
    dic = set(w.upper() for w in json.load(open(os.path.join(ROOT, 'games/rift-words.json'))))
    deny = set(words_in('deny.txt'))
    light = sorted({w.upper() for w in top_n_list('en', 60000)
                    if len(w) == 4 and w.isascii() and w.isalpha() and w.islower()
                    and zipf_frequency(w, 'en') >= 3.0 and w.upper() in dic and w.upper() not in deny})
    with open(os.path.join(HERE, 'light.txt'), 'w') as f:
        f.write('# Orbit light dictionary: 4-letter words with wordfreq zipf >= 3.0 that are in\n'
                '# games/rift-words.json, minus deny.txt. Plus every answer word (added at build).\n')
        for i in range(0, len(light), 20):
            f.write(' '.join(light[i:i + 20]) + '\n')
    print('light.txt:', len(light), 'words')


def spokes_for(rings, offs):
    """offs[r] = clockwise steps ring r is turned from solved. Spoke k shows ring r letter (k - off) % 6."""
    return [''.join(rings[r][(k - offs[r]) % SPOKES] for r in range(RINGS)) for k in range(SPOKES)]


def solved_states(rings, light):
    hits = []
    for o in product(range(SPOKES), repeat=RINGS - 1):
        offs = (0,) + o
        if all(s in light for s in spokes_for(rings, offs)):
            hits.append(offs)
    return hits


def par_of(offs):
    return sum(min(o, SPOKES - o) for o in offs)


def main():
    if '--rebuild-light' in sys.argv:
        rebuild_light()
    dic = set(w.upper() for w in json.load(open(os.path.join(ROOT, 'games/rift-words.json'))))
    deny = set(words_in('deny.txt'))
    answers = []
    for w in words_in('answers.txt'):
        if len(w) != 4 or not w.isalpha():
            print('skip (shape):', w); continue
        if w not in dic:
            print('skip (not in dictionary):', w); continue
        if w in deny:
            print('skip (denied):', w); continue
        if w not in answers:
            answers.append(w)
    light = set(words_in('light.txt')) | set(answers)
    light -= deny
    common = set(answers)
    rng = random.Random(SEED)
    puzzles, recent, stats = [], [], {'tries': 0, 'reject_multi': 0, 'reject_nearmiss': 0, 'reject_easy': 0, 'herrings5': []}
    while len(puzzles) < BANK:
        stats['tries'] += 1
        block = set(w for p in recent for w in p)
        pool = [w for w in answers if w not in block]
        ws = rng.sample(pool, SPOKES)
        # one word per inner letter keeps the fixed ring readable: no repeated inner letters
        if len({w[0] for w in ws}) < SPOKES:
            continue
        rings = [''.join(w[r] for w in ws) for r in range(RINGS)]
        states = [(0,) + o for o in product(range(SPOKES), repeat=RINGS - 1)]
        sp = {o: spokes_for(rings, o) for o in states}
        sol = [o for o in states if all(w in light for w in sp[o])]
        if sol != [tuple([0] * RINGS)]:
            stats['reject_multi'] += 1
            continue
        wrong = states[1:]
        litc = {o: sum(w in light for w in sp[o]) for o in wrong}
        # Near-miss filter: no wrong state may come within 2 spokes of solved, and at least
        # one wrong state lights 2+ spokes so the board still gives some feedback.
        if max(litc.values()) > MAX_WRONG_LIT or max(litc.values()) < 2:
            stats['reject_nearmiss'] += 1
            continue
        # Decoy words: per spoke, wrong states where that spoke spells a COMMON word.
        dec = [sum(1 for o in wrong if sp[o][k] in common) for k in range(SPOKES)]
        if min(dec) < MIN_SPOKE_DECOYS or sum(dec) / SPOKES < MIN_AVG_DECOYS:
            stats['reject_easy'] += 1
            continue
        starts = []
        for o in product(range(1, SPOKES), repeat=RINGS - 1):
            offs = (0,) + o
            if par_of(offs) < MIN_PAR:
                continue
            spk = sp[offs]
            if sum(w in light for w in spk) > MAX_START_LIT or any(w in deny for w in spk):
                continue
            starts.append(offs)
        if not starts:
            continue
        # Prefer longer scrambles: aim for par 10-11 (sometimes 9 or 12), nearest available.
        want = rng.choices([9, 10, 11, 12], weights=[2, 4, 3, 1])[0]
        bestd = min(abs(par_of(o) - want) for o in starts)
        start = rng.choice([o for o in starts if abs(par_of(o) - want) == bestd])
        h5 = sum(1 for v in litc.values() if v == MAX_WRONG_LIT)
        stats['herrings5'].append(h5)
        puzzles.append({'w': ws, 's': list(start[1:]), 'par': par_of(start)})
        recent.append(ws)
        recent = recent[-RECENT:]
    lightlist = sorted(light)
    js = ('/* Orbit puzzle bank. GENERATED by scripts/orbit/gen_orbit.py. Do not hand-edit.\n'
          '   Each puzzle: w = the six spoke words in spoke order (inner letter first),\n'
          '   s = clockwise scramble steps for rings 2, 3, 4 (ring 1 is fixed). Every puzzle has\n'
          '   exactly one solved state among all 512 rotations (proven at build time). */\n'
          'window.ORBIT_DATA = {\n'
          '  epoch: "' + EPOCH + '",\n'
          '  spokes: ' + str(SPOKES) + ', rings: ' + str(RINGS) + ',\n'
          '  light: "' + ' '.join(lightlist) + '",\n'
          '  puzzles: [\n' +
          ',\n'.join('    ["' + ' '.join(p['w']) + '",' + ''.join(map(str, p['s'])) + ']' for p in puzzles) +
          '\n  ]\n};\n')
    with open(os.path.join(ROOT, 'games/orbit-puzzles.js'), 'w') as f:
        f.write(js)
    h = stats['herrings5']
    report = {'bank': len(puzzles), 'answers': len(answers), 'light': len(lightlist),
              'tries': stats['tries'], 'rejected_not_unique': stats['reject_multi'], 'rejected_near_miss': stats['reject_nearmiss'], 'rejected_too_easy': stats['reject_easy'],
              'par_hist': {p: sum(1 for q in puzzles if q['par'] == p) for p in range(MIN_PAR, 3 * (SPOKES // 2) + 1)},
              'max_wrong_lit_states_avg': round(sum(h) / len(h), 2), 'max_wrong_lit_states_max': max(h),
              'distinct_answers_used': len({w for p in puzzles for w in p['w']})}
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
