import { readdirSync, readFileSync, statSync } from "node:fs";

export const MAX_APP_CHUNK_BYTES = 500 * 1024;

export interface AssetEntry {
  name: string;
  bytes: number;
}

export function oversizedAppChunks(
  entries: ReadonlyArray<AssetEntry>,
  maxBytes = MAX_APP_CHUNK_BYTES,
): string[] {
  return entries
    .filter((entry) => {
      const fileName = entry.name.split("/").pop() ?? entry.name;
      return fileName.endsWith(".js") && !fileName.startsWith("vendor-") && entry.bytes > maxBytes;
    })
    .map((entry) => `${entry.name} (${(entry.bytes / 1024).toFixed(1)} kB)`);
}

function bundleText(directory: string): string {
  const files = readdirSync(directory, { recursive: true })
    .filter((file): file is string => typeof file === "string")
    .map((file) => `${directory}/${file}`)
    .filter((file) => statSync(file).isFile());
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function assetEntries(directory: string): AssetEntry[] {
  const assetsDir = `${directory}/assets`;
  return readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      bytes: statSync(`${assetsDir}/${entry.name}`).size,
    }));
}

function runCheckDist(argv: ReadonlyArray<string>): void {
  const isHarness = argv.includes("--harness");
  const directory = isHarness ? "dist-harness" : "dist";
  const text = bundleText(directory);
  const containsHook =
    text.includes("__cloverhollow") || text.includes("window.__cloverhollow");
  const containsStateLog = text.includes("[cloverhollow] state");
  const containsGallery = text.includes("Cloverhollow sticker gallery");
  const containsQa = text.includes("QA save library") && text.includes("golden-jordan");
  const containsConsole = text.includes("QA console");
  if (isHarness ? !containsHook : containsHook) {
    throw new Error(
      isHarness ? "harness hook missing" : "harness hook leaked into production",
    );
  }
  if (isHarness ? !containsStateLog : containsStateLog) {
    throw new Error(
      isHarness ? "harness state logger missing" : "state logger leaked into production",
    );
  }
  if (isHarness ? !containsGallery : containsGallery) {
    throw new Error(isHarness ? "harness gallery missing" : "gallery leaked into production");
  }
  if (isHarness ? !containsQa : containsQa) {
    throw new Error(
      isHarness ? "harness QA library missing" : "QA mode leaked into production",
    );
  }
  if (isHarness ? !containsConsole : containsConsole) {
    throw new Error(
      isHarness ? "harness QA console missing" : "QA console leaked into production",
    );
  }
  if (!isHarness) {
    const oversized = oversizedAppChunks(assetEntries(directory));
    if (oversized.length > 0) {
      throw new Error(`production app chunk(s) exceed 500 kB: ${oversized.join(", ")}`);
    }
    console.log("production hook leak check: passed");
    console.log("production app chunk budget check: passed (<500 kB)");
    return;
  }
  console.log("harness hook presence check: passed");
}

if (import.meta.main) {
  runCheckDist(process.argv);
}
