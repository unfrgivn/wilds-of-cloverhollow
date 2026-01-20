#!/usr/bin/env python3
"""Bake building facades from JSON recipes.

Usage:
  python3 tools/python/bake_buildings.py --recipe <recipe_path>
  python3 tools/python/bake_buildings.py --all
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

EXPORT_ROOT = "res://art/exports/models/buildings"
RUNTIME_ROOT = "res://game/assets/buildings"
SCRIPT_PATH = "tools/godot/generate_prop.gd"


def _godot_bin() -> str:
    return os.environ.get("GODOT_BIN", "godot")


def _run_recipe(recipe_path: Path) -> None:
    cmd = [
        _godot_bin(),
        "--headless",
        "--path",
        ".",
        "--script",
        SCRIPT_PATH,
        "--",
        "--recipe",
        str(recipe_path),
        "--export_root",
        EXPORT_ROOT,
        "--runtime_root",
        RUNTIME_ROOT,
    ]
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bake building facades")
    parser.add_argument("--recipe", help="Path to building recipe JSON")
    parser.add_argument("--all", action="store_true", help="Bake all building recipes")
    args = parser.parse_args()

    if args.recipe:
        recipe = Path(args.recipe)
        if not recipe.exists():
            print(f"Error: Recipe {recipe} not found")
            sys.exit(1)
        _run_recipe(recipe)
        return

    if args.all:
        recipes = sorted(Path("art/recipes/buildings").glob("**/*.json"))
        if not recipes:
            print("Error: No building recipes found under art/recipes/buildings")
            sys.exit(1)
        for recipe in recipes:
            _run_recipe(recipe)
        return

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
