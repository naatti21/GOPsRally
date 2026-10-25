import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { rearCorneringFriction } from '../../v04/src/physics/tire.js';
import { createVehicle } from '../../v04/src/physics/vehicle.js';
import { runSlideTrial } from '../../scripts/physics-line-lab.mjs';

test('rear friction cap only fades when speed and real steering/yaw demand justify it',()=>{
  assert.equal(rearCorneringFriction(1.6,5,1,.6,.4),1.6);
  assert.equal(rearCorneringFriction(1.6,25,0,0,0),1.6);
  assert.ok(rearCorneringFriction(1.6,25,.9,.4,.15)<1.25);
  assert.ok(rearCorneringFriction(1.6,25,.9,.4,.15)>.6);
  assert.ok(rearCorneringFriction(0.7,25,.9,.4,.15)<.7);
  assert.equal(rearCorneringFriction(1.6,Number.NaN,.2,.4,.1),0);
});
test('front keeps full cap; grounded rear consumes corner load as traction',async()=>{
  await RAPIER.init();
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(200,.1,500).setTranslation(0,-.1,0));
  const car=createVehicle(world,{surfaceAt:()=>0});
  try{
    car.reset({x:0,y:1,z:0});
    for(let i=0;i<120;i++){car.tick(1/60,{},false);world.step();}
    car.body.setLinvel({x:0,y:0,z:-27},true);
    for(let i=0;i<45;i++){car.tick(1/60,{right:true});world.step();}
    const state=car.snapshot();
    assert.ok(state.wheels.some(w=>w.contact));
    assert.ok(Math.abs(state.yawRate)>.1);
    assert.ok(state.wheels[0].frictionCap>1.59);
    assert.ok(state.wheels[2].frictionCap<state.wheels[0].frictionCap);
    assert.ok(state.wheels[2].frictionCap>=0.6);
    assert.ok(Number.isFinite(state.bodySlipAngle));
  }finally{world.free();}
});
test('measured steer-only slip benchmark is deterministic and does not invent a seeded slide',()=>{
  const a=runSlideTrial({speedMps:28,turnSeconds:.7,
    countersteerDelaySeconds:10,durationSeconds:3.2});
  const b=runSlideTrial({speedMps:28,turnSeconds:.7,
    countersteerDelaySeconds:10,durationSeconds:3.2});
  assert.deepEqual(a,b);
  assert.equal(a.seedSlipDegrees,0);
  assert.equal(typeof a.hadBreakaway,'boolean');
  assert.ok(a.maxBodySlipDegrees>=0);
});
