export function bindDrivingControls() {
  const keys = new Set(),
    pointers = new Map();
  const map = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowDown: "brake",
    Space: "brake",
  };
  const clear = () => {
    keys.clear();
    pointers.clear();
  };
  for (const b of document.querySelectorAll("[data-drive]")) {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, b.dataset.drive);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      b.addEventListener(name, (e) => pointers.delete(e.pointerId));
  }
  window.addEventListener("keydown", (e) => {
    if (
      map[e.code] &&
      !["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
    ) {
      e.preventDefault();
      keys.add(map[e.code]);
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(map[e.code]));
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return {
    clear,
    read: () => {
      const set = new Set([...keys, ...pointers.values()]);
      return {
        left: set.has("left"),
        right: set.has("right"),
        brake: set.has("brake"),
      };
    },
  };
}
