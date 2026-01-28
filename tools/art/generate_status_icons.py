#!/usr/bin/env python3
"""Generate status effect icons for Wilds of Cloverhollow (16x16)."""

from PIL import Image
import os

COLORS = {
    # Poison (purple/green)
    "poison_outline": (0x3A, 0x28, 0x4A),
    "poison_dark": (0x60, 0x40, 0x80),
    "poison": (0x90, 0x60, 0xB0),
    "poison_light": (0xB8, 0x88, 0xD0),
    "poison_bubble": (0x60, 0xC0, 0x60),
    # Sleep (blue/purple)
    "sleep_outline": (0x28, 0x28, 0x5A),
    "sleep_dark": (0x50, 0x50, 0x90),
    "sleep": (0x80, 0x80, 0xC0),
    "sleep_light": (0xB0, 0xB0, 0xE0),
    # Buff (gold/yellow - up arrow)
    "buff_outline": (0x4A, 0x40, 0x20),
    "buff_dark": (0x90, 0x70, 0x30),
    "buff": (0xD0, 0xA8, 0x40),
    "buff_light": (0xF0, 0xD0, 0x60),
    "buff_highlight": (0xF8, 0xE8, 0x90),
    # Debuff (red/dark - down arrow)
    "debuff_outline": (0x4A, 0x20, 0x20),
    "debuff_dark": (0x80, 0x30, 0x30),
    "debuff": (0xB8, 0x50, 0x50),
    "debuff_light": (0xD8, 0x70, 0x70),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_poison(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Skull shape (rows 3-11)
    # Row 3-4: top of skull
    for x in range(5, 11):
        pixels[x, 3] = hex_to_rgba(C["poison_outline"])
    for x in range(4, 12):
        pixels[x, 4] = hex_to_rgba(C["poison_outline"])
    for x in range(5, 11):
        pixels[x, 4] = hex_to_rgba(C["poison_light"])

    # Rows 5-7: upper skull with eye sockets
    for y in range(5, 8):
        pixels[3, y] = hex_to_rgba(C["poison_outline"])
        pixels[4, y] = hex_to_rgba(C["poison_light"])
        for x in range(5, 11):
            pixels[x, y] = hex_to_rgba(C["poison"])
        pixels[11, y] = hex_to_rgba(C["poison_dark"])
        pixels[12, y] = hex_to_rgba(C["poison_outline"])

    # Eye sockets (black holes)
    pixels[5, 6] = hex_to_rgba(C["poison_outline"])
    pixels[6, 6] = hex_to_rgba(C["poison_outline"])
    pixels[9, 6] = hex_to_rgba(C["poison_outline"])
    pixels[10, 6] = hex_to_rgba(C["poison_outline"])

    # Rows 8-9: cheek area
    for y in range(8, 10):
        pixels[4, y] = hex_to_rgba(C["poison_outline"])
        pixels[5, y] = hex_to_rgba(C["poison"])
        for x in range(6, 10):
            pixels[x, y] = hex_to_rgba(C["poison_dark"])
        pixels[10, y] = hex_to_rgba(C["poison"])
        pixels[11, y] = hex_to_rgba(C["poison_outline"])

    # Rows 10-11: jaw with teeth
    for x in range(5, 11):
        pixels[x, 10] = hex_to_rgba(C["poison_outline"])
    pixels[6, 11] = hex_to_rgba(C["poison_outline"])
    pixels[7, 11] = hex_to_rgba(C["poison_outline"])
    pixels[8, 11] = hex_to_rgba(C["poison_outline"])
    pixels[9, 11] = hex_to_rgba(C["poison_outline"])

    # Poison bubbles
    pixels[3, 12] = hex_to_rgba(C["poison_bubble"])
    pixels[12, 10] = hex_to_rgba(C["poison_bubble"])
    pixels[13, 12] = hex_to_rgba(C["poison_bubble"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sleep(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Three "Z" letters stacked diagonally (small, medium, large)
    # Small Z (rows 2-4, cols 10-12)
    for x in range(10, 13):
        pixels[x, 2] = hex_to_rgba(C["sleep_light"])
    pixels[12, 3] = hex_to_rgba(C["sleep_light"])
    pixels[11, 3] = hex_to_rgba(C["sleep_light"])
    for x in range(10, 13):
        pixels[x, 4] = hex_to_rgba(C["sleep_light"])

    # Medium Z (rows 5-8, cols 6-10)
    for x in range(6, 11):
        pixels[x, 5] = hex_to_rgba(C["sleep"])
    pixels[10, 6] = hex_to_rgba(C["sleep"])
    pixels[9, 6] = hex_to_rgba(C["sleep"])
    pixels[8, 7] = hex_to_rgba(C["sleep"])
    pixels[7, 7] = hex_to_rgba(C["sleep"])
    for x in range(6, 11):
        pixels[x, 8] = hex_to_rgba(C["sleep"])

    # Large Z (rows 9-13, cols 2-8)
    for x in range(2, 9):
        pixels[x, 9] = hex_to_rgba(C["sleep_dark"])
    pixels[8, 10] = hex_to_rgba(C["sleep_dark"])
    pixels[7, 10] = hex_to_rgba(C["sleep_dark"])
    pixels[6, 11] = hex_to_rgba(C["sleep_dark"])
    pixels[5, 11] = hex_to_rgba(C["sleep_dark"])
    pixels[4, 12] = hex_to_rgba(C["sleep_dark"])
    pixels[3, 12] = hex_to_rgba(C["sleep_dark"])
    for x in range(2, 9):
        pixels[x, 13] = hex_to_rgba(C["sleep_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_buff(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Up arrow (rows 2-13)
    # Arrow tip (rows 2-6)
    pixels[7, 2] = hex_to_rgba(C["buff_outline"])
    pixels[8, 2] = hex_to_rgba(C["buff_outline"])

    pixels[6, 3] = hex_to_rgba(C["buff_outline"])
    pixels[7, 3] = hex_to_rgba(C["buff_highlight"])
    pixels[8, 3] = hex_to_rgba(C["buff_light"])
    pixels[9, 3] = hex_to_rgba(C["buff_outline"])

    pixels[5, 4] = hex_to_rgba(C["buff_outline"])
    pixels[6, 4] = hex_to_rgba(C["buff_light"])
    pixels[7, 4] = hex_to_rgba(C["buff_light"])
    pixels[8, 4] = hex_to_rgba(C["buff"])
    pixels[9, 4] = hex_to_rgba(C["buff_dark"])
    pixels[10, 4] = hex_to_rgba(C["buff_outline"])

    pixels[4, 5] = hex_to_rgba(C["buff_outline"])
    pixels[5, 5] = hex_to_rgba(C["buff_light"])
    for x in range(6, 10):
        pixels[x, 5] = hex_to_rgba(C["buff"])
    pixels[10, 5] = hex_to_rgba(C["buff_dark"])
    pixels[11, 5] = hex_to_rgba(C["buff_outline"])

    pixels[3, 6] = hex_to_rgba(C["buff_outline"])
    pixels[4, 6] = hex_to_rgba(C["buff_light"])
    for x in range(5, 11):
        pixels[x, 6] = hex_to_rgba(C["buff"])
    pixels[11, 6] = hex_to_rgba(C["buff_dark"])
    pixels[12, 6] = hex_to_rgba(C["buff_outline"])

    # Arrow outline sides at row 7
    pixels[3, 7] = hex_to_rgba(C["buff_outline"])
    pixels[4, 7] = hex_to_rgba(C["buff_outline"])
    pixels[5, 7] = hex_to_rgba(C["buff_outline"])
    pixels[10, 7] = hex_to_rgba(C["buff_outline"])
    pixels[11, 7] = hex_to_rgba(C["buff_outline"])
    pixels[12, 7] = hex_to_rgba(C["buff_outline"])

    # Arrow shaft (rows 7-13)
    for y in range(7, 14):
        pixels[6, y] = hex_to_rgba(C["buff_outline"])
        pixels[7, y] = hex_to_rgba(C["buff_light"])
        pixels[8, y] = hex_to_rgba(C["buff"])
        pixels[9, y] = hex_to_rgba(C["buff_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_debuff(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Down arrow (rows 2-13)
    # Arrow shaft (rows 2-8)
    for y in range(2, 9):
        pixels[6, y] = hex_to_rgba(C["debuff_outline"])
        pixels[7, y] = hex_to_rgba(C["debuff_light"])
        pixels[8, y] = hex_to_rgba(C["debuff"])
        pixels[9, y] = hex_to_rgba(C["debuff_outline"])

    # Arrow outline sides at row 8
    pixels[3, 8] = hex_to_rgba(C["debuff_outline"])
    pixels[4, 8] = hex_to_rgba(C["debuff_outline"])
    pixels[5, 8] = hex_to_rgba(C["debuff_outline"])
    pixels[10, 8] = hex_to_rgba(C["debuff_outline"])
    pixels[11, 8] = hex_to_rgba(C["debuff_outline"])
    pixels[12, 8] = hex_to_rgba(C["debuff_outline"])

    # Arrow head (rows 9-13)
    pixels[3, 9] = hex_to_rgba(C["debuff_outline"])
    pixels[4, 9] = hex_to_rgba(C["debuff_light"])
    for x in range(5, 11):
        pixels[x, 9] = hex_to_rgba(C["debuff"])
    pixels[11, 9] = hex_to_rgba(C["debuff_dark"])
    pixels[12, 9] = hex_to_rgba(C["debuff_outline"])

    pixels[4, 10] = hex_to_rgba(C["debuff_outline"])
    pixels[5, 10] = hex_to_rgba(C["debuff_light"])
    for x in range(6, 10):
        pixels[x, 10] = hex_to_rgba(C["debuff"])
    pixels[10, 10] = hex_to_rgba(C["debuff_dark"])
    pixels[11, 10] = hex_to_rgba(C["debuff_outline"])

    pixels[5, 11] = hex_to_rgba(C["debuff_outline"])
    pixels[6, 11] = hex_to_rgba(C["debuff_light"])
    pixels[7, 11] = hex_to_rgba(C["debuff"])
    pixels[8, 11] = hex_to_rgba(C["debuff"])
    pixels[9, 11] = hex_to_rgba(C["debuff_dark"])
    pixels[10, 11] = hex_to_rgba(C["debuff_outline"])

    pixels[6, 12] = hex_to_rgba(C["debuff_outline"])
    pixels[7, 12] = hex_to_rgba(C["debuff_light"])
    pixels[8, 12] = hex_to_rgba(C["debuff"])
    pixels[9, 12] = hex_to_rgba(C["debuff_outline"])

    pixels[7, 13] = hex_to_rgba(C["debuff_outline"])
    pixels[8, 13] = hex_to_rgba(C["debuff_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/ui/status"
    os.makedirs(output_dir, exist_ok=True)

    create_poison(os.path.join(output_dir, "icon_poison.png"))
    create_sleep(os.path.join(output_dir, "icon_sleep.png"))
    create_buff(os.path.join(output_dir, "icon_buff.png"))
    create_debuff(os.path.join(output_dir, "icon_debuff.png"))

    print("\nStatus effect icons generation complete!")


if __name__ == "__main__":
    main()
