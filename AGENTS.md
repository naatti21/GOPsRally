# GOPsRally – development guardrails (2026-11-24)

## Source of truth
The repo `main` still hosts an older release. The user-tested, newer prototypes are archived in `reference/` on this integration branch. Do not silently replace the accepted prototype with older `main` handling or old v0.4 Rapier chassis handling.

- `reference/V11_1_TURNpp_approved.html`: approved arcade TURN++ steering, speed, braking, 2D movement.
- `reference/V11_2_full_track_minimap.html`: accepted whole-track static portrait HUD map, not approved terrain physics.
- `reference/RoadLab_3D_shapes_working.html`: **scripted-line** 3D road/contacts proof for crest, jump and bank; geometry method is useful, but it is NOT a freely steerable game.
- `reference/Circuit_3D_failed_integration.html`: **REJECTED** integration: old road geometry, visually missing shapes and bogus flights at road/grass boundaries. Use as negative regression fixture, NOT the new base.

## Player acceptance (non-negotiable)
- **Portrait mobile first**, static-compass, high-oblique Circuit-Superstars-like follow camera, never rear chase default.
- Keep TURN++ on-road turning, speed and braking unchanged until quantitative A/B tests and player approval.
- Whole-circuit minimap shows car arrow; map orientation fixed.
- Real 3D *drivable road surface*: height, downhill/uphill, banks, bidirectional crest/jump. All wheel contacts, camera draw and collision use consistent same geometry.
- Road-to-verge/grass must be continuous. No invisible ramps, arbitrary body lifts, “sticker” geometry, or scripted jump cues.
- Deterministic contact and flight tests with measured outcomes; no pass purely based on numbers if visual result is unreadable.
- Prefer WebGL2 lightweight performance and minimize allocations/draw calls. Player previously measured about 88–90 FPS on V11; verify actual device again before perf claims.
- One clean development branch and preview; no automatic merge/deploy of `main`; no redundant zipped versions for every micro-change.
- Do not mark test results as Android-proven without an actual Android playtest.

## Work procedure
Investigate first, write acceptance checks, implement smallest vertical slice, run tests and capture portrait screenshots/benchmarks. Report measured failures. Preserve archived references intact. See `docs/CODEX_TASK_01.md`.
