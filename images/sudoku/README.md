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
| promo-1.webp | 1280x720, 55 KB |  |
| promo-2.webp | 1280x720, 85 KB |  |

## How to use each file
- **nebula-desktop.webp / nebula-phone.webp:** page background. Use `background:#070a1f url(...) center/cover`. Pick by `@media (orientation:portrait)`. The middle is dark so the board stays readable.
- **board.webp:** board surface, square. The gold outer border sits at about x 35–989 and y 34–987 of 1024 (about 3.4% inset). Inset the 9x9 grid by that much, or crop it. Thin inner lines mark the cells, and brighter gold lines mark the 3x3 boxes. Contrast checked at 360px with white and gold digits.
- **constellation-overlay.webp:** on black. Use `mix-blend-mode:screen`. **constellation-overlay-alpha.webp** is a luma-keyed RGBA version for normal blending. Use it for the solve-trail reveal, for example animating a clip-path or mask left to right. Show it static when the user prefers reduced motion.
- **promo-1.webp / promo-2.webp:** homepage and promo backdrops. promo-1 leaves text space on the left, promo-2 at the top. These are backdrops only; the hero and card images stay real gameplay screenshots.
- **contact-sheet.png:** overview of all assets.
