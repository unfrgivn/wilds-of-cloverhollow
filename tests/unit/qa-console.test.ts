import { describe, expect, it } from "vitest";
import { createState, parseSave, serializeSave, type State } from "../../src/core";
import { inkVariable } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import { runConsoleCommand, type ConsoleContext } from "../../src/dev/console";

const content = loadContent();
const context: ConsoleContext = {
  story: content.world.story,
  stickerIds: content.world.stickers.catalogue.map((sticker) => sticker.id),
  prizeIds: content.world.arcade.prizes.map((prize) => prize.id),
  treatIds: content.world.treats.map((treat) => treat.id),
  thresholds: content.world.levels.thresholds,
};

function base(): State {
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("new-game fixture missing");
  return createState(content.world, fixture, 1);
}

// Reads a story variable the way the game does: declared names answer their
// value (fresh ones their default), undeclared names answer undefined.
function variable(state: State, name: string): unknown {
  return inkVariable(content.world.story, state.ink, name);
}

describe("QA console commands", () => {
  it("help lists every command", () => {
    const outcome = runConsoleCommand(context, base(), "help");
    if (outcome.kind !== "help") throw new Error("expected help");
    for (const word of [
      "help", "xp", "level", "coins", "snacks", "tickets", "treats", "stickers", "prizes",
      "lantern", "lasso", "flute", "map", "save", "export",
    ])
      expect(outcome.message, word).toContain(word);
  });

  it("sets fae's and a member's XP, and refuses anyone else", () => {
    const start = base();
    expect(start.party.map((member) => member.id)).toEqual(["maddie"]);
    const fae = runConsoleCommand(context, start, "xp fae 100");
    if (fae.kind !== "applied") throw new Error("expected an applied outcome");
    expect(fae.state.xp).toBe(100);
    expect(fae.state.tick, "nothing else moved").toBe(start.tick);
    const member = runConsoleCommand(context, fae.state, "xp maddie 40");
    if (member.kind !== "applied") throw new Error("expected an applied outcome");
    expect(member.state.xp, "fae keeps her own XP").toBe(100);
    expect(member.state.party[0]?.xp).toBe(40);
    const sue = runConsoleCommand(context, start, "xp sue 10");
    if (sue.kind !== "error") throw new Error("expected an error");
    expect(sue.message).toContain("Try fae, maddie");
    expect(runConsoleCommand(context, start, "xp fae -5").kind).toBe("error");
    expect(runConsoleCommand(context, start, "xp fae lots").kind).toBe("error");
    const cap = context.thresholds[context.thresholds.length - 1] ?? 0;
    expect(runConsoleCommand(context, start, `xp fae ${cap + 1}`).kind).toBe("error");
  });

  it("level moves XP to its threshold, 1 to 99 only", () => {
    const start = base();
    const six = runConsoleCommand(context, start, "level fae 6");
    if (six.kind !== "applied") throw new Error("expected an applied outcome");
    expect(six.state.xp).toBe(context.thresholds[5]);
    expect(six.message).toContain("level 6");
    const one = runConsoleCommand(context, six.state, "level fae 1");
    if (one.kind !== "applied") throw new Error("expected an applied outcome");
    expect(one.state.xp).toBe(context.thresholds[0]);
    const ninety = runConsoleCommand(context, one.state, "level fae 99");
    if (ninety.kind !== "applied") throw new Error("expected an applied outcome");
    expect(ninety.state.xp).toBe(context.thresholds[98]);
    const member = runConsoleCommand(context, start, "level maddie 3");
    if (member.kind !== "applied") throw new Error("expected an applied outcome");
    expect(member.state.party[0]?.xp).toBe(context.thresholds[2]);
    expect(runConsoleCommand(context, start, "level fae 0").kind).toBe("error");
    expect(runConsoleCommand(context, start, "level fae 100").kind).toBe("error");
    expect(runConsoleCommand(context, start, "level sue 2").kind).toBe("error");
  });

  it("sets coins, snacks, and tickets with their caps", () => {
    const start = base();
    const coins = runConsoleCommand(context, start, "coins 99");
    if (coins.kind !== "applied") throw new Error("expected an applied outcome");
    expect(coins.state.coins).toBe(99);
    expect(coins.message).toBe("coins = 99.");
    const snacks = runConsoleCommand(context, coins.state, "snacks 7");
    if (snacks.kind !== "applied") throw new Error("expected an applied outcome");
    expect(snacks.state.snacks).toBe(7);
    expect(snacks.state.coins, "one command at a time").toBe(99);
    const tickets = runConsoleCommand(context, snacks.state, "tickets 42");
    if (tickets.kind !== "applied") throw new Error("expected an applied outcome");
    expect(tickets.state.tickets).toBe(42);
    const overCoins = runConsoleCommand(context, start, "coins 1000");
    if (overCoins.kind !== "error") throw new Error("expected an error");
    expect(overCoins.message).toContain("999");
    expect(runConsoleCommand(context, start, "snacks 100").kind).toBe("error");
    expect(runConsoleCommand(context, start, "tickets 1000").kind).toBe("error");
    expect(runConsoleCommand(context, start, "coins -1").kind).toBe("error");
    expect(runConsoleCommand(context, start, "coins few").kind).toBe("error");
    expect(runConsoleCommand(context, start, "coins").kind).toBe("error");
  });

  it("grants stickers and prizes from the catalogues", () => {
    const start = base();
    const all = runConsoleCommand(context, start, "stickers all");
    if (all.kind !== "applied") throw new Error("expected an applied outcome");
    expect(all.state.stickers).toHaveLength(context.stickerIds.length);
    expect(new Set(all.state.stickers)).toEqual(new Set(context.stickerIds));
    expect(all.state.stickers.slice(0, start.stickers.length)).toEqual(start.stickers);
    const again = runConsoleCommand(context, all.state, "stickers all");
    if (again.kind !== "applied") throw new Error("expected an applied outcome");
    expect(again.state.stickers).toEqual(all.state.stickers);
    expect(again.message).toContain("already");
    const one = runConsoleCommand(context, start, "stickers pond-pup");
    if (one.kind !== "applied") throw new Error("expected an applied outcome");
    expect(one.state.stickers).toContain("pond-pup");
    const unknown = runConsoleCommand(context, start, "stickers nope");
    if (unknown.kind !== "error") throw new Error("expected an error");
    expect(unknown.message).toContain("No sticker \"nope\"");
    const prizes = runConsoleCommand(context, start, "prizes all");
    if (prizes.kind !== "applied") throw new Error("expected an applied outcome");
    expect(prizes.state.prizes).toHaveLength(context.prizeIds.length);
    const pinwheel = runConsoleCommand(context, start, "prizes pinwheel");
    if (pinwheel.kind !== "applied") throw new Error("expected an applied outcome");
    expect(pinwheel.state.prizes).toContain("pinwheel");
    expect(runConsoleCommand(context, start, "prizes nope").kind).toBe("error");
    const allTreats = runConsoleCommand(context, start, "treats all");
    if (allTreats.kind !== "applied") throw new Error("expected an applied outcome");
    expect(Object.keys(allTreats.state.treats ?? {}).sort()).toEqual([...context.treatIds].sort());
    const oneTreat = runConsoleCommand(context, allTreats.state, "treats fish-cracker");
    if (oneTreat.kind !== "applied") throw new Error("expected an applied outcome");
    expect(oneTreat.state.treats?.["fish-cracker"]).toBe(2);
    expect(runConsoleCommand(context, start, "treats nope").kind).toBe("error");
  });

  it("the four tools set their story variables and nothing else", () => {
    const start = base();
    expect(variable(start, "has_lasso")).toBe(false);
    const lasso = runConsoleCommand(context, start, "lasso on");
    if (lasso.kind !== "applied") throw new Error("expected an applied outcome");
    expect(lasso.message).toBe("has_lasso = true.");
    expect(variable(lasso.state, "has_lasso")).toBe(true);
    expect(variable(lasso.state, "has_flute"), "only the named variable").toBe(false);
    expect(variable(lasso.state, "plan"), "other variables keep their values").toBe("none");
    const off = runConsoleCommand(context, lasso.state, "lasso off");
    if (off.kind !== "applied") throw new Error("expected an applied outcome");
    expect(variable(off.state, "has_lasso")).toBe(false);
    const toolVariables: [string, string][] = [
      ["lantern", "has_lantern"], ["flute", "has_flute"], ["map", "has_map"],
    ];
    for (const [tool, name] of toolVariables) {
      const outcome = runConsoleCommand(context, start, `${tool} on`);
      if (outcome.kind !== "applied") throw new Error("expected an applied outcome");
      expect(variable(outcome.state, name)).toBe(true);
    }
    expect(runConsoleCommand(context, start, "lantern maybe").kind).toBe("error");
    expect(runConsoleCommand(context, start, "wrench on").kind).toBe("error");
  });

  it("save names a QA slot and export asks for the save file", () => {
    const start = base();
    const saved = runConsoleCommand(context, start, "save evening");
    if (saved.kind !== "save") throw new Error("expected a save outcome");
    expect(saved.name).toBe("evening");
    expect(runConsoleCommand(context, start, "save Evening").kind).toBe("error");
    expect(runConsoleCommand(context, start, "save -nope").kind).toBe("error");
    expect(runConsoleCommand(context, start, "save").kind).toBe("error");
    expect(runConsoleCommand(context, start, "export").kind).toBe("export");
  });

  it("refuses unknown commands and answers any case", () => {
    const start = base();
    const unknown = runConsoleCommand(context, start, "frobnicate now");
    if (unknown.kind !== "error") throw new Error("expected an error");
    expect(unknown.message).toContain("Unknown command \"frobnicate\"");
    expect(unknown.message).toContain("help");
    expect(runConsoleCommand(context, start, "HELP").kind).toBe("help");
    expect(runConsoleCommand(context, start, "  ").kind).toBe("error");
  });

  it("applied states stay savable", () => {
    const start = base();
    const coins = runConsoleCommand(context, start, "coins 99");
    if (coins.kind !== "applied") throw new Error("expected an applied outcome");
    const lasso = runConsoleCommand(context, coins.state, "lasso on");
    if (lasso.kind !== "applied") throw new Error("expected an applied outcome");
    const restored = parseSave(serializeSave(lasso.state), base());
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error("the console's state would not load");
    expect(restored.coins).toBe(99);
    expect(variable(restored, "has_lasso")).toBe(true);
  });
});
