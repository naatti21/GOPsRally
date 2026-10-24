# GOPs Rally v0.4 — 3D terrain and vehicle-physics rebuild

Status: **implementation brief; not implemented**.
Owner: GOPs Rally. Working language: English in code and in-game UI.
Previous playable baseline: `main` v0.3.1.
Target branch: `codex/rally-v04-physics`.
Do not deploy or merge new engine to `main` until a real Android device has been tested.

## Context: why rebuild?

The current `game.js` integrates x/z velocity and heading with handcrafted damping. `renderer3d.js` draws a separate WebGL terrain strip and derives wheel pose using approximations. The player reports floating/pasted-on road, car sinking, weak sense of mass, and little speed sensation around 180 km/h. Tweaking visual pitch and roll cannot solve airborne/gravity/contact behavior. Preserve the mobile control/UI principles, not the old physics architecture.

## Technology decision

- Render with **Three.js**, simulate with **@dimforge/rapier3d-compat** (or documented up-to-date equivalent) using its 3D raycast vehicle controller and a dynamic chassis body.
- Vite for build; GitHub Pages base must be `/GOPsRally/`. Use a GitHub Actions build/deploy workflow only when release deployment is approved. `npm run build` must produce a self-contained `dist/` without live CDNs. Pin package versions and commit lockfile.
- Render and physics share **the same generated 3D world data** and spatial scale (meters). Avoid independently computed heights and colliders.
- Use a fixed physics time step (initially 1/60 s; substeps or higher rates as needed for high-speed contacts), a capped accumulator and interpolated rendering. No frame-time-dependent steering force.
- Keep two camera choices: north-fixed and chase. Preserve the existing input convention **left turns left; right turns right** in both views.

## Road and terrain: no more pasted-on strip

1. Generate a heightfield terrain and a spline-based track centerline with width, longitudinal grade and signed bank/camber values.
2. Sculpt terrain into road cross-section with an explicit transition zone into shoulders and verges. The road is a material region of an integrated continuous mesh or is guaranteed flush with terrain and shares vertices; it must not float, z-fight, or penetrate the terrain.
3. Build collision geometry from the *same* mesh/height data as the visible road and surroundings. The four wheel rays must hit that collision world, not an independent elevation function.
4. Handle sharp hairpins and tightly spaced road segments. Avoid crossing offset edges, upside-down triangles, discontinuous normals, mesh spikes, and self-intersections. If using ribbon geometry, detect and fix overlapping polygons robustly.
5. Support true hills, crests, banked corners, gutters, rough gravel, and modest off-road banks. Use visible/physical normals for grip and load.
6. Make road width comfortably playable at mobile zoom; surfaces: compact gravel, loose gravel, grass, shoulder.

## Vehicle dynamics: actual physical behavior

1. One **dynamic rigid-body chassis** with physical mass, inertia and center of gravity. Start from a tunable 1200 kg reference car; no need for homologated real car measurements.
2. Four raycast wheels with independently computed travel/compression, suspension spring stiffness, damping, grip and visual rotation. Use actual controller wheel transforms/contact states for meshes.
3. No airborne steering force or road grip if wheels lose contact. Gravity and angular momentum operate while airborne; collisions handle landing and off-road impacts.
4. Auto-throttle + two responsive steering touch buttons + brake button. Hold brake only after coming to near-stop to reverse. Manual RESET instantly recovers, preserves lap time, no artificial reset countdown.
5. Fast steering *input* response, but physical steering/yaw/lateral traction obey speed, suspension loads and available tire grip. Avoid continuous mandatory drift.
6. Center-of-mass load transfer must show visibly in corners, under braking, and on acceleration; crest unloads wheels, dip compresses them, landing settles rather than passing through ground.
7. At 180 km/h (`50 m/s`) the world and speedometer must agree. Off-road at that speed can produce actual jumps/tumbling if terrain and momentum justify it; never scripted automatic flight or exaggerated bounce without contact physics.
8. Keep vehicle tuning data outside scene code (mass, CoG, wheelbase, track width, tire grip, steering curve, max torque, suspension travel, dampers), ready for later stylized rally car variations.

## Speed sensation and camera

- Preserve Fixed (default) and Chase (no Hybrid).
- Reduce the feeling of a static aerial map: readable car scale, roadside markers/vegetation parallax, wheel/suspension motion, dust particles and contact-driven feedback. Subtle speed-dependent zoom/lead, not nausea-inducing rotation.
- On the fastest straight, aim for approximately 2–3 seconds useful lookahead while keeping the car visible on a narrow phone screen; tuning based on driving tests, not hardcoded as fact.
- Test running at a real ~50 m/s, particularly high-speed crest, curve and off-road exit.

## First vertical slice (no multiplayer, no car selection)

Build one short test track with a **straight, banked fast corner, crest, landing area, uneven gravel section and safe off-road escape**. Have one car and current minimal mobile HUD. No need to copy the old route exactly; prioritize correct surface and physics, with an option to compare to current `main` baseline.

### Done criteria — measure, do not merely claim

- Render mesh and collider use a common terrain/road source. At several road/camber samples, physics hit heights/normals match visual surface to defined tolerances; include tests.
- Sharp bend/hairpin has no cracks, spikes, reversed triangles or visible floating road.
- Wheel contact count and suspension travel change over crest, in depression and on landing. Free airborne body follows gravity and lands rather than intersecting the mesh.
- Left/right maps correctly in both cameras. Fixed default, Chase optional.
- Start/finish aligned on a straight. Existing 2-second start countdown and lap timing preserved.
- No reset regression; reverse works only via brake after slow down.
- Unit/component tests for geometry, signs, suspension, time stepping and lap logic; `npm test` and `npm run build` both pass.
- Browser smoke test (prefer Playwright mobile viewport) reports no JS errors; manual Android GPU test is still required and must be noted honestly.
- Respect mobile performance: target 60 fps on a recent Android handset with a reasonable 30 fps low-quality fallback; report observed device/browser, memory/bundle size and settings if measured. No guessed benchmark claims.

## Work sequence for Codex

**PR 1 — Foundation / terrain:** Vite+Three.js scaffold on feature branch, heightfield/corridor builder, shared collision/visual mesh, rendering and road-integrity tests. One static chassis acceptable in PR 1.

**PR 2 — Dynamics:** Rapier vehicle controller, fixed timestep, wheels/suspension/load transfer, ramps/flight/landing, steering/brake/reverse/reset, physics tests.

**PR 3 — Game feel / QA:** camera, speed cues, dust, mobile HUD, profiling, quality settings, offline PWA and GitHub Pages deployment readiness. Keep baseline `main` playable until approved.

Prefer small, reviewable commits/PRs. Do not merge directly to main, do not add Supabase yet. If current Rapier vehicle controller API or browser requirements differ from this brief, check official docs and explain the change before implementation.

## User acceptance

Driving with two thumbs on a phone must feel immediate yet weighty. A fast crest lifts the car naturally; landing compresses suspension. A slide or off-road launch is an earned consequence of speed and terrain, not an animated trick. Road and embankment appear like one coherent physical landscape, not a ribbon laid over green tiles.
