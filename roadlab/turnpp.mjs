// Grounded coefficients and update order from V11.1 TURN++.
export const SPEED_SCALE = .80;
const TARGET_MPS = 195/(3.6*SPEED_SCALE);
const AERO = (17-.015*TARGET_MPS)/(TARGET_MPS*TARGET_MPS);
const STEERING = {yawGain:2.22,yawResponse:31,steerResponse:58,yawMax:2.58,yawReserve:57,
  sideForce:39.2,damping:3.7,breakaway:.12,align:1};
const OFFROAD_FORCE = 13;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,k) => a+(b-a)*k;

export function stepTurnPP(state,input,dt,roadInfo,grip=1) {
  const {onRoad:road, grade, bank, curve, theta:roadHeading} = roadInfo;
  const tune = STEERING;
  const turn = Number(Boolean(input.right))-Number(Boolean(input.left));
  state.steer=lerp(state.steer,turn,1-Math.exp(-dt*tune.steerResponse));
  let {vx,vz}=state;
  let speed=Math.hypot(vx,vz);
  const speedAuthority=1-.18*clamp((speed-15)/35,0,1);
  const fOldX=Math.sin(state.theta), fOldZ=Math.cos(state.theta);
  const oldSide=vx*fOldZ-vz*fOldX, oldForward=vx*fOldX+vz*fOldZ;
  const oldSlip=Math.atan2(oldSide,Math.max(3,Math.abs(oldForward)));
  const correctiveYaw=tune.align*clamp(oldSlip,-.52,.52)*(1-.85*Math.abs(state.steer));
  const steerYaw=state.steer*(.96+.36*clamp(speed/25,0,1))
    *speedAuthority*clamp(speed/3,0,1)*(road?1:.82)*tune.yawGain;
  const capForce=road?tune.sideForce:OFFROAD_FORCE;
  const yawCap=road ? Math.min(tune.yawMax,.30+tune.yawReserve/Math.max(17,speed))
    : Math.min(1.9,.20+capForce/Math.max(17,speed));
  const targetYaw=clamp(steerYaw+correctiveYaw,-yawCap,yawCap);
  const countersteering=state.yawRate*state.steer<-.06;
  const yawResponse=speed<9?24:Math.abs(state.steer)<.05?7.2
    :countersteering?28:tune.yawResponse;
  // Zero grip preserves angular momentum. Gradual loading restores authority.
  state.yawRate=lerp(state.yawRate,targetYaw,1-Math.exp(-dt*yawResponse*grip));
  state.yawRate=clamp(state.yawRate,-tune.yawMax,tune.yawMax);
  const angle=state.theta+state.yawRate*dt;
  state.theta=Math.atan2(Math.sin(angle),Math.cos(angle));
  const fX=Math.sin(state.theta), fZ=Math.cos(state.theta), rX=fZ, rZ=-fX;
  const forward=vx*fX+vz*fZ, lateral=vx*rX+vz*rZ;
  const banking=road&&Math.sign(state.steer)===Math.sign(curve)?Math.abs(bank)*5.5:0;
  const slipAngle=Math.atan2(lateral,Math.max(3,Math.abs(forward)));
  const turnDemand=Math.abs(state.yawRate*forward);
  const overload=clamp((turnDemand-capForce*.85)/(capForce*.8),0,1);
  const sliding=clamp((Math.abs(slipAngle)-.13)/.42,0,1);
  const targetTraction=road?1-tune.breakaway*Math.max(overload,sliding):.76;
  const gripResponse=targetTraction<state.traction?3:2.2;
  state.traction=lerp(state.traction,targetTraction,1-Math.exp(-dt*gripResponse));
  const sideCap=(capForce*state.traction+(road?banking*.3:0))*grip;
  state.sideAccel=clamp(-lateral*(road?tune.damping:1.7),-sideCap,sideCap);
  vx+=state.sideAccel*rX*dt; vz+=state.sideAccel*rZ*dt;
  speed=Math.hypot(vx,vz);
  const goingForward=Math.cos(state.theta-roadHeading);
  const forwardSpeed=vx*fX+vz*fZ;
  // Keep the original operation order when the tyres carry full load.
  const drag=AERO*speed*speed*Math.sign(forwardSpeed||1);
  const gradeForce=grade*13*goingForward;
  const drive=input.brake?-32.3:17;
  const a=drive*grip-drag-gradeForce*grip;
  vx+=fX*a*dt; vz+=fZ*a*dt;
  if (!road) {
    const slow=Math.max(0,1-13*dt*grip/Math.max(.001,Math.hypot(vx,vz)));
    vx*=slow; vz*=slow;
  }
  if (input.brake&&grip>0) {
    const back=vx*fX+vz*fZ;
    if (back < -7) { vx+=(-7-back)*fX*grip; vz+=(-7-back)*fZ*grip; }
  }
  vx*=Math.exp(-dt*.015); vz*=Math.exp(-dt*.015);
  state.vx=vx; state.vz=vz;
  state.x+=vx*dt; state.z+=vz*dt;
  state.speed=Math.hypot(vx,vz);
  return state;
}
