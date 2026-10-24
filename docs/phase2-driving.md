# Phase 2: playable physics slice (#3)

Base: `242ea98` on `codex/rally-v04-physics`. Working branch: `codex/rally-v04-phase2`; PR target is the Phase 1 branch, never main. No release/deployment or Cloudflare/leaderboard changes.

## Play and inspect

`npm ci`, `npm test`, `npm run build`, `npm run preview`. The isolated build is in `dist/v04/` and uses base `/GOPsRally/v04/`. Open its index, tap GO, wait two seconds, steer with LEFT/RIGHT and slow with BRAKE. Holding brake for 0.7 seconds **at rest** selects reverse until release (reverse power fades by 8 m/s). Arrow keys/A/D/Space also work. RESET immediately returns the car to its most recent nearby road anchor, clears momentum and invalidates the current lap without restarting its clock/countdown. Fixed and Chase remain available. Course settings change the visible start marker/direction and require a fresh GO.

The original root v0.3.1 game/assets are byte-identical to the base. Phase 1 inspection remains at `inspect.html`; its original tests still run there. The root preview now starts the driving slice. Cache generation includes both pages with correct offline navigation. No CDN or online service is needed to drive after initial cache installation.

## What is implemented

- Rapier 0.21 dynamic chassis, 1,200 kg, explicit center of mass and box-derived inertia; a massless cabin collider matches the roof for tumbling. Four native raycast wheels independently apply springs, compression/rebound damping, limited suspension forces, drive/brake and lateral friction impulses. Surface type changes friction. Load transfer, pitch/roll, flight and impacts arise from forces and collisions. No code pins the body to terrain or imposes a flight arc. Only explicit spawn/reset writes the pose.
- Meter/second units, local -Z forward/+X right, 60 Hz fixed physics, CCD on the chassis and interpolated render poses. Steering is immediate but angle reduces with speed. Engine force fades with speed; aerodynamic drag and rolling resistance dissipate energy. The tire model is Rapier's arcade friction model, not a validated real tire model or drivetrain simulation.
- Actual controller suspension length, wheel rotation and steering drive wheel visuals. The mesh/collision terrain is still authoritative. Physics test ramps are synthetic test fixtures, not production jump animations.
- An **original 1,721.84 m closed hill/chicane test sector**, 39 m road elevation range, 65,025 vertices / 129,032 triangles, broad connected landscape, crest/climb/descent, reversing bends and run-out. The road cuts/blends into the same low-frequency landscape from which its elevation was authored. It no longer lifts a narrow ribbon onto unrelated flat terrain. Coarse 3 m tessellation and material transitions remain visible.
- A 40 m spatial index accelerates nearby road projection with an exact fallback outside its 70 m candidate range. Physics/rendering do not scan every track segment each frame: contact classification samples the emitted triangle in constant time; recovery checks only 17 neighboring nodes. This bounded mesh is not a streaming architecture for a 5 km world.
- Local lap tracking uses segment/plane start-line crossings, direction, seven ordered checkpoints, corridor/height bounds and teleport/reset invalidation. Configuration carries track ID, direction, class and physics version. Times use active simulation time and pause when hidden; this is not a secure competitive timing/submission system. Checkpoints do not prove every meter of a lap followed the road.
- `window.rallyDrive.snapshot()` exposes read-only car/contact/lap telemetry and generation/startup, frame/physics timing and draw-call measurements. Browser tests attach this telemetry and screenshots. There is no production autopilot or debug pose setter.

## Additional source material

Locally inspected the newly supplied `fast_lane.ai`, `map.ini`, `sections.ini`, `overlays.ini`, and annotated map. AI version 7 has 3,294 records; last recorded distance 5,161.382 m and elevation range 38.7078 m. Section metadata names the start/finish and chicane ranges, and overlay metadata supplies source checkpoints. The new annotated picture now confirms the requested start on the left-hand long straight, driving toward turn 1. This resolves the earlier *visual* arrow uncertainty; it does not make our different original circuit an exact reconstruction or establish a one-to-one coordinate mapping.

The production sector borrows the approximate relief and gameplay requirements, **not the source centerline, checkpoints, art, branding or exact plan**. Raw attachments, screenshots and extracted AI positions are not committed. The repository's unitless STL contour reference was inspected; its z=0/5 extrusion is not used as elevation. Full ~5 km circuit reconstruction/authoring remains unfinished under the issue's explicitly permitted sector-first fallback.

## Tests and honest evidence

Final local commands: `npm test`, `npm run build`, `npm run test:browser`. See commit/PR handoff for final counts. Foundation and legacy tests are retained; only the original browser inspector's URL changes because it is now a separate entry page. New automated scenarios cover:

- Physical mass/CoM, independent compression, settled spring loads, acceleration load transfer, steering sign, surface-dependent lateral impulse, sustained 180 km/h engine speed, speed-dependent stopping distance and deliberate reverse.
- Unsupported gravity/freefall with no tire steering, suspension landing/rebound, 50 m/s ramp launch and landing, and asymmetric off-road ramp overturning. These initialize physical test conditions then apply the same vehicle controller; there is no scripted airborne path.
- Road/landscape congruence, spatial lookup equivalence, render/collider agreement and bounded geometry size.
- Ordered full lap, invalid skips/reverse/reset, start/direction settings, plus a complete sector lap driven by a **test-only** steering/brake controller. It never writes car pose/velocity after spawn. This proves a simulation can traverse the loop, not that a phone user finds the handling comfortable.
- Real Chromium/SwiftShader at 320/393 px and 800×393 landscape: GO/countdown, acceleration, pointer steering/release/cancellation, cameras, immediate reset, settings and offline restart. Screenshots inspected visually. No Android GPU performance claim.

Development failures were not hidden: reverse initially unlatched as speed exceeded the near-stop threshold; fixed by latching the deliberate reverse state until brake release. A render quaternion interpolation used a plain Rapier object where Three.js expected a Quaternion, causing an empty view despite live physics; fixed by typed conversion and a finite-camera browser assertion. An early successful-lap fixture accidentally crossed its previous gate again; its movement path was corrected, with the lap safety assertions retained.

## Limitations and review gate

- **Not the requested full ~5 km course.** This delivers the permitted playable sector fallback. No claim of a human-completed 180 km/h lap: the sustained-speed test uses a separate long flat physics fixture, while the sector lap test slows for corners.
- No physical Android run, sustained frame-time/thermal/memory data or measured Android startup. JS/WASM shared bundle is still roughly 4.89 MB uncompressed / 1.81 MB gzip; build warns about size. Native desktop software-rendering test speed is not phone performance.
- Grounding is raycast suspension: narrow features smaller than wheel spacing, mesh resolution, contact surface transitions and high-speed crest tuning need further playtesting. The finite terrain can be driven off; manual RESET is available. There are no procedural obstacles, dust/skid effects or polished scenery yet.
- Inspect marker and direction on the original prototype; source map confirmation does not finalize a future larger circuit's start. Old root PWA cache cleanup behavior is untouched and must be reviewed before any co-deployment.

Android checklist before approval: portrait/landscape multitouch steering+brake, cancellation on app switch, readable turn approach in both cameras, low-speed reverse, braking from speed, compression/crest/off-road landing, overturned recovery, complete checkpoint lap, offline cold start after installation, upgrade coexistence with the root PWA, and sustained frametime/heat/memory measurements. Review this one Draft before expanding the circuit. Do not merge or publish automatically.

Final local validation: **21 Node tests PASS / 0 FAIL / 0 SKIP**, both original baseline smoke scripts PASS, production build PASS with the documented bundle warning, **5 Chromium tests PASS / 0 FAIL / 0 SKIP**. GitHub-hosted CI and physical Android are NOT RUN. GitHub API access currently returns `Forbidden`; native Git is available. A saved environment-network draft proposes allowing `api.github.com`; it is not an applied configuration or permission grant. PR creation remains blocked until that access is available.
