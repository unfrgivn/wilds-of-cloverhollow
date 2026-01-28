#!/usr/bin/env python3
"""Generate furniture prop sprites for interior/exterior scenes.

Milestone 202: Town Furniture Props
Creates chair, table, desk, bookshelf, couch, bed, rug sprites.
"""

from PIL import Image
import os

COLORS = {
    "cream_light": (0xF5, 0xEA, 0xD6),
    "cream": (0xE8, 0xDC, 0xC4),
    "cream_shadow": (0xD4, 0xC8, 0xA8),
    "wood_highlight": (0xC9, 0xA8, 0x70),
    "wood_light": (0xB5, 0x8A, 0x4D),
    "wood_mid": (0x8A, 0x6B, 0x3F),
    "wood_dark": (0x5A, 0x4A, 0x3A),
    "wood_shadow": (0x3D, 0x32, 0x28),
    "outline": (0x3D, 0x32, 0x28),
    "fabric_red": (0xC4, 0x6B, 0x6B),
    "fabric_red_dark": (0x8A, 0x4A, 0x4A),
    "fabric_blue": (0x6B, 0x8A, 0xC4),
    "fabric_blue_dark": (0x4A, 0x5A, 0x8A),
    "fabric_pink": (0xE8, 0xA8, 0xC4),
    "fabric_pink_dark": (0xC4, 0x7A, 0x9A),
    "pillow_white": (0xF5, 0xF0, 0xE8),
    "pillow_shadow": (0xD8, 0xD0, 0xC4),
    "book_red": (0xC4, 0x5A, 0x5A),
    "book_blue": (0x5A, 0x7A, 0xB0),
    "book_green": (0x5A, 0x9A, 0x6A),
    "book_yellow": (0xD4, 0xC0, 0x5A),
}


def rgba(name):
    c = COLORS[name]
    return (*c, 255) if len(c) == 3 else c


def create_chair(path):
    """16x16 wooden dining chair, 3/4 top-down view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()
    out, wl, wm, wd = (
        rgba("outline"),
        rgba("wood_light"),
        rgba("wood_mid"),
        rgba("wood_dark"),
    )

    # Chair back (rows 2-7)
    for y in range(2, 8):
        for x in range(5, 11):
            if y == 2 or y == 7 or x == 5 or x == 10:
                p[x, y] = out
            else:
                p[x, y] = wl if y < 5 else wm

    # Seat (rows 8-11)
    for y in range(8, 12):
        for x in range(4, 12):
            if y == 8 or y == 11 or x == 4 or x == 11:
                p[x, y] = out
            else:
                p[x, y] = wm if y < 10 else wd

    # Legs (rows 12-15)
    for x in [5, 10]:
        for y in range(12, 16):
            p[x, y] = wd if y < 15 else out

    img.save(path)


def create_table(path):
    """16x16 small wooden table, 3/4 view."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()
    out, wl, wm, wd = (
        rgba("outline"),
        rgba("wood_light"),
        rgba("wood_mid"),
        rgba("wood_dark"),
    )

    # Table top (rows 4-8)
    for y in range(4, 9):
        for x in range(2, 14):
            if y == 4 or y == 8 or x == 2 or x == 13:
                p[x, y] = out
            elif y == 5:
                p[x, y] = wl
            else:
                p[x, y] = wm

    # Legs (rows 9-15)
    for x in [4, 11]:
        for y in range(9, 16):
            p[x, y] = wd if y < 15 else out

    img.save(path)


def create_desk(path):
    """16x16 writing desk with drawer."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = img.load()
    out, wl, wm, wd = (
        rgba("outline"),
        rgba("wood_light"),
        rgba("wood_mid"),
        rgba("wood_dark"),
    )
    iron = rgba("outline")

    # Desktop (rows 3-6)
    for y in range(3, 7):
        for x in range(1, 15):
            if y == 3 or y == 6 or x == 1 or x == 14:
                p[x, y] = out
            elif y == 4:
                p[x, y] = wl
            else:
                p[x, y] = wm

    # Drawer front (rows 7-10)
    for y in range(7, 11):
        for x in range(2, 14):
            if y == 7 or y == 10 or x == 2 or x == 13:
                p[x, y] = out
            else:
                p[x, y] = wm

    # Drawer handle (row 8)
    p[7, 8] = iron
    p[8, 8] = iron

    # Legs (rows 11-15)
    for x in [3, 12]:
        for y in range(11, 16):
            p[x, y] = wd if y < 15 else out

    img.save(path)


def create_bookshelf(path):
    """16x24 bookshelf with colorful books."""
    img = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    p = img.load()
    out, wl, wm, wd = (
        rgba("outline"),
        rgba("wood_light"),
        rgba("wood_mid"),
        rgba("wood_dark"),
    )
    br, bb, bg, by = (
        rgba("book_red"),
        rgba("book_blue"),
        rgba("book_green"),
        rgba("book_yellow"),
    )

    # Frame outline
    for y in range(1, 23):
        p[1, y] = out
        p[14, y] = out
    for x in range(1, 15):
        p[x, 1] = out
        p[x, 22] = out

    # Frame fill
    for y in range(2, 22):
        p[2, y] = wm
        p[13, y] = wd

    # Shelves at rows 8, 15
    for shelf_y in [8, 15]:
        for x in range(2, 14):
            p[x, shelf_y] = wm

    # Books - top shelf (rows 2-7)
    book_colors = [br, bb, bg, by, br, bb, bg, by, br, bb]
    for i, x in enumerate(range(3, 13)):
        color = book_colors[i % len(book_colors)]
        for y in range(3, 8):
            p[x, y] = color

    # Books - middle shelf (rows 9-14)
    for i, x in enumerate(range(3, 13)):
        color = book_colors[(i + 3) % len(book_colors)]
        for y in range(10, 15):
            p[x, y] = color

    # Books - bottom shelf (rows 16-21)
    for i, x in enumerate(range(3, 13)):
        color = book_colors[(i + 5) % len(book_colors)]
        for y in range(17, 22):
            p[x, y] = color

    img.save(path)


def create_couch(path):
    """24x16 living room couch."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    p = img.load()
    out = rgba("outline")
    fl, fd = rgba("fabric_red"), rgba("fabric_red_dark")
    wm, wd = rgba("wood_mid"), rgba("wood_dark")

    # Back rest (rows 2-7)
    for y in range(2, 8):
        for x in range(2, 22):
            if y == 2 or x == 2 or x == 21:
                p[x, y] = out
            elif y < 5:
                p[x, y] = fl
            else:
                p[x, y] = fd

    # Seat cushion (rows 8-11)
    for y in range(8, 12):
        for x in range(1, 23):
            if y == 11 or x == 1 or x == 22:
                p[x, y] = out
            elif y == 8:
                p[x, y] = fl
            else:
                p[x, y] = fd

    # Armrests
    for y in range(4, 12):
        p[0, y] = fd
        p[23, y] = fd
        p[1, y] = fl if y < 8 else fd

    # Feet (rows 12-14)
    for x in [4, 19]:
        for y in range(12, 15):
            p[x, y] = wm if y < 14 else out

    img.save(path)


def create_bed(path):
    """24x16 bedroom bed with pillow and blanket."""
    img = Image.new("RGBA", (24, 16), (0, 0, 0, 0))
    p = img.load()
    out = rgba("outline")
    wl, wm, wd = rgba("wood_light"), rgba("wood_mid"), rgba("wood_dark")
    pw, ps = rgba("pillow_white"), rgba("pillow_shadow")
    bl, bd = rgba("fabric_blue"), rgba("fabric_blue_dark")

    # Headboard (rows 1-6)
    for y in range(1, 7):
        for x in range(1, 7):
            if y == 1 or y == 6 or x == 1 or x == 6:
                p[x, y] = out
            else:
                p[x, y] = wl if y < 4 else wm

    # Pillow (rows 3-6, x 7-12)
    for y in range(3, 7):
        for x in range(7, 13):
            if y == 3 or y == 6 or x == 7 or x == 12:
                p[x, y] = out
            else:
                p[x, y] = pw if y < 5 else ps

    # Blanket/mattress (rows 7-13)
    for y in range(7, 14):
        for x in range(2, 22):
            if y == 7 or y == 13 or x == 2 or x == 21:
                p[x, y] = out
            elif y < 10:
                p[x, y] = bl
            else:
                p[x, y] = bd

    # Footboard (rows 7-13, x 22-23)
    for y in range(7, 14):
        for x in range(22, 24):
            p[x, y] = wm if x == 22 else wd

    # Feet
    for x in [3, 20]:
        p[x, 14] = wd
        p[x, 15] = out

    img.save(path)


def create_rug(path):
    """24x24 decorative floor rug."""
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    p = img.load()
    out = rgba("outline")
    fl, fd = rgba("fabric_pink"), rgba("fabric_pink_dark")
    cream = rgba("cream")

    # Outer border (rows 2-21, cols 2-21)
    for y in range(2, 22):
        for x in range(2, 22):
            if y == 2 or y == 21 or x == 2 or x == 21:
                p[x, y] = out
            elif y == 3 or y == 20 or x == 3 or x == 20:
                p[x, y] = fd
            elif y == 4 or y == 19 or x == 4 or x == 19:
                p[x, y] = fl
            else:
                p[x, y] = cream

    # Center pattern - simple diamond
    center_x, center_y = 11, 11
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if abs(dx) + abs(dy) <= 3:
                p[center_x + dx, center_y + dy] = fl if abs(dx) + abs(dy) < 2 else fd

    img.save(path)


def main():
    out_dir = "game/assets/sprites/props"
    os.makedirs(out_dir, exist_ok=True)

    sprites = [
        ("chair.png", create_chair),
        ("table.png", create_table),
        ("desk.png", create_desk),
        ("bookshelf.png", create_bookshelf),
        ("couch.png", create_couch),
        ("bed.png", create_bed),
        ("rug.png", create_rug),
    ]

    for name, func in sprites:
        func(os.path.join(out_dir, name))
        print(f"Created: {name}")

    print(f"\nGenerated {len(sprites)} furniture sprites in {out_dir}/")


if __name__ == "__main__":
    main()
