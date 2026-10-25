import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3, Quaternion } from "three";
import { driveIntent } from "../game/contracts.js";
import { tireGrip, velocityAtWheel, measuredSlip, responsiveSteering, rearCorneringFriction } from "./tire.js";
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
    reversing = false;
  const tireState = WHEELS.map(() => ({ slipAngle: 0, sideGrip: 1, surface: 0, frictionCap: 1.6 }));
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
    reversing = false;
    tireState.forEach((state) => Object.assign(state, { slipAngle: 0, sideGrip: 1, surface: 0, frictionCap: 1.6 }));
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
    const rightBeforeSteer = new Vector3(1, 0, 0).applyQuaternion(orientationBeforeSteer);
    const bodySideSlip = measuredSlip(
      rightBeforeSteer.dot(velocityBeforeSteer),
      v,
    );
    steer = responsiveSteering(intent.steer, v, bodySideSlip);
    const upBeforeSteer = new Vector3(0, 1, 0).applyQuaternion(orientationBeforeSteer);
    const yawRateBeforeSteer = upBeforeSteer.dot(body.angvel());
    const engine = enabled
      ? intent.throttle *
        TUNE.engineForce *
        Math.max(0, 1 - Math.abs(v) / (reversing ? 8 : 62))
      : 0;
    // Measure each contact's *own* lateral slip (including yaw velocity), not
    // merely the car heading. Native Rapier wheel impulses and suspension
    // remain authoritative; per-wheel side stiffness fades beyond grip peak.
    const q = body.rotation();
    const center = new Vector3(body.translation().x, body.translation().y, body.translation().z);
    const lin = body.linvel(), ang = body.angvel();
    for (let i = 0; i < 4; i++) {
      const contact = controller.wheelContactPoint(i);
      const type = contact ? surfaceAt(contact.x, contact.z) : 0;
      const wheelSteer = i < 2 ? steer : 0;
      const anchor = new Vector3(...WHEELS[i]).applyQuaternion(q).add(center);
      const offset = anchor.clone().sub(center);
      const pointVelocity = velocityAtWheel(lin, ang, offset);
      const right = new Vector3(Math.cos(wheelSteer), 0, Math.sin(wheelSteer)).applyQuaternion(q);
      const forward = new Vector3(Math.sin(wheelSteer), 0, -Math.cos(wheelSteer)).applyQuaternion(q);
      const lateral = pointVelocity.x * right.x + pointVelocity.y * right.y + pointVelocity.z * right.z;
      const longitudinal = pointVelocity.x * forward.x + pointVelocity.y * forward.y + pointVelocity.z * forward.z;
      const angle = measuredSlip(lateral, longitudinal);
      const grip = tireGrip(angle, longitudinal, type, i >= 2);
      const surfaceFriction = [1.6, 1.25, 0.95, 0.7][type] ?? 0.7;
      // The physical wheel normal force sets the available impulse budget.
      // At sustained cornering load rear traction runs out *before* huge
      // sideways slip appears, so LEFT/RIGHT alone can induce oversteer.
      const frictionCap = i < 2 ? surfaceFriction :
        rearCorneringFriction(surfaceFriction, v, yawRateBeforeSteer, steer, bodySideSlip);
      Object.assign(tireState[i], { slipAngle: angle, sideGrip: grip, surface: type, frictionCap });
      controller.setWheelSideFrictionStiffness(i, grip);
      controller.setWheelFrictionSlip(i, frictionCap);
      controller.setWheelSteering(i, i < 2 ? -steer : 0);
      controller.setWheelEngineForce(i, engine / 4);
      controller.setWheelBrake(
        i,
        !enabled || intent.brake ? (TUNE.brakeForce * dt) / 4 : 0,
      );
    }
    // Rapier applies suspension and friction impulses at contacts, including torque/load transfer.
    controller.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
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
      lateralSpeed: localLateral,
      bodySlipAngle: measuredSlip(localLateral, localLongitudinal),
      yawRate,
      wheels: WHEELS.map((_, i) => ({
        contact: controller.wheelIsInContact(i),
        length: controller.wheelSuspensionLength(i),
        load: controller.wheelSuspensionForce(i),
        rotation: controller.wheelRotation(i),
        steer: controller.wheelSteering(i),
        sideImpulse: controller.wheelSideImpulse(i),
        slipAngle: tireState[i].slipAngle,
        sideGrip: tireState[i].sideGrip,
        frictionCap: tireState[i].frictionCap,
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
