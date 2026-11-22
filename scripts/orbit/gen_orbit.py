#!/usr/bin/env python3
"""Orbit puzzle bank generator (offline; run from the repo root).

    python3 scripts/orbit/gen_orbit.py               # refresh games/orbit-puzzles.js + orbit-practice.js
    python3 scripts/orbit/gen_orbit.py --fresh       # regenerate every day after FREEZE_THROUGH
    python3 scripts/orbit/gen_orbit.py --freeze-through 2026-11-26 --live /tmp/live-orbit.js --fresh
                                                     # ship-time regen: keep the live bank's days through
                                                     # that date byte-identical, regenerate the rest
    python3 scripts/orbit/gen_orbit.py --rebuild-light   # also refresh light.txt + answer_zipf.txt (needs wordfreq)

Board: 4 rings x 8 spokes. Each spoke, read from the inner ring out, is a 4-letter word.
The inner ring is fixed; rings 2-4 rotate in 45-degree steps, so a board has 8^3 = 512 states.

Every puzzle is PROVEN to have exactly one solved state: all 512 relative rotations are
tried, and only the intended one may make all eight spokes words in the LIGHT dictionary
(the same dictionary the page uses to light a spoke). A ring that repeats under rotation
would give a second identical solved state, so it fails the same check.

Weekday curve: puzzle #1 is a Sunday and the bank is 364 days (52 weeks), so a puzzle's weekday
never shifts when the bank wraps. Each day after FREEZE_THROUGH must land in its weekday's band of
simulated solve time (difficulty.estimate): gentle Monday, rising to the hardest on Saturday.
Days up to FREEZE_THROUGH are copied byte-for-byte from the live bank and never touched.
"""
import datetime, json, os, random, re, sys
from itertools import product

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SPOKES, RINGS, BANK = 8, 4, 364   # 364 = 52 weeks, so weekdays stay aligned when the bank wraps
PRACTICE = 200               # separate practice pool (never a daily word set)
SEED = 20261122
EPOCH = '2026-11-22'          # puzzle #1 (UTC day, a Sunday). Live: never change it.
RECENT = 30                   # an answer word is not reused within this many days
WRAP_RECENT = 7               # ... nor within 7 days across the wrap (day 364 -> day 1)
# The ONE freeze parameter. Days #1 .. this UTC date are live (or will be before the next deploy)
# and are copied byte-for-byte from the live bank. At ship time set it to deploy day + 1 (or pass
# --freeze-through) and regenerate with --fresh --live <live bank>.
FREEZE_THROUGH = '2026-11-24'
CURVE_SEED = SEED + 77
MIN_PAR, MAX_START_LIT = 9, 0 # par 9-12 (each moving ring 2-4 steps off); nothing lit at the start
MAX_WRONG_LIT = SPOKES - 3    # no near-miss: a wrong state may light at most 5 of 8 spokes
MIN_SPOKE_DECOYS = 6          # every spoke can spell 6+ wrong common words (no giveaway spoke)
MIN_AVG_DECOYS = 16           # and spokes average 16+ wrong common words

# Weekday difficulty curve. est = simulated minutes (difficulty.estimate, model time; real first
# plays run ~1.3-1.5x). (est_lo, est_hi, preferred par, answer zipf floor, spoke decoys, avg decoys)
# Monday relaxes the decoy floors and uses the most common answers; Tuesday common answers.
CURVE = {
    'Mon': (0.00, 2.00, 9, 4.4, 2, 6),
    'Tue': (2.00, 2.35, 9, 4.2, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
    'Wed': (2.35, 2.70, 10, 0, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
    'Thu': (2.70, 3.05, 10, 0, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
    'Fri': (3.05, 3.45, 10, 0, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
    'Sat': (3.90, 5.00, 11, 0, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
    'Sun': (3.45, 3.90, 11, 0, MIN_SPOKE_DECOYS, MIN_AVG_DECOYS),
}
WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def weekday(i, epoch=None):
    """Weekday name of bank slot i (0-based) = puzzle #i+1, on the UTC calendar."""
    d = datetime.date.fromisoformat(epoch or EPOCH) + datetime.timedelta(days=i)
    return WEEKDAYS[d.weekday()]


def frozen_count(through=None, epoch=None):
    """How many leading days are frozen: #1 .. `through` inclusive."""
    n = (datetime.date.fromisoformat(through or FREEZE_THROUGH) - datetime.date.fromisoformat(epoch or EPOCH)).days + 1
    return max(0, min(BANK, n))


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
    rebuild_zipf()


def rebuild_zipf():
    from wordfreq import zipf_frequency
    with open(os.path.join(HERE, 'answer_zipf.txt'), 'w') as f:
        f.write('# wordfreq zipf of every answer word (higher = more common). Used by the weekday curve\n'
                '# (Monday/Tuesday draw from the more common answers). Rebuilt by --rebuild-zipf or --rebuild-light.\n')
        for w in sorted(set(words_in('answers.txt'))):
            f.write('%s %.2f\n' % (w, zipf_frequency(w.lower(), 'en')))


def load_zipf():
    z = {}
    for line in open(os.path.join(HERE, 'answer_zipf.txt')):
        line = line.split('#', 1)[0].split()
        if len(line) == 2:
            z[line[0]] = float(line[1])
    return z


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


def evaluate(ws, light, common, deny, spoke_decoys=MIN_SPOKE_DECOYS, avg_decoys=MIN_AVG_DECOYS):
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
    if min(dec) < spoke_decoys or sum(dec) / SPOKES < avg_decoys:
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


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def row_key(p):
    return frozenset(p['w'])


def blocked_words(seq, i, both_sides=False):
    """Answer words slot i may not use: the RECENT days before it (and after it when replacing a
    day in place), plus WRAP_RECENT days across the wrap (day 364 is followed by day 1)."""
    n = len(seq)
    out = set()
    for j in range(max(0, i - RECENT), min(n, i + RECENT + 1) if both_sides else i):
        if j != i:
            out.update(seq[j]['w'])
    for j in range(n):
        if j != i and (j + BANK - i <= WRAP_RECENT or i + BANK - j <= WRAP_RECENT):
            out.update(seq[j]['w'])
    return out


def curve_day(rng, i, block, avoid, answers, zipf, light, common, deny, stats):
    """Generate a puzzle for slot i that passes every rule and lands in its weekday band."""
    from difficulty import estimate
    day = weekday(i)
    lo, hi, want, zfloor, sdec, adec = CURVE[day]
    pool = [w for w in answers if zipf.get(w, 0) >= zfloor and w not in block]
    st = stats.setdefault('curve_' + day, {'tries': 0, 'rule_ok': 0})
    while True:
        st['tries'] += 1
        ws = rng.sample(pool, SPOKES)
        if frozenset(ws) in avoid:
            continue
        why, data = evaluate(ws, light, common, deny, sdec, adec)
        if why:
            continue
        starts = data['starts']
        bestd = min(abs(par_of(o) - want) for o in starts)
        start = rng.choice([o for o in starts if abs(par_of(o) - want) == bestd])
        st['rule_ok'] += 1
        est = estimate(ws, start, light, common)['est']
        if lo <= est < hi:
            return {'w': ws, 's': list(start[1:]), 'par': par_of(start)}


def curve_ok(i, p, seq, avoid, zipf, light, common, deny):
    """Would day i (already in seq) be generated as-is today? Rules + band + reuse windows."""
    from difficulty import estimate
    lo, hi, _, zfloor, sdec, adec = CURVE[weekday(i)]
    if any(zipf.get(w, 0) < zfloor for w in p['w']) or row_key(p) in avoid:
        return False
    why, _ = evaluate(p['w'], light, common, deny, sdec, adec)
    if why or not start_ok(p['w'], (0,) + tuple(p['s']), light, deny):
        return False
    if set(p['w']) & blocked_words(seq, i, both_sides=True):
        return False
    return lo <= estimate(p['w'], (0,) + tuple(p['s']), light, common)['est'] < hi


def main():
    if '--rebuild-light' in sys.argv:
        rebuild_light()
    elif '--rebuild-zipf' in sys.argv:
        rebuild_zipf()
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
    zipf = load_zipf()
    missing = [w for w in answers if w not in zipf]
    if missing:
        sys.exit('answer_zipf.txt is missing %d answers (e.g. %s): run with --rebuild-zipf' % (len(missing), missing[:5]))
    stats = {'tries': 0, 'herrings5': []}
    daily_path = os.path.join(ROOT, 'games/orbit-puzzles.js')
    practice_path = os.path.join(ROOT, 'games/orbit-practice.js')
    through = arg('--freeze-through', FREEZE_THROUGH)
    F = frozen_count(through)
    if weekday(0) != 'Sun':
        sys.exit('EPOCH must be a Sunday so the 52-week bank keeps weekdays aligned')

    # Frozen days: copied byte-for-byte from the LIVE bank (default: the current file). At ship time
    # pass --live with the deployed games/orbit-puzzles.js so no player sees a day change mid-day.
    live = load_bank(arg('--live', daily_path), 'ORBIT_DATA')
    if not live or len(live) < F:
        sys.exit('live bank has fewer than %d days' % F)
    frozen = [dict(p) for p in live[:F]]
    old_practice = load_bank(practice_path, 'ORBIT_PRACTICE') or []
    prac_keys = frozenset(row_key(p) for p in old_practice)

    # Plain run: keep every future day that would still be generated as-is (rules, weekday band,
    # reuse windows) so a word-list tweak never reshuffles the calendar; replace only failures.
    # --fresh (or a bank of another length / other frozen days) regenerates everything after F.
    existing = None if '--fresh' in sys.argv else load_bank(daily_path, 'ORBIT_DATA')
    replaced = []
    if existing and len(existing) == BANK and existing[:F] == frozen:
        daily = existing
        rng = random.Random(CURVE_SEED + 7)
        for i in range(F, BANK):
            avoid = prac_keys | {row_key(q) for j, q in enumerate(daily) if j != i}
            if not curve_ok(i, daily[i], daily, avoid, zipf, light, common, deny):
                replaced.append(i)
                daily[i] = curve_day(rng, i, blocked_words(daily, i, both_sides=True), avoid,
                                     answers, zipf, light, common, deny, stats)
        mode = 'kept'
    else:
        rng = random.Random(CURVE_SEED)
        daily = frozen[:]
        avoid = set(prac_keys) | {row_key(p) for p in daily}
        for i in range(F, BANK):
            p = curve_day(rng, i, blocked_words(daily, i), avoid, answers, zipf, light, common, deny, stats)
            daily.append(p)
            avoid.add(row_key(p))
        mode = 'regenerated'

    # Practice pool: a separate seed and a hard ban on any daily word set, so practice can
    # never preview (or replay) a daily puzzle.
    daily_keys = frozenset(row_key(p) for p in daily)
    practice = generate(random.Random(SEED + 1), PRACTICE, answers, light, common, deny, stats, daily_keys)

    lightlist = sorted(light)
    write_js(daily_path, 'ORBIT_DATA',
             '/* Orbit daily puzzle bank. GENERATED by scripts/orbit/gen_orbit.py. Do not hand-edit.\n'
             '   364 days (52 weeks; #1 is a Sunday). Days #1-#' + str(F) + ' (through ' + through + ') are frozen\n'
             '   copies of the live bank; later days follow the weekday difficulty curve (README).\n' + HEAD_DOC,
             lightlist, daily)
    write_js(practice_path, 'ORBIT_PRACTICE',
             '/* Orbit practice pool. GENERATED by scripts/orbit/gen_orbit.py. Do not hand-edit.\n'
             '   Separate from the daily bank: no practice puzzle uses the same eight words as any day.\n' + HEAD_DOC,
             None, practice)
    h = stats.pop('herrings5') or [0]
    allp = daily + practice
    report = {'daily': len(daily), 'mode': mode, 'frozen_through': through, 'frozen_days': F,
              'daily_replaced': [i + 1 for i in replaced], 'practice': len(practice),
              'practice_changed': [p['w'] for p in practice] != [p['w'] for p in old_practice],
              'answers': len(answers), 'light': len(lightlist),
              'practice_daily_overlap': len(daily_keys & {row_key(p) for p in practice}),
              'par_hist_daily': {p: sum(1 for q in daily if q['par'] == p) for p in range(MIN_PAR, 3 * (SPOKES // 2) + 1)},
              'par_hist_practice': {p: sum(1 for q in practice if q['par'] == p) for p in range(MIN_PAR, 3 * (SPOKES // 2) + 1)},
              'max_wrong_lit_states_avg_new': round(sum(h) / len(h), 2),
              'distinct_answers_used': len({w for p in allp for w in p['w']}), **stats}
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
