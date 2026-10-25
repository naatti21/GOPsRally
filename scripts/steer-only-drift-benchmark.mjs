/**
 * Steer-only arcades: induced slide must arise from REAL tire impulse limits,
 * not seed angle, hidden handbrake, direct yaw torque or keyframe rotation.
 * Each row replays a fresh identical Rapier vehicle fixture.
 */
import { runSlideTrial } from './physics-line-lab.mjs';
import { pathToFileURL } from 'node:url';
const speeds=[19.5,27.8,35]; // 70, 100, 126 km/h.
const pulses=[0.35,0.65,0.95];
const round=n=>+n.toFixed(1);
export function benchmarkSteerOnly(){
  const all=[];
  for(const speedMps of speeds)for(const turnSeconds of pulses) {
    const noCounter=runSlideTrial({speedMps,turnSeconds,
      countersteerDelaySeconds:10,durationSeconds:3.5});
    const corrections=[0.12,0.35,0.65].map(delay=>{
      const x=runSlideTrial({speedMps,turnSeconds,
        countersteerDelaySeconds:delay,countersteerSeconds:1.15,durationSeconds:3.5});
      return {delaySeconds:delay,peakSlipDegrees:x.maxBodySlipDegrees,
        maxDifferenceFromNoCounterMeters:round(Math.abs(noCounter.netLateralMeters)-
          Math.abs(x.netLateralMeters)),
        finalSlipDegrees:x.finalSlipDegrees,lateralMeters:x.netLateralMeters,
        slideWasInitiated:x.hadBreakaway};
    });
    all.push({speedKmh:round(speedMps*3.6),turnSeconds,
      peakSteerOnlySlipDegrees:noCounter.maxBodySlipDegrees,
      slideWasInitiated:noCounter.hadBreakaway,
      noCounterLateralMeters:noCounter.netLateralMeters,
      corrections});
  }
  return {name:'GOPs Rally steering-only breakaway sweep',
    throttle:'automatic',brakeInTurn:false,artificialSlipSeed:false,
    thresholdDegrees:8,results:all,
    note:'A 3.5s right-input pulse may be unnatural on a real bend. These are repeatable flat-ground impulse-budget fixtures, NOT a human judgement of feeling.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(benchmarkSteerOnly(),null,2));
