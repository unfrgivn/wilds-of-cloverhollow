import { describe, expect, test } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  landFieldGuide,
  setInkVariables,
  startBattle,
  type State,
} from "../../src/core";
import {
  battlePeekData,
  checkMechanicLabel,
  type CheckKind,
} from "../../src/ui/battle-peek";

const content = loadContent();
const world = content.world;
const rawPlazaFixture = content.fixtures["plaza"];
if (rawPlazaFixture === undefined) throw new Error("Missing plaza fixture");
const plazaFixture = rawPlazaFixture;

function battleStateFor(
  critterId: string,
  overrides: Partial<State> = {},
): State {
  const base = createState(world, plazaFixture);
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`Missing critter ${critterId}`);
  const merged: State = { ...base, ...overrides };
  return {
    ...merged,
    battle: startBattle(world, merged, critter),
  };
}

describe("Milestone 110: Battle Field Guide Peek & Interactive Map Land Guide", () => {
  test("checkMechanicLabel maps all 8 check kinds exhaustively", () => {
    const expected: Record<CheckKind, string> = {
      ring: "Timing Ring",
      charge: "Hold & Release",
      chain: "Rhythm Chain",
      catch: "Toy Catch",
      lean: "Wind-Gust Lean",
      trace: "Shape Trace",
      peekaboo: "Peekaboo Freeze",
      echo: "Musical Echo Chimes",
    };
    const allKinds: readonly CheckKind[] = [
      "ring",
      "charge",
      "chain",
      "catch",
      "lean",
      "trace",
      "peekaboo",
      "echo",
    ];
    expect(Object.keys(expected).sort()).toEqual([...allKinds].sort());
    for (const kind of allKinds) {
      expect(checkMechanicLabel(kind)).toBe(expected[kind]);
    }
  });

  test("battlePeekData returns null outside battle or for an unknown critter", () => {
    const base = createState(world, plazaFixture);
    expect(battlePeekData(world, base)).toBeNull();

    const active = battleStateFor("fountain-frog");
    if (active.battle === null) throw new Error("Expected active battle");
    expect(
      battlePeekData(world, {
        ...active,
        battle: { ...active.battle, critterId: "missing-critter" },
      }),
    ).toBeNull();
  });

  test("battlePeekData classifies familiarity, gates feelings and treats cleanly", () => {
    const first = battleStateFor("fountain-frog");
    const firstPeek = battlePeekData(world, first);
    if (firstPeek === null) throw new Error("Expected peek data");
    expect(firstPeek.critterId).toBe("fountain-frog");
    expect(firstPeek.name).toBe("Fizzy Frog");
    expect(firstPeek.landName).toBe("Cloverhollow");
    expect(firstPeek.familiarity).toBe("first-meeting");
    expect(firstPeek.familiarityLabel).toBe("New Friend");
    expect(firstPeek.calmedCount).toBe(0);
    expect(firstPeek.favouriteTreats).toEqual([]);
    expect(firstPeek.knownFeelings).toBeNull();

    // Carrying the lantern reveals feelings on a first meeting without spoiling treats.
    const lanternState = battleStateFor("fountain-frog", {
      ink: setInkVariables(first.ink, { has_lantern: true }),
    });
    const lanternPeek = battlePeekData(world, lanternState);
    if (lanternPeek === null) throw new Error("Expected lantern peek data");
    expect(lanternPeek.familiarity).toBe("first-meeting");
    expect(lanternPeek.knownFeelings).toEqual(["Bored", "Curious", "Zoomy"]);
    expect(lanternPeek.favouriteTreats).toEqual([]);

    // Calming once (or holding the species sticker) upgrades to Befriended and unlocks treats.
    const befriended = battleStateFor("fountain-frog", {
      calms: { frog: 1 },
      stickers: ["fountain-frog"],
    });
    const befriendedPeek = battlePeekData(world, befriended);
    if (befriendedPeek === null) throw new Error("Expected befriended peek data");
    expect(befriendedPeek.familiarity).toBe("befriended");
    expect(befriendedPeek.familiarityLabel).toBe("Befriended ✓");
    expect(befriendedPeek.calmedCount).toBe(1);
    expect(befriendedPeek.knownFeelings).toEqual(["Bored", "Curious", "Zoomy"]);
    expect(befriendedPeek.favouriteTreats).toContain("Fish Cracker");

    // Reaching world.battle.oldFriends.calms classifies as Old Friend ★.
    const oldFriendState = battleStateFor("fountain-frog", {
      calms: { frog: world.battle.oldFriends.calms },
      stickers: ["fountain-frog"],
    });
    const oldFriendPeek = battlePeekData(world, oldFriendState);
    if (oldFriendPeek === null) throw new Error("Expected old-friend peek data");
    expect(oldFriendPeek.familiarity).toBe("old-friend");
    expect(oldFriendPeek.familiarityLabel).toBe("Old Friend ★");
    expect(oldFriendPeek.calmedCount).toBe(world.battle.oldFriends.calms);
  });

  test("battlePeekData selects tailored <=72-char tips for wind-ups, Talk, Echo, Peekaboo", () => {
    const gullPeek = battlePeekData(world, battleStateFor("gull"));
    expect(gullPeek?.tip).toContain("wind-up bubble");

    const chefPeek = battlePeekData(world, battleStateFor("taco-chef"));
    expect(chefPeek?.tip).toContain("Talk");

    const lambPeek = battlePeekData(world, battleStateFor("lamb"));
    expect(lambPeek?.checkLabel).toBe("Musical Echo Chimes");
    expect(lambPeek?.tip).toContain("chime");

    const owlPeek = battlePeekData(world, battleStateFor("moon-owl"));
    expect(owlPeek?.checkLabel).toBe("Peekaboo Freeze");
    expect(owlPeek?.tip).toContain("freeze");

    for (const critter of Object.values(world.critters)) {
      const peek = battlePeekData(world, battleStateFor(critter.id));
      expect(peek, critter.id).not.toBeNull();
      expect(peek?.tip.length ?? 999, `${critter.id} tip length`).toBeLessThanOrEqual(72);
    }
  });

  test("landFieldGuide covers all 7 lands, gems, bus stops, and unrevealed/empty lands", () => {
    const base = createState(world, plazaFixture);

    // Unrevealed lands and unknown IDs return empty strings without spoilers.
    expect(landFieldGuide(world, base, "hills")).toBe("");
    expect(landFieldGuide(world, base, "enchanted")).toBe("");
    expect(landFieldGuide(world, base, "nonexistent")).toBe("");

    // Before any gem is found, gem badge stays hidden while stops and highlights show.
    const cloverGuide = landFieldGuide(world, base, "cloverhollow");
    expect(cloverGuide).toContain("Cloverhollow");
    expect(cloverGuide).toContain("stickers");
    expect(cloverGuide).toContain("Star-Line stop");
    expect(cloverGuide).toContain("Shops, Café & Arcade");
    expect(cloverGuide).not.toContain("Gem");

    const bayGuide = landFieldGuide(world, base, "bay");
    expect(bayGuide).toContain("Bubblegum Bay");
    expect(bayGuide).toContain("Star-Line stop");
    expect(bayGuide).toContain("Fishing, Boats & Cottage");

    const trailGuide = landFieldGuide(world, base, "trail");
    expect(trailGuide).toContain("Cliffside Trail");
    expect(trailGuide).not.toContain("Star-Line stop");
    expect(trailGuide).toContain("Cliffside Lookout");

    // Reveal all lands and find a subset of Star Gems to verify ★ Gem vs ◇ Gem.
    const lateState: State = {
      ...base,
      ink: setInkVariables(base.ink, {
        visited_hills: true,
        found_mist_way: true,
        gem_park: true,
        gem_pass: true,
        gem_cavern: true,
      }),
    };

    expect(landFieldGuide(world, lateState, "cloverhollow")).toContain("★ Gem");
    expect(landFieldGuide(world, lateState, "bay")).toContain("◇ Gem");
    expect(landFieldGuide(world, lateState, "trail")).toContain("◇ Gem");
    expect(landFieldGuide(world, lateState, "forest")).toContain("◇ Gem");
    expect(landFieldGuide(world, lateState, "hills")).toContain("◇ Gem");
    expect(landFieldGuide(world, lateState, "hills")).toContain("Sanctuary & Taco Truck");
    expect(landFieldGuide(world, lateState, "pass")).toContain("★ Gem (2/2)");
    expect(landFieldGuide(world, lateState, "pass")).toContain("Star-Line stop");
    expect(landFieldGuide(world, lateState, "pass")).toContain("Lodge, Summit & Cavern");

    const enchantedGuide = landFieldGuide(world, lateState, "enchanted");
    expect(enchantedGuide).toContain("The Enchanted Forest");
    expect(enchantedGuide).toContain("Misty Path & Ancient Tree");
    expect(enchantedGuide).not.toContain("Gem");
    expect(enchantedGuide).not.toContain("Star-Line stop");

    // Partial gem progress in Pinecone Pass (1 of 2 gems) shows ◇ Gem (1/2).
    const halfPassState: State = {
      ...base,
      ink: setInkVariables(base.ink, { gem_pass: true }),
    };
    expect(landFieldGuide(world, halfPassState, "pass")).toContain("◇ Gem (1/2)");
  });
});
