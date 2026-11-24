// Test driver only. Returns button states; never moves or aligns the vehicle.
export function raceButtons(surface,state,maxSpeed=53) {
  const at=surface.sample(state.x,state.z);
  if(at.s==null)throw Error("Test driver left the terrain ribbon");
  const sight=Math.max(9,state.speed*.47);
  const target=surface.sampleRoad(at.s+sight);
  const heading=Math.atan2(target.x-state.x,target.z-state.z);
  const difference=heading-state.theta;
  const turn=Math.atan2(Math.sin(difference),Math.cos(difference))-.16*state.yawRate;
  let desired=maxSpeed;
  for(let ahead=3;ahead<=100;ahead+=7) {
    const curve=Math.abs(surface.sampleRoad(at.s+ahead).curve);
    const cornerSpeed=Math.sqrt(12/Math.max(.001,curve));
    desired=Math.min(desired,Math.sqrt(cornerSpeed**2+2*18*ahead));
  }
  return {left:turn<-.028,right:turn>.028,brake:state.speed>desired};
}
