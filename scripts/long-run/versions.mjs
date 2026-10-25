import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const VERSIONS = Object.freeze({
  v044:'ca746502855fddbac7a99101ff400437d672c78a',
  v045:'9cc39de4c6616a82a69081fc83c0a0d656a4265f',
  v045b:'bac49764e38f3fd220b3af67a08035af5463836d',
  v046:'bd5b3222c6d18014048dbc65d09c2566fa6446ed',
});
export const hash = data => createHash('sha256').update(data).digest('hex');
export function materialize(name, sha = VERSIONS[name]) {
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw Error('An exact commit is required');
  const root = mkdtempSync(join(tmpdir(),'rally-long-'));
  const archive = execFileSync('git',['archive',sha,'v04/src','package.json','package-lock.json'],{maxBuffer:16e6});
  const tar = join(root,'source.tar'); writeFileSync(tar,archive);
  execFileSync('tar',['xf',tar,'-C',root]);
  const lock = readFileSync(join(root,'package-lock.json'));
  const dependencies = JSON.parse(lock).packages;
  const installed = JSON.parse(readFileSync('package-lock.json')).packages;
  for (const [key,p] of Object.entries(dependencies)) {
    if (key && (installed[key]?.version !== p.version || installed[key]?.integrity !== p.integrity))
      throw Error(`Dependency mismatch: ${key}`);
    if (key && !p.optional && JSON.parse(readFileSync(join(key,'package.json'))).version !== p.version)
      throw Error(`Installed dependency mismatch: ${key}`);
  }
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  return {name,sha,root,sourceArchiveSha256:hash(archive),lockSha256:hash(lock),
    dependencies:Object.fromEntries(Object.entries(dependencies).filter(([k])=>k).map(([k,v])=>[k,v.version]))};
}
export async function loadVehicle(version) {
  return import(pathToFileURL(join(version.root,'v04/src/physics/vehicle.js')));
}
export function saveJSON(file,data) { mkdirSync(resolve(file,'..'),{recursive:true}); writeFileSync(file,JSON.stringify(data,null,2)+'\n'); }
