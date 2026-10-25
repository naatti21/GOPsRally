# Validation record

Runtime: Node 24.19.0; Rapier 0.21.0; pinned lockfile; Chromium 154.0.8037.57
with SwiftShader. Application physics remains the exact v0.4.6 baseline.

| Check | Actual local result |
| --- | --- |
| `npm ci` | PASS, 22 packages installed; lock unchanged |
| `npm test` | PASS: 63 Node tests, 0 FAIL, 0 SKIP; legacy smoke commands also pass |
| New laboratory tests | 6/6 PASS, included in 63 above |
| `npm run lab:line` | Exit 0; failed driver catches remain in numerical output |
| `npm run lab:corner` | Exit 0; invalid paths remain in numerical output |
| `npm run lab:drift` | Exit 0; spinout/overcorrection cases remain in numerical output |
| `npm run build` | PASS; Vite bundle and offline generation |
| `npm run test:browser` | 6/6 PASS, 0 FAIL, 0 SKIP; 320/393 px WebGL, driving, touch, reset and offline |
| Four-version full matrix | 620/620 simulations completed; 1,550,880 steps retained; no out-of-mesh steps |
| Long-run reproducibility | Exact repeated 9,000-step (150 s) trace equality, not rounded summary equality |
| Raw-evidence verification | All compressed/raw SHA-256 checks and expected step counts PASS |
| Parameter screen | 60/60 runs completed: baseline plus nine single-family changes; none promoted |
| Camera replay | 8 archived camera/version combinations × 9,000 steps, one shared physical trace |
| Camera smoothing screen | 2 × 9,000 steps, same physical trace; no application changes |
| GitHub-hosted CI / workflow_dispatch | NOT RUN from this environment; no remote result claimed |
| Physical Android driving, touch latency and FPS | NOT RUN / NOT MEASURED |

The six new tests cover independent exhaustive-road-query equivalence, correction
interval timing, held/delayed digital observations, short physical determinism and
telemetry, continuous-spin versus alternating-yaw classification, and 150-second
continuity/determinism. Existing acceleration, braking, gravity, suspension/landing,
reverse, reset, tire-force budgets, terrain/collision and camera tests remain intact.

The published driving measurements are **not 620 successful driving scenarios**.
Many runs spin out, leave the road or fail to complete a checkpoint-valid lap;
these failures are the investigation's result. No safety test was skipped, marked
expected-failure or weakened. The before/after legacy corner/line/drift numerical
outputs are archived next to the new metrics, including unsuccessful cases.

This local record does not claim independent QA approval, Android performance or
GitHub CI success. The opt-in workflow makes raw evidence available as a future
GitHub Actions artifact without deployment. Until then the full 60 Hz recordings
remain under ignored `lab-results/`; compact summaries, hashes and plots are committed.
