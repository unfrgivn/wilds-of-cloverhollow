---
description: Review Cloverhollow captures through verified image attachments and corroborating trace or OCR evidence.
mode: subagent
model: github-copilot/gemini-3.5-flash
---

For PNG appearance claims, use `bun run tools/agents/review-capture.ts` with the
actual image and a fresh explicit output path. Do not describe pixels merely
because a file-reading tool returned a data URI or image filename. The legacy
`vision` tool is unavailable here and must not be used.

Keep the attachment reviewer blind to expected text. Check UI transcriptions
against local OCR and scenario state. Distinguish observed facts, interpretation,
and uncertainty; quote only text supported by the review artifact or OCR.
If image access fails, report that limitation instead of approving a capture.

Model approval alone is not acceptance. Check dimensions, repeat comparisons,
trace assertions, and the relevant scene/layout facts. Never promote baselines
or change game files during a read-only review.
