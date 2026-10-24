import './style.css';
import {buildSurface,sampleSurface} from './world/surface.js';
import {createPhysics} from './physics/world.js';
import {createScene} from './render/scene.js';
import {makeClock} from './game/contracts.js';
const status=document.querySelector('#status');
async function start(){
  const surface=buildSurface(),physics=await createPhysics(surface),view=createScene(document.querySelector('canvas'),surface),clock=makeClock();
  let anchor=view.inspect(0),body=null,previousTime=performance.now(),previous=null;
  const updateStatus=()=>{const hit=physics.rayAt(anchor.x+.137,anchor.z+.219),mesh=sampleSurface(surface,anchor.x+.137,anchor.z+.219);status.textContent=`${surface.indices.length/3} triangles · collider error ${Math.abs(hit.height-mesh.height).toFixed(5)} m`;};
  document.querySelector('#section').onchange=e=>{anchor=view.inspect(Number(e.target.value));reset();};
  for(const button of document.querySelectorAll('[data-camera]'))button.onclick=()=>{for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b===button));view.setCamera(button.dataset.camera);};
  const reset=()=>{if(body){physics.world.removeRigidBody(body);body=null}view.probe.visible=false;clock.reset();previous=null;updateStatus();};
  document.querySelector('#reset').onclick=reset;
  document.querySelector('#drop').onclick=()=>{reset();body=physics.drop(anchor.x,sampleSurface(surface,anchor.x,anchor.z).height+9,anchor.z);physics.addProbe(body);previous={...body.translation()};view.probe.visible=true;};
  document.querySelector('#wireframe').onchange=e=>view.setWireframe(e.target.checked);
  document.addEventListener('visibilitychange',()=>{previousTime=performance.now();clock.reset()});
  const frame=now=>{const dt=(now-previousTime)/1000;previousTime=now;
    const {alpha}=clock.advance(document.hidden?0:dt,()=>{if(body)previous={...body.translation()};physics.world.step()});
    if(body){const p=body.translation();view.probe.position.set(previous.x+(p.x-previous.x)*alpha,previous.y+(p.y-previous.y)*alpha,previous.z+(p.z-previous.z)*alpha)}
    view.render();requestAnimationFrame(frame);
  };requestAnimationFrame(frame);updateStatus();
  // Read-only inspection evidence: no renderer mock or simulation escape hatch.
  window.rallyFoundation={getSnapshot:()=>({vertices:surface.positions.length/3,triangles:surface.indices.length/3,drawCalls:view.renderer.info.render.calls,probe:body?{...body.translation()}:null,anchor:{...anchor},renderer:view.renderer.getContext().getParameter(view.renderer.getContext().VERSION)})};
  document.body.dataset.ready='true';
  if(import.meta.env.PROD&&'serviceWorker'in navigator)await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL});
}
start().catch(error=>{console.error(error);status.textContent=`Unable to start 3D preview: ${error.message}. WebGL2 is required.`;document.body.dataset.ready='error'});
