import { readdirSync, readFileSync, statSync } from "node:fs";

function bundleText(directory: string): string {
  const files = readdirSync(directory, { recursive: true })
    .filter((file): file is string => typeof file === "string")
    .map((file) => `${directory}/${file}`)
    .filter((file) => statSync(file).isFile());
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const text = bundleText(
  process.argv.includes("--harness") ? "dist-harness" : "dist",
);
const containsHook =
  text.includes("__cloverhollow") || text.includes("window.__cloverhollow");
if (process.argv.includes("--harness") ? !containsHook : containsHook) {
  throw new Error(
    process.argv.includes("--harness")
      ? "harness hook missing"
      : "harness hook leaked into production",
  );
}
console.log(
  process.argv.includes("--harness")
    ? "harness hook presence check: passed"
    : "production hook leak check: passed",
);
