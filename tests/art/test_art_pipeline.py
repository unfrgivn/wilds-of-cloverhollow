from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parents[2]
VALIDATE = ROOT / "tools/art/validate_sprite.py"
QUANTIZE = ROOT / "tools/art/quantize_to_palette.py"
PACK = ROOT / "tools/art/pack_spritesheet.py"


def write_palette(path: Path, value: object) -> None:
    path.write_text(json.dumps({"colors": value}), encoding="utf-8")


def write_image(path: Path, size: tuple[int, int], pixels: list[tuple[int, int, int, int]]) -> None:
    image = Image.new("RGBA", size)
    image.putdata(pixels)
    image.save(path)


def run(script: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(script), *args], capture_output=True, text=True)


class ArtPipelineTests(unittest.TestCase):
    def test_validation_recurses_nested_and_unions_palettes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            image = tmp_path / "sprite 16x24.png"
            palette_a, palette_b = tmp_path / "biome.json", tmp_path / "global.json"
            write_image(image, (16, 24), [(255, 0, 0, 255), (0, 0, 255, 255)] * 192)
            write_palette(palette_a, {"nested": {"red": "#ff0000"}})
            write_palette(palette_b, ["#0000ff"])
            result = run(VALIDATE, str(image), "--palette", str(palette_a), "--palette", str(palette_b), "--size", "16x16")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("dimensions", result.stderr)
            result = run(VALIDATE, str(image), "--palette", str(palette_a), "--palette", str(palette_b), "--size", "16x24")
            self.assertEqual(result.returncode, 0)


    def test_transparent_stray_is_ignored_but_visible_stray_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            palette, image = tmp_path / "palette.json", tmp_path / "sprite.png"
            write_palette(palette, ["#ff0000"])
            write_image(image, (1, 1), [(0, 255, 0, 0)])
            self.assertEqual(run(VALIDATE, str(image), "--palette", str(palette), "--size", "1x1").returncode, 0)
            write_image(image, (1, 1), [(0, 255, 0, 255)])
            self.assertNotEqual(run(VALIDATE, str(image), "--palette", str(palette), "--size", "1x1").returncode, 0)

    def test_malformed_palette_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            palette, image = tmp_path / "bad.json", tmp_path / "sprite.png"
            palette.write_text('{"colors": ["#12zz00"]}', encoding="utf-8")
            write_image(image, (1, 1), [(255, 0, 0, 255)])
            self.assertNotEqual(run(VALIDATE, str(image), "--palette", str(palette), "--size", "1x1").returncode, 0)

    def test_metadata_outside_colors_does_not_supply_palette_colors(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            palette, image = tmp_path / "bad.json", tmp_path / "sprite.png"
            palette.write_text('{"colors": [123], "description": "#ff0000"}', encoding="utf-8")
            write_image(image, (1, 1), [(255, 0, 0, 255)])
            self.assertNotEqual(run(VALIDATE, str(image), "--palette", str(palette), "--size", "1x1").returncode, 0)


    def test_quantize_preserves_alpha_and_never_overwrites_input(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            palette, source, output = tmp_path / "palette.json", tmp_path / "in.png", tmp_path / "out.png"
            write_palette(palette, ["#ff0000", "#0000ff"])
            write_image(source, (2, 1), [(250, 0, 0, 127), (0, 255, 0, 0)])
            result = run(QUANTIZE, str(source), str(palette), str(source))
            self.assertNotEqual(result.returncode, 0)
            extra = tmp_path / "extra.json"
            write_palette(extra, ["#0000ff"])
            write_image(source, (2, 1), [(250, 0, 0, 127), (0, 0, 250, 255)])
            self.assertEqual(run(QUANTIZE, str(source), str(palette), str(output), "--palette", str(extra)).returncode, 0)
            with Image.open(output) as image:
                self.assertEqual(list(image.convert("RGBA").get_flattened_data()), [(255, 0, 0, 127), (0, 0, 255, 255)])


    def test_pack_sorts_paths_with_spaces_and_rejects_empty_or_mismatched_frames(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            frames = tmp_path / "frames with spaces"
            frames.mkdir()
            write_image(frames / "b.png", (2, 2), [(0, 0, 255, 255)] * 4)
            write_image(frames / "a.png", (2, 2), [(255, 0, 0, 255)] * 4)
            output = tmp_path / "sheet output.png"
            self.assertEqual(run(PACK, str(frames), str(output), "--cols", "2").returncode, 0)
            metadata = json.loads(output.with_suffix(".json").read_text(encoding="utf-8"))
            self.assertEqual([frame["file"] for frame in metadata["frames"]], ["a.png", "b.png"])
            empty = tmp_path / "empty"
            empty.mkdir()
            self.assertNotEqual(run(PACK, str(empty), str(tmp_path / "empty.png")).returncode, 0)
            write_image(frames / "bad.png", (1, 2), [(0, 0, 0, 255)] * 2)
            self.assertNotEqual(run(PACK, str(frames), str(tmp_path / "bad-sheet.png")).returncode, 0)
            existing_output = tmp_path / "existing.png"
            existing_metadata = existing_output.with_suffix(".json")
            existing_output.write_bytes(b"do not replace")
            existing_metadata.write_bytes(b"metadata stays")
            before_output, before_metadata = existing_output.read_bytes(), existing_metadata.read_bytes()
            self.assertNotEqual(run(PACK, str(frames), str(existing_output)).returncode, 0)
            self.assertEqual(existing_output.read_bytes(), before_output)
            self.assertEqual(existing_metadata.read_bytes(), before_metadata)
            source_bytes = (frames / "a.png").read_bytes()
            self.assertNotEqual(run(PACK, str(frames), str(frames / "a.png"), "--force").returncode, 0)
            self.assertEqual((frames / "a.png").read_bytes(), source_bytes)


if __name__ == "__main__":
    unittest.main()
