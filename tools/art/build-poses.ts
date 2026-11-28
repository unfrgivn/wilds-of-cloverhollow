#!/usr/bin/env bun
// Deterministic builder for Art Wave A1 expressive character pose sheets
// (fae-poses, maddie-poses, sue-poses, jordan-poses).
//
// Extracts whole connected components from the committed raw strips in
// art/source/, keys out the character's chroma background (--holes, no global
// despill), despills ONLY the alpha-edge band via despill-edge.ts, applies one
// uniform scale factor per strip (preserving natural posture height differences
// for sit/stretch/nap), aligns feet to the character's exact baseline, packs
// PixiJS v8 spritesheets, and renders cream + dark review contact sheets with
// the approved base down_idle_01 sprite in slot 0 for visual parity checks.
//
//   bun tools/art/build-poses.ts [--only fae|maddie|sue|jordan]
import { mkdirSync, readFileSync } from "node:fs";

type StripSpec = {
  id: string;
  source: string;
  scalePercent: number;
  poses: readonly { name: string; index: number; flop?: boolean }[];
};

type CharacterPoseSpec = {
  id: string;
  keyHex: string;
  keyName: "green" | "magenta";
  fuzz: string;
  canvas: number;
  baseline: number;
  columns: number;
  baseAtlas: string;
  baseJson: string;
  strips: readonly StripSpec[];
};

const SPECS: readonly CharacterPoseSpec[] = [
  {
    id: "fae",
    keyHex: "#00FF00",
    keyName: "green",
    fuzz: "18%",
    canvas: 384,
    baseline: 375,
    columns: 4,
    baseAtlas: "public/assets/characters/fae/fae.webp",
    baseJson: "public/assets/characters/fae/fae.json",
    strips: [
      {
        id: "expressive",
        source: "art/source/fae/fae-poses-expressive-v2.png",
        scalePercent: 23.0,
        poses: [
          { name: "cheer", index: 1 },
          { name: "shock", index: 2 },
          { name: "sit", index: 3 },
          { name: "talk", index: 4 },
        ],
      },
      {
        id: "tools",
        source: "art/source/fae/fae-poses-tools-v1.png",
        scalePercent: 21.5,
        poses: [
          { name: "tool_lantern", index: 1 },
          { name: "tool_lasso", index: 2 },
          { name: "tool_flute", index: 3 },
        ],
      },
    ],
  },
  {
    id: "maddie",
    keyHex: "#00FF00",
    keyName: "green",
    fuzz: "18%",
    canvas: 256,
    baseline: 247,
    columns: 4,
    baseAtlas: "public/assets/characters/maddie/maddie.webp",
    baseJson: "public/assets/characters/maddie/maddie.json",
    strips: [
      {
        id: "poses",
        source: "art/source/maddie/maddie-poses-v2.png",
        scalePercent: 15.4,
        poses: [
          { name: "groom", index: 1 },
          { name: "stretch", index: 2 },
          { name: "nap", index: 3 },
          { name: "cheer", index: 4 },
        ],
      },
    ],
  },
  {
    id: "sue",
    keyHex: "#FF00FF",
    keyName: "magenta",
    fuzz: "18%",
    canvas: 384,
    baseline: 375,
    columns: 3,
    baseAtlas: "public/assets/characters/sue/sue.webp",
    baseJson: "public/assets/characters/sue/sue.json",
    strips: [
      {
        id: "poses",
        source: "art/source/sue/sue-poses-v2.png",
        scalePercent: 20.1,
        poses: [
          { name: "cheer", index: 1 },
          { name: "shock", index: 2 },
          { name: "sit", index: 3 },
        ],
      },
    ],
  },
  {
    id: "jordan",
    keyHex: "#FF00FF",
    keyName: "magenta",
    fuzz: "18%",
    canvas: 384,
    baseline: 375,
    columns: 3,
    baseAtlas: "public/assets/characters/jordan/jordan.webp",
    baseJson: "public/assets/characters/jordan/jordan.json",
    strips: [
      {
        id: "poses",
        source: "art/source/jordan/jordan-poses-v1.png",
        scalePercent: 22.0,
        poses: [
          { name: "cheer", index: 1 },
          { name: "shock", index: 2 },
          { name: "sit", index: 3 },
        ],
      },
    ],
  },
];

function argValue(name: string): string | null {
  const idx = Bun.argv.indexOf(`--${name}`);
  return idx >= 0 ? (Bun.argv[idx + 1] ?? null) : null;
}

async function runChecked(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Command failed (${code}): ${cmd.join(" ")}`);
}

type FrameRect = { x: number; y: number; w: number; h: number };

function readBaseIdleFrame(jsonPath: string): FrameRect {
  const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid base sheet JSON: ${jsonPath}`);
  }
  const frames = Reflect.get(parsed, "frames");
  if (typeof frames !== "object" || frames === null) {
    throw new Error(`Missing frames in ${jsonPath}`);
  }
  const idle = Reflect.get(frames, "down_idle_01");
  const rect = typeof idle === "object" && idle !== null ? Reflect.get(idle, "frame") : null;
  if (typeof rect !== "object" || rect === null) {
    throw new Error(`Missing down_idle_01 in ${jsonPath}`);
  }
  const x = Reflect.get(rect, "x");
  const y = Reflect.get(rect, "y");
  const w = Reflect.get(rect, "w");
  const h = Reflect.get(rect, "h");
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof w !== "number" ||
    typeof h !== "number"
  ) {
    throw new Error(`Malformed frame rect in ${jsonPath}`);
  }
  return { x, y, w, h };
}

async function buildCharacterPoses(spec: CharacterPoseSpec): Promise<void> {
  const workDir = `art/scratch/e2-build/${spec.id}`;
  const framesDir = `${workDir}/frames`;
  mkdirSync(framesDir, { recursive: true });
  mkdirSync(`public/assets/characters/${spec.id}`, { recursive: true });
  mkdirSync("art/review", { recursive: true });

  const orderedFrames: { pose: string; frameName: string; path: string }[] = [];
  const bottomMargin = spec.canvas - spec.baseline - 1;

  for (const strip of spec.strips) {
    const extractDir = `${workDir}/extract-${strip.id}`;
    await runChecked([
      "bun",
      "tools/art/extract-figures.ts",
      "--input",
      strip.source,
      "--output",
      extractDir,
      "--expected",
      String(strip.poses.length),
      "--key",
      spec.keyHex,
      "--fuzz",
      spec.fuzz,
    ]);

    for (const pose of strip.poses) {
      const raw = `${extractDir}/raw-${String(pose.index).padStart(2, "0")}.png`;
      const keyed = `${workDir}/${pose.name}.keyed.png`;
      const cleaned = `${workDir}/${pose.name}.clean.png`;
      const frameName = `pose_${pose.name}_01`;
      const outFrame = `${framesDir}/${frameName}.png`;

      // 1. Chroma key with enclosed holes + edge-only despill (preserves interior colors).
      await runChecked([
        "bun",
        "tools/art/key-alpha.ts",
        "--input",
        raw,
        "--output",
        keyed,
        "--key",
        spec.keyHex,
        "--fuzz",
        spec.fuzz,
        "--despill",
        "edge",
        "--holes",
      ]);

      // 2. Drop tiny disconnected keying debris, erode 1px outer alpha rim, edge-only despill.
      await runChecked([
        "bun",
        "tools/art/drop-islands.ts",
        "--input",
        keyed,
        "--output",
        cleaned,
        "--min",
        "40",
      ]);
      await runChecked([
        "magick",
        cleaned,
        ...(pose.flop === true ? ["-flop"] : []),
        "-channel",
        "A",
        "-morphology",
        "Erode",
        "Disk:1",
        "+channel",
        cleaned,
      ]);
      await runChecked([
        "bun",
        "tools/art/despill-edge.ts",
        "--input",
        cleaned,
        "--output",
        cleaned,
        "--key",
        spec.keyName,
        "--band",
        "12",
      ]);

      // 3. Trim, apply strip's uniform scale factor, align feet to baseline on fixed canvas.
      await runChecked([
        "magick",
        cleaned,
        "-trim",
        "+repage",
        "-resize",
        `${strip.scalePercent}%`,
        "-gravity",
        "south",
        "-background",
        "none",
        "-extent",
        `${spec.canvas}x${spec.canvas - bottomMargin}`,
        "-gravity",
        "north",
        "-extent",
        `${spec.canvas}x${spec.canvas}`,
        outFrame,
      ]);

      // 4. Clean anti-aliased edge fringe after resize (edge band only, matching build-sue/jordan).
      await runChecked([
        "bun",
        "tools/art/despill-edge.ts",
        "--input",
        outFrame,
        "--output",
        outFrame,
        "--key",
        spec.keyName,
        "--band",
        "12",
      ]);
      await runChecked([
        "bun",
        "tools/art/drop-islands.ts",
        "--input",
        outFrame,
        "--output",
        outFrame,
        "--min",
        "20",
      ]);

      orderedFrames.push({ pose: pose.name, frameName, path: outFrame });
    }
  }

  // Pack PNG atlas + PixiJS v8 JSON.
  const pngOut = `public/assets/characters/${spec.id}/${spec.id}-poses.png`;
  const jsonOut = `public/assets/characters/${spec.id}/${spec.id}-poses.json`;
  const rows = Math.ceil(orderedFrames.length / spec.columns);

  await runChecked([
    "magick",
    "montage",
    ...orderedFrames.map((item) => item.path),
    "-tile",
    `${spec.columns}x`,
    "-geometry",
    `${spec.canvas}x${spec.canvas}+0+0`,
    "-background",
    "none",
    "-alpha",
    "on",
    pngOut,
  ]);

  const anchorY = spec.baseline / spec.canvas;
  const framesRecord: Record<string, unknown> = {};
  const animationsRecord: Record<string, string[]> = {};
  for (const [index, item] of orderedFrames.entries()) {
    framesRecord[item.frameName] = {
      frame: {
        x: (index % spec.columns) * spec.canvas,
        y: Math.floor(index / spec.columns) * spec.canvas,
        w: spec.canvas,
        h: spec.canvas,
      },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: spec.canvas, h: spec.canvas },
      sourceSize: { w: spec.canvas, h: spec.canvas },
      anchor: { x: 0.5, y: anchorY },
    };
    animationsRecord[`pose_${item.pose}`] = [item.frameName];
  }

  const sheet = {
    frames: framesRecord,
    animations: animationsRecord,
    meta: {
      image: `${spec.id}-poses.png`,
      size: { w: spec.columns * spec.canvas, h: rows * spec.canvas },
      scale: "1",
      baseline: spec.baseline,
    },
  };
  await Bun.write(jsonOut, `${JSON.stringify(sheet, null, 2)}\n`);

  // Render review contact sheets on cream (#F5F1E0) and dark (#29283B) with
  // the approved base down_idle_01 sprite in slot 0 for side-by-side scale check.
  const baseRect = readBaseIdleFrame(spec.baseJson);
  const baseIdlePath = `${workDir}/base_down_idle_01.png`;
  await runChecked([
    "magick",
    spec.baseAtlas,
    "-crop",
    `${baseRect.w}x${baseRect.h}+${baseRect.x}+${baseRect.y}`,
    "+repage",
    baseIdlePath,
  ]);

  const reviewTiles = [baseIdlePath, ...orderedFrames.map((item) => item.path)];
  const reviewCols = Math.min(4, reviewTiles.length);
  const tileSize = spec.canvas;

  const creamOut = `art/review/e2-${spec.id}-poses-cream.jpg`;
  const darkOut = `art/review/e2-${spec.id}-poses-dark.jpg`;
  await runChecked([
    "magick",
    "montage",
    ...reviewTiles,
    "-label",
    "%t",
    "-tile",
    `${reviewCols}x`,
    "-geometry",
    `${tileSize}x${tileSize}+14+26`,
    "-background",
    "#F5F1E0",
    "-fill",
    "#5B3530",
    "-pointsize",
    "18",
    "-gravity",
    "south",
    "-quality",
    "90",
    creamOut,
  ]);
  await runChecked([
    "magick",
    "montage",
    ...reviewTiles,
    "-label",
    "%t",
    "-tile",
    `${reviewCols}x`,
    "-geometry",
    `${tileSize}x${tileSize}+14+26`,
    "-background",
    "#29283B",
    "-fill",
    "#F5F1E0",
    "-pointsize",
    "18",
    "-gravity",
    "south",
    "-quality",
    "90",
    darkOut,
  ]);
  console.log(`Built ${spec.id}-poses -> ${pngOut}, ${creamOut}, ${darkOut}`);
}

const only = argValue("only");
const selected = only === null ? SPECS : SPECS.filter((item) => item.id === only);
if (selected.length === 0) throw new Error(`Unknown --only target: ${only}`);
for (const spec of selected) {
  await buildCharacterPoses(spec);
}
