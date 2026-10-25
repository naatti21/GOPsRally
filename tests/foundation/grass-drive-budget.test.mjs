import test from 'node:test';
import assert from 'node:assert/strict';
import { contactForces, lateralResponse } from '../../v04/src/physics/contact-tire.js';
import { SURFACE_DRIVE_BUDGET, surfaceDriveBudget } from '../../v04/src/physics/drive-profile.js';
import { probeGrass } from '../../scripts/grass-traction-probe.mjs';

test('traction management changes only grass drive request, not road or shoulder',()=>{
  assert.deepEqual([...SURFACE_DRIVE_BUDGET],[1,1,1,.42]);
  assert.equal(surfaceDriveBudget(0),1);
  assert.equal(surfaceDriveBudget(1),1);
  assert.equal(surfaceDriveBudget(2),1);
  assert.equal(surfaceDriveBudget(3),.42);
  assert.equal(surfaceDriveBudget(999),.42);
});
test('motor impulse leaves a genuine lateral-force budget on grass, no invented traction',()=>{
  const fixture={angle:.35,lateral:8,longitudinal:12,load:3200,
    grip:.58,drive:3000,dt:1/60,rear:true};
  const old=contactForces({...fixture,driveBudget:1});
  const managed=contactForces({...fixture,driveBudget:surfaceDriveBudget(3)});
  assert.ok(old.limit>0);
  assert.equal(old.limit,managed.limit,'surface friction remains unchanged');
  assert.ok(Math.abs(managed.longitudinal)<=managed.limit*.42+1e-8);
  assert.ok(Math.abs(managed.lateral)>Math.abs(old.lateral)+1,
    'reduced automatic torque should make room for more physical side force');
  assert.ok(Math.hypot(managed.longitudinal,managed.lateral)<=managed.limit+1e-8);
  assert.ok(managed.lateral*fixture.lateral<=0);
  const road=contactForces({...fixture,grip:1,driveBudget:surfaceDriveBudget(0)});
  const unmodified=contactForces({...fixture,grip:1});
  assert.deepEqual(road,unmodified);
  // A `driveBudget=1` must NOT first clamp motor request and then
  // rerun friction-circle allocation, which would silently alter road physics.
  const demand={angle:.35,lateral:4,longitudinal:22,load:2800,
    grip:1,drive:12000,dt:1/60};
  const reference=contactForces({...demand,driveBudget:1});
  const fy=-reference.limit*lateralResponse(demand.angle).response;
  const scale=Math.min(1,reference.limit/Math.hypot(demand.drive,fy));
  assert.ok(Math.abs(reference.lateral-fy*scale)<1e-7,
    'non-grass request must use the original unclamped longitudinal demand');
  assert.ok(Math.abs(reference.longitudinal-demand.drive*scale)<1e-7);
});
test('grass brake behavior is independent from optional engine traction budget',()=>{
  const common={angle:.20,lateral:2,longitudinal:18,load:3000,grip:.58,
    brake:3500,drive:1000};
  assert.deepEqual(contactForces({...common,driveBudget:.42}),
    contactForces({...common,driveBudget:1}));
});
test('actual Rapier 40 km/h side recovery with automatic throttle improves over v046WG 0.58-grip fixture',()=>{
  const withThrottle=probeGrass({type:3,motor:true,sideKmh:40,forwardKmh:0,seconds:3});
  const repeat=probeGrass({type:3,motor:true,sideKmh:40,forwardKmh:0,seconds:3});
  assert.deepEqual(withThrottle,repeat);
  assert.equal(withThrottle.grip,.58);
  // Published v046WG fixture: ~25.63 km/h world-x after 1s.
  // Keep a real numerical acceptance gate; do not merely check finite output.
  assert.ok(Math.abs(withThrottle.sideAt1)<22,
    `expected a meaningful improvement over 25.63 km/h baseline, got ${withThrottle.sideAt1}`);
  assert.ok(Math.abs(withThrottle.sideAt2)<5,
    `lateral velocity still excessive at 2s: ${withThrottle.sideAt2} km/h`);
  assert.ok(withThrottle.records.every(r=>r.wheelContacts>=2));
  const compact=probeGrass({type:0,motor:true,sideKmh:40,forwardKmh:0,seconds:3});
  assert.ok(Math.abs(compact.sideAt1-9.21)<.12,
    `road was changed by grass-only experiment: ${compact.sideAt1}`);
  assert.ok(Math.abs(compact.sideAt2-11)<.12,
    `road long-term trajectory changed: ${compact.sideAt2}`);
  assert.ok(Math.abs(compact.sideAt1)<Math.abs(withThrottle.sideAt1),
    'even after traction control, road should recover faster than grass');
});
