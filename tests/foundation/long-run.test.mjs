import test from 'node:test';
import assert from 'node:assert/strict';
import {roadIndex,ovalTrack} from '../../scripts/long-run/road.mjs';
import {pulseInput,digitalDriver} from '../../scripts/long-run/driver.mjs';
import {simulate} from '../../scripts/long-run/simulate.mjs';
import * as factory from '../../v04/src/physics/vehicle.js';
test('BVH nearest road matches independent exhaustive segment projection inside and outside the course',()=>{
  const track=ovalTrack(),road=roadIndex(track);
  for(let x=-450;x<=450;x+=37)for(let z=-450;z<=450;z+=41){
    const d=Math.min(...track.nodes.map((a,i)=>{
      const b=track.nodes[(i+1)%track.nodes.length],dx=b.x-a.x,dz=b.z-a.z;
      const u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-a.x-u*dx,z-a.z-u*dz);
    }));
    assert.ok(Math.abs(road.nearest(x,z).distance-d)<1e-7);
  }
});
test('countersteer delay is independent of hold duration and includes release',()=>{
  const s={pulse:.65,delay:.3,hold:.4};
  assert.deepEqual(pulseInput(.7,s),{left:false,right:false,brake:false});
  assert.equal(pulseInput(1,s).left,true);assert.equal(pulseInput(1.36,s).left,false);
});
test('digital driver holds buttons between decisions and consumes delayed observations',()=>{
  const read=digitalDriver(roadIndex(ovalTrack()),{delay:.3,period:.2});
  const p={x:-80,z:100,heading:0,speed:20};
  const first=read(0,p),second=read(.1,{...p,heading:2});
  assert.equal(second.left,first.left);assert.equal(second.right,first.right);assert.equal(second.decision,false);
  const third=read(.2,{...p,heading:2});assert.equal(third.left,first.left);assert.equal(third.right,first.right);
});
test('physical trace is deterministic, records every step and never resets momentum during the run',()=>{
  const s={environment:'open',mode:'pulse',speed:100,pulse:.65,delay:.3,hold:.3,duration:3};
  const a=simulate(factory,s),b=simulate(factory,s);
  assert.deepEqual(a.rows,b.rows);assert.equal(a.rows.length,180);
  assert.equal(a.metadata.duringRunStateWrites,0);
  assert.equal(a.metadata.interventions.length,3);
  assert.ok(a.rows.some(r=>Math.abs(r.beta)>3));
  assert.ok(a.rows.every(r=>r.wheels.length===4&&r.wheels.every(w=>Number.isFinite(w.saturation))));
  assert.ok(a.rows.every(r=>Number.isFinite(r.ay)&&Number.isFinite(r.rack)));
});
import {summarize} from '../../scripts/long-run/metrics.mjs';
test('one-direction spin must not count as left/right oscillation at the heading wrap',()=>{
 const rows=Array.from({length:240},(_,i)=>({speed:20,beta:i%120<60?170:-170,yaw:90,margin:2,x:0,z:-i,pitch:0,roll:0,ay:0,rack:.2,inDomain:true,phase:'right',right:true,wheels:[{load:3000,length:.4,contact:true}]}));
 assert.equal(summarize(rows).oscillationCycles,0);
 assert.equal(summarize(rows).spinouts,1);
 const alternating=rows.map((r,i)=>({...r,beta:i%60<30?12:-12,yaw:i%60<30?30:-30}));
 assert.equal(summarize(alternating).oscillationCycles,3);
});
test('150-second digital run keeps continuous momentum and repeats without hidden resets',()=>{
 const s={environment:'oval-flat',mode:'driver',speed:100,delay:.2,period:.2,duration:150};
 const a=simulate(factory,s),b=simulate(factory,s);
 assert.equal(a.rows.length,9000);assert.deepEqual(a.rows,b.rows);
 assert.ok(a.summary.distanceMeters>1000);
 assert.ok(a.rows.some(r=>r.left)&&a.rows.some(r=>r.right));
 assert.ok(a.rows.filter(r=>r.decision).length>=700);
 // Diagnostic failures remain data, not expected-failure tests or hidden recoveries.
 assert.equal(a.metadata.duringRunStateWrites,0);
});
