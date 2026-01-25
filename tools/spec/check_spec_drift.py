#!/usr/bin/env python3
"""
Spec drift guardrail: ensures spec.md is updated when code changes.

Override options:
- Environment variable: ALLOW_SPEC_DRIFT=1
- Commit message tags: [spec-ok] or [refactor]
"""

import os
import re
import subprocess
import sys
from pathlib import Path

SURFACE_PREFIXES = ("game/", "tools/", ".opencode/")
SURFACE_FILES = ("project.godot",)
OVERRIDE_PATTERNS = (r"\[spec-ok\]", r"\[refactor\]")


def run(cmd: list[str]) -> str:
    return (
        subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        .decode("utf-8", errors="replace")
        .strip()
    )


def is_git_repo() -> bool:
    try:
        run(["git", "rev-parse", "--is-inside-work-tree"])
        return True
    except Exception:
        return False


def get_head_commit_message() -> str:
    """Get the commit message of HEAD (for post-commit checks)."""
    try:
        return run(["git", "log", "-1", "--format=%B"])
    except Exception:
        return ""


def has_commit_override(message: str) -> bool:
    """Check if commit message contains an override tag."""
    for pattern in OVERRIDE_PATTERNS:
        if re.search(pattern, message, re.IGNORECASE):
            return True
    return False


def main() -> int:
    # Check environment override
    if os.environ.get("ALLOW_SPEC_DRIFT") == "1":
        print("[spec-check] ALLOW_SPEC_DRIFT=1 set; skipping spec drift check.")
        return 0

    if not is_git_repo():
        print("[spec-check] Not a git repo; skipping.")
        return 0

    # Check commit message override (for staged/committed changes)
    commit_msg = get_head_commit_message()
    if has_commit_override(commit_msg):
        print("[spec-check] Override tag found in commit message; skipping check.")
        return 0

    try:
        # Check both staged and unstaged changes
        staged = run(["git", "diff", "--cached", "--name-only"]).splitlines()
        unstaged = run(["git", "diff", "--name-only"]).splitlines()
        changed = list(set(staged + unstaged))
    except Exception as e:
        print(f"[spec-check] ERROR: unable to read git diff: {e}")
        return 1

    changed = [c.strip() for c in changed if c.strip()]
    if not changed:
        print("[spec-check] No changes.")
        return 0

    spec_changed = "spec.md" in changed

    surface_changed = False
    for f in changed:
        if f in SURFACE_FILES:
            surface_changed = True
            break
        if any(f.startswith(p) for p in SURFACE_PREFIXES):
            surface_changed = True
            break

    if surface_changed and not spec_changed:
        print("[spec-check] FAIL: code/tooling changed without spec.md update.")
        print("Changed files:")
        for f in changed:
            print(f"  - {f}")
        print("")
        print("Fix options:")
        print("  1) Update spec.md in the same commit to reflect the change; or")
        print("  2) Add [spec-ok] or [refactor] to your commit message; or")
        print("  3) Set ALLOW_SPEC_DRIFT=1 environment variable (temporary override).")
        return 2

    print("[spec-check] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
