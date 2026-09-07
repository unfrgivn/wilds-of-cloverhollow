# M230 Cloverbrook Footbridge art pass

## Reference review before editing

The previous study capture and the Cassette Beasts park/town references shared
the same broad idea, a fixed 2.5D route with a pixel character, but differed in
the important product-facing details: the study read as two flat green slabs
with a few box trees, while the references used a legible ground palette,
layered banks, clustered silhouettes, and a clear reason for each prop. The
previous upper landmark was three stacked solids rather than a place a player
would recognise. The old HUD also occupied enough of the frame to compete with
the scene.

## Implemented visual intent

The runtime scene presents a warm garden route, with the showcase kit required
and loaded fail-closed:

- meadow, soil, path, cliff, and cool stream materials use the repeating showcase
  textures at world scale instead of stretched full-bank images;
- the stream uses the showcase water texture with restrained ripple marks;
- broadleaf trees, conifer, shrubs, reeds, flowers, tufts, and rocks use varied
  anchored pixel sprites with depth testing and deliberate route clearances;
- the upper landmark is an open four-post lookout shrine with a bench, sign, and
  pitched roof, rather than stacked cubes;
- new textured cottage and bridge variants add timber, shingles, masonry,
  recessed windows, window boxes, detailed planking, and embedded textures,
  while retaining the measured body/deck/rail collision contracts;
- the title chrome is compact and names the area plus projection mode. Diagnostic
  floor/air-state text is intentionally kept out of presentation frames while
  Scenario Runner trace operations continue to prove movement and grounding.

## Honest remaining prototype limits

The kit is intentionally bounded to this study. It does not add audio, weather,
NPCs, or a larger world-system refactor. The orthographic view remains the
intended hero composition; the long-lens view is a calibrated comparison, not a
second fully art-directed shot. Capture review must confirm the generated kit is
present before calling the pass complete.

## Reproduction

```bash
uv run --locked python tools/art/build_park25d_showcase.py
blender --background --factory-startup --python tools/art/build_park25d_showcase_blender.py
just study-25d-rendered
```

The recipe is `art/recipes/park25d_showcase.json`. It declares eight opaque
32x32 textures, eight transparent foliage/prop sprites with explicit sizes,
the palette union, and the 20-texel-per-metre target. The original M229 kit is
retained separately. The Blender variant builder reuses its geometry helpers
without invoking its output writer.

The showcase GLB import sidecars deliberately set
`gltf/embedded_image_handling=3` (Godot 4.5 Embed as Uncompressed). Embedded
pixel images stay lossless inside the imported scene instead of creating
loose `cottage_*`/`bridge_*` PNGs beside the assets. The two import sidecars are
tracked exceptions to the general import-metadata ignore rule. A fresh clone
needs Godot to import these GLBs, but does not need Blender.

## Evidence

`study_25d_camera` captures spawn and upper-landmark poses under both camera
profiles. `study_25d_walk` continues to prove the full bridge/ramp return,
barriers, jump, sprite grounding, and asset loading. Rendered PNGs are generated
under `captures/rendered/` by `run-study-25d-rendered.sh`; source changes are
confined to the study runtime and scenario/art evidence paths.
