#!/usr/bin/env python3
"""Generate equipment icons for Wilds of Cloverhollow (16x16)."""

from PIL import Image
import os

COLORS = {
    # Metal (sword/armor)
    "metal_outline": (0x3A, 0x45, 0x50),
    "metal_dark": (0x6A, 0x7A, 0x8A),
    "metal": (0x9A, 0xAA, 0xBA),
    "metal_light": (0xC0, 0xD0, 0xE0),
    "metal_highlight": (0xE8, 0xF0, 0xF8),
    # Wood (sword handle)
    "wood_outline": (0x3D, 0x32, 0x28),
    "wood_dark": (0x6A, 0x50, 0x38),
    "wood": (0x8A, 0x6A, 0x4D),
    "wood_light": (0xB5, 0x8A, 0x5A),
    # Shield (blue/silver)
    "shield_outline": (0x28, 0x3A, 0x5A),
    "shield_dark": (0x40, 0x60, 0x90),
    "shield": (0x60, 0x88, 0xB8),
    "shield_light": (0x90, 0xB8, 0xD8),
    # Leather (armor)
    "leather_outline": (0x3D, 0x28, 0x20),
    "leather_dark": (0x6A, 0x48, 0x38),
    "leather": (0x8A, 0x60, 0x48),
    "leather_light": (0xB0, 0x80, 0x60),
    # Gold (accessory)
    "gold_outline": (0x5A, 0x48, 0x20),
    "gold_dark": (0xA8, 0x80, 0x30),
    "gold": (0xE8, 0xC0, 0x40),
    "gold_light": (0xF0, 0xD8, 0x70),
    "gold_highlight": (0xF8, 0xE8, 0xA0),
    # Gem (accessory)
    "gem_outline": (0x5A, 0x20, 0x40),
    "gem_dark": (0xA0, 0x40, 0x70),
    "gem": (0xE0, 0x60, 0xA0),
    "gem_light": (0xF0, 0x90, 0xC0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_sword(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Blade tip (rows 1-3) - diagonal sword pointing up-right
    pixels[11, 1] = hex_to_rgba(C["metal_outline"])
    pixels[10, 2] = hex_to_rgba(C["metal_outline"])
    pixels[11, 2] = hex_to_rgba(C["metal_highlight"])
    pixels[12, 2] = hex_to_rgba(C["metal_outline"])

    # Row 3-6: upper blade
    for i in range(4):
        y = 3 + i
        x = 9 - i
        pixels[x, y] = hex_to_rgba(C["metal_outline"])
        pixels[x + 1, y] = hex_to_rgba(C["metal_light"])
        pixels[x + 2, y] = hex_to_rgba(C["metal"])
        pixels[x + 3, y] = hex_to_rgba(C["metal_dark"])
        pixels[x + 4, y] = hex_to_rgba(C["metal_outline"])

    # Row 7-8: blade near guard
    for i in range(2):
        y = 7 + i
        x = 5 - i
        pixels[x, y] = hex_to_rgba(C["metal_outline"])
        pixels[x + 1, y] = hex_to_rgba(C["metal_light"])
        pixels[x + 2, y] = hex_to_rgba(C["metal"])
        pixels[x + 3, y] = hex_to_rgba(C["metal_dark"])
        pixels[x + 4, y] = hex_to_rgba(C["metal_outline"])

    # Row 9: crossguard
    for x in range(2, 8):
        pixels[x, 9] = hex_to_rgba(C["gold"])
    pixels[2, 9] = hex_to_rgba(C["gold_outline"])
    pixels[7, 9] = hex_to_rgba(C["gold_outline"])

    # Rows 10-13: handle
    for y in range(10, 14):
        pixels[3, y] = hex_to_rgba(C["wood_outline"])
        pixels[4, y] = hex_to_rgba(C["wood_light"])
        pixels[5, y] = hex_to_rgba(C["wood"])
        pixels[6, y] = hex_to_rgba(C["wood_dark"])
        pixels[7, y] = hex_to_rgba(C["wood_outline"])

    # Row 14: pommel
    for x in range(4, 7):
        pixels[x, 14] = hex_to_rgba(C["gold"])
    pixels[4, 14] = hex_to_rgba(C["gold_outline"])
    pixels[6, 14] = hex_to_rgba(C["gold_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_shield(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 2: top curve
    for x in range(5, 11):
        pixels[x, 2] = hex_to_rgba(C["shield_outline"])

    # Rows 3-10: shield body (tapers to point)
    widths = [8, 10, 10, 10, 8, 6, 4, 2]
    for i, w in enumerate(widths):
        y = 3 + i
        start = 8 - w // 2
        end = start + w

        pixels[start, y] = hex_to_rgba(C["shield_outline"])
        pixels[start + 1, y] = hex_to_rgba(C["shield_light"])
        for x in range(start + 2, end - 2):
            pixels[x, y] = hex_to_rgba(C["shield"])
        if end - 2 > start + 2:
            pixels[end - 2, y] = hex_to_rgba(C["shield_dark"])
        pixels[end - 1, y] = hex_to_rgba(C["shield_outline"])

    # Row 11: bottom point
    pixels[7, 11] = hex_to_rgba(C["shield_outline"])
    pixels[8, 11] = hex_to_rgba(C["shield_outline"])

    # Metal rim highlight (inner vertical line)
    for y in range(4, 9):
        pixels[8, y] = hex_to_rgba(C["metal_light"])

    # Shield emblem (small cross)
    pixels[7, 5] = hex_to_rgba(C["gold"])
    pixels[8, 5] = hex_to_rgba(C["gold"])
    pixels[9, 5] = hex_to_rgba(C["gold"])
    pixels[8, 4] = hex_to_rgba(C["gold"])
    pixels[8, 6] = hex_to_rgba(C["gold"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_armor(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Row 2: collar/neck
    for x in range(6, 10):
        pixels[x, 2] = hex_to_rgba(C["leather_outline"])

    # Row 3: upper shoulder line
    for x in range(4, 12):
        pixels[x, 3] = hex_to_rgba(C["leather_outline"])

    # Rows 4-7: shoulder and chest
    for y in range(4, 8):
        pixels[3, y] = hex_to_rgba(C["leather_outline"])
        pixels[4, y] = hex_to_rgba(C["leather_light"])
        for x in range(5, 11):
            pixels[x, y] = hex_to_rgba(C["leather"])
        pixels[11, y] = hex_to_rgba(C["leather_dark"])
        pixels[12, y] = hex_to_rgba(C["leather_outline"])

    # Rows 8-11: lower body
    for y in range(8, 12):
        pixels[4, y] = hex_to_rgba(C["leather_outline"])
        pixels[5, y] = hex_to_rgba(C["leather_light"])
        for x in range(6, 10):
            pixels[x, y] = hex_to_rgba(C["leather"])
        pixels[10, y] = hex_to_rgba(C["leather_dark"])
        pixels[11, y] = hex_to_rgba(C["leather_outline"])

    # Row 12: bottom edge
    for x in range(5, 11):
        pixels[x, 12] = hex_to_rgba(C["leather_outline"])

    # Metal buckle/clasp in center
    pixels[7, 6] = hex_to_rgba(C["metal"])
    pixels[8, 6] = hex_to_rgba(C["metal"])
    pixels[7, 7] = hex_to_rgba(C["metal_dark"])
    pixels[8, 7] = hex_to_rgba(C["metal_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_accessory(output_path):
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Ring shape (rows 4-11)
    # Row 4-5: top of ring
    for x in range(6, 10):
        pixels[x, 4] = hex_to_rgba(C["gold_outline"])
        pixels[x, 5] = hex_to_rgba(C["gold_light"])

    # Rows 6-9: ring sides
    for y in range(6, 10):
        pixels[5, y] = hex_to_rgba(C["gold_outline"])
        pixels[6, y] = hex_to_rgba(C["gold_light"])
        pixels[9, y] = hex_to_rgba(C["gold_dark"])
        pixels[10, y] = hex_to_rgba(C["gold_outline"])

    # Row 10-11: bottom of ring
    for x in range(6, 10):
        pixels[x, 10] = hex_to_rgba(C["gold_dark"])
        pixels[x, 11] = hex_to_rgba(C["gold_outline"])

    # Gem setting (top center, rows 2-5)
    pixels[7, 2] = hex_to_rgba(C["gem_outline"])
    pixels[8, 2] = hex_to_rgba(C["gem_outline"])

    pixels[6, 3] = hex_to_rgba(C["gem_outline"])
    pixels[7, 3] = hex_to_rgba(C["gem_light"])
    pixels[8, 3] = hex_to_rgba(C["gem"])
    pixels[9, 3] = hex_to_rgba(C["gem_outline"])

    pixels[6, 4] = hex_to_rgba(C["gem_outline"])
    pixels[7, 4] = hex_to_rgba(C["gem"])
    pixels[8, 4] = hex_to_rgba(C["gem_dark"])
    pixels[9, 4] = hex_to_rgba(C["gem_outline"])

    pixels[7, 5] = hex_to_rgba(C["gem_outline"])
    pixels[8, 5] = hex_to_rgba(C["gem_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/items"
    os.makedirs(output_dir, exist_ok=True)

    create_sword(os.path.join(output_dir, "icon_sword.png"))
    create_shield(os.path.join(output_dir, "icon_shield.png"))
    create_armor(os.path.join(output_dir, "icon_armor.png"))
    create_accessory(os.path.join(output_dir, "icon_accessory.png"))

    print("\nEquipment icons generation complete!")


if __name__ == "__main__":
    main()
