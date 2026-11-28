import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

export const MAX_APP_CHUNK_BYTES = 500 * 1024;
export const RUNTIME_STORY_ASSET = "assets/story/main.ink.json";

export interface AssetEntry {
  name: string;
  bytes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function bundledStoryChunks(entries: ReadonlyArray<AssetEntry>): string[] {
  return entries
    .filter((entry) => {
      const fileName = entry.name.split("/").pop() ?? entry.name;
      return fileName.startsWith("story-content") && fileName.endsWith(".js");
    })
    .map((entry) => entry.name);
}

export function verifyRuntimeStoryAsset(directory: string): void {
  const storyPath = `${directory}/${RUNTIME_STORY_ASSET}`;
  if (!existsSync(storyPath)) {
    throw new Error(`runtime story asset missing: ${storyPath}`);
  }
  const raw = readFileSync(storyPath, "utf8");
  if (raw.trim().length === 0) {
    throw new Error(`runtime story asset is empty: ${storyPath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`runtime story asset is invalid JSON (${storyPath}): ${detail}`);
  }
  if (!isRecord(parsed) || typeof parsed.inkVersion !== "number" || !Array.isArray(parsed.root)) {
    throw new Error(`runtime story asset is not valid compiled Ink JSON: ${storyPath}`);
  }
}

export function verifyEntryStylesheets(directory: string, entryHtml = "index.html"): void {
  const htmlPath = `${directory}/${entryHtml}`;
  if (!existsSync(htmlPath)) {
    throw new Error(`entry HTML missing: ${htmlPath}`);
  }
  const html = readFileSync(htmlPath, "utf8");
  const hrefs = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((href) => href.length > 0);
  if (hrefs.length === 0) {
    throw new Error(`entry HTML links no stylesheets: ${htmlPath}`);
  }
  const combinedCss = hrefs
    .map((href) => {
      const normalized = href.replace(/^\.\//, "");
      const cssPath = `${directory}/${normalized}`;
      if (!existsSync(cssPath)) {
        throw new Error(`linked stylesheet missing (${htmlPath}): ${cssPath}`);
      }
      return readFileSync(cssPath, "utf8");
    })
    .join("\n");
  for (const marker of [".sticker-dialogue", ".sticker-speaker", ".touch-stick"]) {
    if (!combinedCss.includes(marker)) {
      throw new Error(`linked CSS for ${htmlPath} is missing required rule ${marker}`);
    }
  }
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
  const entries = assetEntries(directory);
  const storyChunks = bundledStoryChunks(entries);
  if (storyChunks.length > 0) {
    throw new Error(`story JSON must not be bundled as JS chunk(s): ${storyChunks.join(", ")}`);
  }
  verifyRuntimeStoryAsset(directory);
  verifyEntryStylesheets(directory, "index.html");
  if (isHarness) {
    verifyEntryStylesheets(directory, "ui-gallery.html");
  }
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
    const oversized = oversizedAppChunks(entries);
    if (oversized.length > 0) {
      throw new Error(`production app chunk(s) exceed 500 kB: ${oversized.join(", ")}`);
    }
    console.log("production hook leak check: passed");
    console.log("production app chunk budget check: passed (<500 kB)");
    console.log("production runtime story asset check: passed");
    return;
  }
  console.log("harness hook presence check: passed");
  console.log("harness runtime story asset check: passed");
}

if (import.meta.main) {
  runCheckDist(process.argv);
}
