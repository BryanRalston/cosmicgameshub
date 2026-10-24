# BRIX 3D code audit (read-only), 2026-10-24
URL: https://www.cosmicgameshub.com/games/brix3d

## Measured (Lighthouse 12, mobile emulation, headless Chrome + SwiftShader)
- FCP 3.1 s, LCP 5.5 s, TTI 5.5 s, TBT 170 ms, JS bootup 0.4 s, total 615 KiB transferred.
- HTML: 616 KB raw / 126 KB brotli, single inline file (~16,130 lines), `cache-control: max-age=0, must-revalidate`.
- three.module.js r160 from unpkg: 1.27 MB raw / 257 KB gzip (no brotli), max-age=1y, third-party CDN (an extra DNS/TLS round trip and a single point of failure).
- ~12 addon modules from unpkg (OrbitControls, EffectComposer, Bloom, SMAA 35 KB, SSAO, SimplexNoise) as a request waterfall through the importmap. No preload.
- gtag 181 KB (bigger than the game code). Thumbnail jpg 166 KB, max-age=0.
- No models or textures fetched; bricks are procedural geometry.

## Renderer (line numbers refer to served HTML)
- L3893 importmap three@0.160.0. L5187 WebGLRenderer antialias:true, powerPreference high-performance.
- L4953 presets: balanced (default) DPR 1.5 desktop / 1.25 mobile, shadow 2048/1024, bloom+SMAA post ON; high adds SSAO. MSAA plus SMAA plus bloom is redundant and costly on mobile.
- L5190-5191 PCFSoftShadowMap, one shadow-casting sun with a 96x96 frustum. L5852 groundStuds InstancedMesh of 96x96 = 9,216 studs that cast shadows.
- L15648 animate: rAF every frame, but rendering is gated by `needsRender` (on-demand), which is good. Forced each frame in first-person, weather (30 Hz), ghost pulse <280 ms after pointer move, and light updates.
- L8502 shouldUseInstancing: instancing by default. Bricks with texture, pitch/roll, or facePanels fall back to one Mesh per brick (L8562 createBrick + scene.add), so draw calls grow with those. The HUD shows draws.
- Lamp bricks register lights (L8566). Many point lights can force shader recompiles and per-pixel cost: a risk.
- Raycasting: pick meshes are cached per brick (L8540 cachePickMeshes), but collectBrickMeshes() rebuilds the array on each call. mousemove/touchmove handlers (L12065, L12581, L9213) raycast against all bricks plus the InstancedMeshes, which are tested per instance with no BVH. That is O(N) per move and is the main lag risk in large builds.
- Save: localStorage (brickBuilderGallery L14248, custom prefabs L10791, L11923). Share is a copyable build code text, a .brick file, or a PNG (L2997-3004). No URL share link. localStorage has a ~5 MB quota.
- Audio: WebAudio AudioContext (L3929), synthesized.
- Touch: touchstart/touchmove handlers (L4981, L5174, L12581). isMobileGfx DPR cap.

## Risks, ranked
1. Raycasting on every pointer move against every brick and instance with no BVH or throttle. Fix: three-mesh-bvh, or a grid-DDA pick using the existing voxel grid; cache the mesh list.
2. Default post stack (bloom + SMAA + MSAA, DPR 1.5) on phones. Fix: default to performance on mobile, add an adaptive-DPR FPS governor, drop MSAA when SMAA is on.
3. 9,216 shadow-casting studs plus PCFSoft 2048. Fix: bake the baseplate studs into a normal map or turn castShadow off; use PCF.
4. Non-instanced fallback bricks and lamp lights. Fix: merge static ones and cap the number of lights.
5. Load: self-host and bundle three (tree-shake to about 150 KB br), lazy-load the post/SSAO/SimplexNoise addons, defer gtag, give the HTML a long cache via a hashed JS split.
6. No URL share link, which limits virality.

## Leader success factors (from domain knowledge; no web search was run)
- Minecraft Classic: instant start with no install, two-button place/break, block palette on a hotkey, a first-person sense of scale, shared links to worlds.
- Townscaper: no goals or failure, every click makes something beautiful (auto-tiling), cozy palette and sound, one-click screenshots and share, very low friction.
- LEGO Builder's Journey: tactile snapping, studio lighting and depth of field, a guided puzzle progression that teaches mechanics, satisfying click audio.
- Goxel and MagicaVoxel: precise tools (box, fill, mirror), good default lighting, easy export.
- Common threads: under 3 s to first block, juicy place feedback (sound, squash, particles), auto-beauty lighting, sharing by URL or image, light goals or challenges for retention.
