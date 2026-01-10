---
description: Run CI tests (headless) and summarize failures
agent: build
---
Run the full automated test suite headlessly using the repo's CI script. Then summarize:
- failing tests
- likely root cause(s)
- the smallest fix that unblocks CI
