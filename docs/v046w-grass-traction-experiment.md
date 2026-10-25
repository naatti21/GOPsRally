# v0.4.6WG — grass traction experiment (not a released version)

Player's Android feedback: steer-only drifting is sometimes catchable, but the car **snaps abruptly**, exits to grass too easily and then feels like ice skating. This is a NO-GO feedback signal, not an invitation to automatically increase all grip values.

Existing low-speed v0.4.7 research PR #19 found at seeded 40 km/h pure lateral velocity, with disabled game tick (which actually engages brakes) after 1s: compact surface ~5.44 km/h sideways, grass 0.43 ~24.45 km/h sideways (still ~8.85 km/h after 2s). With auto throttle enabled, large slip persisted for several seconds. Thus grass's old factor 0.43 plausibly causes a long, unsteerable exit, compounded by powered motion and delayed button feedback.

## Single-variable candidate

Preserve the v0.4.6W contact physics, automatic throttle, steering and wheel-speed HUD exactly as-is. **Only change grass `SURFACE_GRIP[3]` from 0.43 to 0.58**, keeping compact 1.00, loose 0.79 and shoulder 0.64. This narrows the shoulder→grass friction cliff from 0.21 to 0.06 while grass still has 42% less available tire force than compact road. A/B measurement uses 40km/h actual sideways chassis motion on identical flat surface with automatic throttle or with the game's disabled/braking state, not inferred from wheel-speed HUD.

A shorter sideways glide is desirable; invisible road-centering, teleporting the car back, hidden anti-yaw torque, or requiring mid-turn braking are NOT. The grass remains slower and more dangerous than road. Wrong line has real consequences.

Bench: `npm run lab:grass`. CI stores `grass-traction-recovery` JSON. Existing physics, long-run observations and browser tests are unchanged. Physics comparability key bumped, label changed to v0.4.6WG experiment. Baseline v0.4.6W is untouched.

## Limitations / required work

- **Do not infer this solves the snap.** Existing 620-run long-term research on v0.4.6 found wide sensitivity to 200–400ms digital countersteering, on and off track. More grass grip cannot fix hard snaps on the road.
- Compare both actual **wheel-derived HUD speed and true ground/sideslip motion**, since their values can diverge substantially while sliding.
- Do not deploy before CI green. Even with CI green, keep this candidate in Draft pending real Android A/B tests and a proper delayed-countersteer control study.
- If this candidate still feels icy, next physical focus is motor/throttle demand stealing lateral grip (friction circle) during sustained powered sideslip; evaluate separately instead of stacking speculative parameters.

## Diagnostic correction: 'motor off' does not equal free coasting

The original no-throttle v0.4.7 low-speed probe called `car.tick(dt, {}, false)` after initialization. Inspecting `vehicle.js` shows that `enabled=false` also requests **14000 N of total wheel braking force**. Its 'motor off' trials therefore measure *braked* tire recovery, NOT unpowered neutral coasting. We explicitly identify this in the new JSON as `brakesAppliedByDisabledTick`; do not quote those historical results as pure free-roll physics. The **motor=true trials** remain the key user-relevant always-throttle scenarios. Genuine neutral coasting would require a separately designed physics-test injection that disables engine AND brakes without modifying the player control grammar; we have not built that yet.
