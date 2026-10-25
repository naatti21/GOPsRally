/**
 * Lightweight, explicitly approximate wheel rotational dynamics for the
 * v0.4.6 three-button drivetrain. This models the speedometer/visible wheel
 * rotation, NOT a replacement for the existing contact tire force solver.
 *
 * No road-contact => applied engine torque accelerates the driven wheel until
 * the gearing-equivalent limiter. Landing couples the spin back toward contact
 * rolling speed according to the actual normal load. Nothing changes the
 * chassis translation, yaw, tyre friction budget, or the existing 60 Hz forces.
 */
export const WHEEL_SPIN = Object.freeze({
  inertiaKgM2: 2.1,
  freeSpinDragPerSecond: 0.32,
  groundCouplingPerSecond: 25,
  limiterKmh: 190,
  driveSlipPerLoad: 0.26,
  maxGroundDriveSlipMps: 1.8,
});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function stepWheelSpin(previous,{
  dt,radius,longitudinalSpeed,contact,load,driveForce=0,brakeForce=0,
  settings=WHEEL_SPIN,
}) {
  if (![dt,radius,longitudinalSpeed,load,driveForce,brakeForce,
    previous?.omega,previous?.rotation].every(Number.isFinite)
    ||dt<=0||dt>0.1||radius<=0||load<0||brakeForce<0)
    throw Error('Invalid wheel rotation state or physics timestep');
  const maxOmega=settings.limiterKmh/3.6/radius;
  let omega=previous.omega;
  // All driven wheels get their real requested engine share from the same
  // impulse budget; in air the wheel can freely rev instead of "reading"
  // chassis velocity, which would be incorrect.
  omega+=driveForce*radius/settings.inertiaKgM2*dt;
  if(brakeForce>0) {
    const brakeImpulse=(brakeForce*radius/settings.inertiaKgM2)*dt;
    omega=Math.sign(omega)*Math.max(0,Math.abs(omega)-brakeImpulse);
  }
  if(contact){
    // Simplified rolling constraint, load-sensitive and continuous at touch.
    // It is *observational*: longitudinal tire force stays handled by Rapier
    // contact impulses, rather than double-applying torque to the chassis.
    const slip=clamp(driveForce*settings.driveSlipPerLoad/Math.max(1000,load),
      -settings.maxGroundDriveSlipMps,settings.maxGroundDriveSlipMps);
    const target=(longitudinalSpeed+slip)/radius;
    const stiffness=settings.groundCouplingPerSecond*clamp(load/3000,0.12,1.8);
    omega+=(target-omega)*(1-Math.exp(-stiffness*dt));
  } else {
    omega*=Math.exp(-settings.freeSpinDragPerSecond*dt);
  }
  omega=clamp(omega,-maxOmega,maxOmega);
  const rotation=previous.rotation+omega*dt;
  return {omega,rotation,limited:Math.abs(omega)>=maxOmega-0.001};
}
/** AWD: both axles are powered. Sensor-style indicated speed is the mean
 * magnitude of 4 wheel circumferential speeds, NOT the chassis dot(forward).
 * The independent true horizontal ground speed is kept for diagnosis.
 */
export function wheelSpeedometer(wheels,radius) {
  if(!Array.isArray(wheels)||wheels.length!==4||!Number.isFinite(radius)||radius<=0)
    throw Error('Expected four wheels and a valid tire radius');
  if(wheels.some(w=>!Number.isFinite(w.omega)))
    throw Error('Nonfinite angular wheel speed');
  return wheels.reduce((a,w)=>a+Math.abs(w.omega),0)*radius/4;
}
