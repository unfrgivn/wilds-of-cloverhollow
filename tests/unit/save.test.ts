import { describe, expect, it } from "vitest";
import { createState, stableHash, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseSave, serializeSave } from "../../src/core/save";

describe("save format", () => {
  const content = loadContent();
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("fixture missing");
  const fresh: State = createState(content.world, fixture);

  it("round trips a state with an identical hash, undefined keys included", () => {
    // A touch choice leaves `choose: undefined` in the last input; JSON drops
    // the key, and the hash must not care.
    const state: State = { ...fresh, tick: 42,
      previousInput: { ...fresh.previousInput, choose: undefined } };
    const restored = parseSave(serializeSave(state), fresh);
    expect(restored).not.toBeNull();
    expect(stableHash(restored)).toBe(stableHash(state));
  });

  it("rejects other versions, broken JSON, and states of another shape", () => {
    // Version 1 saves kept Maddie in `maddie` and `trail`, and version 2 saves
    // had no lantern; both start fresh, as does a version from the future.
    expect(parseSave(JSON.stringify({ version: 1, state: fresh }), fresh)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 2, state: fresh }), fresh)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 4, state: fresh }), fresh)).toBeNull();
    expect(parseSave("not json", fresh)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 3, state: { tick: 1 } }), fresh)).toBeNull();
    const wrongType = { ...fresh, tick: "1" };
    expect(parseSave(JSON.stringify({ version: 3, state: wrongType }), fresh)).toBeNull();
    const missingNested = { ...fresh, motion: { distance: 0 } };
    expect(parseSave(JSON.stringify({ version: 3, state: missingNested }), fresh)).toBeNull();
    // Array elements are checked against the template's first element.
    const partyWithoutMotion = {
      ...fresh,
      party: fresh.party.map(({ motion: _motion, ...member }) => member),
    };
    expect(parseSave(JSON.stringify({ version: 3, state: partyWithoutMotion }), fresh))
      .toBeNull();
    const emptyParty = { ...fresh, party: [] };
    expect(parseSave(JSON.stringify({ version: 3, state: emptyParty }), fresh)).not.toBeNull();
  });

  it("keeps a save made before a critter existed, with that critter in chaos", () => {
    const older: State["critters"] = { ...fresh.critters, frog: "calm" };
    delete older.pup;
    const restored = parseSave(JSON.stringify({ version: 3, state: { ...fresh, critters: older } }),
      fresh);
    expect(restored?.critters).toEqual({ ...fresh.critters, frog: "calm" });
    expect(restored?.critters.pup).toBe("chaos");
  });

  it("accepts a save taken mid-battle and mid-dialogue", () => {
    const busy = { ...fresh, dialogue: { knot: "window", speaker: "Fae", text: "Hi", revealed: 1,
      choices: [], selected: 0, ended: false } };
    expect(parseSave(serializeSave(busy), fresh)).not.toBeNull();
  });
});
