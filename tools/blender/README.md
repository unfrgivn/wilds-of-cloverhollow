# Blender Export Tools

These scripts export Blender assets into Godot-ready prop packages.

## Single asset export
```bash
blender -b art/blender/diorama_template.blend \
  -P tools/blender/export_asset.py -- \
  --asset <asset_id> \
  --out "$(pwd)/content/props"
```

## Batch export
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

## Character sheet export (optional)
```bash
blender -b art/blender/diorama_template.blend \
  -P tools/blender/export_character_sheet.py -- \
  --character <char_id> \
  --out "$(pwd)/content/characters"
```

All scripts are headless-safe and log errors on failure.
