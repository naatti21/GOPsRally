import test from 'node:test';
import assert from 'node:assert/strict';
import { SURFACE_GRIP } from '../../v04/src/physics/tire.js';
import { probeGrass,runGrassComparison } from '../../scripts/grass-traction-probe.mjs';

test('offroad grip hierarchy remains graded, no grass ice cliff',()=>{
  assert.equal(SURFACE_GRIP.length,4);
  for(let i=1;i<4;i++)
    assert.ok(SURFACE_GRIP[i]<SURFACE_GRIP[i-1]);
  assert.ok(SURFACE_GRIP[0]-SURFACE_GRIP[3]>=0.35,
    'grass still has meaningful offroad penalty');
  assert.ok(SURFACE_GRIP[2]-SURFACE_GRIP[3]<0.12,
    'shoulder to grass must no longer drop tire force abruptly');
});
test('40km/h lateral motion regains normal grip on road, grass recovers better than previous 0.43 surface',()=>{
  const report=runGrassComparison();
  assert.equal(report.scenarios.length,6);
  const road=report.scenarios[0],grass=report.scenarios[3];
  assert.ok(road.groundAt1<grass.groundAt1);
  assert.ok(grass.groundAt1<23.9,
    'v0.4.6 grass baseline retained ~24.45km/h after 1s; candidate must improve');
  assert.ok(grass.groundAt2<grass.groundAt1);
  assert.ok(report.scenarios.every(s=>
    s.records.every(r=>Object.entries(r).filter(([k,v])=>typeof v==='number')
      .every(([k,v])=>Number.isFinite(v)))));
  assert.ok(report.scenarios.every(s=>s.records.every(r=>r.wheelContacts>=2)));
});
test('same input and terrain produces deterministic grip recovery with and without motor',()=>{
  const a=probeGrass({type:3,motor:true});
  const b=probeGrass({type:3,motor:true});
  assert.deepEqual(a,b);
  assert.ok(Number.isFinite(a.final.bodySlipDegrees));
  assert.ok(a.final.totalLateralImpulseNs>=0);
  const noMotor=probeGrass({type:3,motor:false});
  assert.notDeepEqual(a.records,noMotor.records);
});
