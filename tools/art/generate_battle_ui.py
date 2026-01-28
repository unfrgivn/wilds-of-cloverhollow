#!/usr/bin/env python3
"""Generate battle UI elements for Wilds of Cloverhollow."""

from PIL import Image
import os
import math

UI_COLORS = {
    "frame_dark": (0x3D, 0x32, 0x28),
    "frame_mid": (0x6B, 0x5A, 0x4A),
    "frame_light": (0xA8, 0x98, 0x80),
    "frame_bg": (0x28, 0x20, 0x1A),
    "hp_fill": (0x4A, 0xC4, 0x5A),
    "hp_low": (0xE8, 0x64, 0x64),
    "mp_fill": (0x5A, 0xA8, 0xD7),
    "white": (0xFF, 0xFF, 0xFF),
    "yellow": (0xF5, 0xE0, 0x78),
    "gold": (0xE8, 0xC0, 0x40),
    "red": (0xE8, 0x64, 0x64),
    "green_light": (0x8F, 0xD9, 0x78),
    "transparent": (0, 0, 0, 0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_hp_bar(output_path):
    """Create hp_bar.png (48x8) - health bar frame with gradient fill."""
    width, height = 48, 8
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Row 0: top border
    for x in range(width):
        pixels[x, 0] = hex_to_rgba(C["frame_dark"])

    # Row 1-6: sides + fill area
    for y in range(1, 7):
        pixels[0, y] = hex_to_rgba(C["frame_dark"])
        pixels[width - 1, y] = hex_to_rgba(C["frame_dark"])
        for x in range(1, width - 1):
            pixels[x, y] = hex_to_rgba(C["frame_bg"])

    # Row 7: bottom border
    for x in range(width):
        pixels[x, 7] = hex_to_rgba(C["frame_dark"])

    # Fill HP (green, about 80% full for display)
    fill_width = int((width - 4) * 0.8)
    for y in range(2, 6):
        for x in range(2, 2 + fill_width):
            pixels[x, y] = hex_to_rgba(C["hp_fill"])

    # Highlight on top of fill
    for x in range(2, 2 + fill_width):
        pixels[x, 2] = hex_to_rgba(C["green_light"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_mp_bar(output_path):
    """Create mp_bar.png (48x8) - mana bar frame with gradient fill."""
    width, height = 48, 8
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Row 0: top border
    for x in range(width):
        pixels[x, 0] = hex_to_rgba(C["frame_dark"])

    # Row 1-6: sides + fill area
    for y in range(1, 7):
        pixels[0, y] = hex_to_rgba(C["frame_dark"])
        pixels[width - 1, y] = hex_to_rgba(C["frame_dark"])
        for x in range(1, width - 1):
            pixels[x, y] = hex_to_rgba(C["frame_bg"])

    # Row 7: bottom border
    for x in range(width):
        pixels[x, 7] = hex_to_rgba(C["frame_dark"])

    # Fill MP (blue, about 60% full for display)
    fill_width = int((width - 4) * 0.6)
    for y in range(2, 6):
        for x in range(2, 2 + fill_width):
            pixels[x, y] = hex_to_rgba(C["mp_fill"])

    # Highlight
    for x in range(2, 2 + fill_width):
        pixels[x, 2] = hex_to_rgba(C["white"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_command_box(output_path):
    """Create command_box.png (96x48) - command menu frame."""
    width, height = 96, 48
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Outer border (dark)
    for x in range(width):
        pixels[x, 0] = hex_to_rgba(C["frame_dark"])
        pixels[x, height - 1] = hex_to_rgba(C["frame_dark"])
    for y in range(height):
        pixels[0, y] = hex_to_rgba(C["frame_dark"])
        pixels[width - 1, y] = hex_to_rgba(C["frame_dark"])

    # Inner border (mid)
    for x in range(1, width - 1):
        pixels[x, 1] = hex_to_rgba(C["frame_mid"])
        pixels[x, height - 2] = hex_to_rgba(C["frame_mid"])
    for y in range(1, height - 1):
        pixels[1, y] = hex_to_rgba(C["frame_mid"])
        pixels[width - 2, y] = hex_to_rgba(C["frame_mid"])

    # Highlight (light, top-left inner)
    for x in range(2, width - 2):
        pixels[x, 2] = hex_to_rgba(C["frame_light"])
    for y in range(2, height - 2):
        pixels[2, y] = hex_to_rgba(C["frame_light"])

    # Fill background
    for y in range(3, height - 3):
        for x in range(3, width - 3):
            pixels[x, y] = hex_to_rgba(C["frame_bg"])

    # Corner accents (decorative)
    pixels[2, 2] = hex_to_rgba(C["gold"])
    pixels[width - 3, 2] = hex_to_rgba(C["gold"])
    pixels[2, height - 3] = hex_to_rgba(C["gold"])
    pixels[width - 3, height - 3] = hex_to_rgba(C["gold"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_target_cursor(output_path):
    """Create target_cursor.png (16x16) - enemy selection cursor (arrow/hand)."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Arrow pointing right, centered vertically
    # Row 4-11: arrow body
    arrow = [
        "      XX        ",  # Row 4
        "      XXX       ",  # Row 5
        "  XXXXXXXX      ",  # Row 6
        "  XXXXXXXXX     ",  # Row 7
        "  XXXXXXXXXX    ",  # Row 8
        "  XXXXXXXXX     ",  # Row 9
        "  XXXXXXXX      ",  # Row 10
        "      XXX       ",  # Row 11
        "      XX        ",  # Row 12
    ]

    for row_idx, row in enumerate(arrow):
        y = 4 + row_idx
        for x, char in enumerate(row):
            if x < width and y < height:
                if char == "X":
                    pixels[x, y] = hex_to_rgba(C["yellow"])

    # Outline
    outline_coords = [
        (5, 4),
        (5, 5),
        (1, 6),
        (1, 7),
        (1, 8),
        (1, 9),
        (1, 10),
        (5, 11),
        (5, 12),
        (8, 4),
        (9, 5),
        (10, 6),
        (11, 7),
        (12, 8),
        (11, 9),
        (10, 10),
        (9, 11),
        (8, 12),
    ]
    for x, y in outline_coords:
        if 0 <= x < width and 0 <= y < height:
            pixels[x, y] = hex_to_rgba(C["frame_dark"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_attack_slash(output_path):
    """Create attack_slash.png (32x32) - attack effect diagonal slash."""
    width, height = 32, 32
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Diagonal slash from top-right to bottom-left
    for i in range(28):
        x = 28 - i
        y = 2 + i
        if 0 <= x < width and 0 <= y < height:
            # Main slash (white core)
            pixels[x, y] = hex_to_rgba(C["white"])
            if x + 1 < width:
                pixels[x + 1, y] = hex_to_rgba(C["white"])
            # Glow effect (yellow)
            if x - 1 >= 0:
                pixels[x - 1, y] = hex_to_rgba(C["yellow"])
            if x + 2 < width:
                pixels[x + 2, y] = hex_to_rgba(C["yellow"])
            if y - 1 >= 0 and x < width:
                pixels[x, y - 1] = hex_to_rgba(C["yellow"])
            if y + 1 < height and x < width:
                pixels[x, y + 1] = hex_to_rgba(C["yellow"])

    # Sparkle points at ends
    sparkle_coords = [(28, 2), (29, 3), (2, 28), (1, 29)]
    for sx, sy in sparkle_coords:
        if 0 <= sx < width and 0 <= sy < height:
            pixels[sx, sy] = hex_to_rgba(C["gold"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_heal_sparkle(output_path):
    """Create heal_sparkle.png (16x16) - heal effect sparkle/star."""
    width, height = 16, 16
    img = Image.new("RGBA", (width, height), UI_COLORS["transparent"])
    pixels = img.load()

    C = UI_COLORS

    # Center cross shape
    cx, cy = 7, 7

    # Vertical beam
    for dy in range(-5, 6):
        y = cy + dy
        if 0 <= y < height:
            intensity = 1.0 - abs(dy) / 6.0
            if intensity > 0.8:
                pixels[cx, y] = hex_to_rgba(C["white"])
            elif intensity > 0.4:
                pixels[cx, y] = hex_to_rgba(C["green_light"])
            else:
                pixels[cx, y] = hex_to_rgba(C["hp_fill"])

    # Horizontal beam
    for dx in range(-5, 6):
        x = cx + dx
        if 0 <= x < width:
            intensity = 1.0 - abs(dx) / 6.0
            if intensity > 0.8:
                pixels[x, cy] = hex_to_rgba(C["white"])
            elif intensity > 0.4:
                pixels[x, cy] = hex_to_rgba(C["green_light"])
            else:
                pixels[x, cy] = hex_to_rgba(C["hp_fill"])

    # Diagonal accents
    diag_coords = [(5, 5), (9, 5), (5, 9), (9, 9)]
    for x, y in diag_coords:
        if 0 <= x < width and 0 <= y < height:
            pixels[x, y] = hex_to_rgba(C["green_light"])

    # Center bright
    pixels[cx, cy] = hex_to_rgba(C["white"])
    pixels[cx - 1, cy] = hex_to_rgba(C["white"])
    pixels[cx + 1, cy] = hex_to_rgba(C["white"])
    pixels[cx, cy - 1] = hex_to_rgba(C["white"])
    pixels[cx, cy + 1] = hex_to_rgba(C["white"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/ui/battle"
    os.makedirs(output_dir, exist_ok=True)

    create_hp_bar(os.path.join(output_dir, "hp_bar.png"))
    create_mp_bar(os.path.join(output_dir, "mp_bar.png"))
    create_command_box(os.path.join(output_dir, "command_box.png"))
    create_target_cursor(os.path.join(output_dir, "target_cursor.png"))
    create_attack_slash(os.path.join(output_dir, "attack_slash.png"))
    create_heal_sparkle(os.path.join(output_dir, "heal_sparkle.png"))

    print("\nBattle UI generation complete!")


if __name__ == "__main__":
    main()
