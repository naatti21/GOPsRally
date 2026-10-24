const fs = require('fs'), vm = require('vm'), assert = require('assert');
let drawCalls=0, verts=0, uniforms=0, errors=[];
const nop=()=>{};
const gl=new Proxy({
 VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,DYNAMIC_DRAW:7,TRIANGLES:8,FLOAT:9,DEPTH_TEST:10,COLOR_BUFFER_BIT:11,DEPTH_BUFFER_BIT:12,LEQUAL:13,CULL_FACE:14,
 createShader:()=>({}),shaderSource:nop,compileShader:nop,getShaderParameter:()=>true,getShaderInfoLog:()=>'',
 createProgram:()=>({}),attachShader:nop,linkProgram:nop,getProgramParameter:()=>true,getProgramInfoLog:()=>'',
 getAttribLocation:()=>0,getUniformLocation:()=>({}),createVertexArray:()=>({}),createBuffer:()=>({}),
 bindVertexArray:nop,bindBuffer:nop,bufferData:(_,data)=>{assert(data.every(Number.isFinite),'non-finite vertex data');verts+=data.length/9;},
 enableVertexAttribArray:nop,vertexAttribPointer:nop,uniformMatrix4fv:(_,__,data)=>{assert(data.every(Number.isFinite),'non-finite camera / model matrix');uniforms++;},
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
assert(drawCalls>=7,'world or vehicle not rendered');
assert(verts>30000,'terrain / road / vegetation / car mesh too small');
const before=drawCalls;state.camera='chase';state.camYaw=1.3;state.roll=-.25;
state.skids=[{x:120,z:100,side:1,t:1},{x:121,z:101,side:1,t:1.05}];
window.GOPsRally3D.render(state,track,trees,ground,13.5);
assert(drawCalls>before+7,'dynamic camera / vehicle not rendered');
assert.strictEqual(errors.length,0,errors.join(' '));
console.log('3D renderer validated:',{drawCalls,verticesUploaded:verts,matrixUniforms:uniforms});