# Visual regression

Primary strategy:
- Deterministic movie capture from scripted scenarios

Secondary strategy:
- Checkpoint screenshots (only if capture is stable across GPUs)

Baseline storage:
- `tests/visual-baselines/<scenario_id>/movie/*.png`

Workflow:
- `./tools/ci/run-golden-capture.sh <run_id>`
- `./tools/ci/update-visual-baseline.sh <run_id>`
- `./tools/ci/run-visual-diff.sh <run_id>`
- `./tools/ci/run-visual-regression.sh <run_id>`

Reports:
- `reports/visual-diff/<run_id>/index.html`

Adding a golden scenario:
- Create `tests/scenarios/<id>.json` and ensure it runs headlessly
- Add `<id>` to `SCENARIOS` in `tools/ci/run-golden-capture.sh` and `tools/ci/update-visual-baseline.sh`
- Capture + update baselines, then run visual diff
