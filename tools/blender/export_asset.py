import argparse
import json
import os
import sys
from typing import Dict, Optional

import bpy

ASSET_PREFIX = "ASSET__"
COL_BASE = "COL_BASE"
COL_OVERHANG = "COL_OVERHANG"
COL_FOOTPRINT = "COL_FOOTPRINT"
RENDER_CAM = "RENDER_CAM"
FOOTPRINT_CAM = "FOOTPRINT_CAM"
FOOTPRINT_MAT_NAME = "FOOTPRINT_MAT"


def _parse_args() -> argparse.Namespace:
    if "--" not in sys.argv:
        raise SystemExit("Missing -- separator for script arguments")
    args = sys.argv[sys.argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Export a single asset collection")
    parser.add_argument("--asset", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args)


def _build_parent_map() -> Dict[bpy.types.Collection, bpy.types.Collection]:
    parent_map: Dict[bpy.types.Collection, bpy.types.Collection] = {}
    for collection in bpy.data.collections:
        for child in collection.children:
            parent_map[child] = collection
    return parent_map


def _hide_all_collections() -> None:
    for collection in bpy.data.collections:
        collection.hide_render = True


def _show_collection_and_parents(
    collection: bpy.types.Collection,
    parent_map: Dict[bpy.types.Collection, bpy.types.Collection],
) -> None:
    collection.hide_render = False
    for child in collection.children_recursive:
        child.hide_render = False
    parent = parent_map.get(collection)
    while parent is not None:
        parent.hide_render = False
        parent = parent_map.get(parent)


def _find_child_collection(
    parent: bpy.types.Collection, name: str
) -> Optional[bpy.types.Collection]:
    for child in parent.children_recursive:
        if child.name == name:
            return child
        if child.name.startswith(f"{name}."):
            return child
        if child.name.startswith(f"{name}_"):
            return child
    return None


def _collection_has_objects(collection: bpy.types.Collection) -> bool:
    return len(collection.all_objects) > 0


def _ensure_camera(name: str) -> bpy.types.Object:
    camera = bpy.data.objects.get(name)
    if camera is None:
        raise RuntimeError(f"Missing camera: {name}")
    return camera


def _ensure_material() -> bpy.types.Material:
    material = bpy.data.materials.get(FOOTPRINT_MAT_NAME)
    if material is None:
        material = bpy.data.materials.new(FOOTPRINT_MAT_NAME)
        material.use_nodes = True
        nodes = material.node_tree.nodes
        nodes.clear()
        output = nodes.new("ShaderNodeOutputMaterial")
        emission = nodes.new("ShaderNodeEmission")
        emission.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        emission.inputs["Strength"].default_value = 1.0
        material.node_tree.links.new(
            emission.outputs["Emission"], output.inputs["Surface"]
        )
    return material


def _render_to_path(scene: bpy.types.Scene, path: str) -> None:
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export_asset(asset_id: str, out_root: str) -> None:
    asset_collection_name = f"{ASSET_PREFIX}{asset_id}"
    asset_collection = bpy.data.collections.get(asset_collection_name)
    if asset_collection is None:
        raise RuntimeError(f"Missing collection: {asset_collection_name}")

    base_collection = _find_child_collection(asset_collection, COL_BASE)
    if base_collection is None:
        raise RuntimeError(f"Missing {COL_BASE} under {asset_collection_name}")

    overhang_collection = _find_child_collection(asset_collection, COL_OVERHANG)
    footprint_collection = _find_child_collection(asset_collection, COL_FOOTPRINT)
    if footprint_collection is None:
        raise RuntimeError(f"Missing {COL_FOOTPRINT} under {asset_collection_name}")

    out_root = os.path.abspath(out_root)
    asset_dir = os.path.join(out_root, asset_id)
    visuals_dir = os.path.join(asset_dir, "visuals")
    footprints_dir = os.path.join(asset_dir, "footprints")
    generated_dir = os.path.join(asset_dir, "_generated")
    os.makedirs(visuals_dir, exist_ok=True)
    os.makedirs(footprints_dir, exist_ok=True)
    os.makedirs(generated_dir, exist_ok=True)

    parent_map = _build_parent_map()
    scene = bpy.context.scene
    view_layer = bpy.context.view_layer

    render_cam = _ensure_camera(RENDER_CAM)
    footprint_cam = _ensure_camera(FOOTPRINT_CAM)

    base_path = os.path.join(visuals_dir, "base.png")
    _hide_all_collections()
    _show_collection_and_parents(base_collection, parent_map)
    scene.camera = render_cam
    view_layer.material_override = None
    _render_to_path(scene, base_path)

    has_overhang = False
    overhang_path = None
    if overhang_collection is not None and _collection_has_objects(overhang_collection):
        overhang_path = os.path.join(visuals_dir, "overhang.png")
        _hide_all_collections()
        _show_collection_and_parents(overhang_collection, parent_map)
        scene.camera = render_cam
        view_layer.material_override = None
        _render_to_path(scene, overhang_path)
        has_overhang = True

    footprint_path = os.path.join(footprints_dir, "block.png")
    _hide_all_collections()
    _show_collection_and_parents(footprint_collection, parent_map)
    scene.camera = footprint_cam
    view_layer.material_override = _ensure_material()
    _render_to_path(scene, footprint_path)
    view_layer.material_override = None

    blocks_movement = _collection_has_objects(footprint_collection)

    manifest = {
        "asset_id": asset_id,
        "outputs": {
            "base_png": os.path.relpath(base_path, asset_dir),
            "overhang_png": os.path.relpath(overhang_path, asset_dir)
            if overhang_path
            else None,
            "footprint_png": os.path.relpath(footprint_path, asset_dir),
        },
        "anchor": {"mode": "anchor_empty", "anchor_hint": "ANCHOR at feet"},
        "defaults": {
            "blocks_movement": blocks_movement,
            "has_overhang": has_overhang,
            "default_bake_mode": "static",
        },
    }

    manifest_path = os.path.join(asset_dir, f"{asset_id}_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)

    print(f"[ExportAsset] {asset_id} -> {manifest_path}")


def main() -> None:
    args = _parse_args()
    export_asset(args.asset, args.out)


if __name__ == "__main__":
    main()
