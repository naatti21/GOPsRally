import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
const {chromium}=await import(process.env.ROADS_PLAYWRIGHT_MODULE??"playwright");
const base=process.env.CIRCUIT_URL??"http://127.0.0.1:4173/circuit/";
const folder=process.env.CIRCUIT_EVIDENCE??"docs/evidence/circuit";
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
  args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
  const viewport={width:390,height:844};
  const page=await browser.newPage({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(()=>document.documentElement.classList.contains("webgl-3d"));
  assert.equal(await page.evaluate(()=>window.roadlabQA),undefined);
  assert(await page.locator("#telemetry").isHidden());
  const shot=async name=>page.screenshot({path:join(folder,name+".png"),scale:"css"});
  await shot("01-grid");
  await page.goto(base+"?qa=1");
  const start=page.locator("#start");
  const snapshot=()=>page.evaluate(()=>window.roadlabQA.snapshot());
  const race=()=>page.evaluate(()=>window.roadlabQA.raceInfo());
  await start.tap();
  await page.waitForFunction(()=>document.querySelector("#countdown").classList.contains("show"));
  await page.waitForFunction(()=>window.roadlabQA.snapshot().state.speed>10);
  await page.evaluate(()=>window.roadlabQA.clearTiming());
  await page.waitForTimeout(2900);
  const render=await page.evaluate(()=>window.roadlabQA.timing());
  assert(render.frames>12&&render.vertices<80000);
  const map=await page.locator("#map-road").getAttribute("d");
  const initialArrow=await page.locator("#map-car").getAttribute("transform");
  assert(map.endsWith(" Z"));
  const initialState=(await snapshot()).state;
  const client=await page.context().newCDPSession(page);
  const points=await Promise.all(["#left","#brake"].map(async (selector,id)=>{
    const {x,y,width,height}=await page.locator(selector).boundingBox();
    return {x:x+width/2,y:y+height/2,id};
  }));
  await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:points});
  await page.waitForFunction(previous=>{
    const {state}=window.roadlabQA.snapshot();
    return Math.abs(state.theta-previous.theta)>.15&&state.speed<previous.speed-3;
  },initialState);
  await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  assert(!(await page.locator("#left").getAttribute("class")).includes("pressed"));
  assert.equal(await page.locator("#map-road").getAttribute("d"),map);
  assert.notEqual(await page.locator("#map-car").getAttribute("transform"),initialArrow);
  assert.equal((await snapshot()).mode,"fixed");
  const beforeRecovery=await race();
  await page.locator("#recover").tap();
  assert((await race()).lapTicks>=beforeRecovery.lapTicks+360);
  const recovered=await snapshot();
  assert(recovered.state.speed<5);
  await page.locator("#pause").tap();
  const paused=await race();
  await page.waitForTimeout(400);
  assert.equal((await race()).lapTicks,paused.lapTicks);
  await start.tap();
  await page.waitForFunction(ticks=>window.roadlabQA.raceInfo().lapTicks>ticks,paused.lapTicks);
  await page.locator("#pause").tap();
  await page.locator("#restart").tap();
  assert.equal((await race()).lapTicks,0);
  assert.equal((await snapshot()).state.speed,0);
  await page.waitForFunction(()=>document.querySelector("#countdown").textContent==="GO");
  await page.evaluate(async()=> {
    const {raceButtons}=await import("/tests/circuit-driver.mjs");
    const {circuit}=await import("/roadlab/circuit.mjs");
    window.roadlabQA.hold();
    window.driveEvidence=(condition)=>{
      const qa=window.roadlabQA;
      for(let i=0;i<24000;i++){
        const {body,state}=qa.snapshot();
        if(condition==="approach"&&body.contacts===4&&qa.surface.sample(state.x,state.z).s>circuit.crest-48)return;
        if(condition==="air"&&body.contacts===0&&body.tyreGap>=4.9)return;
        if(condition==="land"&&body.landings===1&&body.contacts>=3)return;
        if(condition==="bank"&&Math.abs(qa.surface.sample(state.x,state.z).s-circuit.bankCenter)<15&&Math.abs(body.roll)>.1)return;
        if(condition==="finish"&&qa.raceInfo().finished)return;
        qa.step(1,raceButtons);
      }
      throw Error("Missing race phase: "+condition);
    };
  });
  const phases={};
  for(const [phase,name] of [["approach","02-crest-approach"],["air","03-crest-flight"],["land","04-crest-landing"],["bank","05-banked-bend"],["finish","06-results"]]){
    await page.evaluate(phase=>window.driveEvidence(phase),phase);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await shot(name);
    const {body:{contacts,tyreGap,bodyClearance,vy,roll},state:{speed}}=await snapshot();
    phases[phase]={contacts,tyreGap,bodyClearance,rollDegrees:roll*180/Math.PI,verticalMps:vy,speedMps:speed};
  }
  assert.equal(phases.approach.contacts,4);
  assert.equal(phases.air.contacts,0);
  assert(phases.land.contacts>=3);
  const result=await race();
  assert.equal(result.laps.length,3);
  assert.equal(await page.locator("#panel-title").textContent(),"Race complete");
  assert.equal(await page.locator("#results dd").count(),3);
  const best=await page.locator("#best").textContent();
  assert.notEqual(best,"—");
  await page.reload();
  await page.waitForFunction(best=>document.querySelector("#best").textContent===best,best);
  await start.tap();
  assert.deepEqual((await race()).laps,[]);
  for(const width of [320,360,430]){
    await page.setViewportSize({width,height:740});
    const boxes=await Promise.all(["#left","#brake","#right"].map(selector=>page.locator(selector).boundingBox()));
    for(let i=0;i<boxes.length;i++){
      assert(boxes[i].width>=44&&boxes[i].height>=44);
      assert(boxes[i].x>=0&&boxes[i].x+boxes[i].width<=width);
      if(i>0)assert(boxes[i-1].x+boxes[i-1].width<boxes[i].x);
    }
  }
  assert.deepEqual(errors,[]);
  const evidence={browser:browser.version(),viewport,softwareRenderer:"SwiftShader",render,laps:result.laps,phases};
  await writeFile(join(folder,"metrics.json"),JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
} finally {await browser.close();}
