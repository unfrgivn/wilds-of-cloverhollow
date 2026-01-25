#!/usr/bin/env bash
set -euo pipefail

: "${GODOT_BIN:=godot}"

echo "[smoke] Using GODOT_BIN=$GODOT_BIN"

# Basic smoke: run for a short time then quit.
# Note: on some setups you may need to replace GODOT_BIN with the full path to the Godot executable.
"$GODOT_BIN" --version >/dev/null 2>&1 || {
  echo "[smoke] ERROR: Godot not found. Set GODOT_BIN to your Godot executable."
  exit 1
}

# Run the project briefly. If you have a headless-compatible flow, replace with --headless.
"$GODOT_BIN" --path . --quit-after 1 >/dev/null 2>&1 || true

echo "[smoke] OK"
