#!/usr/bin/env python3
"""Generate town tileset pieces for Wilds of Cloverhollow (16x16)."""

from PIL import Image
import os

COLORS = {
    # Grass
    "grass_outline": (0x28, 0x4A, 0x28),
    "grass_dark": (0x40, 0x70, 0x40),
    "grass": (0x60, 0x98, 0x50),
    "grass_light": (0x80, 0xB8, 0x68),
    "grass_highlight": (0xA0, 0xD0, 0x80),
    # Path (dirt/sand)
    "path_outline": (0x5A, 0x48, 0x38),
    "path_dark": (0x8A, 0x70, 0x58),
    "path": (0xB8, 0x98, 0x78),
    "path_light": (0xD8, 0xB8, 0x98),
    # Water
    "water_outline": (0x28, 0x48, 0x68),
    "water_dark": (0x40, 0x70, 0xA0),
    "water": (0x60, 0x98, 0xC8),
    "water_light": (0x88, 0xC0, 0xE0),
    "water_highlight": (0xB0, 0xE0, 0xF0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_grass_tile(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base grass fill
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["grass"])

    # Add variation pattern (darker patches)
    dark_spots = [(2, 3), (7, 2), (12, 4), (4, 8), (10, 9), (1, 12), (8, 13), (14, 11)]
    for sx, sy in dark_spots:
        pixels[sx, sy] = hex_to_rgba(C["grass_dark"])

    # Light grass highlights
    light_spots = [(5, 1), (11, 3), (3, 6), (9, 7), (14, 5), (6, 11), (12, 14), (2, 14)]
    for sx, sy in light_spots:
        pixels[sx, sy] = hex_to_rgba(C["grass_light"])

    # Tiny highlight sparkles
    pixels[4, 4] = hex_to_rgba(C["grass_highlight"])
    pixels[11, 10] = hex_to_rgba(C["grass_highlight"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_path_tile(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base path fill
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["path"])

    # Darker worn patches
    dark_spots = [(3, 2), (8, 4), (13, 3), (5, 7), (10, 8), (2, 11), (7, 12), (12, 13)]
    for sx, sy in dark_spots:
        pixels[sx, sy] = hex_to_rgba(C["path_dark"])
        if sx + 1 < 16:
            pixels[sx + 1, sy] = hex_to_rgba(C["path_dark"])

    # Light sandy spots
    light_spots = [(1, 5), (6, 3), (11, 6), (4, 10), (9, 11), (14, 9)]
    for sx, sy in light_spots:
        pixels[sx, sy] = hex_to_rgba(C["path_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_path_edge_top(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Top rows (0-2): grass
    for y in range(3):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["grass"])

    # Row 3: transition edge
    for x in range(width):
        pixels[x, 3] = hex_to_rgba(C["grass_dark"])

    # Bottom rows (4-15): path
    for y in range(4, height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["path"])

    # Add path texture
    pixels[5, 7] = hex_to_rgba(C["path_dark"])
    pixels[10, 10] = hex_to_rgba(C["path_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_water_tile(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Base water fill
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["water"])

    # Wave pattern (horizontal light bands)
    for x in range(width):
        if x % 4 < 2:
            pixels[x, 4] = hex_to_rgba(C["water_light"])
            pixels[x, 11] = hex_to_rgba(C["water_light"])

    # Deeper dark areas
    dark_spots = [(3, 7), (8, 8), (12, 6), (5, 13), (10, 2)]
    for sx, sy in dark_spots:
        pixels[sx, sy] = hex_to_rgba(C["water_dark"])

    # Sparkle highlights
    pixels[6, 3] = hex_to_rgba(C["water_highlight"])
    pixels[13, 9] = hex_to_rgba(C["water_highlight"])
    pixels[2, 12] = hex_to_rgba(C["water_highlight"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_water_edge_top(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Top rows (0-4): grass
    for y in range(5):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["grass"])

    # Row 5-6: shoreline edge
    for x in range(width):
        pixels[x, 5] = hex_to_rgba(C["path"])
        pixels[x, 6] = hex_to_rgba(C["path_dark"])

    # Bottom rows (7-15): water
    for y in range(7, height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["water"])

    # Water wave pattern
    for x in range(0, width, 4):
        pixels[x, 9] = hex_to_rgba(C["water_light"])
        pixels[x + 1, 9] = hex_to_rgba(C["water_light"])

    # Water sparkle
    pixels[8, 11] = hex_to_rgba(C["water_highlight"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_water_edge_corner(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Fill with grass base
    for y in range(height):
        for x in range(width):
            pixels[x, y] = hex_to_rgba(C["grass"])

    # Diagonal water area (bottom-right corner)
    for y in range(6, height):
        for x in range(y - 2, width):
            if x >= 0:
                pixels[x, y] = hex_to_rgba(C["water"])

    # Shore edge along diagonal
    for i in range(10):
        y = 6 + i
        x = 4 + i
        if x < width and y < height:
            pixels[x, y] = hex_to_rgba(C["path"])
        if x - 1 >= 0 and y < height:
            pixels[x - 1, y] = hex_to_rgba(C["path_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/tiles/town"
    os.makedirs(output_dir, exist_ok=True)

    create_grass_tile(os.path.join(output_dir, "tile_grass.png"))
    create_path_tile(os.path.join(output_dir, "tile_path.png"))
    create_path_edge_top(os.path.join(output_dir, "tile_path_edge_top.png"))
    create_water_tile(os.path.join(output_dir, "tile_water.png"))
    create_water_edge_top(os.path.join(output_dir, "tile_water_edge_top.png"))
    create_water_edge_corner(os.path.join(output_dir, "tile_water_edge_corner.png"))

    print("\nTown tiles generation complete!")


if __name__ == "__main__":
    main()
