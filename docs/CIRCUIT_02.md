# Gravel Ridge

Gravel Ridge is a three-lap solo time trial on a 2.088 km closed course. The new course has a fast west straight, a flowing northern section, a tightening eastern sequence, and a southern approach that rewards braking. It uses the TURN++ steering, acceleration, brake strength and ×0.80 speedometer from V11.1. The camera stays high and fixed to the compass, with the same velocity lookahead. The full-course map remains north-up while the car arrow moves and rotates.

## Play

Serve the repository root with `python3 -m http.server 4173` and visit `/circuit/` on that server. This is the single preview path and requires WebGL2. Serve the source modules together rather than opening the HTML directly. There is no deployment configuration for this build.

Tap Start Race. The car accelerates by itself. Use Left and Right to steer and Brake to slow down. Hold Brake at a standstill to reverse. Keyboard equivalents are Left/Right or A/D, and Space to brake. Use Pause or Escape to pause, then Resume Race or Restart Race. Recover returns the car to its last valid location and adds three seconds to the current lap. After three laps the result screen shows the three splits, total time and best lap. The best lap is stored on that browser for this course. Storage failure leaves the game playable.

## Implementation

`roadlab/circuit.mjs` defines the closed spline, distance lookup, west crest, southern rise/descent and smoothly blended bank. `surface.mjs` uses the same rounded triangle positions for WebGL and wheel queries. The grass tapers to the flat floor. The race uses 24 ordered, forward-only gates per lap. Recovery records a safe point within the active gate sector. Crossing the finish repeatedly does not advance a lap. The three-lap clock advances with the simulation instead of counting a pause as drive time.

The circuit contains 40,322 terrain triangles. The renderer submits only the terrain batches near the preserved fixed-compass camera. There are no new asset downloads or large scenery meshes. The original `/roadlab/` route stays available as a reference.

## Verification

- Test inputs drove all three laps through the same race and physics code used by players. The completed run produced 52.208 s, 50.525 s and 50.525 s. There was one takeoff and landing per lap, each at the west crest.
- The slower full lap completed in 116.967 s without takeoff. Across 92 driven crossings from road into grass, measured airtime was 0 s and peak excess ride clearance was 0.08035 m. The maximum height change across 2 mm boundary probes was 0.61 mm. All ribbon vertices matched their world queries within 0.01 mm.
- At an initial 48 m/s, the independent crest tests measured 1.750 s southbound and 1.758 s northbound, with peak minimum tyre gaps of 5.495 m and 5.506 m respectively. The 2,880-step grounded comparison with V11.1 still reports zero difference on identical inputs and road profiles.
- Playwright covered startup, countdown, simultaneous touch steer/brake, static map, pause, resume, restart, recovery penalty, all three laps, the result and best after reload. The full race uses a test driver that supplies left/right/brake states only. It never sets a waypoint pose. Portrait control geometry was checked at 320, 360, 390 and 430 CSS pixels.

```sh
node tests/circuit.test.mjs
node tests/roadlab.test.mjs
node tests/smoke-test.cjs
node tests/3d-smoke-test.cjs
# With Playwright and Chromium available and the HTTP server on port 4173:
node tests/circuit-browser.mjs
ROADLAB_URL=http://127.0.0.1:4173/roadlab/ ROADLAB_EVIDENCE=/tmp/gops-lab-regression node tests/roadlab-browser.mjs
```

Portrait evidence at 390 × 844 without telemetry on screen: [start](evidence/circuit/01-grid.png), [grounded approach](evidence/circuit/02-crest-approach.png), [flight](evidence/circuit/03-crest-flight.png), [landing](evidence/circuit/04-crest-landing.png), [banked bend](evidence/circuit/05-banked-bend.png), [results](evidence/circuit/06-results.png). The ground shadow and the chassis separate in the flight frame, then meet again at landing. [The browser measurements](evidence/circuit/metrics.json) give contact counts, measured tyre clearance and frame timing. Timings reflect headless desktop Chromium with SwiftShader. Android frame rate and player feel still require a handset test.

The task environment currently has no authenticated HTTP preview port. The service listens on port 4173 for owner review when the HTTP preview is configured. No GitHub Pages or other public deployment has been made. The milestone remains pending player approval on a phone.
