# Racing-line physics A/B bench (not player Draw Mode)

## Question

Is the original drawn test line the "correct" / fastest racing line? **Not proven.**
The initial 325m C2-smooth path was hand placed for repeatable testing. Smooth
geometry does not imply optimal lap time, optimal entry/exit or even legal
track usage when the whole car footprint is considered.

## New reproducible experiment

`npm run lab:corner` simulates a single flat, 90-degree right-hander using
the current 1200kg Rapier vehicle physics and **only the existing digital
LEFT/RIGHT/BRAKE controller**; no direct yaw or scripted car transforms.

- Same centerline: turn radius 35m; road 13m wide; entry straight 75m; exit 65m
- Same initial x/z/heading and starting speed (83 or 110km/h)
- Same target speed profile (44km/h during apex, automatic throttle thereafter)
- Four planned options: center, early apex, late apex, inside
- Braking permitted only on the approach before the turn — **zero braking
  inside a corner** regardless of vehicle speed
- Every plan C2-smooth and physically on the same legal road at design time
- World-space wheel positions are checked for off-road excursions on EVERY
  simulation frame. A center-of-mass within road is not enough.
- An off-road wheel gets poorer lateral traction (surface category 3).
  Any wheel leaving the track invalidates the finish.
- Outputs include actual physical gate crossing, elapsed time, exit velocity,
  corner entry velocity, grip/side slip, trajectory deviation, wheel off-road
  seconds, and a leaderboard containing **legal** runs only.

## First actual 83km/h-entry measurements (2026-10-24)

| Planned line | Time | Exit speed | Wheel off-road | Valid |
|---|---:|---:|---:|:---:|
| Center | 11.12s | 75.5km/h | 0s | Yes |
| Late apex | 11.20s | 75.2km/h | 0s | Yes |
| Early apex | 10.82s | 78.9km/h | 0s | Yes |
| Inside | 10.47s | 77.9km/h | 2.32s | **No** |

The **inside shortcut looked fastest** until tire contact positions were
checked. At maximum deviation its wheel centers exceeded the road by ~0.65m,
and the run is therefore invalid. Among *these four fixed preset paths*
an early apex is fastest with this particular bang-bang virtual driver and
speed profile. This does **not** prove early apex is generally optimal; late
apex performance depends on exact corner shape, downstream straight, speed,
vehicle physics, turn-in timing and driver steering controller.

At higher 110km/h initial speed, earlier approach braking largely erased the
difference in speed at actual corner entry. This is a test-driver / speed-plan
effect, not an independent optimized brake point.

## What remains

- These are heuristic line shapes, not the optimization result of minimum-time
  optimal control. Optimize entry speed, brake point, steering policy and
  apex line simultaneously only after tire forces and slip control are credible.
- An objective is not simply high speed or shortest path: count legal on-road
  trajectory, total time *including exit*, and meaningful drift controllability.
- Real terrain relief, surface variation and human response may change
  preferred lines. Later extend the test to a segment of the real generated
  course; don't claim the synthetic flat corner represents the full track.
- The old 325m spline still serves as a useful regression driver trajectory;
  **do not simply keep editing that one line until a preferred outcome appears**.
- For now, prefer this A/B lab over spending scarce Codex credits. Reserve
  Codex for a separately specified hard problem in the tire-force model.

Repo: `feature/v04-racing-line-benchmark`, Draft PR #12 (based on lab PR #11).
No player-facing changes and no Pages publication in this branch.
