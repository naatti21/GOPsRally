// Existing corner oracle retained unchanged; compare archived factories.
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {materialize,VERSIONS,saveJSON} from './long-run/versions.mjs';
const results=[];
for(const [name,sha] of Object.entries({...VERSIONS,v046wgt:'8ce83a859740c76769769a6309ffbaa34b30c739',candidate:null})){
 const module=sha?join(materialize(name,sha).root,'v04/src/physics/vehicle.js'):resolve('v04/src/physics/vehicle.js');
 const env={...process.env,RALLY_VEHICLE_MODULE:module};
 const corner=JSON.parse(execFileSync(process.execPath,['scripts/corner-line-benchmark.mjs'],{env,maxBuffer:16e6}));
 const straight=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',"import {measureStraight} from './scripts/arcade-dynamics-benchmark.mjs';console.log(JSON.stringify(measureStraight()))"],{env,maxBuffer:16e6}));
 results.push({name,sha,corner,straight});console.log(name,'done');
}
saveJSON('lab-results/integrated-extra.json',{results});
