/* GOPs Rally 0.1 — standalone, offline-capable mobile driving feel prototype.
 * Rendered with the Canvas 2D API and a custom orthographic 2.5D projector.
 * Height and camber are in the track geometry; production physics/3D are not claimed.
 * No external packages or user accounts. High scores live on this device only.
 */
(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);
  const UI = { lap: $('lap'), time: $('time'), best: $('best'), speed: $('speed'), surface: $('surface'), message: $('message'), overlay: $('overlay'), start: $('start'), pause: $('pause'), toast: $('toast') };
  const PI2 = Math.PI * 2;
  const ROAD_HALF = 13.5;
  const COURSE = [
    [-50, 6], [12, 110], [122, 173], [222, 140], [270, 44], [218, -44],
    [276, -164], [181, -251], [54, -199], [-16, -138], [-116, -244],
    [-242, -211], [-271, -93], [-218, 23], [-261, 121], [-178, 213], [-91, 166]
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const turnAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const length = (x, z) => Math.hypot(x, z);
  const seeded = n => { let x = (Math.imul(n + 137, 1664525) + 1013904223) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967295; };
  const ground = (x, z) => 7.2 * Math.sin(x * .012) + 5.2 * Math.cos(z * .011) + 4.6 * Math.sin((x + z) * .014);

  function spline(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return .5 * ((2 * p1) + (-p0 + p2) * t + (2*p0 - 5*p1 + 4*p2 - p3) * t2 + (-p0 + 3*p1 - 3*p2 + p3) * t3);
  }
  const track = [];
  const SEGMENTS = COURSE.length * 38;
  for (let i=0; i<COURSE.length; i++) {
    const n = COURSE.length;
    const p0=COURSE[(i+n-1)%n], p1=COURSE[i], p2=COURSE[(i+1)%n], p3=COURSE[(i+2)%n];
    for (let k=0; k<38; k++) {
      const t=k/38;
      const x=spline(p0[0],p1[0],p2[0],p3[0],t), z=spline(p0[1],p1[1],p2[1],p3[1],t);
      track.push({x,z,y:ground(x,z)+.45,theta:0,bank:0,curve:0});
    }
  }
  let trackLength=0;
  for(let i=0;i<track.length;i++){
    const prev=track[(i+track.length-2)%track.length],next=track[(i+2)%track.length];
    track[i].theta=Math.atan2(next.x-prev.x,next.z-prev.z);
    const following=track[(i+1)%track.length];
    trackLength+=length(following.x-track[i].x,following.z-track[i].z);
  }
  for(let i=0;i<track.length;i++){
    const thBefore=track[(i+track.length-7)%track.length].theta;
    const thAfter=track[(i+7)%track.length].theta;
    const bend=turnAngle(thAfter-thBefore);
    track[i].curve=bend;
    track[i].bank=clamp(-bend*.68, -.155, .155);
  }
  const offset = (node, across, up=0) => ({x:node.x+Math.cos(node.theta)*across,z:node.z-Math.sin(node.theta)*across,y:node.y+node.bank*across+up});
  function closestRoad(x,z){
    let best=Infinity,idx=0;
    for(let i=0;i<track.length;i++){
      const p=track[i];const d=(x-p.x)**2+(z-p.z)**2;
      if(d<best){best=d;idx=i;}
    }
    const at=track[idx];
    const lateral=(x-at.x)*Math.cos(at.theta)-(z-at.z)*Math.sin(at.theta);
    return {dist:Math.sqrt(best), idx, at, lateral};
  }

  const trees=[];
  for(let i=0;i<850;i++){
    const x=-385+seeded(i*5+1)*780,z=-360+seeded(i*5+2)*665;
    if(closestRoad(x,z).dist<ROAD_HALF+8)continue;
    trees.push({x,z,y:ground(x,z),h:5+seeded(i*5+3)*13,r:3.5+seeded(i*5+4)*4.5,shape:seeded(i*5+5)});
  }
  const stones=[];
  for(let i=0;i<250;i++){
    const x=-390+seeded(i*17+8)*800,z=-365+seeded(i*23+17)*700;
    if(closestRoad(x,z).dist<ROAD_HALF+2)continue;
    stones.push({x,z,y:ground(x,z),r:.7+seeded(i*19+2)*2.4});
  }

  let w=0,h=0,dpr=1,last=performance.now(),toastUntil=0,frameCount=0;
  const savedBest=()=>{try{const s=localStorage.getItem('gopsrally-best-v1');return s?Number(s):null;}catch{return null;}};
  const state={
    running:false,paused:false,t:0,lap:1,lapT:0,best:savedBest(),camera:'hybrid',
    x:track[3].x,z:track[3].z,theta:track[3].theta,vx:0,vz:0,steer:0,
    speed:0,camX:track[3].x,camZ:track[3].z,camY:track[3].y,camYaw:track[3].theta,
    closest:3,offroad:false,progress:3/track.length,dust:[],lapGuard:0
  };
  UI.best.textContent=state.best ? formatTime(state.best) : '—';
  const input={left:false,right:false,brake:false};

  function resetCar(){
    const p=track[3];Object.assign(state,{x:p.x,z:p.z,theta:p.theta,vx:Math.sin(p.theta)*10,vz:Math.cos(p.theta)*10,steer:0,speed:10,
      camX:p.x,camZ:p.z,camY:p.y,camYaw:p.theta,lap:1,lapT:0,lapGuard:0,closest:3,offroad:false,dust:[]});
  }
  function resize(){
    w=window.innerWidth;h=window.innerHeight;
    dpr=Math.min(window.devicePixelRatio||1,1.75);
    canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize',resize,{passive:true});resize();
  function formatTime(t){
    const cs=Math.floor((t%1)*100);const s=Math.floor(t)%60,m=Math.floor(t/60);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');
  }
  function showToast(text,duration=2){UI.toast.textContent=text;UI.toast.classList.add('show');toastUntil=performance.now()+duration*1000;}
  function cameraMode(mode){if(!['fixed','hybrid','chase'].includes(mode))return;state.camera=mode;document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));showToast('KAMERA: '+({fixed:'LUKITTU',hybrid:'HYBRIDI',chase:'CHASE'}[mode]),1.1);}
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>cameraMode(b.dataset.camera)));
  function pause(){if(!state.running)return;state.paused=!state.paused;UI.overlay.classList.toggle('hidden',!state.paused);UI.start.innerHTML=state.paused?'JATKA AJOA <span>→</span>':'ALOITA AJO <span>→</span>';UI.pause.textContent=state.paused?'▶':'Ⅱ';Object.keys(input).forEach(k=>input[k]=false);}
  UI.pause.addEventListener('click',pause);
  UI.start.addEventListener('click',()=>{
    if(!state.running){resetCar();state.running=true;state.paused=false;state.t=0;}
    else state.paused=false;
    UI.overlay.classList.add('hidden');UI.pause.textContent='Ⅱ';
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden && state.running && !state.paused)pause();});
  const btnMap={left:$('left'),right:$('right'),brake:$('brake')};
  Object.entries(btnMap).forEach(([name,btn])=>{
    const pressed = e=>{e.preventDefault();input[name]=true;btn.classList.add('pressed');try{btn.setPointerCapture(e.pointerId);}catch{}};
    const released = e=>{if(e)e.preventDefault();input[name]=false;btn.classList.remove('pressed');};
    btn.addEventListener('pointerdown',pressed);btn.addEventListener('pointerup',released);btn.addEventListener('pointercancel',released);btn.addEventListener('lostpointercapture',released);
  });
  const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'brake',ArrowDown:'brake',KeyS:'brake'};
  const held=new Set();
  function rebuildKeys(){for(const c of ['left','right','brake'])input[c]=[...held].some(k=>keys[k]===c)||btnMap[c].classList.contains('pressed');}
  window.addEventListener('keydown',e=>{
    if(keys[e.code]){e.preventDefault();held.add(e.code);rebuildKeys();}
    else if(e.code==='Escape'&&!e.repeat)pause();
    else if(e.code==='Digit1')cameraMode('fixed');
    else if(e.code==='Digit2')cameraMode('hybrid');
    else if(e.code==='Digit3')cameraMode('chase');
  });
  window.addEventListener('keyup',e=>{if(keys[e.code]){e.preventDefault();held.delete(e.code);rebuildKeys();}});
  window.addEventListener('blur',()=>{held.clear();rebuildKeys();});

  function update(dt){
    if(!state.running||state.paused)return;
    dt=Math.min(.045,dt);
    state.t+=dt;state.lapT+=dt;state.lapGuard+=dt;
    const near=closestRoad(state.x,state.z);
    const road=near.dist<ROAD_HALF+.6;
    state.offroad=!road;
    state.closest=near.idx;
    const rightTurn=(input.right?1:0)-(input.left?1:0);
    state.steer=lerp(state.steer,rightTurn,1-Math.exp(-dt*18));
    let vx=state.vx,vz=state.vz;
    let speed=length(vx,vz);
    const desiredYawRate=state.steer*(.67+1.17*clamp(speed/52,0,1));
    state.theta=turnAngle(state.theta+desiredYawRate*dt*(road?1:.78));
    const fX=Math.sin(state.theta),fZ=Math.cos(state.theta);
    const rX=Math.cos(state.theta),rZ=-Math.sin(state.theta);
    const forward=vx*fX+vz*fZ,lateral=vx*rX+vz*rZ;
    const yawMatchesCurve=Math.sign(state.steer)===Math.sign(near.at.curve);
    const banking=road&&yawMatchesCurve?Math.abs(near.at.bank)*5.5:0;
    const grip=(road?5.3+banking:2.25);
    const remainingSide=lateral*Math.exp(-grip*dt);
    vx+=(remainingSide-lateral)*rX;vz+=(remainingSide-lateral)*rZ;
    speed=length(vx,vz);
    const hillBefore=track[(near.idx+track.length-5)%track.length],hillAfter=track[(near.idx+5)%track.length];
    const grade=(hillAfter.y-hillBefore.y)/Math.max(1,length(hillAfter.x-hillBefore.x,hillAfter.z-hillBefore.z));
    const goingForward=Math.cos(state.theta-near.at.theta);
    const a=(input.brake?-41:17)-.0058*speed*speed-(road?0:19)-grade*13*goingForward;
    vx+=fX*a*dt;vz+=fZ*a*dt;
    if(input.brake){const v=length(vx,vz);if(v<1.2){vx=0;vz=0;}}
    vx*=Math.exp(-dt*.015);vz*=Math.exp(-dt*.015);
    state.vx=vx;state.vz=vz;state.x+=vx*dt;state.z+=vz*dt;
    state.speed=length(vx,vz);
    const after=closestRoad(state.x,state.z);
    state.progress=after.idx/track.length;
    if(state.closest>track.length*.86&&after.idx<track.length*.12&&goingForward>.05&&state.lapGuard>15){
      const finished=state.lapT;
      if(!state.best||finished<state.best){state.best=finished;try{localStorage.setItem('gopsrally-best-v1',String(finished));}catch{}showToast('UUSI ENNÄTYS · '+formatTime(finished),3);}
      else showToast('KIERROS '+state.lap+' · '+formatTime(finished),3);
      state.lap++;state.lapT=0;state.lapGuard=0;
    }
    state.closest=after.idx;
    const cm=state.camera;
    const desiredYaw=cm==='fixed'?0:cm==='hybrid'?state.theta*.38:state.theta;
    if(cm==='fixed')state.camYaw=lerp(state.camYaw,0,1-Math.exp(-dt*2.6));
    else state.camYaw+=turnAngle(desiredYaw-state.camYaw)*(1-Math.exp(-dt*(cm==='hybrid'?1.8:3.3)));
    // The car is offset toward the bottom of the view as speed rises.
    const lead=11+clamp(state.speed/54,0,1)*28;
    const targetX=state.x+Math.sin(state.theta)*lead,targetZ=state.z+Math.cos(state.theta)*lead;
    const camK=1-Math.exp(-dt*5.5);
    state.camX=lerp(state.camX,targetX,camK);state.camZ=lerp(state.camZ,targetZ,camK);
    state.camY=lerp(state.camY,after.at.y,camK);
    if(road&&state.speed>18&&Math.abs(state.steer)>.12&&frameCount%2===0){
      const side=seeded(frameCount*4)*2-1;
      state.dust.push({x:state.x-Math.sin(state.theta)*4+side*2,z:state.z-Math.cos(state.theta)*4,y:after.at.y,life:.8,r:1.4+seeded(frameCount*17)*1.6});
    }
    if(!road&&frameCount%2===0){state.dust.push({x:state.x,z:state.z,y:after.at.y,life:1,r:2.4});}
    state.dust.forEach(d=>{d.life-=dt;d.r+=dt*3.5;});state.dust=state.dust.filter(d=>d.life>0).slice(-32);
  }
  function camera(){
    // Scale is deliberately generous: fast driving must still show braking distance.
    const v=clamp(state.speed/56,0,1);
    const worldHeight=147+v*49;
    const scale=Math.min(h/worldHeight,w/(worldHeight*(w/h<.82?.54:.64)));
    return {scale,cx:w*.5,cy:h*.51,yaw:state.camYaw,ct:Math.cos(.29),st:Math.sin(.29),sin:Math.sin(state.camYaw),cos:Math.cos(state.camYaw)};
  }
  function project(x,z,y,cam){
    const dx=x-state.camX,dz=z-state.camZ;
    const across=dx*cam.cos-dz*cam.sin,depth=dx*cam.sin+dz*cam.cos;
    return {x:cam.cx+across*cam.scale,y:cam.cy-(depth*cam.ct+(y-state.camY)*cam.st)*cam.scale,depth};
  }
  function poly(ps,color,stroke,lineWidth=1){
    if(ps.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return;
    ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);for(let j=1;j<ps.length;j++)ctx.lineTo(ps[j].x,ps[j].y);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
  }
  function line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function visible(p,margin=110){return p.x>=-margin&&p.y>=-margin&&p.x<=w+margin&&p.y<=h+margin;}
  function background(cam){
    ctx.fillStyle='#253c2d';ctx.fillRect(0,0,w,h);
    const tile=20;
    const minX=Math.floor((state.camX-235)/tile),maxX=Math.ceil((state.camX+235)/tile);
    const minZ=Math.floor((state.camZ-260)/tile),maxZ=Math.ceil((state.camZ+260)/tile);
    for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
      const x=ix*tile,z=iz*tile;
      const mx=x+tile*.5,mz=z+tile*.5;
      const pp=project(mx,mz,ground(mx,mz),cam);
      if(!visible(pp,55))continue;
      const p0=project(x,z,ground(x,z),cam),p1=project(x+tile,z,ground(x+tile,z),cam),p2=project(x+tile,z+tile,ground(x+tile,z+tile),cam),p3=project(x,z+tile,ground(x,z+tile),cam);
      const noise=seeded(ix*10987+iz*2333);
      const slope=(ground(x+tile,z)-ground(x,z))*1.7;
      const light=clamp(28+noise*13+slope,22,50);
      const green=Math.round(light*1.5),red=Math.round(light*.79),blue=Math.round(light*.96);
      poly([p0,p1,p2,p3],`rgb(${red},${green},${blue})`);
    }
  }
  function drawRoad(cam){
    const segments=[];
    for(let i=0;i<track.length;i++){
      const a=track[i],b=track[(i+1)%track.length];
      const m=project((a.x+b.x)*.5,(a.z+b.z)*.5,(a.y+b.y)*.5,cam);
      if(!visible(m,210))continue;
      segments.push({i,depth:m.depth,mid:m});
    }
    // Painter order gives more reliable intersections on serpentine roads.
    segments.sort((a,b)=>b.depth-a.depth);
    for(const seg of segments){
      const i=seg.i,a=track[i],b=track[(i+1)%track.length];
      const q=(at,s)=>{const p=offset(at,s);return project(p.x,p.z,p.y,cam);};
      const lOuter=q(a,-ROAD_HALF-2.5),rOuter=q(a,ROAD_HALF+2.5),lOuter2=q(b,-ROAD_HALF-2.5),rOuter2=q(b,ROAD_HALF+2.5);
      poly([lOuter,rOuter,rOuter2,lOuter2],i%18<9?'#665e49':'#70654e');
      const left=q(a,-ROAD_HALF),right=q(a,ROAD_HALF),left2=q(b,-ROAD_HALF),right2=q(b,ROAD_HALF);
      const shade=seeded(i*41);
      poly([left,right,right2,left2],shade<.28?'#ae9a70':shade<.66?'#b7a47d':'#bdad89');
      if(i%3===0){
        line(q(a,-ROAD_HALF+1),q(b,-ROAD_HALF+1),'#d4c39d66',.85*cam.scale);
        line(q(a,ROAD_HALF-1),q(b,ROAD_HALF-1),'#d4c39d66',.85*cam.scale);
      }
      const tire = i%9<7 ? '#7b6a5552' : '#b8a68155';
      line(q(a,-3.3),q(b,-3.3),tire,.58*cam.scale);
      line(q(a,3.3),q(b,3.3),tire,.58*cam.scale);
      if(i%15===3){
        const rock=q(a,-ROAD_HALF+4+seeded(i*2)*7);
        ctx.fillStyle='#675f4c98';ctx.beginPath();ctx.arc(rock.x,rock.y,Math.max(.4,cam.scale*.3),0,PI2);ctx.fill();
      }
    }
    // High contrast checkered start line, attached to the actual road bank.
    const at=track[0],follow=track[2];
    for(let j=0;j<10;j++){
      const lo=-ROAD_HALF+j*(2*ROAD_HALF/10),hi=lo+2*ROAD_HALF/10;
      const p0=offset(at,lo,.14),p1=offset(at,hi,.14),p2=offset(follow,hi,.14),p3=offset(follow,lo,.14);
      poly([project(p0.x,p0.z,p0.y,cam),project(p1.x,p1.z,p1.y,cam),project(p2.x,p2.z,p2.y,cam),project(p3.x,p3.z,p3.y,cam)],j%2?'#faf0d7':'#243b31');
    }
  }
  function foliage(cam){
    const items=[];
    for(const t of trees){const p=project(t.x,t.z,t.y,cam);if(!visible(p,80))continue;items.push({d:p.depth,t,p});}
    items.sort((a,b)=>b.d-a.d);
    for(const {t,p} of items){
      const top=project(t.x,t.z,t.y+t.h,cam);const rad=Math.max(2,t.r*cam.scale);
      const shadowX=p.x+rad*.55,shadowY=p.y+rad*.25;
      ctx.fillStyle='#071e1680';ctx.beginPath();ctx.ellipse(shadowX,shadowY,rad*.85,rad*.35,-.3,0,PI2);ctx.fill();
      line(p,top,'#463e2b',Math.max(1.1,cam.scale*.7));
      const k=t.shape;
      // Slightly irregular silhouette with multiple layered forest greens.
      ctx.fillStyle=k<.4?'#183c2f':k<.75?'#214b37':'#2d5238';
      ctx.beginPath();ctx.ellipse(top.x,top.y,rad*.96,rad*.77,-.32,0,PI2);ctx.fill();
      ctx.fillStyle=k<.4?'#305e44':k<.75?'#326847':'#456d49';
      ctx.beginPath();ctx.ellipse(top.x-rad*.25,top.y-rad*.19,rad*.62,rad*.5,-.32,0,PI2);ctx.fill();
      ctx.fillStyle='#81a16c4d';ctx.beginPath();ctx.ellipse(top.x-rad*.36,top.y-rad*.38,rad*.22,rad*.14,-.35,0,PI2);ctx.fill();
    }
    for(const t of stones){const p=project(t.x,t.z,t.y,cam);if(!visible(p,12))continue;ctx.fillStyle='#918d747a';ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,t.r*cam.scale),Math.max(.7,t.r*cam.scale*.55),0,0,PI2);ctx.fill();}
  }
  function carPolygon(cam,pts,fill,stroke){
    const th=state.theta,fx=Math.sin(th),fz=Math.cos(th),rx=Math.cos(th),rz=-Math.sin(th);
    poly(pts.map(([side,front,height])=>project(state.x+side*rx+front*fx,state.z+side*rz+front*fz,ground(state.x,state.z)+.7+height,cam)),fill,stroke,.7);
  }
  function carSegment(cam,a,b,color,width){
    const th=state.theta,fx=Math.sin(th),fz=Math.cos(th),rx=Math.cos(th),rz=-Math.sin(th);
    const toP=([side,front,height])=>project(state.x+side*rx+front*fx,state.z+side*rz+front*fz,ground(state.x,state.z)+.7+height,cam);
    line(toP(a),toP(b),color,width*cam.scale);
  }
  function drawCar(cam){
    const p=project(state.x,state.z,ground(state.x,state.z)+.35,cam);
    if(!visible(p,65))return;
    const shadow=project(state.x+2.2,state.z-1.7,ground(state.x,state.z),cam);
    ctx.fillStyle='#071914a6';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,6.1*cam.scale,3.5*cam.scale,0,0,PI2);ctx.fill();
    // Four solid rubber wheels; front wheels articulate with steering input.
    for(const side of [-1,1])for(const f of [-2.25,2.25]){
      carPolygon(cam,[[side*2.32,f-.99,.46],[side*2.32,f+.99,.46],[side*2.32,f+.99,1.24],[side*2.32,f-.99,1.24]],'#151b1a','#070d0b');
      carSegment(cam,[side*2.5,f-1,.89],[side*2.5,f+1,.89],'#55605a',.12);
    }
    // 3D body sides, main paint and sculpted fenders.
    carPolygon(cam,[[-1.94,-3.17,.5],[1.94,-3.17,.5],[1.94,3.18,.5],[-1.94,3.18,.5]],'#7c301f');
    carPolygon(cam,[[1.94,-3.17,.5],[1.94,3.18,.5],[1.82,3.04,1.36],[1.82,-3.02,1.36]],'#a43e24');
    carPolygon(cam,[[-1.94,-3.17,.5],[-1.94,3.18,.5],[-1.82,3.04,1.36],[-1.82,-3.02,1.36]],'#d76b2c');
    carPolygon(cam,[[-1.82,-3.08,1.34],[1.82,-3.08,1.34],[1.9,-1.55,1.34],[1.77,1.74,1.34],[1.6,3.14,1.34],[-1.6,3.14,1.34],[-1.77,1.74,1.34],[-1.9,-1.55,1.34]],'#ee933a','#f7b95f');
    // Deep hood shaping.
    carPolygon(cam,[[-1.35,1.04,1.41],[1.35,1.04,1.41],[1.43,2.72,1.41],[-1.43,2.72,1.41]],'#edac47');
    carPolygon(cam,[[-.42,1.17,1.43],[.42,1.17,1.43],[.57,2.8,1.43],[-.57,2.8,1.43]],'#d87e30');
    // Side windows and rear glazing.
    carPolygon(cam,[[-1.38,-1.52,1.48],[1.38,-1.52,1.48],[1.15,-.72,2.42],[-1.15,-.72,2.42]],'#24434a');
    carPolygon(cam,[[-1.48,-.5,1.46],[1.48,-.5,1.46],[1.16,.95,2.35],[-1.16,.95,2.35]],'#203a47');
    carPolygon(cam,[[-1.2,-.84,2.41],[1.2,-.84,2.41],[1.16,.91,2.41],[-1.16,.91,2.41]],'#f0e5c7');
    // Windscreen and its reflection; the front of the car is +forward.
    carPolygon(cam,[[-1.15,.96,2.39],[1.15,.96,2.39],[1.47,1.72,1.48],[-1.47,1.72,1.48]],'#274755');
    carSegment(cam,[-.95,1.04,2.4],[.25,1.56,1.69],'#acc5c5a1',.12);
    // Windshield roof and racing stripe.
    carPolygon(cam,[[-.26,-.7,2.47],[.26,-.7,2.47],[.26,.84,2.47],[-.26,.84,2.47]],'#db6840');
    // Headlights, grille and taillights.
    for(const side of [-1,1]){
      carPolygon(cam,[[side*1.03,2.88,1.48],[side*1.55,2.88,1.48],[side*1.46,3.18,1.46],[side*.98,3.18,1.46]],'#ffedbd');
      carPolygon(cam,[[side*.89,-3.1,1.45],[side*1.65,-3.1,1.45],[side*1.63,-2.94,1.47],[side*.9,-2.94,1.47]],'#e64330');
    }
    carPolygon(cam,[[-.83,3.12,1.37],[.83,3.12,1.37],[.76,3.23,1.37],[-.76,3.23,1.37]],'#38413c');
    carPolygon(cam,[[-2.0,-3.28,1.82],[2.0,-3.28,1.82],[2,-2.9,1.82],[-2,-2.9,1.82]],'#2c342c');
    carSegment(cam,[-2.0,-3.28,1.82],[2,-3.28,1.82],'#f2cc74',.16);
  }
  function drawDust(cam){
    for(const d of state.dust){const p=project(d.x,d.z,d.y,cam);if(!visible(p,50))continue;ctx.fillStyle=`rgba(213,199,158,${Math.max(0,d.life*.19)})`;ctx.beginPath();ctx.ellipse(p.x,p.y,d.r*cam.scale,d.r*cam.scale*.58,0,0,PI2);ctx.fill();}
  }
  function draw(){
    if(w<1||h<1)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const cam=camera();
    background(cam);drawRoad(cam);foliage(cam);drawDust(cam);drawCar(cam);
    // Minimal textured haze, no heavyweight postprocessing.
    const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#0b25131a');grad.addColorStop(.7,'#00000000');grad.addColorStop(1,'#05160c30');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  }
  function updateHud(){
    UI.time.textContent=formatTime(state.lapT);UI.lap.textContent=String(state.lap).padStart(2,'0');
    UI.speed.textContent=String(Math.round(state.speed*3.6));
    UI.best.textContent=state.best?formatTime(state.best):'—';
    UI.surface.textContent=state.offroad?'MAASTO':'SORATIE';UI.surface.classList.toggle('offroad',state.offroad);
    UI.message.textContent=state.offroad?'Takaisin tielle — nyt menetät vauhtia.':state.speed>43?'Katso pitkälle. Ennakoiva ajolinja ratkaisee.':'Opettele rata. Aja sitten kovempaa.';
  }
  function tick(now){
    try{
      const dt=clamp((now-last)/1000,0,.05);last=now;frameCount++;
      if(state.running&&!state.paused)update(dt);
      draw();
      if(frameCount%4===0)updateHud();
      if(now>toastUntil)UI.toast.classList.remove('show');
    }catch(e){console.error('GOPs Rally rendering error',e);UI.message.textContent='Virhe ajossa — avaa konsoli lisätietoihin.';}
    requestAnimationFrame(tick);
  }
  window.__gopsRallyDebug={getSnapshot:()=>({running:state.running,paused:state.paused,camera:state.camera,speed:state.speed,lap:state.lap,offroad:state.offroad,trackSegments:SEGMENTS,trees:trees.length,canvas:[canvas.width,canvas.height]}), reset:resetCar};
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline cache unavailable',e)));
  requestAnimationFrame(tick);
})();

