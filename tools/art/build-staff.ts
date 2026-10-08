#!/usr/bin/env bun
export {};

async function run(command: string[]): Promise<void> {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error("Command failed: " + command.join(" "));
}
const whoArgument = Bun.argv.indexOf("--who");
const requested = whoArgument >= 0 ? Bun.argv[whoArgument + 1] : undefined;
if (requested === undefined) {
  for (const person of ["teacher", "nurse", "coach"]) {
    const process = Bun.spawn(["bun", "tools/art/build-staff.ts", "--who", person], {
      stdout: "inherit", stderr: "inherit",
    });
    if (await process.exited !== 0) throw new Error(`Build failed for ${person}`);
  }
  process.exit(0);
}
const who = requested;
if (who !== "teacher" && who !== "nurse" && who !== "coach")
  throw new Error("--who must be teacher, nurse, or coach");
const root = "art/source/staff/" + who;
const frames = "art/scratch/" + who + "-build-frames";
await run(["rm", "-rf", frames]);
await run(["mkdir", "-p", frames]);
const processFrame = async (source: string, name: string): Promise<void> => {
  await run(["bun", "tools/art/postprocess.ts", "--input", source,
    "--output", frames + "/" + name + ".png", "--width", "448", "--height", "448",
    "--figure-height", "336", "--bottom-margin", "8", "--key", "#FF00FF",
    "--fuzz", "18%", "--despill", "edge"]);
  await run(["bun", "tools/art/despill-edge.ts", "--input", frames + "/" + name + ".png",
    "--output", frames + "/" + name + "-despill.png", "--key", "magenta", "--band", "20"]);
  await run(["mv", frames + "/" + name + "-despill.png", frames + "/" + name + ".png"]);
};
await processFrame(root + "/pose-0.png", "down_idle_01");
await processFrame(root + "/blink-edit-raw.png", "down_idle_02");
await processFrame(root + "/pose-1.png", "left_idle_01");
if (who === "teacher") {
  await run(["magick", frames + "/left_idle_01.png", "-flop", frames + "/right_idle_01.png"]);
}
else await processFrame(root + "/pose-2.png", "right_idle_01");
await run(["mkdir", "-p", "public/assets/characters/" + who]);
await run(["magick", "montage", frames + "/down_idle_01.png", frames + "/down_idle_02.png",
  frames + "/left_idle_01.png", frames + "/right_idle_01.png", "-tile", "4x1",
  "-geometry", "448x448+0+0", "-background", "none",
  "public/assets/characters/" + who + "/" + who + ".png"]);
const names = ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"];
const records: Record<string, unknown> = {};
for (const [index, name] of names.entries()) records[name] = {
  frame: { x: index * 448, y: 0, w: 448, h: 448 }, rotated: false, trimmed: true,
  spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 }, sourceSize: { w: 448, h: 448 },
  anchor: { x: 0.5, y: 439 / 448 },
};
await Bun.write("public/assets/characters/" + who + "/" + who + ".json", JSON.stringify({
  frames: records,
  animations: {
    idle_down: ["down_idle_01", "down_idle_02"],
    idle_left: ["left_idle_01"], idle_right: ["right_idle_01"],
  },
  meta: { image: who + ".png", size: { w: 1792, h: 448 }, scale: "1", baseline: 439 },
}, null, 2) + "\n");
