import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Keeps src/core deterministic across JavaScript engines (spec 3.1): no clocks,
// no DOM, no unseeded randomness, no locale-dependent comparisons, and none of
// the Math functions whose results may differ between V8 and JavaScriptCore.
const banned = new RegExp(
  "\\b(?:Date|performance|window|document|setTimeout|setInterval|" +
    "requestAnimationFrame|localeCompare|toLocale[A-Za-z]*)\\b|" +
    "Math\\.(?:random|sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|hypot|cbrt)|" +
    "\\*\\*",
);

/** Blanks out comments (keeping line breaks) so prose can't trip the scan. */
export function stripComments(source: string): string {
  let output = "";
  let index = 0;
  let quote: string | undefined;
  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (quote !== undefined) {
      output += char;
      if (char === "\\") {
        output += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = undefined;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

if (import.meta.main) {
  for (const file of files("src/core")) {
    const code = stripComments(readFileSync(file, "utf8"));
    const match = banned.exec(code);
    if (match !== null) {
      const line = code.slice(0, match.index).split("\n").length;
      throw new Error(`forbidden token "${match[0]}" in ${file}:${line}`);
    }
    if (/from ['"]\.\.\//.test(code))
      throw new Error(`core imports outside core: ${file}`);
  }
  console.log("core purity: passed");
}
