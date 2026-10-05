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
