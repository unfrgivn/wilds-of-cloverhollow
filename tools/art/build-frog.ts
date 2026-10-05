#!/usr/bin/env bun
export {};

async function run(command: string[]): Promise<void> {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error("Command failed: " + command.join(" "));
}
const frames = "art/scratch/frog-build-frames";
await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
const bodySources = [
  ["chaos-raw.png", "chaos_idle_01"],
  ["burst-raw.png", "chaos_burst_01"],
  ["soothed-ring-raw.png", "soothed_01"],
  ["calm-raw.png", "calm_idle_01"],
];
for (const [source, name] of bodySources) {
  await run([
    "bun", "tools/art/postprocess.ts", "--input", "art/source/critters/frog/" + source,
    "--output", frames + "/" + name + ".png", "--width", "512", "--height", "512",
    "--figure-height", "380", "--bottom-margin", "8", "--key", "#FF00FF",
    "--fuzz", "18%", "--despill", "edge",
  ]);
}
const auraAlpha = frames + "/aura-alpha.png";
const auraTrim = frames + "/aura-trim.png";
const auraScaled = frames + "/aura-scaled.png";
await run([
  "bun", "tools/art/white-to-alpha.ts", "--input",
  "art/source/critters/frog/aura-white-01b-raw.png", "--output", auraAlpha,
]);
await run(["magick", auraAlpha, "-trim", "+repage", "-resize", "28%", auraScaled]);
await run([
  "magick", "-size", "512x512", "xc:none", auraScaled, "-geometry", "+24+40",
  "-composite", frames + "/chaos_aura_01.png",
]);
await run([
  "magick", "montage", frames + "/chaos_idle_01.png", frames + "/chaos_burst_01.png",
  frames + "/soothed_01.png", frames + "/calm_idle_01.png", frames + "/chaos_aura_01.png",
  "-tile", "3x2", "-geometry", "512x512+0+0", "-background", "none", "-alpha", "on",
  "public/assets/critters/frog/frog.png",
]);
const names = ["chaos_idle_01", "chaos_burst_01", "soothed_01", "calm_idle_01", "chaos_aura_01"];
const framesJson: Record<string, unknown> = {};
for (const [index, name] of names.entries()) {
  framesJson[name] = {
    frame: { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, w: 512, h: 512 },
    rotated: false,
    trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 512, h: 512 },
    sourceSize: { w: 512, h: 512 },
    anchor: { x: 0.5, y: 0.984375 },
  };
}
const sheet = {
  frames: framesJson,
  animations: {
    chaos_idle: ["chaos_idle_01"],
    chaos_burst: ["chaos_burst_01"],
    soothed: ["soothed_01"],
    calm_idle: ["calm_idle_01"],
    chaos_aura: ["chaos_aura_01"],
  },
  meta: { image: "frog.png", size: { w: 1536, h: 1024 }, scale: "1", baseline: 504 },
};
await Bun.write("public/assets/critters/frog/frog.json", JSON.stringify(sheet, null, 2) + "\n");
await Bun.file(auraTrim).delete().catch(() => undefined);
await Bun.file(auraAlpha).delete().catch(() => undefined);
await Bun.file(auraScaled).delete().catch(() => undefined);
