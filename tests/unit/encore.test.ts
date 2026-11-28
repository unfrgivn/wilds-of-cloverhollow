import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, parseEncoreContent } from "../../src/content/load";
import {
  applyEncoreCheckSpec,
  battleCommands,
  battleView,
  blankInput,
  BOSS_SET_PIECES,
  buildEncoreShrineView,
  computeEncoreCoins,
  createState,
  ENCORE_MODIFIER_IDS,
  encoreFeelingBonus,
  encoreSummary,
  encoreWindUpSpec,
  gentleCheckSpec,
  isEncoreBossUnlocked,
  isEncoreShrineUnlocked,
  parseSave,
  recordEncoreVictory,
  serializeSave,
  soundCues,
  stableHash,
  startDialogue,
  startEncoreBattle,
  step,
  type ActionFrame,
  type CheckSpec,
  type EncoreModifierId,
  type State,
} from "../../src/core";
import { importErrors, stripComments } from "../../tools/purity";

const { world, fixtures } = loadContent();
const none: ActionFrame = blankInput();

function press(partial: Partial<ActionFrame>): ActionFrame {
  return { ...none, ...partial };
}

function advance(
  state: State,
  frame: ActionFrame,
  ticks = 1,
  gentleTiming = false,
): State {
  let next = state;
  for (let i = 0; i < ticks; i += 1) {
    next = step(world, next, frame, { gentleTiming, textSpeed: "instant" }).state;
  }
  return next;
}

function confirmOnce(state: State, gentleTiming = false): State {
  const pressed = advance(state, press({ confirm: true }), 1, gentleTiming);
  return advance(pressed, none, 1, gentleTiming);
}

/** Plays a single active battle timing check cleanly to completion. */
function playCheckToGrade(state: State, gentleTiming = false): State {
  let next = state;
  for (let guard = 0; guard < 600 && next.battle?.phase === "check"; guard += 1) {
    const check = next.battle.check;
    if (check === null) break;
    if (check.kind === "ring") {
      const hit = check.tick + 1 === check.spec.targetTick;
      next = advance(next, hit ? press({ confirm: true }) : none, 1, gentleTiming);
    } else if (check.kind === "charge") {
      const hold = check.tick >= check.spec.waitTicks && check.held < check.spec.targetTick;
      next = advance(next, hold ? press({ confirm: true }) : none, 1, gentleTiming);
    } else if (check.kind === "chain") {
      const hit = check.spec.arrivals.some(
        (arrival, idx) => check.results[idx] === "pending" && check.tick + 1 === arrival,
      );
      next = advance(next, hit ? press({ confirm: true }) : none, 1, gentleTiming);
    } else if (check.kind === "catch") {
      const pendingIdx = check.results.findIndex((res) => res === "pending");
      const lane = pendingIdx >= 0 ? (check.lanes[pendingIdx] ?? 1) : 1;
      const y = lane === 0 ? -1 : lane === 2 ? 1 : 0;
      next = advance(next, press({ move: { x: 0, y } }), 1, gentleTiming);
    } else if (check.kind === "lean") {
      const blowing = check.spec.starts.some(
        (start, idx) =>
          check.results[idx] === "pending" &&
          check.tick >= start &&
          check.tick < start + check.spec.puffTicks,
      );
      const x = blowing ? 1 : check.balance > 6 ? -1 : check.balance < -6 ? 1 : 0;
      next = advance(next, press({ move: { x, y: 0 } }), 1, gentleTiming);
    } else if (check.kind === "trace") {
      const target = check.path.points[check.checkpoint] ?? check.brush;
      next = advance(
        next,
        press({ pointer: { x: Math.round(target.x), y: Math.round(target.y) } }),
        1,
        gentleTiming,
      );
    } else if (check.kind === "peekaboo") {
      const tick = check.tick + 1;
      const unsafe = check.spec.peeks.some(
        (peek) => tick >= peek.start - 2 && tick < peek.end,
      );
      next = advance(next, unsafe ? none : press({ confirm: true }), 1, gentleTiming);
    } else if (check.kind === "echo") {
      const stride = check.spec.demoTicks + check.spec.gapTicks;
      const demoEnd = check.spec.notes * stride;
      if (check.tick < demoEnd) {
        next = advance(next, none, 1, gentleTiming);
      } else {
        const note = check.sequence[check.entered] ?? 0;
        const move = note === 0
          ? { x: 0, y: -1 }
          : note === 1
            ? { x: 1, y: 0 }
            : note === 2
              ? { x: 0, y: 1 }
              : { x: -1, y: 0 };
        next = advance(next, press({ move }), 1, gentleTiming);
        next = advance(next, none, 1, gentleTiming);
      }
    } else {
      next = advance(next, none, 1, gentleTiming);
    }
  }
  return next;
}

/** Completes an active Encore battle cleanly to victory, picking feeling matches & Talk answers. */
function winEncoreBattle(
  initial: State,
  gentleTiming = false,
): { state: State; cues: string[] } {
  let state = initial;
  const cues: string[] = [];
  const stepWithCues = (frame: ActionFrame): void => {
    const prev = state;
    state = step(world, state, frame, { gentleTiming, textSpeed: "instant" }).state;
    cues.push(...soundCues(prev, state, world));
  };
  for (let guard = 0; guard < 1200 && state.battle !== null; guard += 1) {
    const b = state.battle;
    if (b.phase === "check") {
      const prev = state;
      state = playCheckToGrade(state, gentleTiming);
      cues.push(...soundCues(prev, state, world));
      continue;
    }
    if (b.phase === "talk" && b.talk !== null && b.talk !== undefined) {
      if (b.talk.choices.length > 0) {
        stepWithCues(press({ choose: 0 }));
        stepWithCues(none);
      } else {
        stepWithCues(press({ confirm: true }));
        stepWithCues(none);
      }
      continue;
    }
    if (b.phase === "command") {
      const commands = battleCommands(world, state);
      const talkIdx = commands.findIndex((cmd) => cmd.id === "talk" && !cmd.disabled);
      const feelingIdx = commands.findIndex(
        (cmd) => !cmd.disabled && cmd.feeling !== null && cmd.id !== "snack",
      );
      const primaryIdx = commands.findIndex(
        (cmd) => !cmd.disabled && cmd.id !== "recover" && cmd.id !== "snack" && cmd.id !== "run",
      );
      const pick = talkIdx >= 0 ? talkIdx : feelingIdx >= 0 ? feelingIdx : Math.max(0, primaryIdx);
      stepWithCues(press({ choose: pick }));
      stepWithCues(none);
      continue;
    }
    stepWithCues(press({ confirm: true }));
    stepWithCues(none);
  }
  return { state, cues };
}

describe("Track E18A: Cozy Replay Shrine / Boss Encore", () => {
  it("loads all 9 canonical BOSS_SET_PIECES bosses and 3 Star Challenge modifiers cleanly", () => {
    expect(world.encore).toBeDefined();
    const encore = world.encore!;
    expect(encore.modifiers.map((m) => m.id)).toEqual([...ENCORE_MODIFIER_IDS]);
    expect(encore.bosses.map((b) => b.critterId)).toHaveLength(BOSS_SET_PIECES.length);
    expect(new Set(encore.bosses.map((b) => b.critterId))).toEqual(new Set(BOSS_SET_PIECES));
    expect(new Set(encore.bosses.map((b) => b.trophyId)).size).toBe(encore.bosses.length);
    for (const boss of encore.bosses) {
      expect(world.critters[boss.critterId]).toBeDefined();
    }
    expect(() =>
      parseEncoreContent(
        { ...encore, bosses: [...encore.bosses, encore.bosses[0]] },
        "bad",
        world.critters,
      ),
    ).toThrow();
  });

  it("enforces Sanctuary Shrine unlock rules, spoiler safety, and Ink open event", () => {
    const freshSanctuary = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    expect(isEncoreShrineUnlocked(world, freshSanctuary)).toBe(false);
    const lockedView = buildEncoreShrineView(world, freshSanctuary);
    expect(lockedView.unlocked).toBe(false);
    expect(lockedView.unlockedBosses).toBe(0);
    const lockedFinale = lockedView.bosses.find((b) => b.critterId === "hooded-kid");
    expect(lockedFinale?.unlocked).toBe(false);
    expect(lockedFinale?.title).toBe("Ancient Tree Finale");
    expect(lockedFinale?.title.toLowerCase()).not.toContain("milo");

    // 0 calmed bosses: Ink dream_shrine shows locked teaser without shrine tag
    let dlg = startDialogue(world, freshSanctuary, "dream_shrine");
    expect(dlg.dialogue?.text).toContain("carved limestone lantern");
    expect(dlg.dialogue?.shrine).toBeUndefined();

    // 1 calmed mini-boss (Grumpy Gull): Shrine unlocks ONLY Grumpy Gull
    const gullCalmed: State = {
      ...freshSanctuary,
      critters: { ...freshSanctuary.critters, gull: "calm" },
      stickers: ["lookout-gull"],
    };
    expect(isEncoreShrineUnlocked(world, gullCalmed)).toBe(true);
    const partialView = buildEncoreShrineView(world, gullCalmed);
    expect(partialView.unlockedBosses).toBe(1);
    expect(partialView.finaleUnlocked).toBe(false);
    expect(
      isEncoreBossUnlocked(world, gullCalmed, { critterId: "gull", isFinale: false }),
    ).toBe(true);
    expect(
      isEncoreBossUnlocked(world, gullCalmed, { critterId: "hooded-kid", isFinale: true }),
    ).toBe(false);
    expect(startEncoreBattle(world, gullCalmed, "hooded-kid").battle).toBeNull();

    // Selecting "Open Dream Memory Shrine" emits open-encore-shrine event on dialogue close
    dlg = startDialogue(world, gullCalmed, "dream_shrine");
    dlg = confirmOnce(dlg); // reveal & show choices
    expect(dlg.dialogue?.choices[0]).toBe("Open Dream Memory Shrine");
    dlg = confirmOnce(dlg); // choose option 0 -> line tagged # shrine: encore
    expect(dlg.dialogue?.shrine).toBe("encore");
    const closed = step(world, dlg, press({ confirm: true }), { textSpeed: "instant" });
    expect(closed.state.dialogue).toBeNull();
    expect(closed.events).toContainEqual({ type: "open-encore-shrine" });

    // Post-finale: full 9-boss roster unlocked
    const festival = createState(world, fixtures.festival!);
    const fullView = buildEncoreShrineView(world, festival);
    expect(fullView.unlocked).toBe(true);
    expect(fullView.finaleUnlocked).toBe(true);
    expect(fullView.unlockedBosses).toBe(9);
  });

  it("applies Brisk Breeze across all 8 check kinds and respects Gentle Timing", () => {
    const specs: CheckSpec[] = [
      world.battle.commands.soothe.check,
      world.party.sue!.command!.check,
      world.party.jordan!.command!.check,
      world.critters["arcade-keeper"]!.burst.check,
      world.critters.gull!.burst.check,
      world.critters["hooded-kid"]!.burst.check,
      world.critters["moon-owl"]!.burst.check,
      { kind: "echo", notes: 3, demoTicks: 18, gapTicks: 6, inputTicks: 140 },
    ];
    for (const base of specs) {
      const brisk = applyEncoreCheckSpec(base, ["brisk-breeze"], false);
      const gentle = gentleCheckSpec(base);
      const briskGentle = applyEncoreCheckSpec(base, ["brisk-breeze"], true);
      expect(brisk.kind).toBe(base.kind);
      expect(briskGentle.kind).toBe(base.kind);
      if (
        base.kind === "ring" &&
        brisk.kind === "ring" &&
        gentle.kind === "ring" &&
        briskGentle.kind === "ring"
      ) {
        expect(brisk.greatWindow).toBeLessThan(base.greatWindow);
        expect(briskGentle.greatWindow).toBeGreaterThanOrEqual(base.greatWindow);
        expect(briskGentle.greatWindow).toBeLessThanOrEqual(gentle.greatWindow);
      } else if (
        base.kind === "charge" &&
        brisk.kind === "charge" &&
        gentle.kind === "charge" &&
        briskGentle.kind === "charge"
      ) {
        expect(brisk.greatWindow).toBeLessThan(base.greatWindow);
        expect(briskGentle.greatWindow).toBeGreaterThanOrEqual(base.greatWindow);
        expect(briskGentle.greatWindow).toBeLessThanOrEqual(gentle.greatWindow);
      } else if (
        base.kind === "chain" &&
        brisk.kind === "chain" &&
        gentle.kind === "chain" &&
        briskGentle.kind === "chain"
      ) {
        expect(brisk.hitWindow).toBeLessThan(base.hitWindow);
        expect(briskGentle.hitWindow).toBeGreaterThanOrEqual(base.hitWindow);
      } else if (
        base.kind === "catch" &&
        brisk.kind === "catch" &&
        briskGentle.kind === "catch"
      ) {
        expect(brisk.travelTicks).toBeLessThan(base.travelTicks);
        expect(briskGentle.travelTicks).toBeGreaterThanOrEqual(base.travelTicks);
      } else if (
        base.kind === "lean" &&
        brisk.kind === "lean" &&
        briskGentle.kind === "lean"
      ) {
        expect(brisk.puffTicks).toBeLessThan(base.puffTicks);
        expect(briskGentle.steer).toBeGreaterThanOrEqual(base.steer);
      } else if (
        base.kind === "trace" &&
        brisk.kind === "trace" &&
        briskGentle.kind === "trace"
      ) {
        expect(brisk.reachRadius).toBeLessThan(base.reachRadius);
        expect(briskGentle.reachRadius).toBeGreaterThanOrEqual(base.reachRadius);
      } else if (
        base.kind === "peekaboo" &&
        brisk.kind === "peekaboo" &&
        briskGentle.kind === "peekaboo"
      ) {
        expect(brisk.warningTicks).toBeLessThan(base.warningTicks);
        expect(briskGentle.warningTicks).toBeGreaterThanOrEqual(base.warningTicks);
      } else if (
        base.kind === "echo" &&
        brisk.kind === "echo" &&
        briskGentle.kind === "echo"
      ) {
        expect(brisk.inputTicks).toBeLessThan(base.inputTicks);
        expect(briskGentle.inputTicks).toBeGreaterThanOrEqual(base.inputTicks);
      }
    }
  });

  it("applies Wind-Up Surge and Pure Heart (no snacks + bonus feeling calm)", () => {
    const festival = createState(world, fixtures.festival!);
    const gull = world.critters.gull!;

    // Wind-Up Surge triggers wind-up bubbles on Turn 1 immediately after intro
    const baseWindUp = encoreWindUpSpec(gull.windUp, []);
    const surgedWindUp = encoreWindUpSpec(gull.windUp, ["windup-surge"]);
    expect(baseWindUp?.start).toBe(2);
    expect(surgedWindUp?.start).toBe(1);
    expect(surgedWindUp?.every).toBeLessThan(baseWindUp!.every);
    expect(surgedWindUp?.bubbles).toBeGreaterThan(baseWindUp!.bubbles);

    const surgeStart = startEncoreBattle(world, festival, "gull", ["windup-surge"], "instant");
    const surgeTurn1 = confirmOnce(surgeStart);
    expect(surgeTurn1.battle?.phase).toBe("command");
    expect(surgeTurn1.battle?.windUp).not.toBeNull();
    expect(surgeTurn1.battle?.windUp?.feelings.length).toBeGreaterThanOrEqual(2);

    // Pure Heart disables snacks, filters "hungry" feelings, and grants extra feeling bonus
    const pureStart = startEncoreBattle(world, { ...festival, snacks: 5 }, "gull", [
      "pure-heart",
    ], "instant");
    const pureTurn1 = confirmOnce(pureStart);
    const cmds = battleCommands(world, pureTurn1);
    const snackCmd = cmds.find((c) => c.id === "snack");
    expect(snackCmd?.disabled).toBe(true);
    expect(snackCmd?.detail).toBe("Pure Heart");
    expect(snackCmd?.feeling).toBeNull();
    expect(pureTurn1.battle?.feelings.includes("hungry")).toBe(false);
    expect(encoreFeelingBonus(world, pureTurn1.battle)).toBe(
      world.battle.feelingBonus + world.encore!.pureHeartFeelingBonus,
    );

    // Verify Pure Heart actually awards +10 extra calm on a feeling-matched check
    const plainStart = startEncoreBattle(world, { ...festival, snacks: 5 }, "gull", [], "instant");
    const plainTurn1 = confirmOnce(plainStart);
    const forcedPlain: State = {
      ...plainTurn1,
      battle: { ...plainTurn1.battle!, feelings: ["grumpy", "bored", "grumpy"], windUp: null },
    };
    const forcedPure: State = {
      ...pureTurn1,
      battle: { ...pureTurn1.battle!, feelings: ["grumpy", "bored", "grumpy"], windUp: null },
    };
    const resolveSoothe = (s: State): number => {
      const started = advance(s, press({ choose: 0 }), 1);
      const checked = playCheckToGrade(advance(started, none, 1));
      return checked.battle?.calm ?? 0;
    };
    expect(resolveSoothe(forcedPure) - resolveSoothe(forcedPlain)).toBe(
      world.encore!.pureHeartFeelingBonus,
    );
  });

  it("preserves story flags on win, run, and faint including Ancient Tree Talk replay", () => {
    const base = createState(world, fixtures.festival!);
    const preSnapshot = {
      ink: base.ink,
      critters: { ...base.critters },
      wild: [...base.wild],
      calms: { ...base.calms },
      stickers: [...base.stickers],
      safeSpot: { ...base.safeSpot },
      area: base.area,
    };

    // 1. Win Grumpy Gull with 2 Star Challenges -> bonus coins + 2 stars + Trophy unlocked
    const mods: EncoreModifierId[] = ["brisk-breeze", "pure-heart"];
    const startedGull = startEncoreBattle(world, base, "gull", mods, "instant");
    expect(battleView(world, startedGull)?.encore).toEqual({
      bossId: "gull",
      modifiers: ["brisk-breeze", "pure-heart"],
    });
    const { state: wonGull, cues } = winEncoreBattle(startedGull);
    expect(wonGull.battle).toBeNull();
    expect(wonGull.area).toBe("sanctuary");
    expect(wonGull.player).toEqual(base.player);
    expect(wonGull.coins).toBe(base.coins + computeEncoreCoins(world.encore!, mods));
    expect(wonGull.encore?.trophies).toEqual(["gull-weathervane"]);
    expect(wonGull.encore?.bosses.gull).toEqual({
      clears: 1,
      bestStars: 2,
      modifiersCleared: ["brisk-breeze", "pure-heart"],
    });
    expect(cues).toContain("battle-win");
    expect(cues).toContain("prize-won");
    expect(wonGull.ink).toBe(preSnapshot.ink);
    expect(wonGull.critters).toEqual(preSnapshot.critters);
    expect(wonGull.calms).toEqual(preSnapshot.calms);
    expect(wonGull.stickers).toEqual(preSnapshot.stickers);
    expect(wonGull.safeSpot).toEqual(preSnapshot.safeSpot);

    // 2. Win Ancient Tree Finale (hooded-kid) TWICE using sandboxed talkInk without mutating ink
    const startedFinale1 = startEncoreBattle(
      world, wonGull, "hooded-kid", ["windup-surge"], "instant",
    );
    const { state: afterFinale1 } = winEncoreBattle(startedFinale1);
    expect(afterFinale1.battle).toBeNull();
    expect(afterFinale1.ink).toBe(preSnapshot.ink);
    expect(afterFinale1.encore?.trophies).toContain("ancient-tree-prism");
    expect(afterFinale1.encore?.bosses["hooded-kid"]?.clears).toBe(1);

    const startedFinale2 = startEncoreBattle(
      world, afterFinale1, "hooded-kid", ["brisk-breeze", "windup-surge", "pure-heart"], "instant",
    );
    const { state: afterFinale2 } = winEncoreBattle(startedFinale2);
    expect(afterFinale2.battle).toBeNull();
    expect(afterFinale2.ink).toBe(preSnapshot.ink);
    expect(afterFinale2.encore?.bosses["hooded-kid"]?.clears).toBe(2);
    expect(afterFinale2.encore?.bosses["hooded-kid"]?.bestStars).toBe(3);
    expect(afterFinale2.encore?.bosses["hooded-kid"]?.modifiersCleared).toEqual([
      ...ENCORE_MODIFIER_IDS,
    ]);

    // 3. Run from Ancient Tree Finale (normally canRun: false) exits cleanly without side effects
    const runStart = confirmOnce(
      startEncoreBattle(world, afterFinale2, "hooded-kid", [], "instant"),
    );
    const runIdx = battleCommands(world, runStart).findIndex((c) => c.id === "run");
    expect(runIdx).toBeGreaterThanOrEqual(0);
    const ran = confirmOnce(advance(runStart, press({ choose: runIdx }), 1));
    expect(ran.battle).toBeNull();
    expect(ran.player).toEqual(afterFinale2.player);
    expect(ran.ink).toBe(afterFinale2.ink);
    expect(ran.coins).toBe(afterFinale2.coins);
    expect(ran.encore).toEqual(afterFinale2.encore);

    // 4. Faint (rest) in Encore wakes smoothly at Sanctuary Shrine with NO transition to safeSpot
    const faintBase = startEncoreBattle(world, afterFinale2, "gull", [], "instant");
    const resting: State = {
      ...faintBase,
      battle: { ...faintBase.battle!, phase: "rest", message: "Fae drifts awake!", revealed: 17 },
    };
    const woke = confirmOnce(resting);
    expect(woke.battle).toBeNull();
    expect(woke.transition).toBeNull();
    expect(woke.area).toBe("sanctuary");
    expect(woke.player).toEqual(afterFinale2.player);
    expect(woke.ink).toBe(afterFinale2.ink);
    expect(woke.encore).toEqual(afterFinale2.encore);
  });

  it("keeps v10 saves bit-identical when empty, round-trips encore records, and stays pure", () => {
    const fresh = createState(world, fixtures["new-game"]!);
    expect("encore" in fresh).toBe(false);

    const festival = createState(world, fixtures.festival!);
    const withEncore: State = {
      ...festival,
      encore: recordEncoreVictory(
        undefined,
        { critterId: "arcade-keeper", trophyId: "pip-star-token" },
        ["pure-heart", "brisk-breeze"],
      ),
    };
    const json = serializeSave(withEncore);
    expect(JSON.parse(json).version).toBe(10);
    const restored = parseSave(json, fresh);
    expect(restored).not.toBeNull();
    expect(stableHash(restored)).toBe(stableHash(withEncore));
    expect(encoreSummary(world, restored!).trophiesEarned).toBe(1);
    expect(encoreSummary(world, restored!).starsEarned).toBe(2);

    // Reject malformed encore payloads
    const badMod = JSON.stringify({
      version: 10,
      state: {
        ...festival,
        encore: {
          bosses: { gull: { clears: 1, bestStars: 1, modifiersCleared: ["invalid"] } },
          trophies: [],
        },
      },
    });
    expect(parseSave(badMod, fresh)).toBeNull();

    // Pure core check on src/core/encore.ts
    const source = stripComments(readFileSync("src/core/encore.ts", "utf8"));
    expect(importErrors("src/core/encore.ts", source)).toEqual([]);
  });
});
