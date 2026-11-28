import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createState, parseSave, stableHash, step } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { qaFlow } from "../../src/shell/qa-flow";
import {
  readQaSettingsSnapshot,
  type QaSessionSettingsDeps,
} from "../../src/shell/qa-session";
import { NavOverlayController } from "../../src/render/nav-overlay";
import {
  QA_SETTING_TOGGLES,
  ensureSandboxPack,
  qaPackFromUrl,
  qaSettingPressed,
  shouldShowQaTouchTrigger,
  type PackState,
} from "../../src/dev/qa";

describe("QA menu flow", () => {
  it("wraps, confirms, and cancels without changing the selected pack", () => {
    expect(qaFlow(3, 0, { up: true, down: false, confirm: false, cancel: false }))
      .toEqual({ open: true, selected: 2, action: null });
    expect(qaFlow(3, 2, { up: false, down: true, confirm: true, cancel: false }))
      .toEqual({ open: true, selected: 0, action: 0 });
    expect(qaFlow(3, 1, { up: false, down: false, confirm: false, cancel: true }))
      .toEqual({ open: false, selected: 1, action: null });
  });

  it("resolves a known URL pack and rejects unknown IDs", () => {
    const packs: PackState[] = [{
      pack: {
        id: "sample", label: "Sample", note: "Test", fixture: "new-game",
        run: "new-game/chapter-one.json", tick: 1, interim: false, hash: "hash",
      },
      save: "save",
    }];
    expect(qaPackFromUrl(packs, "?qa=sample")).toBe(packs[0]);
    expect(() => qaPackFromUrl(packs, "?qa=missing"))
      .toThrow("Known saves: sample");
  });

  it("enters synthetic Sandbox QA pack on live edits and preserves an active pack", () => {
    const entered = ensureSandboxPack(null, 420);
    expect(entered.enteredSandbox).toBe(true);
    expect(entered.pack.pack).toEqual({
      id: "sandbox",
      label: "Sandbox",
      note: "Live QA sandbox.",
      fixture: "sandbox",
      run: "",
      tick: 420,
      interim: true,
      hash: "",
    });
    const existing: PackState = {
      pack: {
        id: "jordan", label: "Jordan", note: "Note", fixture: "new-game",
        run: "run.json", tick: 100, interim: false, hash: "abc",
      },
      save: "{}",
    };
    const kept = ensureSandboxPack(existing, 999);
    expect(kept.enteredSandbox).toBe(false);
    expect(kept.pack).toBe(existing);
  });

  it("gates the touch QA trigger to active live gameplay without overlays or QA packs", () => {
    const base = {
      blocked: false,
      hasActivePack: false,
      menuOpen: false,
      consoleOpen: false,
      titleOpen: false,
      photoMode: false,
    };
    expect(shouldShowQaTouchTrigger(base)).toBe(true);
    expect(shouldShowQaTouchTrigger({ ...base, hasActivePack: true })).toBe(false);
    expect(shouldShowQaTouchTrigger({ ...base, titleOpen: true })).toBe(false);
    expect(shouldShowQaTouchTrigger({ ...base, menuOpen: true })).toBe(false);
    expect(shouldShowQaTouchTrigger({ ...base, consoleOpen: true })).toBe(false);
    expect(shouldShowQaTouchTrigger({ ...base, photoMode: true })).toBe(false);
    expect(shouldShowQaTouchTrigger({ ...base, blocked: true })).toBe(false);
  });

  it("wires the Nav Heatmap QA setting toggle and aria-pressed state cleanly", () => {
    expect(QA_SETTING_TOGGLES).toContainEqual({ id: "navOverlay", label: "Nav Heatmap" });

    const navOverlay = new NavOverlayController();
    const baseDeps: QaSessionSettingsDeps = {
      gentleTiming: () => false,
      toggleGentleTiming: () => undefined,
      keyHints: () => true,
      toggleKeyHints: () => undefined,
      reducedMotion: () => false,
      toggleReducedMotion: () => undefined,
      muted: () => false,
      toggleMute: () => undefined,
      textSpeed: () => "cozy",
      setTextSpeed: () => undefined,
      photoMode: () => false,
      canPhotoMode: () => true,
      setPhotoMode: () => undefined,
    };

    const omitted = readQaSettingsSnapshot(baseDeps);
    expect(omitted.navOverlay).toBe(false);
    expect(qaSettingPressed(omitted, "navOverlay")).toBe("false");

    const wiredDeps = {
      ...baseDeps,
      navOverlay: () => navOverlay.isHeatmapVisible(),
      toggleNavOverlay: () => {
        navOverlay.setHeatmapVisible(!navOverlay.isHeatmapVisible());
      },
    };

    expect(qaSettingPressed(readQaSettingsSnapshot(wiredDeps), "navOverlay")).toBe("false");
    wiredDeps.toggleNavOverlay();
    expect(navOverlay.isHeatmapVisible()).toBe(true);
    expect(navOverlay.debugLayer.visible).toBe(true);
    expect(qaSettingPressed(readQaSettingsSnapshot(wiredDeps), "navOverlay")).toBe("true");
    wiredDeps.toggleNavOverlay();
    expect(navOverlay.isHeatmapVisible()).toBe(false);
    expect(navOverlay.debugLayer.visible).toBe(false);
    expect(qaSettingPressed(readQaSettingsSnapshot(wiredDeps), "navOverlay")).toBe("false");
  });
});

describe("QA save library", () => {
  it("keeps every pack parseable and fresh, and catches stale run pins", () => {
    const content = loadContent();
    const manifest: { id: string; fixture: string; run: string; tick: number }[] =
      JSON.parse(readFileSync("content/qa/saves.json", "utf8"));
    const template = createState(
      content.world,
      content.fixtures["new-game"] ?? (() => { throw new Error("new-game fixture missing"); })(),
      1,
    );
    for (const pack of manifest) {
      const save = readFileSync(`content/qa/saves/${pack.id}.json`, "utf8");
      const stale = `Pack ${pack.id} is stale; rerun bun tools/qa/build-saves.ts`;
      expect(parseSave(save, template), stale)
        .not.toBeNull();
      let exact = createState(
        content.world,
        content.fixtures[pack.fixture] ?? (() => { throw new Error("fixture missing"); })(), 1,
      );
      const script = parseScript(
        JSON.parse(readFileSync(`tests/sim/scripts/${pack.run}`, "utf8")), pack.run,
      );
      let remaining = pack.tick;
      for (const segment of script) {
        const ticks = Math.min(segment.ticks, remaining);
        for (let index = 0; index < ticks; index += 1)
          exact = step(content.world, exact, segment.frame).state;
        remaining -= ticks;
        if (remaining === 0) break;
      }
      expect(stableHash(exact), stale)
        .toBe(stableHash(parseSave(save, template)));
    }
  }, 60_000);
});
