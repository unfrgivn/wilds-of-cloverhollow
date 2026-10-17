import { describe, expect, it } from "vitest";
import {
  loadContent,
  parseBattleContent,
  parseCritter,
  parsePartyMember,
} from "../../src/content/load";

const content = loadContent();

function clone(value: unknown): Record<string, unknown> {
  const copy: unknown = JSON.parse(JSON.stringify(value));
  if (!record(copy)) throw new Error("fixture is not an object");
  return copy;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nested(root: Record<string, unknown>, ...names: string[]): Record<string, unknown> {
  let current = root;
  for (const name of names) {
    const next = current[name];
    if (!record(next)) throw new Error(`missing fixture field ${name}`);
    current = next;
  }
  return current;
}

function critter(): Record<string, unknown> {
  const value = content.world.critters["fountain-frog"];
  if (value === undefined) throw new Error("fountain frog missing");
  return clone(value);
}

function partyMember(): Record<string, unknown> {
  const value = content.world.party.maddie;
  if (value === undefined) throw new Error("Maddie missing");
  return clone(value);
}

describe("battle check content validation", () => {
  it("rejects an unknown check kind with its file and field", () => {
    const value = critter();
    nested(value, "burst", "check").kind = "wrong";
    expect(() => parseCritter(value, "critters/frog.json"))
      .toThrow(/critters\/frog\.json.*burst\.check\.kind/);
  });

  it("rejects a non-integer tick with its file and field", () => {
    const value = critter();
    nested(value, "burst", "check").travelTicks = 1.5;
    expect(() => parseCritter(value, "critters/frog.json"))
      .toThrow(/critters\/frog\.json.*burst\.check\.travelTicks/);
  });

  it.each([
    ["greatWindow", 12, /greatWindow/],
    ["targetTick", 2, /targetTick/],
    ["targetTick", 59, /targetTick/],
  ])("rejects an invalid ring %s with its field", (field, value, fieldPattern) => {
    const raw = content.world.critters.pup;
    if (raw === undefined) throw new Error("pup missing");
    const valueCopy = clone(raw);
    const check = nested(valueCopy, "burst", "check");
    if (field === "greatWindow") {
      check.greatWindow = value;
      check.goodWindow = 11;
    } else {
      check.targetTick = value;
    }
    expect(() => parseCritter(valueCopy, "critters/pup.json"))
      .toThrow(new RegExp(`critters/pup\\.json.*${fieldPattern.source}`));
  });

  it("rejects a charge target past maxTicks and waitTicks below one", () => {
    const raw = content.world.party.sue;
    if (raw === undefined) throw new Error("Sue missing");
    const first = clone(raw);
    nested(first, "command", "check").targetTick = 55;
    expect(() => parsePartyMember(first, "party/sue.json"))
      .toThrow(/party\/sue\.json.*command\.check\.targetTick/);
    const second = clone(raw);
    nested(second, "command", "check").waitTicks = 0;
    expect(() => parsePartyMember(second, "party/sue.json"))
      .toThrow(/party\/sue\.json.*command\.check\.waitTicks/);
  });

  it("rejects invalid chain windows, order, travel, gaps, and look", () => {
    const invalidCases: Array<[string, (check: Record<string, unknown>) => void, RegExp]> = [
      ["hitWindow", (check) => { check.hitWindow = 0; }, /burst\.check/],
      ["arrivals", (check) => { check.arrivals = [44, 44, 96]; }, /burst\.check\.arrivals/],
      ["arrivals", (check) => { check.arrivals = [20, 70, 96]; }, /burst\.check\.arrivals/],
      ["arrivals", (check) => { check.arrivals = [44, 50, 96]; }, /burst\.check\.arrivals/],
      ["look", (check) => { check.look = "unknown"; }, /burst\.check\.look/],
    ];
    for (const [, change, field] of invalidCases) {
      const value = critter();
      change(nested(value, "burst", "check"));
      expect(() => parseCritter(value, "critters/fountain-frog.json"))
        .toThrow(new RegExp(`critters/fountain-frog\\.json.*${field.source}`));
    }
    const accepted = critter();
    nested(accepted, "burst", "check").arrivals = [44, 62, 96];
    expect(() => parseCritter(accepted, "critters/fountain-frog.json")).not.toThrow();
  });

  it("rejects a big burst of a different kind", () => {
    const value = critter();
    const big = nested(value, "burst", "big");
    big.kind = "ring";
    big.ticks = 60;
    big.targetTick = 45;
    big.greatWindow = 5;
    big.goodWindow = 11;
    expect(() => parseCritter(value, "critters/fountain-frog.json"))
      .toThrow(/critters\/fountain-frog\.json.*burst\.big\.kind/);
  });

  it("rejects a party command without a check", () => {
    const value = partyMember();
    delete nested(value, "command").check;
    expect(() => parsePartyMember(value, "party/maddie.json"))
      .toThrow(/party\/maddie\.json.*command\.check/);
  });

  it("rejects battle content without hints or Soothe's check", () => {
    const raw = content.world.battle;
    const noHints = clone(raw);
    delete noHints.hints;
    expect(() => parseBattleContent(noHints, "battle.json")).toThrow(/battle\.json.*hints/);

    const noCheck = clone(raw);
    delete nested(noCheck, "commands", "soothe").check;
    expect(() => parseBattleContent(noCheck, "battle.json"))
      .toThrow(/battle\.json.*commands\.soothe\.check/);
  });
});
