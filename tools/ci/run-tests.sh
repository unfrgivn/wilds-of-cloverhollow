#!/usr/bin/env bash
set -euo pipefail

# Run headless unit/integration tests.

./tools/ci/run-smoke.sh
./tools/ci/run-asset-check.sh

GODOT_DISABLE_LEAK_CHECKS=1 godot --headless --path . -s res://addons/gut/gut_cmdln.gd -- -gdir=res://game/tests -ginclude_subdirs -gexit
