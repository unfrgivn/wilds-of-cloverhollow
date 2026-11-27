import { describe, expect, it } from "vitest";
import { createState, journalFish, journalKeepsakes, type State } from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import { loadContent } from "../../src/content/load";
import {
  areaMediaAtlases,
  battleCheckOverlay,
  battlePortraitAtlases,
  buildDialogueView,
  buildJournalView,
  buildRewardStickerView,
  COMET_ATLAS,
  createMoleHoleHandler,
  createShellAssets,
  FAE_ATLAS,
  FISH_ATLAS,
  FOOD_ATLAS,
  MOLE_ATLAS,
  ownedJournalAtlases,
} from "../../src/shell/assets";
import { isFacingPoint, resolveHudInteractHint } from "../../src/ui/hud-hints";

const { world, fixtures } = loadContent();

function stateIn(
  fixtureName: string,
  overrides: Partial<State> = {},
  variables: Record<string, boolean> = {},
): State {
  const fixture = fixtures[fixtureName];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  const base = createState(world, fixture, 1);
  const ink = Object.keys(variables).length > 0
    ? setInkVariables(base.ink, variables)
    : base.ink;
  return { ...base, ink, ...overrides };
}

describe(
  "Interactive Fish & Keepsake Lore Cards, Context Key Hints & src/shell/assets.ts",
  () => {
    it("journalFish provides coins, snacks, and non-empty blurb for all 6 catches", () => {
      const state = stateIn("bay", {
        caughtFish: { minnow: 1, starfish: 2 },
      });
      const fish = journalFish(world, state);
      expect(fish).toHaveLength(6);
      for (const entry of fish) {
        expect(entry.coins, entry.id).toBeGreaterThan(0);
        expect(entry.snacks, entry.id).toBeGreaterThanOrEqual(0);
        expect(entry.blurb.trim().length, entry.id).toBeGreaterThan(10);
      }
      const starfish = fish.find((entry) => entry.id === "starfish");
      expect(starfish).toMatchObject({
        id: "starfish",
        name: "Golden Starfish Crown",
        owned: true,
        rare: true,
        coins: 20,
        snacks: 1,
      });
      const minnow = fish.find((entry) => entry.id === "minnow");
      expect(minnow).toMatchObject({
        id: "minnow",
        name: "Bubblegum Minnow",
        owned: true,
        rare: false,
        coins: 4,
        snacks: 0,
      });
    });

    it("journalKeepsakes provides non-empty displaySpot and memory for every keepsake", () => {
      const state = stateIn("clubhouse", {}, { sue_compass: true, jordan_clover: true });
      const keepsakes = journalKeepsakes(world, state);
      expect(keepsakes.length).toBeGreaterThanOrEqual(8);
      for (const entry of keepsakes) {
        expect(entry.displaySpot.trim().length, entry.id).toBeGreaterThan(0);
        expect(entry.displaySpot, entry.id).toContain("Clubhouse");
        expect(entry.memory.trim().length, entry.id).toBeGreaterThan(10);
      }
      const compass = keepsakes.find((entry) => entry.id === "sea-compass");
      expect(compass).toMatchObject({
        id: "sea-compass",
        name: "Sea-Glass Compass",
        source: "Sue's Beach Cottage",
        displaySpot: "Clubhouse Crate",
        owned: true,
      });
    });

    it("resolves context-aware Z key hint labels without false Pet triggers behind Fae", () => {
      const origin = { x: 360, y: 850 };

      // 1. Real interactables always win (custom prompt or default Talk).
      expect(
        resolveHudInteractHint({
          hasInteractable: true,
          interactPrompt: "Fish",
          isResting: false,
          player: origin,
          facing: "up",
          pettableCompanion: { x: 360, y: 800 },
          hasRestSpot: true,
        }),
      ).toEqual({ canInteract: true, interactLabel: "Fish" });
      expect(
        resolveHudInteractHint({
          hasInteractable: true,
          isResting: false,
          player: origin,
          facing: "up",
          pettableCompanion: null,
          hasRestSpot: false,
        }),
      ).toEqual({ canInteract: true, interactLabel: "Talk" });

      // 2. While resting, Z stands Fae back up.
      expect(
        resolveHudInteractHint({
          hasInteractable: false,
          isResting: true,
          player: origin,
          facing: "down",
          pettableCompanion: { x: 360, y: 900 },
          hasRestSpot: true,
        }),
      ).toEqual({ canInteract: true, interactLabel: "Stand" });

      // 3. Pet triggers ONLY when facing the companion (dot >= 0.15).
      expect(isFacingPoint(origin, "left", { x: 308, y: 844 })).toBe(true);
      expect(isFacingPoint(origin, "up", { x: 308, y: 844 })).toBe(false);
      expect(
        resolveHudInteractHint({
          hasInteractable: false,
          isResting: false,
          player: origin,
          facing: "left",
          pettableCompanion: { x: 308, y: 844 },
          hasRestSpot: true,
        }),
      ).toEqual({ canInteract: true, interactLabel: "Pet" });
      expect(
        resolveHudInteractHint({
          hasInteractable: false,
          isResting: false,
          player: origin,
          facing: "up",
          pettableCompanion: { x: 308, y: 844 },
          hasRestSpot: false,
        }),
      ).toEqual({ canInteract: false, interactLabel: "Talk" });

      // 4. Rest spot activates Rest when not facing a pettable companion.
      expect(
        resolveHudInteractHint({
          hasInteractable: false,
          isResting: false,
          player: origin,
          facing: "up",
          pettableCompanion: { x: 308, y: 844 },
          hasRestSpot: true,
        }),
      ).toEqual({ canInteract: true, interactLabel: "Rest" });
    });

    it("exports clean shell asset helpers and projects journal/battle/dialogue views", () => {
      expect(typeof createShellAssets).toBe("function");
      expect(typeof battleCheckOverlay).toBe("function");
      expect(typeof buildRewardStickerView).toBe("function");
      expect(typeof buildDialogueView).toBe("function");
      expect(MOLE_ATLAS).toBe("assets/arcade/moles.json");
      expect(FOOD_ATLAS).toBe("assets/arcade/cook-food.json");
      expect(FISH_ATLAS).toBe("assets/arcade/fish-catches.json");
      expect(COMET_ATLAS).toBe("assets/arcade/comet.json");
      expect(FAE_ATLAS).toBe("assets/characters/fae/fae.json");

      const bedroom = world.areas.bedroom;
      const plaza = world.areas.plaza;
      if (bedroom === undefined || plaza === undefined) throw new Error("missing areas");
      expect(areaMediaAtlases(world, bedroom)).toEqual(["assets/characters/mom/mom.json"]);
      expect(areaMediaAtlases(world, plaza).length).toBeGreaterThan(0);

      const journalState = stateIn(
        "plaza",
        {
          journalOpen: true,
          stickers: ["fountain-frog"],
          prizes: ["frog-plush"],
          caughtFish: { starfish: 1 },
        },
        { has_lantern: true, has_flute: true, has_lasso: true },
      );
      const journalAtlases = ownedJournalAtlases(world, journalState);
      expect(journalAtlases).toContain(world.arcade.atlas);
      expect(journalAtlases).toContain(FISH_ATLAS);

      const portraitAtlases = battlePortraitAtlases(world, journalState);
      expect(portraitAtlases).toContain(FAE_ATLAS);

      const view = buildJournalView({
        world,
        state: journalState,
        notes: ["A sunny test note"],
        mapCentres: { cloverhollow: { x: 100, y: 200 } },
        art: {
          stickerArt: () => null,
          prizeArt: () => null,
          fishArt: () => null,
        },
        muted: false,
        level: 1,
        musicMuted: false,
        musicLevel: 0.75,
        ambienceMuted: false,
        nowPlaying: "Cloverhollow Town",
        gentleTiming: false,
        keyHints: false,
        textSpeed: "cozy",
        reducedMotion: false,
        hasLantern: true,
        hasFlute: true,
        hasLasso: true,
      });
      expect(view.hasLasso).toBe(true);
      expect(view.fish?.find((item) => item.id === "starfish")?.coins).toBe(20);
      expect(view.keepsakes?.length).toBeGreaterThanOrEqual(8);

      const events: string[] = [];
      const onHole = createMoleHoleHandler({
        setButton: (button, down) => events.push(`set:${button}:${down}`),
        tapButton: (button) => events.push(`tap:${button}`),
        holdArrow: (dir) => events.push(`hold:${dir.x},${dir.y}`),
        tapArrow: (dir) => events.push(`tapArrow:${dir.x},${dir.y}`),
        releaseArrow: (dir) => events.push(`rel:${dir.x},${dir.y}`),
      });
      onHole("middle", true);
      onHole("up", true);
      onHole("up", false);
      expect(events).toEqual([
        "set:confirm:true",
        "tap:confirm",
        "hold:0,-1",
        "tapArrow:0,-1",
        "rel:0,-1",
      ]);
    });
  },
);
