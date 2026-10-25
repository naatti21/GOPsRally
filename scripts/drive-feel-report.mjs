/** Numbers that phone testers can compare against a fixed physical experiment.
 * Not a prediction of how many real rally corners will require drifting.
 */
import {measureStraight,runArcadeTrace} from './arcade-dynamics-benchmark.mjs';
import {runCornerTrial} from './corner-line-benchmark.mjs';
import {chaseFov} from '../v04/src/render/camera-response.js';
import {RACE} from '../v04/src/game/laps.js';
const straight=measureStraight();
const inputs=[0.35,0.65,0.95];
const turns=[70,100,126].flatMap(speedKmh=>inputs.map(pulse=>{
 const s=runArcadeTrace({speedKmh,pulse});
 return {speedKmh,pulseSeconds:pulse,peakSlipDegrees:s.summary.peakSlip,
   moderateSlipSeconds:s.summary.longestModerateSeconds,
   exitKmh:s.summary.exitKmh,unfoldedMaxDegrees:s.summary.peakUnfoldedSlip,
   finalYawDegreesPerSecond:s.summary.finalYaw};
}));
const corners=[0.7,0.8,0.9,1].map(approachSpeedFactor=>runCornerTrial({
  lineId:'center',initialSpeedKmh:83,approachSpeedFactor
}));
const corner=corners.at(-1);
const out={
 physicsVersion:RACE.physics_version,
 measured0to100Seconds:straight.find(x=>x.mode==='0–100 km/h')?.seconds,
 stopFrom100Meters:straight.find(x=>x.mode.startsWith('100 km/h'))?.distanceMeters,
 chaseCameraDegrees:{at60:chaseFov(60/3.6),at100:chaseFov(100/3.6),at140:chaseFov(140/3.6)},
 steerOnlyNoBrake:turns,
 approachOnlyCornerSpeedPlans:corners.map(c=>({speedFactor:c.approachSpeedFactor,
   validFinish:c.validFinish,entryKmh:c.cornerEntryKmh,exitKmh:c.exitKmh,
   wheelOffRoadSeconds:c.wheelOffRoadSeconds,peakSlipDegrees:c.maxBodySlipDegrees,
   timeSeconds:c.elapsedSeconds,brakeInCornerFrames:c.brakeInCornerFrames})),
 legal90degreeCorner:{elapsedSeconds:corner.elapsedSeconds,validFinish:corner.validFinish,
   peakSlipDegrees:corner.maxBodySlipDegrees,exitKmh:corner.exitKmh,
   wheelOffRoadSeconds:corner.wheelOffRoadSeconds,brakeInCornerFrames:corner.brakeInCornerFrames},
 caveat:'Flat scripted pulses and a synthetic 90 degree corner do not establish the feel on the real course. Compare on Android. No scripted yaw/line rescue.'
};
console.log(JSON.stringify(out,null,2));
