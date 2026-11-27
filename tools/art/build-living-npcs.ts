#!/usr/bin/env bun
// Deterministically builds the thirteen Living NPCs atlases from their raw
// 2x2 sheets under art/source/living-npcs/<id>/sheet-raw.png and composes
// cream/dark review contact sheets under art/review/.
export {};

type Spec = {
  id: string;
  group: "adults" | "kids" | "wave2" | "wave3";
  figureHeight: number;
  cols: number;
  rows: number;
  // [col, row] (0-indexed) for [down_idle_01, down_idle_02, left_idle_01, right_idle_01]
  cells: readonly (readonly [number, number])[];
};

const people: readonly Spec[] = [
  { id: "flora", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "sal", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "lark", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "mina", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "otis", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "pebble", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "moss", group: "adults", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "sammy", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "pippa", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "leo", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "maya", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "nora", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "sunny", group: "kids", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "gus", group: "wave2", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "hazel", group: "wave2", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "bram", group: "wave2", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "wren", group: "wave2", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "tuck", group: "wave2", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "kai", group: "wave2", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "sage", group: "wave3", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "clara", group: "wave3", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "bramble", group: "wave3", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "bert", group: "wave3", figureHeight: 336, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "poppy", group: "wave3", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "gemma", group: "wave3", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "theo", group: "wave3", figureHeight: 280, cols: 2, rows: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
];

const frameNames = [
  "down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01",
] as const;

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

const filter = new Set(Bun.argv.slice(2));
const selected = filter.size === 0 ? people : people.filter((person) => filter.has(person.id));

for (const person of selected) {
  const source = `art/source/living-npcs/${person.id}/sheet-raw.png`;
  const frames = `art/scratch/${person.id}-build-frames`;
  await run(["rm", "-rf", frames]);
  await run(["mkdir", "-p", frames, `public/assets/characters/${person.id}`]);
  const cellW = Math.floor(2048 / person.cols);
  const cellH = Math.floor(2048 / person.rows);
  for (let i = 0; i < frameNames.length; i += 1) {
    const name = frameNames[i]!;
    const [col, row] = person.cells[i]!;
    const cropPath = `${frames}/crop-${name}.png`;
    const framePath = `${frames}/${name}.png`;
    await run([
      "magick",
      source,
      "-crop",
      `${cellW}x${cellH}+${col * cellW}+${row * cellH}`,
      "+repage",
      cropPath,
    ]);
    await run([
      "bun",
      "tools/art/postprocess.ts",
      "--input",
      cropPath,
      "--output",
      framePath,
      "--width",
      "448",
      "--height",
      "448",
      "--figure-height",
      String(person.figureHeight),
      "--bottom-margin",
      "8",
      "--key",
      "#FF00FF",
      "--fuzz",
      "25%",
      "--despill",
      "edge",
      "--holes",
    ]);
    await run([
      "bun",
      "tools/art/drop-islands.ts",
      "--input",
      framePath,
      "--output",
      framePath,
      "--min",
      "80",
    ]);
    const despilled = `${frames}/${name}-despill.png`;
    await run([
      "bun",
      "tools/art/despill-edge.ts",
      "--input",
      framePath,
      "--output",
      despilled,
      "--key",
      "magenta",
      "--band",
      "12",
    ]);
    await run(["mv", despilled, framePath]);
  }
  const atlas = `public/assets/characters/${person.id}/${person.id}.webp`;
  await run([
    "magick",
    "montage",
    ...frameNames.map((name) => `${frames}/${name}.png`),
    "-tile",
    "4x1",
    "-geometry",
    "448x448+0+0",
    "-background", "none", "-define", "webp:lossless=true", atlas,
  ]);
  const records: Record<string, unknown> = {};
  for (let i = 0; i < frameNames.length; i += 1) {
    records[frameNames[i]!] = {
      frame: { x: i * 448, y: 0, w: 448, h: 448 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 },
      sourceSize: { w: 448, h: 448 },
      anchor: { x: 0.5, y: 439 / 448 },
    };
  }
  await Bun.write(
    `public/assets/characters/${person.id}/${person.id}.json`,
    `${JSON.stringify(
      {
        frames: records,
        animations: {
          idle_down: ["down_idle_01", "down_idle_02"],
          idle_left: ["left_idle_01"],
          idle_right: ["right_idle_01"],
        },
        meta: {
          image: `${person.id}.webp`,
          size: { w: 1792, h: 448 },
          scale: "1",
          baseline: 439,
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Built atlas: ${atlas}`);
}

async function buildReviewSheet(
  group: "adults" | "kids" | "wave2" | "wave3",
  bg: string,
  suffix: string,
): Promise<void> {
  const members = people.filter((person) => person.group === group);
  const rows: string[] = [];
  await run(["mkdir", "-p", "art/scratch/review-rows", "art/review"]);
  for (const person of members) {
    const rowPath = `art/scratch/review-rows/${person.id}-${suffix}.png`;
    await run([
      "magick",
      `public/assets/characters/${person.id}/${person.id}.webp`,
      "-background",
      bg,
      "-flatten",
      "-resize",
      "1200x300!",
      "-gravity",
      "NorthWest",
      "-fill",
      bg === "#F5F1E0" ? "#47321F" : "#F5F1E0",
      "-pointsize",
      "22",
      "-annotate",
      "+12+24",
      `${person.id} (down | blink | left | right)`,
      rowPath,
    ]);
    rows.push(rowPath);
  }
  const out = `art/review/living-npcs-${group}-${suffix}.jpg`;
  await run([
    "magick",
    ...rows,
    "-append",
    "-resize",
    "1400x1400>",
    "-quality",
    "90",
    out,
  ]);
  console.log(`Built review sheet: ${out}`);
}

await buildReviewSheet("adults", "#F5F1E0", "cream");
await buildReviewSheet("adults", "#1E1926", "dark");
await buildReviewSheet("kids", "#F5F1E0", "cream");
await buildReviewSheet("kids", "#1E1926", "dark");
await buildReviewSheet("wave2", "#F5F1E0", "cream");
await buildReviewSheet("wave2", "#1E1926", "dark");
await buildReviewSheet("wave3", "#F5F1E0", "cream");
await buildReviewSheet("wave3", "#1E1926", "dark");
