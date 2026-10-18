#!/usr/bin/env bun
// Rebuilds four single-frame forest fairy NPC atlases from the selected raw grid.
export {};
const run = async (command: string[]): Promise<void> => {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
};
await run(["rm", "-rf", "art/scratch/forest-fairy-frames",
  "public/assets/characters/fairy-lavender", "public/assets/characters/fairy-mint",
  "public/assets/characters/fairy-sky",
  "public/assets/characters/fairy-peach"]);
await run(["mkdir", "-p", "art/scratch/forest-fairy-frames",
  "public/assets/characters/fairy-lavender", "public/assets/characters/fairy-mint",
  "public/assets/characters/fairy-sky",
  "public/assets/characters/fairy-peach"]);
await run(["bun", "tools/art/extract-figures.ts", "--input",
  "art/source/forest-fairy/idle-grid-raw.png", "--output", "art/scratch/forest-fairy-raw",
  "--expected", "4", "--key", "#00FF00", "--fuzz", "25%"]);
for (let index = 1; index <= 4; index += 1) {
  const name = `idle_down_0${index}`;
  await run(["bun", "tools/art/postprocess.ts", "--input",
    `art/scratch/forest-fairy-raw/raw-${String(index).padStart(2, "0")}.png`,
    "--output", `art/scratch/forest-fairy-frames/${name}.png`, "--width", "256",
    "--height", "256", "--figure-height", "120", "--bottom-margin", "8",
    "--key", "#00FF00", "--fuzz", "25%", "--despill", "edge"]);
}
const ids = ["fairy-lavender", "fairy-mint", "fairy-sky", "fairy-peach"];
for (const [index, id] of ids.entries()) {
  await run(["magick", `art/scratch/forest-fairy-frames/idle_down_0${index + 1}.png`,
    "-strip", "-define", "png:exclude-chunk=all",
    `public/assets/characters/${id}/${id}.png`]);
  const name = "idle_down_01";
  const frames = { [name]: {
    frame: { x: 0, y: 0, w: 256, h: 256 }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 }, sourceSize: { w: 256, h: 256 },
    anchor: { x: 0.5, y: 247 / 256 },
  } };
  await Bun.write(`public/assets/characters/${id}/${id}.json`, JSON.stringify({
    frames, animations: { idle_down: [name] }, meta: { image: `${id}.png`,
      size: { w: 256, h: 256 }, scale: "1", baseline: 247 },
  }, null, 2) + "\n");
}
