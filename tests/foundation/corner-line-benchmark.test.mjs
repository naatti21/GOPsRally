import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSegments } from '../../v04/src/testing/line-lab.js';
import { CORNER,LINE_IDS,cornerCenterSamples,makeCornerLine,nearestRoad }
  from '../../v04/src/testing/racing-line.js';
import { runCornerTrial,runCornerComparison }
  from '../../scripts/corner-line-benchmark.mjs';

test('all racing-line alternatives are smooth, bounded by identical road, and share start and finish',()=>{
  const geometry=cornerCenterSamples();
  const courses=LINE_IDS.map(makeCornerLine);
  for(const course of courses) {
    const p=course.path.samples;
    assert.ok(course.maxPlannedOffsetMeters<CORNER.roadHalf-0.5);
    assert.ok(p.every(x=>Number.isFinite(x.curvature)&&
      nearestRoad(geometry,x.x,x.z).distance<CORNER.roadHalf-0.5));
    assert.ok(Math.hypot(p[0].x,p[0].z-CORNER.entry)<1e-6);
    assert.ok(Math.hypot(p.at(-1).x-(CORNER.radius+CORNER.exit),
      p.at(-1).z+CORNER.radius)<1e-6);
    assert.ok(course.path.joins.length>=3);
    assert.equal(course.path.anchors[0].speedKmh,83);
  }
  assert.ok(new Set(courses.map(c=>c.path.length.toFixed(2))).size>=3,
    'different lines must have different geometry, not just names');
});
test('late apex and early apex genuinely choose different sides along the same turn',()=>{
  const early=makeCornerLine('early-apex'),late=makeCornerLine('late-apex');
  const maxAt=(course,lo,hi)=>{
    const points=course.path.samples.filter(p=>{
      const t=nearestRoad(course.center,p.x,p.z).s;
      return t>=lo && t<=hi;
    });
    return points.reduce((sum,p)=>sum+
      nearestRoad(course.center,p.x,p.z).side/points.length,0);
  };
  const beforeApex=late.arcStart+(late.arcEnd-late.arcStart)*0.34;
  const afterApex=late.arcStart+(late.arcEnd-late.arcStart)*0.75;
  assert.ok(maxAt(early,beforeApex-8,beforeApex+8)>
    maxAt(late,beforeApex-8,beforeApex+8));
  assert.ok(maxAt(late,afterApex-8,afterApex+8)>
    maxAt(early,afterApex-8,afterApex+8));
});
test('physical virtual-driver comparison is deterministic, does not require braking during bend',()=>{
  const a=runCornerTrial({lineId:'late-apex',maxSeconds:12});
  const b=runCornerTrial({lineId:'late-apex',maxSeconds:12});
  assert.deepEqual(a,b);
  assert.equal(a.brakeInCornerFrames,0);
  assert.ok(a.enteredCorner);
  assert.ok(a.steeringInCornerFrames>0);
  assert.ok(a.maxBodySlipDegrees>=0);
  assert.ok(a.rmsLineErrorMeters>0);
});
test('all four prescribed lines actually produce measured and comparable outcomes',()=>{
  const comparison=runCornerComparison({initialSpeedKmh:83,maxSeconds:12});
  assert.equal(comparison.laps.length,4);
  assert.deepEqual(comparison.laps.map(x=>x.lineId),LINE_IDS);
  assert.ok(comparison.laps.every(x=>x.brakeInCornerFrames===0));
  assert.ok(comparison.laps.every(x=>x.maxRoadOffsetMeters>=0));
  const times=new Set(comparison.laps.map(x=>x.elapsedSeconds));
  const errors=new Set(comparison.laps.map(x=>x.rmsLineErrorMeters));
  assert.ok(times.size>1||errors.size>1);
});
