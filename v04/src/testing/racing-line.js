/**
 * A fixed 90-degree right-hand hairpin-ish corner with three alternative
 * planned lines. Not an optimality oracle: racing line quality is measured
 * by Rapier simulation, not assumed from the waypoint shape.
 *
 * World axes: heading -Z on approach, +X on exit.
 * Same track width, same start, same finish and speed plan for every trial.
 */
import { compileSegments } from './line-lab.js';

export const CORNER = Object.freeze({
  radius: 35,
  roadHalf: 6.5,
  entry: 75,
  exit: 65,
});
const clamp01=t=>Math.max(0,Math.min(1,t));
const smooth5=t=>{t=clamp01(t);return t*t*t*(10+t*(-15+6*t));};
function between(t,a,b){return smooth5((t-a)/(b-a));}
export function cornerCenterSamples(config=CORNER) {
  const {radius:R,entry,exit}=config, nodes=[];
  const push=(x,z,tx,tz)=>{
    const prev=nodes.at(-1);
    nodes.push({x,z,tx,tz,s:prev?prev.s+Math.hypot(x-prev.x,z-prev.z):0});
  };
  for(let j=0;j<=6;j++)push(0,entry*(1-j/6),0,-1);
  for(let j=1;j<=12;j++){
    const theta=Math.PI+Math.PI*j/24;
    push(R+R*Math.cos(theta),R*Math.sin(theta),-Math.sin(theta),Math.cos(theta));
  }
  for(let j=1;j<=6;j++)push(R+exit*j/6,-R,1,0);
  return nodes;
}
function profile(s,arcStart,arcEnd,end) {
  // Same planned speed across all paths: brake on straight approach and
  // resume automatic drive through the bend. Actual brake input is clipped
  // to the approach so corner steering doesn't rely on brake+steer gestures.
  if(s<arcStart-37)return 83;
  if(s<arcStart-4)return 83-39*between(s,arcStart-37,arcStart-4);
  if(s<arcEnd)return 44;
  return 44+38*between(s,arcEnd,end);
}
function offsetFor(id,s,arcStart,arcEnd,end) {
  const apex=(arcStart+arcEnd)/2;
  switch(id){
    case 'center':
      return 0;
    case 'late-apex':
      return -3.6*between(s,0,arcStart-17)
        +7.3*between(s,arcStart+5,apex+10)
        -7.3*between(s,apex+10,arcEnd+23)
        +3.6*between(s,arcEnd+23,end);
    case 'early-apex':
      return -3.6*between(s,0,arcStart-20)
        +7.3*between(s,arcStart-14,apex-10)
        -7.3*between(s,apex-10,arcEnd+8)
        +3.6*between(s,arcEnd+8,end);
    case 'inside':
      return 3.6*between(s,0,arcStart-13)-
        3.6*between(s,arcEnd+10,end);
    default:throw Error('Unknown racing line: '+id);
  }
}
export const LINE_IDS=Object.freeze(['center','late-apex','early-apex','inside']);
export function nearestRoad(center,x,z) {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Invalid world point');
  let distance=Infinity,s=0,side=0;
  for(let i=1;i<center.length;i++){
    const a=center[i-1],b=center[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp01(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz));
    const px=a.x+t*dx,pz=a.z+t*dz;
    const separation=Math.hypot(x-px,z-pz);
    if(separation<distance){
      distance=separation;s=a.s+t*(b.s-a.s);
      const length=Math.hypot(dx,dz);
      side=((x-px)*(-dz)+(z-pz)*dx)/length;
    }
  }
  return {distance,s,side};
}
export function makeCornerLine(id,config=CORNER) {
  const center=cornerCenterSamples(config);
  const R=config.radius,arcStart=config.entry,arcEnd=arcStart+Math.PI*R/2;
  const end=center.at(-1).s;
  const anchors=center.map(p=>{
    const offset=offsetFor(id,p.s,arcStart,arcEnd,end);
    return {x:p.x-p.tz*offset,z:p.z+p.tx*offset,
      speedKmh:profile(p.s,arcStart,arcEnd,end)};
  });
  const segments=[];
  for(let i=0;i<anchors.length-1;i+=4){
    segments.push({points:anchors.slice(i,Math.min(i+5,anchors.length))});
  }
  const path=compileSegments(segments,{spacing:1.3});
  let maximum=0;
  for(const p of path.samples){
    maximum=Math.max(maximum,nearestRoad(center,p.x,p.z).distance);
  }
  if(maximum>config.roadHalf-0.5)
    throw Error('Planned line crosses track boundary '+id+': '+maximum.toFixed(2));
  return {id,path,center,maxPlannedOffsetMeters:maximum,
    roadHalf:config.roadHalf,arcStart,arcEnd,
    finish:{x:R+config.exit-2,z:-R}};
}
