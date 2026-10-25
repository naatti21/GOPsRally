import test from 'node:test';
import assert from 'node:assert/strict';
import {availableEngineForce, wheelDriveForce, cornerDriveManagement} from '../../v04/src/physics/drive-profile.js';
import {measureStraight,runArcadeTrace} from '../../scripts/arcade-dynamics-benchmark.mjs';
import {chaseFov} from '../../v04/src/render/camera-response.js';

test('automatic acceleration uses real contact forces with useful midrange torque',()=>{
 const f0=availableEngineForce(0), f60=availableEngineForce(60/3.6),f100=availableEngineForce(100/3.6);
 assert.ok(f0>8500&&f60>7000&&f100>5500,'strong low/mid-range');
 assert.ok(f0>f60&&f60>f100);
 assert.equal(availableEngineForce(70),0);
 for(const speed of [0,12,28,48]){
  const e=availableEngineForce(speed);
  assert.ok(e>=0&&e<=9000);
 }
 for(const e of [-5000,0,7000]){
  const forces=[0,1,2,3].map(i=>wheelDriveForce(e,i));
  assert.ok(Math.abs(forces.reduce((s,x)=>s+x,0)-e)<1e-7);
  assert.ok(Math.abs(forces[0]/(e||1)-(e?0.2:0))<1e-9);
  assert.ok(Math.abs(forces[2]/(e||1)-(e?0.3:0))<1e-9);
 }
});
test('real Rapier car reaches 100 kmh faster without spoofing speed',()=>{
 const acceleration=measureStraight().find(x=>x.mode==='0–100 km/h');
 assert.equal(acceleration.reached,true);
 assert.ok(acceleration.seconds>3.5&&acceleration.seconds<7,
  `0-100 must be livelier than v045 7.267s; got ${acceleration.seconds}s`);
});
test('moderate steer-only slide remains possible and speed camera separates 60/100',()=>{
 const r=runArcadeTrace({speedKmh:100,pulse:.65});
 assert.ok(r.summary.peakSlip>5&&r.summary.peakSlip<26,
   `measured 100kmh slip ${r.summary.peakSlip}`);
 assert.ok(r.summary.longestModerateSeconds>.2);
 const difference=chaseFov(100/3.6)-chaseFov(60/3.6);
 assert.ok(difference>4&&difference<10);
});

test('corner torque control preserves straight acceleration and avoids abrupt extra rear saturation',()=>{
 const straight=cornerDriveManagement(0,0);
 const middle=cornerDriveManagement(.19,.05);
 const turn=cornerDriveManagement(.38,.14);
 const slide=cornerDriveManagement(.38,.3);
 assert.deepEqual(straight,{throttleScale:1,rearShare:.6});
 assert.ok(straight.throttleScale>middle.throttleScale);
 assert.ok(middle.throttleScale>turn.throttleScale);
 assert.ok(turn.throttleScale>slide.throttleScale);
 assert.ok(slide.throttleScale>=.68);
 assert.ok(turn.rearShare<=.52 && turn.rearShare>=.5);
 for(const state of [straight,middle,turn,slide])
  assert.ok([state.throttleScale,state.rearShare].every(Number.isFinite));
});
