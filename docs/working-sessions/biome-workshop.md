# Biome workshop (repeatable process)

This is the repeatable process for designing and shipping a new biome pack.

The goal: you should be able to add a biome without reinventing art style or changing core systems.

This doc complements:
- `docs/biomes/checklist.md` (ship checklist)
- `docs/biomes/BIOME_TEMPLATE.md` (documentation template)

---

## Phase 0 — Preconditions (town-first)

Before you start a new biome, Cloverhollow must be stable:
- Cloverhollow palette + pixel kit settings exist and are versioned.
- At least 10 Cloverhollow props exist and look consistent.
- At least one enemy family exists (overworld + battle sprites) and can be reused as a template.

If any of these are missing, do not start a new biome. Build the style lock first.

---

## Phase 1 — Biome brief (30–60 minutes)

Create a one-page brief under `docs/biomes/<biome_id>/biome.md`:

### 1) One-line pitch
- Example: "A bright beach town where candy-colored boardwalk lights contrast with calm ocean blues."

### 2) Gameplay purpose
- What does the player learn here?
- What tool/party member/plot beat is introduced here?

### 3) Emotional palette
Pick 4–6 adjectives:
- cozy, breezy, playful, sparkling, etc.

### 4) Landmarks + loop
- 1 iconic landmark (visible from multiple angles)
- 1 "main loop" path that naturally guides new players

### 5) Architecture + prop motifs
- 3 motif words that constrain generation (e.g., "shingled roofs", "rounded windows", "wooden docks")

### 6) Enemy fantasy (visible enemies)
- 2–3 enemy families that fit the biome
- 1 "leader" enemy (later miniboss)

### 7) Battle background needs
- 2–3 diorama concepts
- 1 must be the "signature" background for the biome

Output: a brief that is readable by both humans and agents.

---

## Phase 2 — Palette + pixel kit (style lock for the biome)

### 1) Generate mood references
Use AI to generate 10–20 reference images for the biome.
These are not final assets; they are inputs to palette selection.

### 2) Choose palette structure
Every biome has:
- `art/palettes/<biome_id>.palette.json`
- pixel kit settings (resolution + pixels-per-meter)

Rules:
- Shared common palette remains unchanged.
- The biome palette should be small and purposeful.

Recommended starting targets:
- 24 biome colors
- 3-step value ramp baked into palette values

### 3) Validate palette + pixel kit
Run `tools/python/validate_assets.py` (once implemented) and ensure:
- the palette file loads
- pixel kit settings are present and integer-scaled

---

## Phase 3 — Prop kit plan (what must exist for this biome)

Create `docs/biomes/<biome_id>/asset-list.md` and list:

### Minimum (MVP)
- 10 props total
- 1 landmark prop
- 2–4 signage/wayfinding props
- 1 interactable container prop

### Recommended categories
- ground clutter (3)
- structural pieces (3)
- interaction props (2)
- landmark + signage (2+)

---

## Phase 4 — Area plan (discrete scenes)

Create `docs/biomes/<biome_id>/scenes.md`.

Recommended MVP structure:
- 1 exterior hub scene
- 1 small interior scene (shop/cafe)
- 1 path scene (connecting route)

Each scene must define:
- entrances/exits
- spawn marker IDs
- navigation + collision assumptions
- where visible enemies spawn

---

## Phase 5 — Enemy roster (content + mechanics)

Define the enemy families in `docs/biomes/<biome_id>/biome.md` and create stubs under:
- `game/data/enemies/<enemy_id>.tres` (or JSON, depending on the data spine)

For each enemy family, define:
- visual theme (1–2 sentences)
- role (tank, support, fast, status)
- 1 signature move

---

## Phase 6 — Battle backgrounds

For each biome:
- Create 2–3 background recipes under `art/recipes/battle_backgrounds/<biome_id>/`.
- Bake at 960×540 and scale to 1920×1080 with nearest-neighbor integer scaling.

---

## Phase 7 — Build, test, and lock

1) Create the biome pack folders with `tools/python/new_biome.py` (or the opencode command).
2) Build the first hub area scene in Godot using placeholder props.
3) Add one visible enemy spawner.
4) Add one Scenario Runner scenario for the biome.
5) Only then begin generating the real prop kit and enemy sprites.

---

## "Biome Definition of Done" (MVP)

A biome is considered MVP-complete when:
- The hub scene loads and is navigable.
- The palette + pixel kit are locked and validated.
- At least 10 props exist and match style.
- At least 3 enemy families exist (at least one fully implemented).
- At least 2 battle backgrounds exist.
- At least one automated scenario passes and produces artifacts.
