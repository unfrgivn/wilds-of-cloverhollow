#!/usr/bin/env python3
"""Generate interior shop prop sprites using the Cloverhollow palette.

Creates interior shop props: counter, shelf, display_case, cash_register, crates.
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
    "glass_light": (0xCC, 0xDD, 0xEE),
    "glass_dark": (0x99, 0xBB, 0xCC),
    "gold": (0xD9, 0xB8, 0x48),
    "potion_red": (0xCC, 0x55, 0x55),
    "potion_blue": (0x55, 0x88, 0xCC),
    "potion_green": (0x55, 0xAA, 0x66),
    "cloth_red": (0xCC, 0x66, 0x55),
    "cloth_blue": (0x55, 0x66, 0xAA),
    "outline": (0x3D, 0x32, 0x28),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def draw_rect(pixels, x1, y1, x2, y2, color):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            pixels[x, y] = color


def create_counter(output_path):
    """Create a 24x16 shop counter."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])

    # Counter top (rows 2-5)
    for y in range(2, 6):
        for x in range(1, 23):
            if y == 2 or y == 5:
                pixels[x, y] = outline
            elif x == 1 or x == 22:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if y == 3 else wood_m

    # Counter body (rows 6-14)
    for y in range(6, 15):
        for x in range(2, 22):
            if x == 2 or x == 21:
                pixels[x, y] = outline
            elif y == 14:
                pixels[x, y] = wood_d
            else:
                pixels[x, y] = wood_m if x < 12 else wood_d

    # Bottom outline
    for x in range(2, 22):
        pixels[x, 15] = outline

    # Panel detail
    draw_rect(pixels, 5, 8, 9, 12, wood_d)
    draw_rect(pixels, 14, 8, 18, 12, wood_d)

    img.save(output_path)
    print(f"Created: {output_path}")


def create_shelf(output_path):
    """Create a 16x24 shop shelf with items."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    potion_r = hex_to_rgba(COLORS["potion_red"])
    potion_b = hex_to_rgba(COLORS["potion_blue"])
    potion_g = hex_to_rgba(COLORS["potion_green"])

    # Back panel (rows 0-23)
    for y in range(0, 24):
        for x in range(1, 15):
            if x == 1 or x == 14 or y == 0 or y == 23:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_d

    # Shelf planks at rows 7, 15
    for shelf_y in [7, 15]:
        for x in range(2, 14):
            pixels[x, shelf_y] = wood_l
            pixels[x, shelf_y + 1] = wood_m

    # Potions on top shelf (rows 2-6)
    for i, color in enumerate([potion_r, potion_b, potion_g]):
        px = 3 + i * 4
        pixels[px, 4] = color
        pixels[px + 1, 4] = color
        pixels[px, 5] = color
        pixels[px + 1, 5] = color
        pixels[px, 6] = outline
        pixels[px + 1, 6] = outline

    # Potions on second shelf (rows 10-14)
    for i, color in enumerate([potion_g, potion_r, potion_b]):
        px = 3 + i * 4
        pixels[px, 12] = color
        pixels[px + 1, 12] = color
        pixels[px, 13] = color
        pixels[px + 1, 13] = color
        pixels[px, 14] = outline
        pixels[px + 1, 14] = outline

    # Bottom items (boxes, rows 18-22)
    draw_rect(pixels, 3, 18, 6, 21, wood_m)
    draw_rect(pixels, 9, 18, 12, 21, wood_m)

    img.save(output_path)
    print(f"Created: {output_path}")


def create_display_case(output_path):
    """Create a 16x16 glass display case."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    glass_l = hex_to_rgba(COLORS["glass_light"])
    glass_d = hex_to_rgba(COLORS["glass_dark"])
    gold = hex_to_rgba(COLORS["gold"])

    # Wood base (rows 10-14)
    for y in range(10, 15):
        for x in range(2, 14):
            if x == 2 or x == 13 or y == 10 or y == 14:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if y == 11 else wood_m

    # Bottom outline
    for x in range(2, 14):
        pixels[x, 15] = outline

    # Glass dome (rows 2-9)
    for y in range(2, 10):
        for x in range(3, 13):
            if y == 2:
                if x >= 5 and x <= 10:
                    pixels[x, y] = outline
            elif y == 9:
                pixels[x, y] = outline
            elif x == 3 or x == 12:
                if y >= 4:
                    pixels[x, y] = outline
            else:
                pixels[x, y] = glass_l if x < 8 else glass_d

    # Curved top
    pixels[4, 3] = outline
    pixels[11, 3] = outline
    pixels[3, 4] = outline
    pixels[12, 4] = outline

    # Display item (gold ring)
    pixels[7, 7] = gold
    pixels[8, 7] = gold
    pixels[7, 8] = gold
    pixels[8, 8] = gold

    img.save(output_path)
    print(f"Created: {output_path}")


def create_cash_register(output_path):
    """Create a 16x16 cash register."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    metal_l = hex_to_rgba(COLORS["metal_light"])
    metal_m = hex_to_rgba(COLORS["metal_mid"])
    metal_d = hex_to_rgba(COLORS["metal_dark"])
    gold = hex_to_rgba(COLORS["gold"])

    # Main body (rows 4-13)
    for y in range(4, 14):
        for x in range(3, 13):
            if x == 3 or x == 12 or y == 4 or y == 13:
                pixels[x, y] = outline
            else:
                pixels[x, y] = metal_l if y < 8 else metal_m

    # Display window (rows 5-7)
    draw_rect(pixels, 5, 5, 10, 7, metal_d)

    # Buttons (rows 9-11)
    for bx in [5, 7, 9]:
        pixels[bx, 9] = gold
        pixels[bx, 10] = gold
        pixels[bx, 11] = metal_d

    # Drawer (rows 14-15)
    for x in range(4, 12):
        pixels[x, 14] = metal_m
        pixels[x, 15] = outline

    # Handle
    pixels[7, 14] = gold
    pixels[8, 14] = gold

    img.save(output_path)
    print(f"Created: {output_path}")


def create_crate(output_path):
    """Create a 16x16 wooden crate."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])

    # Main box (rows 3-14)
    for y in range(3, 15):
        for x in range(2, 14):
            if x == 2 or x == 13 or y == 3 or y == 14:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if x < 8 else wood_m

    # Horizontal slats
    for x in range(3, 13):
        pixels[x, 6] = wood_d
        pixels[x, 10] = wood_d

    # Vertical slats
    for y in range(4, 14):
        pixels[5, y] = wood_d
        pixels[10, y] = wood_d

    # Corner reinforcements
    corners = [(3, 4), (12, 4), (3, 13), (12, 13)]
    for cx, cy in corners:
        pixels[cx, cy] = wood_d

    # Bottom
    for x in range(2, 14):
        pixels[x, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_crate_open(output_path):
    """Create a 16x16 open wooden crate with items."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    cloth_r = hex_to_rgba(COLORS["cloth_red"])
    cloth_b = hex_to_rgba(COLORS["cloth_blue"])

    # Box sides (rows 6-14)
    for y in range(6, 15):
        for x in range(2, 14):
            if x == 2 or x == 13 or y == 14:
                pixels[x, y] = outline
            elif y == 6:
                pixels[x, y] = wood_l
            else:
                pixels[x, y] = wood_m

    # Items poking out (rows 2-6)
    draw_rect(pixels, 4, 3, 6, 5, cloth_r)
    draw_rect(pixels, 9, 2, 11, 5, cloth_b)

    # Vertical slats
    for y in range(7, 14):
        pixels[5, y] = wood_d
        pixels[10, y] = wood_d

    # Bottom
    for x in range(2, 14):
        pixels[x, 15] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_barrel(output_path):
    """Create a 16x16 wooden barrel."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    metal = hex_to_rgba(COLORS["metal_mid"])

    # Barrel body - wider in middle
    for y in range(2, 15):
        if y < 4 or y > 12:
            x_start, x_end = 5, 11
        elif y < 6 or y > 10:
            x_start, x_end = 4, 12
        else:
            x_start, x_end = 3, 13

        for x in range(x_start, x_end):
            if x == x_start or x == x_end - 1:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wood_l if x < 8 else wood_m

    # Top
    for x in range(5, 11):
        pixels[x, 2] = outline

    # Bottom
    for x in range(5, 11):
        pixels[x, 14] = outline
    for x in range(5, 11):
        pixels[x, 15] = outline

    # Metal bands
    for x in range(4, 12):
        if pixels[x, 4][3] > 0:
            pixels[x, 4] = metal
        if pixels[x, 11][3] > 0:
            pixels[x, 11] = metal

    # Vertical wood grain
    for y in range(3, 14):
        if pixels[6, y][3] > 0 and pixels[6, y] != outline and pixels[6, y] != metal:
            pixels[6, y] = wood_d
        if pixels[9, y][3] > 0 and pixels[9, y] != outline and pixels[9, y] != metal:
            pixels[9, y] = wood_d

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/props/shop"
    os.makedirs(output_dir, exist_ok=True)

    create_counter(os.path.join(output_dir, "counter.png"))
    create_shelf(os.path.join(output_dir, "shelf.png"))
    create_display_case(os.path.join(output_dir, "display_case.png"))
    create_cash_register(os.path.join(output_dir, "cash_register.png"))
    create_crate(os.path.join(output_dir, "crate.png"))
    create_crate_open(os.path.join(output_dir, "crate_open.png"))
    create_barrel(os.path.join(output_dir, "barrel.png"))

    print(f"\nGenerated 7 interior shop prop sprites in {output_dir}/")


if __name__ == "__main__":
    main()
