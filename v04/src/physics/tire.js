// Small, deterministic tire-response contract. Rapier owns the wheel raycast,
// springs, drive and braking; this module supplies a bounded lateral grip curve.
// The curve is deliberately arcade-tuned, not a Pacejka tire identification.
export const SURFACE_GRIP = Object.freeze([1, 0.79, 0.64, 0.43]);
export const AXLE_GRIP = Object.freeze({ front: 1.0, rear: 0.78 });

export function tireGrip(slipAngle, groundSpeed, surfaceType, rear = false) {
  const surface = SURFACE_GRIP[surfaceType] ?? SURFACE_GRIP[3];
  if (!Number.isFinite(slipAngle) || !Number.isFinite(groundSpeed)) return 0;
  // Larger lateral slip means a progressively smaller recoverable contact
  // force. Rear tires break away sooner, making countersteering meaningful.
  const threshold = rear ? 0.075 : 0.16;
  const width = rear ? 0.27 : 0.42;
  const excess = Math.min(1, Math.max(0, (Math.abs(slipAngle) - threshold) / width));
  const smooth = excess * excess * (3 - 2 * excess);
  const fade = Math.min(1, Math.max(0, Math.abs(groundSpeed) / 8));
  const loss = (rear ? 0.72 : 0.35) * smooth * fade;
  return surface * (rear ? AXLE_GRIP.rear : AXLE_GRIP.front) * (1 - loss);
}

export function velocityAtWheel(linear, angular, offset) {
  // v(point) = v(center of mass) + angular velocity cross offset.
  return {
    x: linear.x + angular.y * offset.z - angular.z * offset.y,
    y: linear.y + angular.z * offset.x - angular.x * offset.z,
    z: linear.z + angular.x * offset.y - angular.y * offset.x,
  };
}

export function measuredSlip(lateralVelocity, longitudinalVelocity) {
  if (!Number.isFinite(lateralVelocity) || !Number.isFinite(longitudinalVelocity)) return 0;
  // Low-speed regularization stops the tires from randomly snapping into slide
  // while the player waits on the start line.
  return Math.atan2(lateralVelocity, Math.max(2.5, Math.abs(longitudinalVelocity)));
}

/**
 * Digital LEFT/RIGHT should not become powerless at high speed.
 * Countersteer receives extra physical wheel angle when its direction
 * follows lateral velocity, never an injected yaw/rotation.
 */
export function responsiveSteering(input, speedMps, bodySlipAngle = 0) {
  if (![input, speedMps, bodySlipAngle].every(Number.isFinite)) return 0;
  const direction = Math.max(-1, Math.min(1, input));
  const base = 0.64 / (1 + Math.abs(speedMps) / 36);
  const isCatch = direction !== 0 &&
    Math.sign(direction) === Math.sign(bodySlipAngle) &&
    Math.abs(bodySlipAngle) > 0.09;
  const bonus = isCatch ? Math.min(0.26, (Math.abs(bodySlipAngle) - 0.09) * 0.9) : 0;
  return direction * Math.min(0.78, base * (1 + bonus));
}

/**
 * Soft arcade-side cornering response. Rapier's direct per-wheel friction
 * impulse CAP remains untouched; decouple lateral response from wheel engine
 * and braking to avoid a grip-on/grip-off bifurcation under sustained steering.
 *
 * More lateral demand reduces the *linear* rear aligning response. This uses
 * only physical wheel impulses; no injected yaw or pose correction.
 */
export function rearCorneringStiffnessScale(speedMps, yawRate, steer, bodySlipAngle) {
  if (![speedMps,yawRate,steer,bodySlipAngle].every(Number.isFinite)) return 1;
  const speed=Math.abs(speedMps);
  if(speed<12 || (Math.abs(steer)<0.04&&Math.abs(bodySlipAngle)<0.055)) return 1;
  const geometricG=(speed*speed*Math.tan(Math.min(0.6,Math.abs(steer)))/2.6)/9.81;
  const actualG=Math.abs(speed*yawRate)/9.81;
  const demand=Math.max(actualG,geometricG*0.11);
  const x=Math.min(1,Math.max(0,(demand-0.50)/1.4));
  const eased=x*x*(3-2*x);
  const speedFade=Math.min(1,Math.max(0,(speed-12)/18));
  const recovery=Math.abs(steer)>0.04&&Math.abs(yawRate)>0.15&&
    Math.abs(bodySlipAngle)>0.07&&Math.sign(steer)===Math.sign(yawRate);
  return 1-(recovery ? 0.06 : 0.50)*eased*speedFade;
}
