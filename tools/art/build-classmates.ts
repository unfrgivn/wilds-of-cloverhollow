#!/usr/bin/env bun
// Rebuilds the Milo, Rosie, and hooded-kid character atlases byte for byte.
export {};

type Person = {
  id: string;
  key: string;
  fuzz: string;
  sources: string[];
  names: string[];
};

const people: Person[] = [
  {
    id: "milo",
    key: "#FF00FF",
    fuzz: "18%",
    sources: ["pose-front-raw.png", "blink-edit-raw.png", "pose-side-raw.png", "pose-side-raw.png"],
    names: ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"],
  },
  {
    id: "rosie",
    key: "#FF00FF",
    fuzz: "18%",
    sources: ["pose-front-raw.png", "blink-edit-raw.png", "pose-left-raw.png",
      "pose-right-raw.png"],
    names: ["down_idle_01", "down_idle_02", "left_idle_01", "right_idle_01"],
  },
  {
    id: "hooded-kid",
    key: "#00FF00",
    fuzz: "18%",
    sources: ["body-raw.png"],
    names: ["down_idle_01"],
  },
];

async function run(command: string[]): Promise<void> {
  const process = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  if (await process.exited !== 0) throw new Error(`Command failed: ${command.join(" ")}`);
}

for (const person of people) {
  const frames = `art/scratch/${person.id}-build-frames`;
  await run(["rm", "-rf", frames]);
  await run(["mkdir", "-p", frames, `public/assets/characters/${person.id}`]);
  for (const [index, name] of person.names.entries()) {
    const source = `art/source/classmates/${person.id}/${person.sources[index]}`;
    const frame = `${frames}/${name}.png`;
    await run(["bun", "tools/art/postprocess.ts", "--input", source, "--output", frame,
      "--width", "448", "--height", "448", "--figure-height", "280", "--bottom-margin", "8",
      "--key", person.key, "--fuzz", person.fuzz, "--despill", "edge"]);
    const despilled = `${frames}/${name}-despill.png`;
    await run(["bun", "tools/art/despill-edge.ts", "--input", frame, "--output", despilled,
      "--key", person.key === "#FF00FF" ? "magenta" : "green", "--band", "20"]);
    await run(["mv", despilled, frame]);
  }
  const atlas = `public/assets/characters/${person.id}/${person.id}.png`;
  await run(["magick", "montage", ...person.names.map((name) => `${frames}/${name}.png`),
    "-tile", `${person.names.length}x1`, "-geometry", "448x448+0+0", "-background", "none", atlas]);
  const records: Record<string, unknown> = {};
  for (const [index, name] of person.names.entries()) records[name] = {
    frame: { x: index * 448, y: 0, w: 448, h: 448 }, rotated: false, trimmed: true,
    spriteSourceSize: { x: 0, y: 0, w: 448, h: 448 }, sourceSize: { w: 448, h: 448 },
    anchor: { x: 0.5, y: 439 / 448 },
  };
  const animations: Record<string, string[]> = person.id === "hooded-kid"
    ? { idle_down: ["down_idle_01"] }
    : { idle_down: ["down_idle_01", "down_idle_02"], idle_left: ["left_idle_01"],
      idle_right: ["right_idle_01"] };
  await Bun.write(`public/assets/characters/${person.id}/${person.id}.json`, `${JSON.stringify({
    frames: records, animations,
    meta: { image: `${person.id}.png`, size: { w: person.names.length * 448, h: 448 },
      scale: "1", baseline: 439 },
  }, null, 2)}\n`);
}
