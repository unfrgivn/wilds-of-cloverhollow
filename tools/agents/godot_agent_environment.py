#!/usr/bin/env python3
"""Disposable DEV-only Godot/MCP snapshot lifecycle.

The helper copies a narrow, physical project snapshot outside the repository.
It never synchronizes files back and never runs Scenario Runner as a proxy.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from typing import NoReturn, TypedDict, cast


REPO = Path(__file__).resolve().parents[2]
ALLOWED_ROOT = (Path(tempfile.gettempdir()).resolve() / "opencode").resolve()
DEFAULT_ROOT = ALLOWED_ROOT / "godot-agent-environment"
PACKAGE = REPO / ".opencode" / "mcp" / "satelliteoflove"
ADDON_CLI = PACKAGE / "node_modules" / "@satelliteoflove" / "godot-mcp" / "dist" / "cli.js"
PORT = 6550
MANIFEST_SCHEMA = 1
TOOL_NAME = "godot-agent-environment"
READY_LINE = "Server listening on 127.0.0.1:6550"


class Manifest(TypedDict, total=False):
    schema: int
    tool: str
    source_root: str
    source_revision: str
    source_dirty: bool
    source_dirty_sha256: str
    files: dict[str, str]
    generated_at_unix: int
    snapshot_project_sha256: str


class Runtime(TypedDict, total=False):
    pid: int | None
    stopped_pid: int
    port: int
    snapshot: str
    log: str
    started_at_unix: int
    startup_error: str
    godot_bin: str


@dataclass(frozen=True)
class SourceSnapshot:
    manifest: Manifest
    paths: tuple[str, ...]


def fail(message: str) -> NoReturn:
    raise SystemExit(f"[godot-agent-environment] ERROR: {message}")


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def reject_symlink_or_hardlink(path: Path, *, allow_missing: bool = False) -> None:
    if not path.exists() and not path.is_symlink():
        if allow_missing:
            return
        fail(f"required path is missing: {path}")
    if path.is_symlink():
        fail(f"symlinks are not allowed: {path}")
    if path.is_file() and path.stat().st_nlink > 1:
        fail(f"hardlinked files are not allowed: {path}")


def validate_root(value: str | Path) -> Path:
    raw = Path(value).expanduser()
    if not raw.is_absolute():
        fail("--root must be an absolute path")
    allowed = ALLOWED_ROOT
    raw_absolute = Path(os.path.abspath(raw))
    if raw_absolute == allowed or not is_within(raw_absolute, allowed):
        fail(f"snapshot root must be below {allowed}, not {raw_absolute}")
    current = allowed
    for part in raw_absolute.relative_to(allowed).parts:
        current /= part
        if current.is_symlink():
            fail(f"snapshot path component is a symlink: {current}")
    root = raw_absolute.resolve(strict=False)
    if root == allowed or not is_within(root, allowed):
        fail(f"resolved snapshot root escapes {allowed}: {root}")
    if root.exists() and root.is_file():
        fail(f"snapshot root is not a directory: {root}")
    return root


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_output(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=REPO, check=True, text=True, capture_output=True)
    return result.stdout.strip()


def canonical_source_file(relative: str) -> Path:
    candidate = REPO / relative
    reject_symlink_or_hardlink(candidate)
    resolved = candidate.resolve(strict=True)
    if not is_within(resolved, REPO.resolve()):
        fail(f"source path escapes the repository: {relative}")
    if not resolved.is_file():
        fail(f"source path is not a regular file: {relative}")
    return resolved


def source_snapshot() -> SourceSnapshot:
    selected: list[str] = ["project.godot"]
    for base in (REPO / "game", REPO / "tests" / "scenarios"):
        reject_symlink_or_hardlink(base)
        for path in sorted(base.rglob("*")):
            relative = path.relative_to(REPO)
            if any(part.startswith(".") for part in relative.parts):
                continue
            if path.is_symlink():
                fail(f"refusing symlink in selected source: {relative}")
            if path.is_file():
                canonical_source_file(relative.as_posix())
                selected.append(relative.as_posix())

    project = canonical_source_file("project.godot")
    project_text = project.read_text(encoding="utf-8")
    icon_match = re.search(r'^config/icon="(res://[^"\n]+)"', project_text, re.MULTILINE)
    if icon_match:
        icon = icon_match.group(1).removeprefix("res://")
        icon_path = canonical_source_file(icon)
        if not is_within(icon_path, REPO.resolve()):
            fail(f"configured icon escapes the repository: {icon}")
        selected.append(icon)

    dirty = subprocess.run(["git", "diff", "HEAD", "--binary"], cwd=REPO, check=True, text=True, capture_output=True).stdout
    paths = tuple(sorted(set(selected)))
    manifest: Manifest = {
        "schema": MANIFEST_SCHEMA,
        "tool": TOOL_NAME,
        "source_root": str(REPO.resolve()),
        "source_revision": git_output("rev-parse", "HEAD"),
        "source_dirty": bool(git_output("status", "--porcelain")),
        "source_dirty_sha256": hashlib.sha256(dirty.encode()).hexdigest(),
        "files": {name: sha256(canonical_source_file(name)) for name in paths},
        "generated_at_unix": int(time.time()),
    }
    return SourceSnapshot(manifest, paths)


def load_manifest(root: Path) -> Manifest:
    validate_root(root)
    manifest_path = root / "manifest.json"
    reject_symlink_or_hardlink(manifest_path)
    try:
        raw = cast(dict[str, object], json.loads(manifest_path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid snapshot manifest: {error}")
    if raw.get("schema") != MANIFEST_SCHEMA or raw.get("tool") != TOOL_NAME or raw.get("source_root") != str(REPO.resolve()):
        fail(f"snapshot manifest is not owned by this tool: {manifest_path}")
    files_raw = raw.get("files")
    if not isinstance(files_raw, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in files_raw.items()):
        fail("snapshot manifest has invalid file hashes")
    return cast(Manifest, raw)


def verify_snapshot(root: Path) -> Manifest:
    manifest = load_manifest(root)
    for name, expected in manifest["files"].items():
        destination = root / name
        reject_symlink_or_hardlink(destination)
        allowed_project_hash = cast(dict[str, object], manifest).get("snapshot_project_sha256")
        expected_hash = allowed_project_hash if name == "project.godot" and isinstance(allowed_project_hash, str) else expected
        if sha256(destination) != expected_hash:
            fail(f"snapshot file changed or is corrupt: {destination}")
    reject_symlink_or_hardlink(root / "project.godot")
    return manifest


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def copy_selected(root: Path) -> None:
    root = validate_root(root)
    if root.exists():
        fail(f"snapshot already exists; use refresh explicitly: {root}")
    root.parent.mkdir(parents=True, exist_ok=True)
    reject_symlink_or_hardlink(root.parent)
    root.mkdir()
    reject_symlink_or_hardlink(root)
    owned = True
    try:
        before = source_snapshot()
        for name in before.paths:
            source = canonical_source_file(name)
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            reject_symlink_or_hardlink(destination.parent)
            shutil.copyfile(source, destination)
            os.chmod(destination, source.stat().st_mode & 0o777)
        after = source_snapshot()
        if before.manifest["files"] != after.manifest["files"] or before.manifest["source_dirty_sha256"] != after.manifest["source_dirty_sha256"]:
            fail("source changed during snapshot copy; discarded partial snapshot")
        write_json(root / "manifest.json", before.manifest)
        runtime = root / "runtime"
        runtime.mkdir()
        for directory in ("home", "xdg-config", "xdg-data", "xdg-cache"):
            (runtime / directory).mkdir()
        print(json.dumps({"snapshot": str(root), "source_revision": before.manifest["source_revision"], "file_count": len(before.paths)}, indent=2))
    except BaseException:
        if owned and root.exists() and not root.is_symlink():
            shutil.rmtree(root)
        raise


def refresh(root: Path) -> None:
    root = validate_root(root)
    if not root.exists():
        copy_selected(root)
        return
    manifest = verify_snapshot(root)
    runtime_path = root / "runtime.json"
    runtime = cast(dict[str, object], json.loads(runtime_path.read_text(encoding="utf-8"))) if runtime_path.exists() else {}
    if runtime.get("pid"):
        fail("stop the owned snapshot editor before refreshing")
    if manifest["source_root"] != str(REPO.resolve()):
        fail("refusing to delete a snapshot from another source root")
    shutil.rmtree(root)
    copy_selected(root)


def ensure_snapshot(root: Path) -> Manifest:
    return verify_snapshot(validate_root(root))


def enable_addon(root: Path) -> None:
    project = root / "project.godot"
    reject_symlink_or_hardlink(project)
    text = project.read_text(encoding="utf-8")
    line = 'enabled=PackedStringArray("res://addons/godot_mcp/plugin.cfg")'
    if "[editor_plugins]" in text:
        text = re.sub(r"(?ms)^\[editor_plugins\]\n.*?(?=^\[|\Z)", f"[editor_plugins]\n{line}\n\n", text)
    else:
        text += f"\n[editor_plugins]\n{line}\n"
    project.write_text(text, encoding="utf-8")
    manifest = load_manifest(root)
    manifest["snapshot_project_sha256"] = sha256(project)
    write_json(root / "manifest.json", manifest)


def record_snapshot_project_hash(root: Path) -> None:
    manifest = load_manifest(root)
    manifest["snapshot_project_sha256"] = sha256(root / "project.godot")
    write_json(root / "manifest.json", manifest)


def port_owner() -> str:
    return subprocess.run(["lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN"], text=True, capture_output=True).stdout.strip()


def process_command(pid: int) -> str:
    return subprocess.run(["ps", "-p", str(pid), "-o", "command="], text=True, capture_output=True).stdout.strip()


def validate_scene(root: Path, scene: str | None) -> str | None:
    if scene is None:
        return None
    if not scene.startswith("res://") or ".." in Path(scene.removeprefix("res://")).parts:
        fail("--scene must be a res:// path without traversal")
    relative = scene.removeprefix("res://")
    raw_candidate = root / relative
    reject_symlink_or_hardlink(raw_candidate)
    candidate = raw_candidate.resolve(strict=False)
    game_root = (root / "game").resolve(strict=True)
    if not is_within(candidate, game_root) or candidate.suffix != ".tscn":
        fail("--scene must name an existing .tscn under the snapshot game/ directory")
    if not candidate.is_file():
        fail(f"snapshot scene is not a regular file: {scene}")
    return scene


def godot_version(godot_bin: str) -> str:
    try:
        result = subprocess.run([godot_bin, "--version"], check=True, text=True, capture_output=True, timeout=10)
    except (OSError, subprocess.SubprocessError) as error:
        fail(f"cannot run GODOT_BIN={godot_bin!r} for version preflight: {error}")
    version = (result.stdout or result.stderr).strip()
    if "4.5.1" not in version:
        fail(f"Godot 4.5.1 is required, got: {version}")
    return version


def wait_ready(process: subprocess.Popen[bytes], log: Path, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if READY_LINE in log.read_text(encoding="utf-8", errors="replace") and port_owner():
            return True
        time.sleep(0.25)
    return False


def terminate_owned(pid: int, root: Path) -> bool:
    command = process_command(pid)
    if not command or str(root) not in command or "godot" not in command:
        return False
    os.kill(pid, signal.SIGTERM)
    for _ in range(40):
        if not process_command(pid):
            return True
        time.sleep(0.25)
    if process_command(pid):
        os.kill(pid, signal.SIGKILL)
        time.sleep(0.5)
    return not bool(process_command(pid))


def start(root: Path, scene: str | None) -> None:
    ensure_snapshot(root)
    selected_scene = validate_scene(root, scene)
    if port_owner():
        fail(f"port {PORT} is occupied; refusing to kill or reuse another process\n{port_owner()}")
    if not ADDON_CLI.is_file():
        fail(f"local pinned MCP CLI missing; run npm ci in {PACKAGE}")
    install = subprocess.run(["node", str(ADDON_CLI), "--install-addon", str(root)], text=True, capture_output=True, timeout=120)
    if install.returncode:
        fail(f"pinned addon install failed:\n{install.stdout}\n{install.stderr}")
    enable_addon(root)
    runtime_dir = root / "runtime"
    reject_symlink_or_hardlink(runtime_dir, allow_missing=True)
    runtime_dir.mkdir(exist_ok=True)
    for directory in ("home", "xdg-config", "xdg-data", "xdg-cache"):
        reject_symlink_or_hardlink(runtime_dir / directory, allow_missing=True)
        (runtime_dir / directory).mkdir(exist_ok=True)
    log = runtime_dir / "godot-editor.log"
    godot_bin = os.environ.get("GODOT_BIN", "godot")
    version = godot_version(godot_bin)
    env = os.environ.copy()
    env.update({
        "HOME": str(runtime_dir / "home"),
        "XDG_CONFIG_HOME": str(runtime_dir / "xdg-config"),
        "XDG_DATA_HOME": str(runtime_dir / "xdg-data"),
        "XDG_CACHE_HOME": str(runtime_dir / "xdg-cache"),
    })
    with log.open("w", encoding="utf-8") as handle:
        command = [godot_bin, "--editor", "--headless", "--path", str(root)]
        if selected_scene:
            command.append(selected_scene)
        process = subprocess.Popen(command, stdout=handle, stderr=subprocess.STDOUT, env=env)
    runtime: Runtime = {"pid": process.pid, "port": PORT, "snapshot": str(root), "log": str(log), "started_at_unix": int(time.time()), "godot_bin": godot_bin, "godot_version": version}
    write_json(root / "runtime.json", runtime)
    if not wait_ready(process, log, 30):
        if process.poll() is None:
            terminate_owned(process.pid, root)
        runtime["pid"] = None
        runtime["startup_error"] = "editor did not report the MCP ready line"
        write_json(root / "runtime.json", runtime)
        fail(f"editor startup failed; see {log}")
    record_snapshot_project_hash(root)
    print(json.dumps({**runtime, "port_ready": True}, indent=2))


def status(root: Path) -> None:
    ensure_snapshot(root)
    runtime_path = root / "runtime.json"
    runtime = cast(dict[str, object], json.loads(runtime_path.read_text(encoding="utf-8"))) if runtime_path.exists() else {}
    pid = runtime.get("pid")
    command = process_command(pid) if isinstance(pid, int) else ""
    alive = bool(command) and str(root) in command and "godot" in command
    ready = alive and READY_LINE in (root / "runtime" / "godot-editor.log").read_text(encoding="utf-8", errors="replace")
    print(json.dumps({"snapshot": str(root), "editor_alive": alive, "editor_ready": ready, "pid": pid, "port": PORT, "port_owner": port_owner(), "command": command}, indent=2))


def stop(root: Path) -> None:
    root = validate_root(root)
    runtime_path = root / "runtime.json"
    if not runtime_path.exists():
        print(json.dumps({"stopped": False, "reason": "no runtime record"}, indent=2))
        return
    runtime = cast(Runtime, json.loads(runtime_path.read_text(encoding="utf-8")))
    pid = runtime.get("pid")
    if not isinstance(pid, int):
        print(json.dumps({"stopped": False, "reason": "already stopped"}, indent=2))
        return
    if not process_command(pid):
        runtime["pid"] = None
        runtime["stopped_pid"] = pid
        write_json(runtime_path, runtime)
        print(json.dumps({"stopped": False, "stale_pid_cleared": pid}, indent=2))
        return
    if not terminate_owned(pid, root):
        fail(f"refusing to kill foreign PID or failed to stop owned PID {pid}")
    if port_owner():
        fail(f"owned editor stopped but port {PORT} remains occupied: {port_owner()}")
    runtime["pid"] = None
    runtime["stopped_pid"] = pid
    write_json(runtime_path, runtime)
    print(json.dumps({"stopped": True, "pid": pid, "port_clean": True}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Disposable DEV-only Godot agent environment")
    parser.add_argument("command", choices=["snapshot", "refresh", "start", "status", "stop", "server-command"])
    parser.add_argument("--root", type=validate_root, default=DEFAULT_ROOT)
    parser.add_argument("--scene")
    args = parser.parse_args()
    args.root = validate_root(args.root)
    if args.command == "snapshot":
        copy_selected(args.root)
    elif args.command == "refresh":
        refresh(args.root)
    elif args.command == "start":
        start(args.root, args.scene)
    elif args.command == "status":
        status(args.root)
    elif args.command == "stop":
        stop(args.root)
    else:
        ensure_snapshot(args.root)
        print(f"GODOT_HOST=127.0.0.1 GODOT_PORT={PORT} GODOT_MCP_USAGE_LOG=0 node {ADDON_CLI} --read-only")


if __name__ == "__main__":
    main()
