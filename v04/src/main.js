import "./style.css";
import {
  Vector3,
  Quaternion,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  ArrowHelper,
} from "three";
import { buildSector } from "./world/sector.js";
import { sampleSurface } from "./world/surface.js";
import { createPhysics } from "./physics/world.js";
import { createVehicle } from "./physics/vehicle.js";
import { createScene } from "./render/scene.js";
import { makeClock } from "./game/contracts.js";
import { makeLaps, RACE } from "./game/laps.js";
import { bindDrivingControls } from "./game/input.js";
const $ = (s) => document.querySelector(s);
async function start() {
  const began = performance.now(),
    surface = buildSector(),
    generated = performance.now();
  const physics = await createPhysics(surface),
    view = createScene($("canvas"), surface);
  const car = createVehicle(physics.world, {
    surfaceAt: (x, z) => sampleSurface(surface, x, z)?.type ?? 3,
  });
  const clock = makeClock(),
    input = bindDrivingControls();
  const config = { ...RACE };
  let laps,
    gate,
    marker,
    arrow,
    countdown = 2,
    running = false,
    lastTime = performance.now(),
    previous,
    current,
    safeNode = 0;
  let frames = 0,
    totalFrameMs = 0,
    maxFrameMs = 0,
    physicsMs = 0;
  const mapPoint = (n) => ({
    x: 10 + (n.x + 190) / 4,
    y: 10 + (n.z + 300) / 4.5,
  });
  const path = surface.track.nodes
    .map((n) => {
      const p = mapPoint(n);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
  function configure() {
    config.startFraction = Number($("#start").value);
    config.direction = Number($("#direction").value);
    laps = makeLaps(surface.track, config);
    gate = laps.gates[0];
    safeNode = Math.floor(config.startFraction * surface.track.nodes.length);
    if (marker) {
      view.scene.remove(marker, arrow);
      marker.geometry.dispose();
      marker.material.dispose();
      arrow.dispose();
    }
    marker = new Mesh(
      new BoxGeometry(surface.track.roadHalf * 2, 0.08, 0.7),
      new MeshBasicMaterial({ color: 0xffdc78 }),
    );
    marker.position.set(gate.x, gate.y + 0.15, gate.z);
    marker.rotation.y = Math.atan2(gate.tx, gate.tz);
    view.scene.add(marker);
    arrow = new ArrowHelper(
      new Vector3(gate.tx, 0, gate.tz),
      new Vector3(gate.x, gate.y + 1, gate.z),
      8,
      0xffdc78,
      2,
      1,
    );
    view.scene.add(arrow);
    const p = mapPoint(gate);
    $("#map").innerHTML =
      `<polyline points="${path}" fill="none" stroke="#a6b6a2" stroke-width="3"/><line x1="${p.x}" y1="${p.y}" x2="${p.x + gate.tx * 10}" y2="${p.y + gate.tz * 10}" stroke="#ffdc78" stroke-width="3"/><circle cx="${p.x}" cy="${p.y}" r="3" fill="#ffdc78"/><circle id="map-car" r="2.5" fill="#fff"/>`;
    running = false;
    countdown = 2;
    $("#go").disabled = false;
    recover(true);
  }
  function recover(atStart = false) {
    const n = surface.track.nodes[safeNode],
      tx = n.tx * config.direction,
      tz = n.tz * config.direction;
    const x = n.x - (atStart ? tx * 4 : 0),
      z = n.z - (atStart ? tz * 4 : 0),
      h = sampleSurface(surface, x, z);
    car.reset({ x, y: h.height + 1, z }, Math.atan2(tx, -tz));
    if (!atStart) laps.invalidate();
    input.clear();
    clock.reset();
    previous = current = car.snapshot();
    view.drive(current, 1); // teleport only for explicit reset
  }
  $("#reset").onclick = () => recover();
  $("#start").onchange = configure;
  $("#direction").onchange = configure;
  $("#go").onclick = () => {
    running = true;
    countdown = 2;
    $("#go").disabled = true;
  };
  for (const b of document.querySelectorAll("[data-camera]"))
    b.onclick = () => {
      for (const btn of document.querySelectorAll("[data-camera]"))
        btn.setAttribute("aria-pressed", String(btn === b));
      view.setCamera(b.dataset.camera);
    };
  configure();
  // Until the alternate Fixed angle is validated on-device, start with the known-playable chase view.
  view.setCamera("chase");
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
    clock.reset();
    previous = current = car.snapshot();
  });
  function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = document.hidden ? 0 : Math.min(rawDt, 0.1);
    const beganPhysics = performance.now();
    const { alpha } = clock.advance(dt, (step) => {
      previous = current;
      const active = running && countdown <= 0;
      if (running && countdown > 0) countdown = Math.max(0, countdown - step);
      car.tick(step, input.read(), active);
      physics.world.step();
      current = car.snapshot();
      if (active) {
        laps.update(current.position, step);
        // Recovery anchor advances locally only while upright and on road, never scans the whole route per frame.
        const up = new Vector3(0, 1, 0).applyQuaternion(current.rotation);
        if (
          up.y > 0.65 &&
          current.wheels.filter((w) => w.contact).length >= 2
        ) {
          let best = Infinity;
          const baseNode = safeNode;
          for (let offset = -8; offset <= 8; offset++) {
            const i =
                (baseNode + offset + surface.track.nodes.length) %
                surface.track.nodes.length,
              n = surface.track.nodes[i],
              d = Math.hypot(
                n.x - current.position.x,
                n.z - current.position.z,
              );
            if (d < best && d < surface.track.roadHalf) {
              best = d;
              safeNode = i;
            }
          }
        }
      }
    });
    physicsMs = performance.now() - beganPhysics;
    const pose = {
      ...current,
      position: new Vector3()
        .copy(previous.position)
        .lerp(current.position, alpha),
      rotation: new Quaternion()
        .copy(previous.rotation)
        .slerp(new Quaternion().copy(current.rotation), alpha),
    };
    view.drive(pose, dt);
    view.render();
    $("#speed").textContent = Math.round(Math.abs(current.speed) * 3.6);
    const lap = laps.snapshot();
    $("#lap").textContent =
      `Lap ${lap.laps.length + 1} · ${lap.elapsed.toFixed(1)}s${lap.valid ? "" : " · invalid"}`;
    $("#countdown").textContent = !running
      ? "TAP GO"
      : countdown > 0
        ? Math.ceil(countdown)
        : "";
    $("#status").textContent =
      `${current.wheels.filter((w) => w.contact).length}/4 contacts · CP ${Math.min(lap.next, 7)}/7`;
    const mp = mapPoint(current.position);
    $("#map-car").setAttribute("cx", mp.x);
    $("#map-car").setAttribute("cy", mp.y);
    if (!document.hidden) {
      frames++;
      totalFrameMs += rawDt * 1000;
      maxFrameMs = Math.max(maxFrameMs, rawDt * 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only telemetry supports real-device profiling without a simulation mutation/debug escape hatch.
  window.rallyDrive = {
    snapshot: () => ({
      ...car.snapshot(),
      input: input.read(),
      lap: laps.snapshot(),
      countdown,
      running,
      config: { ...config },
      metrics: {
        generationMs: generated - began,
        startupMs: readyTime - began,
        meanFrameMs: totalFrameMs / Math.max(1, frames),
        maxFrameMs,
        physicsMs,
        triangles: surface.indices.length / 3,
        drawCalls: view.renderer.info.render.calls,
        cameraFinite: view.camera.matrixWorld.elements.every(Number.isFinite),
        carNdc: view.carNdc(),
        cameraDistance: view.cameraDistance(),
      },
      trackLength: surface.track.length,
    }),
  };
  const readyTime = performance.now();
  document.body.dataset.ready = "true";
  if (import.meta.env.PROD && "serviceWorker" in navigator)
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
}
start().catch((e) => {
  console.error(e);
  $("#status").textContent = `Unable to start: ${e.message}`;
  document.body.dataset.ready = "error";
});
