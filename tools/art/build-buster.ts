#!/usr/bin/env bun
// Deterministically builds Buster the Bus Driver's runtime atlas (Milestone 91)
// from art/source/townspeople/buster/sheet-raw.png using the townspeople pipeline.
export {};

type FrameCell = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
};

const SOURCE = "art/source/townspeople/buster/sheet-raw.png";
const FRAMES_DIR = "art/scratch/buster-build-frames";
const OUT_DIR = "public/assets/characters/buster";
const ATLAS_PNG = `${OUT_DIR}/buster.png`;
const ATLAS_JSON = `${OUT_DIR}/buster.json`;
const FIGURE_HEIGHT = 336;
const CANVAS = 448;
const BASELINE = 439;
const CELL = 1024;

// Quadrant mapping verified visually against sheet-raw.png:
// (0,0) front open, (1,0) front blink, (1,1) 3/4 facing left, (0,1) 3/4 facing right.
const FRAME_CELLS: readonly FrameCell[] = [
  { name: "down_idle_01", col: 0, row: 0 },
  { name: "down_idle_02", col: 1, row: 0 },
  { name: "left_idle_01", col: 1, row: 1 },
  { name: "right_idle_01", col: 0, row: 1 },
];

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", FRAMES_DIR]);
await run(["mkdir", "-p", FRAMES_DIR, OUT_DIR]);

for (const { name, col, row } of FRAME_CELLS) {
  const cropPath = `${FRAMES_DIR}/crop-${name}.png`;
  const framePath = `${FRAMES_DIR}/${name}.png`;
  await run([
    "magick", SOURCE, "-crop", `${CELL}x${CELL}+${col * CELL}+${row * CELL}`,
    "+repage", cropPath,
  ]);
  await run([
    "bun", "tools/art/postprocess.ts", "--input", cropPath, "--output", framePath,
    "--width", String(CANVAS), "--height", String(CANVAS),
    "--figure-height", String(FIGURE_HEIGHT), "--bottom-margin", "8",
    "--key", "#FF00FF", "--fuzz", "25%", "--despill", "edge", "--holes",
  ]);
  await run([
    "bun", "tools/art/drop-islands.ts", "--input", framePath, "--output", framePath,
    "--min", "80",
  ]);
  const despilled = `${FRAMES_DIR}/${name}-despill.png`;
  await run([
    "bun", "tools/art/despill-edge.ts", "--input", framePath, "--output", despilled,
    "--key", "magenta", "--band", "12",
  ]);
  await run(["mv", despilled, framePath]);
}

await run([
  "magick", "montage", ...FRAME_CELLS.map(({ name }) => `${FRAMES_DIR}/${name}.png`),
  "-tile", "4x1", "-geometry", `${CANVAS}x${CANVAS}+0+0`, "-background", "none", ATLAS_PNG,
]);

const records: Record<string, unknown> = {};
for (let i = 0; i < FRAME_CELLS.length; i += 1) {
  const entry = FRAME_CELLS[i];
  if (entry === undefined) continue;
  records[entry.name] = {
    frame: { x: i * CANVAS, y: 0, w: CANVAS, h: CANVAS },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: CANVAS, h: CANVAS },
    sourceSize: { w: CANVAS, h: CANVAS },
    anchor: { x: 0.5, y: BASELINE / CANVAS },
  };
}

await Bun.write(
  ATLAS_JSON,
  `${JSON.stringify(
    {
      frames: records,
      animations: {
        idle_down: ["down_idle_01", "down_idle_02"],
        idle_left: ["left_idle_01"],
        idle_right: ["right_idle_01"],
      },
      meta: {
        image: "buster.png",
        size: { w: CANVAS * FRAME_CELLS.length, h: CANVAS },
        scale: "1",
        baseline: BASELINE,
      },
    },
    null,
    2,
  )}\n`,
);
