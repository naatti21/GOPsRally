import * as THREE from 'three';
import {sampleSurface} from '../world/surface.js';
export function createScene(canvas,surface){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x9bb8b7);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x9bb8b7,180,450);
  scene.add(new THREE.HemisphereLight(0xdcefff,0x495536,2.5));
  const sun=new THREE.DirectionalLight(0xfff0d5,2.5);sun.position.set(-80,120,50);scene.add(sun);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.setAttribute('color',new THREE.BufferAttribute(surface.colors,3));geometry.computeVertexNormals();
  // Flat shading uses the same face normal as the collision triangle, not a different smoothed surface.
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
  scene.add(new THREE.Mesh(geometry,material));
  const chassis=new THREE.Group();const box=new THREE.Mesh(new THREE.BoxGeometry(1.8,.65,3.8),new THREE.MeshStandardMaterial({color:0xf0b83b,roughness:.7}));chassis.add(box);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.5,.55,1.9),new THREE.MeshStandardMaterial({color:0x243941,roughness:.5}));cabin.position.y=.55;chassis.add(cabin);scene.add(chassis);
  const wheels=Array.from({length:4},()=>{const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.24,12),new THREE.MeshStandardMaterial({color:0x1c2427}));wheel.rotation.z=Math.PI/2;scene.add(wheel);return wheel});
  const probe=new THREE.Mesh(new THREE.SphereGeometry(.45,12,8),new THREE.MeshStandardMaterial({color:0xee6b47}));probe.visible=false;scene.add(probe);
  const camera=new THREE.PerspectiveCamera(50,1,.1,600);let mode='fixed',anchor=null;
  const sites=[0,.18,.31,.51,.70,.61].map(t=>surface.track.nodes[Math.floor(t*surface.track.nodes.length)]);
  function inspect(index){
    anchor=sites[index];const ground=sampleSurface(surface,anchor.x,anchor.z);const up=new THREE.Vector3(...ground.normal);
    const forward=new THREE.Vector3(anchor.tx,0,anchor.tz);forward.addScaledVector(up,-forward.dot(up)).normalize();
    const right=new THREE.Vector3().crossVectors(forward,up).normalize();
    const matrix=new THREE.Matrix4().makeBasis(right,up,forward.clone().negate());
    chassis.quaternion.setFromRotationMatrix(matrix);chassis.position.set(anchor.x,ground.height+.85,anchor.z);
    // Static inspection fixture only. No animated suspension or fake driving.
    wheels.forEach((wheel,i)=>{const p=new THREE.Vector3((i%2?1:-1)*.94,0,i<2?-1.2:1.2).applyQuaternion(chassis.quaternion).add(chassis.position);const hit=sampleSurface(surface,p.x,p.z);wheel.position.set(p.x,hit.height+.35,p.z);wheel.quaternion.copy(chassis.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));});
    updateCamera();return {x:anchor.x,y:ground.height,z:anchor.z};
  }
  function updateCamera(){
    if(!anchor)return;const p=chassis.position;
    const offset=mode==='fixed'?new THREE.Vector3(0,55,40):new THREE.Vector3(-anchor.tx*38,30,-anchor.tz*38);
    camera.position.copy(p).add(offset);camera.lookAt(p);
  }
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();inspect(0);
  return {renderer,scene,camera,geometry,probe,inspect,setCamera(value){mode=value;updateCamera()},setWireframe(value){material.wireframe=value},render(){renderer.render(scene,camera)},dispose(){observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});renderer.dispose()}};
}
