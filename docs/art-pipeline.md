# Art Pipeline — Blender Sprite Factory → Godot 4.5 assets

This project uses Blender as the sprite factory for all props, buildings, room shells, and UI art. The goal is consistent, repeatable, transparent PNG output that feeds the Path B pipeline.

## 1. Folder layout (recommended)

- `art/blender/`
  - `.blend` source files
  - per‑asset collections
- `art/exports/`
  - final PNG exports (RGBA, transparent)
- `content/props/`
  - prop packages (used by the prototype)
- `content/scenes/`
  - scene assets (ground plates and baked outputs)

## 2. Blender export settings (required)

### 2.1 Scene + render
- **Render engine**: Eevee or Cycles (consistent per asset set)
- **Color management**: View Transform = Standard
- **Film**: Transparent = ON
- **Output**: PNG, RGBA, 8‑bit
- **Resolution**: fixed per asset class (document in the `.blend` file)

### 2.2 Camera + anchoring
- **Camera**: Orthographic
- **Anchor convention**: prop feet/contact point at `(0,0,0)`
- **Bottom‑center alignment**: the prop’s feet align to the bottom‑center of the image
- **Consistent scale**: 1 world unit = 1 pixel in Godot

### 2.3 Naming
- `prop_id_base.png`
- `prop_id_overhang.png`
- `prop_id_shadow.png` (optional)

## 3. Export checklist (hard requirements)

- PNG has true alpha, no checkerboard background
- No opaque background or black/white boxes
- Crop to alpha bounds with `ART_PADDING_PX` padding
- Overhang sprites only contain draw‑over elements

## 4. Import into prop packages

For each prop package:
- Copy PNGs into `content/props/<prop_id>/visuals/`
- Ensure `base.png` and `overhang.png` are transparent
- Keep `footprints/block.png` authoritative for collisions

### 4.1 Sync Blender exports (recommended)

Use the sync tool to copy Blender exports into prop visuals:
```bash
godot --headless --quit --script res://tools/sync_blender_exports.gd
```
Optional flags:
- `--dry-run` for a no‑write preview
- `--allow-create` to create missing prop folders
- `--allow-missing` to skip if `art/exports` is absent

## 5. Ground plates (Path B)

- `ground.png` must be **ground only** (dirt, grass, paths, puddles)
- **No buildings, walls, furniture, or vertical art** on `ground.png`

## 6. Validation gates

Before committing new art:
- Run `godot --headless --quit --script res://tools/crop_prop_images.gd`
- Run `godot --headless --quit --script res://tools/qa_art.gd`
- Run `godot --headless --quit --script res://tools/bake_scene_plates.gd`

If QA fails, the asset does not enter the repo.
