import test from 'node:test';
import assert from 'node:assert/strict';
import {digitalSteering} from '../../v04/src/physics/digital-steering.js';
import * as factory from '../../v04/src/physics/vehicle.js';
import {simulate} from '../../scripts/long-run/simulate.mjs';
const empty=()=>({hold:0,direction:0,rack:0});
test('digital assist is mirror symmetric and preserves low-speed reverse steering',()=>{
 for(const forward of [-6,0,20,35]){
  const a=digitalSteering(empty(),{input:1,forward,lateral:-3,yaw:-.4,dt:1/60});
  const b=digitalSteering(empty(),{input:-1,forward,lateral:3,yaw:.4,dt:1/60});
  assert.equal(a.rack,-b.rack);
  if(forward<3)assert.ok(a.rack>0);
 }
});
test('release and reversal discard sustained-button history',()=>{
 let s=empty();for(let i=0;i<120;i++)s=digitalSteering(s,{input:1,forward:25,lateral:0,yaw:0,dt:1/60});
 const reversed=digitalSteering(s,{input:-1,forward:25,lateral:0,yaw:0,dt:1/60});
 assert.equal(reversed.hold,1/60);
 const release=digitalSteering(s,{input:0,forward:25,lateral:0,yaw:0,dt:1/60});
 assert.equal(release.hold,0);
 assert.equal(release.target,0);
});
test('200–450ms correction grid settles at 70/100/126 without a short-pulse spin',()=>{
 for(const speed of [70,100,126])for(const hold of [.2,.3,.4,.45]){
  const {summary:s}=simulate(factory,{environment:'open',mode:'pulse',speed,pulse:.65,delay:.3,hold,duration:6});
  assert.equal(s.spinouts,0);
  assert.ok(s.peakSlip<20,`${speed}/${hold}: ${s.peakSlip}`);
  assert.ok(s.finalAbsSlip<2&&s.finalAbsYaw<4);
 }
});
test('a longer steering-only input still creates measured moderate sideslip at 100 km/h',()=>{
 const {summary:s}=simulate(factory,{environment:'open',mode:'pulse',speed:100,pulse:1.8,duration:6});
 assert.ok(s.peakSlip>=6&&s.moderateSeconds>=.5);
});
