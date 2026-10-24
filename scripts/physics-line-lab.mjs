/** Repeatable 60 Hz draw-line/Rapier test, not a new game mode. */
import RAPIER from '@dimforge/rapier3d-compat';
import { pathToFileURL } from 'node:url';
import { createVehicle } from '../v04/src/physics/vehicle.js';
import { compileSegments, drawDriver, PHYSICS_TEST_LINE } from '../v04/src/testing/line-lab.js';
const dt=1/60;
await RAPIER.init();
function rig(start={x:0,z:70}) {
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(350,0.1,650)
    .setTranslation(0,-0.1,-75));
  const car=createVehicle(world,{surfaceAt:()=>0});
  car.reset({x:start.x,y:1,z:start.z},0);
  for(let i=0;i<120;i++){car.tick(dt,{},false);world.step();}
  return {world,car};
}
const round=(n,places=2)=>+n.toFixed(places);
export function runLineTrial({speedFactor=1,durationSeconds=21}={}) {
  if(!Number.isFinite(speedFactor)||speedFactor<0.35||speedFactor>2)
    throw Error('Invalid speed factor');
  const segments=PHYSICS_TEST_LINE.map(s=>({points:s.points.map(p=>
    ({...p,speedKmh:p.speedKmh*speedFactor}))}));
  const path=compileSegments(segments),driver=drawDriver(path);
  const {world,car}=rig(path.samples[0]),records=[];
  try {
    const a=path.samples[0],v=Math.min(20,a.speedMps);
    // Start speed is an explicit test fixture. No pose or velocity rewriting in the run.
    car.body.setLinvel({x:a.tx*v,y:0,z:a.tz*v},true);
    for(let i=0;i<durationSeconds*60;i++) {
      const input=driver.read(car.snapshot());
      car.tick(dt,input,true);
      world.step();
      const state=car.snapshot();
      if(i%6===0||input.done){
        const lengths=state.wheels.map(w=>w.length);
        records.push({time:i*dt,progress:input.progress,error:input.lineError,
          finish:input.done,slip:state.bodySlipAngle,yaw:state.yawRate,
          spring:Math.max(...lengths)-Math.min(...lengths),
          speed:Math.abs(state.speed),left:input.left,right:input.right,brake:input.brake});
      }
      if(input.done)break;
    }
    const last=records.at(-1), rms=Math.sqrt(records.reduce((sum,p)=>sum+p.error*p.error,0)/records.length);
    return {seconds:round(last.time),progressMeters:round(last.progress),trackLengthMeters:round(path.length),
      finishReached:last.finish,rmsLineErrorMeters:round(rms),
      maxLineErrorMeters:round(Math.max(...records.map(p=>p.error))),
      maxBodySlipDegrees:round(180/Math.PI*Math.max(...records.map(p=>Math.abs(p.slip))),1),
      peakYawRateDegreesPerSecond:round(180/Math.PI*Math.max(...records.map(p=>Math.abs(p.yaw))),1),
      maxSuspensionLengthDeltaMeters:round(Math.max(...records.map(p=>p.spring)),3),
      countBrakeFrames:records.filter(p=>p.brake).length,
      countLeftFrames:records.filter(p=>p.left).length,
      countRightFrames:records.filter(p=>p.right).length,
      maxObservedSpeedKmh:round(3.6*Math.max(...records.map(p=>p.speed)),1)};
  }finally{world.free();}
}
export function runSlideTrial({speedMps=23,turnSeconds=0.46,
  countersteerDelaySeconds=0.2,countersteerSeconds=1.15,durationSeconds=3,
  seedSlipDegrees=0,seedYawRate=0}={}) {
  if(![speedMps,turnSeconds,countersteerDelaySeconds,countersteerSeconds,durationSeconds,seedSlipDegrees,seedYawRate]
    .every(Number.isFinite)||speedMps<3||speedMps>54||
    Math.min(turnSeconds,countersteerDelaySeconds,countersteerSeconds,durationSeconds)<0)
    throw Error('Invalid slide experiment');
  const {world,car}=rig(),rows=[];
  try {
    car.body.setLinvel({x:0,y:0,z:-speedMps},true);
    // Initialize the physical car with known yaw and slip BEFORE simulation;
    // never rewrite its pose, yaw or velocity while it is being controlled.
    if(seedSlipDegrees!==0 || seedYawRate!==0) {
      const yaw=-seedSlipDegrees*Math.PI/180;
      car.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
      car.body.setAngvel({x:0,y:seedYawRate,z:0},true);
    }
    for(let frame=0;frame<Math.round(durationSeconds*60);frame++){
      const t=frame*dt;
      const right=t<turnSeconds;
      const left=t>=turnSeconds+countersteerDelaySeconds &&
        t<turnSeconds+countersteerDelaySeconds+countersteerSeconds;
      car.tick(dt,{right,left},true);world.step();
      const s=car.snapshot();
      rows.push({yaw:s.yawRate,slip:s.bodySlipAngle,x:s.position.x,
        front:(s.wheels[0].sideGrip+s.wheels[1].sideGrip)/2,
        rear:(s.wheels[2].sideGrip+s.wheels[3].sideGrip)/2,
        contacts:s.wheels.filter(w=>w.contact).length});
    }
    const last=rows.at(-1),max=Math.max(...rows.map(r=>Math.abs(r.slip)));
    const mean=key=>rows.reduce((a,r)=>a+r[key],0)/rows.length;
    const hadBreakaway=max>8*Math.PI/180;
    const regainedControl=hadBreakaway &&
      Math.abs(last.slip)<Math.min(6*Math.PI/180,max*0.5) &&
      Math.abs(last.yaw)<0.4 && last.contacts>=2;
    const onset=rows[Math.min(rows.length-1,Math.round(turnSeconds*60))];
    return {countersteerDelaySeconds,seedSlipDegrees,seedYawRate,hadBreakaway,
      onsetSlipDegrees:round(180/Math.PI*Math.abs(onset.slip),1),
      maxBodySlipDegrees:round(180/Math.PI*max,1),
      finalSlipDegrees:round(180/Math.PI*Math.abs(last.slip),1),
      finalYawRateDegreesPerSecond:round(180/Math.PI*Math.abs(last.yaw),1),
      meanFrontGrip:round(mean('front'),3),meanRearGrip:round(mean('rear'),3),
      minimumWheelContacts:Math.min(...rows.map(r=>r.contacts)),
      netLateralMeters:round(last.x,1),
      regainedControl};
  }finally{world.free();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify({
    mode:'GOPs Rally Draw-line physics research (not player UI)',
    speedPlans:[0.65,1,1.35].map(speedFactor=>({speedFactor,...runLineTrial({speedFactor})})),
    steeringInduced:[0,0.15,0.35,0.6,1.2].map(countersteerDelaySeconds=>
      runSlideTrial({countersteerDelaySeconds})),
    seededSnapRecovery:[0,0.15,0.35,0.6,1.2,10].map(countersteerDelaySeconds=>
      runSlideTrial({countersteerDelaySeconds,seedSlipDegrees:18,seedYawRate:-0.55})),
    caveat:'Only a genuine 8+ degree breakaway qualifies as slide recovery. No artificial car motion after test initialization.'
  },null,2));
}
