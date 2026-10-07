import { describe, expect, it } from "vitest";
import {
  parseCritter,
  parsePartyMember,
  partyErrors,
  partyJoinErrors,
} from "../../src/content/load";
import { loadContent } from "../../src/content/load";

const valid = {
  id: "sue",
  name: "Sue",
  atlas: "assets/characters/sue/sue.json",
  box: { width: 50, height: 140 },
  walkCycleUnits: 126,
  sits: false,
  start: false,
  joins: "sue_joined",
  command: { id: "cast", label: "Cast", resting: "reeling in" },
};

describe("party loader rules", () => {
  it("requires exactly one of start and joins", () => {
    expect(() => parsePartyMember({ ...valid, start: true }, "test")).toThrow();
    expect(() => parsePartyMember({ ...valid, start: false, joins: null }, "test")).toThrow();
    expect(() => parsePartyMember({ ...valid, start: true, joins: null }, "test")).not.toThrow();
  });

  it("rejects an undeclared joining variable", () => {
    const member = parsePartyMember(valid, "test");
    expect(partyJoinErrors({ sue: member }, () => undefined)).toEqual([
      "party sue: joins variable sue_joined is not declared",
    ]);
  });

  it("requires Cast numbers and lines for every critter", () => {
    const content = loadContent();
    const frog = content.world.critters.frog;
    if (frog === undefined) throw new Error("frog missing");
    const rawNumbers: unknown = JSON.parse(JSON.stringify(frog));
    const rawLines: unknown = JSON.parse(JSON.stringify(frog));
    if (!record(rawNumbers) || !record(rawLines)) throw new Error("bad fixture");
    if (!record(rawNumbers.commands) || !record(rawNumbers.commands.friends))
      throw new Error("bad commands");
    if (!record(rawLines.lines) || !record(rawLines.lines.friends))
      throw new Error("bad lines");
    delete rawNumbers.commands.friends.cast;
    delete rawLines.lines.friends.cast;
    const noNumbers = parseCritter(rawNumbers, "test");
    const noLines = parseCritter(rawLines, "test");
    const party = content.world.party;
    const missingNumbers = partyErrors(party, { frog: noNumbers });
    const missingLines = partyErrors(party, { frog: noLines });
    expect(missingNumbers).toContain("critter frog: no commands.friends.cast");
    expect(missingLines).toContain("critter frog: no lines.friends.cast");
  });
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
