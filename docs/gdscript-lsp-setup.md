# GDScript LSP Setup for OpenCode

This document explains how to enable GDScript language server support for the Cloverhollow project.

## Overview

Godot 4.5 includes a built-in Language Server Protocol (LSP) server that provides:
- Code completion
- Go-to-definition
- Find references
- Diagnostics (errors/warnings)
- Hover information

The LSP runs as part of the Godot editor and communicates over TCP (default port 6005).

## Setup

### 1. Install the LSP Bridge

The `opencode-godot-lsp` package bridges Godot's TCP-based LSP to stdio for tools like opencode:

```bash
npm install -g opencode-godot-lsp
```

### 2. Start the Godot LSP Server

Run Godot's editor in headless mode with LSP enabled:

```bash
# Using the provided script:
./tools/start-gdscript-lsp.sh

# Or manually:
godot --editor --headless --lsp-port 6005 --path /path/to/project
```

For persistent background operation, use tmux:

```bash
tmux new-session -d -s godot-lsp "godot --editor --headless --lsp-port 6005 --path $(pwd)"
```

### 3. Configure opencode.json

Add the LSP configuration to your project's `opencode.json`:

```json
{
  "lsp": {
    "gdscript": {
      "command": ["godot-lsp-bridge"],
      "extensions": [".gd", ".gdshader"]
    }
  }
}
```

### 4. Restart opencode session

After adding the config, restart your opencode session to pick up the new LSP configuration.

## Usage

Once configured, you can use LSP features on `.gd` files:

```bash
# Check for errors
lsp_diagnostics scripts/autoloads/GameState.gd

# Get type info at a position
lsp_hover scripts/Player.gd 15 10

# Find definition
lsp_goto_definition scripts/Main.gd 20 5

# Find all references
lsp_find_references scripts/autoloads/GameState.gd 25 10
```

## Troubleshooting

### "No LSP server configured for extension: .gd"

1. Ensure `opencode.json` has the LSP config
2. Restart the opencode session
3. Make sure the Godot LSP server is running (`tmux attach -t godot-lsp`)

### LSP bridge can't connect

1. Check if Godot is running: `ps aux | grep "godot.*lsp"`
2. Verify the port: `lsof -i :6005`
3. Restart the Godot LSP server

### Slow or missing completions

The headless editor may take a few seconds to fully initialize. Wait ~5 seconds after starting before using LSP features.

## Session Startup

For agents working on this project, add this to your session startup:

```bash
# Start Godot LSP if not running
if ! pgrep -f "godot.*lsp-port" > /dev/null; then
    tmux new-session -d -s omo-godot-lsp "godot --editor --headless --lsp-port 6005 --path $(pwd)"
    sleep 3  # Wait for initialization
fi
```
