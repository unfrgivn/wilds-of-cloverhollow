#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if ! command -v bun >/dev/null 2>&1; then
  echo "[tests] ERROR: Bun is required to run tests and evidence validation. Install Bun or set PATH." >&2
  exit 1
fi
bun test "$repo_root/tests/ci-validator.test.ts"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-120}" \
  "$repo_root/tools/ci/run-scenario.sh" input_debouncer_probe
"$repo_root/tests/test_ci_harness.sh"
"$repo_root/tests/test_repeatability.sh"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-180}" \
  "$repo_root/tools/ci/run-scenario.sh" readiness_harness_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-120}" \
  "$repo_root/tools/ci/run-scenario.sh" intro_boot_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-180}" \
  "$repo_root/tools/ci/run-scenario.sh" isolation_save_roundtrip_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-400}" \
  "$repo_root/tools/ci/run-scenario.sh" player_eight_direction_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-2400}" \
  "$repo_root/tools/ci/run-scenario.sh" town_forest_route_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-3000}" \
  "$repo_root/tools/ci/run-scenario.sh" route_boundaries_smoke
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-600}" \
  "$repo_root/tools/ci/run-scenario.sh" park_pond_collision_smoke
echo "[tests] PASS"
