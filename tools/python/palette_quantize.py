#!/usr/bin/env python3
"""Deterministic palette quantization using Godot headless."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Quantize an image to a palette using Godot headless.",
    )
    parser.add_argument("--in", dest="input_path", required=True, help="Input PNG path")
    parser.add_argument(
        "--out", dest="output_path", required=True, help="Output PNG path"
    )
    parser.add_argument("--palette", required=True, help="Palette JSON path")
    parser.add_argument(
        "--godot",
        default=os.getenv("GODOT_BIN", "godot"),
        help="Godot binary path (or set GODOT_BIN)",
    )
    return parser.parse_args()


def run_godot_quantize(
    godot_bin: str,
    input_path: Path,
    output_path: Path,
    palette_path: Path,
) -> int:
    script_path = Path(__file__).resolve().parents[1] / "godot" / "palette_quantize.gd"
    if not script_path.exists():
        print(f"Missing script: {script_path}", file=sys.stderr)
        return 1
    cmd = [
        godot_bin,
        "--headless",
        "--script",
        str(script_path),
        "--",
        "--in",
        str(input_path),
        "--out",
        str(output_path),
        "--palette",
        str(palette_path),
    ]
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print("Godot quantize failed", file=sys.stderr)
    return result.returncode


def main() -> int:
    args = parse_args()
    input_path = Path(args.input_path).resolve()
    output_path = Path(args.output_path).resolve()
    palette_path = Path(args.palette).resolve()

    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 1
    if not palette_path.exists():
        print(f"Palette not found: {palette_path}", file=sys.stderr)
        return 1

    return run_godot_quantize(args.godot, input_path, output_path, palette_path)


if __name__ == "__main__":
    raise SystemExit(main())
