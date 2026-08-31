# BRIX 3D renderer constraints

Do not reintroduce the stalls this pass removed. Play loop beats pretty.

## Tone mapping
- `ACESFilmicToneMapping` on the WebGLRenderer. Do not swap without a visual pass.
- Exposure is set by time-of-day, not a second color-grade stack.
- One vignette/grade shader on the composer. Do not stack extra color grades.

## Lights
- Scene lighting is **one directional sun + hemisphere + ambient** (or IBL via the single PMREM env map).
- Lamp/light bricks are **emissive**. Real `PointLight`s come from a pool of **max 4 nearest**.
- Never one `PointLight` per lamp brick. Never `castShadow` on brick lights.

## Shadows
- PCF soft is fine. **1024 on mobile / Performance, 2048 on desktop High/Balanced.**
- Do **not** reintroduce 4096² maps.
- Tight frustum around the build AABB, not ±100 of empty world.
- Keep `bias` / `normalBias` to kill acne and peter-panning.

## DPR
- Mobile cap **1.25**. Desktop cap **1.5**. Performance preset is **1**.
- Never `min(devicePixelRatio, 2)` on phones.

## Frame loop
- Demand render: camera/orbit damping, pointer, brick edits, weather.
- `updateTimeOfDay()` only when the time slider/preset changes.
- Weather does not force 60fps. If weather is on, cap ~30fps or skip post.
- Ghost pulse does not dirty the composer when the pointer is idle.
- `preserveDrawingBuffer` stays **off**. Screenshots render then read the canvas in the same turn.

## Geometry
- **Placed bricks go through InstancedMesh.** `createBrick()` Groups are for ghost/preview, photo textures, pitch/roll, and face panels only.
- Studs are merged into the instance geometry. Do not spawn 8-segment cylinder meshes per stud per placed brick.
- Raycast instanced meshes + cached group pick lists. Do not `traverse` every brick on every pointer move.

## Materials
- Shared materials by color (and transparent / lamp flag). Paint by swapping instance keys, not mutating a shared material in place.
- MeshPhysical ABS: roughness ~0.32, clearcoat ~0.38, one env map.
- Generate PMREM **once**. Do not rebuild it every frame or on time-of-day ticks.

## Quality presets
Persist `localStorage.brixQuality`. Default **Balanced**.

| Preset | DPR cap | Shadows | Bloom | SSAO | SMAA |
|---|---|---|---|---|---|
| High | 1.5 / 1.25 mobile | 2048 / 1024 | on | desktop only | on |
| Balanced | 1.5 / 1.25 | 2048 / 1024 | on | off | on |
| Performance | 1 | 1024 | off | off | off |

Performance also skips the composer (forward render).

## Do not
- Rewrite camera/orbit/snap/ghost feel, brick catalog, `.brick` save format, undo, walk mode, or UI chrome (quality + FPS HUD only).
- Migrate the file to WebGPU unless a tiny feature-detect fallback is free.
- Add CSM, extra lights, 4096 shadows, or per-brick Mesh groups for the persistent scene.
