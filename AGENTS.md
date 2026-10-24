# Coding-agent instructions for GOPs Rally v0.4

Before changing code, read `docs/physics-v0.4-brief.md` and GitHub issue #1. Work on branch `codex/rally-v04-physics` (or create a short-lived sub-branch and PR toward it). Never merge directly into `main` or silently replace the deployed v0.3.1 game.

## Primary priority
Make the road, terrain, visual mesh, physics colliders and wheel contacts agree geometrically. Then implement mass, gravity, suspension, airborne flight, landings and wheel grip with Rapier3D. Cosmetic roll, exaggerated particle effects or scripted jumps are not a substitute.

## Tooling and deliverable
Use current documented APIs, Vite, Three.js, Rapier 3D, pinned npm deps and lockfile. Bundle locally for offline PWA; use the `/GOPsRally/` GitHub Pages base path when preparing deployment. Preserve accessible touch left/right/brake, deliberate reverse, manual no-wait reset, and Fixed/Chase cameras. Avoid a monolithic gameplay script.

Start by reporting an implementation plan and reviewing risks. Keep work incremental and testable. Each PR should include commands run, pass/fail evidence, verification gaps and an Android manual-test checklist. Do not invent frame rates or claim a device test based on a mocked GL context.

No Supabase/multiplayer work until local driving, terrain and camera behavior are reliable.

## Acceptance focus
- One source of truth for render heights/normals and physics collision.
- No floating road, reversed steering, disappearing wheels or clipping into the ground.
- Four wheel suspension travel and real rigid-body dynamics through crests, bumps and off-road exits.
- Correct 180 km/h = 50 m/s and meaningful sense of speed.
- Functional physics tests and build before PR review.
