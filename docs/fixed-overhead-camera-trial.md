# GOPs Rally — Fixed overhead camera A/B trial (2026-11-08)

**Status: isolated experiment. Do NOT merge or deploy before separate Android approval.**

Base: `feature/v04-responsive-handling` (v0.4.4 gameplay/physics).
New: `experiment/fixed-overhead-camera-v1`.

## Scope
- Launch in Fixed mode; keep Chase selectable for direct A/B comparison.
- Fixed now has a compass-locked elevated viewpoint, a smoothed focus slightly ahead in the car's heading direction, mobile portrait framing and a modest speed-related zoom.
- Camera aim and position use the same world-space focus; steering does **not** rotate the camera.
- Current v0.4.4 car physics, track, input, collision, road assets and lap timing are not modified.
- Existing Chase behavior is preserved.
- Camera direction is exposed as read-only test telemetry.
- No new track, no physics simplification yet. Decide those only after real phone feedback.

## Acceptance gate on Android
1. On a 320–393px wide portrait phone, are both road edges generally visible and is the approaching bend readable in time?
2. Can you hold left/right steering without the camera twisting, text selection or losing the car behind HUD/controls?
3. Can you deliberately steer through a bend and repeat it with more confidence than Chase?
4. Does any zooming feel distracting or make the car too small?

Test: one straight, one gentle turn and one tighter bend on existing loop. Compare Fixed and Chase on the SAME v0.4.4 physics; do not change physics during this test.

## Automated gates
- Run `npm test`, `npm run build` and `npm run test:browser` via the draft PR workflow.
- Browser tests assert Fixed is the initial mode, camera direction doesn't change under steering, mobile car stays in frame, and existing driving/offline behavior remains.
- Automated tests alone cannot certify touch feel or road readability. Review CI/browser evidence, then user phone test before any release.

## Next decision
If Fixed feels reliably better, narrow the game into a short, repeatable test segment and **then**, separately, simplify handling. If Fixed is worse, revise only the camera, not handling.
