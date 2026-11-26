import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { evaluateOverworldEmotes } from "../../src/render/emotes";
import { transitionZoom } from "../../src/render/fade";
import { companionIdlePose, idleBreathing } from "../../src/render/motion";
import { areaBannerEnvelope, areaBannerInfo } from "../../src/ui/area-banner";

const { world } = loadContent();

describe("Milestone 85: areaBannerInfo & areaBannerEnvelope", () => {
  it("returns null for harness and unknown areas, and deduplicates matching land names", () => {
    expect(areaBannerInfo(world, "harness")).toBeNull();
    expect(areaBannerInfo(world, "does-not-exist")).toBeNull();
    expect(areaBannerInfo(world, "enchanted")).toEqual({
      title: "The Enchanted Forest",
      region: null,
    });
    expect(areaBannerInfo(world, "bay")).toEqual({
      title: "Bubblegum Bay",
      region: null,
    });
    expect(areaBannerInfo(world, "pass")).toEqual({
      title: "Pinecone Pass",
      region: null,
    });
  });

  it("formats distinct room titles with their land region eyebrow", () => {
    expect(areaBannerInfo(world, "cafe")).toEqual({
      title: "Bon Appetit Café",
      region: "Cloverhollow",
    });
    expect(areaBannerInfo(world, "cavern")).toEqual({
      title: "Crystal Cavern",
      region: "Pinecone Pass",
    });
    expect(areaBannerInfo(world, "kitchen")).toEqual({
      title: "Kitchen",
      region: "Cloverhollow",
    });
  });

  it("eases banner opacity and vertical slide across fade-in, hold, and fade-out", () => {
    const start = areaBannerEnvelope(0);
    const rising = areaBannerEnvelope(0.07);
    const held = areaBannerEnvelope(0.5);
    const fading = areaBannerEnvelope(0.91);
    const done = areaBannerEnvelope(1);

    expect(start.opacity).toBe(0);
    expect(start.offsetY).toBeLessThan(0);
    expect(rising.opacity).toBeGreaterThan(0);
    expect(rising.opacity).toBeLessThan(1);
    expect(held).toEqual({ opacity: 1, offsetY: 0 });
    expect(fading.opacity).toBeGreaterThan(0);
    expect(fading.opacity).toBeLessThan(1);
    expect(fading.offsetY).toBeLessThan(0);
    expect(done.opacity).toBe(0);
  });
});

describe("Milestone 85: evaluateOverworldEmotes", () => {
  const baseInput = {
    areaId: "park",
    tick: 45,
    player: { x: 500, y: 500 },
    dialogueOpen: false,
    roamers: [],
    calmedCritters: [],
    nappingMembers: [],
    recentTalk: null,
  };

  it("returns empty on harness or while dialogue is open", () => {
    const busy = {
      ...baseInput,
      roamers: [
        { x: 520, y: 500, height: 80, notice: 10, noticeTicks: 24, chasing: false },
      ],
      calmedCritters: [{ x: 510, y: 510, height: 80, index: 0 }],
      nappingMembers: [{ x: 460, y: 500, height: 60, stillTicks: 300, index: 0 }],
      recentTalk: { x: 540, y: 500, height: 110, elapsed: 5 },
    };
    expect(evaluateOverworldEmotes({ ...busy, areaId: "harness" })).toEqual([]);
    expect(evaluateOverworldEmotes({ ...busy, dialogueOpen: true })).toEqual([]);
  });

  it("emits emoteQuestion while noticing and emoteExclaim on startle chase", () => {
    const noticing = evaluateOverworldEmotes({
      ...baseInput,
      roamers: [
        { x: 600, y: 520, height: 80, notice: 12, noticeTicks: 24, chasing: false },
      ],
    });
    expect(noticing).toHaveLength(1);
    expect(noticing[0]?.texture).toBe("emoteQuestion");
    expect(noticing[0]?.y).toBeLessThan(520 - 80);

    const startleStart = evaluateOverworldEmotes({
      ...baseInput,
      roamers: [
        { x: 600, y: 520, height: 80, notice: 24, noticeTicks: 24, chasing: true },
      ],
    });
    const startlePeak = evaluateOverworldEmotes({
      ...baseInput,
      roamers: [
        { x: 600, y: 520, height: 80, notice: 29, noticeTicks: 24, chasing: true },
      ],
    });
    const startleHold = evaluateOverworldEmotes({
      ...baseInput,
      roamers: [
        { x: 600, y: 520, height: 80, notice: 38, noticeTicks: 24, chasing: true },
      ],
    });
    const startleDone = evaluateOverworldEmotes({
      ...baseInput,
      roamers: [
        { x: 600, y: 520, height: 80, notice: 54, noticeTicks: 24, chasing: true },
      ],
    });
    expect(startleStart[0]?.texture).toBe("emoteExclaim");
    expect(startleStart[0]?.scale).toBeCloseTo(0.5, 2);
    expect(startlePeak[0]?.scale).toBeCloseTo(1.12, 2);
    expect(startleHold[0]?.scale).toBeCloseTo(0.95, 2);
    expect(startleDone).toEqual([]);
  });

  it("emits emoteNote near calmed critters and omits far ones", () => {
    const result = evaluateOverworldEmotes({
      ...baseInput,
      calmedCritters: [
        { x: 600, y: 500, height: 70, index: 0 },
        { x: 800, y: 500, height: 70, index: 1 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.texture).toBe("emoteNote");
    expect(result[0]?.alpha).toBeGreaterThan(0.5);
  });

  it("emits emoteZzz for napping Maddie at >= 240 ticks and emoteHeart after talking", () => {
    const awake = evaluateOverworldEmotes({
      ...baseInput,
      nappingMembers: [{ x: 460, y: 500, height: 60, stillTicks: 239, index: 0 }],
    });
    expect(awake).toEqual([]);

    const napping = evaluateOverworldEmotes({
      ...baseInput,
      nappingMembers: [{ x: 460, y: 500, height: 60, stillTicks: 240, index: 0 }],
    });
    expect(napping).toHaveLength(1);
    expect(napping[0]?.texture).toBe("emoteZzz");
    expect(napping[0]?.alpha).toBeGreaterThan(0.5);

    const heartEarly = evaluateOverworldEmotes({
      ...baseInput,
      recentTalk: { x: 560, y: 500, height: 110, elapsed: 4 },
    });
    const heartLater = evaluateOverworldEmotes({
      ...baseInput,
      recentTalk: { x: 560, y: 500, height: 110, elapsed: 24 },
    });
    const heartExpired = evaluateOverworldEmotes({
      ...baseInput,
      recentTalk: { x: 560, y: 500, height: 110, elapsed: 38 },
    });
    expect(heartEarly[0]?.texture).toBe("emoteHeart");
    expect(heartLater[0]?.texture).toBe("emoteHeart");
    expect(heartLater[0]?.y ?? 0).toBeLessThan(heartEarly[0]?.y ?? 0);
    expect(heartExpired).toEqual([]);
  });
});

describe("Milestone 85: companionIdlePose", () => {
  it("matches idleBreathing below 180 still ticks", () => {
    for (const id of ["maddie", "pond-pup", "acorn-squirrel", "ribbon-bunny", "sue", "jordan"]) {
      expect(companionIdlePose(id, 179, 55, 1)).toEqual(idleBreathing(55, 2.6));
    }
  });

  it("gives distinct long-idle personality poses at >= 180 ticks", () => {
    const maddie = companionIdlePose("maddie", 240, 20, 0);
    expect(maddie.scaleX).toBeCloseTo(1.035, 4);
    expect(maddie.scaleY).toBeLessThan(0.99);

    const pupHop = companionIdlePose("pond-pup", 240, 118, 0);
    expect(pupHop.offsetY).toBeLessThan(-4);
    expect(Math.abs(pupHop.rotation)).toBeGreaterThan(0.01);

    const squirrelHop = companionIdlePose("acorn-squirrel", 240, 99, 0);
    expect(squirrelHop.offsetY).toBeLessThan(-2);

    const bunnyHop = companionIdlePose("ribbon-bunny", 240, 108, 0);
    expect(bunnyHop.offsetY).toBeLessThan(-4);

    const sue = companionIdlePose("sue", 240, 40, 1);
    const jordan = companionIdlePose("jordan", 240, 40, 2);
    expect(Math.abs(sue.offsetX)).toBeGreaterThan(0.1);
    expect(Math.abs(sue.rotation)).toBeGreaterThan(0.005);
    expect(jordan.offsetX).not.toBeCloseTo(sue.offsetX, 3);
  });
});

describe("Milestone 85: transitionZoom", () => {
  it("returns 1 outside transitions or with invalid doorFadeTicks", () => {
    expect(transitionZoom(null, 18)).toBe(1);
    expect(
      transitionZoom({ target: { area: "kitchen", spawn: "stairs" }, phase: "out", elapsed: 9 }, 0),
    ).toBe(1);
  });

  it("eases 1.00 -> 1.022 on phase out and 0.972 -> 1.00 on phase in", () => {
    const target = { area: "kitchen", spawn: "stairs" };
    const outStart = transitionZoom({ target, phase: "out", elapsed: 0 }, 18);
    const outMid = transitionZoom({ target, phase: "out", elapsed: 9 }, 18);
    const outEnd = transitionZoom({ target, phase: "out", elapsed: 18 }, 18);
    expect(outStart).toBeCloseTo(1, 5);
    expect(outMid).toBeGreaterThan(1.005);
    expect(outMid).toBeLessThan(1.02);
    expect(outEnd).toBeCloseTo(1.022, 5);

    const inStart = transitionZoom({ target, phase: "in", elapsed: 0 }, 18);
    const inMid = transitionZoom({ target, phase: "in", elapsed: 9 }, 18);
    const inEnd = transitionZoom({ target, phase: "in", elapsed: 18 }, 18);
    expect(inStart).toBeCloseTo(0.972, 5);
    expect(inMid).toBeGreaterThan(0.98);
    expect(inMid).toBeLessThan(0.995);
    expect(inEnd).toBeCloseTo(1, 5);
  });
});
