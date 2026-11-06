# BRIX 3D finish — PR #30 (one round)

Repo worktree: C:\Users\bryma\dev\cgh-brix3d
Local branch: brix3d-finish-tmp (tracks origin/grok/brix3d-perf-quality)
Remote PR branch: grok/brix3d-perf-quality
PR: https://github.com/BryanRalston/cosmicgameshub/pull/30 (DRAFT — keep draft, NEVER merge)
Starting HEAD: 1b4844ce5e723ca1383e73e74ff5fe20588e5cae

## Goal
Finish PR #30 so the diff vs current master is BRIX-only, the Vercel header pattern is valid, the preview is READY, and the test plan passes at desktop 1440x900 and phone 390x844.

## 1. Bring branch up to date; trim to BRIX-only
Current origin/master after fetch is 271a741 (Sudoku Game of the Week #39; includes prior Sudoku work). The PR currently shows ~348 files / +37k lines because the branch diverged. Trim so the PR only changes:
- games/brix3d* and its hashed assets
- the brix3d headers in vercel.json
- briefs/brix3d-*.md

DO NOT touch: index.html, data/featured.json, Sudoku, Holiday Rush, or any other game. Sudoku stays Game of the Week.

Preferred non-force approach:
1. Merge origin/master into this branch (resolve conflicts keeping master for non-BRIX paths).
2. Reset every non-BRIX path to match origin/master (`git checkout origin/master -- <paths>` as needed).
3. Ensure vercel.json keeps master's other headers and only adds/fixes the brix3d hashed-asset headers.
4. Commit the rebase/cleanup.
5. Push with a normal (non-force) push: `git push origin HEAD:grok/brix3d-perf-quality`

If a force-push would be required, STOP. Do not force-push. Save a patch if useful and report.

Making a brand-new tip from master + BRIX files is only OK if it can be pushed without force. Otherwise stop.

## 2. Valid Vercel header source pattern
An earlier deploy failed on:
  "/games/brix3d/:file(brix3d.[0-9a-f]+.(js|css))"
(header at index 3). Fix the source pattern so Vercel accepts it. Preview deploy must reach READY.

## 3. Test plan (fresh browser per check; hard timeouts; reconnect after every reload)
Viewports: desktop 1440x900 and phone 390x844. Up to 3 local test/fix cycles. No Cursor cloud, no Imagine.

Checks:
- Place and undo
- Save and load
- An old build code
- A share link in a fresh tab
- The phone drawer and bottom bar (390x844)
- Cottage, Tower and Buggy
- Other games unchanged
- Large builds above 60 FPS with no lag — report measured FPS numbers

Harness lessons from Sudoku: do not reuse a stale CDP session across reloads; never send a touch event with zero touch points; fresh Chrome per scenario; reconnect after every reload.

## Push rules
- Push to the same PR branch only if everything passes.
- Keep the PR a draft. Never merge.
- Do not commit unrelated briefs/qa dumps beyond briefs/brix3d-*.md that belong in the PR.
- Do not disturb C:\Users\bryma\dev\cgh-sudoku or C:\Users\bryma\dev\cosmicgameshub working trees.

## Report back
- New HEAD sha (or why none)
- PR file count and diffstat vs master
- Preview URL and READY status
- Pass/fail table per check × viewport
- FPS numbers
