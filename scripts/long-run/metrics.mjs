export function summarize(rows) {
  const dt=1/60;
  let spinFrames=0,offFrames=0,spins=0,offRoad=0,recoveries=0,cycles=0,lastSign=0,alternations=0,dwell=0,pending=0,healthy=0,wasLost=false;
  let moderate=0,longest=0,current=0,distance=0,overcorrections=0,releaseAlternations=0,lastButtonSign=0,lastReversal=-Infinity;
  const phaseEvents={};
  for(let i=0;i<rows.length;i++) {
    const r=rows[i],moving=r.speed>5,slip=Math.abs(r.beta);
    if(moving&&slip>=6&&slip<=18){moderate+=dt;current+=dt;longest=Math.max(longest,current);}else current=0;
    spinFrames=moving&&slip>60?spinFrames+1:0;
    offFrames=r.margin< -2?offFrames+1:0;
    if(spinFrames===15){spins++;wasLost=true;phaseEvents[r.phase]=(phaseEvents[r.phase]||0)+1;}
    if(offFrames===30){offRoad++;wasLost=true;}
    if(wasLost&&slip<10&&Math.abs(r.yaw)<15&&r.margin>=0&&moving)healthy++;else healthy=0;
    if(healthy===60){recoveries++;wasLost=false;}
    const buttonSign=r.right?1:r.left?-1:0;
    if(buttonSign&&lastButtonSign&&buttonSign!==lastButtonSign)lastReversal=i;
    if(buttonSign)lastButtonSign=buttonSign;
    // Count alternating *physical yaw*, not +/-180 degree wrapping in a continuous spin.
    const sign=moving&&slip>6&&slip<60&&Math.abs(r.yaw)>10?Math.sign(r.yaw):0;
    if(sign!==pending){pending=sign;dwell=0;}else dwell++;
    if(sign&&dwell===6){if(lastSign&&sign!==lastSign){alternations++;if(i-lastReversal<=60)overcorrections++;if(r.phase==='release')releaseAlternations++;}lastSign=sign;}
    if(i)distance+=Math.hypot(r.x-rows[i-1].x,r.z-rows[i-1].z);
  }
  cycles=Math.floor(alternations/2);
  const max=k=>rows.reduce((m,r)=>Math.max(m,Math.abs(r[k])),0);
  const mean=k=>rows.reduce((m,r)=>m+r[k],0)/rows.length;
  const tail=rows.slice(-60);
  return {seconds:rows.length*dt,distanceMeters:distance,peakSlip:max('beta'),moderateSeconds:moderate,longestModerateSeconds:longest,
    peakYaw:max('yaw'),oscillationCycles:cycles,overcorrections,releaseAlternations,spinouts:spins,offRoadEvents:offRoad,recoveries,spinOnsetPhase:phaseEvents,
    offRoadSeconds:rows.filter(r=>r.margin<0).length*dt,meanKmh:mean('speed')*3.6,exitKmh:rows.at(-1).speed*3.6,
    peakPitch:max('pitch'),peakRoll:max('roll'),peakLateralAcceleration:max('ay'),
    finalAbsSlip:tail.reduce((s,r)=>s+Math.abs(r.beta),0)/tail.length,finalAbsYaw:tail.reduce((s,r)=>s+Math.abs(r.yaw),0)/tail.length,
    finalX:rows.at(-1).x,finalZ:rows.at(-1).z,
    rackReversals:rows.reduce((s,r,i)=>s+(i>0&&r.rack*rows[i-1].rack<0?1:0),0),
    lostContactSeconds:rows.filter(r=>r.wheels.filter(w=>w.contact).length<2).length*dt,
    outsideMeshSeconds:rows.filter(r=>!r.inDomain).length*dt,
    minLoad:rows.reduce((m,r)=>Math.min(m,...r.wheels.map(w=>w.load)),Infinity),
    maxLoad:rows.reduce((m,r)=>Math.max(m,...r.wheels.map(w=>w.load)),0),
    minTravel:rows.reduce((m,r)=>Math.min(m,...r.wheels.map(w=>w.length)),Infinity),
    maxTravel:rows.reduce((m,r)=>Math.max(m,...r.wheels.map(w=>w.length)),0)};
}
