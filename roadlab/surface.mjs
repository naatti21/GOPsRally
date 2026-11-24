// RoadLab row strips, with shoulders and grass sharing the exact boundary vertices.
// Every vertex is rounded once to the precision uploaded to WebGL.
export const ROAD_HALF = 9.5;
export const SHOULDER = 12;
export const GRASS_EDGE = 52;
export const STRAIGHT = 320;
export const RADIUS = 70;
export const CREST_S = 175;
export const LAP = 2 * STRAIGHT + 2 * Math.PI * RADIUS;
export const FINISH_S = 34;
const LIMIT = 8000;
const STEP = .8;
const CELL = 16;
const offsets = [-52,-38,-26,-18,-14,-12,-9.5,-3.6,0,3.6,9.5,12,14,18,26,38,52];
const palette = [
  [.22,.36,.24], [.224,.365,.242], [.23,.38,.25], [.24,.385,.255], [.25,.39,.26],
  [.43,.36,.28], [.65,.54,.40], [.58,.47,.34], [.63,.52,.38], [.67,.56,.42], [.43,.36,.28],
  [.25,.39,.26], [.24,.385,.255], [.23,.38,.25], [.224,.365,.242], [.22,.36,.24]
];
const grass = [.22,.36,.24];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = (n) => { const t = clamp(n,0,1); return t*t*(3-2*t); };
const wrap = (s) => ((s % LAP) + LAP) % LAP;

export function centerline(distance) {
  const s = wrap(distance);
  const arc = Math.PI * RADIUS;
  if (s < STRAIGHT) return {x:-RADIUS,z:s-STRAIGHT/2,theta:0,curve:0};
  if (s < STRAIGHT + arc) {
    const angle = (s - STRAIGHT) / RADIUS;
    return {x:-RADIUS*Math.cos(angle),z:STRAIGHT/2+RADIUS*Math.sin(angle),theta:angle,curve:1/RADIUS};
  }
  if (s < 2*STRAIGHT+arc) return {x:RADIUS,z:STRAIGHT/2-(s-STRAIGHT-arc),theta:Math.PI,curve:0};
  const angle=(s-2*STRAIGHT-arc)/RADIUS;
  return {x:RADIUS*Math.cos(angle),z:-STRAIGHT/2-RADIUS*Math.sin(angle),theta:Math.PI+angle,curve:1/RADIUS};
}

function relief(s) {
  // The narrow real crest and broad rise/fall use RoadLab's Gaussian profile.
  const arc = Math.PI * RADIUS;
  const north = s - STRAIGHT;
  const bankWeight = smooth(north/60) * smooth((arc-north)/60);
  const crest = 5.8 * Math.exp(-(((s-CREST_S)/35)**2)) * smooth(s/35) * smooth((STRAIGHT-s)/35);
  const southbound = s - STRAIGHT - arc;
  const rise = 3.9 * Math.exp(-(((southbound-150)/62)**2)) *
    smooth(southbound/45)*smooth((STRAIGHT-southbound)/45);
  return {height:crest+rise+4.6*bankWeight,bank:-.235*bankWeight};
}

function rowAt(s) {
  const {x,z,theta,curve} = centerline(s);
  const {height,bank} = relief(s);
  const dx = Math.cos(theta), dz = -Math.sin(theta);
  const vertices = offsets.map(lateral => {
    const d = Math.abs(lateral);
    let y = height + bank*lateral;
    if (d > SHOULDER) {
      const side = Math.sign(lateral);
      const edge = height+bank*side*SHOULDER, slope=bank*side;
      // On the descending side shorten the tail enough to end at zero
      // without overshooting below the flat infield.
      const span=GRASS_EDGE-SHOULDER;
      const run=slope<0 ? Math.min(span,2.9*edge/-slope) : span;
      const t=clamp((d-SHOULDER)/run,0,1);
      // Hermite to the surrounding flat ground, matching the shoulder slope.
      y = (1-t)**2 * ((1+2*t)*edge+t*run*slope);
    }
    return {x:Math.fround(x+dx*lateral),y:Math.fround(y),z:Math.fround(z+dz*lateral),lateral};
  });
  return {s,x,z,theta,curve,bank,height,vertices};
}

export function createSurface() {
  const count = Math.ceil(LAP/STEP);
  const rows = Array.from({length:count}, (_,i) => rowAt(i*LAP/count));
  const triangles = [];
  const grid = new Map();

  function triangle(a,b,c,band,row,next) {
    const ux = b.x-a.x, uz = b.z-a.z, vx = c.x-a.x, vz = c.z-a.z;
    const det = ux*vz-uz*vx;
    const gx = ((b.y-a.y)*vz-(c.y-a.y)*uz)/det;
    const gz = (ux*(c.y-a.y)-vx*(b.y-a.y))/det;
    const normalScale = 1/Math.hypot(gx,1,gz);
    const finish = row && row.s>=FINISH_S && row.s<FINISH_S+3.2 && band>=6 && band<10;
    const color=finish ? ((band+Math.floor((row.s-FINISH_S)/1.6))%2 ? [.90,.87,.74] : [.19,.22,.20])
      : row ? palette[band] : grass;
    const t = {a,b,c,ux,uz,vx,vz,inv:1/det,gx,gz,nx:-gx*normalScale,ny:normalScale,nz:-gz*normalScale,
      band,row,next,color};
    triangles.push(t);
    if (!row) return t;
    for (let x=Math.floor(Math.min(a.x,b.x,c.x)/CELL);x<=Math.floor(Math.max(a.x,b.x,c.x)/CELL);x++) {
      for (let z=Math.floor(Math.min(a.z,b.z,c.z)/CELL);z<=Math.floor(Math.max(a.z,b.z,c.z)/CELL);z++) {
        const key = x*2048+z;
        if (!grid.has(key)) grid.set(key,[]);
        grid.get(key).push(t);
      }
    }
    return t;
  }

  // The exterior and the infield use the same flat rendered floor.
  // The ribbon terminates at y=0 and never dips below the floor.
  const a={x:-LIMIT,y:0,z:-LIMIT}, b={x:LIMIT,y:0,z:-LIMIT};
  const c={x:LIMIT,y:0,z:LIMIT}, d={x:-LIMIT,y:0,z:LIMIT};
  triangle(a,c,b,-1,null,null);
  triangle(a,d,c,-1,null,null);

  for (let i=0;i<rows.length;i++) {
    const row=rows[i], next=rows[(i+1)%rows.length];
    for (let band=0;band<offsets.length-1;band++) {
      const a=row.vertices[band], b=row.vertices[band+1];
      const c=next.vertices[band+1], d=next.vertices[band];
      triangle(a,c,b,band,row,next);
      triangle(a,d,c,band,row,next);
    }
  }

  function sample(x,z,out={}) {
    const bin = grid.get(Math.floor(x/CELL)*2048+Math.floor(z/CELL));
    if (bin) for (const t of bin) {
      const dx=x-t.a.x, dz=z-t.a.z;
      const u=(dx*t.vz-dz*t.vx)*t.inv;
      const v=(t.ux*dz-t.uz*dx)*t.inv;
      if (u < -1e-7 || v < -1e-7 || u+v > 1+1e-7) continue;
      const nextWeight = t.c === t.row.vertices[t.band+1] ? u : u+v;
      out.x=x; out.z=z; out.y=t.a.y+dx*t.gx+dz*t.gz;
      out.nx=t.nx; out.ny=t.ny; out.nz=t.nz;
      out.gx=t.gx; out.gz=t.gz;
      out.lateral=t.a.lateral*(1-u-v)+t.b.lateral*u+t.c.lateral*v;
      out.s=wrap(t.row.s+nextWeight*LAP/count);
      out.bank=t.row.bank+(t.next.bank-t.row.bank)*nextWeight;
      out.curve=t.row.curve;
      out.theta=t.row.theta;
      out.material=Math.abs(out.lateral)<=ROAD_HALF ? "road" :
        Math.abs(out.lateral)<=SHOULDER ? "shoulder" : "grass";
      return out;
    }
    if (Math.abs(x)>LIMIT || Math.abs(z)>LIMIT) return null;
    Object.assign(out,{x,z,y:0,nx:0,ny:1,nz:0,gx:0,gz:0,lateral:Infinity,s:null,bank:0,curve:0,theta:0,material:"grass"});
    return out;
  }

  function sampleRoad(s,lateral=0) {
    if (Math.abs(lateral)>GRASS_EDGE) throw new RangeError("Lateral sample outside the ribbon");
    const phase=wrap(s)*count/LAP;
    const i=Math.floor(phase), f=phase-i;
    const a=rows[i], b=rows[(i+1)%count];
    const nextBand=offsets.findIndex(n=>n>lateral);
    const band=nextBand<0 ? offsets.length-2 : nextBand-1;
    const t=(lateral-offsets[band])/(offsets[band+1]-offsets[band]);
    const p=a.vertices[band], q=a.vertices[band+1], r=b.vertices[band+1], u=b.vertices[band];
    const blend = key => t>=f ? p[key]*(1-t)+q[key]*(t-f)+r[key]*f
      : p[key]*(1-f)+u[key]*(f-t)+r[key]*t;
    const hit=sample(blend("x"),blend("z"));
    const {theta}=centerline(s);
    const fx=Math.sin(theta), fz=Math.cos(theta), rx=fz, rz=-fx;
    const unit=(x,y,z)=>{const m=Math.hypot(x,y,z);return [x/m,y/m,z/m];};
    return {...hit,
      normal:[hit.nx,hit.ny,hit.nz], tangent:unit(fx,hit.gx*fx+hit.gz*fz,fz),
      lateralDirection:unit(rx,hit.gx*rx+hit.gz*rz,rz)};
  }
  return {rows,triangles,sample,sampleRoad};
}
