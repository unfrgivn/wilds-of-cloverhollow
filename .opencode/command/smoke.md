---
description: Run a headless smoke boot of the game
agent: build
---
Run a headless smoke boot of the game (no editor UI). If it fails, identify:
- the first error in logs
- the file/line likely responsible
- a concrete fix

If there is no dedicated smoke command, propose one and implement it in `tools/ci/run-smoke.sh`.
