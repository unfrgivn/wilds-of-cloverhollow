---
name: e2e-tests-gdunit4
description: End-to-end tests in Godot using GdUnit4
compatibility: opencode
---
# Skill (Optional): Add Headless E2E Tests (GdUnit4)

This skill is optional. For Godot **4.5**, the recommended baseline in this repo is **GUT** (see `07-e2e-tests-gut.md`),
because Godot 4.5 API changes may require a specific GdUnit4 major version.

If you choose to use GdUnit4 anyway:

## Steps
1. Install GdUnit4 into `addons/gdUnit4` (pin a version compatible with Godot 4.5).
2. Create E2E tests using GdUnit4’s scene runner/input simulation:
   - demo smoke
   - item pickup
   - transitions
   - quest completion

## CLI
```bash
godot --headless --path . --script addons/gdUnit4/bin/GdUnitCmdTool.gd -a test
```
