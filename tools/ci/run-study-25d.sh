#!/usr/bin/env bash
set -euo pipefail
SCENARIO_ID="${1:-study_25d_walk}"
case "$SCENARIO_ID" in study_25d_walk|study_25d_camera) ;; *) echo "[study] ERROR: unsupported study scenario: $SCENARIO_ID" >&2; exit 2 ;; esac
./tools/ci/import-study-25d.sh
export QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-2400}"
exec ./tools/ci/run-scenario.sh "$SCENARIO_ID"
