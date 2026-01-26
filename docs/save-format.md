# Save Data Format

This document describes the save file format for Wilds of Cloverhollow.

## Overview

Save files are stored as JSON in `user://saves/save_slot_N.json` where N is 0, 1, or 2.

## Schema

```json
{
  "version": 1,
  "timestamp": 1737907200,
  "current_area": "res://game/scenes/areas/Area_TownCenter.tscn",
  "player_position": {
    "x": 256.0,
    "y": 144.0
  },
  "inventory": {
    "tools": ["lantern", "journal"],
    "items": {
      "potion": 3,
      "ether": 1
    }
  },
  "story_flags": {
    "talked_to_teacher": true,
    "forest_unlocked": false,
    "quest_accepted_chaos_investigation": true
  }
}
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `version` | int | Save format version for migrations (currently 1) |
| `timestamp` | int | Unix timestamp when save was created |
| `current_area` | string | Scene path of the current area |
| `player_position.x` | float | Player X coordinate in the area |
| `player_position.y` | float | Player Y coordinate in the area |
| `inventory.tools` | array[string] | List of acquired tool IDs |
| `inventory.items` | dict[string, int] | Map of item ID to quantity |
| `story_flags` | dict[string, bool] | Map of story flag names to values |

## Version History

| Version | Changes |
|---------|---------|
| 1 | Initial format |

## Portability

The save format is designed for cloud sync compatibility:

- Pure JSON (no binary data)
- Platform-independent paths (scene paths use `res://` prefix)
- Unix timestamps (portable across timezones)
- No device-specific identifiers

## Cloud Sync Hooks

SaveManager provides stub methods for future cloud sync:

- `cloud_upload(slot)` - Upload save to cloud (no-op)
- `cloud_download(slot)` - Download save from cloud (no-op)
- `cloud_has_newer_save(slot)` - Check for newer cloud save (returns false)
- `get_save_data_json(slot)` - Get raw JSON for upload
- `import_save_data_json(slot, json)` - Import JSON from download

Signals:
- `cloud_sync_started` - Emitted when sync begins
- `cloud_sync_completed(success)` - Emitted when sync ends
- `cloud_conflict_detected(local_ts, cloud_ts)` - Emitted on timestamp conflict

## Migration Strategy

When updating the save format:

1. Increment `SAVE_VERSION` in SaveManager.gd
2. Add migration logic in `_apply_save_data()` to handle old versions
3. Document changes in this file's Version History
