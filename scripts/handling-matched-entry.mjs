// Causal diagnostic only, NOT the shipped candidate: replay the legacy entry
// with its actual forces, switch only the steering controller at correction.
// No body state is copied/reset and the simulator forbids during-run writes.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {materialize,loadVehicle,saveJSON} from './long-run/versions.mjs';
import {simulate} from './long-run/simulate.mjs';
const baseline=await loadVehicle(materialize('v046'));
const results=[];
for(const speed of [70,100,126])for(const pulse of [.65,1.8])for(const delay of [.1,.3,.45]){
 const v=materialize('hybrid','e4978c53338b58ef7a9eaefeb295b97c296db24c');
 const path=join(v.root,'v04/src/physics/vehicle.js');let src=readFileSync(path,'utf8');
 src=src.replace('measuredSlip }','measuredSlip, responsiveSteering }');
 src=src.replace('  let steeringState =','  let enabledSteps = 0;\n  let steeringState =');
 const from=src.indexOf('    steeringState = digitalSteering');const end=src.indexOf('    const driveManagement',from);
 const integrated=src.slice(from,end);
 if(from<0||end<0)throw Error('Missing controller replacement');
 src=src.slice(0,from)+`    if(enabled)enabledSteps++;
    if(enabledSteps <= ${Math.round((pulse+delay)*60)}) {
      steer=responsiveSteering(intent.steer,v,bodySideSlip);
      rackAngle+=(steer-rackAngle)*(1-Math.exp(-dt/TUNE.steeringTime));
      steeringState={direction:0,hold:0,rack:rackAngle};
    } else {
${integrated}    }
`+src.slice(end);
 writeFileSync(path,src);const hybrid=await loadVehicle(v);
 for(const hold of [.2,.3,.4,.45]){
  const scenario={environment:'open',mode:'pulse',speed,pulse,delay,hold,duration:6};
  const b=simulate(baseline,scenario),c=simulate(hybrid,scenario);
  const n=Math.round((pulse+delay)*60);
  for(let i=0;i<n;i++)for(const key of ['x','y','z','beta','yaw','rack','speed'])
   if(b.rows[i][key]!==c.rows[i][key])throw Error(`Entry mismatch ${i}/${key}`);
  results.push({scenario,identicalEntrySteps:n,baseline:b.summary,hybrid:c.summary});
 }
}
saveJSON('lab-results/matched-entry.json',{warning:'Counterfactual steering-only switch after identical natural entry; not a normal candidate run. No chassis state write after initial spawn.',results});
console.log(results.length,'paired entry-state checks passed');
