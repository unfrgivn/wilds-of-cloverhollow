"""Asset validation tool.

Usage:
  python3 tools/python/validate_assets.py --recipe <recipe_path>
  python3 tools/python/validate_assets.py --character <char_id>
"""

import argparse
import sys
import json
from pathlib import Path


def parse_recipe(recipe_path: str) -> dict:
    path = Path(recipe_path)
    if not path.exists():
        print(f"Error: Recipe {recipe_path} not found")
        sys.exit(1)

    if path.suffix == ".json":
        with open(path, "r") as f:
            return json.load(f)
    elif path.suffix in [".yml", ".yaml"]:
        data = {}
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    key, val = line.split(":", 1)
                    data[key.strip()] = val.strip()
        return data
    else:
        print(f"Error: Unknown recipe format {path.suffix}")
        sys.exit(1)


def validate_character(char_id: str, category: str = "enemy"):
    print(f"Validating character: {char_id} (category: {category})")
    base_path = Path("art/exports/sprites") / char_id

    if not base_path.exists():
        print(f"Error: Character export directory {base_path} missing")
        sys.exit(1)

    required_anims = ["idle", "walk"]
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

    missing = []
    for anim in required_anims:
        for d in directions:
            fname = f"{char_id}_{anim}_{d}.png"
            if not (base_path / fname).exists():
                missing.append(fname)

    if missing:
        print(f"Error: Missing sprite files for {char_id}:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)

    battle_files = [
        f"{char_id}_battle_idle_L.png",
        f"{char_id}_battle_idle_R.png",
    ]
    battle_present = any((base_path / f).exists() for f in battle_files)
    if battle_present:
        battle_missing = [f for f in battle_files if not (base_path / f).exists()]
        if battle_missing:
            print(f"Error: Missing battle sprite files for {char_id}:")
            for m in battle_missing:
                print(f"  - {m}")
            sys.exit(1)

    runtime_base = "characters" if category == "character" else "enemies"
    runtime_path = Path(f"game/assets/sprites/{runtime_base}/{char_id}")

    if not runtime_path.exists():
        print(f"Error: Runtime directory {runtime_path} missing")
        sys.exit(1)

    if not any(runtime_path.iterdir()):
        print(f"Error: Runtime directory {runtime_path} is empty")
        sys.exit(1)

    print(f"Success: Character {char_id} validated.")


def validate_recipe(recipe_path: str):
    print(f"Validating recipe: {recipe_path}")
    data = parse_recipe(recipe_path)

    if "id" in data:
        asset_id = data["id"]
        if "characters" in recipe_path:
            category = data.get("category", "enemy")
            validate_character(asset_id, category)
        elif "props" in recipe_path:
            prop_path_tscn = Path(
                f"art/exports/models/props/{asset_id}/{asset_id}.tscn"
            )
            prop_path_glb = Path(f"art/exports/models/props/{asset_id}/{asset_id}.glb")

            if not prop_path_tscn.exists() and not prop_path_glb.exists():
                print(f"Error: Prop output {prop_path_tscn} (or .glb) missing")
                sys.exit(1)
            if prop_path_tscn.exists():
                runtime_prop = Path(f"game/assets/props/{asset_id}.tscn")
                if not runtime_prop.exists():
                    print(f"Error: Runtime prop {runtime_prop} missing")
                    sys.exit(1)
            print(f"Success: Prop {asset_id} validated.")
        elif "buildings" in recipe_path:
            building_path_tscn = Path(
                f"art/exports/models/buildings/{asset_id}/{asset_id}.tscn"
            )
            building_path_glb = Path(
                f"art/exports/models/buildings/{asset_id}/{asset_id}.glb"
            )

            if not building_path_tscn.exists() and not building_path_glb.exists():
                print(f"Error: Building output {building_path_tscn} (or .glb) missing")
                sys.exit(1)
            if building_path_tscn.exists():
                runtime_building = Path(f"game/assets/buildings/{asset_id}.tscn")
                if not runtime_building.exists():
                    print(f"Error: Runtime building {runtime_building} missing")
                    sys.exit(1)
            print(f"Success: Building {asset_id} validated.")
        elif "battle_backgrounds" in recipe_path:
            parts = Path(recipe_path).parts
            if len(parts) >= 2:
                bg_id = Path(recipe_path).stem
                biome = parts[-2]
                bg_path = Path(f"game/assets/battle_backgrounds/{biome}/{bg_id}/bg.png")
                if not bg_path.exists():
                    print(f"Error: Battle background {bg_path} missing")
                    sys.exit(1)
                print(f"Success: Battle background {bg_id} validated.")
    else:
        print("Warning: Recipe has no 'id' field, skipping specific checks.")


def main():
    parser = argparse.ArgumentParser(description="Validate assets")
    parser.add_argument("--recipe", help="Path to recipe file")
    parser.add_argument("--character", help="Character ID to validate")

    args = parser.parse_args()

    if args.character:
        validate_character(args.character)
    elif args.recipe:
        validate_recipe(args.recipe)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
