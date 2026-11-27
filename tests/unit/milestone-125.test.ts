import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import * as coreIndex from "../../src/core";
import * as battleModule from "../../src/core/battle";
import * as battleViewModule from "../../src/core/battle-view";
import * as simModule from "../../src/core/sim";
import { addTreat, createState, startBattle, type State } from "../../src/core";
import { setInkVariables } from "../../src/core/ink";
import {
  createPreferenceStore,
  type PreferenceAdapter,
} from "../../src/platform/preference-store";

const { world, fixtures } = loadContent();

function stateFrom(
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

describe("Milestone 125: Shared Resilient Preference Store", () => {
  it("recovers cleanly after a rejected set() and preserves FIFO write ordering", async () => {
    const order: string[] = [];
    const stored = new Map<string, string>();
    const pending: { resolve: () => void; reject: (err: Error) => void }[] = [];

    const adapter: PreferenceAdapter = {
      get: async (key) => stored.get(key) ?? null,
      set: (key, value) => {
        order.push(`start:${value}`);
        return new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: () => {
              stored.set(key, value);
              order.push(`done:${value}`);
              resolve();
            },
            reject: (err) => {
              order.push(`fail:${value}`);
              reject(err);
            },
          });
        });
      },
    };

    const store = createPreferenceStore("cloverhollow-audio", adapter);
    expect(store.isLoaded()).toBe(false);
    expect(store.isDirty()).toBe(false);

    const w1 = store.save("v1");
    const w2 = store.save("v2");
    const w3 = store.save("v3");

    await Promise.resolve();
    expect(order).toEqual(["start:v1"]);

    // Reject write #1 (e.g. Safari Private Mode / storage quota failure).
    pending[0]?.reject(new Error("QuotaExceededError"));
    expect(await w1).toBe(false);

    // Queue recovers cleanly and runs write #2 next in strict FIFO order.
    await Promise.resolve();
    expect(order).toEqual(["start:v1", "fail:v1", "start:v2"]);
    pending[1]?.resolve();
    expect(await w2).toBe(true);

    // Write #3 runs after #2 completes.
    await Promise.resolve();
    expect(order).toEqual(["start:v1", "fail:v1", "start:v2", "done:v2", "start:v3"]);
    pending[2]?.resolve();
    expect(await w3).toBe(true);
    expect(stored.get("cloverhollow-audio")).toBe("v3");
  });

  it(
    "marks isLoaded() true when get() rejects and delivers null without unhandled rejections",
    async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const adapter: PreferenceAdapter = {
        get: () => Promise.reject(new Error("SecurityError: storage denied")),
        set: () => Promise.reject(new Error("QuotaExceededError")),
      };
      const store = createPreferenceStore("cloverhollow-settings", adapter);
      expect(store.isLoaded()).toBe(false);

      let loadedValue: string | null | undefined;
      let loadedInsideCallback = false;
      await store.load((raw) => {
        loadedValue = raw;
        loadedInsideCallback = store.isLoaded();
      });

      expect(loadedValue).toBeNull();
      expect(loadedInsideCallback).toBe(true);
      expect(store.isLoaded()).toBe(true);

      store.markDirty();
      expect(store.isDirty()).toBe(true);
      expect(await store.save("{\"textSpeed\":\"brisk\"}")).toBe(false);
      await Promise.resolve();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("delivers stored raw JSON on load() and tracks markDirty() before load finishes", async () => {
    let resolveGet: ((value: string | null) => void) | undefined;
    const saved: string[] = [];
    const adapter: PreferenceAdapter = {
      get: () =>
        new Promise<string | null>((resolve) => {
          resolveGet = resolve;
        }),
      set: async (_key, value) => {
        saved.push(value);
      },
    };

    const store = createPreferenceStore("cloverhollow-records", adapter);
    const loading = store.load((raw) => {
      if (store.isDirty()) void store.save("local-override");
      else if (raw !== null) void store.save(`kept:${raw}`);
    });
    expect(store.isLoaded()).toBe(false);

    // Local change arrives while load() is still in flight.
    store.markDirty();
    expect(store.isDirty()).toBe(true);
    resolveGet?.("{\"skee\":150}");
    await loading;
    expect(store.isLoaded()).toBe(true);
    expect(saved).toEqual(["local-override"]);
  });
});

describe("Milestone 125: Pure src/core/battle-view.ts Extraction", () => {
  it(
    "re-exports battleCommands, battleView, totalTreatCount, and revealCharacters identically",
    () => {
    expect(battleViewModule.battleCommands).toBe(battleModule.battleCommands);
    expect(battleViewModule.battleCommands).toBe(simModule.battleCommands);
    expect(battleViewModule.battleCommands).toBe(coreIndex.battleCommands);

    expect(battleViewModule.battleView).toBe(battleModule.battleView);
    expect(battleViewModule.battleView).toBe(simModule.battleView);
    expect(battleViewModule.battleView).toBe(coreIndex.battleView);

    expect(battleViewModule.totalTreatCount).toBe(battleModule.totalTreatCount);
    expect(battleViewModule.totalTreatCount).toBe(simModule.totalTreatCount);
    expect(battleViewModule.totalTreatCount).toBe(coreIndex.totalTreatCount);

    expect(battleViewModule.revealCharacters).toBe(battleModule.revealCharacters);
    expect(battleViewModule.revealCharacters).toBe(simModule.revealCharacters);
    expect(battleViewModule.revealCharacters).toBe(coreIndex.revealCharacters);
  });

  it(
    "projects identical battle commands, treats, sparkle, and assists on live battle states",
    () => {
    const frog = world.critters["fountain-frog"];
    if (frog === undefined) throw new Error("Missing fountain-frog critter");
    const treatId = world.treats[0]?.id;
    if (treatId === undefined) throw new Error("Missing treat content");

    const base = addTreat(
      stateFrom(
        "plaza-party",
        {},
        { has_flute: true, pup_friend: true, has_lasso: true },
      ),
      treatId,
      2,
    );
    const started = startBattle(world, base, frog);
    const active: State = {
      ...base,
      battle: {
        ...started,
        phase: "command",
        sparkle: world.battle.together.chargeMax,
        treatMenu: true,
        treatSelected: 1,
      },
    };

    expect(battleViewModule.totalTreatCount(active.treats)).toBe(2);
    expect(battleViewModule.totalTreatCount(undefined)).toBe(0);

    const commands = battleViewModule.battleCommands(world, active);
    expect(commands).toEqual(battleModule.battleCommands(world, active));
    expect(commands).toEqual(coreIndex.battleCommands(world, active));
    expect(commands.map((cmd) => cmd.id)).toContain("soothe");
    expect(commands.map((cmd) => cmd.id)).toContain("snack");

    const view = battleViewModule.battleView(world, active);
    expect(view).toEqual(battleModule.battleView(world, active));
    expect(view).toEqual(coreIndex.battleView(world, active));
    expect(view?.critterId).toBe("fountain-frog");
    expect(view?.sparkle?.ready).toBe(true);
    expect(view?.fluteAssist).toEqual({ available: true, label: "Pond Pup", kind: "pup" });
    expect(view?.lassoAssist).toEqual({ available: true, windUp: false });
    expect(view?.treatTray?.items.some((item) => item.id === treatId)).toBe(true);
    expect(battleViewModule.battleView(world, base)).toBeNull();
  });
});
