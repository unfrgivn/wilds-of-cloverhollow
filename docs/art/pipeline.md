# Art pipeline

The scripts are Bun-only and use the installed ImageMagick 7 `magick` command.
Run commands from the repository root. Generated scratch files stay in
`art/scratch/`; only selected source and review/runtime outputs are kept.

```sh
# 1. Generate an image, with zero or more concept references.
GEMINI_API_KEY=... bun tools/art/gemini-image.ts \
  --model gemini-3-pro-image --aspect-ratio 1:1 --image-size 2K \
  --prompt "..." --ref docs/art/concepts/characters/character_concept_sheet_fae.png

# 2. Segment a generated strip by connected components, retaining each figure's
# full alpha bounding box and masking other components. This avoids equal-width
# or thresholded column crops and neighbor bleed.
bun tools/art/extract-strip.ts --input art/scratch/walk-strip.png \
  --output art/scratch/strip-frames --key '#00FF00' --fuzz 18% --expected 6
# If connected components return fewer frames, the script may split the widest
# component only at its deepest alpha-column valley when that column has at
# most 6 opaque pixels. Otherwise it fails and the operator must regenerate
# with more spacing. It fails if six are not found and never cuts through a
# component's artwork.
# For a difficult back walk, prefer two three-frame strips with wide gutters.
# Extract each with --expected 3, then concatenate the extracted frames in
# contact, down, passing, contact, down, passing order.

# 3. Key, despill, erode the alpha rim, trim, scale to 280 source px, and align
# feet to row 375 on the fixed 384x384 canvas.
bun tools/art/postprocess.ts --input art/scratch/source.png \
  --output art/scratch/fae-frame.png --width 384 --height 384 \
  --figure-height 280 --bottom-margin 8 --fuzz 18% --key '#00FF00'
# For concept sheets with paper rather than green, add --key '#F5F1E0'.
# Keep selected raw model/strip outputs in art/source/<character>/.
# Run clean-alpha.ts on each finished frame to remove disconnected islands.
# Do not resize frames horizontally to satisfy a metric. If proportions do not
# match the canonical idle, regenerate the strip.

# Maddie uses a 256x256 canvas, --bottom-margin 8, and --baseline 247. Choose
# one uniform source scale from the shared model-sheet standing anchor, measure
# that anchor in every source, and record each factor. Never upscale a source.
# Do not use separate standing and seated pose-height targets; seated height
# changes naturally from posture.
# Generate quadruped walks as two three-frame strips per direction when needed:
# contact, down, passing, then contact, down, passing. Diagonal leg pairs
# alternate and the tail sways. Validate Maddie with the mandatory validator;
# no check-disabling flags exist.
# Side-facing alpha heuristics are not reliable with a raised tail, so the
# contact sheet must stamp the expected facing arrows for Maddie's rows.

# 4. Put fixed-size frames in art/scratch/fae-frames/.
# Names are down_walk_01.png, up_idle_01.png, left_walk_06.png, etc.
bun tools/art/pack-atlas.ts --input art/scratch/fae-frames \
  --output public/assets/characters/fae/fae.png \
  --json public/assets/characters/fae/fae.json --width 384 --height 384 \
  --columns 5 --baseline 375

# 5. Make the owner-review image on cream and dark backgrounds, including the
# 0.56x phone row.
bun tools/art/contact-sheet.ts --input art/scratch/fae-frames \
  --output art/review/fae-contact-sheet.png --frame-width 384 --frame-height 384

# 6. Review motion at about 10 fps.
for direction in down up left; do
  magick -delay 10 -loop 0 art/scratch/fae-frames/${direction}_walk_*.png \
    -background '#F5F1E0' -alpha remove -alpha off \
    art/review/fae-walk-${direction}.gif
done
magick -delay 10 -loop 0 art/scratch/fae-frames/left_walk_*.png -flop \
  -background '#F5F1E0' -alpha remove -alpha off art/review/fae-walk-right.gif

# 7. Run objective acceptance checks.
bun tools/art/validate-sprite.ts \
  --atlas public/assets/characters/fae/fae.png \
  --json public/assets/characters/fae/fae.json
```

The API script sends the key only as `x-goog-api-key`, never logs it, and appends
one JSON line to `art/scratch/generation-log.jsonl` for every call, including
failed calls.

Runtime keeps only `fae.png` and `fae.json`. Extracted frames live in
`art/scratch/` and review images in `art/review/`; both are regenerable and not
committed. The atlas uses five columns, 384x384 source frames, a feet baseline
at row 375, and anchor `{x: 0.5, y: 375/384}` in PixiJS v8 JSON. Right is
omitted because the runtime mirrors the left set.

`validate-sprite.ts` checks edges, connected components, green spill, baseline,
exact animation names and counts with no unused or duplicate frames, walk area
ratio at most 1.20, idle area ratio 0.70-1.40, blockiness at most 0.08, and
down/up walk mirror IoU at least 0.70. Ink-aware hard-straight crop cuts are
mandatory. Biped-only head checks are enabled by the recipe.
There are no CLI switches that disable checks.
