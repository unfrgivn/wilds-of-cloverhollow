from __future__ import annotations

import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parents[2]
GENERATOR = ROOT / "tools/art/generate_park_terrain.py"
VALIDATOR = ROOT / "tools/art/validate_sprite.py"
PALETTE = ROOT / "art/palettes/cloverhollow.palette.json"
GLOBAL = ROOT / "art/palettes/global_ui_skin.palette.json"
RUNTIME = ROOT / "game/assets/sprites/tiles/park"
NAMES = (
    "grass", "path_center", "path_edge_n", "path_edge_s", "path_edge_e", "path_edge_w",
    "path_corner_ne", "path_corner_nw", "path_corner_se", "path_corner_sw",
    "pond_water", "pond_shore_n", "park_hedge",
)


def rgba_pixels(path: Path) -> tuple[tuple[int, int], tuple[tuple[int, int, int, int], ...]]:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        return rgba.size, tuple(rgba.get_flattened_data())


class ParkTerrainTests(unittest.TestCase):
    def generate(self, output: Path, contact_sheet: Path | None = None) -> None:
        command = ["uv", "run", "--locked", "--project", str(ROOT), "python", str(GENERATOR), "--output-dir", str(output)]
        if contact_sheet is not None:
            command.extend(["--contact-sheet", str(contact_sheet)])
        subprocess.run(command, check=True, cwd=ROOT)

    def test_generated_tiles_are_native_sized_palette_compliant_and_binary_alpha(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "park"
            self.generate(output)
            for name in NAMES:
                image_path = output / f"{name}.png"
                self.assertTrue(image_path.is_file())
                with Image.open(image_path) as image:
                    self.assertEqual(image.size, (16, 16))
                    alpha = image.convert("RGBA").getchannel("A").get_flattened_data()
                    self.assertTrue(set(alpha) <= {0, 255})
                result = subprocess.run(
                    ["uv", "run", "--locked", "--project", str(ROOT), "python", str(VALIDATOR), str(image_path),
                     "--palette", str(PALETTE), "--palette", str(GLOBAL), "--size", "16x16"],
                    check=False, capture_output=True, text=True, cwd=ROOT,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_generation_is_byte_deterministic_and_writes_contact_sheet(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second = root / "first", root / "second"
            contact = ROOT / "captures/m226/art/park_terrain/contact_sheet.png"
            self.generate(first, contact)
            self.generate(second)
            for name in NAMES:
                self.assertEqual(rgba_pixels(first / f"{name}.png"), rgba_pixels(RUNTIME / f"{name}.png"), f"decoded runtime drift: {name}")
            first_hashes = [hashlib.sha256((first / f"{name}.png").read_bytes()).hexdigest() for name in NAMES]
            second_hashes = [hashlib.sha256((second / f"{name}.png").read_bytes()).hexdigest() for name in NAMES]
            self.assertEqual(first_hashes, second_hashes)
            with Image.open(contact) as image:
                self.assertEqual(image.size, (64, 64))
                self.assertEqual(image.get_flattened_data()[0], (106, 204, 106))

    def test_three_by_three_path_patch_has_matching_shared_edges(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "park"
            self.generate(output)
            names = [
                ["path_corner_nw", "path_edge_n", "path_corner_ne"],
                ["path_edge_w", "path_center", "path_edge_e"],
                ["path_corner_sw", "path_edge_s", "path_corner_se"],
            ]
            tiles = {}
            for row in names:
                for name in row:
                    with Image.open(output / f"{name}.png") as image:
                        tiles[name] = image.get_flattened_data()
            for row in range(3):
                for column in range(2):
                    left = tiles[names[row][column]]
                    right = tiles[names[row][column + 1]]
                    self.assertEqual([left[y * 16 + 15] for y in range(16)], [right[y * 16] for y in range(16)])
            for row in range(2):
                for column in range(3):
                    upper = tiles[names[row][column]]
                    lower = tiles[names[row + 1][column]]
                    self.assertEqual([upper[15 * 16 + x] for x in range(16)], [lower[x] for x in range(16)])
            self.assertNotEqual((output / "path_edge_e.png").read_bytes(), (output / "path_edge_w.png").read_bytes())


if __name__ == "__main__":
    unittest.main()
