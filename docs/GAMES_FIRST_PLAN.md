# Games-first plan for CosmicGamesHub

Audit date: 2026-10-22. Canonical host: `https://www.cosmicgameshub.com` (no trailing slash; Vercel `cleanUrls: true`, `trailingSlash: false`). Analytics: GA4 gtag `G-D272MF8NQP`.

Bryan’s direction: free browser games are the brand, the homepage, the nav, the hero, and the site title. Originals come first (Holiday Rush, RIFT, Gamerdle, BRIX 3D, Rootweave, Pixle). Guides and pro setups stay live only as a lower homepage section and as the second nav item. Leaving guide page content untouched protects search traffic. It does not give guides equal weight anywhere else. Noonsworn (`https://bryanralston.github.io/noonsworn/`) is a later iframe. It is not listed in this phase.

The audit below is the site before this change. Everything after “Target information architecture” is what this pull request ships.

## Current-state audit

The site is static HTML. `global.js` is the live nav: on `DOMContentLoaded` it replaces `.nav__links` with Play, Gear, Pros, Daily, Compare, and Search. The HTML under that list is only a no-JS fallback and differs by page (older pages still say Headsets, Mice, Chairs, Keyboards, Monitors).

### Homepage (`/`)

- Title and H1 are “Play. Compete. Discover your setup.” Three equal hero buttons: Play Games, Find Gaming Gear, See What Pros Use.
- Play is a six-card row (Holiday Rush, RIFT, Gamerdle, Pixle, Crossword, Aim Trainer) under a larger gear stack: category cards, Amazon “buying today” row, pro strip, popular guide cards, six versus cards, an editor headset pick, tools, trust copy, newsletter, and an AI-gaming banner.
- No JSON-LD on the homepage. Canonical is `https://www.cosmicgameshub.com/`. GA4 snippet is present.
- Footer leads with Guides, then Compare, then Play Free.
- Homepage Amazon links that must stay intact if the page is rewritten: `B07W4QH2NT` (Logitech G203) and `B0F3QDLZKG` (Razer BlackShark V3 Pro), both `tag=cosmicgameshu-20`.

### Navigation and footer

- Rendered nav order is Play → Gear → Pros → Daily → Compare.
- A category subnav under the homepage repeats Play, Gear, Pros, Daily, Find My Gear, How we choose.
- Footers are not one component. The homepage footer is the full four-column footer. Many guide and versus pages use a shorter footer. `global.js` does not rewrite footers.

### `/games`

- Hub already exists: 25 games, filters, sort, device stats, ItemList JSON-LD, canonical `https://www.cosmicgameshub.com/games`.
- The hero leads with the daily desk (RIFT, Gamerdle, Pixle, Crossword, Link). Holiday Rush, BRIX 3D, and Rootweave sit lower in Arcade / 3D.
- Sitemap priority for `/games` is 0.7, below `/guides` (0.9) and `/pros` (0.95).

### Original games

| Game | URL | Notes |
| --- | --- | --- |
| Holiday Rush | `/games/holiday-rush` | Original store sim. `games/holiday-rush.js` is in active development elsewhere. Do not edit it. |
| RIFT | `/games/rift` | Daily three-zone word game. |
| Gamerdle | `/games/gamerdle` | Daily mystery-game guess. |
| BRIX 3D | `/games/brix3d` | Fullscreen brick builder. Does not load `styles.css` or `global.js`. Does not include the GA4 snippet. `.brix-back` is hidden on desktop. |
| Rootweave | `/games/rootweave` | Already embeds `https://bryanralston.github.io/rootweave/`. Leave that embed alone. |
| Pixle | `/games/pixle` | Daily five-letter gaming word. |

Other playable pages (dailies, arcade, skill) stay at their current URLs. They are the rest of the catalog, not the homepage lead.

Canvas games with `overflow: hidden` and no site stylesheet: Asteroid Dodge, Void Keeper, Dream Machine, Beat Lab, plus BRIX 3D. A strip injected only into document flow would be invisible on those pages.

### Guides, pros, comparisons

- 33 guide HTML files under `guides/`. All 33 are in `sitemap.xml`. None are missing, and the sitemap has no guide URL without a file.
- Guide canonicals use `https://www.cosmicgameshub.com/guides/<slug>` with no trailing slash.
- Guide pages carry GA4 `G-D272MF8NQP` and Amazon affiliate links with `tag=cosmicgameshu-20`.
- Component pages are the existing category guides (headsets, mice, keyboards, chairs, monitors), not a separate `/components` route.
- Pro setups live at `/pros` and `/pros/<id>`. Comparisons live at `/versus` and `/versus/<slug>`.
- `vercel.json` has cache headers only. There is no redirect map.

### Sitemap and structured data

- `sitemap.xml` lists the homepage, `/pros`, `/build`, `/guides`, `/versus`, every guide, versus pages, tools, pro index pages, `/games`, `/games/daily`, each game, and `/ai-gaming`.
- Game pages that already have VideoGame JSON-LD (Holiday Rush, RIFT, Gamerdle, Rootweave, Pixle, and others) keep it.
- The homepage has no WebSite or ItemList schema.

## Target information architecture

Primary (the site):

1. `/` — free-games portal. Tagline “Free browser games, no downloads”. Game of the Week hero. Category chips. Thumbnail grid above the fold. No gear above the fold.
2. `/games` — hub. Originals first, then the existing daily desk and the rest of the 25-game catalog.
3. `/games/holiday-rush`, `/games/rift`, `/games/gamerdle`, `/games/brix3d`, `/games/rootweave`, `/games/pixle`.
4. `/games/daily` and every other existing `/games/<slug>` page. Same URLs.

Secondary (still linked, not the brand):

1. `/guides` — the second nav item, and a section below the fold on `/`.
2. Component guides, title gear pages, `/pros`, `/versus`, and tools stay at their current URLs. They are linked from that lower section and from their own pages. They are not nav peers of Games.

Nav:

1. Games → `/games` (the primary pill).
2. Guides → `/guides` (the quieter second item).
3. Search (existing overlay).

Pro Setups, Daily, and Compare are not nav peers. Daily stays one click from the homepage chips and from `/games`. Pro setups and comparisons stay in the lower homepage section and the footer.

Not in nav, homepage, hub, or sitemap until a later phase: Noonsworn.

Future URL, not created yet: `/games/noonsworn`, copied from `games/embed-template.html` when the embed is ready to list.

## Page-by-page changes

### Phase 1 (this change)

| Page | Change |
| --- | --- |
| `/` | Title, description, and Open Graph say “Free browser games, no downloads”. Game of the Week hero (badge, blurb, Play now) from `data/featured.json`, starting as Holiday Rush. Category chips (All, Arcade, Puzzle, Daily, Strategy). Thumbnail grid with New, Popular, and Game of the Week badges, above the fold on desktop and mobile. CSS hover scale only. Gear and the two Amazon buttons (`B07W4QH2NT`, `B0F3QDLZKG`, `tag=cosmicgameshu-20`) stay below the fold. JSON-LD: `WebSite` plus an `ItemList` of the six originals. No GSAP. Canonical and GA4 stay. |
| `/games` | Hero and a new Originals block lead with the same six games. Daily desk and the 25-card catalog stay, so every current game URL remains linked. ItemList order puts the six originals first and still lists all 25. Title and description lead with originals. |
| Every `/games/<slug>` page that loads `global.js` | A “More games” strip linking the six originals and `/games`. In-flow under the game on scrolling pages. On `overflow: hidden` canvas pages, a fixed “More games” control that expands, so it does not cover the playfield until opened. |
| `/games/brix3d` | Same strip, written into the page outside `#controls` (that panel’s `backdrop-filter` would trap a fixed dock). Collapsed fixed dock so it does not cover play controls. Page does not load `global.js` (slash-search would steal keys). GA4 snippet plus `game_card_click` and `game_start` live in the page. No `game_complete` (nothing observable marks a finished build). No gameplay script edits. If `data/featured.json` names `brix3d`, the page adds the Game of the Week tag itself. |
| Every `/guides/<slug>` article | `global.js` injects a text-only “Take a break: play our free games” card before the first `h2` that sits below the fold, and a second card at the end of `main`, after `window` load. Holiday Rush, RIFT, and Gamerdle. No images. Guide HTML, titles, metas, and above-the-fold buying blocks are not edited. The `/guides` index is not an article, so it does not get the card. |
| `games/embed-template.html` | Reusable iframe shell for an external game. `noindex`, disallowed in `robots.txt`, not linked, not in the sitemap, iframe `src` left blank. Copy it when Noonsworn (or a later game) is ready to publish. |
| `data/featured.json` | One-line Game of the Week config. See “Rotate Game of the Week” below. `vercel.json` caches it for 300 seconds. |
| `global.js` | Nav is Games, then Guides, then Search. More-games injection, with dock CSS for canvas pages that do not load `styles.css`. Featured-game paint. Play-break injection. GA4 events below. |
| `styles.css` | Portal, Game of the Week, tiles, chips, play-break, nav weight. No guide-page layout edits. |
| `sitemap.xml` | Same URL set. Bump `lastmod` and priority for `/`, `/games`, and the six originals so the games hub is no longer below the guide index. Do not add the embed template. Do not remove or rewrite any `<loc>`. |
| `robots.txt` | `Disallow: /games/embed-template` only. |

### Explicitly not changed in phase 1

- Any guide, versus, pro, tool, or `/build` URL, canonical, title, or body.
- Amazon `tag=cosmicgameshu-20` links inside guides.
- `games/holiday-rush.js` and Holiday Rush gameplay markup beyond the shared nav (nav text is replaced at runtime by `global.js`).
- Rootweave’s existing iframe URL.
- Noonsworn: no link, no iframe `src`, no sitemap row.

### Later phases (not this PR)

| Phase | Work |
| --- | --- |
| 2. Measure, then a small follow-up | Read `game_card_click`, `game_start`, and `game_complete` after this ships. The question is which of the four traffic guides (PS5 headsets, monitors, Valorant mouse, keyboard switches) actually send a player into a game. Phase 2 is that reading plus a short change based on it, not a new information architecture. |
| Later. Noonsworn | Copy `games/embed-template.html` to `games/noonsworn.html`. Set the iframe to `https://bryanralston.github.io/noonsworn/`, write title, description, canonical, and VideoGame JSON-LD, remove `noindex`, add the URL to the homepage grid, `/games` originals, more-games strip, and sitemap. Confirm the sandbox and `allow` list against the real game (pointer lock, fullscreen, audio). |

## Rotate Game of the Week

`data/featured.json` is the only file to edit. It is one JSON object, one line:

```json
{"slug":"holiday-rush","weekStart":"2026-10-19","blurb":"Schedule the floor and survive three holiday rushes."}
```

- `slug` is the path segment in `/games/<slug>`.
- `weekStart` is `YYYY-MM-DD`. The hero shows it as “Week of Oct 19”.
- `blurb` is the short line under the title.

Example, rotating to RIFT the next week:

```json
{"slug":"rift","weekStart":"2026-10-26","blurb":"Three daily word zones — chain, grow, and decode."}
```

`global.js` fetches `/data/featured.json` and updates the hero (badge stays “Game of the Week”, title, blurb, Play now href, and image), the matching homepage tile, the matching card on `/games`, and a “Game of the Week” tag above that game’s `h1`. The homepage HTML defaults to Holiday Rush so the first paint matches the current file and does not jump when the JSON is unchanged. Cache-Control on the file is `public, max-age=300`.

Slugs with a built-in hero image: `holiday-rush`, `rift`, `gamerdle`, `brix3d`, `rootweave`, `pixle`, `asteroid-dodge`, `aim-trainer`, `crossword`, `link`, `sudoku`, `minesweeper`. Any other slug still links to `/games/<slug>` and shows the blurb; the hero media is a plain panel until an image is added to the map in `global.js`.

BRIX 3D does not load `global.js`. Its page reads the same JSON and shows the tag only when `slug` is `brix3d`.

## GA4 events

Measurement id stays `G-D272MF8NQP`. Events go through `gtag('event', name, params)`. `games/holiday-rush.js` is not edited. That file already sends `holiday_rush_open`, `holiday_rush_day_start`, `holiday_rush_complete`, and `holiday_rush_resume`. The events below are separate and are fired from `global.js` (and a short script on BRIX 3D).

| Event | When | Params |
| --- | --- | --- |
| `game_card_click` | Click on a same-host link to `/games/<slug>`, excluding `/games`, `/games/daily`, and `/games/embed-template`. | `game` (slug), `source_page` (current path), `placement` (`feature`, `tile`, `play_break`, `more_games`, `nav`, or `link`) |
| `game_start` | First pointer or key inside a game page. Ignores the nav, footer, more-games strip, play-break, site search, and `/` / Escape / modifier keys. | `game`, `source_page` (same-host referrer path, or `direct`) |
| `game_complete` | Observed from outside the game script. | `game`, `source_page` (same as start) |

`game_complete` watches:

- Holiday Rush: `#hr-final` loses `hidden` (week complete).
- RIFT: `#resultScreen` gains `show`.
- Gamerdle: `#resultPanel` gains `show`.
- Pixle: `#result-modal` gains `open` (the help modal does not count).
- BRIX 3D and Rootweave: no observable complete, so this event is not sent.

Phase 2 joins `source_page` on `game_card_click` with `source_page` on `game_start` / `game_complete` to see which guide sent the player.

## SEO-safety plan

Guides stay indexed. The games-first layout changes internal emphasis. It does not change guide addresses.

1. **No URL changes.** Every guide file keeps its slug. Do not rename, fold, or move `guides/*.html`.
2. **No redirects.** Do not add `redirects` in `vercel.json` for `/guides`, `/guides/*`, `/pros`, or `/versus`. A redirect, even a 301 to a “new” gear hub, is a URL change.
3. **Canonicals stay on www.** Existing tags remain `https://www.cosmicgameshub.com/...` with no trailing slash. The new homepage canonical stays `https://www.cosmicgameshub.com/`. Do not point guide canonicals at `/` or `/games`.
4. **Affiliate links stay.** Do not edit guide HTML in this phase, so every `tag=cosmicgameshu-20` href stays byte-for-byte. Homepage Amazon buttons that remain must use the same two ASINs and the same tag.
5. **Sitemap is an update, not a replacement.** Every current `<loc>` stays, including all 33 guide URLs. Update `lastmod` / priority only for the homepage, `/games`, and the six originals. Do not submit the embed template. Do not noindex any guide.
6. **Internal links still reach guides from `/`.** The homepage section below the fold and the footer still link `/guides`, the component guides, title gear pages, `/pros`, and `/versus`. `global.js` points the second nav item, Guides, at `/guides`. Guide bodies are not rewritten to get there. The play-break card is injected after load, below the fold, and contains no images, so titles, metas, above-the-fold buying blocks, affiliate links, and guide-to-pros links stay byte-identical.
7. **Structured data is additive.** Homepage gains `WebSite` and an `ItemList` of games. Do not remove VideoGame or Article JSON-LD from game or guide pages. Do not mark guides as `noindex`.
8. **Analytics id stays `G-D272MF8NQP`.** Do not swap the measurement id on pages this phase touches.
9. **New URLs are opt-in.** `games/embed-template.html` is `noindex` and disallowed. A copied game page is the only way a new game URL enters the sitemap.

What this plan accepts: the homepage will send fewer links into the long versus grid than it does today. Those versus URLs remain in the sitemap, in `/versus`, and in their own internal links. Guide URLs remain linked from `/`, `/guides`, and the nav.

## Success metrics

Check these after phase 1 is deployed. Do not treat a short-term impression dip on the homepage’s old gear modules as a guide-index failure.

| Signal | Pass |
| --- | --- |
| Guide URLs | All 33 `sitemap.xml` guide URLs return 200. No new redirect. Canonical host stays `www.cosmicgameshub.com`. |
| Affiliate integrity | A diff of `guides/` is empty for this phase. Homepage Amazon hrefs still contain `tag=cosmicgameshu-20`. |
| Games-first home | Within two seconds a first-time visitor can say “free games site”: tagline, Game of the Week with Play now, and a thumbnail row, with no gear or shopping in that first screen. Nav is Games, then Guides. |
| Game of the Week | `data/featured.json` is Holiday Rush. The hero, the Holiday Rush tile, and `/games/holiday-rush` show the Game of the Week tag. Rotating is the one-line edit in “Rotate Game of the Week”. |
| Hub | `/games` shows the six originals before the daily desk. All 25 catalog links still resolve. The featured game’s hub card carries the Game of the Week tag. |
| Play-break | Each guide article shows the text card mid-article (below the fold) and at the end. The four traffic guides keep their hero buying blocks. |
| More games | Each original game page exposes a More games strip (or the docked control on fullscreen canvas pages, including BRIX outside `#controls`) linking the other originals and `/games`. |
| Quality | Playwright, desktop and mobile: homepage, `/games`, nav, every original game link, and a sample of guides load with no console errors from first-party scripts. |
| Speed | Homepage does not load GSAP. Hero image is the featured still, with width and height set. Tiles past the first row use `loading="lazy"`. Play-break has no images. |
| Search | Within 28 days, Search Console shows the same guide URL set indexed (no spike of “Not found (404)” or “Page with redirect” on `/guides/*`). Homepage ItemList is valid in Rich Results test. |
| Behavior | GA4 events in the table above. Phase 2 reads which of the four traffic guides produce `game_card_click` then `game_start`. Guide landing-page sessions do not depend on the homepage hero. |

## Phase 1 boundaries

Ship the table in “Phase 1” above in one pull request against `master`. Do not merge it in the same change. Do not list Noonsworn. Do not edit `games/holiday-rush.js`.
