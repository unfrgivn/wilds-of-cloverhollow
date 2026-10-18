#!/usr/bin/env bun
// Rebuilds ambient butterflies and fairy-light VFX from the selected black matte sheet.
export {};
const run = async (command: string[]): Promise<void> => {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0)
    throw new Error(`Command failed: ${command.join(" ")}`);
};
await run(["rm", "-rf", "art/scratch/ambient-raw-frames", "art/scratch/ambient-frames",
  "public/assets/ambient"]);
await run(["mkdir", "-p", "art/scratch/ambient-frames", "public/assets/ambient"]);
await run(["bun", "tools/art/extract-figures.ts", "--input", "art/source/ambient/ambient-raw.png",
  "--output", "art/scratch/ambient-raw-frames", "--expected", "6", "--key", "#000000",
  "--fuzz", "12%"]);
const names = ["butterfly-pink-0", "butterfly-pink-1",
  "butterfly-blue-0", "butterfly-blue-1", "fairy-light-0", "fairy-light-1"];
for (let index = 0; index < names.length; index += 1) {
  const extracted = `art/scratch/ambient-raw-frames/raw-${String(index + 1).padStart(2, "0")}.png`;
  const lifted = `art/scratch/ambient-frames/${names[index]}-lifted.png`;
  const frame = `art/scratch/ambient-frames/${names[index]}.png`;
  await run(["bun", "tools/art/black-to-alpha.ts", "--input", extracted, "--output", lifted]);
  await run(["magick", lifted, "-trim", "+repage", "-resize", "80x80",
    "-gravity", "center", "-background", "none", "-extent", "96x96", frame]);
}
await run(["magick", "montage", ...names.map((name) => `art/scratch/ambient-frames/${name}.png`),
  "-tile", "6x1", "-geometry", "96x96+0+0", "-background", "none", "-alpha", "on",
  "public/assets/ambient/ambient.png"]);
const frames = Object.fromEntries(names.map((name, index) => [name, {
  frame: { x: index * 96, y: 0, w: 96, h: 96 }, rotated: false, trimmed: true,
  spriteSourceSize: { x: 0, y: 0, w: 96, h: 96 }, sourceSize: { w: 96, h: 96 },
}]));
await Bun.write("public/assets/ambient/ambient.json", JSON.stringify({
  frames,
  animations: {
    butterfly_pink: [names[0], names[1]], butterfly_blue: [names[2], names[3]],
    fairy_light: [names[4], names[5]],
  }, meta: { image: "ambient.png", size: { w: 576, h: 96 }, scale: "1" },
}, null, 2) + "\n");
