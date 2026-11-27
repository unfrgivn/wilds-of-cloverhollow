#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ASSETS_ROOT = "public/assets";
const SKIP_ATLASES = new Set(["public/assets/items/lantern/lantern.json"]);
const MIN_PSNR_DB = 42;
const CONCURRENCY = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function totalBytes(directory: string): number {
  let bytes = 0;
  for (const file of walkFiles(directory)) bytes += statSync(file).size;
  return bytes;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function runChecked(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd.join(" ")} failed (${code}): ${stderr.trim()}`);
}

async function measurePsnr(referencePath: string, candidatePath: string): Promise<number> {
  const proc = Bun.spawn(
    ["magick", "compare", "-metric", "PSNR", referencePath, candidatePath, "null:"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code > 1) throw new Error(`magick compare failed (${code}): ${stderr.trim()}`);
  const token = stderr.trim().split(/\s+/)[0] ?? "";
  if (token === "inf" || token === "1.#INF") return Number.POSITIVE_INFINITY;
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) {
    throw new Error(`Unable to parse PSNR from "${stderr.trim()}" for ${candidatePath}`);
  }
  return value;
}

const beforeTotal = totalBytes(ASSETS_ROOT);
const jsonFiles = walkFiles(ASSETS_ROOT).filter((file) => file.endsWith(".json")).sort();
type AtlasJob = { jsonPath: string; parsed: Record<string, unknown>; imageName: string };
const jobs: AtlasJob[] = [];
for (const jsonPath of jsonFiles) {
  if (SKIP_ATLASES.has(jsonPath)) continue;
  const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.meta)) continue;
  const imageName = parsed.meta.image;
  if (typeof imageName !== "string" || !imageName.endsWith(".png")) continue;
  const pngPath = join(dirname(jsonPath), imageName);
  if (!existsSync(pngPath)) continue;
  jobs.push({ jsonPath, parsed, imageName });
}

let converted = 0;
let losslessFallbacks = 0;
let savedBytes = 0;
let lowestPsnr = Number.POSITIVE_INFINITY;
let lowestPsnrFile = "";
let cursor = 0;

async function processJob(job: AtlasJob): Promise<void> {
  const { jsonPath, parsed, imageName } = job;
  const pngPath = join(dirname(jsonPath), imageName);
  const isPropAtlas = jsonPath.startsWith("public/assets/areas/") &&
    /\/props-\d+\.json$/.test(jsonPath);
  const quality = isPropAtlas ? 90 : 92;
  const webpName = imageName.replace(/\.png$/, ".webp");
  const webpPath = join(dirname(jsonPath), webpName);
  const pngBytes = statSync(pngPath).size;

  await runChecked([
    "cwebp", "-quiet", "-q", String(quality), "-alpha_q", "100", "-m", "6",
    pngPath, "-o", webpPath,
  ]);
  let psnr = await measurePsnr(pngPath, webpPath);
  let mode = `q${quality}`;
  if (psnr < MIN_PSNR_DB) {
    await runChecked(["cwebp", "-quiet", "-lossless", "-z", "9", pngPath, "-o", webpPath]);
    psnr = await measurePsnr(pngPath, webpPath);
    mode = "lossless";
    losslessFallbacks += 1;
  }
  if (psnr < MIN_PSNR_DB) {
    throw new Error(`${webpPath} PSNR ${psnr.toFixed(2)} dB still below ${MIN_PSNR_DB} dB`);
  }
  if (psnr < lowestPsnr) {
    lowestPsnr = psnr;
    lowestPsnrFile = webpPath;
  }

  const webpBytes = statSync(webpPath).size;
  savedBytes += pngBytes - webpBytes;
  if (isRecord(parsed.meta)) parsed.meta.image = webpName;
  writeFileSync(jsonPath, `${JSON.stringify(parsed, null, 2)}\n`);
  rmSync(pngPath);
  converted += 1;
  const psnrText = Number.isFinite(psnr) ? `${psnr.toFixed(2)} dB` : "inf dB";
  console.log(
    `${webpPath}: ${formatMb(pngBytes)} -> ${formatMb(webpBytes)} (${mode}, PSNR ${psnrText})`,
  );
}

const workers = Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    if (job !== undefined) await processJob(job);
  }
});
await Promise.all(workers);

const afterTotal = totalBytes(ASSETS_ROOT);
const reduction = beforeTotal === 0 ? 0 : ((beforeTotal - afterTotal) / beforeTotal) * 100;
console.log(
  `\nConverted ${converted} atlases (${losslessFallbacks} lossless fallback). ` +
    `Saved ${formatMb(savedBytes)}.`,
);
console.log(
  `public/assets total: ${formatMb(beforeTotal)} -> ${formatMb(afterTotal)} ` +
    `(-${reduction.toFixed(1)}%)`,
);
if (lowestPsnrFile.length > 0) {
  const lowestText = Number.isFinite(lowestPsnr) ? `${lowestPsnr.toFixed(2)} dB` : "inf dB";
  console.log(`Lowest PSNR: ${lowestText} (${lowestPsnrFile})`);
}
