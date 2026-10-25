// Historical v0.4.4 native-stiffness curve (tireGrip), retained for baseline
// regression comparisons. v0.4.5 applies forces in contact-tire.js instead.
// The slip, point-velocity and steering helpers below remain shared production code.
// Off-road remains slower/looser than compact gravel, but grass must not feel
// like ice: narrow the shoulder (0.64) -> grass drop from 0.21 to 0.06.
// A/B against the archived 0.43 baseline before approving any mobile release.
export const SURFACE_GRIP = Object.freeze([1, 0.79, 0.64, 0.58]);
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
  // Prevent excessive wheel angle at speed: when the tire has saturated,
  // more lock cannot create more side force, only delay smooth recovery.
  const base = 0.64 / (1 + Math.abs(speedMps) / 33);
  const isCatch = direction !== 0 &&
    Math.sign(direction) === Math.sign(bodySlipAngle) &&
    Math.abs(bodySlipAngle) > 0.09;
  const bonus = isCatch ? Math.min(0.26, (Math.abs(bodySlipAngle) - 0.09) * 0.9) : 0;
  return direction * Math.min(0.78, base * (1 + bonus));
}
