const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{};let raf=null,now=0;const exceptions=[];
const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
function makeElement(id){return {id,style:{},textContent:'',innerHTML:'',dataset:{},events:{},classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)},contains(x){return this.values.has(x)},toggle(x,on){if(on)this.add(x);else this.remove(x)}},addEventListener(name,cb){this.events[name]=cb},setPointerCapture:noop,getContext:()=>ctx};}
const elems=new Map();const el=k=>elems.get(k)||elems.set(k,makeElement(k)).get(k);
const buttons=['fixed','hybrid','chase'].map(mode=>{const e=makeElement('cam-'+mode);e.dataset.camera=mode;return e;});
const document={querySelector:s=>el(s),getElementById:el,querySelectorAll:s=>s==='[data-camera]'?buttons:[],addEventListener:noop,hidden:false};
const window={innerWidth:400,innerHeight:780,devicePixelRatio:1,addEventListener:noop};
const sandbox={window,document,navigator:{},location:{protocol:'file:'},performance:{now:()=>now},requestAnimationFrame:f=>raf=f,console:{...console,error:e=>exceptions.push(e)},localStorage:{getItem:()=>null,setItem:noop},Math,Number,Array,String,Map,Set};
vm.runInNewContext(fs.readFileSync(__dirname+'/game.js','utf8'),sandbox,{filename:'game.js',timeout:20000});
assert(raf,'render loop missing');
for(let i=0;i<3;i++){now+=17;const fn=raf;raf=null;fn(now);assert(raf,'render loop terminated');}
assert.strictEqual(window.__gopsRallyDebug.getSnapshot().running,false);
el('start').events.click();assert.strictEqual(window.__gopsRallyDebug.getSnapshot().running,true);
const initial=window.__gopsRallyDebug.getSnapshot();
for(let i=0;i<12;i++){now+=17;const fn=raf;raf=null;fn(now);}
assert(window.__gopsRallyDebug.getSnapshot().speed>initial.speed,'car does not accelerate');
buttons[0].events.click();assert.strictEqual(window.__gopsRallyDebug.getSnapshot().camera,'fixed');
buttons[2].events.click();assert.strictEqual(window.__gopsRallyDebug.getSnapshot().camera,'chase');
el('right').events.pointerdown({preventDefault:noop,pointerId:1});
for(let i=0;i<6;i++){now+=17;const fn=raf;raf=null;fn(now);}
el('right').events.pointerup({preventDefault:noop});
el('pause').events.click();assert(window.__gopsRallyDebug.getSnapshot().paused);
assert.strictEqual(exceptions.length,0,exceptions.map(String).join('\n'));
console.log('Validated: boot, rendering, start, acceleration, steering, cameras, pause', window.__gopsRallyDebug.getSnapshot());
