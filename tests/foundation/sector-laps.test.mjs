import test from "node:test";
import assert from "node:assert/strict";
import { buildSector } from "../../v04/src/world/sector.js";
import { sampleSurface } from "../../v04/src/world/surface.js";
import { projectRoad } from "../../v04/src/world/track.js";
import { createPhysics } from "../../v04/src/physics/world.js";
import { makeLaps } from "../../v04/src/game/laps.js";
const m = buildSector();
test("bounded original sector has 39 m relief; spatial lookup equals exhaustive projection", () => {
  assert.ok(m.track.length > 1600 && m.track.length < 1850);
  assert.ok(m.positions.length / 3 < 70000);
  const ys = m.track.nodes.map((n) => n.y);
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 39) < 0.001);
  for (let i = 0; i < 50; i++) {
    const x = -350 + ((i * 83) % 700),
      z = -340 + ((i * 137) % 680);
    assert.deepEqual(
      projectRoad(m.track, x, z),
      projectRoad(m.track, x, z, true),
    );
  }
});
test("road lies within a broad landscape, not a narrow continuous raised ridge", () => {
  let maxDelta = 0;
  for (const n of m.track.nodes) {
    assert.ok(Math.abs(n.y - m.track.landscape(n.x, n.z)) < 0.001);
    for (const side of [-1, 1]) {
      const x = n.x + n.tz * 25 * side,
        z = n.z - n.tx * 25 * side;
      maxDelta = Math.max(
        maxDelta,
        Math.abs(sampleSurface(m, x, z).height - n.y),
      );
    }
  }
  assert.ok(maxDelta < 10);
});
test("sector rendering triangles and real Rapier collision agree on both sides of bends", async () => {
  const p = await createPhysics(m);
  try {
    for (let i = 0; i < m.track.nodes.length; i += 17) {
      const n = m.track.nodes[i];
      for (const offset of [-14, 0, 14]) {
        const x = n.x + 0.137 + n.tz * offset,
          z = n.z + 0.219 - n.tx * offset;
        assert.ok(
          Math.abs(p.rayAt(x, z).height - sampleSurface(m, x, z).height) <
            0.001,
        );
      }
    }
  } finally {
    p.dispose();
  }
});
// Small fixture with separated gate planes: each crossing is a real position-segment intersection.
const track = {
  roadHalf: 5,
  nodes: Array.from({ length: 8 }, (_, i) => ({
    x: Math.sin((i * Math.PI) / 4) * 100,
    z: -Math.cos((i * Math.PI) / 4) * 100,
    y: 0,
    tx: Math.cos((i * Math.PI) / 4),
    tz: Math.sin((i * Math.PI) / 4),
  })),
};
function cross(l, i, back = false) {
  const g = l.gates[i],
    sign = back ? -1 : 1;
  l.update({ x: g.x - g.tx * 2 * sign, y: 1, z: g.z - g.tz * 2 * sign }, 0.1);
  l.update({ x: g.x + g.tx * 2 * sign, y: 1, z: g.z + g.tz * 2 * sign }, 0.1);
}
function travel(l, from, to) {
  const a = l.gates[from],
    b = l.gates[to];
  for (let j = 1; j <= 100; j++) {
    const t = j / 100;
    l.update(
      {
        x: a.x + a.tx * 2 + (b.x - b.tx * 2 - a.x - a.tx * 2) * t,
        y: 1,
        z: a.z + a.tz * 2 + (b.z - b.tz * 2 - a.z - a.tz * 2) * t,
      },
      0.05,
    );
  }
}
test("ordered checkpoints and forward finish count a local lap", () => {
  const l = makeLaps(track);
  cross(l, 0);
  for (let i = 1; i <= 8; i++) {
    travel(l, (i - 1) % 8, i % 8);
    cross(l, i % 8);
  }
  assert.equal(l.snapshot().laps.length, 1);
});
test("skipped gates, reverse crossings, teleport and manual reset cannot award a lap", () => {
  for (const mode of ["skip", "reverse", "reset"]) {
    const l = makeLaps(track);
    cross(l, 0);
    for (let i = 1; i <= 7; i++) {
      if (mode === "skip" && i === 3) continue;
      travel(l, i - 1, i);
      cross(l, i, mode === "reverse");
      if (mode === "reset" && i === 4) l.invalidate();
    }
    travel(l, 7, 0);
    cross(l, 0);
    assert.equal(l.snapshot().laps.length, 0);
  }
});
test("start and driving direction are configurable and validated", () => {
  const l = makeLaps(track, { startFraction: 0.25, direction: -1 });
  assert.equal(l.gates[0].x, 100);
  assert.ok(l.gates[0].tz < 0);
  assert.throws(() => makeLaps(track, { direction: 0 }));
  assert.throws(() => makeLaps(track, { startFraction: NaN }));
});
test("a test driver can complete the entire sector using only steering/brake inputs", async () => {
  const { createVehicle } = await import("../../v04/src/physics/vehicle.js");
  const { Vector3 } = await import("three");
  const p = await createPhysics(m),
    car = createVehicle(p.world, {
      surfaceAt: (x, z) => sampleSurface(m, x, z)?.type ?? 3,
    }),
    laps = makeLaps(m.track),
    a = m.track.nodes[0];
  car.reset(
    { x: a.x - a.tx * 4, y: a.y + 1, z: a.z - a.tz * 4 },
    Math.atan2(a.tx, -a.tz),
  );
  let idx = 0,
    maxDistance = 0;
  try {
    for (let i = 0; i < 10000 && !laps.snapshot().laps.length; i++) {
      const pos = car.body.translation();
      let best = Infinity,
        base = idx;
      for (let d = -10; d <= 12; d++) {
        const j = (base + d + m.track.nodes.length) % m.track.nodes.length,
          n = m.track.nodes[j],
          distance = Math.hypot(pos.x - n.x, pos.z - n.z);
        if (distance < best) {
          idx = j;
          best = distance;
        }
      }
      maxDistance = Math.max(maxDistance, best);
      const look =
          m.track.nodes[
            (idx + Math.max(3, Math.floor(Math.abs(car.speed()) * 0.35))) %
              m.track.nodes.length
          ],
        f = new Vector3(0, 0, -1).applyQuaternion(car.body.rotation());
      const aim = Math.atan2(look.x - pos.x, -(look.z - pos.z)),
        heading = Math.atan2(f.x, -f.z),
        angle = Math.atan2(Math.sin(aim - heading), Math.cos(aim - heading));
      // Test-only driver. No position, velocity or rotation writes after spawn; production has no autopilot.
      car.tick(
        1 / 60,
        {
          left: angle < -0.025,
          right: angle > 0.025,
          brake: Math.abs(car.speed()) > (Math.abs(angle) > 0.2 ? 10 : 22),
        },
        i > 120,
      );
      p.world.step();
      if (i > 120) laps.update(car.body.translation(), 1 / 60);
    }
    assert.equal(laps.snapshot().laps.length, 1);
    assert.ok(maxDistance < m.track.roadHalf);
    assert.ok(laps.snapshot().laps[0] > 60);
  } finally {
    p.dispose();
  }
});
