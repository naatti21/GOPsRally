import test from 'node:test';
import assert from 'node:assert/strict';
import {outsideTerrain} from '../../v04/src/game/world-bounds.js';
import {CONTACT_TUNE,lateralResponse} from '../../v04/src/physics/contact-tire.js';
import {responsiveSteering} from '../../v04/src/physics/tire.js';
import {runArcadeTrace} from '../../scripts/arcade-dynamics-benchmark.mjs';
import {runCornerTrial} from '../../scripts/corner-line-benchmark.mjs';

test('lost car stops only near the true outer mesh, not when sliding off the road',()=>{
  const world={min:-165,size:330};
  assert.equal(outsideTerrain(world,{x:0,z:0}),false);
  assert.equal(outsideTerrain(world,{x:90,z:-100}),false);
  assert.equal(outsideTerrain(world,{x:163,z:0}),true);
  assert.equal(outsideTerrain(world,{x:-170,z:0}),true);
  assert.equal(outsideTerrain(world,{x:0,z:162.49}),false);
  assert.equal(outsideTerrain(world,{x:0,z:162.51}),true);
  assert.equal(outsideTerrain(world,{x:NaN,z:0}),true);
});

test('early steering response retains real side force and rear grip fades smoothly',()=>{
  assert.ok(CONTACT_TUNE.mu>=1.05&&CONTACT_TUNE.mu<=1.2);
  assert.ok(lateralResponse(.08,false).response>0.49,
    'initial front side response should not feel like ice');
  const sides=[.1,.2,.35,.55].map(a=>lateralResponse(a,true));
  assert.ok(sides.every(t=>t.retention>=.93));
  assert.ok(sides.every(t=>Number.isFinite(t.response)&&t.response>0));
});

test('digital high-speed steering stays available without demanding unachievable max wheel lock',()=>{
  assert.ok(responsiveSteering(1,27.8)<.36);
  assert.ok(responsiveSteering(1,27.8)>.3);
  assert.equal(responsiveSteering(-1,27.8),-responsiveSteering(1,27.8));
});

test('small steer pulse on compact retains intermediate slip and settles without oscillation',()=>{
  const s=runArcadeTrace({speedKmh:100,pulse:.65,duration:4});
  assert.ok(s.summary.peakSlip>5&&s.summary.peakSlip<19);
  assert.ok(Math.abs(s.summary.finalSlip)<2);
  assert.ok(Math.abs(s.summary.finalYaw)<4);
  const latter=s.rows.filter(r=>r.time>2.5);
  assert.ok(latter.filter(r=>Math.abs(r.yaw)>20).length===0,
    'should not repeatedly hunt after the driver releases steering');
});

test('recalibrated car has a valid first synthetic corner without brake+steer in the bend',()=>{
  const x=runCornerTrial({lineId:'center',initialSpeedKmh:83});
  assert.equal(x.brakeInCornerFrames,0);
  assert.ok(x.enteredCorner);
  assert.ok(Number.isFinite(x.rmsLineErrorMeters));
  assert.ok(x.maxWheelRoadOffsetMeters>=0);
});
