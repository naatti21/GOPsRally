import * as THREE from "three";
import { WHEELS, TUNE } from "../physics/vehicle.js";
import { sampleSurface } from "../world/surface.js";
import { chaseFov, easeFov, chaseHeading } from "./camera-response.js";
export function createScene(canvas, surface) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x9bb8b7);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9bb8b7, 180, 450);
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x495536, 2.5));
  const sun = new THREE.DirectionalLight(0xfff0d5, 2.5);
  sun.position.set(-80, 120, 50);
  scene.add(sun);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(surface.positions, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(surface.colors, 3));
  geometry.computeVertexNormals();
  // Flat shading uses the same face normal as the collision triangle, not a different smoothed surface.
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });
  scene.add(new THREE.Mesh(geometry, material));
  // Lightweight roadside stakes make the physical gravel corridor readable on mobile.
  // They follow the same sampled terrain used by the Rapier collider, not a raised road ribbon.
  const nodes = surface.track.nodes;
  // Extra near-field markers pass the camera at visibly different rates at 60 vs 100 km/h.
  // Existing instancing preserves the same number of draw calls.
  const markerStep = 4;
  const stakes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.18, 0.85, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xffedbd, roughness: 1 }),
    Math.ceil(nodes.length / markerStep) * 2,
  );
  const stake = new THREE.Object3D();
  let stakeCount = 0;
  for (let i = 0; i < nodes.length; i += markerStep) {
    const node = nodes[i];
    for (const side of [-1, 1]) {
      const distance = surface.track.roadHalf + 1.7;
      const x = node.x + side * node.tz * distance;
      const z = node.z - side * node.tx * distance;
      const ground = sampleSurface(surface, x, z);
      if (!ground) continue;
      stake.position.set(x, ground.height + 0.425, z);
      stake.updateMatrix();
      stakes.setMatrixAt(stakeCount++, stake.matrix);
    }
  }
  stakes.count = stakeCount;
  stakes.instanceMatrix.needsUpdate = true;
  scene.add(stakes);
  const chassis = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.64, 3.8),
    new THREE.MeshStandardMaterial({ color: 0xf0b83b, roughness: 0.7 }),
  );
  box.position.y = TUNE.bodyOffsetY;
  chassis.add(box);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.55, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x243941, roughness: 0.5 }),
  );
  cabin.position.y = 0.55 + TUNE.bodyOffsetY;
  chassis.add(cabin);
  scene.add(chassis);
  const wheels = Array.from({ length: 4 }, () => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(TUNE.radius, TUNE.radius, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c2427 }),
    );
    wheel.rotation.z = Math.PI / 2;
    scene.add(wheel);
    return wheel;
  });
  const probe = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xee6b47 }),
  );
  probe.visible = false;
  scene.add(probe);
  let filteredHeading = 0;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  let mode = "fixed",
    anchor = null,
    lastDrivenPose = null;
  const sites = [0, 0.18, 0.31, 0.51, 0.7, 0.61].map(
    (t) => surface.track.nodes[Math.floor(t * surface.track.nodes.length)],
  );
  function inspect(index) {
    anchor = sites[index];
    const ground = sampleSurface(surface, anchor.x, anchor.z);
    const up = new THREE.Vector3(...ground.normal);
    const forward = new THREE.Vector3(anchor.tx, 0, anchor.tz);
    forward.addScaledVector(up, -forward.dot(up)).normalize();
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const matrix = new THREE.Matrix4().makeBasis(
      right,
      up,
      forward.clone().negate(),
    );
    chassis.quaternion.setFromRotationMatrix(matrix);
    chassis.position.set(anchor.x, ground.height + 0.85, anchor.z);
    // Static inspection fixture only. No animated suspension or fake driving.
    wheels.forEach((wheel, i) => {
      const p = new THREE.Vector3(
        (i % 2 ? 1 : -1) * 0.94,
        0,
        i < 2 ? -1.2 : 1.2,
      )
        .applyQuaternion(chassis.quaternion)
        .add(chassis.position);
      const hit = sampleSurface(surface, p.x, p.z);
      wheel.position.set(p.x, hit.height + TUNE.radius, p.z);
      wheel.quaternion
        .copy(chassis.quaternion)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            Math.PI / 2,
          ),
        );
    });
    updateCamera();
    return { x: anchor.x, y: ground.height, z: anchor.z };
  }
  function updateCamera() {
    if (!anchor) return;
    const p = chassis.position;
    const offset =
      mode === "fixed"
        ? new THREE.Vector3(0, 55, 40)
        : new THREE.Vector3(-anchor.tx * 38, 30, -anchor.tz * 38);
    camera.position.copy(p).add(offset);
    camera.lookAt(p);
  }
  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  inspect(0);
  function drive(pose, dt, snapCamera = false) {
    lastDrivenPose = pose;
    chassis.position.copy(pose.position);
    chassis.quaternion.copy(pose.rotation);
    wheels.forEach((wheel, i) => {
      const w = pose.wheels[i],
        connection = WHEELS[i];
      wheel.position
        .set(connection[0], connection[1] - w.length, connection[2])
        .applyQuaternion(chassis.quaternion)
        .add(chassis.position);
      wheel.quaternion
        .copy(chassis.quaternion)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            w.steer,
          ),
        )
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -w.rotation, // Rolling toward local -Z rotates around -X.
          ),
        )
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            Math.PI / 2,
          ),
        );
    });
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      chassis.quaternion,
    );
    forward.y = 0;
    forward.normalize();
    const speed = Math.hypot(pose.speed, pose.lateralSpeed ?? 0);
    const bodyHeading = Math.atan2(forward.x, -forward.z);
    const courseHeading =
      bodyHeading +
      Math.atan2(pose.lateralSpeed ?? 0, Math.max(3, Math.abs(pose.speed)));
    filteredHeading = chaseHeading(
      filteredHeading,
      bodyHeading,
      courseHeading,
      speed,
      dt,
      snapCamera,
    );
    if (mode === "chase")
      forward.set(Math.sin(filteredHeading), 0, -Math.cos(filteredHeading));
    // Fixed = a zoomed-out, stable compass-facing camera that TRACKS the car.
    // Do not project the look-at point 7 m ahead of the car: in portrait mode
    // that moves the vehicle behind the HUD/steering controls or off-screen.
    // Chase remains the lower, heading-relative driving camera.
    const fixed = mode === "fixed";
    const lookAhead = fixed ? 0 : Math.min(14, 5 + speed * 0.22);
    const target = chassis.position
      .clone()
      .addScaledVector(forward, lookAhead)
      .add(new THREE.Vector3(0, 1.1, 0));
    const wanted = fixed
      ? chassis.position.clone().add(new THREE.Vector3(0, 32, 26))
      : chassis.position
          .clone()
          .addScaledVector(forward, -(11 + Math.min(2.5, speed * 0.075)))
          .add(new THREE.Vector3(0, 5.5 + Math.min(1.5, speed * 0.045), 0));
    camera.position.lerp(
      wanted,
      snapCamera ? 1 : 1 - Math.exp(-Math.max(0, dt) * 7),
    );
    const newFov = fixed
      ? 58
      : easeFov(camera.fov, chaseFov(speed), dt, snapCamera);
    if (camera.fov !== newFov) {
      camera.fov = newFov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
  }
  return {
    renderer,
    scene,
    camera,
    geometry,
    probe,
    inspect,
    drive,
    setCamera(value) {
      mode = value;
      // Switching from Chase to Fixed must never teleport the view to the
      // stale Phase 1 inspection anchor and then slowly hunt for the car.
      if (lastDrivenPose) drive(lastDrivenPose, 0, true);
      else updateCamera();
    },
    setWireframe(value) {
      material.wireframe = value;
    },
    carNdc() {
      camera.updateMatrixWorld();
      const p = chassis.position.clone().project(camera);
      return { x: p.x, y: p.y };
    },
    cameraDistance() {
      return camera.position.distanceTo(chassis.position);
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
    },
  };
}
