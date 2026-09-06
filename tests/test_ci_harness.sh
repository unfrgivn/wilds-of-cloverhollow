#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
capture_dir="$(mktemp -d "${TMPDIR:-/tmp}/cloverhollow-ci.XXXXXX")"
trap 'rm -rf "$capture_dir"' EXIT

missing_capture="$capture_dir/missing"
if CAPTURE_DIR="$missing_capture" QUIT_AFTER_FRAMES=2 \
  "$repo_root/tools/ci/run-scenario.sh" definitely_missing_scenario >/dev/null 2>&1; then
  echo "missing scenarios must fail" >&2
  exit 1
fi
python3 - "$missing_capture/trace.json" <<'PY'
import json
import sys

trace = json.load(open(sys.argv[1], encoding="utf-8"))
expected = "Scenario file not found: res://tests/scenarios/definitely_missing_scenario.json"
if expected not in trace.get("errors", []) or trace.get("passed") is not False:
    raise SystemExit("missing scenario did not produce the exact failed trace")
PY

echo "ci harness regression tests passed"
