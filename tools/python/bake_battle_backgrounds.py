#!/usr/bin/env python3
import argparse
import subprocess
import sys
import os
import glob


def bake_background(recipe_path):
    print(f"Baking battle background from {recipe_path}...")

    godot_bin = os.getenv("GODOT_BIN", "godot")
    cmd = [
        godot_bin,
        "--headless",
        "--script",
        "tools/godot/generate_battle_background.gd",
        "--",
        "--recipe",
        recipe_path,
    ]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error baking {recipe_path}:")
        print(e.stdout)
        print(e.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Bake battle backgrounds from recipes")
    parser.add_argument("--recipe", help="Specific recipe file to bake")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Bake all backgrounds in art/recipes/battle_backgrounds/",
    )

    args = parser.parse_args()

    if args.recipe:
        bake_background(args.recipe)
    elif args.all:
        recipes = glob.glob("art/recipes/battle_backgrounds/**/*.json", recursive=True)
        for r in recipes:
            bake_background(r)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
