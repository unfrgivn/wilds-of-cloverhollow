#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
exec uv run --locked --project "$PROJECT_ROOT" python "$SCRIPT_DIR/quantize_to_palette.py" "$@"
