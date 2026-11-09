# Classic Rally V3 — momentum and speed perception test

## Real Android observation (2026-11-09)
V2 is a step forward, but lateral grip snaps back, car abruptly travels along its facing heading and 180 km/h looks/feels too slow. Treat this as **failed player-acceptance**, despite passing synthetic V2 tests.

## What changes and why
1. V2's lateral velocity was multiplied every frame by an exponential damping factor: this can erase slip unnaturally. V3 preserves longitudinal/sideways velocity and only changes it using **capped lateral acceleration**. No traction magnet or velocity snap to yaw.
2. A traction state declines/rebuilds over different time constants. The available side force remains limited throughout, even as grip recovers.
3. Steering **curvature** decreases with speed. At 180 km/h the car cannot make an unrealistic tight bend merely by holding a button; the player must brake before a bend. R = v^2/a demonstrates why.
4. Actual lateral acceleration now drives body lean, not the steering button. Vibration frequency follows actual speed.
5. Wide fixed camera is still compass-locked but moves its focus ahead of the **velocity vector**, not the nose, so drifting does not point the camera in a fake direction. Landscape view span tightens from 174m at rest toward 136m at speed; around 180 km/h a 393px screen gives ~144px/s of world-space motion before angle foreshortening. No fabricated displayed speed.
6. The road geometry, lap timing, three driving controls, and other versions are unchanged.

## Acceptance on Android
- Verify **actual visible slide** at 60–100 km/h and that the car **keeps drifting smoothly** for a moment after the steering button is released.
- Compare coasting/countersteering: does the slide reduce gradually instead of suddenly pointing straight?
- At 160–180 km/h on available straights, are surroundings moving noticeably faster? Can players feel that turning requires more space and earlier braking?
- If not, record mode/orientation/speed and short screen video. Automated slip degrees alone cannot prove a good game.
- If "V3" label is absent, stop: old cached/wrong test is running.

## Strict release boundary
**DO NOT merge or deploy**. This branch is compared only with the previously unapproved Classic V2 draft. GitHub Actions produces standalone HTML for optional Android testing; source changes aren't a public release.
