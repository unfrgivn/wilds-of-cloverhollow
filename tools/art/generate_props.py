#!/usr/bin/env python3
"""Generate pixel art prop sprites using the Cloverhollow palette.

Creates proper 16x16, 16x24, and 16x32 pixel art sprites programmatically
with exact palette colors and clean pixel edges.
"""

from PIL import Image
import os

# Cloverhollow palette colors (from art/palettes/cloverhollow.palette.json)
COLORS = {
    # Ground
    "cream_light": (0xF5, 0xEA, 0xD6),
    "cream": (0xE8, 0xDC, 0xC4),
    "cream_shadow": (0xD4, 0xC8, 0xA8),
    "cobble": (0xB0, 0xA4, 0x8C),
    # Wood
    "wood_highlight": (0xC9, 0xA8, 0x70),
    "wood_light": (0xB5, 0x8A, 0x4D),
    "wood_mid": (0x8A, 0x6B, 0x3F),
    "wood_dark": (0x5A, 0x4A, 0x3A),
    "wood_shadow": (0x3D, 0x32, 0x28),
    # Foliage
    "foliage_highlight": (0x8F, 0xD9, 0x78),
    "foliage_light": (0x6B, 0xC4, 0x5A),
    "foliage_mid": (0x4A, 0xA8, 0x4A),
    "foliage_dark": (0x2F, 0x6B, 0x2F),
    "foliage_shadow": (0x1B, 0x3F, 0x1B),
    # Metal
    "iron_light": (0x6A, 0x6A, 0x6A),
    "iron": (0x4A, 0x4A, 0x4A),
    "iron_dark": (0x2A, 0x2A, 0x2A),
    # Flowers
    "flower_pink": (0xE8, 0xA8, 0xC4),
    "flower_purple": (0xB0, 0x88, 0xCC),
    "flower_yellow": (0xF5, 0xE0, 0x78),
    "flower_red": (0xD9, 0x70, 0x70),
    "flower_white": (0xF8, 0xF4, 0xEA),
    # Outlines
    "outline_brown": (0x3D, 0x32, 0x28),
    "outline_maroon": (0x5A, 0x38, 0x38),
    # Transparent
    "transparent": (0, 0, 0, 0),
}


def hex_to_rgba(hex_tuple):
    """Convert RGB tuple to RGBA."""
    if len(hex_tuple) == 4:
        return hex_tuple
    return (*hex_tuple, 255)


def create_bench(output_path):
    """Create a 16x16 wooden park bench sprite."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    # Colors
    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_light = hex_to_rgba(COLORS["wood_light"])
    wood_mid = hex_to_rgba(COLORS["wood_mid"])
    wood_dark = hex_to_rgba(COLORS["wood_dark"])

    # Bench design - side view, 3/4 perspective
    # Row 6-7: Back rest top
    for x in range(2, 14):
        pixels[x, 6] = outline
        pixels[x, 7] = wood_light if x % 3 != 0 else wood_mid

    # Row 8-9: Back rest middle
    for x in range(2, 14):
        pixels[x, 8] = wood_mid
        pixels[x, 9] = wood_mid if x % 4 != 0 else wood_dark

    # Row 10: Gap between back and seat
    pixels[2, 10] = outline
    pixels[13, 10] = outline

    # Row 11-12: Seat
    for x in range(1, 15):
        pixels[x, 11] = outline if x in (1, 14) else wood_light
        pixels[x, 12] = outline if x in (1, 14) else wood_mid

    # Row 13: Seat front edge
    for x in range(1, 15):
        pixels[x, 13] = outline

    # Legs (rows 14-15)
    for leg_x in [3, 12]:
        pixels[leg_x, 14] = wood_dark
        pixels[leg_x, 15] = outline

    # Armrests
    pixels[1, 8] = outline
    pixels[1, 9] = wood_dark
    pixels[1, 10] = wood_dark
    pixels[14, 8] = outline
    pixels[14, 9] = wood_dark
    pixels[14, 10] = wood_dark

    img.save(output_path)
    print(f"Created: {output_path}")


def create_lamp(output_path):
    """Create a 16x32 streetlamp with flower basket sprite."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Colors
    outline = hex_to_rgba(COLORS["outline_brown"])
    iron = hex_to_rgba(COLORS["iron"])
    iron_light = hex_to_rgba(COLORS["iron_light"])
    iron_dark = hex_to_rgba(COLORS["iron_dark"])
    flower_pink = hex_to_rgba(COLORS["flower_pink"])
    flower_purple = hex_to_rgba(COLORS["flower_purple"])
    foliage = hex_to_rgba(COLORS["foliage_mid"])
    yellow = hex_to_rgba(COLORS["flower_yellow"])

    # Lamp head (rows 0-5)
    # Top cap
    for x in range(6, 10):
        pixels[x, 0] = iron_dark
    for x in range(5, 11):
        pixels[x, 1] = iron

    # Lamp glass (glowing)
    for y in range(2, 5):
        for x in range(5, 11):
            if x in (5, 10):
                pixels[x, y] = iron
            else:
                pixels[x, y] = yellow

    # Lamp bottom
    for x in range(6, 10):
        pixels[x, 5] = iron_dark

    # Pole (rows 6-27)
    for y in range(6, 28):
        pixels[7, y] = iron_light
        pixels[8, y] = iron

    # Base (rows 28-31)
    for x in range(5, 11):
        pixels[x, 28] = iron
        pixels[x, 29] = iron_dark
    for x in range(4, 12):
        pixels[x, 30] = iron
        pixels[x, 31] = outline

    # Flower basket arm (right side, rows 10-12)
    for x in range(9, 14):
        pixels[x, 10] = iron

    # Basket
    pixels[12, 11] = iron_dark
    pixels[13, 11] = iron_dark
    pixels[14, 11] = iron_dark
    pixels[11, 12] = iron_dark
    pixels[12, 12] = iron
    pixels[13, 12] = iron
    pixels[14, 12] = iron_dark
    pixels[15, 12] = iron_dark

    # Flowers in basket
    pixels[12, 9] = flower_pink
    pixels[13, 9] = foliage
    pixels[14, 9] = flower_purple
    pixels[12, 10] = foliage
    pixels[14, 10] = flower_pink

    img.save(output_path)
    print(f"Created: {output_path}")


def create_tree(output_path):
    """Create a 16x32 deciduous tree sprite."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Colors
    outline = hex_to_rgba(COLORS["outline_brown"])
    foliage_h = hex_to_rgba(COLORS["foliage_highlight"])
    foliage_l = hex_to_rgba(COLORS["foliage_light"])
    foliage_m = hex_to_rgba(COLORS["foliage_mid"])
    foliage_d = hex_to_rgba(COLORS["foliage_dark"])
    trunk_l = hex_to_rgba(COLORS["wood_mid"])
    trunk_d = hex_to_rgba(COLORS["wood_dark"])

    # Canopy - round fluffy shape (rows 0-20)
    canopy = [
        # (y, x_start, x_end)
        (1, 6, 10),
        (2, 4, 12),
        (3, 3, 13),
        (4, 2, 14),
        (5, 2, 14),
        (6, 1, 15),
        (7, 1, 15),
        (8, 1, 15),
        (9, 1, 15),
        (10, 1, 15),
        (11, 2, 14),
        (12, 2, 14),
        (13, 3, 13),
        (14, 3, 13),
        (15, 4, 12),
        (16, 5, 11),
        (17, 6, 10),
    ]

    for y, x_start, x_end in canopy:
        for x in range(x_start, x_end):
            # Shading: lighter at top-left, darker at bottom-right
            if y < 6:
                color = foliage_h if x < 8 else foliage_l
            elif y < 12:
                color = foliage_l if x < 8 else foliage_m
            else:
                color = foliage_m if x < 8 else foliage_d
            pixels[x, y] = color
        # Outline edges
        pixels[x_start, y] = foliage_d
        pixels[x_end - 1, y] = foliage_d

    # Trunk (rows 18-31)
    for y in range(18, 32):
        pixels[7, y] = trunk_l
        pixels[8, y] = trunk_d

    # Trunk base wider
    pixels[6, 30] = trunk_d
    pixels[9, 30] = trunk_d
    pixels[6, 31] = outline
    pixels[7, 31] = trunk_d
    pixels[8, 31] = trunk_d
    pixels[9, 31] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_planter(output_path):
    """Create a 16x16 stone flower planter sprite."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    # Colors
    outline = hex_to_rgba(COLORS["outline_brown"])
    stone_l = hex_to_rgba(COLORS["cream"])
    stone_m = hex_to_rgba(COLORS["cream_shadow"])
    stone_d = hex_to_rgba(COLORS["cobble"])
    flower_p = hex_to_rgba(COLORS["flower_pink"])
    flower_y = hex_to_rgba(COLORS["flower_yellow"])
    flower_pu = hex_to_rgba(COLORS["flower_purple"])
    foliage = hex_to_rgba(COLORS["foliage_mid"])
    foliage_d = hex_to_rgba(COLORS["foliage_dark"])

    # Flowers (rows 2-6)
    flowers = [
        (3, 4, flower_p),
        (3, 8, flower_y),
        (3, 12, flower_pu),
        (4, 3, foliage),
        (4, 5, flower_y),
        (4, 7, foliage),
        (4, 9, flower_p),
        (4, 11, foliage),
        (4, 13, flower_y),
        (5, 4, flower_pu),
        (5, 6, foliage),
        (5, 8, flower_p),
        (5, 10, flower_y),
        (5, 12, flower_p),
        (6, 3, foliage),
        (6, 5, foliage),
        (6, 7, foliage),
        (6, 9, foliage),
        (6, 11, foliage),
        (6, 13, foliage),
    ]
    for y, x, color in flowers:
        pixels[x, y] = color

    # Planter box (rows 7-14)
    # Top rim
    for x in range(2, 14):
        pixels[x, 7] = outline
        pixels[x, 8] = stone_l

    # Body
    for y in range(9, 14):
        for x in range(2, 14):
            if x in (2, 13):
                pixels[x, y] = outline
            elif x < 7:
                pixels[x, y] = stone_l
            else:
                pixels[x, y] = stone_m

    # Bottom
    for x in range(2, 14):
        pixels[x, 14] = outline

    # Shadow detail
    for y in range(10, 14):
        pixels[12, y] = stone_d

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sign(output_path):
    """Create a 16x16 wooden notice board/sign sprite."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    cream = hex_to_rgba(COLORS["cream"])

    # Sign board (rows 1-9)
    for y in range(1, 10):
        for x in range(2, 14):
            if y == 1 or y == 9 or x == 2 or x == 13:
                pixels[x, y] = outline
            elif y == 2:
                pixels[x, y] = wood_l
            else:
                pixels[x, y] = cream if 4 <= x <= 11 else wood_m

    # Post (rows 10-15)
    for y in range(10, 16):
        pixels[7, y] = wood_m
        pixels[8, y] = wood_d

    # Base
    pixels[6, 15] = outline
    pixels[9, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/props/polished"
    os.makedirs(output_dir, exist_ok=True)

    create_bench(os.path.join(output_dir, "bench.png"))
    create_lamp(os.path.join(output_dir, "lamp.png"))
    create_tree(os.path.join(output_dir, "tree.png"))
    create_planter(os.path.join(output_dir, "planter.png"))
    create_sign(os.path.join(output_dir, "sign.png"))

    print(f"\nGenerated 5 prop sprites in {output_dir}/")


if __name__ == "__main__":
    main()
