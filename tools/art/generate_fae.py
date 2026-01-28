#!/usr/bin/env python3
"""
Generate Fae (main character) overworld sprites.
M207: Player Character (Fae) - idle and walk cycle for 8 directions.

Fae is a young student (8-12 age range) in school uniform.
- 16x24 chibi proportions
- Colored outlines (dark versions of fill colors, never pure black)
- Minimal shading (2-3 bands max)
- School uniform: blue skirt/shirt, white collar
- Brown hair, peach skin
"""

from PIL import Image
import os

# Palette colors from cloverhollow.palette.json
COLORS = {
    # Skin tones
    "skin": (0xF5, 0xD5, 0xB0),
    "skin_shadow": (0xD4, 0xA5, 0x74),
    "skin_outline": (0x8B, 0x6B, 0x4D),
    # Hair (brown)
    "hair": (0x7B, 0x4B, 0x2B),
    "hair_highlight": (0x9B, 0x6B, 0x4B),
    "hair_outline": (0x4A, 0x2A, 0x1A),
    # School uniform - blue
    "uniform_blue": (0x5B, 0x7B, 0xAB),
    "uniform_blue_shadow": (0x4A, 0x5A, 0x8A),
    "uniform_blue_outline": (0x2A, 0x3A, 0x5A),
    # Uniform white (collar)
    "uniform_white": (0xF0, 0xF0, 0xE8),
    "uniform_white_shadow": (0xD0, 0xD0, 0xC8),
    # Shoes
    "shoes": (0x4A, 0x3A, 0x2A),
    "shoes_outline": (0x2A, 0x1A, 0x0A),
    # Eyes
    "eyes": (0x3A, 0x5A, 0x7A),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_fae_south(output_path):
    """Fae facing south (towards camera) - idle frame."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()

    # Row 0-1: Hair top
    for x in range(5, 11):
        p[x, 0] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 1] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(5, 11):
        p[x, 1] = hex_to_rgba(COLORS["hair"])

    # Row 2-3: Hair sides + top of head
    for x in range(3, 13):
        p[x, 2] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 2] = hex_to_rgba(COLORS["hair"])
    for x in range(5, 11):
        p[x, 2] = hex_to_rgba(COLORS["hair_highlight"])

    for x in range(3, 13):
        p[x, 3] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 3] = hex_to_rgba(COLORS["hair"])

    # Row 4-5: Hair + forehead
    for x in range(3, 13):
        p[x, 4] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 4] = hex_to_rgba(COLORS["hair"])
    for x in range(5, 11):
        p[x, 4] = hex_to_rgba(COLORS["skin"])

    for x in range(3, 13):
        p[x, 5] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 5] = hex_to_rgba(COLORS["skin"])
    p[4, 5] = hex_to_rgba(COLORS["hair"])
    p[11, 5] = hex_to_rgba(COLORS["hair"])

    # Row 6-7: Face with eyes
    for x in range(3, 13):
        p[x, 6] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(4, 12):
        p[x, 6] = hex_to_rgba(COLORS["skin"])
    p[5, 6] = hex_to_rgba(COLORS["eyes"])  # left eye
    p[10, 6] = hex_to_rgba(COLORS["eyes"])  # right eye

    for x in range(3, 13):
        p[x, 7] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(4, 12):
        p[x, 7] = hex_to_rgba(COLORS["skin"])

    # Row 8: Lower face
    for x in range(4, 12):
        p[x, 8] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(5, 11):
        p[x, 8] = hex_to_rgba(COLORS["skin"])

    # Row 9: Neck + collar start
    for x in range(6, 10):
        p[x, 9] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 9):
        p[x, 9] = hex_to_rgba(COLORS["skin"])

    # Row 10-11: Collar (white) + shoulders
    for x in range(4, 12):
        p[x, 10] = hex_to_rgba(COLORS["uniform_blue_outline"])
    for x in range(5, 11):
        p[x, 10] = hex_to_rgba(COLORS["uniform_white"])
    for x in range(6, 10):
        p[x, 10] = hex_to_rgba(COLORS["uniform_white"])

    for x in range(3, 13):
        p[x, 11] = hex_to_rgba(COLORS["uniform_blue_outline"])
    for x in range(4, 12):
        p[x, 11] = hex_to_rgba(COLORS["uniform_blue"])
    for x in range(6, 10):
        p[x, 11] = hex_to_rgba(COLORS["uniform_white"])

    # Row 12-15: Torso (uniform blue)
    for row in range(12, 16):
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])
        # Shadow on sides
        p[4, row] = hex_to_rgba(COLORS["uniform_blue_shadow"])
        p[11, row] = hex_to_rgba(COLORS["uniform_blue_shadow"])

    # Row 16-19: Skirt
    for row in range(16, 20):
        width_offset = (row - 16) // 2  # Skirt flares out slightly
        left = 3 - width_offset
        right = 13 + width_offset
        for x in range(max(0, left), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(max(0, left + 1), min(16, right - 1)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 20-23: Legs + shoes
    for x in range(4, 7):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(5, 6):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    for x in range(9, 12):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(10, 11):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    # Shoes
    for x in range(4, 7):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(5, 6):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    for x in range(9, 12):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(10, 11):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_fae_north(output_path):
    """Fae facing north (away from camera) - idle frame."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()

    # Row 0-3: Hair (back of head - more hair visible)
    for x in range(5, 11):
        p[x, 0] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 12):
        p[x, 1] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(5, 11):
        p[x, 1] = hex_to_rgba(COLORS["hair"])

    for row in range(2, 9):
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["hair"])
        # Highlight stripe
        if row >= 3 and row <= 5:
            for x in range(6, 10):
                p[x, row] = hex_to_rgba(COLORS["hair_highlight"])

    # Row 9: Neck hint
    for x in range(6, 10):
        p[x, 9] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 9):
        p[x, 9] = hex_to_rgba(COLORS["skin"])

    # Row 10-15: Back of uniform
    for row in range(10, 16):
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 16-19: Skirt (back)
    for row in range(16, 20):
        width_offset = (row - 16) // 2
        left = 3 - width_offset
        right = 13 + width_offset
        for x in range(max(0, left), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(max(0, left + 1), min(16, right - 1)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 20-23: Legs + shoes (same as front)
    for x in range(4, 7):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(5, 6):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    for x in range(9, 12):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(10, 11):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    for x in range(4, 7):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(5, 6):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    for x in range(9, 12):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(10, 11):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_fae_east(output_path):
    """Fae facing east (right) - idle frame."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()

    # Side view - character shifted slightly right, narrower
    # Row 0-3: Hair (side profile)
    for x in range(6, 12):
        p[x, 0] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(5, 13):
        p[x, 1] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(6, 12):
        p[x, 1] = hex_to_rgba(COLORS["hair"])

    for row in range(2, 5):
        for x in range(4, 13):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        for x in range(5, 12):
            p[x, row] = hex_to_rgba(COLORS["hair"])

    # Row 5-8: Face (side) - face shows on right side
    for x in range(4, 13):
        p[x, 5] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(5, 12):
        p[x, 5] = hex_to_rgba(COLORS["hair"])
    for x in range(9, 13):
        p[x, 5] = hex_to_rgba(COLORS["skin"])
    p[12, 5] = hex_to_rgba(COLORS["skin_outline"])

    for row in range(6, 8):
        for x in range(4, 6):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        p[5, row] = hex_to_rgba(COLORS["hair"])
        for x in range(6, 13):
            p[x, row] = hex_to_rgba(COLORS["skin_outline"])
        for x in range(7, 12):
            p[x, row] = hex_to_rgba(COLORS["skin"])
        if row == 6:
            p[10, row] = hex_to_rgba(COLORS["eyes"])  # Eye

    # Row 8: Chin
    for x in range(6, 12):
        p[x, 8] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 11):
        p[x, 8] = hex_to_rgba(COLORS["skin"])

    # Row 9: Neck
    for x in range(7, 10):
        p[x, 9] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(8, 9):
        p[x, 9] = hex_to_rgba(COLORS["skin"])

    # Row 10-15: Uniform (side) - includes arm
    for row in range(10, 16):
        for x in range(5, 12):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(6, 11):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])
        # Arm on right side
        p[11, row] = hex_to_rgba(COLORS["uniform_blue_shadow"])

    # Row 16-19: Skirt (side)
    for row in range(16, 20):
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 20-23: Legs + shoes (side - one leg visible)
    for x in range(6, 10):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 9):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    for x in range(6, 10):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(7, 9):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_fae_west(output_path):
    """Fae facing west (left) - idle frame. Mirror of east."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()

    # Side view - character shifted slightly left, narrower
    # Row 0-3: Hair (side profile) - mirrored from east
    for x in range(4, 10):
        p[x, 0] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(3, 11):
        p[x, 1] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 10):
        p[x, 1] = hex_to_rgba(COLORS["hair"])

    for row in range(2, 5):
        for x in range(3, 12):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        for x in range(4, 11):
            p[x, row] = hex_to_rgba(COLORS["hair"])

    # Row 5-8: Face (side) - face shows on left side
    for x in range(3, 12):
        p[x, 5] = hex_to_rgba(COLORS["hair_outline"])
    for x in range(4, 11):
        p[x, 5] = hex_to_rgba(COLORS["hair"])
    for x in range(3, 7):
        p[x, 5] = hex_to_rgba(COLORS["skin"])
    p[3, 5] = hex_to_rgba(COLORS["skin_outline"])

    for row in range(6, 8):
        for x in range(10, 12):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        p[10, row] = hex_to_rgba(COLORS["hair"])
        for x in range(3, 10):
            p[x, row] = hex_to_rgba(COLORS["skin_outline"])
        for x in range(4, 9):
            p[x, row] = hex_to_rgba(COLORS["skin"])
        if row == 6:
            p[5, row] = hex_to_rgba(COLORS["eyes"])  # Eye

    # Row 8: Chin
    for x in range(4, 10):
        p[x, 8] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(5, 9):
        p[x, 8] = hex_to_rgba(COLORS["skin"])

    # Row 9: Neck
    for x in range(6, 9):
        p[x, 9] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 8):
        p[x, 9] = hex_to_rgba(COLORS["skin"])

    # Row 10-15: Uniform (side) - includes arm
    for row in range(10, 16):
        for x in range(4, 11):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(5, 10):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])
        # Arm on left side
        p[4, row] = hex_to_rgba(COLORS["uniform_blue_shadow"])

    # Row 16-19: Skirt (side)
    for row in range(16, 20):
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 20-23: Legs + shoes (side - one leg visible)
    for x in range(6, 10):
        p[x, 20] = hex_to_rgba(COLORS["skin_outline"])
        p[x, 21] = hex_to_rgba(COLORS["skin_outline"])
    for x in range(7, 9):
        p[x, 20] = hex_to_rgba(COLORS["skin"])
        p[x, 21] = hex_to_rgba(COLORS["skin"])

    for x in range(6, 10):
        p[x, 22] = hex_to_rgba(COLORS["shoes_outline"])
        p[x, 23] = hex_to_rgba(COLORS["shoes_outline"])
    for x in range(7, 9):
        p[x, 22] = hex_to_rgba(COLORS["shoes"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_fae_diagonal(output_path, direction):
    """
    Create diagonal-facing sprites (NE, SE, SW, NW).
    These are 3/4 views combining front/back + side elements.
    """
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()

    # Determine which way we're facing
    facing_south = direction in ["se", "sw"]
    facing_east = direction in ["ne", "se"]

    # Offset character slightly in direction of movement
    x_offset = 1 if facing_east else -1

    # Row 0-4: Hair
    center = 8 + (x_offset // 2)
    for row in range(5):
        width = 4 + row if row < 3 else 5
        left = center - width // 2
        right = center + width // 2 + 1
        for x in range(max(0, left - 1), min(16, right + 1)):
            p[x, row] = hex_to_rgba(COLORS["hair_outline"])
        for x in range(max(0, left), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["hair"])
        # Highlight
        if row >= 1 and row <= 3:
            for x in range(center - 1, center + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["hair_highlight"])

    # Row 5-8: Face
    for row in range(5, 9):
        left = center - 4
        right = center + 4
        # Hair on sides
        if row < 8:
            for x in range(max(0, left - 1), min(16, left + 1)):
                p[x, row] = hex_to_rgba(COLORS["hair_outline"])
            p[max(0, left), row] = hex_to_rgba(COLORS["hair"])
            for x in range(max(0, right - 1), min(16, right + 1)):
                p[x, row] = hex_to_rgba(COLORS["hair_outline"])
            p[min(15, right - 1), row] = hex_to_rgba(COLORS["hair"])

        # Face
        for x in range(max(0, left + 1), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["skin_outline"])
        for x in range(max(0, left + 2), min(16, right - 1)):
            p[x, row] = hex_to_rgba(COLORS["skin"])

        # Eyes (only on front-facing rows and if facing south)
        if facing_south and row == 6:
            eye_left = center - 2
            eye_right = center + 2
            if 0 <= eye_left < 16:
                p[eye_left, row] = hex_to_rgba(COLORS["eyes"])
            if 0 <= eye_right < 16:
                p[eye_right, row] = hex_to_rgba(COLORS["eyes"])

    # Row 9: Neck
    for x in range(center - 1, center + 2):
        if 0 <= x < 16:
            p[x, 9] = hex_to_rgba(COLORS["skin_outline"])
    p[center, 9] = hex_to_rgba(COLORS["skin"])

    # Row 10-15: Uniform torso
    for row in range(10, 16):
        left = center - 4
        right = center + 5
        for x in range(max(0, left), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(max(0, left + 1), min(16, right - 1)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])
        # Collar on row 10-11 if facing south
        if facing_south and row <= 11:
            for x in range(center - 1, center + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["uniform_white"])

    # Row 16-19: Skirt
    for row in range(16, 20):
        flare = (row - 16) // 2
        left = center - 4 - flare
        right = center + 5 + flare
        for x in range(max(0, left), min(16, right)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue_outline"])
        for x in range(max(0, left + 1), min(16, right - 1)):
            p[x, row] = hex_to_rgba(COLORS["uniform_blue"])

    # Row 20-23: Legs positioned for diagonal walking
    # Leading leg further in direction of movement
    lead_x = center + (2 if facing_east else -2)
    trail_x = center + (-1 if facing_east else 1)

    for row in range(20, 22):
        # Leading leg
        for x in range(lead_x - 1, lead_x + 2):
            if 0 <= x < 16:
                p[x, row] = hex_to_rgba(COLORS["skin_outline"])
        if 0 <= lead_x < 16:
            p[lead_x, row] = hex_to_rgba(COLORS["skin"])
        # Trailing leg
        for x in range(trail_x - 1, trail_x + 2):
            if 0 <= x < 16:
                p[x, row] = hex_to_rgba(COLORS["skin_outline"])
        if 0 <= trail_x < 16:
            p[trail_x, row] = hex_to_rgba(COLORS["skin"])

    # Shoes
    for row in range(22, 24):
        for x in range(lead_x - 1, lead_x + 2):
            if 0 <= x < 16:
                p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
        if 0 <= lead_x < 16:
            p[lead_x, row] = hex_to_rgba(COLORS["shoes"])
        for x in range(trail_x - 1, trail_x + 2):
            if 0 <= x < 16:
                p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
        if 0 <= trail_x < 16:
            p[trail_x, row] = hex_to_rgba(COLORS["shoes"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_walk_frame(base_sprite_path, output_path, frame_num, direction):
    """
    Create a walk animation frame by modifying leg positions.
    frame_num: 0-3 (4 frame walk cycle)
    """
    # Load the base idle sprite
    img = Image.open(base_sprite_path).copy()
    p = img.load()

    # Clear existing leg area (rows 20-23)
    for y in range(20, 24):
        for x in range(16):
            p[x, y] = (0, 0, 0, 0)

    # Determine center and leg positions based on frame
    center = 8
    if direction in ["east", "ne", "se"]:
        center = 8
    elif direction in ["west", "nw", "sw"]:
        center = 7

    # Walk cycle leg positions (simple 4-frame cycle)
    # Frame 0: legs together (neutral)
    # Frame 1: left leg forward, right leg back
    # Frame 2: legs together (passing)
    # Frame 3: right leg forward, left leg back

    if direction in ["south", "north"]:
        left_leg = center - 3
        right_leg = center + 2

        # Leg offset for walk cycle
        # Frame 0,2: neutral. Frame 1: left forward. Frame 3: right forward.
        if frame_num == 0 or frame_num == 2:
            left_offset = 0
            right_offset = 0
        elif frame_num == 1:
            # Left leg forward, right leg back
            left_offset = 1
            right_offset = -1
        else:  # frame_num == 3
            # Right leg forward, left leg back
            left_offset = -1
            right_offset = 1

        # Draw legs with vertical offset to show depth
        for row in range(20, 22):
            # Left leg - apply offset
            lx = left_leg
            ly_offset = -left_offset if left_offset > 0 else 0  # Forward = higher
            for x in range(lx, lx + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["skin_outline"])
            if 0 <= lx < 16:
                p[lx, row] = hex_to_rgba(COLORS["skin"])

            # Right leg - apply offset
            rx = right_leg
            for x in range(rx, rx + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["skin_outline"])
            if 0 <= rx < 16:
                p[rx, row] = hex_to_rgba(COLORS["skin"])

        # Shoes - horizontal offset shows stride
        for row in range(22, 24):
            lx = left_leg + left_offset
            for x in range(lx, lx + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
            if 0 <= lx < 16 and row == 22:
                p[lx, row] = hex_to_rgba(COLORS["shoes"])

            rx = right_leg + right_offset
            for x in range(rx, rx + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
            if 0 <= rx < 16 and row == 22:
                p[rx, row] = hex_to_rgba(COLORS["shoes"])

    elif direction in ["east", "west"]:
        # Side view - legs move forward/back
        leg_x = 7 if direction == "east" else 7

        if frame_num == 0 or frame_num == 2:
            offset = 0
        elif frame_num == 1:
            offset = 1 if direction == "east" else -1
        else:
            offset = -1 if direction == "east" else 1

        for row in range(20, 22):
            for x in range(leg_x - 1, leg_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["skin_outline"])
            p[leg_x, row] = hex_to_rgba(COLORS["skin"])

        for row in range(22, 24):
            shoe_x = leg_x + offset
            for x in range(shoe_x - 1, shoe_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
            if 0 <= shoe_x < 16:
                p[shoe_x, row] = hex_to_rgba(COLORS["shoes"])

    else:
        # Diagonal - simplified leg movement
        facing_east = direction in ["ne", "se"]
        lead_x = center + (2 if facing_east else -2)
        trail_x = center + (-1 if facing_east else 1)

        # Swap lead/trail based on frame
        if frame_num == 1 or frame_num == 2:
            lead_x, trail_x = trail_x, lead_x

        for row in range(20, 22):
            for x in range(lead_x - 1, lead_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["skin_outline"])
            if 0 <= lead_x < 16:
                p[lead_x, row] = hex_to_rgba(COLORS["skin"])
            for x in range(trail_x - 1, trail_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["skin_outline"])
            if 0 <= trail_x < 16:
                p[trail_x, row] = hex_to_rgba(COLORS["skin"])

        for row in range(22, 24):
            for x in range(lead_x - 1, lead_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["shoes_outline"])
            for x in range(trail_x - 1, trail_x + 2):
                if 0 <= x < 16:
                    p[x, row] = hex_to_rgba(COLORS["shoes_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    # Output directory
    output_dir = "game/assets/sprites/characters/player/default"
    os.makedirs(output_dir, exist_ok=True)

    # Generate idle sprites for 8 directions
    directions = {
        "south": create_fae_south,
        "north": create_fae_north,
        "east": create_fae_east,
        "west": create_fae_west,
    }

    # Cardinal directions
    for direction, create_func in directions.items():
        idle_path = os.path.join(output_dir, f"idle_{direction}.png")
        create_func(idle_path)

    # Diagonal directions
    for diag in ["ne", "se", "sw", "nw"]:
        idle_path = os.path.join(output_dir, f"idle_{diag}.png")
        create_fae_diagonal(idle_path, diag)

    # Create main idle.png (south-facing, for costume system)
    create_fae_south(os.path.join(output_dir, "idle.png"))

    # Generate walk cycle frames (4 frames per direction)
    all_directions = ["south", "north", "east", "west", "ne", "se", "sw", "nw"]
    for direction in all_directions:
        base_path = os.path.join(output_dir, f"idle_{direction}.png")
        for frame in range(4):
            walk_path = os.path.join(output_dir, f"walk_{direction}_{frame}.png")
            create_walk_frame(base_path, walk_path, frame, direction)

    print(f"\nGenerated Fae character sprites:")
    print(f"  - 8 idle directions + idle.png (9 sprites)")
    print(f"  - 8 directions × 4 walk frames (32 sprites)")
    print(f"  Total: 41 sprites in {output_dir}/")


if __name__ == "__main__":
    main()
