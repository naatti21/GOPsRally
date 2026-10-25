// Temporary archived copies ONLY. One parameter family per intervention.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {materialize,loadVehicle,saveJSON,hash} from './versions.mjs';
import {simulate} from './simulate.mjs';
const output=resolve(process.env.LONG_RUN_OUTPUT||'lab-results/sweep');mkdirSync(output,{recursive:true});
const variants={
 baseline:[],
 rack:[['vehicle.js','steeringTime: 0.07','steeringTime: 0.12']],
 authority:[['tire.js','Math.abs(speedMps) / 33','Math.abs(speedMps) / 22']],
 slopes:[['contact-tire.js','frontSlope: 0.145','frontSlope: 0.18'],['contact-tire.js','rearSlope: 0.12','rearSlope: 0.16']],
 postPeak:[['contact-tire.js','frontLoss: 0.05','frontLoss: 0.02'],['contact-tire.js','rearLoss: 0.08','rearLoss: 0.02']],
 relaxation:[['contact-tire.js','relaxationLength: 0.8','relaxationLength: 0.35']],
 damping:[['vehicle.js','.setAngularDamping(0.15)','.setAngularDamping(0.3)']],
 suspension:[['vehicle.js','compression: 4.1','compression: 5.2'],['vehicle.js','rebound: 4.8','rebound: 5.4']],
 driveSplit:[['drive-profile.js','rearShare:0.6-0.085*lock','rearShare: 0.5 - 0.04 * lock']],
 cornerTorque:[['drive-profile.js','1-0.20*lock*lock-0.12*slip','1 - 0.38 * lock * lock - 0.16 * slip']],
};
const baseline=JSON.parse(readFileSync('lab-results/full/summary.json'));
if(baseline.results.length!==4||baseline.results.some(v=>!v.scenarios.some(s=>s.scenario.id==='real-full-100')))
 throw Error('Finish the four-version diagnosis before tuning');
const scenarios=[
 {id:'release',environment:'open',mode:'pulse',speed:100,pulse:.65,duration:6},
 ...[.2,.3,.45].map(delay=>({id:`catch-${delay}`,environment:'open',mode:'pulse',speed:100,pulse:.65,delay,hold:.3,duration:6})),
 ...['oval-flat','real-full'].map(environment=>({id:environment,environment,mode:'driver',speed:100,duration:150,delay:.2,period:.2})),
];
const results=[];
for(const [name,patches] of Object.entries(variants)){
 if(process.env.SWEEP_VARIANTS&&!process.env.SWEEP_VARIANTS.split(',').includes(name))continue;
 const version=materialize('v046'),applied=[];
 for(const [file,from,to] of patches){const path=join(version.root,'v04/src/physics',file),before=readFileSync(path,'utf8');
  if(before.split(from).length!==2)throw Error(`Non-unique/missing mutation ${name} ${from}`);
  const after=before.replace(from,to);writeFileSync(path,after);applied.push({file,from,to,beforeSha256:hash(before),afterSha256:hash(after)});
 }
 const factory=await loadVehicle(version),runs=[];
 for(const scenario of scenarios){const {summary}=simulate(factory,scenario,{traceFile:join(output,`${name}-${scenario.id}.jsonl.gz`)});runs.push({scenario,summary});console.log(name,scenario.id,summary.spinouts,summary.oscillationCycles,summary.offRoadSeconds);}
 results.push({name,baseSha:version.sha,patches:applied,runs});saveJSON(join(output,'summary.json'),{selection:'Exploratory single-family screen; not a tuned release or independent validation',results});
}
