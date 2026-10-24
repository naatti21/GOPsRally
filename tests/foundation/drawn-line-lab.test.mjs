import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSegments, drawDriver, PHYSICS_TEST_LINE, lineAtKnot }
  from '../../v04/src/testing/line-lab.js';
import { runLineTrial, runSlideTrial } from '../../scripts/physics-line-lab.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('drawn segments connect with continuous position, tangent and curvature (C2)',()=>{
  const p=compileSegments(PHYSICS_TEST_LINE);
  assert.equal(p.joins.length,3);
  assert.ok(p.length>250&&p.length<450);
  close(p.samples[0].x,0);close(p.samples[0].z,70);
  close(p.samples.at(-1).x,18);close(p.samples.at(-1).z,-221);
  for(const join of p.joins){
    const a=lineAtKnot(p,join,'left'),b=lineAtKnot(p,join,'right');
    for(const axis of ['x','z'])for(const key of ['value','slope','curvature'])
      close(a[axis][key],b[axis][key]);
  }
  assert.ok(p.samples.every(s=>Number.isFinite(s.curvature)&&
    Math.abs(Math.hypot(s.tx,s.tz)-1)<1e-8));
});
test('discontinuous segment endpoints and different target speeds are rejected',()=>{
  const gap=structuredClone(PHYSICS_TEST_LINE);
  gap[1].points[0].x+=0.5;
  assert.throws(()=>compileSegments(gap),/share identical endpoints/);
  const conflict=structuredClone(PHYSICS_TEST_LINE);
  conflict[1].points[0].speedKmh+=5;
  assert.throws(()=>compileSegments(conflict),/conflicting join speed/);
});
test('test driver emits the same left/right/brake digital inputs, never car positions',()=>{
  const path=compileSegments(PHYSICS_TEST_LINE),driver=drawDriver(path);
  const before={position:{x:-12,z:66},rotation:{x:0,y:0,z:0,w:1},speed:20};
  const cmd=driver.read(before);
  for(const key of ['left','right','brake'])assert.equal(typeof cmd[key],'boolean');
  assert.ok(cmd.lineError>3);
  assert.ok(!('position' in cmd)&&!('rotation' in cmd));
  driver.reset();close(driver.read(before).progress,cmd.progress);
});
test('real 1200 kg car follows a drawn line imperfectly and deterministically',()=>{
  const a=runLineTrial({speedFactor:0.75,durationSeconds:11});
  const b=runLineTrial({speedFactor:0.75,durationSeconds:11});
  assert.deepEqual(a,b);
  assert.ok(a.progressMeters>50);
  assert.ok(a.maxLineErrorMeters>0);
  assert.ok(Number.isFinite(a.maxBodySlipDegrees));
  assert.ok(a.countLeftFrames+a.countRightFrames>0);
});
test('drawn speed changes the physical braking commands',()=>{
  const low=runLineTrial({speedFactor:0.65,durationSeconds:12});
  const high=runLineTrial({speedFactor:1.35,durationSeconds:12});
  assert.ok(low.countBrakeFrames>high.countBrakeFrames,
    `brakes lower-speed=${low.countBrakeFrames} higher-speed=${high.countBrakeFrames}`);
  assert.ok(Number.isFinite(low.rmsLineErrorMeters)&&Number.isFinite(high.rmsLineErrorMeters));
});
test('countersteer timing changes measured chassis outcome; catchability is reported, not assumed',()=>{
  const early=runSlideTrial({countersteerDelaySeconds:0});
  const late=runSlideTrial({countersteerDelaySeconds:1.2});
  assert.deepEqual(early,runSlideTrial({countersteerDelaySeconds:0}));
  for(const s of [early,late]){
    assert.ok(Number.isFinite(s.finalSlipDegrees)&&Number.isFinite(s.finalYawRateDegreesPerSecond));
    assert.equal(typeof s.regainedControl,'boolean');
    assert.ok(s.minimumWheelContacts>=0&&s.minimumWheelContacts<=4);
  }
  assert.ok(Math.abs(early.netLateralMeters-late.netLateralMeters)>0.01);
  if(early.maxBodySlipDegrees<8)
    assert.equal(early.regainedControl,false,'never count routine steering as a recovered slide');
  const seeded=runSlideTrial({countersteerDelaySeconds:0.15,
    seedSlipDegrees:18,seedYawRate:-0.55});
  assert.ok(seeded.hadBreakaway,'the seeded fixture must actually reproduce a meaningful slide');
  assert.ok(seeded.maxBodySlipDegrees>=8);
  assert.equal(typeof seeded.regainedControl,'boolean');
});
