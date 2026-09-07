# Cloverbrook Footbridge: showcase direction

## Intent

Show what one finished-looking Cloverhollow location could look like using
3D terrain and pixel-art characters. The scene should feel like a small,
welcoming village garden, not a rendering demo or a collection of sample props.

The art pass is M230 on `prototype/2-5d-world-study`. M229 remains the recorded
technical blockout. Neither milestone authorizes a whole-game migration.

## Visual brief

**Time and mood:** a warm, clear afternoon. Sunlit cream plaster, terracotta,
wood, and grass contrast with cool, readable shade. Preserve a cozy tone for
the game's family audience.

**Place:** a cottage garden beside a narrow stream, connected by a wooden
footbridge to a raised garden lookout. Paths, planting, and a few practical
props should suggest people use and care for this place.

**Composition:** the cottage provides an architectural focal point, the bridge
connects the banks, and the raised lookout rewards the short walk. Planting
frames those places without blocking the route. Leave quiet ground between
detail clusters so the player and path remain easy to read.

**Surface language:** low-resolution authored textures with consistent scale,
distinct material edges, and restrained variation. Grass, soil, stone, wood,
roofing, and water should be distinguishable at the native 512x288 resolution.
Detail that disappears at this size is not a substitute for good silhouettes.

**Vegetation:** recognizable tree forms with layered canopies, readable bark,
and varied shrub/grass/reed shapes. Group plants by location and purpose, rather
than scattering identical tufts uniformly across the lawn.

**Architecture:** a coherent cottage and bridge kit. Roof, walls, openings,
trim, foundation, railings, and supports must physically fit together. Use
measured anchors for attachments, then inspect their rendered appearance.

**Presentation:** compact original area-name and control treatment. Keep the
world visible. Hero shots may hide control hints, but must show the actual
playable scene rather than a separate beauty-render construction.

## Reference discipline

The original Cassette Beasts park reference informs terrain construction,
silhouettes, pixel/3D coherence, and readable elevation. It does not supply
runtime art, architecture to duplicate, characters, UI, or branding.

The initial comparison is recorded locally under `captures/m230/before`.
Its concrete gaps were bare block surfaces, cube trees, empty composition,
plain height edges, and a diagnostic overlay. Suggestions made by an image
reviewer are advisory; an outline shader is not a required solution.

## Acceptance review

Review the actual native starting, bridge, and elevated-route captures. Compare
the same poses under both cameras and inspect a real movement recording.

The slice is not visually accepted if:

- Key terrain or trees still read as unadorned blockout primitives.
- Surface detail has incompatible pixel sizes or creates repetitive noise.
- Props look arbitrarily scattered or obscure the main route.
- Fae disappears, floats, or is drawn through solid geometry.
- Lighting crushes shadow detail, washes out the palette, or hides unfinished art.
- UI crowds the scene or clips.
- A beautiful view requires a separate scene that the player cannot traverse.

Functional gates remain independent: the bridge/ramp round trip, jump/landing,
boundary pressure checks, asset validation, and the retained 2D game must pass.
Record remaining visual weaknesses plainly. The user makes the art-direction
decision; test results and model praise cannot make it on their behalf.
