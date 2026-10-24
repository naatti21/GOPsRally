import * as THREE from "three";
import { WHEELS, TUNE } from "../physics/vehicle.js";
import { sampleSurface } from "../world/surface.js";
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  let mode = "fixed",
    anchor = null;
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
  function drive(pose, dt) {
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
    const lead = Math.min(25, Math.abs(pose.speed) * 0.5),
      target = chassis.position.clone().addScaledVector(forward, lead);
    const height = 32 + Math.min(20, Math.abs(pose.speed) * 0.4);
    const offset =
      mode === "fixed"
        ? new THREE.Vector3(0, height, 26)
        : forward
            .clone()
            .multiplyScalar(-30)
            .add(new THREE.Vector3(0, height, 0));
    camera.position.lerp(target.clone().add(offset), 1 - Math.exp(-dt * 8));
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
      updateCamera();
    },
    setWireframe(value) {
      material.wireframe = value;
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
