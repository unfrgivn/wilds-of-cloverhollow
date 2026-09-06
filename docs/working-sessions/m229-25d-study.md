# M229: branch-only 2.5D study

## Scope

This is a direction sample on `prototype/2-5d-world-study`, not a replacement
for the production 2D game. The starting main commit is `d9c3dd5`.
See [the research and migration recommendation](../art/25d-direction-study.md)
and [sample controls](../testing/25d-study-controls.md).

## Original Blender assets

The cottage and bridge are original Cloverhollow assets. The parent review
rebuilt them using Blender 5.0.1 and independently re-imported the exported
GLBs. The bridge measured 4 × 2 metres, with a 1 metre rail height. The cottage
wall body measured 3.2 × 2.4 × 2.2 metres, with a 3.05 metre roof ridge.

Geometry checks cover closed meshes, positive signed volume, planar faces,
facade recess ray hits, chimney overlap, bridge deck height, and rail contact.
An initial asset capture exposed coplanar bottom trim and Blender's default
cube in the preview. The trim was separated from the wall faces and unrelated
objects excluded from rendering. A fresh attachment review found no visible
bottom-trim striping or unrelated objects in the corrected cottage preview.

Local evidence:

- `captures/25d-study/assets/asset-validation.json`
- `captures/25d-study/assets/parent-final-rebuild.log`
- `captures/25d-study/assets/independent-glb-import.json`
- `captures/25d-study/assets/parent-final-cottage-review.txt`

The asset-only views are not gameplay evidence. Runtime collision and rendered
composition require their own Scenario Runner checks.

## Final playable evidence

Both study scenarios passed headless and rendered verification. The final
walk crosses the bridge, climbs the ramp to the 1.2 m ledge, jumps, lands,
descends, and returns to the west bank. The camera scenario additionally
checks water blocking from both banks and the upper cliff boundary.

The final MovieMaker trace records a jump from approximately 1.200 m to 2.163 m,
followed by a grounded landing. Its west return checkpoint is at approximately
`(-3.094, 0.000, 0.000)`. The bridge checkpoint is approximately 0.161 m high.
No route action teleports or automatically jumps around obstacles.

Final evidence:

- `captures/25d-study/final-headless-walk/trace.json`
- `captures/25d-study/final-headless-camera/trace.json`
- `captures/25d-study/showcase-camera/trace.json` and six native PNGs
- `captures/25d-study/showcase-movie/trace.json` and `walkthrough.avi`
- `captures/25d-study/showcase-camera-review.txt`
- `captures/25d-study/showcase-motion-review.txt`
- [Committed gallery, GIF, and MP4](../art/samples/park25d/README.md)

The final attachment reviews identify Fae in every comparison panel and all
six sampled motion frames, with no major clipping. Reviews are advisory and
are corroborated by the route trace and geometry checks. Projection metadata
checks the billboard's camera-facing bounds, not framebuffer occlusion.

The parent corrected an always-on-top sprite workaround, a rail collider twice
its intended width, malformed mesh winding, wrong-side ramp waypoints, and a
mislabeled perspective capture. Depth testing stays enabled. The final camera
angle and landmark placement keep the route readable without drawing Fae
through solid geometry.

Three numeric geometry tests validate the actual ramp/approach initializers,
closed topology, outward winding, and rail dimensions. They are source-data
checks, not a substitute for the passing Godot traversal runs.

## Regression gates

The existing art pipeline passed 13 tests through `just art-tests`.
Six additional real-binary GLB tests passed through
`uv run --locked --project . python -m unittest discover -s tests/art -p test_study_glb.py`.
They check the container, hierarchy, geometry data, dimensions, and linearized
material colors without a mocked importer or new dependency.
The existing visual evidence and renderer tests passed 10 tests through
`bun test tests/visual/`. No baseline was promoted for this new study.

Parent verification also passed the production `run-smoke.sh`, `run-tests.sh`,
and `run-spec-check.sh` gates, plus the existing real-input
`town_forest_route_smoke` round trip. Logs and the legacy route trace are under
`captures/25d-study/parent-checks`. These verify retained 2D behavior; they do
not substitute for the study's separate 3D traversal checks.

`just visual-regression` also passed: overworld, dialogue, and battle captures
matched all three existing local goldens exactly. The log is
`captures/25d-study/parent-checks/legacy-visuals.log`.

This study does not certify an iOS performance budget, mobile touch controls,
quest progression, battle return, save migration, or large-world streaming.
The flat-shaded terrain and block trees remain deliberate prototype art. The
branch stops at visual direction review, with no merge to main or automatic
whole-game migration.
Water/cliff pressure checks cover walking. Jumping over low water walls or
bridge rails and recovering from a fall are not certified; the study has no
fall-recovery system. This is a remaining prototype limitation, not production
boundary behavior.
