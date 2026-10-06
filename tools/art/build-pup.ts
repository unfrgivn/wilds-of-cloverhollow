#!/usr/bin/env bun
// Rebuilds the pup's atlas (art/recipes/pup.json) byte for byte from its sources.
//
// Bodies: three panels of the generated sheet plus the bark frame, which is one
// edit of the sheet's bark panel (mirrored to face left like the others, given
// the chaos eyes it lacked). Each is keyed on #00FF00 by border flood, scaled
// so the figure is 380 px tall on a 512 px canvas (baseline 504), then cleaned
// at sprite size: detached key debris is dropped, and the 2 px alpha-edge band
// is despilled. The fuzz is 45%, not 18%: the generator painted a lime band
// (about (106, 196, 21), 98-106 from the key) outside the tennis balls' ink
// outlines, and the pup's own colours are all far from the key (the nearest,
// the balls' shadowed yellow-green, is over 150 away).
// Aura: one white-ground painting, white lifted to alpha, scaled 28%.
export {};

const sheet = "art/source/critters/pup/body-sheet-raw.png";
const fuzz = "45%";
const frames = "art/scratch/pup-build-frames";
const bodies: { name: string; source: string; crop: string | null }[] = [
  { name: "chaos_idle_01", source: sheet, crop: "688x1536+0+0" },
  { name: "chaos_burst_01", source: "art/source/critters/pup/burst-edit.png", crop: null },
  { name: "soothed_01", source: sheet, crop: "688x1536+1376+0" },
  { name: "calm_idle_01", source: sheet, crop: "688x1536+2064+0" },
];

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
for (const body of bodies) {
  const input = `${frames}/source-${body.name}.png`;
  await run(["magick", body.source, ...(body.crop === null ? [] : ["-crop", body.crop, "+repage"]),
    input]);
  const frame = `${frames}/${body.name}.png`;
  await run(["bun", "tools/art/postprocess.ts", "--input", input, "--output", frame,
    "--width", "512", "--height", "512", "--figure-height", "380", "--bottom-margin", "8",
    "--key", "#00FF00", "--fuzz", fuzz, "--despill", "edge"]);
  await run(["bun", "tools/art/drop-islands.ts", "--input", frame, "--output", frame,
    "--min", "120"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", frame, "--output", frame,
    "--key", "green", "--band", "2"]);
}
const alpha = `${frames}/aura-alpha.png`;
const scaled = `${frames}/aura-scaled.png`;
await run(["bun", "tools/art/white-to-alpha.ts", "--input",
  "art/source/critters/pup/aura-white-raw.png", "--output", alpha]);
await run(["magick", alpha, "-trim", "+repage", "-resize", "28%", scaled]);
await run(["magick", "-size", "512x512", "xc:none", scaled, "-geometry", "+24+40", "-composite",
  `${frames}/chaos_aura_01.png`]);
const names = [...bodies.map((body) => body.name), "chaos_aura_01"];
await run(["magick", "montage", ...names.map((name) => `${frames}/${name}.png`),
  "-tile", "3x2", "-geometry", "512x512+0+0", "-background", "none",
  "public/assets/critters/pup/pup.png"]);
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
}, meta: { image: "pup.png", size: { w: 1536, h: 1024 }, scale: "1", baseline: 504 } };
await Bun.write("public/assets/critters/pup/pup.json", `${JSON.stringify(atlas, null, 2)}\n`);
