# Godot MCP and agent workflow research

Research date: 2026-09-06. The shortlist records source/documentation findings;
the final section records the subsequent bounded runtime evaluation.

The source review below was followed by a bounded runtime evaluation. See the
evaluation section at the end for what was actually exercised and the limits
of that evidence.

## Recommendation

Evaluate **[satelliteoflove/godot-mcp](https://github.com/satelliteoflove/godot-mcp)**
at release `godot-mcp-v4.1.11` in a disposable project first. Its documented
Godot 4.5+ support, structured runtime observation, input, and deterministic
stepping fit Cloverhollow's Godot 4.5.1 development loop.

Evaluate **[Erodenn/godot-mcp-runtime](https://github.com/Erodenn/godot-mcp-runtime)**
as the alternative if avoiding a committed addon is important. Its temporary
project changes need crash-recovery and concurrent-edit testing before use in
this working tree.

Consider **[minimal-godot-mcp](https://github.com/ryanmazzolini/minimal-godot-mcp)**
for GDScript diagnostics. This fills a real gap: current OpenCode V2
[configuration documentation](https://opencode.ai/v2/docs/config) says `lsp`
settings are accepted but language servers are not started. Having
`godot-lsp-bridge` on PATH and in config therefore does not establish working
diagnostics in this client. The same documentation says `instructions` entries
are not yet loaded; active `AGENTS.md` and explicit skill reads remain important.

Do not install all three by default. First measure which feedback is missing
from direct file editing, headless Godot checks, and the Scenario Runner.

## Why the current local server should not remain enabled unchanged

The configured sibling checkout is `Coding-Solo/godot-mcp`:

| Snapshot | Commit | Date |
| --- | --- | --- |
| Local checkout | `90b907a472e343eb3807a49cb13f82e4c7b12731` | 2026-01-05 |
| Coding-Solo upstream main at audit | `1209744fad78f3998f98c7394fd0f6ef50da5281` | 2026-04-16 |

The upstream [security-related fix](https://github.com/Coding-Solo/godot-mcp/commit/1209744fad78f3998f98c7394fd0f6ef50da5281)
validates node class names and removes direct script-path loading from
`add_node`/`create_scene` operations. The local snapshot predates it. This is
reason for precautionary disablement, not evidence of exploitation.

Coding-Solo is not abandoned merely because this checkout is old. Updating it
could retain basic process/scene operations, but it does not provide the live
state/input/capture loop needed here. `satelliteoflove` is a different
integration architecture, not an in-place upgrade command for this checkout.

The local sibling repository also has an untracked `bun.lock`; it was not
modified or reset during this audit.

## Shortlist

Dates below refer to the latest source commits observed during research, not a
guarantee of ongoing support. Capability claims are from each project's docs.

| Candidate | Recency observed | Useful capabilities | Main tradeoff |
| --- | --- | --- | --- |
| [satelliteoflove/godot-mcp](https://github.com/satelliteoflove/godot-mcp) | Main 2026-08-31; release 4.1.11 dated 2026-08-27 | Runtime state, input, screenshots, freeze/step/step-until, tilemap/animation tools, read/write separation | Editor addon and game bridge; exact 4.5.1 behavior still needs testing |
| [Erodenn/godot-mcp-runtime](https://github.com/Erodenn/godot-mcp-runtime) | 2026-09-06 | Headless editing, runtime tree, UI discovery, input sequences, screenshots, attach mode | Transient autoload/project mutation; arbitrary script execution remains privileged |
| [Vollkorn-Games/godot-mcp](https://github.com/Vollkorn-Games/godot-mcp) | 2026-08-09 | Broad editor/runtime tools, batched input/state/capture sequences, GUT integration | Larger tool surface, temporary autoload/TCP bridge, exact client/engine compatibility untested |
| [minimal-godot-mcp](https://github.com/ryanmazzolini/minimal-godot-mcp) | 2026-07-18 | Native LSP diagnostics and DAP console output, no addon | Needs an open Godot editor and Node 22+; not a playtesting server |
| [beckettlab/beckett-godot-mcp](https://github.com/beckettlab/beckett-godot-mcp) | 2026-09-01 | Embedded server, reflection, runtime observation/capture, local access controls | Lite does not include the paid input/assertion/test layer |
| [letsagents/godot-mcp](https://github.com/letsagents/godot-mcp) | 2026-08-24 | Runtime debugger, breakpoints, state, input, screenshots | Small project; debugger compatibility notes focus on newer Godot versions |

### Canonical repository correction

`freema/godot-mcp` is a fork of `satelliteoflove/godot-mcp`, not the best current
installation target. The fork was still at 4.0.1 from June 14. Its README points
to the canonical package, `@satelliteoflove/godot-mcp`. Use the canonical
[4.1.11 package manifest](https://github.com/satelliteoflove/godot-mcp/blob/godot-mcp-v4.1.11/server/package.json)
and release rather than copying a fork's installation instructions blindly.

### Test evidence is narrower than feature claims

The canonical [CI workflow](https://github.com/satelliteoflove/godot-mcp/blob/godot-mcp-v4.1.11/.github/workflows/ci.yml)
runs the build, coverage tests, and stdio protocol smoke tests. It does not
establish full Godot-engine integration coverage. Its separate
[agent evaluation harness](https://github.com/satelliteoflove/godot-mcp/tree/main/server/evals)
requires an already-open editor and an authenticated Claude setup, and is not
wired into that CI workflow. Treat exact Godot 4.5.1 runtime compatibility as an
acceptance test, not a proven fact from a badge.

## Other game-building and artwork options

- **[GDAI MCP](https://gdaimcp.com/):** commercial editor plugin. The public
  [repository](https://github.com/3ddelano/gdai-mcp-plugin-godot) does not expose
  the full implementation. Worth considering only if a paid proprietary
  workflow is wanted, not a default dependency here.
- **[Summer Engine](https://github.com/SummerEngine/summer-engine-agent):**
  integrated CLI, MCP, skills, diagnostics, and asset-generation workflow. Its
  agent layer is MIT, but the engine application is separately licensed and
  proprietary. It requires a custom engine and sign-in. This is a platform
  migration, not a stock-Godot tooling upgrade.
- **[Aseprite MCP](https://github.com/diivi/aseprite-mcp):** potentially useful
  for pixel-art authoring, animation, palette work, and sheet export. It requires
  Aseprite and a separate tool setup. Keep it optional; a drawing tool does not
  replace palette, alpha, size, animation, and in-scene readability checks.
- **Official Godot tooling:** the engine provides CLI, editor, LSP, and debugger
  interfaces. Community MCP entries in the Godot Asset Library are not evidence
  of first-party endorsement. Research did not identify a first-party Godot
  Foundation MCP server.

## Adoption gate

No replacement package was installed or executed in the main project during
this research. Before adopting one:

1. Pin a reviewed release/commit and confirm the dependency/addon fit.
2. Use a disposable project without secrets, not this dirty working tree.
3. Verify the exact Godot 4.5.1 binary and OpenCode MCP handshake.
4. Start read-only. Inspect live player position, scene tree, and properties.
5. Separately allow bounded in-engine input/stepping, then verify movement,
   collision, progression state, and a captured frame.
6. Keep arbitrary GDScript/eval, method calls, and filesystem/export mutation
   denied unless a task specifically needs them. Static analysis and loopback
   listeners do not make execution a sandbox.
7. Test stop, crash, restart, port cleanup, concurrent edits, and unchanged
   project settings. Exclude development bridges from production exports.
8. Allow only one agent to own the interactive editor bridge. Other agents can
   edit independent files or inspect artifacts without competing for its client.
9. Convert discoveries into committed Scenario Runner assertions and captures.
   Keep that reproducible harness as the regression authority.

For this shared repository, an explicit reviewed addon is easier to audit than
an untested promise to restore `project.godot` after shutdown. That preference
does not by itself make either candidate secure or compatible.

## Bounded runtime evaluation

The pinned 4.1.11 source at
`345aba8b86cc94daec3577b04df31b0c5f9c2b3b` was built and tested in an external,
disposable fixture using Godot 4.5.1. The repository's server suite reported
633 passing tests and seven skips; its stdio protocol test passed.

The fixture demonstrated:
- Matching 4.1.11 server/addon versions and a live editor connection.
- Read-only mode exposing observation tools and rejecting `godot_node_edit`.
- Frozen game launch, bounded stepping, named movement input, and a progression
  change from an input event without `godot_exec`.
- Structured runtime state, a captured frame, and clean process/port shutdown.

The parent session independently repeated the read-only rejection and runtime
calls. Artifacts are under `captures/m227/independent/`. Both runs moved the
player and incremented progression, but the same duration-based movement ended
at x=154 versus x=156. Do not claim tick-perfect replay from this evidence.
The MCP's resized screenshot was 512x287, so it is also not a replacement for
native 512x288 Scenario Runner golden captures.

The original source lock had nine production audit findings, six high severity,
in transitive MCP SDK dependencies. The evaluated application uses stdio and
an outbound WebSocket, not the affected inbound HTTP adapters. That limits
reachability; it does not make the dependency graph security-clean. Full audit
records are in `captures/m227/audit-production.json` and `audit-all.json`.

### Adoption boundary

Code review found that the addon persists project settings/autoload changes and
does not remove all of them on plugin shutdown. Therefore, use a physical
development snapshot with private import cache and user data, never an addon
installed into the canonical game or a symlinked copy of its files. Refresh the
snapshot explicitly after source edits. Do not copy changes back automatically
or export from the snapshot.

A small consumer package with an exact server version and freshly resolved
lockfile is preferable to importing the upstream development lock. Audit that
resolved runtime graph and retest the published artifact. Expose only reviewed
observation tools in OpenCode; keep script execution and mutation denied.
