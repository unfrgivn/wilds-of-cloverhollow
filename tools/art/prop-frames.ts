#!/usr/bin/env bun
/*
 * Every prop's picture, as the kit cut it (spec 6.2), on teal, with its
 * footprint drawn on it in its own place (orange), its front edge (red), and
 * its home (a ring). A picture must be its object, whole, and nothing else:
 * wall, floor, or a neighbour's outline left in a picture shows here against
 * the teal. Its footprint must sit where the object meets the floor: a
 * picture floating above the red line, or reaching well below it (legs Fae
 * could stand between), is a footprint or a mask to fix. Each label gives how
 * far, in units, the picture reaches past its front at most (`over`) and how
 * far it stops short of it (`short`), in the footprint's columns.
 *
 *   bun tools/art/prop-frames.ts <area>   (art/review/<area>-frames.png)
 */
import { mkdirSync, readFileSync } from "node:fs";
import { loadContent } from "../../src/content/load";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number";

const id = process.argv[2] ?? "";
const { world } = loadContent();
const area = world.areas[id];
if (area === undefined || area.props.length === 0) throw new Error(`${id} has no props`);
type Frame = { page: string; x: number; y: number; w: number; h: number; ax: number; ay: number };
const frames = new Map<string, Frame>();
for (const path of area.atlases) {
  const json: unknown = JSON.parse(readFileSync(`public/${path}`, "utf8"));
  if (!isRecord(json) || !isRecord(json.frames) || !isRecord(json.meta) ||
      typeof json.meta.image !== "string") throw new Error(`bad atlas ${path}`);
  const page = `public/${path.replace(/[^/]+$/, json.meta.image)}`;
  for (const [name, raw] of Object.entries(json.frames)) {
    const rect = isRecord(raw) ? raw.frame : undefined;
    const anchor = isRecord(raw) ? raw.anchor : undefined;
    if (isRecord(rect) && isRecord(anchor) && isNumber(rect.x) && isNumber(rect.y) &&
        isNumber(rect.w) && isNumber(rect.h) && isNumber(anchor.x) && isNumber(anchor.y))
      frames.set(name, { page, x: rect.x, y: rect.y, w: rect.w, h: rect.h, ax: anchor.x,
        ay: anchor.y });
  }
}

mkdirSync(`art/scratch/prop-frames/${id}`, { recursive: true });
const tiles: string[] = [];
const notes: string[] = [];
for (const prop of area.props)
  for (const [name, state] of Object.entries(prop.states)) {
    const frame = frames.get(state.frame);
    if (frame === undefined) throw new Error(`${prop.id}: no frame ${state.frame}`);
    // World units to frame px: the frame's anchor is the prop's home.
    const fx = (x: number): number =>
      (prop.flip ? prop.x - x : x - prop.x) * 2 + frame.ax * frame.w;
    const fy = (y: number): number => (y - prop.y) * 2 + frame.ay * frame.h;
    const pad = 60;
    const { left, step, columns } = state.silhouette;
    const xs = state.footprint.flat().map(([x]) => x);
    let over = 0;
    let short = 0;
    for (let x = Math.min(...xs) + step / 2; xs.length > 0 && x < Math.max(...xs); x += step) {
      const index = Math.floor((x - left) / step);
      const runs = columns[index] ?? [];
      if (runs.length === 0) continue;
      const gap = Math.max(...runs.map(([, bottom]) => bottom)) - (state.front.ys[index] ?? 0);
      over = Math.max(over, gap);
      short = Math.max(short, -gap);
    }
    const draw: string[] = ["-fill", "#f08c0040", "-stroke", "#d35400", "-strokewidth", "3"];
    for (const polygon of state.footprint)
      draw.push("-draw", `polygon ${polygon.map(([x, y]) =>
        `${fx(x) + pad},${fy(y) + pad}`).join(" ")}`);
    const edge = state.front.ys.map((y, index) =>
      `${fx(left + (index + 0.5) * step) + pad},${fy(y) + pad}`).join(" ");
    if (state.front.ys.length > 1)
      draw.push("-fill", "none", "-stroke", "#e00000", "-strokewidth", "2", "-draw",
        `polyline ${edge}`);
    const home = `${frame.ax * frame.w + pad},${frame.ay * frame.h + pad}`;
    draw.push("-fill", "none", "-stroke", "#000", "-strokewidth", "2", "-draw",
      `circle ${home} ${frame.ax * frame.w + pad + 7},${frame.ay * frame.h + pad}`);
    const label = `${prop.id}${name === "default" ? "" : `.${name}`}` +
      `${xs.length === 0 ? "" : `  over ${Math.round(over)} short ${Math.round(short)}`}`;
    notes.push(label);
    const out = `art/scratch/prop-frames/${id}/${prop.id}-${name}.png`;
    const result = Bun.spawnSync(["magick", "(", frame.page, "-crop",
      `${frame.w}x${frame.h}+${frame.x}+${frame.y}`, "+repage", ...(prop.flip ? ["-flop"] : []),
      ")", "-background", "#2a9d8f", "-alpha", "remove", "-alpha", "off", "-bordercolor",
      "#2a9d8f", "-border", `${pad}`, ...draw, "-resize", "50%", "-gravity", "north",
      "-background", "white", "-splice", "0x22", "-pointsize", "14", "-fill", "black",
      "-stroke", "none", "-annotate", "+0+3", label, out], { stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
    tiles.push(out);
  }
const rows: string[] = [];
for (let index = 0; index < tiles.length; index += 5)
  rows.push("(", ...tiles.slice(index, index + 5), "-background", "white", "-gravity", "south",
    "+append", ")");
mkdirSync("art/review", { recursive: true });
const output = `art/review/${id}-frames.png`;
const sheet = Bun.spawnSync(["magick", ...rows, "-background", "white", "-gravity", "west",
  "-append", output], { stderr: "pipe" });
if (sheet.exitCode !== 0) throw new Error(new TextDecoder().decode(sheet.stderr));
for (const note of notes) console.log(note);
console.log(`${output}: ${tiles.length} frames`);
