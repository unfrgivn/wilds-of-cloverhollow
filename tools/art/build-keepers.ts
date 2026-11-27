#!/usr/bin/env bun
// Deterministically builds Bay Keeper and Pass Keeper runtime atlases (Milestone 92)
// from art/source/townspeople/{bay-keeper,pass-keeper}/sheet-raw.png using the
// townspeople magenta chroma-key pipeline.
export {};

type FrameCell = {
  readonly name: string;
  readonly col: number;
  readonly row: number;
};

type KeeperSpec = {
  readonly id: string;
  readonly source: string;
  readonly cells: readonly FrameCell[];
};

const FIGURE_HEIGHT = 336;
const CANVAS = 448;
const BASELINE = 439;
const CELL = 1024;

// Quadrant mapping verified visually against both raw sheets:
// (0,0) front open, (1,0) front blink, (1,1) 3/4 facing left, (0,1) 3/4 facing right.
const STANDARD_CELLS: readonly FrameCell[] = [
  { name: "down_idle_01", col: 0, row: 0 },
  { name: "down_idle_02", col: 1, row: 0 },
  { name: "left_idle_01", col: 1, row: 1 },
  { name: "right_idle_01", col: 0, row: 1 },
];

const KEEPERS: readonly KeeperSpec[] = [
  {
    id: "bay-keeper",
    source: "art/source/townspeople/bay-keeper/sheet-raw.png",
    cells: STANDARD_CELLS,
  },
  {
    id: "pass-keeper",
    source: "art/source/townspeople/pass-keeper/sheet-raw.png",
    cells: STANDARD_CELLS,
  },
];

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function buildKeeper(keeper: KeeperSpec): Promise<void> {
  const framesDir = `art/scratch/${keeper.id}-build-frames`;
  const outDir = `public/assets/characters/${keeper.id}`;
  const atlasPng = `${outDir}/${keeper.id}.png`;
  const atlasJson = `${outDir}/${keeper.id}.json`;

  await run(["rm", "-rf", framesDir]);
  await run(["mkdir", "-p", framesDir, outDir]);

  for (const { name, col, row } of keeper.cells) {
    const cropPath = `${framesDir}/crop-${name}.png`;
    const framePath = `${framesDir}/${name}.png`;
    await run([
      "magick", keeper.source, "-crop", `${CELL}x${CELL}+${col * CELL}+${row * CELL}`,
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
    const despilled = `${framesDir}/${name}-despill.png`;
    await run([
      "bun", "tools/art/despill-edge.ts", "--input", framePath, "--output", despilled,
      "--key", "magenta", "--band", "12",
    ]);
    await run(["mv", despilled, framePath]);
  }

  await run([
    "magick", "montage", ...keeper.cells.map(({ name }) => `${framesDir}/${name}.png`),
    "-tile", "4x1", "-geometry", `${CANVAS}x${CANVAS}+0+0`, "-background", "none", atlasPng,
  ]);

  const records: Record<string, unknown> = {};
  for (let i = 0; i < keeper.cells.length; i += 1) {
    const entry = keeper.cells[i];
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
    atlasJson,
    `${JSON.stringify(
      {
        frames: records,
        animations: {
          idle_down: ["down_idle_01", "down_idle_02"],
          idle_left: ["left_idle_01"],
          idle_right: ["right_idle_01"],
        },
        meta: {
          image: `${keeper.id}.png`,
          size: { w: CANVAS * keeper.cells.length, h: CANVAS },
          scale: "1",
          baseline: BASELINE,
        },
      },
      null,
      2,
    )}\n`,
  );
}

for (const keeper of KEEPERS) {
  await buildKeeper(keeper);
}
