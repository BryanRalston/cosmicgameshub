# Player-suite corrections

These edits fix checks that measured the wrong thing. The pass bars are unchanged.

## Clicks land on a stud

`platePoint` aimed at a fraction of the viewport. On the 1280×800 home shot that point is the horizon, and the brick count stayed 0. `clickStud` screenshots the canvas and clicks a real stud highlight in the middle band of the plate (y 50–70% of the frame, clear of the sidebar and the bottom toolbar). Drag and the 90% scale check use the same point and still send a real press, without `element.click()`.

## Lighthouse needs the window in front

A background Chrome window reports no first paint, so the run never measured TBT. Each Lighthouse pass raises the debug Chrome window before the load. The bars stay TBT 0 and no task over 50 ms.

## A dismissed tutorial is still ready

`ready()` waited until the tutorial was on screen. After Skip or Got it, that card stays hidden and the key is not stored, so the next `ready()` on the same page waited out the timeout. If the card does not appear within 1.5 s of the plate being ready, the player already closed it.

## The tutorial is in the way

`brixCanPlace` becomes true before the tutorial card or the phone coachmark is up. `ready()` now waits until that card is visible (or the tutorial was already dismissed), then clicks Skip or Got it. A player cannot place through the card. The fresh typing checks do not use this wait. They still type on the first frame the name field can be clicked.

## The phone drawer opens before typing

The first tap on the drawer handle can land before its listener exists, so the name field stays off screen and the check died on a missing box. The phone path taps Got it if it is up, taps the handle, and types only once the tray has the open class. There is no settle delay between that open and `keyboard.type`.

## Phone triple-click is one gesture

Three separate taps appended to the name. A triple-click selects the text that is already there. The phone path now sends one touch and one triple-click, then types.

## A phone tap also sends the click the button expects

Playwright's touch tap reaches the canvas, and the game places from `touchend`. The same tap does not activate `Got it`, which listens for `click`. The coachmark stayed up and the next tap hit the card, so the brick count stayed 0. A phone synthesizes that click. `clickAt` sends the touch. On a button or a field it also sends the click at that point. On the canvas it does not: the extra click placed a second brick beside the first.

## Brick size is the brick, not the whole red UI

The red box was every red pixel on the page, including the HUD swatch and the counters, so a placed brick measured 1102 px. The check now uses the largest red component on the plate. Fill 40–75% and the 25–45 px bar are unchanged.

## Plate edge is the far rim, not horizon moiré or toolbar noise

The peak check scored rings at the sky line and failed a desktop frame where the studded plate meets flat grass on the right. A corner count then passed on stud-sized noise along the bottom toolbar. The check now looks above the toolbar for a studded run with flat grass beside it. Desktop home has that row. The phone coachmark shot does not. Fill 40–75%, brick size 25–45 px, and the moiré peak bar are unchanged.

## Colour samples were the yellow HUD

`colors.png` shows a red brick. `faceSamples` averaged every pixel matching the red predicate, and the yellow HUD digits (`rgb(255, 225, 74)`, hue 50) match `r > 90 && r > g + 25 && r > b + 25`. The reported lit hue 50.1 is those digits, not the brick. The check now skips the sidebar, the top HUD, the bottom toolbar, and the zoom strip, then uses the largest connected component that is not the whole plate. Green also matches the baseplate, so a plate-sized component is dropped and the sample falls back to pixels with saturation at least 0.78. The hue windows are unchanged.

## Custom confirms stay up after the click

The harness dismisses a native `confirm` before the click returns, so the next click reached the gallery. A custom confirm stays on screen, and one click cannot both dismiss it and hit the button underneath. The check now presses Escape after Clear, after the gallery trash confirm, and after the project trash confirm. The gallery still needs the Escape it already had. The check still fails if any native dialog fires.

## A phone control is revealed only when it is the top hit

`scrollUntil` stopped when the bounding box sat inside the 390×844 viewport. On the phone the Floor button's box does that while its center is the build HUD (`z-index` 240) and the Color swatch's box does that while its center is the drawer handle. The tap never reached the control. The phone path now keeps scrolling until `elementFromPoint` is the control. A control clipped above the tray scrolls back down. The popup, color, and delete assertions are unchanged.

## One phone tap is one click

A tap on `#panelToggle` already delivers one `click` and opens the tray. `clickAt` then sent `mouse.click` as well. That second click shuts a toggle the finger just opened (Floor, Wall, Mirror, a section). HTML now sends the mouse click only when the tap produced none, which is what Got it needed. The canvas stays touch-only, so a tap still places one brick.

## The phone tray scroll is a drag

One CDP touchMove does not scroll `.tray-scroll`, so Floor and Color stayed under the HUD and `elementFromPoint` never became the control. The phone path now drags in small steps, the way a finger moves. The project block sticks to the top of the tray, so a title sitting under that block scrolls back down until the control is the top hit. The popup and color assertions are unchanged.

## A lower-tray control scrolls up

The drag treated every hit inside the project block as "scrolled too far" and moved the sheet back to the top. Tools and Color sit below that block, so the drag never reached them. A control whose center is in the lower part of the sheet now scrolls up. A control clipped above the tray, or tucked under the header in the top 96px, still scrolls down. The top-hit requirement and the color assertion are unchanged.

## The finger moves across frames

A burst of touch moves in one turn did not change `.tray-scroll` scrollTop, so Wall stayed below the phone sheet. The drag now steps across animation frames. A control above the open band, including one sitting under the drawer handle, scrolls down. A control below the band scrolls up. The top-hit requirement is unchanged.

## The HUD and the handle are not the control

A color swatch whose box sat in the viewport was still the redo button, and Mirror stopped a few pixels below the sheet. The drag now moves up when the hit is the bottom HUD and down when the hit is the drawer handle. A short gap uses a short drag so the control is not thrown past the open band. The top-hit requirement is unchanged.

## The drag aims at the middle of the sheet

A drag that cleared the HUD landed the next control under the drawer handle, and the reverse drag put it back on the HUD. Wall's center stayed on the color HUD button at the bottom of the sheet. Each drag now moves the control halfway toward the middle of the open tray, and it stops once the sheet no longer scrolls. The top-hit requirement and the color assertion are unchanged.

## A phone tap counts only when that control receives the click

`clickAt` treated any `click` on the document as the tap's click. On Floor, the finger's `pointerup` landed on the button and a `click` landed somewhere else, so the helper skipped the mouse click. The button stayed inactive and `#buildToolPopup` never opened. The helper now waits until the element under the finger, or a parent or child of it, receives the click. If that does not happen, it sends one `mouse.click` at the same point. The canvas stays touch-only. The popup must still sit fully inside the viewport.

## The runner releases the port

After the summary, `browser.close()` could sit forever and leave port 8772 taken, so the next run never started. The runner now waits at most 4 seconds for the browser to close, drops open connections, and exits. Pass and fail bars are unchanged.

## A title tap that misses is repeated once

Under load the phone sheet is still coasting, so the title tap lands on the padding and the section stays collapsed. `openSection` reads the title's box again and taps up to three times. The popup and color assertions are unchanged.

## Opening a section does not close it

`openSection` always clicked the title. Tools was already open after Floor, so the next click collapsed it and Wall's center was no longer a button. The click now happens only when that section is collapsed. The popup and color assertions are unchanged.

## Lighthouse paints only when the debug window is in front

The audit returned NO_FCP while the headed player window still covered the debug Chrome, and again after that window was closed. Lighthouse was started with `spawnSync` inside the same process that serves the page, so the document never arrived and nothing painted. The player browser closes first, the debug window is raised once before each run, and Lighthouse runs as its own process so the server can answer. A loop that kept resizing that window during the trace stretched Speed Index, so it is not used. The bars stay TBT 0 and no task over 50 ms.

## The after-placement name is typed on an open plate

The phone "one brick" check opened the drawer and then searched the screenshot for a stud. The sheet covers the lower plate, so the brightest green pixel above it is grass and the brick count stays 0. The brick is placed with the sheet closed, then the drawer opens and the name is typed with no wait. The name must still match, and the hotkey flags are unchanged.

## A phone tap's click is counted before a second click

Chrome turns a touch into a click on a later task. The fallback mouse click was sent in the same turn, before that click existed, so Floor received two clicks and the panel closed. The tap now waits for the click event, or 120 ms if none arrives, and only then sends the mouse click. The panel still has to sit fully inside the viewport.

## Floor, Wall, and Mirror are measured once the panel is steady

`panels-fit` called `inside()` on the same turn as the click. A panel that was still opening, or a phone tap whose click arrived a frame later, failed once and passed the next run. The check now waits until two frames in a row report the same fully inside box, at most 900 ms, and then uses that same `inside()` rule. A panel that stays closed, or that is clipped, still fails. The pass bar is unchanged.

## Round 18 player cases

Twelve checks, ids `R18a` through `R18l`, reproduce the desktop and phone notes. They use real clicks, taps, and key events. They do not call `focus()` or write `input.value`. The older pass bars are unchanged. `R18c` keeps the thumbs fill and margin bars (40–75% fill, 2% margin, at least 150 red pixels). A spread's solidity is the gap ratio, so it does not measure specks. The new check also requires the largest red brick's long side to be at least 12% of the thumb's short side. A spread's brick-to-span ratio cannot reach 16% without crossing the 75% fill cap or cropping an edge, and 9.9% on the old build still fails 12%. The older `thumbs` check and its solidity bar are unchanged. `R18a` clicks the name field on the next action after the place click, with no wait for the brick to appear. `R18e` adds a closer home size and a close-inspection zoom, and its stud-moire bar is stricter than `D-stud-moire`. `R18b` maps the bitmap through the canvas `getBoundingClientRect` and `devicePixelRatio`, and allows 4 px. `D-click-90` still allows 12 px.

The 2×2 ghost is centered on the cell. A stud rim is more than 4 px from that center, so the first hover only has to show a ghost. The cursor then moves onto that ghost's center, and ghost, place, and delete still have to land within 4 px of the cursor. A mapping bias still fails. The bitmap point is divided by the screenshot's pixels per CSS pixel and by `visualViewport.scale`. `devicePixelRatio` stays 1 at page scale 1.1, the bitmap stays about 1280 wide, and the plate is drawn scaled inside it. Scale 0.9 reports `visualViewport.scale` of 1, so that path is unchanged. The 4 px bar is unchanged. The game's pointer math does not divide by that scale. The six-brick and fifteen-brick points are a tighter cluster. A view-wide spread cannot put one brick at 12% of the short side while the group's fill stays inside 40–75% and the margin stays at least 2%. The 12% bar is unchanged. On 3934543 the wide cluster measured 9.9% and still fails that bar. The older `thumbs` check is unchanged. `R18i` sky bar aligned to 15-30% per Grok Interface ruling. `R18i` measures the saturated blob nearest the screen center. The toolbar and the toast were inside the old span, so a 44 px cottage was reported as 409 px. The 48 px bar is unchanged. `P-chrome` confirms the empty-plate warning before it checks the saved name and the Save button. An empty save now asks first, and the button-position bar is unchanged.

## Round 19 player cases

Twelve checks, ids `R19a` through `R19l`, reproduce the desktop and phone notes on top of the Round 18 bars. They use real clicks, taps, and key events. They do not call `focus()` or write `input.value`. No older pass bar was loosened. `R19f` uses the same thumb bars as `R18c` (40–75% fill, 2% margin, at least 150 red pixels, largest red side at least 12% of the short side) on a 3-brick spread and a 6-brick spread. `R19b` is twenty trials: blur, then the name field is clicked and `fifteen` is typed with delay 0 while the button is still coming up. A floor toggle or a dropped character fails. `R19g` looks for a ground-color shelf on the desktop top and right and in the phone band y 280–320. It does not change `hardEdge`, `horizonSeam`, or the edge-scan thresholds. `R19i` keeps `R18i`'s sky bar where it is and adds its own 15–30% sky bar, a visible brick counter, the starter bar, and a 2×2 of at least 25 px.

## Round 20 player cases

Ten checks, ids `R20a` through `R20j`, reproduce the desktop and phone notes on top of the Round 18 and Round 19 bars. They use real clicks, taps, and key events. They do not call `focus()` or write `input.value`. No older pass bar was loosened. `R20a` types every builder hotkey letter as the first character of a focused empty field and again over a selected field. `R20b` presses `m` while the Replace confirm is open and does not click the dialog first. `R20c` saves 1, 3, 6, 8, and 15 bricks and requires one overhead frame: thumb sky 8–32%, sky spread at most 10 points, and the same 12% brick and 40–75% fill bars as `R18c`. `R20d` is a 1440×900 window, first brick 25–45 px, all four plate corners inside the canvas, moiré peaks under 3. `R20e` requires the brick counter at 13 px with contrast at least 4.5, and at least 30 lit cylinder studs. `R20f` opens the phone drawer and requires the plate to cover at least 45% of the shot, with zoom minus still the top hit. `R20g` keeps the 15–30% sky bar and the y 280–320 shelf bar and requires the 2×2 at 30 px with the starter bar on screen. `R20h` requires the week badge and the float control to hit the gallery, ignores `n`/`m`/`f` after Save blurs the name, and requires an exit button on the mirror, floor, move, and delete banners. `R20i` arms Delete, clicks that same stud again, and requires the count to fall before a banner whose label says Exit. `R20d` and `R20e` report every miss in one line. `R20j` holds a finger on a stud and requires the ghost to project at least 24 by 14 px.

## Round 21 player cases

Ten checks, ids `R21a` through `R21j`, reproduce the desktop and phone notes on top of the Round 18, 19, and 20 bars. They use real clicks, taps, and key events. They do not call `focus()` or write `input.value`. No older pass bar was loosened. `R21a` is a 1440×900 window. It counts horizontal plate stripes in the lower half of the shot, the band `moirePeaks` does not scan, and it requires stud peaks in the left, middle, and right of that band. The peak cap stays under 3, the same cap as `R20d`. `R21b` places one brick at that home zoom and requires a face-luma spread of at least 22 and at least two stud highlights. `R21c` saves a 3-spread, a 6-spread, and a 15-spread. The saved bitmap must be at least 400×300. Fill stays 40–75%, margin stays 2%, and the largest brick stays at least 12% of the short side. Thumb sky stays 8–32% with a spread of at most 10 points, the same frame as `R20c`. `R21d` saves cabin, confirms New, then clicks Load twice and does not click the row. The second click has to bring the bricks and the name back, on the desktop sidebar and in the phone drawer. `R21e` drags 36 px on the empty phone canvas and requires the camera to move more than 0.02 rad and less than 0.18 rad. A Recenter or Frame build button has to sit on the play screen, outside the drawer. `R21f` opens the 16vh drawer. The blank tail under the last tool must be under 80 px. One wheel notch must move no more than one scrollport. Hide tools has to stay fully on screen and be the top hit at the start and after the wheel reaches the end. The last tool's center has to enter the scrollport. `R21g` places one brick on the phone at the default quality and uses the same stud and face bars as `R21b`. It does not change the quality chip. `R21h` opens the real Gallery and the real New confirm. The week badge, More games, View, and zoom plus must not be the top hit, including the right-edge points the notes name. The gallery trash must sit fully inside the viewport with every corner as the top hit, and the gallery scroller must not be wider than its frame. `R21i` taps View and requires the stats, FPS, and quality panels to miss the week badge. `R21j` arms Delete with the toolbar button, then presses Escape with no modal open. Delete mode and the banner turn off and the brick count stays put.
