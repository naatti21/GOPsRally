import { TYRE_RADIUS } from "./contact.mjs";

export function createRenderer(canvas,surface) {
const gl=canvas.getContext("webgl2",{antialias:false,alpha:false,powerPreference:"high-performance"});
if (!gl) return null;
const vs = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNormal; in vec3 aColor;
uniform mat4 uProj,uView,uModel;
out vec3 vColor; out float vFog;
void main(){
 vec4 eye=uView*uModel*vec4(aPos,1.);
 vec3 n=normalize(mat3(uModel)*aNormal);
 float sun=max(.0,dot(n,normalize(vec3(-.44,.88,.19))));
 vColor=aColor*(.60+.40*sun);
 vFog=clamp((-eye.z-125.)/490.,0.,.48);
 gl_Position=uProj*eye;
}`;
const fs = `#version 300 es
precision mediump float;
in vec3 vColor; in float vFog; out vec4 frag;
void main(){ frag=vec4(mix(vColor,vec3(.23,.31,.27),vFog),1.); }`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program;
try {program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
catch(e){console.error('WebGL2 initialization failed',e);return null;}
const loc={pos:gl.getAttribLocation(program,'aPos'),normal:gl.getAttribLocation(program,'aNormal'),color:gl.getAttribLocation(program,'aColor'),projection:gl.getUniformLocation(program,'uProj'),view:gl.getUniformLocation(program,'uView'),model:gl.getUniformLocation(program,'uModel')};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const d=Math.hypot(...a)||1;return a.map(x=>x/d);};
function identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function translate(x,y,z){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
function yaw(t){const m=identity(),c=Math.cos(t),s=Math.sin(t);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function roll(t){const m=identity(),c=Math.cos(t),s=Math.sin(t);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
function pitch(t){const m=identity(),c=Math.cos(t),s=Math.sin(t);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function ortho(left,right,bottom,top,near,far){const m=identity();m[0]=2/(right-left);m[5]=2/(top-bottom);m[10]=-2/(far-near);m[12]=-(right+left)/(right-left);m[13]=-(top+bottom)/(top-bottom);m[14]=-(far+near)/(far-near);return m;}
function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);const m=identity();m[0]=x[0];m[4]=x[1];m[8]=x[2];m[1]=y[0];m[5]=y[1];m[9]=y[2];m[2]=z[0];m[6]=z[1];m[10]=z[2];m[12]=-x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2];m[13]=-y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2];m[14]=-z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2];return m;}
function meshBuilder(){const data=[];
 function tri(a,b,c,color){const n=norm(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])data.push(...p,...n,...color);}
 function quad(a,b,c,d,color){tri(a,c,b,color);tri(a,d,c,color);}
 function box(cx,cy,cz,w,h,d,color){const x=cx-w/2,X=cx+w/2,y=cy-h/2,Y=cy+h/2,z=cz-d/2,Z=cz+d/2;
 const A=[x,y,z],B=[X,y,z],C=[X,Y,z],D=[x,Y,z],E=[x,y,Z],F=[X,y,Z],G=[X,Y,Z],H=[x,Y,Z];
 quad(A,B,C,D,color);quad(F,E,H,G,color);quad(E,A,D,H,color);quad(B,F,G,C,color);quad(D,C,G,H,color);quad(E,F,B,A,color);
 }
 return {data,tri,quad,box};}
function gpu(builder,dynamic=false){const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(builder.data),dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
 const stride=9*4;for(const [idx,offset] of [[loc.pos,0],[loc.normal,12],[loc.color,24]]){gl.enableVertexAttribArray(idx);gl.vertexAttribPointer(idx,3,gl.FLOAT,false,stride,offset);}gl.bindVertexArray(null);return {vao,buf,count:builder.data.length/9};}
const terrain=meshBuilder(), floor=meshBuilder();
for(const tri of surface.triangles){
 const {a,b,c,nx,ny,nz,color}=tri;
 const target=tri.row ? terrain : floor;
 for(const v of [a,b,c]) target.data.push(v.x,v.y,v.z,nx,ny,nz,...color);
}
const world=gpu(terrain), floorGpu=gpu(floor);
const colors={car:[.96,.29,.12],hood:[.98,.54,.12],roof:[.98,.91,.70],glass:[.10,.22,.28],stripe:[.94,.91,.71]};
const car=meshBuilder();
car.box(0,-.10,0,3.45,.73,5.80,colors.car);
car.box(0,.41,1.75,3.13,.23,1.54,colors.hood);
car.box(0,.82,-.30,2.65,.49,2.85,colors.roof);
car.box(0,.58,1.06,2.53,.26,.32,colors.glass);
car.box(0,.61,-1.51,2.53,.20,.25,colors.glass);
for(const side of [-1,1]){car.box(side*1.48,-.09,-1.9,.24,.21,.30,colors.stripe);car.box(side*1.43,-.03,2.7,.25,.16,.17,[.95,.88,.64]);}

const tyre=meshBuilder();
const rubber=[.065,.07,.07], rim=[.34,.36,.36];
for(let i=0;i<12;i++){
 const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
 const side=(x,t)=>[x,TYRE_RADIUS*Math.cos(t),TYRE_RADIUS*Math.sin(t)];
 const A=side(-.39,a), B=side(.39,a), C=side(.39,b), D=side(-.39,b);
 tyre.quad(A,B,C,D,rubber);
 tyre.tri([-.39,0,0],A,D,rim);
 tyre.tri([.39,0,0],C,B,rim);
}
const carGpu=gpu(car), tyreGpu=gpu(tyre);
const shadow=meshBuilder();
shadow.quad([-2,0,-3.3],[2,0,-3.3],[2,0,3.3],[-2,0,3.3],[.11,.13,.10]);
const shadowGpu=gpu(shadow);
const I=identity();
const shadowHit={};
const stats={terrainTriangles:surface.triangles.length,drawCalls:8,
 vertices:world.count+floorGpu.count+carGpu.count+4*tyreGpu.count+shadowGpu.count};

function draw(mesh,matrix){
 gl.uniformMatrix4fv(loc.model,false,matrix);
 gl.bindVertexArray(mesh.vao);
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

function render(state,body,camera) {
 const w=window.innerWidth,h=window.innerHeight,ratio=Math.min(window.devicePixelRatio||1,1.30);
 const dw=Math.max(2,Math.round(w*ratio)),dh=Math.max(2,Math.round(h*ratio));
 if(canvas.width!==dw||canvas.height!==dh){
  canvas.width=dw;canvas.height=dh;gl.viewport(0,0,dw,dh);
 }
 gl.clearColor(.17,.28,.21,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const aspect=w/h;
 const span=(aspect>1?124:172)-clamp(state.speed/55,0,1)*20;
 const proj=ortho(-span*aspect/2,span*aspect/2,-span/2,span/2,5,850);
 proj[0]*=-1;
 const target=[camera.x,camera.y,camera.z];
 const view=lookAt([camera.x,camera.y+187,camera.z-99],target);
 gl.uniformMatrix4fv(loc.projection,false,proj);
 gl.uniformMatrix4fv(loc.view,false,view);
 // The flat floor overlaps the ribbon footprint at y=0. Draw it first
 // without writing depth so precision cannot hide the coplanar ribbon.
 gl.depthMask(false);
 draw(floorGpu,I);
 gl.depthMask(true);
 draw(world,I);
 const hgt=surface.sample(state.x,state.z,shadowHit);
 if(hgt) {
  const sloped=rotationToSurface(hgt.nx,hgt.ny,hgt.nz,state.theta);
  sloped[12]=state.x;sloped[13]=hgt.y+.055;sloped[14]=state.z;
  draw(shadowGpu,sloped);
 }
 const pose=multiply(multiply(translate(state.x,body.y,state.z),yaw(state.theta)),
   multiply(roll(body.roll),pitch(body.pitch)));
 draw(carGpu,pose);
 for(const wheel of body.wheels) draw(tyreGpu,multiply(translate(wheel.x,wheel.y,wheel.z),yaw(state.theta)));
}

function rotationToSurface(nx,ny,nz,theta) {
 const up=[nx,ny,nz], flat=[Math.sin(theta),0,Math.cos(theta)];
 const right=norm(cross(up,flat));
 const forward=cross(right,up);
 return new Float32Array([...right,0,...up,0,...forward,0,0,0,0,1]);
}

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.useProgram(program);
return {render,stats};
}
