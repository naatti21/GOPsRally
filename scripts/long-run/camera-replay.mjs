// Replays the SAME recorded physical trajectory through actual archived Three.js scenes.
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
import {materialize,VERSIONS,hash,saveJSON} from './versions.mjs';
const out=resolve(process.env.LONG_RUN_OUTPUT||'lab-results/full');
const trace=readFileSync(join(out,process.env.CAMERA_TRACE||'v046-real-full-100.jsonl.gz'));
const [metadata,...rows]=gunzipSync(trace).toString().trim().split('\n').map(JSON.parse);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const name of (process.env.CAMERA_VERSIONS?.split(',')||Object.keys(VERSIONS))){
  const version=materialize(name);
  const tau=process.env.CAMERA_HEADING_TAU;
  const label=tau?`${name}-tau${tau}`:name;
  let cameraPatch=null;
  if(tau){
    if(tau!=='0.2'||name!=='v046')throw Error('Only the declared v046 0.2 s camera experiment is supported');
    const file=join(version.root,'v04/src/render/camera-response.js'),before=readFileSync(file,'utf8');
    const from='Math.max(0, dt) / 0.09',to='Math.max(0, dt) / 0.2';
    if(before.split(from).length!==2)throw Error('Missing/ambiguous camera mutation');
    const after=before.replace(from,to);writeFileSync(file,after);
    cameraPatch={from,to,beforeSha256:hash(before),afterSha256:hash(after)};
  }
  const server=await createServer({configFile:false,root:join(version.root,'v04'),logLevel:'error',server:{host:'127.0.0.1',port:0,fs:{allow:[version.root,resolve('.')]}}});
  writeFileSync(join(version.root,'v04/replay.html'),'<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>');
  await server.listen();
  try {
   for(const mode of ['fixed','chase']){
    const page=await browser.newPage({viewport:{width:393,height:851},deviceScaleFactor:1});
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/replay.html`);
    await page.evaluate(async()=>{
      const [{createScene},{buildSector}]=await Promise.all([import('/src/render/scene.js'),import('/src/world/sector.js')]);
      window.view=createScene(document.querySelector('canvas'),buildSector());
    });
    const records=await page.evaluate(({rows,mode})=>{
      const view=window.view;view.setCamera(mode);const result=[];
      for(let i=0;i<rows.length;i++){
        const r=rows[i];view.drive({position:{x:r.x,y:r.y,z:r.z},rotation:r.rotation,speed:r.forwardSpeed,lateralSpeed:r.lateralSpeed,wheels:r.wheels},1/60,i===0);
        view.camera.updateMatrixWorld();
        const e=view.camera.matrixWorld.elements,heading=Math.atan2(-e[8],e[10])*180/Math.PI,ndc=view.carNdc();
        result.push({t:r.t,bodyHeading:r.heading,beta:r.beta,cameraHeading:heading,fov:view.camera.fov,ndc});
        if(i%60===0)view.render();
      }
      view.render();return result;
    },{rows,mode});
    await page.screenshot({path:join(out,`camera-${label}-${mode}.png`)});
    writeFileSync(join(out,`camera-${label}-${mode}.json`),JSON.stringify(records));
    if(records.length!==rows.length||records.some(r=>![r.cameraHeading,r.fov,r.ndc.x,r.ndc.y].every(Number.isFinite)))throw Error('Invalid/incomplete camera replay');
    const wrap=a=>Math.atan2(Math.sin(a*Math.PI/180),Math.cos(a*Math.PI/180))*180/Math.PI;
    let cameraSum=0,bodySum=0;
    for(let i=1;i<records.length;i++){cameraSum+=(wrap(records[i].cameraHeading-records[i-1].cameraHeading)*60)**2;bodySum+=(wrap(records[i].bodyHeading-records[i-1].bodyHeading)*60)**2;}
    results.push({version:label,cameraPatch,sha:version.sha,mode,physicsTraceSha256:hash(trace),frames:records.length,
      cameraYawRateRms:Math.sqrt(cameraSum/(records.length-1)),bodyHeadingRateRms:Math.sqrt(bodySum/(records.length-1)),
      carOutsideNdcFrames:records.filter(r=>Math.abs(r.ndc.x)>1||Math.abs(r.ndc.y)>1).length,
      browser:browser.version(),rendering:'actual Chromium SwiftShader; drive every 60Hz record, render once/s; NOT device FPS'});
    await page.close();
   }
  }finally{await server.close();}
 }
 saveJSON(join(out,process.env.CAMERA_HEADING_TAU?'camera-smoothing-summary.json':'camera-summary.json'),results);
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
