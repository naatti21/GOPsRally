# Steer-only drift: two negative experiments, and required next model

2026-10-25 | Branch: `feature/v04-steer-induced-drift` | PR #13
Reference: public v0.4.4 remains unchanged; old Draw/line lab PR #11 and legal-corner benchmark PR #12 are controls.

## Requirement (from direct player feedback)

Three mobile buttons: LEFT/RIGHT and BRAKE. Automatic throttle. The main driving skill is steering/line choice, *not* braking through a bend. Braking mainly before exceptionally tight, high-speed corners. Natural moderate self-stabilization desirable, BUT player must initiate and control a meaningful drift angle on the racing surface with steering alone. No auto-track-return; error can carry vehicle far into scenery.

## Actual 60 Hz Rapier evidence, not opinions

The first experiment reduced Rapier rear-wheel `setWheelFrictionSlip` friction *cap* based on speed/turn demand (capped to 40% of normal). It produced abrupt, unrecoverable **70–85 degree slides** in ordinary 70–126 km/h steering-pulse tests. Rejected.

A milder cap drop (~12–26% depending on speed) kept existing CI green but bifurcated: at ~100km/h mostly **0.4–0.8° slip**, while longer/faster input abruptly jumped into >80° spin. Not appropriate for the three-button arcade game. Rejected.

A second experiment kept the entire native wheel slip cap and instead softened only rear `setWheelSideFrictionStiffness` under sustained steering/yaw. This kept tests green, BUT failed to initiate a meaningful slide: about **0.3–0.4° slip at ~100–126 km/h** during 0.35–0.95 second steering pulses. Not a solution. See green CI measurement artifact on PR #13.

These are repeatable flat-ground tests; human Android play is still required before a public candidate can be declared fun. Test results are a diagnosis, not certification of universal native Rapier limitations.

## Physical distinction

Rapier raycast controller's `friction_slip` determines the maximum vector impulse proportional to normal load (native source: `max_imp = wheel.wheel_suspension_force * dt * wheel.friction_slip`). `side_friction_stiffness` multiplies a calculated lateral tire impulse before that joint cap. Neither is by itself a nonlinear, transient tire curve supporting stable, nonbinary drift angle with this chassis setup. Engine/brake/suspension are already handled by Rapier.

## Next engineering task (suitable for Codex *if explicitly chosen*)

Design and test a **bounded four-wheel lateral tire-force model** on top of native Rapier suspension and longitudinal drive/brakes. Preserve real per-wheel normal load, contact position, chassis inertia and surface friction. Do not apply direct yaw torque/teleport, fake visual motion, or an arbitrary "snap into drift" state.

Candidate approach: disable or minimize native lateral impulses to avoid double-counting; compute wheel-contact local slip angle from `v + omega × r`, steering angle, surface and load. Use a smooth peak/postpeak lateral force curve and clamp each contact impulse to its remaining friction-circle budget after longitudinal impulse. Apply lateral impulses at physical wheel contact positions once per fixed physics step. Confirm sign conventions, low-speed handling, suspension motion and contact transients. Use reference checks from Rapier's raycast vehicle controller source, not assumed API behavior.

**Acceptance measures (not single golden-angle tuning):**
- Reproducible steering-only 70 / 100 / 126 km/h sequences across 0.35 / 0.65 / 0.95s inputs, all measured with true body sideslip AND yaw.
- At reasonable fast-corner demand, a recoverable 6–18° drift range exists for some duration; steering changes *control* angle rather than immediately flipping between <1° and >75°.
- Overdriving longer/faster can still spin or go off-road; input release and countersteer produce nonchaotic self-stability on some legitimate window.
- On the 13m-wide 90° synthetic corner, use legal 4-wheel boundaries, actual exit speed and crossing, not just best-looking path.
- Brake only on approach for baseline driving; NEVER require brake-release or handbrake mid-corner.
- Existing 1200kg suspension/braking/rollover and mobile Chromium tests still pass. No magic position resets.
- Compare actual Android user response separately before publishing and bump physics_version for lap timing changes.

## Status

**PR #13 is an unmerged diagnostic experiment, NOT a shippable handling release.** No Codex run or night automation has been started. Existing v0.4.4 preview remains the safe comparison.
