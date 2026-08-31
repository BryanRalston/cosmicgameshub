# Games quality bar

## Hard rules
- Do **not** drop `id="hamburger"` on game nav. Missing id used to throw before `init()` and blanked boards.
- Pixle is a **5-letter gaming Wordle**. Do not list it as a screenshot game. Do not invent screenshot assets.
- **BRIX renderer is shipped.** `games/BRIX.md` is law. Feel-only edits (camera/ghost/place) are allowed. Do not reintroduce 4096 shadows or per-brick Mesh groups for the persistent scene.
- Dream Machine is lab-only. Do not count it in the /games product total.
- Isolation: CosmicGamesHub repo only. No Harborline, Rootweave source, or schedule-builder.
- No 25th Wordle clone. No fake email list. No readable text in Imagine images.

## Bar (every game)
- Boots, first interaction works, a round can finish
- 30-second “I get it” onboarding
- Satisfying success/fail (CSS/canvas juice; optional `navigator.vibrate`)
- Mobile 390px playable
- Dailies: streak, share with `cosmicgameshub.com` URL, **Play next daily** CTA, countdown to tomorrow
- Looks like CosmicGamesHub 2026, not a CodePen

## DAU product
`/games/daily` is the front door. One shared day, 12 puzzles, visible progress, streak, next puzzle, share the set.

## NYT bar (flagships)
See `games/NYT_BAR.md`. Pixle, Mini crossword, Link, Gamerdle are editorial products. Do not RNG a Link set. Do not shrink Pixle answers back to a junk list.
