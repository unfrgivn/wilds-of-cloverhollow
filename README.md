# Wilds of Cloverhollow

A cozy storybook adventure for kids 8 to 12. Fae, her cat Maddie, and their
friends calm the chaos spreading through Cloverhollow, one painted scene at a
time.

It is a TypeScript web game (PixiJS) wrapped for iOS with Capacitor, built so
AI agents can build, drive, inspect, and verify it.

- `spec.md`: what the game is (source of truth)
- `AGENTS.md`: how agents work in this repo
- `docs/plan.md`: milestones
- `NOTES.md`: the original story notes
- `docs/art/concepts/`: concept art and style references

The previous Godot pixel-art build is archived at tag `archive/godot-pixel`.

## Requirements
- Node 24 LTS (`nvm use`), Bun 1.3+, and `just`
- Xcode 27 for iOS work
- `GEMINI_API_KEY` for art generation (optional)

## Commands
- `just dev`: run the game locally
- `just check`: typecheck, unit tests, headless sim, purity, and lint
- `just sim`: run every scripted deterministic simulation
- `just e2e`: Playwright end-to-end tests (Chromium and WebKit)
- `just build`: production build, plus checks that the dev hook stays out of it
- `just ios-sim`: build the harness and launch it in the iPhone 17 simulator
  (set `IOS_SIMULATOR_NAME` to use another simulator)
- `just ios-smoke`: drag the touch stick in the simulator and verify that the
  player moved, using the app's live console output
- `just ios-open`: open the iOS project in Xcode

Screenshot baselines are macOS-only for now. The harness build is used by the
Playwright suite and can be started with `bun run build:harness`.
