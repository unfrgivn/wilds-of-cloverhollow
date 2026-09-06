#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$repo_root/captures/m224/repeatability"
first="$(mktemp -d "$repo_root/captures/m224/repeatability/headless.XXXXXX")"
second="$(mktemp -d "$repo_root/captures/m224/repeatability/headless.XXXXXX")"

CAPTURE_DIR="$first" SEED=224 QUIT_AFTER_FRAMES=180 "$repo_root/tools/ci/run-scenario.sh" readiness_harness_smoke >/dev/null
CAPTURE_DIR="$second" SEED=224 QUIT_AFTER_FRAMES=180 "$repo_root/tools/ci/run-scenario.sh" readiness_harness_smoke >/dev/null

python3 - "$first/trace.json" "$second/trace.json" <<'PY'
import json
import sys

def positions(path):
    trace = json.load(open(path, encoding="utf-8"))
    values = [(event.get("type"), event.get("position")) for event in trace["events"] if event.get("type") == "move_end"]
    if not values:
        raise SystemExit("repeatability trace has no move_end events")
    return values

if positions(sys.argv[1]) != positions(sys.argv[2]):
    raise SystemExit("headless intermediate movement positions differ")
PY

if [[ "${1:-}" == "--rendered" ]]; then
  first_rendered="$(mktemp -d "$repo_root/captures/m224/repeatability/rendered.XXXXXX")"
  second_rendered="$(mktemp -d "$repo_root/captures/m224/repeatability/rendered.XXXXXX")"
  CAPTURE_DIR="$first_rendered" SEED=224 QUIT_AFTER_FRAMES=180 "$repo_root/tools/ci/run-scenario-rendered.sh" readiness_harness_smoke >/dev/null
  CAPTURE_DIR="$second_rendered" SEED=224 QUIT_AFTER_FRAMES=180 "$repo_root/tools/ci/run-scenario-rendered.sh" readiness_harness_smoke >/dev/null
  first_png="$(find "$first_rendered" -name '*_action_execution.png' -type f -print -quit)"
  second_png="$(find "$second_rendered" -name '*_action_execution.png' -type f -print -quit)"
  if [[ -z "$first_png" || -z "$second_png" ]]; then
    echo "missing repeatability capture" >&2
    exit 1
  fi
  cmp "$first_png" "$second_png"
fi
echo "repeatability evidence passed"
