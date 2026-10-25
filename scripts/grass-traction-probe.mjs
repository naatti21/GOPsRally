/** Repeatable grass/shoulder recovery trial, no game-side yaw or rescue.
 * The initialized lateral motion is a measurement fixture, never gameplay.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { createVehicle } from '../v04/src/physics/vehicle.js';
import { SURFACE_GRIP } from '../v04/src/physics/tire.js';
import { pathToFileURL } from 'node:url';
await RAPIER.init();
const dt=1/60, kmh=3.6, round=x=>Math.round(x*100)/100;
// IMPORTANT: in createVehicle.tick(enabled=false) the game actively applies
// wheel brakes, not neutral coasting. Thus motor=false here is a BRAKING
// reference, motor=true is the actual always-throttle player condition.
export function probeGrass({type=3,motor=false,sideKmh=40,forwardKmh=0,seconds=3}={}){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(650,.1,650).setTranslation(0,-.1,0));
  const car=createVehicle(world,{surfaceAt:()=>type});
  try{
    car.reset({x:0,y:1,z:0});
    for(let i=0;i<120;i++){car.tick(dt,{},false);world.step();}
    car.body.setLinvel({x:sideKmh/kmh,y:0,z:-forwardKmh/kmh},true);
    const records=[];
    for(let i=0;i<=Math.round(seconds/dt);i++){
      if(i%30===0){
        const s=car.snapshot(),v=car.body.linvel();
        records.push({seconds:round(i*dt),actualGroundKmh:round(Math.hypot(v.x,v.z)*kmh),
          sideXKmh:round(v.x*kmh),bodyLateralKmh:round(s.lateralSpeed*kmh),
          bodySlipDegrees:round(s.bodySlipAngle*180/Math.PI),
          groundX:round(s.position.x),groundZ:round(s.position.z),
          yawDegreesPerSecond:round(s.yawRate*180/Math.PI),
          wheelContacts:s.wheels.filter(w=>w.contact).length,
          totalLateralImpulseNs:round(s.wheels.reduce((a,w)=>a+Math.abs(w.sideImpulse),0)),
          avgNormalLoadN:round(s.wheels.reduce((a,w)=>a+w.load,0)/4)});
      }
      if(i<Math.round(seconds/dt)){car.tick(dt,{},motor);world.step();}
    }
    const at=t=>records.find(x=>x.seconds===t);
    return {type,grip:SURFACE_GRIP[type],motor,brakesAppliedByDisabledTick:!motor,seed:{sideKmh,forwardKmh},
      groundAt1:at(1).actualGroundKmh,sideAt1:at(1).sideXKmh,
      groundAt2:at(2).actualGroundKmh,sideAt2:at(2).sideXKmh,
      final:records.at(-1),records};
  }finally{world.free();}
}
export function runGrassComparison(){
  return {name:'v0.4.6W offroad 40kmh sideways: automatic throttle vs BRAKING-disabled tick',
    scenarios:[0,1,2,3].map(type=>probeGrass({type,motor:false}))
      .concat([0,3].map(type=>probeGrass({type,motor:true}))),
    note:'motor=false invokes game tick(enabled=false) and DOES APPLY BRAKES; these are NOT neutral coasting trials. motor=true represents actual automatic throttle. Grass must remain slower than compact. 40kmh initial lateral velocity is a fixture, not wheel-speed HUD.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(runGrassComparison(),null,2));
