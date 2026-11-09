// Deterministic input-level regression for the lightweight Classic rally sandbox.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const noop=()=>{};
let frame=null,now=0;
const faults=[];
const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
function element(id){
  return {id,style:{},textContent:'',innerHTML:'',dataset:{},events:{},
    classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)},contains(x){return this.values.has(x)},toggle(x,on){if(on)this.add(x);else this.remove(x)}},
    addEventListener(name,cb){this.events[name]=cb},setPointerCapture:noop,getContext:()=>ctx};
}
const elements=new Map(),el=id=>elements.get(id)||elements.set(id,element(id)).get(id);
const cameras=['fixed','chase'].map(name=>Object.assign(element(name),{dataset:{camera:name}}));
const document={querySelector:el,getElementById:el,querySelectorAll:s=>s==='[data-camera]'?cameras:[],addEventListener:noop,hidden:false};
const window={innerWidth:852,innerHeight:393,devicePixelRatio:1,addEventListener:noop};
const sandbox={window,document,navigator:{},location:{protocol:'file:'},performance:{now:()=>now},
  requestAnimationFrame:fn=>frame=fn,localStorage:{getItem:()=>null,setItem:noop},
  console:{...console,error:e=>faults.push(String(e))},Math,Array,Number,String,Map,Set};
vm.runInNewContext(fs.readFileSync(__dirname+'/../game.js','utf8'),sandbox,{filename:'game.js',timeout:30000});
const snapshot=()=>window.__gopsRallyDebug.getSnapshot();
function steps(count){for(let i=0;i<count;i++){const fn=frame;assert.equal(typeof fn,'function');now+=17;frame=null;fn(now);}}
function steer(name,down){el(name).events[down?'pointerdown':'pointerup']({preventDefault:noop,pointerId:1});}
assert.equal(snapshot().camera,'fixed','Classic must default to world-locked camera');
el('start').events.click();
steps(126);assert.equal(snapshot().countdown,0);
steps(48);assert(snapshot().speed>7,'automatic throttle must move the car');
const starting=snapshot();
steer('right',true);steps(29);steer('right',false);
const drifting=snapshot();
assert(Math.abs(drifting.heading-starting.heading)>.08,'turn-in must respond promptly');
assert(Math.abs(drifting.slipDegrees)>8,'need meaningful entry slip, not tiny numbers passing as drift');
assert(Math.abs(drifting.lateralSpeed)>1.5,'lateral velocity must survive steering');
assert(Math.abs(drifting.yawRate)>.5,'must build measurable rotational inertia');
assert(drifting.skids>=2,'tyre trace must appear from actual lateral movement');
assert(Number.isFinite(drifting.speed)&&drifting.speed<65,'speed must remain finite and bounded');
const releaseYaw=drifting.yawRate,releaseHeading=drifting.heading;
steps(8);
const coasting=snapshot();
assert(Math.sign(coasting.yawRate)===Math.sign(releaseYaw),'body rotation must continue briefly after steering release');
assert(Math.abs(coasting.yawRate)>.12,'release must not zero yaw immediately');
assert(Math.abs(coasting.heading-releaseHeading)>.035,'coasting chassis must continue rotating visibly');
steps(43);
const recovering=snapshot();
assert(Math.abs(recovering.slipDegrees)<Math.abs(drifting.slipDegrees)*.75,'neutral steer should recover the slide');
assert(Math.abs(recovering.yawRate)<Math.abs(releaseYaw)*.35,'yaw must settle without steering');
el('recover').events.click();
steps(70);
steer('right',true);steps(28);
const beforeCounter=snapshot();
assert(beforeCounter.yawRate>.4,'need real entry yaw before countersteer');
steer('right',false);steer('left',true);steps(16);steer('left',false);
const countered=snapshot();
assert(countered.yawRate<-.12,'countersteer must physically reverse yaw momentum');
assert.equal(snapshot().camera,'fixed','no implicit mode switching while steering');
assert.equal(faults.length,0,faults.join('\n'));
console.log('Classic V2 measured trial',JSON.stringify({entrySlipDeg:drifting.slipDegrees,afterReleaseDeg:recovering.slipDegrees,initialYawRate:releaseYaw,coastYawRate:coasting.yawRate,counterYawRate:countered.yawRate,speedKmh:Math.round(drifting.speed*3.6),tracks:drifting.skids}));