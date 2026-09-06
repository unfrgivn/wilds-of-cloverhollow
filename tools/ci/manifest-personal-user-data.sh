#!/usr/bin/env bash
set -euo pipefail

: "${1:?output manifest path required}"
output="$1"
: > "$output"

roots=(
  "$HOME/Library/Application Support/Godot/app_userdata/Wilds of Cloverhollow"
  "$HOME/.local/share/godot/app_userdata/Wilds of Cloverhollow"
)
if [[ -n "${XDG_DATA_HOME:-}" ]]; then
  roots+=("$XDG_DATA_HOME/godot/app_userdata/Wilds of Cloverhollow")
fi
for root in "${roots[@]}"; do
  if [[ -d "$root" ]]; then
    find "$root" -type f -print | LC_ALL=C sort | while IFS= read -r file; do
      shasum "$file"
    done >> "$output"
  fi
done
if [[ ! -s "$output" ]]; then
  printf '%s\n' EMPTY > "$output"
fi
