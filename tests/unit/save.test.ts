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
    expect(parseSave(JSON.stringify({ version: 2, state: fresh }), fresh)).toBeNull();
    expect(parseSave("not json", fresh)).toBeNull();
    expect(parseSave(JSON.stringify({ version: 1, state: { tick: 1 } }), fresh)).toBeNull();
    const wrongType = { ...fresh, tick: "1" };
    expect(parseSave(JSON.stringify({ version: 1, state: wrongType }), fresh)).toBeNull();
    const { motion: _motion, ...maddieWithoutMotion } = fresh.maddie;
    const missingNested = { ...fresh, maddie: maddieWithoutMotion };
    expect(parseSave(JSON.stringify({ version: 1, state: missingNested }), fresh)).toBeNull();
  });

  it("accepts a save taken mid-battle and mid-dialogue", () => {
    const busy = { ...fresh, dialogue: { knot: "window", speaker: "Fae", text: "Hi", revealed: 1,
      choices: [], selected: 0, ended: false } };
    expect(parseSave(serializeSave(busy), fresh)).not.toBeNull();
  });
});
