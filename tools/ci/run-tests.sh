#!/usr/bin/env bash
set -euo pipefail

# Run headless unit/integration tests.
# TODO: install and configure a test framework (e.g., GUT) and update this script.

./tools/ci/run-smoke.sh

echo "No test framework configured yet. (Implement GUT and update tools/ci/run-tests.sh)"
