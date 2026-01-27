# Voice Acting Audio File Conventions

This document defines the naming and organization conventions for voice acting audio files.

## Directory Structure

```
game/assets/audio/voice/
├── placeholder.ogg           # Default placeholder for missing files
├── fae/                      # Character name (lowercase)
│   ├── intro/               # Scene/conversation ID
│   │   ├── 001.ogg         # Line number (3 digits, zero-padded)
│   │   ├── 002.ogg
│   │   └── ...
│   ├── bedroom/
│   │   ├── 001.ogg
│   │   └── ...
│   └── battle/
│       └── ...
├── elder/
│   └── ...
├── teacher/
│   └── ...
└── ...
```

## Audio ID Format

Audio IDs follow the pattern: `{character}_{scene}_{line}`

Examples:
- `fae_intro_001` → `voice/fae/intro/001.ogg`
- `elder_park_003` → `voice/elder/park/003.ogg`
- `teacher_classroom_012` → `voice/teacher/classroom/012.ogg`

## Naming Rules

1. **Character names**: Lowercase, snake_case for compound names
   - `fae`, `elder`, `teacher`, `mayor_thornwood`

2. **Scene IDs**: Lowercase, snake_case
   - `intro`, `bedroom`, `first_class`, `chaos_investigation`

3. **Line numbers**: 3-digit zero-padded integers
   - `001`, `002`, ..., `999`

## Audio Specifications

| Property | Value |
|----------|-------|
| Format | OGG Vorbis (.ogg) |
| Sample rate | 44.1 kHz |
| Channels | Mono |
| Bit rate | 96-128 kbps |
| Normalization | -3 dB peak |

## Integration with DialogueManager

To add voice to dialogue:

1. Place audio file in correct directory
2. DialogueManager will automatically call `VoiceActingManager.play_dialogue_voice(speaker, line_index, scene_id)`
3. VoiceActingManager handles playback and interruption

## Placeholder Files

If a voice file is missing, VoiceActingManager falls back to `placeholder.ogg`.
This allows development to continue before all voice files are recorded.

## Character List

| Character | ID | Notes |
|-----------|-----|-------|
| Fae | `fae` | Main character |
| Pet (Maddie) | `maddie` | Pet cat |
| Pet (Buddy) | `buddy` | Pet dog |
| Pet (Nibbles) | `nibbles` | Pet hamster |
| Elder | `elder` | Town elder |
| Teacher | `teacher` | School teacher |
| Mom | `mom` | Fae's mother |
| Mayor | `mayor` | Mayor Thornwood |
| Librarian | `librarian` | Town librarian |
| Baker | `baker` | Café baker |
| Blacksmith | `blacksmith` | Ironhammer |
| Doctor | `doctor` | Dr. Willowmere |
| Shopkeeper | `shopkeeper` | General store |
| Arcade Owner | `buzz` | Pixel Palace |
| Pet Clerk | `clover` | Pet shop |
| Chaos Lord | `chaos_lord` | Main villain |

## Battle Voice Lines

Battle voices use special scene IDs:
- `battle_attack` - Attack callouts
- `battle_defend` - Defend stance
- `battle_skill_{skill_id}` - Skill-specific lines
- `battle_hurt` - Taking damage
- `battle_victory` - Victory celebration
- `battle_defeat` - Defeat reactions

Example: `fae_battle_attack_001`
