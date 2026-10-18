#!/usr/bin/env bun
// Builds Milo's post-reveal overworld idle atlas from the selected two-pose strip.
export {};

const root = "art";
const frames = `${root}/scratch/milo-hoodie-build-frames`;
const sources = [
  ["idle-down-raw.png", "down_idle_01"],
  ["blink-raw.png", "down_idle_02"],
] as const;

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames, "public/assets/characters/milo-hoodie"]);
for (const [sourceName, frameName] of sources) {
  const output = `${frames}/${frameName}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input",
    `art/source/classmates/milo-hoodie/${sourceName}`, "--output", output,
    "--width", "448", "--height", "448", "--figure-height", "280",
    "--bottom-margin", "8", "--key", "#FF00FF", "--fuzz", "18%", "--despill", "edge"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", output, "--output", `${output}.tmp.png`,
    "--key", "magenta", "--band", "20"]);
  await run(["mv", `${output}.tmp.png`, output]);
}
await run(["magick", "montage", ...sources.map(([, name]) => `${frames}/${name}.png`),
  "-tile", "2x1", "-geometry", "448x448+0+0", "-background", "none",
  "public/assets/characters/milo-hoodie/milo-hoodie.png"]);

const frameData = Object.fromEntries(sources.map(([, name], index) => [name, {
  frame: { x: index * 448, y: 0, w: 448, h: 448 }, rotated: false, trimmed: true,
  spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 }, sourceSize: { w: 448, h: 448 },
  anchor: { x: 0.5, y: 439 / 448 },
}]));
await Bun.write("public/assets/characters/milo-hoodie/milo-hoodie.json", `${JSON.stringify({
  frames: frameData,
  animations: { idle_down: ["down_idle_01", "down_idle_02"] },
  meta: { image: "milo-hoodie.png", size: { w: 896, h: 448 }, scale: "1", baseline: 439 },
}, null, 2)}\n`);
