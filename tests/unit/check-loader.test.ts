import { describe, expect, it } from "vitest";
import {
  loadContent,
  parseBattleContent,
  parseCritter,
  parsePartyMember,
  feelingErrors,
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

function ringCritter(): Record<string, unknown> {
  const value = content.world.critters.bluebird;
  if (value === undefined) throw new Error("bluebird missing");
  return clone(value);
}

function catchCritter(): Record<string, unknown> {
  const value = content.world.critters.pup;
  if (value === undefined) throw new Error("pup missing");
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
    const raw = content.world.critters.bluebird;
    if (raw === undefined) throw new Error("pup missing");
    const valueCopy = clone(raw);
    const check = nested(valueCopy, "burst", "check");
    if (field === "greatWindow") {
      check.greatWindow = value;
      check.goodWindow = 11;
    } else {
      check.targetTick = value;
    }
      expect(() => parseCritter(valueCopy, "critters/bluebird.json"))
      .toThrow(new RegExp(`critters/bluebird\\.json.*${fieldPattern.source}`));
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
    const value = catchCritter();
    const big = nested(value, "burst", "big");
    big.kind = "ring";
    big.ticks = 60;
    big.targetTick = 45;
    big.greatWindow = 5;
    big.goodWindow = 11;
    expect(() => parseCritter(value, "critters/fountain-frog.json"))
      .toThrow(/critters\/fountain-frog\.json.*burst\.big\.kind/);
  });

  it.each([
    ["garbled arrivals", (check: Record<string, unknown>) => {
      check.arrivals = [54, "bad"];
    }, /burst\.check\.arrivals/],
    ["arrival before travel", (check: Record<string, unknown>) => {
      check.arrivals = [49, 58];
    }, /burst\.check\.arrivals/],
    ["seven tick gap", (check: Record<string, unknown>) => {
      check.arrivals = [54, 61];
    }, /burst\.check\.arrivals/],
    ["empty toys", (check: Record<string, unknown>) => { check.toys = []; },
      /burst\.check\.toys/],
  ])("rejects a catch with %s and names its field", (_name, change, field) => {
    const value = critter();
    const check = nested(value, "burst", "check");
    check.kind = "catch";
    check.travelTicks = 50;
    check.arrivals = [54, 62];
    check.toys = ["toy"];
    change(check);
    expect(() => parseCritter(value, "critters/pup.json"))
      .toThrow(new RegExp(`critters/pup\\.json.*${field.source}`));
  });

  it("accepts a catch gap of exactly eight ticks", () => {
    const value = catchCritter();
    const check = nested(value, "burst", "check");
    check.kind = "catch";
    check.travelTicks = 50;
    check.arrivals = [54, 62];
    check.toys = ["toy"];
    expect(() => parseCritter(value, "critters/pup.json")).not.toThrow();
  });

  it("rejects a catch as Soothe's check", () => {
    const value = clone(content.world.battle);
    const check = nested(nested(value, "commands"), "soothe", "check");
    check.kind = "catch";
    check.travelTicks = 50;
    check.arrivals = [54];
    check.toys = ["toy"];
    expect(() => parseBattleContent(value, "battle.json"))
      .toThrow(/battle\.json.*commands\.soothe\.check\.kind/);
  });

  it("rejects a catch as a party command's check", () => {
    const value = partyMember();
    const check = nested(value, "command", "check");
    check.kind = "catch";
    check.travelTicks = 50;
    check.arrivals = [54];
    check.toys = ["toy"];
    expect(() => parsePartyMember(value, "party/maddie.json"))
      .toThrow(/party\/maddie\.json.*command\.check\.kind/);
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

    const noAtlas = clone(raw);
    delete noAtlas.toyAtlas;
    expect(() => parseBattleContent(noAtlas, "battle.json"))
      .toThrow(/battle\.json.*toyAtlas/);

    const noCatchHint = clone(raw);
    const hints = nested(noCatchHint, "hints");
    delete hints.catch;
    expect(() => parseBattleContent(noCatchHint, "battle.json"))
      .toThrow(/battle\.json.*hints/);
  });

  it("rejects missing or unknown feelings and names the field", () => {
    const missing = clone(content.world.battle);
    delete nested(missing, "feelings").zoomy;
    expect(() => parseBattleContent(missing, "battle.json"))
      .toThrow(/battle\.json.*feelings\.zoomy/);

    const unknown = clone(content.world.battle);
    nested(unknown, "feelings").glad = { label: "Glad", answer: "soothe" };
    expect(() => parseBattleContent(unknown, "battle.json"))
      .toThrow(/battle\.json.*feelings/);
  });

  it("rejects empty feeling labels and invalid feeling bonuses", () => {
    const empty = clone(content.world.battle);
    nested(empty, "feelings", "zoomy").label = "";
    expect(() => parseBattleContent(empty, "battle.json"))
      .toThrow(/battle\.json.*feelings\.zoomy/);

    for (const bonus of [-1, 1.5]) {
      const value = clone(content.world.battle);
      value.feelingBonus = bonus;
      expect(() => parseBattleContent(value, "battle.json"))
        .toThrow(/battle\.json.*feelingBonus/);
    }
  });

  it("reports run and unknown feeling answers through feelingErrors", () => {
    for (const answer of ["run", "unknown"]) {
      const value = clone(content.world.battle);
      nested(value, "feelings", "zoomy").answer = answer;
      const battle = parseBattleContent(value, "battle.json");
      expect(feelingErrors(battle, content.world.party)).toEqual([
        expect.stringContaining("feelings.zoomy.answer"),
      ]);
    }
  });

  it.each([
    ["empty", []],
    ["unknown", ["glad"]],
    ["repeated", ["zoomy", "zoomy"]],
  ])("rejects a critter with %s feelings", (_name, feelings) => {
    const value = critter();
    value.feelings = feelings;
    expect(() => parseCritter(value, "critters/frog.json"))
      .toThrow(/critters\/frog\.json.*feelings/);
  });
});
