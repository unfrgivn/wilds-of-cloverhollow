import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, type Battle, type State } from "../../src/core";
import { newCook } from "../../src/core/cook";
import {
  applyHomeRecord,
  HOME_RECORD_AREAS,
  isJukeboxTrack,
  jukeboxTracks,
  pickShuffleTrack,
  soundtrackFor,
  trackTitles,
  type JukeboxTrack,
  type SoundtrackState,
} from "../../src/core/music";
import {
  createHomeRecordController,
  HOME_RECORD_PREF_KEY,
  parseHomeRecord,
  serializeHomeRecord,
} from "../../src/platform/home-record-prefs";
import type { PreferenceAdapter } from "../../src/platform/preference-store";
import { resolveSoundtrack, stepJukeboxTrack } from "../../src/shell/feedback";

const content = loadContent();
const newGameFixture = content.fixtures["new-game"];
if (newGameFixture === undefined) throw new Error("Missing new-game fixture");
const baseState = createState(content.world, newGameFixture);

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

function makeMemoryAdapter(initial: Record<string, string> = {}): {
  adapter: PreferenceAdapter;
  stored: Map<string, string>;
} {
  const stored = new Map<string, string>(Object.entries(initial));
  const adapter: PreferenceAdapter = {
    get: async (key) => stored.get(key) ?? null,
    set: async (key, value) => {
      stored.set(key, value);
    },
  };
  return { adapter, stored };
}

describe("Milestone 227: Clubhouse & Bedroom Home Record Player + Soundtrack Album Shuffle", () => {
  it("validates HOME_RECORD_AREAS and isJukeboxTrack across all 35 tracks", () => {
    expect([...HOME_RECORD_AREAS].sort()).toEqual(["bedroom", "clubhouse"]);
    for (const track of jukeboxTracks) {
      expect(isJukeboxTrack(track), track).toBe(true);
    }
    for (const invalid of ["silent", "", "unknown", null, undefined, 42, {}, []]) {
      expect(isJukeboxTrack(invalid)).toBe(false);
    }
  });

  it("applies pinned Home Record in bedroom/clubhouse and yields to dramatic scores", () => {
    const bedroomBase: SoundtrackState = {
      track: "home",
      ambience: "none",
      duck: false,
      title: trackTitles.home,
    };
    const clubhouseBase: SoundtrackState = {
      track: "clubhouse",
      ambience: "none",
      duck: true,
      title: trackTitles.clubhouse,
    };
    const plazaBase: SoundtrackState = {
      track: "home",
      ambience: "town-breeze",
      duck: false,
      title: trackTitles.home,
    };

    // Null home record returns the exact base reference untouched.
    expect(applyHomeRecord({ ...baseState, area: "bedroom" }, bedroomBase, null)).toBe(bedroomBase);

    // Pinned track overrides bedroom & clubhouse while preserving ambience and duck.
    expect(applyHomeRecord({ ...baseState, area: "bedroom" }, bedroomBase, "festival")).toEqual({
      track: "festival",
      ambience: "none",
      duck: false,
      title: "Cloverhollow Jubilee",
    });
    expect(applyHomeRecord({ ...baseState, area: "clubhouse" }, clubhouseBase, "melody")).toEqual({
      track: "melody",
      ambience: "none",
      duck: true,
      title: "Ms. Willow's Recital",
    });

    // Non-home areas stay untouched.
    expect(applyHomeRecord({ ...baseState, area: "plaza" }, plazaBase, "festival")).toBe(plazaBase);
    expect(applyHomeRecord({ ...baseState, area: "bay" }, plazaBase, "festival")).toBe(plazaBase);

    // Ordinary dialogue in bedroom keeps Home Record; Heart-to-Heart yields cleanly.
    const normalTalk: State["dialogue"] = {
      knot: "club_poster",
      speaker: "Fae",
      text: "Cozy!",
      revealed: 5,
      choices: [],
      selected: 0,
      ended: false,
    };
    const h2hTalk: State["dialogue"] = {
      knot: "h2h_sue_bay",
      speaker: "Sue",
      text: "Hey Fae!",
      revealed: 8,
      choices: [],
      selected: 0,
      ended: false,
    };
    expect(
      applyHomeRecord({ ...baseState, area: "clubhouse", dialogue: normalTalk }, clubhouseBase,
        "festival"),
    ).toEqual({
      track: "festival",
      ambience: "none",
      duck: true,
      title: "Cloverhollow Jubilee",
    });
    expect(
      applyHomeRecord({ ...baseState, area: "clubhouse", dialogue: h2hTalk }, clubhouseBase,
        "festival"),
    ).toBe(clubhouseBase);

    // Battles, Clubhouse Microwave (arcade), and Waking-Up finale ALWAYS keep dramatic scores.
    const stubBattle: Battle = {
      critterId: "fountain-frog",
      den: null,
      entry: { x: 100, y: 100 },
      phase: "command",
      message: "",
      revealed: 0,
      selected: 0,
      command: null,
      energy: 5,
      calm: 0,
      rest: {},
      check: null,
      lastGrade: null,
      feelings: [],
      answered: false,
      lanternPeek: false,
      turn: 1,
      windUp: null,
      rewardSticker: null,
      phaseTicks: 0,
    };
    expect(
      applyHomeRecord({ ...baseState, area: "clubhouse", battle: stubBattle }, clubhouseBase,
        "festival"),
    ).toBe(clubhouseBase);

    expect(
      applyHomeRecord({ ...baseState, area: "clubhouse", arcade: newCook("nuggets") },
        clubhouseBase, "festival"),
    ).toBe(clubhouseBase);

    expect(
      applyHomeRecord({ ...baseState, area: "bedroom", finale: "morning" }, bedroomBase,
        "festival"),
    ).toBe(bedroomBase);
    expect(
      applyHomeRecord({ ...baseState, area: "bedroom", finale: "credits" }, bedroomBase,
        "festival"),
    ).toBe(bedroomBase);
  });

  it("integrates Home Record into resolveSoundtrack and stepJukeboxTrack without title leaks",
    () => {
    const bedroomState: State = { ...baseState, area: "bedroom" };
    const clubhouseState: State = { ...baseState, area: "clubhouse" };
    const plazaState: State = { ...baseState, area: "plaza" };

    expect(resolveSoundtrack(content.world, bedroomState, null, false, "festival").soundtrack)
      .toMatchObject({ track: "festival", title: "Cloverhollow Jubilee", duck: false });
    expect(resolveSoundtrack(content.world, clubhouseState, null, false, "festival").soundtrack)
      .toMatchObject({ track: "festival", title: "Cloverhollow Jubilee", duck: false });
    expect(resolveSoundtrack(content.world, plazaState, null, false, "festival").soundtrack)
      .toMatchObject({ track: "home", title: "Cloverhollow Town", ambience: "town-breeze" });

    // Title screen always keeps Watercolor Morning even when state.area is bedroom.
    expect(resolveSoundtrack(content.world, bedroomState, null, true, "festival").soundtrack)
      .toMatchObject({ track: "title", title: "Watercolor Morning" });

    // Explicit Jukebox preview takes precedence over Home Record and plays unducked.
    expect(
      resolveSoundtrack(content.world, { ...clubhouseState, journalOpen: true }, "encore", false,
        "festival").soundtrack,
    ).toMatchObject({ track: "encore", title: "Starlight Encore!", duck: false });

    // Stepping Music Box in clubhouse starts from the active Home Record.
    const nextFromFestival = stepJukeboxTrack(
      content.world, clubhouseState, null, 1, false, "festival",
    );
    const festIdx = jukeboxTracks.indexOf("festival");
    expect(nextFromFestival).toBe(jukeboxTracks[(festIdx + 1) % jukeboxTracks.length]);

    // Pure soundtrackFor remains unchanged when homeRecord is not applied.
    expect(soundtrackFor(content.world, bedroomState, { titleOpen: false }).track).toBe("home");
  });

  it("picks shuffle tracks deterministically without repeating current and handles edge cases",
    () => {
    expect(pickShuffleTrack([], null, 0)).toBeNull();
    expect(pickShuffleTrack([], "home", 7)).toBeNull();
    expect(pickShuffleTrack(["festival"], null, 0)).toBe("festival");
    expect(pickShuffleTrack(["festival"], "festival", 42)).toBe("festival");

    const pool: readonly JukeboxTrack[] = ["festival", "arcade", "taco", "enchanted-calm"];
    for (let seed = -5; seed < 40; seed += 1) {
      const a = pickShuffleTrack(pool, "festival", seed);
      const b = pickShuffleTrack(pool, "festival", seed);
      expect(a).toBe(b);
      expect(a).not.toBeNull();
      expect(a).not.toBe("festival");
      expect(pool).toContain(a);
    }

    // Consecutive seeds across all 35 tracks produce varied picks and never repeat current.
    let current: JukeboxTrack | null = "clubhouse";
    const visited = new Set<JukeboxTrack>();
    for (let step = 0; step < 12; step += 1) {
      const next = pickShuffleTrack(jukeboxTracks, current, step);
      expect(next).not.toBeNull();
      expect(next).not.toBe(current);
      if (next !== null) {
        visited.add(next);
        current = next;
      }
    }
    expect(visited.size).toBeGreaterThanOrEqual(6);

    const musicSrc = readFileSync("src/core/music.ts", "utf8");
    expect(musicSrc).not.toContain("Math.random");
  });

  it("persists, validates, and notifies Home Record preferences resiliently", async () => {
    expect(HOME_RECORD_PREF_KEY).toBe("cloverhollow-home-record");
    expect(parseHomeRecord(null)).toBeNull();
    expect(parseHomeRecord("")).toBeNull();
    expect(parseHomeRecord("null")).toBeNull();
    expect(parseHomeRecord("{broken json")).toBeNull();
    expect(parseHomeRecord('{"track":"silent"}')).toBeNull();
    expect(parseHomeRecord('{"track":"not-a-track"}')).toBeNull();
    expect(parseHomeRecord('{"track":123}')).toBeNull();
    expect(parseHomeRecord("silent")).toBeNull();
    expect(parseHomeRecord("festival")).toBe("festival");
    expect(parseHomeRecord('"melody"')).toBe("melody");
    expect(parseHomeRecord(serializeHomeRecord("canvas"))).toBe("canvas");
    expect(parseHomeRecord(serializeHomeRecord(null))).toBeNull();

    const { adapter, stored } = makeMemoryAdapter();
    const first = createHomeRecordController(adapter);
    await first.ready;
    expect(first.get()).toBeNull();

    const events: Array<[JukeboxTrack | null, boolean]> = [];
    const unsubscribe = first.subscribe((track, fromUser) => {
      events.push([track, fromUser]);
    });

    first.set("festival");
    expect(first.get()).toBe("festival");
    expect(events).toEqual([["festival", true]]);

    unsubscribe();
    first.set("melody");
    expect(events).toHaveLength(1);
    expect(first.get()).toBe("melody");

    // Allow queued writes to flush, then reload in a fresh controller instance.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stored.get(HOME_RECORD_PREF_KEY)).toBe('{"track":"melody"}');

    const reloaded = createHomeRecordController(adapter);
    const loadEvents: Array<[JukeboxTrack | null, boolean]> = [];
    reloaded.subscribe((track, fromUser) => {
      loadEvents.push([track, fromUser]);
    });
    await reloaded.ready;
    expect(reloaded.get()).toBe("melody");
    expect(loadEvents).toEqual([["melody", false]]);

    // Corrupted persisted value falls back safely to null.
    const corrupt = createHomeRecordController(
      makeMemoryAdapter({ [HOME_RECORD_PREF_KEY]: "{not-valid-json" }).adapter,
    );
    await corrupt.ready;
    expect(corrupt.get()).toBeNull();

    // Unpinning persists null cleanly.
    reloaded.set(null);
    expect(reloaded.get()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stored.get(HOME_RECORD_PREF_KEY)).toBe('{"track":null}');
  });

  it("enforces strict < 900 line budgets across all touched src/ files", () => {
    const caps: readonly [string, number][] = [
      ["src/core/music.ts", 520],
      ["src/platform/home-record-prefs.ts", 100],
      ["src/ui/journal-jukebox.ts", 360],
      ["src/ui/journal-jukebox.css", 480],
      ["src/shell/feedback.ts", 900],
      ["src/shell/shell-bindings.ts", 900],
      ["src/main.ts", 885],
    ];
    for (const [file, cap] of caps) {
      const lines = lineCount(file);
      expect(lines, `${file} (${lines} lines) must stay < ${cap}`).toBeLessThan(cap);
    }
  });
});
