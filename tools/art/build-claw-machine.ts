#!/usr/bin/env bun
export {};

// Rebuilds the shipped claw-machine cutout without a generation call. The
// border flood stops at the warm-brown cabinet ink, then trim and resize are
// deterministic ImageMagick operations.

const source = "art/source/arcade/claw-machine-front-raw.png";
const cutout = "art/scratch/claw-machine-cutout.png";
const despilled = "art/scratch/claw-machine-despilled.png";
const output = "public/assets/arcade/claw-machine.webp";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run([
  "magick", source,
  "-alpha", "on",
  "-fuzz", "8%",
  "-fill", "none",
  "-draw", "color 0,0 floodfill",
  "-trim", "+repage", cutout,
]);

const identify = Bun.spawn(["magick", cutout, "-format", "%wx%h", "info:"]);
const dimensions = (await new Response(identify.stdout).text()).trim().split("x").map(Number);
const widthValue = dimensions[0];
const heightValue = dimensions[1];
if (dimensions.length !== 2 || widthValue === undefined || heightValue === undefined
  || !Number.isInteger(widthValue) || !Number.isInteger(heightValue)) {
  throw new Error("Could not read cutout dimensions");
}
const cutoutBytes = await (async () => {
  const child = Bun.spawn(["magick", cutout, "-depth", "8", "rgba:-"], { stdout: "pipe" });
  const bytes = new Uint8Array(await new Response(child.stdout).arrayBuffer());
  if (await child.exited !== 0) throw new Error("Could not read cutout pixels");
  return bytes;
})();
const cutoutWidth = widthValue;
const cutoutHeight = heightValue;
const outputBytes = new Uint8Array(cutoutBytes);
const paper = { r: 255, g: 249, b: 235 };
for (let y = 0; y < cutoutHeight; y += 1) {
  for (let x = 0; x < cutoutWidth; x += 1) {
    const index = (y * cutoutWidth + x) * 4;
    const alpha = cutoutBytes[index + 3] ?? 0;
    if (alpha === 0 || alpha === 255) continue;
    let nearTransparent = false;
    for (let dy = -3; dy <= 3 && !nearTransparent; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= cutoutWidth || ny < 0 || ny >= cutoutHeight) continue;
        if ((cutoutBytes[(ny * cutoutWidth + nx) * 4 + 3] ?? 0) === 0) {
          nearTransparent = true; break;
        }
      }
    }
    if (!nearTransparent) continue;
    // Remove only the paper contribution from antialiased edge pixels. This
    // is an alpha-edge despill, not a colour adjustment to the cabinet.
    const factor = alpha / 255;
    outputBytes[index] = Math.max(0, Math.min(255,
      Math.round(((cutoutBytes[index] ?? 0) - (1 - factor) * paper.r) / factor)));
    outputBytes[index + 1] = Math.max(0, Math.min(255,
      Math.round(((cutoutBytes[index + 1] ?? 0) - (1 - factor) * paper.g) / factor)));
    outputBytes[index + 2] = Math.max(0, Math.min(255,
      Math.round(((cutoutBytes[index + 2] ?? 0) - (1 - factor) * paper.b) / factor)));
  }
}
const write = Bun.spawn(
  ["magick", "-size", `${cutoutWidth}x${cutoutHeight}`, "-depth", "8", "rgba:-", despilled],
  { stdin: "pipe" },
);
if (write.stdin === null) throw new Error("Could not write despilled cutout");
write.stdin.write(outputBytes); write.stdin.end();
if (await write.exited !== 0) throw new Error("Could not write despilled cutout");

await run([
  "magick", despilled,
  "-resize", "1600x",
  "-define", "webp:lossless=false",
  "-quality", "90",
  output,
]);
