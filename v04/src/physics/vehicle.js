import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3, Quaternion } from "three";
import { driveIntent } from "../game/contracts.js";
import { velocityAtWheel, measuredSlip, responsiveSteering } from "./tire.js";
import { contactForces, CONTACT_TUNE } from "./contact-tire.js";
import { SURFACE_GRIP } from "./tire.js";
export const TUNE = Object.freeze({
  mass: 1200,
  centerOfMassY: -0.1,
  bodyOffsetY: 0.18,
  radius: 0.36,
  rest: 0.48,
  travel: 0.28,
  stiffness: 34,
  compression: 4.1,
  rebound: 4.8,
  engineForce: 6500,
  brakeForce: 14000,
  drag: 0.42,
  rolling: 150,
  steeringTime: 0.085,
});
export const WHEELS = [
  [-0.84, 0.05, -1.3],
  [0.84, 0.05, -1.3],
  [-0.84, 0.05, 1.3],
  [0.84, 0.05, 1.3],
];
export function createVehicle(world, { surfaceAt = () => 0 } = {}) {
  // Box-derived inertia in kg m², with explicit lowered CoM in chassis coordinates.
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setCcdEnabled(true)
      .setCanSleep(false)
      .setAngularDamping(0.15),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.86, 0.32, 1.9)
      .setTranslation(0, TUNE.bodyOffsetY, 0)
      .setMassProperties(
        TUNE.mass,
        { x: 0, y: TUNE.centerOfMassY - TUNE.bodyOffsetY, z: 0 },
        {
          x: (TUNE.mass * (0.64 ** 2 + 3.8 ** 2)) / 12,
          y: (TUNE.mass * (1.72 ** 2 + 3.8 ** 2)) / 12,
          z: (TUNE.mass * (1.72 ** 2 + 0.64 ** 2)) / 12,
        },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setFriction(0.6)
      .setRestitution(0.05),
    body,
  );
  // The visible cabin must also collide when the car tumbles; mass stays on the chassis.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.75, 0.275, 0.95)
      .setTranslation(0, 0.55 + TUNE.bodyOffsetY, 0)
      .setDensity(0)
      .setFriction(0.6),
    body,
  );
  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;
  WHEELS.forEach(([x, y, z], i) => {
    controller.addWheel(
      { x, y, z },
      { x: 0, y: -1, z: 0 },
      { x: 1, y: 0, z: 0 },
      TUNE.rest,
      TUNE.radius,
    );
    controller.setWheelSuspensionStiffness(i, TUNE.stiffness);
    controller.setWheelSuspensionCompression(i, TUNE.compression);
    controller.setWheelSuspensionRelaxation(i, TUNE.rebound);
    controller.setWheelMaxSuspensionTravel(i, TUNE.travel);
    controller.setWheelMaxSuspensionForce(i, 18000);
    controller.setWheelFrictionSlip(i, 1.6);
    controller.setWheelSideFrictionStiffness(i, 1);
  });
  let brakeHeld = 0,
    steer = 0,
    rackAngle = 0,
    reversing = false;
  const tireState = WHEELS.map(() => ({
    slipAngle: 0,
    sideGrip: 1,
    surface: 0,
    sideImpulse: 0,
    forwardImpulse: 0,
    limit: 0,
    relaxedAngle: 0,
  }));
  const direction = () =>
    new Vector3(0, 0, -1).applyQuaternion(body.rotation());
  function speed() {
    return direction().dot(body.linvel());
  }
  function reset(position, heading = 0) {
    body.setTranslation(position, true);
    body.setRotation(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -heading),
      true,
    );
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.resetForces(true);
    body.resetTorques(true);
    brakeHeld = 0;
    steer = 0;
    rackAngle = 0;
    reversing = false;
    tireState.forEach((state) =>
      Object.assign(state, {
        slipAngle: 0,
        sideGrip: 1,
        surface: 0,
        sideImpulse: 0,
        forwardImpulse: 0,
        limit: 0,
        relaxedAngle: 0,
      }),
    );
  }
  function tick(dt, input = {}, enabled = true) {
    const v = speed();
    brakeHeld = input.brake && Math.abs(v) < 0.5 ? brakeHeld + dt : 0;
    if (!input.brake) reversing = false;
    else if (brakeHeld >= 0.7) reversing = true;
    const intent = reversing
      ? {
          steer: driveIntent(input, v, brakeHeld).steer,
          throttle: -1,
          brake: false,
        }
      : driveIntent(input, v, brakeHeld);
    // All correction is at the actual front wheel steering joint. The car's
    // chassis still rotates only under Rapier tire forces and collisions.
    const velocityBeforeSteer = body.linvel();
    const orientationBeforeSteer = body.rotation();
    const rightBeforeSteer = new Vector3(1, 0, 0).applyQuaternion(
      orientationBeforeSteer,
    );
    const bodySideSlip = measuredSlip(
      rightBeforeSteer.dot(velocityBeforeSteer),
      v,
    );
    steer = responsiveSteering(intent.steer, v, bodySideSlip);
    rackAngle += (steer - rackAngle) * (1 - Math.exp(-dt / TUNE.steeringTime));
    const engine = enabled
      ? intent.throttle *
        TUNE.engineForce *
        Math.max(0, 1 - Math.abs(v) / (reversing ? 8 : 62))
      : 0;
    // Native raycasts/springs remain authoritative. Disable BOTH native tire axes:
    // no independent native engine/brake impulse can spend the same friction budget.
    for (let i = 0; i < 4; i++) {
      controller.setWheelSideFrictionStiffness(i, 0);
      controller.setWheelSteering(i, i < 2 ? -rackAngle : 0);
      controller.setWheelEngineForce(i, 0);
      controller.setWheelBrake(i, 0);
    }
    controller.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    const q = body.rotation(),
      center = body.worldCom(),
      lin = { ...body.linvel() },
      ang = { ...body.angvel() };
    const impulses = [];
    for (let i = 0; i < 4; i++) {
      const state = tireState[i];
      if (!controller.wheelIsInContact(i)) {
        Object.assign(state, {
          slipAngle: 0,
          sideImpulse: 0,
          forwardImpulse: 0,
          limit: 0,
          relaxedAngle: 0,
        });
        continue;
      }
      const point = controller.wheelContactPoint(i),
        normal = new Vector3().copy(controller.wheelContactNormal(i));
      const type = surfaceAt(point.x, point.z),
        wheelSteer = i < 2 ? rackAngle : 0;
      const right = new Vector3(
        Math.cos(wheelSteer),
        0,
        Math.sin(wheelSteer),
      ).applyQuaternion(q);
      right.addScaledVector(normal, -right.dot(normal)).normalize();
      const forward = new Vector3().crossVectors(normal, right).normalize();
      const velocity = velocityAtWheel(lin, ang, {
        x: point.x - center.x,
        y: point.y - center.y,
        z: point.z - center.z,
      });
      const lateral = right.dot(velocity),
        longitudinal = forward.dot(velocity),
        angle = measuredSlip(lateral, longitudinal);
      const response =
        1 -
        Math.exp(
          (-dt * Math.max(5, Math.abs(longitudinal))) /
            CONTACT_TUNE.relaxationLength,
        );
      state.relaxedAngle += (angle - state.relaxedAngle) * response;
      const force = contactForces({
        angle: state.relaxedAngle,
        lateral,
        longitudinal,
        load: Math.min(
          controller.wheelMaxSuspensionForce(i),
          Math.max(0, controller.wheelSuspensionForce(i)),
        ),
        grip: SURFACE_GRIP[type] ?? SURFACE_GRIP[3],
        rear: i >= 2,
        drive: engine / 4,
        brake: !enabled || intent.brake ? TUNE.brakeForce / 4 : 0,
        dt,
        mass: TUNE.mass,
      });
      Object.assign(state, {
        slipAngle: angle,
        sideGrip:
          force.retention * (i >= 2 ? 0.98 : 1) * (SURFACE_GRIP[type] ?? 0.43),
        surface: type,
        sideImpulse: force.lateral * dt,
        forwardImpulse: force.longitudinal * dt,
        limit: force.limit,
      });
      // Keep the native cap visible for compatibility diagnostics, not as a second tire model.
      controller.setWheelFrictionSlip(i, [1.6, 1.25, 0.95, 0.7][type] ?? 0.7);
      impulses.push({
        point,
        impulse: right
          .multiplyScalar(force.lateral * dt)
          .addScaledVector(forward, force.longitudinal * dt),
      });
    }
    // Evaluate all wheels from the same pre-tire state, avoiding left/right iteration-order bias.
    for (const { point, impulse } of impulses)
      body.applyImpulseAtPoint(impulse, point, true);
    const velocity = body.linvel(),
      magnitude = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (magnitude > 0) {
      const grounded = Array.from({ length: 4 }, (_, i) =>
        controller.wheelIsInContact(i),
      ).some(Boolean);
      const force =
        TUNE.drag * magnitude * magnitude + (grounded ? TUNE.rolling : 0);
      const impulse = Math.min(force * dt, TUNE.mass * magnitude);
      body.applyImpulse(
        {
          x: (-velocity.x / magnitude) * impulse,
          y: (-velocity.y / magnitude) * impulse,
          z: (-velocity.z / magnitude) * impulse,
        },
        true,
      );
    }
  }
  function snapshot() {
    const velocity = body.linvel();
    const orientation = body.rotation();
    const forward = new Vector3(0, 0, -1).applyQuaternion(orientation);
    const right = new Vector3(1, 0, 0).applyQuaternion(orientation);
    const up = new Vector3(0, 1, 0).applyQuaternion(orientation);
    const localLongitudinal = forward.dot(velocity);
    const localLateral = right.dot(velocity);
    const yawRate = up.dot(body.angvel());
    return {
      position: { ...body.translation() },
      rotation: { ...orientation },
      speed: speed(),
      steer,
      rackAngle,
      lateralSpeed: localLateral,
      bodySlipAngle: measuredSlip(localLateral, localLongitudinal),
      yawRate,
      wheels: WHEELS.map((_, i) => ({
        contact: controller.wheelIsInContact(i),
        length: controller.wheelSuspensionLength(i),
        load: Math.min(
          controller.wheelMaxSuspensionForce(i),
          Math.max(0, controller.wheelSuspensionForce(i)),
        ),
        rawSuspensionLoad: controller.wheelSuspensionForce(i),
        rotation: controller.wheelRotation(i),
        steer: controller.wheelSteering(i),
        sideImpulse: tireState[i].sideImpulse,
        forwardImpulse: tireState[i].forwardImpulse,
        tireLimit: tireState[i].limit,
        nativeSideImpulse: controller.wheelSideImpulse(i),
        nativeForwardImpulse: controller.wheelForwardImpulse(i),
        slipAngle: tireState[i].slipAngle,
        sideGrip: tireState[i].sideGrip,
        surface: tireState[i].surface,
      })),
    };
  }
  return {
    body,
    controller,
    reset,
    tick,
    speed,
    snapshot,
    dispose() {
      world.removeVehicleController(controller);
      world.removeRigidBody(body);
    },
  };
}
