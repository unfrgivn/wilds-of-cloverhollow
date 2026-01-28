#!/usr/bin/env python3
"""
Generate battle backgrounds for Wilds of Cloverhollow.

Creates 512x288 pixel art battle backgrounds with layered composition:
- Backdrop layer (sky/distant)
- Mid-ground elements (trees/props)
- Ground plane (floor)
- Battle stage (central area)
- Foreground framing (shadows/bushes)

Style: Flat colors, simple geometric shapes, JRPG stage layout.
"""

from PIL import Image
import os

# ============================================================================
# Cloverhollow Meadow Palette (sunny town battles)
# ============================================================================
MEADOW_COLORS = {
    "sky_light": (0xA8, 0xD4, 0xE8),  # Light blue sky
    "sky": (0x7A, 0xC0, 0xE0),  # Blue sky
    "cloud": (0xF8, 0xF4, 0xEA),  # White clouds
    "tree_dark": (0x2F, 0x6B, 0x2F),  # Dark foliage
    "tree_mid": (0x4A, 0xA8, 0x4A),  # Mid foliage
    "tree_light": (0x6B, 0xC4, 0x5A),  # Light foliage
    "grass_light": (0x8F, 0xD9, 0x78),  # Highlight grass
    "grass": (0x6B, 0xC4, 0x5A),  # Main grass
    "grass_dark": (0x4A, 0xA8, 0x4A),  # Shadow grass
    "path": (0xE8, 0xDC, 0xC4),  # Cream path
    "path_shadow": (0xD4, 0xC8, 0xA8),  # Path shadow
    "flower_pink": (0xE8, 0xA8, 0xC4),  # Pink flowers
    "flower_yellow": (0xF5, 0xE0, 0x78),  # Yellow flowers
    "outline": (0x3D, 0x32, 0x28),  # Brown outline
}

# ============================================================================
# Bubblegum Bay Palette (beach battles)
# ============================================================================
BAY_COLORS = {
    "sky_light": (0xE8, 0xD0, 0xE8),  # Pastel pink sky
    "sky": (0xD0, 0xB0, 0xD8),  # Purple-pink sky
    "cloud": (0xF8, 0xF0, 0xF8),  # White-pink clouds
    "water_light": (0x8F, 0xD9, 0xE8),  # Light water
    "water": (0x5A, 0xA8, 0xD7),  # Blue water
    "water_dark": (0x3A, 0x8A, 0xBD),  # Deep water
    "sand_light": (0xF5, 0xE8, 0xD0),  # Light sand
    "sand": (0xE8, 0xD8, 0xB8),  # Main sand
    "sand_shadow": (0xD0, 0xC0, 0xA0),  # Shadow sand
    "bubble_pink": (0xF0, 0xA0, 0xC0),  # Pink bubbles
    "bubble_purple": (0xC0, 0x90, 0xD0),  # Purple bubbles
    "shell": (0xF8, 0xE0, 0xE0),  # Shell pink
    "outline": (0x5A, 0x38, 0x58),  # Maroon outline
}


def hex_to_rgba(t):
    """Convert RGB tuple to RGBA."""
    return (*t, 255) if len(t) == 3 else t


def create_meadow_background(output_path):
    """
    Create cloverhollow_meadow.png (512x288) - sunny town battle background.

    Composition:
    - Rows 0-80: Blue sky with white clouds
    - Rows 60-120: Distant tree line (dark to light gradient)
    - Rows 100-200: Green grass field
    - Rows 160-240: Central battle stage (lighter grass oval)
    - Rows 220-288: Foreground grass with flowers
    """
    width, height = 512, 288
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()

    C = MEADOW_COLORS

    # ========================================================================
    # Layer 1: Sky gradient (rows 0-100)
    # ========================================================================
    for y in range(100):
        sky_color = C["sky_light"] if y < 50 else C["sky"]
        for x in range(width):
            pixels[x, y] = hex_to_rgba(sky_color)

    # ========================================================================
    # Layer 1b: Clouds (simple ovals at top)
    # ========================================================================
    # Cloud 1: left side
    for y in range(15, 35):
        for x in range(50, 120):
            dx = abs(x - 85)
            dy = abs(y - 25)
            if dx * dx / 1200 + dy * dy / 80 < 1:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # Cloud 2: right side
    for y in range(25, 45):
        for x in range(380, 470):
            dx = abs(x - 425)
            dy = abs(y - 35)
            if dx * dx / 2000 + dy * dy / 100 < 1:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # Cloud 3: center-left
    for y in range(10, 28):
        for x in range(200, 280):
            dx = abs(x - 240)
            dy = abs(y - 19)
            if dx * dx / 1500 + dy * dy / 70 < 1:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # ========================================================================
    # Layer 2: Distant tree line (rows 60-120)
    # ========================================================================
    # Dark tree silhouettes
    for y in range(60, 120):
        depth = (y - 60) / 60.0
        tree_color = C["tree_dark"] if depth < 0.5 else C["tree_mid"]
        for x in range(width):
            pixels[x, y] = hex_to_rgba(tree_color)

    # Tree top triangles (dark trees at horizon)
    tree_positions = [30, 80, 140, 200, 260, 320, 380, 440, 490]
    for tx in tree_positions:
        tree_height = 40 + (tx % 20)
        for y in range(60 - tree_height, 80):
            half_width = (80 - (60 - tree_height - y)) // 3
            for x in range(tx - half_width, tx + half_width):
                if 0 <= x < width:
                    pixels[x, y] = hex_to_rgba(C["tree_dark"])

    # ========================================================================
    # Layer 3: Grass field (rows 100-288)
    # ========================================================================
    for y in range(100, height):
        grass_color = C["grass"]
        if y > 220:
            grass_color = C["grass_dark"]  # Foreground shadow
        for x in range(width):
            pixels[x, y] = hex_to_rgba(grass_color)

    # ========================================================================
    # Layer 4: Battle stage - central lighter oval (rows 140-240)
    # ========================================================================
    stage_cx, stage_cy = 256, 190
    stage_rx, stage_ry = 180, 60
    for y in range(130, 250):
        for x in range(76, 436):
            dx = abs(x - stage_cx)
            dy = abs(y - stage_cy)
            if dx * dx / (stage_rx * stage_rx) + dy * dy / (stage_ry * stage_ry) < 1:
                pixels[x, y] = hex_to_rgba(C["grass_light"])

    # Stage outline (darker ring)
    for y in range(130, 250):
        for x in range(76, 436):
            dx = abs(x - stage_cx)
            dy = abs(y - stage_cy)
            dist = dx * dx / (stage_rx * stage_rx) + dy * dy / (stage_ry * stage_ry)
            if 0.85 < dist < 1.0:
                pixels[x, y] = hex_to_rgba(C["grass"])

    # ========================================================================
    # Layer 5: Dirt path crossing (horizontal line)
    # ========================================================================
    for y in range(185, 200):
        for x in range(0, 100):
            pixels[x, y] = hex_to_rgba(C["path"])
        for x in range(412, width):
            pixels[x, y] = hex_to_rgba(C["path"])

    # Path shadows
    for y in range(195, 200):
        for x in range(0, 100):
            pixels[x, y] = hex_to_rgba(C["path_shadow"])
        for x in range(412, width):
            pixels[x, y] = hex_to_rgba(C["path_shadow"])

    # ========================================================================
    # Layer 6: Flowers scattered (foreground decoration)
    # ========================================================================
    import random

    random.seed(42)  # Deterministic

    flower_spots = [
        (40, 250),
        (90, 260),
        (130, 245),
        (380, 255),
        (430, 248),
        (470, 262),
    ]
    for fx, fy in flower_spots:
        color = C["flower_pink"] if random.random() > 0.5 else C["flower_yellow"]
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if abs(dx) + abs(dy) <= 3:
                    px, py = fx + dx, fy + dy
                    if 0 <= px < width and 0 <= py < height:
                        pixels[px, py] = hex_to_rgba(color)

    img.save(output_path)
    print(f"Created: {output_path}")


def create_bubblegum_bay_background(output_path):
    """
    Create bubblegum_bay.png (512x288) - beach battle background.

    Composition:
    - Rows 0-80: Pastel pink/purple sky with clouds
    - Rows 60-140: Ocean water (gradient)
    - Rows 120-288: Sandy beach
    - Rows 160-240: Central battle stage (lighter sand oval)
    - Foreground: Shells, bubbles decoration
    """
    width, height = 512, 288
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = img.load()

    C = BAY_COLORS

    # ========================================================================
    # Layer 1: Pastel sky (rows 0-90)
    # ========================================================================
    for y in range(90):
        sky_color = C["sky_light"] if y < 45 else C["sky"]
        for x in range(width):
            pixels[x, y] = hex_to_rgba(sky_color)

    # ========================================================================
    # Layer 1b: Clouds
    # ========================================================================
    # Cloud 1: left
    for y in range(15, 35):
        for x in range(60, 140):
            dx = abs(x - 100)
            dy = abs(y - 25)
            if dx * dx / 1500 + dy * dy / 80 < 1:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # Cloud 2: right
    for y in range(20, 40):
        for x in range(360, 460):
            dx = abs(x - 410)
            dy = abs(y - 30)
            if dx * dx / 2200 + dy * dy / 100 < 1:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # ========================================================================
    # Layer 2: Ocean water (rows 70-140)
    # ========================================================================
    for y in range(70, 140):
        depth = (y - 70) / 70.0
        if depth < 0.3:
            water_color = C["water_dark"]
        elif depth < 0.6:
            water_color = C["water"]
        else:
            water_color = C["water_light"]
        for x in range(width):
            pixels[x, y] = hex_to_rgba(water_color)

    # Wave foam line
    for y in range(130, 138):
        for x in range(width):
            if (x + y) % 12 < 6:
                pixels[x, y] = hex_to_rgba(C["cloud"])

    # ========================================================================
    # Layer 3: Sand beach (rows 130-288)
    # ========================================================================
    for y in range(130, height):
        sand_color = C["sand"]
        if y > 240:
            sand_color = C["sand_shadow"]  # Foreground shadow
        for x in range(width):
            pixels[x, y] = hex_to_rgba(sand_color)

    # ========================================================================
    # Layer 4: Battle stage - lighter sand oval (rows 150-230)
    # ========================================================================
    stage_cx, stage_cy = 256, 195
    stage_rx, stage_ry = 170, 55
    for y in range(140, 250):
        for x in range(86, 426):
            dx = abs(x - stage_cx)
            dy = abs(y - stage_cy)
            if dx * dx / (stage_rx * stage_rx) + dy * dy / (stage_ry * stage_ry) < 1:
                pixels[x, y] = hex_to_rgba(C["sand_light"])

    # Stage outline
    for y in range(140, 250):
        for x in range(86, 426):
            dx = abs(x - stage_cx)
            dy = abs(y - stage_cy)
            dist = dx * dx / (stage_rx * stage_rx) + dy * dy / (stage_ry * stage_ry)
            if 0.88 < dist < 1.0:
                pixels[x, y] = hex_to_rgba(C["sand"])

    # ========================================================================
    # Layer 5: Bubbles scattered (floating decoration)
    # ========================================================================
    import random

    random.seed(123)  # Deterministic

    bubble_spots = [
        (50, 170),
        (80, 200),
        (120, 155),
        (400, 165),
        (450, 190),
        (480, 175),
    ]
    for bx, by in bubble_spots:
        color = C["bubble_pink"] if random.random() > 0.5 else C["bubble_purple"]
        radius = 4 + int(random.random() * 3)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if dx * dx + dy * dy <= radius * radius:
                    px, py = bx + dx, by + dy
                    if 0 <= px < width and 0 <= py < height:
                        pixels[px, py] = hex_to_rgba(color)
        # Bubble highlight
        pixels[bx - 1, by - 1] = hex_to_rgba(C["cloud"])

    # ========================================================================
    # Layer 6: Shells (foreground decoration)
    # ========================================================================
    shell_spots = [(60, 260), (140, 270), (380, 265), (460, 258)]
    for sx, sy in shell_spots:
        # Simple shell spiral shape
        for dy in range(-4, 5):
            for dx in range(-5, 6):
                if abs(dx) + abs(dy) <= 5 and not (dx < -2 and dy > 1):
                    px, py = sx + dx, sy + dy
                    if 0 <= px < width and 0 <= py < height:
                        pixels[px, py] = hex_to_rgba(C["shell"])
        # Shell outline
        pixels[sx - 4, sy] = hex_to_rgba(C["outline"])
        pixels[sx + 4, sy] = hex_to_rgba(C["outline"])

    img.save(output_path)
    print(f"Created: {output_path}")


def main():
    output_dir = "game/assets/sprites/backgrounds/battle"
    os.makedirs(output_dir, exist_ok=True)

    # Generate missing battle backgrounds
    create_meadow_background(os.path.join(output_dir, "cloverhollow_meadow.png"))
    create_bubblegum_bay_background(os.path.join(output_dir, "bubblegum_bay.png"))

    print("\nBattle backgrounds generation complete!")
    print("Existing backgrounds (not regenerated):")
    print("  - forest_clearing.png")
    print("  - deep_woods.png")
    print("  - grove.png")


if __name__ == "__main__":
    main()
