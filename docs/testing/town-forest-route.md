# Town, Park, and Forest Route

`town_forest_route_smoke` is the bounded M226 route proof. It uses Scenario
Runner input events and does not teleport between gameplay areas. Dialogue
debounce gaps use 18 fixed physics frames, matching the 9-tick input cooldown.

```bash
CAPTURE_DIR=captures/m226/town-forest-headless \
  QUIT_AFTER_FRAMES=2400 \
  ./tools/ci/run-scenario.sh town_forest_route_smoke

CAPTURE_DIR=captures/m226/town-forest-rendered \
  QUIT_AFTER_FRAMES=2400 \
  ./tools/ci/run-scenario-rendered.sh town_forest_route_smoke
```

The route proves:

1. Town Center starts at the `from_hero_house` fixture and follows real input
   to the Town Park portal.
2. Town Park settles at `from_town_center`.
3. The Forest Gate is interacted with while locked, and dialogue is asserted.
4. `forest_unlocked=true` is an explicit test setup flag, not quest-chain proof.
5. The unlocked gate opens Forest Entrance through the real interaction path,
   placing the player at `(256, 220)`, clear of the arch artwork.
6. Slot 0 save/load restores a fractional checkpoint at `(257.5, 218.5)`, then the
   save is deleted.
7. Forest returns to Park through its actual trigger, and Park returns to Town
   Center through its actual trigger.
8. The final Town Center spawn and settled position are asserted.

Rendered evidence includes `locked_forest_gate` and `forest_entrance` PNGs.
The route uses valid save slot 0 and the wrapper isolates Godot's user data;
personal user data is manifest-checked before and after execution.

This does not prove the full quest chain, battle return, battle balance,
large-map scrolling, or unrelated areas. Door and forest route coverage is
separate from the M224 startup/readiness proof.

## Collision and movement checks

```bash
QUIT_AFTER_FRAMES=3000 ./tools/ci/run-scenario.sh route_boundaries_smoke
./tools/ci/run-scenario.sh park_pond_collision_smoke
./tools/ci/run-scenario.sh player_eight_direction_smoke
./tools/ci/run-scenario.sh input_debouncer_probe
```

Perimeter fixtures use explicit setup positions away from active portals. Each
pressure check asserts the scene, numeric stop position, and complete collision
rectangle. That setup is not used to bypass traversal in the full route.
