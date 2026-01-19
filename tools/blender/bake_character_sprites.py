"""Blender sprite baking entrypoint.

Run via:
  blender -b <template.blend> -P tools/blender/bake_character_sprites.py -- --recipe <recipe.json>
"""

import sys
import argparse
import json
import os
import math

# Bypass static analysis for Blender modules
try:
    bpy = __import__("bpy")
    mathutils = __import__("mathutils")
    Vector = mathutils.Vector
    Euler = mathutils.Euler
except ImportError:
    bpy = None
    Vector = None
    Euler = None


def setup_placeholder_scene(char_id):
    if not bpy:
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.object.camera_add(location=(0, -10, 10), rotation=(math.radians(45), 0, 0))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 4.0
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type="SUN", location=(5, -5, 10))

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
    cube = bpy.context.object
    cube.name = "Character"

    bpy.ops.object.text_add(location=(0, 0, 1.5))
    text = bpy.context.object
    text.data.body = char_id
    text.data.align_x = "CENTER"
    text.rotation_euler = (math.radians(90), 0, 0)

    text.parent = cube


def render_direction(output_path, angle_deg):
    if not bpy:
        return

    char_obj = bpy.data.objects.get("Character")
    if char_obj:
        char_obj.rotation_euler = (0, 0, math.radians(angle_deg))

    bpy.context.scene.render.filepath = output_path
    bpy.context.scene.render.resolution_x = 256
    bpy.context.scene.render.resolution_y = 256
    bpy.context.scene.render.film_transparent = True

    bpy.ops.render.render(write_still=True)


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

    char_id = recipe.get("id", "unknown")

    if not bpy.data.objects:
        setup_placeholder_scene(char_id)

    out_dir = os.path.join("art/exports/sprites", char_id)
    os.makedirs(out_dir, exist_ok=True)

    directions = {
        "S": 0,
        "SE": 45,
        "E": 90,
        "NE": 135,
        "N": 180,
        "NW": 225,
        "W": 270,
        "SW": 315,
    }

    anims = ["idle", "walk"]

    for anim in anims:
        for dirname, angle in directions.items():
            out_path = os.path.join(out_dir, f"{char_id}_{anim}_{dirname}.png")
            render_direction(out_path, angle)
            print(f"Rendered {out_path}")


if __name__ == "__main__":
    main()
