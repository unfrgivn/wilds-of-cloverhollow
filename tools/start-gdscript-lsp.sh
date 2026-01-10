#!/bin/bash
# Start the GDScript LSP server for opencode/editor integration
# This runs Godot's editor in headless mode with the LSP enabled on port 6005

PROJECT_PATH="${1:-$(pwd)}"
LSP_PORT="${2:-6005}"

echo "[GDScript LSP] Starting Godot editor in headless mode with LSP on port $LSP_PORT"
echo "[GDScript LSP] Project: $PROJECT_PATH"

# Check if Godot is available
if ! command -v godot &> /dev/null; then
    echo "[ERROR] Godot not found in PATH. Install Godot 4.5+ first."
    exit 1
fi

# Check if project.godot exists
if [ ! -f "$PROJECT_PATH/project.godot" ]; then
    echo "[ERROR] No project.godot found at $PROJECT_PATH"
    exit 1
fi

# Start Godot with LSP
exec godot --editor --headless --lsp-port "$LSP_PORT" --path "$PROJECT_PATH"
