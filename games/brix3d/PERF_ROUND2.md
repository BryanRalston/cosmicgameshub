# BRIX 3D round 2

Measured 2026-10-24 on this PC. Headed Chrome 155.0.8059.86. Real GPU, not headless and not SwiftShader.

GPU: ANGLE (Intel, Intel(R) UHD Graphics (0x0000A7A8) Direct3D11 vs_5_0 ps_5_0, D3D11).

Same method as `briefs/brix3d-perf.md`: `http://127.0.0.1:8765/games/brix3d.html`, `brixQuality` cleared before each measured load, `placeGrid`, 0.8 s warmup, then 2 s of `orbitTick`. Draws and triangles are `renderer.info` after that sample. Mobile is 390×844, deviceScaleFactor 2, touch, iPhone user agent, then a reload. Lighthouse 13.5.0, mobile, simulated throttling, `--port=9333`. GPU sample time `2026-10-24T23:58:52.595Z`. Lighthouse `fetchTime` `2026-10-24T23:57:34.414Z`.

The page under test was the single main bundle `brix3d.b4b31c7a72.js` (883,817 bytes) plus `brix3d.09e381f5d1.css` (77,886 bytes). Bloom and SSAO live in `brix3d-post.76f35f6862.js` (496,507 bytes) and load only when post is on and the device is not the mobile graphics path. The mobile Lighthouse run requested the main script (transfer 884,149 bytes) and did not request the post file.

Triangle counts include the whole scene. DPR below is the renderer pixel ratio. FPS is the HUD counter and a measured frame count over the 2 s sample.

## Round 1 after (comparison)

| Scene | HUD FPS | Draws | Triangles |
| --- | ---: | ---: | ---: |
| Desktop 1440×900, 1 brick, balanced, shadow 2048 | 95 | 70 | 2,629 |
| Desktop 1440×900, 520 bricks, balanced, shadow 2048 | 81 | 70 | 280,813 |
| Mobile 390×844, 1 brick, performance, shadow 512 | 165 | 16 | 1,216 |
| Mobile 390×844, 520 bricks, performance, shadow 512 | 165 | 16 | 279,400 |

Lighthouse mobile after round 1: score 0.57, LCP 1.7 s, FCP 1.3 s, TTI 9.3 s, TBT 1,355 ms. Original TBT before any of this work was 626 ms.

## Round 2

| Scene | HUD FPS | Measured FPS | Draws | Triangles | Quality | DPR | Shadow | Scenery draws |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Desktop 1440×900, 1 brick | 63 | 64 | 33 | 19,006 | balanced | 1 | 2048 | 14 |
| Desktop 1440×900, 520 bricks | 58 | 59 | 33 | 297,190 | balanced | 1 | 2048 | 14 |
| Mobile 390×844, 1 brick | 166 | 165 | 19 | 19,552 | performance | 1 | 512 | 14 |
| Mobile 390×844, 520 bricks | 166 | 165 | 19 | 297,736 | performance | 1 | 512 | 14 |

Desktop samples: inner 1440×900, `maxTouchPoints` 2, desktop user agent, one instanced brick batch, `autoSteps` 0, AA `msaa`. Sample frames 129 / 117 over about 2.0 s. Mobile samples: inner 390×844, device pixel ratio 2, renderer DPR 1, `maxTouchPoints` 5, iPhone user agent, 331 frames over 2.0 s.

Lighthouse mobile on this bundle: score **0.62**, FCP **1,253 ms**, LCP **1,652 ms**, speed index **3,551 ms**, TBT **1,443 ms**, TTI **8,426 ms**, CLS **0.225**.

Desktop draw calls fell from 70 to 33 because trees, mountains, clouds, and extra forest meshes bake into 14 material buckets. Bricks stay one `InstancedMesh`. Triangles rose (one brick, 2,629 to 19,006) because the merged forest is drawn whole and is no longer culled per tree. Desktop 520-brick measured FPS is **59**, under 60. The HUD read 58. Mobile draw calls rose from 16 to 19 for the same reason. Mobile FPS stayed about 165.

## Checks

### A. Vercel header

`getTransformedRoutes` from `@vercel/routing-utils` returned no error. Source `/games/brix3d/(brix3d.*)\.(js|css)` compiles to `^/games/brix3d(?:/(brix3d.*))\.(js|css)$`. It matches the hashed js, css, `brix3d-post.*`, and `brix3d-*` chunk names. It does not match `brix3d.html`, the manifest, `src/main.js`, or the icon PNG. The old `:file(brix3d.[0-9a-f]+.(js|css))` pattern is gone.

### 2. Picking

`collectBrickMeshes(true)` is gone. Hover sets `pointerDirty` and flushes from one `requestAnimationFrame` (`scheduleHover`). The game source does not call `readPixels`. Face paint still calls `collectBrickMeshes(false)` in two places because it needs mesh faces.

### 3. Auto quality

On the final bundle, desktop 1440 wide, desktop user agent, `maxTouchPoints` 2, saved quality cleared, page older than the 4 s boot guard: start was balanced, shadow 2048, `autoSteps` 0. One `considerAutoQuality(40, 60, 40)` stayed there. The second call stepped to performance, shadow 1024, `autoSteps` 1. AA stayed `msaa`. `SMAAPass` is not in `brix3d.b4b31c7a72.js`. The build throws if it is.

### 7. 390px drawer

Measured on `brix3d.09e381f5d1.css` at 390×844. Closed: HUD left 4, right 386, top 776, bottom 838. Six buttons on one row, height 52. First button left 9 right 69. Last button left 321 right 382, inside the 390px width. Open: controls class `tray-open`, visible height 520, top 258, bottom 778. The button row did not move. The last rebuild did not change this CSS file.

### C. Save, legacy codes, share links

All of these ran in the live page against `brix3d.b4b31c7a72.js`.

| Check | Result |
| --- | --- |
| `placeStarter('cottage')` | 7 bricks |
| `getProjectData` then `clear` then `loadProjectData` | 7 bricks |
| Legacy `btoa(JSON.stringify(buildShareRecords()))` | prefix `W3si`, `applyCodeBricks` placed 7 |
| `encodeShareToken` / `decodeShareToken` | kind `z`, JSON equal to the records |
| Fresh load of `brix3d.html?sharetest=1#b=<that token>` | toast `Shared build loaded (7 bricks)`, 7 bricks, same main script |

## Grades

| Item | Grade |
| --- | --- |
| A. Vercel header | pass |
| 2. Picking | pass |
| 3. Auto quality, one AA method | pass |
| 4. Merge static scenery | pass |
| 7. 390px drawer and toolbar | pass |
| TBT back toward 626 ms | partial |
| C. Save, legacy code, share link | pass |

Item 4 passes the draw-call cut (70 to 33 on desktop, scenery 14, bricks still 1 batch). Desktop 520 measured FPS is 59. Mobile draws went 16 to 19. Triangles went up because the merged forest is not culled per tree.

TBT is partial. Post-processing is a separate file and the mobile run does not download it. Combining three.js with the game moved TBT from the split-bundle trial (1,472 ms) to **1,443 ms**. That is still above round 1's 1,355 ms and well above the original 626 ms. LCP stays at 1,652 ms. Score moved from 0.57 to 0.62.
