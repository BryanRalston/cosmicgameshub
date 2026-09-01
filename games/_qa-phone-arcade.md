# Phone mini-app QA — arcade / skill (390×844)

Puppeteer-core + Chrome, `python -m http.server` on **8768**, viewport **390×844**, `isMobile` + touch. Screenshots: `_qa/playtest/phone-arcade/`. Server stopped after the pass.

Bar: viewport-fit=cover, Start/Play/Fire/mode ≥ 44px, canvas `touch-action: none` and thumb-playable, no 300px empty chrome above the playfield, no horizontal overflow, after-round score + Play again + Share if the game already had share, type-racer input ≥ 16px, minesweeper long-press flag, beat-lab lane buttons on coarse pointer. Desktop not rewritten.

| game | overflow | 44px | playable | notes | fixed-this-pass |
|---|---|---|---|---|---|
| aim-trainer | none | pass | yes | Canvas 372×686, top 158 (nav+HUD). Start/mode/Play again 44px. Hamburger kept. Share already existed. | viewport-fit, canvas fills leftover viewport, compact title, `touch-action: none` |
| asteroid-dodge | none | pass | yes | Full 390×844 canvas. FIRE/THRUST 72px on coarse. Guns/wrap unchanged. Share + Play again already existed. | viewport-fit, overlay wrap, coarse HUD copy, hide site-link, safe-area pads |
| beat-lab | none | pass | yes | Full-viewport canvas. Four lane buttons 68px during play. Play again + Share already existed. | canvas `position:fixed` fill, 44px selects, title wrap, lanes on coarse, hide lab-nav while playing |
| color-memory | none | pass | yes | 2×2 pads ~150px. Start / Play again / Share 44px. Hamburger kept. | viewport-fit, 44px actions, wider grid, compact chrome |
| memory-match | none | pass | yes | 4×4 cards ~80px. Theme/size/New Game 44px. Share on win already existed. Hamburger kept. | viewport-fit, 44px chips, compact intro |
| minesweeper | none | pass | yes | Easy cells **41px** (9×44 would overflow 390). Long-press flagged a cell in playtest (`🚩`). Hard 16×30 shrinks to fit, no page overflow. Share already existed. | rewrote long-press (flag on hold, swallow click), cell fit, 44px diffs |
| reaction-trainer | none | pass | yes | Tap pad ~52vh, not a 220px circle under a wall of text. Try again / Share 44px. | viewport-fit, large pad, compact title |
| type-racer | none | pass | yes | Hidden input is a 16px overlay on the phrase box (no iOS zoom). Mode 48px. Play again + Share already existed. | viewport-fit, 16px overlay input, tap hint, compact intro |
| void-keeper | none | pass | yes | Full-viewport canvas, Play/Share 44px. | viewport-fit, `touch-action: none`, overlay wrap, hide site-link |
| brix3d | none | primary chrome pass | yes | **Browser 3D wrapper, not a native app.** Quick/back/zoom/HUD ≥ 44px. Collapsed tray still has smaller time/weather chips until opened. Renderer not touched (no 4096 shadows, no per-brick Mesh groups). | 100dvh, 44px tap chrome, back link, nowrap quick bar, hide FPS overlap |
| rootweave | none | pass | yes | Wrapper only — iframe is the hosted sim. Hero/note hidden on 390 so the frame sits under title + Play. | viewport-fit, compact chrome, taller iframe |

## Playtest notes
- Aim/reaction/void/asteroid/beat canvases fill the usable 390×844 viewport.
- Minesweeper long-press: `touchstart` 500ms → cell flagged, click suppressed.
- Beat Lab lanes: `#lane-buttons.active` display flex after countdown; 68px ≥ 44.
- BRIX canvas metrics sometimes report 0×0 during boot (WebGL in `#container`); screenshot shows a full-viewport 3D playfield.
- Lab games (asteroid, beat-lab, void-keeper, brix3d) have no `id="hamburger"` — they use `#lab-nav`. Hub-styled games kept `id="hamburger"`.
- Dream Machine skipped (lab-only). Daily games / `daily-kit.js` / `global.js` / `styles.css` / homepage not edited.
