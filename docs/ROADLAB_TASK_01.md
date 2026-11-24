# RoadLab 01 — technical course

## Baseline and acceptance checks

- V11.1 runs its arcade integrator in world metres and seconds. X is across the map, +Z is north, +Y is up in WebGL. Heading zero points +Z and positive heading turns toward +X. Its speedometer reports world m/s × 3.6 × 0.80. Use a trace against the archived integrator before changing its coefficients.
- V11.1 renders separate terrain and road strips and synthesizes wheel height in the renderer. Its compass-locked camera uses a raised orthographic view, velocity lookahead and a speed-dependent portrait span. V11.2 adds a closed north-up SVG path with a separately translated and rotated car arrow.
- RoadLab makes crest and camber part of the rendered triangles, interpolates contacts inside those triangles, and drives its body with four damped suspension springs. Its x/z pose is scripted and its outer terrain does not support the wheels. The new loop uses the mesh method and spring constants, with open steering and continuous terrain beyond the shoulder.
- The failed circuit queried its road strip until the edge and then fell back to the unrelated natural ground function. Its visually recessed landscape was yet another height. Reproduce the road/grass handoff using those archived functions before checking the replacement.

Acceptance: verify shared vertices and seam/edge height, a legacy artificial launch and its absence on the new surface, low/high speed in both directions, body roll on the bank, flat grounded TURN++ parity, smooth grip recovery, lap and compass behavior, then inspect portrait ride/flight/landing frames with diagnostics off. Measure actual browser frame intervals and mesh complexity separately from Android, which requires a handset.

## Implementation

The technical loop has two 320 m straights and two 70 m radius bends. The northbound straight has the main crest, the opposite straight has a gentler rise and fall, and the northern bend banks into the turn. The closed surface uses 1,350 rows spaced approximately 0.8 m apart. Within each row pair, the shoulder and grass reuse the road's boundary vertices. The grass transition meets the flat ground at the same height. The floor is painted before the ribbon with depth writes disabled to avoid coplanar depth artifacts.

`roadlab/surface.mjs` builds the triangles consumed by both WebGL and the x/z queries. These are vertical ray intersections against the triangle planes using barycentric bounds and a local spatial grid. `sampleRoad(s, lateral)` exposes the position, normal, tangent, lateral direction and bank for inspection. `contact.mjs` samples four suspension anchors from the same chassis pose, supplies its vertical motion, pitch and roll, and reports measured tyre gaps. `turnpp.mjs` keeps the archived grounded update order and tunes. `drive.mjs` combines them at 120 Hz. Wheel load removes tyre forces in flight and restores them over a 0.14 s loading ramp. A single forward finish gate controls the lap counter. The compass-locked portrait camera retains its fixed eye offset and velocity lookahead.

The preview at `/roadlab/` has the approved touch controls and a static north-up full course map. Use Left/Right, Space to brake or reverse, and Escape to pause on desktop. Add `?debug=1` for wheel contacts, actual body floor clearance, vertical velocity, camera mode and the unbounded animation frame interval.

## Deterministic results

| Check | Measured result |
| --- | --- |
| Road, shoulder and grass borders across the whole mesh, including the wrap | Largest height change across a 2 mm boundary probe: 0.47 mm. Highest vertex/query discrepancy rounds to 0.00000 m. |
| Ordinary edge crossing | 0 s airborne and 0.07928 m maximum excess body clearance. Acceptance limits: 0.15 s and 0.30 m. |
| Archived Circuit at its road/grass handoff | 9.13153 m height drop, 1.00 s false flight, 9.22961 m excess clearance. |
| Crest, initial speed 16 m/s (46 indicated km/h) | Four contacts throughout the measured runs in both directions, 0 s airborne. |
| Crest, initial speed 48 m/s (138 indicated km/h) | 1.65833 s airborne in each direction. Peak minimum tyre gap 4.75465 m northbound and 4.75319 m southbound. One landing each, with a maximum grip increment of 0.05952 per tick. |
| Bank | Chassis roll −12.49°, heading change 0.46528 rad during steer input, four wheel contacts at the end of the trace. |
| Grounded TURN++ A/B | No numerical difference in sampled horizontal state over 2,880 ticks across flat, graded/banked and off-road inputs. This compares both integrators with identical input and road data. |
| Air input and lap | Active side slip, steering and braking produced no tyre force in flight. Forward finish counted once and the reverse pass did not count. |

Run the eight deterministic checks and the two existing smoke suites:

```sh
node tests/roadlab.test.mjs
node tests/smoke-test.cjs
node tests/3d-smoke-test.cjs
```

## Portrait browser evidence

The browser test drives the real preview by touch and keyboard, checks the fixed camera and static full-track map, and records grounded approach, flight and landing with the debug HUD hidden. The repeatable screenshots seed the vehicle on the straight, then run normal physics.

- Northbound [approach](evidence/roadlab/01-approach-north.png), [flight](evidence/roadlab/02-flight-north.png), [landing](evidence/roadlab/03-landing-north.png)
- Southbound [approach](evidence/roadlab/01-approach-south.png), [flight](evidence/roadlab/02-flight-south.png), [landing](evidence/roadlab/03-landing-south.png)
- [Banked bend](evidence/roadlab/04-banked-bend.png) and [raw frame timing and complexity](evidence/roadlab/browser-metrics.json)

Install Playwright and Chromium in your development environment. From the repository root, start `python3 -m http.server 4194` and run `node tests/roadlab-browser.mjs` in a second terminal. For a system Chromium set `CHROMIUM_PATH` to the executable. To use an existing Playwright installation set `ROADS_PLAYWRIGHT_MODULE` to its absolute module path.

The desktop headless Chromium run uses SwiftShader at 390 × 844 CSS pixels with a 507 × 1097 drawing buffer. The scene contains 43,202 terrain triangles and issues eight draw calls while driving. The measured frame intervals reflect software rendering in this environment. Handset frame pacing, touch ergonomics, and driving feel remain unverified. The route and suspension are deliberately limited to this technical course. The tyre model uses vertical rays and does not handle walls or full-volume collisions.

In the committed portrait sequence, the car separates from its ground shadow in both directions, then the same gap closes at landing. At the captured flight frames, the minimum tyre/ground gap was 4.70 m in each direction. The measured animation interval over 101 frames was 66.6 ms median, 100 ms p95, and 150 ms maximum.
