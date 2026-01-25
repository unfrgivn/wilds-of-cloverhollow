# Working Sessions Plan

This file is the milestone source. `/next-milestone` selects work from here.

Status convention:
- Completed milestones include `**Status:** ✅ Completed (YYYY-MM-DD)` in the milestone header line.
- Incomplete milestones have no status field.

---

## Milestone 0 — Repo boot + CI sanity  **Owner:** QA Automation + Godot Gameplay Engineer
### Objective
The project boots reliably (macOS) and has a repeatable CLI workflow for smoke/tests/scenarios.

### Acceptance criteria
- Godot project opens and runs the default scene.
- `./tools/ci/run-smoke.sh` returns 0.
- `./tools/ci/run-tests.sh` returns 0 (even if only placeholder tests exist).
- `./tools/ci/run-scenario.sh scenario_smoke` runs and produces a trace under `captures/`.
- `spec.md` reflects the current project constraints.

---

## Milestone 1 — Pixel exploration core (2D)  **Owner:** Godot Gameplay Engineer
### Objective
Playable 2D exploration slice with pixel-stable camera and a controllable player.

### Acceptance criteria
- 2D area scene exists (`Area_Cloverhollow_Test.tscn` or equivalent).
- Player moves with free analog input (keyboard ok for now; touch later).
- Camera2D follows player with pixel-stable movement (no shimmer).
- Collisions exist (at least one wall/obstacle).
- Scenario `exploration_walk_smoke` runs via Scenario Runner.

---

## Milestone 2 — Interaction + dialogue  **Owner:** Godot Gameplay Engineer + UI Systems
### Objective
Player can interact with an object/NPC and see a dialogue box.

### Acceptance criteria
- Interaction detector (Area2D) on player.
- At least one interactable (sign or NPC).
- Dialogue UI appears and can be dismissed.
- Scenario `interaction_smoke` proves it end-to-end.

---

## Milestone 3 — Area transitions + spawn system  **Owner:** Godot Gameplay Engineer
### Objective
Discrete areas with stable spawn points and transitions.

### Acceptance criteria
- A SceneRouter/AreaLoader exists.
- At least two areas and one transition between them.
- Stable spawn marker IDs (string IDs).
- Scenario `area_transition_smoke` loads area A -> area B -> returns.

---

## Milestone 4 — Visible enemies + encounter trigger  **Owner:** Godot Gameplay Engineer
### Objective
Overworld enemies are visible and trigger battle reliably.

### Acceptance criteria
- Enemy actor exists and is visible on map.
- Collision/trigger starts battle transition.
- Scenario `encounter_trigger_smoke` triggers a battle entry.

---

## Milestone 5 — Battle loop v0  **Owner:** Battle Systems + UI Systems
### Objective
A minimal but complete turn-based battle loop.

### Acceptance criteria
- Battle scene loads with placeholder background.
- Party of 4 displayed.
- Enemy displayed.
- Turn order works for at least “Attack” and “Defend”.
- Battle UI:
  - status HUD at top (party + enemies)
  - command menu boxes at bottom/side
  - no cassette theming
- Scenario `battle_one_turn` performs one action and ends the turn.

---

## Milestone 6 — Data-driven content spine  **Owner:** Data Systems + Gameplay
### Objective
Enemies/skills/items/encounters defined in data, not hard-coded.

### Acceptance criteria
- Data schema exists for:
  - biomes
  - enemies
  - skills
  - items
  - encounters
- Adding a new enemy uses data + sprite drop-in only.
- Content lint script exists (even if minimal).

---

## Milestone 7 — Pixel art pipeline tooling  **Owner:** Art Pipeline + QA Automation
### Objective
Deterministic, non-artist-friendly asset workflow.

### Acceptance criteria
- Global palette and Cloverhollow palette exist under `art/palettes/`.
- Scripts exist (can be stubs initially):
  - quantize_to_palette
  - validate_sprite
  - pack_spritesheet
- Docs exist for:
  - tile workflow
  - sprite workflow
- At least one placeholder sprite set passes validation.

---

## Milestone 8 — Golden capture + visual diff  **Owner:** QA Automation
### Objective
Artifact-based testing for visuals without OS-level window control.

### Acceptance criteria
- Rendered scenario runner exists (`run-scenario-rendered.sh`).
- At least 3 golden scenarios produce deterministic capture frames.
- Diff report generated against baselines.
- Baseline update workflow documented.

---

## Milestone 9 — Spec drift guardrail  **Owner:** Spec Steward + QA Automation
### Objective
Prevent spec drift.

### Acceptance criteria
- CI/local check fails if `game/**` changes but `spec.md` does not.
- Allow explicit override for known refactors.
- Documented in `docs/working-sessions/`.

---

## Milestone 10 — Cloverhollow town pack v0  **Owner:** World Builder + Art Pipeline
### Objective
First real content pack (style lock).

### Acceptance criteria
- Cloverhollow area has at least:
  - hero house exterior
  - town center
  - school exterior (blockout ok)
  - arcade exterior (blockout ok)
- Minimum prop set implemented as reusable sprites (bench, sign, lamp, tree, fence).
- At least one non-scary enemy type.
- At least one battle background.

---

## Milestone 11 — Biome pack factory workflow  **Owner:** World Producer + Art Pipeline
### Objective
Adding a biome is repeatable and safe.

### Acceptance criteria
- `/new-biome <id>` scaffolds docs + palette + stub data + scenario stub.
- Biome checklist is enforced (at least by linter or human checklist).
- Implement Bubblegum Bay as the first non-town biome pack.

---

## Milestone 12 — iOS touch controls  **Owner:** UI Systems + Gameplay
### Objective
Playable on iPhone/iPad landscape with touch.

### Acceptance criteria
- Virtual joystick + interact button.
- Safe placement for iPhone notches.
- No critical UI overlap.

---

## Milestone 13 — Save/Load + tools (lantern/journal/lasso/flute)  **Owner:** Gameplay + Data Systems
### Objective
Start the “adventure + puzzle + light RPG” loop.

### Acceptance criteria
- Save/load for player position and inventory.
- Implement at least one tool-gated interaction (placeholder art ok).
- Add at least one “school life” gating puzzle stub.


---

## Milestone 14 — Optional: 8-direction overworld animation upgrade  **Owner:** Art Pipeline + Gameplay
### Objective
Increase animation fidelity without breaking the pixel style lock.

### Acceptance criteria
- Player overworld supports 8-direction animation.
- Diagonal movement uses diagonal sprites (not nearest-cardinal).
- Sprite pipeline and validation updated to handle 8-direction sets.
- Visual regression baselines updated intentionally.
