import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  contactForces,
  lateralResponse,
  CONTACT_TUNE,
} from "../../v04/src/physics/contact-tire.js";
import { createVehicle } from "../../v04/src/physics/vehicle.js";
import { runArcadeTrace } from "../../scripts/arcade-dynamics-benchmark.mjs";
import {
  chaseFov,
  easeFov,
  chaseHeading,
} from "../../v04/src/render/camera-response.js";
await RAPIER.init();
test("smooth tire curve is odd, bounded and has a gentle post-peak rather than a cliff", () => {
  for (const rear of [false, true]) {
    let peak = 0,
      previous = 0;
    for (let a = 0; a < 1.5; a += 0.001) {
      const r = lateralResponse(a, rear).response;
      assert.ok(r >= 0 && r <= 1);
      assert.ok(Math.abs(r - previous) < 0.02);
      assert.ok(Math.abs(r + lateralResponse(-a, rear).response) < 1e-12);
      previous = r;
      peak = Math.max(peak, r);
    }
    assert.ok(peak > previous);
    assert.ok(previous > peak * 0.85);
  }
});
test("combined longitudinal/lateral forces share one load budget, dissipate slip, and vanish in air", () => {
  for (const load of [0, 500, 3000, 9000])
    for (const grip of [0.43, 1])
      for (const side of [-12, 0, 12])
        for (const longitudinal of [-20, 0, 20])
          for (const drive of [-15000, 0, 15000]) {
            const f = contactForces({
              angle: Math.atan2(side, Math.max(2.5, Math.abs(longitudinal))),
              lateral: side,
              longitudinal,
              load,
              grip,
              drive,
            });
            assert.ok(Math.hypot(f.longitudinal, f.lateral) <= f.limit + 1e-6);
            assert.ok(f.lateral * side <= 0);
            if (load === 0)
              assert.equal(Math.hypot(f.longitudinal, f.lateral), 0);
          }
  const light = contactForces({
      angle: 0.2,
      lateral: 4,
      longitudinal: 20,
      load: 1500,
    }),
    heavy = contactForces({
      angle: 0.2,
      lateral: 4,
      longitudinal: 20,
      load: 6000,
    });
  assert.ok(heavy.limit > light.limit * 3 && heavy.limit < light.limit * 4);
});
test("pinned Rapier native weighted ellipse permits twice the circular longitudinal budget", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0),
  );
  const car = createVehicle(world);
  try {
    car.reset({ x: 0, y: 1, z: 0 });
    for (let i = 0; i < 120; i++) {
      car.tick(1 / 60, {}, false);
      world.step();
    }
    const c = car.controller;
    for (let i = 0; i < 4; i++) {
      c.setWheelSideFrictionStiffness(i, 0);
      c.setWheelEngineForce(i, 1e6);
      c.setWheelBrake(i, 0);
      c.setWheelFrictionSlip(i, 0.01);
    }
    c.updateVehicle(1 / 60, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    assert.equal(Math.abs(c.wheelSideImpulse(0)), 0);
    const ratio =
      c.wheelForwardImpulse(0) / ((c.wheelSuspensionForce(0) * 0.01) / 60);
    assert.ok(ratio > 1.99 && ratio < 2.01);
  } finally {
    world.free();
  }
});
test("production tire impulses are applied exactly once, with native tire impulses disabled", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(100, 0.1, 100).setTranslation(0, -0.1, 0),
  );
  const car = createVehicle(world);
  try {
    car.reset({ x: 0, y: 1, z: 0 });
    for (let i = 0; i < 180; i++) {
      car.tick(1 / 60, { right: i > 140 }, i > 120);
      world.step();
      for (const w of car.snapshot().wheels) {
        assert.equal(Math.abs(w.nativeSideImpulse), 0);
        assert.equal(Math.abs(w.nativeForwardImpulse), 0);
        assert.ok(
          Math.hypot(w.sideImpulse, w.forwardImpulse) <=
            w.tireLimit / 60 + 1e-5,
        );
      }
    }
    assert.ok(car.snapshot().wheels.some((w) => Math.abs(w.sideImpulse) > 1));
  } finally {
    world.free();
  }
});
test("steering-only moderate slide has duration, short correction reduces yaw and path error at three speeds", () => {
  for (const speedKmh of [70, 100, 126]) {
    const release = runArcadeTrace({ speedKmh }),
      catchSlide = runArcadeTrace({ speedKmh, counter: 0.1 });
    assert.ok(release.summary.peakSlip >= 6 && release.summary.peakSlip < 22);
    assert.ok(release.summary.longestModerateSeconds > 0.4);
    assert.ok(catchSlide.summary.longestModerateSeconds > 0.25);
    assert.ok(catchSlide.summary.peakSlip < 22);
    assert.ok(
      Math.abs(catchSlide.summary.catchYaw) <
        Math.abs(release.summary.catchYaw) * 0.8,
    );
    assert.ok(
      Math.abs(catchSlide.summary.lateralMeters) <
        Math.abs(release.summary.lateralMeters) - 5,
    );
    assert.ok(
      Math.abs(catchSlide.summary.finalSlip) < 2 &&
        Math.abs(catchSlide.summary.finalYaw) < 3,
    );
    const reverseCrossings = catchSlide.rows.filter(
      (r, i, a) => i > 0 && Math.abs(r.slip) > 6 && r.slip * a[i - 1].slip < 0,
    ).length;
    assert.equal(reverseCrossings, 0);
    assert.ok(release.rows.every((r) => !r.input.brake));
    assert.equal(release.summary.minContacts, 4);
  }
});
test("large steering pulses have an intermediate region; prolonged overcorrection still fails", () => {
  for (const speedKmh of [70, 100, 126])
    for (const pulse of [0.35, 0.65, 0.95]) {
      const s = runArcadeTrace({ speedKmh, pulse });
      assert.ok(
        s.summary.peakSlip < 25 && s.summary.peakUnfoldedSlip < 25,
        `${speedKmh}/${pulse}`,
      );
      for (let i = 1; i < s.rows.length; i++)
        assert.ok(Math.abs(s.rows[i].slip - s.rows[i - 1].slip) < 5);
    }
  const bad = runArcadeTrace({
    speedKmh: 126,
    counter: 1.15,
    counterDelay: 0.12,
  });
  assert.ok(bad.summary.peakSlip > 45);
  assert.ok(bad.summary.exitKmh < 100);
});
test("real braking/acceleration/cornering change individual spring loads and chassis pitch/roll", () => {
  const stop = runArcadeTrace({ speedKmh: 100, brake: true, duration: 1 }),
    turn = runArcadeTrace({ speedKmh: 100, duration: 2 });
  assert.ok(
    stop.rows.some(
      (r) =>
        r.loads[0] + r.loads[1] > (r.loads[2] + r.loads[3]) * 1.5 &&
        r.pitch < -0.7,
    ),
  );
  assert.ok(
    turn.rows.some(
      (r) =>
        r.loads[0] + r.loads[2] > (r.loads[1] + r.loads[3]) * 1.2 &&
        Math.abs(r.roll) > 1,
    ),
  );
  for (const r of [...stop.rows, ...turn.rows]) {
    assert.ok(r.travel.every((x) => x >= 0.19 && x <= 0.77));
    assert.ok(r.loads.every((x) => x >= 0 && x <= 18000.1));
  }
  assert.ok(stop.summary.peakPitch < 6 && turn.summary.peakRoll < 8);
});
test("Chase FOV stays modest and eases consistently across frame rates; heading takes shortest path", () => {
  assert.equal(chaseFov(0), 62);
  assert.equal(chaseFov(50), 68);
  assert.equal(chaseFov(90), 68);
  assert.ok(chaseFov(25) > 62 && chaseFov(25) < 68);
  let a = 62,
    b = 62;
  for (let i = 0; i < 60; i++) a = easeFov(a, 68, 1 / 60);
  for (let i = 0; i < 120; i++) b = easeFov(b, 68, 1 / 120);
  assert.ok(Math.abs(a - b) < 1e-10);
  assert.ok(a < 68);
  const h = chaseHeading(
    Math.PI - 0.01,
    -Math.PI + 0.01,
    -Math.PI + 0.11,
    30,
    1 / 60,
  );
  assert.ok(Math.abs(h - (Math.PI - 0.01)) < 0.02);
  assert.equal(easeFov(68, 62, 0, true), 62);
});
test("hard landing traction uses the capped applied spring load, never the unclamped spring request", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(200, 0.1, 400).setTranslation(0, -0.1, 0),
  );
  const car = createVehicle(world);
  let clipped = false;
  try {
    car.reset({ x: 0, y: 8, z: 0 });
    car.body.setLinvel({ x: 8, y: -8, z: -25 }, true);
    for (let i = 0; i < 240; i++) {
      car.tick(1 / 60, {}, false);
      world.step();
      for (const w of car.snapshot().wheels) {
        if (w.rawSuspensionLoad > w.load + 1) clipped = true;
        assert.ok(w.load <= 18000);
        assert.ok(w.tireLimit <= CONTACT_TUNE.mu * 18000 * 1.1 * 1.01 + 1e-5);
        assert.ok(
          Math.hypot(w.sideImpulse, w.forwardImpulse) <=
            w.tireLimit / 60 + 1e-5,
        );
        if (!w.contact)
          assert.equal(Math.hypot(w.sideImpulse, w.forwardImpulse), 0);
      }
    }
    assert.ok(clipped, "fixture must actually hit the suspension-force cap");
  } finally {
    world.free();
  }
});
