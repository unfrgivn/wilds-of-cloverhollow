import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Compiler } from "inkjs/full";

const sourcePath = "content/story/main.ink";
const outputPath = "content/story/main.ink.json";
const source = readFileSync(sourcePath, "utf8");
const compiler = new Compiler(source);
compiler.Compile();
const errors = compiler.errors ?? [];
const warnings = compiler.warnings ?? [];
if (errors.length > 0 || warnings.length > 0)
  throw new Error([...errors, ...warnings].join("\n"));
const runtime = compiler.runtimeStory;
if (runtime === null) throw new Error("Ink compiler produced no story");
const compiled = runtime.ToJson();
if (typeof compiled !== "string") throw new Error("Ink did not serialize");
if (compiled.includes('"POW"')) throw new Error("main.ink uses native POW");
mkdirSync("content/story", { recursive: true });
if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  const expected = `${JSON.stringify(JSON.parse(compiled), null, 2)}\n`;
  if (current !== expected) throw new Error(`${outputPath} is stale`);
} else {
  writeFileSync(outputPath, `${JSON.stringify(JSON.parse(compiled), null, 2)}\n`);
}
