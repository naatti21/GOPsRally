import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { createVehicle } from "../../v04/src/physics/vehicle.js";
import { tireGrip, velocityAtWheel, measuredSlip } from "../../v04/src/physics/tire.js";

test("wheel point velocity includes yaw instead of only chassis linear velocity", () => {
  const front = velocityAtWheel(
    { x: 0, y: 0, z: -20 },
    { x: 0, y: -1, z: 0 },
    { x: 0.8, y: 0, z: -1.3 },
  );
  const rear = velocityAtWheel(
    { x: 0, y: 0, z: -20 },
    { x: 0, y: -1, z: 0 },
    { x: 0.8, y: 0, z: 1.3 },
  );
  assert.ok(front.x > 1);
  assert.ok(rear.x < -1);
  assert.equal(measuredSlip(0, -20), 0);
  assert.ok(measuredSlip(8, -20) > 0.25);
  assert.ok(measuredSlip(-8, -20) < -0.25);
});

test("rear tires progressively lose more lateral grip than front under high slip", () => {
  for (const surface of [0, 1, 2, 3]) {
    const frontStraight = tireGrip(0, 25, surface, false);
    const frontSliding = tireGrip(0.55, 25, surface, false);
    const rearStraight = tireGrip(0, 25, surface, true);
    const rearSliding = tireGrip(0.55, 25, surface, true);
    assert.ok(frontStraight > frontSliding);
    assert.ok(rearStraight > rearSliding);
    assert.ok(rearSliding / rearStraight < frontSliding / frontStraight);
    assert.ok(rearStraight > rearSliding * 2);
  }
  // Grass remains materially weaker than compact even after softening the
  // shoulder-to-grass cliff; the old 0.5 ratio was calibrated to grass=0.43.
  assert.ok(tireGrip(0.4, 25, 3, true) < tireGrip(0.4, 25, 0, true) * 0.65);
  assert.equal(tireGrip(Number.NaN, 25, 0, true), 0);
  assert.ok(tireGrip(0.4, 0, 0, true) > tireGrip(0.4, 25, 0, true));
});

test("a physical 1200 kg Rapier chassis reports wheel slip and recovers traction as it straightens", async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(200, 0.1, 1000).setTranslation(0, -0.1, 0),
  );
  const car = createVehicle(world, { surfaceAt: () => 0 });
  try {
    car.reset({ x: 0, y: 1, z: 0 });
    for (let i = 0; i < 120; i++) {
      car.tick(1 / 60, {}, false);
      world.step();
    }
    assert.equal(car.snapshot().wheels.filter(w => w.contact).length, 4);
    car.body.setLinvel({ x: 12, y: 0, z: -25 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.tick(1 / 60, {}, true);
    world.step();
    const sliding = car.snapshot();
    assert.ok(sliding.bodySlipAngle > 0.3);
    assert.ok(sliding.wheels[2].slipAngle > 0.3);
    assert.ok(sliding.wheels[2].sideGrip < sliding.wheels[0].sideGrip);
    assert.ok(Number.isFinite(sliding.yawRate));
    assert.ok(sliding.wheels.every(w => w.sideGrip >= 0 && w.sideGrip <= 1));
    // A zero lateral-velocity input must restore the baseline grip and clear
    // the telemetry without any hidden yaw or pose correction.
    car.body.setLinvel({ x: 0, y: 0, z: -25 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.tick(1 / 60, {}, true);
    const recovered = car.snapshot();
    assert.ok(Math.abs(recovered.wheels[2].slipAngle) < 0.05);
    assert.ok(recovered.wheels[2].sideGrip > sliding.wheels[2].sideGrip);
  } finally {
    world.free();
  }
});
