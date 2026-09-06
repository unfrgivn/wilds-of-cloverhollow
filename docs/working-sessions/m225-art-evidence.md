# Milestone 225: art validation and visual evidence

Completed 2026-09-06.

## Pipeline

- Locked Pillow 12.3.0/uv tools now validate nested palette unions, transparent
  pixels, explicit sprite sizes, safe quantization, and deterministic packing.
- Six art tests exercise real PNGs, malformed palettes, alpha, dimensions,
  filenames with spaces, source protection, and output collision handling.
- Seven visual tests cover exact pixels/dimensions, missing/extra/empty images,
  invalid data, and reviewed baseline promotion with preservation on failure.
- Four capture-review tests cover arguments, PNG headers, and safe output paths.
- `just validate-assets` covers selected samples only. It is not an audit of
  every existing sprite.

## Presentation repairs

The first candidate review found actual defects, rather than a reason to bless
the old screenshots. Goldens now capture the real town instead of a gray test
fixture. Town camera limits frame its 512x288 area. Battle labels are in proper
containers; all six party rows and all five commands fit, and status, turn
information, log, and menu occupy separate bands.

The golden dialogue is a controlled visual fixture, not proof of completing a
dialogue quest. The golden battle is the initial HUD state, not proof of an
attack or victory.

## Verified visual review path

An earlier specialist response quoted text absent from the image. That response
was rejected. The bundled vision tool also selected an unavailable model.

The replacement workflow attaches the actual PNG through OpenCode's file
interface in a private tool-denied session. Its dialogue transcription matched
local OCR: “The path divides beneath the old oak.”, “Follow the lanterns.”,
and “Return to town.” An enlarged tile-sheet check correctly found no text.

Final battle review transcribed Slime, HP 15/15, all six party entries, the full
turn order, and Attack/Skill/Item/Defend/Run. It confirmed the UI bands no longer
overlap. These observations were corroborated by runtime rectangle assertions
and OCR, not accepted from the model's approval alone.

Review evidence is under `captures/m225/independent/`, especially
`accepted-battle-review.txt`, `revised-dialogue-review.txt`, and
`revised-overworld-review.txt`.

## Baselines

Promoted after review:

- `golden_overworld`: candidate run7, frame 0033.
- `golden_dialogue`: candidate run7, frame 0065.
- `golden_battle`: candidate run9, frame 0034.

Each has an independently generated matching repeat frame. The reviewed profile
is Godot 4.5.1, Forward+, Metal 3.2, Apple M2, native 512x288, seed 225. These are
initial prototype baselines, not certification of finished artwork or of exact
cross-GPU rendering.

Known remaining artwork issues include baked checkerboard/opaque backgrounds
on legacy town facades and placeholder battle scenery. M226 replaces the town
facade references with the prepared palette-normalized transparent set and
integrates the new park terrain and Fae directions.

## Final independent gates

All passed: `just smoke`, `just tests`, `just spec-check`, headless and rendered
`golden_overworld`, `just visual-regression`, `just art-tests`, and the eleven
Bun visual/review-tool tests. Results and logs are in
`captures/m225/final-acceptance/`.

The full golden suite also passed with the Dummy audio driver, keeping rendered
CI independent of audio hardware. Headless test isolation and existing gameplay
state assertions remain in force.

A promotion test exposed a Bun piped-descriptor failure after successful file
promotion. Its test harness now captures the real child status and output in
files, retaining the success, exact-frame-set, and provenance assertions. Both
test orders passed repeatedly; no production failure was waived.

CI installs ImageMagick explicitly and the comparison tool supports both its
v7 `magick` entry point and v6 `identify`/`compare` binaries. Cross-GPU visual
results must still be inspected if CI reports a difference.
