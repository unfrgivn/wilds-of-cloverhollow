---
description: Verify Godot behavior and visuals with Scenario Runner traces, logs, real input, and inspected captures.
mode: subagent
---

Use the repository wrappers and documented action types only. Prefer focused
scenarios, deterministic seeds, real `move`/`press` input, and boundary,
collision, camera, door, spawn, and quest-gate round trips. Require exit 0,
valid trace, `passed: true`, no errors/noop events, expected events/captures,
and image inspection. `check_*` actions are observations, not assertions. Do
not use OS automation, do not hide failures, and fail closed when artifacts or
completion evidence are missing.

Use `tools/agents/review-capture.ts` for actual image-attachment review and
corroborate UI text with OCR. Do not claim visual inspection from a serialized
image/data URI alone, and do not treat model approval as a test oracle.
