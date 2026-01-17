# Blender Asset Source Files

This folder holds the Blender source files that define the export conventions for the Path B pipeline.

Required files:
- `diorama_template.blend` — template scene with cameras, lighting, and render defaults
- `material_library.blend` — shared material library that references textures in `art/design_kit/`

Conventions (summary):
- Cameras:
  - `RENDER_CAM` (game render, fixed)
  - `FOOTPRINT_CAM` (top-down ortho for footprints)
- Collections per asset:
  - `ASSET__<asset_id>`
    - `COL_BASE` (required)
    - `COL_OVERHANG` (optional)
    - `COL_FOOTPRINT` (required for blocking props)
- `ANCHOR` empty placed at the feet/contact point, Z=0
- Film Transparent enabled, PNG RGBA output

For full pipeline details see `docs/art_pipeline.md`.
