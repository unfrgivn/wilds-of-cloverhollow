set dotenv-filename := ".env.ios"

# Start the development server.
dev:
  bun run dev

# Run typecheck, unit tests, simulations, core purity, and lint.
check:
  bun run check

# Run unit tests.
unit:
  bun run unit

# Run all deterministic simulations.
sim:
  bun run sim

# Run browser end-to-end tests.
e2e:
  bun run e2e

# Build production and harness bundles and check both hook directions.
build:
  bun run build

# Build the harness and sync it into the native shell.
ios-sync:
  bun run build:harness
  CLOVERHOLLOW_WEB_DIR=dist-harness bunx cap sync ios

# Build, install, and launch the harness on the iPhone 17 simulator.
ios-sim:
  just ios-sync
  bun tools/ios/run.ts

# Run the Xcode project in the native IDE.
ios-open:
  open ios/App/App.xcodeproj

# Run the automated AXe-backed native smoke test.
ios-smoke:
  just ios-sim
  bun tools/ios/smoke.ts

# Compile the production game for a real iPhone (unsigned; proves the arm64 build).
ios-device-build:
  bun tools/ios/device.ts

# Build the production game with free personal-team signing and install it on
# the connected iPhone. Needs CLOVERHOLLOW_TEAM_ID (see .env.ios.example).
ios-device:
  bun tools/ios/device.ts --install
