/**
 * The terrain is finite. A runaway car must not fall through an absent
 * collider indefinitely; stop simulation at the outermost edge and offer
 * explicit RESET. Never teleport or magnetize the vehicle onto the road.
 */
export function outsideTerrain(surface, position, inset = 2.5) {
  if (!Number.isFinite(inset) || inset < 0 || !Number.isFinite(surface?.min) ||
    !Number.isFinite(surface?.size) || ![position?.x, position?.z].every(Number.isFinite))
    return true;
  const min = surface.min + inset, max = surface.min + surface.size - inset;
  return position.x < min || position.x > max ||
    position.z < min || position.z > max;
}
