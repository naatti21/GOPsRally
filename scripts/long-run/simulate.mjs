import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {gzipSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
import {environment} from './environments.mjs';
import {pulseInput,chicaneInput,digitalDriver} from './driver.mjs';
import {summarize} from './metrics.mjs';
import {hash} from './versions.mjs';
import {makeLaps} from '../../v04/src/game/laps.js';
import {wrap} from './road.mjs';
await RAPIER.init();
const DT=1/60, DEG=180/Math.PI;
export function simulate(factory,scenario,{traceFile}={}) {
  const env=environment(scenario.environment),world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=DT;
  if(env.data)world.createCollider(RAPIER.ColliderDesc.trimesh(env.data.positions,env.data.indices));
  else world.createCollider(RAPIER.ColliderDesc.cuboid(20000,.1,20000).setTranslation(0,-.1,0));
  const car=factory.createVehicle(world,{surfaceAt:scenario.surfaceType===undefined?env.surfaceAt:()=>scenario.surfaceType}),rows=[];
  const start=scenario.mode==='driver'?env.road.at(env.track.length-4):{x:0,y:0,z:0,tx:0,tz:-1};
  const yaw=Math.atan2(-start.tx,-start.tz);
  car.reset({x:start.x,y:(env.sample(start.x,start.z)?.height??0)+1,z:start.z},yaw);
  const laps=makeLaps(env.track);
  const driver=digitalDriver(env.road,{delay:scenario.delay??.2,period:scenario.period??.2,maxSpeed:scenario.speed/3.6,brakeMode:scenario.brakeMode,lineOffset:scenario.lineOffset??0});
  try {
    for(let i=0;i<120;i++){car.tick(DT,{},false);world.step();}
    car.body.setLinvel({x:start.tx*scenario.speed/3.6,y:0,z:start.tz*scenario.speed/3.6},true);
    // Fail loudly if a future driver/factory starts correcting state during a run.
    for(const method of ['setTranslation','setRotation','setLinvel','setAngvel','setNextKinematicTranslation','setNextKinematicRotation'])
      car.body[method]=()=>{throw Error(`Forbidden during-run state write: ${method}`);};
    let previous={...car.body.linvel()};
    for(let i=0;i<Math.round(scenario.duration/DT);i++){
      const t=i*DT,before=car.snapshot(),f0=new Vector3(0,0,-1).applyQuaternion(before.rotation);
      const input=scenario.mode==='driver'?driver(t,{x:before.position.x,z:before.position.z,speed:Math.hypot(car.body.linvel().x,car.body.linvel().z),heading:Math.atan2(f0.x,-f0.z)}):scenario.mode==='chicane'?chicaneInput(t):pulseInput(t,scenario);
      car.tick(DT,input,true);world.step();
      const s=car.snapshot(),v=car.body.linvel(),f=new Vector3(0,0,-1).applyQuaternion(s.rotation),right=new Vector3(1,0,0).applyQuaternion(s.rotation);
      const speed=Math.hypot(v.x,v.z),heading=Math.atan2(f.x,-f.z),course=Math.atan2(v.x,-v.z),beta=speed>.5?wrap(course-heading)*DEG:0;
      const wheels=s.wheels.map((w,j)=>{
        const wp=new Vector3(...factory.WHEELS[j]);wp.y-=w.length;wp.applyQuaternion(s.rotation).add(s.position);
        const side=w.sideImpulse??car.controller.wheelSideImpulse(j),forward=w.forwardImpulse??car.controller.wheelForwardImpulse(j);
        const load=Math.max(0,Math.min(car.controller.wheelMaxSuspensionForce(j),car.controller.wheelSuspensionForce(j)));
        const budget=w.tireLimit??(car.controller.wheelSuspensionForce(j)*car.controller.wheelFrictionSlip(j));
        return {...w,x:wp.x,y:wp.y,z:wp.z,load,rawLoad:car.controller.wheelSuspensionForce(j),
          sideForce:side/DT,forwardForce:forward/DT,slipAngle:w.slipAngle??null,
          saturation:budget>0?(w.tireLimit!==undefined?Math.hypot(side,forward)/DT:Math.hypot(side,.5*forward)/DT)/budget:0,
          margin:env.track.roadHalf-(scenario.environment==='open'?Math.abs(wp.x):env.road.nearest(wp.x,wp.z).distance)};
      });
      const ay=((v.x-previous.x)*right.x+(v.z-previous.z)*right.z)/DT;previous={...v};
      laps.update(s.position,DT);
      rows.push({t:(i+1)*DT,left:!!input.left,right:!!input.right,brake:!!input.brake,decision:!!input.decision,reason:input.reason??null,
        phase:input.brake?'brake':input.left?'left':input.right?'right':'release',
        x:s.position.x,y:s.position.y,z:s.position.z,rotation:s.rotation,velocity:{...v},speed,forwardSpeed:s.speed,lateralSpeed:s.lateralSpeed,
        heading:heading*DEG,course:course*DEG,beta,yaw:s.yawRate*DEG,ay,rack:s.rackAngle??s.steer,steeringControl:s.steeringControl??null,
        pitch:Math.asin(Math.max(-1,Math.min(1,f.y)))*DEG,roll:Math.asin(Math.max(-1,Math.min(1,right.y)))*DEG,
        margin:Math.min(...wheels.map(w=>w.margin)),station:env.road.nearest(s.position.x,s.position.z).s,inDomain:!!env.sample(s.position.x,s.position.z),wheels});
    }
    const summary={...summarize(rows),laps:laps.snapshot().laps,checkpointNext:laps.snapshot().next};
    const metadata={scenario,dt:DT,meshHash:env.meshHash,interventions:[{type:'spawn',position:start,yaw},{type:'settle',seconds:2,enabled:false},{type:'entry velocity',kmh:scenario.speed}],duringRunStateWrites:0,
      forceBudget:rows[0].wheels[0].tireLimit!==undefined?'custom circle':'native weighted ellipse; raw suspension budget',
      warning:'Forces/contact state are from pre-integration vehicle tick; pose is post-integration. No physical reset/recovery during run.'};
    if(traceFile){const bytes=Buffer.from([JSON.stringify(metadata),...rows.map(r=>JSON.stringify(r,(_k,v)=>typeof v==='number'?+v.toFixed(7):v))].join('\n')+'\n');const gz=gzipSync(bytes);writeFileSync(traceFile,gz);summary.traceSha256=hash(gz);summary.rawTraceSha256=hash(bytes);}
    return {summary,metadata,rows};
  }finally{world.free();}
}
