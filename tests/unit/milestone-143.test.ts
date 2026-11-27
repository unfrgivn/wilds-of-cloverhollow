import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { prizeFieldNote, type PrizeFieldNoteMeta } from "../../src/ui/journal-field-note";

describe("Milestone 143: Arcade Prize Field Note Lore", () => {
  const content = loadContent();
  const prizes = content.world.arcade.prizes;
  const clawIds = new Set(content.world.arcade.claw.heap.map((item) => item.prize));
  const counterIds = new Set(content.world.arcade.counter.prizes.map((item) => item.prize));

  it("provides bespoke origin, home, and unique blurb for all 13 Arcade Prizes", () => {
    expect(prizes).toHaveLength(13);
    expect(clawIds.size).toBe(9);
    expect(counterIds.size).toBe(4);

    const fallback = prizeFieldNote("unknown-prize");
    const blurbs = new Set<string>();

    for (const prize of prizes) {
      const meta: PrizeFieldNoteMeta = prizeFieldNote(prize.id);
      const isClaw = clawIds.has(prize.id);
      const isCounter = counterIds.has(prize.id);
      expect(isClaw !== isCounter, `${prize.id} belongs to exactly one arcade source`).toBe(true);

      const expectedOrigin = isClaw
        ? "Claw Machine · Mr. Pip's Arcade"
        : "Ticket Counter · Mr. Pip's Arcade";
      expect(meta.origin, prize.id).toBe(expectedOrigin);
      expect(meta.displayNote, prize.id).toBe("Clubhouse Shelf");
      expect(meta.blurb.trim().length, prize.id).toBeGreaterThan(20);
      expect(meta.blurb, `${prize.id} uses bespoke blurb`).not.toBe(fallback.blurb);
      blurbs.add(meta.blurb);
    }

    expect(blurbs.size).toBe(13);
    expect(prizeFieldNote("star-racer-keychain").blurb).toContain("Milo");
  });

  it("returns a safe non-empty fallback for unknown prize IDs", () => {
    const fallback = prizeFieldNote("unknown-prize");
    expect(fallback.origin.trim().length).toBeGreaterThan(0);
    expect(fallback.displayNote).toBe("Clubhouse Shelf");
    expect(fallback.blurb.trim().length).toBeGreaterThan(0);
  });
});
