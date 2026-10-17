#!/usr/bin/env bun
export {};
const source = "art/source/moles/moles-sheet-raw.png";
const scratch = "art/scratch/moleframes";
const atlas = "public/assets/arcade/moles.png";
async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}
async function clearExactKey(path: string): Promise<void> {
  const read = Bun.spawn(["magick", path, "-depth", "8", "rgba:-"], { stdout: "pipe" });
  const bytes = new Uint8Array(await new Response(read.stdout).arrayBuffer());
  if (await read.exited !== 0) throw new Error(`Could not read ${path}`);
  for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
    if (bytes[offset] === 255 && bytes[offset + 1] === 0
      && bytes[offset + 2] === 255) bytes[offset + 3] = 0;
  }
  const write = Bun.spawn(["magick", "-size", "320x320", "-depth", "8", "rgba:-", path],
    { stdin: "pipe" });
  if (write.stdin === null) throw new Error(`Could not write ${path}`);
  write.stdin.write(bytes); write.stdin.end();
  if (await write.exited !== 0) throw new Error(`Could not write ${path}`);
}
await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", scratch, "public/assets/arcade"]);
for (const index of [0, 1, 2]) {
  await run(["magick", source, "-crop", "800x1792+" + String(index * 800) + "+0", "+repage",
    "-fuzz", "22%", "-transparent", "#FF00FF", "-trim", "+repage",
    "-resize", "270x290>", "-gravity", "south", "-background", "none",
    "-extent", "320x320", "-strip", scratch + "/" + String(index) + ".png"]);
  await clearExactKey(scratch + "/" + String(index) + ".png");
}
await run(["magick", scratch + "/0.png", scratch + "/1.png", scratch + "/2.png",
  "+append", "-strip", atlas]);
await Bun.write("public/assets/arcade/moles.json", JSON.stringify({
  frames: Object.fromEntries(["mole-up", "mole-booped", "mole-giggle"].map((name, index) => [name, {
    frame: { x: index * 320, y: 0, w: 320, h: 320 }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 320, h: 320 }, sourceSize: { w: 320, h: 320 },
    anchor: { x: 0.5, y: 1 },
  }])), meta: { image: "moles.png", format: "RGBA8888", size: { w: 960, h: 320 } },
}, null, 2) + "\n");
