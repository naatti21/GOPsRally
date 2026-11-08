# GOPs Rally — Classic Rally arcade sandbox (2026-11-08)

Status: **isolated experimental branch; do not merge or deploy without Android approval.**

Source: published v0.3.1 `main` game (the version the player reports as much more fun), NOT experimental v0.4 Rapier handling.

## Design direction
- **Classic Rally**: landscape-first, fixed compass direction, high isometric overhead view, road and upcoming turn visible. Use the supplied reference image only as an art/camera target, not an asset included in the game.
- **Chase Rally** (future): portrait-first. Both formats may eventually use the same arcade handling baseline but must have separate records by mode, track and physics version.
- Do not introduce shared leaderboard accounts, Supabase changes, or mode-specific rankings in this trial.

## Trial changes
- Rebalance simplified lateral velocity damping: entry slide grows with speed/steering, grip returns naturally on release.
- Faster digital steering response and safer near-zero-speed heading behavior.
- More restrained, smoother heading-related camera lead, no compass rotation in Fixed.
- A higher Fixed camera and landscape framing with bounded speed zoom.
- Roadside reflector posts to give visual motion cues at speed.
- No artificial speedometer scaling; UI continues displaying actual game velocity in km/h.
- Chase remains technically selectable for comparison but is NOT a finished separate game mode.
- The existing track geometry, lap rules, offline cache and public site are untouched.

## Android acceptance
1. Rotate device to landscape and select Fixed.
2. Drive a straight and several bends at 40–120 km/h. Are road edges and next bend visible early enough?
3. Enter a bend steering only: can you see drift beginning instead of a sudden full loss of grip?
4. Countersteer or release: can you catch it without the car getting stuck in an endless slide?
5. Does apparent motion improve? If not, measure actual screen motion and road dimensions before changing displayed speed.
6. Repeat one bend three times, improving the line without camera fighting the player.

Only after the manual test is positive consider separating modes/leaderboards or redesigning track graphics. Redesign with desert road/fences is a later art pass.

## Test gates
`node tests/smoke-test.cjs`
`node tests/3d-smoke-test.cjs`
`node tests/classic-feel.cjs`

GitHub Actions `classic-lab.yml` is deliberately tests-only: no Pages updates, deploy credentials, or release artifacts.
