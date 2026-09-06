# Milestone 228: hosted renderer compatibility

The Linux runner cannot provide the Vulkan surface extension used by the local
default renderer. The strict log gate correctly rejected Godot's attempted
Vulkan startup even though it later fell back to OpenGL.

The launcher now accepts validated `GODOT_RENDERING_METHOD` overrides. Hosted
visual CI selects `gl_compatibility` before engine startup and uses a separate
`baselines/visual/linux-gl-compatibility` profile. Local defaults and their
reviewed Metal baselines remain unchanged. Errors, missing baselines, and exact
pixel differences still fail the gate.

## Evidence

- Fourteen local visual/review/renderer tests passed, including invalid method
  rejection and real Compatibility rendering with trace verification.
- Mandatory smoke, tests, spec, headless compatibility scenario, and rendered
  compatibility scenario passed independently under `captures/m228/parent-check`.
- Linux evaluation runs `34055910583` and `34056022171` rendered all three
  scenarios successfully using X11, Godot 4.5.1, and `gl_compatibility`.
- Both evaluation jobs intentionally failed on absent Linux baselines. No
  render errors were waived, and all candidate frames remained available.
- Each Linux frame matched its independent repeat exactly, zero differing pixels.
- Actual attachment review, OCR, and runtime layout/scene assertions corroborated
  the dialogue, commands, party status, and prototype town states.
- Linux frames were promoted explicitly with `--reviewed`, then compared against
  the second Linux run. All three comparisons passed.

Artifacts are in `captures/m228/linux-candidates`, `linux-repeat`, and the
adjacent review/diagnostic files. A temporary evaluation branch collected these
artifacts before the final milestone was landed on main.

macOS OpenGL also differs from Linux OpenGL, so a renderer name alone is not a
portable baseline identity. These profiles do not claim universal cross-GPU or
cross-driver equivalence. Known prototype art clutter remains gameplay polish
work, not a reason to relax visual comparisons.
