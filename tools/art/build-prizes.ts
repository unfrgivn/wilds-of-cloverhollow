#!/usr/bin/env bun
export {};
// Rebuilds the claw-machine prize atlas from the selected Gemini sheet.
// The whole sheet is keyed before segmentation, so a tail that crosses the
// generator's layout cannot be cut into the neighbouring prize.

type Rgba = { r: number; g: number; b: number; a: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
type Component = { area: number; sumX: number; pixels: number[]; bounds: Bounds };

const source = "art/source/prizes/prizes-sheet-raw.png";
const scratch = "art/scratch/prizes-build";
const names = ["frog-plush", "pup-plush", "raccoon-plush"];
const newNames = [
  "cat-plush", "bunny-plush", "bluebird-plush", "hamster-plush", "squirrel-plush", "owl-plush",
];
const sourceSize = 2048;
const width = 320;
const height = 320;
const baseline = 300;
const scalePercent = 40;
const key = { r: 0, g: 0, b: 255 };
const keyDistance = 48;
const newSource = "art/source/prizes/plushes-six-sheet-raw.png";

async function run(command: string[], stdin?: Uint8Array): Promise<Uint8Array> {
  const child = Bun.spawn(command, {
    stdin: stdin ?? undefined, stdout: "pipe", stderr: "inherit",
  });
  const output = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return output;
}

function distance(pixel: Rgba): number {
  return Math.max(Math.abs(pixel.r - key.r), Math.abs(pixel.g - key.g), Math.abs(pixel.b - key.b));
}

function neighbours4(index: number, imageWidth: number, length: number): number[] {
  const x = index % imageWidth;
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x + 1 < imageWidth) result.push(index + 1);
  if (index >= imageWidth) result.push(index - imageWidth);
  if (index + imageWidth < length) result.push(index + imageWidth);
  return result;
}

function neighbours8(index: number, imageWidth: number, imageHeight: number): number[] {
  const x = index % imageWidth;
  const y = Math.floor(index / imageWidth);
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX >= 0 && nextX < imageWidth && nextY >= 0 && nextY < imageHeight) {
        result.push(nextY * imageWidth + nextX);
      }
    }
  }
  return result;
}

async function writeRgba(
  path: string, pixels: Rgba[], imageWidth: number, imageHeight: number,
): Promise<void> {
  const rgba = new Uint8Array(pixels.length * 4);
  for (const [index, pixel] of pixels.entries()) {
    const offset = index * 4;
    rgba[offset] = pixel.r;
    rgba[offset + 1] = pixel.g;
    rgba[offset + 2] = pixel.b;
    rgba[offset + 3] = pixel.a;
  }
  await run(["magick", "-size", `${imageWidth}x${imageHeight}`, "-depth", "8", "rgba:-", path],
    rgba);
}

const raw = await run(["magick", source, "-alpha", "on", "-depth", "8", "rgba:-"]);
const pixels: Rgba[] = [];
for (let index = 0; index < sourceSize * sourceSize; index += 1) {
  const offset = index * 4;
  pixels.push({ r: raw[offset] ?? 0, g: raw[offset + 1] ?? 0,
    b: raw[offset + 2] ?? 0, a: raw[offset + 3] ?? 255 });
}

// Flood the matte from the complete image border. This is intentionally done
// before finding components, rather than once per fixed source column.
const matte = new Uint8Array(pixels.length);
const flood: number[] = [];
for (let y = 0; y < sourceSize; y += 1) {
  flood.push(y * sourceSize, y * sourceSize + sourceSize - 1);
}
for (let x = 0; x < sourceSize; x += 1) {
  flood.push(x, (sourceSize - 1) * sourceSize + x);
}
while (flood.length > 0) {
  const index = flood.shift();
  if (index === undefined || matte[index] !== 0) continue;
  const pixel = pixels[index];
  if (pixel === undefined || distance(pixel) > keyDistance) continue;
  matte[index] = 1;
  pixel.a = 0;
  flood.push(...neighbours4(index, sourceSize, pixels.length));
}

// The blue legacy sheet has no enclosed matte, but the magenta sheet can
// leave a key-coloured island between a plush's body and tail. Clear sizeable
// enclosed key pockets and despill only their eight-pixel visible rim.
function clearEnclosedKeyPockets(
  image: Rgba[], imageWidth: number, imageHeight: number,
  isKey: (pixel: Rgba) => boolean,
  despill: (pixel: Rgba) => void,
): void {
  const seen = new Uint8Array(image.length);
  for (let start = 0; start < image.length; start += 1) {
    if (seen[start] === 1 || !isKey(image[start] ?? { r: 0, g: 0, b: 0, a: 0 })) continue;
    const pending = [start];
    const members: number[] = [];
    seen[start] = 1;
    while (pending.length > 0) {
      const index = pending.pop();
      if (index === undefined) continue;
      members.push(index);
      for (const next of neighbours4(index, imageWidth, image.length)) {
        if (seen[next] === 0 && isKey(image[next] ?? { r: 0, g: 0, b: 0, a: 0 })) {
          seen[next] = 1;
          pending.push(next);
        }
      }
    }
    if (members.length < 20) continue;
    const pocket = new Set(members);
    for (const index of members) {
      const pixel = image[index];
      if (pixel !== undefined) pixel.a = 0;
    }
    const rim: number[] = [...members];
    const distance = new Uint16Array(image.length);
    distance.fill(999);
    for (const index of members) distance[index] = 0;
    while (rim.length > 0) {
      const index = rim.pop();
      if (index === undefined) continue;
      const nextDistance = (distance[index] ?? 999) + 1;
      if (nextDistance > 8) continue;
      for (const next of neighbours4(index, imageWidth, image.length)) {
        if ((distance[next] ?? 999) <= nextDistance || pocket.has(next)) continue;
        distance[next] = nextDistance;
        const pixel = image[next];
        if (pixel !== undefined && pixel.a !== 0) despill(pixel);
        rim.push(next);
      }
    }
  }
}

// Correct only the visible rim, leaving any genuine blue plush detail alone.
const rimDistance = new Uint16Array(pixels.length);
rimDistance.fill(999);
const rimQueue: number[] = [];
for (const [index, isMatte] of matte.entries()) {
  if (isMatte === 1) {
    rimDistance[index] = 0;
    rimQueue.push(index);
  }
}
while (rimQueue.length > 0) {
  const index = rimQueue.shift();
  if (index === undefined) continue;
  const nextDistance = (rimDistance[index] ?? 999) + 1;
  for (const next of neighbours4(index, sourceSize, pixels.length)) {
    if ((rimDistance[next] ?? 999) <= nextDistance) continue;
    rimDistance[next] = nextDistance;
    rimQueue.push(next);
  }
}
for (let index = 0; index < pixels.length; index += 1) {
  const pixel = pixels[index];
  if (pixel === undefined || pixel.a === 0) continue;
  if ((rimDistance[index] ?? 999) <= 8 && pixel.b > Math.max(pixel.r, pixel.g) + 10) {
    pixel.b = Math.max(pixel.r, pixel.g);
  }
}

// Find the three complete plush components on the keyed whole sheet.
const seen = new Uint8Array(pixels.length);
const components: Component[] = [];
for (let start = 0; start < pixels.length; start += 1) {
  if (seen[start] === 1 || (pixels[start]?.a ?? 0) <= 127) continue;
  const queue = [start];
  const members: number[] = [];
  seen[start] = 1;
  let sumX = 0;
  const bounds: Bounds = { left: sourceSize, top: sourceSize, right: 0, bottom: 0 };
  while (queue.length > 0) {
    const index = queue.pop();
    if (index === undefined) continue;
    const x = index % sourceSize;
    const y = Math.floor(index / sourceSize);
    members.push(index);
    sumX += x;
    bounds.left = Math.min(bounds.left, x);
    bounds.top = Math.min(bounds.top, y);
    bounds.right = Math.max(bounds.right, x + 1);
    bounds.bottom = Math.max(bounds.bottom, y + 1);
    for (const next of neighbours8(index, sourceSize, sourceSize)) {
      if (seen[next] === 0 && (pixels[next]?.a ?? 0) > 127) {
        seen[next] = 1;
        queue.push(next);
      }
    }
  }
  if (members.length >= 10000)
    components.push({ area: members.length, sumX, pixels: members, bounds });
}
if (components.length !== names.length) {
  throw new Error(`Expected ${names.length} plush components, found ${components.length}`);
}
components.sort((left, right) => left.sumX / left.area - right.sumX / right.area);

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", scratch, "public/assets/prizes"]);
const framePaths: string[] = [];
for (const [index, name] of names.entries()) {
  const component = components[index];
  if (component === undefined) throw new Error(`Missing component for ${name}`);
  const cropWidth = component.bounds.right - component.bounds.left;
  const cropHeight = component.bounds.bottom - component.bounds.top;
  const cropPixels: Rgba[] = Array.from({ length: cropWidth * cropHeight },
    () => ({ r: 0, g: 0, b: 0, a: 0 }));
  for (const sourceIndex of component.pixels) {
    const sourceX = sourceIndex % sourceSize;
    const sourceY = Math.floor(sourceIndex / sourceSize);
    const cropIndex = (sourceY - component.bounds.top) * cropWidth
      + sourceX - component.bounds.left;
    const pixel = pixels[sourceIndex];
    if (pixel !== undefined) cropPixels[cropIndex] = { ...pixel };
  }
  const keyed = `${scratch}/${name}-keyed.png`;
  const resized = `${scratch}/${name}-resized.png`;
  const frame = `${scratch}/${name}.png`;
  await writeRgba(keyed, cropPixels, cropWidth, cropHeight);
  await run(["magick", keyed, "-trim", "+repage", "-resize", `${scalePercent}%`,
    "-define", "png:color-type=6", resized]);
  const dimensions = (await run(["magick", "identify", "-format", "%wx%h", resized]));
  const [scaledWidthText, scaledHeightText] =
    new TextDecoder().decode(dimensions).trim().split("x");
  const scaledWidth = Number(scaledWidthText);
  const scaledHeight = Number(scaledHeightText);
  if (!Number.isInteger(scaledWidth) || !Number.isInteger(scaledHeight)
    || scaledWidth > width - 16 || scaledHeight > baseline - 8) {
    throw new Error(`${name} does not fit on the prize frame`);
  }
  const x = Math.floor((width - scaledWidth) / 2);
  const y = baseline - scaledHeight + 1;
  await run(["magick", "-size", `${width}x${height}`, "xc:none", resized,
    "-geometry", `+${x}+${y}`, "-composite", "-define", "png:color-type=6", frame]);
  framePaths.push(frame);
}
// The second sheet is a 3x3 contact sheet; its bottom two rows are the six
// additions. Gemini occasionally paints a
// different chroma shade in a cell, so flood its border from the four corner
// colours rather than globally keying the subject. The recorded intended key
// remains #D400A8; this border flood only removes the generator's pink wash.
const newRaw = await run(["magick", newSource, "-alpha", "on", "-depth", "8", "rgba:-"]);
const newPixels: Rgba[] = [];
for (let index = 0; index < sourceSize * sourceSize; index += 1) {
  const offset = index * 4;
  newPixels.push({ r: newRaw[offset] ?? 0, g: newRaw[offset + 1] ?? 0,
    b: newRaw[offset + 2] ?? 0, a: newRaw[offset + 3] ?? 255 });
}
const cells = [
  { left: 0, top: 682, right: 682, bottom: 1365 },
  { left: 682, top: 682, right: 1365, bottom: 1365 },
  { left: 1365, top: 682, right: 2048, bottom: 1365 },
  { left: 0, top: 1365, right: 682, bottom: 2048 },
  { left: 682, top: 1365, right: 1365, bottom: 2048 },
  { left: 1365, top: 1365, right: 2048, bottom: 2048 },
];
function colourDistance(left: Rgba, right: Rgba): number {
  return Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g),
    Math.abs(left.b - right.b));
}
for (const [cellIndex, cell] of cells.entries()) {
  const cellWidth = cell.right - cell.left;
  const cellHeight = cell.bottom - cell.top;
  const cellPixels: Rgba[] = [];
  for (let y = cell.top; y < cell.bottom; y += 1) {
    for (let x = cell.left; x < cell.right; x += 1) {
      const pixel = newPixels[y * sourceSize + x];
      cellPixels.push(pixel === undefined ? { r: 0, g: 0, b: 0, a: 0 } : { ...pixel });
    }
  }
  const seeds = [cellPixels[0], cellPixels[cellWidth - 1],
    cellPixels[(cellHeight - 1) * cellWidth], cellPixels[cellPixels.length - 1]]
    .filter((pixel): pixel is Rgba => pixel !== undefined);
  const keyed = new Uint8Array(cellPixels.length);
  const queue: number[] = [];
  for (let y = 0; y < cellHeight; y += 1) {
    queue.push(y * cellWidth, y * cellWidth + cellWidth - 1);
  }
  for (let x = 0; x < cellWidth; x += 1) {
    queue.push(x, (cellHeight - 1) * cellWidth + x);
  }
  while (queue.length > 0) {
    const index = queue.pop();
    if (index === undefined || keyed[index] === 1) continue;
    const pixel = cellPixels[index];
    if (pixel === undefined || !seeds.some((seed) => colourDistance(pixel, seed) <= 52)) continue;
    keyed[index] = 1;
    pixel.a = 0;
    for (const next of neighbours4(index, cellWidth, cellPixels.length)) queue.push(next);
  }
  clearEnclosedKeyPockets(cellPixels, cellWidth, cellHeight,
    (pixel) => seeds.some((seed) => colourDistance(pixel, seed) <= 52),
    (pixel) => {
      if (pixel.r > pixel.g + 10 && pixel.b > pixel.g + 10) {
        pixel.r = pixel.g;
        pixel.b = pixel.g;
      }
    });
  const seenCell = new Uint8Array(cellPixels.length);
  let best: number[] = [];
  let bestBounds: Bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  for (let start = 0; start < cellPixels.length; start += 1) {
    if (seenCell[start] === 1 || (cellPixels[start]?.a ?? 0) <= 127) continue;
    const pending = [start];
    const members: number[] = [];
    seenCell[start] = 1;
    const bounds: Bounds = { left: cellWidth, top: cellHeight, right: 0, bottom: 0 };
    while (pending.length > 0) {
      const index = pending.pop();
      if (index === undefined) continue;
      const x = index % cellWidth;
      const y = Math.floor(index / cellWidth);
      members.push(index);
      bounds.left = Math.min(bounds.left, x); bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1);
      for (const next of neighbours8(index, cellWidth, cellHeight)) {
        if (seenCell[next] === 0 && (cellPixels[next]?.a ?? 0) > 127) {
          seenCell[next] = 1; pending.push(next);
        }
      }
    }
    if (members.length > best.length) { best = members; bestBounds = bounds; }
  }
  if (best.length < 10000) throw new Error(`No plush component found in cell ${cellIndex}`);
  const cropWidth = bestBounds.right - bestBounds.left;
  const cropHeight = bestBounds.bottom - bestBounds.top;
  const cropPixels: Rgba[] = Array.from({ length: cropWidth * cropHeight },
    () => ({ r: 0, g: 0, b: 0, a: 0 }));
  for (const index of best) {
    const x = index % cellWidth; const y = Math.floor(index / cellWidth);
    const target = (y - bestBounds.top) * cropWidth + x - bestBounds.left;
    const pixel = cellPixels[index];
    if (pixel !== undefined) cropPixels[target] = { ...pixel };
  }
  const name = newNames[cellIndex];
  if (name === undefined) throw new Error(`Missing name for cell ${cellIndex}`);
  const keyedPath = `${scratch}/${name}-keyed.png`;
  const resizedPath = `${scratch}/${name}-resized.png`;
  const framePath = `${scratch}/${name}.png`;
  await writeRgba(keyedPath, cropPixels, cropWidth, cropHeight);
  await run(["magick", keyedPath, "-trim", "+repage", "-resize", `${scalePercent}%`,
    "-define", "png:color-type=6", resizedPath]);
  const dimensions = await run(["magick", "identify", "-format", "%wx%h", resizedPath]);
  const [scaledWidthText, scaledHeightText] =
    new TextDecoder().decode(dimensions).trim().split("x");
  const scaledWidth = Number(scaledWidthText); const scaledHeight = Number(scaledHeightText);
  if (!Number.isInteger(scaledWidth) || !Number.isInteger(scaledHeight)
    || scaledWidth > width - 16 || scaledHeight > baseline - 8)
    throw new Error(`${name} does not fit`);
  const x = Math.floor((width - scaledWidth) / 2); const y = baseline - scaledHeight + 1;
  await run(["magick", "-size", `${width}x${height}`, "xc:none", resizedPath,
    "-geometry", `+${x}+${y}`, "-composite", "-define", "png:color-type=6", framePath]);
  framePaths.push(framePath);
}
const allNames = [...names, ...newNames];
await run(["magick", "montage", ...framePaths, "-tile", "3x3",
  "-geometry", `${width}x${height}+0+0`,
  "-background", "none", "-alpha", "on", "public/assets/prizes/prizes.png"]);
const frameData = Object.fromEntries(allNames.map((name, index) => [name, {
  frame: { x: (index % 3) * width, y: Math.floor(index / 3) * height, w: width, h: height },
  rotated: false, trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: width, h: height }, sourceSize: { w: width, h: height },
  anchor: { x: 0.5, y: baseline / height },
}]));
const atlas = {
  frames: frameData,
  animations: Object.fromEntries(allNames.map((name) => [name, [name]])),
  meta: { image: "prizes.png", size: { w: width * 3, h: height * 3 }, scale: "1", baseline },
};
await Bun.write("public/assets/prizes/prizes.json", `${JSON.stringify(atlas, null, 2)}\n`);
