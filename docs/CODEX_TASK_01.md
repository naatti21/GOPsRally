# Codex Task 01 — architecture and real 3D drivable surface (NO DEPLOY)

**Repo:** `naatti21/GOPsRally`  
**Starting branch:** `integration/roadlab-turnpp-baseline`  
**Status:** technical implementation task, not a release.

## Why
The user validated that TURN++ is fun to drive, the whole-track minimap is useful, and the RoadLab road shapes can look natural. Our later circuit integration failed because it reused the old road shape, while the separate road/grass heights generated artificial airborne events. The player tests in **portrait orientation**.

## Inputs
Read ALL four complete `reference/*.html` files listed in root `AGENTS.md`. Treat RoadLab geometry, NOT the failed Circuit integration, as the starting 3D road/contact implementation. Preserve TURN++ handling from V11.1 and the map from V11.2. Files in `reference/` are immutable specimens.

## First deliverable (before playable road release)
1. Describe the current coordinate systems and units, map of road mesh construction, collision/suspension contact queries, vehicle x/z and yaw control, and camera follow behavior.
2. Extract or implement an **authoritative drivable surface module**, e.g. `sampleRoad(s, lateral)` returning world position, surface normal, tangent, lateral direction and bank. Implement continuous verge/grass extension to the same surface. Render geometry and collision raycasts must derive from the same surface and not independently synthesize heights.
3. Create a small **freely steerable technical loop** with (a) gentle rise/fall, (b) true crest/jump and (c) banked bend. No scripted line or jump events. Maintain the portrait fixed-compass oblique camera. Keep the base TURN++ horizontal handling; if unavoidable, clearly isolate and quantify changes.
4. Implement deterministic tests for cross-section continuity, both directions over crest, slow vs fast contact, bank response and no unintended road-edge launch. Include a fixture reproducing the old road/grass failure.
5. Add dev-only debug overlays: contact count, real body-ground clearance, vertical velocity, camera mode and actual frame time. Do not count floating particles as a jump; use body/tyre geometry.
6. Measure performance with both geometry complexity and browser frame timings. Do not claim Android FPS without user's phone result.

## Acceptance gates
- Road edge, shoulder and grass all connect continuously. Test across entire road including near mesh seams. No multi-meter discontinuities.
- On ordinary road and shoulder crossings: no spontaneous >0.15s airtime or >0.3m body clearance solely from a height query discontinuity.
- At a designed crest: low speed contacts persist while high speed can produce natural, visible takeoff and landing in both travel directions.
- Banking shows actual chassis attitude and remains steerable, not just camera tilt.
- In air road tyre sideforces are removed/reduced naturally and only return smoothly on contact; no hard teleport to ground.
- Grounded TURN++ steering baseline remains comparable under an A/B input trace; preserve existing accepted controls and lap/map behavior.
- The portrait high-oblique view must make a real jump readable even with debug HUD turned off. Supply evidence frames.
- No deployment, no merge into `main`, no UI overhaul, no heavy scenery, no unrelated work.

## Stop rule
If clean geometry + freely steerable contacts cannot be achieved without major physics replacement, STOP and report the specific blocker and alternatives. Do not simulate progress with visual decals or arbitrarily scripted launches.

## Review / delivery
Commit source modules, tests, readable design notes, and captured evidence to a separate integration branch and open a **draft** PR. A playable Android preview comes **after** all deterministic gates and browser visuals pass; user personally judges driving feel.
