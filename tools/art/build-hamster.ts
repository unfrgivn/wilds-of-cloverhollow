#!/usr/bin/env bun
// Build the four whole hamster sources at one shared scale. Each source is a
// single keyed figure; postprocess trims its complete connected alpha silhouette
// (body, backpack, effects, and burst snowballs) before placing the baseline.
export {};

const root = "art/source/critters/hamster";
const frames = "art/scratch/hamster-build-frames";
const uniformScale = "26.0";
const bodies = [
  ["chaos_idle_01", "chaos-raw.png"],
  ["chaos_burst_01", "burst-raw.png"],
  ["soothed_01", "soothed-raw.png"],
  ["calm_idle_01", "calm-raw.png"],
] as const;

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
for (const [name, source] of bodies) {
  const keyedSource = `${frames}/key-${name}.png`;
  await run(["magick", `${root}/${source}`, "-fuzz", "10%", "-fill", "#00FF00",
    "-draw", "color 0,0 floodfill", "-fuzz", "20%", "-transparent", "#FF00FF",
    keyedSource]);
  await run(["bun", "tools/art/postprocess.ts", "--input", keyedSource,
    "--output", `${frames}/${name}.png`, "--width", "512", "--height", "512",
    "--scale-percent", uniformScale, "--bottom-margin", "8", "--key", "#00FF00",
    "--fuzz", "18%", "--despill", "global-green", "--holes"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input",
    `${frames}/${name}.png`, "--output", `${frames}/${name}.png`, "--key", "green",
    "--band", "3"]);
  await run(["magick", `${frames}/${name}.png`, "-fuzz", "40%", "-transparent",
    "#00FF00", `${frames}/${name}.png`]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", `${frames}/${name}.png`,
    "--output", `${frames}/${name}.png`, "--min", "120"]);
}

const alpha = `${frames}/aura-alpha.png`;
const scaled = `${frames}/aura-scaled.png`;
await run(["bun", "tools/art/white-to-alpha.ts", "--input",
  `${root}/aura-white-raw.png`, "--output", alpha]);
await run(["magick", alpha, "-trim", "+repage", "-resize", "20%", scaled]);
await run(["magick", "-size", "512x512", "xc:none", scaled, "-gravity", "center",
  "-geometry", "+0+0", "-composite", `${frames}/chaos_aura_01.png`]);

const names = [...bodies.map(([name]) => name), "chaos_aura_01"];
await run(["magick", "montage", ...names.map((name) => `${frames}/${name}.png`),
  "-tile", "3x2", "-geometry", "512x512+0+0", "-background", "none",
  "public/assets/critters/hamster/hamster.png"]);
const frameData: Record<string, unknown> = {};
for (const [index, name] of names.entries()) {
  frameData[name] = {
    frame: { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, w: 512, h: 512 },
    rotated: false, trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 512, h: 512 },
    sourceSize: { w: 512, h: 512 }, anchor: { x: 0.5, y: 0.984375 },
  };
}
const atlas = { frames: frameData, animations: {
  chaos_idle: ["chaos_idle_01"], chaos_burst: ["chaos_burst_01"],
  soothed: ["soothed_01"], calm_idle: ["calm_idle_01"], chaos_aura: ["chaos_aura_01"],
}, meta: { image: "hamster.png", size: { w: 1536, h: 1024 }, scale: "1", baseline: 504 } };
await Bun.write("public/assets/critters/hamster/hamster.json",
  `${JSON.stringify(atlas, null, 2)}\n`);
