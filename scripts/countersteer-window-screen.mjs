/**
 * A narrow, reproducible gate: did selective countersteer authority preserve
 * entry drift AND avoid mid-corner/later long-run failure? No claimed PASS
 * unless all independent unit + real-course benchmarks agree.
 */
import {pathToFileURL} from 'node:url';
import * as factory from '../v04/src/physics/vehicle.js';
import {simulate} from './long-run/simulate.mjs';
function traceFirst(rows,predicate) {
 const at=rows.findIndex(predicate);
 if(at<0)return null;
 const r=rows[at];
 return {time:+r.t.toFixed(3),station:+r.station.toFixed(1),
   roadMarginMeters:+r.margin.toFixed(2),speedKmh:+(r.speed*3.6).toFixed(1),
   sideslipDegrees:+r.beta.toFixed(1),yawDegreesPerSecond:+r.yaw.toFixed(1),
   steering:{left:r.left,right:r.right,brake:r.brake,rackRadians:+r.rack.toFixed(3)},
   driverDecision:r.reason};
}
export function runCountersteerWindowScreen(){
 const runs=[];
 for(const speed of [70,100,126])for(const hold of [.2,.3,.4]){
   const scenario={environment:'open',mode:'pulse',speed,pulse:.65,delay:.3,hold,duration:6};
   const {summary:s,rows}=simulate(factory,scenario);
   runs.push({id:`pulse-${speed}-${hold}`,summary:{
     peakTrueSlipDegrees:+s.peakSlip.toFixed(2),
     peakYawDegreesPerSecond:+s.peakYaw.toFixed(2),
     longestModerateSlipSeconds:+s.longestModerateSeconds.toFixed(2),
     finalAbsSlipDegrees:+s.finalAbsSlip.toFixed(2),
     spinouts:s.spinouts,
     lateralDisplacementMeters:+s.finalX.toFixed(2)},
     firstSpin:traceFirst(rows,r=>Math.abs(r.beta)>60&&r.speed>5)});
 }
 for(const mode of ['speed-plan','pre-corner']){
   const scenario={environment:'real-full',mode:'driver',speed:100,
     duration:mode==='speed-plan'?150:180,delay:.2,period:.2,brakeMode:mode};
   const {summary:s,rows}=simulate(factory,scenario);
   runs.push({id:`real-${mode}`,summary:{
     spinouts:s.spinouts,offRoadSeconds:+s.offRoadSeconds.toFixed(2),
     roadLaps:s.laps.length,meanSpeedKmh:+s.meanKmh.toFixed(2),
     peakSlipDegrees:+s.peakSlip.toFixed(2),
     oscillationCycles:s.oscillationCycles},
     firstWheelExit:traceFirst(rows,r=>r.margin<0),
     firstSevereSlide:traceFirst(rows,r=>Math.abs(r.beta)>60&&r.speed>5)});
 }
 return {label:'selective opposite-input protection (research, NOT release)',
  baseline:'v0.4.6 from PR #18; source branch has unchanged tires/engine/camera',
  safeguards:'do not accept unless initial drift, 200-400ms correction, and BOTH real course runs improve together',
  runs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 console.log(JSON.stringify(runCountersteerWindowScreen(),null,2));
