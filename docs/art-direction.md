# Art Direction — Cloverhollow (SNES-inspired readability + cozy storybook look)

## Goal

Achieve **EarthBound-like readability and pacing** (tight town layout, cutaway interiors, quirky props) using **original art** that matches the provided concept samples.

Primary reference pack:
- `art/reference/concepts/` (user-provided samples)

## Non-negotiables
- Do **not** copy EarthBound sprites, tiles, UI bitmaps, maps, or text.
- Avoid “direct redraws” of recognizable EarthBound rooms or towns.
- Use EarthBound only for *structural* inspiration: how rooms are staged, how the town reads, how fast interactions are.

## Camera & perspective

The game uses a **top-down/oblique** viewpoint (not strict isometric simulation).

For interiors, target the “cutaway room” staging:
- visible floor plane
- partial walls (back + one side)
- props arranged along edges so the walkable lane remains readable

The provided interior concepts (bedroom, school hall, arcade) are the baseline style:
- soft shading
- clean outlines
- warm/ambient lighting

## Visual cohesion strategy (recommended)

Even when source art is not pixel art, we can maintain “SNES cohesiveness” by:
- rendering to a **low-resolution SubViewport**, then scaling up
- limiting UI font sizes and contrast to stay legible at the chosen internal resolution

Keep this as a toggle so the team can decide based on playtest feel.

## Characters

### Scale rules
- Use a single, consistent “character height” across all scenes.
- Doorways, desks, beds, and arcade machines should be sized relative to that height.

### Animation expectations
Preferred for exploration:
- 4-direction walk cycles (idle + 2–4 step frames per direction)

Acceptable for the first playable:
- single idle pose per direction, with a subtle procedural bob and footstep SFX placeholders.

## Props & interactables

The game should be dense with “checkable” props, but navigable:
- place interactables near edges or at “ends” of lanes
- avoid center clutter that blocks pathing

Target prop categories:
- home: bed, desk, shelves, toys/posters, lamp
- school: lockers, bulletin board, trophy case, classroom door
- arcade: cabinets, claw machine, ticket counter, gumball machines

## Color + mood

Cozy base with periodic “weird” accents:
- warm neutrals for homes and civic buildings
- bright candy colors for arcade signage and collectibles
- occasional neon/glow cues (blacklight lantern, hypnotic eyes, hidden sigils)

The weirdness should feel “just under the surface,” not horror-forward in the demo.

## UI style

The provided UI sample suggests a “sticker” UI language:
- rounded shapes
- clear outlines
- icon-driven counters
- speech-bubble interaction prompts

The demo should implement:
- dialogue box
- interaction prompt (“Press [key] to …”)
- simple inventory list
- simple counters (Candy, Gems, etc.)

## Deliverables for the demo

Minimum art needed to ship a playable demo (placeholders allowed initially):
- Fae exploration sprite(s)
- Cloverhollow town exterior backdrop/tiles + collisions
- Fae house bedroom + hall/living room
- School interior hall
- Arcade interior
- 10–20 props/collectible icons
