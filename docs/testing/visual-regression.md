# Visual regression

## Concept
Use deterministic capture checkpoints (PNG frames) and diff them against baselines.

## Why
This catches UI/layout regressions and rendering drift without manual playtesting.

## Files
- `baselines/visual/<scenario_id>/frames/*.png`
- `captures/golden/<scenario_id>/<run_id>/frames/*.png`
- `reports/visual-diff/<scenario_id>/<run_id>/index.html`

## Workflow
1. Run golden capture.
2. Diff frames.
3. Only update baselines intentionally.
