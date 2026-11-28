import { describe, expect, test } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  battleView,
  createCheck,
  createState,
  startFormationBattle,
  type Battle,
  type State,
} from "../../src/core";
import { buildBattleHudView } from "../../src/shell/view-models";
import { spinSnagButtonLabel, whackKeyCap } from "../../src/ui/battle-checks-v2";
import { classifyBattlePopup, type BattlePopupSnapshot } from "../../src/ui/battle-popups";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("missing new-game fixture");

describe("Milestone 200: Track E7 v2 battle check gamepad parity & synergy/phase-2 popups", () => {
  test("whackKeyCap adapts middle slot between keyboard Z and gamepad A", () => {
    expect(whackKeyCap("middle")).toBe("Z");
    expect(whackKeyCap("middle", "keyboard")).toBe("Z");
    expect(whackKeyCap("middle", "gamepad")).toBe("A");
    for (const [slot, arrow] of [
      ["up", "↑"],
      ["right", "→"],
      ["down", "↓"],
      ["left", "←"],
    ] as const) {
      expect(whackKeyCap(slot, "keyboard")).toBe(arrow);
      expect(whackKeyCap(slot, "gamepad")).toBe(arrow);
    }
  });

  test("spinSnagButtonLabel adapts SNAG! for gamepad and preserves SPIN! while spinning", () => {
    expect(spinSnagButtonLabel(false)).toBe("SPIN!");
    expect(spinSnagButtonLabel(false, "keyboard")).toBe("SPIN!");
    expect(spinSnagButtonLabel(false, "gamepad")).toBe("SPIN!");
    expect(spinSnagButtonLabel(true)).toBe("SNAG!");
    expect(spinSnagButtonLabel(true, "keyboard")).toBe("SNAG!");
    expect(spinSnagButtonLabel(true, "gamepad")).toBe("SNAG! [A]");
  });

  test("classifyBattlePopup emits SYNERGY! and PHASE 2! strictly on false -> true edges", () => {
    const base: BattlePopupSnapshot = {
      battleKey: "pup",
      calm: 30,
      energy: 5,
      poppedCount: 0,
      message: "Go!",
      tick: 200,
      comboActive: false,
      bossPhase2: false,
    };

    const comboOn: BattlePopupSnapshot = { ...base, comboActive: true, tick: 201 };
    expect(classifyBattlePopup(base, comboOn)).toEqual([
      { kind: "assist", text: "SYNERGY! ★", side: "fae" },
    ]);
    // Steady frame must never re-fire.
    expect(classifyBattlePopup(comboOn, { ...comboOn, tick: 202 })).toEqual([]);
    // Battle open, close, critter switch, or tick rewind never fires.
    expect(classifyBattlePopup(null, comboOn)).toEqual([]);
    expect(classifyBattlePopup(comboOn, null)).toEqual([]);
    expect(classifyBattlePopup(base, { ...comboOn, battleKey: "crab" })).toEqual([]);
    expect(classifyBattlePopup(base, { ...comboOn, tick: 199 })).toEqual([]);

    const phase2On: BattlePopupSnapshot = { ...base, bossPhase2: true, tick: 201 };
    expect(classifyBattlePopup(base, phase2On)).toEqual([
      { kind: "peek", text: "PHASE 2! ⚡", side: "critter" },
    ]);
    expect(classifyBattlePopup(phase2On, { ...phase2On, tick: 202 })).toEqual([]);
    expect(classifyBattlePopup(null, phase2On)).toEqual([]);
    expect(classifyBattlePopup(phase2On, null)).toEqual([]);
  });

  test("buildBattleHudView populates comboActive only on player-side combo checks", () => {
    const startState = createState(world, fixture);
    const baseBattle = startFormationBattle(world, startState, ["pup", "crab"], "instant");
    const partyCommands: Record<string, string | null> = {};
    const sootheSpec = world.battle.commands.soothe.check;

    const makeHud = (battle: Battle) => {
      const state: State = { ...startState, battle };
      return buildBattleHudView({
        world,
        state,
        battle: battleView(world, state),
        partyCommands,
        paused: false,
        canPeek: true,
        peekOpen: false,
        speakerPortrait: () => null,
      });
    };

    const commandHud = makeHud({ ...baseBattle, phase: "command", command: null });
    expect(commandHud.popupSnapshot?.comboActive).toBe(false);

    const playerComboHud = makeHud({
      ...baseBattle,
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: createCheck(sootheSpec, "critter"),
    });
    expect(playerComboHud.popupSnapshot?.comboActive).toBe(true);

    // Subsequent foe burst check must NOT re-trigger comboActive even while command lingers.
    const foeBurstHud = makeHud({
      ...baseBattle,
      phase: "check",
      command: "combo:bubblegum-lasso-spin",
      check: createCheck(sootheSpec, "fae"),
    });
    expect(foeBurstHud.popupSnapshot?.comboActive).toBe(false);
  });
});
