#!/usr/bin/env python3
"""Validate PNG dimensions and visible colors against one or more palettes."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Final, TypeAlias

from PIL import Image

HEX: Final = re.compile(r"^#[0-9a-fA-F]{6}$")
Color: TypeAlias = tuple[int, int, int]


def palette_colors(path: Path) -> set[Color]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid palette {path}: {error}") from error
    if isinstance(value, dict):
        if "colors" not in value:
            raise ValueError(f"palette {path} has no colors field")
        source = value["colors"]
    elif isinstance(value, list):
        source = value
    else:
        raise ValueError(f"palette {path} must be an object or color list")
    if isinstance(source, (dict, list)):
        leaves: list[object] = []

        def collect(item: object) -> None:
            if isinstance(item, dict):
                for child in item.values():
                    collect(child)
            elif isinstance(item, list):
                for child in item:
                    collect(child)
            else:
                leaves.append(item)

        collect(source)
    else:
        raise ValueError(f"palette {path}.colors must be an object or color list")
    if not leaves:
        raise ValueError(f"palette {path} contains no colors")
    colors: set[Color] = set()
    for leaf in leaves:
        if not isinstance(leaf, str) or not HEX.fullmatch(leaf):
            raise ValueError(f"invalid color {leaf!r} in {path}")
        colors.add((int(leaf[1:3], 16), int(leaf[3:5], 16), int(leaf[5:7], 16)))
    return colors


def parse_size(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)x(\d+)", value.lower())
    if match is None or int(match.group(1)) < 1 or int(match.group(2)) < 1:
        raise argparse.ArgumentTypeError("size must be positive WIDTHxHEIGHT")
    return int(match.group(1)), int(match.group(2))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sprite", type=Path)
    parser.add_argument("--palette", action="append", type=Path, default=[],
                        help="palette JSON, repeat to form a union")
    parser.add_argument("--biome", action="append", default=[],
                        help="biome name under art/palettes (adds the global UI palette)")
    parser.add_argument("--global-palette", action="append", type=Path, default=[])
    parser.add_argument("--size", type=parse_size, help="expected dimensions, e.g. 16x16")
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--grid", type=int, help="optional alignment grid")
    args = parser.parse_args(argv)
    if (args.width is None) != (args.height is None):
        parser.error("--width and --height must be supplied together")
    if args.size is not None and args.width is not None:
        parser.error("use --size or --width/--height, not both")
    if args.grid is not None and args.grid < 1:
        parser.error("--grid must be positive")
    palette_paths = list(args.palette) + [
        Path(__file__).resolve().parents[2] / "art" / "palettes" / f"{name}.palette.json"
        for name in args.biome
    ] + list(args.global_palette)
    if args.biome and not args.global_palette:
        palette_paths.append(Path(__file__).resolve().parents[2] / "art" / "palettes" / "global_ui_skin.palette.json")
    if not palette_paths:
        parser.error("at least one --palette or --biome is required")
    if not args.sprite.is_file():
        print(f"ERROR: input not found: {args.sprite}", file=sys.stderr)
        return 1
    try:
        allowed = set().union(*(palette_colors(path) for path in palette_paths))
        with Image.open(args.sprite) as image:
            image.load()
            actual = image.convert("RGBA")
            expected = args.size or ((args.width, args.height) if args.width is not None else None)
            if expected is not None and actual.size != expected:
                raise ValueError(f"dimensions are {actual.width}x{actual.height}, expected {expected[0]}x{expected[1]}")
            if args.grid is not None and (actual.width % args.grid or actual.height % args.grid):
                raise ValueError(f"dimensions {actual.width}x{actual.height} are not aligned to {args.grid}")
            visible = {pixel[:3] for pixel in actual.get_flattened_data() if pixel[3] != 0}
            stray = sorted(visible - allowed)
            if stray:
                formatted = ", ".join("#%02x%02x%02x" % color for color in stray)
                raise ValueError(f"visible colors not in palettes: {formatted}")
    except (OSError, ValueError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print(f"PASSED: {args.sprite} ({actual.width}x{actual.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
