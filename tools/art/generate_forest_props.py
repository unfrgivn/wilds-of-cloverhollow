#!/usr/bin/env python3
"""
Generate forest props for M214.
Style: Clean geometric shapes, 2-tone vertical shading (light left/dark right),
colored outlines (no pure black), minimal and flat details.
"""

from PIL import Image
import os

COLORS = {
    # Forest greens (darker than town for deeper forest)
    "leaf_outline": (0x2A, 0x4A, 0x2A),
    "leaf_light": (0x4A, 0x7A, 0x4A),
    "leaf_shadow": (0x3A, 0x5A, 0x3A),
    # Browns for trunks/logs
    "bark_dark": (0x3D, 0x2E, 0x1A),
    "bark_mid": (0x5A, 0x42, 0x28),
    "bark_light": (0x7A, 0x5A, 0x38),
    "bark_highlight": (0x8A, 0x6A, 0x48),
    # Bush greens (slightly different from tree)
    "bush_outline": (0x28, 0x48, 0x28),
    "bush_light": (0x48, 0x78, 0x40),
    "bush_shadow": (0x38, 0x58, 0x30),
    # Stump rings
    "ring_light": (0x9A, 0x7A, 0x58),
    "ring_dark": (0x6A, 0x4A, 0x30),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_forest_tree(output_path):
    """Dark forest tree - 16x32, denser/darker than town tree."""
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Foliage (rows 0-18) - larger, denser canopy
    # Top of canopy
    for x in range(5, 11):
        pixels[x, 0] = hex_to_rgba(COLORS["leaf_outline"])
    for x in range(4, 12):
        pixels[x, 1] = hex_to_rgba(COLORS["leaf_outline"])

    # Main canopy body
    for y in range(2, 17):
        # Determine width at this row (widest in middle)
        if y < 4:
            left, right = 3, 13
        elif y < 8:
            left, right = 2, 14
        elif y < 14:
            left, right = 2, 14
        else:
            left, right = 3, 13

        for x in range(left, right):
            # Outline
            if x == left or x == right - 1:
                pixels[x, y] = hex_to_rgba(COLORS["leaf_outline"])
            # Shading - light left, dark right
            elif x < 8:
                pixels[x, y] = hex_to_rgba(COLORS["leaf_light"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["leaf_shadow"])

    # Bottom edge of canopy
    for x in range(4, 12):
        pixels[x, 17] = hex_to_rgba(COLORS["leaf_outline"])

    # Trunk (rows 18-31)
    for y in range(18, 32):
        # Trunk widens at base
        if y < 28:
            left, right = 7, 9
        else:
            left, right = 6, 10

        for x in range(left, right):
            if x < 8:
                pixels[x, y] = hex_to_rgba(COLORS["bark_light"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["bark_mid"])

    # Ground base
    for x in range(5, 11):
        pixels[x, 31] = hex_to_rgba(COLORS["bark_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_log(output_path):
    """Fallen log - 24x16, horizontal with visible rings."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    pixels = img.load()

    # Main log body (rows 4-12)
    for y in range(4, 13):
        for x in range(2, 22):
            # Top edge
            if y == 4:
                pixels[x, y] = hex_to_rgba(COLORS["bark_dark"])
            # Bottom edge
            elif y == 12:
                pixels[x, y] = hex_to_rgba(COLORS["bark_dark"])
            # Left/right edges
            elif x == 2 or x == 21:
                pixels[x, y] = hex_to_rgba(COLORS["bark_mid"])
            # Main bark surface
            elif y < 7:
                pixels[x, y] = hex_to_rgba(COLORS["bark_highlight"])
            elif y < 10:
                pixels[x, y] = hex_to_rgba(COLORS["bark_light"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["bark_mid"])

    # Left end - cut cross-section showing rings
    for y in range(5, 12):
        for x in range(0, 4):
            dist = abs(1.5 - x) + abs(8 - y) * 0.5
            if dist < 2:
                pixels[x, y] = hex_to_rgba(COLORS["ring_light"])
            elif dist < 3.5:
                pixels[x, y] = hex_to_rgba(COLORS["ring_dark"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["bark_mid"])

    # Right end - rough broken end
    for y in range(5, 12):
        pixels[22, y] = hex_to_rgba(COLORS["bark_dark"])
        if y in [6, 8, 10]:
            pixels[23, y] = hex_to_rgba(COLORS["bark_mid"])

    # Some moss on top
    pixels[8, 4] = hex_to_rgba((0x4A, 0x7A, 0x3A))
    pixels[14, 4] = hex_to_rgba((0x4A, 0x7A, 0x3A))
    pixels[15, 4] = hex_to_rgba((0x4A, 0x7A, 0x3A))

    img.save(output_path)
    print(f"Created: {output_path}")


def create_bush(output_path):
    """Forest bush - 16x16, round leafy shrub."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    # Bush shape - rounded blob
    # Row 2-3: Top
    for x in range(5, 11):
        pixels[x, 2] = hex_to_rgba(COLORS["bush_outline"])
    for x in range(4, 12):
        pixels[x, 3] = hex_to_rgba(COLORS["bush_outline"])

    # Rows 4-11: Main body
    for y in range(4, 12):
        if y < 6:
            left, right = 2, 14
        elif y < 10:
            left, right = 1, 15
        else:
            left, right = 2, 14

        for x in range(left, right):
            # Outline
            if x == left or x == right - 1:
                pixels[x, y] = hex_to_rgba(COLORS["bush_outline"])
            # Light left
            elif x < 7:
                pixels[x, y] = hex_to_rgba(COLORS["bush_light"])
            # Dark right
            else:
                pixels[x, y] = hex_to_rgba(COLORS["bush_shadow"])

    # Bottom row
    for x in range(3, 13):
        pixels[x, 12] = hex_to_rgba(COLORS["bush_outline"])
    for x in range(5, 11):
        pixels[x, 13] = hex_to_rgba(COLORS["bush_outline"])

    # Some leaf texture bumps
    pixels[5, 5] = hex_to_rgba(COLORS["bush_light"])
    pixels[10, 6] = hex_to_rgba(COLORS["bush_shadow"])
    pixels[4, 8] = hex_to_rgba(COLORS["bush_light"])
    pixels[11, 9] = hex_to_rgba(COLORS["bush_shadow"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_stump(output_path):
    """Tree stump - 16x16, cut tree with visible rings."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pixels = img.load()

    # Top surface with rings (rows 2-6)
    for y in range(2, 7):
        for x in range(3, 13):
            cx, cy = 8, 4
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5

            if x == 3 or x == 12:
                pixels[x, y] = hex_to_rgba(COLORS["bark_dark"])
            elif dist < 1.5:
                pixels[x, y] = hex_to_rgba(COLORS["ring_dark"])
            elif dist < 3:
                pixels[x, y] = hex_to_rgba(COLORS["ring_light"])
            elif dist < 4:
                pixels[x, y] = hex_to_rgba(COLORS["ring_dark"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["ring_light"])

    # Bark sides (rows 7-13)
    for y in range(7, 14):
        # Slight taper at bottom
        if y < 11:
            left, right = 3, 13
        else:
            left, right = 4, 12

        for x in range(left, right):
            if x == left or x == right - 1:
                pixels[x, y] = hex_to_rgba(COLORS["bark_dark"])
            elif x < 7:
                pixels[x, y] = hex_to_rgba(COLORS["bark_light"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["bark_mid"])

    # Base
    for x in range(5, 11):
        pixels[x, 14] = hex_to_rgba(COLORS["bark_dark"])

    # Moss/lichen patches
    pixels[4, 8] = hex_to_rgba((0x4A, 0x7A, 0x3A))
    pixels[11, 10] = hex_to_rgba((0x4A, 0x7A, 0x3A))

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/props/forest"
    os.makedirs(output_dir, exist_ok=True)

    create_forest_tree(os.path.join(output_dir, "tree_forest.png"))
    create_log(os.path.join(output_dir, "log.png"))
    create_bush(os.path.join(output_dir, "bush.png"))
    create_stump(os.path.join(output_dir, "stump.png"))

    print(f"\nForest props complete!")
    print(f"Files created in: {output_dir}/")


if __name__ == "__main__":
    main()
