import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";

const content = loadContent();

describe("hills critters", () => {
  it("registers the lamb and hedgehog with their distinct burst rules", () => {
    const lamb = content.world.critters.lamb;
    const hedgehog = content.world.critters.hedgehog;
    expect(lamb?.name).toBe("Bouncy Lamb");
    expect(lamb?.calmName).toBe("Clover Lamb");
    expect(lamb?.burst.check.kind).toBe("chain");
    expect(lamb?.calmKnot).toBe("lamb_calm");
    expect(hedgehog?.name).toBe("Prickly Hedgehog");
    expect(hedgehog?.calmName).toBe("Meadow Hedgehog");
    expect(hedgehog?.burst.check.kind).toBe("ring");
    expect(hedgehog?.calmKnot).toBe("hedgehog_calm");
  });

  it("keeps both new stickers inside the expanded catalogue", () => {
    expect(content.world.stickers.slots).toBe(16);
    expect(content.world.stickers.catalogue.map((sticker) => sticker.id)).toEqual(
      expect.arrayContaining(["clover-lamb", "meadow-hedgehog"]),
    );
  });
});
