---
description: Run spec drift guardrail check
agent: build
---
Run the spec drift check with `./tools/ci/run-spec-check.sh`.

If it fails, report:
- files that triggered the guardrail
- whether `spec.md` needs updating or `ALLOW_SPEC_DRIFT=1` is justified
