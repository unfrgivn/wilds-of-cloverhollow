# Changelog — Cloverhollow Demo

All notable changes to this project are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Feature specification interview workflow in AGENTS.md — agents must interview user and update spec.md before implementing new features
- TODO.md for phased task tracking
- CHANGELOG.md for tracking completed work

### Changed
- (none yet)

### Fixed
- (none yet)

---

## Session History

### 2026-01-11 — Agent Workflow & Documentation

**Focus**: Establishing agent workflows and project documentation standards.

**Changes**:
- Added mandatory feature specification interview workflow to AGENTS.md
- Created TODO.md with phased task breakdown for demo
- Created CHANGELOG.md for tracking changes

---

### 2026-01-XX — Arcade & Claw Machine Mini-Game

**Focus**: Playable claw machine mini-game in Arcade.

**Changes**:
- Created claw machine mini-game (`scripts/minigames/claw_game.gd`)
- Added claw machine interactable (`scripts/interactables/claw_machine.gd`)
- Generated claw machine background art
- Fixed Maddie companion persistence across scenes
- Fixed variable declaration bugs in claw game

**Known Issues**:
- Claw machine prizes not connected to inventory yet
- Play cost not deducted from candy

---

### 2026-01-XX — Art Style Upgrade

**Focus**: Upgrading all artwork to cozy watercolor illustration style.

**Changes**:
- Replaced placeholder pixel art with watercolor-style environments
- Generated new backgrounds: town, bedroom, living room, hall, nursery, school, arcade
- Fixed player sprite scaling (3x scale for 32px sprites)
- Configured viewport 640x480, window 1280x960
- Added F3 debug overlay for coordinate logging
- Fixed NPC "sticker outline" artifacts using ImageMagick erosion

**Art Style Established**:
- Soft watercolor with diffuse warm lighting
- Warm pastel palette (cream, beige, lavender, pink, blue)
- Dark brown/sepia outlines (not black)
- Isometric "dollhouse cutaway" perspective

---

## Version History

<!-- Future releases will be documented here -->
<!-- Example:
## [0.1.0] — 2026-02-XX
### Added
- Playable demo with complete "Hollow Light" quest
-->

