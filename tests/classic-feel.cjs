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
assert(Math.abs(drifting.slipDegrees)>3.5,'steering must produce visible physical sideslip');
assert(Math.abs(drifting.lateralSpeed)>1,'lateral velocity must survive steering');
assert(Number.isFinite(drifting.speed)&&drifting.speed<65,'speed must remain finite and bounded');
steps(51);
const recovering=snapshot();
assert(Math.abs(recovering.slipDegrees)<Math.abs(drifting.slipDegrees)*.8,'neutral steer should recover the slide');
const beforeLeft=recovering.heading;
steer('left',true);steps(12);steer('left',false);
assert(Math.abs(snapshot().heading-beforeLeft)>.025,'countersteer must change heading');
assert.equal(snapshot().camera,'fixed','no implicit mode switching while steering');
assert.equal(faults.length,0,faults.join('\n'));
console.log('Classic arcade regression passed',JSON.stringify({entrySlipDeg:drifting.slipDegrees,afterReleaseDeg:recovering.slipDegrees,speedKmh:Math.round(drifting.speed*3.6)}));