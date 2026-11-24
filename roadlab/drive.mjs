import { FINISH_S, LAP, ROAD_HALF } from "./surface.mjs";
import { DT, createContact, stepContact } from "./contact.mjs";
import { stepTurnPP } from "./turnpp.mjs";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createDrive(surface,{s=FINISH_S,direction=1,speed=0,lateral=0}={}) {
  const at=surface.sampleRoad(s,lateral);
  const theta=at.theta+(direction<0?Math.PI:0);
  const state={x:at.x,z:at.z,theta,vx:Math.sin(theta)*speed,vz:Math.cos(theta)*speed,
    speed,steer:0,yawRate:0,traction:1,sideAccel:0,lap:1,lapTime:0,best:null,safeS:s,
    material:at.material};
  return {state,body:createContact(surface,state),camera:{x:state.x,y:at.y,z:state.z},
    scratch:{},road:{},finish:surface.sampleRoad(FINISH_S)};
}

export function stepDrive(surface,drive,input,dt=DT,portrait=true) {
  const {state,body,camera,scratch,road,finish}=drive;
  const before=surface.sample(state.x,state.z,scratch);
  road.onRoad=Boolean(before && Math.abs(before.lateral)<ROAD_HALF+.6);
  road.theta=before?.theta??state.theta;
  road.bank=before?.bank??0; road.curve=before?.curve??0;
  road.grade=road.onRoad ? before.gx*Math.sin(road.theta)+before.gz*Math.cos(road.theta) : 0;
  if (road.onRoad && Math.abs(before.lateral)<ROAD_HALF*.7 && body.grip>0) state.safeS=before.s;
  const acrossFinish=finish.tangent;
  const pre=(state.x-finish.x)*acrossFinish[0]+(state.z-finish.z)*acrossFinish[2];
  stepTurnPP(state,input,dt,road,body.grip);
  stepContact(surface,state,body,dt);
  state.lapTime+=dt;
  const after=surface.sample(state.x,state.z,scratch);
  state.material=after?.material??"grass";
  const post=(state.x-finish.x)*acrossFinish[0]+(state.z-finish.z)*acrossFinish[2];
  if (after?.s!=null) {
    const d=Math.abs(after.s-FINISH_S);
    if (pre<0&&post>=0&&Math.min(d,LAP-d)<8&&Math.abs(after.lateral)<ROAD_HALF+.6&&
        state.vx*acrossFinish[0]+state.vz*acrossFinish[2]>3&&state.lapTime>15) {
      state.best=Math.min(state.best??Infinity,state.lapTime);
      state.lap++;state.lapTime=0;
    }
  }
  // V11.1 velocity lookahead and smoothing. Sample terrain, never vehicle height.
  const lead=Math.min(9+clamp(state.speed/50,0,1)*25,portrait?34:26);
  const speed=Math.max(1,state.speed);
  const follow=1-Math.exp(-dt*(5.5+6*clamp(state.speed/55,0,1)));
  camera.x+=(state.x+state.vx/speed*lead-camera.x)*follow;
  camera.z+=(state.z+state.vz/speed*lead-camera.z)*follow;
  const ground=surface.sample(camera.x,camera.z,scratch);
  if (ground) camera.y+=(ground.y-camera.y)*follow;
}
