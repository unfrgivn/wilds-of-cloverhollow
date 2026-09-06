import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "agents" / "godot_agent_environment.py"
SPEC = importlib.util.spec_from_file_location("godot_agent_environment", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules["godot_agent_environment"] = MODULE
SPEC.loader.exec_module(MODULE)


class GodotAgentEnvironmentTests(unittest.TestCase):
    def test_source_manifest_is_narrow_and_hashed(self) -> None:
        snapshot = MODULE.source_snapshot()
        manifest = snapshot.manifest
        self.assertIn("project.godot", manifest["files"])
        self.assertTrue(any(path.startswith("game/") for path in manifest["files"]))
        self.assertTrue(any(path.startswith("tests/scenarios/") for path in manifest["files"]))
        self.assertTrue(all(not Path(path).parts[0].startswith(".") for path in manifest["files"]))
        self.assertTrue(all(len(value) == 64 for value in manifest["files"].values()))

    def test_snapshot_is_physical_and_copy_is_independent(self) -> None:
        with tempfile.TemporaryDirectory(prefix="godot-agent-", dir=tempfile.gettempdir()) as temporary:
            root = MODULE.validate_root(Path(MODULE.ALLOWED_ROOT) / Path(temporary).name / "snapshot")
            MODULE.copy_selected(root)
            source = MODULE.REPO / "project.godot"
            copied = root / "project.godot"
            before = source.read_bytes()
            copied.write_bytes(b"snapshot-only")
            self.assertEqual(before, source.read_bytes())
            self.assertEqual(os.stat(copied).st_nlink, 1)
            self.assertFalse((root / ".godot").exists())
            self.assertFalse((root / ".git").exists())

    def test_nonowned_refresh_preserves_sentinel(self) -> None:
        with tempfile.TemporaryDirectory(prefix="godot-agent-", dir=tempfile.gettempdir()) as temporary:
            root = MODULE.validate_root(Path(MODULE.ALLOWED_ROOT) / Path(temporary).name / "unowned")
            root.mkdir(parents=True)
            sentinel = root / "do-not-delete.txt"
            sentinel.write_text("keep", encoding="utf-8")
            with self.assertRaises(SystemExit):
                MODULE.refresh(root)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")

    def test_root_inside_repo_and_symlink_are_rejected(self) -> None:
        with self.assertRaises(SystemExit):
            MODULE.validate_root(MODULE.REPO / "unsafe")
        with tempfile.TemporaryDirectory(prefix="godot-agent-", dir=tempfile.gettempdir()) as temporary:
            target = Path(temporary) / "target"
            target.mkdir()
            link = Path(MODULE.ALLOWED_ROOT) / (Path(temporary).name + "-link")
            try:
                link.symlink_to(target, target_is_directory=True)
                with self.assertRaises(SystemExit):
                    MODULE.validate_root(link)
            finally:
                link.unlink(missing_ok=True)

    def test_source_paths_cannot_escape_repo(self) -> None:
        with self.assertRaises(SystemExit):
            MODULE.canonical_source_file("../outside-project.godot")

    def test_scene_validation_allows_snapshot_scene_only(self) -> None:
        with tempfile.TemporaryDirectory(prefix="godot-agent-", dir=tempfile.gettempdir()) as temporary:
            root = MODULE.validate_root(Path(MODULE.ALLOWED_ROOT) / Path(temporary).name / "snapshot")
            MODULE.copy_selected(root)
            self.assertEqual(MODULE.validate_scene(root, "res://game/scenes/Main.tscn"), "res://game/scenes/Main.tscn")
            with self.assertRaises(SystemExit):
                MODULE.validate_scene(root, "res://project.godot")
            with self.assertRaises(SystemExit):
                MODULE.validate_scene(root, "res://game/../project.godot")
            with self.assertRaises(SystemExit):
                MODULE.validate_scene(root, "res:///private/outside.tscn")


if __name__ == "__main__":
    unittest.main()
