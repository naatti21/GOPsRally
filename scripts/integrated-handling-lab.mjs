import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {materialize,loadVehicle,VERSIONS,saveJSON,hash} from './long-run/versions.mjs';
import {simulate} from './long-run/simulate.mjs';
const output=resolve(process.env.HANDLING_OUTPUT||'lab-results/integrated');mkdirSync(output,{recursive:true});
const versions={...VERSIONS,v046wgt:'8ce83a859740c76769769a6309ffbaa34b30c739',candidate:null};
export function cases(){
 const s=[];
 for(const speed of [70,100,126])for(const pulse of [.35,.65,1.8]){
 s.push({id:`release-${speed}-${pulse}`,environment:'open',mode:'pulse',speed,pulse,duration:6});
 for(const delay of [.1,.2,.3,.45])for(const hold of [.2,.3,.4,.45])s.push({id:`catch-${speed}-${pulse}-${delay}-${hold}`,environment:'open',mode:'pulse',speed,pulse,delay,hold,duration:6});
 }
 for(const surfaceType of [1,2,3])for(const speed of [70,100,126])for(const hold of [0,.2,.3,.4,.45])s.push({id:`surface-${surfaceType}-${speed}-${hold}`,environment:'open',surfaceType,mode:'pulse',speed,pulse:.65,delay:.3,hold,duration:6});
 for(const environment of ['oval-flat','oval-low','oval-transition','oval-banked','oval-uneven','real-full','real-uniform','real-flat'])for(const speed of [70,100,126])s.push({id:`${environment}-${speed}`,environment,mode:'driver',speed,duration:150,delay:.2,period:.2});
 for(const environment of ['oval-flat','real-full'])for(const delay of [.1,.3,.45])s.push({id:`${environment}-delay-${delay}`,environment,mode:'driver',speed:100,duration:150,delay,period:.2});
 for(const environment of ['oval-flat','real-full'])for(const period of [.3,.4])s.push({id:`${environment}-hold-${period}`,environment,mode:'driver',speed:100,duration:150,delay:.2,period});
 for(const speed of [70,100,126])for(const mode of ['chicane','pulse'])s.push({id:`${mode}-long-${speed}`,environment:'open',mode,speed,pulse:15,duration:150});
 for(const environment of ['oval-flat','real-full'])s.push({id:`${environment}-pre-corner`,environment,mode:'driver',speed:100,duration:180,delay:.2,period:.2,brakeMode:'pre-corner'});
 for(const lineOffset of [-3,0,3])s.push({id:`line-${lineOffset}`,environment:'real-full',mode:'driver',speed:100,duration:600,delay:.2,period:.2,brakeMode:'pre-corner',lineOffset});
 return s;
}
const results=[];
for(const name of (process.env.HANDLING_VERSIONS||Object.keys(versions).join(',')).split(',')){
 const version=name==='candidate'?{name,sha:'working-tree',sources:Object.fromEntries(['vehicle.js','digital-steering.js','tire.js','contact-tire.js','drive-profile.js'].map(f=>[f,hash(readFileSync('v04/src/physics/'+f))]))}:materialize(name,versions[name]);
 const factory=name==='candidate'?await import('../v04/src/physics/vehicle.js'):await loadVehicle(version);
 const entry={version,scenarios:[]};results.push(entry);
 for(const s of cases()){
  if(process.env.HANDLING_CASES&&!process.env.HANDLING_CASES.split(',').includes(s.id))continue;
  const trace=['catch-100-0.65-0.3-0.4','release-100-1.8','real-full-100'].includes(s.id)?join(output,`${name}-${s.id}.jsonl.gz`):undefined;
  const {summary,metadata,rows}=simulate(factory,s,{traceFile:trace});
  // Recovery is independent from a road on open fixtures; require a full
  // second of low slip/yaw after the final command, not a single crossing.
  const after=(s.pulse??0)+(s.delay??0)+(s.hold??0);let healthy=0,recoverySeconds=null;
  for(const r of rows)if(r.t>after){healthy=r.speed>5&&Math.abs(r.beta)<5&&Math.abs(r.yaw)<10?healthy+1:0;if(healthy===60&&recoverySeconds===null)recoverySeconds=r.t-after-1;}
  summary.openRecoverySeconds=s.mode==='pulse'?recoverySeconds:null;
  entry.scenarios.push({scenario:s,summary,metadata,trace:trace?.split('/').at(-1)});
  saveJSON(join(output,'summary.json'),{schema:1,node:process.version,dt:1/60,results});
  console.log(name,s.id,summary.peakSlip.toFixed(2),summary.spinouts,summary.offRoadSeconds.toFixed(2),summary.laps.length);
 }
}
