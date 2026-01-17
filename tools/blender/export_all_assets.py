import argparse
import json
import os
import sys
from typing import List, Set

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.append(SCRIPT_DIR)

import export_asset

ASSET_PREFIX = "ASSET__"


def _parse_args() -> argparse.Namespace:
    if "--" not in sys.argv:
        raise SystemExit("Missing -- separator for script arguments")
    args = sys.argv[sys.argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Export multiple assets")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--all", action="store_true")
    mode.add_argument("--referenced-only", action="store_true")
    parser.add_argument("--out", required=True)
    parser.add_argument("--scenes", default="content/scenes")
    return parser.parse_args(args)


def _find_asset_collections() -> List[str]:
    asset_ids: List[str] = []
    for collection in bpy.data.collections:
        if collection.name.startswith(ASSET_PREFIX):
            asset_ids.append(collection.name[len(ASSET_PREFIX) :])
    return sorted(set(asset_ids))


def _extract_asset_id(def_path: str) -> str:
    normalized = def_path.replace("res://", "")
    parts = normalized.split("/")
    if "props" in parts:
        idx = parts.index("props")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    return ""


def _find_scene_json_paths(scenes_root: str) -> List[str]:
    results: List[str] = []
    for root, _, files in os.walk(scenes_root):
        for name in files:
            if name == "scene.json":
                results.append(os.path.join(root, name))
    return sorted(results)


def _collect_referenced_assets(scenes_root: str) -> List[str]:
    asset_ids: Set[str] = set()
    for path in _find_scene_json_paths(scenes_root):
        with open(path, "r", encoding="utf-8") as handle:
            try:
                data = json.load(handle)
            except json.JSONDecodeError:
                print(f"[ExportAll] Invalid JSON: {path}")
                continue
        for entry in data.get("props", []):
            if not isinstance(entry, dict):
                continue
            def_path = str(entry.get("def", "")).strip()
            if not def_path:
                continue
            asset_id = _extract_asset_id(def_path)
            if asset_id:
                asset_ids.add(asset_id)
    return sorted(asset_ids)


def main() -> None:
    args = _parse_args()
    if args.all:
        asset_ids = _find_asset_collections()
    else:
        asset_ids = _collect_referenced_assets(args.scenes)

    if not asset_ids:
        raise SystemExit("No assets found to export")

    failures: List[str] = []
    for asset_id in asset_ids:
        try:
            export_asset.export_asset(asset_id, args.out)
        except Exception as exc:
            failures.append(asset_id)
            print(f"[ExportAll] Failed {asset_id}: {exc}")

    if failures:
        raise SystemExit(f"Export failed for {len(failures)} assets")

    print(f"[ExportAll] OK ({len(asset_ids)} assets)")


if __name__ == "__main__":
    main()
