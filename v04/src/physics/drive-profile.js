// Tune engine response independently from the slip/contact model.
// v0.4.5's 6500 N × (1 - v/62) leaves mid-speed acceleration sluggish.
// All forces remain applied via grounded tire contact/friction budgets.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function availableEngineForce(speedMps, reversing=false,peakNewtons=9000) {
  if (![speedMps,peakNewtons].every(Number.isFinite) || peakNewtons<0) return 0;
  const speed=Math.abs(speedMps);
  if(reversing) return Math.max(0,peakNewtons*0.42*(1-speed/8));
  const t=clamp(speed/60,0,1);
  return peakNewtons*(1-Math.pow(t,1.35));
}
export function wheelDriveForce(engineNewtons,wheelIndex,rearShare=0.6) {
  if(!Number.isFinite(engineNewtons)||!Number.isFinite(rearShare)||
     rearShare<0||rearShare>1||!Number.isInteger(wheelIndex)||wheelIndex<0||wheelIndex>3)
    throw Error('Invalid drive distribution');
  return engineNewtons*(wheelIndex<2?(1-rearShare)/2:rearShare/2);
}

/**
 * Automatic throttle can back off modestly under actual cornering load,
 * like a simplified traction-control/torque-distribution system.
 * This does not steer the car or insert yaw; all force is still limited by
 * grounded tire load and shared longitudinal/lateral friction circle.
 */
export function cornerDriveManagement(steeringAngle,bodySlipAngle) {
  if(!Number.isFinite(steeringAngle)||!Number.isFinite(bodySlipAngle))
    return {throttleScale:1,rearShare:0.6};
  const lock=clamp(Math.abs(steeringAngle)/0.38,0,1);
  const slip=clamp((Math.abs(bodySlipAngle)-0.08)/0.2,0,1);
  return {
    throttleScale:1-0.20*lock*lock-0.12*slip,
    rearShare:0.6-0.085*lock,
  };
}
