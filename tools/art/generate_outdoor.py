#!/usr/bin/env python3
"""Generate outdoor prop sprites using the Cloverhollow palette.

Creates town outdoor props: fountain, fence, mailbox, trash_can, picnic_table, flower_bed.
All sprites follow the cozy storybook JRPG style with colored outlines.
"""

from PIL import Image
import os

# Cloverhollow palette colors
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
    # Water
    "water_light": (0x88, 0xCC, 0xEE),
    "water_mid": (0x66, 0xAA, 0xDD),
    "water_dark": (0x44, 0x88, 0xBB),
    # Flowers
    "flower_pink": (0xE8, 0xA8, 0xC4),
    "flower_purple": (0xB0, 0x88, 0xCC),
    "flower_yellow": (0xF5, 0xE0, 0x78),
    "flower_red": (0xD9, 0x70, 0x70),
    "flower_white": (0xF8, 0xF4, 0xEA),
    # Stone
    "stone_light": (0xCC, 0xC4, 0xB8),
    "stone_mid": (0xA8, 0xA0, 0x94),
    "stone_dark": (0x7A, 0x72, 0x68),
    # Outlines
    "outline_brown": (0x3D, 0x32, 0x28),
    "outline_teal": (0x2A, 0x4A, 0x4A),
}


def hex_to_rgba(hex_tuple):
    """Convert RGB tuple to RGBA."""
    if len(hex_tuple) == 4:
        return hex_tuple
    return (*hex_tuple, 255)


def create_fountain(output_path):
    """Create a 32x32 town fountain sprite with water."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Colors
    outline = hex_to_rgba(COLORS["outline_brown"])
    stone_l = hex_to_rgba(COLORS["stone_light"])
    stone_m = hex_to_rgba(COLORS["stone_mid"])
    stone_d = hex_to_rgba(COLORS["stone_dark"])
    water_l = hex_to_rgba(COLORS["water_light"])
    water_m = hex_to_rgba(COLORS["water_mid"])
    water_d = hex_to_rgba(COLORS["water_dark"])

    # Central pillar top (rows 2-6)
    for y in range(2, 7):
        for x in range(14, 18):
            if y == 2:
                pixels[x, y] = stone_l
            else:
                pixels[x, y] = stone_m if x < 16 else stone_d
    # Pillar outline
    pixels[13, 3] = outline
    pixels[18, 3] = outline
    for y in range(3, 7):
        pixels[13, y] = outline
        pixels[18, y] = outline

    # Water spout area (row 7-8)
    for x in range(14, 18):
        pixels[x, 7] = water_l  # Water spray hint

    # Upper basin (rows 8-12)
    for y in range(8, 13):
        for x in range(10, 22):
            if y == 8:
                pixels[x, y] = outline
            elif y == 12:
                pixels[x, y] = outline
            elif x == 10 or x == 21:
                pixels[x, y] = outline
            else:
                # Water fill with depth shading
                if y < 10:
                    pixels[x, y] = water_l
                else:
                    pixels[x, y] = water_m if x < 16 else water_d

    # Central pillar continues down (rows 13-18)
    for y in range(13, 19):
        for x in range(14, 18):
            if x == 14 or x == 17:
                pixels[x, y] = outline
            else:
                pixels[x, y] = stone_m if x == 15 else stone_d

    # Lower basin (rows 19-27)
    for y in range(19, 28):
        for x in range(4, 28):
            if y == 19:
                pixels[x, y] = outline
            elif y == 27:
                pixels[x, y] = outline
            elif x == 4 or x == 27:
                pixels[x, y] = outline
            else:
                # Water with perspective shading
                if y < 22:
                    pixels[x, y] = water_l if x < 16 else water_m
                else:
                    pixels[x, y] = water_m if x < 16 else water_d

    # Base rim (rows 28-30)
    for y in range(28, 31):
        for x in range(3, 29):
            if y == 28:
                pixels[x, y] = stone_l
            elif y == 29:
                pixels[x, y] = stone_m
            else:
                pixels[x, y] = stone_d if x > 5 and x < 26 else outline

    # Base outline bottom
    for x in range(3, 29):
        pixels[x, 31] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_fence(output_path):
    """Create a 16x16 wooden picket fence segment."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])

    # Horizontal rails (rows 6-7 and rows 11-12)
    for x in range(0, 16):
        # Upper rail
        pixels[x, 6] = wood_l
        pixels[x, 7] = wood_m
        # Lower rail
        pixels[x, 11] = wood_l
        pixels[x, 12] = wood_m

    # Pickets - 4 vertical boards with pointed tops
    picket_positions = [1, 5, 9, 13]
    for px in picket_positions:
        # Pointed top (row 2-3)
        pixels[px, 2] = outline
        pixels[px + 1, 2] = outline
        pixels[px, 3] = wood_l
        pixels[px + 1, 3] = wood_m
        # Board body (rows 4-14)
        for y in range(4, 15):
            pixels[px, y] = wood_l
            pixels[px + 1, y] = wood_m
        # Outline sides
        for y in range(3, 15):
            if px > 0:
                pixels[px - 1, y] = (
                    pixels[px - 1, y] if pixels[px - 1, y][3] > 0 else (0, 0, 0, 0)
                )

    # Bottom outline
    for x in range(0, 16):
        if pixels[x, 14][3] > 0:  # Only where pickets are
            pixels[x, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_mailbox(output_path):
    """Create a 16x16 cute mailbox sprite."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    # Red for the mailbox
    red_l = (0xE8, 0x70, 0x70, 255)
    red_m = (0xCC, 0x55, 0x55, 255)
    red_d = (0xAA, 0x40, 0x40, 255)

    # Mailbox body - rounded rectangle shape (rows 2-9)
    # Top curve
    for x in range(6, 12):
        pixels[x, 2] = outline
    pixels[5, 3] = outline
    pixels[12, 3] = outline

    # Body
    for y in range(3, 10):
        for x in range(5, 13):
            if x == 5 or x == 12:
                pixels[x, y] = outline
            elif y == 9:
                pixels[x, y] = outline
            else:
                pixels[x, y] = red_l if x < 9 else red_m

    # Mail slot (row 5-6)
    for x in range(7, 11):
        pixels[x, 5] = outline
        pixels[x, 6] = red_d

    # Flag on right side (rows 3-5)
    pixels[13, 3] = outline
    pixels[13, 4] = red_l
    pixels[14, 4] = red_m
    pixels[13, 5] = outline

    # Post (rows 10-15)
    for y in range(10, 16):
        pixels[8, y] = wood_l
        pixels[9, y] = wood_m
    # Post outline
    for y in range(10, 16):
        pixels[7, y] = outline if y == 15 else (0, 0, 0, 0)
        pixels[10, y] = outline if y == 15 else (0, 0, 0, 0)

    pixels[7, 15] = outline
    pixels[10, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_trash_can(output_path):
    """Create a 16x16 metal trash can sprite."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    iron_l = hex_to_rgba(COLORS["iron_light"])
    iron = hex_to_rgba(COLORS["iron"])
    iron_d = hex_to_rgba(COLORS["iron_dark"])

    # Lid (rows 2-4)
    for x in range(5, 11):
        pixels[x, 2] = outline
    for x in range(4, 12):
        pixels[x, 3] = iron_l
        pixels[x, 4] = iron

    # Lid handle
    pixels[7, 1] = outline
    pixels[8, 1] = outline
    pixels[7, 2] = iron_l
    pixels[8, 2] = iron

    # Body (rows 5-13) - slightly tapered
    for y in range(5, 14):
        x_start = 4 if y < 10 else 3
        x_end = 12 if y < 10 else 13
        for x in range(x_start, x_end):
            if x == x_start or x == x_end - 1:
                pixels[x, y] = outline
            elif x < 8:
                pixels[x, y] = iron_l
            else:
                pixels[x, y] = iron

    # Horizontal bands (decoration)
    for x in range(4, 12):
        if pixels[x, 7][3] > 0 and x not in (4, 11):
            pixels[x, 7] = iron_d
        if pixels[x, 11][3] > 0 and x not in (3, 12):
            pixels[x, 11] = iron_d

    # Base (row 14-15)
    for x in range(3, 13):
        pixels[x, 14] = iron_d
        pixels[x, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_picnic_table(output_path):
    """Create a 24x16 wooden picnic table sprite."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])

    # Table top (rows 4-6)
    for y in range(4, 7):
        for x in range(2, 22):
            if y == 4:
                pixels[x, y] = outline
            elif y == 6:
                pixels[x, y] = wood_m
            else:
                pixels[x, y] = wood_l if x % 4 < 2 else wood_m

    # Table top front edge
    for x in range(2, 22):
        pixels[x, 7] = outline

    # Left bench (rows 9-11)
    for y in range(9, 12):
        for x in range(0, 8):
            if y == 9:
                pixels[x, y] = wood_l
            elif y == 10:
                pixels[x, y] = wood_m
            else:
                pixels[x, y] = outline

    # Right bench (rows 9-11)
    for y in range(9, 12):
        for x in range(16, 24):
            if y == 9:
                pixels[x, y] = wood_l
            elif y == 10:
                pixels[x, y] = wood_m
            else:
                pixels[x, y] = outline

    # Table legs (rows 8-14)
    # Left A-frame
    for y in range(8, 15):
        offset = (y - 8) // 2
        pixels[5 - offset, y] = wood_d
        pixels[6 + offset, y] = wood_d
    # Right A-frame
    for y in range(8, 15):
        offset = (y - 8) // 2
        pixels[17 - offset, y] = wood_d
        pixels[18 + offset, y] = wood_d

    # Ground contact
    pixels[2, 15] = outline
    pixels[9, 15] = outline
    pixels[14, 15] = outline
    pixels[21, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_flower_bed(output_path):
    """Create a 24x16 decorative flower bed sprite."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline_brown"])
    stone_l = hex_to_rgba(COLORS["stone_light"])
    stone_m = hex_to_rgba(COLORS["stone_mid"])
    stone_d = hex_to_rgba(COLORS["stone_dark"])
    soil = hex_to_rgba(COLORS["wood_dark"])
    foliage = hex_to_rgba(COLORS["foliage_mid"])
    foliage_d = hex_to_rgba(COLORS["foliage_dark"])
    flower_p = hex_to_rgba(COLORS["flower_pink"])
    flower_y = hex_to_rgba(COLORS["flower_yellow"])
    flower_pu = hex_to_rgba(COLORS["flower_purple"])
    flower_r = hex_to_rgba(COLORS["flower_red"])
    flower_w = hex_to_rgba(COLORS["flower_white"])

    # Stone border (rows 8-15)
    for y in range(8, 16):
        for x in range(1, 23):
            if y == 8 or y == 15:
                pixels[x, y] = outline
            elif x == 1 or x == 22:
                pixels[x, y] = outline
            elif y == 9:
                pixels[x, y] = stone_l
            elif y < 13:
                pixels[x, y] = stone_m if x < 12 else stone_d
            else:
                pixels[x, y] = stone_d

    # Soil inside (rows 9-14, but covered by flowers)
    for y in range(9, 15):
        for x in range(2, 22):
            if pixels[x, y] == (0, 0, 0, 0) or pixels[x, y][3] == 0:
                pixels[x, y] = soil

    # Flowers and foliage (rows 2-8)
    # Row of flowers
    flower_colors = [
        flower_p,
        flower_y,
        flower_pu,
        flower_r,
        flower_w,
        flower_p,
        flower_y,
    ]
    for i, fc in enumerate(flower_colors):
        x = 3 + i * 3
        # Flower head
        pixels[x, 3] = fc
        pixels[x - 1, 4] = fc
        pixels[x, 4] = fc
        pixels[x + 1, 4] = fc
        pixels[x, 5] = fc
        # Stem
        pixels[x, 6] = foliage
        pixels[x, 7] = foliage_d

    # Extra foliage filling
    for x in range(2, 22):
        if pixels[x, 7][3] == 0:
            pixels[x, 7] = foliage if x % 2 == 0 else foliage_d
        if pixels[x, 6][3] == 0 and x % 3 == 0:
            pixels[x, 6] = foliage

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/props"
    os.makedirs(output_dir, exist_ok=True)

    create_fountain(os.path.join(output_dir, "fountain.png"))
    create_fence(os.path.join(output_dir, "fence.png"))
    create_mailbox(os.path.join(output_dir, "mailbox.png"))
    create_trash_can(os.path.join(output_dir, "trash_can.png"))
    create_picnic_table(os.path.join(output_dir, "picnic_table.png"))
    create_flower_bed(os.path.join(output_dir, "flower_bed.png"))

    print(f"\nGenerated 6 outdoor prop sprites in {output_dir}/")


if __name__ == "__main__":
    main()
