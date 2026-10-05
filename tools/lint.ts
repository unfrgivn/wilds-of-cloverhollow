import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const sourceFiles = [
  "vite.config.ts",
  "playwright.config.ts",
  "vitest.config.ts",
  "tsconfig.json",
  "package.json",
  "justfile",
  ...files("src"),
  ...files("tests"),
  ...files("tools"),
];
for (const file of sourceFiles.filter((item) => item.endsWith(".ts"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.length > 100)
      throw new Error(`${file}:${index + 1} exceeds 100 columns`);
  });
}
for (const file of [...files("content"), ...files("tests/sim/scripts")].filter(
  (item) => item.endsWith(".json"),
)) {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  const expected = `${JSON.stringify(parsed, null, 2)}\n`;
  if (readFileSync(file, "utf8") !== expected)
    throw new Error(`${file} is not pretty-printed JSON`);
}
console.log("lint: passed");
