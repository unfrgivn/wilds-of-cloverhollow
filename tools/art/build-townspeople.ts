#!/usr/bin/env bun
// Deterministically builds the five Milestone 79 Cloverhollow townspeople atlases
// (dad, chef, barnaby, bree, toby) from their raw sheets under art/source/townspeople/.
export {};

type Spec = {
  id: string;
  figureHeight: number;
  cols: number;
  rows: number;
  // [col, row] (0-indexed) for [down_idle_01, down_idle_02, left_idle_01, right_idle_01]
  cells: readonly (readonly [number, number])[];
};

const people: readonly Spec[] = [
  { id: "dad", figureHeight: 336, cols: 2, rows: 2, cells: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: "chef", figureHeight: 336, cols: 2, rows: 2, cells: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: "barnaby", figureHeight: 336, cols: 2, rows: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "bree", figureHeight: 336, cols: 2, rows: 2, cells: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  { id: "toby", figureHeight: 280, cols: 2, rows: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
];

const frameNames = ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"] as const;

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

for (const person of people) {
  const source = `art/source/townspeople/${person.id}/sheet-raw.png`;
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
    await run(["magick", source, "-crop", `${cellW}x${cellH}+${col * cellW}+${row * cellH}`,
      "+repage", cropPath]);
    await run(["bun", "tools/art/postprocess.ts", "--input", cropPath, "--output", framePath,
      "--width", "448", "--height", "448", "--figure-height", String(person.figureHeight),
      "--bottom-margin", "8", "--key", "#FF00FF", "--fuzz", "25%", "--despill", "edge",
      "--holes"]);
    await run(["bun", "tools/art/drop-islands.ts", "--input", framePath, "--output", framePath,
      "--min", "80"]);
    const despilled = `${frames}/${name}-despill.png`;
    await run(["bun", "tools/art/despill-edge.ts", "--input", framePath, "--output", despilled,
      "--key", "magenta", "--band", "12"]);
    await run(["mv", despilled, framePath]);
  }
  const atlas = `public/assets/characters/${person.id}/${person.id}.png`;
  await run(["magick", "montage", ...frameNames.map((name) => `${frames}/${name}.png`),
    "-tile", "4x1", "-geometry", "448x448+0+0", "-background", "none", atlas]);
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
  await Bun.write(`public/assets/characters/${person.id}/${person.id}.json`, `${JSON.stringify({
    frames: records,
    animations: {
      idle_down: ["down_idle_01", "down_idle_02"],
      idle_left: ["left_idle_01"],
      idle_right: ["right_idle_01"],
    },
    meta: {
      image: `${person.id}.png`,
      size: { w: 1792, h: 448 },
      scale: "1",
      baseline: 439,
    },
  }, null, 2)}\n`);
}
