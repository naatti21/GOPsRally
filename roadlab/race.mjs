import {ROAD_HALF} from "./surface.mjs";
import {DT} from "./contact.mjs";
import {createDrive,stepDrive} from "./drive.mjs";

export const RACE_LAPS=3;
export const RECOVERY_SECONDS=3;
const CHECKPOINTS=24;
const BEST_KEY="gops-rally.gravel-ridge.best-lap.v1";

export function readBest(storage) {
  try {
    const value=Number(storage.getItem(BEST_KEY));
    return value>0&&Number.isFinite(value)?value:null;
  } catch { return null; }
}

export function saveBest(storage,seconds) {
  try { storage.setItem(BEST_KEY,String(seconds)); } catch { /* Private mode or quota. */ }
}

export function createRace(surface,best=null) {
  const gates=Array.from({length:CHECKPOINTS},(_,i)=>{
    const s=(surface.finish+(i+1)*surface.lap/CHECKPOINTS)%surface.lap;
    const {x,z,theta}=surface.sampleRoad(s);
    return {s,x,z,fx:Math.sin(theta),fz:Math.cos(theta)};
  });
  const safeS=surface.finish+5;
  return {gates,next:0,drive:createDrive(surface,{s:safeS}),safeS,laps:[],
    lapTicks:0,best,finished:false,missed:false};
}

export function recoverRace(surface,race) {
  race.drive=createDrive(surface,{s:race.safeS});
  race.lapTicks+=Math.round(RECOVERY_SECONDS/DT);
  race.missed=false;
}

export function stepRace(surface,race,input,portrait=true) {
  if (race.finished) return;
  const {drive}=race;
  const {state}=drive;
  const gate=race.gates[race.next];
  const pre=(state.x-gate.x)*gate.fx+(state.z-gate.z)*gate.fz;
  stepDrive(surface,drive,input,DT,portrait,false);
  race.lapTicks++;
  const post=(state.x-gate.x)*gate.fx+(state.z-gate.z)*gate.fz;
  const across=(state.x-gate.x)*gate.fz-(state.z-gate.z)*gate.fx;
  if(pre<0 && post>=0 && Math.abs(across)<=ROAD_HALF+.6 && state.material!=="grass") {
    race.next=(race.next+1)%race.gates.length;
    race.missed=false;
    if(race.next===0) {
      const seconds=race.lapTicks*DT;
      race.laps.push(seconds);
      race.best=Math.min(race.best??Infinity,seconds);
      race.lapTicks=0;
      race.finished=race.laps.length===RACE_LAPS;
    }
  }
  const at=surface.sample(state.x,state.z,drive.scratch);
  if(at?.s==null)return;
  const nextGate=race.gates[race.next];
  const ahead=(at.s-nextGate.s+surface.lap)%surface.lap;
  if(ahead>12 && ahead<surface.lap/2)race.missed=true;
  if(ahead>surface.lap-surface.lap/race.gates.length-6 &&
      Math.abs(at.lateral)<ROAD_HALF*.65 && drive.body.contacts>=3){
    race.safeS=at.s;
  }
}
