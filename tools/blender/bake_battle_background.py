"""Blender battle background baking entrypoint.

Run via:
  blender -b <diorama.blend> -P tools/blender/bake_battle_background.py -- <args>

TODO:
- load biome diorama
- render background png
- quantize / validate
- output to art/exports/battle_backgrounds/... 
"""

import sys


def main() -> int:
	print("TODO: implement battle background baking")
	print("argv:", sys.argv)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
