# Reproducible v0.4.4 → v0.4.5 physics comparisons

Baseline: `033ebb54872c702b143da62ce455892f92d139a3` (PR #12). Dependencies identical on both runs: Rapier JS/WASM 0.21.0, Three.js 0.186.1; Node 24.19.0. Candidate is the commit containing this report. No experimental PR #13 vehicle code is used.

- `*-line.json`: unchanged draw-line and seeded-recovery laboratory, including failed catches.
- `*-corner.json`: original four lines at 83 and 110 km/h, legal four-wheel boundaries, plus equal-start center-line driver-intent comparisons. No mid-corner braking or rewarded ranking.
- `*-drift.json`: original 70.2/100.1/126 km/h, 0.35/0.65/0.95 s pulse sweep and long-countersteer cases from PR #13's **harness**.
- `*-contact.json`: independent 70/100/126 km/h traces summarized by duration, slip/yaw, actual loads/travel, pitch/roll, displacement, exit speed and straight-line acceleration/braking. Includes release, short catch, overcorrection and overdrive.
- `*-traces.ndjson`: 10 Hz samples from 60 Hz simulations for the 100 km/h release/catch/overcorrection cases. Native legacy slip is regularized/folded; `unfoldedSlip` is measured independently from raw linear velocity in the body frame. Full traces for all cases are emitted by `npm run --silent lab:drift` and uploaded by CI.

Durations are simulated time, not CPU execution-time or phone-performance measurements. An open-ground displacement is not a road-boundary result. Corner wheel-center bounds are evaluated separately. “Clean attempt” labels driver intent; inspect actual slip and clean-corner fraction rather than assuming it was slip-free.

Run from the candidate checkout after `npm ci`:

```sh
BASELINE_DIR="$(mktemp -d /tmp/gops-v044.XXXXXX)"
git archive 033ebb54872c702b143da62ce455892f92d139a3 v04/src/physics v04/src/game/contracts.js package.json | tar -x -C "$BASELINE_DIR"
ln -s "$PWD/node_modules" "$BASELINE_DIR/node_modules"
RALLY_VEHICLE_MODULE="$BASELINE_DIR/v04/src/physics/vehicle.js" node scripts/archive-arcade-benchmarks.mjs before
node scripts/archive-arcade-benchmarks.mjs after
```

This uses the **same candidate lab code** for both models, with an explicitly archived vehicle factory. It never changes branches, rewrites production files or applies artificial yaw/pose updates during a trial. The initial test speed and settling period are identical. No external service, user data or Draw Mode UI is involved.

See [technical report](../../arcade-dynamics-v045.md) for interpretation, failed model hypotheses and Android gates.
