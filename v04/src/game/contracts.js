export const kmhToMps=kmh=>kmh/3.6;
export const forward=yaw=>({x:Math.sin(yaw),z:-Math.cos(yaw)});
export const steering=({left=false,right=false})=>Number(right)-Number(left);
export function makeClock(step=1/60){
  let accumulator=0;
  return {advance(dt,tick){accumulator+=Math.min(Math.max(dt,0),.1);let ticks=0;while(accumulator>=step){tick(step);accumulator-=step;ticks++}return {alpha:accumulator/step,ticks}},reset(){accumulator=0}};
}
// Kept independent from rendering for the next dynamics slice; no fake car motion.
export function driveIntent(input,speed,heldBrakeSeconds){
  const reverse=input.brake&&Math.abs(speed)<.5&&heldBrakeSeconds>=.7;
  return {steer:steering(input),throttle:input.brake?(reverse?-1:0):1,brake:input.brake&&!reverse};
}
