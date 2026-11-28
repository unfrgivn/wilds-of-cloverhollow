import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, setInkVariables } from "../../src/core";
import { loadContent } from "../../src/content/load";
import {
  computeAreaEvictions,
  computeNpcChatterScreenAnchor,
  computeNoticeMarkViews,
  computePromptScreenView,
  computeStoryAtmosphereOptions,
  computeViewportRect,
} from "../../src/render/view-projections";

describe("Milestone 167: Pixi-free view-projections extraction & line budget", () => {
  const { world, fixtures } = loadContent();

  it("keeps src/render/view.ts cleanly under 760 lines and view-projections.ts Pixi-free", () => {
    const viewSrc = fs.readFileSync("src/render/view.ts", "utf8");
    const projSrc = fs.readFileSync("src/render/view-projections.ts", "utf8");
    expect(viewSrc.split("\n").length).toBeLessThan(760);
    expect(projSrc.split("\n").length).toBeLessThan(520);
    expect(projSrc).not.toContain("pixi.js");
  });

  it("evaluates story-reactive atmosphere flags incl. sanctuaryFestival & reducedMotion", () => {
    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("missing plaza fixture");
    const base = createState(world, plaza);
    expect(computeStoryAtmosphereOptions(world, base, "sanctuary", false)).toBeUndefined();

    const festivalState = {
      ...base,
      ink: setInkVariables(base.ink, {
        milo_revealed: true,
        buster_reward: true,
      }),
    };
    expect(computeStoryAtmosphereOptions(world, festivalState, "sanctuary", false)).toEqual({
      sanctuaryFestival: true,
    });
    expect(computeStoryAtmosphereOptions(world, festivalState, "plaza", true)).toEqual({
      plazaStarGlow: true,
      reducedMotion: true,
    });
  });

  it("projects viewport, evictions, prompts, chatter anchors, and notice marks", () => {
    const rect = computeViewportRect(1280, 720, 1280, 720);
    expect(rect).toEqual({ x: 0, y: 0, width: 1280, height: 720 });

    const evictions = computeAreaEvictions({
      residentUrls: ["a.webp", "b.webp", "c.webp"],
      previousUrls: ["a.webp"],
      nextUrls: ["b.webp"],
      residentEntityAliases: ["fae", "npc-old", "npc-new"],
      previousEntities: [],
      nextEntities: ["npc-new"],
      permanentAliases: new Set(["fae"]),
    });
    expect(evictions).toEqual({
      evictedUrls: ["c.webp"],
      unloadKeys: ["c.webp", "npc-old"],
    });

    const plaza = fixtures.plaza;
    if (plaza === undefined) throw new Error("missing plaza fixture");
    const base = createState(world, plaza);
    expect(
      computePromptScreenView(world, base, undefined, 1280, 720, 1280, 720).visible,
    ).toBe(false);
    expect(
      computeNoticeMarkViews(world, base, undefined, 1280, 720, 1280, 720),
    ).toEqual([]);

    const bubble = {
      npcId: "flora",
      speakerName: "Flora",
      text: "Morning, Fae!",
      tone: "warm" as const,
      adult: true,
      emote: null,
      progress: 0.5,
      x: 475,
      y: 410,
      alpha: 1,
    };
    const chatter = computeNpcChatterScreenAnchor(
      world,
      base,
      bubble,
      null,
      { x: 0, y: 0 },
      1280,
      720,
      1280,
      720,
    );
    expect(chatter).toEqual({
      visible: true,
      npcId: "flora",
      speakerName: "Flora",
      text: "Morning, Fae!",
      tone: "warm",
      x: 475,
      y: 220,
      alpha: 1,
    });

    const suppressed = computeNpcChatterScreenAnchor(
      world,
      { ...base, journalOpen: true },
      bubble,
      null,
      { x: 0, y: 0 },
      1280,
      720,
      1280,
      720,
    );
    expect(suppressed).toBeNull();
  });
});
