// Exact segment BVH: telemetry/driver queries never alter physical state.
export const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
export function roadIndex(track) {
  const segments=track.nodes.map((a,i)=>({a,b:track.nodes[(i+1)%track.nodes.length],i}));
  function build(items) {
    const box={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
    for(const {a,b} of items) {
      box.minX=Math.min(box.minX,a.x,b.x);box.maxX=Math.max(box.maxX,a.x,b.x);
      box.minZ=Math.min(box.minZ,a.z,b.z);box.maxZ=Math.max(box.maxZ,a.z,b.z);
    }
    if(items.length<=8)return {...box,items};
    const axis=box.maxX-box.minX>box.maxZ-box.minZ?'x':'z';
    items.sort((u,v)=>(u.a[axis]+u.b[axis])-(v.a[axis]+v.b[axis]));
    const mid=items.length>>1;return {...box,children:[build(items.slice(0,mid)),build(items.slice(mid))]};
  }
  const root=build([...segments]);
  const boxDistance=(n,x,z)=>Math.max(n.minX-x,0,x-n.maxX)**2+Math.max(n.minZ-z,0,z-n.maxZ)**2;
  function nearest(x,z) {
    let best={distance:Infinity,i:Infinity};
    function visit(node) {
      if(boxDistance(node,x,z)>best.distance**2+1e-10)return;
      if(node.children){const c=[...node.children].sort((a,b)=>boxDistance(a,x,z)-boxDistance(b,x,z));c.forEach(visit);return;}
      for(const {a,b,i} of node.items){
        const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(l*l)));
        const px=a.x+u*dx,pz=a.z+u*dz,distance=Math.hypot(x-px,z-pz);
        if(distance<best.distance-1e-10 || Math.abs(distance-best.distance)<1e-10&&i<best.i)
          best={distance,i,x:px,z:pz,y:a.y+(b.y-a.y)*u,tx:dx/l,tz:dz/l,lateral:((x-px)*dz-(z-pz)*dx)/l,s:a.s+u*((i===segments.length-1?track.length:b.s)-a.s)};
      }
    }visit(root);return best;
  }
  function at(s) {
    s=(s%track.length+track.length)%track.length;
    let lo=0,hi=segments.length;
    while(lo+1<hi){const m=(lo+hi)>>1;if(segments[m].a.s<=s)lo=m;else hi=m;}
    const {a,b}=segments[lo],end=lo===segments.length-1?track.length:b.s,u=(s-a.s)/(end-a.s);
    return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u,tx:a.tx,tz:a.tz,s};
  }
  return {nearest,at};
}
export function ovalTrack() {
  const points=[],R=80,L=400;
  for(let i=0;i<200;i++)points.push({x:-R,z:L/2-i*L/200});
  for(let i=0;i<126;i++){const t=i*Math.PI/126;points.push({x:-R*Math.cos(t),z:-L/2-R*Math.sin(t)});}
  for(let i=0;i<200;i++)points.push({x:R,z:-L/2+i*L/200});
  for(let i=0;i<126;i++){const t=i*Math.PI/126;points.push({x:R*Math.cos(t),z:L/2+R*Math.sin(t)});}
  let length=0;
  const nodes=points.map((a,i)=>{const b=points[(i+1)%points.length],d=Math.hypot(b.x-a.x,b.z-a.z),n={...a,y:0,s:length,tx:(b.x-a.x)/d,tz:(b.z-a.z)/d,bank:0};length+=d;return n;});
  return {nodes,length,roadHalf:6.5,shoulder:9};
}
