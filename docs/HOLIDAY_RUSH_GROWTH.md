# Holiday Rush growth

Holiday Rush is a floor you run, then a store you grow, then a plaza you lease, then a second floor you can stand on. The mall map opens after the east-wall knock-through. A complaint from a tenant is a card on the next shift, the same shape as a call-out. A leased unit can be played as its own floor, and each tenant has a mechanic of their own. A plaza walk, a parade, or a blackout retunes the next flagship shift. The week has a calendar, and the map names today's rush so there is a reason to open tomorrow.

The shift tick in `games/holiday-rush.js` (`startDay`, `step`, `updateCustomers`) stays the tuned sim. New content enters through `sim.books`, the layout, and JSON. A new SKU, hire, or build does not require an edit to the tick. Headless `simulate()` does not set `sim.books`, so the pinned shift-0 balance is unchanged.

## What shipped

- A company register: sales, cost of goods, wages, rent, and a loan payment. Profit persists in `hr_books_v4`.
- Prices, wholesale cases, reputation, and three-line reviews.
- Hire, fire, and train. Training and a second-store lead are absences on the floor you are playing.
- Knock-through expansion, a third register, departments, a flagship wing, and a plaza kiosk.
- A grid editor. Traffic is a flood from the door. A walled-off register, gondola, or cafe does not sell.
- A world layer: the store you are in runs at full fidelity. Every other open store posts an aggregate tape. The plaza kiosk is a second floor you can switch to and play, with its own counter plan. A case can move between back rooms without touching the register. A lead can be sent to the store you are not standing in.
- A mall map after the knock-through: four lease units, rent you set, a counteroffer when the offer is under their ask, five commons you can open, and a complaint card on the next shift. Lease rent hits the tape only when a lease exists. Walk the plaza, send a parade, or ride a blackout, and the next flagship shift takes that tune. The week lists seven mall events. Playing a tenant floor uses that tenant's mechanic.
- A price the aisle can see. A tag on the gondola, an aisle mood on the HUD, a grumble above 1.2×, and a walkout at 1.45×. Headless `simulate()` still has no books, so the pinned shift does not feel it.
- Per-type sprite budgets and lazy loads. The camera stays close when the building grows. Quality follows a fill budget: quiet phone scenes stay sharp, a crowded or late frame steps down through glows, sprite count, and finally the half-resolution shed.
- Achievements on the office wall, and a daily rush on the shift map. Clearing it pays a bonus into the register after the tape is posted. A three-morning streak is its own mark.

## How this sits next to the games it is measured against

**Diner Dash.** The chain is still the skill: combo multiplies the ring, not the cost of goods, and it still dies on a walkout. Patience, rush, and the coach are the first three taps. Growth does not replace that chain. It gives the chain a margin. A long combo on a steep price is a loud shift and a thin tape.

**Good Pizza Great Pizza.** Ingredient cost is wholesale, and the chapter unlock is a knock-through you can see. Reviews are three lines with a number, tied to the wait, the hole in the shelf, or a price above the tag. Eight SKUs, not a topping catalog. The products on the gondola are drawn large enough to read on a phone. A cocoa tin at the ceiling is not a hidden modifier: the treats gondola says WON’T PAY, that shopper turns around, and the close names the price against the tag. That is the GPGP beat where a bad price shows up in the shop, not only in the ledger. GPGP is one shop plus a daily and a topping list. Holiday Rush keeps the one-counter feel on the floor you are standing on, and adds a second floor you can play yourself, with stock you can move by the case and a lead who runs the floor you left.

**Supermarket Simulator.** The price the shopper expects is the printed MSRP. It does not drift in the background. Raise one starter SKU to the ceiling and the weighted aisle demand falls under 0.78, so the HUD reads Thin. Raise one SKU past 1.45× and the shopper at that gondola walks. The others still queue. Empty back room stops the shelf from refilling. Expansion happens when the floor is full, and the camera does not zoom out to show the new bay. You drag there. The kiosk is a different plan: a window gondola, a wrap gondola, and a cocoa counter. Mugs sell only while that cafe fixture is on the floor you are playing, so the mart's pinned demand stays put.

**Two Point Hospital.** Reputation moves the crowd. Training pulls a person off the next shift. Firing costs severance and a hit to reviews, and the last till lead cannot be fired. The loan is one product, offered when the next build is close and unaffordable. The crowd you manage is the crowd on the floor you are standing in. Staff move across stores the way Two Point staff move across rooms: send Maren to the kiosk and she is absent from the mart. A tenant complaint is that kind of interrupt: Quick Fix says the parking row is dark, and you either open Security for $900 or let the door stay thin. Each tenant floor has its own mechanic. Window Box's demo pays families more. Quick Fix's bench is slower and richer. Second Cup's line is cheaper tickets and a thicker door. Trim & Bow's window follows the mall calendar.

**Game Dev Tycoon.** The second site waits on cash, reviews, and a trained lead. There is no investor skim and no publishing deal. The old 10% bank cut is gone from the player-facing tape. Campaign stars still unlock the next shift. Opening the kiosk is the milestone. Running a full shift on it yourself is the next one. The office lists both.

**Stardew-style days.** A clean shift at the starter store nets about $3,010 on the pinned tape (sales 7500, goods 3750, wages 520, rent 220). The knock-through costs $2,700, so one strong day buys the next room and a 75% day does not. The tool you buy changes the floor tomorrow. The shift map names today's rush — short lines, a star on the door, or a hot till — and paying it is a bonus after the tape, so the $3,010 pin stays the close. Three mornings in a row is a streak on the same meta the week already keeps. The mall week is seven named days, from tree lighting to a quiet Sunday, and that door multiplier hits the flagship only.

## Formulas

Demand, with reputation anchored at 3.4 so day one matches the current floor:

```
priceDemand = clamp(1 - (price/MSRP - 1) * 0.9, 0.42, 1.22)
priceDemand = 0 when price/MSRP >= 1.45
demand = clamp((1 + (reputation - 3.4) * 0.11) * average(priceDemand), 0.42, 1.42)
```

Prices stay between 0.7× and 1.45× MSRP. A regular basket at MSRP lands between $64 and $88 before the floor's upsell, stock, and combo. Combo multiplies revenue after the quote. Cost of goods stays the wholesale on the units taken.

```
trainMul = 1 + (skill - 2) * 0.08
```

Starters are skill 2, so training does not retune shift 0. A new hire is skill 1 and slower until the class. Skill caps at 5. The class costs `450 * current skill` and that person misses the next shift. Skill ticks up when the shift closes.

Customer cap is 14, then 18, 22, 26, 32 across knock, lane, departments, and flagship. Each register past the paid count adds 3. Deleting a register in the editor does not lower the tier. A wall does: shoppers cannot reach it, so it does not sell.

Rent per close on the mart: 220, 360, 480, 680, 920. Playing the kiosk charges the kiosk rent, 520, on that shift's close. A background flagship still pays the mart ladder. A background kiosk pays 520. The daily bonus is added after `closeShift`, so a blank mart tape stays $3,010.

Close:

```
profit = sales - cogs - wages - rent - loanPayment
reputation = reputation * 0.72 + serviceScore * 0.28
```

Wages are the crew on the board. Starters stay at $16/hr and the manager at $26/hr. Hires carry their own wage. A retry replaces the profit already posted for that shift index. It does not add a second copy. The other store's aggregate tape runs on the first close of that shift, not on the retry.

Service score is a 1–5 mix of walkouts, goal percent, stockouts, and markup. Reviews are at most three lines from that mix.

Aggregate store, while you play somewhere else:

```
eff = 0.34 with no lead
eff = clamp(0.62 + (skill - 2) * 0.08, 0.45, 0.9) with a lead
sales = round(4200 * demand * eff * stockMul * (flagship ? 1 : 0.72))
```

`stockMul` is 0.25 under 20 units, 0.7 under 80, otherwise 1. A stocked background store burns about 70 units. No lead, a green lead, or a bare back room each write a complaint onto the tape.

Loan: District bridge, $4,000 now, $560 off each of the next 8 closes. Offered only when a build is next, the register cannot pay it, and the bridge would get you close. One loan at a time. Shifts played must be at least 1.

## Builds

| Id | Cost | Needs | What changes on the floor |
| --- | --- | --- | --- |
| knock | 2700 | — | World grows 1600 → 2080 east. Lights and plush. Camera stays close. |
| lane | 5400 | knock | Register C in the new bay. Someone has to be pulled onto it. |
| departments | 9600 | lane | World 2480. Seasonal gondola and a cafe. Mugs sell only while a cafe fixture is on the active layout. |
| flagship | 16000 | departments, reviews 3.8 | World 2880. Another plush gondola. |
| kiosk | 26000 | flagship, reviews 4.0, a manager at skill 3 | A second floor, 1280×900, with a window gondola, a wrap gondola, and a cocoa counter. Shared cash and prices. Its own stock. Switch to it and you play it. A lead runs the floor you left, and that tape posts on the first close. |

Knock-through grows east only. The stage is short; the store does not grow taller.

## Shift beats

The played floor, and only the played floor, adds one fresh beat per day across the fifteen shifts: sample tray, tour bus, double ring, wrap-table flash, flickering lights, a lost kid, an aisle inspector, an open return, carolers, holding the door, rain on the curb, an expired coupon, a jammed dock, a back-room count, and a parade. The last choice on every card leaves the floor alone, so a timeout does not move the pins. If a tag is above 1.12× the sticker, a price-talk card follows and the last choice holds the tag. Headless `simulate()` never sets `floorOn`, so these cards do not move the shift-0 pins. The first office open explains pricing and stays until a price actually changes. The first mall open explains rent and the 85% grumble and stays until a lease is signed. Neither is a fourth step on the day-0 floor coach.

A crowd past the fill budget steps down a ladder. The budget is 2.4 million filled pixels a frame, a mid-phone fragment allowance after bandwidth, measured as plate pixels times device-pixel ratio squared, plus overdraw, on-screen sprites, glows, and distance blobs. It is a fill-rate proxy, not a trace from a phone GPU. Tier 3 is full resolution with glows. Tier 2 caps full sprites and glows. Tier 1 drops glows and draws distance blobs. Tier 0 is the existing shed: half-resolution backing store, 16 full sprites, edge shoppers as blobs, shelf chrome and glows skipped, the spatial hash rebuilt every third tick, and the sim stepped about twenty times a second. A step down waits for three hot frames, using a short average of frame time so one quick frame does not erase a slow stretch. A step up waits for eighteen cool frames, and only when the next tier still fits the budget and the frame average is at or under 15 ms, so a tier that is already near the ceiling does not climb back into a slow one. A 1280×800 color buffer at device-pixel ratio 2 is already over that budget, so a desk view settles lower while a quiet phone can stay at tier 3. That path is the stress crowd, not a normal cap of 14 to 32. `stress()` starts the ladder at tier 3 so the drop is visible.

## Layout

Cells are 80 world units. The starter fixtures sit on the coordinates the shift already uses, and shift 1 does not apply the layout, so the first floor does not drift.

Gondola, register, cafe, wall, and freight block their cell. The door is walkable. Traffic is a 4-neighbor flood from the door. A selling fixture is reachable when any neighbor is flooded.

The editor tools are toys, lights, seasonal, register (reg1–reg3 only), cafe, wall, and erase. Drag a tool across tiles to place a run of them. The door, the dock, and the last register cannot be erased.

When the layout is edited or the world is wider than 1600, shoppers path on the grid. Until then they use the existing aisle path.

## Camera

Characters are targeted at 118px on a phone under 520px wide, 112px on a tablet, 108px on a desk. Zoom bottoms at 1.0 on a phone and 0.88 on a desk, and tops at 1.7. A bigger world does not shrink the sprites. A 390px-wide stage shows a slice of the floor. Drag, edge chevrons, and the East bay button move you. Follow resumes about 2.6 seconds after a drag.

Map is a separate button. It draws a corner minimap of the whole plate, back wall through the door, with a rectangle for the current view. The play camera stays on the zoom floor, so characters stay at the phone target. Zoom in, zoom out, or East bay closes the map. The default zoom floor stays 1.0 on a phone.

Products draw in a 46×54 world slot, about 70px on that phone. Illustrated art, when it arrives, drops into the same rect from `products/<sku>.webp` or `objects/<sku>.png`.

## Sprites

There is no total art cap. Each character type, body frames plus portraits, stays within 110KB (`perTypeBudget` 112640). PNG and WebP with alpha both count. `manifest.json` keeps the flat `files` list and adds a `types` map. The grouper unions both, so a new file is picked up even before someone edits the map.

The boot loads only the types on today's shift. Day 0 is regular, kid, family, and the four crew bodies. The ugly-sweater shopper preloads with day 1, rusher from day 5, haggle from day 7, lift from day 12. The end-of-shift screen preloads the next day's new types. A type that is not in the pack yet draws as a silhouette. If that type’s sheet was already decoded, the stand-in is that pose filled solid. Otherwise it is a tall dashed figure with a question mark. Holding a type keeps the sheet as a ghost and blocks the loader from filling the live pack back in. The opening line is grandpa, mom, and kid so the first shift does not ask for sprites it has not loaded. Headless simulate still uses the old customer mix, because that mix is part of the pinned balance.

The v10 pack replaces the v3 bodies. Each type stays under 110 KB and keeps its own manifest. The floor is no longer a baked photo or a code-drawn room. `room.js` paints side walls, then back-wall segments from x=222, then the 222×125 corners. `wall_back_arch` stays 125 px tall. Ledge order matches the art script: the end piece’s bottom 14 px band is redrawn 6 px lower, then the full end piece, then the front ledge. Scuffs use that script’s Random(3) stream at chance 0.17, and light-versus-dark follows the floor tile. Shelves, registers, the truck, the jack, and the tree are object sprites. Tree twinkle, the scanner sweep, the gift sparkle, and lit string bulbs composite with `lighter`. The static room is one canvas blit, so the glow pass stays a handful of images while 150 shoppers are on the floor.

## Save

Key `hr_books_v4`. Version 4. `hr_campaign_v1.bank` migrates into `cash` once. Campaign stars and the five floor upgrades stay. Upgrade purchases debit the same register. The 10% skim is not added on top.

```
{
  v: 4,
  cash, reputation, prices, staff, expansions, loan,
  active, locations: { mart, kiosk? },
  reviews, milestones, posted, closed,
  shifts, lifetimeProfit, playedPrice,
  mall: null,
  tenantRuns: [],
  dailyClaimed: ''
}
```

`posted` / `closed` remember the profit already booked for a shift index so a retry replaces it. `mall: null` is reserved so the mall phase can fill that key without a migration.

`hr_run_v1` (version 3, same day) still resumes a shift in progress, including the sales already on the drawer. A mid-shift reload reads that saved sales figure back before the clock steps again. `tenantRuns` keeps the last management cuts from playing a leased floor.

## Milestones

1. First close with a profit on the tape.
2. First price moved off the tag.
3. First case bought for the back room.
4. First hire. They are slower until trained.
5. First training. They miss the next shift and the line feels it.
6. Knock-through. Drag to the east bay.
7. Reviews at 4.0.
8. Loan paid off, or never taken.
9. Plaza kiosk, with a lead who is not on your floor.
10. Both floors: a full shift played on the kiosk.
11. A case moved from one back room to the other. Cash stays put.
12. A tenant's counteroffer accepted.
13. Today's rush cleared, and the bonus is in the register.
14. Three mornings in a row.

The office lists these with the ones the tape already writes: profit, a moved price, a case bought, a hire, a finished class, and the knock-through. `hr_meta_v1` still owns the streak. The daily bonus never enters `closeShift`.

## Architecture

`games/holiday-rush/src/` attaches `HRParts` as classic scripts, before `holiday-rush.js`. Node requires the same files when the self-test runs.

| Module | Job |
| --- | --- |
| data | JSON load and id indexes |
| entities | Customer pool and a spatial hash |
| economy | Register, prices, crew, builds, close |
| layout | Flood, routes, apply, editor |
| world | Which store is full fidelity, aggregate tick, `lease()`, `negotiate()`, the week calendar, the daily claim |
| save | `hr_books_v4` |
| sprites | Per-type budget, classify, lazy session |
| sim | The adapter the tick calls. Not a second copy of `step` |
| render | Camera math and the quality ladder. The tick does not know the viewport |
| room | Modular floor: walls from x=222, corners, end-band, fixture blit |
| ui | Office, the layout grid, and the mall map |

`world.fidelity(books, id)` is `full` for the active store and `aggregate` otherwise. `world.lease()` is the accept/refuse math. `signLease`, `buyCommon`, and `nextComplaint` are what the map and the shift card call. Tenants and costs live in `data/tenants.json` and `data/mall.json`.

## Mall

Phase A, shipped earlier. One mart, then a kiosk. The active store is full fidelity. The other store posts an aggregate tape.

Phase B, this build. The mall map unlocks with the east-wall knock-through, so day one stays a floor. Storefronts are the chip sheets. You pick a tenant, set rent under their ceiling, and hand them the keys. An offer at or above 90% of their ceiling is accepted. An offer between 62% and that ask comes back as a counter at the midpoint, and Accept writes the lease at the counter rent. Under the floor, they walk. `signLease` itself is unchanged: a direct call at $1,000 for Quick Fix still accepts with a complaint. Commons are stamp buttons: decor $800, security $900, parking lights $700, food court $1,200, holiday event $600. If the common they `want` is still 0, they complain, traffic drops to 70% of their number, and they pay 85%. The next shift shows that complaint as a card. Fix it and the common opens, cash leaves the register, and this close collects full rent. Let them grumble and the door stays thin. Rent is added in `closeShift` only when `books.mall.leases` exists, so a save with `mall: null` still posts the pinned $3,010.

Phase C. A leased unit has Play their floor. That opens their 1280×900 room with their gondolas, your crew, and a smaller goal. The close adds 15% of their drawer to the register and does not replace the flagship’s posted profit. Window Box runs a demo: families pay 1.35×. Quick Fix runs a bench: patience and the ticket are both higher. Second Cup runs a cup line: cheaper tickets, more people through the door. Trim & Bow runs a window: the spawn follows the calendar door, busier when the day's event is above 1 and thinner when it is quiet. The mall week is tree lighting, a field trip, cocoa tasting, a maker market, choir, Saturday parade, and a quiet Sunday. That door multiplier applies on a flagship shift once the mall exists. A tenant shift stores the name and leaves the multiplier at 1. Headless `simulate()` never sets `tenant` or `books`, so the pins stay. The plaza section sets the next flagship shift. Walk the plaza and the door becomes 90% plus 6% for each open common. Send the parade after the holiday event is open and that shift’s crowd stays at the parade rate the whole day. Ride the blackout while parking lights or security are dark and that shift drains patience with a 0.84 door. The tune is consumed when the flagship opens, so a tenant floor leaves it untouched. Commons stay a purchase. The complaint card is unchanged.

The second floor is the kiosk. Building it clones the counter plan, stocks a starter back room, and unlocks the store switch. Move a case sends 40 units from the floor you are on to the other back room and writes the transfer milestone. Send one case still buys wholesale into the other store. Assigning a lead marks them away from the floor you play. Finishing a kiosk shift writes Both floors. The mart, if it is the one in the background, posts its own tape at the mart rent.

## What was cut

An investor who skims every shift. A catalog of 80–150 SKUs. Hundreds of decorations. A research tree. A gardening minigame. Prices that move with no tell. A taller store. A 40-person roster. The 20 staff and 150 customers in the stress test are the pool and the spatial hash, not a hiring catalog. The crew you learn by name stays the original eight plus four hires.

## Self-test

`node games/holiday-rush.js --self-test` still pins combo, stars, and the shift-0 bands. It also runs the module tests: basket mean, the $3,010 tape, a $400 lease that posts $3,410, kiosk rent at 520 while the mart stays 220, a cocoa case moved with cash unchanged, mugs locked until the active layout has a cafe, a shelf that refuses at 1.45× and grumbles above 1.2×, migration of an $1,800 bank, starter traffic, a walled-off register, the path into the east bay, aggregate profit, a background flagship on mart rent, a refused over-rent lease, a complaint when security is 0, buying security to clear that complaint, a parade that waits for the holiday event, a blackout that waits for a dark lot, a plaza visit door, Quick Fix negotiation (walk at 500, counter 1130 at 1000, accept at 1300), a stable daily goal that pays once, the stockroom door pasted at 421×126, phone sprite size, a 150-sprite desk view that steps under the fill budget, a quiet phone that stays on tier 3, a late phone frame that reaches the shed, and the per-type sprite budget. `simulate()` and a blank `closeShift` are unchanged.
