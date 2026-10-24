/* GOPs Rally — native WebGL2 3D scene, no CDN or runtime dependencies.
 * Terrain, banked road, vegetation, chassis and four independent wheels use real 3D geometry.
 * Arcade dynamics remain the responsibility of game.js; suspension is a visual response model.
 */
(() => {
'use strict';
const canvas = document.getElementById('scene3d');
const gl = canvas?.getContext('webgl2', {antialias:true,alpha:false,powerPreference:'high-performance'});
if (!gl) { document.documentElement.classList.add('fallback-2d'); return; }
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
catch(e){console.error('WebGL2 initialization failed',e);document.documentElement.classList.add('fallback-2d');return;}
const loc={pos:gl.getAttribLocation(program,'aPos'),normal:gl.getAttribLocation(program,'aNormal'),color:gl.getAttribLocation(program,'aColor'),projection:gl.getUniformLocation(program,'uProj'),view:gl.getUniformLocation(program,'uView'),model:gl.getUniformLocation(program,'uModel')};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const V=(x,y,z)=>[x,y,z];
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
const C={terrain:[.20,.38,.265],terrain2:[.245,.425,.286],road:[.64,.565,.425],road2:[.70,.625,.473],edge:[.40,.345,.263],rut:[.49,.415,.318],stripe:[.97,.94,.78],finish:[.17,.235,.195],car:[.94,.39,.115],hood:[.98,.55,.20],roof:[.97,.89,.70],glass:[.14,.26,.31],rubber:[.055,.07,.065],steel:[.39,.42,.40],trunk:[.25,.18,.12]};
let initialized=false,world=[],body,wheels,groundFn,trackData,carTop=1.6;
function buildWorld(track,trees,ground,roadHalf){
 groundFn=ground;trackData=track;
 const t=meshBuilder();const step=11,minX=-420,maxX=420,minZ=-395,maxZ=355;
 for(let x=minX;x<maxX;x+=step)for(let z=minZ;z<maxZ;z+=step){
 const a=[x,ground(x,z)-.3,z],b=[x+step,ground(x+step,z)-.3,z],c=[x+step,ground(x+step,z+step)-.3,z+step],d=[x,ground(x,z+step)-.3,z+step];
 const color=((Math.floor(x/step)+Math.floor(z/step))&1)?C.terrain:C.terrain2;t.quad(a,b,c,d,color);
 }world.push(gpu(t));
 const strip=meshBuilder();const len=track.length;
 function corner(node,s,raise){return [node.x+Math.cos(node.theta)*s,node.y+node.bank*s+raise,node.z-Math.sin(node.theta)*s];}
 // Geometrically continuous strips share exactly the same endpoints; depth test handles bends.
 for(let i=0;i<len;i++){
 const a=track[i],b=track[(i+1)%len];
 const bend=Math.abs(a.curve||0);const shrink=1-.12*clamp(bend/.5,0,1);
 const wb=roadHalf*shrink;const wa=roadHalf*(1-.12*clamp(Math.abs(b.curve||0)/.5,0,1));
 const bands=[[-wb-2.4,-wb,C.edge],[-wb,-3.6,C.road],[-3.6,-2.3,C.rut],[-2.3,2.3,i%12<6?C.road:C.road2],[2.3,3.6,C.rut],[3.6,wb,C.road],[wb,wb+2.4,C.edge]];
 for(let j=0;j<bands.length;j++){
 const [l,r,color]=bands[j];const la=l<=-wb?l+(wb-wa):l>=wb?l+(wa-wb):l;
 const ra=r<=-wb?r+(wb-wa):r>=wb?r+(wa-wb):r;
 strip.quad(corner(a,l,.055),corner(a,r,.055),corner(b,ra,.055),corner(b,la,.055),color);
 }
 }
 world.push(gpu(strip));
 const treeMesh=meshBuilder();let n=0;
 // 3D low-poly pines, batched for mobile: <= 600 trees in two draw calls.
 for(const tr of trees){if(++n%2===0)continue;const trunkY=tr.y+Math.max(1.4,tr.h*.26),height=tr.h*.92,r=tr.r*.72;
 treeMesh.box(tr.x,tr.y+height*.14,tr.z,.9,height*.28,.9,C.trunk);
 const base=tr.y+height*.22,top=tr.y+height*1.13;
 for(let k=0;k<6;k++){
 const a=k*Math.PI/3,b=(k+1)*Math.PI/3;
 const p=[tr.x+Math.cos(a)*r,base,tr.z+Math.sin(a)*r],q=[tr.x+Math.cos(b)*r,base,tr.z+Math.sin(b)*r],tip=[tr.x,top,tr.z];
 treeMesh.tri(p,q,tip,k%2?[.13,.27,.20]:[.18,.34,.23]);
 }
 }
 world.push(gpu(treeMesh));
 const flag=meshBuilder();const at=track[627 % track.length],theta=at.theta,fx=Math.sin(theta),fz=Math.cos(theta),rx=Math.cos(theta),rz=-Math.sin(theta);const w=roadHalf*2;
 for(let k=0;k<10;k++)for(let q=0;q<2;q++){
 const x1=-roadHalf+k*w/10,x2=-roadHalf+(k+1)*w/10,z1=q*1.6,z2=(q+1)*1.6;
 const p=(x,z)=>[at.x+rx*x+fx*z,at.y+at.bank*x+.13,at.z+rz*x+fz*z];
 flag.quad(p(x1,z1),p(x2,z1),p(x2,z2),p(x1,z2),(k+q)%2?C.stripe:C.finish);
 }world.push(gpu(flag));
 // Real volumetric car: chassis, roof, glazing, wing and distinct 3D tyres.
 const car=meshBuilder();
 car.box(0,.78,0,3.75,.98,6.35,C.car);
 car.box(0,1.38,1.72,3.3,.32,2.15,C.hood);
 car.box(0,1.45,-1.6,3.35,.42,1.85,C.car);
 car.box(0,1.91,-.24,2.76,.32,2.75,C.roof);
 car.box(0,1.67,.95,2.65,.63,.26,C.glass);
 car.box(0,1.67,-1.39,2.55,.63,.23,C.glass);
 for(const side of [-1,1]){
 car.box(side*1.38,1.62,-.30,.17,.5,1.85,C.glass);
 car.box(side*1.3,.71,2.95,.62,.12,.17,C.stripe);
 car.box(side*1.3,.73,-3,.68,.17,.16,[.68,.12,.09]);
 }
 car.box(0,1.16,-3.27,4.15,.16,.31,C.rubber);
 car.box(0,.84,3.23,2.3,.14,.15,C.steel);
 body=gpu(car);
 const wheel=meshBuilder();wheel.box(0,0,0,.95,1.1,1.45,C.rubber);wheel.box(-.50,0,0,.10,.67,.77,C.steel);wheels=gpu(wheel);
 initialized=true;
}
const draw=(m,model)=>{gl.uniformMatrix4fv(loc.model,false,model);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);};
let frame=0;
function render(state,track,trees,ground,roadHalf){
 if(!initialized)buildWorld(track,trees,ground,roadHalf);
 const W=window.innerWidth,H=window.innerHeight;
 const dpr=Math.min(window.devicePixelRatio||1,1.5);
 const dw=Math.max(2,Math.round(W*dpr)),dh=Math.max(2,Math.round(H*dpr));
 if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh;}
 gl.viewport(0,0,dw,dh);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE); // Keep both faces visible on steep, banked track sections.
 gl.clearColor(.17,.28,.21,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const speed=clamp(state.speed/55,0,1),span=178+speed*55,aspect=W/H;
 const projection=ortho(-span*aspect*.5,span*aspect*.5,-span*.5,span*.5,5,850);
 const baseY=ground(state.camX,state.camZ),target=[state.camX,baseY,state.camZ];
 const dir=state.camera==='chase'?state.camYaw:0,ss=Math.sin(dir),cc=Math.cos(dir);
 // Elevated orbit with fixed heading or chase heading, respecting relief without camera roll.
 const eye=[target[0]-ss*128,target[1]+163,target[2]-cc*128];
 const view=lookAt(eye,target);
 gl.useProgram(program);gl.uniformMatrix4fv(loc.projection,false,projection);gl.uniformMatrix4fv(loc.view,false,view);
 const I=identity();for(const m of world)draw(m,I);
 // Four wheels track the terrain independently, body floats over axle averages.
 const th=state.theta,si=Math.sin(th),co=Math.cos(th),fx=si,fz=co,rx=co,rz=-si;
 let heights=[];for(const f of [-2.12,2.12])for(const s of [-1,1]){let x=state.x+f*fx+s*1.63*rx,z=state.z+f*fz+s*1.63*rz;heights.push(ground(x,z));}
 const avg=heights.reduce((a,b)=>a+b,0)/4;
 // exaggerated but bounded visual weight transfer; the simulation remains arcade physics.
 const reliefRoll=Math.atan2((heights[0]+heights[2]-heights[1]-heights[3])*.5,3.25);
 const reliefPitch=Math.atan2((heights[2]+heights[3]-heights[0]-heights[1])*.5,4.25);
 const rollAngle=clamp((state.roll||0)*1.75+reliefRoll*.45,-.32,.32);
 const pitchAngle=clamp((state.pitch||0)*1.7+reliefPitch*.44,-.28,.28);
 const jounce=state.heave||0;
 const base=multiply(translate(state.x,avg+.66+jounce,state.z),yaw(th));
 const swung=multiply(base,multiply(roll(rollAngle),pitch(pitchAngle)));
 draw(body,swung);
 let idx=0;for(const f of [-2.12,2.12])for(const side of [-1,1]){
 const h=heights[idx++];
 const mount=multiply(translate(state.x+f*fx+side*1.72*rx,h+.52,state.z+f*fz+side*1.72*rz),yaw(th+(f>0?state.steer*.16:0)));
 draw(wheels,mount);
 }
 // Simple spatial skid traces from real slip positions, lifted above the gravel surface.
 if(state.skids?.length){const builder=meshBuilder();let prev=null;
 for(const s of state.skids){if(prev&&prev.side===s.side&&s.t-prev.t<.14&&Math.hypot(s.x-prev.x,s.z-prev.z)<6){
 const a=[prev.x,ground(prev.x,prev.z)+.21,prev.z],b=[s.x,ground(s.x,s.z)+.21,s.z],dx=b[0]-a[0],dz=b[2]-a[2],mag=Math.hypot(dx,dz)||1,wx=dz/mag*.24,wz=-dx/mag*.24;
 builder.quad([a[0]-wx,a[1],a[2]-wz],[a[0]+wx,a[1],a[2]+wz],[b[0]+wx,b[1],b[2]+wz],[b[0]-wx,b[1],b[2]-wz],[.19,.17,.13]);
 }prev=s;}
 if(builder.data.length){const m=gpu(builder,true);draw(m,I);gl.deleteBuffer(m.buf);gl.deleteVertexArray(m.vao);}
 }
 gl.bindVertexArray(null);frame++;
}
window.GOPsRally3D={render,ready:true};
document.documentElement.classList.add('webgl-3d');
})();