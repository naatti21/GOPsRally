import RAPIER from '@dimforge/rapier3d-compat';
let ready;
export async function createPhysics(surface){
  ready??=RAPIER.init();await ready;
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=1/60;
  const collider=world.createCollider(RAPIER.ColliderDesc.trimesh(surface.positions,surface.indices).setFriction(.85));
  world.step();
  return {world,collider,rayAt(x,z){const hit=world.castRayAndGetNormal(new RAPIER.Ray({x,y:100,z},{x:0,y:-1,z:0}),200,true);return hit?{height:100-hit.timeOfImpact,normal:hit.normal}:null},
    drop(x,y,z){return world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setCcdEnabled(true))},
    addProbe(body){world.createCollider(RAPIER.ColliderDesc.ball(.45).setMass(5).setRestitution(.05),body)},
    dispose(){world.free()}};
}
