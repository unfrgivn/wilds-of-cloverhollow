#!/usr/bin/env python3
"""Generate building facade sprites using the Cloverhollow palette.

Creates 48x64 building facades for town exterior scenes.
All sprites follow the cozy storybook JRPG style with colored outlines.
"""

from PIL import Image
import os

COLORS = {
    # Walls
    "wall_cream": (0xF5, 0xEA, 0xD6),
    "wall_cream_mid": (0xE8, 0xDC, 0xC4),
    "wall_cream_dark": (0xD4, 0xC8, 0xA8),
    "wall_pink": (0xF0, 0xD8, 0xD8),
    "wall_pink_dark": (0xD8, 0xC0, 0xC0),
    "wall_blue": (0xD8, 0xE8, 0xF0),
    "wall_blue_dark": (0xC0, 0xD0, 0xD8),
    "wall_green": (0xD8, 0xE8, 0xD8),
    "wall_green_dark": (0xC0, 0xD0, 0xC0),
    # Roof terracotta
    "roof_light": (0xCC, 0x88, 0x66),
    "roof_mid": (0xAA, 0x66, 0x44),
    "roof_dark": (0x88, 0x44, 0x33),
    # Roof blue
    "roof_blue_light": (0x66, 0x88, 0xAA),
    "roof_blue_mid": (0x44, 0x66, 0x88),
    "roof_blue_dark": (0x33, 0x44, 0x66),
    # Wood
    "wood_light": (0xB5, 0x8A, 0x4D),
    "wood_mid": (0x8A, 0x6B, 0x3F),
    "wood_dark": (0x5A, 0x4A, 0x3A),
    # Windows
    "window_light": (0x88, 0xCC, 0xEE),
    "window_dark": (0x44, 0x88, 0xBB),
    "window_frame": (0x5A, 0x4A, 0x3A),
    # Awning colors
    "awning_red": (0xCC, 0x66, 0x55),
    "awning_red_dark": (0xAA, 0x44, 0x44),
    "awning_green": (0x66, 0xAA, 0x66),
    "awning_green_dark": (0x44, 0x88, 0x44),
    "awning_blue": (0x55, 0x88, 0xCC),
    "awning_blue_dark": (0x44, 0x66, 0xAA),
    # Metal
    "metal_light": (0x8A, 0x7A, 0x5A),
    "metal_dark": (0x4A, 0x3A, 0x2A),
    # Outlines
    "outline": (0x3D, 0x32, 0x28),
}


def hex_to_rgba(hex_tuple):
    return (*hex_tuple, 255) if len(hex_tuple) == 3 else hex_tuple


def draw_rect(pixels, x1, y1, x2, y2, color):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            pixels[x, y] = color


def draw_window(pixels, x, y, w=6, h=8):
    """Draw a standard window at position (x,y) with width w and height h."""
    outline = hex_to_rgba(COLORS["outline"])
    frame = hex_to_rgba(COLORS["window_frame"])
    light = hex_to_rgba(COLORS["window_light"])
    dark = hex_to_rgba(COLORS["window_dark"])

    # Frame outline
    for dx in range(w):
        pixels[x + dx, y] = outline
        pixels[x + dx, y + h - 1] = outline
    for dy in range(h):
        pixels[x, y + dy] = outline
        pixels[x + w - 1, y + dy] = outline

    # Window panes
    for dy in range(1, h - 1):
        for dx in range(1, w - 1):
            pixels[x + dx, y + dy] = light if dy < h // 2 else dark

    # Cross frame
    mid_x = x + w // 2
    mid_y = y + h // 2
    for dy in range(1, h - 1):
        pixels[mid_x, y + dy] = frame
    for dx in range(1, w - 1):
        pixels[x + dx, mid_y] = frame


def draw_door(pixels, x, y, w=8, h=14):
    """Draw a standard door at position (x,y)."""
    outline = hex_to_rgba(COLORS["outline"])
    wood_l = hex_to_rgba(COLORS["wood_light"])
    wood_m = hex_to_rgba(COLORS["wood_mid"])
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    metal = hex_to_rgba(COLORS["metal_dark"])

    # Door frame
    for dx in range(w):
        pixels[x + dx, y] = outline
        pixels[x + dx, y + h - 1] = outline
    for dy in range(h):
        pixels[x, y + dy] = outline
        pixels[x + w - 1, y + dy] = outline

    # Door body
    for dy in range(1, h - 1):
        for dx in range(1, w - 1):
            if dx < w // 2:
                pixels[x + dx, y + dy] = wood_l
            else:
                pixels[x + dx, y + dy] = wood_m

    # Door panels
    draw_rect(pixels, x + 2, y + 2, x + w - 3, y + 5, wood_d)
    draw_rect(pixels, x + 2, y + 7, x + w - 3, y + h - 4, wood_d)

    # Handle
    pixels[x + w - 3, y + h // 2] = metal


def create_general_store(output_path):
    """Create a 48x64 general store facade."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_cream"])
    wall_dark = hex_to_rgba(COLORS["wall_cream_dark"])
    roof_l = hex_to_rgba(COLORS["roof_light"])
    roof_m = hex_to_rgba(COLORS["roof_mid"])
    roof_d = hex_to_rgba(COLORS["roof_dark"])
    awning = hex_to_rgba(COLORS["awning_green"])
    awning_d = hex_to_rgba(COLORS["awning_green_dark"])

    # Roof (rows 0-15)
    for y in range(0, 16):
        for x in range(4, 44):
            if y < 4:
                pixels[x, y] = roof_l
            elif y < 10:
                pixels[x, y] = roof_m
            else:
                pixels[x, y] = roof_d

    # Roof outline
    for x in range(4, 44):
        pixels[x, 0] = outline
        pixels[x, 15] = outline
    for y in range(0, 16):
        pixels[4, y] = outline
        pixels[43, y] = outline

    # Wall (rows 16-55)
    for y in range(16, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Awning (rows 20-26)
    for y in range(20, 27):
        for x in range(2, 46):
            stripe = (x // 4) % 2
            if y == 20 or y == 26:
                pixels[x, y] = outline
            else:
                pixels[x, y] = awning if stripe == 0 else awning_d

    # Windows (2 on upper floor)
    draw_window(pixels, 10, 28, 8, 10)
    draw_window(pixels, 30, 28, 8, 10)

    # Door (center)
    draw_door(pixels, 20, 42, 8, 14)

    # Display windows (flanking door)
    draw_window(pixels, 8, 44, 10, 10)
    draw_window(pixels, 30, 44, 10, 10)

    # Ground (rows 56-63)
    for y in range(56, 64):
        for x in range(0, 48):
            pixels[x, y] = outline if y == 56 else (0, 0, 0, 0)

    img.save(output_path)
    print(f"Created: {output_path}")


def create_school(output_path):
    """Create a 48x64 school facade."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_cream"])
    wall_dark = hex_to_rgba(COLORS["wall_cream_dark"])
    roof_l = hex_to_rgba(COLORS["roof_blue_light"])
    roof_m = hex_to_rgba(COLORS["roof_blue_mid"])
    roof_d = hex_to_rgba(COLORS["roof_blue_dark"])
    awning = hex_to_rgba(COLORS["awning_blue"])
    awning_d = hex_to_rgba(COLORS["awning_blue_dark"])

    # Peaked roof (triangular top)
    for y in range(0, 12):
        margin = y
        for x in range(4 + margin, 44 - margin):
            if y < 4:
                pixels[x, y] = roof_l
            elif y < 8:
                pixels[x, y] = roof_m
            else:
                pixels[x, y] = roof_d
            if x == 4 + margin or x == 43 - margin:
                pixels[x, y] = outline

    # Roof base
    for x in range(4, 44):
        pixels[x, 12] = outline

    # Wall (rows 13-55)
    for y in range(13, 56):
        for x in range(6, 42):
            if x == 6 or x == 41:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Clock area (center top)
    for y in range(14, 20):
        for x in range(20, 28):
            pixels[x, y] = (
                outline if (x == 20 or x == 27 or y == 14 or y == 19) else wall
            )

    # Windows (3 on each floor)
    for wx in [10, 20, 30]:
        draw_window(pixels, wx, 24, 6, 8)
        draw_window(pixels, wx, 44, 6, 8)

    # Double doors (center)
    draw_door(pixels, 18, 44, 6, 12)
    draw_door(pixels, 24, 44, 6, 12)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_arcade(output_path):
    """Create a 48x64 arcade facade with neon accents."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba((0x3A, 0x2A, 0x4A))  # Dark purple
    wall_dark = hex_to_rgba((0x2A, 0x1A, 0x3A))
    neon_pink = hex_to_rgba((0xFF, 0x66, 0xAA))
    neon_cyan = hex_to_rgba((0x66, 0xFF, 0xEE))

    # Flat top (rows 0-8)
    for y in range(0, 9):
        for x in range(4, 44):
            if y == 0 or y == 8:
                pixels[x, y] = outline
            elif x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall_dark

    # Neon sign area
    for x in range(10, 38):
        pixels[x, 3] = neon_pink
        pixels[x, 5] = neon_cyan

    # Wall (rows 9-55)
    for y in range(9, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 35 else wall_dark

    # Large display window
    draw_rect(pixels, 8, 20, 39, 38, hex_to_rgba(COLORS["window_dark"]))
    for x in range(8, 40):
        pixels[x, 20] = outline
        pixels[x, 38] = outline
    for y in range(20, 39):
        pixels[8, y] = outline
        pixels[39, y] = outline

    # Neon border on window
    for x in range(9, 39):
        pixels[x, 21] = neon_pink
        pixels[x, 37] = neon_cyan
    for y in range(21, 38):
        pixels[9, y] = neon_pink
        pixels[38, y] = neon_cyan

    # Door
    draw_door(pixels, 20, 42, 8, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_library(output_path):
    """Create a 48x64 library facade with columns."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_cream"])
    wall_dark = hex_to_rgba(COLORS["wall_cream_dark"])
    stone = hex_to_rgba((0xCC, 0xC4, 0xB8))
    stone_dark = hex_to_rgba((0xA8, 0xA0, 0x94))
    roof = hex_to_rgba(COLORS["roof_dark"])

    # Triangular pediment (classical style)
    for y in range(0, 10):
        margin = y
        for x in range(4 + margin, 44 - margin):
            pixels[x, y] = stone if y < 6 else stone_dark
            if x == 4 + margin or x == 43 - margin:
                pixels[x, y] = outline

    for x in range(4, 44):
        pixels[x, 10] = outline

    # Entablature
    for y in range(11, 14):
        for x in range(4, 44):
            pixels[x, y] = stone_dark if y < 13 else outline

    # Wall with columns
    for y in range(14, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Columns (4 columns)
    col_positions = [8, 18, 28, 38]
    for cx in col_positions:
        for y in range(14, 56):
            pixels[cx, y] = stone
            pixels[cx + 1, y] = stone_dark
            pixels[cx + 2, y] = outline

    # Large arched windows
    draw_window(pixels, 10, 20, 6, 12)
    draw_window(pixels, 21, 20, 6, 12)
    draw_window(pixels, 32, 20, 6, 12)

    # Double doors
    draw_door(pixels, 18, 42, 6, 14)
    draw_door(pixels, 24, 42, 6, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_cafe(output_path):
    """Create a 48x64 cafe facade with warm awning."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_pink"])
    wall_dark = hex_to_rgba(COLORS["wall_pink_dark"])
    roof_l = hex_to_rgba(COLORS["roof_light"])
    roof_m = hex_to_rgba(COLORS["roof_mid"])
    awning = hex_to_rgba(COLORS["awning_red"])
    awning_d = hex_to_rgba(COLORS["awning_red_dark"])

    # Roof
    for y in range(0, 14):
        for x in range(4, 44):
            if y < 4:
                pixels[x, y] = roof_l
            elif y < 10:
                pixels[x, y] = roof_m
            else:
                pixels[x, y] = outline if (y == 0 or y == 13) else roof_m
            if x == 4 or x == 43:
                pixels[x, y] = outline

    # Wall
    for y in range(14, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Striped awning
    for y in range(18, 26):
        for x in range(2, 46):
            stripe = (x // 3) % 2
            if y == 18 or y == 25:
                pixels[x, y] = outline
            else:
                pixels[x, y] = awning if stripe == 0 else awning_d

    # Upper windows
    draw_window(pixels, 12, 28, 8, 8)
    draw_window(pixels, 28, 28, 8, 8)

    # Large shop window
    draw_window(pixels, 8, 42, 12, 12)
    draw_window(pixels, 28, 42, 12, 12)

    # Door
    draw_door(pixels, 20, 42, 8, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_town_hall(output_path):
    """Create a 48x64 town hall facade with clock tower."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_cream"])
    wall_dark = hex_to_rgba(COLORS["wall_cream_dark"])
    stone = hex_to_rgba((0xCC, 0xC4, 0xB8))
    stone_dark = hex_to_rgba((0xA8, 0xA0, 0x94))
    gold = hex_to_rgba((0xD9, 0xB8, 0x48))

    # Clock tower top (peaked)
    for y in range(0, 8):
        margin = y // 2
        for x in range(18 + margin, 30 - margin):
            pixels[x, y] = stone if y < 4 else stone_dark
            if x == 18 + margin or x == 29 - margin:
                pixels[x, y] = outline

    # Clock face
    for y in range(8, 16):
        for x in range(18, 30):
            if x == 18 or x == 29 or y == 8 or y == 15:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall

    # Clock hands
    pixels[23, 10] = outline
    pixels[24, 10] = outline
    pixels[24, 12] = outline

    # Main building roof
    for y in range(16, 22):
        for x in range(4, 44):
            if y == 16 or y == 21:
                pixels[x, y] = outline
            elif x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = stone_dark

    # Wall
    for y in range(22, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 42 else wall_dark

    # Columns
    for cx in [8, 38]:
        for y in range(22, 56):
            pixels[cx, y] = stone
            pixels[cx + 1, y] = stone_dark

    # Windows
    draw_window(pixels, 12, 26, 8, 10)
    draw_window(pixels, 28, 26, 8, 10)

    # Grand double doors
    draw_door(pixels, 16, 42, 8, 14)
    draw_door(pixels, 24, 42, 8, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_pet_shop(output_path):
    """Create a 48x64 pet shop facade."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba(COLORS["wall_green"])
    wall_dark = hex_to_rgba(COLORS["wall_green_dark"])
    roof_l = hex_to_rgba(COLORS["roof_light"])
    roof_m = hex_to_rgba(COLORS["roof_mid"])
    awning = hex_to_rgba(COLORS["awning_green"])
    awning_d = hex_to_rgba(COLORS["awning_green_dark"])

    # Roof
    for y in range(0, 14):
        for x in range(4, 44):
            if y < 5:
                pixels[x, y] = roof_l
            elif y < 10:
                pixels[x, y] = roof_m
            else:
                pixels[x, y] = roof_m
            if x == 4 or x == 43 or y == 0 or y == 13:
                pixels[x, y] = outline

    # Wall
    for y in range(14, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Awning
    for y in range(20, 27):
        for x in range(2, 46):
            stripe = (x // 4) % 2
            if y == 20 or y == 26:
                pixels[x, y] = outline
            else:
                pixels[x, y] = awning if stripe == 0 else awning_d

    # Windows with animal silhouettes
    draw_window(pixels, 10, 30, 10, 10)
    draw_window(pixels, 28, 30, 10, 10)

    # Door
    draw_door(pixels, 20, 42, 8, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_blacksmith(output_path):
    """Create a 48x64 blacksmith facade with forge hint."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba((0x8A, 0x7A, 0x6A))  # Stone gray
    wall_dark = hex_to_rgba((0x6A, 0x5A, 0x4A))
    wood_d = hex_to_rgba(COLORS["wood_dark"])
    roof = hex_to_rgba(COLORS["roof_dark"])
    metal = hex_to_rgba(COLORS["metal_dark"])
    ember = hex_to_rgba((0xFF, 0x88, 0x44))

    # Roof
    for y in range(0, 14):
        for x in range(4, 44):
            pixels[x, y] = roof
            if x == 4 or x == 43 or y == 0 or y == 13:
                pixels[x, y] = outline

    # Chimney with smoke hint
    for y in range(0, 10):
        pixels[36, y] = wall_dark
        pixels[37, y] = wall_dark
        pixels[38, y] = wall_dark
    for y in range(0, 10):
        pixels[35, y] = outline
        pixels[39, y] = outline

    # Wall
    for y in range(14, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 40 else wall_dark

    # Forge opening (left side)
    draw_rect(pixels, 8, 30, 18, 44, wood_d)
    draw_rect(pixels, 10, 32, 16, 42, ember)
    for x in range(8, 19):
        pixels[x, 30] = outline
        pixels[x, 44] = outline
    for y in range(30, 45):
        pixels[8, y] = outline
        pixels[18, y] = outline

    # Door (right side)
    draw_door(pixels, 28, 42, 8, 14)

    # Anvil sign
    draw_rect(pixels, 20, 20, 30, 28, metal)
    for x in range(20, 31):
        pixels[x, 20] = outline
        pixels[x, 28] = outline
    for y in range(20, 29):
        pixels[20, y] = outline
        pixels[30, y] = outline

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def create_clinic(output_path):
    """Create a 48x64 clinic facade with red cross."""
    img = Image.new("RGBA", (48, 64), (0, 0, 0, 0))
    pixels = img.load()

    outline = hex_to_rgba(COLORS["outline"])
    wall = hex_to_rgba((0xF8, 0xF4, 0xF0))  # White
    wall_dark = hex_to_rgba((0xE8, 0xE4, 0xE0))
    roof = hex_to_rgba(COLORS["roof_blue_mid"])
    red = hex_to_rgba((0xCC, 0x44, 0x44))

    # Roof
    for y in range(0, 14):
        for x in range(4, 44):
            pixels[x, y] = roof
            if x == 4 or x == 43 or y == 0 or y == 13:
                pixels[x, y] = outline

    # Red cross on roof
    for y in range(3, 11):
        pixels[23, y] = red
        pixels[24, y] = red
    for x in range(20, 28):
        pixels[x, 6] = red
        pixels[x, 7] = red

    # Wall
    for y in range(14, 56):
        for x in range(4, 44):
            if x == 4 or x == 43:
                pixels[x, y] = outline
            else:
                pixels[x, y] = wall if y < 42 else wall_dark

    # Windows
    draw_window(pixels, 10, 22, 8, 10)
    draw_window(pixels, 30, 22, 8, 10)
    draw_window(pixels, 10, 42, 8, 10)
    draw_window(pixels, 30, 42, 8, 10)

    # Door
    draw_door(pixels, 20, 42, 8, 14)

    # Ground
    for x in range(0, 48):
        pixels[x, 56] = outline

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/buildings"
    os.makedirs(output_dir, exist_ok=True)

    create_general_store(os.path.join(output_dir, "general_store.png"))
    create_school(os.path.join(output_dir, "school.png"))
    create_arcade(os.path.join(output_dir, "arcade.png"))
    create_library(os.path.join(output_dir, "library.png"))
    create_cafe(os.path.join(output_dir, "cafe.png"))
    create_town_hall(os.path.join(output_dir, "town_hall.png"))
    create_pet_shop(os.path.join(output_dir, "pet_shop.png"))
    create_blacksmith(os.path.join(output_dir, "blacksmith.png"))
    create_clinic(os.path.join(output_dir, "clinic.png"))

    print(f"\nGenerated 9 building facade sprites in {output_dir}/")


if __name__ == "__main__":
    main()
