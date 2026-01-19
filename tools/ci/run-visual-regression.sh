#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-}"
if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(date +%Y%m%d_%H%M%S)"
fi

./tools/ci/run-golden-capture.sh "$RUN_ID"
./tools/ci/run-visual-diff.sh "$RUN_ID"
