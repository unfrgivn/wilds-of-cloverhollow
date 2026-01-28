#!/usr/bin/env python3
"""
Generate attack animations for forest enemies to complete M212.
Matches existing idle sprites style - 32x32, soft shading, colored outlines.

Enemies:
- Angry Acorn: dark brown cap, orange-brown body, headbutt attack
- Sneaky Snake: lime green, lunge/bite attack
- Grumpy Stump: chocolate brown bark, root smash attack
"""

from PIL import Image
import os

# Colors from existing sprites (approximate)
COLORS = {
    # Angry Acorn
    "acorn_cap_dark": (0x5D, 0x3A, 0x1A),
    "acorn_cap_mid": (0x7A, 0x4D, 0x26),
    "acorn_cap_light": (0x8F, 0x5F, 0x32),
    "acorn_body_dark": (0x9E, 0x5A, 0x20),
    "acorn_body": (0xC5, 0x75, 0x2D),
    "acorn_body_light": (0xD9, 0x92, 0x4D),
    # Sneaky Snake
    "snake_dark": (0x3A, 0x5A, 0x28),
    "snake_mid": (0x5C, 0x8A, 0x3D),
    "snake_light": (0x8B, 0xC3, 0x4A),
    "snake_belly": (0xA8, 0xD4, 0x6E),
    # Grumpy Stump
    "stump_dark": (0x4A, 0x32, 0x1E),
    "stump_mid": (0x6B, 0x4A, 0x2D),
    "stump_light": (0x8B, 0x65, 0x3D),
    "stump_top": (0xA5, 0x7A, 0x55),
    "moss": (0x5A, 0x8A, 0x4A),
    # Shared
    "eye_white": (0xFF, 0xFF, 0xFF),
    "eye_black": (0x10, 0x10, 0x10),
    "mouth_red": (0xC0, 0x40, 0x40),
    "angry_brow": (0x20, 0x18, 0x10),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_angry_acorn_attack1(output_path):
    """Acorn winding up for attack - squashed down, tilted forward."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Squashed body (wider, shorter) - centered around row 20-28
    # Row 20-21: Cap top edge tilted forward
    for x in range(11, 22):
        pixels[x, 20] = hex_to_rgba(COLORS["acorn_cap_dark"])
    for x in range(10, 23):
        pixels[x, 21] = hex_to_rgba(COLORS["acorn_cap_mid"])

    # Row 22-24: Cap main body
    for x in range(9, 24):
        pixels[x, 22] = hex_to_rgba(COLORS["acorn_cap_mid"])
    for x in range(10, 23):
        shade = COLORS["acorn_cap_light"] if x < 15 else COLORS["acorn_cap_mid"]
        pixels[x, 23] = hex_to_rgba(shade)
    for x in range(11, 22):
        pixels[x, 24] = hex_to_rgba(COLORS["acorn_cap_dark"])

    # Row 25-28: Squashed body (wider than normal)
    for x in range(9, 24):
        pixels[x, 25] = hex_to_rgba(COLORS["acorn_body"])
    for x in range(8, 25):
        shade = COLORS["acorn_body_light"] if x < 14 else COLORS["acorn_body"]
        pixels[x, 26] = hex_to_rgba(shade)
    for x in range(9, 24):
        pixels[x, 27] = hex_to_rgba(COLORS["acorn_body_dark"])
    for x in range(11, 22):
        pixels[x, 28] = hex_to_rgba(COLORS["acorn_body_dark"])

    # Angry eyes (squinted) at row 26
    pixels[12, 26] = hex_to_rgba(COLORS["eye_white"])
    pixels[13, 26] = hex_to_rgba(COLORS["eye_black"])
    pixels[19, 26] = hex_to_rgba(COLORS["eye_white"])
    pixels[20, 26] = hex_to_rgba(COLORS["eye_black"])

    # Angry eyebrows
    pixels[11, 25] = hex_to_rgba(COLORS["angry_brow"])
    pixels[12, 25] = hex_to_rgba(COLORS["angry_brow"])
    pixels[20, 25] = hex_to_rgba(COLORS["angry_brow"])
    pixels[21, 25] = hex_to_rgba(COLORS["angry_brow"])

    # Gritted mouth
    for x in range(14, 19):
        pixels[x, 27] = hex_to_rgba(COLORS["mouth_red"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_angry_acorn_attack2(output_path):
    """Acorn lunging forward with headbutt - stretched tall, forward motion."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Stretched forward and up - cap leading, positioned more to the right
    # Row 12-16: Cap stretched forward
    for x in range(16, 24):
        pixels[x, 12] = hex_to_rgba(COLORS["acorn_cap_dark"])
    for x in range(15, 26):
        pixels[x, 13] = hex_to_rgba(COLORS["acorn_cap_mid"])
    for x in range(14, 27):
        pixels[x, 14] = hex_to_rgba(COLORS["acorn_cap_mid"])
    for x in range(14, 26):
        shade = COLORS["acorn_cap_light"] if x < 18 else COLORS["acorn_cap_mid"]
        pixels[x, 15] = hex_to_rgba(shade)
    for x in range(15, 25):
        pixels[x, 16] = hex_to_rgba(COLORS["acorn_cap_dark"])

    # Row 17-23: Body stretched behind
    for x in range(13, 24):
        pixels[x, 17] = hex_to_rgba(COLORS["acorn_body"])
    for x in range(11, 22):
        pixels[x, 18] = hex_to_rgba(COLORS["acorn_body"])
    for x in range(10, 20):
        shade = COLORS["acorn_body_light"] if x < 14 else COLORS["acorn_body"]
        pixels[x, 19] = hex_to_rgba(shade)
    for x in range(9, 18):
        pixels[x, 20] = hex_to_rgba(COLORS["acorn_body"])
    for x in range(9, 16):
        pixels[x, 21] = hex_to_rgba(COLORS["acorn_body_dark"])
    for x in range(10, 14):
        pixels[x, 22] = hex_to_rgba(COLORS["acorn_body_dark"])

    # Angry eyes on body
    pixels[12, 18] = hex_to_rgba(COLORS["eye_white"])
    pixels[13, 18] = hex_to_rgba(COLORS["eye_black"])
    pixels[17, 18] = hex_to_rgba(COLORS["eye_white"])
    pixels[18, 18] = hex_to_rgba(COLORS["eye_black"])

    # Eyebrows
    pixels[11, 17] = hex_to_rgba(COLORS["angry_brow"])
    pixels[12, 17] = hex_to_rgba(COLORS["angry_brow"])
    pixels[17, 17] = hex_to_rgba(COLORS["angry_brow"])
    pixels[18, 17] = hex_to_rgba(COLORS["angry_brow"])

    # Motion lines behind (optional visual)
    for i in range(3):
        pixels[6, 19 + i] = hex_to_rgba((200, 200, 200, 128))
        pixels[5, 20 + i] = hex_to_rgba((180, 180, 180, 100))

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sneaky_snake_attack1(output_path):
    """Snake coiling up, preparing to strike."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Coiled body at bottom
    # Row 22-28: Coiled loops
    for x in range(10, 22):
        pixels[x, 26] = hex_to_rgba(COLORS["snake_dark"])
    for x in range(9, 23):
        pixels[x, 27] = hex_to_rgba(COLORS["snake_mid"])
    for x in range(10, 22):
        pixels[x, 28] = hex_to_rgba(COLORS["snake_light"])

    # Second coil layer
    for x in range(12, 20):
        pixels[x, 24] = hex_to_rgba(COLORS["snake_dark"])
    for x in range(11, 21):
        pixels[x, 25] = hex_to_rgba(COLORS["snake_mid"])

    # Head raised up (S-curve neck)
    # Neck going up
    for y in range(18, 24):
        pixels[14, y] = hex_to_rgba(COLORS["snake_mid"])
        pixels[15, y] = hex_to_rgba(COLORS["snake_light"])

    # Head at top - larger, menacing
    for x in range(12, 19):
        pixels[x, 14] = hex_to_rgba(COLORS["snake_dark"])
    for x in range(11, 20):
        pixels[x, 15] = hex_to_rgba(COLORS["snake_mid"])
    for x in range(11, 20):
        pixels[x, 16] = hex_to_rgba(COLORS["snake_light"])
    for x in range(12, 19):
        pixels[x, 17] = hex_to_rgba(COLORS["snake_mid"])

    # Eyes
    pixels[13, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[14, 15] = hex_to_rgba(COLORS["eye_black"])
    pixels[17, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[18, 15] = hex_to_rgba(COLORS["eye_black"])

    # Forked tongue out
    pixels[15, 13] = hex_to_rgba(COLORS["mouth_red"])
    pixels[14, 12] = hex_to_rgba(COLORS["mouth_red"])
    pixels[16, 12] = hex_to_rgba(COLORS["mouth_red"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_sneaky_snake_attack2(output_path):
    """Snake lunging forward to bite."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Body stretched back-left
    for x in range(4, 12):
        pixels[x, 22] = hex_to_rgba(COLORS["snake_mid"])
    for x in range(6, 14):
        pixels[x, 21] = hex_to_rgba(COLORS["snake_light"])
    for x in range(8, 16):
        pixels[x, 20] = hex_to_rgba(COLORS["snake_mid"])

    # Neck stretching forward-right
    for x in range(14, 22):
        pixels[x, 18] = hex_to_rgba(COLORS["snake_mid"])
    for x in range(18, 26):
        pixels[x, 16] = hex_to_rgba(COLORS["snake_light"])

    # Head lunging far right - mouth open
    for x in range(24, 30):
        pixels[x, 14] = hex_to_rgba(COLORS["snake_dark"])
    for x in range(23, 31):
        pixels[x, 15] = hex_to_rgba(COLORS["snake_mid"])
    for x in range(23, 31):
        pixels[x, 16] = hex_to_rgba(COLORS["snake_light"])
    for x in range(24, 30):
        pixels[x, 17] = hex_to_rgba(COLORS["snake_mid"])

    # Open mouth (top and bottom jaw)
    pixels[29, 14] = hex_to_rgba(COLORS["mouth_red"])
    pixels[30, 14] = hex_to_rgba(COLORS["mouth_red"])
    pixels[29, 17] = hex_to_rgba(COLORS["mouth_red"])
    pixels[30, 17] = hex_to_rgba(COLORS["mouth_red"])

    # Fangs
    pixels[30, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[30, 16] = hex_to_rgba(COLORS["eye_white"])

    # Eyes
    pixels[25, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[26, 15] = hex_to_rgba(COLORS["eye_black"])

    # Motion blur lines
    for i in range(4):
        pixels[20 + i, 15] = hex_to_rgba((200, 200, 200, 80))

    img.save(output_path)
    print(f"Created: {output_path}")


def create_grumpy_stump_attack1(output_path):
    """Stump winding up - leaning back, roots tensing."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Main body tilted back slightly
    # Row 10-20: Stump body
    for x in range(10, 23):
        pixels[x, 10] = hex_to_rgba(COLORS["stump_top"])
    for x in range(11, 22):
        pixels[x, 11] = hex_to_rgba(COLORS["stump_top"])

    # Moss on top
    pixels[12, 10] = hex_to_rgba(COLORS["moss"])
    pixels[15, 10] = hex_to_rgba(COLORS["moss"])
    pixels[19, 10] = hex_to_rgba(COLORS["moss"])

    # Bark body
    for y in range(12, 22):
        for x in range(9, 24):
            if 10 <= x <= 22:
                shade = COLORS["stump_light"] if x < 14 else COLORS["stump_mid"]
                pixels[x, y] = hex_to_rgba(shade)

    # Darker bark edges
    for y in range(14, 20):
        pixels[9, y] = hex_to_rgba(COLORS["stump_dark"])
        pixels[23, y] = hex_to_rgba(COLORS["stump_dark"])

    # Angry face
    pixels[12, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[13, 15] = hex_to_rgba(COLORS["eye_black"])
    pixels[19, 15] = hex_to_rgba(COLORS["eye_white"])
    pixels[20, 15] = hex_to_rgba(COLORS["eye_black"])

    # Thick angry eyebrows
    for x in range(11, 14):
        pixels[x, 14] = hex_to_rgba(COLORS["angry_brow"])
    for x in range(19, 22):
        pixels[x, 14] = hex_to_rgba(COLORS["angry_brow"])

    # Grumpy frown
    for x in range(14, 19):
        pixels[x, 18] = hex_to_rgba(COLORS["stump_dark"])
    pixels[14, 17] = hex_to_rgba(COLORS["stump_dark"])
    pixels[18, 17] = hex_to_rgba(COLORS["stump_dark"])

    # Roots tensed/raised at bottom
    for x in range(7, 11):
        pixels[x, 24] = hex_to_rgba(COLORS["stump_mid"])
        pixels[x, 25] = hex_to_rgba(COLORS["stump_dark"])
    for x in range(22, 26):
        pixels[x, 24] = hex_to_rgba(COLORS["stump_mid"])
        pixels[x, 25] = hex_to_rgba(COLORS["stump_dark"])

    # Ground crack lines
    for x in range(8, 25):
        pixels[x, 26] = hex_to_rgba(COLORS["stump_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_grumpy_stump_attack2(output_path):
    """Stump slamming down - roots smashing ground."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    pixels = img.load()

    # Body slammed forward/down
    # Row 14-24: Stump body lower
    for x in range(10, 23):
        pixels[x, 14] = hex_to_rgba(COLORS["stump_top"])

    # Moss
    pixels[12, 14] = hex_to_rgba(COLORS["moss"])
    pixels[16, 14] = hex_to_rgba(COLORS["moss"])
    pixels[20, 14] = hex_to_rgba(COLORS["moss"])

    # Bark body
    for y in range(15, 24):
        for x in range(9, 24):
            if 10 <= x <= 22:
                shade = COLORS["stump_light"] if x < 14 else COLORS["stump_mid"]
                pixels[x, y] = hex_to_rgba(shade)

    # Darker edges
    for y in range(16, 22):
        pixels[9, y] = hex_to_rgba(COLORS["stump_dark"])
        pixels[23, y] = hex_to_rgba(COLORS["stump_dark"])

    # Angry face - more intense
    pixels[12, 18] = hex_to_rgba(COLORS["eye_white"])
    pixels[13, 18] = hex_to_rgba(COLORS["eye_black"])
    pixels[19, 18] = hex_to_rgba(COLORS["eye_white"])
    pixels[20, 18] = hex_to_rgba(COLORS["eye_black"])

    # Extra thick eyebrows - really mad
    for x in range(10, 15):
        pixels[x, 17] = hex_to_rgba(COLORS["angry_brow"])
    for x in range(18, 23):
        pixels[x, 17] = hex_to_rgba(COLORS["angry_brow"])

    # Open mouth yelling
    for x in range(14, 19):
        pixels[x, 20] = hex_to_rgba(COLORS["mouth_red"])
        pixels[x, 21] = hex_to_rgba(COLORS["mouth_red"])

    # Roots smashing outward
    for x in range(3, 10):
        pixels[x, 26] = hex_to_rgba(COLORS["stump_mid"])
        pixels[x, 27] = hex_to_rgba(COLORS["stump_dark"])
    for x in range(23, 30):
        pixels[x, 26] = hex_to_rgba(COLORS["stump_mid"])
        pixels[x, 27] = hex_to_rgba(COLORS["stump_dark"])

    # Impact debris/dust
    for x in range(5, 28):
        if x % 3 == 0:
            pixels[x, 28] = hex_to_rgba((140, 100, 60, 180))
            pixels[x, 29] = hex_to_rgba((120, 85, 50, 120))

    # Ground crack pattern
    for x in range(6, 27):
        pixels[x, 30] = hex_to_rgba(COLORS["stump_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    # Angry Acorn
    acorn_dir = "game/assets/sprites/enemies/angry_acorn"
    os.makedirs(acorn_dir, exist_ok=True)
    create_angry_acorn_attack1(os.path.join(acorn_dir, "attack_1.png"))
    create_angry_acorn_attack2(os.path.join(acorn_dir, "attack_2.png"))

    # Sneaky Snake
    snake_dir = "game/assets/sprites/enemies/sneaky_snake"
    os.makedirs(snake_dir, exist_ok=True)
    create_sneaky_snake_attack1(os.path.join(snake_dir, "attack_1.png"))
    create_sneaky_snake_attack2(os.path.join(snake_dir, "attack_2.png"))

    # Grumpy Stump
    stump_dir = "game/assets/sprites/enemies/grumpy_stump"
    os.makedirs(stump_dir, exist_ok=True)
    create_grumpy_stump_attack1(os.path.join(stump_dir, "attack_1.png"))
    create_grumpy_stump_attack2(os.path.join(stump_dir, "attack_2.png"))

    print("\nForest enemy attack animations complete!")
    print("Files created in:")
    print(f"  - {acorn_dir}/attack_*.png")
    print(f"  - {snake_dir}/attack_*.png")
    print(f"  - {stump_dir}/attack_*.png")


if __name__ == "__main__":
    main()
