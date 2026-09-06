# DEV-only Godot agent environment

This is the controlled environment for the pinned
`@satelliteoflove/godot-mcp@4.1.11` server. It is not a game runtime
dependency and is never installed into the main Godot project.

## First-time package setup

The package is intentionally local and has no globally installed CLI:

```bash
cd .opencode/mcp/satelliteoflove
npm ci --ignore-scripts
npm audit --omit=dev --json
```

The lockfile must resolve exactly `4.1.11`, with zero production audit findings
before the snapshot lifecycle is used.

## Safety contract

- Source is pinned to commit `345aba8b86cc94daec3577b04df31b0c5f9c2b3b`.
- The addon is installed and enabled only in a physical snapshot outside the
  repository, never through a symlink or hardlink.
- Snapshot contents are limited to `project.godot`, `game/`,
  `tests/scenarios/`, and an explicitly referenced root icon.
- Hidden files (including `.env` and `.godot`) are excluded. Root dependency,
  Git, capture, and override paths are not selected. Keep credentials out of
  the copied game/data tree; this is not a content-based secret scanner.
- A manifest records the source revision, dirty-content hash, and SHA-256 for
  every copied file. Refresh is explicit and never syncs changes back.
- `GODOT_HOST` is fixed to `127.0.0.1`; port `6550` must be free before start.
- The lifecycle helper kills only an editor process whose command line contains
  the recorded snapshot path. It never kills an unrelated port owner.
- The OpenCode `satellite` server starts with `--read-only`. Permissions deny
  all `satellite_*` tools before allowing only read-only inspection tools.
- `godot_exec`, input, scene/node/resource writes, and generic control are not
  allowed by the project permissions.
- Scenario Runner remains the authoritative gameplay harness. MCP observation
  is supplementary and does not establish deterministic input outcomes.

The addon writes project settings on initialization and does not reliably remove
its autoload on exit, so the main project is never used for this workflow.

## Repeatable commands

From the repository root:

```bash
ENV="$(python3 -c 'import tempfile; from pathlib import Path; print(Path(tempfile.gettempdir()).resolve() / "opencode" / "cloverhollow-inspector")')"

python3 tools/agents/godot_agent_environment.py snapshot --root "$ENV"
python3 tools/agents/godot_agent_environment.py start --root "$ENV" \
  --scene res://game/scenes/areas/Area_TownPark.tscn
python3 tools/agents/godot_agent_environment.py status --root "$ENV"
python3 tools/agents/godot_agent_environment.py server-command --root "$ENV"
./tools/ci/run-scenario.sh readiness_harness_smoke
python3 tools/agents/godot_agent_environment.py stop --root "$ENV"
```

To inspect current source changes, stop the editor and explicitly refresh:

```bash
python3 tools/agents/godot_agent_environment.py refresh --root "$ENV"
```

`start` runs the locally installed pinned CLI's `--install-addon` against the
snapshot, enables the plugin in the snapshot's `project.godot`, and launches a
headless editor with private `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and
`XDG_CACHE_HOME` directories. No editor clicks or OS window automation are
required. It preflights `GODOT_BIN --version` and refuses anything other than
Godot 4.5.1. `--scene` is optional, must be an existing regular `.tscn` under
the snapshot's `game/` directory, and is passed to the editor without touching
the main project. The helper deliberately has no Scenario Runner proxy; use the
canonical repository wrappers from the main checkout, and point any separately
orchestrated run at the snapshot only after the snapshot is refreshed and its
manifest is reviewed.

OpenCode's project-local server is named `satellite`. After starting the
snapshot, use only the allowed read tools. Native integration has been verified
in-session: `godot_project.get_info` returned the exact disposable snapshot
path and Godot 4.5.1, `addon_status` reported connected/version-matched 4.1.11,
and `godot_node_read` returned the live tree. Do not restart the shared service
while another child is active.

The durable environment is editor/read-observation only. Runtime gameplay
control remains with the canonical Scenario Runner and its existing CLI gates;
no generic remote-debug or MCP proxy is provided here.

## Evidence and limitations

Keep lifecycle output, snapshot `manifest.json`, MCP handshake/tool-list logs,
runtime state, and screenshots under `captures/m227/` when recording an eval.
Read screenshots natively; they are evidence, not golden baselines. This durable
server is read-only, so it cannot provide input or deterministic gameplay
control. The earlier isolated full-mode candidate evaluation showed bounded
input, but Scenario Runner remains authoritative, and screenshot dimensions may
be resized by the MCP response.
