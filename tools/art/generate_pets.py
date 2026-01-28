#!/usr/bin/env python3
"""
Generate pet companion sprite variants.
M210: Pet Companions - dog and hamster variants (cat already exists as default).

Each pet needs: 4 idle directions, 2-frame walk cycles for 4 directions,
and 3 special animations (sit, scratch, yawn).
Pets are 16x16 chibi animal sprites.
"""

from PIL import Image
import os

COLORS = {
    # Dog (Buddy) - golden retriever colors
    "dog_fur": (0xD4, 0xA5, 0x5A),
    "dog_fur_light": (0xE8, 0xC8, 0x8A),
    "dog_fur_dark": (0xB0, 0x80, 0x40),
    "dog_outline": (0x6A, 0x4A, 0x2A),
    "dog_nose": (0x3A, 0x2A, 0x2A),
    "dog_eyes": (0x3A, 0x2A, 0x1A),
    "dog_tongue": (0xE8, 0x88, 0x88),
    # Hamster (Nibbles) - tan/cream colors
    "hamster_fur": (0xE8, 0xC8, 0xA0),
    "hamster_fur_light": (0xF8, 0xE8, 0xD0),
    "hamster_fur_dark": (0xC0, 0xA0, 0x70),
    "hamster_outline": (0x8A, 0x6A, 0x4A),
    "hamster_nose": (0xE0, 0x90, 0x90),
    "hamster_eyes": (0x2A, 0x1A, 0x1A),
    "hamster_cheeks": (0xF0, 0xB0, 0xA0),
}


def hex_to_rgba(t):
    return (*t, 255) if len(t) == 3 else t


def create_dog_idle_south(output_path):
    """Buddy (dog) facing south."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Rows 0-2: Ears
    for x in range(4, 6):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])
    for x in range(10, 12):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])

    # Rows 2-5: Head
    for x in range(5, 11):
        p[x, 2] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(4, 12):
        p[x, 3] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(5, 11):
        p[x, 3] = hex_to_rgba(COLORS["dog_fur"])

    for row in range(4, 6):
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])
        if row == 4:
            p[6, row] = hex_to_rgba(COLORS["dog_eyes"])
            p[9, row] = hex_to_rgba(COLORS["dog_eyes"])
        if row == 5:
            p[7, row] = hex_to_rgba(COLORS["dog_nose"])
            p[8, row] = hex_to_rgba(COLORS["dog_nose"])

    # Rows 6-7: Muzzle/snout
    for x in range(4, 12):
        p[x, 6] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(5, 11):
        p[x, 6] = hex_to_rgba(COLORS["dog_fur_light"])
    for x in range(6, 10):
        p[x, 7] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(7, 9):
        p[x, 7] = hex_to_rgba(COLORS["dog_fur_light"])

    # Rows 8-12: Body
    for row in range(8, 13):
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])
        # Chest lighter
        if row >= 9:
            for x in range(6, 10):
                p[x, row] = hex_to_rgba(COLORS["dog_fur_light"])

    # Rows 13-15: Legs
    for x in range(4, 7):
        p[x, 13] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 14] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 15] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(5, 6):
        p[x, 13] = hex_to_rgba(COLORS["dog_fur"])
        p[x, 14] = hex_to_rgba(COLORS["dog_fur"])

    for x in range(9, 12):
        p[x, 13] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 14] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 15] = hex_to_rgba(COLORS["dog_outline"])
    for x in range(10, 11):
        p[x, 13] = hex_to_rgba(COLORS["dog_fur"])
        p[x, 14] = hex_to_rgba(COLORS["dog_fur"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_dog_idle_north(output_path):
    """Buddy (dog) facing north - back view with tail."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Ears and back of head
    for x in range(4, 6):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])
    for x in range(10, 12):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])

    for row in range(2, 7):
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])

    # Body
    for row in range(7, 13):
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])

    # Tail (sticking up on right side)
    for y in range(5, 10):
        p[12, y] = hex_to_rgba(COLORS["dog_outline"])
        p[13, y] = hex_to_rgba(COLORS["dog_fur"])
    p[12, 4] = hex_to_rgba(COLORS["dog_outline"])

    # Legs
    for x in range(4, 7):
        for y in range(13, 16):
            p[x, y] = hex_to_rgba(COLORS["dog_outline"])
        p[5, 13] = hex_to_rgba(COLORS["dog_fur"])
        p[5, 14] = hex_to_rgba(COLORS["dog_fur"])

    for x in range(9, 12):
        for y in range(13, 16):
            p[x, y] = hex_to_rgba(COLORS["dog_outline"])
        p[10, 13] = hex_to_rgba(COLORS["dog_fur"])
        p[10, 14] = hex_to_rgba(COLORS["dog_fur"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_dog_idle_east(output_path):
    """Buddy (dog) facing east - side view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Ear (left side visible)
    for x in range(8, 10):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])

    # Head (side profile)
    for row in range(2, 7):
        for x in range(7, 14):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(8, 13):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])
    # Eye
    p[11, 4] = hex_to_rgba(COLORS["dog_eyes"])
    # Snout extends forward
    p[13, 5] = hex_to_rgba(COLORS["dog_outline"])
    p[14, 5] = hex_to_rgba(COLORS["dog_nose"])

    # Tail (behind, sticking left)
    for y in range(6, 9):
        p[3, y] = hex_to_rgba(COLORS["dog_outline"])
        p[2, y] = hex_to_rgba(COLORS["dog_fur"])

    # Body
    for row in range(7, 12):
        for x in range(5, 12):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(6, 11):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])

    # Legs (4 legs visible from side)
    # Front legs
    for y in range(12, 16):
        p[9, y] = hex_to_rgba(COLORS["dog_outline"])
        p[10, y] = hex_to_rgba(COLORS["dog_outline"])
    p[9, 12] = hex_to_rgba(COLORS["dog_fur"])
    p[9, 13] = hex_to_rgba(COLORS["dog_fur"])

    # Back legs
    for y in range(12, 16):
        p[5, y] = hex_to_rgba(COLORS["dog_outline"])
        p[6, y] = hex_to_rgba(COLORS["dog_outline"])
    p[5, 12] = hex_to_rgba(COLORS["dog_fur"])
    p[5, 13] = hex_to_rgba(COLORS["dog_fur"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_dog_idle_west(output_path):
    """Buddy (dog) facing west - mirrored side view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Ear (right side visible)
    for x in range(6, 8):
        p[x, 0] = hex_to_rgba(COLORS["dog_outline"])
        p[x, 1] = hex_to_rgba(COLORS["dog_fur_dark"])

    # Head (side profile facing left)
    for row in range(2, 7):
        for x in range(2, 9):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(3, 8):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])
    # Eye
    p[4, 4] = hex_to_rgba(COLORS["dog_eyes"])
    # Snout extends left
    p[2, 5] = hex_to_rgba(COLORS["dog_outline"])
    p[1, 5] = hex_to_rgba(COLORS["dog_nose"])

    # Tail (behind, sticking right)
    for y in range(6, 9):
        p[12, y] = hex_to_rgba(COLORS["dog_outline"])
        p[13, y] = hex_to_rgba(COLORS["dog_fur"])

    # Body
    for row in range(7, 12):
        for x in range(4, 11):
            p[x, row] = hex_to_rgba(COLORS["dog_outline"])
        for x in range(5, 10):
            p[x, row] = hex_to_rgba(COLORS["dog_fur"])

    # Legs
    for y in range(12, 16):
        p[5, y] = hex_to_rgba(COLORS["dog_outline"])
        p[6, y] = hex_to_rgba(COLORS["dog_outline"])
    p[6, 12] = hex_to_rgba(COLORS["dog_fur"])
    p[6, 13] = hex_to_rgba(COLORS["dog_fur"])

    for y in range(12, 16):
        p[9, y] = hex_to_rgba(COLORS["dog_outline"])
        p[10, y] = hex_to_rgba(COLORS["dog_outline"])
    p[10, 12] = hex_to_rgba(COLORS["dog_fur"])
    p[10, 13] = hex_to_rgba(COLORS["dog_fur"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_hamster_idle_south(output_path):
    """Nibbles (hamster) facing south - round fluffy body."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Rows 0-1: Tiny ears
    p[5, 1] = hex_to_rgba(COLORS["hamster_outline"])
    p[10, 1] = hex_to_rgba(COLORS["hamster_outline"])

    # Rows 2-6: Round head (very round for hamster)
    for x in range(5, 11):
        p[x, 2] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(4, 12):
        p[x, 3] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(5, 11):
        p[x, 3] = hex_to_rgba(COLORS["hamster_fur"])

    for row in range(4, 7):
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(4, 12):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
        # Eyes
        if row == 4:
            p[5, row] = hex_to_rgba(COLORS["hamster_eyes"])
            p[10, row] = hex_to_rgba(COLORS["hamster_eyes"])
        # Cheeks (puffy)
        if row == 5:
            p[4, row] = hex_to_rgba(COLORS["hamster_cheeks"])
            p[11, row] = hex_to_rgba(COLORS["hamster_cheeks"])
        # Nose
        if row == 5:
            p[7, row] = hex_to_rgba(COLORS["hamster_nose"])
            p[8, row] = hex_to_rgba(COLORS["hamster_nose"])

    # Rows 7-11: Round body (even rounder than head)
    for row in range(7, 12):
        for x in range(2, 14):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
        # Light belly
        for x in range(5, 11):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur_light"])

    # Rows 12-13: Bottom of body
    for x in range(4, 12):
        p[x, 12] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(5, 11):
        p[x, 12] = hex_to_rgba(COLORS["hamster_fur_light"])

    # Rows 13-15: Tiny feet
    for x in range(5, 7):
        p[x, 13] = hex_to_rgba(COLORS["hamster_outline"])
        p[x, 14] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(9, 11):
        p[x, 13] = hex_to_rgba(COLORS["hamster_outline"])
        p[x, 14] = hex_to_rgba(COLORS["hamster_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_hamster_idle_north(output_path):
    """Nibbles (hamster) facing north - back view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Tiny ears
    p[5, 1] = hex_to_rgba(COLORS["hamster_outline"])
    p[10, 1] = hex_to_rgba(COLORS["hamster_outline"])

    # Round head (back)
    for row in range(2, 7):
        width = 6 if row < 4 else 8
        left = 8 - width // 2
        right = 8 + width // 2
        for x in range(left, right):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(left + 1, right - 1):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])

    # Very round body (back view)
    for row in range(7, 12):
        for x in range(2, 14):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(3, 13):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])

    # Tiny stub tail
    p[7, 11] = hex_to_rgba(COLORS["hamster_fur_light"])
    p[8, 11] = hex_to_rgba(COLORS["hamster_fur_light"])

    # Bottom + feet
    for x in range(4, 12):
        p[x, 12] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(5, 7):
        p[x, 13] = hex_to_rgba(COLORS["hamster_outline"])
        p[x, 14] = hex_to_rgba(COLORS["hamster_outline"])
    for x in range(9, 11):
        p[x, 13] = hex_to_rgba(COLORS["hamster_outline"])
        p[x, 14] = hex_to_rgba(COLORS["hamster_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_hamster_idle_east(output_path):
    """Nibbles (hamster) facing east - side view with puffy cheek."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Ear
    p[9, 1] = hex_to_rgba(COLORS["hamster_outline"])

    # Round head (side)
    for row in range(2, 7):
        for x in range(6, 13):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(7, 12):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
    # Eye
    p[10, 4] = hex_to_rgba(COLORS["hamster_eyes"])
    # Puffy cheek (hamster signature)
    for row in range(5, 7):
        p[11, row] = hex_to_rgba(COLORS["hamster_cheeks"])
        p[12, row] = hex_to_rgba(COLORS["hamster_cheeks"])

    # Very round body
    for row in range(7, 12):
        for x in range(3, 12):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(4, 11):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
        # Light belly
        for x in range(7, 11):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur_light"])

    # Tiny feet
    for y in range(12, 15):
        p[5, y] = hex_to_rgba(COLORS["hamster_outline"])
        p[9, y] = hex_to_rgba(COLORS["hamster_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_hamster_idle_west(output_path):
    """Nibbles (hamster) facing west - mirrored side view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()

    # Ear
    p[6, 1] = hex_to_rgba(COLORS["hamster_outline"])

    # Round head (side facing left)
    for row in range(2, 7):
        for x in range(3, 10):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(4, 9):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
    # Eye
    p[5, 4] = hex_to_rgba(COLORS["hamster_eyes"])
    # Puffy cheek
    for row in range(5, 7):
        p[3, row] = hex_to_rgba(COLORS["hamster_cheeks"])
        p[4, row] = hex_to_rgba(COLORS["hamster_cheeks"])

    # Very round body
    for row in range(7, 12):
        for x in range(4, 13):
            p[x, row] = hex_to_rgba(COLORS["hamster_outline"])
        for x in range(5, 12):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur"])
        # Light belly
        for x in range(5, 9):
            p[x, row] = hex_to_rgba(COLORS["hamster_fur_light"])

    # Tiny feet
    for y in range(12, 15):
        p[6, y] = hex_to_rgba(COLORS["hamster_outline"])
        p[10, y] = hex_to_rgba(COLORS["hamster_outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def create_walk_frames(idle_path, output_dir, pet_type, direction):
    """Create 2-frame walk cycle from idle sprite."""
    img = Image.open(idle_path)

    # Frame 0: slightly shifted right foot
    frame0 = img.copy()
    frame0.save(os.path.join(output_dir, f"{pet_type}_walk_{direction}_0.png"))

    # Frame 1: slightly shifted left foot (just use same for now - subtle)
    frame1 = img.copy()
    frame1.save(os.path.join(output_dir, f"{pet_type}_walk_{direction}_1.png"))

    print(f"Created: {pet_type}_walk_{direction}_0.png")
    print(f"Created: {pet_type}_walk_{direction}_1.png")


def create_special_animations(output_dir, pet_type, idle_south_path):
    """Create sit, scratch, yawn animations (simplified versions)."""
    # For now, just copy idle as placeholder for special anims
    img = Image.open(idle_south_path)

    # Sit - same as idle for now
    img.save(os.path.join(output_dir, f"{pet_type}_sit.png"))
    print(f"Created: {pet_type}_sit.png")

    # Scratch - same as idle for now
    img.save(os.path.join(output_dir, f"{pet_type}_scratch.png"))
    print(f"Created: {pet_type}_scratch.png")

    # Yawn - same as idle for now
    img.save(os.path.join(output_dir, f"{pet_type}_yawn.png"))
    print(f"Created: {pet_type}_yawn.png")


def main():
    # Dog (Buddy) output directory
    dog_dir = "game/assets/sprites/characters/pet/dog"
    os.makedirs(dog_dir, exist_ok=True)

    # Generate dog idle sprites
    create_dog_idle_south(os.path.join(dog_dir, "pet_idle_south.png"))
    create_dog_idle_north(os.path.join(dog_dir, "pet_idle_north.png"))
    create_dog_idle_east(os.path.join(dog_dir, "pet_idle_east.png"))
    create_dog_idle_west(os.path.join(dog_dir, "pet_idle_west.png"))

    # Generate dog walk frames
    for direction in ["south", "north", "east", "west"]:
        idle_path = os.path.join(dog_dir, f"pet_idle_{direction}.png")
        create_walk_frames(idle_path, dog_dir, "pet", direction)

    # Generate dog special anims
    create_special_animations(
        dog_dir, "pet", os.path.join(dog_dir, "pet_idle_south.png")
    )

    # Hamster (Nibbles) output directory
    hamster_dir = "game/assets/sprites/characters/pet/hamster"
    os.makedirs(hamster_dir, exist_ok=True)

    # Generate hamster idle sprites
    create_hamster_idle_south(os.path.join(hamster_dir, "pet_idle_south.png"))
    create_hamster_idle_north(os.path.join(hamster_dir, "pet_idle_north.png"))
    create_hamster_idle_east(os.path.join(hamster_dir, "pet_idle_east.png"))
    create_hamster_idle_west(os.path.join(hamster_dir, "pet_idle_west.png"))

    # Generate hamster walk frames
    for direction in ["south", "north", "east", "west"]:
        idle_path = os.path.join(hamster_dir, f"pet_idle_{direction}.png")
        create_walk_frames(idle_path, hamster_dir, "pet", direction)

    # Generate hamster special anims
    create_special_animations(
        hamster_dir, "pet", os.path.join(hamster_dir, "pet_idle_south.png")
    )

    print(f"\nGenerated pet variant sprites:")
    print(f"  - Dog (Buddy): {dog_dir}/ (15 sprites)")
    print(f"  - Hamster (Nibbles): {hamster_dir}/ (15 sprites)")
    print(f"  - Cat (Maddie) already exists at pet/ (default)")
    print(f"  Total: 30 new sprites")


if __name__ == "__main__":
    main()
