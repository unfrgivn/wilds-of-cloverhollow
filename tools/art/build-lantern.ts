#!/usr/bin/env bun
// Rebuilds the lantern and white-lifted secret decals byte for byte from the
// selected sources in art/source/lantern.
export {};

type Size = { width: number; height: number };
type Frame = { x: number; y: number; w: number; h: number };
type FrameData = {
  frame: Frame;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: Frame;
  sourceSize: Size;
};

const source = "art/source/lantern";
const scratch = "art/scratch/lantern-build";

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error("Command failed: " + command.join(" "));
}

async function text(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const result = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error("Command failed: " + command.join(" "));
  return result.trim();
}

async function size(path: string): Promise<Size> {
  const result = await text(["magick", "identify", "-format", "%w:%h", path]);
  const [widthText, heightText] = result.split(":");
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Bad size for " + path);
  }
  return { width, height };
}

async function writeAtlas(
  names: string[],
  paths: string[],
  output: string,
  jsonOutput: string,
  imageName: string,
): Promise<void> {
  await run([
    "magick", "-background", "none", "-gravity", "north", ...paths,
    "+append", "-strip", output,
  ]);
  const sizes = await Promise.all(paths.map((path) => size(path)));
  const frames: Record<string, FrameData> = {};
  let x = 0;
  for (const [index, name] of names.entries()) {
    const frameSize = sizes[index];
    if (frameSize === undefined) throw new Error("Missing frame size for " + name);
    frames[name] = {
      frame: { x, y: 0, w: frameSize.width, h: frameSize.height },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: frameSize.width, h: frameSize.height },
      sourceSize: frameSize,
    };
    x += frameSize.width;
  }
  const metadata = {
    frames,
    animations: Object.fromEntries(names.map((name) => [name, [name]])),
    meta: {
      image: imageName,
      size: { w: x, h: Math.max(...sizes.map((frameSize) => frameSize.height)) },
      scale: "1",
    },
  };
  await Bun.write(jsonOutput, JSON.stringify(metadata, null, 2) + "\n");
}

await run(["rm", "-rf", scratch]);
await run([
  "mkdir", "-p", scratch + "/lantern", scratch + "/glows",
  "public/assets/items/lantern", "public/assets/glows",
]);

const matte = scratch + "/lantern/matte.png";
const fit = scratch + "/lantern/fit.png";
const frame = scratch + "/lantern/lantern.png";
await run([
  "bun", "tools/art/key-alpha.ts", "--input", source + "/lantern-raw.png",
  "--output", matte, "--key", "#FFFFFF", "--fuzz", "8%", "--despill", "none",
]);
await run(["magick", matte, "-trim", "+repage", "-resize", "232x232", fit]);
await run([
  "magick", "-size", "256x256", "xc:none", fit,
  "-gravity", "center", "-composite", "-channel", "A", "-threshold", "1%",
  "+channel", "-strip", frame,
]);
await run(["magick", frame, "-strip", "public/assets/items/lantern/lantern.png"]);
const lanternMetadata = {
  frames: {
    lantern: {
      frame: { x: 0, y: 0, w: 256, h: 256 }, rotated: false, trimmed: true,
      spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 },
      sourceSize: { w: 256, h: 256 }, anchor: { x: 0.5, y: 0.5 },
    },
  },
  animations: { lantern: ["lantern"] },
  meta: { image: "lantern.png", size: { w: 256, h: 256 }, scale: "1" },
};
await Bun.write(
  "public/assets/items/lantern/lantern.json",
  JSON.stringify(lanternMetadata, null, 2) + "\n",
);

const glowNames = ["paw_prints", "ink_note", "trail_marker"];
const glowPaths: string[] = [];
for (const name of glowNames) {
  const alpha = scratch + "/glows/" + name + "-alpha.png";
  const padded = scratch + "/glows/" + name + ".png";
  const raw = source + "/" + name.replaceAll("_", "-") + "-raw.png";
  await run(["bun", "tools/art/black-to-alpha.ts", "--input", raw, "--output", alpha]);
  const target = name === "paw_prints" ? "240x160"
    : name === "ink_note" ? "140x140" : "120x160";
  await run([
    "magick", alpha, "-trim", "+repage", "-resize", target,
    "-bordercolor", "none",
    "-border", "8", "-strip", padded,
  ]);
  glowPaths.push(padded);
}
await writeAtlas(
  glowNames, glowPaths, "public/assets/glows/glows.png",
  "public/assets/glows/glows.json", "glows.png",
);
