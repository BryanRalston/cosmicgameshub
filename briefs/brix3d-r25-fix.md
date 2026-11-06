# BRIX 3D r25 fix — PR #30 (one Grok Interface round)

Worktree: C:\Users\bryma\dev\cgh-brix3d
Branch: brix3d-finish-tmp → origin/grok/brix3d-perf-quality
Start HEAD: ee06b99bfae6fd0660bb5ab5f78c8fb03cd24216
PR: https://github.com/BryanRalston/cosmicgameshub/pull/30 (DRAFT — keep draft, NEVER merge)

Read Game Tester notes first:
C:\Users\bryma\dev\cgh-brix3d\briefs\brix3d-r25-scores.md

## Blockers (phone, touch)
1. In Move mode, tapping an existing brick must pick it up. Right now it places a new brick (count 50→51) and the banner stays. Fix pick-vs-place on touch.
2. Floor tool needs a touch method (e.g. tap corner A then corner B, or one-finger drag that paints while orbit is suspended). Update its hint text for touch.

## Nits
(a) Load from Code dialog: title for loading, Load button (not "Name your build" / Save). Label share textarea correctly (link vs code). Desktop share modal must fit or scroll at ~715 px tall.
(b) Feedback toasts: Load with nothing selected; phone Save; repeated starter (add or explain why not).
(c) Show more of the phone drawer above the dock; sensible starter size on the plate; more plate contrast vs ground; remove the desktop black bar at the top-left of the canvas.

## Keep / regressions
Keep 520-brick FPS above 60 at 1440x900 and 390x844, and everything that already passed: first brick, undo/redo, save/load, old codes, share link in a fresh tab, starters, drawer and bottom bar, other games unchanged.

## Scope
- Touch BRIX files only (games/brix3d*, briefs/brix3d-*, vercel.json headers if needed). PR must stay BRIX-only vs master.
- Do NOT touch cgh-sudoku, Harborline, index.html, featured.json, Sudoku, Holiday Rush, or other games.

## Test plan (up to 3 local test/fix cycles)
Fresh browser per check. Hard timeouts. Reconnect after every reload. Never send touch events with 0 points.
Viewports: 1440x900, 390x844 touch, and ~715 px-tall desktop for the share modal.

Verify:
- Blocker 1 Move pick-up on phone
- Blocker 2 Floor on phone + updated hint
- Nits a, b, c
- Regressions: place/undo, save/load, old code, share link, starters, drawer/bar, other games, FPS-520 at both sizes

## Push rule (important)
Commit locally when green. DO NOT push. The babysitter will re-run the full harness and push only if that re-run passes. Leave HEAD ready and print a clear summary of sha, pass/fail per item, and FPS.

No Cursor cloud. No Imagine. No force-push. No merge.
