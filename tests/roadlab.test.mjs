import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {createSurface,CREST_S, FINISH_S, LAP, ROAD_HALF, SHOULDER, GRASS_EDGE, STRAIGHT} from "../roadlab/surface.mjs";
import {createContact,DT,stepContact} from "../roadlab/contact.mjs";
import {createDrive,stepDrive} from "../roadlab/drive.mjs";
import {stepTurnPP} from "../roadlab/turnpp.mjs";

const surface=createSurface();
const archive=name=>readFileSync(new URL("../reference/"+name,import.meta.url),"utf8");
const sections=html=>[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([,src])=>src);
const round=n=>Number(n.toFixed(5));

test("every row has a continuous shoulder, grass boundary and closing seam",()=>{
  let maxEdgeChange=0,maxRoundTrip=0;
  for (const row of surface.rows) {
    for (const side of [-1,1]) for (const edge of [ROAD_HALF,SHOULDER,GRASS_EDGE]) {
      const left=surface.sampleRoad(row.s,side*(edge-.001));
      const boundary=surface.sampleRoad(row.s,side*edge);
      const right=edge===GRASS_EDGE
        ? surface.sample(boundary.x+side*boundary.lateralDirection[0]*.001,boundary.z+side*boundary.lateralDirection[2]*.001)
        : surface.sampleRoad(row.s,side*(edge+.001));
      maxEdgeChange=Math.max(maxEdgeChange,Math.abs(right.y-left.y));
      assert(Math.abs(Math.hypot(...boundary.normal)-1)<1e-8);
      assert(Math.abs(boundary.normal.reduce((sum,n,i)=>sum+n*boundary.tangent[i],0))<1e-8);
    }
    const delta=.0001;
    for (const lateral of [-27,-12,-9.5,0,9.5,12,27]) {
      const left=surface.sampleRoad(row.s-delta,lateral), right=surface.sampleRoad(row.s+delta,lateral);
      assert(Math.hypot(left.x-right.x,left.y-right.y,left.z-right.z)<.002);
    }
    for (const vertex of row.vertices) {
      const at=surface.sample(vertex.x,vertex.z);
      maxRoundTrip=Math.max(maxRoundTrip,Math.abs(at.y-vertex.y));
      assert(vertex.y>=0);
    }
  }
  assert(maxEdgeChange<.005);
  assert(maxRoundTrip<.00001);
  console.log("mesh", {rows:surface.rows.length,triangles:surface.triangles.length,maxEdgeChange:round(maxEdgeChange),maxRoundTrip:round(maxRoundTrip)});
});

test("road and shoulder crossings retain support without an edge launch",()=>{
  let maxAir=0,maxRise=0;
  for(const s of [2,42,115,175,260,STRAIGHT+72,STRAIGHT+110,LAP-1]) for(const side of [-1,1]){
    const at=surface.sampleRoad(s);
    const [dx,,dz]=at.lateralDirection;
    const theta=Math.atan2(side*dx,side*dz);
    const speed=12;
    const state={x:at.x,z:at.z,theta,vx:Math.sin(theta)*speed,vz:Math.cos(theta)*speed,yawRate:0};
    const body=createContact(surface,state);
    for(let i=0;i<Math.round(34/speed/DT);i++){
      state.x+=state.vx*DT;state.z+=state.vz*DT;stepContact(surface,state,body);
      maxRise=Math.max(maxRise,body.rideClearance);
    }
    maxAir=Math.max(maxAir,body.maxAirTime);
  }
  console.log("edge", {maxAir:round(maxAir),maxRise:round(maxRise)});
  assert(maxAir<=.15);
  assert(maxRise<=.3);
});

test("archived Circuit fixture reproduces loss of support at its road/grass handoff",()=>{
  const [roadCode,contactCode,,game]=sections(archive("Circuit_3D_failed_integration.html"));
  const sandbox=vm.createContext({});
  sandbox.window=sandbox;
  vm.runInContext(roadCode,sandbox);
  vm.runInContext(contactCode,sandbox);
  const source=game.slice(game.indexOf("  const PI2"),game.indexOf("  // Entire circuit overview"));
  vm.runInContext(`(()=>{${source};globalThis.fixture={track,ground,ROAD_HALF};})();`,sandbox);
  const {track,ground,ROAD_HALF:half}=sandbox.fixture;
  const query=sandbox.CircuitRoad.sample;
  let worst={drop:0};
  for(const row of track.filter((_,i)=>i%4===0)) for(const side of [-1,1]){
    const dx=side*Math.cos(row.theta),dz=-side*Math.sin(row.theta);
    for(let d=half;d<half+4;d+=.10){
      const ix=row.x+dx*d,iz=row.z+dz*d;
      const y=query(ix,iz),outside=query(ix+dx*.10,iz+dz*.10);
      if(y==null||outside!=null)continue;
      const drop=y-ground(ix+dx*.10,iz+dz*.10);
      if(drop>worst.drop)worst={row,dx,dz,d,drop};
    }
  }
  assert(worst.drop>3);
  const {row,dx,dz,d}=worst,theta=Math.atan2(dx,dz);
  const startDist=d-7, vx=12*dx,vz=12*dz;
  let x=row.x+dx*startDist,z=row.z+dz*startDist;
  const body=sandbox.CircuitContact.fresh(x,z,theta,query,ground);
  for(let i=0;i<210;i++){x+=vx*DT;z+=vz*DT;sandbox.CircuitContact.substep(body,DT,{x,z,theta,vx,vz},query,ground);}
  assert(body.airSeconds>.15&&body.maxGap>.3);
  console.log("archived edge failure", {drop:round(worst.drop),air:round(body.airSeconds),excess:round(body.maxGap)});
});

test("slow and fast crest runs in both headings, with the actual drive and contact steps",()=>{
  for(const direction of [1,-1]) for(const speed of [16,48]){
    const drive=createDrive(surface,{s:CREST_S-direction*80,direction,speed});
    const {body,state}=drive,fast=speed===48;
    let lowestContacts=4,recovered=false,airSide=0,maxLandingGain=0,previousGrip=1;
    for(let i=0;i<1600;i++){
      // Low-speed test holds the initial longitudinal speed with a driver pedal trace.
      const brake=!fast && state.speed>speed+.25;
      stepDrive(surface,drive,{brake});
      if(Math.abs(state.x+70)>2) throw new Error("Crest trace left the straight");
      lowestContacts=Math.min(lowestContacts,body.contacts);
      if(previousGrip===0&&body.grip>0)assert(body.grip<.1);
      maxLandingGain=Math.max(maxLandingGain,body.grip-previousGrip);
      if(previousGrip===0)airSide=Math.max(airSide,Math.abs(state.sideAccel));
      previousGrip=body.grip;
      if(body.landings&&body.grip===1)recovered=true;
      if((state.z-(CREST_S-STRAIGHT/2))*direction>105)break;
    }
    if(fast){
      assert.equal(body.takeoffs,1);assert.equal(body.landings,1);
      assert(body.maxAirTime>.25&&body.peakTyreGap>.3&&recovered);
      assert.equal(airSide,0);
      assert(maxLandingGain<=DT/.14+1e-9);
    }else{
      assert(lowestContacts>=2);assert.equal(body.takeoffs,0);
    }
    console.log("crest",{direction,speed,lowestContacts,air:round(body.maxAirTime),
      tyreGap:round(body.peakTyreGap),landings:body.landings,maxLandingGain:round(maxLandingGain)});
  }
});

test("bank rolls the body under wheel forces and the car responds to free steering",()=>{
  const drive=createDrive(surface,{s:STRAIGHT+105,speed:13});
  const initial=drive.state.theta;
  for(let i=0;i<60;i++)stepDrive(surface,drive,{right:i%24<7,brake:i%9===0});
  assert(Math.abs(drive.state.theta-initial)>.18);
  assert(Math.abs(drive.body.roll)>.12);
  assert(drive.body.contacts>=2);
  console.log("bank",{rollDegrees:round(drive.body.roll*180/Math.PI),yawDelta:round(drive.state.theta-initial),
    contacts:drive.body.contacts});
});

test("forward finish increments the lap once, the reverse crossing does not",()=>{
  for(const direction of [1,-1]){
    const d=createDrive(surface,{s:FINISH_S-direction*2,direction,speed:14});
    d.state.lapTime=16;
    for(let i=0;i<55;i++)stepDrive(surface,d,{});
    assert.equal(d.state.lap,direction===1?2:1);
    assert.equal(d.state.best!==null,direction===1);
  }
});

test("grounded A/B parity: evaluate the exact archived horizontal update under a shared trace",()=>{
  const html=archive("V11_1_TURNpp_approved.html");
  const tune=html.slice(html.indexOf("  const HANDLING="),html.indexOf("  function setHandling"));
  const slice=html.slice(html.indexOf("    const oldX=state.x,oldZ=state.z;"),html.indexOf("    const after=closestRoad(state.x,state.z);"));
  const baseline=vm.runInNewContext(`(state,input,dt,profile)=>{
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,k)=>a+(b-a)*k;
    const turnAngle=a=>Math.atan2(Math.sin(a),Math.cos(a)),length=Math.hypot;
    const ROAD_HALF=9.5;
    const track=Array.from({length:11},(_,i)=>({x:0,z:i,y:i*profile.grade}));
    const closestRoad=()=>({dist:profile.onRoad?0:20,idx:5,at:profile});
    ${tune}
    ${slice}
  }`);
  let maxDelta=0;
  for(const profile of [
    {onRoad:true,grade:0,bank:0,curve:0,theta:0},
    {onRoad:true,grade:.12,bank:-.235,curve:.015,theta:.25},
    {onRoad:false,grade:0,bank:0,curve:0,theta:0}
  ]){
    const a={x:0,z:0,theta:.12,vx:1,vz:30,steer:0,yawRate:0,traction:1};
    const b={...a};
    for(let i=0;i<960;i++){
      const input={left:i%131<29,right:i%179<17,brake:i%240>155};
      baseline(a,input,DT,profile);stepTurnPP(b,input,DT,profile,1);
      for(const key of ["x","z","vx","vz","yawRate","theta","speed","sideAccel","traction"])
        maxDelta=Math.max(maxDelta,Math.abs(a[key]-b[key]));
    }
  }
  assert(maxDelta<1e-9);
  console.log("V11.1 A/B",{ticks:2880,maxDelta});
});

test("side slip, steering and brake input cannot create tyre forces in flight",()=>{
  const initial={x:0,z:0,theta:.2,vx:9,vz:35,steer:0,yawRate:.3,traction:1};
  const road={onRoad:true,grade:.12,bank:.2,curve:.014,theta:0};
  const ground={...initial},air={...initial},coasting={...initial};
  stepTurnPP(ground,{right:true,brake:true},DT,road,1);
  stepTurnPP(air,{right:true,brake:true},DT,road,0);
  stepTurnPP(coasting,{},DT,road,0);
  assert.equal(Math.abs(air.sideAccel),0);
  assert.equal(air.yawRate,initial.yawRate);
  assert.equal(air.vx,coasting.vx);
  assert.equal(air.vz,coasting.vz);
  assert(Math.abs(ground.sideAccel)>1);
  assert.notEqual(ground.yawRate,air.yawRate);
});
