# Mobile control, drift entry and launch feedback — v0.4.6WGT-FB

**Player report:** 2026-11-08: rear still a little too nervous as drift begins, overshoots desired angle; launch feels dull/slow; long touch occasionally selects/highlights steering button text and loses steering. Three controls LEFT / RIGHT / BRAKE and automatic throttle stay unchanged.

**Base:** published v0.4.6WGT source `feature/v046wg-surface-traction-control`. Previous later speculative v0.4.7 research (#18, #23, #24) is NOT accepted as baseline. **Draft PR #25 only. Do not merge or publish without user approval.** Old stable root and all experimental URLs must survive unchanged.

## Changes
- Scope Android long-press touch-action, selection and context-callout suppression to the three driving controls only. Keep pointer capture, pointercancel, blur and app-switch cancellation. A 1.1-second CDP touch hold is tested against actual input state; current browser suite also verifies offline, reset and mobile camera.
- Gentle physical steering response: while wheel angle is building in the same direction and the car is not already in a big slide, use a 95 ms steering rise; releasing/reversing stays at 65 ms. Do not add chassis yaw torque, tire grip, road magnet, handbrake or any new controls.
- At true ground speed below 10 m/s and with negligible actual side slip / rack angle, add up to 12% low-speed *requested* torque fading smoothly to zero before 36 km/h. Existing load-dependent combined friction circle still caps actual force. The requested torque boost must not apply to a car already sliding sideways at 40 km/h; original grass recovery exact-reference test protects this.
- Chase FOV responds to actual speed earlier below 60 km/h and remains within the prior [62°,74°] interval, no camera shake, speedometer falsification or scripted motion.
- Physics comparability key changed to `rapier-v046wgt-touch-launch-steering-1`.

## CI A/B evidence (same flat physical fixtures)

| Metric | Published v0.4.6WGT source | FB candidate | Interpretation |
|---|---:|---:|---|
| 0–100 km/h | 4.617 s | 4.550 s | Modest physical improvement; **not** a drastic sprint fix |
| Braking 100 km/h | 42.175 m | 42.175 m | Unchanged |
| 70 km/h 0.65s steer peak slip | 9.154° | 9.058° | Very small improvement |
| 100 km/h 0.65s steer peak slip | 11.603° | 11.421° | Very small improvement |
| 126 km/h 0.65s steer peak slip | 13.451° | 13.229° | Very small improvement |
| Chase FOV at 60 km/h | 64.70° | 66.77° | Speed appears earlier |
| Chase FOV at 100 km/h | 69.77° | 72.23° | Still within restrained limit |
| Center corner four-wheel off road | 1.27 s | 1.05 s | Both **fail** legality; not solved |

A short right-steer release on a flat track is NOT an Android human driving-feel verdict. The desired difference in drift onset is currently small, so don't claim the overshoot problem is cured. A specific longer on-road episode and real Android continuous-hold test are required before considering this a release.

## Verification

GitHub CI initial pass on `cb70f0a9e97c60cc53efeaaae6e98bd59f2c0ffe`: **71/71 Node tests and 8/8 Chromium browser tests**, includes new 1.1s CDP held-touch and existing grass physical recovery fixture. Original grass test initially failed because torque boost was mistakenly based on body-forward speed during pure lateral motion; corrected to true ground speed plus low-slip gate. Regressions are a release blocker, not a reason to relax tests.

Subsequent source-label / physics-version commit requires final CI confirmation separately.

## Android acceptance (not completed)

Test a one-second and three-second held LEFT/RIGHT on physical phone; no selection handles, context menu, or cancelled control. Confirm two-thumb steering/brake still works. Then compare low-speed feel, fixed/chase view, 70–100 km/h turn-in, immediate and delayed countersteer, grass transition and real course boundaries against the current public version. Collect real frame time/heat if feasible. **No automatic production deploy.**
