import { createSurface, FINISH_S } from "./surface.mjs";
import { DT } from "./contact.mjs";
import { createDrive, stepDrive } from "./drive.mjs";
import { SPEED_SCALE } from "./turnpp.mjs";
import { createRenderer } from "./renderer.mjs";

const $=id=>document.getElementById(id);
const surface=createSurface();
const renderer=createRenderer($("scene3d"),surface);
if (!renderer) $("webgl-error").hidden=false;
else start(renderer);

function start(renderer) {
  document.documentElement.classList.add("webgl-3d");
  const params=new URLSearchParams(location.search);
  const telemetry=$("telemetry");
  const debug=params.get("debug")==="1", qa=params.get("qa")==="1";
  telemetry.hidden=!debug;
  let drive=createDrive(surface);
  let running=false,paused=false,countdown=0,last=performance.now(),accumulator=0;
  let lastHud=-Infinity,lastMap=-Infinity;
  const keys=new Map([["ArrowLeft","left"],["KeyA","left"],["ArrowRight","right"],["KeyD","right"],
    ["Space","brake"],["ArrowDown","brake"],["KeyS","brake"]]);
  const held=new Set(), fingers=new Map();
  const buttons=["left","right","brake"].map($);
  const input={left:false,right:false,brake:false};
  const intervals=new Float64Array(1500);
  let frame=0, maxFrame=0;
  const logo=$("overlay"), startButton=$("start");
  const compass=$("track-map");
  const rows=surface.rows;
  const xs=rows.map(row=>row.x), zs=rows.map(row=>row.z);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const pad=27;
  compass.setAttribute("viewBox",`${minX-pad} ${-maxZ-pad} ${maxX-minX+2*pad} ${maxZ-minZ+2*pad}`);
  const path=rows.filter((_,i)=>i%4===0).map((p,i)=>
    `${i?"L":"M"}${p.x.toFixed(1)} ${(-p.z).toFixed(1)}`).join(" ")+" Z";
  $("map-road").setAttribute("d",path);
  $("map-road").setAttribute("stroke-width","8");
  $("map-road-outline").setAttribute("d",path);
  $("map-road-outline").setAttribute("stroke-width","15");
  const finish=surface.sampleRoad(FINISH_S);
  $("map-finish").setAttribute("transform",`translate(${finish.x} ${-finish.z}) rotate(${finish.theta*180/Math.PI}) scale(.65)`);

  function syncInput() {
    for (const button of buttons) {
      const press=[...held].some(key=>keys.get(key)===button.id) || [...fingers.values()].includes(button.id);
      input[button.id]=press;
      button.classList.toggle("pressed",press);
    }
  }
  function clearInput(){held.clear();fingers.clear();syncInput();}
  for (const button of buttons) {
    button.addEventListener("pointerdown",event=>{
      event.preventDefault();
      fingers.set(event.pointerId,button.id);button.setPointerCapture(event.pointerId);syncInput();
    });
    for(const name of ["pointerup","pointercancel","lostpointercapture"]) {
      button.addEventListener(name,event=>{fingers.delete(event.pointerId);syncInput();});
    }
  }
  window.addEventListener("keydown",event=>{
    if (keys.has(event.code)) {event.preventDefault();held.add(event.code);syncInput();}
    else if (event.code==="Escape"&&!event.repeat) togglePause();
  });
  window.addEventListener("keyup",event=>{held.delete(event.code);syncInput();});
  window.addEventListener("blur",clearInput);
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&running&&!paused)togglePause();});
  function togglePause(){
    if(!running)return;
    paused=!paused;logo.classList.toggle("hidden",!paused);
    $("countdown").classList.remove("show");
    startButton.textContent=paused?"RESUME DRIVING":"START DRIVING";
    $("pause").textContent=paused?"▶":"Ⅱ";
    clearInput();
  }
  $("pause").addEventListener("click",togglePause);
  startButton.addEventListener("click",()=>{
    if(!running){running=true;countdown=2;clearInput();}
    else if(paused)togglePause();
    logo.classList.add("hidden");
  });
  $("recover").addEventListener("click",()=>{
    if(!running||paused)return;
    const {safeS,lap,lapTime,best}=drive.state;
    drive=createDrive(surface,{s:safeS});
    Object.assign(drive.state,{lap,lapTime,best});clearInput();
  });
  function clock(n) {
    if(n==null)return "—";
    const cs=Math.floor(n*100);
    return [Math.floor(cs/6000),Math.floor(cs/100)%60,cs%100].map(n=>String(n).padStart(2,"0"))
      .join(":").replace(/:([^:]*)$/,".$1");
  }
  function hud(now,ms){
    const {state,body}=drive;
    if(now-lastMap>=100){
      $("map-car").setAttribute("transform",
        `translate(${state.x.toFixed(2)} ${(-state.z).toFixed(2)}) rotate(${(state.theta*180/Math.PI).toFixed(1)}) scale(.62)`);
      lastMap=now;
    }
    if(now-lastHud<90)return;
    lastHud=now;
    $("time").textContent=clock(state.lapTime);
    $("best").textContent=clock(state.best);
    $("lap").textContent=String(state.lap).padStart(2,"0");
    $("speed").textContent=String(Math.round(state.speed*3.6*SPEED_SCALE));
    $("surface").textContent=state.material==="road"?"GRAVEL":state.material.toUpperCase();
    $("surface").classList.toggle("offroad",state.material!=="road");
    $("message").textContent=state.material==="grass"?"OFF ROAD · RESET to recover":"TURN++ · ROADLAB";
    if(debug)telemetry.textContent=`Tyres ${body.contacts}/4 · body clearance ${body.bodyClearance?.toFixed(2)??"—"} m · vY ${body.vy.toFixed(2)} m/s · fixed compass · ${ms.toFixed(1)} ms`;
  }

  function tick(now){
    const ms=Math.max(0,now-last);last=now;
    if(frame>0){intervals[(frame-1)%intervals.length]=ms;maxFrame=Math.max(maxFrame,ms);}
    frame++;
    if(running&&!paused){
      if(countdown>0){
        countdown-=Math.min(.065,ms/1000);
        $("countdown").textContent=String(Math.max(1,Math.ceil(countdown)));
        $("countdown").classList.toggle("show",countdown>0);
      }else{
        accumulator+=Math.min(.05,ms/1000);
        while(accumulator>=DT){
          stepDrive(surface,drive,input,DT,innerHeight>innerWidth);
          accumulator-=DT;
        }
      }
    }
    renderer.render(drive.state,drive.body,drive.camera);
    hud(now,ms);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  if(qa)window.roadlabQA={
    reset(options){drive=createDrive(surface,options);running=false;paused=false;countdown=0;
      logo.classList.add("hidden");clearInput();lastHud=lastMap=-Infinity;},
    step(count,controls={}){
      for(let i=0;i<count;i++)stepDrive(surface,drive,controls,DT,innerHeight>innerWidth);
      lastHud=lastMap=-Infinity;
    },
    snapshot(){return {state:{...drive.state},body:structuredClone(drive.body),camera:{...drive.camera},mode:"fixed",debug};},
    clearTiming(){frame=0;maxFrame=0;},
    timing(){
      const data=Array.from(intervals.subarray(0,Math.min(intervals.length,frame-1))).sort((a,b)=>a-b);
      return {frames:data.length,p50:data[Math.floor(data.length*.5)],p95:data[Math.floor(data.length*.95)],
        max:maxFrame,...renderer.stats,viewport:[canvasWidth(),$("scene3d").height]};
    }
  };
  function canvasWidth(){return $("scene3d").width;}
}
