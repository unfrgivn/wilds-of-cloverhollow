#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from typing import Iterable, Set


def run_git(
    repo_root: str, args: Iterable[str], check: bool = True
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", repo_root, *args],
        check=check,
        text=True,
        capture_output=True,
    )


def get_repo_root() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            check=True,
            text=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as exc:
        print("Spec drift check failed: not in a git repo.", file=sys.stderr)
        print(exc.stderr.strip(), file=sys.stderr)
        sys.exit(2)

    repo_root = result.stdout.strip()
    if not repo_root:
        print("Spec drift check failed: could not resolve repo root.", file=sys.stderr)
        sys.exit(2)
    return repo_root


def ref_exists(repo_root: str, ref: str) -> bool:
    try:
        run_git(repo_root, ["rev-parse", "--verify", ref])
        return True
    except subprocess.CalledProcessError:
        return False


def remote_exists(repo_root: str, remote: str) -> bool:
    try:
        result = run_git(repo_root, ["remote"], check=True)
    except subprocess.CalledProcessError:
        return False
    return remote in result.stdout.split()


def fetch_ref(repo_root: str, ref: str) -> None:
    if not remote_exists(repo_root, "origin"):
        return
    try:
        run_git(repo_root, ["fetch", "origin", ref, "--depth=1"], check=True)
    except subprocess.CalledProcessError:
        return


def get_merge_base(repo_root: str, ref: str) -> str | None:
    try:
        result = run_git(repo_root, ["merge-base", ref, "HEAD"], check=True)
    except subprocess.CalledProcessError:
        return None
    merge_base = result.stdout.strip()
    return merge_base or None


def collect_diff(repo_root: str, diff_args: list[str]) -> Set[str]:
    try:
        result = run_git(repo_root, ["diff", "--name-only", *diff_args], check=True)
    except subprocess.CalledProcessError:
        return set()
    return {line.strip() for line in result.stdout.splitlines() if line.strip()}


def resolve_base_ref(repo_root: str) -> str | None:
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        candidate = f"origin/{base_ref}"
        if not ref_exists(repo_root, candidate):
            fetch_ref(repo_root, base_ref)
        if ref_exists(repo_root, candidate):
            return candidate

    for candidate in ("origin/main", "origin/master"):
        if ref_exists(repo_root, candidate):
            return candidate

    if ref_exists(repo_root, "HEAD~1"):
        return "HEAD~1"

    return None


def collect_changes(repo_root: str) -> Set[str]:
    changes: Set[str] = set()
    changes |= collect_diff(repo_root, [])
    changes |= collect_diff(repo_root, ["--cached"])

    base_ref = resolve_base_ref(repo_root)
    if base_ref:
        merge_base = get_merge_base(repo_root, base_ref)
        if merge_base:
            changes |= collect_diff(repo_root, [f"{merge_base}...HEAD"])
        else:
            changes |= collect_diff(repo_root, [f"{base_ref}...HEAD"])

    return changes


def is_spec_guarded(path: str) -> bool:
    if path == "project.godot":
        return True
    if path.startswith("game/"):
        return True
    if path.startswith("tools/"):
        return True
    if path.startswith(".opencode/"):
        return True
    return False


def main() -> int:
    if os.environ.get("ALLOW_SPEC_DRIFT") == "1":
        print("Spec drift check bypassed (ALLOW_SPEC_DRIFT=1).")
        return 0

    repo_root = get_repo_root()
    changes = collect_changes(repo_root)
    if not changes:
        print("Spec drift check: no changes detected.")
        return 0

    spec_changed = "spec.md" in changes
    guarded_changes = sorted(path for path in changes if is_spec_guarded(path))

    if not guarded_changes:
        print("Spec drift check: no guarded changes detected.")
        return 0

    if spec_changed:
        print("Spec drift check: guarded changes detected with spec update.")
        return 0

    print("Spec drift guardrail failed.", file=sys.stderr)
    print("Guarded changes detected without spec.md update:", file=sys.stderr)
    for path in guarded_changes:
        print(f"- {path}", file=sys.stderr)
    print(
        "\nUpdate spec.md to match these changes, or bypass with ALLOW_SPEC_DRIFT=1.",
        file=sys.stderr,
    )
    print("Example: ALLOW_SPEC_DRIFT=1 ./tools/ci/run-spec-check.sh", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
