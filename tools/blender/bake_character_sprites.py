"""Blender sprite baking entrypoint.

Intended to be run via:
  blender -b <template.blend> -P tools/blender/bake_character_sprites.py -- <args>

TODO:
- load character collection
- render 8 directions and animations
- write spritesheets to art/exports/sprites/...
"""

import sys


def main() -> int:
	print("TODO: implement sprite baking")
	print("argv:", sys.argv)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
