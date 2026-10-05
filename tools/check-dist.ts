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
const containsStateLog = text.includes("[cloverhollow] state");
const containsGallery = text.includes("Cloverhollow sticker gallery");
if (process.argv.includes("--harness") ? !containsHook : containsHook) {
  throw new Error(
    process.argv.includes("--harness")
      ? "harness hook missing"
      : "harness hook leaked into production",
  );
}
if (process.argv.includes("--harness") ? !containsStateLog : containsStateLog) {
  throw new Error(
    process.argv.includes("--harness")
      ? "harness state logger missing"
      : "state logger leaked into production",
  );
}
if (process.argv.includes("--harness") ? !containsGallery : containsGallery) {
  throw new Error(process.argv.includes("--harness")
    ? "harness gallery missing" : "gallery leaked into production");
}
console.log(
  process.argv.includes("--harness")
    ? "harness hook presence check: passed"
    : "production hook leak check: passed",
);
