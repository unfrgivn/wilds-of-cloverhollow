#!/usr/bin/env python3
"""Pack sorted, same-sized PNG frames into a deterministic RGBA sheet."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--cols", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    if not args.input_dir.is_dir():
        print(f"ERROR: input directory not found: {args.input_dir}", file=sys.stderr)
        return 1
    frames = sorted(args.input_dir.glob("*.png"), key=lambda path: path.name)
    if not frames:
        print("ERROR: input directory contains no PNG frames", file=sys.stderr)
        return 1
    if args.cols is not None and args.cols < 1:
        print("ERROR: --cols must be positive", file=sys.stderr)
        return 1
    destination = args.output.resolve()
    metadata_path = destination.with_suffix(".json")
    if any(frame.resolve() == destination or frame.resolve() == metadata_path for frame in frames):
        print("ERROR: output or metadata path overlaps a source frame", file=sys.stderr)
        return 1
    if destination.exists() and not args.force:
        print(f"ERROR: output exists (use --force): {args.output}", file=sys.stderr)
        return 1
    if metadata_path.exists() and not args.force:
        print(f"ERROR: metadata exists (use --force): {metadata_path}", file=sys.stderr)
        return 1
    try:
        loaded = []
        for frame in frames:
            with Image.open(frame) as image:
                loaded.append((frame, image.convert("RGBA")))
        size = loaded[0][1].size
        if any(image.size != size for _, image in loaded[1:]):
            raise ValueError("all frames must have identical dimensions")
        columns = args.cols or len(loaded)
        rows = (len(loaded) + columns - 1) // columns
        sheet = Image.new("RGBA", (size[0] * columns, size[1] * rows), (0, 0, 0, 0))
        metadata = []
        for index, (frame, image) in enumerate(loaded):
            x, y = (index % columns) * size[0], (index // columns) * size[1]
            sheet.paste(image, (x, y))
            metadata.append({"file": frame.name, "x": x, "y": y, "width": size[0], "height": size[1]})
        destination.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(destination, format="PNG")
        metadata_path.write_text(json.dumps({"frames": metadata}, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    print(f"OK: packed {len(frames)} frames -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
