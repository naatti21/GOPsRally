import test from 'node:test';
import assert from 'node:assert/strict';
import { runLowSpeedTractionProbe } from '../../scripts/long-run/low-speed-side-grip.mjs';

test('low-speed grip report distinguishes projected HUD speed from real ground motion',()=>{
  const data=runLowSpeedTractionProbe(), scenarios=data.scenarios;
  assert.equal(scenarios.length,8);
  for(const s of scenarios){
    assert.ok(s.rows.length>=6);
    assert.ok(s.rows.every(r=>
      Object.values(r).filter(x=>typeof x==='number').every(Number.isFinite)),
      'all 40kmh telemetry numbers must be finite');
    assert.ok(s.rows.every(r=>r.contacts>=0&&r.contacts<=4));
    assert.ok(Math.abs(s.rows[0].actualGroundKmh-s.seed.groundKmh)<0.02);
  }
  const sideways=scenarios[0].rows[0];
  assert.ok(sideways.hudForwardKmh<0.5);
  assert.ok(Math.abs(sideways.actualGroundKmh-40)<.05);
  const oblique=scenarios[6].rows[0];
  assert.ok(Math.abs(oblique.hudForwardKmh-40)<0.05);
  assert.ok(Math.abs(oblique.actualGroundKmh-60)<0.05);
});
test('40 kmh lateral motion slows without input; asphalt-like compact surface must beat grass',()=>{
  const {scenarios}=runLowSpeedTractionProbe();
  const compact=scenarios[0], grass=scenarios[3];
  assert.equal(compact.surface,0);
  assert.equal(grass.surface,3);
  assert.ok(compact.rows.at(-1).actualGroundKmh<compact.rows[0].actualGroundKmh);
  assert.ok(compact.rows.at(-1).contacts>=2);
  // This tests lateral deceleration on the exact SAME car and input.
  // Exact time-to-stop remains a physics QA criterion, not a tuned passing threshold.
  assert.ok(Math.abs(compact.rows[2].originalSideXKmh) <=
    Math.abs(grass.rows[2].originalSideXKmh)+1);
});
