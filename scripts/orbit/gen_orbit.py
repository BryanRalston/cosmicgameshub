#!/usr/bin/env python3
"""Orbit puzzle bank generator (offline; run from the repo root).

    python3 scripts/orbit/gen_orbit.py               # refresh games/orbit-puzzles.js + orbit-practice.js
    python3 scripts/orbit/gen_orbit.py --fresh       # rebuild the daily bank from scratch
    python3 scripts/orbit/gen_orbit.py --rebuild-light   # also refresh light.txt (needs wordfreq)

Board: 4 rings x 8 spokes. Each spoke, read from the inner ring out, is a 4-letter word.
The inner ring is fixed; rings 2-4 rotate in 45-degree steps, so a board has 8^3 = 512 states.

Every puzzle is PROVEN to have exactly one solved state: all 512 relative rotations are
tried, and only the intended one may make all eight spokes words in the LIGHT dictionary
(the same dictionary the page uses to light a spoke). A ring that repeats under rotation
would give a second identical solved state, so it fails the same check.
"""
import json, os, random, re, sys
from itertools import product

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPOKES, RINGS, BANK = 8, 4, 366
PRACTICE = 200               # separate practice pool (never a daily word set)
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


def evaluate(ws, light, common, deny):
    """Check one word set against every rule. Returns (reason, None) or (None, data)."""
    # one word per inner letter keeps the fixed ring readable: no repeated inner letters
    if len({w[0] for w in ws}) < SPOKES:
        return 'inner', None
    rings = [''.join(w[r] for w in ws) for r in range(RINGS)]
    states = [(0,) + o for o in product(range(SPOKES), repeat=RINGS - 1)]
    sp = {o: spokes_for(rings, o) for o in states}
    sol = [o for o in states if all(w in light for w in sp[o])]
    if sol != [tuple([0] * RINGS)]:
        return 'multi', None
    wrong = states[1:]
    litc = {o: sum(w in light for w in sp[o]) for o in wrong}
    # Near-miss filter: no wrong state may come within 2 spokes of solved, and at least
    # one wrong state lights 2+ spokes so the board still gives some feedback.
    if max(litc.values()) > MAX_WRONG_LIT or max(litc.values()) < 2:
        return 'nearmiss', None
    # Decoy words: per spoke, wrong states where that spoke spells a COMMON word.
    dec = [sum(1 for o in wrong if sp[o][k] in common) for k in range(SPOKES)]
    if min(dec) < MIN_SPOKE_DECOYS or sum(dec) / SPOKES < MIN_AVG_DECOYS:
        return 'easy', None
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
        return 'nostart', None
    return None, {'starts': starts, 'h5': sum(1 for v in litc.values() if v == MAX_WRONG_LIT)}


def start_ok(ws, start, light, deny):
    rings = [''.join(w[r] for w in ws) for r in range(RINGS)]
    spk = spokes_for(rings, start)
    return (0 not in start[1:] and par_of(start) >= MIN_PAR and
            sum(w in light for w in spk) <= MAX_START_LIT and not any(w in deny for w in spk))


def generate(rng, count, answers, light, common, deny, stats, avoid=frozenset(), near=None):
    """Make `count` fresh puzzles. `avoid` = word-set keys that may not be reused;
    `near(i)` returns words blocked for slot i (the recent-days window)."""
    out, recent = [], []
    while len(out) < count:
        stats['tries'] += 1
        block = set(w for p in recent for w in p)
        if near:
            block |= near(len(out))
        pool = [w for w in answers if w not in block]
        ws = rng.sample(pool, SPOKES)
        if frozenset(ws) in avoid:
            stats['reject_dup'] = stats.get('reject_dup', 0) + 1
            continue
        why, data = evaluate(ws, light, common, deny)
        if why:
            stats['reject_' + why] = stats.get('reject_' + why, 0) + 1
            continue
        starts = data['starts']
        # Prefer longer scrambles: aim for par 10-11 (sometimes 9 or 12), nearest available.
        want = rng.choices([9, 10, 11, 12], weights=[2, 4, 3, 1])[0]
        bestd = min(abs(par_of(o) - want) for o in starts)
        start = rng.choice([o for o in starts if abs(par_of(o) - want) == bestd])
        stats['herrings5'].append(data['h5'])
        out.append({'w': ws, 's': list(start[1:]), 'par': par_of(start)})
        avoid = avoid | {frozenset(ws)}
        recent.append(ws)
        recent = recent[-RECENT:]
    return out


def load_bank(path, var):
    """Read an existing generated bank so a light-list edit does not reshuffle every day."""
    if not os.path.exists(path):
        return None
    txt = open(path).read()
    m = re.search(r'puzzles: \[(.*?)\n  \]', txt, re.S)
    if not m or ('window.' + var) not in txt:
        return None
    out = []
    for w, s in re.findall(r'\["([A-Z ]+)",(\d+)\]', m.group(1)):
        st = [int(c) for c in s]
        out.append({'w': w.split(), 's': st, 'par': par_of((0,) + tuple(st))})
    return out


def write_js(path, var, head, light, puzzles):
    rows = ',\n'.join('    ["' + ' '.join(p['w']) + '",' + ''.join(map(str, p['s'])) + ']' for p in puzzles)
    js = (head +
          'window.' + var + ' = {\n' +
          '  epoch: "' + EPOCH + '",\n'
          '  spokes: ' + str(SPOKES) + ', rings: ' + str(RINGS) + ',\n' +
          ('  light: "' + ' '.join(light) + '",\n' if light else '') +
          '  puzzles: [\n' + rows + '\n  ]\n};\n')
    with open(path, 'w') as f:
        f.write(js)


HEAD_DOC = ('   Each puzzle: w = the eight spoke words in spoke order (inner letter first),\n'
            '   s = clockwise scramble steps for rings 2, 3, 4 (ring 1 is fixed). Every puzzle has\n'
            '   exactly one solved state among all 512 rotations (proven at build time). */\n')


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
    # Glow list = the wordfreq-built light.txt + hand-picked extras + every answer, minus deny.
    light = set(words_in('light.txt')) | set(words_in('extra.txt')) | set(answers)
    light -= deny
    common = set(answers)
    stats = {'tries': 0, 'herrings5': []}
    daily_path = os.path.join(ROOT, 'games/orbit-puzzles.js')
    practice_path = os.path.join(ROOT, 'games/orbit-practice.js')

    # Daily bank: keep the existing days when they still pass every rule against the current
    # glow list (so a word-list tweak never reshuffles published days); --fresh rebuilds.
    daily = None if '--fresh' in sys.argv else load_bank(daily_path, 'ORBIT_DATA')
    replaced = []
    if daily and len(daily) == BANK:
        for i, p in enumerate(daily):
            why, _ = evaluate(p['w'], light, common, deny)
            if why or not start_ok(p['w'], (0,) + tuple(p['s']), light, deny):
                replaced.append(i)
        rng = random.Random(SEED + 7)
        for i in replaced:
            def near(_, i=i):
                return {w for j in range(max(0, i - RECENT), min(BANK, i + RECENT + 1)) if j != i for w in daily[j]['w']}
            avoid = frozenset(frozenset(p['w']) for p in daily)
            daily[i] = generate(rng, 1, answers, light, common, deny, stats, avoid, near)[0]
    else:
        daily = generate(random.Random(SEED), BANK, answers, light, common, deny, stats)

    # Practice pool: a separate seed and a hard ban on any daily word set, so practice can
    # never preview (or replay) a daily puzzle.
    daily_keys = frozenset(frozenset(p['w']) for p in daily)
    practice = generate(random.Random(SEED + 1), PRACTICE, answers, light, common, deny, stats, daily_keys)

    lightlist = sorted(light)
    write_js(daily_path, 'ORBIT_DATA',
             '/* Orbit daily puzzle bank. GENERATED by scripts/orbit/gen_orbit.py. Do not hand-edit.\n' + HEAD_DOC,
             lightlist, daily)
    write_js(practice_path, 'ORBIT_PRACTICE',
             '/* Orbit practice pool. GENERATED by scripts/orbit/gen_orbit.py. Do not hand-edit.\n'
             '   Separate from the daily bank: no practice puzzle uses the same eight words as any day.\n' + HEAD_DOC,
             None, practice)
    h = stats.pop('herrings5') or [0]
    allp = daily + practice
    report = {'daily': len(daily), 'daily_replaced': replaced, 'practice': len(practice),
              'answers': len(answers), 'light': len(lightlist),
              'practice_daily_overlap': len(daily_keys & {frozenset(p['w']) for p in practice}),
              'par_hist_daily': {p: sum(1 for q in daily if q['par'] == p) for p in range(MIN_PAR, 3 * (SPOKES // 2) + 1)},
              'par_hist_practice': {p: sum(1 for q in practice if q['par'] == p) for p in range(MIN_PAR, 3 * (SPOKES // 2) + 1)},
              'max_wrong_lit_states_avg_new': round(sum(h) / len(h), 2),
              'distinct_answers_used': len({w for p in allp for w in p['w']}), **stats}
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
