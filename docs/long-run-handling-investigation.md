# Long-run handling investigation — v0.4.7 laboratory

Research branch based on v0.4.6. **No released vehicle tuning or renderer is changed.**
The laboratory runs archived factories, not reconstructed approximations of old versions.
This document separates reproducible simulated behavior from unverified Android usability.

## Reproduce

Node 24.19.0; `npm ci` verifies the committed lock. Rapier 0.21.0, Three 0.186.1,
Playwright 1.64.1 and Vite 8.3.5 are pinned. The archive loader checks each historical
lock's versions/integrities against the installed lock and required installed packages.
All four Git objects must exist locally (`git fetch --all` in a shallow checkout is
not enough; fetch full history). No network is used while simulating.

```sh
npm ci
npm run lab:long
node scripts/long-run/reanalyze.mjs
node scripts/long-run/sweep.mjs
npm run lab:camera
CAMERA_VERSIONS=v046 CAMERA_HEADING_TAU=0.2 npm run lab:camera
MPLCONFIGDIR=/tmp/gops-mpl python3 scripts/long-run/plot.py
node scripts/long-run/report.mjs
npm test
npm run lab:line
npm run lab:corner
npm run lab:drift
npm run build
npm run test:browser
```

`lab:long -- --quick` is a four-case smoke run, **not** the full comparison.
Use `LONG_RUN_OUTPUT` to select a fresh output directory and `LONG_RUN_VERSIONS=v046`
for a subset. Camera replay defaults to the v0.4.6 real-track 100 km/h trace;
`CAMERA_TRACE` selects another recorded trace, and `CAMERA_VERSIONS` selects renderers.
Plotting requires matplotlib 3.10.8; it is a research tool, not a game dependency.
The opt-in workflow archives full traces and screenshots; it never deploys.

The output directory is `lab-results/`, deliberately separate from Playwright's
self-cleaning `test-results/`. Raw evidence is ignored by Git. Committed summaries
include SHA-256 hashes of each compressed and decompressed recording. `reanalyze`
verifies both hashes and the expected number of physics steps before recomputing metrics.

## Locked comparison

| Version | Exact commit |
| --- | --- |
| v0.4.4 | `ca746502855fddbac7a99101ff400437d672c78a` |
| v0.4.5 | `9cc39de4c6616a82a69081fc83c0a0d656a4265f` |
| v0.4.5b | `bac49764e38f3fd220b3af67a08035af5463836d` |
| v0.4.6 | `bd5b3222c6d18014048dbc65d09c2566fa6446ed` |

The original world source agrees across the four archived versions. The real course
uses the existing 1.72 km mesh, not a flat proxy, with its banking, 39 m elevation
range, bumps and material classification. The shared collision data is hashed.
The mesh is passed directly to Rapier; nearest-road queries do not create forces.

## Experimental controls

- Fixed 1/60 s step. Exactly one initial spawn, two-second unpowered settling period,
  and specified entry velocity. No yaw/slip seeding. Afterwards any direct body pose,
  velocity or kinematic-target assignment throws. No reset, teleport, recovery impulse,
  road-centering force or per-corner reseeding is permitted.
- Entry speeds 70 / 100 / 126 km/h; speeds thereafter evolve physically under auto throttle.
- Open-loop pulses 0.35 / 0.65 / 1.8 s, release-only controls, delays
  0.10 / 0.20 / 0.30 / 0.45 s crossed with holds 0.20 / 0.30 / 0.40 s.
  These six-second trials characterize correction windows, **not** stage stability.
- 150-second open-loop alternating turns and 15-second sustained steering followed
  by 135 seconds of release. The nominal open-loop road is a straight corridor:
  its boundary distance means lateral departure, not a failed racing-line lap.
- A stadium course with 80 m constant-radius corners compares flat uniform grip,
  reduced uniform grip, a grip transition, 7% banking and original-amplitude ripples.
  Same route and mesh topology; one condition changes at a time.
- Real course: original mesh/materials; same mesh with uniform grip; same x/z route
  and materials with heights flattened. Flattening removes elevation/bank/bumps
  together; it does not by itself isolate each of those three causes.
- Closed-loop trials last 150 s with uninterrupted momentum. Additional pre-corner
  braking trials last 180 s. Full laps count only via the existing eight directed
  checkpoint gates, not nearest-route progress or elapsed time. This is checkpoint-valid
  completion, not a clean-lap claim: wheel-boundary violations are reported separately
  and do not retroactively change the existing game gate rules.
- Digital driver: only LEFT / RIGHT / BRAKE. Position/heading observations are delayed;
  decisions are held for 200 ms. Delay variants include 100, 200, 300 and 450 ms.
  Route lookahead and curvature-based braking are identical for all versions. The
  driver has perfect map knowledge but delayed vehicle observations. It is not a
  validated model of human skill or perception. Its own feedback can oscillate.
- The ordinary driver can brake during corners when above its speed plan. The separate
  `pre-corner` variant prohibits that when local curvature exceeds 0.004/m; off-road
  slowing remains allowed and explicitly recorded. Neither requires brake-release tricks.

## Telemetry and event definitions

Each JSONL gzip starts with metadata and then **every 60 Hz step**, without subsampling.
Units: positions/travel meters; speed m/s; yaw and body angles degrees; rack and wheel
slip radians; forces N; acceleration m/s². Boolean buttons and decision reasons are
recorded. Rack is right-positive; Rapier's actual signed front-wheel steer is also
retained per wheel. Quaternion, heading, real horizontal velocity direction, signed
forward speed, true unfolded planar sideslip, four wheel positions/loads/travel/forces,
slip, surface classification and traction-budget utilization are retained.

Forces/contact state come from the pre-integration vehicle update, pose from the
following world step. That known one-step sampling relationship matters for phase
analysis. New custom-force saturation uses its circular Fx/Fy budget; the old native
model uses its weighted ellipse (0.5 Fx, Fy) and raw spring-force budget. Those ratios
are not interchangeable measurements of physical friction coefficients. Tire state
slip is the model's measured/relaxed state, not an independent optical sensor.

Wheel-center margin uses exact nearest segment distance (BVH, cross-checked against
an exhaustive oracle), not chassis position. It excludes tire width and is explicitly
not a full tire-footprint clearance. Out-of-mesh steps are counted rather than reset.
Low-speed planar slip below 0.5 m/s is recorded as zero; event metrics require >5 m/s.

- Spinout: |true sideslip| >60° for 15 consecutive steps (0.25 s).
- Significant off-road event: minimum wheel-center margin <-2 m for 30 steps.
- Recovery: after such an event, >5 m/s, |slip|<10°, |yaw|<15°/s and all wheel centers
  inside the road for one second. It is a measured outcome, never an intervention.
- Oscillation: alternating physical yaw signs with |yaw|>10°/s and 6°<|slip|<60°,
  seven-step dwell; two alternations per cycle. A continuous spin crossing ±180°
  must not count as alternating yaw. The test suite explicitly guards that mistake.
- Overcorrection proxy: such a yaw alternation within one second of an opposite
  non-neutral button command. This is an operational correlation, not proof of intent.
- Reported cycles include intentional chicanes: use input phase and raw plots to
  distinguish them from unwanted oscillation. Release alternations are separate.

A short correction is not labelled successful merely because it reaches a moderate
peak. The numerical report includes final one-second mean absolute slip/yaw, lateral
path deviation, moderate-slip duration, speed and spinouts, paired with release-only
controls. No passing benchmark threshold has been weakened to hide unstable cases.

## Camera experiment

Actual archived `createScene` implementations run in Chromium at 393×851. All eight
version × Fixed/Chase replays consume the same physical trace hash. Camera transforms
are updated for all 9,000 steps; a real WebGL frame is rendered once per simulated
second and screenshots are retained. Camera heading, chassis heading, FOV and car NDC
are recorded separately. This is a deterministic visual/geometry replay, **not an FPS
benchmark**, touch-latency measurement or proof of Android comfort. It excludes the
human camera-to-steering feedback loop.

## Controlled screening

Only after four-version baseline measurements, temporary v0.4.6 archives receive
one-family changes: rack time, high-speed authority, tire slopes/post-peak retention, relaxation length,
angular damping, spring damping, drive split and corner torque reduction. Every source
replacement is required to match exactly once and has before/after hashes. Patches
are research fixtures, never written into the working application's physics files.
Surface-family changes are the independent environment comparisons above. Camera
smoothing is evaluated separately from identical physics. Screened values are not an
exhaustive optimization and cannot establish a global optimum.

## Review and Android follow-up

Do not replace any published preview from this investigation. A human should test a
reviewed candidate on the same phone, course and camera: full stages; 70/100/126 km/h
entries; ordinary 200–400 ms corrections; alternating corners; steering release;
pre-corner braking; deliberate mistakes and recovery without reset. Record actual
button timings and phone/render timing before attributing a mismatch to tire tuning.
Keep Fixed/Chase trials paired and verify controls remain visible in portrait mode.

Numerical results, conclusions, unsuccessful cases and validation status follow in
`long-run-handling-results.md` after the completed runs. Physical performance claims
are limited to the exact simulated versions, fixtures and driver described here.
