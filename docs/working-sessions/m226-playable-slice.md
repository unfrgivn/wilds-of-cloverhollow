# Milestone 226: playable town-to-forest slice

Completed 2026-09-06.

## Delivered

- Continuous 90 px/s player physics, removing the old left/up rounding bias.
  Ten ticks cover 15 px in each cardinal direction and 15 px total diagonally.
- Render-only pixel alignment, physics-driven camera updates, and eight-direction
  Fae idle/walk art with matching texture assertions.
- Forty-one normalized Fae frames, nine transparent building facades, and
  thirteen native park tiles, all reproducible from checked-in recipes.
- Tiled park ground, readable exits, a pond with blocked water flanks and a
  walkable bridge, plus continuous world-edge colliders in all three areas.
- A real-input Town → Park → Forest → Park → Town journey, with locked/unlocked
  gate states and an isolated save/load checkpoint at fractional coordinates.

## What the tests prove

- **Route:** four reciprocal spawn checks, locked/open dialogue checks, four
  save-state checks, position restoration after moving away, and settled Town
  return. The gate's unlock flag is test setup, not quest-chain completion.
- **Perimeter:** fifteen scene checks, fifteen numeric position checks, and
  fifteen full-body containment checks covering twelve edges and three corners.
  Fixtures are deliberately away from real portals.
- **Pond:** left/right water blocking, sustained pressure, diagonal corner
  approach, and bridge crossing with numeric position assertions.
- **Movement:** eight displacement assertions and eight matching facing/texture
  assertions. Physics coordinates remain fractional; the camera/rendering snaps.
- **Art:** thirteen tests check generation, published RGBA pixels, palette,
  dimensions, alpha, path seams, and reproducibility.

## Independent verification

Passed through the repository scripts/just recipes:

- Smoke, root tests, spec check.
- Headless and rendered `town_forest_route_smoke` with a 2400-frame budget.
- Boundary, pond, and eight-direction scenarios.
- Headless/rendered repeatability checks.
- All three updated golden comparisons.
- Art tests and visual/review-tool unit tests.

Core release evidence is in `captures/m226/release-check/`. Earlier independent
assertion summaries and scenario captures are in `captures/m226/parent-final/`.
The final forest capture/review is in `captures/m226/final-forest-render/` and
`captures/m226/parent-final/forest-accepted-review.txt`.

Actual attachment reviews confirmed readable route exits, a visible player at
the forest entrance, and readable dialogue/battle commands. Known prototype
scenery and label clutter are not described as finished artwork. Updated goldens
were promoted only after attachment review, layout/trace checks, and comparison.

## Integration fixes

- Removed an oversized temporary Town/Park trigger that covered the default
  player spawn. Reciprocal spawn points are now outside their return triggers.
- Corrected a reintroduced physics-rounding regression before acceptance.
- Removed duplicate Park pond/bridge primitives and aligned the shore with the
  collision region.
- Replaced wall-clock/render-frame mixing with one physics-tick debounce clock.
- Removed the stale ImageMagick-7-only shell preflight found by hosted CI.
  A regression uses real standalone `identify`/`compare` executables with no
  `magick` in PATH; it does not mock comparison results.

## Not certified

Full quest-chain completion, battle balance/return, mobile touch behavior,
large-map scrolling, other areas, and universal cross-GPU determinism remain
outside this slice. Some NPC/prop art and battle scenery are still placeholders.

Suggested next gameplay slice: play the home/school opening through the actual
forest-unlock quest chain, then verify a real encounter and battle return. That
work should use the same input, state, capture, and art gates rather than treating
the route's explicit unlock fixture as completed story content.
