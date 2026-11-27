import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as battleModule from "../../src/ui/battle";
import * as battleOverlaysModule from "../../src/ui/battle-overlays";
import {
  battleActionKeys,
  classifyBattlePopup,
  type BattlePopupSnapshot,
} from "../../src/ui/battle";

describe("Milestone 134: Battle Assist Popups, Gamepad Badges & Battle Overlays", () => {
  const base: BattlePopupSnapshot = {
    battleKey: "owl",
    calm: 20,
    energy: 4,
    poppedCount: 0,
    message: "What will Fae do?",
    tick: 200,
    fluteUsed: false,
    lassoUsed: false,
    lanternPeek: false,
    togetherActive: false,
  };

  it("classifies FLUTE!, STEADY!, MOOD PEEK!, and TOGETHER! strictly on false->true transitions",
    () => {
      expect(classifyBattlePopup(base, { ...base, fluteUsed: true, tick: 201 })).toEqual([
        { kind: "assist", text: "FLUTE! ♪", side: "fae" },
      ]);

      expect(classifyBattlePopup(base, { ...base, lassoUsed: true, tick: 201 })).toEqual([
        { kind: "steady", text: "STEADY! ✦", side: "critter" },
      ]);

      expect(classifyBattlePopup(base, { ...base, lanternPeek: true, tick: 201 })).toEqual([
        { kind: "peek", text: "MOOD PEEK! ✦", side: "critter" },
      ]);

      expect(classifyBattlePopup(base, { ...base, togetherActive: true, tick: 201 })).toEqual([
        { kind: "big", text: "TOGETHER! ★", side: "fae" },
      ]);

      // Handles undefined -> true as well (e.g. partial older snapshots).
      const bare: BattlePopupSnapshot = {
        battleKey: "owl",
        calm: 20,
        energy: 4,
        poppedCount: 0,
        message: "What will Fae do?",
        tick: 200,
      };
      expect(
        classifyBattlePopup(bare, {
          ...bare,
          calm: 45,
          fluteUsed: true,
          tick: 201,
        }),
      ).toEqual([
        { kind: "normal", text: "+25", side: "critter" },
        { kind: "assist", text: "FLUTE! ♪", side: "fae" },
      ]);

      // Steady true->true frames, battle switch, open/close, and tick rewind emit [].
      const active: BattlePopupSnapshot = {
        ...base,
        fluteUsed: true,
        lassoUsed: true,
        lanternPeek: true,
        togetherActive: true,
        tick: 201,
      };
      expect(classifyBattlePopup(active, { ...active, tick: 202 })).toEqual([]);
      expect(classifyBattlePopup(null, active)).toEqual([]);
      expect(classifyBattlePopup(active, null)).toEqual([]);
      expect(
        classifyBattlePopup(base, { ...active, battleKey: "gull", tick: 201 }),
      ).toEqual([]);
      expect(classifyBattlePopup(base, { ...active, tick: 199 })).toEqual([]);
    },
  );

  it("maps battleActionKeys accurately for keyboard and gamepad input modes", () => {
    expect(battleActionKeys("keyboard")).toEqual({
      together: "X",
      lasso: "R",
      flute: "F",
      peek: "I",
    });
    expect(battleActionKeys("gamepad")).toEqual({
      together: "B",
      lasso: "LB",
      flute: "RB",
      peek: "View",
    });
  });

  it("extracts battle overlays into src/ui/battle-overlays.ts and trims src/ui/battle.ts", () => {
    expect(battleModule.createRewardSticker).toBe(battleOverlaysModule.createRewardSticker);
    expect(battleModule.createFeelingBubble).toBe(battleOverlaysModule.createFeelingBubble);
    expect(battleModule.createWindUpBubbles).toBe(battleOverlaysModule.createWindUpBubbles);
    expect(battleModule.createCommandMenu).toBe(battleOverlaysModule.createCommandMenu);
    expect(battleModule.battleCommandPreview).toBe(battleOverlaysModule.battleCommandPreview);

    const battleLines = readFileSync("src/ui/battle.ts", "utf8").split("\n").length;
    expect(battleLines).toBeLessThan(700);
  });
});
