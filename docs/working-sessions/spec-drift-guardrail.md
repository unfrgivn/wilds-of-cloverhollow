# Spec Drift Guardrail

This document describes the spec drift prevention system that ensures `spec.md` stays synchronized with code changes.

## Purpose

The guardrail prevents "spec drift" where code behavior diverges from documentation. When files under `game/`, `tools/`, or `.opencode/` change, the check fails unless `spec.md` is also modified in the same commit.

## Monitored Paths

The check triggers when any of these change:

| Path | Description |
|------|-------------|
| `game/**` | All game code and assets |
| `tools/**` | CI scripts, art pipeline, linting |
| `.opencode/**` | Opencode configuration |
| `project.godot` | Godot project settings |

## Running the Check

```bash
./tools/ci/run-spec-check.sh
```

Exit codes:
- `0` — Pass (no drift detected or override applied)
- `1` — Error (git issue)
- `2` — Fail (drift detected)

## Override Options

Use overrides sparingly. Valid reasons: pure refactors, test-only changes, tooling that doesn't affect behavior.

### 1. Commit Message Tags

Add one of these tags to your commit message:

```bash
git commit -m "refactor: extract helper function [refactor]"
git commit -m "chore: update CI script [spec-ok]"
```

Both `[spec-ok]` and `[refactor]` are equivalent; choose whichever communicates intent.

### 2. Environment Variable

For local testing or CI bypass:

```bash
ALLOW_SPEC_DRIFT=1 ./tools/ci/run-spec-check.sh
```

## When to Update spec.md

**Must update spec.md:**
- New gameplay mechanics
- Changed controls or input handling
- Modified battle system behavior
- New data schemas or file formats
- Changed platform constraints or requirements

**Override is acceptable:**
- Renaming variables or functions (pure refactor)
- Adding tests without behavior changes
- CI/tooling improvements that don't affect game behavior
- Bug fixes that restore intended spec behavior

## Integration

The check runs:
1. Locally via `./tools/ci/run-spec-check.sh`
2. In CI as part of the test pipeline
3. Called by `run-tests.sh` during milestone verification

## Troubleshooting

**Check fails unexpectedly:**
- Verify you don't have unstaged changes in monitored paths
- Use `git diff --name-only` to see what's detected
- If legitimate refactor, add `[refactor]` to commit message

**Check passes when it shouldn't:**
- Override tags are case-insensitive; check commit message for accidental matches
- Environment variable may be set; check `echo $ALLOW_SPEC_DRIFT`
