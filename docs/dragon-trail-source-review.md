# Dragon Trail — reference geometry intake (2026-10-24)

## Confirmed evidence from user-supplied files

- The user confirmed that their linked driving video shows **Dragon Trail – Seaside**, and that the arrow on their map indicates **driving direction** with the **start/finish at that marker**. The marker's actual X/Y location is **not represented in the available STL or archived HTML**. Do not guess its coordinates or driving sign.
- User-uploaded binary `Dragon Trail - Seaside.stl`: 3,568 triangles, 1,784 distinct STL vertices after merging, watertight single connected 5-unit-thick extrusion. Bounding box source X ≈ -54.577..53.0, Y ≈ -48..74.563, Z **only 0 and 5**. Thus it is a *plan-view shape*, **not a road elevation / terrain model**.
- Two planar boundaries were extracted from upper triangles: outer = 465 points, inner = 427 points, both valid closed polygons. The source-unit dimensions **are not meters**, and STL point order does not establish track direction.
- The derived plan data is at [`reference/dragon-trail-plan-contours.json`](../reference/dragon-trail-plan-contours.json). Treat the coordinates as a **reference** for tracing the road corridor, not a ready-made driveable centerline.
- User-uploaded `veindragontrail.zip - Google Drive.mht` is a saved HTML Drive preview only; it does not embed ZIP data. Drive metadata confirms `veindragontrail.zip`, MIME `application/x-zip-compressed`, **523,985,073 bytes**. Connected Drive raw download rejected it (413) because it exceeds the connector's 268,435,456-byte limit. **Contents of that ZIP remain unknown.**
- Official Gran Turismo published Dragon Trail – Seaside specs: approximately **5,209 m** lap, **38 m** total elevation difference, **18** corners, **653 m** longest straight. Source: https://www.gran-turismo.com/us/products/gtsport/tracklist/ . These figures describe the original named circuit, not verified 3D shape measurements of the STL.

## Phase 2 / track authoring recommendations

1. Reconstruct a **closed, non-self-intersecting centerline** from the sampled outline. Verify road width, curve radii and minimum separation against the contours. The boundary polygon is not an ordered centerline and should not be treated as one. Normalize source units using the target total length or explicit scale constraints.
2. Ask for / import a **map image annotated with driving arrow and start/finish marker** (or equivalent user-confirmed marker coordinates) before finalizing direction or lap-crossing logic. The MHT is not such an image.
3. Elevation is a **separate editable distance-along-track curve**. Seed it with the user's profile/video plus stated uncertainties; avoid inferring actual elevations from the flat STL. A prototype may use a clearly marked artist-authored profile with about 38 m difference, but it is *not* evidence of exact real elevation.
4. Sculpt adjoining terrain with road cut/fill, drainage and shoulders on an extended spatial scale. Avoid a uniform track-width ridge; generate road materials and collider from **the same world mesh**.
5. Treat the fast technical chicane / "Chicane of Death" as a gameplay test: curb impact, bank, tire loading, jump clearance, offroad collision and sufficient collision substeps at 180 km/h (50 m/s).
6. The current v0.4 Phase 1 is a static inspection prototype. Before adding an actual vehicle, benchmark terrain generation (currently repeated nearest-segment lookups on a dense heightfield) and verify Android frame time/startup and offline cache coexistence.
7. Copyright/IP boundary: the supplied mesh derives from a recognizable third-party fictional track. Use it as an internal geometry research/reference asset for a **distinct, original GOPs Rally track**; do not copy branding, textures, track name or protected art into an eventual commercial release without rights review.

## Test gating

- Geometry imports with no inverted polygons, no collapsed chicane, no crossings unless explicitly supported; contact surface matches rendered geometry.
- Start/finish and direction must be **visually verified** by user.
- Physical longitudinal profile must be stored independently of plan footprint and configurable without re-tracing centerline.
- Legacy `main` playable version remains unaffected; next playable physics slice lands on a feature branch / Draft PR.
