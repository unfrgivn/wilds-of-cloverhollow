import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  battleView,
  createState,
  startBattle,
  type State,
} from "../../src/core";
import * as atmosphereIndoor from "../../src/render/atmosphere-indoor";
import * as atmosphereRooms from "../../src/render/atmosphere-rooms";
import { buildBattleHudView } from "../../src/shell/view-models";
import { battlePeekData } from "../../src/ui/battle-peek";

const content = loadContent();
const world = content.world;
const rawBayDuo = content.fixtures["bay-duo"];
if (rawBayDuo === undefined) throw new Error("Missing bay-duo fixture");
const bayDuoFixture = rawBayDuo;
const rawPlaza = content.fixtures["plaza"];
if (rawPlaza === undefined) throw new Error("Missing plaza fixture");
const plazaFixture = rawPlaza;

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Milestone 232: Target-Aware Battle Peek & atmosphere-rooms.ts Split (Track E19S)", () => {
  it("resolves multi-foe targets dynamically from state.battle.foes and targetIndex", () => {
    const state = createState(world, bayDuoFixture);
    if (state.battle === null || state.battle.foes === undefined) {
      throw new Error("Expected active multi-foe battle in bay-duo");
    }
    expect(state.battle.foes.length).toBeGreaterThanOrEqual(2);

    const foe0Peek = battlePeekData(world, state);
    if (foe0Peek === null) throw new Error("Expected foe 0 peek data");
    expect(foe0Peek.critterId).toBe("pup");
    expect(foe0Peek.name).toBe("Zoomie Pup");
    expect(foe0Peek.checkLabel).toBe("Toy Catch");
    expect(foe0Peek.intentNote).toBeNull();
    expect(foe0Peek.phase2Note).toBeNull();

    // Switching targetIndex to 1 resolves foe 1 even if battle.critterId stays on foe 0.
    const target1State: State = {
      ...state,
      battle: { ...state.battle, critterId: "pup", targetIndex: 1 },
    };
    const foe1Peek = battlePeekData(world, target1State);
    if (foe1Peek === null) throw new Error("Expected foe 1 peek data");
    expect(foe1Peek.critterId).toBe("crab");
    expect(foe1Peek.name).toBe("Snappy Crab");
    expect(foe1Peek.checkLabel).toBe("Rhythm Chain");
    expect(foe1Peek.tip).toContain("confirm");
    expect(foe1Peek.critterId).not.toBe(foe0Peek.critterId);
    expect(foe1Peek.checkLabel).not.toBe(foe0Peek.checkLabel);
    expect(foe1Peek.tip).not.toBe(foe0Peek.tip);

    // If the indexed foe is already soothed, fall back to the first un-soothed foe.
    const soothedFirst: State = {
      ...state,
      battle: {
        ...state.battle,
        targetIndex: 0,
        foes: state.battle.foes.map((foe, idx) =>
          idx === 0 ? { ...foe, soothed: true } : foe,
        ),
      },
    };
    const fallbackPeek = battlePeekData(world, soothedFirst);
    expect(fallbackPeek?.critterId).toBe("crab");
  });

  it("formats intentNote and phase2Note cleanly and adapts tips for gamepad without keyboard diff",
    () => {
      const state = createState(world, bayDuoFixture);
      if (state.battle === null) throw new Error("Expected active battle");
      const crabState: State = {
        ...state,
        battle: { ...state.battle, targetIndex: 1 },
      };

      const defaultPeek = battlePeekData(world, crabState);
      const keyboardPeek = battlePeekData(world, crabState, { inputMode: "keyboard" });
      const gamepadPeek = battlePeekData(world, crabState, {
        inputMode: "gamepad",
        intentLabel: "Calling Cheer",
        intentDetail: "Cheering on its teammate!",
        phase2Title: "Encore Finale",
        phase2Rhythm: "Double Time",
      });

      if (defaultPeek === null || keyboardPeek === null || gamepadPeek === null) {
        throw new Error("Expected peek data");
      }

      expect(keyboardPeek.tip).toBe(defaultPeek.tip);
      expect(keyboardPeek.tip).toContain("confirm");
      expect(gamepadPeek.tip).not.toContain("confirm");
      expect(gamepadPeek.tip).toContain("Tap A right as each bouncing beat");
      expect(gamepadPeek.intentNote).toBe("Calling Cheer — Cheering on its teammate!");
      expect(gamepadPeek.phase2Note).toBe("Phase 2 · Encore Finale (Double Time)");

      const labelOnly = battlePeekData(world, crabState, {
        intentLabel: "Puffing Up",
        phase2Title: "Starlight Rush",
      });
      expect(labelOnly?.intentNote).toBe("Puffing Up");
      expect(labelOnly?.phase2Note).toBe("Phase 2 · Starlight Rush");
    });

  it("wires targeted multi-foe intent and gamepad inputMode in buildBattleHudView", () => {
    const basePlaza = createState(world, plazaFixture);
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("Missing fountain-frog");
    const singleState: State = {
      ...basePlaza,
      battle: { ...startBattle(world, basePlaza, frog), phase: "command" },
    };
    const singleHud = buildBattleHudView({
      world,
      state: singleState,
      battle: battleView(world, singleState),
      partyCommands: {},
      paused: false,
      canPeek: true,
      peekOpen: true,
      speakerPortrait: () => null,
      inputMode: "keyboard",
    });
    expect(singleHud.peek?.critterId).toBe("fountain-frog");
    expect(singleHud.peek?.intentNote).toBeNull();
    expect(singleHud.peek?.phase2Note).toBeNull();

    const duoBase = createState(world, bayDuoFixture);
    if (duoBase.battle === null) throw new Error("Expected bay-duo battle");
    const duoCommand: State = {
      ...duoBase,
      battle: { ...duoBase.battle, phase: "command", targetIndex: 1 },
    };
    const duoHud = buildBattleHudView({
      world,
      state: duoCommand,
      battle: battleView(world, duoCommand),
      partyCommands: {},
      paused: false,
      canPeek: true,
      peekOpen: true,
      speakerPortrait: () => null,
      inputMode: "gamepad",
    });
    expect(duoHud.peek?.critterId).toBe("crab");
    expect(duoHud.peek?.name).toBe("Snappy Crab");
    expect(duoHud.peek?.intentNote).toBe("Calling Cheer — Cheering on its teammate!");
    expect(duoHud.peek?.phase2Note).toBeNull();
    expect(duoHud.peek?.tip).toContain("Tap A right as each bouncing beat");
  });

  it("keeps atmosphere-rooms.ts and battle-peek.ts Pixi/DOM-free and within line budgets", () => {
    expect(atmosphereIndoor.evaluateRoomAtmosphere).toBe(atmosphereRooms.evaluateRoomAtmosphere);

    const roomAreas = [
      "sue-cottage",
      "jordan-cabin",
      "milo-house",
      "rosie-cottage",
      "bedroom",
      "clubhouse",
      "music",
      "art-room",
    ] as const;
    for (const areaId of roomAreas) {
      const opts = {
        clubhouseBloom: true,
        musicRoomHarmony: true,
        artRoomPaletteGlow: true,
      };
      const viaIndoor = atmosphereIndoor.evaluateIndoorAtmosphere(areaId, 1280, 720, 42, opts);
      const viaRooms = atmosphereRooms.evaluateRoomAtmosphere(areaId, 1280, 720, 42, opts);
      expect(viaIndoor, areaId).toEqual(viaRooms);
      expect((viaRooms ?? []).length, areaId).toBeGreaterThan(0);
    }
    expect(atmosphereRooms.evaluateRoomAtmosphere("plaza", 1280, 720, 42)).toBeNull();

    const roomsCode = stripComments(readFileSync("src/render/atmosphere-rooms.ts", "utf8"));
    expect(roomsCode).not.toMatch(/pixi\.js|\bdocument\b|\bwindow\b|\bHTMLElement\b/);

    const peekCode = stripComments(readFileSync("src/ui/battle-peek.ts", "utf8"));
    expect(peekCode).not.toMatch(
      /pixi\.js|\bdocument\b|\bwindow\b|\bHTMLElement\b|["']\.\/dom["']/,
    );

    expect(lineCount("src/ui/battle.ts")).toBeLessThan(650);
    expect(lineCount("src/render/atmosphere-indoor.ts")).toBeLessThan(380);
    expect(lineCount("src/render/atmosphere-rooms.ts")).toBeLessThan(330);
  });
});
