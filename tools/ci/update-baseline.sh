#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"
CAPTURE_DIR=""
REVIEWED=0
for argument in "$@"; do
  if [[ "$argument" == "--reviewed" ]]; then REVIEWED=1; elif [[ -z "$CAPTURE_DIR" && "$argument" != "$SCENARIO_ID" ]]; then CAPTURE_DIR="$argument"; fi
done

if [[ -z "$SCENARIO_ID" ]]; then
  echo "Usage: $0 <scenario_id> <capture_dir> --reviewed" >&2
  exit 2
fi
if (( REVIEWED == 0 )); then
  echo "ERROR: explicit --reviewed is required before copying baselines" >&2
  exit 1
fi
if [[ -z "$CAPTURE_DIR" ]]; then
  CAPTURE_DIR=$(find "captures/rendered/$SCENARIO_ID" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort | tail -1)
fi
if [[ -z "$CAPTURE_DIR" || ! -d "$CAPTURE_DIR" ]]; then
  echo "ERROR: capture directory not found" >&2
  exit 1
fi
if [[ ! -s "$CAPTURE_DIR/trace.json" || ! -s "$CAPTURE_DIR/run.log" ]]; then
  echo "ERROR: baseline source must include a successful trace.json and run.log" >&2
  exit 1
fi
if ! bun run tools/ci/visual-evidence.ts --validate-source "$SCENARIO_ID" "$CAPTURE_DIR"; then
  echo "ERROR: trace is invalid or belongs to another scenario" >&2
  exit 1
fi
if grep -qE '(^|: )ERROR:|SCRIPT ERROR:|Parse Error:' "$CAPTURE_DIR/run.log"; then
  echo "ERROR: baseline source log contains runtime errors" >&2
  exit 1
fi
if ! bun run tools/ci/validate-scenario.ts --trace "$CAPTURE_DIR/trace.json" --log "$CAPTURE_DIR/run.log" --captures "$CAPTURE_DIR" --rendered >/dev/null; then
  echo "ERROR: baseline source evidence did not pass scenario validation" >&2
  exit 1
fi
frames=()
while IFS= read -r frame; do frames+=("$frame"); done < <(find "$CAPTURE_DIR" -maxdepth 1 -type f -name '*.png' -print)
if (( ${#frames[@]} == 0 )); then
  echo "ERROR: baseline source has no PNG captures" >&2
  exit 1
fi

baseline_parent="$BASELINE_DIR"
mkdir -p "$baseline_parent"
staging=$(mktemp -d "$baseline_parent/.${SCENARIO_ID}.staging.XXXXXX")
trap 'rm -rf "$staging"' EXIT
for frame in "${frames[@]}"; do cp "$frame" "$staging/$(basename "$frame")"; done
cp "$CAPTURE_DIR/trace.json" "$staging/provenance.json"
target="$baseline_parent/$SCENARIO_ID"
backup="$baseline_parent/.${SCENARIO_ID}.backup.$$"
if [[ -d "$target" ]]; then mv "$target" "$backup"; fi
if ! mv "$staging" "$target"; then
  [[ -d "$backup" ]] && mv "$backup" "$target"
  exit 1
fi
rm -rf "$backup"
trap - EXIT
echo "Updated ${#frames[@]} baseline image(s) in $BASELINE_DIR/$SCENARIO_ID"
echo "Review the images before committing."
