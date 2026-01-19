"""Blender battle background baking entrypoint.

Run via:
  blender -b <diorama.blend> -P tools/blender/bake_battle_background.py -- --recipe <recipe.json>
"""

import sys
import argparse
import json
import os
import math

try:
    bpy = __import__("bpy")
except ImportError:
    bpy = None


def setup_placeholder_diorama(biome, bg_id):
    if not bpy:
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.object.camera_add(location=(0, -10, 5), rotation=(math.radians(60), 0, 0))
    cam = bpy.context.object
    cam.data.type = "PERSP"
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type="SUN", location=(5, -5, 10))

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Ground"

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
    cube = bpy.context.object
    cube.name = "Prop"

    bpy.ops.object.text_add(location=(0, 0, 3))
    text = bpy.context.object
    text.data.body = f"{biome}\n{bg_id}"
    text.data.align_x = "CENTER"
    text.rotation_euler = (math.radians(60), 0, 0)


def main():
    if not bpy:
        print("This script must be run inside Blender.")
        return

    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--recipe", required=True)
    args = parser.parse_args(argv)

    recipe_path = args.recipe
    if not os.path.exists(recipe_path):
        print(f"Recipe not found: {recipe_path}")
        sys.exit(1)

    try:
        with open(recipe_path, "r") as f:
            if recipe_path.endswith(".json"):
                recipe = json.load(f)
            else:
                recipe = {}
                for line in f:
                    if ":" in line:
                        k, v = line.split(":", 1)
                        recipe[k.strip()] = v.strip()
    except Exception as e:
        print(f"Failed to parse recipe: {e}")
        sys.exit(1)

    bg_id = recipe.get("id", "unknown")
    biome = recipe.get("biome", "unknown")

    if not bpy.data.objects:
        setup_placeholder_diorama(biome, bg_id)

    out_dir = os.path.join("game/assets/battle_backgrounds", biome, bg_id)
    os.makedirs(out_dir, exist_ok=True)

    out_path = os.path.join(out_dir, "bg.png")

    bpy.context.scene.render.filepath = out_path
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080

    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_path}")


if __name__ == "__main__":
    main()
