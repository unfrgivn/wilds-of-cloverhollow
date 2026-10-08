// Draws an area's JSON over its painting for review: the floor's outline,
// blockers (red), props' footprints in every state (orange; painted props
// dashed), occluders and their baselines (blue), doors (magenta), spawns
// (gold), look points with their reach (violet), and people's footprints
// (cyan). Green is every spot Fae's feet can get to from a spawn: on the floor
// and a player radius clear of its edge, every blocker, prop, and footprint
// (the core's own rule). Green on furniture, behind it, or off the painted
// floor is a geometry bug.
//
//   bun tools/art/area-overlay.ts <area>   (writes art/review/<area>-overlay.png)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { everyPropFootprint, type Polygon } from "../../src/core";
import { reachablePositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";

const id = process.argv[2] ?? "bedroom";
const { world } = loadContent();
const area = world.areas[id];
if (area?.ground === undefined) throw new Error(`no painted area ${id}`);
const radius = world.tunables.playerRadius;

// The area checks' own flood fill from every spawn, on their 5-unit grid.
const reached = reachablePositions(area, radius);
const cell = 5;

// The painting is 2 source px per unit.
const px = (value: number): number => value * 2;
const poly = (points: Polygon): string => points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
const width = px(area.width);
const height = px(area.height);
const grid: string[] = [];
for (let x = 0; x <= width; x += 100) grid.push(`<path d="M${x} 0V${height}"/>`);
for (let y = 0; y <= height; y += 100) grid.push(`<path d="M0 ${y}H${width}"/>`);
const reach = reached.map((point) =>
  `M${px(point.x) - cell} ${px(point.y) - cell}h${cell * 2}v${cell * 2}h${-cell * 2}z`).join("");
const manifest: { tiles: { file: string; x: number; y: number; width: number; height: number }[] } =
  JSON.parse(readFileSync(`public/assets/areas/${area.ground}/ground.json`, "utf8"));
const images = manifest.tiles.map((tile) =>
  `<image href="${process.cwd()}/public/assets/areas/${area.ground}/${tile.file}" ` +
  `x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}"/>`).join("");
const baselines = area.occluders.map((item) => {
  const xs = item.polygon.map(([x]) => x);
  return `<path d="M${px(Math.min(...xs))} ${px(item.baseline)}H${px(Math.max(...xs))}"/>`;
}).join("");
const spawns = Object.entries(area.spawns).map(([name, point]) =>
  `<circle cx="${px(point.x)}" cy="${px(point.y)}" r="18"/>` +
  `<text x="${px(point.x) + 24}" y="${px(point.y)}">${name}</text>`).join("");
// A look point's circle is the interaction range (60 units).
const looks = area.interactables.map((item) =>
  `<circle cx="${px(item.point.x)}" cy="${px(item.point.y)}" r="120"/>` +
  `<circle cx="${px(item.point.x)}" cy="${px(item.point.y)}" r="12"/>` +
  `<text x="${px(item.point.x) + 18}" y="${px(item.point.y)}">${item.id}</text>`).join("");
const group = (style: string, body: string): string => `<g ${style}>${body}</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
  images +
  group('fill="#2fb34a66"', `<path d="${reach}"/>`) +
  group('fill="none" stroke="#198754" stroke-width="8"',
    `<polygon points="${poly(area.walkable)}"/>`) +
  group('fill="#d9484855" stroke="#a11" stroke-width="8"',
    area.blockers.map((item) => `<polygon points="${poly(item)}"/>`).join("")) +
  group('fill="#f08c0055" stroke="#b35900" stroke-width="6"',
    area.props.map((prop) => group(prop.painted ? 'stroke-dasharray="14 8"' : "",
      Object.values(prop.states).flatMap((state) => state.footprint)
        .map((item) => `<polygon points="${poly(item)}"/>`).join(""))).join("")) +
  group('fill="#17c3e055" stroke="#0a7f99" stroke-width="6"',
    area.npcs.map((npc) => `<polygon points="${poly(npc.footprint)}"/>`).join("")) +
  group('fill="none" stroke="#1769aa" stroke-width="8"',
    area.occluders.map((item) => `<polygon points="${poly(item.polygon)}"/>`).join("")) +
  group('fill="none" stroke="#1769aa" stroke-dasharray="18 12"', baselines) +
  group('fill="#e0309a44" stroke="#c0157f" stroke-width="8"',
    area.triggers.map((item) => `<polygon points="${poly(item.polygon)}"/>`).join("")) +
  group('fill="#e6b800" stroke="#543" stroke-width="5"', spawns) +
  group('fill="none" stroke="#7c3aed" stroke-width="4" stroke-dasharray="12 8"', looks) +
  group('stroke="#ffffff66" stroke-width="2"', grid.join("")) + "</svg>";
mkdirSync("art/review", { recursive: true });
const source = join("art/review", `${id}-overlay.svg`);
writeFileSync(source, svg);
const output = join("art/review", `${id}-overlay.png`);
const result = Bun.spawnSync(["magick", source, output], { stderr: "pipe" });
if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
console.log(`${output}: ${reached.length} reachable spots`);
