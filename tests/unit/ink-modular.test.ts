import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  endingContentErrors,
  fetchStoryJson,
  loadBrowserContent,
  loadContent,
  loadStoryFromDisk,
  STORY_ASSET_PATH,
  type StoryFetcher,
  storyAssetUrl,
  storyTagErrors,
  storyTags,
} from "../../src/content/load";
import { createInkState, createState, stableHash } from "../../src/core";
import {
  bundledStoryChunks,
  RUNTIME_STORY_ASSET,
  verifyEntryStylesheets,
  verifyRuntimeStoryAsset,
} from "../../tools/check-dist";
import {
  compileStoryFile,
  compileStorySource,
  createStoryFileHandler,
  listStoryInkFiles,
  readStorySources,
  STORY_DIR,
  STORY_ENTRY,
  STORY_OUTPUT,
} from "../../tools/ink/compile";
import { chunkGroups } from "../../vite.config";

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "cloverhollow-ink-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("Track E0: Ink compiler fileHandler and compileStorySource", () => {
  it("compiles modular Ink with nested INCLUDE files deterministically", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, "systems"), { recursive: true });
      mkdirSync(join(dir, "chapters", "nested"), { recursive: true });
      writeFileSync(join(dir, "systems", "vars.ink"), "VAR greeted = false\n");
      writeFileSync(
        join(dir, "chapters", "nested", "leaf.ink"),
        "=== leaf ===\nHello from leaf! # speaker: Fae\n-> DONE\n",
      );
      writeFileSync(
        join(dir, "chapters", "intro.ink"),
        [
          "INCLUDE chapters/nested/leaf.ink",
          "=== intro ===",
          "~ greeted = true",
          "Welcome! -> leaf",
        ].join("\r\n") + "\r\n",
      );
      const entry = "INCLUDE systems/vars.ink\nINCLUDE chapters/intro.ink\n";
      writeFileSync(join(dir, "main.ink"), entry);

      const first = compileStoryFile(join(dir, "main.ink"), dir);
      const second = compileStorySource(entry, { rootDir: dir, sourceFilename: "main.ink" });

      expect(first.json).toBe(second.json);
      expect(first.includedFiles).toEqual([
        "systems/vars.ink",
        "chapters/intro.ink",
        "chapters/nested/leaf.ink",
      ]);
      expect(readStorySources(join(dir, "main.ink"), dir)).toContain("Hello from leaf!");
    });
  });

  it("fails fast on missing INCLUDE files", () => {
    withTempDir((dir) => {
      expect(() =>
        compileStorySource("INCLUDE chapters/missing.ink\n", { rootDir: dir }),
      ).toThrow(/Failed to load|missing\.ink/);
    });
  });

  it("fails fast on recursive INCLUDE cycles", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "a.ink"), "INCLUDE b.ink\n=== knot_a ===\nHi\n-> DONE\n");
      writeFileSync(join(dir, "b.ink"), "INCLUDE a.ink\n=== knot_b ===\nBye\n-> DONE\n");

      expect(() =>
        compileStorySource("INCLUDE a.ink\n", { rootDir: dir }),
      ).toThrow(/Recursive INCLUDE/);
    });
  });

  it("rejects path traversal, backslashes, empty paths, and absolute paths", () => {
    withTempDir((dir) => {
      const handler = createStoryFileHandler(dir);
      expect(() => handler.ResolveInkFilename("")).toThrow(/Empty/);
      expect(() => handler.ResolveInkFilename("   ")).toThrow(/Empty/);
      expect(() => handler.ResolveInkFilename("..\\secret.ink")).toThrow(/forward slashes/);
      expect(() => handler.ResolveInkFilename("systems\\vars.ink")).toThrow(/forward slashes/);
      expect(() => handler.ResolveInkFilename("/etc/passwd")).toThrow(/relative/);
      expect(() => handler.ResolveInkFilename("../secret.ink")).toThrow(/escapes story root/);
      expect(() => handler.ResolveInkFilename(".")).toThrow(/escapes story root/);
      expect(() => handler.LoadInkFileContents(join(dir, "..", "secret.ink"))).toThrow(
        /escapes story root/,
      );
      expect(() =>
        compileStorySource("INCLUDE ../secret.ink\n", { rootDir: dir }),
      ).toThrow(/escapes story root/);
    });
  });

  it("rejects native POW instruction", () => {
    withTempDir((dir) => {
      const powInk = "=== math_test ===\n~ temp x = POW(2, 3)\n{x}\n-> DONE\n";
      expect(() => compileStorySource(powInk, { rootDir: dir })).toThrow(/POW/);
    });
  });
});

describe("Track E0: Modular story integrity", () => {
  it("uses INCLUDE modules across systems, chapters, party, and town with zero orphans", () => {
    const entrySource = readFileSync(STORY_ENTRY, "utf8");
    const nonEmptyLines = entrySource
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(nonEmptyLines.length).toBeGreaterThanOrEqual(17);
    expect(nonEmptyLines.every((line) => line.startsWith("INCLUDE "))).toBe(true);
    expect(entrySource).toContain("INCLUDE systems/");
    expect(entrySource).toContain("INCLUDE chapters/");
    expect(entrySource).toContain("INCLUDE party/");
    expect(entrySource).toContain("INCLUDE town/");

    const compiled = compileStoryFile(STORY_ENTRY, STORY_DIR);
    const allDiskInkFiles = listStoryInkFiles(STORY_DIR);
    const includedSet = new Set(compiled.includedFiles);
    const orphans = allDiskInkFiles.filter(
      (file) => file !== "main.ink" && !includedSet.has(file),
    );
    expect(orphans).toEqual([]);
    expect(compiled.includedFiles.length).toBe(nonEmptyLines.length);
  });

  it("matches public/assets/story/main.ink.json byte-for-byte with legacy JSON removed", () => {
    expect(existsSync("content/story/main.ink.json")).toBe(false);
    expect(existsSync(STORY_OUTPUT)).toBe(true);

    const compiled = compileStoryFile(STORY_ENTRY, STORY_DIR);
    const onDisk = readFileSync(STORY_OUTPUT, "utf8");
    expect(onDisk).toBe(compiled.json);
  });

  it("preserves all story knots/functions, variables, tags, and ending invariants", () => {
    const story = loadStoryFromDisk();
    const root = story.root;
    expect(Array.isArray(root)).toBe(true);
    if (!Array.isArray(root)) return;
    const defs: unknown = root[2];
    expect(isRecord(defs)).toBe(true);
    if (!isRecord(defs)) return;
    const keys = Object.keys(defs);
    expect(keys).toContain("global decl");
    expect(keys.filter((key) => key !== "global decl").length).toBeGreaterThanOrEqual(324);

    const { world } = loadContent();
    const prices = Object.fromEntries(
      world.arcade.counter.prizes.map((item) => [item.prize, item.price]),
    );
    const treatPrices = Object.fromEntries(
      world.treats.map((item) => [item.id, item.price]),
    );
    expect(storyTagErrors(storyTags(story), world.areas, prices, treatPrices)).toEqual([]);
    expect(endingContentErrors(story, world.areas)).toEqual([]);
  });
});

describe("Track E0: Browser and disk story loader parity", () => {
  it("resolves storyAssetUrl cleanly across relative, root, subpath, and empty bases", () => {
    expect(storyAssetUrl("./")).toBe(`./${STORY_ASSET_PATH}`);
    expect(storyAssetUrl("/")).toBe(`/${STORY_ASSET_PATH}`);
    expect(storyAssetUrl("/cloverhollow/")).toBe(`/cloverhollow/${STORY_ASSET_PATH}`);
    expect(storyAssetUrl("/cloverhollow")).toBe(`/cloverhollow/${STORY_ASSET_PATH}`);
    expect(storyAssetUrl("")).toBe(`./${STORY_ASSET_PATH}`);
    expect(storyAssetUrl(".")).toBe(`./${STORY_ASSET_PATH}`);
  });

  it("matches synchronous disk loadContent() identically when fetched via Response", async () => {
    const diskJson = readFileSync(STORY_OUTPUT, "utf8");
    const seenUrls: string[] = [];
    const fetcher: StoryFetcher = async (input) => {
      seenUrls.push(input);
      return new Response(diskJson, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const diskContent = loadContent();
    const browserContent = await loadBrowserContent({ baseUrl: "/cloverhollow/", fetcher });

    expect(seenUrls).toEqual([`/cloverhollow/${STORY_ASSET_PATH}`]);
    expect(browserContent.world.story).toEqual(diskContent.world.story);

    const fixture = diskContent.fixtures["new-game"];
    expect(fixture).toBeDefined();
    if (fixture === undefined) return;

    const diskState = createState(diskContent.world, fixture);
    const browserState = createState(browserContent.world, fixture);
    expect(stableHash(browserState)).toBe(stableHash(diskState));

    const diskInk = createInkState(diskContent.world.story, 1);
    const browserInk = createInkState(browserContent.world.story, 1);
    expect(browserInk).toBe(diskInk);
    for (const name of ["plan", "sue_joined", "forest_fizzy", "festival_toast_done"]) {
      expect(browserContent.world.storyVariable(browserInk, name)).toBe(
        diskContent.world.storyVariable(diskInk, name),
      );
    }
  });

  it("throws clear errors on HTTP failure or invalid story JSON", async () => {
    const missingFetcher: StoryFetcher = async () =>
      new Response("Not Found", { status: 404 });
    await expect(fetchStoryJson({ baseUrl: "./", fetcher: missingFetcher })).rejects.toThrow(
      /HTTP 404/,
    );

    const invalidFetcher: StoryFetcher = async () =>
      new Response(JSON.stringify({ nope: true }), { status: 200 });
    await expect(fetchStoryJson({ baseUrl: "./", fetcher: invalidFetcher })).rejects.toThrow(
      /invalid story\.inkVersion/,
    );
  });
});

describe("Track E0: Dist guard and retired story-content Vite chunk", () => {
  it("retires story-content from vite.config.ts and flags accidental story-content chunks", () => {
    expect(chunkGroups.some((group) => group.name === "story-content")).toBe(false);
    expect(
      bundledStoryChunks([
        { name: "index-abc123.js", bytes: 310_000 },
        { name: "area-content-def456.js", bytes: 240_000 },
        { name: "story-content-999999.js", bytes: 380_000 },
        { name: "assets/story-content-111111.js", bytes: 120_000 },
        { name: "story-content-ignored.css", bytes: 1000 },
      ]),
    ).toEqual(["story-content-999999.js", "assets/story-content-111111.js"]);
  });

  it("verifyRuntimeStoryAsset validates valid JSON and rejects missing/malformed files", () => {
    withTempDir((dir) => {
      expect(() => verifyRuntimeStoryAsset(dir)).toThrow(/missing/);

      const storyPath = join(dir, RUNTIME_STORY_ASSET);
      mkdirSync(join(dir, "assets", "story"), { recursive: true });
      writeFileSync(storyPath, "");
      expect(() => verifyRuntimeStoryAsset(dir)).toThrow(/empty/);

      writeFileSync(storyPath, "{not-json");
      expect(() => verifyRuntimeStoryAsset(dir)).toThrow(/invalid JSON/);

      writeFileSync(storyPath, JSON.stringify({ inkVersion: "bad", root: null }));
      expect(() => verifyRuntimeStoryAsset(dir)).toThrow(/not valid compiled Ink JSON/);

      writeFileSync(storyPath, readFileSync(STORY_OUTPUT, "utf8"));
      expect(() => verifyRuntimeStoryAsset(dir)).not.toThrow();
    });
  });

  it("verifyEntryStylesheets catches missing or incomplete linked UI CSS", () => {
    withTempDir((dir) => {
      expect(() => verifyEntryStylesheets(dir, "index.html")).toThrow(/entry HTML missing/);

      writeFileSync(join(dir, "index.html"), "<!doctype html><html><head></head></html>");
      expect(() => verifyEntryStylesheets(dir, "index.html")).toThrow(/links no stylesheets/);

      mkdirSync(join(dir, "assets"), { recursive: true });
      writeFileSync(
        join(dir, "index.html"),
        '<link rel="stylesheet" href="./assets/missing.css">',
      );
      expect(() => verifyEntryStylesheets(dir, "index.html")).toThrow(/linked stylesheet missing/);

      writeFileSync(join(dir, "assets", "partial.css"), ".sticker-dialogue{}");
      writeFileSync(
        join(dir, "index.html"),
        '<link rel="stylesheet" href="./assets/partial.css">',
      );
      expect(() => verifyEntryStylesheets(dir, "index.html")).toThrow(/missing required rule/);

      writeFileSync(
        join(dir, "assets", "full.css"),
        ".sticker-dialogue{}.sticker-speaker{}.touch-stick{}",
      );
      writeFileSync(
        join(dir, "index.html"),
        '<link rel="stylesheet" href="./assets/full.css">',
      );
      expect(() => verifyEntryStylesheets(dir, "index.html")).not.toThrow();
    });
  });
});
