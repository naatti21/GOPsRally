import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {materialize,loadVehicle,VERSIONS,saveJSON} from './long-run/versions.mjs';
import {simulate} from './long-run/simulate.mjs';
export function scenarios(quick=false) {
  const out=[];
  for(const speed of [70,100,126])for(const pulse of [.35,.65,1.8]){
    out.push({id:`release-${speed}-${pulse}`,environment:'open',mode:'pulse',speed,pulse,duration:6});
    for(const delay of [.1,.2,.3,.45])for(const hold of [.2,.3,.4])out.push({id:`catch-${speed}-${pulse}-${delay}-${hold}`,environment:'open',mode:'pulse',speed,pulse,delay,hold,duration:6});
  }
  for(const environment of ['oval-flat','oval-low','oval-transition','oval-banked','oval-uneven','real-full','real-uniform','real-flat'])
    for(const speed of [70,100,126])out.push({id:`${environment}-${speed}`,environment,mode:'driver',speed,duration:150,delay:.2,period:.2});
  for(const environment of ['oval-flat','real-full'])for(const delay of [.1,.3,.45])out.push({id:`${environment}-delay-${delay}`,environment,mode:'driver',speed:100,duration:150,delay,period:.2});
  for(const speed of [70,100,126])out.push({id:`chicane-${speed}`,environment:'open',mode:'chicane',speed,duration:150});
  for(const speed of [70,100,126])out.push({id:`sustained-${speed}`,environment:'open',mode:'pulse',speed,pulse:15,duration:150});
  for(const environment of ['oval-flat','real-full'])out.push({id:`${environment}-pre-corner`,environment,mode:'driver',speed:100,duration:180,delay:.2,period:.2,brakeMode:'pre-corner'});
  return quick?out.filter(s=>['release-100-0.65','catch-100-0.65-0.3-0.3','oval-flat-100','real-full-100'].includes(s.id)):out;
}
const output=resolve(process.env.LONG_RUN_OUTPUT||'lab-results/full');mkdirSync(output,{recursive:true});
const quick=process.argv.includes('--quick');
const versions=process.env.LONG_RUN_VERSIONS?.split(',')||Object.keys(VERSIONS);
const results=[];
for(const name of versions){
  const version=materialize(name),factory=await loadVehicle(version);
  const entry={version,scenarios:[]};results.push(entry);
  for(const s of scenarios(quick)){
    const file=join(output,`${name}-${s.id}.jsonl.gz`);
    const {summary,metadata}=simulate(factory,s,{traceFile:file});
    entry.scenarios.push({scenario:s,summary,metadata,trace:file.split('/').at(-1)});
    console.log(name,s.id,JSON.stringify({spins:summary.spinouts,off:summary.offRoadSeconds,cycles:summary.oscillationCycles,laps:summary.laps.length}));
    saveJSON(join(output,'summary.json'),{schema:1,node:process.version,dt:1/60,quick,results});
  }
}
