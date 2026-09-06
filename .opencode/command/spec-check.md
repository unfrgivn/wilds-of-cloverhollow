---
description: Run the spec drift guardrail and explain any source-of-truth mismatch.
---

Run `./tools/ci/run-spec-check.sh`, inspect its complete output, and report the
exact result. If it fails, compare the changed behavior with `spec.md` and fix
the source-of-truth mismatch or use only the explicit override documented in
`tools/spec/check_spec_drift.py` when the change is a genuine refactor. Do not
silence failures or claim unrelated Scenario Runner logs prove spec compliance.
