# Phone mini-app QA — daily games (390×844)

Playtest: puppeteer-core + Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`, viewport 390×844 dsf 2, `python -m http.server` on 127.0.0.1:8766.

Overflow = `document.documentElement.scrollWidth <= 390`. 44px = computed height of **visible** primary taps (keys, submit, tiles, share, play-again, next daily). Share-after = share control with a `cosmicgameshub.com` URL after a finished round (copy and/or `navigator.share` via `daily-kit.js`).

Not perfect. Help `?` / `#` stay ~32–44px (not primary). Closed result modals still use `scale(0.92)`, so hidden share/dock measure ~40px until the modal opens. Related-games blocks still sit under some boards. Gear Quiz still labels “1 of 22” (pre-existing bank, not this pass). Full auto-solve of every daily was not run; live finish+share was confirmed on Pro Kit Daily.

| game | overflow | 44px | share-after | notes | fixed-this-pass |
|---|---|---|---|---|---|
| daily | 390 | yes (Play next / Share / cards) | yes — Share today's set | Breadcrumb hidden; hero tightened; stat labels wrap | viewport already had fit; compact + safe-area |
| pixle | 390 | yes — keys 44, Enter/⌫ 44 | result modal Share + Play next dock | Typed Q on on-screen keys. First-visit help covers board until dismiss | viewport-fit; keys 42→44; share/close 44; sticky kb + safe-area |
| crossword | 390 | yes — cells ≥44, Check/Reveal/Clear 44 | result Share + dock (shown on solve) | Sticky thumb bar. DOWN clues sit under it until scroll. System keyboard via 16px hidden input | viewport-fit; sticky 44px controls; fluid 5×5; breadcrumb off |
| link | 390 | yes — tiles ~58, Shuffle/Submit 44 | result modal Share + dock | Tapped tile. Help auto-opens first visit | safe-area; compact header; 44px tool icons |
| gamerdle | 390 | yes — input 44 / Guess 44 | result Copy & Share + dock | Typed Halo. 6-col grid uses minmax(0,1fr) so names wrap | compact hero; cells stay 44 at 420px; share 44 full-width |
| rift | 390 | yes — Submit 48, inputs 44 | Copy Result on complete | Typed in Chain. Header chrome reduced | viewport-fit; compact header; 16px/44px inputs |
| sudoku | 390 | yes — numpad 5×2 at 44 | win + fail Share; Play again | Tapped empty cell + placed 1. Numpad was 10-col ~31px | viewport-fit; 5-col 44px pad; compact title; fail share |
| word-scramble | 390 | yes — Submit/Shuffle 44 | result modal Share + dock | Typed A. Related games still below play | viewport-fit; 16px input; 44px CTAs; dock in modal |
| gaming-trivia | 390 | yes — answers 44, Next 44 | results Copy & Share + dock | Tapped answer; Next sticky in card | viewport-fit; compact chrome; sticky Next |
| gear-quiz | 390 | yes — Start/choices/Share 44 | end Share + Play again + dock | Start + choice. “1 of 22” leftover | viewport-fit; 44px; hide back/sub on phone |
| spec-match | 390 | yes — Start/choices 44 | end Share + Play again + dock | Start + choice | viewport-fit; 44px; hide back link |
| hardware-timeline | 390 | yes — Start/year tiles 44 | end Share + Play again + dock | Start + year tap | viewport-fit; 44px; hide back link |
| price-guesser | 390 | yes — Guess/input/Next 44 | end Copy Result + Play again | Guessed 99; Next Round on screen | viewport-fit; 16px/44px; compact header |
| daily-challenge | 390 | yes — choices 48, Copy share 44 | **yes, live after tap** + Play next | Scrolled result into view; URL in share text | compact hero; 44px copy; scroll-into-view |

Shared (`games/daily-kit.js`): `viewport-fit=cover` ensure; phone CSS (overflow-x clip, 16px inputs, 44px primary classes, breadcrumb off, safe-area); `shareResult` + `navigator.share` wrap around `CGSfx.shareNow`; dock next/mute 44px.

Hamburger `id="hamburger"` present on all 14. Amazon tag `cosmicgameshu-20` untouched. Pixle remains Wordle-for-gamers (no screenshots).
