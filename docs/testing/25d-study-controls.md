# M229 2.5D park study controls

The bounded visual study is opt-in and never changes the normal 2D boot route.
Run it with `just study-25d` (headless trace) or `just study-25d-rendered`
(native PNG captures). Both scenarios load
`res://game/scenes/studies/Park3DStudy.tscn` through the Scenario Runner's
`loader: "direct"` option. The default router remains the 2D router.

Each study wrapper first performs a fresh isolated GLB import. Import artifacts
are kept under `captures/study-import/run.XXXXXX/`; warnings are allowed, but
Godot `ERROR`, script, and parse errors fail the wrapper. The scenario wrappers
then use the normal Scenario Runner flags and defaults (`SEED=12345`,
`QUIT_AFTER_FRAMES=2400`) and require a fresh `CAPTURE_DIR` when one is
provided. The import step is study-only and is not part of ordinary scenario
CI.

For manual play, use `just study-25d-play`. It opens the study scene directly
with isolated user data and intentionally has no auto-quit. For a deterministic
MovieMaker capture, use `just study-25d-record` or pass `study_25d_camera` to
`tools/ci/record-study-25d.sh`. Recordings default to 1800 frames at 60 FPS
and write `walkthrough.avi`, `trace.json`, and the run log under a fresh
`captures/study-record/<scenario>/run.XXXXXX/`. The resulting AVI can be
converted separately with ffmpeg. This is an original visual prototype study,
not a replacement for the default 2D game route.

Controls in the study are WASD or arrow keys, `J` for jump, `1` orthographic,
`2` long-lens perspective, and `L` for the warm key light. The route is driven
by real input actions, not position teleportation. The trace records scene,
camera profile, floor height, grounded state, jump peak, and route checkpoints.

The scene is an original Cloverhollow diorama, not a conversion or a claim of
matching any external game's projection. The bridge and cottage GLBs are
required study assets and the run fails closed if either cannot be loaded.
Rendered runs write PNG checkpoints under `captures/rendered/study_25d_walk/`
and `captures/rendered/study_25d_camera/`; headless runs write traces under
`captures/scenarios/`. The study also records a numeric `sprite_proof` with
camera-facing quad corners, a screen box, and source texture alpha bounds at
capture checkpoints. This checks projection and texture availability, not
occlusion or framebuffer visibility. Actual attachment reviews of the rendered
captures provide the separate visual check.
