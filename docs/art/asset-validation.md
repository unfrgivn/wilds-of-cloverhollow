# Asset validation

All exported assets should be validated by scripts in `tools/python/`.

## Examples
- sprite frame dimensions consistent
- file naming matches convention
- alpha channel present
- palette compliance within tolerance
- triangle budgets for props

## Run the checks
- `./tools/ci/run-asset-check.sh`
- `python3 tools/python/validate_assets.py --all --check-missing`
