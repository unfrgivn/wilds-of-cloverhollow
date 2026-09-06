#!/usr/bin/env bash
set -euo pipefail

./tools/ci/import-study-25d.sh
mkdir -p captures/study-play
play_root="$(mktemp -d "captures/study-play/run.XXXXXX")"
echo "[study-play] isolation_root=$play_root"
exec env GODOT_ISOLATION_ROOT="$play_root/runtime" ./tools/ci/run-godot-isolated.sh res://game/scenes/studies/Park3DStudy.tscn
