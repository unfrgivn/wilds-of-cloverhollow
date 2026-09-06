"""Bounded regression checks for the authored Park 25D GLB files."""

import json
import math
import struct
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[2]
ASSET_DIR = ROOT / "game/assets/studies/park25d"


def load_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise AssertionError(f"invalid GLB header in {path}")
    chunks = []
    offset = 12
    while offset < length:
        size, kind = struct.unpack_from("<II", data, offset)
        chunks.append((kind, data[offset + 8 : offset + 8 + size]))
        offset += 8 + size
    json_chunk = next(c for kind, c in chunks if kind == 0x4E4F534A)
    binary = next(c for kind, c in chunks if kind == 0x4E4942)
    return json.loads(json_chunk.rstrip(b" \t\r\n\0")), binary


def accessor_values(doc, binary, index):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"]
    widths = {5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    fmt, size = widths[accessor["componentType"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[accessor["type"]]
    stride = view.get("byteStride", components * size)
    values = []
    for row in range(count):
        at = start + row * stride
        values.append(struct.unpack_from("<" + fmt * components, binary, at))
    return values


def mesh_bounds(doc, binary, mesh_index):
    points = []
    for primitive in doc["meshes"][mesh_index]["primitives"]:
        points.extend(accessor_values(doc, binary, primitive["attributes"]["POSITION"]))
    return tuple((min(p[i] for p in points), max(p[i] for p in points)) for i in range(3))


def node_bounds(doc, binary, node):
    if any(key in node for key in ("matrix", "rotation", "children")):
        raise AssertionError("Study bounds require flat nodes with applied rotations")
    bounds = mesh_bounds(doc, binary, node["mesh"])
    translation = node.get("translation", [0, 0, 0])
    scale = node.get("scale", [1, 1, 1])
    return tuple((lo * scale[i] + translation[i], hi * scale[i] + translation[i])
                 if scale[i] >= 0 else (hi * scale[i] + translation[i], lo * scale[i] + translation[i])
                 for i, (lo, hi) in enumerate(bounds))


def srgb_to_linear(channel):
    value = int(channel, 16) / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


class StudyGlbTests(unittest.TestCase):
    def test_glbs_have_valid_headers_and_json_binary_chunks(self):
        for path in sorted(ASSET_DIR.glob("*.glb")):
            doc, binary = load_glb(path)
            self.assertGreater(len(binary), 0, path)
            self.assertIn("nodes", doc)
            self.assertIn("meshes", doc)

    def test_declared_assets_have_runtime_paths_and_named_model_hierarchy(self):
        recipe = json.loads((ROOT / "art/recipes/park25d.json").read_text())
        names = {asset["name"] for asset in recipe["assets"]}
        self.assertEqual(names, {"cottage", "bridge"})
        for name in names:
            path = ASSET_DIR / f"{name}.glb"
            self.assertTrue(path.is_file(), path)
            doc, _ = load_glb(path)
            node_names = [node.get("name", "") for node in doc["nodes"]]
            self.assertTrue(node_names)
            self.assertTrue(all(node_name.startswith("P25D_") for node_name in node_names))
            self.assertEqual(doc["scene"], 0)
            self.assertTrue(doc["scenes"][0]["nodes"])

    def test_positions_normals_and_triangle_indices_are_finite_and_valid(self):
        for path in sorted(ASSET_DIR.glob("*.glb")):
            doc, binary = load_glb(path)
            for mesh in doc["meshes"]:
                for primitive in mesh["primitives"]:
                    positions = accessor_values(doc, binary, primitive["attributes"]["POSITION"])
                    normals = accessor_values(doc, binary, primitive["attributes"]["NORMAL"])
                    self.assertEqual(len(positions), len(normals))
                    self.assertGreater(len(positions), 0)
                    for point, normal in zip(positions, normals):
                        self.assertTrue(all(math.isfinite(value) for value in point + normal))
                        self.assertAlmostEqual(math.sqrt(sum(value * value for value in normal)), 1.0, delta=0.01)
                    indices = accessor_values(doc, binary, primitive["indices"])
                    flat = [value[0] for value in indices]
                    self.assertEqual(len(flat) % 3, 0)
                    self.assertTrue(all(0 <= index < len(positions) for index in flat))
                    self.assertGreater(len(set(flat)), 2)

    def test_authored_geometry_has_meaningful_bounds(self):
        for path in sorted(ASSET_DIR.glob("*.glb")):
            doc, binary = load_glb(path)
            for mesh in doc["meshes"]:
                bounds = mesh_bounds(doc, binary, doc["meshes"].index(mesh))
                self.assertTrue(all(math.isfinite(value) for axis in bounds for value in axis))
                self.assertTrue(all(hi - lo > 0.001 for lo, hi in bounds))

    def test_material_colors_are_linearized_recipe_colors(self):
        colors = json.loads((ROOT / "art/recipes/park25d.json").read_text())["colors"]
        for path in sorted(ASSET_DIR.glob("*.glb")):
            doc, _ = load_glb(path)
            for material in doc["materials"]:
                name = material["name"].removeprefix("P25D_")
                factor = material["pbrMetallicRoughness"]["baseColorFactor"]
                expected = tuple(srgb_to_linear(colors[name][i:i + 2]) for i in (1, 3, 5))
                self.assertEqual(factor[3], 1.0)
                for actual, target in zip(factor[:3], expected):
                    self.assertAlmostEqual(actual, target, delta=0.002)

    def test_world_bounds_match_declared_study_dimensions(self):
        expected = {
            "bridge": {"x": (4.0, 0.001), "z": (2.0, 0.001), "deck": (0.16, 0.001), "rail": (1.0, 0.001)},
            "cottage": {"wall_x": (3.2, 0.001), "wall_z": (2.4, 0.001), "wall_y": (2.2, 0.001), "roof_y": (3.05, 0.001)},
        }
        for name, claims in expected.items():
            doc, binary = load_glb(ASSET_DIR / f"{name}.glb")
            nodes = {node["name"]: node for node in doc["nodes"]}
            if name == "bridge":
                all_bounds = [node_bounds(doc, binary, node) for node in doc["nodes"]]
                self.assertAlmostEqual(max(b[0][1] for b in all_bounds) - min(b[0][0] for b in all_bounds), claims["x"][0], delta=claims["x"][1])
                self.assertAlmostEqual(max(b[2][1] for b in all_bounds) - min(b[2][0] for b in all_bounds), claims["z"][0], delta=claims["z"][1])
                self.assertAlmostEqual(node_bounds(doc, binary, nodes["P25D_DeckPlank_00"])[1][1], claims["deck"][0], delta=claims["deck"][1])
                self.assertAlmostEqual(node_bounds(doc, binary, nodes["P25D_Rail-0.78"])[1][1], claims["rail"][0], delta=claims["rail"][1])
            else:
                wall = node_bounds(doc, binary, nodes["P25D_CottageWallMass"])
                roof = node_bounds(doc, binary, nodes["P25D_CottageGableRoof"])
                self.assertAlmostEqual(wall[0][1] - wall[0][0], claims["wall_x"][0], delta=claims["wall_x"][1])
                self.assertAlmostEqual(wall[2][1] - wall[2][0], claims["wall_z"][0], delta=claims["wall_z"][1])
                self.assertAlmostEqual(wall[1][1] - wall[1][0], claims["wall_y"][0], delta=claims["wall_y"][1])
                self.assertAlmostEqual(roof[1][1], claims["roof_y"][0], delta=claims["roof_y"][1])


if __name__ == "__main__":
    unittest.main()
