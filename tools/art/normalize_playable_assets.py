#!/usr/bin/env python3
"""Rebuild and palette-normalize the explicit playable town asset pack."""

from __future__ import annotations

import argparse
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw

ROOT: Final = Path(__file__).resolve().parents[2]
FAE_GENERATOR: Final = ROOT / "tools/art/generate_fae.py"
BUILDING_GENERATOR: Final = ROOT / "tools/art/generate_buildings.py"
BIOME_PALETTE: Final = ROOT / "art/palettes/cloverhollow.palette.json"
GLOBAL_PALETTE: Final = ROOT / "art/palettes/global_ui_skin.palette.json"
DEFAULT_OUTPUT: Final = ROOT / "captures/m226/playable-art/staged"
CONTACT_DIR: Final = ROOT / "captures/m226/playable-art"
FAE_NAMES: Final[tuple[str, ...]] = (
    "idle.png", "idle_north.png", "idle_ne.png", "idle_east.png", "idle_se.png",
    "idle_south.png", "idle_sw.png", "idle_west.png", "idle_nw.png",
    *(f"walk_{direction}_{frame}.png" for direction in ("south", "north", "east", "west", "ne", "se", "sw", "nw") for frame in range(4)),
)
BUILDING_NAMES: Final[tuple[str, ...]] = (
    "general_store.png", "school.png", "library.png", "cafe.png", "arcade.png",
    "clinic.png", "town_hall.png", "pet_shop.png", "blacksmith.png",
)


def run_generator(script: Path, cwd: Path) -> None:
    result = subprocess.run(
        ["uv", "run", "--locked", "--project", str(ROOT), "python", str(script)],
        cwd=cwd, capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"generator failed: {script.name}\n{result.stdout}{result.stderr}")


def quantize(source: Path, destination: Path, force: bool) -> None:
    command = [
        "uv", "run", "--locked", "--project", str(ROOT), "python",
        str(ROOT / "tools/art/quantize_to_palette.py"), str(source), str(BIOME_PALETTE), str(destination),
        "--palette", str(GLOBAL_PALETTE),
    ]
    if force:
        command.append("--force")
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"quantization failed for {source}:\n{result.stdout}{result.stderr}")


def contact_sheet(paths: list[Path], output: Path, columns: int, scale: int) -> None:
    label_height = 18
    cell_width, cell_height = 48 * scale, 64 * scale + label_height
    sheet = Image.new("RGBA", (columns * cell_width, ((len(paths) + columns - 1) // columns) * cell_height), (245, 234, 214, 255))
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        with Image.open(path) as source:
            image = source.convert("RGBA").resize((source.width * scale, source.height * scale), Image.Resampling.NEAREST)
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        sheet.alpha_composite(image, (x, y))
        draw.text((x, y + image.height + 1), path.name, fill=(61, 50, 40, 255))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, format="PNG", optimize=False)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--contact-dir", type=Path, default=CONTACT_DIR)
    parser.add_argument("--force", action="store_true", help="replace the explicit 50 published outputs")
    args = parser.parse_args(argv)
    target_root = args.output_dir.resolve()
    targets = [target_root / "characters/player/default" / name for name in FAE_NAMES]
    targets += [target_root / "buildings" / name for name in BUILDING_NAMES]
    existing = [path for path in targets if path.exists()]
    if existing and not args.force:
        raise SystemExit("target output contains existing playable assets; use --force")
    with tempfile.TemporaryDirectory(prefix="playable-art-source-", dir=os.environ.get("TMPDIR")) as source_dir_name:
        source_root = Path(source_dir_name)
        run_generator(FAE_GENERATOR, source_root)
        run_generator(BUILDING_GENERATOR, source_root)
        fae_source = source_root / "game/assets/sprites/characters/player/default"
        building_source = source_root / "game/assets/sprites/buildings"
        if sorted(path.name for path in fae_source.glob("*.png")) != sorted(FAE_NAMES):
            raise RuntimeError("Fae generator did not produce the expected 41-file pack")
        if sorted(path.name for path in building_source.glob("*.png")) != sorted(BUILDING_NAMES):
            raise RuntimeError("building generator did not produce the expected 9-file pack")
        for name in FAE_NAMES:
            quantize(fae_source / name, target_root / "characters/player/default" / name, args.force)
        for name in BUILDING_NAMES:
            quantize(building_source / name, target_root / "buildings" / name, args.force)
    published = [target_root / "characters/player/default" / name for name in FAE_NAMES]
    published += [target_root / "buildings" / name for name in BUILDING_NAMES]
    contact_sheet([path for path in published if path.is_file()][:41], args.contact_dir / "fae_2x_labeled.png", 8, 2)
    contact_sheet([path for path in published if path.is_file()][41:], args.contact_dir / "buildings_2x_labeled.png", 3, 2)
    print(f"Normalized {len(published)} playable assets in {target_root}")
    print(f"Fae: {len(FAE_NAMES)} x 16x24; buildings: {len(BUILDING_NAMES)} x 48x64")
    print(f"Contact sheets: {args.contact_dir / 'fae_2x_labeled.png'}, {args.contact_dir / 'buildings_2x_labeled.png'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
