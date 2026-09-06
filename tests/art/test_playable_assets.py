from __future__ import annotations

import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parents[2]
NORMALIZER = ROOT / "tools/art/normalize_playable_assets.py"
FAE_GENERATOR = ROOT / "tools/art/generate_fae.py"
BUILDING_GENERATOR = ROOT / "tools/art/generate_buildings.py"
VALIDATOR = ROOT / "tools/art/validate_sprite.py"
FAE_NAMES = (
    "idle.png", "idle_north.png", "idle_ne.png", "idle_east.png", "idle_se.png",
    "idle_south.png", "idle_sw.png", "idle_west.png", "idle_nw.png",
    *(f"walk_{direction}_{frame}.png" for direction in ("south", "north", "east", "west", "ne", "se", "sw", "nw") for frame in range(4)),
)
BUILDING_NAMES = (
    "general_store.png", "school.png", "library.png", "cafe.png", "arcade.png",
    "clinic.png", "town_hall.png", "pet_shop.png", "blacksmith.png",
)


def run_normalizer(output: Path, contact: Path, force: bool = False) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(NORMALIZER), "--output-dir", str(output), "--contact-dir", str(contact)]
    if force:
        command.append("--force")
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)


def files(root: Path) -> list[Path]:
    return [root / "characters/player/default" / name for name in FAE_NAMES] + [root / "buildings" / name for name in BUILDING_NAMES]


def rgba_pixels(path: Path) -> tuple[tuple[int, int], tuple[tuple[int, int, int, int], ...]]:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        return rgba.size, tuple(rgba.get_flattened_data())


class PlayableAssetTests(unittest.TestCase):
    def test_full_pack_dimensions_palette_alpha_and_true_transparency(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "sprites"
            result = run_normalizer(root, Path(directory) / "contact", True)
            self.assertEqual(result.returncode, 0, result.stderr)
            generated = files(root)
            self.assertEqual(len(generated), 50)
            self.assertTrue(all(path.is_file() for path in generated))
            for index, path in enumerate(generated):
                expected_size = (16, 24) if index < 41 else (48, 64)
                with Image.open(path) as image:
                    rgba = image.convert("RGBA")
                    self.assertEqual(rgba.size, expected_size, path)
                    alpha = set(rgba.getchannel("A").get_flattened_data())
                    self.assertTrue(alpha <= {0, 255}, path)
                    if index >= 41:
                        self.assertIn(0, alpha, path)
                validation = subprocess.run(
                    [sys.executable, str(VALIDATOR), str(path), "--biome", "cloverhollow", "--size", f"{expected_size[0]}x{expected_size[1]}"],
                    cwd=ROOT, capture_output=True, text=True, check=False,
                )
                self.assertEqual(validation.returncode, 0, f"{path}: {validation.stderr}")
            self.assertTrue((Path(directory) / "contact/fae_2x_labeled.png").is_file())
            self.assertTrue((Path(directory) / "contact/buildings_2x_labeled.png").is_file())

    def test_source_alpha_is_preserved_and_generators_produce_expected_lists(self) -> None:
        with tempfile.TemporaryDirectory(prefix="playable-source-") as directory:
            source = Path(directory)
            subprocess.run([sys.executable, str(FAE_GENERATOR)], cwd=source, check=True)
            subprocess.run([sys.executable, str(BUILDING_GENERATOR)], cwd=source, check=True)
            self.assertEqual(sorted(path.name for path in (source / "game/assets/sprites/characters/player/default").glob("*.png")), sorted(FAE_NAMES))
            self.assertEqual(sorted(path.name for path in (source / "game/assets/sprites/buildings").glob("*.png")), sorted(BUILDING_NAMES))
            normalized = Path(directory) / "sprites"
            result = run_normalizer(normalized, Path(directory) / "contact", True)
            self.assertEqual(result.returncode, 0, result.stderr)
            sources = [source / "game/assets/sprites/characters/player/default" / name for name in FAE_NAMES]
            sources += [source / "game/assets/sprites/buildings" / name for name in BUILDING_NAMES]
            for original, output in zip(sources, files(normalized)):
                with Image.open(original) as source_image, Image.open(output) as output_image:
                    self.assertEqual(source_image.convert("RGBA").getchannel("A").get_flattened_data(), output_image.convert("RGBA").getchannel("A").get_flattened_data(), original)

    def test_repeat_generation_is_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second = root / "first", root / "second"
            self.assertEqual(run_normalizer(first, root / "contact-first", True).returncode, 0)
            self.assertEqual(run_normalizer(second, root / "contact-second", True).returncode, 0)
            for generated, runtime in zip(files(first), files(ROOT / "game/assets/sprites")):
                self.assertEqual(rgba_pixels(generated), rgba_pixels(runtime), f"decoded runtime drift: {runtime}")
            first_hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in files(first)]
            second_hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in files(second)]
            self.assertEqual(first_hashes, second_hashes)

    def test_existing_outputs_require_force_and_remain_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "sprites"
            self.assertEqual(run_normalizer(root, Path(directory) / "contact", True).returncode, 0)
            before = {path: path.read_bytes() for path in files(root)}
            rejected = run_normalizer(root, Path(directory) / "contact", False)
            self.assertNotEqual(rejected.returncode, 0)
            self.assertTrue(all(path.read_bytes() == content for path, content in before.items()))


if __name__ == "__main__":
    unittest.main()
