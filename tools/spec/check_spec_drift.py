#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path

SURFACE_PREFIXES = ("game/", "tools/", ".opencode/")
SURFACE_FILES = ("project.godot",)

def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode("utf-8", errors="replace").strip()

def is_git_repo() -> bool:
    try:
        run(["git", "rev-parse", "--is-inside-work-tree"])
        return True
    except Exception:
        return False

def main() -> int:
    if os.environ.get("ALLOW_SPEC_DRIFT") == "1":
        print("[spec-check] ALLOW_SPEC_DRIFT=1 set; skipping spec drift check.")
        return 0

    if not is_git_repo():
        print("[spec-check] Not a git repo; skipping.")
        return 0

    try:
        changed = run(["git", "diff", "--name-only"]).splitlines()
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
        print("  2) If this is a pure refactor, rerun with ALLOW_SPEC_DRIFT=1 (temporary override).")
        return 2

    print("[spec-check] OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
