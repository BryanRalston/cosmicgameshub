# BRIX 3D performance

Measured 2026-10-24 on this PC, headed Chrome 155, real GPU (not headless SwiftShader).

GPU: ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8) Direct3D11 vs_5_0 ps_5_0, D3D11).

Method: local static server `http://127.0.0.1:8765/games/brix3d.html`, Chrome remote debugging, `window.brixDebug.placeGrid`, then 0.8 s warmup and 2 s of continuous `orbitTick` so the on-demand renderer stays busy. Draw calls and triangles are `renderer.info` after that render (`brixDebug.getStats`). Mobile pass uses a 390×844 viewport, deviceScaleFactor 2, touch, and an iPhone user agent, then a reload so quality defaults see that device. Saved `brixQuality` was cleared before each After load so the numbers are the first-visit defaults. Lighthouse 13.5.0 mobile, simulated throttling, attached to the same headed Chrome (`--port=9333`).

Triangle counts include the whole scene (baseplate, forest scenery, and bricks), not bricks alone. DPR below is the renderer pixel ratio, not the device pixel ratio.

## Before

| Scene | FPS | Draws | Triangles | Quality | DPR | Shadow |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Desktop 1440×900, 1 brick | 88 | 71 | 592,919 | balanced | 1 | 2048 |
| Desktop 1440×900, 520 bricks | 79 | 71 | 871,103 | balanced | 1 | 2048 |
| Mobile 390×844, 1 brick | 165 | 35 | 591,023 | balanced | 1.25 | 1024 |
| Mobile 390×844, 520 bricks | 163 | 35 | 869,207 | balanced | 1.25 | 1024 |

Lighthouse mobile: performance score **55**, LCP **5.0 s**, FCP **4.6 s**, TTI **7.7 s**, TBT **626 ms**.

Desktop was already near 60 FPS on this iGPU. The baseplate still contributed hundreds of thousands of triangles and a 2048 shadow map. Mobile was still the Balanced preset (DPR 1.25, bloom + SMAA on top of MSAA). LCP was dominated by the 632 KB inline document plus the unpkg three.js waterfall.

## After

| Scene | FPS | Draws | Triangles | Quality | DPR | Shadow |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| Desktop 1440×900, 1 brick | 95 | 70 | 2,629 | balanced | 1 | 2048 |
| Desktop 1440×900, 520 bricks | 81 | 70 | 280,813 | balanced | 1 | 2048 |
| Mobile 390×844, 1 brick | 165 | 16 | 1,216 | performance | 1 | 512 |
| Mobile 390×844, 520 bricks | 165 | 16 | 279,400 | performance | 1 | 512 |

Lighthouse mobile: performance score **57**, LCP **1.7 s**, FCP **1.3 s**, TTI **9.3 s**, TBT **1,355 ms**.

Same Intel UHD. Desktop Balanced with 520 bricks stays above 60 FPS (81). A 520-brick phone load on the Performance preset holds 165 FPS in this emulation, with renderer DPR 1, no bloom, and a 512 shadow map. Triangles for one brick fell from 592,919 to 2,629 because the 9,216 shadow-casting studs are now one plane. Draw calls stay in the tens because the forest props are still separate meshes. LCP is under 2.5 s. The overall score only moved 55 to 57 because the self-hosted three.js bundle is about 975 KB and its parse shows up as total blocking time. Time to interactive is longer than before for that reason.

Checked in the same Chrome session: a project save reloaded to the same brick count, a legacy `btoa` build code reloaded, and a `#b=` share link round-tripped. No page errors. `games/rootweave.html` still points at the original thumbnail.

## Item status

| # | Item | Status |
| --- | --- | --- |
| 1 | Baseplate studs | Done. One textured, normal-mapped plane. It does not cast shadows. |
| 2 | Picking | Done. Hover uses the brick grid and runs once per frame. No `readPixels` in the game. |
| 3 | Mobile defaults | Done. First visit uses Performance, pixel ratio 1, bloom off, MSAA only, shadow map 512. Quality steps down when demanded frames stay under 50 FPS. |
| 4 | Static bricks and lights | Done. Plain bricks share one instanced batch with per-instance color. Real brick lights stay capped at 4. |
| 5 | Load | Done. three.js r160 and the game are one hashed file. The large stylesheet is a second hashed file. Both are immutable in `vercel.json`. Analytics waits until idle. Thumbnail is a 39 KB JPEG. Manifest icons are real PNGs. `mobile-web-app-capable` is set. |
| 6 | First build | Done. Default time of day is noon with stronger sun and ambient light. Cottage, tower, and buggy drop in with one tap. |
| 7 | 390px layout | Done. Tools sit in a bottom drawer. The build bar is one row of 52px targets and stays inside the screen. |
| 8 | Share link | Done. Copy Share Link writes `#b=` plus the same brick records as the build code. Code, `.brick`, and PNG export stay. Old codes still load. |
| 9 | Daily prompt | Done. One short prompt per day. Dismiss is remembered until tomorrow. |
| 10 | Place feedback | Done. A snap, a short bounce, and a dust puff play when a brick lands. |
