# Visual Regression Testing

## Concept
Use capture checkpoints (PNG frames) and exact pixel comparisons against
reviewed baselines. The same engine, renderer, scenario inputs, timing, and
test state are prerequisites for a meaningful comparison. Inspect the rendered
images before accepting a baseline.

## Directory Structure

```
baselines/
└── visual/
    └── <scenario_id>/
        ├── overworld_initial.png
        ├── overworld_after_move.png
        └── ...

captures/
└── rendered/
    └── <scenario_id>/
        └── <timestamp>/
            ├── overworld_initial.png
            ├── overworld_after_move.png
            ├── trace.json
            └── diffs/           # Created by diff-visual.sh
```

## Golden Scenarios

Golden scenarios are marked with `"golden": true` in their JSON definition. They are designed to produce deterministic, reproducible captures for visual regression testing.

Current golden scenarios:
- `golden_overworld` - Overworld scene with player movement
- `golden_battle` - Battle scene with command menu
- `golden_dialogue` - Dialogue UI interaction

## Workflow

### Running a Golden Scenario

```bash
./tools/ci/run-scenario-rendered.sh golden_overworld
```

This runs the scenario with actual rendering (not headless) and saves captures to `captures/rendered/<scenario_id>/<timestamp>/`.

### Comparing Against Baselines

```bash
./tools/ci/diff-visual.sh golden_overworld
```

This compares the most recent capture against baselines in `baselines/visual/<scenario_id>/`. Outputs:
- `MATCH` - Frame matches baseline exactly
- `DIFF` - Frame differs from baseline (regression detected)
- `MISSING` - Frame exists in baseline but not in capture
- `NEW` - Frame exists in capture but not in baseline

### Updating Baselines

When intentionally changing visuals:

```bash
./tools/ci/run-scenario-rendered.sh golden_overworld
./tools/ci/update-baseline.sh golden_overworld <reviewed-capture-directory> --reviewed
git diff baselines/visual/golden_overworld/
git add baselines/visual/golden_overworld/
# Include the reviewed images in the current milestone commit.
```

## CI Integration

The CI workflow for visual regression:

1. Run all golden scenarios with rendered output
2. Diff against committed baselines
3. Fail if any diffs detected
4. Write highlighted diff PNGs and report match/failure details in command output.

`run-visual-regression.sh` uses the three golden scenarios above and delegates
to the same rendered scenario wrapper used locally. Linux uses `xvfb-run` when
available. Set `CAPTURE_DIR` to a fresh output root for each suite run.

The canonical baseline root is `baselines/visual`, not ignored
`captures/golden`. Missing or empty baselines, missing or extra captures,
dimension differences, invalid images, tool failures, and any changed pixel
fail comparison. No fuzz tolerance is applied.

Promotion requires `--reviewed`, a matching `scenario_id`, and successful
trace/log/capture validation. It replaces the exact frame set, including
removal of stale frames, and saves the source trace as `provenance.json`.
Use an explicit capture directory rather than relying on implicit selection.
The flag records a deliberate operation; it does not inspect images for you.

## Dialogue and UI review evidence

Previous visual approvals are not authoritative when exact dialogue text or
clipping is disputed. Require all of the following before promoting a UI
baseline:

1. Read the native PNG attachment, inspect the trace/log, and corroborate text
   with OCR where available.
2. Run `tools/agents/review-capture.ts` with an explicit output file and the
   current model from `opencode2 models` (default:
   `github-copilot/gemini-3.5-flash`).
3. Check the transcription and clipped-label findings against the image; a
   model's generic approval is not acceptance.

The wrapper isolates `opencode2 run` in a private temporary workspace with no
tools, delegation, or file permissions for its custom review agent. The legacy
built-in vision helper is disabled and must not be used as evidence. A model
availability error fails closed, with no fallback provider or fabricated text.

## Creating New Golden Scenarios

1. Create scenario JSON in `tests/scenarios/`:
   ```json
   {
     "scenario_id": "golden_new_feature",
     "description": "Golden capture for new feature",
     "golden": true,
     "actions": [
       { "type": "load_scene", "scene": "res://game/scenes/..." },
       { "type": "wait_frames", "frames": 30 },
       { "type": "capture", "label": "initial_state" },
       ...
     ]
   }
   ```

2. Run the scenario to generate initial captures
3. Review captures visually
4. Update baselines to commit as the expected output

## Troubleshooting

### Captures differ on different machines
Ensure consistent:
- Godot version
- Display scaling settings
- Same seed (if using RNG)

### No captures generated
Check that the scenario uses `"type": "capture"` actions and that the rendered runner is used (not headless).

### Baseline directory missing
Run `update-baseline.sh <scenario> <capture-directory> --reviewed` only after
inspecting a known-good capture. A missing baseline is a failure, not a pass.
