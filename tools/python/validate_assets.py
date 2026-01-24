import argparse
import sys
import json
import struct
from pathlib import Path


PIXELS_PER_METER_DEFAULT = 24
SPRITE_RESOLUTION_DEFAULT = 48
SPRITE_RESOLUTION_ALLOWED = {48, 72}
BATTLE_BG_SIZE = (960, 540)


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


def load_palette(palette_path: Path) -> dict | None:
    if not palette_path.exists():
        print(f"Error: Palette {palette_path} not found")
        sys.exit(1)
    with open(palette_path, "r") as f:
        data = json.load(f)
    if isinstance(data, dict):
        if "colors" in data:
            return data["colors"]
        return data
    if isinstance(data, list):
        return None
    return None


def resolve_palette_path(recipe_path: str, data: dict) -> Path:
    if "palette" in data:
        palette_ref = str(data["palette"])
        if palette_ref.startswith("res://"):
            palette_ref = palette_ref.replace("res://", "", 1)
        return Path(palette_ref)
    if "characters" in recipe_path:
        common = Path("art/palettes/common.palette.json")
        if common.exists():
            return common
    parts = Path(recipe_path).parts
    if "recipes" in parts:
        idx = parts.index("recipes")
        if idx + 2 < len(parts):
            biome = parts[idx + 2]
            candidate = Path("art/palettes") / f"{biome}.palette.json"
            if candidate.exists():
                return candidate
    return Path("art/palettes/cloverhollow.palette.json")


def read_png_size(path: Path) -> tuple[int, int]:
    with open(path, "rb") as f:
        header = f.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Invalid PNG header for {path}")
    width, height = struct.unpack(">II", header[16:24])
    return width, height


def validate_palette_colors(data: dict, recipe_path: str) -> None:
    palette_path = resolve_palette_path(recipe_path, data)
    palette = load_palette(palette_path)
    if not palette:
        return
    missing = set()
    for part in data.get("parts", []):
        color_name = part.get("color")
        if color_name and color_name not in palette:
            missing.add(color_name)
    colors = data.get("colors", {})
    if isinstance(colors, dict):
        for color_name in colors.values():
            if color_name and color_name not in palette:
                missing.add(color_name)
    if missing:
        print(f"Error: Palette {palette_path} missing colors for {recipe_path}:")
        for name in sorted(missing):
            print(f"  - {name}")
        sys.exit(1)


def validate_pixel_kit(data: dict, recipe_path: str) -> None:
    render = data.get("render", {})
    if not isinstance(render, dict):
        return
    if "pixels_per_meter" in render:
        ppm = render.get("pixels_per_meter")
        if not isinstance(ppm, int):
            print(f"Error: pixels_per_meter must be int in {recipe_path}")
            sys.exit(1)
        if ppm != PIXELS_PER_METER_DEFAULT:
            print(
                f"Error: pixels_per_meter {ppm} does not match pixel kit default {PIXELS_PER_METER_DEFAULT} in {recipe_path}"
            )
            sys.exit(1)
    if "resolution" in render:
        resolution = render.get("resolution")
        if not isinstance(resolution, int):
            print(f"Error: resolution must be int in {recipe_path}")
            sys.exit(1)
        if "characters" in recipe_path and resolution not in SPRITE_RESOLUTION_ALLOWED:
            print(
                f"Error: sprite resolution {resolution} is not allowed in {recipe_path}"
            )
            sys.exit(1)
    for key in ["padding", "max_size"]:
        if key in render and not isinstance(render[key], int):
            print(f"Error: {key} must be int in {recipe_path}")
            sys.exit(1)


def validate_character(
    char_id: str, category: str = "enemy", expected_resolution: int | None = None
):
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

    if expected_resolution:
        sample_path = base_path / f"{char_id}_idle_N.png"
        if sample_path.exists():
            width, height = read_png_size(sample_path)
            if width > expected_resolution or height > expected_resolution:
                print(
                    f"Error: Sprite {sample_path} exceeds expected resolution {expected_resolution}px"
                )
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
    validate_pixel_kit(data, recipe_path)
    validate_palette_colors(data, recipe_path)

    if "id" in data:
        asset_id = data["id"]
        if "characters" in recipe_path:
            category = data.get("category", "enemy")
            render = data.get("render", {})
            expected_resolution = int(
                render.get("resolution", SPRITE_RESOLUTION_DEFAULT)
            )
            validate_character(asset_id, category, expected_resolution)
        elif "props" in recipe_path:
            prop_path_tscn = Path(
                f"art/exports/models/props/{asset_id}/{asset_id}.tscn"
            )
            prop_path_glb = Path(f"art/exports/models/props/{asset_id}/{asset_id}.glb")
            prop_path_png = Path(f"art/exports/models/props/{asset_id}/{asset_id}.png")
            runtime_png = Path(f"game/assets/props/{asset_id}.png")

            if not prop_path_tscn.exists() and not prop_path_glb.exists():
                print(f"Error: Prop output {prop_path_tscn} (or .glb) missing")
                sys.exit(1)
            if prop_path_tscn.exists():
                runtime_prop = Path(f"game/assets/props/{asset_id}.tscn")
                if not runtime_prop.exists():
                    print(f"Error: Runtime prop {runtime_prop} missing")
                    sys.exit(1)
            if not prop_path_png.exists():
                print(f"Error: Prop texture {prop_path_png} missing")
                sys.exit(1)
            if not runtime_png.exists():
                print(f"Error: Runtime prop texture {runtime_png} missing")
                sys.exit(1)
            render = data.get("render", {})
            max_size = render.get("max_size", render.get("resolution"))
            if isinstance(max_size, int):
                width, height = read_png_size(prop_path_png)
                if width > max_size or height > max_size:
                    print(
                        f"Error: Prop texture {prop_path_png} exceeds max size {max_size}px"
                    )
                    sys.exit(1)
            print(f"Success: Prop {asset_id} validated.")
        elif "buildings" in recipe_path:
            building_path_tscn = Path(
                f"art/exports/models/buildings/{asset_id}/{asset_id}.tscn"
            )
            building_path_glb = Path(
                f"art/exports/models/buildings/{asset_id}/{asset_id}.glb"
            )
            building_path_png = Path(
                f"art/exports/models/buildings/{asset_id}/{asset_id}.png"
            )
            runtime_png = Path(f"game/assets/buildings/{asset_id}.png")

            if not building_path_tscn.exists() and not building_path_glb.exists():
                print(f"Error: Building output {building_path_tscn} (or .glb) missing")
                sys.exit(1)
            if building_path_tscn.exists():
                runtime_building = Path(f"game/assets/buildings/{asset_id}.tscn")
                if not runtime_building.exists():
                    print(f"Error: Runtime building {runtime_building} missing")
                    sys.exit(1)
            if not building_path_png.exists():
                print(f"Error: Building texture {building_path_png} missing")
                sys.exit(1)
            if not runtime_png.exists():
                print(f"Error: Runtime building texture {runtime_png} missing")
                sys.exit(1)
            render = data.get("render", {})
            max_size = render.get("max_size", render.get("resolution"))
            if isinstance(max_size, int):
                width, height = read_png_size(building_path_png)
                if width > max_size or height > max_size:
                    print(
                        f"Error: Building texture {building_path_png} exceeds max size {max_size}px"
                    )
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
                width, height = read_png_size(bg_path)
                if (width, height) != BATTLE_BG_SIZE:
                    print(
                        f"Error: Battle background {bg_path} must be {BATTLE_BG_SIZE[0]}x{BATTLE_BG_SIZE[1]}"
                    )
                    sys.exit(1)
                print(f"Success: Battle background {bg_id} validated.")
    else:
        print("Warning: Recipe has no 'id' field, skipping specific checks.")


def _collect_recipe_paths() -> list[Path]:
    root = Path("art/recipes")
    if not root.exists():
        return []
    return sorted(root.rglob("*.json"))


def validate_all_recipes() -> None:
    recipes = _collect_recipe_paths()
    if not recipes:
        print("Error: No recipes found under art/recipes")
        sys.exit(1)
    for recipe in recipes:
        validate_recipe(str(recipe))


def _has_recipe(asset_id: str, root: str) -> bool:
    root_path = Path(root)
    if not root_path.exists():
        return False
    return any(root_path.rglob(f"{asset_id}.json"))


def check_missing_recipes() -> None:
    errors = []

    prop_runtime = Path("game/assets/props")
    if prop_runtime.exists():
        for prop in prop_runtime.glob("*.tscn"):
            asset_id = prop.stem
            if not _has_recipe(asset_id, "art/recipes/props"):
                errors.append(f"Missing recipe for prop: {asset_id}")

    building_runtime = Path("game/assets/buildings")
    if building_runtime.exists():
        for building in building_runtime.glob("*.tscn"):
            asset_id = building.stem
            if not _has_recipe(asset_id, "art/recipes/buildings"):
                errors.append(f"Missing recipe for building: {asset_id}")

    for category in ["characters", "enemies"]:
        sprite_root = Path(f"game/assets/sprites/{category}")
        if not sprite_root.exists():
            continue
        for entry in sprite_root.iterdir():
            if not entry.is_dir():
                continue
            asset_id = entry.name
            if not _has_recipe(asset_id, "art/recipes/characters"):
                errors.append(f"Missing recipe for sprite {category}: {asset_id}")

    battle_root = Path("game/assets/battle_backgrounds")
    if battle_root.exists():
        for bg_path in battle_root.rglob("bg.png"):
            bg_id = bg_path.parent.name
            biome = bg_path.parent.parent.name
            recipe = Path(f"art/recipes/battle_backgrounds/{biome}/{bg_id}.json")
            if not recipe.exists():
                errors.append(f"Missing recipe for battle background: {biome}/{bg_id}")

    if errors:
        print("Error: Found runtime assets without recipes:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)

    print("Success: All runtime assets have recipes.")


def main():
    parser = argparse.ArgumentParser(description="Validate assets")
    parser.add_argument("--recipe", help="Path to recipe file")
    parser.add_argument("--character", help="Character ID to validate")
    parser.add_argument("--all", action="store_true", help="Validate all recipes")
    parser.add_argument(
        "--check-missing",
        action="store_true",
        help="Fail if runtime assets lack recipes",
    )

    args = parser.parse_args()

    if args.character:
        validate_character(args.character)
        return

    if args.recipe:
        validate_recipe(args.recipe)
        return

    ran = False
    if args.all:
        validate_all_recipes()
        ran = True

    if args.check_missing:
        check_missing_recipes()
        ran = True

    if not ran:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
