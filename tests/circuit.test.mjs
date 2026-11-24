import assert from "node:assert/strict";
import test from "node:test";
import {circuit} from "../roadlab/circuit.mjs";
import {createDrive,stepDrive} from "../roadlab/drive.mjs";
import {createRace,stepRace,recoverRace,readBest,saveBest} from "../roadlab/race.mjs";
import {createSurface,ROAD_HALF,SHOULDER} from "../roadlab/surface.mjs";
import {raceButtons} from "./circuit-driver.mjs";

const surface=createSurface(circuit);
const round=n=>Number(n.toFixed(5));

test("all circuit rows, including the seam, meet the road and both grass boundaries",()=>{
  assert(surface.lap>=1800&&surface.lap<=2400);
  let gap=0;
  for(const row of surface.rows) for(const edge of [ROAD_HALF,SHOULDER,31,42]){
    for(const sign of [-1,1]){
      const before=surface.sampleRoad(row.s,sign*(edge-.001));
      const after=edge===42
        ? surface.sample(before.x+sign*.002*Math.cos(row.theta),before.z-sign*.002*Math.sin(row.theta))
        : surface.sampleRoad(row.s,sign*(edge+.001));
      gap=Math.max(gap,Math.abs(before.y-after.y));
      assert.equal(surface.sample(before.x,before.z).y,before.y);
    }
  }
  for(const row of surface.rows) for(const point of row.vertices){
    assert(Math.abs(surface.sample(point.x,point.z).y-point.y)<1e-5);
  }
  for(const lateral of circuit.offsets){
    const a=surface.sampleRoad(surface.lap-.001,lateral),b=surface.sampleRoad(.001,lateral);
    assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<.004);
  }
  assert(gap<.002);
  console.log("circuit mesh",{length:round(surface.lap),triangles:surface.triangles.length,edgeGap:round(gap)});
});

test("three driven laps with steering and braking, no unintended takeoffs",()=>{
  const race=createRace(surface);
  let takeoffs=0, landings=0, brakes=0;
  for(let i=0;i<42000&&!race.finished;i++){
    const {state,body}=race.drive;
    const old=body.takeoffs;
    const input=raceButtons(surface,state);
    if(input.brake)brakes++;
    stepRace(surface,race,input);
    if(body.takeoffs!==old){
      takeoffs++;
      const s=surface.sample(state.x,state.z).s;
      assert(Math.abs(s-circuit.crest)<40,"takeoff outside the crest");
    }
    landings=body.landings;
    assert(!race.missed);
  }
  assert(race.finished&&race.laps.length===3);
  assert.equal(takeoffs,3);
  assert.equal(landings,3);
  assert(brakes>300);
  const t=race.lapTicks;
  stepRace(surface,race,{});
  assert.equal(race.lapTicks,t);
  console.log("race",{laps:race.laps.map(round),takeoffs,landings,brakes});
});

test("slower full lap and repeated grass crossings have no false flight",()=>{
  const race=createRace(surface);
  for(let i=0;i<27000&&race.laps.length===0;i++){
    stepRace(surface,race,raceButtons(surface,race.drive.state,18));
  }
  assert.equal(race.laps.length,1);
  assert.equal(race.drive.body.takeoffs,0);
  let climb=0,air=0,crossings=0;
  for(let s=2;s<surface.lap;s+=46)for(const direction of [-1,1]){
    const drive=createDrive(surface,{s,speed:12,lateral:direction*7.5});
    const {state,body}=drive;
    state.theta+=direction*.63;
    state.vx=Math.sin(state.theta)*12;state.vz=Math.cos(state.theta)*12;
    for(let i=0;i<170;i++){
      stepDrive(surface,drive,{},undefined,true,false);
      climb=Math.max(climb,body.rideClearance??0);
      air=Math.max(air,body.maxAirTime);
    }
    assert.equal(state.material,"grass");
    crossings++;
  }
  console.log("no false flight",{slowLap:round(race.laps[0]),crossings,air:round(air),excessClearance:round(climb)});
  assert(air<.15&&climb<.3);
});

test("crest is bidirectional at speed and real banking changes chassis attitude",()=>{
  for(const direction of [-1,1]){
    const drive=createDrive(surface,{s:circuit.crest-direction*62,direction,speed:48});
    for(let i=0;i<410;i++)stepDrive(surface,drive,{});
    const {body}=drive;
    assert.equal(body.takeoffs,1);
    assert.equal(body.landings,1);
    assert(body.peakTyreGap>2);
    console.log("bidirectional crest",{direction,air:round(body.maxAirTime),gap:round(body.peakTyreGap)});
  }
  const drive=createDrive(surface,{s:circuit.bankCenter,speed:18});
  for(let i=0;i<85;i++)stepDrive(surface,drive,raceButtons(surface,drive.state,18));
  assert(Math.abs(drive.body.roll)>.1);
  assert(drive.body.contacts>=3);
});

test("ordered, forward gates reject finish camping and off-road shortcuts",()=>{
  const race=createRace(surface);
  for (const direction of [-1,1]){
    race.drive=createDrive(surface,{s:surface.finish-direction*3,direction,speed:15});
    for(let i=0;i<50;i++)stepRace(surface,race,{});
    assert.equal(race.next,0);
  }
  const gate=race.gates[0];
  race.drive=createDrive(surface,{s:gate.s-5,lateral:17,speed:17});
  for(let i=0;i<165;i++)stepRace(surface,race,{});
  assert.equal(race.next,0);
  assert.equal(race.missed,true);
  const duration=race.lapTicks;
  recoverRace(surface,race);
  assert.equal(race.lapTicks,duration+360);
  assert.equal(race.drive.state.speed,0);
  for(let i=0;i<670&&race.next===0;i++)stepRace(surface,race,{});
  assert.equal(race.next,1);
  assert.equal(race.missed,false);
  assert.deepEqual(race.laps,[]);
});

test("best lap in local storage survives restarts and invalid storage is safe",()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  assert.equal(readBest(storage),null);
  saveBest(storage,51.234);
  assert.equal(createRace(surface,readBest(storage)).best,51.234);
  saveBest(storage,Infinity);
  assert.equal(readBest(storage),null);
  const denied={getItem(){throw Error();},setItem(){throw Error();}};
  assert.equal(readBest(denied),null);
  assert.doesNotThrow(()=>saveBest(denied,50));
});
