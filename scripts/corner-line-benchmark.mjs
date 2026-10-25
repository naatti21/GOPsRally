/**
 * Same corner, same Rapier chassis and starting conditions: compare *measured*
 * racing line outcomes. NO extra yaw torque, racing-line magnet or teleports.
 * Virtual driver is limited to digital left/right and approach-only braking.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { pathToFileURL } from 'node:url';
const {createVehicle,WHEELS}=process.env.RALLY_VEHICLE_MODULE?await import(pathToFileURL(process.env.RALLY_VEHICLE_MODULE)):await import('../v04/src/physics/vehicle.js');
import { Vector3, Quaternion } from 'three';
import { drawDriver } from '../v04/src/testing/line-lab.js';
import { LINE_IDS, makeCornerLine, nearestRoad } from '../v04/src/testing/racing-line.js';
await RAPIER.init();
const DT=1/60, round=(n,p=2)=>+n.toFixed(p);
export function runCornerTrial({lineId='center',initialSpeedKmh=83,maxSeconds=24,approachSpeedFactor=1,lookAheadSeconds=.5,maxLookAhead=24,entrySteerSeconds=0}={}) {
  if(!Number.isFinite(initialSpeedKmh)||initialSpeedKmh<15||initialSpeedKmh>170||
    !Number.isFinite(maxSeconds)||maxSeconds<3||maxSeconds>60||!Number.isFinite(approachSpeedFactor)||approachSpeedFactor<.3||approachSpeedFactor>1.5)throw Error('Invalid benchmark settings');
  if(!Number.isFinite(entrySteerSeconds)||entrySteerSeconds<0||entrySteerSeconds>3)throw Error('Invalid steering entry');
  const course=makeCornerLine(lineId),points=course.path.samples;
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  world.createCollider(RAPIER.ColliderDesc.cuboid(350,0.1,350)
    .setTranslation(0,-0.1,-30));
  const car=createVehicle(world,{
    surfaceAt:(x,z)=>nearestRoad(course.center,x,z).distance<=course.roadHalf?0:3
  }),driver=drawDriver({...course.path,samples:course.path.samples.map(p=>({...p,speedMps:p.speedMps*approachSpeedFactor}))},{lookAheadSeconds,maxLookAhead});
  // Road boundaries count WHEEL CENTRES, not just the chassis COM.
  // A car whose body centre is 14cm from the edge is not safely on track.
  const q=new Quaternion(),offset=new Vector3();
  const wheelRoadOffsets=(snapshot)=>{
    q.copy(snapshot.rotation);
    return WHEELS.map(([x,y,z])=>{
      offset.set(x,y,z).applyQuaternion(q);
      return nearestRoad(course.center,
        snapshot.position.x+offset.x,snapshot.position.z+offset.z).distance;
    });
  };
  car.reset({x:0,y:1,z:75},0);
  try {
    for(let i=0;i<120;i++){car.tick(DT,{},false);world.step();}
    const speed=initialSpeedKmh/3.6;
    car.body.setLinvel({x:0,y:0,z:-speed},true);
    let maxRoadOffset=0,maxLineError=0,squared=0,offRoadFrames=0,insideSteerFrames=0;
    let count=0,brakeApproach=0,brakeInCorner=0,maxSlip=0,maxYaw=0;
    let maxWheelRoadOffset=0,wheelOffRoadFrames=0;
    let finished=false,exitSpeed=0,time=0,exitOffset=0,cornerEntrySpeed=0;
    const initial=car.snapshot();
    let lastS=0,entered=false,actualBrake=false,entryTime=null,moderateFrames=0,cornerFrames=0,cleanCornerFrames=0;
    for(let frame=0;frame<Math.round(maxSeconds/DT);frame++){
      const state=car.snapshot(),road=nearestRoad(course.center,state.position.x,state.position.z);
      const requested=driver.read(state);
      const beforeTurn=road.s<course.arcStart-4;
      const input={left:requested.left,right:requested.right,
        brake:beforeTurn&&requested.brake};
      if(road.s>=course.arcStart&&entryTime===null)entryTime=frame*DT;
      if(entryTime!==null&&frame*DT-entryTime<entrySteerSeconds){input.right=true;input.left=false;}
      if(input.brake){brakeApproach++;actualBrake=true;}
      if(!beforeTurn && input.brake)brakeInCorner++;
      if(!entered && road.s>=course.arcStart){
        entered=true;cornerEntrySpeed=Math.abs(state.speed)*3.6;
      }
      if(road.s>=course.arcStart && road.s<=course.arcEnd && (input.left||input.right))
        insideSteerFrames++;
      car.tick(DT,input,true);world.step();
      const next=car.snapshot(),offset=nearestRoad(course.center,next.position.x,next.position.z);
      // Signed road error is computed independently of the planned racing line.
      // Driver.lineError is nearest planned-line error sampled by the controller.
      squared+=requested.lineError**2;maxLineError=Math.max(maxLineError,requested.lineError);
      maxRoadOffset=Math.max(maxRoadOffset,offset.distance);
      const wheels=wheelRoadOffsets(next);
      maxWheelRoadOffset=Math.max(maxWheelRoadOffset,...wheels);
      if(offset.distance>course.roadHalf)offRoadFrames++;
      if(wheels.some(v=>v>course.roadHalf))wheelOffRoadFrames++;
      maxSlip=Math.max(maxSlip,Math.abs(next.bodySlipAngle));
      maxYaw=Math.max(maxYaw,Math.abs(next.yawRate));
      if(Math.abs(next.bodySlipAngle)>=6*Math.PI/180&&Math.abs(next.bodySlipAngle)<=18*Math.PI/180)moderateFrames++;
      if(offset.s>=course.arcStart&&offset.s<=course.arcEnd){cornerFrames++;if(Math.abs(next.bodySlipAngle)<6*Math.PI/180)cleanCornerFrames++;}
      count++;time=(frame+1)*DT;
      if(state.position.x<course.finish.x && next.position.x>=course.finish.x &&
        next.position.x>state.position.x){
        finished=true;exitOffset=offset.distance;exitSpeed=Math.abs(next.speed)*3.6;break;
      }
      lastS=offset.s;
    }
    return {lineId,initialSpeedKmh,approachSpeedFactor,lookAheadSeconds,maxLookAhead,entrySteerSeconds,moderateSlipSeconds:round(moderateFrames*DT),cleanCornerFraction:round(cleanCornerFrames/Math.max(1,cornerFrames)),plannedLengthMeters:round(course.path.length),
      maxPlannedOffsetMeters:round(course.maxPlannedOffsetMeters),
      elapsedSeconds:round(time),finishCrossed:finished,
      validFinish:finished&&exitOffset<=course.roadHalf&&wheelOffRoadFrames===0,
      offRoadSeconds:round(offRoadFrames*DT),
      wheelOffRoadSeconds:round(wheelOffRoadFrames*DT),
      maxRoadOffsetMeters:round(maxRoadOffset),
      maxWheelRoadOffsetMeters:round(maxWheelRoadOffset),
      trackMarginMeters:round(course.roadHalf-maxWheelRoadOffset),
      rmsLineErrorMeters:round(Math.sqrt(squared/count)),
      maxLineErrorMeters:round(maxLineError),
      maxBodySlipDegrees:round(maxSlip*180/Math.PI,1),
      maxYawDegreesPerSecond:round(maxYaw*180/Math.PI,1),
      enteredCorner:entered,cornerEntryKmh:round(cornerEntrySpeed,1),
      exitKmh:round(exitSpeed,1),brakeApproachFrames:brakeApproach,
      brakeInCornerFrames:brakeInCorner,steeringInCornerFrames:insideSteerFrames};
  }finally{world.free();}
}
export function runCornerComparison({initialSpeedKmh=83,maxSeconds=24}={}){
  const laps=LINE_IDS.map(lineId=>runCornerTrial({lineId,initialSpeedKmh,maxSeconds}));
  const validRanking=laps.filter(x=>x.validFinish).sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds)
    .map(x=>({lineId:x.lineId,elapsedSeconds:x.elapsedSeconds,exitKmh:x.exitKmh}));
  return {question:'Which line delivers the fastest VALID 90-degree turn using this exact car and digital driver?',
    geometry:'Common 90 degree right, 13m road, 35m centerline radius; flat ground for isolated physics.',
    startingSpeedKmh:initialSpeedKmh,laps,validRanking,
    fastestLegal:validRanking[0]?.lineId??null,
    rejectedCuts:laps.filter(x=>!x.validFinish).map(x=>x.lineId),
    limitation:'Heuristic preset lines, NOT proof of optimality. Physical wheel locations define track cuts, off-road gets grass grip. Virtual bang-bang driver and preset speeds may dominate. Results cannot substitute human play.'};
}
export function runDrivingStyleComparison(){return [0,.35,1.2].map((entrySteerSeconds,i)=>({intent:['line-following / clean attempt','moderate drift attempt','excessive steering'][i],...runCornerTrial({entrySteerSeconds})}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify({
    normal:runCornerComparison(),
    higherEntry:runCornerComparison({initialSpeedKmh:110}),
    drivingStyles:runDrivingStyleComparison()
  },null,2));
}
