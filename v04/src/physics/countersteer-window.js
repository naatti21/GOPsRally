/**
 * Experimental, deliberately narrow three-button countersteering limiter.
 *
 * Keeps the v0.4.6 steering curve fully unchanged for ordinary LEFT/RIGHT
 * input. Only at the BEGINNING of a new opposing button press, when the car
 * already has real yaw AND same-signed body slip, may the recovery command be
 * capped. The cap stays for that one physical key/pointer hold (even when
 * yaw crosses zero), then fully releases. No road knowledge or chassis forces.
 *
 * This is a prototype hypothesis, NOT an accepted release steering model.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const CATCH_TUNE=Object.freeze({
  minSpeedMps:12,
  minSlipRadians:0.075,   // 4.3 degrees
  minYawRadiansPerSecond:0.16, // 9.2 degrees/second
  rackCapRadians:0.155,
});
export const emptyCatchState=()=>({direction:0,latched:false});
export function gateCountersteer(previous,{button,baseAngle,forward,lateral,yaw}) {
  if(![button,baseAngle,forward,lateral,yaw].every(Number.isFinite))throw Error('Invalid steering signals');
  const direction=Math.sign(button);
  const changed=direction!==previous.direction;
  const groundSpeed=Math.hypot(forward,lateral);
  const beta=Math.atan2(lateral,Math.max(2.5,Math.abs(forward)));
  // Our vehicle convention: negative yaw = turning RIGHT.  Negative button
  // steers LEFT, therefore a yaw-matching command opposes body rotation.
  const trulyOpposite=direction!==0 &&
    direction===Math.sign(yaw) &&
    direction===Math.sign(beta) &&
    Math.sign(baseAngle)===direction;
  const qualifying=groundSpeed>=CATCH_TUNE.minSpeedMps &&
    Math.abs(beta)>=CATCH_TUNE.minSlipRadians &&
    Math.abs(yaw)>=CATCH_TUNE.minYawRadiansPerSecond;
  const latched=direction===0?false:
    changed?(trulyOpposite&&qualifying):Boolean(previous.latched);
  const limited=latched
    ?Math.sign(baseAngle)*Math.min(Math.abs(baseAngle),CATCH_TUNE.rackCapRadians)
    :baseAngle;
  return {direction,latched,baseAngle,limited,slip:beta};
}
