# Orbit (games/orbit.html)

Rules: 4 letter rings x 8 spokes around a core. Each spoke, read from the core outward, must be a
4-letter word. Ring 1 (inner) is fixed; rings 2-4 turn in 45-degree steps (8^3 = 512 board states).
A spoke lights when it spells a word in the light dictionary; all eight lit = solved.

Scoring: a move is one 45-degree step a ring passes, however it was turned. A drag pays for every
step it crosses (two full spins = 16 moves even if the ring ends where it started), so drag-scanning
is not free. Undo (button, Z, U or Backspace) turns back the last button step or the last whole drag
gesture; it is a real turn, so it costs its steps too. Par = fewest steps from the
scramble (9-12). 3 stars within 2.5x par, 2 stars within 5x par, else 1.

Hints: the Hint button opens a menu (a popover on desktop, a bottom sheet on phones) with two hints,
each usable once a day:
- 🔍 Check rings: shows which moving rings are in place right now (✓ / ✗ on the Ring buttons, a green
  glow on rings in place, a toast and a screen-reader line). Nothing moves. A ring's mark holds while
  the ring stays where it was checked. 3 stars stay possible, but need 2x par instead of 2.5x par.
- 🔒 Lock a ring: snaps the ring furthest off into place and locks it. Max 2 stars.
Using both caps at 2 stars. Saved in `orbit-state-v2` as `check` (move count when used, -1 = unused)
and `checkOffs` (ring offsets at that moment); older saves without these fields load as "unused".

Daily pick: UTC day (same day boundary and countdown as Pixle/Link). Puzzle #1 = `EPOCH` in
gen_orbit.py (a Sunday); the bank is 364 days (52 weeks) so a day's weekday never shifts at the wrap.
The subtitle shows the weekday (e.g. "Daily word rings · #3 · Tue"). Practice uses its own 200-puzzle pool
(games/orbit-practice.js, same rules, separate seed, no puzzle with the same eight words as any day),
so practice can never preview a daily. `?practice=1` plays a random practice puzzle (no stats);
`?practice=1&n=17` plays practice puzzle 17.

Share card (spoiler-free): stars, moves vs par and time, a 10-cell efficiency bar (par / moves,
coloured by stars) and the moves spent on each ring. No words, directions or scramble distances.
Hints show as 🔍 (ring check) and 💡 (ring lock) after the stars and on the card.

## Weekday difficulty curve
Puzzles ramp up through the week. Every day after the freeze is generated to land in its weekday's
band of simulated solve time (`difficulty.estimate`: the word-finder player, 60 runs seeded from the
puzzle, 8 s per word tried + 0.6 s per turn). These are model minutes; real first plays run about
1.3-1.5x longer.

| Day | Band (model min) | Answers | Preferred par | Decoy floor (per spoke / avg) |
|---|---|---|---|---|
| Mon | < 2.00 | zipf >= 4.4 (most common) | 9 | 2 / 6 (relaxed) |
| Tue | 2.00-2.35 | zipf >= 4.2 | 9 | 6 / 16 |
| Wed | 2.35-2.70 | all | 10 | 6 / 16 |
| Thu | 2.70-3.05 | all | 10 | 6 / 16 |
| Fri | 3.05-3.45 | all | 10 | 6 / 16 |
| Sat | 3.90-5.00 | all | 11 | 6 / 16 |
| Sun | 3.45-3.90 | all | 11 | 6 / 16 |

Shipped bank (`python3 scripts/orbit/difficulty.py --weekdays`), median model minutes (p10-p90):
Mon 1.65 (1.20-1.96) · Tue 2.17 (2.04-2.30) · Wed 2.52 (2.38-2.64) · Thu 2.86 (2.72-2.99) ·
Fri 3.22 (3.07-3.37) · Sun 3.64 (3.47-3.79) · Sat 4.21 (3.96-4.65). The old bank was flat (every
weekday's median between 2.40 and 2.70). Zipf values come from `answer_zipf.txt` (rebuilt with
`--rebuild-zipf`), so a normal run doesn't need wordfreq.

### Freeze: days already played never change
`FREEZE_THROUGH` in gen_orbit.py is the ONE freeze setting. Days #1 .. that UTC date are copied
byte-for-byte from the live bank and never re-checked or replaced. verify_bank.js and difficulty.py
read the same constant. Today it is 2026-11-24 (#1-#3), which assumes a deploy on Mon Nov 23 at the earliest.

At ship time: set it to the deploy's UTC day + 1, then regenerate against the bank that is live:

    git show origin/master:games/orbit-puzzles.js > /tmp/live-orbit.js
    python3 scripts/orbit/gen_orbit.py --fresh --live /tmp/live-orbit.js
    node scripts/orbit/verify_bank.js games/orbit-puzzles.js games/orbit-practice.js --frozen /tmp/live-orbit.js
    python3 scripts/orbit/difficulty.py --weekdays

(`--freeze-through DATE` overrides the constant for one run; then pass the same date to
verify_bank.js as `--through DATE`.) Regenerating with a later freeze changes every later day, so
the final bank is generated at ship time. The frozen days sit outside the curve, as one-offs.

## Puzzle rules enforced by the generator
- Exactly one solved state among all 512 rotations (brute force; `verify_bank.js` re-proves it
  from the shipped file).
- Nothing lit at the start; every moving ring starts 1+ steps off; par 9-12 (aim 10-11).
- No near-miss: no wrong state lights more than 5 of 8 spokes (stops "fix the last spoke" solves).
- Some feedback: at least one wrong state lights 2+ spokes.
- No giveaway spoke: every spoke can spell 6+ WRONG common words, 16+ on average, so the first
  word a player spots on a spoke is usually not the answer.
- 8 different inner letters; no answer word reused within 30 days, nor within 7 days across the
  wrap (day 364 -> day 1).
- Each day after the freeze lands in its weekday band (above). Monday relaxes the decoy floor to
  2 per spoke / 6 on average so it can be gentle; every other rule applies every day.

## Difficulty (scripts/orbit/difficulty.py, 60-puzzle sample, 30 runs each)
The word-finder bot models the real strategy: pick a spoke, try the words it can spell there
(common words first), turn the rings to each, stop when everything lights. Since a correct word
on any spoke fixes all three rings, words tried is the main cost.

| Metric | Before (6 spokes) | After (8 spokes) |
|---|---|---|
| Spokes x rings | 6 x 4 | 8 x 4 |
| Board states | 216 | 512 |
| Par (mean) | 6.48 | 10.22 |
| Spokes lit at start | 0.33 | 0.0 |
| Most spokes lit by a wrong state (mean / worst) | 3.42 / 5 | 4.25 / 5 |
| Wrong states lighting 2+ spokes | 25.18 | 112.37 |
| Wrong common words per spoke | 10.39 | 26.4 |
| Word-finder: words tried | 6.31 | 13.78 |
| Word-finder: moves | 26.4 | 75.88 |
| Smart player (easiest spoke first): words / moves | 3.11 / 13.33 | 8.51 / 45.43 |
| Greedy hill-climber: moves (cap 2000) | 1352.36 | 1866.98 |
| Est. minutes (8 s/word + 0.6 s/turn) | 1.1 | 2.6 |

Hill-climbing does not work in either version (lit counts give almost no gradient), so the
near-miss filter is a guard, not the main lever. The real levers are 8 letters per ring
(8^3 = 512 combinations per spoke to scan instead of 216) and more convincing wrong words.

## Files
- answers.txt: curated answer words (common, family-friendly, no names / plural-s / past tense).
- light.txt: words that light a spoke (wordfreq zipf >= 3.0 AND in games/rift-words.json, minus deny.txt).
- extra.txt: hand-picked glow words wordfreq missed (MEME, NOOB, NERF, FIZZ, ONYX, OKRA, OBOE...).
- deny.txt: never light, never shown on a scrambled spoke (offensive words, names, abbreviations,
  and odd glow words such as ARYA, BREE, DOTH, CHIT, EROS).
- answer_zipf.txt: wordfreq zipf per answer (for the Mon/Tue answer floors).
- gen_orbit.py: builds games/orbit-puzzles.js (daily bank + glow list) and games/orbit-practice.js.
  A plain run keeps every day after the freeze that would still be generated as-is (all rules, its
  weekday band, the reuse windows), so a word-list edit never reshuffles days. Only failing days are
  replaced. `--fresh` regenerates every day after the freeze. Frozen days are never touched.
- verify_bank.js: `node scripts/orbit/verify_bank.js games/orbit-puzzles.js games/orbit-practice.js
  [--frozen LIVE.js]`. Re-proves both files: unique solution, 0 lit at start, no wrong state above
  5 lit, par >= 9, no repeats, practice overlap 0, whole weeks from a Sunday, and no answer reuse
  within 30 days or 7 days across the wrap. With --frozen it also checks that the frozen days are
  byte-identical to the live bank.
- difficulty.py: `python3 scripts/orbit/difficulty.py [bank.js] [--sample 60] [--runs 30]`;
  `--weekdays` prints the per-weekday table and exits 1 if any day after the freeze is outside its band.

Rebuild: `python3 scripts/orbit/gen_orbit.py` (add `--rebuild-light` to refresh light.txt; needs wordfreq).

Optional art: paths in the `ART` object at the top of games/orbit.js (backdrop and core are set;
rings is null). With a path left null the CSS/SVG fallback is used and no request is made.
