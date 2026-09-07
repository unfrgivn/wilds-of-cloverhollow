from pathlib import Path
import re
import unittest


ROOT = Path(__file__).parents[2]
SOURCE = ROOT / "game/scripts/studies/Park3DStudy.gd"
Vec = tuple[float, float, float]


def _function(source: str, name: str) -> str:
    match = re.search(rf"func {name}\([^\n]*\).*?:\n(.*?)(?=\nfunc |\Z)", source, re.S)
    if match is None:
        raise AssertionError(f"missing function {name}")
    return match.group(1)


def _geometry(body: str, bindings: dict[str, float] | None = None) -> tuple[list[Vec], list[int]]:
    vertex_match = re.search(r"vertices := PackedVector3Array\(\[(.*?)\]\)", body, re.S)
    index_match = re.search(r"indices := PackedInt32Array\(\[(.*?)\]\)", body, re.S)
    if vertex_match is None or index_match is None:
        raise AssertionError("missing geometry initializer")
    values = bindings or {}
    vertices = []
    for literal in re.findall(r"Vector3\(([^)]*)\)", vertex_match.group(1)):
        parts = [part.strip() for part in literal.split(",")]
        vertices.append(tuple(float(values.get(part, part)) for part in parts))  # type: ignore[arg-type]
    indices = [int(value) for value in re.findall(r"-?\d+", index_match.group(1))]
    if "if x_low > x_high:" in body and values["x_low"] > values["x_high"]:
        indices.reverse()
    return vertices, indices


def _approach_bindings(source: str) -> list[dict[str, float]]:
    world = _function(source, "_build_world")
    calls = re.findall(r'_add_bridge_approach\("[^"]+",\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)', world)
    variables = dict(re.findall(r"var (\w+) := ([0-9.-]+)", world))
    return [{"x_low": float(low), "x_high": float(high), "top": float(variables.get(top.strip(), top))} for low, high, top in calls]


def _cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _sub(a: Vec, b: Vec) -> Vec:
    return tuple(a[i] - b[i] for i in range(3))  # type: ignore[return-value]


def _dot(a: Vec, b: Vec) -> float:
    return sum(a[i] * b[i] for i in range(3))


class Park3DStudyContractTests(unittest.TestCase):
    def test_geometry_assertions_measure_scene_nodes_instead_of_repeating_constructor_constants(self) -> None:
        source = SOURCE.read_text()
        body = _function(source, "_geometry_assertions")
        self.assertIn("_mesh_nodes_with_prefix", source)
        self.assertIn("_path_vertex_observations", source)
        self.assertIn("get_aabb()", source)
        self.assertNotIn("0.16 + 1.39", body)

    def test_wedge_initializer_is_a_closed_outward_solid_with_expected_slope(self) -> None:
        source = SOURCE.read_text()
        vertices, indices = _geometry(_function(source, "_add_wedge_ramp"))
        self.assertEqual(len(vertices), 6)
        self.assertEqual(len(indices), 24)
        triangles = [tuple(sorted(indices[i : i + 3])) for i in range(0, len(indices), 3)]
        self.assertEqual(len(set(triangles)), 8)
        edges = [(min(tri[i], tri[(i + 1) % 3]), max(tri[i], tri[(i + 1) % 3])) for tri in [indices[i : i + 3] for i in range(0, len(indices), 3)] for i in range(3)]
        self.assertTrue(all(edges.count(edge) == 2 for edge in set(edges)))
        center = tuple(sum(vertex[i] for vertex in vertices) / len(vertices) for i in range(3))
        volume = 0.0
        for i in range(0, len(indices), 3):
            a, b, c = (vertices[indices[i + j]] for j in range(3))
            outward = tuple(-component for component in _cross(_sub(b, a), _sub(c, a)))
            centroid = tuple((a[k] + b[k] + c[k]) / 3 for k in range(3))
            self.assertGreater(_dot(outward, _sub(centroid, center)), 0.0)
            volume += _dot(a, _cross(b, c)) / 6.0
        self.assertGreater(abs(volume), 0.0)
        self.assertAlmostEqual(max(vertex[1] for vertex in vertices) - min(vertex[1] for vertex in vertices), 1.2)
        self.assertAlmostEqual(1.2 / (max(vertex[0] for vertex in vertices) - min(vertex[0] for vertex in vertices)), 0.3)

    def test_bridge_approach_call_bindings_produce_closed_outward_solids(self) -> None:
        source = SOURCE.read_text()
        body = _function(source, "_add_bridge_approach")
        bindings = _approach_bindings(source)
        self.assertEqual(bindings, [{"x_low": -2.5, "x_high": -2.0, "top": 0.16}, {"x_low": 2.5, "x_high": 2.0, "top": 0.16}])
        for values in bindings:
            vertices, indices = _geometry(body, values)
            self.assertEqual(len(vertices), 6)
            self.assertEqual(len(indices), 24)
            self.assertEqual(len({tuple(sorted(indices[i : i + 3])) for i in range(0, 24, 3)}), 8)
            edges = [(min(tri[i], tri[(i + 1) % 3]), max(tri[i], tri[(i + 1) % 3])) for tri in [indices[i : i + 3] for i in range(0, 24, 3)] for i in range(3)]
            self.assertTrue(all(edges.count(edge) == 2 for edge in set(edges)))
            center = tuple(sum(vertex[i] for vertex in vertices) / 6 for i in range(3))
            for i in range(0, 24, 3):
                a, b, c = (vertices[indices[i + j]] for j in range(3))
                normal = tuple(-component for component in _cross(_sub(b, a), _sub(c, a)))
                centroid = tuple((a[k] + b[k] + c[k]) / 3 for k in range(3))
                self.assertGreater(_dot(normal, _sub(centroid, center)), 0.0)

    def test_bridge_rail_colliders_are_bounded_by_four_metre_glb(self) -> None:
        source = SOURCE.read_text()
        calls = re.findall(r'_add_box\("BridgeRail(?:Front|Back)",\s*Vector3\([^)]*\),\s*Vector3\(([^)]*)\)', source)
        self.assertEqual(len(calls), 2)
        for size in calls:
            width = float(size.split(",")[0].strip())
            self.assertAlmostEqual(width, 3.34)
            self.assertLessEqual(width, 4.0)


if __name__ == "__main__":
    unittest.main()
