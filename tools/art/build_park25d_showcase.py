"""Original pixel clusters. Run with uv run --locked python; never samples references."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import TypeAlias, TypedDict, cast

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RECIPE = ROOT / "art/recipes/park25d_showcase.json"
Point: TypeAlias = tuple[int, int]


class ShowcaseRecipe(TypedDict):
    """Fields used by this builder; architectural metadata belongs to its owner."""

    colors: dict[str, str]
    seed: int
    textures: list[str]
    sprites: dict[str, list[int]]


def load_recipe() -> ShowcaseRecipe:
    return cast(ShowcaseRecipe, json.loads(RECIPE.read_text(encoding="utf-8")))


COLORS = load_recipe()["colors"]


def polygon(draw: ImageDraw.ImageDraw, points: list[Point], tone: str) -> None:
    draw.polygon(points, fill=COLORS[tone])


def line(draw: ImageDraw.ImageDraw, points: list[Point], tone: str) -> None:
    draw.line(points, fill=COLORS[tone])


def leaf_cluster(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    """Scalloped section, directional lit shelf and shaded underside."""
    def transform(points: list[Point]) -> list[Point]:
        return [(x + round(px * (w - 1) / 24), y + round(py * (h - 1) / 19)) for px, py in points]
    bands = [
        ("leaf_shadow", [(0,4),(3,4),(3,2),(7,2),(7,0),(13,0),(13,2),(18,2),(18,5),(22,5),(22,10),(24,10),(24,14),(21,14),(21,17),(17,17),(17,19),(10,19),(10,17),(4,17),(4,14),(0,14)]),
        ("leaf_dark", [(1,5),(4,5),(4,3),(8,3),(8,1),(12,1),(12,3),(17,3),(17,6),(21,6),(21,11),(23,11),(23,13),(20,13),(20,16),(16,16),(16,18),(11,18),(11,16),(5,16),(5,13),(1,13)]),
        ("leaf_mid", [(1,5),(4,5),(4,3),(8,3),(8,1),(12,1),(12,3),(17,3),(17,6),(20,6),(20,10),(17,10),(17,12),(12,12),(12,14),(8,14),(8,12),(3,12),(3,10),(1,10)]),
        ("leaf_light", [(2,5),(5,5),(5,3),(8,3),(8,2),(11,2),(11,4),(16,4),(16,6),(18,6),(18,8),(12,8),(12,10),(7,10),(7,8),(2,8)])]
    for tone, points in bands:
        polygon(draw, transform(points), tone)
    # Broken leaf shelves, not individual bright dots: the top plane stays quiet.
    line(draw, transform([(4,10),(6,10),(6,9)]), "leaf_mid")
    line(draw, transform([(8,13),(10,13),(10,12)]), "leaf_light")
    line(draw, transform([(17,13),(18,13),(18,12)]), "leaf_mid")


def oak(variant: int) -> Image.Image:
    """Upright young oak and a lower, spreading oak with a crooked trunk."""
    image = Image.new("RGBA", (64, 80))
    d = ImageDraw.Draw(image)
    if variant == 0:
        polygon(d, [(24,79),(27,73),(28,56),(21,49),(16,47),(17,43),
                    (25,46),(31,53),(32,42),(37,40),(37,52),(44,45),
                    (48,45),(42,54),(36,59),(37,74),(42,79)], "ink")
        polygon(d, [(27,78),(30,72),(30,55),(23,48),(29,51),
                    (34,57),(35,73),(39,78)], "wood_dark")
        polygon(d, [(29,76),(31,71),(31,57),(33,59),(33,76)], "wood_mid")
        line(d, [(30,75),(31,70),(31,62)], "wood_light")
        line(d, [(34,64),(33,66),(34,68),(35,66),(34,64)], "wood_shadow")
        line(d, [(35,55),(40,51),(43,47)], "wood_mid")
        line(d, [(32,73),(32,76),(30,78)], "wood_light")
    else:
        polygon(d, [(22,79),(26,75),(27,67),(30,60),(28,54),(22,51),
                    (18,45),(22,44),(27,49),(33,51),(37,47),(43,45),
                    (45,47),(38,52),(36,59),(33,68),(35,75),(42,79)], "ink")
        polygon(d, [(25,78),(29,73),(29,67),(32,59),(30,54),(25,50),
                    (33,54),(36,51),(34,59),(31,68),(34,76),(38,78)], "wood_dark")
        polygon(d, [(27,77),(30,71),(30,67),(33,59),(32,55),(34,55),
                    (34,59),(32,67),(32,73),(35,77)], "wood_mid")
        line(d, [(28,75),(30,70),(30,67),(33,60)], "wood_light")
        line(d, [(33,62),(31,64),(32,66),(34,64),(33,62)], "wood_shadow")
        line(d, [(30,77),(31,75),(31,73)], "wood_light")
    # Authored lobe positions, never randomly stamped circles.
    clusters = ([(3,25,29,25),(34,24,27,28),(14,36,32,24),(5,13,29,29),(30,10,28,30),(17,2,31,30),(15,23,33,27)] if variant == 0 else
                [(2,29,30,25),(31,31,31,24),(20,36,28,22),(3,18,29,26),(34,20,27,28),(17,9,34,27),(20,25,33,26)])
    for cluster in clusters:
        leaf_cluster(d, *cluster)
    return image


def pine() -> Image.Image:
    image = Image.new("RGBA", (48, 80))
    d = ImageDraw.Draw(image)
    polygon(d, [(19,79),(21,70),(21,48),(27,48),(27,74),(30,79)], "ink")
    d.rectangle((23,52,25,78), fill=COLORS["wood_mid"])
    line(d, [(23,65),(23,77)], "wood_light")
    line(d, [(25,72),(24,73),(25,75)], "wood_dark")
    for top, bottom, half in [(31,67,22),(19,51,18),(9,36,13),(2,24,9)]:
        x = 24
        polygon(d, [(x,top),(x+half//2,bottom-12),(x+half//2-2,bottom-12),(x+half,bottom-3),(x+half-1,bottom),(x+6,bottom-1),(x+3,bottom+2),(x-4,bottom+1),(x-half,bottom),(x-half,bottom-3),(x-half//2+2,bottom-12),(x-half//2,bottom-12)], "leaf_shadow")
        polygon(d, [(x,top+2),(x+half-2,bottom-3),(x+4,bottom-3),(x+2,bottom),(x-half+2,bottom-2)], "leaf_dark")
        polygon(d, [(x,top+2),(x+1,bottom-7),(x+7,bottom-4),(x-half+3,bottom-4)], "leaf_mid")
        line(d, [(x-half+4,bottom-5),(x-4,bottom-6),(x-2,bottom-8)], "leaf_light")
        line(d, [(x-3,top+10),(x-1,top+7)], "leaf_light")
    return image


def plant(name: str, size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGBA", size)
    d = ImageDraw.Draw(image)
    w, h = size
    if name == "bush":
        for cluster in [(1,7,20,17),(15,8,16,16),(7,2,21,20)]:
            leaf_cluster(d, *cluster)
        line(d, [(13,23),(17,23)], "leaf_dark")
    elif name == "rock":
        polygon(d, [(2,15),(1,11),(5,5),(9,3),(15,2),(21,8),(22,14),(20,15)], "ink")
        polygon(d, [(3,13),(5,7),(10,4),(15,3),(19,8),(16,10),(9,10)], "stone_light")
        polygon(d, [(3,14),(9,10),(16,10),(19,8),(21,13),(19,14)], "stone_dark")
        polygon(d, [(5,7),(10,4),(14,4),(10,7)], "cream_shadow")
        line(d, [(14,7),(13,9),(15,11)], "stone")
        line(d, [(3,13),(6,13),(7,14)], "leaf_dark")
    else:
        stems = ([(3,11),(6,7),(8,3),(11,8),(13,6)] if name == "grass_tuft" else
                 [(5,6),(12,4),(19,8)] if name == "flowers" else
                 [(3,12),(6,3),(10,6),(13,15)])
        for i, (x, top) in enumerate(stems):
            base = w // 2 + (i % 3) - 1
            polygon(d, [(base,h-1),(x-1,top),(x+1,top+2),(base+2,h-1)], "leaf_dark")
            line(d, [(base,h-2),(x,top+2)], "leaf_light")
            line(d, [(x,top+6),(x-2,top+3)], "leaf_mid")
            if name == "flowers":
                # Three readable blooms with petal-sized clusters, not single dots.
                petal = "pink" if i == 1 else "white"
                edge = "purple" if i == 1 else "wood_dark"
                polygon(d, [(x-1,top-3),(x+1,top-3),(x+1,top-2),
                            (x+3,top-1),(x+3,top+1),(x+1,top+1),
                            (x+1,top+3),(x-1,top+3),(x-1,top+1),
                            (x-3,top+1),(x-3,top-1),(x-1,top-2)], edge)
                line(d, [(x,top-2),(x,top+2)], petal)
                line(d, [(x-2,top),(x+2,top)], petal)
                line(d, [(x-1,top-1),(x+1,top-1)], petal)
                d.point((x,top), fill=COLORS["yellow"])
            elif name == "reeds":
                d.rectangle((x-1,top,x+1,top+6), fill=COLORS["wood_dark"])
                line(d, [(x-1,top+1),(x-1,top+4)], "wood_light")
    return image


def texture(name: str, seed: int, repeats: int = 1) -> Image.Image:
    """Authored material rhythms wrap on a torus, never random confetti.

    A 32px period is 1.6m at 20 texels/m. Opposing edge pixels need not
    be identical: they are adjacent samples, not duplicated endpoints.
    Every stroke crossing an edge is also drawn on the opposite side.
    """
    base = {"grass":"leaf_mid", "soil":"wood_mid", "path":"cream_shadow", "stone":"stone_dark", "wood":"wood_mid", "roof":"roof_dark", "water":"water", "plaster":"cream"}[name]
    if not 1 <= repeats <= 4:
        raise ValueError("texture proof repeats must be between one and four")
    image = Image.new("RGBA", (32 * repeats, 32 * repeats), COLORS[base])
    d = ImageDraw.Draw(image)
    def mark(points: list[Point], tone: str, filled: bool = False) -> None:
        for dx in range(-64, image.width + 32, 32):
            for dy in range(-64, image.height + 32, 32):
                shifted = [(x+dx,y+dy) for x,y in points]
                if filled:
                    polygon(d, shifted, tone)
                else:
                    line(d, shifted, tone)
    if name == "plaster":
        # Small limewashed wear shelves, leaving the broad wall plane quiet.
        for x, y in [(4, 7), (22, 20), (30, 29)]:
            mark([(x, y), (x + 3, y), (x + 4, y + 1), (x + 1, y + 1)],
                 "cream_light", True)
    elif name == "grass":
        # Two close green steps; four low, broken blades leave 90% quiet lawn.
        for x,y in [(3,7),(20,15),(10,27),(29,30)]:
            mark([(x,y),(x+2,y),(x+3,y-1),(x+5,y-1)], "leaf_light")
        mark([(18,14),(19,12)], "leaf_light")
        mark([(8,26),(8,25)], "leaf_light")
    elif name in ("soil", "path"):
        # Deliberate paired clods and small stones, with no uniform stippling.
        offset = seed % 4
        for x,y in [(3,5),(22,12),(11,25),(30,29)]:
            x += offset
            if name == "soil":
                mark([(x,y),(x+4,y),(x+5,y+1),(x+2,y+2),(x,y+1)], "wood_dark", True)
                mark([(x,y),(x+3,y-1),(x+4,y)], "wood_light")
                mark([(x+6,y+2),(x+7,y+2)], "wood_light")
            else:
                mark([(x,y),(x+2,y-1),(x+3,y),(x+2,y+1),(x,y+1)], "stone_light", True)
                mark([(x+1,y+2),(x+2,y+2)], "stone")
        if name == "path":
            mark([(9,11),(13,11),(14,10)], "stone_light")
            mark([(22,23),(25,23)], "stone_light")
    elif name in ("stone","roof"):
        brick_w = 16 if name == "stone" else 8
        for row in range(4):
            for col in range(32 // brick_w):
                x, y = col*brick_w + (row%2)*(brick_w//2), row*8
                mark([(x+2,y+1),(x+brick_w-2,y+1),(x+brick_w-1,y+2),(x+brick_w-1,y+5),(x+brick_w-2,y+6),(x+1,y+6),(x+1,y+2)], name, True)
                mark([(x+2,y+1),(x+brick_w-3,y+1)], name+"_light")
                if name == "stone" and (col+row*2)%4 == 0:
                    mark([(x+3,y+6),(x+6,y+6),(x+7,y+5)], "leaf_dark")
                    mark([(x+4,y+5),(x+5,y+5)], "leaf_mid")
                if name == "roof":
                    mark([(x+2,y+2),(x+2,y+4)], "roof_light")
    elif name == "wood":
        for x in range(0,32,8):
            mark([(x,0),(x,32)], "wood_dark")
            mark([(x+1,0),(x+1,32)], "wood_light")
            y = (x*3+4)%32
            mark([(x+2,y+11),(x+7,y+11)], "wood_dark")
            mark([(x+2,y+12),(x+6,y+12)], "wood_light")
            mark([(x+3,y-5),(x+3,y+1),(x+4,y+4),(x+5,y+1),(x+5,y-3)], "wood_dark")
            mark([(x+6,y+4),(x+6,y+9)], "wood_light")
            mark([(x+4,y+14),(x+4,y+22),(x+5,y+25)], "wood_light")
    else:
        for x,y,length in [(2,4,8),(25,13,5),(10,23,10)]:
            mark([(x,y+1),(x+2,y+1),(x+3,y),(x+length,y),
                  (x+length+2,y-1)], "water_light")
            mark([(x+3,y-1),(x+length-2,y-1)], "water_high")
        mark([(15,22),(16,22)], "water_glint")
    return image


def contact_sheet(images: dict[str, Image.Image], textures: list[str], sprites: list[str]) -> Image.Image:
    """Texture repeat swatches and nearest 2x sprites on a visible alpha checker."""
    sheet = Image.new("RGB", (1024, 640), COLORS["cream"])
    draw = ImageDraw.Draw(sheet)
    for index, name in enumerate(textures):
        x = index * 128
        draw.text((x + 4, 5), name + " 32x32", fill=COLORS["ink"])
        # Four native samples enlarge by two, preserving every pixel exactly.
        swatch = Image.new("RGBA", (64, 64))
        for dx in (0, 32):
            for dy in (0, 32):
                swatch.paste(images[name], (dx, dy))
        sheet.paste(swatch.resize((128, 128), Image.Resampling.NEAREST), (x, 22))
    draw.text((8, 162), "ORIGINAL CLOVERBROOK KIT / 2x NEAREST / bottom-center foot markers", fill=COLORS["ink"])
    for index, name in enumerate(sprites):
        x, y = (index % 4) * 224, 184 + (index // 4) * 224
        image = images[name]
        draw.text((x + 8, y), f"{name} {image.width}x{image.height}", fill=COLORS["ink"])
        for row in range(12):
            for column in range(13):
                if (row + column) % 2 == 0:
                    left, top = x + 8 + column * 16, y + 18 + row * 16
                    draw.rectangle((left, top, left + 15, top + 15), fill=COLORS["cream_shadow"])
        large = image.resize((image.width * 2, image.height * 2), Image.Resampling.NEAREST)
        anchor_x, foot_y = x + 112, y + 194
        sheet.paste(large, (anchor_x - image.width, foot_y - large.height), large)
        draw.line([(anchor_x - 4, foot_y + 3), (anchor_x + 3, foot_y + 3)], fill=COLORS["ink"])
        draw.line([(anchor_x, foot_y + 1), (anchor_x, foot_y + 6)], fill=COLORS["ink"])
    return sheet


def build(output: Path, evidence: Path | None = None) -> dict[str, Image.Image]:
    recipe = load_recipe()
    images = {name:texture(name,recipe["seed"]+i) for i,name in enumerate(recipe["textures"])}
    images.update({"oak_a":oak(0), "oak_b":oak(1), "pine":pine()})
    for name,size in recipe["sprites"].items():
        if name not in images:
            images[name] = plant(name, (size[0], size[1]))
    output.mkdir(parents=True, exist_ok=True)
    measurements: dict[str, object] = {}
    for name,image in images.items():
        image.save(output/f"{name}.png")
        measurements[name] = {"size":image.size, "alpha_bounds":image.getbbox(), "alpha_values":sorted(set(image.getchannel("A").get_flattened_data()))}
    if evidence:
        evidence.mkdir(parents=True, exist_ok=True)
        sheet = contact_sheet(images, recipe["textures"], list(recipe["sprites"]))
        sheet.save(evidence/"texture-sprite-sheet.png")
        repeats = Image.new("RGBA", (512,256))
        for i,name in enumerate(recipe["textures"]):
            for tx in range(4):
                for ty in range(4):
                    repeats.paste(images[name],((i%4)*128+tx*32,(i//4)*128+ty*32))
        repeats.save(evidence/"texture-repeats.png")
        (evidence/"pixel-measurements.json").write_text(json.dumps(measurements,indent=2)+"\n")
    return images


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT/"game/assets/studies/park25d/showcase")
    parser.add_argument("--evidence",type=Path,default=ROOT/"captures/m230/assets")
    args = parser.parse_args()
    build(args.output,args.evidence)
