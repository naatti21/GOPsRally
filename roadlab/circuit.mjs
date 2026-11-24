// Closed uniform cubic B-spline, sampled once into a distance lookup table.
// x and z are world metres; the straight on the west side carries the crest.
const knots = [
  [-260,-225],[-260,-105],[-260,30],[-260,175],[-226,263],
  [-128,293],[-12,248],[110,302],[235,238],[275,130],
  [237,46],[144,20],[114,-80],[214,-154],[246,-249],
  [152,-320],[57,-292],[-20,-222],[-120,-288],[-224,-305]
];
const resolution = 48;
const full = knots.length * resolution;

function spline(index) {
  const i = Math.floor(index / resolution), t = index / resolution - i;
  const weights = [(1-t)**3, 3*t**3-6*t*t+4, -3*t**3+3*t*t+3*t+1, t**3];
  const derivative = [-3*(1-t)**2,9*t*t-12*t,-9*t*t+6*t+3,3*t*t];
  const second = [6*(1-t),18*t-12,6-18*t,6*t];
  let x=0,z=0,dx=0,dz=0,ddx=0,ddz=0;
  for (let j=0;j<4;j++) {
    const [px,pz]=knots[(i+j-1+knots.length)%knots.length];
    x+=px*weights[j]/6; z+=pz*weights[j]/6;
    dx+=px*derivative[j]/6; dz+=pz*derivative[j]/6;
    ddx+=px*second[j]/6; ddz+=pz*second[j]/6;
  }
  return {x,z,theta:Math.atan2(dx,dz),curve:(dz*ddx-dx*ddz)/Math.hypot(dx,dz)**3};
}

const distances = [0];
let previous=spline(0);
for(let i=1;i<=full;i++){
  const next=spline(i);
  distances.push(distances[i-1]+Math.hypot(next.x-previous.x,next.z-previous.z));
  previous=next;
}
const lap=distances[full];
const crest=distances[resolution*2]-35;
const bankCenter=distances[resolution*5]-29;
const hillCenter=distances[resolution*14];
const gaussian=(s,center,width)=>Math.exp(-(((s-center)/width)**2));
// A compact, smooth bump, with zero value and derivative at the edges.
const window=(s,center,radius)=>Math.max(0,1-((s-center)/radius)**2)**2;

function centerline(s) {
  let lo=0,hi=full;
  while(hi-lo>1){
    const middle=(lo+hi)>>1;
    if(distances[middle]<=s)lo=middle;
    else hi=middle;
  }
  return spline(lo+(s-distances[lo])/(distances[hi]-distances[lo]));
}

export const circuit = {
  lap, finish:18, crest, bankCenter, step:1.45,
  offsets:[-42,-31,-22,-16,-12,-9.5,-3.6,0,3.6,9.5,12,16,22,31,42],
  centerline,
  relief(s) {
    const bankWeight=window(s,bankCenter,120);
    const crestHeight=5.8*gaussian(s,crest,35)*window(s,crest,120);
    const hill=8*gaussian(s,hillCenter,93)*window(s,hillCenter,230);
    return {height:crestHeight+hill+2.5*bankWeight,bank:-.17*bankWeight};
  }
};
