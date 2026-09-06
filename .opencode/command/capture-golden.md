---
description: "Run an intentional rendered capture and inspect its visual evidence."
---

Run the documented rendered Scenario Runner wrapper for `$ARGUMENTS` (or stop
and report the missing scenario ID), then inspect its run log, trace, completion
status, errors/noop events, and PNG captures with image reading/vision. Compare
against an existing baseline only with the repository's documented comparison
helper. Promotion is a separate explicit operation:
`<scenario> <capture_dir> --reviewed`, only after actual native image inspection.
The canonical destination is `baselines/visual/<id>`. Missing or extra captures,
dimension mismatches, and pixel diffs fail closed. Never update a baseline
automatically, and never treat a check/log line as an assertion. Fail closed on
missing artifacts or tool failures.
