import {
  createState,
  serializeSave,
  stableHash,
  startCutscene,
  type ActionFrame,
  type Fixture,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import type { InputSource } from "../platform/input";
import type { AudioController } from "../platform/audio";
import type { GameSettingsController } from "../platform/game-settings";
import type { MinigameRecords } from "../platform/minigame-records";
import type { BattleCheckInfo } from "../render/view";
import type { CutsceneRenderInfo } from "../render/cutscene-render";
import type { MicroDelightsRenderInfo } from "../render/micro-delights-render";
import type { NpcLifeRenderInfo } from "../render/npc-life";
import type { TimeOfDayPhase } from "../render/time-of-day";
import { formatSaveBackup, parseSaveBackup } from "../shell/save-backup";
import type { SaveStore } from "../shell/save-storage";
import type { ArcadeInfo } from "../ui/arcade";
import type { PostcardCapture } from "../ui/postcard";
import type { QaPack } from "./qa";

export type CloverhollowHook = {
  version: 1;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  step: (ticks: number) => Promise<{
    tick: number;
    x: number;
    y: number;
    facing: State["facing"];
  }>;
  input: (frame: ActionFrame, ticks: number) => void;
  getState: () => State;
  hash: () => string;
  reset: (options?: { seed?: number; fixture?: string }) => Promise<void>;
  renderInfo: () => {
    area: string;
    finale: State["finale"];
    credits: { entries: { section: "friends" | "met"; name: string }[] } | null;
    drawOrder: { label: string; zIndex: number }[];
    animation: string;
    frame: number;
    paperFlipScaleX: number;
    party: { id: string; hidden: number; animation: string; frame: number }[];
    fade: number;
    cachedAreaTextures: string[];
    prompt: { visible: boolean; label: string; x: number; y: number };
    dialogue: {
      open: boolean;
      speaker: string | null;
      revealed: number;
      length: number;
      choices: string[];
      selected: number;
    };
    critters: {
      id: string;
      kind: string;
      frame: string;
      x: number;
      y: number;
    }[];
    npcs: { id: string; frame: string; facing: string }[];
    npcLife: NpcLifeRenderInfo;
    ambient: { id: string; x: number; y: number; frame: number }[];
    canopies: { id: string; alpha: number }[];
    // Each prop's current state, whether it lies flat (drawn under everyone)
    // or is hidden (not there), and its strips: world x range and the y it
    // sorts by (spec 6).
    props: {
      id: string;
      state: string;
      flat: boolean;
      hidden: boolean;
      strips: { left: number; right: number; zIndex: number }[];
    }[];
    lantern: { on: boolean; glows: string[] };
    // The recurring critters' "?" and "!" over their heads (Milestone 51).
    marks: { key: string; mark: "?" | "!"; x: number; y: number }[];
    clubhouseDisplay: number;
    atmosphereParticles: number;
    footstepPuffs: number;
    starGemGlints: number;
    petting: string | null;
    resting: string | null;
    timeOfDay: TimeOfDayPhase;
    photoMode: boolean;
    microDelights: MicroDelightsRenderInfo;
    battle: {
      phase: string | null;
      check: BattleCheckInfo | null;
      critter: { id: string; frame: string } | null;
      faePose: string | null;
      partyPoses: Record<string, string>;
      layout: {
        critter: { x: number; baseline: number; height: number };
        fae: { x: number; baseline: number; height: number };
        party: { x: number; y: number }[];
      } | null;
      backdrop: { x: number; y: number; width: number; height: number } | null;
      overworldVisible: boolean;
      auraAlpha: number;
    };
    cutscene: CutsceneRenderInfo | null;
    arcade: ArcadeInfo | null;
  };
  save: {
    clear: () => Promise<void>;
    last: () => { tick: number; hash: string } | null;
    loaded: () => { tick: number; hash: string } | null;
    exportBackup?: () => string;
    importBackup?: (raw: string) => Promise<boolean>;
  };
  boot: { title: () => "fresh" | "continue" | "confirm" | null };
  qa: { active: () => boolean; packs: () => QaPack[] };
  navOverlay?: (visible?: boolean) => boolean;
  previewDialogueTags?: (tags: string[] | null) => void;
  cutscene?: {
    play: (id: string) => Promise<boolean>;
    active: () => string | null;
    list: () => string[];
  };
  sound: {
    log: AudioController["log"];
    effects: AudioController["effects"];
    muted: AudioController["muted"];
    level: AudioController["level"];
    state: AudioController["state"];
    music: AudioController["music"];
  };
  settings: {
    gentleTiming: () => boolean;
    setGentleTiming: (on: boolean) => void;
    keyHints: () => boolean;
    setKeyHints: (on: boolean) => void;
    textSpeed: () => TextSpeed;
    setTextSpeed: (speed: TextSpeed) => void;
    reducedMotion: () => boolean;
    setReducedMotion: (on: boolean) => void;
    photoMode: () => boolean;
    setPhotoMode: (on: boolean) => void;
    snapPostcard: (options?: { download?: boolean }) => Promise<PostcardCapture | null>;
    minigameRecords: () => MinigameRecords;
  };
};

export function installHook(deps: {
  input: InputSource;
  get: () => State;
  tick: (frame: ActionFrame) => void;
  ensureArea: (fresh?: boolean) => Promise<void>;
  render: () => void;
  paused: () => boolean;
  setPaused: (paused: boolean) => void;
  // Marks the synthetic ticks of `step`, so the shell can skip what belongs
  // only to real-time play (the door fade's prefetch, spec 11).
  setStepping: (stepping: boolean) => void;
  reset: (options: { seed?: number; fixture?: string }) => Promise<void>;
  renderInfo: CloverhollowHook["renderInfo"];
  save: CloverhollowHook["save"];
  boot: CloverhollowHook["boot"];
  qa: CloverhollowHook["qa"];
  navOverlay?: (visible?: boolean) => boolean;
  previewDialogueTags?: (tags: string[] | null) => void;
  cutscene?: CloverhollowHook["cutscene"];
  sound: CloverhollowHook["sound"];
  settings: CloverhollowHook["settings"];
}): void {
  const hook: CloverhollowHook = {
    version: 1,
    pause: () => deps.setPaused(true),
    resume: () => deps.setPaused(false),
    isPaused: deps.paused,
    step: async (ticks) => {
      deps.setPaused(true);
      await deps.ensureArea();
      // Only the area the step ends in is loaded (spec 11): a replay through
      // a dozen doors loaded and dropped every room on the way. If the step
      // left its first area at any tick, even to come back, the last area is
      // loaded afresh, which leaves the view and camera as loading each one
      // in turn did. Nothing it passes through is warmed either: the door
      // fade's prefetch belongs to the real-time loop, and warming every room
      // on the way once more cost CI's software-rendered WebKit minutes.
      const first = deps.get().area;
      let moved = false;
      deps.setStepping(true);
      try {
        for (let index = 0; index < Math.max(0, ticks); index += 1) {
          deps.tick(deps.input.next());
          if (deps.get().area !== first) moved = true;
        }
      } finally {
        deps.setStepping(false);
      }
      await deps.ensureArea(moved);
      deps.render();
      const state = deps.get();
      return {
        tick: state.tick,
        x: state.player.x,
        y: state.player.y,
        facing: state.facing,
      };
    },
    input: deps.input.queue,
    getState: () => structuredClone(deps.get()),
    hash: () => stableHash(deps.get()),
    reset: async (options = {}) => {
      deps.setPaused(true);
      deps.input.clear();
      await deps.reset(options);
      deps.render();
    },
    renderInfo: deps.renderInfo,
    save: deps.save,
    boot: deps.boot,
    qa: deps.qa,
    ...(deps.navOverlay !== undefined ? { navOverlay: deps.navOverlay } : {}),
    ...(deps.previewDialogueTags !== undefined
      ? { previewDialogueTags: deps.previewDialogueTags }
      : {}),
    ...(deps.cutscene !== undefined ? { cutscene: deps.cutscene } : {}),
    sound: deps.sound,
    settings: deps.settings,
  };
  window.__cloverhollow = hook;
}

/** Wires shell subsystems and portable backup import/export into `installHook`. */
export function installShellHook(deps: {
  world: World;
  fixtures: Record<string, Fixture>;
  fresh: State;
  speciesXp: Record<string, number>;
  input: InputSource;
  get: () => State;
  tick: (frame: ActionFrame) => void;
  ensureArea: (fresh?: boolean) => Promise<void>;
  render: () => void;
  invalidate: () => void;
  paused: () => boolean;
  setPaused: (paused: boolean) => void;
  setStepping: (stepping: boolean) => void;
  applyResetState: (next: State) => Promise<void>;
  renderInfo: CloverhollowHook["renderInfo"];
  boot: CloverhollowHook["boot"];
  qa: CloverhollowHook["qa"];
  isQaRestricted: () => boolean;
  saveStore: SaveStore;
  clearSaveDirty: () => void;
  applyImportedSave: (imported: State) => Promise<void>;
  sound: AudioController;
  gameSettings: GameSettingsController;
  photoMode: () => boolean;
  setPhotoMode: (on: boolean) => void;
  snapPostcard: (options?: { download?: boolean }) => Promise<PostcardCapture | null>;
  minigameRecords: () => MinigameRecords;
  navOverlay?: (visible?: boolean) => boolean;
  previewDialogueTags?: (tags: string[] | null) => void;
  setCutsceneState?: (next: State) => void;
}): void {
  const invalidateAfter = <Args extends unknown[]>(
    fn: (...args: Args) => void,
  ): ((...args: Args) => void) => (...args: Args): void => {
    fn(...args);
    deps.invalidate();
  };
  installHook({
    input: deps.input,
    get: deps.get,
    tick: deps.tick,
    ensureArea: deps.ensureArea,
    render: () => {
      deps.render();
      deps.invalidate();
    },
    paused: deps.paused,
    setPaused: deps.setPaused,
    setStepping: deps.setStepping,
    reset: async (options) => {
      const name = options.fixture ?? "new-game";
      const fixture = deps.fixtures[name];
      if (fixture === undefined) {
        const known = Object.keys(deps.fixtures).join(", ");
        throw new Error(`Unknown fixture "${name}". Known fixtures: ${known}`);
      }
      await deps.applyResetState(createState(deps.world, fixture, options.seed));
    },
    renderInfo: deps.renderInfo,
    boot: deps.boot,
    qa: deps.qa,
    ...(deps.navOverlay !== undefined ? { navOverlay: deps.navOverlay } : {}),
    ...(deps.previewDialogueTags !== undefined
      ? { previewDialogueTags: deps.previewDialogueTags }
      : {}),
    ...(deps.setCutsceneState !== undefined
      ? {
          cutscene: {
            play: async (id: string) => {
              if (deps.world.cutscenes[id] === undefined) return false;
              const next = startCutscene(deps.world, deps.get(), id);
              if (next.cutscene === undefined) return false;
              deps.setCutsceneState?.(next);
              await deps.ensureArea();
              deps.render();
              deps.invalidate();
              return true;
            },
            active: () => deps.get().cutscene?.id ?? null,
            list: () => Object.keys(deps.world.cutscenes).sort(),
          },
        }
      : {}),
    save: {
      clear: async () => {
        if (deps.isQaRestricted()) return;
        await deps.saveStore.clear();
        deps.clearSaveDirty();
      },
      last: () => deps.saveStore.last(),
      loaded: () => (deps.isQaRestricted() ? null : deps.saveStore.loaded()),
      exportBackup: () =>
        formatSaveBackup(deps.get(), deps.world, new Date().toISOString()),
      importBackup: async (raw) => {
        if (deps.isQaRestricted()) return false;
        const imported = parseSaveBackup(
          raw,
          deps.fresh,
          deps.speciesXp,
          deps.world.levels.thresholds,
        );
        if (imported === null) return false;
        const wrote = await deps.saveStore.write(serializeSave(imported), {
          tick: imported.tick,
          hash: stableHash(imported),
        });
        if (!wrote) return false;
        await deps.applyImportedSave(imported);
        return true;
      },
    },
    sound: {
      log: deps.sound.log,
      effects: deps.sound.effects,
      muted: deps.sound.muted,
      level: deps.sound.level,
      state: deps.sound.state,
      music: deps.sound.music,
    },
    settings: {
      gentleTiming: deps.gameSettings.gentleTiming,
      setGentleTiming: invalidateAfter((on: boolean) => deps.gameSettings.setGentleTiming(on)),
      keyHints: deps.gameSettings.keyHints,
      setKeyHints: invalidateAfter((on: boolean) => deps.gameSettings.setKeyHints(on)),
      textSpeed: deps.gameSettings.textSpeed,
      setTextSpeed: invalidateAfter((speed: TextSpeed) => deps.gameSettings.setTextSpeed(speed)),
      reducedMotion: deps.gameSettings.reducedMotion,
      setReducedMotion: invalidateAfter((on: boolean) => deps.gameSettings.setReducedMotion(on)),
      photoMode: deps.photoMode,
      setPhotoMode: deps.setPhotoMode,
      snapPostcard: deps.snapPostcard,
      minigameRecords: deps.minigameRecords,
    },
  });
}

declare global {
  interface Window {
    __cloverhollow?: CloverhollowHook;
  }
}
