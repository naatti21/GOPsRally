// Bounded steering-joint assist for three-button driving. No route knowledge,
// chassis forces, pose writes or desired racing line enter this controller.
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const DIGITAL_STEERING = Object.freeze({
  initialAuthority: 0.45,
  sustainedAuthority: 1.25,
  buildStart: 0.3,
  buildSeconds: 0.8,
  slipGain: 0.7,
  yawSeconds: 0.22,
  maxFeedback: 0.4,
  maxAngle: 0.64,
  rackSeconds: 0.07,
});
export function digitalSteering(previous, {input, forward, lateral, yaw, dt}) {
  if (![previous.hold, previous.direction, previous.rack, input, forward, lateral, yaw, dt].every(Number.isFinite) || dt <= 0 || dt > .1)
    throw Error('Invalid digital steering state');
  const direction = Math.sign(input);
  const hold = direction === 0 ? 0 : direction === previous.direction ? previous.hold + dt : dt;
  // Reverse/parking keeps the original direct steering convention. Actual
  // ground speed cannot be disguised by a collapsing forward projection.
  const ground = Math.hypot(forward, lateral);
  const fade = clamp((forward - 3) / 9, 0, 1);
  const t = clamp((hold - DIGITAL_STEERING.buildStart) / DIGITAL_STEERING.buildSeconds, 0, 1);
  const authority = DIGITAL_STEERING.initialAuthority +
    (DIGITAL_STEERING.sustainedAuthority - DIGITAL_STEERING.initialAuthority) * t * t * (3 - 2*t);
  const base = .64 / (1 + ground / 33);
  const beta = Math.atan2(lateral, Math.max(2.5, Math.abs(forward)));
  // Positive rack turns right; positive physical yaw turns left. Sideslip
  // aligns the wheel with local travel; yaw feedback opposes excess rotation.
  const feedback = clamp(DIGITAL_STEERING.slipGain*beta + DIGITAL_STEERING.yawSeconds*yaw,
    -DIGITAL_STEERING.maxFeedback, DIGITAL_STEERING.maxFeedback);
  const target = clamp(direction*base*(1-fade*(1-authority)) + fade*feedback,
    -DIGITAL_STEERING.maxAngle, DIGITAL_STEERING.maxAngle);
  const rack = previous.rack + (target-previous.rack)*(1-Math.exp(-dt/DIGITAL_STEERING.rackSeconds));
  return {direction, hold, rack, target, feedback:fade*feedback, authority};
}
