/**
 * v0.4.6 low-speed lateral-traction diagnostic.
 * This is a RESEARCH fixture, not a new driving mode or published physics.
 * 40 km/h HUD is the forward component, NOT the horizontal speed magnitude.
 * Initial velocities are test fixtures only; no pose/velocity edits after step 0.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { pathToFileURL } from 'node:url';
import { createVehicle } from '../../v04/src/physics/vehicle.js';
import { SURFACE_GRIP } from '../../v04/src/physics/tire.js';
await RAPIER.init();
const DT=1/60, KMH=3.6, rnd=(v,n=3)=>+v.toFixed(n);
const pythag=(a,b)=>Math.hypot(a,b);
function testCase({label,forwardKmh=0,sideKmh=40,surface=0,
  active=false, steerSeconds=0, duration=4}){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(600,.1,600)
    .setTranslation(0,-.1,0));
  const car=createVehicle(world,{surfaceAt:()=>surface});
  const rows=[];
  try{
    car.reset({x:0,y:1,z:0});
    for(let i=0;i<120;i++){car.tick(DT,{},false);world.step();}
    car.body.setLinvel({x:sideKmh/KMH,y:0,z:-forwardKmh/KMH},true);
    for(let i=0;i<=Math.round(duration/DT);i++){
      const snap=car.snapshot(), v=car.body.linvel();
      const horizontalKmh=pythag(v.x,v.z)*KMH;
      if(i%30===0||i===Math.round(duration/DT)){
        rows.push({
          t:rnd(i*DT,2),
          hudForwardKmh:rnd(Math.abs(snap.speed)*KMH,2),
          actualGroundKmh:rnd(horizontalKmh,2),
          bodyLateralKmh:rnd(snap.lateralSpeed*KMH,2),
          originalSideXKmh:rnd(v.x*KMH,2),
          slipDegrees:rnd(snap.bodySlipAngle*180/Math.PI,1),
          yawDegreesPerS:rnd(snap.yawRate*180/Math.PI,1),
          contacts:snap.wheels.filter(x=>x.contact).length,
          minWheelLoadN:rnd(Math.min(...snap.wheels.map(x=>x.load)),0),
          maxWheelLoadN:rnd(Math.max(...snap.wheels.map(x=>x.load)),0),
          totalSideImpulseNs:rnd(snap.wheels.reduce((n,x)=>n+Math.abs(x.sideImpulse),0))
        });
      }
      if(i===Math.round(duration/DT))break;
      car.tick(DT,{right:i*DT<steerSeconds},active);
      world.step();
    }
    let halfLifeSeconds=null;
    for(const r of rows){
      if(Math.abs(r.originalSideXKmh)<=sideKmh/2){halfLifeSeconds=r.t;break;}
    }
    return {label,surface,nominalSurfaceGrip:SURFACE_GRIP[surface],active,
      steerSeconds,seed:{forwardKmh,sideKmh,groundKmh:rnd(pythag(forwardKmh,sideKmh),2)},
      halftimeSampledSeconds:halfLifeSeconds,rows};
  }finally{world.free();}
}
export function runLowSpeedTractionProbe(){
  return {
    notice:'No parameter tuning or live-game changes. HUD speed is body-forward component and understates total sideways travel.',
    scenarios:[
      ...[0,1,2,3].map(surface=>testCase({label:'40 kmh PURE lateral, no motor',surface})),
      ...[0,3].map(surface=>testCase({label:'40 kmh PURE lateral, automatic throttle',surface,active:true})),
      testCase({label:'HUD 40 kmh but actual ground speed ~60 kmh, automatic throttle',
        surface:0,forwardKmh:40,sideKmh:Math.sqrt(60**2-40**2),active:true}),
      testCase({label:'40 kmh straight approach then 0.55 s steer, automatic throttle',
        surface:0,forwardKmh:40,sideKmh:0,active:true,steerSeconds:.55})
    ]
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(runLowSpeedTractionProbe(),null,2));
