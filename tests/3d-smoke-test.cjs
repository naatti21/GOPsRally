const fs = require('fs'), vm = require('vm'), assert = require('assert');
let drawCalls=0, verts=0, uniforms=0, errors=[];
const modelMatrices=[];
const nop=()=>{};
const gl=new Proxy({
 VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,DYNAMIC_DRAW:7,TRIANGLES:8,FLOAT:9,DEPTH_TEST:10,COLOR_BUFFER_BIT:11,DEPTH_BUFFER_BIT:12,LEQUAL:13,CULL_FACE:14,
 createShader:()=>({}),shaderSource:nop,compileShader:nop,getShaderParameter:()=>true,getShaderInfoLog:()=>'',
 createProgram:()=>({}),attachShader:nop,linkProgram:nop,getProgramParameter:()=>true,getProgramInfoLog:()=>'',
 getAttribLocation:()=>0,getUniformLocation:(_,name)=>({name}),createVertexArray:()=>({}),createBuffer:()=>({}),
 bindVertexArray:nop,bindBuffer:nop,bufferData:(_,data)=>{assert(data.every(Number.isFinite),'non-finite vertex data');verts+=data.length/9;},
 enableVertexAttribArray:nop,vertexAttribPointer:nop,uniformMatrix4fv:(where,__,data)=>{assert(data.every(Number.isFinite),'non-finite camera / model matrix');uniforms++;if(where.name==='uModel')modelMatrices.push([...data]);},
 drawArrays:(_,__,count)=>{assert(count>0);drawCalls++;},viewport:nop,enable:nop,disable:nop,depthFunc:nop,clearColor:nop,clear:nop,useProgram:nop,
 deleteBuffer:nop,deleteVertexArray:nop
 },{get:(obj,k)=>k in obj?obj[k]:nop});
const scene3d={width:0,height:0,getContext:(type)=>{assert.strictEqual(type,'webgl2');return gl;}};
const classes=new Set(),document={getElementById:()=>scene3d,documentElement:{classList:{add:x=>classes.add(x)}}};
const window={innerWidth:393,innerHeight:852,devicePixelRatio:2};
const sandbox={window,document,console:{...console,error:e=>errors.push(e)},Math,Float32Array};
vm.runInNewContext(fs.readFileSync(__dirname+'/../renderer3d.js','utf8'),sandbox,{filename:'renderer3d.js',timeout:3000});
assert(classes.has('webgl-3d')&&window.GOPsRally3D?.ready,'3D renderer not initialized');
const ground=(x,z)=>Math.sin(x*.015)*5+Math.cos(z*.012)*3;
const track=Array.from({length:128},(_,i)=>{const t=i*2*Math.PI/128,x=160*Math.sin(t),z=140*Math.cos(t);return {x,z,y:ground(x,z)+.45,theta:t,curve:0.02,bank:0.08};});
const trees=Array.from({length:50},(_,i)=>({x:i*4-100,z:200+(i%6)*5,y:ground(i*4-100,200+(i%6)*5),h:9,r:5}));
const state={x:120,z:100,theta:.65,speed:24,camX:120,camZ:116,camYaw:0,camera:'fixed',roll:.16,pitch:-.08,heave:.1,steer:.4,skids:[]};
window.GOPsRally3D.render(state,track,trees,ground,13.5);
// Road ribbon and chassis cannot use different height functions.
for(const i of [0,12,32,65,92]){
 const p=track[i];
 const road=window.GOPsRally3D.roadAt(p.x,p.z,track);
 assert(Math.abs(road.y-p.y)<.03,'ribbon height deviates from road centre at node '+i);
 const g=window.GOPsRally3D.terrainSurface(p.x,p.z,track,ground,13.5);
 assert(g<road.y-2,'terrain must be recessed under the road');
 const wheelY=window.GOPsRally3D.roadSurface(p.x,p.z,track,ground,13.5);
 assert(Math.abs(wheelY-road.y)<.03,'wheel height does not use road height');
}
const wheels=modelMatrices.slice(-4);
assert.strictEqual(wheels.length,4,'must draw all 4 wheels');
for(const wm of wheels){
 const x=wm[12],z=wm[14],height=window.GOPsRally3D.roadSurface(x,z,track,ground,13.5);
 assert(Math.abs(wm[13]-(height+.52))<.02,'wheel must sit on road surface');
}
// The projection must agree with right-positive input in both camera types.
function clip(m,x,y,z){return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13]];}
let m=window.GOPsRally3D.debugProjection(0),o=clip(m,0,0,0);
assert(clip(m,1,0,0)[0]>o[0],'fixed view mirrors right steering');
assert(clip(m,0,0,1)[1]>o[1],'fixed view flips forward direction');
const turn=1.25;m=window.GOPsRally3D.debugProjection(turn);o=clip(m,0,0,0);
assert(clip(m,Math.cos(turn),0,-Math.sin(turn))[0]>o[0],'chase view mirrors steering');
assert(clip(m,Math.sin(turn),0,Math.cos(turn))[1]>o[1],'chase camera forward is inverted');
assert(drawCalls>=7,'world or vehicle not rendered');
assert(verts>30000,'terrain / road / vegetation / car mesh too small');
const before=drawCalls;state.camera='chase';state.camYaw=1.3;state.roll=-.25;
state.skids=[{x:120,z:100,side:1,t:1},{x:121,z:101,side:1,t:1.05}];
window.GOPsRally3D.render(state,track,trees,ground,13.5);
assert(drawCalls>before+7,'dynamic camera / vehicle not rendered');
assert.strictEqual(errors.length,0,errors.join(' '));
console.log('3D renderer validated:',{drawCalls,verticesUploaded:verts,matrixUniforms:uniforms});