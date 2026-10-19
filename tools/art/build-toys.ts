#!/usr/bin/env bun
export {};
// Cut isolated toy islands from approved atlas frames. The source pixels are
// copied byte-for-byte; only the alpha outside the chosen island is cleared
// and transparent padding is added.

type Seed = { name: string; x: number; y: number };
type Source = { name: string; atlas: string; frame: string; seeds: Seed[] };
type Recipe = { threshold: number; padding: number; sources: Source[] };
type Component = {
  pixels: number[]; minX: number; minY: number; maxX: number; maxY: number;
};
type Frame = { x: number; y: number; w: number; h: number };
type Toy = {
  name: string; source: string; path: string; width: number; height: number;
  pixels: Uint8Array; sourcePixels: Uint8Array; sourceWidth: number;
  sourceX: number; sourceY: number; mask: Uint8Array;
};

const recipePath = "art/recipes/toys.json";
const recipe = JSON.parse(await Bun.file(recipePath).text()) as Recipe;
const scratch = "art/scratch/toys-build";
await Bun.$`rm -rf ${scratch}`;
await Bun.$`mkdir -p ${scratch}/sources ${scratch}/frames public/assets/battle/toys art/review`;

async function command(args: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(args, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${args.join(" ")}`);
  return bytes;
}

async function dimensions(path: string): Promise<{ width: number; height: number }> {
  const text = new TextDecoder().decode(await command([
    "magick", "identify", "-format", "%w %h", path,
  ]));
  const values = text.trim().split(" ").map(Number);
  const width = values[0] ?? 0; const height = values[1] ?? 0;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid dimensions for ${path}`);
  }
  return { width, height };
}

async function rgba(path: string): Promise<{ pixels: Uint8Array; width: number; height: number }> {
  const { width, height } = await dimensions(path);
  const pixels = await command(["magick", path, "-alpha", "on", "-depth", "8", "rgba:-"]);
  if (pixels.length !== width * height * 4) throw new Error(`Invalid RGBA data for ${path}`);
  return { pixels, width, height };
}

async function writeRgba(
  path: string, pixels: Uint8Array, width: number, height: number,
): Promise<void> {
  const child = Bun.spawn([
    "magick", "-size", `${width}x${height}`, "-depth", "8", "rgba:-", "-strip",
    "-define", "png:exclude-chunk=date,time", `PNG32:${path}`,
  ], { stdin: "pipe", stderr: "inherit" });
  child.stdin.write(pixels);
  await child.stdin.end();
  if (await child.exited !== 0) throw new Error(`Could not write ${path}`);
}

async function frameFromAtlas(atlas: string, frameName: string): Promise<Frame> {
  const json: unknown = JSON.parse(await Bun.file(atlas.replace(/\.png$/, ".json")).text());
  if (typeof json !== "object" || json === null || !("frames" in json)) {
    throw new Error(`Invalid atlas JSON: ${atlas}`);
  }
  const frames: unknown = json.frames;
  if (!isRecord(frames) || !(frameName in frames)) {
    throw new Error(`Missing frame ${frameName} in ${atlas}`);
  }
  const entry: unknown = frames[frameName];
  if (typeof entry !== "object" || entry === null || !("frame" in entry)) {
    throw new Error(`Invalid frame ${frameName}`);
  }
  const box: unknown = entry.frame;
  if (!isRecord(box)) throw new Error(`Invalid box ${frameName}`);
  const x = Number(box.x); const y = Number(box.y);
  const w = Number(box.w); const h = Number(box.h);
  if (![x, y, w, h].every(Number.isFinite)) {
    throw new Error(`Invalid dimensions ${frameName}`);
  }
  return { x, y, w, h };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function components(
  pixels: Uint8Array, width: number, height: number, threshold: number,
): Component[] {
  const seen = new Uint8Array(width * height);
  const result: Component[] = [];
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] === 1 || (pixels[start * 4 + 3] ?? 0) <= threshold) continue;
    const stack = [start]; const found: number[] = [];
    let minX = width; let minY = height; let maxX = 0; let maxY = 0;
    seen[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop(); if (index === undefined) continue;
      found.push(index); const x = index % width; const y = Math.floor(index / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] === 1 || (pixels[next * 4 + 3] ?? 0) <= threshold) continue;
        seen[next] = 1; stack.push(next);
      }
    }
    result.push({ pixels: found, minX, minY, maxX, maxY });
  }
  return result;
}

const toys: Toy[] = [];
const reviewSources: string[] = [];
for (const source of recipe.sources) {
  const frame = await frameFromAtlas(source.atlas, source.frame);
  const sourcePath = `${scratch}/sources/${source.name}.png`;
  await command([
    "magick", source.atlas, "-crop", `${frame.w}x${frame.h}+${frame.x}+${frame.y}`,
    "+repage", sourcePath,
  ]);
  const image = await rgba(sourcePath);
  const found = components(image.pixels, image.width, image.height, recipe.threshold);
  const selected: Component[] = [];
  const rectangles: string[] = [];
  for (const seed of source.seeds) {
    const index = seed.y * image.width + seed.x;
    const component = found.find((candidate) => candidate.pixels.includes(index));
    if (component === undefined) {
      throw new Error(`Seed ${source.name}/${seed.name} is not on an opaque component`);
    }
    if (selected.includes(component)) {
      throw new Error(`Seed ${source.name}/${seed.name} duplicates a component`);
    }
    selected.push(component);
    rectangles.push(
      `rectangle ${component.minX},${component.minY} ${component.maxX},${component.maxY}`,
    );
    const width = component.maxX - component.minX + 1 + recipe.padding * 2;
    const height = component.maxY - component.minY + 1 + recipe.padding * 2;
    const output = new Uint8Array(width * height * 4);
    const mask = new Uint8Array(width * height);
    for (const pixel of component.pixels) {
      const x = pixel % image.width - component.minX + recipe.padding;
      const y = Math.floor(pixel / image.width) - component.minY + recipe.padding;
      const from = pixel * 4; const to = (y * width + x) * 4;
      const red = image.pixels[from]; const green = image.pixels[from + 1];
      const blue = image.pixels[from + 2]; const alpha = image.pixels[from + 3];
      if (red === undefined || green === undefined || blue === undefined || alpha === undefined) {
        throw new Error(`Invalid pixel ${pixel}`);
      }
      output[to] = red; output[to + 1] = green;
      output[to + 2] = blue; output[to + 3] = alpha;
      mask[y * width + x] = 1;
    }
    const path = `${scratch}/frames/${seed.name}.png`;
    await writeRgba(path, output, width, height);
    toys.push({
      name: seed.name, source: source.name, path, width, height, pixels: output,
      sourcePixels: image.pixels, sourceWidth: image.width,
      sourceX: component.minX - recipe.padding, sourceY: component.minY - recipe.padding,
      mask,
    });
  }
  const reviewPath = `${scratch}/sources/${source.name}-selected.png`;
  await command([
    "magick", sourcePath, "-fill", "none", "-stroke", "#A5664E", "-strokewidth", "4",
    "-draw", rectangles.join(" "), reviewPath,
  ]);
  reviewSources.push(reviewPath);
}

const cellWidth = Math.max(...toys.map((toy) => toy.width));
const cellHeight = Math.max(...toys.map((toy) => toy.height));
const columns = 6; const gap = 8;
const atlasWidth = columns * cellWidth + (columns - 1) * gap;
const rows = Math.ceil(toys.length / columns);
const atlasHeight = rows * cellHeight + (rows - 1) * gap;
const atlasPixels = new Uint8Array(atlasWidth * atlasHeight * 4);
const frames: Record<string, unknown> = {};
for (const [index, toy] of toys.entries()) {
  const x = (index % columns) * (cellWidth + gap);
  const y = Math.floor(index / columns) * (cellHeight + gap);
  for (let row = 0; row < toy.height; row += 1) {
    const from = row * toy.width * 4;
    const to = ((y + row) * atlasWidth + x) * 4;
    atlasPixels.set(toy.pixels.subarray(from, from + toy.width * 4), to);
  }
  frames[toy.name] = {
    frame: { x, y, w: toy.width, h: toy.height }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: toy.width, h: toy.height },
    sourceSize: { w: toy.width, h: toy.height }, anchor: { x: 0.5, y: 0.5 },
  };
}
await writeRgba("public/assets/battle/toys/toys.png", atlasPixels, atlasWidth, atlasHeight);

const atlasInfo = new TextDecoder().decode(await command([
  "magick", "identify", "-verbose", "public/assets/battle/toys/toys.png",
]));
if (!atlasInfo.includes("Colorspace: sRGB") || !atlasInfo.includes("Type: TrueColorAlpha") ||
    !atlasInfo.includes("png:IHDR.color_type: 6 (RGBA)")) {
  throw new Error("Atlas is not an sRGB TrueColorAlpha PNG with color type 6");
}
const packed = await rgba("public/assets/battle/toys/toys.png");
let compared = 0;
for (const [index, toy] of toys.entries()) {
  const x = (index % columns) * (cellWidth + gap);
  const y = Math.floor(index / columns) * (cellHeight + gap);
  for (let row = 0; row < toy.height; row += 1) for (let col = 0; col < toy.width; col += 1) {
    const atlasAt = ((y + row) * packed.width + x + col) * 4;
    const toyAt = (row * toy.width + col) * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      if (packed.pixels[atlasAt + channel] !== toy.pixels[toyAt + channel]) {
        throw new Error(`Packed pixel mismatch in ${toy.name}`);
      }
    }
    compared += 1;
    if (toy.mask[row * toy.width + col] === 1) {
      const sourceAt = ((toy.sourceY + row) * toy.sourceWidth + toy.sourceX + col) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (packed.pixels[atlasAt + channel] !== toy.sourcePixels[sourceAt + channel]) {
          throw new Error(`Source pixel mismatch in ${toy.name}`);
        }
      }
    }
  }
}
console.log(`Atlas check: ${toys.length} frames checked, ${compared} pixels compared`);
const sheet = {
  frames, animations: {}, meta: {
    image: "toys.png", size: { w: atlasWidth, h: atlasHeight }, scale: "1",
    sources: Object.fromEntries(recipe.sources.map((source) => [source.name, {
      atlas: source.atlas, frame: source.frame,
    }])),
    frameSources: Object.fromEntries(toys.map((toy) => [toy.name, toy.source])),
  },
};
await Bun.write("public/assets/battle/toys/toys.json", `${JSON.stringify(sheet, null, 2)}\n`);

const labels = toys.map((toy) => `${toy.name} (${toy.width}x${toy.height})`);
await command([
  "magick", "montage", ...toys.map((toy) => toy.path), "-tile", "6x", "-geometry",
  `${cellWidth}x${cellHeight}+12+28`, "-background", "#F5F1E0", "-fill", "#5B3530",
  "-pointsize", "16", "-set", "label", "%t", "art/scratch/toys-build/toy-sheet.png",
]);
await command([
  "magick", "montage", ...reviewSources, "-tile", "3x", "-geometry", "512x512+16+32",
  "-background", "#F5F1E0", "-fill", "#5B3530", "-pointsize", "18", "-set", "label",
  "%t", "art/scratch/toys-build/source-sheet.png",
]);
await command([
  "magick", "art/scratch/toys-build/toy-sheet.png", "-resize", "56%",
  "art/scratch/toys-build/toy-sheet-small.png",
]);
await command(["magick", "-size", "1200x20", "xc:#F5F1E0", "art/scratch/toys-build/rule.png"]);
await command([
  "magick", "art/scratch/toys-build/toy-sheet.png", "art/scratch/toys-build/rule.png",
  "art/scratch/toys-build/toy-sheet-small.png", "art/scratch/toys-build/source-sheet.png",
  "-append", "-background", "#F5F1E0", "-quality", "90", "art/review/toys-sheet.jpg",
]);
console.log(`Built ${toys.length} toys in ${atlasWidth}x${atlasHeight} atlas`);
console.log(labels.join("\n"));
