import {wrap} from './road.mjs';
export function pulseInput(t,{pulse=.65,delay=0,hold=0}={}) {
  return {right:t<pulse,left:t>=pulse+delay&&t<pulse+delay+hold,brake:false};
}
export function chicaneInput(t) {
  const phase=t%12,cycle=Math.floor(t/12),right=cycle%2===0;
  const on=phase<(cycle%3===0?1.8:.65),catching=phase>=2.1&&phase<2.4;
  return {right:right?on:catching,left:right?catching:on,brake:phase>=9&&phase<9.7};
}
// Sampled, delayed digital driver. Reads snapshots only. No car/body reference.
export function digitalDriver(road,{delay=.2,period=.2,maxSpeed=100/3.6,brakeMode='speed-plan',lineOffset=0}={}) {
  let next=0,held={left:false,right:false,brake:false},history=[];
  return (t,state)=>{
    history.push({t,...state});
    while(history.length>1&&history[1].t<=t-delay)history.shift();
    if(t+1e-9<next)return {...held,decision:false};
    next=t+period;
    const old=history[0],p=road.nearest(old.x,old.z),v=old.speed;
    const ahead=road.at(p.s+Math.min(40,10+v*.65));
    const error=wrap(Math.atan2(ahead.x-ahead.tz*lineOffset-old.x,-(ahead.z+ahead.tx*lineOffset-old.z))-old.heading);
    let target=maxSpeed;
    // Plan braking from geometric curvature; no desired yaw/position is applied.
    for(let d=0;d<=90;d+=10){
      const a=road.at(p.s+d),b=road.at(p.s+d+8),c=road.at(p.s+d+16);
      const k=Math.abs(wrap(Math.atan2(c.tx,-c.tz)-Math.atan2(a.tx,-a.tz)))/16;
      if(k>.001)target=Math.min(target,Math.sqrt(4.5/k+2*4*Math.max(0,d-12)));
    }
    const a=road.at(p.s),b=road.at(p.s+12);
    const inCorner=Math.abs(wrap(Math.atan2(b.tx,-b.tz)-Math.atan2(a.tx,-a.tz)))/12>.004;
    const brake=(v>target+1&&(brakeMode!=='pre-corner'||!inCorner)) || p.distance>12&&v>6;
    held={left:error<-.06,right:error>.06,brake};
    return {...held,decision:true,reason:p.distance>12?'off-road braking':brake?'speed plan':'heading deadband',targetSpeed:target};
  };
}
