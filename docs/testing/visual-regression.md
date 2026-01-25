# Visual Regression Testing

## Concept
Use deterministic capture checkpoints (PNG frames) and diff them against baselines to catch UI/layout regressions and rendering drift without manual playtesting.

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
./tools/ci/update-baseline.sh golden_overworld
git diff baselines/visual/golden_overworld/
git add baselines/visual/golden_overworld/
git commit -m "Update golden_overworld baselines for [reason]"
```

## CI Integration

The CI workflow for visual regression:

1. Run all golden scenarios with rendered output
2. Diff against committed baselines
3. Fail if any diffs detected
4. Generate diff report with highlighted differences

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
Run `update-baseline.sh` to create the baseline from a known-good capture.
