# Cosmic Sudoku theme assets (Grok Imagine stills, Nov 3 2026)
Made with Grok Imagine (9 stills: 8 first pass + 1 board redo). Compressed to WebP at quality 82. Originals are in src/, and QC downscales are in qc/.
Native generation size is 1280x720 / 720x1280 / 1024x1024. I didn't upscale anything to 1920, so on large screens use background-size: cover.

| File | Size | Use |
|---|---|---|
| board.webp | 1024x1024, 30 KB |  |
| constellation-overlay-alpha.webp | 1280x720, 45 KB |  |
| constellation-overlay.webp | 1280x720, 12 KB |  |
| nebula-desktop.webp | 1280x720, 69 KB |  |
| nebula-phone.webp | 720x1280, 61 KB |  |
| planet-1-alpha.webp | 128x128, 7 KB |  |
| planet-1.webp | 128x128, 5 KB |  |
| planet-2-alpha.webp | 128x128, 3 KB |  |
| planet-2.webp | 128x128, 2 KB |  |
| planet-3-alpha.webp | 128x128, 3 KB |  |
| planet-3.webp | 128x128, 2 KB |  |
| planet-4-alpha.webp | 128x128, 8 KB |  |
| planet-4.webp | 128x128, 4 KB |  |
| planet-5-alpha.webp | 128x128, 5 KB |  |
| planet-5.webp | 128x128, 4 KB |  |
| planet-6-alpha.webp | 128x128, 5 KB |  |
| planet-6.webp | 128x128, 4 KB |  |
| planet-7-alpha.webp | 128x128, 6 KB |  |
| planet-7.webp | 128x128, 4 KB |  |
| planet-8-alpha.webp | 128x128, 4 KB |  |
| planet-8.webp | 128x128, 3 KB |  |
| planet-9-alpha.webp | 128x128, 3 KB |  |
| planet-9.webp | 128x128, 2 KB |  |
| promo-1.webp | 1280x720, 55 KB |  |
| promo-2.webp | 1280x720, 85 KB |  |
| supernova-1-alpha.webp | 400x400, 22 KB |  |
| supernova-1.webp | 400x400, 5 KB |  |
| supernova-2-alpha.webp | 400x400, 74 KB |  |
| supernova-2.webp | 400x400, 17 KB |  |
| supernova-3-alpha.webp | 400x400, 54 KB |  |
| supernova-3.webp | 400x400, 14 KB |  |

## How to use each file
- **nebula-desktop.webp / nebula-phone.webp:** page background. Use `background:#070a1f url(...) center/cover`. Pick by `@media (orientation:portrait)`. The middle is dark so the board stays readable.
- **board.webp:** board surface, square. The gold outer border sits at about x 35–989 and y 34–987 of 1024 (about 3.4% inset). Inset the 9x9 grid by that much, or crop it. Thin inner lines mark the cells, and brighter gold lines mark the 3x3 boxes. Contrast checked at 360px with white and gold digits.
- **constellation-overlay.webp:** on black. Use `mix-blend-mode:screen`. **constellation-overlay-alpha.webp** is a luma-keyed RGBA version for normal blending. Use it for the solve-trail reveal, for example animating a clip-path or mask left to right. Show it static when the user prefers reduced motion.
- **planet-1..9.webp:** digits 1–9 on black: 1 lava, 2 orange bands, 3 gold ringed, 4 green clouds, 5 ice, 6 ocean swirl, 7 purple craters, 8 pink storm, 9 silver moon with rings. **planet-N-alpha.webp** versions have a transparent background, so draw them at cell size. All nine are distinct at 32px (see qc/planets-32px-x3.png).
- **supernova-1..3.webp:** a three-frame burst (ignite, peak, ring shockwave) on black. Use `mix-blend-mode:screen`, or the -alpha versions. Play about 80ms, 120ms, 200ms with a scale and fade. Skip it or use a simple fade under reduced motion.
- **promo-1.webp / promo-2.webp:** homepage and promo backdrops. promo-1 leaves text space on the left, promo-2 at the top. These are backdrops only; the hero and card images stay real gameplay screenshots.
- **contact-sheet.png:** overview of all assets.
