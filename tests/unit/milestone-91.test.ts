import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  battleParty,
  chooseRoamTarget,
  nextNotice,
  noticed,
  partyCommand,
  partySlots,
  presentCritters,
  rollWild,
  stepParty,
  stepWild,
  syncParty,
  touchingCritter,
  visibleFollowerSlot,
} from "../../src/core";
import * as coreParty from "../../src/core/party";
import * as coreRoam from "../../src/core/roam";
import * as coreSim from "../../src/core/sim";
import { createHaptics } from "../../src/platform/haptics";
import {
  BATTLE_STAGE_MOODS,
  computeBattleStageMoodLayout,
  evaluateFluteCameo,
  resolveBattleVfxPosition,
  resolveFluteCameoIds,
} from "../../src/render/battle-stage";
import { atlasImagePath, parseAtlasJson } from "../../src/ui/atlas";

const { world } = loadContent();

describe("Milestone 91: WebP atlas resolution, modular core/render, and haptics", () => {
  it("resolves atlasImagePath from meta.image, nested paths, and .png fallback", () => {
    const webpSheet = parseAtlasJson(
      { frames: {}, meta: { size: { w: 512, h: 512 }, image: "frog.webp" } },
      "frog.json",
    );
    expect(atlasImagePath("assets/critters/frog/frog.json", webpSheet)).toBe(
      "assets/critters/frog/frog.webp",
    );
    expect(atlasImagePath("frog.json", webpSheet)).toBe("frog.webp");

    const nestedProp = parseAtlasJson(
      { frames: {}, meta: { size: { w: 1024, h: 1024 }, image: "props-1.webp" } },
      "props-1.json",
    );
    expect(atlasImagePath("assets/areas/plaza/props-1.json", nestedProp)).toBe(
      "assets/areas/plaza/props-1.webp",
    );

    const noImageSheet = parseAtlasJson(
      { frames: {}, meta: { size: { w: 256, h: 256 } } },
      "legacy.json",
    );
    expect(atlasImagePath("assets/legacy/item.json", noImageSheet)).toBe("assets/legacy/item.png");
    expect(atlasImagePath("assets/legacy/item.json")).toBe("assets/legacy/item.png");
  });

  it("verifies every world atlas JSON resolves to an existing image file under public/", () => {
    const atlases = new Set<string>([
      "assets/characters/fae/fae.json",
      "assets/ambient/ambient.json",
      "assets/glows/glows.json",
      "assets/arcade/moles.json",
      "assets/arcade/cook-food.json",
      "assets/arcade/fish-catches.json",
      "assets/arcade/comet.json",
      world.arcade.atlas,
      world.battle.toyAtlas,
    ]);
    for (const character of Object.values(world.characters)) atlases.add(character.atlas);
    for (const member of Object.values(world.party)) atlases.add(member.atlas);
    for (const critter of Object.values(world.critters)) atlases.add(critter.atlas);
    for (const area of Object.values(world.areas)) {
      for (const atlas of area.atlases) {
        atlases.add(atlas);
      }
    }

    expect(Object.keys(world.areas).length).toBeGreaterThanOrEqual(23);
    expect(atlases.size).toBeGreaterThanOrEqual(87);

    for (const atlasRel of atlases) {
      const jsonPath = `public/${atlasRel}`;
      expect(existsSync(jsonPath), `missing atlas JSON ${jsonPath}`).toBe(true);
      const sheet = parseAtlasJson(JSON.parse(readFileSync(jsonPath, "utf8")), jsonPath);
      expect(sheet.meta.image, `${jsonPath} missing meta.image`).toBeDefined();
      expect(sheet.meta.image?.endsWith(".webp"), `${jsonPath} should reference .webp`).toBe(true);
      const resolved = atlasImagePath(jsonPath, sheet);
      expect(existsSync(resolved), `missing atlas image ${resolved} from ${jsonPath}`).toBe(true);
    }
  });

  it("keeps party and roam exports identically reachable from src/core and src/core/sim", () => {
    expect(battleParty).toBe(coreParty.battleParty);
    expect(partySlots).toBe(coreParty.partySlots);
    expect(partyCommand).toBe(coreParty.partyCommand);
    expect(visibleFollowerSlot).toBe(coreParty.visibleFollowerSlot);
    expect(syncParty).toBe(coreParty.syncParty);
    expect(stepParty).toBe(coreParty.stepParty);
    expect(coreSim.battleParty).toBe(coreParty.battleParty);
    expect(coreSim.partySlots).toBe(coreParty.partySlots);

    expect(rollWild).toBe(coreRoam.rollWild);
    expect(presentCritters).toBe(coreRoam.presentCritters);
    expect(stepWild).toBe(coreRoam.stepWild);
    expect(touchingCritter).toBe(coreRoam.touchingCritter);
    expect(nextNotice).toBe(coreRoam.nextNotice);
    expect(noticed).toBe(coreRoam.noticed);
    expect(chooseRoamTarget).toBe(coreRoam.chooseRoamTarget);
    expect(coreSim.rollWild).toBe(coreRoam.rollWild);
    expect(coreSim.presentCritters).toBe(coreRoam.presentCritters);

    expect(partyCommand(world, "maddie")?.id).toBe("play");
    expect(partyCommand(world, "pond-pup")).toBeNull();
  });

  it("computes battle-stage moods, flute cameos, and VFX anchors cleanly", () => {
    for (const mood of Object.keys(BATTLE_STAGE_MOODS)) {
      const key = mood === "calm-normal" || mood === "windup" || mood === "together-ready" ||
          mood === "together-active" || mood === "soothed"
        ? mood
        : "calm-normal";
      const layout = computeBattleStageMoodLayout(key, 30, 1280, 720);
      expect(layout.waveA.alpha).toBeGreaterThan(0);
      expect(layout.spotlight.width).toBeGreaterThan(0);
    }

    const ids = resolveFluteCameoIds(world, "", "Fae plays her flute! Pond Pup hops in!");
    expect(ids).toEqual(["pond-pup"]);
    const cameo = evaluateFluteCameo({
      ids,
      showingFluteLine: true,
      cameoElapsed: 0,
      tick: 12,
      faeX: 300,
      faeY: 500,
      party: world.party,
    });
    expect(cameo.actors.length).toBe(1);
    expect(cameo.sparkles.length).toBe(4);

    const anchors = {
      fae: { x: 200, y: 400 },
      critter: { x: 800, y: 300 },
      party: new Map([["maddie", { x: 140, y: 420 }]]),
    };
    const mid = resolveBattleVfxPosition(
      {
        texture: "sparkle",
        anchor: "between",
        t: 0.5,
        offsetX: 10,
        offsetY: -5,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        alpha: 1,
        tint: 0xffffff,
        blend: "normal",
      },
      anchors,
    );
    expect(mid).toEqual({ x: 510, y: 345 });
  });

  it("creates haptics that safely no-op in Node/Vitest without throwing", () => {
    const haptics = createHaptics();
    expect(typeof haptics.supported()).toBe("boolean");
    expect(() => haptics.trigger("light")).not.toThrow();
    expect(() => haptics.trigger("medium")).not.toThrow();
    expect(() => haptics.trigger("celebrate")).not.toThrow();
  });
});
