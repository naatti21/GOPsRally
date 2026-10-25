# Wheel-derived speedometer / airborne limiter — isolated v0.4.6 trial

Date: 2026-10-25. Base: `feature/v046-arcade-feel-on-stable` (PR #17).
The experimental v0.4.7 lateral-grip diagnostics (PR #19) remain a separate issue.

## What changed

The old HUD displayed `Math.abs(bodyForwardVelocity) * 3.6`. When a car
travels obliquely, that is **not** total speed across ground. This can
mislead a driver who observes "40 km/h sideways" when horizontal ground
speed is much larger. We now expose three distinct readings:

- **HUD**: 4 driven wheel mean circumferential speed, `wheelSpeedMps`,
  using a bounded rotational-state estimate, including free spinning in air
- **Physics forward speed**: existing signed `speed` remains unmodified
- **True planar ground speed**: `groundSpeedMps=hypot(vx,vz)` stays telemetry

The AWD wheels accelerate angularly from their existing commanded engine
force share. Ground rolling recouples the wheel to surface-relative speed
according to measured suspension force; brake slows angular momentum; no
ground contact allows the wheels to spin up until the gearing-equivalent
**190 km/h wheel-speed limiter**. Animated wheel rotation uses the same
angle integrated by this model. `wheelLimiter` flags the top of the band.

**Engineering honesty:** this is a lightweight *kinematic rotational
estimator*, NOT a complete torque-consistent wheel/drivetrain simulation.
The new angular wheel state does **not** feed back into the longitudinal
contact-force curve, so landing spin cannot yet create full tire torque
reaction or a powered burnout. The earlier v0.4.6 per-wheel contact
physics remains unchanged. In the air no longitudinal force transfers to
the vehicle; a wheel-speed meter may be high with zero ground motion.

## Important non-goals

- No artificial wheel speed based on arbitrary HUD acceleration frames:
  the readout comes from the integrated wheel state and requested
  drivetrain torque.
- No body acceleration or speed multiplier when airborne.
- No change to v0.4.6 tires, grip thresholds, yaw, road boundaries or
  existing public previews.
- The v0.4.6 issue "slides sideways at indicated ~40 km/h" is **not
  resolved by this display change**. That physical traction issue must
  be evaluated against the v0.4.7 low-speed lateral-grip diagnostic,
  including side speed and true ground speed.
- No release or preview promotion without CI and an Android test.

## Validation

Unit tests separately cover road rolling, airborne wind-up to limiter,
wheel angular inertia on landing, reverse and braking, and a fully
airborne Rapier car where wheel speed increases but real horizontal
ground speed stays near zero. Browser test checks HUD/source agreement
and finite per-wheel values on 393px Android-like portrait.

Manual Android test:
1. On a straight, check HUD tracks expected driving speed.
2. On the first noticeable jump, HUD is allowed to climb faster than
   actual landscape motion; at peak the optional `LIMITER` status appears.
3. On landing, tire-speed indicated speed settles rather than
   instantly teleporting to chassis speed.
4. Try several wide and tight turns to see whether the apparent
   40 km/h sideways glide was partly a reading problem.
5. Independently judge side traction / countersteer; do **not** mark
   it fixed just because the speed display changed.

This is a Draft PR against `feature/v046-arcade-feel-on-stable`.
