#!/usr/bin/env bun
/*
 * Depth preview for an area's props (spec 6.2): Fae drawn where a player can
 * stand, every prop column drawn before her or over her the way the renderer
 * sorts it (over her where her feet are north of that column's front edge).
 * With no positions, two tiles per prop: the reachable spot where it hides
 * the most of her, and the spot in front of it where her picture overlaps it
 * the most. A wrong footprint shows here as Fae drawn over a desk she stands
 * behind, or under one she stands in front of. A canopy prop over her is drawn
 * faded to 40%, as it settles in the game.
 *
 *   bun tools/art/depth-preview.ts <area> [x,y ...]   (art/review/<area>-depth.png)
 */
import { mkdirSync, readFileSync } from "node:fs";
import {
  createState, faeBox, propCovers, propState, type Area, type Point, type Prop,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { propSpots } from "./prop-spots";

type Frame = { page: string; x: number; y: number; w: number; h: number; ax: number; ay: number };
type Tile = { feet: Point; label: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number";

// A Pixi spritesheet's frames, by name, with the page image each is on.
function atlas(path: string): Map<string, Frame> {
  const json: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(json) || !isRecord(json.frames) || !isRecord(json.meta) ||
      typeof json.meta.image !== "string") throw new Error(`bad atlas ${path}`);
  const page = path.replace(/[^/]+$/, json.meta.image);
  const found = new Map<string, Frame>();
  for (const [name, raw] of Object.entries(json.frames)) {
    const rect = isRecord(raw) ? raw.frame : undefined;
    const anchor = isRecord(raw) ? raw.anchor : undefined;
    if (!isRecord(rect) || !isRecord(anchor) || !isNumber(rect.x) || !isNumber(rect.y) ||
        !isNumber(rect.w) || !isNumber(rect.h) || !isNumber(anchor.x) || !isNumber(anchor.y))
      throw new Error(`bad frame ${name} in ${path}`);
    found.set(name,
      { page, x: rect.x, y: rect.y, w: rect.w, h: rect.h, ax: anchor.x, ay: anchor.y });
  }
  return found;
}

const id = process.argv[2] ?? "";
const { world } = loadContent();
function painted(name: string): { area: Area; ground: string } {
  const found = world.areas[name];
  if (found?.ground === undefined) throw new Error(`no painted area ${name}`);
  return { area: found, ground: found.ground };
}
const { area, ground } = painted(id);
const spawn = Object.keys(area.spawns)[0];
if (spawn === undefined) throw new Error(`${id} has no spawn`);
const ink = createState(world, { area: id, spawn, seed: 1 }).ink;
const frames = new Map<string, Frame>();
for (const path of area.atlases)
  for (const [name, frame] of atlas(`public/${path}`)) frames.set(name, frame);
function faeFrame(): Frame {
  const frame = atlas("public/assets/characters/fae/fae.json").get("down_idle_01");
  if (frame === undefined) throw new Error("no Fae frame");
  return frame;
}
const fae = faeFrame();
const props = area.props.map((prop) => ({ prop, state: propState(world, ink, prop) }));

function tiles(): Tile[] {
  const given = process.argv.slice(3).map((text) => {
    const [x, y] = text.split(",").map(Number);
    if (!isNumber(x) || !isNumber(y) || Number.isNaN(x) || Number.isNaN(y))
      throw new Error(`positions are x,y: ${text}`);
    return { x, y };
  });
  if (given.length > 0)
    return given.map((feet) => {
      const hiders = props.filter(({ state }) => propCovers(state, feet, faeBox) > 0)
        .map(({ prop, state }) =>
          `${prop.id} ${Math.round(propCovers(state, feet, faeBox) * 100)}%`);
      return { feet, label: `(${feet.x}, ${feet.y}) ${hiders.join(", ") || "in front of all"}` };
    });
  return propSpots(world, area, ink).flatMap(({ id: prop, behind, front }) => [
    ...(behind === undefined ? [] : [{ feet: behind.feet,
      label: `${prop}: behind, ${Math.round(behind.covered * 100)}% hidden` }]),
    ...(front === undefined ? [] : [{ feet: front.feet, label: `${prop}: in front` }]),
  ]);
}

const signed = (value: number): string => value >= 0 ? `+${value}` : `${value}`;
const WINDOW = 600;

// One frame's columns [from, to) drawn at their world place, mirrored for a
// flipped prop (its world column i is the frame's column count - 1 - i).
function strip(frame: Frame, prop: Prop, from: number, to: number, origin: Point,
  alpha = 1): string[] {
  const left = prop.flip ? 2 * prop.x - (1 - frame.ax) * frame.w : 2 * prop.x - frame.ax * frame.w;
  const top = 2 * prop.y - frame.ay * frame.h;
  const count = frame.w / 10;
  const source = prop.flip ? count - to : from;
  const crop = `${(to - from) * 10}x${frame.h}+${frame.x + source * 10}+${frame.y}`;
  return ["(", frame.page, "-crop", crop, "+repage", ...(prop.flip ? ["-flop"] : []),
    ...(alpha < 1 ? ["-channel", "A", "-evaluate", "multiply", `${alpha}`, "+channel"] : []), ")",
    "-geometry",
    `${signed(Math.round(left + from * 10 - origin.x))}${signed(Math.round(top - origin.y))}`,
    "-composite"];
}

function render(tile: Tile, out: string): void {
  const origin = { x: 2 * tile.feet.x - WINDOW / 2, y: 2 * tile.feet.y - WINDOW * 0.72 };
  const args = ["-size", `${WINDOW}x${WINDOW}`, "xc:#fcfbf6"];
  const manifest: unknown = JSON.parse(readFileSync(`public/assets/areas/${ground}/ground.json`,
    "utf8"));
  if (!isRecord(manifest) || !Array.isArray(manifest.tiles)) throw new Error("bad ground manifest");
  for (const part of manifest.tiles)
    if (isRecord(part) && typeof part.file === "string" && isNumber(part.x) && isNumber(part.y))
      args.push(`public/assets/areas/${ground}/${part.file}`, "-geometry",
        `${signed(part.x - origin.x)}${signed(part.y - origin.y)}`, "-composite");
  // Lifted props' shadows on the ground, then each prop column before or
  // over Fae. A painted prop is already on the plate, so only its columns
  // over Fae are drawn.
  const before: string[] = [];
  const after: string[] = [];
  const faeLeft = 2 * tile.feet.x - fae.ax * fae.w;
  for (const { prop, state } of props) {
    const frame = frames.get(state.frame);
    if (frame === undefined) throw new Error(`${prop.id}: no frame ${state.frame}`);
    const shadow = state.shadow === null ? undefined : frames.get(state.shadow);
    if (!prop.painted && shadow !== undefined)
      before.push(...strip(shadow, prop, 0, shadow.w / 10, origin).slice(0, -1), "-compose",
        "multiply", "-composite", "-compose", "over");
    const ys = state.front.ys;
    // A canopy over more than 5% of her settles at 40%.
    const alpha = prop.canopy && propCovers(state, tile.feet, faeBox) > 0.05 ? 0.4 : 1;
    let from = 0;
    for (let index = 1; index <= ys.length; index += 1) {
      const over = (column: number): boolean => tile.feet.y < (ys[column] ?? -Infinity);
      if (index < ys.length && over(index) === over(from)) continue;
      const columnLeft = 2 * state.silhouette.left + from * 10;
      const columnRight = 2 * state.silhouette.left + index * 10;
      const nearFae = columnRight > faeLeft && columnLeft < faeLeft + fae.w;
      if (over(from) && (nearFae || !prop.painted))
        after.push(...strip(frame, prop, from, index, origin, alpha));
      if (!over(from) && !prop.painted) before.push(...strip(frame, prop, from, index, origin));
      from = index;
    }
  }
  const body = ["(", fae.page, "-crop", `${fae.w}x${fae.h}+${fae.x}+${fae.y}`, "+repage", ")",
    "-geometry", `${signed(Math.round(faeLeft - origin.x))}${signed(Math.round(2 * tile.feet.y -
      fae.ay * fae.h - origin.y))}`, "-composite"];
  const dot = `circle ${WINDOW / 2},${WINDOW * 0.72} ${WINDOW / 2 + 4},${WINDOW * 0.72}`;
  const result = Bun.spawnSync(["magick", ...args, ...before, ...body, ...after,
    "-fill", "#e0309a", "-draw", dot,
    "-resize", "50%", "-gravity", "north", "-background", "white", "-splice", "0x22",
    "-pointsize", "14", "-fill", "black", "-annotate", "+0+3", tile.label, out],
  { stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
}

const all = tiles();
if (all.length === 0) throw new Error(`${id}: nothing to preview (no props?)`);
const scratch = `art/scratch/depth-preview/${id}`;
mkdirSync(scratch, { recursive: true });
const files = all.map((tile, index) => {
  const out = `${scratch}/tile-${index}.png`;
  render(tile, out);
  return out;
});
const rows: string[] = [];
for (let index = 0; index < files.length; index += 4)
  rows.push("(", ...files.slice(index, index + 4), "+append", ")");
mkdirSync("art/review", { recursive: true });
const output = `art/review/${id}-depth.png`;
const sheet = Bun.spawnSync(["magick", ...rows, "-background", "white", "-append", output],
  { stderr: "pipe" });
if (sheet.exitCode !== 0) throw new Error(new TextDecoder().decode(sheet.stderr));
for (const tile of all) console.log(`${tile.label} at (${tile.feet.x}, ${tile.feet.y})`);
console.log(`${output}: ${all.length} tiles`);
