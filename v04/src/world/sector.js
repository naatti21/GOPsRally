import { CatmullRomCurve3, Vector3 } from "three";
import { buildSurface } from "./surface.js";
// Original hill/chicane loop. No reference AI vertices or map assets are shipped.
const PLAN = [
  [-150, 200],
  [-150, -40],
  [-150, -180],
  [-110, -255],
  [-45, -270],
  [-15, -235],
  [30, -270],
  [100, -245],
  [160, -155],
  [135, -30],
  [60, 60],
  [105, 155],
  [160, 230],
  [95, 300],
  [-25, 320],
  [-150, 290],
];
const rawHeight = (x, z) =>
  17 * Math.sin(x / 160) + 12 * Math.cos(z / 160) + 3 * Math.sin((x + z) / 95);
export function makeSector() {
  const curve = new CatmullRomCurve3(
    PLAN.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  const length = curve.getLength(),
    count = Math.ceil(length / 3);
  const nodes = Array.from({ length: count }, (_, i) => {
    const t = i / count,
      p = curve.getPointAt(t),
      d = curve.getTangentAt(t),
      a = curve.getTangentAt((t - 0.004 + 1) % 1),
      b = curve.getTangentAt((t + 0.004) % 1);
    return {
      x: p.x,
      z: p.z,
      y: rawHeight(p.x, p.z),
      tx: d.x,
      tz: d.z,
      s: (i * length) / count,
      bank: Math.max(
        -0.1,
        Math.min(
          0.1,
          -Math.atan2(a.z * b.x - a.x * b.z, a.x * b.x + a.z * b.z) * 0.3,
        ),
      ),
    };
  });
  const min = Math.min(...nodes.map((n) => n.y)),
    range = Math.max(...nodes.map((n) => n.y)) - min;
  const landscape = (x, z) => ((rawHeight(x, z) - min) * 39) / range;
  for (const n of nodes) n.y = landscape(n.x, n.z);
  const track = { nodes, length, roadHalf: 6.5, shoulder: 9, landscape };
  // Cache candidates within 70 m of each spatial cell. The fallback preserves correctness outside it.
  const cell = 40,
    radius = 70,
    buckets = new Map();
  nodes.forEach((a, i) => {
    const b = nodes[(i + 1) % nodes.length];
    for (
      let x = Math.floor((Math.min(a.x, b.x) - radius) / cell);
      x <= Math.floor((Math.max(a.x, b.x) + radius) / cell);
      x++
    )
      for (
        let z = Math.floor((Math.min(a.z, b.z) - radius) / cell);
        z <= Math.floor((Math.max(a.z, b.z) + radius) / cell);
        z++
      ) {
        const key = `${x},${z}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(i);
      }
  });
  track.candidates = (x, z) =>
    buckets.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
  track.candidateRadius = radius;
  return track;
}
export function buildSector() {
  const track = makeSector();
  return buildSurface({
    track,
    step: 3,
    size: 760,
    terrainHeight: track.landscape,
  });
}
