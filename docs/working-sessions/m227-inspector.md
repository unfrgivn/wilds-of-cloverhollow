# Milestone 227: isolated Godot agent environment

The optional inspector uses `@satelliteoflove/godot-mcp` 4.1.11 with a fresh,
committed consumer lock. The parent independently ran `npm audit --omit=dev`:
zero findings. This differs from the older upstream development lock, whose
audit findings remain recorded under `captures/m227/`.

## Verified boundaries

- The old server is disabled; `satellite` exposes five allowlisted observation
  tools through OpenCode and starts in the package's read-only mode.
- The package's read-only tool surface rejected a write request in the fixture.
- The addon is installed only into an owned physical snapshot outside the repo.
- Six ownership/path tests passed, including non-owned directory preservation,
  independent copies, traversal rejection, and valid/invalid scene selection.
- The helper refused to copy while source changed and discarded its own partial
  snapshot. A subsequent stable copy succeeded.
- Parent-owned start, stop, refresh, targeted scene start, and final cleanup
  succeeded. Port 6550 was free after stop.

## Native OpenCode verification

Without restarting the shared service, the parent called:

1. `satellite.godot_project` with `get_info`, receiving the private snapshot path
   and Godot 4.5.1.
2. `satellite.godot_project` with `addon_status`, receiving `connected: true`,
   matching packaged server/addon 4.1.11, and a non-stale build.
3. `satellite.godot_node_read` with `get_scene_tree`, first for Main, then after
   a targeted restart for TownPark. The park tree included the player at
   `(100, 144)`, trees, pond, flower beds, and terrain nodes.

The independent status and dependency audit artifacts are under
`captures/m227/independent/`. The source fixture also demonstrated input and
progression, but those write/control capabilities are not enabled in the
durable OpenCode integration.

## Canonical game regression checks

All mandatory commands passed independently through their `just` recipes:
smoke, tests, spec check, headless `agent_environment_smoke`, and rendered
`agent_environment_smoke`. The scenario asserts the park scene and its default
spawn without installing the MCP addon there. Exit codes and logs are under
`captures/m227/parent-acceptance/`.

## Limits

This is an editor/observation integration, not a second acceptance-test runner.
Runtime observation requires a running game connected to that editor; the
lifecycle helper does not proxy gameplay. Use the canonical Scenario Runner
for autonomous input, assertions, captures, and repeatability.

Duration-based MCP input differed by one physics tick between fixture runs, and
its resized screenshot was 512x287. Neither is accepted as deterministic golden
evidence. Use native 512x288 Scenario Runner captures instead.

Loopback binding and read-only client permissions do not sandbox the host.
Do not expose the bridge as a shared or remote service. Stop it when inspection
is finished, and never export the development snapshot.
