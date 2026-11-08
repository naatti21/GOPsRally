import test from "node:test";
import assert from "node:assert/strict";
import { launchTorqueScale, availableEngineForce, cornerDriveManagement } from "../../v04/src/physics/drive-profile.js";
import { runArcadeTrace, measureStraight } from "../../scripts/arcade-dynamics-benchmark.mjs";
import { chaseFov } from "../../v04/src/render/camera-response.js";

test("extra launch force decays smoothly before middle speeds without faking wheel or body speed",()=>{
  assert.ok(Math.abs(launchTorqueScale(0)-1.12)<1e-9);
  assert.ok(launchTorqueScale(5)>launchTorqueScale(10));
  assert.ok(launchTorqueScale(10)>1);
  assert.equal(launchTorqueScale(15),1);
  assert.equal(launchTorqueScale(30),1);
  assert.equal(launchTorqueScale(Number.NaN),1);
  for(let i=0;i<150;i++){
    const speed=i/10;
    const next=(i+1)/10;
    assert.ok(Math.abs(launchTorqueScale(next)-launchTorqueScale(speed))<.01);
  }
  // The existing straight torque curve and corner drive management remain unchanged.
  assert.ok(availableEngineForce(0)>8500);
  assert.equal(cornerDriveManagement(0,0).throttleScale,1);
});
test("physical car has a brisk but bounded 0-100 and genuinely steers into a recoverable slip",()=>{
  const measured=measureStraight().find(x=>x.mode==="0–100 km/h");
  assert.equal(measured.reached,true);
  assert.ok(measured.seconds>3.3&&measured.seconds<7);
  const entry=runArcadeTrace({speedKmh:100,pulse:.65});
  const catchTurn=runArcadeTrace({speedKmh:100,pulse:.65,counter:.1});
  assert.ok(entry.summary.peakSlip>5&&entry.summary.peakSlip<25);
  assert.ok(entry.summary.longestModerateSeconds>.2);
  assert.ok(Math.abs(catchTurn.summary.lateralMeters)<Math.abs(entry.summary.lateralMeters)-5);
  assert.ok(catchTurn.summary.peakUnfoldedSlip<27);
});
test("speed camera starts conveying launch before 50km/h, without changing fixed speed readout",()=>{
  assert.equal(chaseFov(0),62);
  assert.ok(chaseFov(30/3.6)>63);
  assert.ok(chaseFov(50/3.6)>65);
  assert.equal(chaseFov(50),74);
});
