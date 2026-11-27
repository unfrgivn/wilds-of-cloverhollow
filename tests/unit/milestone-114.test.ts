import { describe, expect, it } from "vitest";
import {
  defaultMinigameRecords,
  readMinigameRecords,
  recordMinigameResult,
  writeMinigameRecords,
  type MinigameRecords,
} from "../../src/platform/minigame-records";
import {
  classifyCometPopup,
  classifyFishPopup,
  classifyMolePopup,
  classifySkeePopup,
  formatArcadeBestText,
} from "../../src/ui/arcade-popups";

describe("Milestone 112: minigame personal best records", () => {
  it("defaults all minigame records to zero", () => {
    expect(defaultMinigameRecords()).toEqual({ skee: 0, mole: 0, comet: 0, fish: 0 });
  });

  it("round-trips valid records through writeMinigameRecords and readMinigameRecords", () => {
    const sample: MinigameRecords = { skee: 220, mole: 14, comet: 16, fish: 5 };
    const encoded = writeMinigameRecords(sample);
    expect(readMinigameRecords(encoded)).toEqual(sample);
  });

  it("handles null, malformed JSON, non-objects, negatives, and floats gracefully", () => {
    expect(readMinigameRecords(null)).toEqual({ skee: 0, mole: 0, comet: 0, fish: 0 });
    expect(readMinigameRecords("not-json{")).toEqual({ skee: 0, mole: 0, comet: 0, fish: 0 });
    expect(readMinigameRecords("42")).toEqual({ skee: 0, mole: 0, comet: 0, fish: 0 });
    expect(readMinigameRecords("null")).toEqual({ skee: 0, mole: 0, comet: 0, fish: 0 });
    expect(
      readMinigameRecords(
        JSON.stringify({ skee: 180.9, mole: -4, comet: "12", fish: 3.7 }),
      ),
    ).toEqual({ skee: 180, mole: 0, comet: 0, fish: 3 });
    expect(readMinigameRecords(JSON.stringify({ skee: 50 }))).toEqual({
      skee: 50,
      mole: 0,
      comet: 0,
      fish: 0,
    });
    expect(
      writeMinigameRecords({ skee: -10, mole: 12.8, comet: Number.NaN, fish: Infinity }),
    ).toBe('{"skee":0,"mole":12,"comet":0,"fish":0}');
  });

  it("never triggers isNewBest on zero or negative scores", () => {
    const base = defaultMinigameRecords();
    const zero = recordMinigameResult(base, "skee", 0);
    expect(zero).toEqual({ records: base, best: 0, isNewBest: false });

    const negative = recordMinigameResult(base, "mole", -5);
    expect(negative).toEqual({ records: base, best: 0, isNewBest: false });
  });

  it("updates best immutably on higher scores and preserves best on equal or lower scores", () => {
    const initial: MinigameRecords = { skee: 100, mole: 10, comet: 8, fish: 2 };
    const beat = recordMinigameResult(initial, "skee", 220);
    expect(beat.isNewBest).toBe(true);
    expect(beat.best).toBe(220);
    expect(beat.records).toEqual({ skee: 220, mole: 10, comet: 8, fish: 2 });
    // Original object stays untouched.
    expect(initial.skee).toBe(100);

    const tied = recordMinigameResult(beat.records, "skee", 220);
    expect(tied).toEqual({ records: beat.records, best: 220, isNewBest: false });

    const lower = recordMinigameResult(beat.records, "skee", 150);
    expect(lower).toEqual({ records: beat.records, best: 220, isNewBest: false });

    const floored = recordMinigameResult(beat.records, "fish", 4.9);
    expect(floored).toEqual({
      records: { skee: 220, mole: 10, comet: 8, fish: 4 },
      best: 4,
      isNewBest: true,
    });
  });
});

describe("Milestone 112: pure die-cut arcade score popup classifiers", () => {
  it("classifies Skee-Ball score deltas and stays silent on open or reset", () => {
    expect(classifySkeePopup(null, 0)).toBeNull();
    expect(classifySkeePopup(null, 150)).toBeNull();
    expect(classifySkeePopup(50, 50)).toBeNull();
    expect(classifySkeePopup(150, 0)).toBeNull();

    expect(classifySkeePopup(0, 10)).toEqual({ kind: "normal", text: "+10" });
    expect(classifySkeePopup(10, 50)).toEqual({ kind: "normal", text: "+40" });
    expect(classifySkeePopup(50, 100)).toEqual({ kind: "big", text: "+50!" });
    expect(classifySkeePopup(50, 150)).toEqual({ kind: "rare", text: "+100 ★!" });
  });

  it("classifies Boop-a-Mole boops and stays silent on open, equal, or reset", () => {
    expect(classifyMolePopup(null, 0)).toBeNull();
    expect(classifyMolePopup(null, 5)).toBeNull();
    expect(classifyMolePopup(3, 3)).toBeNull();
    expect(classifyMolePopup(14, 0)).toBeNull();

    expect(classifyMolePopup(0, 1)).toEqual({ kind: "boop", text: "BOOP! +2" });
    expect(classifyMolePopup(13, 14)).toEqual({ kind: "boop", text: "BOOP! +2" });
  });

  it("classifies Comet Cruise star catches and stays silent on open, equal, or reset", () => {
    expect(classifyCometPopup(null, 0)).toBeNull();
    expect(classifyCometPopup(null, 8)).toBeNull();
    expect(classifyCometPopup(4, 4)).toBeNull();
    expect(classifyCometPopup(14, 0)).toBeNull();

    expect(classifyCometPopup(0, 1)).toEqual({ kind: "star", text: "★ +1" });
    expect(classifyCometPopup(13, 14)).toEqual({ kind: "star", text: "★ +1" });
  });

  it("classifies Fishing catch transitions and ignores static result renders or escapes", () => {
    expect(classifyFishPopup(null, "aim", false, false)).toBeNull();
    expect(classifyFishPopup(null, "result", false, true)).toBeNull();
    expect(classifyFishPopup(null, "result", true, true)).toBeNull();
    expect(classifyFishPopup("result", "result", true, true)).toBeNull();
    expect(classifyFishPopup("reeling", "reeling", false, false)).toBeNull();
    expect(classifyFishPopup("reeling", "result", false, false)).toBeNull();

    expect(classifyFishPopup("reeling", "result", false, true)).toEqual({
      kind: "normal",
      text: "NICE CATCH!",
    });
    expect(classifyFishPopup("reeling", "result", true, true)).toEqual({
      kind: "rare",
      text: "★ RARE!",
    });
  });

  it("formats Personal Best badge copy cleanly", () => {
    expect(formatArcadeBestText({ best: 220, isNewBest: true })).toBe("★ NEW BEST! 220");
    expect(formatArcadeBestText({ best: 220, isNewBest: false })).toBe("Best: 220");
  });
});
