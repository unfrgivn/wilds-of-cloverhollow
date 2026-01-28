#!/usr/bin/env python3
"""
Generate boss sprites for M213.

Bosses:
- Forest Guardian: Large tree spirit boss (48x48), green/brown palette
- Chaos Minion: Attack animations for existing purple blob enemy (24x24)
"""

from PIL import Image
import os

COLORS = {
    # Forest Guardian - nature spirit
    "guardian_bark_dark": (0x3D, 0x2E, 0x1A),
    "guardian_bark": (0x5A, 0x45, 0x28),
    "guardian_bark_light": (0x7A, 0x62, 0x3A),
    "guardian_leaves_dark": (0x2A, 0x5A, 0x2A),
    "guardian_leaves": (0x4A, 0x8A, 0x4A),
    "guardian_leaves_light": (0x6A, 0xAA, 0x5A),
    "guardian_glow": (0x8A, 0xDA, 0x6A),
    "guardian_eye": (0xDD, 0xFF, 0xAA),
    # Chaos Minion - dark purple blob
    "minion_dark": (0x2A, 0x1A, 0x3A),
    "minion_body": (0x5A, 0x3A, 0x7A),
    "minion_light": (0x8A, 0x5A, 0xAA),
    "minion_glow": (0xDA, 0x4A, 0x6A),
    "minion_eye": (0xFF, 0xFF, 0xFF),
    "minion_pupil": (0xDA, 0x2A, 0x4A),
    # Shared
    "moss": (0x4A, 0x7A, 0x3A),
}


def hex_to_rgba(t, alpha=255):
    if len(t) == 4:
        return t
    return (*t, alpha)


# ============ Forest Guardian (48x48) ============


def create_forest_guardian_idle(output_path):
    """Large tree spirit with glowing eyes, leafy crown."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    pixels = img.load()

    # Leafy crown at top (rows 2-12)
    # Row 2-4: Top leaves
    for x in range(18, 31):
        pixels[x, 2] = hex_to_rgba(COLORS["guardian_leaves_dark"])
    for x in range(15, 34):
        pixels[x, 3] = hex_to_rgba(COLORS["guardian_leaves"])
    for x in range(13, 36):
        pixels[x, 4] = hex_to_rgba(COLORS["guardian_leaves"])

    # Row 5-8: Main leaf crown
    for y in range(5, 9):
        for x in range(11, 38):
            if (x + y) % 3 == 0:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_light"])
            elif (x + y) % 3 == 1:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_dark"])

    # Row 9-12: Lower crown with some gaps
    for y in range(9, 13):
        for x in range(13, 36):
            if (x + y) % 4 != 0:
                shade = (
                    COLORS["guardian_leaves"]
                    if x < 24
                    else COLORS["guardian_leaves_dark"]
                )
                pixels[x, y] = hex_to_rgba(shade)

    # Face/trunk area (rows 13-35)
    # Row 13-35: Main trunk body
    for y in range(13, 36):
        trunk_width = 16 - abs(y - 24) // 3
        left = 24 - trunk_width // 2
        right = 24 + trunk_width // 2
        for x in range(left, right):
            if x < 22:
                shade = COLORS["guardian_bark_light"]
            elif x < 26:
                shade = COLORS["guardian_bark"]
            else:
                shade = COLORS["guardian_bark_dark"]
            pixels[x, y] = hex_to_rgba(shade)

    # Glowing eyes (row 18-21)
    # Left eye
    for y in range(18, 22):
        for x in range(18, 22):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_eye"])
    pixels[19, 19] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[20, 19] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[19, 20] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[20, 20] = hex_to_rgba(COLORS["guardian_glow"])

    # Right eye
    for y in range(18, 22):
        for x in range(26, 30):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_eye"])
    pixels[27, 19] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[28, 19] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[27, 20] = hex_to_rgba(COLORS["guardian_glow"])
    pixels[28, 20] = hex_to_rgba(COLORS["guardian_glow"])

    # Mouth - bark texture line (row 26-28)
    for x in range(20, 28):
        pixels[x, 27] = hex_to_rgba(COLORS["guardian_bark_dark"])

    # Root feet (rows 36-44)
    # Left root
    for y in range(36, 44):
        root_offset = (y - 36) // 2
        for x in range(16 - root_offset, 22):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])
    for y in range(40, 46):
        for x in range(10, 16):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_dark"])

    # Right root
    for y in range(36, 44):
        root_offset = (y - 36) // 2
        for x in range(26, 32 + root_offset):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])
    for y in range(40, 46):
        for x in range(32, 38):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_dark"])

    # Moss patches
    pixels[20, 30] = hex_to_rgba(COLORS["moss"])
    pixels[21, 31] = hex_to_rgba(COLORS["moss"])
    pixels[27, 32] = hex_to_rgba(COLORS["moss"])
    pixels[28, 31] = hex_to_rgba(COLORS["moss"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_forest_guardian_attack1(output_path):
    """Guardian raising roots - preparing attack."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    pixels = img.load()

    # Crown slightly smaller/tensed (rows 4-11)
    for y in range(4, 12):
        for x in range(14, 35):
            if (x + y) % 3 == 0:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_light"])
            elif (x + y) % 3 == 1:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_dark"])

    # Trunk body (rows 12-34)
    for y in range(12, 35):
        trunk_width = 14 - abs(y - 23) // 3
        left = 24 - trunk_width // 2
        right = 24 + trunk_width // 2
        for x in range(left, right):
            shade = COLORS["guardian_bark_light"] if x < 22 else COLORS["guardian_bark"]
            pixels[x, y] = hex_to_rgba(shade)

    # Angry glowing eyes - brighter, squinted
    for y in range(17, 20):
        for x in range(18, 22):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_glow"])
        for x in range(26, 30):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_glow"])

    # Angry brow lines
    for x in range(17, 22):
        pixels[x, 16] = hex_to_rgba(COLORS["guardian_bark_dark"])
    for x in range(26, 31):
        pixels[x, 16] = hex_to_rgba(COLORS["guardian_bark_dark"])

    # Roots raised up - threatening
    # Left root up
    for y in range(28, 40):
        for x in range(8, 16):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])
    for y in range(24, 30):
        for x in range(6, 12):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_light"])

    # Right root up
    for y in range(28, 40):
        for x in range(32, 40):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])
    for y in range(24, 30):
        for x in range(36, 42):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_light"])

    # Ground connection
    for y in range(38, 46):
        for x in range(12, 20):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_dark"])
        for x in range(28, 36):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_forest_guardian_attack2(output_path):
    """Guardian slamming roots down - root slam attack."""
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    pixels = img.load()

    # Crown shaking (rows 2-10)
    for y in range(2, 11):
        offset = 1 if y % 2 == 0 else -1
        for x in range(13 + offset, 36 + offset):
            if (x + y) % 3 == 0:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_light"])
            elif (x + y) % 3 == 1:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves"])
            else:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_leaves_dark"])

    # Trunk body lower (rows 11-34)
    for y in range(11, 35):
        trunk_width = 16 - abs(y - 23) // 3
        left = 24 - trunk_width // 2
        right = 24 + trunk_width // 2
        for x in range(left, right):
            shade = COLORS["guardian_bark_light"] if x < 22 else COLORS["guardian_bark"]
            pixels[x, y] = hex_to_rgba(shade)

    # Eyes fully glowing - attack mode
    for y in range(16, 21):
        for x in range(17, 23):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_glow"])
        for x in range(25, 31):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_glow"])

    # Open mouth roaring
    for y in range(25, 29):
        for x in range(20, 28):
            pixels[x, y] = hex_to_rgba(COLORS["guardian_bark_dark"])

    # Roots slammed down - spread wide
    # Left roots smashing
    for y in range(36, 46):
        for x in range(2, 20):
            if (x + y) % 2 == 0:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])

    # Right roots smashing
    for y in range(36, 46):
        for x in range(28, 46):
            if (x + y) % 2 == 0:
                pixels[x, y] = hex_to_rgba(COLORS["guardian_bark"])

    # Impact debris
    for x in range(4, 44):
        if x % 4 == 0:
            pixels[x, 44] = hex_to_rgba((120, 90, 50, 200))
            pixels[x, 45] = hex_to_rgba((100, 75, 40, 150))
            pixels[x, 46] = hex_to_rgba((80, 60, 30, 100))

    img.save(output_path)
    print(f"Created: {output_path}")


# ============ Chaos Minion (24x24) ============


def create_chaos_minion_attack1(output_path):
    """Minion charging up - pulsing glow."""
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    pixels = img.load()

    # Spike hat (rows 2-6)
    for x in range(10, 14):
        pixels[x, 2] = hex_to_rgba(COLORS["minion_dark"])
    for x in range(9, 15):
        pixels[x, 3] = hex_to_rgba(COLORS["minion_dark"])
    for x in range(9, 15):
        pixels[x, 4] = hex_to_rgba(COLORS["minion_dark"])
    for x in range(8, 16):
        pixels[x, 5] = hex_to_rgba(COLORS["minion_dark"])

    # Body - slightly squashed, pulsing
    for y in range(6, 18):
        body_width = 8 + (2 if 9 <= y <= 14 else 0)
        left = 12 - body_width // 2
        right = 12 + body_width // 2
        for x in range(left, right):
            if x < 10:
                shade = COLORS["minion_light"]
            elif x < 14:
                shade = COLORS["minion_body"]
            else:
                shade = COLORS["minion_dark"]
            pixels[x, y] = hex_to_rgba(shade)

    # Glowing eyes - charging
    for y in range(9, 13):
        for x in range(7, 11):
            pixels[x, y] = hex_to_rgba(COLORS["minion_glow"])
        for x in range(13, 17):
            pixels[x, y] = hex_to_rgba(COLORS["minion_glow"])

    # Energy particles around
    pixels[4, 8] = hex_to_rgba(COLORS["minion_glow"], 180)
    pixels[19, 10] = hex_to_rgba(COLORS["minion_glow"], 180)
    pixels[6, 16] = hex_to_rgba(COLORS["minion_glow"], 180)
    pixels[17, 14] = hex_to_rgba(COLORS["minion_glow"], 180)

    img.save(output_path)
    print(f"Created: {output_path}")


def create_chaos_minion_attack2(output_path):
    """Minion firing chaos bolt - stretched forward."""
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    pixels = img.load()

    # Spike hat tilted forward (rows 4-7)
    for x in range(12, 18):
        pixels[x, 4] = hex_to_rgba(COLORS["minion_dark"])
    for x in range(11, 19):
        pixels[x, 5] = hex_to_rgba(COLORS["minion_dark"])
    for x in range(10, 18):
        pixels[x, 6] = hex_to_rgba(COLORS["minion_dark"])

    # Body stretched right (attacking)
    for y in range(7, 16):
        for x in range(6, 20):
            dist_from_center = abs(x - 13) + abs(y - 11)
            if dist_from_center < 7:
                if x < 11:
                    shade = COLORS["minion_light"]
                elif x < 15:
                    shade = COLORS["minion_body"]
                else:
                    shade = COLORS["minion_dark"]
                pixels[x, y] = hex_to_rgba(shade)

    # Eyes focused right
    for y in range(9, 12):
        for x in range(9, 12):
            pixels[x, y] = hex_to_rgba(COLORS["minion_eye"])
        for x in range(14, 17):
            pixels[x, y] = hex_to_rgba(COLORS["minion_eye"])

    # Pupils looking right
    pixels[11, 10] = hex_to_rgba(COLORS["minion_pupil"])
    pixels[16, 10] = hex_to_rgba(COLORS["minion_pupil"])

    # Chaos bolt projectile (right side)
    for y in range(9, 13):
        for x in range(19, 23):
            pixels[x, y] = hex_to_rgba(COLORS["minion_glow"])
    pixels[22, 10] = hex_to_rgba(COLORS["minion_light"])
    pixels[22, 11] = hex_to_rgba(COLORS["minion_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    # Forest Guardian
    guardian_dir = "game/assets/sprites/enemies/forest_guardian"
    os.makedirs(guardian_dir, exist_ok=True)
    create_forest_guardian_idle(os.path.join(guardian_dir, "idle_1.png"))
    create_forest_guardian_attack1(os.path.join(guardian_dir, "attack_1.png"))
    create_forest_guardian_attack2(os.path.join(guardian_dir, "attack_2.png"))

    # Also create overworld version (scaled down or same)
    create_forest_guardian_idle(os.path.join(guardian_dir, "overworld.png"))

    # Chaos Minion
    minion_dir = "game/assets/sprites/enemies/chaos_minion"
    os.makedirs(minion_dir, exist_ok=True)
    create_chaos_minion_attack1(os.path.join(minion_dir, "attack_1.png"))
    create_chaos_minion_attack2(os.path.join(minion_dir, "attack_2.png"))

    print("\nBoss sprites complete!")
    print("Files created in:")
    print(f"  - {guardian_dir}/ (idle, attack, overworld)")
    print(f"  - {minion_dir}/ (attack animations)")


if __name__ == "__main__":
    main()
