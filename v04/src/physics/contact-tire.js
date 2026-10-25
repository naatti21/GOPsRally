// A smooth, dissipative brush approximation; normalized load limits BOTH axes.
// No road direction, drift mode, yaw torque or reference racing line enters it.
export const CONTACT_TUNE = Object.freeze({
  mu: 1.05,
  frontSlope: 0.16,
  rearSlope: 0.14,
  frontLoss: 0.06,
  rearLoss: 0.14,
  relaxationLength: 0.8,
});
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function lateralResponse(angle, rear = false) {
  const a = Math.abs(angle),
    peak = rear ? 0.22 : 0.28;
  const fade = (a * a) / (a * a + peak * peak);
  const retention =
    1 - (rear ? CONTACT_TUNE.rearLoss : CONTACT_TUNE.frontLoss) * fade;
  return {
    response:
      Math.tanh(
        angle / (rear ? CONTACT_TUNE.rearSlope : CONTACT_TUNE.frontSlope),
      ) * retention,
    retention,
  };
}
export function contactForces({
  angle,
  lateral,
  longitudinal,
  load,
  grip = 1,
  rear = false,
  drive = 0,
  brake = 0,
  dt = 1 / 60,
  mass = 1200,
}) {
  if (
    ![angle, lateral, longitudinal, load, grip, drive, brake, dt, mass].every(
      Number.isFinite,
    ) ||
    dt <= 0 ||
    mass <= 0 ||
    load <= 0
  )
    return { longitudinal: 0, lateral: 0, limit: 0, retention: 1 };
  // Mild tire load sensitivity makes outside-wheel loading matter without inventing extra grip.
  const sensitivity = clamp(
    Math.pow(3000 / Math.max(300, load), 0.08),
    0.8,
    1.1,
  );
  const limit = CONTACT_TUNE.mu * grip * load * sensitivity * (rear ? 0.98 : 1);
  const curve = lateralResponse(angle, rear);
  let fy = -limit * curve.response;
  // At walking pace bound lateral damping so discrete integration cannot kick through zero.
  const maxDamping = (Math.abs(lateral) * mass) / (4 * dt);
  fy = clamp(fy, -maxDamping, maxDamping);
  // Friction always opposes actual contact velocity; transient slip cannot inject lateral energy.
  if (fy * lateral > 0) fy = 0;
  let fx =
    brake > 0
      ? -Math.sign(longitudinal) *
        Math.min(brake, (Math.abs(longitudinal) * mass) / (4 * dt))
      : drive;
  const scale = Math.min(1, limit / Math.max(1e-9, Math.hypot(fx, fy)));
  return {
    longitudinal: fx * scale,
    lateral: fy * scale,
    limit,
    retention: curve.retention,
  };
}
