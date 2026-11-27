import { describe, expect, it } from "vitest";
import * as battleParsers from "../../src/content/battle-parsers";
import * as contentLoad from "../../src/content/load";
import { createState } from "../../src/core";
import {
  createHaptics,
  GAMEPAD_RUMBLE_EFFECTS,
  hasRumbleGamepad,
  triggerGamepadRumble,
  type HapticKind,
  type RumbleParams,
} from "../../src/platform/haptics";
import { evaluateStarGemGlints } from "../../src/render/overworld-render";
import { STAR_GEM_CHARM_SPEC, type VfxTextureKey } from "../../src/render/vfx-textures";

describe("Milestone 121: Dual-Rumble Gamepad Haptics", () => {
  it("invokes playEffect('dual-rumble', ...) with exact GAMEPAD_RUMBLE_EFFECTS per kind", () => {
    const calls: { type: string; params: RumbleParams & { startDelay: number } }[] = [];
    const pad = {
      connected: true,
      vibrationActuator: {
        playEffect(type: string, params: RumbleParams & { startDelay: number }): Promise<string> {
          calls.push({ type, params });
          return Promise.resolve("complete");
        },
      },
    };
    const silentPad = { connected: true };
    const disconnectedPad = {
      connected: false,
      vibrationActuator: {
        playEffect(): void {
          throw new Error("disconnected pad should not be called");
        },
      },
    };

    expect(hasRumbleGamepad([null, undefined, silentPad, disconnectedPad])).toBe(false);
    expect(hasRumbleGamepad([null, silentPad, pad])).toBe(true);

    const kinds: readonly HapticKind[] = ["light", "medium", "celebrate"];
    for (const kind of kinds) {
      expect(triggerGamepadRumble([null, silentPad, disconnectedPad, pad], kind)).toBe(true);
    }

    expect(calls).toEqual([
      { type: "dual-rumble", params: { startDelay: 0, ...GAMEPAD_RUMBLE_EFFECTS.light } },
      { type: "dual-rumble", params: { startDelay: 0, ...GAMEPAD_RUMBLE_EFFECTS.medium } },
      { type: "dual-rumble", params: { startDelay: 0, ...GAMEPAD_RUMBLE_EFFECTS.celebrate } },
    ]);
    expect(GAMEPAD_RUMBLE_EFFECTS).toEqual({
      light: { duration: 35, strongMagnitude: 0.08, weakMagnitude: 0.22 },
      medium: { duration: 70, strongMagnitude: 0.22, weakMagnitude: 0.45 },
      celebrate: { duration: 150, strongMagnitude: 0.38, weakMagnitude: 0.65 },
    });
  });

  it("ignores pads without actuators and swallows thrown or rejected playEffect errors", () => {
    const throwingPad = {
      connected: true,
      vibrationActuator: {
        playEffect(): never {
          throw new Error("actuator busy");
        },
      },
    };
    let secondFired = false;
    const rejectingPad = {
      connected: true,
      vibrationActuator: {
        playEffect(): Promise<never> {
          secondFired = true;
          return Promise.reject(new Error("user gesture required"));
        },
      },
    };

    expect(triggerGamepadRumble([null, { connected: true }, throwingPad], "light")).toBe(false);
    expect(triggerGamepadRumble([throwingPad, rejectingPad], "medium")).toBe(true);
    expect(secondFired).toBe(true);
  });

  it("safely initializes createHaptics in Node without throwing", () => {
    const haptics = createHaptics();
    expect(typeof haptics.supported()).toBe("boolean");
    expect(() => haptics.trigger("light")).not.toThrow();
    expect(() => haptics.trigger("medium")).not.toThrow();
    expect(() => haptics.trigger("celebrate")).not.toThrow();
  });
});

describe("Milestone 121: Modular src/content/battle-parsers.ts Extraction", () => {
  it("re-exports every battle/critter/party/sticker/treat parser identically from load.ts", () => {
    expect(contentLoad.parseCritter).toBe(battleParsers.parseCritter);
    expect(contentLoad.parseBattleContent).toBe(battleParsers.parseBattleContent);
    expect(contentLoad.feelingErrors).toBe(battleParsers.feelingErrors);
    expect(contentLoad.parsePartyMember).toBe(battleParsers.parsePartyMember);
    expect(contentLoad.partyJoinErrors).toBe(battleParsers.partyJoinErrors);
    expect(contentLoad.partyErrors).toBe(battleParsers.partyErrors);
    expect(contentLoad.critterErrors).toBe(battleParsers.critterErrors);
    expect(contentLoad.parseStickers).toBe(battleParsers.parseStickers);
    expect(contentLoad.parseLevels).toBe(battleParsers.parseLevels);
    expect(contentLoad.parseTreats).toBe(battleParsers.parseTreats);
    expect(contentLoad.talkErrors).toBe(battleParsers.talkErrors);
  });
});

describe("Milestone 121: Hand-Inked Star Gem Sparkle Charm Spec", () => {
  it("keeps starGemCharm in VfxTextureKey and evaluateStarGemGlints consistent", () => {
    const key: VfxTextureKey = "starGemCharm";
    expect(key).toBe("starGemCharm");
    expect(STAR_GEM_CHARM_SPEC).toEqual({
      size: 48,
      outerR: 17,
      innerR: 5.5,
      strokeWidth: 2.6,
      glintRadius: 3.2,
    });
    expect(STAR_GEM_CHARM_SPEC.outerR + STAR_GEM_CHARM_SPEC.strokeWidth).toBeLessThan(
      STAR_GEM_CHARM_SPEC.size / 2,
    );

    const { world, fixtures } = contentLoad.loadContent();
    const fixture = fixtures.hills ?? fixtures["new-game"];
    if (fixture === undefined) throw new Error("Missing hills fixture");
    const state = { ...createState(world, fixture, 1), area: "hills", tick: 12 };
    const glints = evaluateStarGemGlints(world, state, false);
    expect(glints).toHaveLength(1);
    const glint = glints[0];
    if (glint === undefined) throw new Error("Expected hills Star Gem glint");
    expect(glint.starScale * 1.15).toBeGreaterThan(0.39);
    expect(glint.starAlpha).toBe(0.88);
  });
});
