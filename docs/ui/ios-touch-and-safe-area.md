# iOS touch + safe area

## Goals
- Landscape-only UI
- Touch controls must not overlap the iPhone notch/home indicator safe area

## Implementation notes
- Use Godot's safe-area API to place interactive controls within the safe area.
- Touch controls should be implemented as a reusable `TouchControls.tscn`.
