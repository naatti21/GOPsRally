import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/v04/',import.meta.url);
async function walk(dir=''){const entries=await readdir(new URL(dir,root),{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(`${dir}${e.name}/`):`${dir}${e.name}`))).flat()}
const files=(await walk()).filter(f=>f!=='sw.js').sort();
const hash=createHash('sha256');for(const f of files)hash.update(await readFile(new URL(f,root)));
const name=`gopsrally-v04-foundation-${hash.digest('hex').slice(0,16)}`;
await writeFile(new URL('sw.js',root),`const CACHE=${JSON.stringify(name)}, PREFIX='gopsrally-v04-foundation-', FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;event.respondWith(caches.open(CACHE).then(async cache=>{const key=event.request.mode==='navigate'?new URL('index.html',self.registration.scope).href:event.request;const hit=await cache.match(key,{ignoreVary:true});return hit||fetch(event.request)}))});
`);
