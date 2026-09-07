"""Actual M230 PNGs, explicit palette validation, and reproducible authoring."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RECIPE = ROOT / "art/recipes/park25d_showcase.json"
BUILDER = ROOT / "tools/art/build_park25d_showcase.py"
OUTPUT = ROOT / "game/assets/studies/park25d/showcase"
TEXTURES = ("grass", "soil", "path", "stone", "wood", "roof", "water", "plaster")
SPRITES = {"oak_a": (64, 80), "oak_b": (64, 80), "pine": (48, 80),
           "bush": (32, 24), "grass_tuft": (16, 16), "flowers": (24, 16),
           "reeds": (16, 32), "rock": (24, 16)}


class ShowcaseTests(unittest.TestCase):
    def generate(self, target: Path, evidence: Path) -> None:
        subprocess.run([sys.executable, str(BUILDER), "--output", str(target),
                        "--evidence", str(evidence)], cwd=ROOT, check=True, timeout=30)

    def test_recipe_contract(self) -> None:
        recipe = json.loads(RECIPE.read_text())
        self.assertEqual(recipe["textures"], list(TEXTURES))
        self.assertEqual(recipe["texture_size"], [32, 32])
        self.assertEqual(recipe["texels_per_meter"], 20)
        self.assertEqual(recipe["sprite_pixel_size"], 0.05)
        self.assertEqual(recipe["seed"], 230)
        self.assertEqual(recipe["sprites"], {key: list(size) for key, size in SPRITES.items()})

    def test_every_runtime_png_dimensions_alpha_palette_and_anchor(self) -> None:
        for name, size in {**dict.fromkeys(TEXTURES, (32, 32)), **SPRITES}.items():
            with self.subTest(name=name):
                path = OUTPUT / f"{name}.png"
                with Image.open(path) as image:
                    self.assertEqual(image.mode, "RGBA")
                    self.assertEqual(image.size, size)
                    alpha = image.getchannel("A")
                    if name in TEXTURES:
                        self.assertEqual(set(alpha.get_flattened_data()), {255})
                        self.assertEqual(image.width % 16, 0)
                        self.assertEqual(image.height % 16, 0)
                        if name == "plaster":
                            colors = image.getcolors()
                            self.assertEqual(len(colors), 2)
                            self.assertGreater(max(count for count, _ in colors), 960)
                    else:
                        self.assertEqual(set(alpha.get_flattened_data()), {0, 255})
                        bounds = alpha.getbbox()
                        self.assertIsNotNone(bounds)
                        self.assertGreater(bounds[0], 0)
                        self.assertGreater(bounds[1], 0)
                        self.assertLess(bounds[2], image.width)
                        self.assertEqual(bounds[3], image.height)
                        self.assertEqual(alpha.getpixel((image.width // 2, image.height - 1)), 255)
                result = subprocess.run(
                    [sys.executable, str(ROOT / "tools/art/validate_sprite.py"), str(path),
                     "--palette", str(ROOT / "art/palettes/cloverhollow.palette.json"),
                     "--palette", str(ROOT / "art/palettes/global_ui_skin.palette.json"),
                     "--size", f"{size[0]}x{size[1]}"],
                    capture_output=True, text=True, check=False, timeout=10)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_regeneration_bytes_match_runtime_and_contact_sheet(self) -> None:
        with tempfile.TemporaryDirectory(prefix="m230-art-") as directory:
            root = Path(directory)
            self.generate(root / "first", root / "evidence-a")
            self.generate(root / "second", root / "evidence-b")
            for name in (*TEXTURES, *SPRITES):
                filename = f"{name}.png"
                first = (root / "first" / filename).read_bytes()
                self.assertEqual(first, (root / "second" / filename).read_bytes(), filename)
                self.assertEqual(first, (OUTPUT / filename).read_bytes(), filename)
            sheet = "texture-sprite-sheet.png"
            self.assertEqual((root / "evidence-a" / sheet).read_bytes(),
                             (root / "evidence-b" / sheet).read_bytes())
            with Image.open(root / "evidence-a" / sheet) as image:
                self.assertEqual(image.size, (1024, 640))

    def test_oaks_have_distinct_silhouettes_and_four_foliage_tones(self) -> None:
        recipe = json.loads(RECIPE.read_text())
        greens = {tuple(bytes.fromhex(value[1:])) for key, value in recipe["colors"].items()
                  if key.startswith("leaf_")}
        with Image.open(OUTPUT / "oak_a.png") as first, Image.open(OUTPUT / "oak_b.png") as second:
            self.assertNotEqual(first.getchannel("A").tobytes(), second.getchannel("A").tobytes())
            self.assertNotEqual(first.crop((0, 60, 64, 80)).tobytes(),
                                second.crop((0, 60, 64, 80)).tobytes())
        for name in ("oak_a", "oak_b", "pine", "bush"):
            with Image.open(OUTPUT / f"{name}.png") as image:
                visible = {pixel[:3] for pixel in image.get_flattened_data() if pixel[3]}
                self.assertEqual(len(visible & greens), 4, name)

    def test_texture_tiling_matches_continuous_nine_tile_render(self) -> None:
        spec = importlib.util.spec_from_file_location("showcase", BUILDER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        for index, name in enumerate(TEXTURES):
            with self.subTest(texture=name):
                tile = builder.texture(name, 230 + index)
                tiled = Image.new("RGBA", (96, 96))
                for y in range(0, 96, 32):
                    for x in range(0, 96, 32):
                        tiled.paste(tile, (x, y))
                continuous = builder.texture(name, 230 + index, repeats=3)
                self.assertEqual(tiled.tobytes(), continuous.tobytes())


if __name__ == "__main__":
    unittest.main()
