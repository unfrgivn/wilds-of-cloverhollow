// Draws each authored surface region over its painting for owner review.
// Usage: bun tools/art/surface-overlay.ts [area]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Polygon } from "../../src/core";
import { loadContent } from "../../src/content/load";

const requested = process.argv[2];
const { world } = loadContent();
const areas = requested === undefined ? Object.values(world.areas) : [world.areas[requested]];
const colours: Record<string, string> = {
  grass: "#65b85a88", sand: "#f5ca5a99", wood: "#9b5b2eaa", snow: "#d9f3ffaa",
  stone: "#8d8b8aaa", tile: "#6fa6c688", carpet: "#c779a888",
};
const px = (value: number): number => value * 2;
const poly = (points: Polygon): string => points.map(([x, y]) => `${px(x)},${px(y)}`).join(" ");
mkdirSync("art/review", { recursive: true });
mkdirSync("art/scratch", { recursive: true });
for (const area of areas) {
  if (area === undefined) continue;
  const images = area.ground === undefined ? "" : (() => {
    const manifest: {
      tiles: { file: string; x: number; y: number; width: number; height: number }[]
    } =
      JSON.parse(readFileSync(`public/assets/areas/${area.ground}/ground.json`, "utf8"));
    return manifest.tiles.map((tile) => `<image href="${process.cwd()}/public/assets/areas/` +
      `${area.ground}/${tile.file}" x="${tile.x}" y="${tile.y}" width="${tile.width}" ` +
      `height="${tile.height}"/>`).join("");
  })();
  const surfaceMap = world.surfaces[area.id];
  if (surfaceMap === undefined) continue;
  // A labelled 100-unit grid, so regions can be read off the painting in area units.
  const grid = [
    ...Array.from({ length: Math.floor(area.width / 100) + 1 }, (_, index) => index * 100)
      .map((x) => `<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="${px(area.height)}" ` +
        `stroke="#0008" stroke-width="1"/><text x="${px(x) + 4}" y="${px(area.height) - 8}" ` +
        `font-size="22" fill="#000c">${x}</text>`),
    ...Array.from({ length: Math.floor(area.height / 100) + 1 }, (_, index) => index * 100)
      .map((y) => `<line x1="0" y1="${px(y)}" x2="${px(area.width)}" y2="${px(y)}" ` +
        `stroke="#0008" stroke-width="1"/><text x="6" y="${px(y) - 6}" ` +
        `font-size="22" fill="#000c">${y}</text>`),
  ].join("");
  const walkable = `<polygon points="${poly(area.walkable)}" fill="none" ` +
    `stroke="#ff2050" stroke-width="4" stroke-dasharray="12 8"/>`;
  const footprints = area.props.flatMap((prop) =>
    prop.states[prop.state]?.footprint ?? []).map((footprint) =>
    `<polygon points="${poly(footprint)}" fill="none" ` +
    `stroke="#2020ff" stroke-width="3"/>`).join("");
  const regions = surfaceMap.regions.map((region, index) => `<polygon ` +
    `points="${poly(region.polygon)}" fill="${colours[region.surface]}" ` +
    `stroke="#4a3040" stroke-width="5"/><text x="${px(region.polygon[0]?.[0] ?? 0)}" ` +
    `y="${px(region.polygon[0]?.[1] ?? 0)}" font-size="28">${index + 1}: ` +
    `${region.surface}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px(area.width)}" ` +
    `height="${px(area.height)}">${images}${grid}${walkable}${footprints}` +
    `<rect x="12" y="12" width="480" ` +
    `height="48" fill="#fff9"/><text x="24" y="46" font-size="28">default: ` +
    `${surfaceMap.default}; regions: first</text>${regions}</svg>`;
  // The SVG names the painting by local path; it stays in scratch.
  const source = join("art/scratch", `${area.id}-surfaces.svg`);
  const output = join("art/review", `${area.id}-surfaces.jpg`);
  writeFileSync(source, svg);
  const result = Bun.spawnSync(["magick", source, "-background", "#f5f1e0", "-alpha", "remove",
    "-quality", "90", output], { stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  console.log(output);
}
