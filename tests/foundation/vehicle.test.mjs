import test from "node:test";
import assert from "node:assert/strict";
import R from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { createVehicle, TUNE } from "../../v04/src/physics/vehicle.js";
await R.init();
function rig(options = {}) {
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    R.ColliderDesc.cuboid(200, 0.1, 4000).setTranslation(0, -0.1, 0),
  );
  const car = createVehicle(world, options);
  car.reset({ x: 0, y: 1, z: 0 });
  const step = (n, input = {}, active = true) => {
    for (let i = 0; i < n; i++) {
      car.tick(1 / 60, input, active);
      world.step();
    }
  };
  step(120, {}, false);
  return { world, car, step };
}
test("1200 kg chassis rests on four independent loaded springs", () => {
  const { world, car, step } = rig();
  try {
    assert.equal(car.body.mass(), 1200);
    assert.ok(Math.abs(car.body.localCom().y - TUNE.centerOfMassY) < 0.001);
    const before = car.snapshot();
    assert.equal(before.wheels.filter((w) => w.contact).length, 4);
    for (const w of before.wheels) {
      assert.ok(w.length < TUNE.rest);
      assert.ok(w.load > 2500 && w.load < 3500);
    }
    world.createCollider(
      R.ColliderDesc.cuboid(0.35, 0.07, 0.4).setTranslation(-0.84, 0.07, -1.3),
    );
    step(60, {}, false);
    const s = car.snapshot();
    assert.ok(Math.abs(s.wheels[0].length - s.wheels[1].length) > 0.04);
    assert.ok(Math.abs(s.rotation.z) > 0.01);
  } finally {
    world.free();
  }
});
test("acceleration transfers load rearward; right/left input yields correct physical yaw", () => {
  for (const dir of ["left", "right"]) {
    const { world, car, step } = rig();
    try {
      step(180);
      const s = car.snapshot();
      assert.ok(s.speed > 12);
      assert.ok(s.wheels[2].load > s.wheels[0].load);
      step(60, { [dir]: true });
      assert.ok(car.body.translation().x * (dir === "right" ? 1 : -1) > 3);
    } finally {
      world.free();
    }
  }
});
test("real engine reaches 180 km/h and braking distance increases with speed", () => {
  const distances = [];
  for (const speed of [25, 50]) {
    const { world, car, step } = rig();
    try {
      car.body.setLinvel({ x: 0, y: 0, z: -speed }, true);
      let count = 0;
      do {
        step(1, { brake: true });
        count++;
      } while (car.speed() > 0.5 && count < 600);
      assert.ok(count < 600);
      distances.push(-car.body.translation().z);
    } finally {
      world.free();
    }
  }
  assert.ok(distances[1] > distances[0] * 3);
  assert.ok(distances[1] > 80 && distances[1] < 170);
  const { world, car, step } = rig();
  try {
    step(3600);
    assert.ok(car.speed() > 50 && car.speed() < 55);
  } finally {
    world.free();
  }
});
test("reverse requires near-stop hold; reset immediately clears momentum", () => {
  const { world, car, step } = rig();
  try {
    step(20, { brake: true });
    assert.ok(Math.abs(car.speed()) < 0.1);
    step(90, { brake: true });
    assert.ok(car.speed() < -1);
    car.reset({ x: 2, y: 5, z: 3 });
    assert.deepEqual({ ...car.body.linvel() }, { x: 0, y: 0, z: 0 });
    assert.equal(car.body.translation().y, 5);
  } finally {
    world.free();
  }
});
test("airborne chassis has gravity and no tire steering; damped suspension lands and settles", () => {
  const { world, car, step } = rig();
  try {
    car.reset({ x: 0, y: 8, z: 0 });
    step(30, { right: true });
    let s = car.snapshot();
    assert.ok(s.wheels.every((w) => !w.contact));
    assert.ok(car.body.linvel().y < -4.5);
    assert.ok(Math.abs(s.rotation.y) < 0.001);
    let maxLoad = 0;
    for (let i = 0; i < 240; i++) {
      step(1, {}, false);
      maxLoad = Math.max(maxLoad, ...car.snapshot().wheels.map((w) => w.load));
    }
    assert.ok(maxLoad > 6000);
    s = car.snapshot();
    assert.ok(s.wheels.every((w) => w.contact));
    assert.ok(Math.abs(car.body.linvel().y) < 0.1);
    assert.ok(s.position.y > 0.65 && s.position.y < 0.85);
  } finally {
    world.free();
  }
});
test("50 m/s ramp creates physical flight and landing; asymmetric off-road ramp can overturn", () => {
  for (const asymmetric of [false, true]) {
    const { world, car, step } = rig();
    try {
      const left = asymmetric ? -3 : -8,
        right = asymmetric ? 0 : 8,
        end = asymmetric ? -20 : -30,
        height = asymmetric ? 2 : 3;
      world.createCollider(
        R.ColliderDesc.trimesh(
          new Float32Array([
            left,
            0,
            -10,
            right,
            0,
            -10,
            left,
            height,
            end,
            right,
            height,
            end,
          ]),
          new Uint32Array([0, 1, 2, 1, 3, 2]),
        ),
      );
      car.body.setLinvel({ x: 0, y: 0, z: -50 }, true);
      let maxY = 0,
        minUp = 1,
        air = 0,
        landed = false;
      for (let i = 0; i < 420; i++) {
        step(1);
        const s = car.snapshot();
        maxY = Math.max(maxY, s.position.y);
        minUp = Math.min(
          minUp,
          new Vector3(0, 1, 0).applyQuaternion(s.rotation).y,
        );
        if (s.wheels.every((w) => !w.contact)) air++;
        if (air > 5 && s.wheels.some((w) => w.contact)) landed = true;
        assert.ok(s.position.y > -0.1);
      }
      if (asymmetric) assert.ok(minUp < -0.5);
      else {
        assert.ok(maxY > 5);
        assert.ok(air > 40);
        assert.ok(landed);
      }
    } finally {
      world.free();
    }
  }
});
test("loose off-road contact limits available lateral tire impulse", () => {
  const impulses = [];
  for (const type of [0, 3]) {
    const { world, car, step } = rig({ surfaceAt: () => type });
    try {
      car.body.setLinvel({ x: 0, y: 0, z: -25 }, true);
      step(20, { right: true });
      assert.equal(
        car.controller.wheelFrictionSlip(0),
        type === 0 ? Math.fround(1.6) : Math.fround(0.7),
      );
      impulses.push(
        car
          .snapshot()
          .wheels.reduce((sum, w) => sum + Math.abs(w.sideImpulse), 0),
      );
    } finally {
      world.free();
    }
  }
  assert.ok(impulses[1] < impulses[0] * 0.8);
});
