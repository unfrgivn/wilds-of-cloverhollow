#!/usr/bin/env python3
"""Generate interactive prop sprites using the Cloverhollow palette.

Creates interactive town props: chest variants, door, sign variants.
All sprites follow the cozy storybook JRPG style with colored outlines.
"""

from PIL import Image
import os

COLORS = {
    "wood_highlight": (0xC9, 0xA8, 0x70),
    "wood_light": (0xB5, 0x8A, 0x4D),
    "wood_mid": (0x8A, 0x6B, 0x3F),
    "wood_dark": (0x5A, 0x4A, 0x3A),
    "wood_shadow": (0x3D, 0x32, 0x28),
    "metal_light": (0x8A, 0x7A, 0x5A),
    "metal_mid": (0x6A, 0x5A, 0x4A),
    "metal_dark": (0x4A, 0x3A, 0x2A),
    "gold_light": (0xF5, 0xE0, 0x78),
    "gold_mid": (0xD9, 0xB8, 0x48),
    "gold_dark": (0xA8, 0x88, 0x38),
    "red_light": (0xCC, 0x66, 0x55),
    "red_mid": (0xAA, 0x44, 0x44),
    "red_dark": (0x88, 0x33, 0x33),
    "blue_light": (0x66, 0x88, 0xCC),
    "blue_mid": (0x44, 0x66, 0xAA),
    "cream": (0xE8, 0xDC, 0xC4),
    "cream_dark": (0xD4, 0xC8, 0xA8),
    "outline_brown": (0x3D, 0x32, 0x28),
    "outline_teal": (0x2A, 0x4A, 0x4A),
}


def hex_to_rgba(hex_tuple):
    return (*hex_tuple, 255) if len(hex_tuple) == 3 else hex_tuple


def create_chest_closed(output_path):
    """Create a 16x16 closed treasure chest."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    metal_l = hex_to_rgba(COLORS["metal_light"])
    metal_m = hex_to_rgba(COLORS["metal_mid"])
    gold = hex_to_rgba(COLORS["gold_mid"])

    # Lid top curve (rows 3-5)
    for x in range(4, 12):
        pixels[x, 3] = outline
    pixels[3, 4] = outline
    pixels[12, 4] = outline
    for x in range(4, 12):
        pixels[x, 4] = wood_l
    pixels[3, 5] = outline
    pixels[12, 5] = outline
    for x in range(4, 12):
        pixels[x, 5] = wood_m

    # Lid body (rows 6-7)
    for y in range(6, 8):
        for x in range(3, 13):
            if x == 3 or x == 12:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if y == 6 else wood_m

    # Metal band (row 8)
    for x in range(3, 13):
        if x == 3 or x == 12:
            pixels[x, 8] = outline
        else:
            pixels[x, 8] = metal_l

    # Lock (center)
    pixels[7, 8] = gold
    pixels[8, 8] = gold

    # Body (rows 9-13)
    for y in range(9, 14):
        for x in range(3, 13):
            if x == 3 or x == 12:
                pixels[x, y] = outline
            elif y == 13:
                pixels[x, y] = wood_d
            else:
                pixels[x, y] = wood_m if x < 8 else wood_d

    # Bottom outline
    for x in range(3, 13):
        pixels[x, 14] = outline

    # Metal corners
    pixels[4, 9] = metal_m
    pixels[11, 9] = metal_m
    pixels[4, 13] = metal_m
    pixels[11, 13] = metal_m

    img.save(output_path)
    print(f"Created: {output_path}")


def create_chest_open(output_path):
    """Create a 16x16 open treasure chest."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    metal_m = hex_to_rgba(COLORS["metal_mid"])
    gold = hex_to_rgba(COLORS["gold_light"])

    # Open lid (tilted back, rows 1-4)
    for x in range(5, 11):
        pixels[x, 1] = outline
    for x in range(4, 12):
        pixels[x, 2] = wood_l if x < 8 else wood_m
    pixels[4, 2] = outline
    pixels[11, 2] = outline
    for x in range(3, 13):
        pixels[x, 3] = wood_m
    pixels[3, 3] = outline
    pixels[12, 3] = outline
    for x in range(3, 13):
        pixels[x, 4] = outline

    # Interior glow (rows 5-6)
    for x in range(4, 12):
        pixels[x, 5] = gold
        pixels[x, 6] = gold

    # Chest body front (rows 7-13)
    for y in range(7, 14):
        for x in range(3, 13):
            if x == 3 or x == 12:
                pixels[x, y] = outline
            elif y == 13:
                pixels[x, y] = wood_d
            else:
                pixels[x, y] = wood_m if x < 8 else wood_d

    # Bottom outline
    for x in range(3, 13):
        pixels[x, 14] = outline

    # Metal corners
    pixels[4, 7] = metal_m
    pixels[11, 7] = metal_m
    pixels[4, 13] = metal_m
    pixels[11, 13] = metal_m

    img.save(output_path)
    print(f"Created: {output_path}")


def create_door_closed(output_path):
    """Create a 16x24 closed wooden door."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    metal = hex_to_rgba(COLORS["metal_mid"])
    gold = hex_to_rgba(COLORS["gold_mid"])

    # Door frame top (rows 0-1)
    for x in range(2, 14):
        pixels[x, 0] = outline
        pixels[x, 1] = wood_d

    # Door body (rows 2-21)
    for y in range(2, 22):
        for x in range(2, 14):
            if x == 2 or x == 13:
                pixels[x, y] = outline
            elif x == 3 or x == 12:
                pixels[x, y] = wood_d
            else:
                pixels[x, y] = wood_l if x < 8 else wood_m

    # Horizontal planks (every 5 rows)
    for y in [6, 11, 16]:
        for x in range(4, 12):
            pixels[x, y] = wood_d

    # Door handle (right side)
    pixels[10, 12] = metal
    pixels[10, 13] = gold
    pixels[10, 14] = metal

    # Bottom threshold
    for x in range(2, 14):
        pixels[x, 22] = wood_d
        pixels[x, 23] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_door_open(output_path):
    """Create a 16x24 open wooden door (showing dark interior)."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    dark = (0x1A, 0x14, 0x14, 255)

    # Door frame (rows 0-1)
    for x in range(2, 14):
        pixels[x, 0] = outline
        pixels[x, 1] = wood_d

    # Dark interior (rows 2-21)
    for y in range(2, 22):
        for x in range(2, 14):
            if x == 2 or x == 13:
                pixels[x, y] = outline
            elif x == 3 or x == 12:
                pixels[x, y] = wood_d
            else:
                pixels[x, y] = dark

    # Bottom threshold
    for x in range(2, 14):
        pixels[x, 22] = wood_d
        pixels[x, 23] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sign_wood(output_path):
    """Create a 16x16 blank wooden sign (for custom text overlay)."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    cream = hex_to_rgba(COLORS["cream"])

    # Sign board (rows 2-9)
    for y in range(2, 10):
        for x in range(2, 14):
            if y == 2 or y == 9:
                pixels[x, y] = outline
            elif x == 2 or x == 13:
                pixels[x, y] = outline
            else:
                pixels[x, y] = cream

    # Wood frame
    for x in range(3, 13):
        pixels[x, 3] = wood_l
        pixels[x, 8] = wood_d

    # Post (rows 10-15)
    for y in range(10, 16):
        pixels[7, y] = wood_l
        pixels[8, y] = wood_m
    pixels[6, 15] = outline
    pixels[9, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sign_arrow(output_path):
    """Create a 16x16 directional arrow sign."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    red = hex_to_rgba(COLORS["red_mid"])

    # Arrow sign board (rows 3-8, arrow shape)
    for y in range(3, 9):
        for x in range(2, 14):
            if y == 3 or y == 8:
                if x >= 3 and x <= 12:
                    pixels[x, y] = outline
            elif x == 2 or x == 13:
                if y == 5 or y == 6:
                    pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if y < 6 else wood_m

    # Arrow point (right side)
    pixels[14, 5] = outline
    pixels[14, 6] = outline
    pixels[13, 4] = outline
    pixels[13, 7] = outline
    pixels[13, 5] = wood_l
    pixels[13, 6] = wood_m

    # Arrow symbol
    pixels[9, 5] = red
    pixels[10, 5] = red
    pixels[11, 5] = red
    pixels[9, 6] = red
    pixels[10, 6] = red
    pixels[11, 6] = red

    # Post (rows 9-15)
    for y in range(9, 16):
        pixels[7, y] = wood_l
        pixels[8, y] = wood_m
    pixels[6, 15] = outline
    pixels[9, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sign_shop(output_path):
    """Create a 16x16 shop/hanging sign."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    metal = hex_to_rgba(COLORS["metal_mid"])
    cream = hex_to_rgba(COLORS["cream"])
    cream_d = hex_to_rgba(COLORS["cream_dark"])

    # Hanging bracket (rows 1-3)
    pixels[4, 1] = metal
    pixels[11, 1] = metal
    pixels[4, 2] = metal
    pixels[11, 2] = metal
    for x in range(4, 12):
        pixels[x, 3] = metal

    # Sign chains
    pixels[5, 4] = metal
    pixels[10, 4] = metal

    # Sign board (rows 5-13)
    for y in range(5, 14):
        for x in range(2, 14):
            if y == 5 or y == 13:
                pixels[x, y] = outline
            elif x == 2 or x == 13:
                pixels[x, y] = outline
            elif y == 6 or y == 12:
                pixels[x, y] = wood_l if y == 6 else wood_m
            else:
                pixels[x, y] = cream if y < 10 else cream_d

    # Decorative corners
    pixels[3, 6] = wood_m
    pixels[12, 6] = wood_m
    pixels[3, 12] = wood_m
    pixels[12, 12] = wood_m

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/props"
    os.makedirs(output_dir, exist_ok=True)

    create_chest_closed(os.path.join(output_dir, "chest_closed.png"))
    create_chest_open(os.path.join(output_dir, "chest_open.png"))
    create_door_closed(os.path.join(output_dir, "door_closed.png"))
    create_door_open(os.path.join(output_dir, "door_open.png"))
    create_sign_wood(os.path.join(output_dir, "sign_wood.png"))
    create_sign_arrow(os.path.join(output_dir, "sign_arrow.png"))
    create_sign_shop(os.path.join(output_dir, "sign_shop.png"))

    print(f"\nGenerated 7 interactive prop sprites in {output_dir}/")


if __name__ == "__main__":
    main()
