"""Scaffold a new biome pack.

Usage:
  python tools/python/new_biome.py <biome_id>

TODO: implement folder + file creation using docs/biomes/BIOME_TEMPLATE.md
"""

import sys


def main() -> int:
	if len(sys.argv) != 2:
		print("Usage: python tools/python/new_biome.py <biome_id>")
		return 2
	biome_id = sys.argv[1]
	print(f"TODO: scaffold biome '{biome_id}'")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
