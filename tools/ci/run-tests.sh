#!/bin/bash
set -e

echo "--- 1. Headless Smoke Test (Project Load) ---"
godot --headless --path . --quit
if [ $? -eq 0 ]; then
    echo "✅ Smoke test passed."
else
    echo "❌ Smoke test failed."
    exit 1
fi

echo "--- 2. Running GUT Tests ---"
godot --headless --path . -s addons/gut/gut_cmdln.gd
