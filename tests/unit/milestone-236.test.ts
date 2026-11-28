import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addPostcardEntry,
  createPostcardAlbumController,
  createPostcardId,
  parsePostcardAlbum,
  POSTCARD_ALBUM_KEY,
  POSTCARD_ALBUM_LIMIT,
  removePostcardEntry,
  type PostcardAlbumStorage,
  type SavedPostcard,
} from "../../src/platform/postcard-album";
import {
  EMPTY_ALBUM_MARKUP,
  HEADER_POSTCARD_ALBUM_MARKUP,
} from "../../src/ui/journal-postcards";

const SAMPLE_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";
const SAMPLE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

function makeCard(index: number, dataUrl = SAMPLE_JPEG): SavedPostcard {
  return {
    id: `card-${index}`,
    filename: `cloverhollow-postcard-area-${index}.png`,
    caption: `Area ${index} · Wilds of Cloverhollow`,
    subcaption: `Cloverhollow · with Maddie`,
    weather: index % 2 === 0 ? "sunshower" : "clear",
    dataUrl,
  };
}

function makeMemoryStorage(maxChars?: number): PostcardAlbumStorage & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (maxChars !== undefined && value.length > maxChars) {
        const err = new Error("Storage quota exceeded");
        err.name = "QuotaExceededError";
        throw err;
      }
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("Milestone 234: Postcard Scrapbook Album Store & Journal Postcard Modal", () => {
  it("parses valid entries, rejects malformed items & bad data URLs, and clamps to limit", () => {
    expect(parsePostcardAlbum(null)).toEqual([]);
    expect(parsePostcardAlbum("")).toEqual([]);
    expect(parsePostcardAlbum("{not-json")).toEqual([]);
    expect(parsePostcardAlbum('{"not":"array"}')).toEqual([]);

    const mixed = [
      makeCard(1, SAMPLE_JPEG),
      makeCard(2, SAMPLE_PNG),
      { ...makeCard(3), dataUrl: "https://example.com/evil.png" },
      { ...makeCard(4), dataUrl: "data:image/svg+xml;base64,AAAA" },
      { ...makeCard(5), id: "   " },
      { ...makeCard(6), caption: "" },
      { ...makeCard(7), weather: "hurricane" },
      makeCard(1, SAMPLE_PNG), // duplicate id ignored
      makeCard(8),
      makeCard(9),
      makeCard(10),
      makeCard(11),
      makeCard(12),
    ];
    const parsed = parsePostcardAlbum(JSON.stringify(mixed));
    expect(parsed).toHaveLength(POSTCARD_ALBUM_LIMIT);
    expect(parsed.map((item) => item.id)).toEqual([
      "card-1", "card-2", "card-8", "card-9", "card-10", "card-11",
    ]);
    expect(parsed[0]?.dataUrl).toBe(SAMPLE_JPEG);
  });

  it("prepends newest entries with FIFO eviction at 6, dedupes by id, and removes cleanly", () => {
    let album: SavedPostcard[] = [];
    for (let i = 1; i <= 8; i += 1) {
      album = addPostcardEntry(album, makeCard(i));
    }
    expect(album).toHaveLength(POSTCARD_ALBUM_LIMIT);
    expect(album.map((item) => item.id)).toEqual([
      "card-8", "card-7", "card-6", "card-5", "card-4", "card-3",
    ]);

    const promoted = addPostcardEntry(album, { ...makeCard(5), caption: "Updated Area 5" });
    expect(promoted).toHaveLength(POSTCARD_ALBUM_LIMIT);
    expect(promoted[0]?.id).toBe("card-5");
    expect(promoted[0]?.caption).toBe("Updated Area 5");

    const trimmed = removePostcardEntry(promoted, "card-7");
    expect(trimmed.map((item) => item.id)).toEqual([
      "card-5", "card-8", "card-6", "card-4", "card-3",
    ]);
  });

  it("evicts oldest entries gracefully on QuotaExceededError and notifies live subscribers", () => {
    const cardA = makeCard(1);
    const cardB = makeCard(2);
    const cardC = makeCard(3);
    // Allow room for 2 cards in JSON, but trigger QuotaExceededError on 3 cards.
    const twoCardBudget = JSON.stringify([cardC, cardB]).length + 12;
    const storage = makeMemoryStorage(twoCardBudget);
    const controller = createPostcardAlbumController(storage);

    const observedCounts: number[] = [];
    const unsubscribe = controller.subscribe((entries) => {
      observedCounts.push(entries.length);
    });

    controller.save(cardA);
    controller.save(cardB);
    expect(controller.list().map((item) => item.id)).toEqual(["card-2", "card-1"]);

    // Saving a 3rd card hits QuotaExceededError and evicts the oldest (card-1) cleanly.
    const afterQuota = controller.save(cardC);
    expect(afterQuota.map((item) => item.id)).toEqual(["card-3", "card-2"]);
    expect(controller.list().map((item) => item.id)).toEqual(["card-3", "card-2"]);
    expect(storage.data.has(POSTCARD_ALBUM_KEY)).toBe(true);

    const afterRemove = controller.remove("card-3");
    expect(afterRemove.map((item) => item.id)).toEqual(["card-2"]);

    controller.clear();
    expect(controller.list()).toEqual([]);
    expect(storage.data.has(POSTCARD_ALBUM_KEY)).toBe(false);

    unsubscribe();
    controller.save(cardA);
    expect(observedCounts).toEqual([1, 2, 2, 1, 0]);
  });

  it("generates monotonic unique ids even for rapid consecutive snaps in the same area", () => {
    const first = createPostcardId("plaza");
    const second = createPostcardId("plaza");
    expect(first).not.toBe(second);
    expect(first.startsWith("plaza-")).toBe(true);
  });

  it("keeps journal-postcards SVG emblems free of <text> nodes and honors file size caps", () => {
    const postcardsSource = readFileSync("src/ui/journal-postcards.ts", "utf8");
    expect(HEADER_POSTCARD_ALBUM_MARKUP).not.toMatch(/<text\b/i);
    expect(EMPTY_ALBUM_MARKUP).not.toMatch(/<text\b/i);
    expect(postcardsSource).not.toMatch(/<text\b/i);

    const caps: readonly (readonly [string, number])[] = [
      ["src/platform/postcard-album.ts", 180],
      ["src/ui/journal-postcards.ts", 320],
      ["src/ui/journal-postcards.css", 430],
      ["src/ui/journal-field-note.ts", 700],
      ["src/main.ts", 885],
      ["src/ui/credits.ts", 900],
      ["src/ui/postcard-canvas.ts", 900],
      ["src/ui/postcard.ts", 900],
      ["src/shell/overworld-feedback.ts", 900],
      ["src/shell/shell-bindings.ts", 900],
    ];
    for (const [path, maxLines] of caps) {
      const lines = readFileSync(path, "utf8").split("\n").length;
      expect(lines, `${path} line count`).toBeLessThan(maxLines);
    }
  });
});
