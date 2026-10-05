import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Point = [number, number];
type Occluder = { id: string; polygon: Point[]; baseline: number };
type Tile = { file: string; x: number; y: number; width: number; height: number };
type Area = { ground: string; occluders: Occluder[]; tiles: Tile[] };

function readArea(path: string): Area {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof value !== "object" || value === null || !("ground" in value) ||
      typeof value.ground !== "string" || !("occluders" in value) ||
      !Array.isArray(value.occluders)) throw new Error("invalid area");
  const occluders = value.occluders.flatMap((item): Occluder[] => {
    if (typeof item !== "object" || item === null || !("id" in item) ||
        typeof item.id !== "string" || !("baseline" in item) ||
        typeof item.baseline !== "number" || !("polygon" in item) ||
        !Array.isArray(item.polygon)) return [];
    const polygon = item.polygon.flatMap((point: unknown): Point[] =>
      Array.isArray(point) && point.length === 2 &&
      typeof point[0] === "number" && typeof point[1] === "number"
        ? [[point[0], point[1]]] : []);
    return polygon.length >= 3 ? [{ id: item.id, polygon, baseline: item.baseline }] : [];
  });
  if (occluders.length !== value.occluders.length) throw new Error("invalid occluder");
  const manifestPath = join("public/assets/areas", value.ground, "ground.json");
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest !== "object" || manifest === null ||
      !("tiles" in manifest) || !Array.isArray(manifest.tiles))
    throw new Error("invalid ground manifest");
  const tiles = manifest.tiles.flatMap((item: unknown): Tile[] =>
    typeof item === "object" && item !== null && "file" in item &&
    "x" in item && "y" in item && "width" in item && "height" in item &&
    typeof item.file === "string" && typeof item.x === "number" &&
    typeof item.y === "number" && typeof item.width === "number" &&
    typeof item.height === "number"
      ? [{ file: item.file, x: item.x, y: item.y, width: item.width, height: item.height }]
      : []);
  if (tiles.length !== manifest.tiles.length) throw new Error("invalid tile");
  return { ground: value.ground, occluders, tiles };
}

const areaPath = process.argv[2] ?? "content/areas/bedroom.json";
const area = readArea(areaPath);
const directory = join("public/assets/areas", area.ground);
mkdirSync(directory, { recursive: true });
const scratch = join("art/scratch", "area-occluders", area.ground);
mkdirSync(scratch, { recursive: true });
const assembled = join(directory, ".assembled.png");
const sourceWidth = Math.max(...area.tiles.map((tile) => tile.x + tile.width));
const sourceHeight = Math.max(...area.tiles.map((tile) => tile.y + tile.height));
const assemblyArgs = ["magick", "-size", `${sourceWidth}x${sourceHeight}`, "xc:none"];
for (const tile of area.tiles)
  assemblyArgs.push(`${directory}/${tile.file}`, "-geometry", `+${tile.x}+${tile.y}`, "-composite");
assemblyArgs.push(assembled);
const assembly = Bun.spawnSync(assemblyArgs, { stderr: "pipe" });
if (assembly.exitCode !== 0) throw new Error(new TextDecoder().decode(assembly.stderr));
const cutouts: { id: string; file: string; x: number; y: number }[] = [];
for (const item of area.occluders) {
  const points: Point[] = item.polygon.map(([x, y]) => [x * 2, y * 2]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.floor(Math.min(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxX = Math.ceil(Math.max(...xs));
  const maxY = Math.ceil(Math.max(...ys));
  const width = maxX - minX;
  const height = maxY - minY;
  const relative = points.map(([x, y]) => `${x - minX},${y - minY}`).join(" L ");
  const mask = join(scratch, `${item.id}.svg`);
  const output = `${item.id}.webp`;
  writeFileSync(mask,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<path fill="white" d="M ${relative} Z"/></svg>`);
  const command = ["magick", assembled,
    "-crop", `${width}x${height}+${minX}+${minY}`, "+repage", "-alpha", "set",
    mask, "-compose", "CopyOpacity", "-composite",
    "-define", "webp:lossless=true", join(directory, output)];
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0)
    throw new Error(new TextDecoder().decode(result.stderr));
  cutouts.push({ id: item.id, file: output, x: minX / 2, y: minY / 2 });
}
writeFileSync(join(directory, "occluders.json"), JSON.stringify({ cutouts }, null, 2) + "\n");
rmSync(assembled);
