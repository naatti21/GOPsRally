# v0.4.6WGT – grass auto-throttle traction control (experimental)

**Source branch:** `feature/v046wg-surface-traction-control`, based on published and CI-verified `feature/v046w-grass-traction-probe` / v0.4.6WG. Does **not** modify the already published v0.4.6WG, v0.4.6W, v0.4.6 or root.

## Player problem
Steering and countersteering sometimes work on the compact road, but at relatively low indicated speeds the car can glide sideways and grass feels like ice. A wheel-speed HUD alone doesn't fix true lateral velocity or tire-force authority. v0.4.6WG raised grass grip from 0.43 to 0.58, which improved a controlled braked-recovery benchmark, but *powered* grass still had ~25.63 km/h world-X lateral motion after one second and ~15.52 km/h after two seconds.

## Single mechanical hypothesis
The always-on engine asks each rear tire for longitudinal thrust even if grass normal-force/friction capacity is too low. Native combined-force friction-circle scaling then reduces the available **lateral force**. Rather than giving grass unrealistic free grip or injecting yaw torque, limit grass **requested drive** to 42% of that tire's normal-load-dependent total force limit. Both components still share the exact same friction circle.

- In `contact-tire.js`, optional `driveBudget` (default 1) limits motor-request force *before* combined-force scaling. Physical braking remains unchanged; total tire force cannot exceed `mu × normalLoad × loadSensitivity`.
- In `drive-profile.js`, `SURFACE_DRIVE_BUDGET = [1,1,1,0.42]`: three on-road surfaces retain exactly the original behavior. Grass still has lower friction `SURFACE_GRIP[3]=0.58`, no road-centering, direct yaw rotation, scripted slip, new touch control, or magic recovery.
- All four contact impulses remain applied at the real wheel/ground contact location.
- Physics version `rapier-v046wgt-grass-torque-budget-1` keeps times separate from v0.4.6WG.
- **This is one experimental intervention, not a validated improvement.** Testing should expose whether longitudinal-lateral competition was the real issue. Don't claim a cure if only the fixed seeded test improves or if human drive becomes underpowered on grass.

## Acceptance checks
1. Run the existing `npm test`, `npm run lab:grass`, `npm run lab:corner`, `npm run lab:drift`, `npm run build`, `npm run test:browser`.
2. In same 40 km/h pure sideways, flat-ground, 4-contact, automatic-throttle fixture, measure v0.4.6WGT side X after 1 and 2s vs published v0.4.6WG **25.63/15.52 km/h**. Smaller residual is desired, without forcing zero motion.
3. Confirm compact gravel 40 km/h trial and steering profile are unchanged, as the budget is 1 for the three non-grass surface types; grass friction circle must still cap both axes.
4. Inspect numerical braking coast reference carefully: `tick(enabled=false)` applies brakes, not neutral coasting.
5. Only after independent CI and a human Android A/B (v046wg vs test candidate) decide if this is worth an isolated beta. User's 40kmh sideways-glide and drift snapping problems remain unsolved until tested.

This Draft PR is **NOT** deployed, merged, or a replacement for existing betas. All previous test addresses remain intact.
