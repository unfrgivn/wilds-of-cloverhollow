import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Point = [number, number];
type Area = {
  width: number; height: number; ground: string;
  walkable: Point[]; blockers: Point[][];
  occluders: { id: string; polygon: Point[]; baseline: number }[];
  spawns: Record<string, { x: number; y: number }>;
};
const id = process.argv[2] ?? "bedroom";
const value: unknown = JSON.parse(readFileSync(`content/areas/${id}.json`, "utf8"));
if (typeof value !== "object" || value === null || !("width" in value) ||
    !("height" in value) || !("ground" in value) ||
    typeof value.width !== "number" || typeof value.height !== "number" ||
    typeof value.ground !== "string" || !("walkable" in value) ||
    !("blockers" in value) || !("occluders" in value) || !("spawns" in value))
  throw new Error("invalid area");
if (!Array.isArray(value.walkable) || !Array.isArray(value.blockers) ||
    !Array.isArray(value.occluders) || typeof value.spawns !== "object" ||
    value.spawns === null) throw new Error("invalid area shapes");
const area: Area = {
  width: value.width, height: value.height, ground: value.ground,
  walkable: value.walkable.flatMap((point: unknown): Point[] =>
    Array.isArray(point) && point.length === 2 && typeof point[0] === "number" &&
    typeof point[1] === "number" ? [[point[0], point[1]]] : []),
  blockers: value.blockers.flatMap((polygon: unknown): Point[][] =>
    Array.isArray(polygon) ? [polygon.flatMap((point: unknown): Point[] =>
      Array.isArray(point) && point.length === 2 && typeof point[0] === "number" &&
      typeof point[1] === "number" ? [[point[0], point[1]]] : [])] : []),
  occluders: value.occluders.flatMap((item): Area["occluders"] => {
    if (typeof item !== "object" || item === null || !("id" in item) ||
        typeof item.id !== "string" || !("baseline" in item) ||
        typeof item.baseline !== "number" || !("polygon" in item) ||
        !Array.isArray(item.polygon)) return [];
    const polygon = item.polygon.flatMap((point: unknown): Point[] =>
      Array.isArray(point) && point.length === 2 && typeof point[0] === "number" &&
      typeof point[1] === "number" ? [[point[0], point[1]]] : []);
    return [{ id: item.id, baseline: item.baseline, polygon }];
  }),
  spawns: Object.fromEntries(Object.entries(value.spawns).flatMap(([name, item]) =>
    typeof item === "object" && item !== null && "x" in item && "y" in item &&
    typeof item.x === "number" && typeof item.y === "number"
      ? [[name, { x: item.x, y: item.y }]] : [])),
};
const sourceWidth = area.width * 2;
const sourceHeight = area.height * 2;
const poly = (points: Point[]): string => points.map(([x, y]) => `${x * 2},${y * 2}`).join(" ");
const lines: string[] = [];
for (let x = 0; x <= sourceWidth; x += 100)
  lines.push(`<path d="M${x} 0V${sourceHeight}"/>`);
for (let y = 0; y <= sourceHeight; y += 100)
  lines.push(`<path d="M0 ${y}H${sourceWidth}"/>`);
const spawnLabels = Object.entries(area.spawns).map(([name, point]) =>
  `<circle cx="${point.x * 2}" cy="${point.y * 2}" r="18"/>` +
  `<text x="${point.x * 2 + 24}" y="${point.y * 2}">${name}</text>`
).join("");
const manifestPath = `public/assets/areas/${area.ground}/ground.json`;
const manifest: { tiles: { file: string; x: number; y: number; width: number; height: number }[] } =
  JSON.parse(readFileSync(manifestPath, "utf8"));
const root = `<svg xmlns="http://www.w3.org/2000/svg" ` +
  `width="${sourceWidth}" height="${sourceHeight}">`;
const images = manifest.tiles.map((tile) =>
  `<image href="${process.cwd()}/public/assets/areas/${area.ground}/${tile.file}" ` +
  `x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}"/>`
).join("");
const walkable = `<g fill="#49b67555" stroke="#198754" stroke-width="8">` +
  `<polygon points="${poly(area.walkable)}"/></g>`;
const blockers = area.blockers.map((item) => `<polygon points="${poly(item)}"/>`).join("");
const occluders = area.occluders.map((item) =>
  `<polygon points="${poly(item.polygon)}"/>`).join("");
const baselines = area.occluders.map((item) => {
  const xs = item.polygon.map(([x]) => x);
  return `<path d="M${Math.min(...xs) * 2} ${item.baseline * 2}` +
    `H${Math.max(...xs) * 2}"/>`;
}).join("");
const svg = root + images + walkable + `<g fill="#d9484855" stroke="#a11" stroke-width="8">` +
  blockers + `</g><g fill="none" stroke="#1769aa" stroke-width="8">` + occluders +
  `</g><g fill="none" stroke="#1769aa" stroke-dasharray="18 12">` + baselines +
  `</g><g fill="#e6b800" stroke="#543" stroke-width="5">${spawnLabels}</g>` +
  `<g stroke="#ffffff66" stroke-width="2">${lines.join("")}</g></svg>`;
mkdirSync("art/review", { recursive: true });
const source = join("art/review", `${id}-overlay.svg`);
writeFileSync(source, svg);
const output = join("art/review", `${id}-overlay.png`);
const result = Bun.spawnSync(["magick", source, output], { stderr: "pipe" });
if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
