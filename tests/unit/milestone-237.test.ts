import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, type State } from "../../src/core";
import { REST_SPOTS } from "../../src/render/companions";
import { PEBBLE_SKIP_SPOTS } from "../../src/render/micro-delights";
import { computePromptScreenView } from "../../src/render/view-projections";
import { buildHudHintsView } from "../../src/shell/view-models";
import { resolveHudInteractHint } from "../../src/ui/hud-hints";

const { world, fixtures } = loadContent();

function stateIn(fixtureName: string, overrides: Partial<State> = {}): State {
  const fixture = fixtures[fixtureName] ?? fixtures["new-game"];
  if (fixture === undefined) throw new Error(`Missing fixture ${fixtureName}`);
  return { ...createState(world, fixture, 1), ...overrides };
}

function lineCount(filePath: string): number {
  return readFileSync(filePath, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 237: Shoreline/Sanctuary Hints, WCAG aria-pressed & Journal Shelves", () => {
  it("resolves HudInteractHint priority cleanly across all 6 overworld cues", () => {
    const base = {
      hasInteractable: false,
      interactPrompt: undefined,
      isResting: false,
      player: { x: 100, y: 100 },
      facing: "right" as const,
      pettableCompanion: null,
      hasRestSpot: false,
      hasPebbleSkip: false,
      hasSanctuaryPet: false,
    };

    // 1. Real interactable wins over everything.
    expect(
      resolveHudInteractHint({
        ...base,
        hasInteractable: true,
        interactPrompt: "Look",
        isResting: true,
        pettableCompanion: { x: 130, y: 100 },
        hasRestSpot: true,
        hasPebbleSkip: true,
        hasSanctuaryPet: true,
      }),
    ).toEqual({ canInteract: true, interactLabel: "Look" });

    // 2. Resting ("Stand") beats companion, rest spot, skip, and sanctuary pet.
    expect(
      resolveHudInteractHint({
        ...base,
        isResting: true,
        pettableCompanion: { x: 130, y: 100 },
        hasRestSpot: true,
        hasPebbleSkip: true,
        hasSanctuaryPet: true,
      }),
    ).toEqual({ canInteract: true, interactLabel: "Stand" });

    // 3. Pettable companion in front cone ("Pet") beats rest spot, skip, and sanctuary pet.
    expect(
      resolveHudInteractHint({
        ...base,
        pettableCompanion: { x: 130, y: 100 },
        hasRestSpot: true,
        hasPebbleSkip: true,
        hasSanctuaryPet: true,
      }),
    ).toEqual({ canInteract: true, interactLabel: "Pet" });

    // 4. Rest spot ("Rest") beats skip and sanctuary pet (even if companion is behind Fae).
    expect(
      resolveHudInteractHint({
        ...base,
        pettableCompanion: { x: 60, y: 100 },
        hasRestSpot: true,
        hasPebbleSkip: true,
        hasSanctuaryPet: true,
      }),
    ).toEqual({ canInteract: true, interactLabel: "Rest" });

    // 5. Shoreline pebble skip ("Skip") beats sanctuary pet.
    expect(
      resolveHudInteractHint({
        ...base,
        pettableCompanion: { x: 60, y: 100 },
        hasPebbleSkip: true,
        hasSanctuaryPet: true,
      }),
    ).toEqual({ canInteract: true, interactLabel: "Skip" });

    // 6. Calm Sanctuary critter ("Pet") resolves when alone.
    expect(resolveHudInteractHint({ ...base, hasSanctuaryPet: true })).toEqual({
      canInteract: true,
      interactLabel: "Pet",
    });

    // 7. Inactive fallback stays "Talk".
    expect(resolveHudInteractHint(base)).toEqual({
      canInteract: false,
      interactLabel: "Talk",
    });
  });

  it("projects buildHudHintsView Skip and Sanctuary Pet cues from real world state", () => {
    const shared = {
      keyHints: true,
      touchActive: false,
      overworldFree: true,
      isResting: false,
      hasLantern: true,
      hasFlute: true,
      muted: false,
      canPhoto: true,
      canBattlePeek: false,
      inputMode: "keyboard" as const,
    };

    const parkSkip = stateIn("park", {
      area: "park",
      player: { x: 765, y: 785 },
      facing: "right",
      party: [],
    });
    const parkHint = buildHudHintsView({ ...shared, world, state: parkSkip });
    expect(parkHint.canInteract).toBe(true);
    expect(parkHint.interactLabel).toBe("Skip");

    const sanctuaryArea = world.areas.sanctuary;
    const frog = sanctuaryArea?.npcs.find((npc) => npc.id === "sanctuary-frog");
    if (frog === undefined) throw new Error("Missing sanctuary-frog NPC");
    const sanctuaryNear = stateIn("sanctuary", {
      area: "sanctuary",
      player: { x: frog.point.x + 70, y: frog.point.y },
      facing: "right",
      party: [],
      critters: { ...stateIn("sanctuary").critters, "fountain-frog": "calm" },
    });
    const sanctuaryHint = buildHudHintsView({ ...shared, world, state: sanctuaryNear });
    expect(sanctuaryHint.canInteract).toBe(true);
    expect(sanctuaryHint.interactLabel).toBe("Pet");
  });

  it("projects floating SKIP at all 3 shorelines and yields to interactables & rest spots", () => {
    const camera = { x: 200, y: 200 };
    expect(PEBBLE_SKIP_SPOTS.map((s) => s.id)).toEqual([
      "park-pond-skip",
      "bay-surf-skip",
      "island-cove-skip",
    ]);

    for (const spot of PEBBLE_SKIP_SPOTS) {
      const atShore = stateIn(spot.area, {
        area: spot.area,
        player: { x: spot.x, y: spot.y },
        facing: "right",
        party: [],
      });
      const view = computePromptScreenView(world, atShore, camera, 1280, 720, 1280, 720);
      expect(view.visible, spot.id).toBe(true);
      expect(view.label, spot.id).toBe("SKIP");
      expect(view.x, spot.id).toBeGreaterThan(0);
      expect(view.y, spot.id).toBeGreaterThan(0);
    }

    // Yields cleanly to real interactables (e.g. bedroom window).
    const bedroomInteract = stateIn("new-game", {
      area: "bedroom",
      player: { x: 640, y: 390 },
      facing: "up",
    });
    const interactPrompt = computePromptScreenView(
      world,
      bedroomInteract,
      { x: 0, y: 0 },
      1280,
      720,
      1280,
      720,
    );
    expect(interactPrompt.label).not.toBe("SKIP");

    // Yields cleanly to rest spots (park-bench does not project SKIP).
    const parkBench = REST_SPOTS.find((spot) => spot.id === "park-bench");
    if (parkBench === undefined) throw new Error("Missing park-bench");
    const atBench = stateIn("park", {
      area: "park",
      player: { x: parkBench.x, y: parkBench.y },
      facing: "right",
      party: [],
    });
    const benchPrompt = computePromptScreenView(world, atBench, camera, 1280, 720, 1280, 720);
    expect(benchPrompt.visible).toBe(false);
  });

  it("declares WCAG aria-pressed on Key Hints toggles and < 650-line src/ui/ budget", () => {
    const hudHintsSrc = readFileSync("src/ui/hud-hints.ts", "utf8");
    expect(hudHintsSrc).toContain(
      'lanternPill.root.setAttribute("aria-pressed", String(view.lanternOn))',
    );
    expect(hudHintsSrc).toContain('mutePill.root.setAttribute("aria-pressed", String(view.muted))');
    expect(hudHintsSrc).toContain('interactPill.root.setAttribute("aria-label", interactText)');

    expect(lineCount("src/ui/journal.ts")).toBeLessThan(460);
    expect(lineCount("src/ui/journal-shelves.ts")).toBeLessThan(300);

    const uiFiles = readdirSync("src/ui")
      .filter((name) => name.endsWith(".ts"))
      .sort()
      .map((name) => join("src/ui", name));
    expect(uiFiles.length).toBeGreaterThan(20);
    for (const file of uiFiles) {
      const lines = lineCount(file);
      expect(lines, `${file} must be < 650 lines (got ${lines})`).toBeLessThan(650);
    }
  });
});
