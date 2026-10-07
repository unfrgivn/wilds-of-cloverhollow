import { Application, Assets, type Spritesheet } from "pixi.js";
import {
  blankInput,
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type State,
  battleView,
} from "./core";
import { loadContent, parseMapCentres } from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView } from "./render/view";
import type { AtlasImage } from "./ui/atlas";
import { preventPinchZoom } from "./platform/gestures";
import { createDialogueBox, createPrompt } from "./ui/sticker";
import {
  createBattleHud,
  createCommandMenu,
  createTimingRing,
  createRewardSticker,
} from "./ui/battle";
import { assetUrl } from "./platform/assets";
import { createJournal } from "./ui/journal";
import {
  journalNotes,
  parseSave,
  serializeSave,
  autosaveNeeded,
  stableHash,
} from "./core";
import { Preferences } from "@capacitor/preferences";
import { createTitleScreen, type TitleChoiceId } from "./ui/title";
import {
  continueDetail,
  titleFlow,
  type TitleInput,
  type TitleMode,
} from "./shell/title-flow";

const content = loadContent();
const app = new Application();
let state: State;
let paused = false;

// One save slot (spec 10).
const saveKey = "cloverhollow-save";

async function boot(): Promise<void> {
  preventPinchZoom();
  await app.init({
    resizeTo: window,
    backgroundColor: 0xf8edcf,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    // Keep the canvas at viewport size in CSS pixels; only the backing store is 2x.
    autoDensity: true,
    preference: "webgl",
  });
  app.renderer.background.color = 0xf8edcf;
  const root = document.querySelector("#app");
  if (root === null) throw new Error("Missing #app root");
  root.appendChild(app.canvas);
  const keyboard = new Keyboard();
  const touch = mountTouchControls();
  const uiRoot = document.createElement("div");
  document.body.append(uiRoot);
  const dialogueBox = createDialogueBox(uiRoot);
  const prompt = createPrompt(uiRoot);
  const battleHud = createBattleHud(uiRoot);
  const commandMenu = createCommandMenu(uiRoot);
  const timingRing = createTimingRing(uiRoot);
  const rewardSticker = createRewardSticker(uiRoot);
  const journal = createJournal(uiRoot);
  const title = createTitleScreen(uiRoot);
  const input = createInputSource(() => {
    const keyboardFrame = keyboard.frame();
    const touchFrame = touch.sample();
    return {
      move:
        touchFrame.move.x !== 0 || touchFrame.move.y !== 0
          ? touchFrame.move
          : keyboardFrame.move,
      confirm: keyboardFrame.confirm || touchFrame.confirm,
      cancel: keyboardFrame.cancel || touchFrame.cancel,
      menu: keyboardFrame.menu || touchFrame.menu,
      // Only while pressed: recorded frames omit it, and a frame from real keys
      // must match the recorded one exactly (spec 3.2).
      ...(keyboardFrame.lantern || touchFrame.lantern ? { lantern: true } : {}),
      choose: touchFrame.choose,
    };
  });
  dialogueBox.onChoose((index) => touch.tapChoice(index));
  commandMenu.onChoose((index) => touch.tapChoice(index));
  journal.onClose(() => touch.tapButton("cancel"));
  const view = new GameView(content.world, {
    debugLabel: import.meta.env.DEV || import.meta.env.MODE === "harness",
    renderer: app.renderer,
  });
  app.stage.addChild(view.root);
  const initialFixture = content.fixtures["new-game"];
  if (initialFixture === undefined) throw new Error("Missing new-game fixture");
  const fresh = createState(content.world, initialFixture);
  const saved = await Preferences.get({ key: saveKey });
  const restored = saved.value === null ? null : parseSave(saved.value, fresh);
  state = restored ?? fresh;
  // A real boot opens on the title (spec 7.3), with the game frozen behind it:
  // no core ticks run, so Continue resumes the save exactly as it was written.
  // Fixture resets (the harness) skip it.
  let titleMode: TitleMode | null = restored === null ? "fresh" : "continue";
  let titleSelected: TitleChoiceId =
    restored === null ? "new-game" : "continue";
  const applyTitle = (input: TitleInput): void => {
    if (titleMode === null) return;
    const result = titleFlow(titleMode, titleSelected, input);
    titleMode = result.mode;
    titleSelected = result.selected;
    if (result.action === "new-game") {
      state = createState(content.world, initialFixture);
      void Preferences.remove({ key: saveKey });
      saveLast = null;
    }
  };
  title.onChoose((id) =>
    applyTitle({
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      cancel: false,
      choose: id,
    }),
  );
  const saveLoaded =
    restored === null
      ? null
      : { tick: restored.tick, hash: stableHash(restored) };
  let saveLast: { tick: number; hash: string } | null = saveLoaded;
  let suppressSave = false;
  let saveQueue = Promise.resolve();
  const save = (): Promise<void> => {
    if (suppressSave) return Promise.resolve();
    const snapshot = state;
    const serialized = serializeSave(snapshot);
    const hash = stableHash(snapshot);
    saveQueue = saveQueue.then(async () => {
      await Preferences.set({
        key: saveKey,
        value: serialized,
      });
      saveLast = { tick: snapshot.tick, hash };
    });
    return saveQueue;
  };
  await view.ready;
  // Each land's centre on the painted map (the journal's MAP page).
  const mapFile = "assets/ui/map/world-map.json";
  const mapResponse = await fetch(assetUrl(mapFile));
  if (!mapResponse.ok) throw new Error(`Failed to load ${mapFile}`);
  const mapCentres = parseMapCentres(await mapResponse.json(), mapFile);
  // Sticker art (the reward card and the journal album) is a CSS crop of a
  // critter's atlas. Decode each atlas once now, so a card never paints before
  // its image is ready (on a busy phone, or a loaded test machine).
  const atlases = new Set(Object.values(content.world.critters).map((critter) => critter.atlas));
  await Promise.all([...atlases].map(async (url) => {
    const atlas = new Image();
    atlas.src = assetUrl(url.replace(".json", ".png"));
    await atlas.decode();
  }));
  // A sticker's art: its critter's atlas, cropped to the frame its content
  // names, with the rect read from the atlas the view loaded.
  const stickerArt = (critterId: string, frameName: string): AtlasImage | null => {
    const critter = content.world.critters[critterId];
    const sheet = critter === undefined
      ? undefined
      : Assets.get<Spritesheet | undefined>(critter.atlas);
    const rect = sheet?.data.frames[frameName]?.frame;
    const size = sheet?.data.meta.size;
    if (critter === undefined || rect === undefined || size === undefined) return null;
    return {
      src: assetUrl(critter.atlas.replace(".json", ".png")),
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      atlas: { w: size.w, h: size.h },
    };
  };
  const initialArea = content.world.areas[state.area];
  if (initialArea === undefined) throw new Error("Missing initial area");
  await view.setArea(initialArea);
  let afterTick = (_next: State): void => undefined;
  let logTitle = (_mode: TitleMode | null): void => undefined;
  let lastBattleLog = "";
  let lastBattleButtonsLog = "";
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const {
      createStateLogger,
      createTitleLogger,
      logPointers,
      logTouchLayout,
    } = await import("./dev/state-log");
    logTouchLayout();
    logPointers();
    afterTick = createStateLogger(content.world);
    logTitle = createTitleLogger();
    afterTick(state);
  }
  // The journal's notes come from running its Ink knot (a Story per line).
  // They only change with what the story reads (its variables, the set
  // pieces, the stickers, and Fae's coins), and the world is frozen while the
  // journal is open, so they're computed once per change, not per frame.
  let journalCache: {
    ink: string;
    critters: State["critters"];
    stickers: State["stickers"];
    coins: number;
    notes: string[];
  } | null = null;
  const notesNow = (): string[] => {
    if (journalCache === null || journalCache.ink !== state.ink ||
        journalCache.critters !== state.critters || journalCache.stickers !== state.stickers ||
        journalCache.coins !== state.coins)
      journalCache = { ink: state.ink, critters: state.critters, stickers: state.stickers,
        coins: state.coins, notes: journalNotes(content.world, state) };
    return journalCache.notes;
  };
  const render = (): void => {
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
    );
    prompt.render(
      state.battle === null
        ? view.promptView(state)
        : { visible: false, label: "", x: 0, y: 0 },
    );
    const battle = battleView(content.world, state);
    const activeBattle = battle !== null;
    const lanternButton = document.querySelector<HTMLButtonElement>(".touch-lantern");
    if (lanternButton !== null) {
      lanternButton.hidden = content.world.storyVariable(state.ink, "has_lantern") !== true;
      lanternButton.classList.toggle("is-on", state.lantern);
    }
    title.render({
      visible: titleMode !== null,
      mode: titleMode ?? "fresh",
      selected: titleSelected,
      continueDetail: continueDetail(content.world, state),
    });
    logTitle(titleMode);
    if (titleMode !== null) document.documentElement.dataset.title = "open";
    else delete document.documentElement.dataset.title;
    if (activeBattle) document.documentElement.dataset.battle = "open";
    else delete document.documentElement.dataset.battle;
    battleHud.render({
      visible: activeBattle && state.battle?.phase !== "reward",
      energy: battle?.energy ?? 0,
      energyMax: battle?.energyMax ?? 0,
      calm: battle === null ? 0 : battle.calm / Math.max(1, battle.calmMax),
      critterName: activeBattle
        ? (content.world.critters[state.battle?.critterId ?? ""]?.name ?? "")
        : "",
    });
    commandMenu.render({
      visible: activeBattle && state.battle?.phase === "command",
      commands: battle?.commands ?? [],
      selected: battle?.selected ?? 0,
    });
    if (
      activeBattle &&
      state.battle?.phase === "command" &&
      (import.meta.env.DEV || import.meta.env.MODE === "harness")
    ) {
      const rects = [
        ...uiRoot.querySelectorAll<HTMLElement>(".battle-command"),
      ].map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const encoded = JSON.stringify(rects);
      if (encoded !== lastBattleButtonsLog) {
        console.log(`[cloverhollow] battle-buttons ${encoded}`);
        lastBattleButtonsLog = encoded;
      }
    }
    const ring = view.battleRingView(
      state,
      window.innerWidth,
      window.innerHeight,
    );
    timingRing.render({
      visible: ring !== null,
      x: ring?.x ?? 0,
      y: ring?.y ?? 0,
      radius: ring?.radius ?? 0,
      progress: battle?.aim?.progress ?? 0,
      target: battle?.aim?.target ?? 0,
      grade: battle?.lastGrade ?? null,
    });
    // The card shows a new sticker; a species already in the album only pays.
    const rewardCritter =
      state.battle === null
        ? undefined
        : content.world.critters[state.battle.critterId];
    rewardSticker.render({
      visible: activeBattle && state.battle?.phase === "reward" &&
        state.battle.rewardSticker !== null,
      title: "NEW STICKER!",
      name: rewardCritter?.sticker.name ?? "",
      image: rewardCritter === undefined
        ? null
        : stickerArt(rewardCritter.id, rewardCritter.sticker.frame),
    });
    journal.render({
      visible: state.journalOpen,
      notes: state.journalOpen ? notesNow() : [],
      stickers: state.journalOpen
        ? Array.from({ length: content.world.stickers.slots }, (_, index) => {
            const sticker = content.world.stickers.catalogue[index];
            if (sticker === undefined)
              return {
                id: `empty-${index}`,
                name: "",
                owned: false,
                image: null,
              };
            const owned = state.stickers.includes(sticker.id);
            return {
              id: sticker.id,
              name: sticker.name,
              owned,
              image: owned ? stickerArt(sticker.critter, sticker.frame) : null,
            };
          })
        : [],
      lands: content.world.lands.map((land) => ({
        ...land,
        ...(mapCentres[land.id] ?? { x: 0, y: 0 }),
      })),
      currentLand: content.world.areas[state.area]?.land ?? null,
      coins: state.coins,
      snacks: state.snacks,
    });
    if (state.journalOpen) document.documentElement.dataset.journal = "open";
    else delete document.documentElement.dataset.journal;
    if (activeBattle) dialogueBox.hide();
    if (activeBattle && (battle?.message ?? "") !== "") {
      dialogueBox.render({
        speaker: null,
        text: battle?.message ?? "",
        revealed: battle?.revealed ?? 0,
        choices: [],
        selected: -1,
        canAdvance: battle !== null && battle.revealed >= battle.message.length,
      });
      document.documentElement.dataset.dialogue = "open";
    } else if (activeBattle) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else if (state.dialogue === null) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else {
      document.documentElement.dataset.dialogue = "open";
      dialogueBox.render({
        speaker: state.dialogue.speaker,
        text: state.dialogue.text,
        revealed: state.dialogue.revealed,
        // Choices appear once the line has finished typing (spec section 7).
        choices:
          state.dialogue.revealed >= state.dialogue.text.length
            ? state.dialogue.choices.map((text) => ({ text }))
            : [],
        selected: state.dialogue.selected,
        canAdvance: state.dialogue.choices.length === 0,
      });
    }
  };
  // The title reads its own input edges from here, never from the core state.
  let titlePrevious: ActionFrame = blankInput();
  // Buttons held when the title closed stay hidden from the game until they're
  // released, so the press that starts the game can't also act in it.
  const swallowed = new Set<"confirm" | "cancel" | "menu">();
  const tick = (frame: ActionFrame): void => {
    if (titleMode !== null) {
      applyTitle({
        up: frame.move.y < -0.5 && titlePrevious.move.y >= -0.5,
        down: frame.move.y > 0.5 && titlePrevious.move.y <= 0.5,
        left: frame.move.x < -0.5 && titlePrevious.move.x >= -0.5,
        right: frame.move.x > 0.5 && titlePrevious.move.x <= 0.5,
        confirm: frame.confirm && !titlePrevious.confirm,
        cancel: frame.cancel && !titlePrevious.cancel,
      });
      titlePrevious = frame;
      if (titleMode === null) {
        for (const button of ["confirm", "cancel", "menu"] as const)
          if (frame[button]) swallowed.add(button);
      }
      return;
    }
    for (const button of swallowed)
      if (!frame[button]) swallowed.delete(button);
    const input: ActionFrame = {
      ...frame,
      confirm: frame.confirm && !swallowed.has("confirm"),
      cancel: frame.cancel && !swallowed.has("cancel"),
      menu: frame.menu && !swallowed.has("menu"),
    };
    const previous = state;
    state = step(content.world, state, input).state;
    if (autosaveNeeded(previous, state)) void save();
    if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
      const log =
        state.battle === null
          ? "closed"
          : `${state.battle.phase}|${state.battle.message}`;
      if (log !== lastBattleLog) {
        const payload = {
          phase: state.battle?.phase ?? null,
          message: state.battle?.message ?? "",
        };
        console.log(`[cloverhollow] battle ${JSON.stringify(payload)}`);
        lastBattleLog = log;
      }
    }
    afterTick(state);
  };
  let areaLoad: Promise<void> | undefined;
  // Loads whatever area the state is in. If a load for an older target is still
  // in flight, waits for it and checks again, so callers always end up with the
  // current area loaded.
  const ensureArea = async (): Promise<void> => {
    for (;;) {
      if (areaLoad !== undefined) {
        await areaLoad;
        continue;
      }
      const area = content.world.areas[state.area];
      if (area === undefined) throw new Error(`Unknown area ${state.area}`);
      if (view.loadedAreaId() === area.id) return;
      areaLoad = view
        .setArea(area)
        .then(() => view.resetCamera())
        .finally(() => {
          areaLoad = undefined;
        });
    }
  };
  window.addEventListener("resize", render);
  let last = performance.now();
  let accumulator = 0;
  app.ticker.add(() => {
    const now = performance.now();
    accumulator += Math.min(now - last, 250);
    last = now;
    if (areaLoad !== undefined) {
      accumulator = 0;
    } else if (!paused) {
      const drained = drainTicks(accumulator, 1000 / 60, 5);
      accumulator = drained.remainingMs;
      for (let index = 0; index < drained.ticks; index += 1) {
        tick(input.next());
        if (view.loadedAreaId() !== state.area) {
          accumulator = 0;
          void ensureArea();
          break;
        }
      }
    }
    render();
  });
  render();
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const { installHook } = await import("./dev/hook");
    installHook({
      input,
      get: () => state,
      tick,
      ensureArea,
      render,
      paused: () => paused,
      setPaused: (value) => {
        paused = value;
      },
      reset: async (options) => {
        keyboard.clearTaps();
        const name = options.fixture ?? "new-game";
        const fixture = content.fixtures[name];
        if (fixture === undefined)
          throw new Error(
            `Unknown fixture "${name}". Known fixtures: ${Object.keys(
              content.fixtures,
            ).join(", ")}`,
          );
        suppressSave = true;
        state = createState(content.world, fixture, options.seed);
        suppressSave = false;
        await ensureArea();
        titleMode = null;
      },
      renderInfo: () => view.renderInfo(state),
      save: {
        clear: async () => {
          await saveQueue;
          await Preferences.remove({ key: saveKey });
          saveLast = null;
        },
        last: () => saveLast,
        loaded: () => saveLoaded,
      },
      boot: { title: () => titleMode },
    });
  }
}

boot().catch((error: unknown) => {
  // Capacitor forwards console.error to the native log, so iOS failures are visible.
  const detail =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  console.error(`[cloverhollow] boot failed: ${detail}`);
});
