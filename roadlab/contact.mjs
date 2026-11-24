// Four world-vertical spring rays, from mounts on the same rigid pose as the body.
export const DT = 1/120;
const MASS=930, G=9.81, K=37000, C=3900, REST=.43, TRAVEL=.74, MOUNT=-.18;
const I_PITCH=1840, I_ROLL=1460;
const BODY_FLOOR=-.465;
export const TYRE_RADIUS=.48;
export const WHEELS=[[-1.47,-2.2],[1.47,-2.2],[-1.47,2.2],[1.47,2.2]];
const CORNERS=[[-1.725,-2.9],[1.725,-2.9],[-1.725,2.9],[1.725,2.9],[0,0]];
const RESTING_Y=MOUNT*-1+TYRE_RADIUS+REST-MASS*G/(4*K);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const mountPoint={};
const cornerPoint={};
const hit={};

function posePoint(state,body,side,height,front,out) {
  const sp=Math.sin(body.pitch), cp=Math.cos(body.pitch);
  const sr=Math.sin(body.roll), cr=Math.cos(body.roll);
  const sy=Math.sin(state.theta), cy=Math.cos(state.theta);
  const y=height*cp-front*sp, z=height*sp+front*cp, x=side*cr-y*sr;
  out.x=state.x+x*cy+z*sy;
  out.z=state.z-x*sy+z*cy;
  out.y=body.y+side*sr+y*cr;
  return out;
}

export function createContact(surface,state) {
  const h=surface.sample(state.x,state.z);
  const fx=Math.sin(state.theta), fz=Math.cos(state.theta);
  const forward=h ? h.gx*fx+h.gz*fz : 0;
  const across=h ? h.gx*fz-h.gz*fx : 0;
  const body={y:(h?.y ?? 0)+RESTING_Y,vy:(h?.gx ?? 0)*state.vx+(h?.gz ?? 0)*state.vz,
    pitch:-Math.atan(forward),roll:Math.atan(across),pitchV:0,rollV:0,
    wheels:WHEELS.map(()=>({x:0,y:0,z:0,load:0})),
    contacts:4,grip:1,airborne:false,airTime:0,maxAirTime:0,takeoffs:0,landings:0,
    tyreGap:0,bodyClearance:RESTING_Y+BODY_FLOOR,rideClearance:0,peakTyreGap:0};
  measure(surface,state,body);
  return body;
}

function measure(surface,state,body) {
  let tyreGap=Infinity, bodyClearance=Infinity;
  for (let i=0;i<WHEELS.length;i++) {
    const [side,front]=WHEELS[i];
    const p=posePoint(state,body,side,MOUNT,front,mountPoint);
    const floor=surface.sample(p.x,p.z,hit);
    const length=floor ? clamp(p.y-floor.y-TYRE_RADIUS,.045,TRAVEL) : TRAVEL;
    const wheel=body.wheels[i];
    wheel.x=p.x; wheel.y=p.y-length; wheel.z=p.z;
    if (floor) tyreGap=Math.min(tyreGap,wheel.y-TYRE_RADIUS-floor.y);
  }
  for (const [side,front] of CORNERS) {
    const p=posePoint(state,body,side,BODY_FLOOR,front,cornerPoint);
    const floor=surface.sample(p.x,p.z,hit);
    if (floor) bodyClearance=Math.min(bodyClearance,p.y-floor.y);
  }
  body.tyreGap=Number.isFinite(tyreGap)?Math.max(0,tyreGap):null;
  body.bodyClearance=Number.isFinite(bodyClearance)?bodyClearance:null;
  body.rideClearance=body.bodyClearance===null?null:body.bodyClearance-(RESTING_Y+BODY_FLOOR);
  body.peakTyreGap=Math.max(body.peakTyreGap,body.tyreGap??0);
}

export function stepContact(surface,state,body,dt=DT) {
  let total=-MASS*G, pitchTorque=-body.pitchV*I_PITCH*1.55, rollTorque=-body.rollV*I_ROLL*1.75;
  let contacts=0;
  for (let i=0;i<WHEELS.length;i++) {
    const [side,front]=WHEELS[i];
    const p=posePoint(state,body,side,MOUNT,front,mountPoint);
    const floor=surface.sample(p.x,p.z,hit);
    const length=floor ? p.y-floor.y-TYRE_RADIUS : Infinity;
    const x=p.x-state.x, z=p.z-state.z;
    const floorV=floor ? floor.gx*(state.vx+state.yawRate*z)+floor.gz*(state.vz-state.yawRate*x) : 0;
    const mountV=body.vy+side*body.rollV-front*body.pitchV;
    const load=length < REST ? clamp(K*(REST-length)-C*(mountV-floorV),0,81000) : 0;
    if (load>.5) contacts++;
    body.wheels[i].load=load;
    total+=load; pitchTorque-=front*load; rollTorque+=side*load;
  }
  body.contacts=contacts;
  body.vy+=total/MASS*dt; body.y+=body.vy*dt;
  body.pitchV=clamp(body.pitchV+pitchTorque/I_PITCH*dt,-2.6,2.6);
  body.rollV=clamp(body.rollV+rollTorque/I_ROLL*dt,-2.6,2.6);
  body.pitch=clamp(body.pitch+body.pitchV*dt,-.7,.7);
  body.roll=clamp(body.roll+body.rollV*dt,-.55,.55);
  measure(surface,state,body);
  // No height correction or jump impulse. The threshold is for metrics only.
  const flight=contacts===0&&(body.tyreGap??1)>.018;
  if (flight) {
    if (!body.airborne) body.takeoffs++;
    body.airTime+=dt; body.maxAirTime=Math.max(body.maxAirTime,body.airTime);
  } else if (contacts>0) {
    if (body.airborne) body.landings++;
    body.airTime=0;
  }
  body.airborne=flight || (body.airborne && contacts===0);
  body.grip=body.airborne?0:contacts>0?Math.min(1,body.grip+dt/.14):body.grip;
  return body;
}
