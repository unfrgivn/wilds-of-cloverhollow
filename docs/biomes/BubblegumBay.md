# Bubblegum Bay

## Summary
- **Biome id:** `bubblegum_bay`
- **Fantasy:** pastel beach town with candy-colored sand and surf
- **Gameplay purpose:** first travel biome with a single encounter and return path

## Visual identity
- **Palette:** `art/palettes/bubblegum_bay.palette.json`
- **Pixel kit:** resolution + pixels-per-meter (see art docs)
- **Landmark:** shore-side bus stop and pink sand flats

## Areas
| Area | Scene | Notes |
| --- | --- | --- |
| Shore | `res://game/scenes/areas/bubblegum_bay/Area_BubblegumBay_Shore.tscn` | Entry area with return door |

## NPCs
| NPC | Notes |
| --- | --- |
| (TBD) | Add when shoreline story beats exist |

## Props
| Prop | Notes |
| --- | --- |
| Bench, lamp, rock, bush, barrel | Reused Cloverhollow kit until beach kit lands |

## Enemies
| Enemy | Notes |
| --- | --- |
| `slime_a` | Placeholder encounter |
| `slime_b` | Placeholder encounter |

## Encounters
| Encounter | Enemies | Notes |
| --- | --- | --- |
| `bubblegum_bay_encounter` | `slime_a`, `slime_b` | Single test encounter |

## Battle backgrounds
| Background | Biome | Notes |
| --- | --- | --- |
| `shore` | `bubblegum_bay` | Simple sky + sand |
