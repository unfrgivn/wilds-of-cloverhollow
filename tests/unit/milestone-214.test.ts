import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  JUKEBOX_ALBUM,
  jukeboxTracks,
  trackAlbumEntry,
  trackTitles,
  type JukeboxTrack,
  type TrackCategory,
} from "../../src/core/music";
import {
  HEADER_MUSIC_BOX_MARKUP,
  MUSIC_NOTE_MARKUP,
} from "../../src/ui/journal-jukebox";
import { bindOptionsCallbacks, defaultOptionsCallbacks } from "../../src/ui/journal-options";

const VALID_CATEGORIES: readonly TrackCategory[] = [
  "town",
  "interiors",
  "wilds",
  "festive",
  "story",
];

describe("Milestone 213: 33-Track Soundtrack Album & Direct Music Box Jukebox Player", () => {
  it("keeps JUKEBOX_ALBUM in exact 33-track parity with jukeboxTracks and trackTitles", () => {
    expect(JUKEBOX_ALBUM).toHaveLength(33);
    expect(JUKEBOX_ALBUM.map((entry) => entry.track)).toEqual([...jukeboxTracks]);

    const seenNumbers = new Set<number>();
    for (let index = 0; index < JUKEBOX_ALBUM.length; index += 1) {
      const entry = JUKEBOX_ALBUM[index];
      if (entry === undefined) throw new Error(`Missing album entry at ${index}`);
      expect(entry.number).toBe(index + 1);
      expect(seenNumbers.has(entry.number)).toBe(false);
      seenNumbers.add(entry.number);

      expect(entry.title).toBe(trackTitles[entry.track]);
      expect(VALID_CATEGORIES).toContain(entry.category);
      expect(entry.region.trim().length).toBeGreaterThan(0);
      expect(entry.mood.trim().length).toBeGreaterThan(0);
      expect(entry.accent).toMatch(/^#[0-9a-f]{6}$/i);

      expect(trackAlbumEntry(entry.track)).toEqual(entry);
    }
  });

  it("partitions all 33 tracks across 5 non-empty categories with expected flagship tracks", () => {
    const counts: Record<TrackCategory, number> = {
      town: 0,
      interiors: 0,
      wilds: 0,
      festive: 0,
      story: 0,
    };
    for (const entry of JUKEBOX_ALBUM) {
      counts[entry.category] += 1;
    }
    let total = 0;
    for (const category of VALID_CATEGORIES) {
      expect(counts[category], `category ${category} non-empty`).toBeGreaterThan(0);
      total += counts[category];
    }
    expect(total).toBe(33);

    expect(trackAlbumEntry("festival")).toMatchObject({
      track: "festival",
      title: "Cloverhollow Jubilee",
      category: "festive",
    });
    expect(trackAlbumEntry("encore")).toMatchObject({
      track: "encore",
      title: "Starlight Encore!",
      category: "story",
    });
  });

  it("wires onSelectJukeboxTrack through defaultOptionsCallbacks and bindOptionsCallbacks", () => {
    const callbacks = defaultOptionsCallbacks();
    const handlers = bindOptionsCallbacks(callbacks);
    const picked: JukeboxTrack[] = [];
    handlers.onSelectJukeboxTrack((track) => { picked.push(track); });
    callbacks.onSelectJukeboxTrack("festival");
    callbacks.onSelectJukeboxTrack("encore");
    expect(picked).toEqual(["festival", "encore"]);
  });

  it("enforces zero SVG text nodes in journal-jukebox.ts and strict file line caps", () => {
    expect(HEADER_MUSIC_BOX_MARKUP).not.toMatch(/<text\b/i);
    expect(MUSIC_NOTE_MARKUP).not.toMatch(/<text\b/i);

    const jukeboxTs = readFileSync("src/ui/journal-jukebox.ts", "utf8");
    expect(jukeboxTs).not.toMatch(/<text\b/i);

    const caps: readonly [string, number][] = [
      ["src/core/music.ts", 520],
      ["src/ui/journal-jukebox.ts", 290],
      ["src/ui/journal-jukebox.css", 430],
      ["src/ui/journal-field-note.ts", 700],
      ["src/ui/journal-field-note-data.ts", 1000],
      ["src/ui/journal-options.ts", 1000],
      ["src/ui/journal.ts", 680],
      ["src/shell/shell-bindings.ts", 1000],
      ["src/main.ts", 900],
    ];
    for (const [file, cap] of caps) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
    }
  });
});
