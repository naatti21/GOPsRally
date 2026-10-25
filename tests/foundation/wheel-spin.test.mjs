import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { stepWheelSpin, wheelSpeedometer, WHEEL_SPIN } from '../../v04/src/physics/wheel-spin.js';
import { createVehicle } from '../../v04/src/physics/vehicle.js';
await RAPIER.init();

test('wheel-derived speed converges to contact-rolling speed on a road',()=>{
  let wheel={omega:0,rotation:0};
  for(let i=0;i<180;i++)wheel=stepWheelSpin(wheel,{
    dt:1/60,radius:0.36,longitudinalSpeed:20,
    contact:true,load:3000,driveForce:0,brakeForce:0,
  });
  assert.ok(Math.abs(wheel.omega*0.36-20)<0.01);
  assert.ok(wheel.rotation>50);
  assert.ok(!wheel.limited);
  assert.ok(Math.abs(wheelSpeedometer(Array(4).fill(wheel),0.36)-20)<0.01);
});

test('free wheel winds up to a finite rev limiter; contact regains road speed',()=>{
  let wheel={omega:65,rotation:0};
  for(let i=0;i<90;i++)wheel=stepWheelSpin(wheel,{
    dt:1/60,radius:0.36,longitudinalSpeed:22,contact:false,
    load:0,driveForce:2400,brakeForce:0,
  });
  assert.equal(wheel.limited,true);
  assert.ok(Math.abs(wheel.omega*0.36*3.6-WHEEL_SPIN.limiterKmh)<0.1);
  const airborne=wheel;
  for(let i=0;i<40;i++)wheel=stepWheelSpin(wheel,{
    dt:1/60,radius:0.36,longitudinalSpeed:22,contact:true,
    load:3500,driveForce:0,brakeForce:0,
  });
  assert.ok(wheel.omega*0.36<23);
  assert.ok(wheel.omega<airborne.omega);
  assert.ok(!wheel.limited);
});

test('braking and reversing affect wheel rotation sign without nonfinite states',()=>{
  let wheel={omega:70,rotation:0};
  for(let i=0;i<40;i++)wheel=stepWheelSpin(wheel,{
    dt:1/60,radius:0.36,longitudinalSpeed:0,contact:false,
    load:0,driveForce:0,brakeForce:3500,
  });
  assert.equal(wheel.omega,0);
  for(let i=0;i<45;i++)wheel=stepWheelSpin(wheel,{
    dt:1/60,radius:0.36,longitudinalSpeed:-6,contact:true,
    load:2500,driveForce:-600,brakeForce:0,
  });
  assert.ok(wheel.omega<0 && wheel.rotation<1);
  assert.throws(()=>wheelSpeedometer([{omega:0}],0.36),/four wheels/);
});

test('Rapier airborne car has tire-sourced HUD speed while true ground speed stays near zero',()=>{
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(400,0.1,400).setTranslation(0,-0.1,0));
  const car=createVehicle(world);
  try{
    car.reset({x:0,y:65,z:0});
    for(let i=0;i<120;i++){car.tick(1/60,{},true);world.step();}
    const s=car.snapshot();
    assert.equal(s.wheels.filter(w=>w.contact).length,0);
    assert.ok(s.wheelSpeedMps>35,'motor spins all driven wheels with no road contact');
    assert.ok(s.wheelLimiter,'all driven wheels can hit gearing-equivalent limiter');
    assert.ok(s.groundSpeedMps<1,'wheel spin does not inject airborne chassis acceleration');
    assert.ok(s.wheels.every(w=>w.rotation>1));
    assert.ok(s.wheels.every(w=>w.angularSpeed>0));
    car.reset({x:0,y:1,z:0});
    assert.ok(car.snapshot().wheelSpeedMps===0);
    assert.ok(car.snapshot().wheels.every(w=>w.rotation===0));
  }finally{world.free();}
});
