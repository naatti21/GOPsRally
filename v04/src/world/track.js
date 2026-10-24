// Meters, Y up. Vehicle forward is local -Z and right is +X. No renderer-specific heights.
import {CatmullRomCurve3,Vector3} from 'three';
export const ROAD_HALF=4.5, SHOULDER=4.5;
const points=[[-75,-95,1],[-75,-35,4],[-70,35,7],[-40,85,11],[15,95,8],[65,65,3],[72,15,-2],[50,-12,-3],[10,-8,0],[-1,-38,4],[30,-65,7],[70,-77,6],[62,-110,2],[0,-120,0]];
export function makeTrack(){
  const curve=new CatmullRomCurve3(points.map(([x,z,y])=>new Vector3(x,y,z)),true,'centripetal');
  const length=curve.getLength(), count=Math.ceil(length/1.5);
  const nodes=Array.from({length:count},(_,i)=>{
    const t=i/count,p=curve.getPointAt(t),tangent=curve.getTangentAt(t);
    const a=curve.getTangentAt((t-2/count+1)%1),b=curve.getTangentAt((t+2/count)%1);
    const turn=Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z);
    // Low, signed banking; cross-section uses exactly this slope, not visual roll.
    const bank=Math.max(-.13,Math.min(.13,-turn*.45));
    const norm=Math.hypot(tangent.x,tangent.z);
    return {x:p.x,y:p.y,z:p.z,tx:tangent.x/norm,tz:tangent.z/norm,bank,s:i*length/count};
  });
  return {nodes,length,roadHalf:ROAD_HALF,shoulder:SHOULDER};
}
function crosses(a,b,c,d){
  const side=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  return side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0;
}
export function validateTrack(track){
  const {nodes,roadHalf,shoulder}=track,outer=roadHalf+shoulder;
  if(nodes.length<4||!(roadHalf>0&&shoulder>0))throw Error('Invalid track dimensions');
  for(let i=0;i<nodes.length;i++){
    const a=nodes[i],b=nodes[(i+1)%nodes.length];
    if(![a.x,a.y,a.z,a.bank].every(Number.isFinite)||Math.hypot(b.x-a.x,b.z-a.z)<.01)throw Error('Invalid track segment');
    // Reject grade-separated crossings / ambiguous nearby corridors rather than choose a height.
    for(let j=i+1;j<nodes.length;j++){
      const c=nodes[j],d=nodes[(j+1)%nodes.length];
      if(j!==i+1&&!(i===0&&j===nodes.length-1)&&crosses(a,b,c,d))throw Error('Crossing road segments');
      const arc=Math.min(Math.abs(nodes[j].s-a.s),track.length-Math.abs(nodes[j].s-a.s));
      if(arc>outer*4&&Math.hypot(nodes[j].x-a.x,nodes[j].z-a.z)<outer*2)throw Error('Overlapping non-neighbor road corridors');
    }
  }
}
export function projectRoad(track,x,z,full=false){
  let best=null,d2=Infinity;
  const ns=track.nodes;
  for(const i of (full?null:track.candidates?.(x,z))??ns.keys()){
    const a=ns[i],b=ns[(i+1)%ns.length],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    const px=a.x+t*dx,pz=a.z+t*dz,dist=(x-px)**2+(z-pz)**2;
    if(dist<d2){const len=Math.hypot(dx,dz);d2=dist;best={x:px,z:pz,y:a.y+t*(b.y-a.y),lateral:((x-px)*dz-(z-pz)*dx)/len,bank:a.bank+t*(b.bank-a.bank),distance:Math.sqrt(dist),segment:i,t};}
  }
  if(!full&&track.candidates&&(!best||best.distance>track.candidateRadius))return projectRoad(track,x,z,true);
  return best;
}
