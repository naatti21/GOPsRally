import {makeTrack,projectRoad,validateTrack} from './track.js';
export const SURFACES={compact:0,loose:1,shoulder:2,grass:3};
// Clear surface zones for small mobile viewports: gravel, loose gravel, dark shoulder, vegetation.
export const COLORS=[[.48,.35,.22],[.57,.43,.27],[.30,.29,.22],[.15,.31,.18]];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function terrain(x,z){return 3*Math.sin(x*.025)+4*Math.cos(z*.023)+2*Math.sin((x+z)*.035)}
// This authoring function runs only while building the authoritative mesh.
function sculpt(track,x,z,terrainHeight){
  const r=projectRoad(track,x,z),d=r.distance;
  const blend=1-smooth((d-track.roadHalf)/track.shoulder);
  const crown=.055*(1-Math.min(1,(r.lateral/track.roadHalf)**2));
  const bumps=.06*Math.sin(x*1.2)*Math.cos(z*.9);
  const roadY=r.y+Math.tan(r.bank)*r.lateral+crown+bumps;
  const height=terrainHeight(x,z)*(1-blend)+roadY*blend;
  const type=d>track.roadHalf+track.shoulder?SURFACES.grass:d>track.roadHalf?SURFACES.shoulder:d>track.roadHalf*.65?SURFACES.loose:SURFACES.compact;
  return {height,type};
}
export function buildSurface({step=1.5,size=330,track=makeTrack(),terrainHeight=terrain}={}){
  validateTrack(track);
  if(!Number.isFinite(step)||step<.5||!Number.isFinite(size)||size<100)throw Error('Invalid surface resolution');
  if(track.nodes.some(n=>Math.max(Math.abs(n.x),Math.abs(n.z))+track.roadHalf+track.shoulder>=size/2))throw Error('Track corridor outside terrain');
  const cells=Math.ceil(size/step),spacing=size/cells,n=cells+1,min=-size/2;
  const positions=new Float32Array(n*n*3),colors=new Float32Array(n*n*3),types=new Uint8Array(n*n);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,px=min+x*spacing,pz=min+z*spacing,{height,type}=sculpt(track,px,pz,terrainHeight);
    positions.set([px,height,pz],i*3);colors.set(COLORS[type],i*3);types[i]=type;
  }
  const indices=new Uint32Array(cells*cells*6);
  for(let z=0;z<cells;z++)for(let x=0;x<cells;x++){
    const a=z*n+x,b=a+1,c=a+n,d=c+1,k=(z*cells+x)*6;
    indices.set([a,c,b,b,c,d],k); // upward winding, shared vertices, no road overlay
  }
  return {positions,indices,colors,types,track,cells,n,min,size,spacing};
}
// Exact barycentric sampling of emitted triangles, not a second analytical height function.
export function sampleSurface(data,x,z){
  const gx=(x-data.min)/data.spacing,gz=(z-data.min)/data.spacing;
  if(gx<0||gz<0||gx>=data.cells||gz>=data.cells)return null;
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,a=iz*data.n+ix;
  const ids=u+v<=1?[a,a+data.n,a+1]:[a+1,a+data.n,a+data.n+1];
  const w=u+v<=1?[1-u-v,v,u]:[1-v,1-u,u+v-1];
  const p=ids.map(i=>Array.from(data.positions.slice(i*3,i*3+3)));
  const ab=p[1].map((n,i)=>n-p[0][i]),ac=p[2].map((n,i)=>n-p[0][i]);
  const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal);
  return {height:p.reduce((h,q,i)=>h+q[1]*w[i],0),normal:normal.map(n=>n/length),type:data.types[ids[w.indexOf(Math.max(...w))]],ids};
}
