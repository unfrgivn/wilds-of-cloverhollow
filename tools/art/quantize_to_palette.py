#!/usr/bin/env python3
"""Nearest-color PNG quantization with explicit, non-destructive output."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

from validate_sprite import palette_colors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("palette", type=Path, help="primary palette JSON")
    parser.add_argument("--palette", action="append", type=Path, default=[], dest="extra_palettes",
                        help="additional palette JSON, repeat to form a union")
    parser.add_argument("output", type=Path)
    parser.add_argument("--force", action="store_true", help="replace an existing output")
    args = parser.parse_args(argv)
    source = args.input.resolve()
    destination = args.output.resolve()
    if not source.is_file() or not args.palette.is_file():
        print("ERROR: input and palette files are required", file=sys.stderr)
        return 1
    if source == destination:
        print("ERROR: output must be separate from input", file=sys.stderr)
        return 1
    if destination.exists() and not args.force:
        print(f"ERROR: output exists (use --force): {args.output}", file=sys.stderr)
        return 1
    try:
        colors = sorted(set().union(palette_colors(args.palette), *(palette_colors(path) for path in args.extra_palettes)))
        with Image.open(source) as image:
            rgba = image.convert("RGBA")
            pixels = []
            for red, green, blue, alpha in rgba.get_flattened_data():
                if alpha == 0:
                    pixels.append((red, green, blue, alpha))
                    continue
                color = min(colors, key=lambda candidate: sum((a - b) ** 2 for a, b in zip(candidate, (red, green, blue))))
                pixels.append((*color, alpha))
            normalized = Image.new("RGBA", rgba.size)
            normalized.putdata(pixels)
            destination.parent.mkdir(parents=True, exist_ok=True)
            normalized.save(destination, format="PNG")
    except (OSError, ValueError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print(f"OK: quantized {args.input} -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
