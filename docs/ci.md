# CI Notes

This repository template includes a minimal GitHub Actions workflow in:
- `.github/workflows/ci.yml`

The workflow is designed to be safe even before the Godot project exists:
- it runs a headless “smoke” boot when `project.godot` is present
- it runs test frameworks only when their expected files exist

## Recommended CI baseline (Godot 4.5)
- Install Godot via the `chickensoft-games/setup-godot` action.
- Run:
  - a headless smoke boot
  - GUT tests if configured

## What you must do
- Pin the Godot version to the project baseline (Godot **4.5.x**).
- Commit your chosen test framework under `addons/` (GUT or GdUnit4), or add an install step.
- Keep CI scripts in `tools/ci/` so the opencode agent can reuse them locally.

## Outputs
- Prefer producing a JUnit XML report for CI annotations.
- Upload test logs/reports as workflow artifacts.
