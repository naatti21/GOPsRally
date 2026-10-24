# v0.4 Phase 1 review handoff

Implements the first slice of #1 only. The root v0.3.1 game and its PWA assets remain unchanged. This is a terrain inspector, not a completed driving game. No deployment workflow is added.

## Run

Node >=22.12 (tested 24.19.0). `npm ci`, `npm test`, `npm run build`, then `npm run preview`. Open http://127.0.0.1:4175/GOPsRally/v04/ . `npm run test:browser` uses `/usr/bin/chromium`; override `CHROMIUM_PATH` where needed. CI installs Playwright Chromium. On this managed environment use `npm --cache /tmp/rally-npm-cache ci` if the default cache is not writable.

## Foundation

- A closed centripetal centerline authors elevation, signed banking and crowned gravel cross-sections. Smooth shoulders blend into surrounding hills/depressions.
- One indexed heightfield mesh has 48,841 vertices and 96,800 triangles. Gravel is a vertex material region, never a second floating ribbon. The identical position/index arrays feed Three.js and Rapier's fixed trimesh. Exact barycentric sampling supplies static wheel placement. Flat shading matches triangle collision normals.
- Non-neighbor corridor overlap, crossing segments and out-of-bounds routes fail explicitly. This prototype supports one non-crossing track, not bridges, tunnels or arbitrary track authoring. A 1.5 m grid still produces visibly faceted shoulders; close sharp bends need visual review.
- An actual dynamic Rapier sphere proves gravity and terrain contact, with CCD and a capped 60 Hz fixed timestep. The four wheels on the parked inspection car are static fixtures, **not suspension**. Camera switching and reset are immediate.
- Separate modules own route authoring, surface mesh/sampling, physics, input/unit contracts, rendering and UI. Pinned npm versions and lockfile provide reproducibility. Rapier APIs checked against 0.21.0 package declarations (`ColliderDesc.trimesh`, `castRayAndGetNormal`, `setCcdEnabled`).
- Build-generated precache bundles the entire preview locally, including Rapier WASM inside the compatibility bundle. Scope `/GOPsRally/v04/` is isolated from the existing game's `/GOPsRally/` scope; cleanup only removes this preview's cache prefix. Cache-first immutable build assets cannot be replaced by HTTP error responses. `ignoreVary` is restricted to this local build cache to handle development server `Vary: Origin` on module requests.

## Verification and limits

See final PR/commit handoff for exact results. Node tests cover mesh topology, real Rapier height/normal agreement, gravity/landing, invalid routes, units/input intent and fixed-step timing. Original VM game and mock-GL renderer tests are preserved as baseline regressions; they do not prove rendering or device performance. Browser tests use actual Chromium WebGL with software SwiftShader at 320 and 393 CSS px, exercise cameras, section selection, physical drop/reset and fully offline reload. Screenshots are generated under `test-results/` and uploaded by CI, not embedded as claimed hardware evidence.

Initial browser run: 2 FAIL on offline module reload. The precache held assets, but Vite's Origin-varying responses missed request-based cache lookup; local immutable cache lookup now ignores Vary. A later run was blocked by a leftover local preview server (port collision), which was stopped before rerun. Neither failure was skipped.

Bundle warning remains: approximately 4.88 MB JavaScript / 1.81 MB gzip. No Android frame rate, thermal, memory or loading-time claim is made. This is a deliberately bounded prototype; render resolution caps at 1.5 DPR, but geometry and startup still need real-device profiling.

## Remaining work after review

Phase 2: dynamic chassis/inertia/center of mass, four raycast suspension wheels, tire/load/surface forces, speed-sensitive braking and steering, genuine jumping/landing/tumbling, countdown/lap state and playable automatic throttle/brake/reverse. The old playable version retains all existing controls while these are absent from the preview. Phase 3: dust/skids/roadside detail, speed presentation and measured Android optimization. Input contract unit tests are not evidence of a vehicle simulation.

## Android review checklist

1. Open the built preview on target Android Chrome; inspect all six sections in portrait and landscape, including inner bends and road shoulders, with wireframe on/off.
2. Verify car/wheel visibility and grounded appearance, Fixed/Chase perspective, touch targets, immediate Reset and falling probe contact.
3. Install preview PWA independently; cold-open offline after first load, rotate/resume, upgrade a build and confirm the old game remains accessible. Existing root PWA's legacy cache cleanup is unchanged and must be checked before co-deployment.
4. Measure frame times, memory, startup and heat on low/mid-range devices. Software-rendered CI is not a substitute.
5. Do not approve driving feel from this static-car slice. Review and approve the shared geometry foundation before Phase 2.

Final local results (2026-10-24): Node foundation **7 PASS / 0 FAIL / 0 SKIP**; both existing baseline smoke scripts **PASS**; Vite production build **PASS** with the documented bundle-size warning; Chromium **2 PASS / 0 FAIL / 0 SKIP**. GitHub Actions and physical Android have not been executed by this local run.
