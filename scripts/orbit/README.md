# Orbit (games/orbit.html)

Rules: 4 letter rings x 8 spokes around a core. Each spoke, read from the core outward, must be a
4-letter word. Ring 1 (inner) is fixed; rings 2-4 turn in 45-degree steps (8^3 = 512 board states).
A spoke lights when it spells a word in the light dictionary; all eight lit = solved.

Scoring: a move is one 45-degree step a ring passes, however it was turned. A drag pays for every
step it crosses (two full spins = 16 moves even if the ring ends where it started), so drag-scanning
is not free. Undo (button, Z, U or Backspace) turns back the last button step or the last whole drag
gesture; it is a real turn, so it costs its steps too. Par = fewest steps from the
scramble (9-12). 3 stars within 2.5x par, 2 stars within 5x par, else 1. One hint a day locks the
ring that is furthest off into place and caps the result at 2 stars.

Daily pick: UTC day (same day boundary and countdown as Pixle/Link). Puzzle #1 = `EPOCH` in
gen_orbit.py; the bank wraps after 366 days. Practice uses its own 200-puzzle pool
(games/orbit-practice.js, same rules, separate seed, no puzzle with the same eight words as any day),
so practice can never preview a daily. `?practice=1` plays a random practice puzzle (no stats);
`?practice=1&n=17` plays practice puzzle 17.

Share card (spoiler-free): stars, moves vs par and time, a 10-cell efficiency bar (par / moves,
coloured by stars) and the moves spent on each ring. No words, directions or scramble distances.

## Puzzle rules enforced by the generator
- Exactly one solved state among all 512 rotations (brute force; `verify_bank.js` re-proves it
  from the shipped file).
- Nothing lit at the start; every moving ring starts 1+ steps off; par 9-12 (aim 10-11).
- No near-miss: no wrong state lights more than 5 of 8 spokes (stops "fix the last spoke" solves).
- Some feedback: at least one wrong state lights 2+ spokes.
- No giveaway spoke: every spoke can spell 6+ WRONG common words, 16+ on average, so the first
  word a player spots on a spoke is usually not the answer.
- 8 different inner letters; no answer word reused within 30 days.

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
- gen_orbit.py: builds games/orbit-puzzles.js (daily bank + glow list) and games/orbit-practice.js.
  A plain run keeps every existing daily that still passes all rules against the current glow list
  (a word-list edit never reshuffles days); failing days are replaced; `--fresh` rebuilds all.
- verify_bank.js: `node scripts/orbit/verify_bank.js games/orbit-puzzles.js games/orbit-practice.js`
  (re-proves both files and checks practice/daily overlap is 0).
- difficulty.py: `python3 scripts/orbit/difficulty.py [bank.js] [--sample 60] [--runs 30]`.

Rebuild: `python3 scripts/orbit/gen_orbit.py` (add `--rebuild-light` to refresh light.txt; needs wordfreq).

Optional art: paths in the `ART` object at the top of games/orbit.js (backdrop and core are set;
rings is null). With a path left null the CSS/SVG fallback is used and no request is made.
