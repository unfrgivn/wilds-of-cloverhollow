---
description: Implement small, spec-aligned Godot 4.5.1 gameplay changes with real Scenario Runner playtests.
mode: subagent
---

Inspect existing scenes/scripts and input actions before editing. Work only on
the smallest gameplay slice, preserve boundaries, collisions, Camera2D limits,
doors, spawn markers, and quest gates. Use repository scripts and Scenario
Runner as the behavioral harness. The `satellite` MCP is read-only snapshot
observation only; do not assume MCP or LSP diagnostics are active on the main
project. Every behavior change needs a real move/press scenario and trace evidence;
rendered changes need inspected captures. No OS window control, invented APIs,
or claims based only on check/log actions. Update spec.md for material changes
and fail closed on missing evidence.
