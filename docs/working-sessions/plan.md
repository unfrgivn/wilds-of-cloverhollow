# Working Sessions Plan

This file is the milestone source. `/next-milestone` selects work from here.

Status convention:
- Completed milestones include `**Status:** ✅ Completed (YYYY-MM-DD)` in the milestone header line.
- Incomplete milestones have no status field.

---

## Milestone 0 — Repo boot + CI sanity  **Status:** ✅ Completed (2026-01-25)  **Owner:** QA Automation + Godot Gameplay Engineer
### Objective
The project boots reliably (macOS) and has a repeatable CLI workflow for smoke/tests/scenarios.

### Acceptance criteria
- Godot project opens and runs the default scene.
- `./tools/ci/run-smoke.sh` returns 0.
- `./tools/ci/run-tests.sh` returns 0 (even if only placeholder tests exist).
- `./tools/ci/run-scenario.sh scenario_smoke` runs and produces a trace under `captures/`.
- `spec.md` reflects the current project constraints.

---

## Milestone 1 — Pixel exploration core (2D)  **Status:** ✅ Completed (2026-01-25)  **Owner:** Godot Gameplay Engineer
### Objective
Playable 2D exploration slice with pixel-stable camera and a controllable player.

### Acceptance criteria
- 2D area scene exists (`Area_Cloverhollow_Test.tscn` or equivalent).
- Player moves with free analog input (keyboard ok for now; touch later).
- Camera2D follows player with pixel-stable movement (no shimmer).
- Collisions exist (at least one wall/obstacle).
- Scenario `exploration_walk_smoke` runs via Scenario Runner.

---

## Milestone 2 — Interaction + dialogue  **Status:** ✅ Completed (2026-01-25)  **Owner:** Godot Gameplay Engineer + UI Systems
### Objective
Player can interact with an object/NPC and see a dialogue box.

### Acceptance criteria
- Interaction detector (Area2D) on player.
- At least one interactable (sign or NPC).
- Dialogue UI appears and can be dismissed.
- Scenario `interaction_smoke` proves it end-to-end.

---

## Milestone 3 — Area transitions + spawn system  **Status:** ✅ Completed (2026-01-25)  **Owner:** Godot Gameplay Engineer
### Objective
Discrete areas with stable spawn points and transitions.

### Acceptance criteria
- A SceneRouter/AreaLoader exists.
- At least two areas and one transition between them.
- Stable spawn marker IDs (string IDs).
- Scenario `area_transition_smoke` loads area A -> area B -> returns.

---

## Milestone 4 — Visible enemies + encounter trigger  **Status:** ✅ Completed (2026-01-25)  **Owner:** Godot Gameplay Engineer
### Objective
Overworld enemies are visible and trigger battle reliably.

### Acceptance criteria
- Enemy actor exists and is visible on map.
- Collision/trigger starts battle transition.
- Scenario `encounter_trigger_smoke` triggers a battle entry.

---

## Milestone 5 — Battle loop v0  **Status:** ✅ Completed (2026-01-25)  **Owner:** Battle Systems + UI Systems
### Objective
A minimal but complete turn-based battle loop.

### Acceptance criteria
- Battle scene loads with placeholder background.
- Party of 4 displayed.
- Enemy displayed.
- Turn order works for at least "Attack" and "Defend".
- Battle UI:
  - status HUD at top (party + enemies)
  - command menu boxes at bottom/side
  - no cassette theming
- Scenario `battle_one_turn` performs one action and ends the turn.

---

## Milestone 6 — Data-driven content spine  **Status:** ✅ Completed (2026-01-25)  **Owner:** Data Systems + Gameplay
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

## Milestone 7 — Pixel art pipeline tooling  **Status:** ✅ Completed (2026-01-25)  **Owner:** Art Pipeline + QA Automation
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

## Milestone 8 — Golden capture + visual diff  **Status:** ✅ Completed (2026-01-25)  **Owner:** QA Automation
### Objective
Artifact-based testing for visuals without OS-level window control.

### Acceptance criteria
- Rendered scenario runner exists (`run-scenario-rendered.sh`).
- At least 3 golden scenarios produce deterministic capture frames.
- Diff report generated against baselines.
- Baseline update workflow documented.

---

## Milestone 9 — Spec drift guardrail  **Status:** ✅ Completed (2026-01-25)  **Owner:** Spec Steward + QA Automation
### Objective
Prevent spec drift.

### Acceptance criteria
- CI/local check fails if `game/**` changes but `spec.md` does not.
- Allow explicit override for known refactors.
- Documented in `docs/working-sessions/`.

---

## Milestone 10 — Cloverhollow town pack v0  **Status:** ✅ Completed (2026-01-25)  **Owner:** World Builder + Art Pipeline
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

## Milestone 11 — Biome pack factory workflow  **Status:** ✅ Completed (2026-01-25)  **Owner:** World Producer + Art Pipeline
### Objective
Adding a biome is repeatable and safe.

### Acceptance criteria
- `/new-biome <id>` scaffolds docs + palette + stub data + scenario stub.
- Biome checklist is enforced (at least by linter or human checklist).
- Implement Bubblegum Bay as the first non-town biome pack.

---

## Milestone 12 — iOS touch controls  **Status:** ✅ Completed (2026-01-25)  **Owner:** UI Systems + Gameplay
### Objective
Playable on iPhone/iPad landscape with touch.

### Acceptance criteria
- Virtual joystick + interact button.
- Safe placement for iPhone notches.
- No critical UI overlap.

---

## Milestone 13 — Save/Load + tools (lantern/journal/lasso/flute)  **Status:** ✅ Completed (2026-01-25)  **Owner:** Gameplay + Data Systems
### Objective
Start the "adventure + puzzle + light RPG" loop.

### Acceptance criteria
- Save/load for player position and inventory.
- Implement at least one tool-gated interaction (placeholder art ok).
- Add at least one "school life" gating puzzle stub.

---

## Milestone 14 — Concept art integration documentation  **Status:** ✅ Completed (2026-01-25)  **Owner:** Art Pipeline
### Objective
Document concept art aesthetic for consistent asset creation.

### Acceptance criteria
- `docs/art/concept-reference.md` exists with aesthetic guidelines.
- Character proportions, environment styles, UI patterns documented.
- File index of all concept art created.
- Asset creators reference this doc before creating new content.

---

# Phase 2: Cloverhollow Town Content

---

## Milestone 15 — Hero's Home exterior  **Status:** ✅ Completed (2026-01-25)  **Owner:** World Builder + Art Pipeline
### Objective
Complete exterior tilemap and props for the protagonist's house.

### Acceptance criteria
- Exterior tilemap for hero's home (2-story cottage style).
- Roof, chimney, door, windows, porch.
- Garden props (flowers, fence, mailbox).
- Door transition zone to interior.
- Scenario `hero_home_exterior_render` captures baseline.

---

## Milestone 16 — Hero's Home interior ground floor  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Interior scene for hero's home main floor.

### Acceptance criteria
- Kitchen area with table, chairs, stove, sink.
- Living room with couch, rug, bookshelf.
- Door to exterior, stairs to upper floor.
- Scenario `hero_home_interior_ground` runs.

---

## Milestone 17 — Hero's Home interior upper floor  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Hero's bedroom and upstairs area.

### Acceptance criteria
- Bedroom with bed, desk, lamp, closet.
- Bathroom (simple: tub, toilet, sink).
- Stairs down to ground floor.
- Interactable mirror (placeholder dialogue).
- Scenario `hero_home_interior_upper` runs.

---

## Milestone 18 — Hero's Home NPC: Mom  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Mom NPC with dialogue.

### Acceptance criteria
- Mom sprite (idle, facing directions).
- Mom spawns in kitchen.
- Dialogue tree with at least 3 branches.
- Scenario `npc_mom_dialogue` proves interaction.

---

## Milestone 19 — Hero's Home NPC: Pet companion  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Pet that follows player and has personality.

### Acceptance criteria
- Pet sprite (idle, walk cycle).
- Pet follows player at consistent spacing.
- Pet has random idle animations (sit, scratch, yawn).
- Scenario `pet_follow_smoke` runs.

---

## Milestone 20 — Town Square exterior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Central hub area for Cloverhollow.

### Acceptance criteria
- Fountain or statue centerpiece.
- Benches, lampposts, trees.
- 4+ building facades with door transitions.
- NPC spawn points (at least 3).
- Scenario `town_square_render` captures baseline.

---

## Milestone 21 — General Store exterior + interior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Shop building where player buys items.

### Acceptance criteria
- Exterior: shop facade with sign.
- Interior: counter, shelves, displayed items.
- Door transitions work.
- Scenario `general_store_walkthrough` runs.

---

## Milestone 22 — General Store NPC: Shopkeeper  **Owner:** Character Systems + UI Systems  **Status:** ✅ Completed (2026-01-25)
### Objective
Shopkeeper with buy/sell interface.

### Acceptance criteria
- Shopkeeper sprite behind counter.
- Shop UI opens on interaction.
- Buy interface with placeholder items.
- Scenario `shop_buy_smoke` proves purchase.

---

## Milestone 23 — School exterior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Cloverhollow School building facade.

### Acceptance criteria
- School building with double doors.
- Playground area (swing set, slide).
- Flagpole, bike rack.
- Scenario `school_exterior_render` runs.

---

## Milestone 24 — School interior: Main Hall  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
School main hallway and lobby.

### Acceptance criteria
- Hallway with lockers, bulletin board.
- Principal's office door.
- Doors to classrooms.
- Trophy case.
- Scenario `school_hall_walkthrough` runs.

---

## Milestone 25 — School interior: Classroom  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Player's classroom scene.

### Acceptance criteria
- Desks arranged in rows.
- Teacher's desk.
- Chalkboard, windows, clock.
- 6+ student desk positions.
- Scenario `classroom_render` runs.

---

## Milestone 26 — School NPC: Teacher  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Teacher character with classroom dialogue.

### Acceptance criteria
- Teacher sprite (standing, sitting variants).
- Teacher positions at desk.
- Dialogue about lessons/homework.
- Scenario `npc_teacher_dialogue` runs.

---

## Milestone 27 — School NPC: Classmates (3+)  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Multiple student NPCs with distinct looks.

### Acceptance criteria
- 3+ unique student sprites.
- Each has at least 2 dialogue lines.
- Students spawn at desks.
- Scenario `npc_classmates_render` runs.

---

## Milestone 28 — Arcade exterior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Arcade building facade.

### Acceptance criteria
- Neon-style sign (static, pixel art).
- Arcade machine visible through window.
- Poster/flyer props.
- Scenario `arcade_exterior_render` runs.

---

## Milestone 29 — Arcade interior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Interior with arcade machines.

### Acceptance criteria
- 4+ arcade cabinet props.
- Counter with snacks display.
- Neon lighting ambiance (palette tint).
- Prize redemption corner.
- Scenario `arcade_interior_walkthrough` runs.

---

## Milestone 30 — Arcade NPC: Owner  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Arcade owner character.

### Acceptance criteria
- Owner sprite behind counter.
- Dialogue about high scores, prizes.
- Placeholder minigame hook.
- Scenario `npc_arcade_owner_dialogue` runs.

---

## Milestone 31 — Arcade minigame stub  **Owner:** Gameplay + UI Systems  **Status:** ✅ Completed (2026-01-25)
### Objective
Playable cabinet interaction (simple minigame).

### Acceptance criteria
- Interacting with cabinet opens minigame scene.
- Simple timing/reflex minigame (catch falling items).
- Score tracking.
- Return to arcade on exit.
- Scenario `arcade_minigame_smoke` runs.

---

## Milestone 32 — Town Park area  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Park/green space for Cloverhollow.

### Acceptance criteria
- Grass tiles, trees, flower beds.
- Pond with bridge.
- Picnic tables, trash cans.
- Path to forest edge.
- Scenario `town_park_render` runs.

---

## Milestone 33 — Town Park NPC: Elder  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Elderly character with lore/hints.

### Acceptance criteria
- Elder sprite (sitting on bench).
- Dialogue with town history hints.
- Optional quest hook placeholder.
- Scenario `npc_elder_dialogue` runs.

---

## Milestone 34 — Library exterior + interior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Town library building.

### Acceptance criteria
- Exterior: classic library facade.
- Interior: bookshelves, reading nooks, checkout desk.
- Ladder prop for high shelves.
- Scenario `library_walkthrough` runs.

---

## Milestone 35 — Library NPC: Librarian  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Librarian with book lookup mechanic.

### Acceptance criteria
- Librarian sprite at desk.
- Dialogue about research topics.
- Book lookup UI stub.
- Scenario `npc_librarian_dialogue` runs.

---

## Milestone 36 — Café/Bakery exterior + interior  **Owner:** World Builder + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Cozy café in town.

### Acceptance criteria
- Exterior: awning, outdoor seating.
- Interior: counter, display case, tables.
- Kitchen visible through doorway.
- Scenario `cafe_walkthrough` runs.

---

## Milestone 37 — Café NPC: Baker  **Owner:** Character Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-25)
### Objective
Baker character with food items.

### Acceptance criteria
- Baker sprite with apron.
- Dialogue about pastries.
- Placeholder recipe mechanic hook.
- Scenario `npc_baker_dialogue` runs.

---

## Milestone 38 — Town Hall exterior + interior  **Status:** ✅ Completed (2026-01-25)  **Owner:** World Builder + Art Pipeline
### Objective
Administrative building.

### Acceptance criteria
- Exterior: official-looking facade, flagpole.
- Interior: reception, mayor's office door.
- Notice board with quest posters.
- Scenario `town_hall_walkthrough` runs.

---

## Milestone 39 — Town Hall NPC: Mayor  **Status:** ✅ Completed (2026-01-25)  **Owner:** Character Systems + Art Pipeline
### Objective
Mayor character for story quests.

### Acceptance criteria
- Mayor sprite (formal attire).
- Dialogue about town problems.
- Quest-giver mechanics stub.
- Scenario `npc_mayor_dialogue` runs.

---

## Milestone 40 — Pet Shop exterior + interior  **Status:** ✅ Completed (2026-01-25)  **Owner:** World Builder + Art Pipeline
### Objective
Shop for pet-related items.

### Acceptance criteria
- Exterior: animal silhouettes on sign.
- Interior: cages, food bins, accessories.
- Pet sounds ambiance.
- Scenario `pet_shop_walkthrough` runs.

---

## Milestone 41 — Pet Shop NPC: Clerk  **Status:** ✅ Completed (2025-01-25)  **Owner:** Character Systems + Art Pipeline
### Objective
Pet shop attendant.

### Acceptance criteria
- Clerk sprite.
- Dialogue about pet care.
- Pet accessory shop UI stub.
- Scenario `npc_pet_clerk_dialogue` runs.

---

## Milestone 42 — Blacksmith/Tool Shop exterior + interior  **Status:** ✅ Completed (2025-01-25)  **Owner:** World Builder + Art Pipeline
### Objective
Shop for adventure tools.

### Acceptance criteria
- Exterior: anvil sign, forge smoke.
- Interior: forge, weapon racks, workbench.
- Tool display props.
- Scenario `blacksmith_walkthrough` runs.

---

## Milestone 43 — Blacksmith NPC  **Status:** ✅ Completed (2025-01-25)  **Owner:** Character Systems + Art Pipeline
### Objective
Tool/weapon shop keeper.

### Acceptance criteria
- Blacksmith sprite (apron, hammer).
- Dialogue about crafting.
- Upgrade shop UI stub.
- Scenario `npc_blacksmith_dialogue` runs.

---

## Milestone 44 — Cloverhollow Clinic exterior + interior  **Status:** ✅ Completed (2025-01-25)  **Owner:** World Builder + Art Pipeline
### Objective
Healing/recovery location.

### Acceptance criteria
- Exterior: red cross sign.
- Interior: reception, exam room, beds.
- Medical props.
- Scenario `clinic_walkthrough` runs.

---

## Milestone 45 — Clinic NPC: Doctor  **Status:** ✅ Completed (2025-01-26)  **Owner:** Character Systems + Art Pipeline
### Objective
Doctor for healing services.

### Acceptance criteria
- Doctor sprite (white coat).
- Dialogue about health tips.
- Party heal service UI.
- Scenario `npc_doctor_heal` runs.

---

## Milestone 46 — Town Bulletin Board system  **Status:** ✅ Completed (2025-01-26)  **Owner:** Gameplay + UI Systems
### Objective
Quest/notice discovery mechanic.

### Acceptance criteria
- Interactable bulletin board prop.
- UI showing available notices/quests.
- Accept/decline quest flow.
- Scenario `bulletin_board_interact` runs.

---

## Milestone 47 — Day/Night cycle (visual only)  **Status:** ✅ Completed (2025-01-26)  **Owner:** Art Pipeline + Gameplay
### Objective
Time-of-day palette shifts.

### Acceptance criteria
- Morning, afternoon, evening, night palettes.
- Smooth transition shader.
- Time advances on area transitions (simplified).
- Scenario `day_night_render` captures all phases.

---

## Milestone 48 — Weather effects stub  **Status:** ✅ Completed (2025-01-26)  **Owner:** Art Pipeline + Gameplay
### Objective
Rain and weather particle effects.

### Acceptance criteria
- Rain particle effect.
- Thunder flash overlay.
- Weather state variable.
- Scenario `weather_rain_render` runs.

---

## Milestone 49 — Streetlight/lamp toggle  **Status:** ✅ Completed (2025-01-26)  **Owner:** Gameplay + Art Pipeline
### Objective
Lights turn on at night.

### Acceptance criteria
- Lamp props have on/off variants.
- Lamps toggle based on time-of-day.
- Scenario `lamp_night_render` runs.

---

## Milestone 50 — Town NPC schedule system  **Owner:** Character Systems + Gameplay  **Status:** ✅ Completed (2026-01-25)
### Objective
NPCs move between locations by time.

### Acceptance criteria
- Schedule data schema per NPC.
- NPCs relocate on time change.
- Scenario `npc_schedule_smoke` shows movement.

---

# Phase 3: Combat System

---

## Milestone 51 — Battle backgrounds: Cloverhollow set  **Owner:** Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Multiple battle backgrounds for town area.

### Acceptance criteria
- Town square background.
- Park background.
- School courtyard background.
- All pass palette validation.
- Scenario `battle_bg_render` captures all.

---

## Milestone 52 — Enemy: Grumpy Squirrel  **Owner:** Art Pipeline + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
First creature enemy with animations.

### Acceptance criteria
- Sprite with idle, attack, hurt, defeat frames.
- Enemy data entry.
- Scenario `enemy_squirrel_battle` runs.

---

## Milestone 53 — Enemy: Dusty Bunny  **Owner:** Art Pipeline + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Second creature enemy.

### Acceptance criteria
- Sprite sheet (idle, hop, attack).
- Enemy data entry.
- Scenario `enemy_bunny_battle` runs.

---

## Milestone 54 — Enemy: Mischief Mouse  **Owner:** Art Pipeline + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Small, fast enemy type.

### Acceptance criteria
- Mouse sprite sheet.
- Higher speed stat.
- Scenario `enemy_mouse_battle` runs.

---

## Milestone 55 — Enemy: Cranky Crow  **Owner:** Art Pipeline + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Flying enemy type.

### Acceptance criteria
- Crow sprite (flying pose).
- Can evade attacks sometimes.
- Scenario `enemy_crow_battle` runs.

---

## Milestone 56 — Enemy: Muddy Frog  **Owner:** Art Pipeline + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Status effect enemy.

### Acceptance criteria
- Frog sprite sheet.
- Mud Splash inflicts slow.
- Scenario `enemy_frog_battle` runs.

---

## Milestone 57 — Party member: Main character battle sprite  **Owner:** Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Hero battle sprite.

### Acceptance criteria
- Idle, attack, hurt, victory poses.
- Matches overworld style.
- Scenario `hero_battle_sprite_render` runs.

---

## Milestone 58 — Party member: Friend A battle sprite  **Owner:** Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
First party member ally.

### Acceptance criteria
- Sprite sheet with battle poses.
- Distinct silhouette from hero.
- Scenario `friend_a_battle_render` runs.

---

## Milestone 59 — Party member: Friend B battle sprite  **Owner:** Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Second party member ally.

### Acceptance criteria
- Sprite sheet with battle poses.
- Scenario `friend_b_battle_render` runs.

---

## Milestone 60 — Party member: Pet battle sprite  **Owner:** Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Pet companion battle form.

### Acceptance criteria
- Pet battle poses (attack, cheer, hurt).
- Pet as 4th party slot.
- Scenario `pet_battle_render` runs.

---

## Milestone 61 — Skill: Attack variants  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Multiple attack skill types.

### Acceptance criteria
- Quick Attack (low damage, high speed).
- Power Strike (high damage, low speed).
- Skills in data.
- Scenario `skill_attacks_smoke` runs.

---

## Milestone 62 — Skill: Healing  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
HP recovery skills.

### Acceptance criteria
- Heal skill restores HP.
- Target selection UI.
- Skill animation placeholder.
- Scenario `skill_heal_smoke` runs.

---

## Milestone 63 — Skill: Status effects  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Buff/debuff skills.

### Acceptance criteria
- Shield (defense up).
- Slow (speed down).
- Status icons on HUD.
- Scenario `skill_status_smoke` runs.

---

## Milestone 64 — Skill: Pet special attacks  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Pet-exclusive skills.

### Acceptance criteria
- Bark (stun chance).
- Fetch (item chance).
- Pet skill menu.
- Scenario `pet_skills_smoke` runs.

---

## Milestone 65 — Item: Potions  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26) + Data Systems
### Objective
Consumable healing items.

### Acceptance criteria
- Small Potion, Medium Potion.
- Item use in battle.
- Inventory deduction.
- Scenario `item_potion_smoke` runs.

---

## Milestone 66 — Item: Status cures  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26) + Data Systems
### Objective
Items that remove status effects.

### Acceptance criteria
- Antidote, Energizer.
- Status removal logic.
- Scenario `item_cure_smoke` runs.

---

## Milestone 67 — Item: Battle throwables  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26) + Data Systems
### Objective
Damage items.

### Acceptance criteria
- Pebble (low damage, always hits).
- Stink Bomb (damage + status).
- Scenario `item_throw_smoke` runs.

---

## Milestone 68 — Battle: Turn order display  **Owner:** UI Systems + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Visual turn order indicator.

### Acceptance criteria
- Turn queue shown on screen.
- Updates after speed changes.
- Scenario `turn_order_render` runs.

---

## Milestone 69 — Battle: Target selection  **Owner:** UI Systems + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Player chooses attack target.

### Acceptance criteria
- Cursor/highlight on enemies.
- Multi-target selection for AoE.
- Scenario `target_select_smoke` runs.

---

## Milestone 70 — Battle: Victory screen  **Owner:** UI Systems + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Post-battle rewards UI.

### Acceptance criteria
- XP gained display.
- Items dropped display.
- Continue button.
- Scenario `victory_screen_render` runs.

---

## Milestone 71 — Battle: Defeat/Game Over  **Owner:** UI Systems + Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Game over handling.

### Acceptance criteria
- Party wipe triggers game over.
- Game Over screen with retry option.
- Return to last save.
- Scenario `game_over_smoke` runs.

---

## Milestone 72 — Battle: Flee/escape  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Run away from battle.

### Acceptance criteria
- Flee option in menu.
- Success rate based on speed.
- Return to overworld on success.
- Scenario `flee_smoke` runs.

---

## Milestone 73 — Battle: Enemy AI basic  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Enemies make decisions.

### Acceptance criteria
- Random attack selection.
- Heal when low HP.
- Scenario `enemy_ai_smoke` runs.

---

## Milestone 74 — Battle: Boss battle prototype  **Owner:** Battle Systems  **Status:** ✅ Completed (2026-01-26) + Art Pipeline
### Objective
Multi-phase boss encounter.

### Acceptance criteria
- Boss enemy with high HP.
- Phase change at 50% HP.
- Boss music trigger stub.
- Scenario `boss_battle_smoke` runs.

---

## Milestone 75 — Experience and leveling  **Owner:** Battle Systems + Data Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Character progression.

### Acceptance criteria
- XP accumulation after battles.
- Level up at thresholds.
- Stat increases on level.
- Scenario `level_up_smoke` runs.

---

## Milestone 76 — Equipment system stub  **Status:** ✅ Completed (2026-01-26)  **Owner:** Gameplay + Data Systems
### Objective
Equippable items affecting stats.

### Acceptance criteria
- Equipment slots (weapon, armor, accessory).
- Equip UI.
- Stat modifications apply.
- Scenario `equipment_smoke` runs.

---

# Phase 4: Story and Quests

---

## Milestone 77 — Story: Opening cutscene  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Art Pipeline
### Objective
Game intro sequence.

### Acceptance criteria
- Title screen with start option.
- Intro text/narration.
- Fade to hero's bedroom (wake up scene).
- Scenario `intro_cutscene_render` runs.

---

## Milestone 78 — Story: Morning routine tutorial  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Guided first moments.

### Acceptance criteria
- Wake up interaction.
- Get dressed (closet interact).
- Go downstairs, talk to Mom.
- Scenario `morning_tutorial_smoke` runs.

---

## Milestone 79 — Story: Walk to school quest  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
First outdoor exploration.

### Acceptance criteria
- Quest log entry: "Go to School".
- Path highlighted/hinted.
- Arrive at school triggers progress.
- Scenario `walk_to_school_smoke` runs.

---

## Milestone 80 — Story: First class scene  **Owner:** Story + Gameplay  **Status:** ✅ Completed (2026-01-26)
### Objective
Classroom story beat.

### Acceptance criteria
- Enter classroom, sit at desk.
- Teacher dialogue.
- Strange occurrence (rumble, lights flicker).
- Scenario `first_class_smoke` runs.

---

## Milestone 81 — Story: Meet the bad guy hint  **Owner:** Story + Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Antagonist foreshadowing.

### Acceptance criteria
- Mysterious figure glimpse (cutscene).
- Townspeople mention weird events.
- Quest log: "Investigate disturbance".
- Scenario `bad_guy_hint_smoke` runs.

---

## Milestone 82 — Quest system framework  **Owner:** Gameplay + Data Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Quest tracking infrastructure.

### Acceptance criteria
- Quest data schema (objectives, rewards).
- Active/completed quest lists.
- Quest log UI.
- Scenario `quest_system_smoke` runs.

---

## Milestone 83 — Quest: Find the lost cat  **Owner:** Story + Gameplay  **Status:** ✅ Completed (2026-01-26)
### Objective
Simple fetch quest.

### Acceptance criteria
- NPC gives quest.
- Cat hidden in park.
- Return cat, get reward.
- Scenario `lost_cat_quest_smoke` runs.

---

## Milestone 84 — Quest: Gather ingredients  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Collection quest.

### Acceptance criteria
- Baker needs 3 berries.
- Berries spawn in park/forest edge.
- Deliver, receive pastry item.
- Scenario `gather_ingredients_smoke` runs.

---

## Milestone 85 — Quest: Pest control  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Combat-focused quest.

### Acceptance criteria
- Shopkeeper has mouse problem.
- Defeat 3 mice in shop basement.
- Receive shop discount.
- Scenario `pest_control_smoke` runs.

---

## Milestone 86 — Quest: Library research  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Investigation quest.

### Acceptance criteria
- Mayor asks for old records.
- Find book in library.
- Discover lore about villain.
- Scenario `library_research_smoke` runs.

---

## Milestone 87 — Quest: Fix the fountain  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Tool-gated puzzle quest.

### Acceptance criteria
- Fountain broken.
- Need wrench from blacksmith.
- Use wrench, restore fountain.
- Scenario `fix_fountain_smoke` runs.

---

## Milestone 88 — Quest chain: The chaos begins  **Status:** ✅ Completed (2026-01-26)  **Owner:** Story + Gameplay
### Objective
Main story progression.

### Acceptance criteria
- Multiple linked quests.
- Unlock forest entrance.
- Story flag progression.
- Scenario `chaos_begins_smoke` runs.

---

## Milestone 89 — Dialogue branching system  **Status:** ✅ Completed (2026-01-26)  **Owner:** Gameplay + UI Systems
### Objective
Player choices affect dialogue.

### Acceptance criteria
- Dialogue option nodes.
- Branching responses.
- Choices affect NPC reactions.
- Scenario `dialogue_branching_smoke` runs.

---

## Milestone 90 — Relationship/affinity tracking  **Status:** ✅ Completed (2026-01-26)  **Owner:** Gameplay + Data Systems
### Objective
NPC friendship levels.

### Acceptance criteria
- Affinity score per NPC.
- Actions modify affinity.
- UI shows relationship status.
- Scenario `affinity_smoke` runs.

---

# Phase 5: Polish and Systems

---

## Milestone 91 — Menu: Pause menu  **Status:** ✅ Completed (2026-01-26)  **Owner:** UI Systems
### Objective
In-game pause functionality.

### Acceptance criteria
- Pause button/key pauses game.
- Options: Resume, Items, Save, Quit.
- Scenario `pause_menu_render` runs.

---

## Milestone 92 — Menu: Inventory UI  **Status:** ✅ Completed (2026-01-26)  **Owner:** UI Systems
### Objective
Item management screen.

### Acceptance criteria
- Grid-based item display.
- Item details on hover/select.
- Use/equip/discard actions.
- Scenario `inventory_ui_render` runs.

---

## Milestone 93 — Menu: Party status  **Status:** ✅ Completed (2026-01-26)  **Owner:** UI Systems
### Objective
Party member stats screen.

### Acceptance criteria
- HP/MP bars.
- Stats display.
- Equipment slots visible.
- Scenario `party_status_render` runs.

---

## Milestone 94 — Menu: Quest log  **Owner:** UI Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Quest tracking interface.

### Acceptance criteria
- Active quests list.
- Completed quests archive.
- Quest details view.
- Scenario `quest_log_render` runs.

---

## Milestone 95 — Menu: Map screen  **Owner:** UI Systems + Art Pipeline  **Status:** ✅ Completed (2026-01-26)
### Objective
Town map display.

### Acceptance criteria
- Cloverhollow map image.
- Current location marker.
- Building labels.
- Scenario `map_screen_render` runs.

---

## Milestone 96 — Menu: Settings  **Owner:** UI Systems  **Status:** ✅ Completed (2026-01-26)
### Objective
Game options.

### Acceptance criteria
- Volume sliders (music, SFX).
- Touch control size option.
- Credits button.
- Scenario `settings_render` runs.

---

## Milestone 97 — Audio: Music integration  **Status:** ✅ Completed (2026-01-26) **Owner:** Audio + Gameplay
### Objective
Background music playback.

### Acceptance criteria
- Area-based music switching.
- Battle music trigger.
- Music data per area.
- Scenario `music_switch_smoke` runs.

---

## Milestone 98 — Audio: Sound effects  **Status:** ✅ Completed (2026-01-26) **Owner:** Audio + Gameplay
### Objective
SFX for actions.

### Acceptance criteria
- Menu navigate SFX.
- Attack hit/miss SFX.
- Interaction SFX.
- Scenario `sfx_smoke` runs.

---

## Milestone 99 — Notifications system  **Status:** ✅ Completed (2026-01-26) **Owner:** UI Systems
### Objective
Toast/popup notifications.

### Acceptance criteria
- Quest received notification.
- Item obtained notification.
- Level up notification.
- Scenario `notifications_smoke` runs.

---

## Milestone 100 — Accessibility: Text size options  **Status:** ✅ Completed (2026-01-26)  **Owner:** UI Systems
### Objective
Readable text for all users.

### Acceptance criteria
- Small/medium/large text options.
- All UI scales properly.
- Scenario `text_size_render` runs.

---

## Milestone 101 — Tutorial hints system  **Owner:** Gameplay + UI Systems
### Objective
Contextual help popups.

### Acceptance criteria
- First-time hints for mechanics.
- Hint dismissal persists.
- Scenario `tutorial_hints_smoke` runs.

---

## Milestone 102 — Performance: Culling and optimization  **Owner:** QA Automation + Gameplay
### Objective
Smooth 60fps on target devices.

### Acceptance criteria
- Off-screen sprites culled.
- No frame drops in stress test.
- Scenario `performance_stress_smoke` runs.

---

## Milestone 103 — Save system: Multiple slots  **Owner:** Data Systems
### Objective
Multiple save files.

### Acceptance criteria
- 3 save slots.
- Load screen shows slot previews.
- Delete save option.
- Scenario `save_slots_smoke` runs.

---

## Milestone 104 — Cloud save stub  **Owner:** Data Systems
### Objective
Future cloud sync preparation.

### Acceptance criteria
- Save data serialization is portable.
- Cloud sync hook (no-op for now).
- Documented format.

---

## Milestone 105 — Cutscene system  **Owner:** Story + Gameplay
### Objective
Scripted story sequences.

### Acceptance criteria
- Cutscene player (text, camera, sprites).
- Cutscene data format.
- Skip option.
- Scenario `cutscene_system_smoke` runs.

---

## Milestone 106 — Photo mode stub  **Owner:** UI Systems + Gameplay
### Objective
Screenshot capture feature.

### Acceptance criteria
- Photo mode button.
- Hide UI option.
- Save screenshot to gallery.
- Scenario `photo_mode_smoke` runs.

---

## Milestone 107 — Achievements system stub  **Owner:** Gameplay + Data Systems
### Objective
Achievement tracking.

### Acceptance criteria
- Achievement data schema.
- Unlock trigger events.
- Achievement popup.
- Scenario `achievements_smoke` runs.

---

# Phase 6: Forest/Clubhouse Woods Expansion

---

## Milestone 108 — Forest entrance area  **Owner:** World Builder + Art Pipeline
### Objective
Transition from town to forest.

### Acceptance criteria
- Forest edge tilemap.
- Wooden arch/gate.
- Warning sign prop.
- Scenario `forest_entrance_render` runs.

---

## Milestone 109 — Forest path area  **Owner:** World Builder + Art Pipeline
### Objective
Main forest exploration zone.

### Acceptance criteria
- Dense tree tiles.
- Winding path.
- Mushroom props.
- Hidden alcoves.
- Scenario `forest_path_render` runs.

---

## Milestone 110 — Forest enemies: Angry Acorn  **Owner:** Art Pipeline + Battle Systems
### Objective
Forest-themed enemy.

### Acceptance criteria
- Acorn sprite with face.
- Roll attack animation.
- Scenario `enemy_acorn_battle` runs.

---

## Milestone 111 — Forest enemies: Sneaky Snake  **Owner:** Art Pipeline + Battle Systems
### Objective
Status-inflicting forest enemy.

### Acceptance criteria
- Snake sprite.
- Poison bite attack.
- Scenario `enemy_snake_battle` runs.

---

## Milestone 112 — Forest enemies: Grumpy Stump  **Owner:** Art Pipeline + Battle Systems
### Objective
Tanky forest enemy.

### Acceptance criteria
- Stump sprite (camouflaged).
- High defense stat.
- Scenario `enemy_stump_battle` runs.

---

## Milestone 113 — Clubhouse exterior  **Owner:** World Builder + Art Pipeline
### Objective
Secret clubhouse in woods.

### Acceptance criteria
- Treehouse structure.
- Rope ladder.
- "No Adults" sign.
- Scenario `clubhouse_exterior_render` runs.

---

## Milestone 114 — Clubhouse interior  **Owner:** World Builder + Art Pipeline
### Objective
Interior hangout space.

### Acceptance criteria
- Cozy room with pillows.
- Snack stash, comic books.
- Map on wall.
- Scenario `clubhouse_interior_render` runs.

---

## Milestone 115 — Forest: Hidden grove  **Owner:** World Builder + Art Pipeline
### Objective
Magical/special area.

### Acceptance criteria
- Glowing flowers.
- Fairy ring of mushrooms.
- Lore item pickup.
- Scenario `hidden_grove_render` runs.

---

## Milestone 116 — Forest battle backgrounds  **Owner:** Art Pipeline
### Objective
Forest combat visuals.

### Acceptance criteria
- Forest clearing background.
- Deep woods background.
- Grove background.
- Scenario `forest_bg_render` runs.

---

## Milestone 117 — Quest: Find the clubhouse  **Owner:** Story + Gameplay
### Objective
Exploration quest.

### Acceptance criteria
- Classmate mentions clubhouse.
- Navigate forest maze.
- Discover clubhouse location.
- Scenario `find_clubhouse_smoke` runs.

---

## Milestone 118 — Quest: Forest patrol  **Owner:** Story + Gameplay
### Objective
Combat quest in forest.

### Acceptance criteria
- Elder asks to clear creatures.
- Defeat 5 forest enemies.
- Receive forest passage permit.
- Scenario `forest_patrol_smoke` runs.

---

## Milestone 119 — Tool: Lantern  **Owner:** Gameplay + Art Pipeline
### Objective
Light-based puzzle tool.

### Acceptance criteria
- Lantern item obtainable.
- Lantern illuminates dark areas.
- Dark areas block without lantern.
- Scenario `lantern_smoke` runs.

---

## Milestone 120 — Forest: Dark hollow (lantern gated)  **Owner:** World Builder + Gameplay
### Objective
Area requiring lantern.

### Acceptance criteria
- Dark overlay effect.
- Lantern reveals path.
- Hidden treasure accessible.
- Scenario `dark_hollow_smoke` runs.

---

# Phase 7: Story Progression

---

## Milestone 121 — Story: Villain reveal  **Owner:** Story + Art Pipeline
### Objective
Antagonist introduction.

### Acceptance criteria
- Villain sprite.
- Confrontation cutscene.
- Villain escapes.
- Scenario `villain_reveal_smoke` runs.

---

## Milestone 122 — Story: Rally the town  **Owner:** Story + Gameplay
### Objective
Gathering allies.

### Acceptance criteria
- Talk to key NPCs.
- Each provides help/item.
- Party fully formed.
- Scenario `rally_town_smoke` runs.

---

## Milestone 123 — Story: Prepare for battle  **Owner:** Story + Gameplay
### Objective
Pre-finale preparation.

### Acceptance criteria
- Equipment check.
- Heal at clinic.
- Final save prompt.
- Scenario `prepare_battle_smoke` runs.

---

## Milestone 124 — Boss: Mini-boss encounter  **Owner:** Battle Systems + Art Pipeline
### Objective
Mid-game challenging fight.

### Acceptance criteria
- Mini-boss sprite and data.
- Unique attack pattern.
- Story progression on defeat.
- Scenario `miniboss_battle_smoke` runs.

---

## Milestone 125 — Story: Cliffhanger ending  **Owner:** Story + Art Pipeline
### Objective
Demo ending with hook.

### Acceptance criteria
- Villain escapes to next area.
- "To be continued" screen.
- Credits roll.
- Scenario `demo_ending_render` runs.

---

# Phase 8: Integration and Demo Polish

---

## Milestone 126 — Full demo playthrough scenario  **Owner:** QA Automation
### Objective
End-to-end automated playtest.

### Acceptance criteria
- Scenario runs from title to credits.
- All systems exercised.
- Trace captures full playthrough.
- Scenario `demo_playthrough_full` runs.

---

## Milestone 127 — Visual polish pass  **Owner:** Art Pipeline + UI Systems
### Objective
Consistent visual quality.

### Acceptance criteria
- All sprites pass validation.
- UI elements aligned.
- No placeholder art in demo.
- Visual regression baselines updated.

---

## Milestone 128 — Audio polish pass  **Owner:** Audio + QA Automation
### Objective
Complete audio coverage.

### Acceptance criteria
- Music for all areas.
- SFX for all interactions.
- Volume balanced.
- Scenario `audio_coverage_smoke` runs.

---

## Milestone 129 — Bug fix sweep  **Owner:** QA Automation + Gameplay
### Objective
Address known issues.

### Acceptance criteria
- Bug tracker cleared.
- Edge cases tested.
- Scenario regression suite passes.

---

## Milestone 130 — iOS build + TestFlight  **Owner:** QA Automation
### Objective
Distribute demo to testers.

### Acceptance criteria
- Export to iOS succeeds.
- TestFlight upload.
- Test on physical device.

---

## Milestone 131 — Performance profiling  **Owner:** QA Automation
### Objective
Ensure smooth performance.

### Acceptance criteria
- Profile on target device.
- No >16ms frame times.
- Memory usage acceptable.

---

## Milestone 132 — Localization stub  **Owner:** Data Systems
### Objective
Prepare for translation.

### Acceptance criteria
- All strings in translation file.
- Language selection UI stub.
- Scenario `localization_smoke` runs.

---

## Milestone 133 — Analytics stub  **Owner:** Data Systems
### Objective
Prepare for user analytics.

### Acceptance criteria
- Analytics event hooks.
- Session tracking.
- No actual data sent (stub).

---

## Milestone 134 — Crash reporting stub  **Owner:** Data Systems
### Objective
Error tracking preparation.

### Acceptance criteria
- Exception handler.
- Log to file.
- Upload hook (no-op).

---

## Milestone 135 — Final demo build  **Owner:** QA Automation
### Objective
Release-ready demo.

### Acceptance criteria
- All scenarios pass.
- All visual baselines match.
- Build archived with version tag.

---

# Future Biomes (Scaffolding)

---

## Milestone 136 — Bubblegum Bay scaffold  **Owner:** World Builder + Art Pipeline
### Objective
Beach biome setup.

### Acceptance criteria
- Biome docs created.
- Palette defined.
- Stub area scene.
- Scenario `bubblegum_bay_stub` runs.

---

## Milestone 137 — Pinecone Pass scaffold  **Owner:** World Builder + Art Pipeline
### Objective
Mountain biome setup.

### Acceptance criteria
- Biome docs created.
- Palette defined.
- Stub area scene.
- Scenario `pinecone_pass_stub` runs.

---

## Milestone 138 — Enchanted Forest scaffold  **Owner:** World Builder + Art Pipeline
### Objective
Magical forest biome setup.

### Acceptance criteria
- Biome docs created.
- Palette defined.
- Stub area scene.
- Scenario `enchanted_forest_stub` runs.

---

# Infrastructure and Tooling Improvements

---

## Milestone 139 — CI: GitHub Actions workflow  **Owner:** QA Automation
### Objective
Automated CI on push.

### Acceptance criteria
- Workflow file in `.github/workflows/`.
- Runs smoke, tests, spec-check.
- PR checks required.

---

## Milestone 140 — CI: Visual regression in CI  **Owner:** QA Automation
### Objective
Automated visual diffing.

### Acceptance criteria
- Rendered scenarios run in CI.
- Diff report uploaded as artifact.
- Failure on unexpected changes.

---

## Milestone 141 — Scenario authoring documentation  **Owner:** QA Automation
### Objective
Guide for writing scenarios.

### Acceptance criteria
- Tutorial in `docs/testing/`.
- Example scenarios commented.
- Best practices listed.

---

## Milestone 142 — Asset pipeline automation  **Owner:** Art Pipeline
### Objective
One-command asset processing.

### Acceptance criteria
- `just assets` processes all.
- Validation + packing + import.
- Errors reported clearly.

---

## Milestone 143 — Content hot reload  **Owner:** Gameplay + Data Systems
### Objective
Change data without restart.

### Acceptance criteria
- Data files watched.
- Reload on change.
- Scenario `hot_reload_smoke` runs.

---

## Milestone 144 — Debug console  **Owner:** Gameplay + UI Systems
### Objective
In-game debug commands.

### Acceptance criteria
- Toggle debug console.
- Commands: spawn, teleport, heal.
- Scenario `debug_console_smoke` runs.

---

## Milestone 145 — Cheat codes for testing  **Owner:** Gameplay
### Objective
Developer shortcuts.

### Acceptance criteria
- Infinite health toggle.
- Skip to area command.
- Disabled in release builds.

---

# Content Expansion Stubs

---

## Milestone 146 — Additional party member: Scout  **Owner:** Art Pipeline + Battle Systems
### Objective
Optional party member.

### Acceptance criteria
- Scout character sprites.
- Recruitment quest stub.
- Battle integration.
- Scenario `scout_recruit_stub` runs.

---

## Milestone 147 — Additional party member: Bookworm  **Owner:** Art Pipeline + Battle Systems
### Objective
Magic-focused party member.

### Acceptance criteria
- Bookworm sprites.
- Magic skills.
- Recruitment quest stub.
- Scenario `bookworm_recruit_stub` runs.

---

## Milestone 148 — Pet variants  **Owner:** Art Pipeline + Character Systems
### Objective
Multiple pet options.

### Acceptance criteria
- Dog, cat, hamster options.
- Pet selection at game start.
- Different pet skills.
- Scenario `pet_variants_smoke` runs.

---

## Milestone 149 — Minigame: Fishing  **Owner:** Gameplay + Art Pipeline
### Objective
Fishing minigame.

### Acceptance criteria
- Fishing spot interactions.
- Cast/catch mechanic.
- Fish item rewards.
- Scenario `fishing_minigame_smoke` runs.

---

## Milestone 150 — Minigame: Bug catching  **Owner:** Gameplay + Art Pipeline
### Objective
Collection minigame.

### Acceptance criteria
- Net tool.
- Bugs spawn in grass.
- Bug collection log.
- Scenario `bug_catching_smoke` runs.

---

## Milestone 151 — Collection log system  **Owner:** Gameplay + UI Systems
### Objective
Track collectibles.

### Acceptance criteria
- Creatures/items logged.
- Completion percentage.
- Rewards for milestones.
- Scenario `collection_log_smoke` runs.

---

## Milestone 152 — Seasonal events stub  **Owner:** Data Systems + Story
### Objective
Holiday/seasonal content.

### Acceptance criteria
- Event data schema.
- Date-based activation.
- Placeholder event.
- Scenario `seasonal_event_stub` runs.

---

## Milestone 153 — Daily challenges stub  **Owner:** Gameplay + Data Systems
### Objective
Replayable daily content.

### Acceptance criteria
- Challenge data schema.
- Daily rotation logic.
- Reward on completion.
- Scenario `daily_challenge_stub` runs.

---

## Milestone 154 — Trading system stub  **Owner:** Gameplay + UI Systems
### Objective
Item trading between players.

### Acceptance criteria
- Trade UI mockup.
- Trade offer/accept flow.
- Placeholder only (no networking).
- Scenario `trading_stub` runs.

---

## Milestone 155 — Photo sticker system  **Owner:** UI Systems + Art Pipeline
### Objective
Decorate photos.

### Acceptance criteria
- Sticker overlay UI.
- Sticker unlocks.
- Save decorated photo.
- Scenario `photo_sticker_smoke` runs.

---

## Milestone 156 — Home customization stub  **Owner:** Gameplay + Art Pipeline
### Objective
Decorate hero's room.

### Acceptance criteria
- Furniture placement UI.
- Furniture items.
- Persistent room state.
- Scenario `home_customize_stub` runs.

---

## Milestone 157 — Costume/outfit system  **Owner:** Character Systems + Art Pipeline
### Objective
Alternate character appearances.

### Acceptance criteria
- Outfit data schema.
- Outfit selection UI.
- Sprite swapping.
- Scenario `costume_smoke` runs.

---

## Milestone 158 — Pet accessories  **Owner:** Character Systems + Art Pipeline
### Objective
Dress up the pet.

### Acceptance criteria
- Accessory data.
- Accessory UI.
- Pet sprite overlay.
- Scenario `pet_accessory_smoke` runs.

---

## Milestone 159 — NPC schedules: Weekend  **Owner:** Character Systems
### Objective
NPCs in different weekend locations.

### Acceptance criteria
- Weekend schedule data.
- Weekend-specific dialogue.
- Scenario `npc_weekend_smoke` runs.

---

## Milestone 160 — School: After-school activities  **Owner:** World Builder + Story
### Objective
Clubs and activities.

### Acceptance criteria
- Club room scenes.
- Club NPCs.
- After-school timeblock.
- Scenario `after_school_smoke` runs.

---

# Documentation and Maintenance

---

## Milestone 161 — Style guide documentation  **Owner:** Art Pipeline
### Objective
Visual style reference.

### Acceptance criteria
- Character design guidelines.
- Environment guidelines.
- Color usage rules.
- Published in `docs/art/`.

---

## Milestone 162 — Code style guide  **Owner:** QA Automation
### Objective
Consistent code conventions.

### Acceptance criteria
- GDScript style rules.
- Naming conventions.
- Linter config.
- Published in `docs/`.

---

## Milestone 163 — Scenario catalog  **Owner:** QA Automation
### Objective
List all scenarios.

### Acceptance criteria
- Auto-generated catalog.
- Scenario descriptions.
- Published in `docs/testing/`.

---

## Milestone 164 — Content catalog  **Owner:** Data Systems
### Objective
List all game content.

### Acceptance criteria
- Enemies, items, skills listed.
- Auto-generated from data.
- Published in `docs/`.

---

## Milestone 165 — Changelog automation  **Owner:** QA Automation
### Objective
Auto-generated changelog.

### Acceptance criteria
- Changelog from commits.
- Version tagging.
- Published with releases.

---

# Stretch Goals

---

## Milestone 166 — Multiplayer co-op exploration stub  **Owner:** Gameplay + Data Systems
### Objective
Future multiplayer preparation.

### Acceptance criteria
- Player state serialization.
- Network message schema.
- Placeholder only.

---

## Milestone 167 — Voice acting hooks  **Owner:** Audio + Data Systems
### Objective
Future voice integration.

### Acceptance criteria
- Dialogue audio slots.
- Audio file naming convention.
- Placeholder files.

---

## Milestone 168 — Accessibility: Screen reader support  **Owner:** UI Systems
### Objective
Improve accessibility.

### Acceptance criteria
- UI elements labeled.
- Screen reader compatible.
- Scenario `screen_reader_smoke` runs.

---

## Milestone 169 — Colorblind mode  **Owner:** Art Pipeline + UI Systems
### Objective
Alternative palettes.

### Acceptance criteria
- Deuteranopia palette.
- Protanopia palette.
- Toggle in settings.
- Scenario `colorblind_render` runs.

---

## Milestone 170 — Dyslexia-friendly font option  **Owner:** UI Systems
### Objective
Alternative font.

### Acceptance criteria
- OpenDyslexic or similar font.
- Font toggle in settings.
- Scenario `dyslexia_font_render` runs.

---

## Milestone 171 — Reduced motion mode  **Owner:** UI Systems + Gameplay
### Objective
Accessibility option.

### Acceptance criteria
- Disable screen shake.
- Disable flashing effects.
- Toggle in settings.
- Scenario `reduced_motion_smoke` runs.

---

## Milestone 172 — One-handed mode  **Owner:** UI Systems
### Objective
Play with one hand.

### Acceptance criteria
- Compact control layout.
- Toggle in settings.
- Scenario `one_handed_render` runs.

---

# Long-term Content Milestones

---

## Milestone 173 — Villain backstory quests  **Owner:** Story
### Objective
Expand antagonist motivation.

### Acceptance criteria
- 3 backstory-revealing quests.
- Sympathy/complexity.
- Scenario stubs.

---

## Milestone 174 — Secret ending conditions  **Owner:** Story + Gameplay
### Objective
Alternate ending.

### Acceptance criteria
- Hidden conditions tracked.
- Alternate final scene.
- Scenario `secret_ending_stub` runs.

---

## Milestone 175 — New Game Plus  **Owner:** Gameplay + Data Systems
### Objective
Replayability feature.

### Acceptance criteria
- NG+ mode available after credits.
- Carry over stats/items.
- Harder enemies.
- Scenario `new_game_plus_stub` runs.

---

## Milestone 176 — Speedrun mode  **Owner:** Gameplay + UI Systems
### Objective
Speedrunner features.

### Acceptance criteria
- In-game timer.
- Skip cutscenes option.
- Splits display.
- Scenario `speedrun_mode_smoke` runs.

---

## Milestone 177 — Boss rush mode  **Owner:** Gameplay
### Objective
Combat challenge mode.

### Acceptance criteria
- Sequential boss fights.
- Leaderboard stub.
- Scenario `boss_rush_stub` runs.

---

## Milestone 178 — Art gallery  **Owner:** UI Systems + Art Pipeline
### Objective
Unlockable art viewer.

### Acceptance criteria
- Gallery scene.
- Concept art unlocks.
- Zoom/pan controls.
- Scenario `art_gallery_smoke` runs.

---

## Milestone 179 — Sound test  **Owner:** Audio + UI Systems
### Objective
Music/SFX player.

### Acceptance criteria
- Jukebox UI.
- Track list.
- Now playing display.
- Scenario `sound_test_smoke` runs.

---

## Milestone 180 — Credits roll  **Owner:** UI Systems + Story
### Objective
End-of-game credits.

### Acceptance criteria
- Scrolling credits.
- Character vignettes.
- Music plays.
- Scenario `credits_render` runs.

---

# Testing Depth

---

## Milestone 181 — Edge case: Inventory full  **Owner:** QA Automation
### Objective
Handle full inventory.

### Acceptance criteria
- Cannot pick up when full.
- UI message shown.
- Scenario `inventory_full_smoke` runs.

---

## Milestone 182 — Edge case: Save corruption recovery  **Owner:** QA Automation + Data Systems
### Objective
Handle bad save files.

### Acceptance criteria
- Detect corrupted save.
- Offer recovery/delete.
- Scenario `save_corruption_smoke` runs.

---

## Milestone 183 — Edge case: Rapid input spam  **Owner:** QA Automation
### Objective
Handle mashing buttons.

### Acceptance criteria
- No crashes on spam.
- Input debouncing.
- Scenario `input_spam_smoke` runs.

---

## Milestone 184 — Edge case: Low memory warning  **Owner:** QA Automation
### Objective
Handle memory pressure.

### Acceptance criteria
- Memory warning logged.
- Non-essential resources freed.
- Game continues.

---

## Milestone 185 — Edge case: Interrupted transitions  **Owner:** QA Automation
### Objective
Handle app backgrounding mid-transition.

### Acceptance criteria
- Resume to stable state.
- No stuck screens.
- Scenario `interrupted_transition_smoke` runs.

---

# Final Polish

---

## Milestone 186 — Splash screen + legal  **Owner:** UI Systems
### Objective
Startup screens.

### Acceptance criteria
- Studio logo.
- Legal text.
- Skip on tap.
- Scenario `splash_render` runs.

---

## Milestone 187 — App icon and metadata  **Owner:** Art Pipeline
### Objective
Store listing assets.

### Acceptance criteria
- App icon (all sizes).
- Screenshots.
- Description text.

---

## Milestone 188 — Privacy policy compliance  **Owner:** Data Systems
### Objective
Legal compliance.

### Acceptance criteria
- Privacy policy link.
- Data usage disclosure.
- No third-party tracking without consent.

---

## Milestone 189 — Age rating preparation  **Owner:** QA Automation
### Objective
App store rating.

### Acceptance criteria
- Content review checklist.
- Rating questionnaire answers.
- No mature content.

---

## Milestone 190 — App Store submission  **Owner:** QA Automation
### Objective
Submit for review.

### Acceptance criteria
- Build uploaded.
- Metadata complete.
- Submitted for review.

---

# Post-Launch Stubs

---

## Milestone 191 — Feedback collection UI  **Owner:** UI Systems
### Objective
In-app feedback.

### Acceptance criteria
- Feedback button in menu.
- Text input.
- Submit action (stub).

---

## Milestone 192 — Update notification system  **Owner:** UI Systems + Data Systems
### Objective
Alert users to updates.

### Acceptance criteria
- Version check on launch.
- Update prompt if outdated.
- Link to store.

---

## Milestone 193 — Patch notes display  **Owner:** UI Systems
### Objective
Show what's new.

### Acceptance criteria
- What's New popup.
- Shown once per version.
- Dismiss button.

---

## Milestone 194 — Seasonal update: Halloween  **Owner:** Art Pipeline + Story
### Objective
Halloween event.

### Acceptance criteria
- Costume items.
- Decorated town.
- Themed quests.

---

## Milestone 195 — Seasonal update: Winter  **Owner:** Art Pipeline + Story
### Objective
Winter event.

### Acceptance criteria
- Snow overlays.
- Winter clothing.
- Gift exchange quest.

---

## Milestone 196 — Expansion: New area teaser  **Owner:** Story + Art Pipeline
### Objective
Tease next content.

### Acceptance criteria
- "Coming Soon" sign in-game.
- Silhouette of new area.
- Quest hook.

---

## Milestone 197 — Community event framework  **Owner:** Gameplay + Data Systems
### Objective
Time-limited events.

### Acceptance criteria
- Event scheduling.
- Unique rewards.
- Event UI.

---

## Milestone 198 — Merchandise integration stub  **Owner:** UI Systems
### Objective
Future merch links.

### Acceptance criteria
- Shop button placeholder.
- External link handling.
- No actual commerce.

---

## Milestone 199 — Social sharing  **Owner:** UI Systems
### Objective
Share progress.

### Acceptance criteria
- Share button.
- Generate shareable image.
- Social platform hooks.

---

## Milestone 200 — Launch retrospective  **Owner:** QA Automation
### Objective
Document learnings.

### Acceptance criteria
- What worked well.
- What to improve.
- Next project recommendations.
- Published in `docs/`.
