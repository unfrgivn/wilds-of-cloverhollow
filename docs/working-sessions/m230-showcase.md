# M230: Cloverbrook Footbridge showcase

## Scope and direction

The user requested a full art pass of the M229 2.5D sample to judge what a
polished product might look like. This remains a branch-only world-art slice,
not a migration of quests, battles, saves, or the production 2D game.

The brief is [Cloverbrook art direction](../art/cloverbrook-art-direction.md).
The M229 gallery remains available as the before state. Local before images
and reference comparison are under `captures/m230/before`.

## Review standard

A first geometry-only pass was not accepted as the requested showcase: it
still lacked authored surface textures and upgraded hero assets. Source review
also found presentation geometry that did not match the walkable surfaces.
The final acceptance must include real authored assets, corrected contacts,
and an inspected in-engine view, rather than relying on a successful run log.

## Retained-game checks

Parent verification passed:

- `./tools/ci/run-smoke.sh`
- `./tools/ci/run-tests.sh`
- `./tools/ci/run-spec-check.sh`
- `CAPTURE_DIR=captures/m230/parent-checks/legacy-goldens just visual-regression`
- The existing `town_forest_route_smoke` real-input round trip.

Logs and traces are under `captures/m230/parent-checks`. All three retained
local goldens matched exactly. The first visual-regression invocation correctly
refused a nonempty default capture directory; the fresh-directory run passed.

These checks establish retained 2D behavior. They do not establish the new art
pass's visual quality, asset correctness, or 3D traversal acceptance.

## Delivered art and reproducibility

- Eight original 32x32 material textures, including the cottage plaster.
- Eight transparent environment sprites with explicit dimensions and foot anchors.
- Textured cottage and bridge variants, retaining the original collision contracts.
- World-scale texture mapping, masonry banks, stream wet lines/foam, a covered
  lookout, compact helper UI, and corrected plant/prop placement.
- [Committed gallery and before/after comparison](../art/samples/cloverbrook-showcase/README.md).

The parent independently ran the pixel-kit tests and rebuilt the Blender
variants after the final PNG generation, so embedded model textures match the
published kit. Blender reported 1,508 cottage triangles and 828 bridge triangles,
with all measured geometry/UV/contact checks passing. The body, roof, deck, and
rail dimensions remain those in the recipe.

Reproduction and import decisions are documented in
`docs/art/park25d-m230-art-pass.md`. The two tracked GLB import sidecars use
uncompressed embedded images. Removing earlier importer-generated image copies
briefly exposed stale local UID references; a subsequent clean import scan
passed, and later imports/runs required no extracted image copies.

## Final independent verification

- `just art-tests`: **24 passed**, including palette, alpha, size, byte-identical
  regeneration, texture repeat continuity, and the retained M229 asset tests.
- `uv run --locked python -m unittest tests/studies/test_park_3d_study.py`:
  **4 passed**. The source contracts complement, not replace, runtime inspection.
- `study_25d_camera`: **passed headless and rendered**. The measured geometry
  action confirms all 13 plant anchors, path vertices/normals, 4 lookout posts,
  2 bench legs, 2 pots, and UI bounds.
- `study_25d_walk`: **passed headless and rendered**. The bridge/ramp ascent,
  jump, landing, descent, and west-bank return remain intact.
- `record-study-25d.sh study_25d_walk`: **passed**, producing a validated real
  MovieMaker recording. The jump rises from approximately 1.200 m to 2.163 m;
  the grounded return is approximately `(-3.094, 0.000, 0.000)` at frame 606.
- Final smoke, tests, and spec checks also passed after integration.

Final local artifacts:

- `captures/m230/final-headless-camera` and `final-headless-walk`
- `captures/m230/final-camera` and `final-walk`
- `captures/m230/final-movie`
- `captures/m230/parent-checks/final-art-tests.log`
- `captures/m230/parent-checks/final-geometry-tests.log`
- `captures/m230/parent-checks/release-tests.log`
- `captures/m230/parent-checks/release-smoke-command.log`

## Visual review and media

The before/after attachment review identified a cohesive art slice rather than
the earlier primitive blockout. Final reviews identified Fae in all six camera
panels and all six sampled motion frames, with no visible missing faces or
disconnected props. Those observations are corroborated by trace positions and
measured geometry. A reviewer's inference about shadow implementation is not
treated as proof; the scene uses a real directional light plus contact-shadow
geometry and authored sprite shading.

- Camera review: `captures/m230/final-camera-review.txt`
- Motion review: `captures/m230/final-motion-review.txt`
- Look: `captures/m230/final-motion-sheet.png`
- Source: 15-second, 900-frame, 512x288 / 60 FPS MJPEG recording.
- Delivery: first 12 seconds, 1024x576 / 60 FPS H.264 MP4, nearest-neighbor
  enlargement, no audio or speed change; native-size 15 FPS GIF preview.
- Probes: `captures/m230/parent-checks/source-movie-probe.json` and
  `delivery-movie-probe.json`.

The visuals are an art-direction example, not a complete game. Repeating
textures, static water/foliage, simple environmental animation, and broader
world interaction remain production work. Mobile performance, fall recovery,
and jumping over low water walls/rails are not certified. Main is unchanged;
the branch stops here for the user's visual review.
