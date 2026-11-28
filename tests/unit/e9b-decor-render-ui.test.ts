import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  CLUBHOUSE_SWATCH_IDS,
  CLUBHOUSE_VISITOR_POINT,
  CLUBHOUSE_VISITORS,
  createState,
  equipClubhouseSwatch,
  setInkVariables,
  toggleBedroomShelfPrize,
  unlockClubhouseSwatch,
  unlockPlushPedestals,
  type State,
} from "../../src/core";
import { dialoguePartner } from "../../src/render/animation";
import {
  evaluateBedroomDisplay,
  evaluateClubhouseDecor,
  evaluateClubhouseDisplay,
} from "../../src/render/clubhouse-display";
import {
  areaEntityAtlases,
  computeGlowTransform,
  evaluateStarGemGlints,
} from "../../src/render/overworld-render";
import { areaMediaAtlases } from "../../src/shell/assets";
import {
  canOverworldSteer,
  canPhotoMode,
  createInputShortcuts,
  isOverworldFree,
  type OverlayGateContext,
  type ShortcutKeyEvent,
} from "../../src/shell/input-shortcuts";

const content = loadContent();
const { world } = content;
const rawNewGame = content.fixtures["new-game"];
if (rawNewGame === undefined) throw new Error("Missing new-game fixture");
const newGameFixture = rawNewGame;

function stateIn(
  areaId: string,
  overrides: Partial<State> = {},
  inkVars: Record<string, boolean | number> = {},
): State {
  const base = createState(world, newGameFixture);
  const area = world.areas[areaId];
  const spawn = area === undefined ? base.player : Object.values(area.spawns)[0] ?? base.player;
  const ink =
    Object.keys(inkVars).length === 0 ? base.ink : setInkVariables(base.ink, inkVars);
  return {
    ...base,
    area: areaId,
    player: { x: spawn.x, y: spawn.y },
    ink,
    ...overrides,
  };
}

function fakeKeyEvent(code: string, repeat = false): ShortcutKeyEvent & { prevented: boolean } {
  const event = {
    code,
    repeat,
    target: null,
    prevented: false,
    preventDefault() {
      event.prevented = true;
    },
    stopPropagation() {},
  };
  return event;
}

describe("E9B Step 2: Bedroom Shelf, Clubhouse Decor, Visiting Friends & Blessing VFX", () => {
  it("evaluates Bedroom shelf display with 4 base slots, 5 with pedestals, custom order", () => {
    const owned = [
      "frog-plush",
      "pup-plush",
      "cat-plush",
      "bunny-plush",
      "bluebird-plush",
      "owl-plush",
    ];
    expect(evaluateBedroomDisplay(world, stateIn("clubhouse", { prizes: owned }))).toEqual([]);
    expect(evaluateBedroomDisplay(world, stateIn("bedroom", { prizes: [] }))).toEqual([]);

    const baseState = stateIn("bedroom", { prizes: owned, coins: 200 });
    const baseDisplay = evaluateBedroomDisplay(world, baseState);
    expect(baseDisplay).toHaveLength(4);
    expect(baseDisplay.every((entry) => entry.pedestal === false)).toBe(true);
    expect(baseDisplay[0]?.x).toBe(world.areas.bedroom?.shelfAnchors?.[0]?.x);

    const withPedestals = unlockPlushPedestals(world, baseState, "coins");
    const expanded = evaluateBedroomDisplay(world, withPedestals);
    expect(expanded).toHaveLength(5);
    expect(expanded.every((entry) => entry.pedestal === true)).toBe(true);

    const toggledOff = toggleBedroomShelfPrize(world, withPedestals, "frog-plush");
    const toggledOn = toggleBedroomShelfPrize(world, toggledOff, "owl-plush");
    const customDisplay = evaluateBedroomDisplay(world, toggledOn);
    expect(customDisplay.map((entry) => entry.id)).toContain("owl-plush");
    expect(customDisplay.map((entry) => entry.id)).not.toContain("frog-plush");
  });

  it("evaluates Clubhouse decor swatches cleanly and leaves classic / non-clubhouse null", () => {
    const baseClub = stateIn("clubhouse", { coins: 500 });
    expect(evaluateClubhouseDecor(baseClub)).toBeNull();
    expect(evaluateClubhouseDecor(stateIn("bedroom", { coins: 500 }))).toBeNull();

    // Preserve exact evaluateClubhouseDisplay shape
    expect(evaluateClubhouseDisplay(world, baseClub)).toEqual({
      prizes: [],
      keepsakes: [],
      encoreTrophy: null,
    });

    const nonClassic = CLUBHOUSE_SWATCH_IDS.filter((id) => id !== "classic");
    for (const swatch of nonClassic) {
      const unlocked = unlockClubhouseSwatch(world, baseClub, swatch, "coins");
      const equipped = equipClubhouseSwatch(unlocked, swatch);
      const early = evaluateClubhouseDecor({ ...equipped, tick: 0 }, false);
      const later = evaluateClubhouseDecor({ ...equipped, tick: 20 }, false);
      const calmA = evaluateClubhouseDecor({ ...equipped, tick: 0 }, true);
      const calmB = evaluateClubhouseDecor({ ...equipped, tick: 120 }, true);

      expect(early).not.toBeNull();
      expect(later).not.toBeNull();
      expect(calmA).toEqual(calmB);
      if (early === null || later === null) continue;

      expect(early.swatch).toBe(swatch);
      expect(early.rug.outerPoly).toHaveLength(4);
      expect(early.rug.innerPoly).toHaveLength(4);
      expect(early.rug.tasselPoints.length).toBeGreaterThan(0);
      expect(early.pennants.length).toBe(11);
      expect(early.ropeSegments.length).toBeGreaterThan(0);
      expect(early.fairyBulbs).toHaveLength(12);
      expect(early.fairyBulbs[0]?.alpha).not.toBe(later.fairyBulbs[0]?.alpha);

      // Keep floor rug strictly clear of the ladder hatch (x >= 571) and deck garden (x >= 650)
      for (const [x] of early.rug.outerPoly) {
        expect(x).toBeLessThan(571);
      }
    }
  });

  it("applies aurora-rubbing & sea-compass glow visibility bonus without changing 0-bonus", () => {
    const glow = { id: "test-glow", frame: "glow_01", point: { x: 400, y: 100 } };
    const player = { x: 40, y: 100 }; // distance = 360 (> 320 base radius, < 448 boosted)
    const baseline = computeGlowTransform(glow, player, 10, 0, 1, true);
    expect(baseline).toEqual(computeGlowTransform(glow, player, 10, 0, 1, true, 0));
    const boosted = computeGlowTransform(glow, player, 10, 0, 1, true, 0.4);
    expect(boosted.alpha).toBeGreaterThan(baseline.alpha);

    const hillsPlain = stateIn("hills", { tick: 15 });
    const hillsAurora = stateIn("hills", { tick: 15 }, { summit_aurora_read: true });
    const hillsBoth = stateIn(
      "hills",
      { tick: 15 },
      { summit_aurora_read: true, sue_compass: true },
    );
    const plainGlint = evaluateStarGemGlints(world, hillsPlain, false)[0];
    const auroraGlint = evaluateStarGemGlints(world, hillsAurora, false)[0];
    const bothGlint = evaluateStarGemGlints(world, hillsBoth, false)[0];
    expect(plainGlint).toBeDefined();
    expect(auroraGlint).toBeDefined();
    expect(bothGlint).toBeDefined();
    if (plainGlint !== undefined && auroraGlint !== undefined && bothGlint !== undefined) {
      expect(auroraGlint.haloSize).toBeGreaterThan(plainGlint.haloSize);
      expect(bothGlint.haloSize).toBeGreaterThan(auroraGlint.haloSize);
      expect(auroraGlint.haloAlpha).toBeGreaterThan(plainGlint.haloAlpha);
      expect(bothGlint.haloAlpha).toBeLessThanOrEqual(0.92);
    }
  });

  it("includes Clubhouse visiting friends in entity/media atlases and dialogue facing", () => {
    const clubhouse = world.areas.clubhouse;
    expect(clubhouse).toBeDefined();
    if (clubhouse === undefined) return;

    const entityAliases = areaEntityAtlases(world, clubhouse).map((entry) => entry.alias);
    for (const id of ["milo", "rosie", "barnaby", "fern"]) {
      expect(entityAliases).toContain(`${id}-sheet`);
    }
    expect(entityAliases).not.toContain("sue-sheet");
    expect(entityAliases).not.toContain("jordan-sheet");

    const mediaAtlases = areaMediaAtlases(world, clubhouse);
    for (const visitor of CLUBHOUSE_VISITORS) {
      const character = world.characters[visitor.id];
      expect(character).toBeDefined();
      if (character !== undefined) {
        expect(mediaAtlases).toContain(character.atlas);
      }
    }

    const withMilo = stateIn(
      "clubhouse",
      {
        dialogue: {
          knot: "club_visit_milo",
          speaker: "Milo",
          text: "Hi Fae!",
          revealed: 7,
          choices: [],
          selected: 0,
          ended: false,
        },
      },
      { clubhouse_claimed: true, milo_revealed: true },
    );
    expect(dialoguePartner(world, withMilo)).toEqual({
      x: CLUBHOUSE_VISITOR_POINT.x,
      y: CLUBHOUSE_VISITOR_POINT.y,
    });
  });

  it("gates overworld shortcuts cleanly when Decor Picker is open and supports KeyB", () => {
    const baseCtx: OverlayGateContext = {
      state: {
        area: "clubhouse",
        dialogue: null,
        battle: null,
        arcade: null,
        journalOpen: false,
        transition: null,
        finale: null,
      },
      titleMode: null,
      qaMenuOpen: false,
      qaConsoleOpen: false,
      qaBlocked: false,
      photoMode: false,
    };

    expect(canOverworldSteer(baseCtx)).toBe(true);
    expect(canPhotoMode(baseCtx)).toBe(true);
    expect(isOverworldFree(baseCtx, false)).toBe(true);

    const openCtx: OverlayGateContext = { ...baseCtx, decorPickerOpen: true };
    expect(canOverworldSteer(openCtx)).toBe(false);
    expect(canPhotoMode(openCtx)).toBe(false);
    expect(isOverworldFree(openCtx, false)).toBe(false);

    let decorOpen = false;
    let photoCalls = 0;
    let currentArea = "clubhouse";
    const shortcuts = createInputShortcuts({
      getContext: () => ({
        ...baseCtx,
        state: { ...baseCtx.state, area: currentArea },
        decorPickerOpen: decorOpen,
      }),
      getBattlePeekOpen: () => false,
      setBattlePeek: () => {},
      setPhotoMode: () => {
        photoCalls += 1;
      },
      snapPostcard: () => {},
      journal: {
        hasOpenOverlay: () => false,
        dismissOverlay: () => false,
        stepOverlay: () => false,
        stepPage: () => {},
        scrollActivePage: () => false,
        navigateFocus: () => false,
        activateFocused: () => false,
      },
      gamepad: {
        poll: () => [],
        consumeActivity: () => false,
        consumePhotoAction: () => null,
        consumeBumperStep: () => 0,
        consumeNavStep: () => null,
        consumeConfirmEdge: () => false,
        rightStickY: () => 0,
        clearTaps: () => {},
      },
      clearKeyboardTaps: () => {},
      swallow: () => {},
      playChoiceMove: () => {},
      invalidate: () => {},
      decorPicker: {
        isOpen: () => decorOpen,
        openForArea: (area) => {
          if (area !== "clubhouse" && area !== "bedroom") return false;
          decorOpen = true;
          return true;
        },
        close: () => {
          decorOpen = false;
        },
        handleKeydown: (event) => {
          if (event.code === "Escape" || event.code === "KeyB" || event.code === "KeyX") {
            decorOpen = false;
            return true;
          }
          return false;
        },
      },
    });

    currentArea = "plaza";
    shortcuts.handleKeydown(fakeKeyEvent("KeyB"));
    expect(decorOpen).toBe(false);

    currentArea = "bedroom";
    const openEv = fakeKeyEvent("KeyB");
    shortcuts.handleKeydown(openEv);
    expect(openEv.prevented).toBe(true);
    expect(decorOpen).toBe(true);

    // Photo mode is blocked while Decor Picker is open
    shortcuts.handleKeydown(fakeKeyEvent("KeyP"));
    expect(photoCalls).toBe(0);

    // Escape closes Decor Picker cleanly
    shortcuts.handleKeydown(fakeKeyEvent("Escape"));
    expect(decorOpen).toBe(false);
  });
});
