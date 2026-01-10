# Testing Strategy (Godot 4.5) — Unit + Integration + E2E-style scene tests

## 1. Goals
- Catch regressions in core demo requirements:
  - movement, interaction, doors, inventory, quest flags
- Run in automation (CI) without opening the editor UI
- Produce machine-readable results (e.g., JUnit XML) suitable for CI annotations

## 2. Recommended stack (Godot 4.5)

### Primary: GUT (Godot Unit Test) for Godot 4
Use **GUT 9.x** as the baseline test framework because it explicitly targets Godot 4.x and is commonly used for CLI-driven test runs.

Use it for:
- unit tests (pure logic / Resources)
- integration tests (scene composition and state changes)
- “E2E-style” tests by loading a small test scene, spawning the player, and simulating input via `Input.parse_input_event()` or direct method calls

### Optional: GdUnit4
GdUnit4 is also strong for scene/input testing, but Godot 4.5 introduces API changes that may require a specific GdUnit4 major version. If you choose to use GdUnit4:
- pin the plugin version
- add a compatibility note in `docs/ci.md`

## 3. What to test for the demo

### 3.1 Smoke tests (always-on)
- Project loads headlessly without errors.
- Main scene loads and remains alive for N frames.

### 3.2 Interaction tests
- Interacting with a container adds an item and marks the container as emptied.
- Interacting with an NPC opens dialogue and advances text.
- Interacting with a sign shows the expected message.

### 3.3 Transition tests
- Interacting with a door changes the scene.
- Player spawns at the expected spawn marker.
- World state persists (inventory/flags) across transitions.

### 3.4 Quest tests
- Picking up the Blacklight Lantern sets the correct inventory entry.
- Using it enables at least one hidden interaction.
- Completing the “Hollow Light” quest sets `quest.hollow_light.completed = true`.

## 4. Testing conventions (agent-friendly)
- Keep each test world small and deterministic.
- Avoid timing flake:
  - prefer waiting for signals / state changes
  - run “advance N frames” helpers explicitly
- Do not require mouse input for tests.
- Add a minimal debug overlay (optional) that can be toggled for local runs.

## 5. CI expectations
- Tests must be runnable with a single command.
- Failures should exit non-zero and produce an artifact/report.

See:
- `tools/testing.md`
- `.github/workflows/ci.yml`
