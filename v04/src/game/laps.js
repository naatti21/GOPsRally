export const RACE = {
  track_id: "gops-hill-chicane-v1",
  direction: 1,
  startFraction: 0,
  vehicle_class: "rally-1200",
  physics_version: "rapier-v04-p2-3",
};
export function makeLaps(track, { direction = 1, startFraction = 0 } = {}) {
  if (
    ![1, -1].includes(direction) ||
    !Number.isFinite(startFraction) ||
    startFraction < 0 ||
    startFraction >= 1
  )
    throw Error("Invalid start configuration");
  const gates = Array.from({ length: 8 }, (_, i) => {
    const f = (startFraction + (direction * i) / 8 + 1) % 1,
      n = track.nodes[Math.floor(f * track.nodes.length)];
    return { ...n, tx: n.tx * direction, tz: n.tz * direction };
  });
  let previous = null,
    next = 1,
    elapsed = 0,
    valid = true,
    laps = [],
    started = false;
  function update(p, dt) {
    elapsed += dt;
    if (!previous) {
      previous = { ...p };
      return;
    }
    const travel = Math.hypot(p.x - previous.x, p.z - previous.z);
    if (travel > 20) {
      valid = false;
      previous = { ...p };
      return;
    }
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i],
        a = (previous.x - g.x) * g.tx + (previous.z - g.z) * g.tz,
        b = (p.x - g.x) * g.tx + (p.z - g.z) * g.tz;
      if (a < 0 && b >= 0) {
        const t = -a / (b - a),
          x = previous.x + (p.x - previous.x) * t,
          z = previous.z + (p.z - previous.z) * t,
          y = previous.y + (p.y - previous.y) * t;
        if (
          Math.abs((x - g.x) * g.tz - (z - g.z) * g.tx) > track.roadHalf + 3 ||
          Math.abs(y - g.y) > 4
        )
          continue;
        if (i === 0) {
          if (started && valid && next === 8) laps.push(elapsed);
          started = true;
          next = 1;
          elapsed = 0;
          valid = true;
        } else if (started && i === next) next++;
        else if (started) valid = false;
      }
    }
    previous = { ...p };
  }
  return {
    gates,
    update,
    invalidate() {
      valid = false;
      previous = null;
    },
    snapshot: () => ({ elapsed, valid, started, next, laps: [...laps] }),
  };
}
