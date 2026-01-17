# Art Pipeline — Blender → Godot Path B

This pipeline turns Blender collections into Godot-ready prop packages with deterministic outputs.

## Folder layout
```
art/
  blender/
    diorama_template.blend
    material_library.blend
  design_kit/

tools/
  blender/
    export_asset.py
    export_all_assets.py
    export_character_sheet.py

content/props/<asset_id>/
  visuals/
    base.png
    overhang.png (optional)
    shadow.png (optional)
    _processed/ (generated)
  footprints/
    block.png
  _generated/
    shadow.png
  <asset_id>.tscn
  <asset_id>_def.tres
  <asset_id>_manifest.json
```

## Blender conventions
`art/blender/diorama_template.blend` defines the export defaults.

### Required scene objects
- `RENDER_CAM` — fixed game camera
- `FOOTPRINT_CAM` — top-down orthographic camera
- `ANCHOR` — empty at feet/contact point, Z=0

### Collections per asset
```
ASSET__<asset_id>
  COL_BASE        (required)
  COL_OVERHANG    (optional)
  COL_FOOTPRINT   (required for blocking props)
```

If multiple assets share one .blend file, Blender may suffix collection names (e.g. `COL_BASE.001`). The exporter accepts `COL_*` prefixes.

### Render settings
- Film Transparent: ON
- Output: PNG, RGBA
- Lighting: fixed rig in template scene

## Design kit materials
`art/blender/material_library.blend` references textures in `art/design_kit/`.

Mapping (placeholder until real textures land):
- `MAT_WOOD_PLANKS_A` → `art/design_kit/wood_planks_a.*`
- `MAT_STONE_BLOCKS_A` → `art/design_kit/stone_blocks_a.*`
- `MAT_PLASTER_A` → `art/design_kit/plaster_a.*`
- `MAT_ROOF_TILE_A` → `art/design_kit/roof_tile_a.*`

## Blender export commands
Single asset:
```bash
blender -b art/blender/diorama_template.blend \
  -P tools/blender/export_asset.py -- \
  --asset <asset_id> \
  --out "$(pwd)/content/props"
```

Batch export:
```bash
# Export all ASSET__* collections
blender -b art/blender/diorama_template.blend \
  -P tools/blender/export_all_assets.py -- \
  --all \
  --out "$(pwd)/content/props"

# Export only assets referenced by scene.json
blender -b art/blender/diorama_template.blend \
  -P tools/blender/export_all_assets.py -- \
  --referenced-only \
  --scenes "$(pwd)/content/scenes" \
  --out "$(pwd)/content/props"
```

## Manifest schema
`<asset_id>_manifest.json` is written by `export_asset.py`:
```json
{
  "asset_id": "house_01",
  "outputs": {
    "base_png": "visuals/base.png",
    "overhang_png": "visuals/overhang.png",
    "footprint_png": "footprints/block.png"
  },
  "anchor": {
    "mode": "anchor_empty",
    "anchor_hint": "ANCHOR at feet"
  },
  "defaults": {
    "blocks_movement": true,
    "has_overhang": true,
    "default_bake_mode": "static"
  }
}
```

## Godot import + processing
Run these headless scripts (referenced assets only by default):
```bash
godot --headless --quit --script res://tools/process_prop_images.gd
godot --headless --quit --script res://tools/generate_prop_shadows.gd
godot --headless --quit --script res://tools/qa_art.gd
godot --headless --quit --script res://tools/import_prop_manifests.gd
```

- `process_prop_images.gd` crops to alpha bounds and writes `visuals/_processed/*`
- `generate_prop_shadows.gd` creates `_generated/shadow.png` when needed
- `qa_art.gd` fails on opaque backgrounds, missing padding, or missing shadows
- `import_prop_manifests.gd` creates/updates `*_def.tres` and `*.tscn`

Use `--all` on tools that support it to process every prop in the repo.

## Art hygiene rules
- All prop art must be transparent PNGs (no checkerboard or opaque backgrounds).
- Enforce `ART_PADDING_PX` transparent border in `_processed` output.
- Split overhangs into `overhang.png` so they draw above the player.
- Blocking props must have a shadow (authored or generated).

## Troubleshooting
- **Missing collection/camera**: ensure `ASSET__<asset_id>`, `COL_*`, `RENDER_CAM`, and `FOOTPRINT_CAM` exist in the template.
- **QA fails with padding**: verify transparent borders and re-run `process_prop_images.gd`.
- **No shadow**: add `visuals/shadow.png` or rerun `generate_prop_shadows.gd`.

## Character sheets (optional)
`export_character_sheet.py` is a stub. Use it as the entry point for character renders:
```
content/characters/<char_id>/
  idle_4dir.png
  walk_4dir.png
  <char_id>.json
```
