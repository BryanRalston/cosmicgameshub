# Games quality bar

## Hard rules
- Do **not** drop `id="hamburger"` on game nav. Missing id used to throw before `init()` and blanked boards.
- Pixle is a **5-letter gaming Wordle**. Do not list it as a screenshot game. Do not invent screenshot assets.
- **Do not edit `games/brix3d.html`** while the BRIX renderer worktree owns it. Hub card / listing copy only.
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
