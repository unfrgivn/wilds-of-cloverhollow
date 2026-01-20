#!/usr/bin/env bash
set -euo pipefail

python3 tools/python/validate_assets.py --all --check-missing
