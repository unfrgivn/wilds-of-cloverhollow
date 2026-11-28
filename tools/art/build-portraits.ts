#!/usr/bin/env bun
// Deterministically builds the Art Wave A2 multi-expression portrait atlas
// (`public/assets/portraits/portraits.{png,json}`) from raw 5-expression strips
// in `art/source/portraits/<id>-sheet-raw.png` and emits JPEG review sheets in
// `art/review/`. Run `bun tools/art/optimize-atlases.ts` after to produce WebP.
import { mkdirSync } from "node:fs";

export {};

type ChromaKey = "green" | "magenta";

type CastSpec = {
  id: string;
  label: string;
  key: ChromaKey;
  fuzz: string;
};

const EXPRESSIONS = ["neutral", "happy", "worried", "determined", "surprised"] as const;

const CAST: readonly CastSpec[] = [
  { id: "fae", label: "Fae", key: "green", fuzz: "26%" },
  { id: "maddie", label: "Maddie", key: "green", fuzz: "26%" },
  { id: "sue", label: "Sue", key: "magenta", fuzz: "26%" },
  { id: "jordan", label: "Jordan", key: "magenta", fuzz: "26%" },
  { id: "milo", label: "Milo", key: "magenta", fuzz: "26%" },
  { id: "mom", label: "Mom", key: "magenta", fuzz: "26%" },
  { id: "dad", label: "Dad", key: "green", fuzz: "26%" },
  { id: "barnaby", label: "Barnaby", key: "magenta", fuzz: "26%" },
  { id: "teacher", label: "Ms. Maple", key: "green", fuzz: "26%" },
  { id: "nurse", label: "Nurse Holly", key: "magenta", fuzz: "26%" },
];

const CELL_SIZE = 200;
const MAX_DRAW_W = 172;
const MAX_DRAW_H = 180;
const MAX_BUST_ASPECT = 1.48;
const SCRATCH_DIR = "art/scratch/portraits-build";
const OUT_DIR = "public/assets/portraits";

async function run(command: string[]): Promise<Uint8Array> {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const stdout = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const stderr = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}\n${stderr.trim()}`);
  }
  return stdout;
}

async function imageSize(path: string): Promise<{ width: number; height: number }> {
  const raw = new TextDecoder().decode(
    await run(["magick", "identify", "-format", "%w %h", path]),
  );
  const [w = 0, h = 0] = raw.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`Invalid dimensions for ${path}: ${raw}`);
  }
  return { width: w, height: h };
}

type Bounds = { x: number; y: number; w: number; h: number };

async function alphaBounds(path: string): Promise<Bounds> {
  const { width, height } = await imageSize(path);
  const rgba = await run(["magick", path, "-alpha", "on", "-depth", "8", "rgba:-"]);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = rgba[(y * width + x) * 4 + 3] ?? 0;
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error(`Empty transparent frame: ${path}`);
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function findSplitColumns(path: string, panels: number): Promise<number[]> {
  const { width, height } = await imageSize(path);
  const rgba = await run(["magick", path, "-alpha", "on", "-depth", "8", "rgba:-"]);
  const colCounts = new Uint32Array(width);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      if ((rgba[(rowOffset + x) * 4 + 3] ?? 0) > 16) {
        colCounts[x] = (colCounts[x] ?? 0) + 1;
      }
    }
  }

  const splits: number[] = [0];
  for (let i = 1; i < panels; i += 1) {
    const approx = Math.round((width * i) / panels);
    const searchRadius = Math.round(width * 0.085);
    const left = Math.max((splits[i - 1] ?? 0) + Math.round(width * 0.1), approx - searchRadius);
    const right = Math.min(width - 1, approx + searchRadius);

    // Find the column with minimum opaque count; prefer center of widest zero-run.
    let minVal = Number.POSITIVE_INFINITY;
    for (let x = left; x <= right; x += 1) {
      const count = colCounts[x] ?? 0;
      if (count < minVal) minVal = count;
    }
    let bestStart = approx;
    let bestLen = -1;
    let runStart = -1;
    for (let x = left; x <= right + 1; x += 1) {
      const matches = x <= right && (colCounts[x] ?? 0) === minVal;
      if (matches && runStart < 0) {
        runStart = x;
      } else if (!matches && runStart >= 0) {
        const len = x - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
    const splitX = bestLen > 0 ? Math.round(bestStart + (bestLen - 1) / 2) : approx;
    splits.push(splitX);
  }
  splits.push(width);
  return splits;
}

async function keepLargestComponent(path: string): Promise<void> {
  const { width, height } = await imageSize(path);
  const pixels = await run(["magick", path, "-alpha", "on", "-depth", "8", "rgba:-"]);
  const total = width * height;
  const seen = new Uint8Array(total);
  let largest: number[] = [];
  const allComponents: number[][] = [];
  for (let start = 0; start < total; start += 1) {
    if (seen[start] === 1 || (pixels[start * 4 + 3] ?? 0) === 0) continue;
    const comp: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const idx = stack.pop();
      if (idx === undefined) continue;
      comp.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next] === 1 || (pixels[next * 4 + 3] ?? 0) === 0) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    allComponents.push(comp);
    if (comp.length > largest.length) largest = comp;
  }
  let changed = false;
  for (const comp of allComponents) {
    if (comp === largest) continue;
    changed = true;
    for (const idx of comp) pixels[idx * 4 + 3] = 0;
  }
  if (!changed) return;
  const write = Bun.spawn(
    ["magick", "-size", `${width}x${height}`, "-depth", "8", "rgba:-", path],
    { stdin: "pipe", stderr: "inherit" },
  );
  write.stdin.write(pixels);
  await write.stdin.end();
  if ((await write.exited) !== 0) throw new Error(`Could not write ${path}`);
}

async function processCharacter(spec: CastSpec): Promise<string[]> {
  const source = `art/source/portraits/${spec.id}-sheet-raw.png`;
  const charScratch = `${SCRATCH_DIR}/${spec.id}`;
  mkdirSync(charScratch, { recursive: true });

  const keyHex = spec.key === "green" ? "#00FF00" : "#FF00FF";
  const keyedPath = `${charScratch}/keyed.png`;
  const despilledPath = `${charScratch}/despilled.png`;

  await run([
    "bun",
    "tools/art/key-alpha.ts",
    "--input",
    source,
    "--output",
    keyedPath,
    "--key",
    keyHex,
    "--fuzz",
    spec.fuzz,
    "--despill",
    "none",
    "--holes",
  ]);
  await run([
    "bun",
    "tools/art/despill-edge.ts",
    "--input",
    keyedPath,
    "--output",
    despilledPath,
    "--key",
    spec.key,
    "--band",
    "10",
  ]);

  const { height } = await imageSize(despilledPath);
  const splits = await findSplitColumns(despilledPath, EXPRESSIONS.length);
  const cleanedPanels: { expr: (typeof EXPRESSIONS)[number]; path: string; bounds: Bounds }[] = [];

  for (let i = 0; i < EXPRESSIONS.length; i += 1) {
    const expr = EXPRESSIONS[i];
    if (expr === undefined) continue;
    const x0 = splits[i] ?? 0;
    const x1 = splits[i + 1] ?? x0 + 1;
    const cropW = Math.max(1, x1 - x0);
    const panelPath = `${charScratch}/panel-${expr}.png`;
    await run([
      "magick",
      despilledPath,
      "-crop",
      `${cropW}x${height}+${x0}+0`,
      "+repage",
      panelPath,
    ]);
    await keepLargestComponent(panelPath);
    const bounds = await alphaBounds(panelPath);
    cleanedPanels.push({ expr, path: panelPath, bounds });
  }

  const maxW = Math.max(...cleanedPanels.map((p) => p.bounds.w));
  const rawMaxH = Math.max(...cleanedPanels.map((p) => p.bounds.h));
  // Uniform chest-up bust crop across all 5 expressions if a sheet drew extra torso length.
  const bustCapH = Math.round(maxW * MAX_BUST_ASPECT);
  const maxH = Math.min(rawMaxH, bustCapH);
  const scale = Math.min(MAX_DRAW_W / maxW, MAX_DRAW_H / maxH);

  const outputFrames: string[] = [];
  for (const panel of cleanedPanels) {
    const cropH = Math.min(panel.bounds.h, bustCapH);
    const scaledW = Math.max(1, Math.round(panel.bounds.w * scale));
    const scaledH = Math.max(1, Math.round(cropH * scale));
    const offsetX = Math.round((CELL_SIZE - scaledW) / 2);
    // Anchor bust flush with the bottom of the 200x200 frame so shoulders meet the
    // circular portrait medallion rim cleanly while tall buns/hats/ears keep top clearance.
    const offsetY = CELL_SIZE - scaledH;
    const outPath = `${SCRATCH_DIR}/frames/${spec.id}_${panel.expr}.png`;
    await run([
      "magick",
      panel.path,
      "-crop",
      `${panel.bounds.w}x${cropH}+${panel.bounds.x}+${panel.bounds.y}`,
      "+repage",
      "-filter",
      "Lanczos",
      "-resize",
      `${scaledW}x${scaledH}!`,
      "-background",
      "none",
      "-extent",
      `${CELL_SIZE}x${CELL_SIZE}-${offsetX}-${offsetY}`,
      outPath,
    ]);
    outputFrames.push(outPath);
  }
  console.log(
    `[portraits] ${spec.id} (${spec.key}): splits=${splits.join(",")} ` +
      `max=${maxW}x${maxH} scale=${scale.toFixed(4)}`,
  );
  return outputFrames;
}

async function buildGroupReviewSheet(
  group: readonly CastSpec[],
  outputJpg: string,
): Promise<void> {
  const framePaths: string[] = [];
  for (const spec of group) {
    for (const expr of EXPRESSIONS) {
      framePaths.push(`${SCRATCH_DIR}/frames/${spec.id}_${expr}.png`);
    }
  }
  const creamPath = `${SCRATCH_DIR}/${outputJpg.split("/").pop()?.replace(".jpg", ".cream.png")}`;
  const darkPath = `${SCRATCH_DIR}/${outputJpg.split("/").pop()?.replace(".jpg", ".dark.png")}`;
  await run([
    "magick",
    "montage",
    ...framePaths,
    "-label",
    "%t",
    "-tile",
    "5x",
    "-geometry",
    "200x200+10+22",
    "-background",
    "#F5F1E0",
    "-fill",
    "#47321F",
    "-pointsize",
    "15",
    "-gravity",
    "south",
    creamPath,
  ]);
  await run([
    "magick",
    "montage",
    ...framePaths,
    "-tile",
    "5x",
    "-geometry",
    "120x120+8+8",
    "-background",
    "#29283B",
    darkPath,
  ]);
  await run([
    "magick",
    creamPath,
    darkPath,
    "-background",
    "#F5F1E0",
    "-gravity",
    "center",
    "-append",
    "-resize",
    "1400x1400>",
    "-quality",
    "90",
    outputJpg,
  ]);
}

async function buildMedallionReviewSheet(outputJpg: string): Promise<void> {
  const medallionDir = `${SCRATCH_DIR}/medallions`;
  mkdirSync(medallionDir, { recursive: true });
  const tiles: string[] = [];
  for (const spec of CAST) {
    for (const expr of EXPRESSIONS) {
      const src = `${SCRATCH_DIR}/frames/${spec.id}_${expr}.png`;
      const tile = `${medallionDir}/${spec.id}_${expr}.png`;
      await run([
        "magick",
        "-size",
        "120x120",
        "xc:#F5F1E0",
        "-fill",
        "#FBF6E8",
        "-stroke",
        "#47321F",
        "-strokewidth",
        "3",
        "-draw",
        "circle 60,60 60,6",
        "(",
        "-size",
        "106x106",
        "xc:#FBF6E8",
        src,
        "-resize",
        "106x106",
        "-gravity",
        "center",
        "-composite",
        "(",
        "-size",
        "106x106",
        "xc:black",
        "-fill",
        "white",
        "-draw",
        "circle 53,53 53,1",
        ")",
        "-alpha",
        "off",
        "-compose",
        "CopyOpacity",
        "-composite",
        ")",
        "-gravity",
        "center",
        "-compose",
        "Over",
        "-composite",
        tile,
      ]);
      tiles.push(tile);
    }
  }
  await run([
    "magick",
    "montage",
    ...tiles,
    "-tile",
    "10x5",
    "-geometry",
    "120x120+6+6",
    "-background",
    "#F5F1E0",
    "-resize",
    "1400x1400>",
    "-quality",
    "90",
    outputJpg,
  ]);
}

mkdirSync(`${SCRATCH_DIR}/frames`, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync("art/review", { recursive: true });

const allFrames: { name: string; path: string }[] = [];
const CONCURRENCY = 4;
const processedByCast = new Map<string, string[]>();
let cursor = 0;
const workers = Array.from({ length: Math.min(CONCURRENCY, CAST.length) }, async () => {
  while (cursor < CAST.length) {
    const spec = CAST[cursor];
    cursor += 1;
    if (spec === undefined) continue;
    const paths = await processCharacter(spec);
    processedByCast.set(spec.id, paths);
  }
});
await Promise.all(workers);

for (const spec of CAST) {
  const paths = processedByCast.get(spec.id) ?? [];
  for (let i = 0; i < EXPRESSIONS.length; i += 1) {
    const expr = EXPRESSIONS[i];
    const path = paths[i];
    if (expr !== undefined && path !== undefined) {
      allFrames.push({ name: `${spec.id}_${expr}`, path });
    }
  }
}

const COLS = 10;
const ROWS = Math.ceil(allFrames.length / COLS);
const ATLAS_W = COLS * CELL_SIZE;
const ATLAS_H = ROWS * CELL_SIZE;
if (ATLAS_W > 2048 || ATLAS_H > 2048) {
  throw new Error(`Portrait atlas ${ATLAS_W}x${ATLAS_H} exceeds 2048x2048 texture budget`);
}

const atlasPng = `${OUT_DIR}/portraits.png`;
await run([
  "magick",
  "montage",
  ...allFrames.map((f) => f.path),
  "-tile",
  `${COLS}x${ROWS}`,
  "-geometry",
  `${CELL_SIZE}x${CELL_SIZE}+0+0`,
  "-background",
  "none",
  "-alpha",
  "on",
  atlasPng,
]);

const framesRecord: Record<string, unknown> = {};
allFrames.forEach((entry, index) => {
  framesRecord[entry.name] = {
    frame: {
      x: (index % COLS) * CELL_SIZE,
      y: Math.floor(index / COLS) * CELL_SIZE,
      w: CELL_SIZE,
      h: CELL_SIZE,
    },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: CELL_SIZE, h: CELL_SIZE },
    sourceSize: { w: CELL_SIZE, h: CELL_SIZE },
  };
});

const atlasJson = {
  frames: framesRecord,
  meta: {
    image: "portraits.png",
    size: { w: ATLAS_W, h: ATLAS_H },
    scale: "1",
  },
};
await Bun.write(`${OUT_DIR}/portraits.json`, `${JSON.stringify(atlasJson, null, 2)}\n`);

await buildGroupReviewSheet(CAST.slice(0, 5), "art/review/e3-portraits-cast-a.jpg");
await buildGroupReviewSheet(CAST.slice(5, 10), "art/review/e3-portraits-cast-b.jpg");
await buildMedallionReviewSheet("art/review/e3-portraits-medallions.jpg");

console.log(`Built ${allFrames.length} portrait frames into ${atlasPng} (${ATLAS_W}x${ATLAS_H})`);
