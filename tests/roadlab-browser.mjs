import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {CREST_S,STRAIGHT} from "../roadlab/surface.mjs";
const {chromium}=await import(process.env.ROADS_PLAYWRIGHT_MODULE??"playwright");
const base=process.env.ROADLAB_URL??"http://127.0.0.1:4194/roadlab/";
const folder=process.env.ROADLAB_EVIDENCE??"docs/evidence/roadlab";
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH,
  args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"?qa=1");
  await page.waitForFunction(()=>Boolean(window.roadlabQA));
  const snapshot=()=>page.evaluate(()=>window.roadlabQA.snapshot());
  const path=await page.locator("#map-road").getAttribute("d");
  const viewBox=await page.locator("#track-map").getAttribute("viewBox");
  assert(path?.endsWith(" Z"));
  assert(await page.locator("#telemetry").isHidden());
  await page.getByRole("button",{name:/START DRIVING/}).tap();
  await page.waitForFunction(()=>window.roadlabQA.snapshot().state.speed>8);
  await page.evaluate(()=>window.roadlabQA.clearTiming());
  await page.waitForTimeout(6200);
  const timing=await page.evaluate(()=>window.roadlabQA.timing());
  const gl=await page.evaluate(()=>{
    const context=document.getElementById("scene3d").getContext("webgl2");
    const info=context.getExtension("WEBGL_debug_renderer_info");
    return info?context.getParameter(info.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER);
  });
  assert(timing.frames>35,"insufficient animation frames");
  assert(timing.p50>0&&timing.p95>=timing.p50);
  const heading=(await snapshot()).state.theta;
  const session=await context.newCDPSession(page);
  const rect=await page.locator("#right").boundingBox();
  const point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]});
  await page.waitForFunction(previous=>
    Math.abs(window.roadlabQA.snapshot().state.theta-previous)>.12,heading);
  await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  const speed=(await snapshot()).state.speed;
  await page.keyboard.down("Space");
  await page.waitForFunction(before=>window.roadlabQA.snapshot().state.speed<before-3,speed);
  await page.keyboard.up("Space");
  assert.equal(await page.locator("#map-road").getAttribute("d"),path);
  assert.equal(await page.locator("#track-map").getAttribute("viewBox"),viewBox);
  assert.equal((await snapshot()).mode,"fixed");

  async function reset(options){
    await page.evaluate(options=>window.roadlabQA.reset(options),options);
  }
  async function holdUntil(condition,direction=1) {
    await page.evaluate(({condition,direction,crestZ})=>{
      for(let i=0;i<600;i++){
        const {state,body}=window.roadlabQA.snapshot();
        if(condition==="air"&&body.airborne&&body.tyreGap>=4.70)return;
        if(condition==="land"&&body.landings&&body.contacts>=3)return;
        if(condition==="approach"&&(state.z-crestZ)*direction>-48){
          if(body.contacts!==4)throw Error("Approach must be on all four wheels");
          return;
        }
        window.roadlabQA.step(1);
      }
      throw Error("No expected phase: "+condition);
    },{condition,direction,crestZ:CREST_S-STRAIGHT/2});
  }
  async function shot(name){
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:join(folder,name+".png")});
  }
  const flights=[];
  for (const direction of [1,-1]) {
    const suffix=direction===1?"north":"south";
    await reset({s:CREST_S-direction*80,direction,speed:48});
    await holdUntil("approach",direction);
    await shot("01-approach-"+suffix);
    await holdUntil("air",direction);
    const {body}=await snapshot();
    assert(body.contacts===0&&body.tyreGap>.3);
    flights.push({direction,tyreGap:body.tyreGap,bodyClearance:body.bodyClearance});
    await shot("02-flight-"+suffix);
    await holdUntil("land",direction);
    await shot("03-landing-"+suffix);
  }
  await reset({s:STRAIGHT+105,speed:13});
  await shot("04-banked-bend");
  await page.goto(base+"?debug=1");
  await page.waitForFunction(()=>document.getElementById("telemetry").textContent.includes("fixed compass"));
  assert(await page.locator("#telemetry").isVisible());
  assert.deepEqual(errors,[]);
  const result={browser:browser.version(),gl,viewportCSS:[390,844],timing,flights};
  await writeFile(join(folder,"browser-metrics.json"),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
