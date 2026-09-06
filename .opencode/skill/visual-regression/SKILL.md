---
name: visual-regression
description: Review Cloverhollow rendered Scenario Runner captures against intentional visual baselines. Use for pixel-art, UI, camera, scene, or art regression work.
compatibility: Scenario Runner, ImageMagick comparison helpers, image reader/vision
---

# Visual regression

Run the repository's existing `./tools/ci/run-scenario-rendered.sh <scenario_id>`
and inspect the capture directory, `trace.json`, and `run.log` before comparing
images. A passing shell exit is not enough: require `passed: true`, no errors or
noop events, expected capture labels, and visual inspection of PNGs.

Use the repository's documented baseline locations and comparison commands.
Baseline updates are intentional review decisions, never an automatic repair.
Do not approve an image because it was quantized or because a diff script
swallowed an error. Fail closed for missing artifacts, missing baselines, or
unreadable captures. Never use OS-level window control.
