import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { responsiveSteering } from "../../v04/src/physics/tire.js";
import { createVehicle } from "../../v04/src/physics/vehicle.js";
import { buildSector } from "../../v04/src/world/sector.js";
import { sampleSurface } from "../../v04/src/world/surface.js";

test("high-speed digital steering remains responsive without artificial yaw input", () => {
  const oldAngle = 0.48 / (1 + 36 / 28);
  const newAngle = responsiveSteering(1, 36);
  assert.ok(newAngle > oldAngle * 1.3);
  assert.ok(newAngle < 0.4);
  assert.equal(responsiveSteering(0, 36, 0.5), 0);
  assert.equal(responsiveSteering(-1, 25), -responsiveSteering(1, 25));
  assert.equal(responsiveSteering(Number.NaN, 25), 0);
});

test("countersteering has more front wheel authority when drift direction matches steering", () => {
  const ordinary = responsiveSteering(1, 27, 0);
  const catchSlide = responsiveSteering(1, 27, 0.28);
  const wrongWay = responsiveSteering(-1, 27, 0.28);
  assert.ok(catchSlide > ordinary * 1.1);
  assert.ok(catchSlide <= ordinary * 1.26);
  assert.ok(Math.abs(wrongWay) < catchSlide);
});

test("Rapier front wheel steering reverses promptly during lateral drift without teleporting", async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.1, 4000).setTranslation(0, -0.1, 0));
  const car = createVehicle(world, { surfaceAt: () => 0 });
  try {
    car.reset({ x: 0, y: 1, z: 0 });
    for (let i = 0; i < 120; i++) {
      car.tick(1/60, {}, false);
      world.step();
    }
    car.body.setLinvel({ x: 9, y: 0, z: -25 }, true);
    car.tick(1/60, { right: true });
    let state = car.snapshot();
    assert.ok(state.steer > responsiveSteering(1, 25));
    assert.ok(state.wheels[0].steer < 0);
    assert.ok(state.bodySlipAngle > 0.2);
    car.tick(1/60, { left: true });
    state = car.snapshot();
    assert.ok(state.steer < 0);
    assert.ok(state.wheels[0].steer > 0);
    assert.ok(state.position.y > 0.3);
  } finally { world.free(); }
});

test("generated driving surface includes resolved minor corrugations without elevated second road ribbon", () => {
  const mesh = buildSector();
  let deviations = [];
  for (let i = 3; i < mesh.track.nodes.length; i += 11) {
    const n = mesh.track.nodes[i];
    const ground = sampleSurface(mesh, n.x, n.z);
    if (ground) deviations.push(ground.height - n.y);
  }
  const span = Math.max(...deviations) - Math.min(...deviations);
  assert.ok(span > 0.04, "road must have measurable gravel micro-relief");
  assert.ok(span < 0.9, "road ripples must not create giant ramps");
});
