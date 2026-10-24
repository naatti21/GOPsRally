/**
 * Experimental Draw Mode planning geometry. This is a physics test bench,
 * not a car-animation path. Dimensions are world metres.
 * Natural cubic splines interpolate joins with C2 position/tangent/curvature.
 */
const finite = Number.isFinite;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
function second(values,knots) {
  const n=values.length, a=Array(n).fill(0),b=Array(n).fill(0),
    c=Array(n).fill(0),d=Array(n).fill(0),m=Array(n).fill(0);
  for(let i=1;i<n-1;i++) {
    const h0=knots[i]-knots[i-1],h1=knots[i+1]-knots[i];
    a[i]=h0;b[i]=2*(h0+h1);c[i]=h1;
    d[i]=6*((values[i+1]-values[i])/h1-(values[i]-values[i-1])/h0);
  }
  for(let i=2;i<n-1;i++) {
    const q=a[i]/b[i-1];b[i]-=q*c[i-1];d[i]-=q*d[i-1];
  }
  for(let i=n-2;i>=1;i--)m[i]=(d[i]-c[i]*m[i+1])/b[i];
  return m;
}
function sample(values,knots,m,i,t) {
  const h=knots[i+1]-knots[i],a=(knots[i+1]-t)/h,b=(t-knots[i])/h;
  return {
    value:a*values[i]+b*values[i+1]+((a*a*a-a)*m[i]+(b*b*b-b)*m[i+1])*h*h/6,
    slope:(values[i+1]-values[i])/h+((1-3*a*a)*m[i]+(3*b*b-1)*m[i+1])*h/6,
    curvature:a*m[i]+b*m[i+1]
  };
}
export function compileSegments(segments,{spacing=1.5}={}) {
  if(!Array.isArray(segments)||!segments.length||!finite(spacing)||spacing<=0.1)
    throw Error('Expected joined segments and positive spacing');
  const anchors=[],joins=[];
  for(let i=0;i<segments.length;i++) {
    const points=segments[i]?.points;
    if(!Array.isArray(points)||points.length<2)throw Error('Each segment needs 2+ anchors');
    for(let j=0;j<points.length;j++) {
      const p=points[j];
      if(![p?.x,p?.z,p?.speedKmh].every(finite)||p.speedKmh<0||p.speedKmh>240)
        throw Error('Invalid position or target speed');
      if(anchors.length && distance(p,anchors.at(-1))<0.001) {
        if(j!==0||i===0||Math.abs(p.speedKmh-anchors.at(-1).speedKmh)>0.001)
          throw Error('Zero-length step or conflicting join speed');
        joins.push(anchors.length-1);
        continue;
      }
      if(i>0 && j===0)throw Error('Segments must share identical endpoints');
      anchors.push({x:p.x,z:p.z,speedKmh:p.speedKmh});
    }
  }
  if(anchors.length<3)throw Error('Need 3+ distinct control points');
  const knots=[0];
  for(let i=1;i<anchors.length;i++)knots.push(knots.at(-1)+distance(anchors[i],anchors[i-1]));
  const xs=anchors.map(p=>p.x),zs=anchors.map(p=>p.z);
  const mx=second(xs,knots),mz=second(zs,knots);
  function at(i,t) {
    const x=sample(xs,knots,mx,i,t),z=sample(zs,knots,mz,i,t);
    const norm=Math.hypot(x.slope,z.slope);
    if(norm<1e-4)throw Error('Degenerate line tangent');
    const f=(t-knots[i])/(knots[i+1]-knots[i]);
    return {x:x.value,z:z.value,tx:x.slope/norm,tz:z.slope/norm,
      curvature:(x.slope*z.curvature-z.slope*x.curvature)/(norm**3),
      speedMps:(anchors[i].speedKmh*(1-f)+anchors[i+1].speedKmh*f)/3.6};
  }
  const samples=[];
  for(let i=0;i<anchors.length-1;i++) {
    const count=Math.max(2,Math.ceil((knots[i+1]-knots[i])/spacing));
    for(let j=0;j<count;j++) {
      const v=at(i,knots[i]+(knots[i+1]-knots[i])*j/count);
      samples.push({...v,s:samples.length?samples.at(-1).s+distance(samples.at(-1),v):0});
    }
  }
  const end=at(anchors.length-2,knots.at(-1));
  samples.push({...end,s:samples.at(-1).s+distance(samples.at(-1),end)});
  return {anchors,joins,samples,length:samples.at(-1).s,geometry:{knots,mx,mz}};
}
export function lineAtKnot(path,anchorIndex,side='left') {
  const {knots,mx,mz}=path.geometry;
  const i=side==='left'?anchorIndex-1:anchorIndex;
  if(i<0||i>=knots.length-1)throw Error('Not an interior knot');
  return {
    x:sample(path.anchors.map(p=>p.x),knots,mx,i,knots[anchorIndex]),
    z:sample(path.anchors.map(p=>p.z),knots,mz,i,knots[anchorIndex])
  };
}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function drawDriver(path,{lookAheadSeconds=0.5,maxLookAhead=24}={}) {
  let cursor=0;
  return {
    reset(){cursor=0;},
    read({position,rotation:q,speed}) {
      let index=cursor,best=Infinity;
      for(let i=Math.max(0,cursor-5);i<Math.min(path.samples.length,cursor+95);i++) {
        const d=distance(position,path.samples[i]);
        if(d<best){best=d;index=i;}
      }
      cursor=Math.max(cursor,index);
      const lookAhead=clamp(7+Math.abs(speed)*lookAheadSeconds,7,maxLookAhead);
      let target=cursor;
      while(target<path.samples.length-1 &&
        path.samples[target].s<path.samples[cursor].s+lookAhead)target++;
      const p=path.samples[target];
      const forwardX=-2*(q.x*q.z+q.w*q.y);
      const forwardZ=-(1-2*(q.x*q.x+q.y*q.y));
      const heading=Math.atan2(forwardX,-forwardZ);
      const goal=Math.atan2(p.x-position.x,-(p.z-position.z));
      const error=wrap(goal-heading);
      const desired=path.samples[Math.min(path.samples.length-1,cursor+3)].speedMps;
      return {left:error< -0.045,right:error>0.045,brake:speed>desired+1.25,
        progress:path.samples[cursor].s,lineError:best,headingError:error,
        targetSpeed:desired,done:cursor>=path.samples.length-4};
    }
  };
}
export const PHYSICS_TEST_LINE=[
 {points:[{x:0,z:70,speedKmh:75},{x:0,z:18,speedKmh:75},{x:2,z:-20,speedKmh:70}]},
 {points:[{x:2,z:-20,speedKmh:70},{x:14,z:-49,speedKmh:58},{x:37,z:-68,speedKmh:55}]},
 {points:[{x:37,z:-68,speedKmh:55},{x:57,z:-99,speedKmh:53},{x:48,z:-132,speedKmh:58}]},
 {points:[{x:48,z:-132,speedKmh:58},{x:21,z:-162,speedKmh:72},{x:18,z:-221,speedKmh:85}]}
];
