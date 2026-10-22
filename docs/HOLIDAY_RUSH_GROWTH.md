# Holiday Rush growth

Holiday Rush is a floor you run, then a store you grow, then a second store that keeps running while you are on the first. The mall is the endgame and is designed here. It is not a screen in this build. A rent spreadsheet would fail the bar the floor already clears.

The shift tick in `games/holiday-rush.js` (`startDay`, `step`, `updateCustomers`) stays the tuned sim. New content enters through `sim.books`, the layout, and JSON. A new SKU, hire, or build does not require an edit to the tick. Headless `simulate()` does not set `sim.books`, so the pinned shift-0 balance is unchanged.

## What shipped

- A company register: sales, cost of goods, wages, rent, and a loan payment. Profit persists in `hr_books_v4`.
- Prices, wholesale cases, reputation, and three-line reviews.
- Hire, fire, and train. Training and a second-store lead are absences on the floor you are playing.
- Knock-through expansion, a third register, departments, a flagship wing, and a plaza kiosk.
- A grid editor. Traffic is a flood from the door. A walled-off register, gondola, or cafe does not sell.
- A world layer: the store you are in runs at full fidelity. Every other open store posts an aggregate tape.
- Per-type sprite budgets and lazy loads. The camera stays close when the building grows.

## How this sits next to the games it is measured against

**Diner Dash.** The chain is still the skill: combo multiplies the ring, not the cost of goods, and it still dies on a walkout. Patience, rush, and the coach are the first three taps. Growth does not replace that chain. It gives the chain a margin. A long combo on a steep price is a loud shift and a thin tape.

**Good Pizza Great Pizza.** Ingredient cost is wholesale, and the chapter unlock is a knock-through you can see. Reviews are three lines with a number, tied to the wait, the hole in the shelf, or a price above the tag. Eight SKUs, not a topping catalog. The products on the gondola are drawn large enough to read on a phone.

**Supermarket Simulator.** The price the shopper expects is the printed MSRP. It does not drift in the background. Raise it and the aisle thins. Raise it past 1.45× and they refuse. Empty back room stops the shelf from refilling. Expansion happens when the floor is full, and the camera does not zoom out to show the new bay. You drag there.

**Two Point Hospital.** Reputation moves the crowd. Training pulls a person off the next shift. Firing costs severance and a hit to reviews, and the last till lead cannot be fired. The loan is one product, offered when the next build is close and unaffordable. The crowd you manage is the crowd on the floor you are standing in.

**Game Dev Tycoon.** The second site waits on cash, reviews, and a trained lead. There is no investor skim and no publishing deal. The old 10% bank cut is gone from the player-facing tape. Campaign stars still unlock the next shift.

**Stardew-style days.** A clean shift at the starter store nets about $3,010 on the pinned tape (sales 7500, goods 3750, wages 520, rent 220). The knock-through costs $2,700, so one strong day buys the next room and a 75% day does not. The tool you buy changes the floor tomorrow.

## Formulas

Demand, with reputation anchored at 3.4 so day one matches the current floor:

```
priceDemand = clamp(1 - (price/MSRP - 1) * 0.9, 0.42, 1.22)
priceDemand = 0 when price/MSRP >= 1.45
demand = clamp((1 + (reputation - 3.4) * 0.11) * average(priceDemand), 0.78, 1.42)
```

Prices stay between 0.7× and 1.45× MSRP. A regular basket at MSRP lands between $64 and $88 before the floor's upsell, stock, and combo. Combo multiplies revenue after the quote. Cost of goods stays the wholesale on the units taken.

```
trainMul = 1 + (skill - 2) * 0.08
```

Starters are skill 2, so training does not retune shift 0. A new hire is skill 1 and slower until the class. Skill caps at 5. The class costs `450 * current skill` and that person misses the next shift. Skill ticks up when the shift closes.

Customer cap is 14, then 18, 22, 26, 32 across knock, lane, departments, and flagship. Each register past the paid count adds 3. Deleting a register in the editor does not lower the tier. A wall does: shoppers cannot reach it, so it does not sell.

Rent per close: 220, 360, 480, 680, 920. The kiosk's own rent is 520 and comes out of its aggregate tape.

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
| kiosk | 26000 | flagship, reviews 4.0, a manager at skill 3 | A second location, 1280×900. Shared cash and prices. Its own stock. A lead leaves your floor to run it. |

Knock-through grows east only. The stage is short; the store does not grow taller.

## Layout

Cells are 80 world units. The starter fixtures sit on the coordinates the shift already uses, and shift 1 does not apply the layout, so the first floor does not drift.

Gondola, register, cafe, wall, and freight block their cell. The door is walkable. Traffic is a 4-neighbor flood from the door. A selling fixture is reachable when any neighbor is flooded.

The editor tools are toys, lights, seasonal, register (reg1–reg3 only), cafe, wall, and erase. The door, the dock, and the last register cannot be erased.

When the layout is edited or the world is wider than 1600, shoppers path on the grid. Until then they use the existing aisle path.

## Camera

Characters are targeted at 118px on a phone under 520px wide, 112px on a tablet, 108px on a desk. Zoom bottoms at 1.0 on a phone and 0.88 on a desk, and tops at 1.7. A bigger world does not shrink the sprites. A 390px-wide stage shows a slice of the floor. Drag, edge chevrons, and the East bay button move you. Follow resumes about 2.6 seconds after a drag.

Products draw in a 46×54 world slot, about 70px on that phone. Illustrated art, when it arrives, drops into the same rect from `products/<sku>.webp` or `objects/<sku>.png`.

## Sprites

There is no total art cap. Each character type, body frames plus portraits, stays within 110KB (`perTypeBudget` 112640). PNG and WebP with alpha both count. `manifest.json` keeps the flat `files` list and adds a `types` map. The grouper unions both, so a new file is picked up even before someone edits the map.

The boot loads only the types on today's shift. Day 0 is regular, kid, family, and the four crew bodies. The ugly-sweater shopper preloads with day 1, rusher from day 5, haggle from day 7, lift from day 12. The end-of-shift screen preloads the next day's new types. A type that is not in the pack yet draws as a silhouette. The opening line is grandpa, mom, and kid so the first shift does not ask for sprites it has not loaded. Headless simulate still uses the old customer mix, because that mix is part of the pinned balance.

The v10 pack replaces the v3 bodies. Each type stays under 110 KB and keeps its own manifest. The floor is no longer a baked photo or a code-drawn room. `room.js` paints side walls, then back-wall segments from x=222, then the 222×125 corners. `wall_back_arch` stays 125 px tall. Each side-wall end piece redraws its bottom 14 px band 6 px lower onto the front ledge. About one in six floor cells swaps to a same-parity scuff tile. Shelves, registers, the truck, the jack, and the tree are object sprites. Tree twinkle, the scanner sweep, the gift sparkle, and lit string bulbs composite with `lighter`. The static room is one canvas blit, so the glow pass stays a handful of images while 150 shoppers are on the floor.

## Save

Key `hr_books_v4`. Version 4. `hr_campaign_v1.bank` migrates into `cash` once. Campaign stars and the five floor upgrades stay. Upgrade purchases debit the same register. The 10% skim is not added on top.

```
{
  v: 4,
  cash, reputation, prices, staff, expansions, loan,
  active, locations: { mart, kiosk? },
  reviews, milestones, posted, closed,
  shifts, lifetimeProfit, playedPrice,
  mall: null
}
```

`posted` / `closed` remember the profit already booked for a shift index so a retry replaces it. `mall: null` is reserved so the mall phase can fill that key without a migration.

`hr_run_v1` (version 3, same day) still resumes a shift in progress.

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

## Architecture

`games/holiday-rush/src/` attaches `HRParts` as classic scripts, before `holiday-rush.js`. Node requires the same files when the self-test runs.

| Module | Job |
| --- | --- |
| data | JSON load and id indexes |
| entities | Customer pool and a spatial hash |
| economy | Register, prices, crew, builds, close |
| layout | Flood, routes, apply, editor |
| world | Which store is full fidelity, aggregate tick, `lease()` |
| save | `hr_books_v4` |
| sprites | Per-type budget, classify, lazy session |
| sim | The adapter the tick calls. Not a second copy of `step` |
| render | Camera math. The tick does not know the viewport |
| room | Modular floor: walls from x=222, corners, end-band, fixture blit |
| ui | Office and the layout grid |

`world.fidelity(books, id)` is `full` for the active store and `aggregate` otherwise. `world.lease(state, slot, tenant, rent, commons)` is tested and unused by the UI. Tenants and the mall map live in `data/tenants.json` and `data/mall.json`.

## Mall roadmap

Phase A, this build. You own one mart and, later, one kiosk. The world layer and the aggregate tick are the proof. Tenant rows and `lease()` exist so Phase B does not invent a second model.

Phase B, the mall map. Storefront slots from `mall.json`. The flagship slot is the store you already run. The other slots take a tenant from `tenants.json`. You set rent. Rent above `maxRent` is refused. If the common area that tenant `wants` is below 1, they complain and their traffic drops to 70%, and they pay 85% of the rent. A complaint is a card on the shift, the same shape as the truck and the call-out, and the choice drops you into that unit for the rest of the shift. That is the bar. A list of rents is not a phase.

Phase C, the commons and the holiday. Decor, security, parking, food court, and events are levels you spend on. A mall-wide event changes the shift you drop into: a parade slows the door, a blackout hits the tills, a visit from the plaza fills every register. Other units keep posting aggregate tapes while you are inside one of them.

`mall: null` in the save is the slot those phases fill.

## What was cut

An investor who skims every shift. A catalog of 80–150 SKUs. Hundreds of decorations. A research tree. A gardening minigame. Prices that move with no tell. A mall screen in this pull request. A taller store. A 40-person roster. The 20 staff and 150 customers in the stress test are the pool and the spatial hash, not a hiring catalog. The crew you learn by name stays the original eight plus four hires.

## Self-test

`node games/holiday-rush.js --self-test` still pins combo, stars, and the shift-0 bands. It also runs the module tests: basket mean, the $3,010 tape, migration of an $1,800 bank, starter traffic, a walled-off register, the path into the east bay, aggregate profit, a refused over-rent lease, a complaint when security is 0, phone sprite size, and the per-type sprite budget.
