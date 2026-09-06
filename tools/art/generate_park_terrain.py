#!/usr/bin/env python3
"""Generate Cloverhollow's small, deterministic 16x16 park terrain kit."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

Color = tuple[int, int, int]
SIZE = 16
BIOME = Path("art/palettes/cloverhollow.palette.json")
GLOBAL = Path("art/palettes/global_ui_skin.palette.json")
DEFAULT_OUTPUT = Path("captures/m226/art/park_terrain")

GRASS: Color = (106, 204, 106)
GRASS_LIGHT: Color = (168, 232, 168)
GRASS_DARK: Color = (74, 168, 74)
PATH: Color = (232, 220, 196)
PATH_SHADOW: Color = (212, 200, 168)
PATH_EDGE: Color = (201, 189, 165)
EARTH: Color = (138, 107, 63)
WATER: Color = (58, 138, 189)
WATER_LIGHT: Color = (90, 168, 215)
WATER_DARK: Color = (42, 106, 138)
HEDGE: Color = (47, 107, 47)
HEDGE_DARK: Color = (27, 63, 27)


def tile(fill: Color = GRASS) -> Image.Image:
    return Image.new("RGB", (SIZE, SIZE), fill)


def line(image: Image.Image, points: list[tuple[int, int]], color: Color) -> None:
    for x, y in points:
        if 0 <= x < SIZE and 0 <= y < SIZE:
            image.putpixel((x, y), color)


def grass() -> Image.Image:
    image = tile()
    line(image, [(2, 4), (3, 4), (2, 5), (12, 11), (13, 11), (13, 12)], GRASS_LIGHT)
    line(image, [(7, 1), (7, 2), (10, 14), (10, 15), (4, 12)], GRASS_DARK)
    return image


def path_center() -> Image.Image:
    image = tile(PATH)
    line(image, [(1, 3), (2, 3), (8, 8), (9, 8), (13, 13)], PATH_SHADOW)
    line(image, [(6, 3), (9, 9), (7, 13)], PATH_EDGE)
    return image


def path_edge(direction: str) -> Image.Image:
    image = path_center()
    if direction == "n":
        for y in range(4):
            for x in range(16):
                image.putpixel((x, y), GRASS)
    elif direction == "s":
        for y in range(12, 16):
            for x in range(16):
                image.putpixel((x, y), GRASS)
    elif direction == "e":
        for x in range(12, 16):
            for y in range(16):
                image.putpixel((x, y), GRASS)
    else:
        for x in range(4):
            for y in range(16):
                image.putpixel((x, y), GRASS)
    return image


def path_corner(corner: str) -> Image.Image:
    image = tile(PATH)
    borders = {
        "nw": ("n", "w"), "ne": ("n", "e"),
        "sw": ("s", "w"), "se": ("s", "e"),
    }[corner]
    for side in borders:
        if side == "n":
            for y in range(4):
                for x in range(16):
                    image.putpixel((x, y), GRASS)
        elif side == "s":
            for y in range(12, 16):
                for x in range(16):
                    image.putpixel((x, y), GRASS)
        elif side == "w":
            for x in range(4):
                for y in range(16):
                    image.putpixel((x, y), GRASS)
        else:
            for x in range(12, 16):
                for y in range(16):
                    image.putpixel((x, y), GRASS)
    return image


def water() -> Image.Image:
    image = tile(WATER)
    line(image, [(2, 3), (3, 3), (4, 3), (10, 9), (11, 9), (12, 9)], WATER_LIGHT)
    line(image, [(1, 13), (2, 13), (3, 13), (8, 5), (9, 5)], WATER_DARK)
    return image


def pond_shore() -> Image.Image:
    image = water()
    for x in range(16):
        image.putpixel((x, 0), GRASS_DARK)
        image.putpixel((x, 1), EARTH if x % 3 else GRASS)
        image.putpixel((x, 2), GRASS if x % 4 else GRASS_LIGHT)
        image.putpixel((x, 3), EARTH)
    return image


def hedge() -> Image.Image:
    image = tile(HEDGE)
    line(image, [(x, y) for y in (14, 15) for x in range(16)], HEDGE_DARK)
    line(image, [(x, 0) for x in range(1, 16, 3)] + [(x, 1) for x in range(2, 16, 4)], GRASS_LIGHT)
    line(image, [(2, 5), (3, 5), (10, 4), (11, 4), (6, 10), (7, 10)], GRASS_LIGHT)
    return image


def tiles() -> dict[str, Image.Image]:
    return {
        "grass": grass(),
        "path_center": path_center(),
        "path_edge_n": path_edge("n"),
        "path_edge_s": path_edge("s"),
        "path_edge_e": path_edge("e"),
        "path_edge_w": path_edge("w"),
        "path_corner_ne": path_corner("ne"),
        "path_corner_nw": path_corner("nw"),
        "path_corner_se": path_corner("se"),
        "path_corner_sw": path_corner("sw"),
        "pond_water": water(),
        "pond_shore_n": pond_shore(),
        "park_hedge": hedge(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--contact-sheet", type=Path)
    parser.add_argument("--force", action="store_true", help="replace existing generated files")
    args = parser.parse_args()
    output = args.output_dir
    generated = tiles()
    existing = [output / f"{name}.png" for name in generated if (output / f"{name}.png").exists()]
    if existing and not args.force:
        raise SystemExit("output contains existing tiles; use --force to replace them")
    output.mkdir(parents=True, exist_ok=True)
    for name, image in generated.items():
        image.save(output / f"{name}.png", format="PNG", optimize=False)
    if args.contact_sheet is not None:
        columns = 4
        sheet = Image.new("RGB", (columns * SIZE, ((len(generated) + columns - 1) // columns) * SIZE))
        for index, image in enumerate(generated.values()):
            sheet.paste(image, ((index % columns) * SIZE, (index // columns) * SIZE))
        args.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(args.contact_sheet, format="PNG", optimize=False)
    print(f"Generated {len(generated)} park terrain tiles in {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
