# Exports (Game-ready)

Place cropped/normalized PNGs that are ready to import into Godot here.

## Conventions
- Stable filenames with `_vNN` versioning (e.g., `fae_walk_v01.png`)
- Transparent backgrounds for sprites/props/icons
- Consistent scale across asset sets

## Export checklist
1) Crop to content bounds and pad to consistent canvas size
2) Verify transparency (no checkerboard baked into pixels)
3) Normalize scale to match existing assets
4) Export PNGs to `art/exports/`
5) Copy final files into the target scene folder under `content/scenes/`
