#!/usr/bin/env bun
// Rebuilds Oliver's atlas from the selected generation (art/recipes/oliver.json).
//
// The strip has two panels on #FF00FF magenta, each inside a thin white frame
// the generator drew, which would stop a flood from the image border. So each
// panel is cropped inside its frame first, then keyed by border flood (plus
// enclosed holes, like the rattle's ring) with edge-only despill. Pose B is
// mirrored so both frames face the same way (the rattle moves up and down on
// one side instead of the baby flipping). Both
// frames share ONE scale (the taller frame becomes 110 px, 55 units) and one
// placement rule: the bottom of the figure on the baseline, and the seated
// body (the alpha centroid of the figure's lower half) at the canvas centre.
export {};

const width = 256;
const height = 256;
const baseline = 247;
const figureHeight = 110;
const source = "art/source/oliver/oliver-strip.png";
const panelWidth = 1376;
const inset = 24;
const scratch = "art/scratch/oliver-build";
const frames = `${scratch}/frames`;

async function run(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "inherit" });
  const output = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
  return output.trim();
}

async function bbox(path: string): Promise<{ x: number; y: number; w: number; h: number }> {
  const text = await run(["magick", path, "-alpha", "extract", "-threshold", "50%",
    "-format", "%@", "info:"]);
  const match = text.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
  if (match === null) throw new Error(`No figure in ${path}: ${text}`);
  return { w: Number(match[1]), h: Number(match[2]), x: Number(match[3]), y: Number(match[4]) };
}

// The x centroid of the alpha in the lower half of the figure (the seated body).
async function bodyCentre(path: string, box: { x: number; y: number; w: number; h: number }):
  Promise<number> {
  const top = box.y + Math.floor(box.h / 2);
  const raw = await run(["magick", path, "-crop", `${box.w}x${box.y + box.h - top}+${box.x}+${top}`,
    "+repage", "-alpha", "extract", "-depth", "8", "-compress", "none", "pgm:-"]);
  const values = raw.split(/\s+/).slice(4).map(Number);
  let total = 0;
  let weighted = 0;
  values.forEach((alpha, index) => {
    total += alpha;
    weighted += alpha * (index % box.w);
  });
  if (total === 0) throw new Error(`No body in ${path}`);
  return box.x + weighted / total;
}

await run(["rm", "-rf", scratch]);
await run(["mkdir", "-p", frames]);
const poses = [
  { name: "down_idle_01", panel: 0, mirror: false },
  { name: "down_idle_02", panel: 1, mirror: true },
];
type Box = { x: number; y: number; w: number; h: number };
const keyed: { name: string; path: string; box: Box }[] = [];
for (const pose of poses) {
  const panel = `${scratch}/${pose.name}-panel.png`;
  const alpha = `${scratch}/${pose.name}-keyed.png`;
  await run(["magick", source, "-crop",
    `${panelWidth - inset * 2}x${1536 - inset * 2}+${pose.panel * panelWidth + inset}+${inset}`,
    "+repage", ...(pose.mirror ? ["-flop"] : []), panel]);
  await run(["bun", "tools/art/key-alpha.ts", "--input", panel, "--output", alpha,
    "--key", "#FF00FF", "--fuzz", "18%", "--despill", "edge", "--holes"]);
  keyed.push({ name: pose.name, path: alpha, box: await bbox(alpha) });
}
const scale = figureHeight / Math.max(...keyed.map((frame) => frame.box.h));
for (const frame of keyed) {
  const centre = await bodyCentre(frame.path, frame.box);
  const left = Math.round(width / 2 - (centre - frame.box.x) * scale);
  const top = Math.round(baseline - frame.box.h * scale);
  const scaled = `${scratch}/${frame.name}-scaled.png`;
  const { x, y, w, h } = frame.box;
  await run(["magick", frame.path, "-crop", `${w}x${h}+${x}+${y}`, "+repage",
    "-filter", "Lanczos", "-resize", `${(scale * 100).toFixed(4)}%`, scaled]);
  await run(["magick", "-size", `${width}x${height}`, "xc:none", scaled, "-geometry",
    `+${left}+${top}`, "-compose", "over", "-composite", `${frames}/${frame.name}.png`]);
}
await run(["bun", "tools/art/pack-atlas.ts", "--input", frames,
  "--output", "public/assets/characters/oliver/oliver.png", "--width", String(width),
  "--height", String(height), "--columns", "2", "--baseline", String(baseline)]);
// pack-atlas writes every direction's animation; Oliver has only idle_down.
const jsonPath = "public/assets/characters/oliver/oliver.json";
const atlas: unknown = JSON.parse(await Bun.file(jsonPath).text());
if (typeof atlas !== "object" || atlas === null || !("animations" in atlas) ||
    typeof atlas.animations !== "object" || atlas.animations === null)
  throw new Error("pack-atlas wrote no animations");
const animations = Object.fromEntries(Object.entries(atlas.animations)
  .filter(([, names]) => Array.isArray(names) && names.length > 0));
await Bun.write(jsonPath, `${JSON.stringify({ ...atlas, animations }, null, 2)}\n`);
const names = keyed.map((frame) => frame.name).join(", ");
console.log(`oliver: scale ${scale.toFixed(5)}, frames ${names}`);
