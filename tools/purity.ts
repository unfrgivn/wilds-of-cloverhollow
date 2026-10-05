import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const banned = new RegExp(
  "\\b(?:Date|performance|window|document|setTimeout|setInterval|" +
    "requestAnimationFrame|localeCompare|toLocale[A-Za-z]*)\\b|" +
    "Math\\.(?:random|sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|hypot|cbrt)|" +
    "\\*\\*",
);
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
for (const file of files("src/core")) {
  const text = readFileSync(file, "utf8");
  if (banned.test(text)) throw new Error(`forbidden token in ${file}`);
  if (/from ['"]\.\.\//.test(text))
    throw new Error(`core imports outside core: ${file}`);
}
console.log("core purity: passed");
