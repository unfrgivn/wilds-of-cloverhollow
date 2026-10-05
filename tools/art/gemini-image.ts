#!/usr/bin/env bun
export {};
type JsonRecord = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonRecord;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(args: string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === undefined || !value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      result.set(key, [...(result.get(key) ?? []), next]);
      index += 1;
    } else result.set(key, [...(result.get(key) ?? []), "true"]);
  }
  return result;
}

function first(args: Map<string, string[]>, key: string, fallback: string): string {
  return args.get(key)?.[0] ?? fallback;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

async function appendLog(entry: JsonRecord): Promise<void> {
  const path = "art/scratch/generation-log.jsonl";
  let previous = "";
  try {
    previous = await Bun.file(path).text();
  } catch {
    previous = "";
  }
  await Bun.write(path, `${previous}${JSON.stringify(entry)}\n`);
}

const args = parseArgs(Bun.argv.slice(2));
const key = process.env.GEMINI_API_KEY;
if (key === undefined || key.length === 0) throw new Error("GEMINI_API_KEY is not set");
const model = first(args, "model", "gemini-3-pro-image-preview");
const prompt = first(args, "prompt", "Generate the requested game art asset.");
const refs = args.get("ref") ?? [];
const ratio = first(args, "aspect-ratio", "1:1");
const imageSize = first(args, "image-size", "2K");
const contentsParts: JsonValue[] = [{ text: prompt }];
for (const ref of refs) {
  const bytes = new Uint8Array(await Bun.file(ref).arrayBuffer());
  contentsParts.push({
    inlineData: {
      mimeType: "image/png",
      data: Buffer.from(bytes).toString("base64"),
    },
  });
}
const body: JsonRecord = {
  contents: [{ role: "user", parts: contentsParts }],
  generationConfig: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: ratio, imageSize },
  },
};
const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
  + `${encodeURIComponent(model)}:generateContent`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify(body),
});
const payload: unknown = await response.json();
if (!response.ok) {
  const message = isRecord(payload) && isRecord(payload.error)
    && typeof payload.error.message === "string"
    ? payload.error.message
    : `HTTP ${response.status}`;
  const mkdir = Bun.spawn(["mkdir", "-p", "art/scratch"]);
  if (await mkdir.exited !== 0) throw new Error("Could not create art/scratch");
  const failedLog = {
    timestamp: new Date().toISOString(), model, prompt, refs,
    outputs: [], finishReason: [], usage: null, error: message,
  };
  await appendLog(failedLog);
  throw new Error(`Gemini request failed: ${message}`);
}
if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
  throw new Error("Gemini response had no candidates");
}
const outputs: string[] = [];
const mkdir = Bun.spawn(["mkdir", "-p", "art/scratch"]);
if (await mkdir.exited !== 0) throw new Error("Could not create art/scratch");
for (const candidate of payload.candidates) {
  if (!isRecord(candidate) || !isRecord(candidate.content)
    || !Array.isArray(candidate.content.parts)) continue;
  for (const part of candidate.content.parts) {
    if (!isRecord(part) || !isRecord(part.inlineData)
      || typeof part.inlineData.data !== "string") continue;
    const output = `art/scratch/${Date.now()}-${safeName(model)}-${outputs.length}.png`;
    await Bun.write(output, Buffer.from(part.inlineData.data, "base64"));
    outputs.push(output);
  }
}
const usage = isRecord(payload.usageMetadata) ? payload.usageMetadata : null;
const finish = payload.candidates.map((candidate) => (
  isRecord(candidate) && typeof candidate.finishReason === "string"
    ? candidate.finishReason
    : null
));
const log = {
  timestamp: new Date().toISOString(), model, prompt, refs,
  outputs, finishReason: finish, usage,
};
await appendLog(log);
if (outputs.length === 0) throw new Error("Gemini returned no image parts");
console.log(outputs.join("\n"));
