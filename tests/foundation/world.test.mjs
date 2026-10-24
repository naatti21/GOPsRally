import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSurface,sampleSurface} from '../../v04/src/world/surface.js';
import {createPhysics} from '../../v04/src/physics/world.js';
import {kmhToMps,forward,steering,makeClock,driveIntent} from '../../v04/src/game/contracts.js';
const mesh=buildSurface();
test('single continuous mesh has finite vertices, all materials and upward triangles',()=>{
 assert.equal(mesh.positions.length/3,48841);assert.equal(mesh.indices.length/3,96800);
 assert.ok(mesh.positions.every(Number.isFinite));assert.equal(new Set(mesh.types).size,4);
 const edges=new Map();for(let i=0;i<mesh.indices.length;i+=3){const ids=Array.from(mesh.indices.slice(i,i+3));const p=ids.map(id=>mesh.positions.slice(id*3,id*3+3));assert.ok((p[1][2]-p[0][2])*(p[2][0]-p[0][0])-(p[1][0]-p[0][0])*(p[2][2]-p[0][2])>0);for(let j=0;j<3;j++){const edge=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b).join(':');edges.set(edge,(edges.get(edge)||0)+1)}}
 assert.ok([...edges.values()].every(n=>n===1||n===2));assert.equal([...edges.values()].filter(n=>n===1).length,mesh.cells*4);
 assert.ok(Math.max(...mesh.track.nodes.map(n=>n.y))-Math.min(...mesh.track.nodes.map(n=>n.y))>12);
 assert.ok(mesh.track.nodes.some(n=>Math.abs(n.bank)>.05));
});
test('Rapier collision agrees with emitted triangles across terrain and road',async()=>{
 const physics=await createPhysics(mesh);try{for(let i=0;i<mesh.track.nodes.length;i+=13){const n=mesh.track.nodes[i];for(const offset of [0,6,14]){const x=n.x+.137+offset,z=n.z+.219;const sample=sampleSurface(mesh,x,z),hit=physics.rayAt(x,z);assert.ok(hit);assert.ok(Math.abs(sample.height-hit.height)<.001);const dot=sample.normal[0]*hit.normal.x+sample.normal[1]*hit.normal.y+sample.normal[2]*hit.normal.z;assert.ok(dot>.999,`normal ${dot}`)}}}finally{physics.dispose()}
});
test('dynamic probe falls under gravity and terrain stops its descent',async()=>{
 const physics=await createPhysics(mesh);try{const x=-75.137,z=-95.219,h=sampleSurface(mesh,x,z).height;const body=physics.drop(x,h+9,z);physics.addProbe(body);for(let i=0;i<30;i++)physics.world.step();assert.ok(body.linvel().y < -4.5);assert.ok(body.translation().y<h+8);for(let i=0;i<180;i++)physics.world.step();const p=body.translation(),ground=sampleSurface(mesh,p.x,p.z);assert.ok(p.y>ground.height+.3);assert.ok(p.y<ground.height+1)}finally{physics.dispose()}
});
test('units, immediate steering and deliberate reverse contracts',()=>{assert.equal(kmhToMps(180),50);assert.equal(steering({right:true}),1);assert.equal(steering({left:true}),-1);assert.ok(forward(Math.PI/2).x>.99);assert.equal(driveIntent({brake:true},20,2).throttle,0);assert.equal(driveIntent({brake:true},0,.8).throttle,-1)});
test('fixed step is render-rate independent and caps suspended frames',()=>{function ticks(dt,n){const c=makeClock();let count=0;for(let i=0;i<n;i++)c.advance(dt,()=>count++);return count}assert.equal(ticks(1/60,60),ticks(1/120,120));const c=makeClock();assert.ok(c.advance(10,()=>{}).ticks<=6);c.reset();assert.equal(c.advance(0,()=>{}).ticks,0)});
test('invalid dimensions and corridors outside terrain fail explicitly',()=>{assert.throws(()=>buildSurface({step:0}),/resolution/);assert.throws(()=>buildSurface({size:100}),/outside terrain/)});
test('self-crossing road is rejected rather than assigned an ambiguous height',async()=>{const {validateTrack}=await import('../../v04/src/world/track.js');const nodes=[[-20,-20],[20,20],[-20,20],[20,-20]].map(([x,z],i)=>({x,z,y:0,bank:0,s:i*60}));assert.throws(()=>validateTrack({nodes,length:240,roadHalf:4.5,shoulder:4.5}),/Crossing/)});
