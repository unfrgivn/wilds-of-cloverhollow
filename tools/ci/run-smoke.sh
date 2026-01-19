#!/usr/bin/env bash
set -euo pipefail

# Headless smoke boot.
# Requires: Godot CLI available as `godot`.

godot --headless --path . --quit
