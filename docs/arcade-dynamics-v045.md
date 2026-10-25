# v0.4.5 experimental handling — review handoff

Base: PR #12 / `feature/v04-racing-line-benchmark`, **033ebb54872c702b143da62ce455892f92d139a3**. Candidate branch: `feature/v04-arcade-dynamics`. PR #13's findings were read; its experimental physics was **not** used. Only its steering-pulse benchmark was reused. No production/public preview deployment, track generation, leaderboard or playable Draw Mode changes.

## Tire and chassis model

`contact-tire.js` supplies a smooth odd lateral response: `tanh(alpha/slope) × retention`, with gradual post-peak retention loss. Front/rear slopes are 0.16/0.12 radians; asymptotic losses are 6%/10%, not a sudden grip switch. Contact slip includes angular velocity about the **actual world center of mass**, measured at the wheel's ground contact and projected into the contact plane. A 0.8 m relaxation length models transient buildup; low-speed damping is bounded, and force opposing the measured velocity cannot become a lateral energy source.

Rapier retains the four raycasts, springs/dampers, gravity, inertia, CCD, roof/body collisions and suspension travel. Native side stiffness, engine force and brake impulse are all zeroed before `updateVehicle`. The new model then applies **one** longitudinal/lateral contact impulse per wheel. Drive and braking share a Euclidean friction circle with lateral force. Available force follows the actual **capped applied spring load**, surface grip and mild load sensitivity, rather than an uncapped landing-force request. All four tire evaluations use the same pre-tire velocity state to avoid wheel iteration-order bias.

Why replace both tire axes? A characterization of the installed **@dimforge/rapier3d-compat 0.21.0** binary gives 0.99350 N·s longitudinal impulse versus a nominal `mu × load × dt` of 0.49675 N·s with zero lateral stiffness. This is the native weighted ellipse's 0.5 longitudinal factor, not our circular budget. An initial suspicion of an *unbounded* impulse from reading an older Rust-tag implementation was **not reproduced**; that hypothesis was rejected. The regression test asserts the measured ~2× ratio and separately requires **zero native impulses** during production operation. Rust controller source inspected: `dimforge/rapier/src/control/ray_cast_vehicle_controller.rs`; runtime behavior, not matching JS/Rust tag names, determines the integration.

The 1,200 kg mass, fixed CoM, inertia, spring rates and dampers remain unchanged. Applying lateral forces at the **real contact point** replaces the native controller's reduced lateral roll lever. That produces genuine lateral load transfer and visible chassis roll, without injected yaw torque, changing CoM, pose corrections or road-centering. A 70 ms steering-rack response keeps input/sign changes prompt while avoiding instantaneous full-angle reversals. Reset clears rack/tire transient state. Wheel visuals follow actual rack/suspension state.

`sideGrip` telemetry is post-peak retention × surface/axle coefficient, not the total available force. `tireLimit`, applied impulses and capped `load` expose the real budget; `rawSuspensionLoad` preserves the unclamped diagnostic. The historical pure `tireGrip` function remains for old regression/reference comparisons; it no longer controls production forces.

Physics comparability key is now **`rapier-v045-contact-tires-1`**. Automatic throttle, deliberate reverse, LEFT/RIGHT/BRAKE, lap guards, countdown and manual reset are retained.

## Measured before/after

Identical flat-ground fixtures, 60 Hz, auto throttle, no brake, no seeded slip/yaw. A 0.65 s right input is followed by release; the short catch adds 0.10 s left input. Duration is the longest continuous interval within **6–18°**, not a single peak sample. These are deterministic simulation seconds, not human/device measurements.

| Entry | v0.4.4 peak slip | v0.4.5 peak slip | Moderate duration before → after | Peak roll before → after |
|---|---:|---:|---:|---:|
| 70 km/h | 1.72° | 9.12° | 0 → 0.617 s | 0.52° → 3.40° |
| 100 km/h | 0.68° | 12.63° | 0 → 0.967 s | 0.54° → 3.49° |
| 126 km/h | 0.33° | 15.67° | 0 → 1.267 s | 0.56° → 3.54° |

| Entry | Yaw rate at 0.85 s: release → short catch | Lateral displacement at 4 s: release → catch |
|---|---:|---:|
| 70 km/h | −25.88 → +4.46 °/s | 36.93 → 27.73 m |
| 100 km/h | −23.43 → −3.59 °/s | 39.39 → 30.93 m |
| 126 km/h | −24.04 → −10.46 °/s | 42.59 → 35.07 m |

The displacement comparison is against the original straight heading in an **open-ground fixture**, not proof of staying inside a road or returning to its center. Short catches settle below 2° slip / 3°/s yaw; prolonged opposite input is deliberately not self-corrected by the game.

| Straight-line measurement | v0.4.4 | v0.4.5 |
|---|---:|---:|
| 0–100 km/h | 7.267 s | 7.267 s |
| 70 km/h stopping distance | 15.86 m | 20.96 m |
| 100 km/h stopping distance | 32.23 m | 42.51 m |
| 180 km/h stopping distance | 102.05 m | 133.56 m |
| Peak braking nose dive | 1.87° | 1.41° |
| Peak acceleration pitch | 0.84° | 0.84° |

Braking distance increases because the new tire budget is stricter; nose dive consequently **decreases**, rather than being cosmetically amplified. Acceleration load transfer is preserved. Cornering roll increases through physical contact moments. No fictional force/speed multipliers were added for presentation.

Same 13 m-wide, 35 m-radius 90° corner, equal initial 83 km/h, center reference line and approach-only braking:

| Driver intent | Time | Exit | Peak slip | 6–18° duration | Valid four-wheel finish |
|---|---:|---:|---:|---:|---|
| Line-following / clean attempt | 9.83 s | 86.7 km/h | 12.3° | 1.68 s | Yes |
| Add 0.35 s entry-steer pulse | 9.98 s | 83.9 km/h | 12.3° | 2.15 s | Yes |
| Hold entry steer for 1.2 s | 10.27 s | 79.0 km/h | 26.5° | 2.67 s | Yes |

No ranking or drift speed bonus is imposed. **The “clean” attempt is not slip-free:** 76% of corner samples are below 6°, but exit corrections produce a 12.3° peak. This limits any claim of an optimal clean-versus-drift comparison. The four existing alternate-line trials still run; some early/late-apex or high-entry trials violate wheel boundaries. Their failures are retained in the JSON, not filtered out of a “best run.”

## Negative results and remaining limits

- First custom prototype (`mu=1.35`, softer rear slope, no rack response) still reached ~52°/80° at 100/126 km/h after a 0.35 s steering pulse. It was rejected. Lowering mu **alone on the old native model** was not reused; the accepted model has a continuous force/slip relation and a shared contact budget.
- A 100 ms rack filter initially failed an existing immediate countersteer sign test. The response was improved to 70 ms; the original assertion was not weakened.
- Long 1.15 s opposite inputs still cause major spins, especially at 100–126 km/h. Poor steering remains costly. Such failures are archived alongside successful short catches.
- The legacy `bodySlipAngle` regularizes low speed and folds reverse longitudinal motion into ±90°. New traces additionally record **unfolded** `atan2(lateral,longitudinal)` and test ordinary pulses against it, so a backward spin cannot masquerade as a recovered slide. Raw high-angle cases must not be compared using peak folded angle alone.
- This is a tunable arcade brush approximation, not an identified real tire, rotating-wheel drivetrain, or proof that a human can control every surface/speed combination. Brief correction windows, grass transitions, banked landings and long-session feel need Android playtesting.

## Camera and mobile evidence

Chase retains its near-car framing, world-up stabilization and the existing road visibility baseline. FOV eases from 62° to at most 68° using measured body-plane velocity, with a 0.65 s time constant. Heading has 90 ms smoothing and at most about 5° contribution toward travel direction; it uses no road tangent. Fixed camera behavior is retained. Existing instanced roadside stakes become denser (every 6 instead of 9 samples) without adding draw calls, blur, shake or another rendering pass.

Actual Chromium/SwiftShader tests cover 320/393 px portrait and landscape, speed-dependent FOV, frame-by-frame car framing through a real steer/countersteer sequence, reset, input cancellation, camera switching and offline reload. Screenshots/telemetry are CI artifacts. This is **software-rendered browser evidence, not Android FPS**. Hardware performance, thermals, touch feel and before/after Android timings remain NOT MEASURED. Existing shared JS/WASM bundle still emits a size warning.

## Reproduce and review

Run `npm ci`, `npm test`, `npm run lab:line`, `npm run lab:corner`, `npm run lab:drift`, `npm run build`, `npm run test:browser`. Set `CHROMIUM_PATH` if system Chromium is elsewhere. Local environment uses Node 24.19 and `/usr/bin/chromium`; the CI workflow installs Playwright Chromium and uploads the drift report. No deployment job was added.

[Archived numeric reports](metrics/arcade-v045/README.md) include the exact baseline SHA, reproduction commands, successes and failed cases. The concise JSON summaries include all scenarios; NDJSON retains selected 100 km/h time series. `lab:drift` emits the full traces for CI artifacts.

Android review: compare v0.4.4 and this separate build on the same phone. Try small taps and 0.35/0.65/0.95 s steering at roughly 70/100/126 km/h, brief opposite corrections, then deliberately excessive inputs. Brake before tight turns. Check roll/pitch against wheel travel, reversing and instant reset, portrait road anticipation and car visibility, app-switch cancellation and offline restart. Record actual frame times/heat and subjective correction window; do not approve public replacement solely from CI.

Recommendation: **GO for independent review and a separate Android handling trial; NO-GO for public replacement without that trial.** No merge or deployment is authorized by this report.

Final local verification (2026-10-25): `npm ci` PASS; **47/47 Node tests PASS**, both legacy smoke scripts PASS; `lab:line`, `lab:corner`, `lab:drift` executed successfully and retain unsuccessful driving scenarios; build PASS with the existing large-bundle warning; **6/6 Chromium tests PASS**, no skips. Remote GitHub CI is not implied by these local results; its availability is reported separately in the PR/task handoff.
