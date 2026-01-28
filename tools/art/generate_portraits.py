#!/usr/bin/env python3
"""Generate party battle portraits for Wilds of Cloverhollow."""

from PIL import Image
import os

COLORS = {
    "outline": (0x3D, 0x32, 0x28),
    "skin_light": (0xF5, 0xDC, 0xC4),
    "skin": (0xE8, 0xC8, 0xA8),
    "skin_shadow": (0xD4, 0xA8, 0x88),
    "hair_light": (0x8F, 0x6B, 0x4A),
    "hair": (0x6B, 0x4A, 0x32),
    "hair_dark": (0x4A, 0x32, 0x28),
    "eye_white": (0xF8, 0xF8, 0xF8),
    "eye": (0x4A, 0xA8, 0x4A),
    "mouth": (0xC4, 0x78, 0x78),
    "clothes_green": (0x4A, 0xA8, 0x4A),
    "clothes_green_dark": (0x2F, 0x6B, 0x2F),
    "clothes_blue": (0x5A, 0xA8, 0xD7),
    "clothes_blue_dark": (0x3A, 0x78, 0xA8),
    "clothes_red": (0xE8, 0x64, 0x64),
    "clothes_red_dark": (0xC0, 0x48, 0x48),
    "fur_orange": (0xE8, 0xA8, 0x64),
    "fur_orange_light": (0xF5, 0xC4, 0x8A),
    "fur_orange_dark": (0xC0, 0x78, 0x48),
    "white": (0xFF, 0xFF, 0xFF),
    "pink": (0xF0, 0xA0, 0xB0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_fae_portrait(output_path):
    """Create portrait_fae.png (32x32) - main character with green outfit."""
    width, height = 32, 32
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Rows 2-8: Hair top
    for y in range(2, 9):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["hair"])
    for y in range(3, 8):
        for x in range(11, 21):
            pixels[x, y] = hex_to_rgba(C["hair_light"])

    # Rows 8-12: Forehead
    for y in range(8, 13):
        for x in range(9, 23):
            pixels[x, y] = hex_to_rgba(C["skin"])
    for y in range(9, 12):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["skin_light"])

    # Rows 13-16: Eyes region
    for y in range(13, 17):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[12, 14] = hex_to_rgba(C["eye_white"])
    pixels[13, 14] = hex_to_rgba(C["eye_white"])
    pixels[13, 15] = hex_to_rgba(C["eye"])
    pixels[18, 14] = hex_to_rgba(C["eye_white"])
    pixels[19, 14] = hex_to_rgba(C["eye_white"])
    pixels[18, 15] = hex_to_rgba(C["eye"])

    # Rows 17-20: Nose and mouth
    for y in range(17, 21):
        for x in range(9, 23):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[15, 18] = hex_to_rgba(C["skin_shadow"])
    pixels[16, 18] = hex_to_rgba(C["skin_shadow"])
    pixels[14, 20] = hex_to_rgba(C["mouth"])
    pixels[15, 20] = hex_to_rgba(C["mouth"])
    pixels[16, 20] = hex_to_rgba(C["mouth"])
    pixels[17, 20] = hex_to_rgba(C["mouth"])

    # Rows 21-24: Chin
    for y in range(21, 25):
        width_offset = y - 21
        for x in range(10 + width_offset, 22 - width_offset):
            pixels[x, y] = hex_to_rgba(C["skin"])

    # Rows 25-30: Clothes (green)
    for y in range(25, 31):
        for x in range(6, 26):
            pixels[x, y] = hex_to_rgba(C["clothes_green"])
    for y in range(26, 30):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["clothes_green_dark"])

    # Side hair
    for y in range(8, 18):
        pixels[7, y] = hex_to_rgba(C["hair_dark"])
        pixels[8, y] = hex_to_rgba(C["hair"])
        pixels[23, y] = hex_to_rgba(C["hair"])
        pixels[24, y] = hex_to_rgba(C["hair_dark"])

    # Outline
    for x in range(9, 23):
        pixels[x, 1] = hex_to_rgba(C["outline"])
    for y in range(2, 25):
        pixels[6, y] = hex_to_rgba(C["outline"])
        pixels[25, y] = hex_to_rgba(C["outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sue_portrait(output_path):
    """Create portrait_sue.png (32x32) - party member with blue outfit."""
    width, height = 32, 32
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Rows 2-10: Hair (longer style)
    for y in range(2, 11):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["hair_dark"])
    for y in range(3, 10):
        for x in range(9, 23):
            pixels[x, y] = hex_to_rgba(C["hair"])

    # Rows 10-14: Forehead
    for y in range(10, 15):
        for x in range(9, 23):
            pixels[x, y] = hex_to_rgba(C["skin"])

    # Rows 14-17: Eyes
    for y in range(14, 18):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[12, 15] = hex_to_rgba(C["eye_white"])
    pixels[13, 15] = hex_to_rgba(C["eye_white"])
    pixels[12, 16] = hex_to_rgba(C["clothes_blue"])
    pixels[19, 15] = hex_to_rgba(C["eye_white"])
    pixels[20, 15] = hex_to_rgba(C["eye_white"])
    pixels[19, 16] = hex_to_rgba(C["clothes_blue"])

    # Rows 18-22: Nose, mouth, chin
    for y in range(18, 23):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[15, 19] = hex_to_rgba(C["skin_shadow"])
    pixels[16, 19] = hex_to_rgba(C["skin_shadow"])
    pixels[14, 21] = hex_to_rgba(C["pink"])
    pixels[15, 21] = hex_to_rgba(C["pink"])
    pixels[16, 21] = hex_to_rgba(C["pink"])
    pixels[17, 21] = hex_to_rgba(C["pink"])

    # Rows 23-30: Clothes (blue)
    for y in range(23, 31):
        for x in range(6, 26):
            pixels[x, y] = hex_to_rgba(C["clothes_blue"])
    for y in range(24, 30):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["clothes_blue_dark"])

    # Side hair
    for y in range(10, 22):
        pixels[6, y] = hex_to_rgba(C["hair_dark"])
        pixels[7, y] = hex_to_rgba(C["hair"])
        pixels[24, y] = hex_to_rgba(C["hair"])
        pixels[25, y] = hex_to_rgba(C["hair_dark"])

    # Outline
    for x in range(7, 25):
        pixels[x, 1] = hex_to_rgba(C["outline"])
    for y in range(2, 24):
        pixels[5, y] = hex_to_rgba(C["outline"])
        pixels[26, y] = hex_to_rgba(C["outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_jordan_portrait(output_path):
    """Create portrait_jordan.png (32x32) - party member with red outfit."""
    width, height = 32, 32
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Rows 3-9: Hair (short spiky)
    for y in range(3, 10):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["hair_dark"])
    for x in range(12, 14):
        pixels[x, 2] = hex_to_rgba(C["hair_dark"])
    for x in range(17, 19):
        pixels[x, 2] = hex_to_rgba(C["hair_dark"])

    # Rows 9-13: Forehead
    for y in range(9, 14):
        for x in range(9, 23):
            pixels[x, y] = hex_to_rgba(C["skin"])

    # Rows 13-17: Eyes
    for y in range(13, 18):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[11, 14] = hex_to_rgba(C["eye_white"])
    pixels[12, 14] = hex_to_rgba(C["eye_white"])
    pixels[11, 15] = hex_to_rgba(C["hair_dark"])
    pixels[19, 14] = hex_to_rgba(C["eye_white"])
    pixels[20, 14] = hex_to_rgba(C["eye_white"])
    pixels[20, 15] = hex_to_rgba(C["hair_dark"])

    # Rows 18-23: Nose, mouth, chin
    for y in range(18, 24):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["skin"])
    pixels[15, 19] = hex_to_rgba(C["skin_shadow"])
    pixels[16, 19] = hex_to_rgba(C["skin_shadow"])
    pixels[14, 21] = hex_to_rgba(C["mouth"])
    pixels[15, 21] = hex_to_rgba(C["mouth"])
    pixels[16, 21] = hex_to_rgba(C["mouth"])

    # Rows 24-30: Clothes (red)
    for y in range(24, 31):
        for x in range(6, 26):
            pixels[x, y] = hex_to_rgba(C["clothes_red"])
    for y in range(25, 30):
        for x in range(8, 24):
            pixels[x, y] = hex_to_rgba(C["clothes_red_dark"])

    # Outline
    for x in range(9, 23):
        pixels[x, 2] = hex_to_rgba(C["outline"])
    for y in range(3, 24):
        pixels[7, y] = hex_to_rgba(C["outline"])
        pixels[24, y] = hex_to_rgba(C["outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_maddie_portrait(output_path):
    """Create portrait_maddie.png (32x32) - pet cat portrait."""
    width, height = 32, 32
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()
    C = COLORS

    # Rows 4-10: Ears
    for y in range(4, 8):
        pixels[9, y] = hex_to_rgba(C["fur_orange"])
        pixels[10, y] = hex_to_rgba(C["fur_orange"])
        pixels[21, y] = hex_to_rgba(C["fur_orange"])
        pixels[22, y] = hex_to_rgba(C["fur_orange"])
    pixels[10, 5] = hex_to_rgba(C["pink"])
    pixels[21, 5] = hex_to_rgba(C["pink"])

    # Rows 8-18: Head (round)
    for y in range(8, 19):
        dist_from_center = abs(y - 13)
        half_width = 8 - dist_from_center // 2
        for x in range(16 - half_width, 16 + half_width):
            pixels[x, y] = hex_to_rgba(C["fur_orange"])

    # Light fur highlight
    for y in range(9, 14):
        for x in range(12, 20):
            pixels[x, y] = hex_to_rgba(C["fur_orange_light"])

    # Rows 12-15: Eyes
    pixels[12, 13] = hex_to_rgba(C["eye_white"])
    pixels[13, 13] = hex_to_rgba(C["eye_white"])
    pixels[12, 14] = hex_to_rgba(C["eye"])
    pixels[19, 13] = hex_to_rgba(C["eye_white"])
    pixels[20, 13] = hex_to_rgba(C["eye_white"])
    pixels[19, 14] = hex_to_rgba(C["eye"])

    # Nose and mouth
    pixels[15, 15] = hex_to_rgba(C["pink"])
    pixels[16, 15] = hex_to_rgba(C["pink"])
    pixels[14, 16] = hex_to_rgba(C["fur_orange_dark"])
    pixels[17, 16] = hex_to_rgba(C["fur_orange_dark"])

    # Whiskers
    for dx in range(-4, 0):
        pixels[12 + dx, 14] = hex_to_rgba(C["white"])
    for dx in range(1, 5):
        pixels[19 + dx, 14] = hex_to_rgba(C["white"])

    # Rows 19-26: Body
    for y in range(19, 27):
        for x in range(10, 22):
            pixels[x, y] = hex_to_rgba(C["fur_orange"])
    for y in range(20, 26):
        for x in range(12, 20):
            pixels[x, y] = hex_to_rgba(C["fur_orange_light"])

    # Outline
    for x in range(8, 24):
        pixels[x, 7] = hex_to_rgba(C["outline"])
    for y in range(8, 20):
        pixels[7, y] = hex_to_rgba(C["outline"])
        pixels[24, y] = hex_to_rgba(C["outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/portraits"
    os.makedirs(output_dir, exist_ok=True)

    create_fae_portrait(os.path.join(output_dir, "portrait_fae.png"))
    create_sue_portrait(os.path.join(output_dir, "portrait_sue.png"))
    create_jordan_portrait(os.path.join(output_dir, "portrait_jordan.png"))
    create_maddie_portrait(os.path.join(output_dir, "portrait_maddie.png"))

    print("\nParty portraits generation complete!")


if __name__ == "__main__":
    main()
