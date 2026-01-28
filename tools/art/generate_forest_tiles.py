#!/usr/bin/env python3
"""Generate forest tileset pieces for Wilds of Cloverhollow (16x16)."""

from PIL import Image
import os

COLORS = {
    # Dark forest grass
    "forest_grass_outline": (0x1A, 0x2A, 0x1A),
    "forest_grass_dark": (0x28, 0x40, 0x28),
    "forest_grass": (0x38, 0x58, 0x38),
    "forest_grass_light": (0x50, 0x70, 0x48),
    # Roots/wood
    "root_outline": (0x2A, 0x20, 0x18),
    "root_dark": (0x48, 0x38, 0x28),
    "root": (0x68, 0x50, 0x38),
    "root_light": (0x88, 0x68, 0x48),
    # Mushroom (red caps)
    "mush_outline": (0x4A, 0x20, 0x20),
    "mush_dark": (0x90, 0x40, 0x40),
    "mush": (0xC0, 0x50, 0x50),
    "mush_light": (0xE0, 0x70, 0x70),
    "mush_spot": (0xF8, 0xF0, 0xE0),
    "mush_stem": (0xE0, 0xD8, 0xC8),
    # Moss
    "moss_dark": (0x40, 0x60, 0x30),
    "moss": (0x60, 0x80, 0x48),
    "moss_light": (0x80, 0xA0, 0x60),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_forest_grass(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base dark grass fill
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["forest_grass"])

    # Darker patches
    dark_spots = [
        (1, 2),
        (6, 1),
        (11, 3),
        (3, 7),
        (9, 6),
        (14, 8),
        (2, 12),
        (7, 11),
        (12, 14),
    ]
    for sx, sy in dark_spots:
        pixels[sx, sy] = hex_to_rgba(C["forest_grass_dark"])

    # Light dappled spots (filtered light)
    light_spots = [(4, 4), (10, 5), (5, 9), (11, 12), (8, 2)]
    for sx, sy in light_spots:
        pixels[sx, sy] = hex_to_rgba(C["forest_grass_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_forest_roots(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base dark grass
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["forest_grass_dark"])

    # Diagonal root pattern (left to right)
    root_path = [
        (0, 6),
        (1, 6),
        (2, 7),
        (3, 7),
        (4, 8),
        (5, 8),
        (6, 9),
        (7, 9),
        (8, 9),
        (9, 10),
        (10, 10),
        (11, 11),
        (12, 11),
        (13, 12),
        (14, 12),
        (15, 13),
    ]
    for x, y in root_path:
        pixels[x, y] = hex_to_rgba(C["root"])
        if y - 1 >= 0:
            pixels[x, y - 1] = hex_to_rgba(C["root_outline"])
        if y + 1 < 16:
            pixels[x, y + 1] = hex_to_rgba(C["root_dark"])

    # Branch roots
    pixels[4, 6] = hex_to_rgba(C["root"])
    pixels[5, 5] = hex_to_rgba(C["root_light"])
    pixels[10, 8] = hex_to_rgba(C["root"])
    pixels[11, 7] = hex_to_rgba(C["root_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_mushroom_tile(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base dark grass
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["forest_grass_dark"])

    # Small mushroom cluster (center-left)
    # Mushroom 1 cap (rows 8-10)
    for x in range(4, 8):
        pixels[x, 8] = hex_to_rgba(C["mush_outline"])
    pixels[3, 9] = hex_to_rgba(C["mush_outline"])
    pixels[4, 9] = hex_to_rgba(C["mush_light"])
    pixels[5, 9] = hex_to_rgba(C["mush"])
    pixels[6, 9] = hex_to_rgba(C["mush"])
    pixels[7, 9] = hex_to_rgba(C["mush_dark"])
    pixels[8, 9] = hex_to_rgba(C["mush_outline"])
    for x in range(4, 8):
        pixels[x, 10] = hex_to_rgba(C["mush_outline"])
    # Spots on cap
    pixels[5, 9] = hex_to_rgba(C["mush_spot"])
    # Stem
    pixels[5, 11] = hex_to_rgba(C["mush_stem"])
    pixels[6, 11] = hex_to_rgba(C["mush_stem"])
    pixels[5, 12] = hex_to_rgba(C["mush_outline"])
    pixels[6, 12] = hex_to_rgba(C["mush_outline"])

    # Mushroom 2 (small, right side)
    pixels[11, 10] = hex_to_rgba(C["mush_outline"])
    pixels[12, 10] = hex_to_rgba(C["mush_outline"])
    pixels[10, 11] = hex_to_rgba(C["mush_outline"])
    pixels[11, 11] = hex_to_rgba(C["mush"])
    pixels[12, 11] = hex_to_rgba(C["mush_dark"])
    pixels[13, 11] = hex_to_rgba(C["mush_outline"])
    pixels[11, 12] = hex_to_rgba(C["mush_stem"])
    pixels[11, 13] = hex_to_rgba(C["mush_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_moss_tile(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base dark grass
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["forest_grass"])

    # Moss patches (scattered)
    moss_areas = [
        (2, 3),
        (3, 3),
        (3, 4),
        (4, 4),
        (9, 5),
        (10, 5),
        (10, 6),
        (11, 6),
        (5, 10),
        (6, 10),
        (6, 11),
        (7, 11),
        (12, 12),
        (13, 12),
        (13, 13),
    ]
    for x, y in moss_areas:
        pixels[x, y] = hex_to_rgba(C["moss"])

    # Lighter moss highlights
    pixels[3, 3] = hex_to_rgba(C["moss_light"])
    pixels[10, 5] = hex_to_rgba(C["moss_light"])
    pixels[6, 10] = hex_to_rgba(C["moss_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_forest_floor(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base dark forest floor
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["forest_grass_dark"])

    # Scattered leaves/debris
    debris = [
        (2, 2),
        (7, 3),
        (12, 4),
        (4, 7),
        (9, 8),
        (14, 9),
        (3, 11),
        (8, 13),
        (13, 14),
    ]
    for x, y in debris:
        pixels[x, y] = hex_to_rgba(C["root_light"])

    # Darker damp spots
    damp = [(5, 5), (10, 10), (1, 13)]
    for x, y in damp:
        pixels[x, y] = hex_to_rgba(C["forest_grass_outline"])
        if x + 1 < 16:
            pixels[x + 1, y] = hex_to_rgba(C["forest_grass_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/tiles/forest"
    os.makedirs(output_dir, exist_ok=True)

    create_forest_grass(os.path.join(output_dir, "tile_forest_grass.png"))
    create_forest_roots(os.path.join(output_dir, "tile_forest_roots.png"))
    create_mushroom_tile(os.path.join(output_dir, "tile_mushrooms.png"))
    create_moss_tile(os.path.join(output_dir, "tile_moss.png"))
    create_forest_floor(os.path.join(output_dir, "tile_forest_floor.png"))

    print("\nForest tiles generation complete!")


if __name__ == "__main__":
    main()
