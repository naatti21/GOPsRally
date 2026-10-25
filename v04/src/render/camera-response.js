// Radians for headings, m/s for speed. No track tangent or synthetic speed.
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function chaseFov(speed) {
  const t = Math.min(1, Math.max(0, (Math.abs(speed) - 8) / 42));
  return 62 + 6 * t * t * (3 - 2 * t);
}
export function easeFov(current, target, dt, snap = false) {
  return snap
    ? target
    : current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / 0.65));
}
export function chaseHeading(
  previous,
  bodyHeading,
  courseHeading,
  speed,
  dt,
  snap = false,
) {
  // A small velocity-direction contribution makes slip readable without hiding the car's heading.
  const contribution =
    Math.abs(speed) > 3
      ? Math.max(-0.5, Math.min(0.5, wrap(courseHeading - bodyHeading))) * 0.18
      : 0;
  const target = bodyHeading + contribution;
  return snap
    ? target
    : previous +
        wrap(target - previous) * (1 - Math.exp(-Math.max(0, dt) / 0.09));
}
