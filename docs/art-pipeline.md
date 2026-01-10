# Art Pipeline — nano banana (image generation) → Godot 4.5 assets

This project uses an external image generation tool (“nano banana” via the user’s image tool) to generate:
- characters / NPCs
- environment backdrops (interiors/exteriors)
- props and item icons
- UI elements

The repository’s responsibility is to keep this repeatable:
- store prompts + constraints
- store chosen outputs
- document import/slicing conventions for Godot

## 1. Folder layout (recommended)

- `art/prompts/`
  - prompt templates (markdown/yaml)
  - constraints per asset type
- `art/source/`
  - raw tool outputs (high-res PNG)
- `art/exports/`
  - game-ready PNGs (cropped, transparent, sized)
- `assets/`
  - imported game assets referenced by scenes/resources

Note: `art/reference/concepts/` already contains the target style samples.

## 2. Generation constraints (critical)

To avoid “almost usable” art, bake these constraints into prompts:

### 2.1 Characters/NPCs
- Transparent background
- Consistent neutral lighting (no dramatic cast shadows)
- Keep silhouette clean (no wispy edges)
- Maintain consistent head/torso proportions across frames
- Provide **4 directions**: front, back, left, right
- Provide **walk cycle** frames: idle + step1 + step2 (minimum)
- Keep the feet aligned to a consistent baseline (for ground contact)

Output format suggestion:
- sprite sheet: 4 rows (directions) × 3 columns (idle/step/step)
- or separate PNGs per frame with consistent canvas size

### 2.2 Interiors (rooms)
Two acceptable styles:
1) Single backdrop image (room “diorama”) + colliders + hotspots
2) Modular prop kit placed in-engine

For speed, prefer (1) for the demo.

Constraints:
- Keep floors readable (clear plane, minimal high-frequency texture)
- Leave a navigable lane between doorways and key interactables
- Avoid extreme perspective distortion (player must “fit”)

### 2.3 Props / icons
- Transparent background
- Sticker-outline optional, but consistent
- Limit micro-detail (icons must read at small sizes)
- Export at multiple scales if needed (e.g., 64×64, 128×128)

## 3. Godot import settings

Decide per project whether textures should be filtered.

Recommended options:
- If using a low-res SubViewport: allow filtered textures but let the SubViewport provide coherence.
- If using true pixel art: disable filtering and mipmaps on relevant textures.

## 4. Prompt templates

You should store prompts in `art/prompts/` and treat them like code.

### 4.1 Fae exploration sprite sheet (example prompt)
- “Create a 2D game sprite sheet of a child adventurer named Fae in a cozy watercolor sticker style.
   Provide 4 directions (front, back, left, right), each with 3 frames (idle, step1, step2).
   Transparent background. Consistent character scale and baseline alignment. Simple shading.
   Outfit: purple hoodie, shorts, sneakers, glittery backpack with star/heart stickers.
   Canvas: 768×1024, arranged in a 4×3 grid with equal cell sizes.”

### 4.2 Arcade interior backdrop (example prompt)
- “Create a cozy cutaway arcade interior diorama in soft watercolor style, angled top-down.
   Include neon signs, 6 arcade cabinets, claw machine, ticket counter, gumball machines.
   Leave a clear walkable lane from the entrance to the counter.
   No characters. No text except simple signage shapes. Output as a single PNG backdrop.”

### 4.3 School hall backdrop (example prompt)
- “Create a cutaway school hallway interior, soft warm lighting, lockers, bulletin board,
   trophy case, and two doors. Leave a wide clear path through the center.
   Output as a single PNG with no characters.”

## 5. Acceptance checks before importing

For each generated asset:
- Is the background actually transparent where expected?
- Is the scale consistent with existing assets?
- Are edges clean enough for in-game compositing?
- Does it read well when downscaled to the game’s internal resolution?

## 6. Optional: “retro filter” toggle

If the team wants a more SNES-like presentation while keeping this art style:
- render world to a low-resolution `SubViewport`
- scale up with nearest-neighbor
- optionally apply a very mild posterize/palette shader (only if it improves readability)
