#!/usr/bin/env bun
// Adds the generated bluebell glow frames after the existing glow atlas.
// The old atlas is copied as the left-hand source image, then compared pixel
// for pixel after packing so existing frames cannot drift.
export {};

const source = "art/scratch/1792284829040-gemini-3-pro-image-0.png";
const scratch = "art/scratch/mist-glow-build";
const oldAtlas = "public/assets/glows/glows.png";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

async function capture(command: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return bytes;
}

async function metric(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const stderr = new Response(child.stderr).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return await stderr;
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", scratch]);
await run(["magick", oldAtlas, "-crop", "530x176+0+0", "+repage",
  `${scratch}/old-region.png`]);
const frames: string[] = [];
for (let index = 0; index < 4; index += 1) {
  const raw = `${scratch}/bluebell-${index + 1}-raw.png`;
  const alpha = `${scratch}/bluebell-${index + 1}-alpha.png`;
  const output = `${scratch}/bluebell-${index + 1}.png`;
  const x = index % 2 === 0 ? 0 : 1024;
  const y = index < 2 ? 0 : 1024;
  await run(["magick", source, "-crop", `1024x1024+${x}+${y}`, "+repage", raw]);
  await run(["bun", "tools/art/black-to-alpha.ts", "--input", raw, "--output", alpha]);
  await run(["magick", alpha, "-trim", "+repage", "-resize", "112x112", "-bordercolor", "none",
    "-border", "8", "-gravity", "center", "-background", "none", "-extent", "128x128",
    "-strip", output]);
  const pixels = await capture(["magick", output, "-alpha", "on", "-depth", "8", "rgba:-"]);
  let alphaTotal = 0;
  for (let pixel = 0; pixel < 128 * 128; pixel += 1) alphaTotal += pixels[pixel * 4 + 3] ?? 0;
  const corners = [0, 127, 127 * 128, 128 * 128 - 1];
  if (corners.some((pixel) => (pixels[pixel * 4 + 3] ?? 255) !== 0))
    throw new Error(`${output} has an opaque corner`);
  if (alphaTotal / (128 * 128 * 255) >= 0.5)
    throw new Error(`${output} has too much alpha`);
  frames.push(output);
}

await run(["magick", "-background", "none", oldAtlas, "-crop", "530x176+0+0", "+repage",
  ...frames, "+append", "-strip",
  "public/assets/glows/glows.png"]);
await run(["magick", "public/assets/glows/glows.png", "-crop", "530x176+0+0", "+repage",
  `${scratch}/new-region.png`]);
const compare = await metric([
  "magick", "compare", "-metric", "AE", `${scratch}/old-region.png`,
  `${scratch}/new-region.png`, "null:",
]);
if (!compare.trim().startsWith("0")) throw new Error(`old glow region changed: ${compare.trim()}`);
await Bun.write("public/assets/glows/glows.json", JSON.stringify({
  frames: {
    paw_prints: { frame: { x: 0, y: 0, w: 238, h: 176 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 238, h: 176 },
      sourceSize: { w: 238, h: 176 } },
    ink_note: { frame: { x: 238, y: 0, w: 156, h: 146 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 156, h: 146 },
      sourceSize: { w: 156, h: 146 } },
    trail_marker: { frame: { x: 394, y: 0, w: 136, h: 171 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 136, h: 171 },
      sourceSize: { w: 136, h: 171 } },
    bluebell_1: { frame: { x: 530, y: 0, w: 128, h: 128 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
      sourceSize: { w: 128, h: 128 } },
    bluebell_2: { frame: { x: 658, y: 0, w: 128, h: 128 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
      sourceSize: { w: 128, h: 128 } },
    bluebell_3: { frame: { x: 786, y: 0, w: 128, h: 128 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
      sourceSize: { w: 128, h: 128 } },
    bluebell_4: { frame: { x: 914, y: 0, w: 128, h: 128 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 },
      sourceSize: { w: 128, h: 128 } },
  },
  animations: {
     paw_prints: ["paw_prints"],
    ink_note: ["ink_note"],
    trail_marker: ["trail_marker"],
    bluebells: ["bluebell_1", "bluebell_2", "bluebell_3", "bluebell_4"] },
  meta: { image: "glows.png", size: { w: 1042, h: 176 }, scale: "1" },
}, null, 2) + "\n");
