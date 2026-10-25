import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { pathToFileURL } from "node:url";
const factory = process.env.RALLY_VEHICLE_MODULE
  ? await import(pathToFileURL(process.env.RALLY_VEHICLE_MODULE))
  : await import("../v04/src/physics/vehicle.js");
await RAPIER.init();
const DT = 1 / 60,
  deg = 180 / Math.PI,
  round = (n, p = 3) => +n.toFixed(p);
export function runArcadeTrace({
  speedKmh = 100,
  pulse = 0.65,
  counter = 0,
  counterDelay = 0,
  duration = 4,
  brake = false,
} = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(1000, 0.1, 5000).setTranslation(0, -0.1, 0),
  );
  const car = factory.createVehicle(world, { surfaceAt: () => 0 }),
    rows = [];
  car.reset({ x: 0, y: 1, z: 0 });
  try {
    for (let i = 0; i < 120; i++) {
      car.tick(DT, {}, false);
      world.step();
    }
    car.body.setLinvel({ x: 0, y: 0, z: -speedKmh / 3.6 }, true);
    for (let i = 0; i < Math.round(duration / DT); i++) {
      const t = i * DT,
        input = {
          right: !brake && t < pulse,
          left:
            !brake &&
            t >= pulse + counterDelay &&
            t < pulse + counterDelay + counter,
          brake,
        };
      car.tick(DT, input, true);
      world.step();
      const s = car.snapshot(),
        f = new Vector3(0, 0, -1).applyQuaternion(s.rotation),
        r = new Vector3(1, 0, 0).applyQuaternion(s.rotation);
      rows.push({
        time: round((i + 1) * DT),
        slip: round(s.bodySlipAngle * deg),
        unfoldedSlip: round(
          Math.atan2(r.dot(car.body.linvel()), f.dot(car.body.linvel())) * deg,
        ),
        yaw: round(s.yawRate * deg),
        x: round(s.position.x),
        z: round(s.position.z),
        speed: round(s.speed * 3.6),
        pitch: round(Math.asin(Math.max(-1, Math.min(1, f.y))) * deg),
        roll: round(Math.asin(Math.max(-1, Math.min(1, r.y))) * deg),
        loads: s.wheels.map((w) => round(w.load, 1)),
        travel: s.wheels.map((w) => round(w.length, 4)),
        contacts: s.wheels.filter((w) => w.contact).length,
        input,
      });
    }
    let consecutive = 0,
      longest = 0,
      moderate = 0,
      pathLength = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i],
        a = Math.abs(r.slip);
      if (a >= 6 && a <= 18) {
        moderate += DT;
        consecutive += DT;
        longest = Math.max(longest, consecutive);
      } else consecutive = 0;
      if (i) pathLength += Math.hypot(r.x - rows[i - 1].x, r.z - rows[i - 1].z);
    }
    const final = rows.at(-1),
      catchAt =
        rows[
          Math.min(
            rows.length - 1,
            Math.round((pulse + counterDelay + 0.2) / DT),
          )
        ];
    return {
      settings: { speedKmh, pulse, counter, counterDelay, duration, brake },
      summary: {
        peakSlip: round(Math.max(...rows.map((r) => Math.abs(r.slip)))),
        peakUnfoldedSlip: round(
          Math.max(...rows.map((r) => Math.abs(r.unfoldedSlip))),
        ),
        moderateSeconds: round(moderate),
        longestModerateSeconds: round(longest),
        peakYaw: round(Math.max(...rows.map((r) => Math.abs(r.yaw)))),
        catchSlip: catchAt.slip,
        catchYaw: catchAt.yaw,
        finalSlip: final.slip,
        finalYaw: final.yaw,
        lateralMeters: final.x,
        pathLength: round(pathLength),
        exitKmh: final.speed,
        peakPitch: round(Math.max(...rows.map((r) => Math.abs(r.pitch)))),
        peakRoll: round(Math.max(...rows.map((r) => Math.abs(r.roll)))),
        minContacts: Math.min(...rows.map((r) => r.contacts)),
        loadRange: [
          Math.min(...rows.flatMap((r) => r.loads)),
          Math.max(...rows.flatMap((r) => r.loads)),
        ],
        travelRange: [
          Math.min(...rows.flatMap((r) => r.travel)),
          Math.max(...rows.flatMap((r) => r.travel)),
        ],
      },
      rows,
    };
  } finally {
    world.free();
  }
}
export function measureStraight() {
  const results = [];
  for (const mode of ["acceleration", 70, 100, 180]) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(100, 0.1, 5000).setTranslation(0, -0.1, 0),
    );
    const car = factory.createVehicle(world);
    car.reset({ x: 0, y: 1, z: 0 });
    try {
      for (let i = 0; i < 120; i++) {
        car.tick(DT, {}, false);
        world.step();
      }
      if (mode !== "acceleration")
        car.body.setLinvel({ x: 0, y: 0, z: -mode / 3.6 }, true);
      let seconds = 0,
        maxAxleLoadDifference = 0,
        peakPitch = 0,
        reached = false;
      for (let i = 0; i < 3600; i++) {
        car.tick(DT, { brake: mode !== "acceleration" }, true);
        world.step();
        seconds = (i + 1) * DT;
        const v = car.snapshot(),
          loads = v.wheels.map((w) => w.load);
        maxAxleLoadDifference = Math.max(
          maxAxleLoadDifference,
          Math.abs(loads[0] + loads[1] - loads[2] - loads[3]),
        );
        peakPitch = Math.max(
          peakPitch,
          Math.abs(
            Math.asin(new Vector3(0, 0, -1).applyQuaternion(v.rotation).y) *
              deg,
          ),
        );
        if (
          mode === "acceleration"
            ? v.speed >= 100 / 3.6
            : Math.abs(v.speed) < 0.5
        ) {
          reached = true;
          break;
        }
      }
      results.push({
        mode:
          mode === "acceleration" ? "0–100 km/h" : `${mode} km/h to <0.5 m/s`,
        reached,
        seconds: round(seconds),
        distanceMeters: round(-car.body.translation().z),
        peakPitch: round(peakPitch),
        maxAxleLoadDifferenceN: round(maxAxleLoadDifference, 1),
      });
    } finally {
      world.free();
    }
  }
  return results;
}
export function benchmarkArcade() {
  const scenarios = [];
  for (const speedKmh of [70, 100, 126])
    for (const [name, options] of [
      ["release", {}],
      ["short-catch", { counter: 0.1 }],
      ["overcorrect", { counter: 1.15, counterDelay: 0.12 }],
      ["overdrive", { pulse: 2.5 }],
    ]) {
      const t = runArcadeTrace({ speedKmh, ...options });
      scenarios.push({
        name,
        settings: t.settings,
        ...t.summary,
        trace10Hz: t.rows.filter((_, i) => i % 6 === 5),
      });
    }
  const braking = runArcadeTrace({
    speedKmh: 100,
    brake: true,
    pulse: 0,
    duration: 2,
  });
  return {
    physicsModule: process.env.RALLY_VEHICLE_MODULE
      ? "archived-v044"
      : "working-tree",
    units:
      "degrees, seconds, meters, km/h, N; simulated time; no seeded slip/yaw",
    scenarios,
    straight: measureStraight(),
    braking: {
      ...braking.summary,
      trace10Hz: braking.rows.filter((_, i) => i % 6 === 5),
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(benchmarkArcade(), null, 2));
