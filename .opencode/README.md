# Project-local OpenCode readiness

This project keeps its V1-compatible layout while using V2-compatible
frontmatter and configuration fields:

- `agent/`: project subagent definitions
- `command/`: slash-command prompt templates
- `skill/`: reusable playbooks, explicitly registered by `opencode.json`
- `tool/`: existing optional tools, not a readiness requirement
- `mcp/`: the pinned DEV-only satelliteoflove consumer package

The old Coding-Solo-era local server at
`/Users/bash/Sites/unfrgivn/godot-mcp/build/index.js` is disabled pending
isolated exact-Godot-4.5.1 security testing. The checked project copy is at
old HEAD `90b907a`, before upstream security fix `1209744` (prevent arbitrary
GDScript instantiation via `add_node`/`create_scene`). Its `godot_*` tools and the legacy
`image_*` tool family are denied by ordered V2 permission rules. The existing
`godot-lsp-bridge` setting remains for compatibility, but V2 accepts `lsp`
settings without starting language servers. A configured bridge is therefore
not active diagnostics. Compare replacement MCP/runtime candidates separately;
do not assume Scenario Runner requires MCP.

The durable DEV-only `satellite` server uses the locally installed exact
`@satelliteoflove/godot-mcp@4.1.11` CLI in read-only mode. Its permissions deny
every `satellite_*` tool first, then allow only project, node, editor,
runtime-state, and docs read tools. Scene/node/resource writes, `godot_exec`,
input, and generic control remain unavailable to the agent. It is useful only
after `tools/agents/godot_agent_environment.py start` launches the disposable
snapshot editor. It must never be pointed at the main project.

See `docs/testing/godot-agent-environment.md` for the snapshot manifest,
refresh, lifecycle, port ownership, and cleanup contract.

## Readiness contract

For behavior, use real `move`/`press` actions and inspect `run.log`,
`trace.json`, `passed`, errors/noop events, expected events, and completion. For
visual work, run the rendered wrapper and read every PNG with image reading or
vision. `check_*` actions are log observations, not assertions. Never use
OS-level window automation.

Fail closed on missing traces/captures, unsupported actions, tool errors, or
ambiguous results. For art, use the locked `uv`/Pillow tools described in
`docs/art/verified-pipeline.md`: nested `.colors` palettes and repeated unions,
transparent-RGB handling, explicit asset sizes, safe quantization output, and
sorted same-sized packing with metadata/source-collision guards are implemented.
Validate every changed asset explicitly; `just validate-assets` checks only two
selected bench samples and is not full-tree certification. Image generation is
optional and must not be auto-run, paid, or supplied API keys.
The M226 park terrain source pass is accepted as an art first pass only; it is
not gameplay-integrated and must not be reported as finished game art.

## Useful entrypoints

- `/godot-readiness [scenario-id-or-area]`
- `/next-milestone [milestone-id-or-title]`
- `/spec-check`
- `/capture-golden <scenario-id>`

The readiness skill evals live in `evals/skills-readiness.json`. They are static
and workflow evidence criteria only; they are not behavioral eval results.
