# Reference Notes — EarthBound Feel (Inspiration Only)

This project is inspired by the **experience** of classic SNES RPG town exploration (especially EarthBound),
but must remain **fully original** in assets, writing, and layout specifics.

Use EarthBound references for:
- pacing and readability
- town composition logic
- how interiors “stage” interactables
- interaction frequency (lots of “Check” targets)

Do not copy:
- sprites/tiles/UI bitmaps
- music
- dialogue
- exact town maps or room compositions

## 1. Town composition principles worth emulating
- **Compact hub**: services are close together so the player learns the town fast.
- **Clear landmarks**: a center plaza or signature building helps navigation.
- **Residential vs civic**: home area is quiet; civic/commercial core is active.
- **Edges imply scale**: visible exits that are blocked/locked in the demo suggest a larger world.

Suggested Cloverhollow equivalents:
- home (Fae’s House)
- school
- arcade
- shop/café (optional in demo)

## 2. Interaction cadence principles
- A single context action (“Talk/Check”) does most of the work.
- Many objects are interactable even if they only provide flavor text.
- Dialogue is short and punchy; avoid long paragraphs early.

## 3. Scene transitions
- Enter/exit buildings frequently.
- Keep transitions snappy (short fade).
- Always spawn the player in a predictable spot near the relevant door.

## 4. Weird stakes tone (for Cloverhollow)
EarthBound’s tone often shifts from mundane to uncanny. For Cloverhollow:
- keep environments cozy
- introduce one “off” element early (e.g., hypnotic creature, glitchy arcade cabinet)
- let the weirdness be discoverable via “Check” interactions

## 5. Battles (future)
Not required for the demo, but plan for:
- battle scene that can be entered from overworld
- layered animated backgrounds (visual identity)
- a “rolling” resource mechanic (HP-like) if desired later
