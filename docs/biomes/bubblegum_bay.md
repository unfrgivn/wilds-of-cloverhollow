# Bubblegum Bay Biome Checklist

**Biome ID:** `bubblegum_bay`
**Type:** wilderness
**Status:** 🚧 In Progress

## Required Assets

### Palette
- [ ] Define 6-12 biome-specific colors in `art/palettes/bubblegum_bay.palette.json`
- [ ] Colors must complement global_ui_skin palette

### Tileset
- [ ] Create `game/assets/tilesets/bubblegum_bay/tileset.png` (128x128 minimum)
- [ ] All tiles 16x16
- [ ] Quantized to biome + global palette

### Props
- [ ] At least 3 unique props for the biome
- [ ] Stored in `game/assets/sprites/props/bubblegum_bay/`

### Enemies
- [ ] At least 1 unique enemy type
- [ ] Entry in `game/data/enemies/enemies.json`
- [ ] Sprite in `game/assets/sprites/enemies/`

### Battle Background
- [ ] Create `game/assets/backgrounds/battle/bubblegum_bay.png` (512x288)

## Required Data

### Biome Definition
- [x] `game/data/biomes/bubblegum_bay.json` created

### Encounters
- [x] `game/data/encounters/bubblegum_bay.json` created
- [ ] Configure encounter_rate
- [ ] Add biome-appropriate enemies

## Required Scenes

### Area Scene
- [ ] Create `game/scenes/areas/Area_bubblegum_bay.tscn`
- [ ] Include Player, spawn markers, area transitions
- [ ] At least one enemy spawn
- [ ] At least one interactable (sign/NPC)

## Testing

### Scenario
- [x] `tests/scenarios/bubblegum_bay_exploration_smoke.json` created
- [ ] Scenario runs without errors
- [ ] Captures generated successfully

## Sign-off

- [ ] All checklist items complete
- [ ] Spec.md updated if needed
- [ ] Visual regression baseline captured
