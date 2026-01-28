#!/usr/bin/env python3
"""Generate inventory item icons for Wilds of Cloverhollow.

Style guide requirements:
- Colored outlines (dark variant of main color) - NEVER pure black
- 2-3 shade bands per material
- Light from upper-left, dark on lower-right
- Clean geometric shapes
"""

from PIL import Image
import os

COLORS = {
    # General
    "outline_brown": (0x3D, 0x32, 0x28),  # Dark brown for wood/neutral
    "cork_light": (0xD4, 0xA5, 0x5A),
    "cork": (0xB5, 0x8A, 0x4D),
    "cork_dark": (0x8A, 0x6A, 0x3D),
    # Red potion (health)
    "red_outline": (0x5A, 0x28, 0x28),  # Dark maroon outline
    "red_dark": (0xA8, 0x40, 0x40),
    "red": (0xE8, 0x64, 0x64),
    "red_light": (0xF0, 0x90, 0x90),
    "red_highlight": (0xF8, 0xB8, 0xB8),
    # Blue potion (mana/ether)
    "blue_outline": (0x28, 0x3A, 0x5A),  # Dark teal-blue outline
    "blue_dark": (0x40, 0x70, 0xA8),
    "blue": (0x5A, 0xA8, 0xD7),
    "blue_light": (0x8F, 0xD0, 0xF0),
    "blue_highlight": (0xB8, 0xE8, 0xF8),
    # Green potion (antidote)
    "green_outline": (0x28, 0x4A, 0x28),  # Dark forest green outline
    "green_dark": (0x40, 0x88, 0x40),
    "green": (0x5A, 0xB8, 0x5A),
    "green_light": (0x8F, 0xD8, 0x8F),
    "green_highlight": (0xB8, 0xF0, 0xB8),
    # Bomb (charcoal/gray)
    "gray_outline": (0x2A, 0x2A, 0x2A),  # Dark charcoal outline
    "gray_dark": (0x3A, 0x3A, 0x3A),
    "gray": (0x50, 0x50, 0x50),
    "gray_light": (0x70, 0x70, 0x70),
    "fuse_orange": (0xE8, 0x90, 0x40),
    "fuse_yellow": (0xF8, 0xD8, 0x40),
    # Key (gold)
    "gold_outline": (0x5A, 0x48, 0x20),  # Dark bronze outline
    "gold_dark": (0xA8, 0x80, 0x30),
    "gold": (0xE8, 0xC0, 0x40),
    "gold_light": (0xF0, 0xD8, 0x70),
    "gold_highlight": (0xF8, 0xE8, 0xA0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_potion(output_path):
    """Create icon_potion.png (16x16) - red health potion bottle."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 2: Cork top
    for x in range(6, 10):
        pixels[x, 2] = hex_to_rgba(C["cork"])
    pixels[6, 2] = hex_to_rgba(C["cork_light"])

    # Row 3: Cork middle
    for x in range(6, 10):
        pixels[x, 3] = hex_to_rgba(C["cork"])
    pixels[6, 3] = hex_to_rgba(C["cork_light"])
    pixels[9, 3] = hex_to_rgba(C["cork_dark"])

    # Row 4: Cork bottom / neck top
    for x in range(5, 11):
        pixels[x, 4] = hex_to_rgba(C["red_outline"])
    for x in range(6, 10):
        pixels[x, 4] = hex_to_rgba(C["cork_dark"])

    # Row 5: Bottle neck
    pixels[5, 5] = hex_to_rgba(C["red_outline"])
    pixels[6, 5] = hex_to_rgba(C["red_light"])
    for x in range(7, 10):
        pixels[x, 5] = hex_to_rgba(C["red"])
    pixels[10, 5] = hex_to_rgba(C["red_outline"])

    # Rows 6-12: Bottle body
    for y in range(6, 13):
        # Left outline
        pixels[3, y] = hex_to_rgba(C["red_outline"])
        # Left highlight band
        pixels[4, y] = hex_to_rgba(C["red_light"])
        # Main body
        for x in range(5, 11):
            pixels[x, y] = hex_to_rgba(C["red"])
        # Right shade band
        pixels[11, y] = hex_to_rgba(C["red_dark"])
        # Right outline
        pixels[12, y] = hex_to_rgba(C["red_outline"])

    # Add highlight sparkle (upper left of body)
    pixels[5, 7] = hex_to_rgba(C["red_highlight"])
    pixels[4, 8] = hex_to_rgba(C["red_highlight"])

    # Row 13: Bottom outline
    for x in range(4, 12):
        pixels[x, 13] = hex_to_rgba(C["red_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_ether(output_path):
    """Create icon_ether.png (16x16) - blue mana potion bottle."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 2: Cork top
    for x in range(6, 10):
        pixels[x, 2] = hex_to_rgba(C["cork"])
    pixels[6, 2] = hex_to_rgba(C["cork_light"])

    # Row 3: Cork middle
    for x in range(6, 10):
        pixels[x, 3] = hex_to_rgba(C["cork"])
    pixels[6, 3] = hex_to_rgba(C["cork_light"])
    pixels[9, 3] = hex_to_rgba(C["cork_dark"])

    # Row 4: Cork bottom / neck top
    for x in range(5, 11):
        pixels[x, 4] = hex_to_rgba(C["blue_outline"])
    for x in range(6, 10):
        pixels[x, 4] = hex_to_rgba(C["cork_dark"])

    # Row 5: Bottle neck
    pixels[5, 5] = hex_to_rgba(C["blue_outline"])
    pixels[6, 5] = hex_to_rgba(C["blue_light"])
    for x in range(7, 10):
        pixels[x, 5] = hex_to_rgba(C["blue"])
    pixels[10, 5] = hex_to_rgba(C["blue_outline"])

    # Rows 6-12: Bottle body
    for y in range(6, 13):
        pixels[3, y] = hex_to_rgba(C["blue_outline"])
        pixels[4, y] = hex_to_rgba(C["blue_light"])
        for x in range(5, 11):
            pixels[x, y] = hex_to_rgba(C["blue"])
        pixels[11, y] = hex_to_rgba(C["blue_dark"])
        pixels[12, y] = hex_to_rgba(C["blue_outline"])

    # Highlight sparkle
    pixels[5, 7] = hex_to_rgba(C["blue_highlight"])
    pixels[4, 8] = hex_to_rgba(C["blue_highlight"])

    # Row 13: Bottom outline
    for x in range(4, 12):
        pixels[x, 13] = hex_to_rgba(C["blue_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_antidote(output_path):
    """Create icon_antidote.png (16x16) - green cure potion bottle."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 2: Cork top
    for x in range(6, 10):
        pixels[x, 2] = hex_to_rgba(C["cork"])
    pixels[6, 2] = hex_to_rgba(C["cork_light"])

    # Row 3: Cork middle
    for x in range(6, 10):
        pixels[x, 3] = hex_to_rgba(C["cork"])
    pixels[6, 3] = hex_to_rgba(C["cork_light"])
    pixels[9, 3] = hex_to_rgba(C["cork_dark"])

    # Row 4: Cork bottom / neck top
    for x in range(5, 11):
        pixels[x, 4] = hex_to_rgba(C["green_outline"])
    for x in range(6, 10):
        pixels[x, 4] = hex_to_rgba(C["cork_dark"])

    # Row 5: Bottle neck
    pixels[5, 5] = hex_to_rgba(C["green_outline"])
    pixels[6, 5] = hex_to_rgba(C["green_light"])
    for x in range(7, 10):
        pixels[x, 5] = hex_to_rgba(C["green"])
    pixels[10, 5] = hex_to_rgba(C["green_outline"])

    # Rows 6-12: Bottle body
    for y in range(6, 13):
        pixels[3, y] = hex_to_rgba(C["green_outline"])
        pixels[4, y] = hex_to_rgba(C["green_light"])
        for x in range(5, 11):
            pixels[x, y] = hex_to_rgba(C["green"])
        pixels[11, y] = hex_to_rgba(C["green_dark"])
        pixels[12, y] = hex_to_rgba(C["green_outline"])

    # Highlight sparkle
    pixels[5, 7] = hex_to_rgba(C["green_highlight"])
    pixels[4, 8] = hex_to_rgba(C["green_highlight"])

    # Row 13: Bottom outline
    for x in range(4, 12):
        pixels[x, 13] = hex_to_rgba(C["green_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_bomb(output_path):
    """Create icon_bomb.png (16x16) - throwable bomb."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 1-2: Fuse spark
    pixels[8, 1] = hex_to_rgba(C["fuse_yellow"])
    pixels[7, 2] = hex_to_rgba(C["fuse_orange"])
    pixels[8, 2] = hex_to_rgba(C["fuse_yellow"])
    pixels[9, 2] = hex_to_rgba(C["fuse_orange"])

    # Row 3-4: Fuse
    pixels[8, 3] = hex_to_rgba(C["cork"])
    pixels[8, 4] = hex_to_rgba(C["cork_dark"])

    # Rows 5-13: Bomb body (circular)
    # Row 5: top of circle
    for x in range(6, 10):
        pixels[x, 5] = hex_to_rgba(C["gray_outline"])

    # Row 6
    pixels[5, 6] = hex_to_rgba(C["gray_outline"])
    pixels[6, 6] = hex_to_rgba(C["gray_light"])
    for x in range(7, 10):
        pixels[x, 6] = hex_to_rgba(C["gray"])
    pixels[10, 6] = hex_to_rgba(C["gray_outline"])

    # Rows 7-10: main body
    for y in range(7, 11):
        pixels[4, y] = hex_to_rgba(C["gray_outline"])
        pixels[5, y] = hex_to_rgba(C["gray_light"])
        for x in range(6, 10):
            pixels[x, y] = hex_to_rgba(C["gray"])
        pixels[10, y] = hex_to_rgba(C["gray_dark"])
        pixels[11, y] = hex_to_rgba(C["gray_outline"])

    # Row 11
    pixels[5, 11] = hex_to_rgba(C["gray_outline"])
    pixels[6, 11] = hex_to_rgba(C["gray"])
    for x in range(7, 10):
        pixels[x, 11] = hex_to_rgba(C["gray_dark"])
    pixels[10, 11] = hex_to_rgba(C["gray_outline"])

    # Row 12: bottom of circle
    for x in range(6, 10):
        pixels[x, 12] = hex_to_rgba(C["gray_outline"])

    # Highlight on upper-left
    pixels[5, 7] = hex_to_rgba(C["gray_light"])
    pixels[6, 7] = hex_to_rgba(C["gray_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_key_item(output_path):
    """Create icon_key.png (16x16) - quest key item."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Key bow (circular head) - rows 3-8
    # Row 3
    for x in range(4, 8):
        pixels[x, 3] = hex_to_rgba(C["gold_outline"])

    # Row 4
    pixels[3, 4] = hex_to_rgba(C["gold_outline"])
    pixels[4, 4] = hex_to_rgba(C["gold_light"])
    for x in range(5, 7):
        pixels[x, 4] = hex_to_rgba(C["gold"])
    pixels[7, 4] = hex_to_rgba(C["gold_dark"])
    pixels[8, 4] = hex_to_rgba(C["gold_outline"])

    # Row 5-6: with center hole
    for y in range(5, 7):
        pixels[3, y] = hex_to_rgba(C["gold_outline"])
        pixels[4, y] = hex_to_rgba(C["gold_light"])
        pixels[5, y] = hex_to_rgba(C["gold_outline"])  # hole
        pixels[6, y] = hex_to_rgba(C["gold_outline"])  # hole
        pixels[7, y] = hex_to_rgba(C["gold_dark"])
        pixels[8, y] = hex_to_rgba(C["gold_outline"])

    # Row 7
    pixels[3, 7] = hex_to_rgba(C["gold_outline"])
    pixels[4, 7] = hex_to_rgba(C["gold"])
    for x in range(5, 7):
        pixels[x, 7] = hex_to_rgba(C["gold"])
    pixels[7, 7] = hex_to_rgba(C["gold_dark"])
    pixels[8, 7] = hex_to_rgba(C["gold_outline"])

    # Row 8: bottom of bow, start of shaft
    for x in range(4, 8):
        pixels[x, 8] = hex_to_rgba(C["gold_outline"])

    # Key shaft - rows 8-12
    for y in range(8, 13):
        pixels[8, y] = hex_to_rgba(C["gold_outline"])
        pixels[9, y] = hex_to_rgba(C["gold_light"])
        pixels[10, y] = hex_to_rgba(C["gold"])
        pixels[11, y] = hex_to_rgba(C["gold_dark"])
        pixels[12, y] = hex_to_rgba(C["gold_outline"])

    # Key teeth - rows 10-12
    pixels[13, 10] = hex_to_rgba(C["gold_outline"])
    pixels[13, 11] = hex_to_rgba(C["gold"])
    pixels[13, 12] = hex_to_rgba(C["gold_outline"])

    pixels[14, 11] = hex_to_rgba(C["gold_outline"])
    pixels[14, 12] = hex_to_rgba(C["gold_outline"])

    # Bottom of shaft
    for x in range(9, 14):
        pixels[x, 13] = hex_to_rgba(C["gold_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/items"
    os.makedirs(output_dir, exist_ok=True)

    create_potion(os.path.join(output_dir, "icon_potion.png"))
    create_ether(os.path.join(output_dir, "icon_ether.png"))
    create_antidote(os.path.join(output_dir, "icon_antidote.png"))
    create_bomb(os.path.join(output_dir, "icon_bomb.png"))
    create_key_item(os.path.join(output_dir, "icon_key.png"))

    print("\nItem icons generation complete!")


if __name__ == "__main__":
    main()
