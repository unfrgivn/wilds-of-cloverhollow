#!/usr/bin/env bash
set -euo pipefail

: "${GODOT_BIN:=godot}"
: "${GODOT_ISOLATION_ROOT:?GODOT_ISOLATION_ROOT must be set}"

mkdir -p "$GODOT_ISOLATION_ROOT"
run_root="$(cd "$GODOT_ISOLATION_ROOT" && pwd)"
mkdir -p "$run_root/home" "$run_root/data" "$run_root/config" "$run_root/cache"

export HOME="$run_root/home"
export XDG_DATA_HOME="$run_root/data"
export XDG_CONFIG_HOME="$run_root/config"
export XDG_CACHE_HOME="$run_root/cache"

exec "$GODOT_BIN" --path . --audio-driver Dummy --fixed-fps 60 "$@"
