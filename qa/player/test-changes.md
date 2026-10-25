# Player-suite corrections

These edits fix checks that measured the wrong thing. The pass bars are unchanged.

## Clicks land on a stud

`platePoint` aimed at a fraction of the viewport. On the 1280×800 home shot that point is the horizon, and the brick count stayed 0. `clickStud` screenshots the canvas and clicks a real stud highlight in the middle band of the plate (y 50–70% of the frame, clear of the sidebar and the bottom toolbar). Drag and the 90% scale check use the same point and still send a real press, without `element.click()`.

## The tutorial is in the way

`brixCanPlace` becomes true before the tutorial card or the phone coachmark is up. `ready()` now waits until that card is visible (or the tutorial was already dismissed), then clicks Skip or Got it. A player cannot place through the card. The fresh typing checks do not use this wait. They still type on the first frame the name field can be clicked.

## The phone drawer opens before typing

The first tap on the drawer handle can land before its listener exists, so the name field stays off screen and the check died on a missing box. The phone path taps Got it if it is up, taps the handle, and types only once the tray has the open class. There is no settle delay between that open and `keyboard.type`.

## A phone tap also sends the click the button expects

Playwright's touch tap reaches the canvas, and the game places from `touchend`. The same tap does not activate `Got it`, which listens for `click`. The coachmark stayed up and the next tap hit the card, so the brick count stayed 0. A phone synthesizes that click. `clickAt` sends the touch. On a button or a field it also sends the click at that point. On the canvas it does not: the extra click placed a second brick beside the first.

## Brick size is the brick, not the whole red UI

The red box was every red pixel on the page, including the HUD swatch and the counters, so a placed brick measured 1102 px. The check now uses the largest red component on the plate. Fill 40–75% and the 25–45 px bar are unchanged.

## Plate edge is the far rim, not horizon moiré or toolbar noise

The peak check scored rings at the sky line and failed a desktop frame where the studded plate meets flat grass on the right. A corner count then passed on stud-sized noise along the bottom toolbar. The check now looks above the toolbar for a studded run with flat grass beside it. Desktop home has that row. The phone coachmark shot does not. Fill 40–75%, brick size 25–45 px, and the moiré peak bar are unchanged.
