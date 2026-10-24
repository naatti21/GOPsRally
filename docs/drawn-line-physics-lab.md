# Draw-line physics lab — experimental (2026-10-24)

## Why

The user wants the *DrawRace-inspired line-drawing workflow* to first become a
**repeatable tire, steering, weight-transfer and countersteering test**, before
any new player-facing Draw Mode. v0.4.4 remains a separate working preview.

## What works

- Draw a course as an ordered list of short `segments[].points` containing
  `x`, `z` (world metres), `speedKmh`. The next segment must begin at the
  previous one's exact endpoint with the same speed.
- The natural cubic spline fits a globally continuous **C2 path** through the
  anchors. Velocity and curvature are continuous across segment joins. This is
  geometric continuity only; narrow track boundaries and achievable steering
  rates must be checked separately before a playable Draw Mode.
- A minimal virtual driver projects the **actual simulated car** onto that
  line, chooses a forward aim point and issues only `left`, `right`, `brake`.
  No position/rotation reset or artificial turn torque during simulation.
- A flat-ground, 60 Hz Rapier test bench drives the same line at 65%, 100%,
  and 135% target speed plans, reporting progress, RMS cross-track error,
  maximum body slip, yaw, spring travel and discrete brake/steering decisions.
  Results reflect the REAL current vehicle controller; they are not a predicted
  success state.
- A second bench starts at the same 23 m/s, steers right for 0.46 s and
  varies the delay before the opposite steering pulse. It reports final
  body slip, yaw, grip, wheel contacts and a provisional catchability flag.
  **No guarantee the car is already catchable**; the experiment is designed
  to expose that weakness. The first real run reached only 1.3 degrees of
  peak sideslip despite a fast steering pulse, exposing a false-positive
  "recovery" flag. The revised test requires at least **8 degrees** before
  any run is even eligible for a caught-slide result. It also supports a
  reproducible 18-degree seeded chassis slip plus initial yaw rate, applied
  **once before the run** as a recovery fixture, never as gameplay steering.
  The first seeded 18-degree trials settled even with **NO countersteer**,
  so 'slip settled' is **not** counted as a player catch. A catch now requires
  the same initial physics experiment to finish within 5 m laterally **and**
  reduce drift by over 10 m against the passive no-countersteer baseline.
  The first measured passive case drifted 29.1 m sideways in three seconds;
  a 0.15 s countersteer trial drifted only 3.6 m. These are fixed-test
  metrics, not proof of gamepad drivability.

Run `npm test` for invariants, or `npm run lab:line` for a JSON comparison.

## Scope and safety

**Not** a new game mode or touch-drawing editor. Not published to /v04/ yet.
This module is not imported by the current player-facing game. It is also not
a racing AI for the leaderboard and should not create record submissions.

## Next pass

Use identical line and slide scenarios when revising the tire model. Compare
the actual slip recovery window and whether a skilled driver can catch the
rear without hidden yaw stabilization; then consider a small orthographic
drawing UI and segment-by-segment speed entry. Do not substitute scene
animation for physics.
