---
description: Audit scenes for missing spawns, collisions, nav, and interactables
agent: world-scene-builder
---
Audit the current scenes for common demo-breakers:
- missing or misnamed spawn markers
- doors without destinations
- missing collisions on walls/props
- missing navigation surfaces
- interactables without prompts/actions
- visible enemy spawners placed in unreachable areas

Return a checklist and the exact files that need edits.
