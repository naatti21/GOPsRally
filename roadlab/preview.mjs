import { createSurface } from "./surface.mjs";
import { DT } from "./contact.mjs";
import { createDrive, stepDrive } from "./drive.mjs";
import { SPEED_SCALE } from "./turnpp.mjs";
import { createRenderer } from "./renderer.mjs";

import {circuit} from "./circuit.mjs";
import {createRace,recoverRace,stepRace,readBest,saveBest,RACE_LAPS,RECOVERY_SECONDS} from "./race.mjs";

const racing=document.documentElement.hasAttribute("data-circuit");
const $=id=>document.getElementById(id);
const surface=createSurface(racing?circuit:undefined);
const renderer=createRenderer($("scene3d"),surface);
if (!renderer) $("webgl-error").hidden=false;
else start(renderer);

function start(renderer) {
  document.documentElement.classList.add("webgl-3d");
  const params=new URLSearchParams(location.search);
  const telemetry=$("telemetry");
  const debug=params.get("debug")==="1", qa=params.get("qa")==="1";
  telemetry.hidden=!debug;
  let best = racing ? readBest({getItem:key=>localStorage.getItem(key)}) : null;
  let race = racing ? createRace(surface,best) : null;
  let drive = race?.drive ?? createDrive(surface);
  const results=$("results");
  const title=$("panel-title"), copy=$("panel-copy"), restart=$("restart");
  let lastLap=0, goUntil=0, lapNoticeUntil=0;
  let manualSimulation=false;
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
  $("map-road").setAttribute("stroke-width",racing?"13":"8");
  $("map-road-outline").setAttribute("d",path);
  $("map-road-outline").setAttribute("stroke-width",racing?"22":"15");
  const finish=surface.sampleRoad(surface.finish);
  $("map-finish").setAttribute("transform",`translate(${finish.x} ${-finish.z}) rotate(${finish.theta*180/Math.PI}) scale(${racing?1.1:.65})`);

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
  function setPanel(heading,detail,button,showRestart=false){
    if(!racing)return;
    title.textContent=heading;
    copy.textContent=detail;
    startButton.textContent=button;
    restart.hidden=!showRestart;
    $("instruction").hidden=showRestart||Boolean(race.finished);
    $("control-hint").hidden=$("instruction").hidden;
    results.hidden=!race.finished;
  }
  function startRace(){
    race=createRace(surface,best);drive=race.drive;
    running=true;paused=false;countdown=3;accumulator=0;lastLap=0;goUntil=0;lapNoticeUntil=0;
    $("toast").classList.remove("show");
    $("pause").textContent="PAUSE";
    logo.classList.add("hidden");clearInput();
  }
  function completeRace(){
    running=false;
    const total=race.laps.reduce((sum,seconds)=>sum+seconds,0);
    results.replaceChildren(...race.laps.map((seconds,index)=>{
      const cell=document.createElement("div"), label=document.createElement("dt"), value=document.createElement("dd");
      label.textContent="Lap "+(index+1);value.textContent=clock(seconds);
      cell.append(label,value);
      return cell;
    }));
    setPanel("Race complete",`Total ${clock(total)} · Best lap ${clock(best)}`,"RACE AGAIN");
    logo.classList.remove("hidden");
    startButton.focus({preventScroll:true});
    clearInput();
  }
  if(racing)restart.addEventListener("click",startRace);
  function togglePause(){
    if(!running)return;
    paused=!paused;logo.classList.toggle("hidden",!paused);
    $("countdown").classList.remove("show");
    if(racing&&paused){
      setPanel("Race paused","Resume from here or restart from the grid.","RESUME RACE",true);
      startButton.focus({preventScroll:true});
    } else if(!racing) startButton.textContent=paused?"RESUME DRIVING":"START DRIVING";
    $("pause").textContent=racing?"PAUSE":paused?"▶":"Ⅱ";
    clearInput();
  }
  $("pause").addEventListener("click",togglePause);
  startButton.addEventListener("click",()=>{
    if(racing&&!running){startRace();return;}
    if(!running){running=true;countdown=2;clearInput();}
    else if(paused)togglePause();
    logo.classList.add("hidden");
  });
  $("recover").addEventListener("click",()=>{
    if(!running||paused)return;
    if(racing){
      recoverRace(surface,race);drive=race.drive;
      $("toast").textContent=`Recovered · +${RECOVERY_SECONDS}s`;
      lapNoticeUntil=performance.now()+2400;
    } else {
      const {safeS,lap,lapTime,best}=drive.state;
      drive=createDrive(surface,{s:safeS});
      Object.assign(drive.state,{lap,lapTime,best});
    }
    clearInput();
  });
  function clock(n) {
    if(n==null)return "—";
    const cs=Math.floor(n*100+1e-7);
    return [Math.floor(cs/6000),Math.floor(cs/100)%60,cs%100].map(n=>String(n).padStart(2,"0"))
      .join(":").replace(/:([^:]*)$/,".$1");
  }
  function hud(now,ms){
    const {state,body}=drive;
    if(now-lastMap>=100){
      $("map-car").setAttribute("transform",
        `translate(${state.x.toFixed(2)} ${(-state.z).toFixed(2)}) rotate(${(state.theta*180/Math.PI).toFixed(1)}) scale(${racing?1.15:.62})`);
      lastMap=now;
    }
    if(now-lastHud<90)return;
    lastHud=now;
    $("time").textContent=clock(racing?(race.finished?race.laps.at(-1):race.lapTicks*DT):state.lapTime);
    $("best").textContent=clock(racing?best:state.best);
    $("lap").textContent=racing?`${Math.min(race.laps.length+1,RACE_LAPS)}/${RACE_LAPS}`:String(state.lap).padStart(2,"0");
    if(racing)$("toast").classList.toggle("show",running&&!paused&&now<lapNoticeUntil);
    $("speed").textContent=String(Math.round(state.speed*3.6*SPEED_SCALE));
    $("surface").textContent=state.material==="road"?"GRAVEL":state.material.toUpperCase();
    $("surface").classList.toggle("offroad",state.material!=="road");
    const message=racing ? race.missed?"Checkpoint missed · Recover":state.material==="grass"?"Off course · Recover":"Gravel Ridge"
      : state.material==="grass"?"OFF ROAD · RESET to recover":"TURN++ · ROADLAB";
    if($("message").textContent!==message)$("message").textContent=message;
    if(debug)telemetry.textContent=`Tyres ${body.contacts}/4 · body clearance ${body.bodyClearance?.toFixed(2)??"—"} m · vY ${body.vy.toFixed(2)} m/s · fixed compass · ${ms.toFixed(1)} ms`;
  }

  function advance(controls,now) {
    if(!racing){stepDrive(surface,drive,controls,DT,innerHeight>innerWidth);return;}
    stepRace(surface,race,controls,innerHeight>innerWidth);
    if(race.best!==best){
      best=race.best;
      saveBest({setItem:(key,value)=>localStorage.setItem(key,value)},best);
    }
    if(race.laps.length!==lastLap){
      lastLap=race.laps.length;
      if(race.finished)completeRace();
      else{
        $("toast").textContent=`Lap ${lastLap} · ${clock(race.laps.at(-1))}`;
        lapNoticeUntil=now+2400;
      }
    }
  }

  function tick(now){
    const ms=Math.max(0,now-last);last=now;
    if(frame>0){intervals[(frame-1)%intervals.length]=ms;maxFrame=Math.max(maxFrame,ms);}
    frame++;
    if(running&&!paused&&!manualSimulation){
      if(countdown>0){
        countdown-=Math.min(.1,ms/1000);
        if(racing&&countdown<=0)goUntil=now+600;
        $("countdown").textContent=countdown>0?String(Math.ceil(countdown)):"GO";
        $("countdown").classList.toggle("show",countdown>0||now<goUntil);
      }else{
        if(now>=goUntil)$("countdown").classList.remove("show");
        accumulator+=Math.min(.1,ms/1000);
        while(running&&accumulator>=DT){
          advance(input,now);
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
    reset(options){
      drive=createDrive(surface,options);
      if(racing){race=createRace(surface,best);race.drive=drive;lastLap=0;}
      running=false;paused=false;countdown=0;
      logo.classList.add("hidden");clearInput();lastHud=lastMap=-Infinity;},
    hold(){manualSimulation=true;},
    step(count,controls={}){
      for(let i=0;i<count;i++){
        const input=typeof controls==="function"?controls(surface,drive.state):controls;
        advance(input,performance.now());
      }
      lastHud=lastMap=-Infinity;
    },
    surface,
    raceInfo(){return race && {laps:[...race.laps],next:race.next,finished:race.finished,missed:race.missed,lapTicks:race.lapTicks};},
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
