import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Compiler, CompilerOptions } from "inkjs/full";
import type { IFileHandler } from "inkjs/compiler/IFileHandler";

export const STORY_DIR = "content/story";
export const STORY_ENTRY = "content/story/main.ink";
export const STORY_OUTPUT = "public/assets/story/main.ink.json";

const LEGACY_STORY_OUTPUT = "content/story/main.ink.json";

export type StoryFileHandler = IFileHandler & {
  readonly loadedFiles: () => readonly string[];
};

export interface CompileStoryOptions {
  rootDir?: string;
  sourceFilename?: string;
}

export interface CompileStoryResult {
  story: Record<string, unknown>;
  json: string;
  includedFiles: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosix(relPath: string): string {
  return relPath.split(sep).join("/");
}

function assertInsideRoot(root: string, candidate: string, label: string): string {
  const rel = relative(root, candidate);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Ink path escapes story root (${root}): "${label}"`);
  }
  return rel;
}

export function createStoryFileHandler(rootDir = STORY_DIR): StoryFileHandler {
  const root = resolve(rootDir);
  const loaded: string[] = [];
  const seen = new Set<string>();

  return {
    ResolveInkFilename(filename: string, _sourceFilename?: string | null): string {
      const trimmed = filename.trim();
      if (trimmed.length === 0) {
        throw new Error("Empty Ink INCLUDE filename");
      }
      if (trimmed.includes("\\")) {
        throw new Error(`Ink INCLUDE path must use forward slashes: "${filename}"`);
      }
      if (isAbsolute(trimmed)) {
        throw new Error(`Ink INCLUDE path must be relative: "${filename}"`);
      }
      const resolved = resolve(root, trimmed);
      assertInsideRoot(root, resolved, filename);
      return resolved;
    },

    LoadInkFileContents(fullFilename: string, _sourceFilename?: string | null): string {
      const resolved = resolve(fullFilename);
      const rel = assertInsideRoot(root, resolved, fullFilename);
      const content = readFileSync(resolved, "utf8").replace(/\r\n/g, "\n");
      const posixRel = toPosix(rel);
      if (!seen.has(posixRel)) {
        seen.add(posixRel);
        loaded.push(posixRel);
      }
      return content;
    },

    loadedFiles(): readonly string[] {
      return [...loaded];
    },
  };
}

export function compileStorySource(
  source: string,
  options?: CompileStoryOptions,
): CompileStoryResult {
  const rootDir = options?.rootDir ?? STORY_DIR;
  const sourceFilename = options?.sourceFilename ?? "main.ink";
  const fileHandler = createStoryFileHandler(rootDir);
  const normalized = source.replace(/\r\n/g, "\n");
  const compilerOptions = new CompilerOptions(sourceFilename, [], false, null, fileHandler);
  const compiler = new Compiler(normalized, compilerOptions);

  try {
    compiler.Compile();
  } catch (err: unknown) {
    const messages = [...(compiler.errors ?? []), ...(compiler.warnings ?? [])];
    if (messages.length > 0) throw new Error(messages.join("\n"));
    throw err;
  }

  const errors = compiler.errors ?? [];
  const warnings = compiler.warnings ?? [];
  if (errors.length > 0 || warnings.length > 0) {
    throw new Error([...errors, ...warnings].join("\n"));
  }

  const runtime = compiler.runtimeStory;
  if (runtime === null) throw new Error("Ink compiler produced no story");
  const compiled = runtime.ToJson();
  if (typeof compiled !== "string") throw new Error("Ink did not serialize");
  if (compiled.includes('"POW"')) throw new Error("story uses native POW");

  const parsed: unknown = JSON.parse(compiled);
  if (!isRecord(parsed)) throw new Error("compiled story is not a JSON object");
  const json = `${JSON.stringify(parsed, null, 2)}\n`;
  return { story: parsed, json, includedFiles: [...fileHandler.loadedFiles()] };
}

export function compileStoryFile(
  entryPath = STORY_ENTRY,
  rootDir = STORY_DIR,
): CompileStoryResult {
  const root = resolve(rootDir);
  const resolvedEntry = resolve(entryPath);
  const relEntry = toPosix(assertInsideRoot(root, resolvedEntry, entryPath));
  const source = readFileSync(resolvedEntry, "utf8");
  return compileStorySource(source, { rootDir, sourceFilename: relEntry });
}

export function listStoryInkFiles(rootDir = STORY_DIR): string[] {
  const root = resolve(rootDir);
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ink")) {
        found.push(toPosix(relative(root, fullPath)));
      }
    }
  };

  walk(root);
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function readStorySources(
  entryPath = STORY_ENTRY,
  rootDir = STORY_DIR,
): string {
  const root = resolve(rootDir);
  const resolvedEntry = resolve(entryPath);
  const { includedFiles } = compileStoryFile(entryPath, rootDir);
  const chunks = [readFileSync(resolvedEntry, "utf8").replace(/\r\n/g, "\n")];
  for (const rel of includedFiles) {
    const fullPath = resolve(root, rel);
    chunks.push(readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n"));
  }
  return chunks.join("\n");
}

function verifyNoOrphanInkFiles(
  entryPath: string,
  rootDir: string,
  includedFiles: readonly string[],
): void {
  const root = resolve(rootDir);
  const entryRel = toPosix(assertInsideRoot(root, resolve(entryPath), entryPath));
  const includedSet = new Set(includedFiles);
  const orphans = listStoryInkFiles(rootDir).filter(
    (file) => file !== entryRel && !includedSet.has(file),
  );
  if (orphans.length > 0) {
    throw new Error(`Orphan .ink file(s) not included by ${entryPath}: ${orphans.join(", ")}`);
  }
}

if (import.meta.main) {
  const result = compileStoryFile(STORY_ENTRY, STORY_DIR);
  verifyNoOrphanInkFiles(STORY_ENTRY, STORY_DIR, result.includedFiles);
  if (process.argv.includes("--check")) {
    if (existsSync(LEGACY_STORY_OUTPUT)) {
      throw new Error(`Stale compiled story file still exists: ${LEGACY_STORY_OUTPUT}`);
    }
    if (!existsSync(STORY_OUTPUT)) {
      throw new Error(`Compiled story missing: ${STORY_OUTPUT}`);
    }
    const current = readFileSync(STORY_OUTPUT, "utf8");
    if (current !== result.json) {
      throw new Error(`${STORY_OUTPUT} is stale`);
    }
  } else {
    mkdirSync(dirname(STORY_OUTPUT), { recursive: true });
    writeFileSync(STORY_OUTPUT, result.json);
  }
}
