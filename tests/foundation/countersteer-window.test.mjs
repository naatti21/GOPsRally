import test from 'node:test';
import assert from 'node:assert/strict';
import {gateCountersteer,emptyCatchState,CATCH_TUNE} from '../../v04/src/physics/countersteer-window.js';
import * as factory from '../../v04/src/physics/vehicle.js';
import {simulate} from '../../scripts/long-run/simulate.mjs';
const signals=(o={})=>({button:1,baseAngle:.35,forward:27.8,
  lateral:0,yaw:-.4,...o});
test('ordinary racing line steering is byte-for-byte unchanged, including short steer-only initiation',()=>{
 for(const velocity of [0,8,20,35]){
   for(const b of [-1,0,1]){
     const raw=b===0?0:b*.35;
     const c=gateCountersteer(emptyCatchState(),signals({
       button:b,baseAngle:raw,forward:velocity,lateral:0,yaw:b===1?-.4:.4}));
     assert.equal(c.limited,raw);
     assert.equal(c.latched,false);
   }
 }
});
test('only a physical opposite press after nontrivial same-signed yaw AND slip is capped',()=>{
 const off=gateCountersteer(emptyCatchState(),signals({button:-1,baseAngle:-.35,lateral:-4,yaw:-.4}));
 assert.equal(off.latched,true);
 assert.equal(off.limited,-CATCH_TUNE.rackCapRadians);
 // The opposite press remains guarded when momentum actually crosses zero,
 // so a 400 ms held button does not instantly command full opposite lock.
 const crossed=gateCountersteer(off,signals({button:-1,baseAngle:-.35,lateral:2,yaw:.35}));
 assert.equal(crossed.latched,true);
 assert.equal(crossed.limited,-CATCH_TUNE.rackCapRadians);
 const released=gateCountersteer(crossed,signals({button:0,baseAngle:0}));
 assert.equal(released.latched,false);
 const newTurn=gateCountersteer(released,signals({button:-1,baseAngle:-.35,lateral:2,yaw:.35}));
 assert.equal(newTurn.latched,false);
 assert.equal(newTurn.limited,-.35);
});
test('no catch protection at parking speed, below 4.3 degree slide, or without meaningful yaw',()=>{
 for(const data of [
   {forward:7,lateral:-2,yaw:-.4},
   {forward:27.8,lateral:-1.8,yaw:-.4},
   {forward:27.8,lateral:-4,yaw:-.1},
 ]){
  const c=gateCountersteer(emptyCatchState(),signals({button:-1,baseAngle:-.35,...data}));
  assert.equal(c.latched,false);
 }
});
test('real 100km/h 650ms unmodified turn-entry retains moderate slide when released',()=>{
 const s=simulate(factory,{environment:'open',mode:'pulse',speed:100,pulse:.65,duration:6}).summary;
 assert.ok(s.peakSlip>=8 && s.peakSlip<=25,`normal entry peak slip was ${s.peakSlip}`);
 assert.ok(s.longestModerateSeconds>.3,`moderate duration ${s.longestModerateSeconds}`);
});
