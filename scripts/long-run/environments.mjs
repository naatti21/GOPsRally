import {buildSector} from '../../v04/src/world/sector.js';
import {sampleSurface} from '../../v04/src/world/surface.js';
import {roadIndex,ovalTrack} from './road.mjs';
import {hash} from './versions.mjs';
const cache=new Map();
export function environment(name) {
  if(cache.has(name))return cache.get(name);
  let data,track;
  if(name.startsWith('real')) {
    data=buildSector();track=data.track;
    if(name==='real-flat'){
      for(let i=1;i<data.positions.length;i+=3)data.positions[i]=0;
      track={...track,nodes:track.nodes.map(n=>({...n,y:0,bank:0}))};
    }
  } else {
    track=ovalTrack();
    if(name!=='open') {
      const cells=254,n=cells+1,size=760,spacing=size/cells,min=-size/2;
      const positions=new Float32Array(n*n*3),indices=new Uint32Array(cells*cells*6),types=new Uint8Array(n*n),road=roadIndex(track);
      for(let z=0;z<n;z++)for(let x=0;x<n;x++){
        const px=min+x*spacing,pz=min+z*spacing,r=road.nearest(px,pz);
        const blend=Math.max(0,1-Math.max(0,r.distance-8)/30);
        const bank=name==='oval-banked'?-.07*r.lateral*blend:0;
        const bump=name==='oval-uneven'?.12*Math.sin(px*.43+pz*.11)*Math.cos(pz*.25)+.04*Math.sin((px-pz)*.48):0;
        positions.set([px,bank+bump,pz],3*(z*n+x));
      }
      for(let z=0;z<cells;z++)for(let x=0;x<cells;x++){
        const a=z*n+x;indices.set([a,a+n,a+1,a+1,a+n,a+n+1],6*(z*cells+x));
      }
      data={positions,indices,types,cells,n,size,spacing,min};
    }
  }
  const road=roadIndex(track);
  const sample=(x,z)=>data?sampleSurface(data,x,z):{height:0,type:0};
  const surfaceAt=(x,z)=>name==='oval-low'?2:name==='oval-transition'?(road.nearest(x,z).s>track.length/2?2:0):name==='real-full'||name==='real-flat'?sample(x,z)?.type??3:0;
  const meshHash=data?hash(Buffer.concat([Buffer.from(data.positions.buffer),Buffer.from(data.indices.buffer),Buffer.from(data.types.buffer)])):hash('cuboid 20000,.1,20000 translation 0,-.1,0');
  const env={name,data,track,road,sample,surfaceAt,meshHash};cache.set(name,env);return env;
}
