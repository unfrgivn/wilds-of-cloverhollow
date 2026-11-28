import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, pointInPolygon, type State } from "../../src/core";
import { recordEncoreVictory, type EncoreRecord } from "../../src/core/encore";
import { setInkVariables } from "../../src/core/ink";
import {
  createPostcardAlbumController,
  PINNED_POSTCARD_KEY,
  type PostcardAlbumStorage,
  type SavedPostcard,
} from "../../src/platform/postcard-album";
import {
  ENCORE_TROPHY_PERCH,
  evaluateClubhouseDisplay,
  evaluateRoomPostcardPerch,
  ROOM_POSTCARD_PERCHES,
} from "../../src/render/clubhouse-display";

const { world, fixtures } = loadContent();
const SAMPLE_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";

function makeCard(index: number): SavedPostcard {
  return {
    id: `card-${index}`,
    filename: `cloverhollow-postcard-${index}.png`,
    caption: `Area ${index} · Wilds of Cloverhollow`,
    subcaption: "Cloverhollow · with Maddie",
    weather: "clear",
    dataUrl: SAMPLE_JPEG,
  };
}

function makeMemoryStorage(): PostcardAlbumStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

function fullClubhouseState(): State {
  const fixture = fixtures.clubhouse;
  if (fixture === undefined) throw new Error("Missing clubhouse fixture");
  const base = createState(world, fixture, 1);
  const ink = setInkVariables(base.ink, {
    clubhouse_claimed: true, cavern_chime_rung: true, spice_returned: true,
    gem_reward_all: true, sanctuary_reward_14: true, sue_compass: true,
    jordan_clover: true, buster_reward: true, milo_loft_visited: true,
    rosie_cottage_visited: true, summit_aurora_read: true,
    island_shells_solved: true, festival_toast_done: true, milo_revealed: true,
  });
  let encore: EncoreRecord | undefined;
  for (const boss of world.encore?.bosses ?? []) {
    encore = recordEncoreVictory(encore, boss, ["brisk-breeze", "windup-surge", "pure-heart"]);
  }
  return {
    ...base,
    area: "clubhouse",
    ink,
    prizes: world.arcade.prizes.map((entry) => entry.id),
    stickers: ["starry-owl", "taco-chef"],
    encore,
  };
}

describe("Milestone 237: Pinned Wall Memory Postcards in Bedroom & Clubhouse", () => {
  it("persists pinned postcard id, rejects unknown ids, clears on remove/clear", () => {
    const storage = makeMemoryStorage();
    const ctrl = createPostcardAlbumController(storage);
    const notifications: number[] = [];
    const unsubscribe = ctrl.subscribe((list) => notifications.push(list.length));

    expect(PINNED_POSTCARD_KEY).toBe("cloverhollow-pinned-postcard");
    expect(ctrl.pinnedId()).toBeNull();
    expect(ctrl.pinnedPostcard()).toBeNull();

    // Rejects invalid ids when album is empty without notifying or persisting.
    expect(ctrl.setPinnedId("nonexistent")).toBeNull();
    expect(storage.data.has(PINNED_POSTCARD_KEY)).toBe(false);
    expect(notifications).toEqual([]);

    const card1 = makeCard(1);
    const card2 = makeCard(2);
    ctrl.save(card1);
    ctrl.save(card2);

    // Pin card1 and verify storage + subscriber notification.
    expect(ctrl.setPinnedId("card-1")).toBe("card-1");
    expect(storage.data.get(PINNED_POSTCARD_KEY)).toBe("card-1");
    expect(ctrl.pinnedId()).toBe("card-1");
    expect(ctrl.pinnedPostcard()?.id).toBe("card-1");
    expect(notifications).toEqual([1, 2, 2]);

    // Rejects invalid/blank ids while preserving the existing valid pin.
    expect(ctrl.setPinnedId("missing-id")).toBe("card-1");
    expect(ctrl.setPinnedId("   ")).toBe("card-1");
    expect(storage.data.get(PINNED_POSTCARD_KEY)).toBe("card-1");

    // Removing a different card leaves the pinned card intact.
    ctrl.remove("card-2");
    expect(ctrl.pinnedId()).toBe("card-1");
    expect(storage.data.get(PINNED_POSTCARD_KEY)).toBe("card-1");

    // Removing the pinned card automatically clears PINNED_POSTCARD_KEY.
    ctrl.remove("card-1");
    expect(ctrl.pinnedId()).toBeNull();
    expect(ctrl.pinnedPostcard()).toBeNull();
    expect(storage.data.has(PINNED_POSTCARD_KEY)).toBe(false);

    // Pinning then unpinning (null) and clearing both remove PINNED_POSTCARD_KEY cleanly.
    ctrl.save(card1);
    ctrl.setPinnedId("card-1");
    expect(ctrl.setPinnedId(null)).toBeNull();
    expect(storage.data.has(PINNED_POSTCARD_KEY)).toBe(false);

    ctrl.setPinnedId("card-1");
    expect(storage.data.get(PINNED_POSTCARD_KEY)).toBe("card-1");
    ctrl.clear();
    expect(ctrl.pinnedId()).toBeNull();
    expect(storage.data.has(PINNED_POSTCARD_KEY)).toBe(false);

    unsubscribe();
  });

  it("places ROOM_POSTCARD_PERCHES cleanly in bedroom & clubhouse clear of all 27 items", () => {
    const bedroom = world.areas.bedroom;
    const clubhouse = world.areas.clubhouse;
    if (bedroom === undefined || clubhouse === undefined) {
      throw new Error("Missing bedroom or clubhouse area");
    }

    const bedPerch = ROOM_POSTCARD_PERCHES.bedroom;
    expect(bedPerch.area).toBe("bedroom");
    expect(pointInPolygon({ x: bedPerch.x, y: bedPerch.y }, bedroom.walkable)).toBe(false);
    expect(bedPerch.x - bedPerch.width / 2).toBeGreaterThan(20);
    expect(bedPerch.x + bedPerch.width / 2).toBeLessThan(bedroom.width - 20);
    expect(bedPerch.y - bedPerch.height / 2).toBeGreaterThan(20);
    expect(bedPerch.y + bedPerch.height / 2).toBeLessThan(bedroom.height - 20);
    for (const anchor of bedroom.shelfAnchors ?? []) {
      expect(Math.hypot(bedPerch.x - anchor.x, bedPerch.y - anchor.y)).toBeGreaterThanOrEqual(50);
    }

    const clubPerch = ROOM_POSTCARD_PERCHES.clubhouse;
    expect(clubPerch.area).toBe("clubhouse");
    expect(pointInPolygon({ x: clubPerch.x, y: clubPerch.y }, clubhouse.walkable)).toBe(false);
    expect(clubPerch.x - clubPerch.width / 2).toBeGreaterThan(20);
    expect(clubPerch.x + clubPerch.width / 2).toBeLessThan(clubhouse.width - 20);
    expect(clubPerch.y - clubPerch.height / 2).toBeGreaterThan(20);
    expect(clubPerch.y + clubPerch.height / 2).toBeLessThan(clubhouse.height - 20);

    const fullDisplay = evaluateClubhouseDisplay(world, fullClubhouseState());
    expect(fullDisplay.prizes).toHaveLength(13);
    expect(fullDisplay.keepsakes).toHaveLength(13);
    expect(fullDisplay.encoreTrophy).not.toBeNull();

    for (const prize of fullDisplay.prizes) {
      const dist = Math.hypot(clubPerch.x - prize.x, clubPerch.y - prize.y);
      expect(dist, `clearance to prize ${prize.id}`).toBeGreaterThanOrEqual(50);
    }
    for (const keepsake of fullDisplay.keepsakes) {
      const dist = Math.hypot(clubPerch.x - keepsake.x, clubPerch.y - keepsake.y);
      expect(dist, `clearance to keepsake ${keepsake.id}`).toBeGreaterThanOrEqual(50);
    }
    const trophyDist = Math.hypot(
      clubPerch.x - ENCORE_TROPHY_PERCH.x,
      clubPerch.y - ENCORE_TROPHY_PERCH.y,
    );
    expect(trophyDist, "clearance to Encore Star Trophy").toBeGreaterThanOrEqual(50);
  });

  it("evaluates perch as null when unpinned/outside and flattens rotation in reducedMotion", () => {
    const sample = { id: "card-1", caption: "Bubblegum Bay", dataUrl: SAMPLE_JPEG };
    expect(evaluateRoomPostcardPerch("bedroom", null, false)).toBeNull();
    expect(evaluateRoomPostcardPerch("clubhouse", null, false)).toBeNull();
    expect(evaluateRoomPostcardPerch("plaza", sample, false)).toBeNull();
    expect(evaluateRoomPostcardPerch("bay", sample, false)).toBeNull();

    const bedNormal = evaluateRoomPostcardPerch("bedroom", sample, false);
    const bedReduced = evaluateRoomPostcardPerch("bedroom", sample, true);
    expect(bedNormal?.area).toBe("bedroom");
    expect(bedNormal?.rotation).not.toBe(0);
    expect(bedReduced?.rotation).toBe(0);

    const clubNormal = evaluateRoomPostcardPerch("clubhouse", sample, false);
    const clubReduced = evaluateRoomPostcardPerch("clubhouse", sample, true);
    expect(clubNormal?.area).toBe("clubhouse");
    expect(clubNormal?.rotation).not.toBe(0);
    expect(clubReduced?.rotation).toBe(0);
  });

  it("keeps clubhouse-display Pixi-free and enforces strict file size caps", () => {
    expect(readFileSync("src/render/clubhouse-display.ts", "utf8")).not.toContain("pixi.js");
    const caps: readonly (readonly [string, number])[] = [
      ["src/platform/postcard-album.ts", 180],
      ["src/render/clubhouse-display.ts", 420],
      ["src/render/clubhouse-postcard-render.ts", 180],
      ["src/render/clubhouse-display-render.ts", 365],
      ["src/render/overworld-effects.ts", 690],
      ["src/render/view-projections.ts", 520],
      ["src/render/view.ts", 700],
      ["src/dev/hook.ts", 500],
      ["src/ui/journal-postcards.ts", 380],
      ["src/ui/journal-postcards.css", 430],
      ["src/ui/journal-field-note.ts", 700],
      ["src/main.ts", 885],
    ];
    for (const [path, maxLines] of caps) {
      const lines = readFileSync(path, "utf8").split("\n").length;
      expect(lines, `${path} line count`).toBeLessThan(maxLines);
    }
  });
});
