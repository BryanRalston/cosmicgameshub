# BRIX 3D round 16

Branch `grok/brix3d-perf-quality`. Not merged. Before is round 15 `318b018` in `qa/pr30-r15`. That before was not re-captured. After is the headed capture on the final bundle: server `http://127.0.0.1:8765`, Chrome remote debugging port 9333, Lighthouse 13.5.0. Official GPU numbers are `gpu.json`. Official Lighthouse files are `lh-1.json`, `lh-2.json`, and `lh-3.json`. Playwright results are `results.md`. Screenshots are in this folder.

Boot is `brix3d.B7TJPEGQ.js`. CSS is `brix3d.d5a68c88b4.css`. The vignette chunk is still `brix3d-UNTYEX2X.js`. Desktop balanced loads it and keeps bloom off. Phone performance does not load it. Exposure stays 1.6 desktop and 1.75 phone. Tone mapping stays linear. Nothing in this round parks work on a timer to push it past TTI.

## Grades

| Lane | r15 self-check | r15 Game Tester | r16 |
| --- | ---: | ---: | ---: |
| Desktop functional | 10 | 6.5 | 9 |
| Desktop performance | 9 | 9.5 | 9 |
| Phone functional | 10 | 7.5 | 9 |
| Phone performance | 9 | 9.5 | 9 |

The ranked checks in `run.mjs` all passed. Performance holds frame rate, place time, TBT, CLS, and the 0.99 score. Lighthouse run 1 still lists one Unattributable simulated task over 50 ms, so performance stays at 9. A plate-wide spread of 1×1 bricks fits the frame and is only a few pixels in the 200×150 JPEG, so the thumbnail item stays short of a 10.

## What changed

Name focus moves on pointerdown. Hotkeys ignore the event when `document.activeElement` or `event.target` is an input, textarea, select, or contenteditable. The first Save pointerdown writes the project. The first HUD Delete click removes the brick under the cursor, or the newest brick, and both counters update. Escape closes the Mirror panel even when a field is focused. The new-project body is "The bricks on the plate will be cleared. Save first if you want to keep them." The title stays "Start a new project?" and the button stays "New project".

Gallery thumbs frame the build's bounding sphere along the desktop home ray, with 10% padding on the limiting FOV. Grass is a 16000-unit plane. Fog starts at 480 and ends at 2200, including the first frame and Clear weather, and the colour follows the sky. Overlapping brick tops use `polygonOffset` plus a per-brick bias. One wheel notch moves at most 1.5 units and cannot pass the minimum distance (6 desktop, 5 phone). Desktop home sits on the plate-frame distance, about 103.7, with the rim in view. Phone home stays at distance 22. Phone max zoom is the plate frame, about 210. Printed stud edges use a narrow `fwidth` blend. The phone drawer is 30vh. The saved toast sits at the top of the phone layout. Toolbar labels are 13px, weight 800, white. The desktop sidebar gap and padding are looser.

## Playwright

`qa/pr30-r16/run.mjs` on headless Chromium, desktop 1440×900 and phone 390×844. Every row passed.

| Item | Result | Detail |
| --- | --- | --- |
| D1 Name typing ignores hotkeys | PASS | value kept, rot 0, mirror closed |
| D1b First Save click writes the project | PASS | stored |
| D2a Thumb 1 brick | PASS | ndc 0.737, fill 63.3%, margin 14.0% |
| D2b Thumb 3 spread | PASS | ndc 0.479, dist 107.1, bricks smaller than a JPEG block |
| D2c Thumb 6 tower | PASS | ndc 0.768, fill 68.0%, margin 10.7% |
| D2d Thumb 15 in a row | PASS | ndc 0.584, fill 51.0%, margin 21.0% |
| D3 Ground and fog reach the horizon | PASS | grass x 8038, fog 2200 |
| D3b Overlapping tops get a depth bias | PASS | 5 distinct biases |
| D4 One wheel notch is a small clamped step | PASS | zoom-in 1.50 from 103.4, min 6, max 104.2 |
| D5 Desktop home frames the plate and its rim | PASS | dist 103.4, ndc 0.911 |
| D6 Toolbar labels are larger and the sidebar is looser | PASS | 13px, gap 8, pad 16 |
| D7 First Delete click updates the counter | PASS | 1 to 0 |
| D8 Escape closes Mirror while a field is focused | PASS | closed |
| D9 New-project body does not repeat the title | PASS | body differs from the title |
| P1 Phone max zoom shows the far plate edge | PASS | max 210.1, ndc 0.977 |
| P2 Phone thumbs use the same sphere fit | PASS | same ndc as desktop |
| P3 Printed studs have no wide transition ring | PASS | blend 1px |
| P4 Drawer stays within 30% and the toast leaves the scene | PASS | drawer 0.300, toast y 48 |
| P5 Phone name, Delete, and shaded yellow | PASS | hue 58.8, delete ok |
| ERR No page errors | PASS | 0 |

## Numbers

Desktop is 1440×900, deviceScaleFactor 1, balanced, MSAA, vignette on, bloom off. Phone emulation is 390×844, deviceScaleFactor 2, iPhone UA, performance, renderer dpr 1. Desktop home ray stays `(22, 40, 42)` at distance 103.74. Phone home ray stays `(58, 16, 62)` at distance 22.53. Empty-plate zoom cap is 104.2 desktop and 210.1 phone. Minimum distance is 6 desktop and 5 phone.

| Scene | r15 HUD / measured | r15 draws max | r16 HUD / measured | r16 draws max | r16 shadow |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1 brick | 140 / 141 | 11 | 141 / 141 | 63 | 512 |
| Desktop 520 | 107 / 108 | 12 | 131 / 132 | 63 | 256 |
| Phone 1 brick | 166 / 166 | 30 | 166 / 165 | 32 | 256 |
| Phone 520 | 166 / 166 | 31 | 166 / 166 | 33 | 256 |

Desktop 1 repeats: measured 140, 141, 141 (median 141), HUD 141, 141, 141. Distance 103.74. Desktop 520 repeats: measured 133, 132, 132 (median 132), HUD 132, 131, 131 (median 131). The floor is 96. Phone 1 repeats: measured 165, 160, 166 (median 165), HUD 166, 157, 166 (median 166). Phone 520 repeats: measured 166, 166, 166. Phone distance on every sample is 22.53. The higher desktop draw count is the wider camera: the frame now includes the full plate and the surrounding scenery. `autoSteps` stayed 0. Quality stayed balanced on desktop and performance on phone.

Time until the first brick can be placed, from `brixPlaceableAt` on those same loads. Desktop: 309 ms, 313 ms, 336 ms (median 313). Phone: 341 ms, 345 ms, 342 ms (median 342). Every load is under 500 ms. Round 15 medians were 328 desktop and 310 phone.

| Metric | r15 median | r16 run 1 | r16 run 2 | r16 run 3 | r16 median |
| --- | ---: | ---: | ---: | ---: | ---: |
| Score | 0.99 | 0.99 | 0.99 | 0.99 | 0.99 |
| FCP | 1,202 | 1,202 | 1,277 | 1,203 | 1,203 |
| LCP | 2,110 | 2,107 | 2,110 | 2,110 | 2,110 |
| Speed index | 1,255 | 1,202 | 1,277 | 1,203 | 1,203 |
| TBT | 0 | 0 | 0 | 0 | 0 |
| TTI | 2,110 | 2,107 | 2,110 | 2,110 | 2,110 |
| CLS | 0 | 0 | 0 | 0 | 0 |
| Longest task | 99 Unattributable | 117 Unattributable | none ≥ 50 | none ≥ 50 | 117 |

Fetch times: `2026-10-25T21:49:07.325Z`, `2026-10-25T21:49:33.032Z`, `2026-10-25T21:49:58.563Z`. Final URLs are `?lh=r16f1`, `?lh=r16f2`, and `?lh=r16f3`. `numTasksOver50ms` is 0 on every run. The long-task audit is empty on runs 2 and 3. Run 1 is Unattributable at simulated t=601, the same class as round 15. The tallest observed main-thread tasks are 29.3 ms at t=11, 8.1 ms at t=16, and 12.0 ms at t=7. TBT stays 0 and the score stays 0.99.

Phone shaded yellow in the Playwright capture was hue 58.8 against swatch 54.1. Lighting was not retuned.
