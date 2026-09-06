# Verified pixel-art tools

Use these tools for changed assets, then inspect those assets in a rendered
Scenario Runner capture. Palette and dimension checks cannot judge a sprite's
silhouette, animation, or readability in the game.

## Environment

The Python tools use `uv`, `pyproject.toml`, and `uv.lock`. The only project
dependency is Pillow, pinned to 12.3.0. Shell wrappers run the locked environment
from the repository root; they do not depend on a global Pillow installation.

Pillow 12.3.0 supports the project's Python 3.11+ requirement. The pin was checked
against the [official release notes](https://pillow.readthedocs.io/en/stable/releasenotes/12.3.0.html),
then exercised by the art tests. Do not restore the old 10.4.0 pin merely because
it happened to be installed on one machine.

```bash
just art-tests
just validate-assets
```

`validate-assets` checks the selected bench samples listed in the justfile. It
does not certify the entire runtime asset tree. Validate every changed asset
explicitly until a complete asset manifest exists.

## Validate dimensions, transparency, and colors

```bash
./tools/art/validate_sprite.sh game/assets/sprites/props/bench.png \
  --biome cloverhollow --size 16x16

./tools/art/validate_sprite.sh path/to/character.png \
  --palette art/palettes/cloverhollow.palette.json \
  --palette art/palettes/global_ui_skin.palette.json \
  --size 16x24
```

- `--biome` includes the shared global UI/skin palette automatically.
- Repeated `--palette` options form a union.
- Palette objects must have a `colors` object or list; nested categories are
  supported. Top-level color lists also work.
- Only `#RRGGBB` leaves are accepted. Metadata and `legacy_flat` do not add colors.
- Fully transparent pixels are ignored for color validation. Any pixel with
  nonzero alpha must use an allowed RGB color.
- Use each asset's actual size. A 16x16 tile grid does not make a 16x24 character
  invalid. `--grid` is an optional extra alignment check, not the sprite default.

## Normalize without replacing source art

```bash
./tools/art/quantize_to_palette.sh art/source/new-prop.png \
  art/palettes/cloverhollow.palette.json captures/art/new-prop-normalized.png \
  --palette art/palettes/global_ui_skin.palette.json
```

Input, primary palette, and a separate output are mandatory. Additional palettes
can be appended. The tool chooses the nearest RGB color without dithering and
preserves alpha. Existing outputs require `--force`; the input cannot be the
output, even with that flag.

Review the normalized output before copying it into `game/assets/`. Record the
source, palette files, size, command, and destination in the asset's recipe.
`just quantize-assets` intentionally performs no blanket mutation.

## Attachment-based visual review

Do not trust prior visual approvals or model-produced dialogue transcriptions.
For dialogue/UI claims, corroborate the trace and diff with OCR, then run the
isolated reviewer only on the attached PNG:

```bash
bun run tools/agents/review-capture.ts \
  captures/rendered/golden_dialogue/dialogue.png \
  "Transcribe prompt and choices exactly" \
  --model "github-copilot/gemini-3.5-flash" \
  --output captures/review/golden_dialogue.txt
```

The wrapper uses a clean private temporary OpenCode 2 workspace, a custom
`capture-review` agent with all permissions denied, and the real `opencode2 run
--agent ... --file ...` attachment path. The model is configurable through
`--model` or `GODOT_VISION_MODEL`; the tested default is
`github-copilot/gemini-3.5-flash`. A missing model or failed invocation is an
error, never a fallback approval. The output path is required and is never
overwritten. The legacy built-in vision helper is disabled and is not evidence.
Use `opencode2 models` when the model catalog changes.

## Pack animation frames

```bash
./tools/art/pack_spritesheet.sh "art/source/walk frames" \
  "captures/art/walk-sheet.png" --cols 4
```

Frames are sorted by filename and must have equal dimensions. Use zero-padded
names when their numeric order matters. Empty directories, dimension mismatches,
source/output collisions, and existing output or metadata fail safely.

The PNG has transparent padding for unused cells. Its sibling JSON contains a
`frames` list with each source filename and its `x`, `y`, `width`, and `height`.
The packer does not infer facing direction or animation timing. Record the
eight-direction ordering and frame durations in the recipe/runtime resource.

## Acceptance loop

1. Read `spec.md`, `style-lock.md`, and `concept-reference.md`.
2. Generate or edit one small asset set at native pixel scale.
3. Run the relevant art tests and explicit palette/size validation.
4. Import with Godot and run the affected scenario.
5. Inspect the full 512x288 composition and a nearest-neighbor sprite enlargement.
6. Compare against reviewed baselines. Update only the baselines whose intended
   visual changes you have inspected.

Cloud image generation and Aseprite are optional authoring choices, not required
steps. Do not hide failures by expanding palettes or recoloring the whole game.
