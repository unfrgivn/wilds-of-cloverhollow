import { Application } from "pixi.js";
import {
  blankInput,
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type Point,
  type State,
  battleParty,
  battleView,
  jukeboxTracks,
  soundCues,
  soundtrackFor,
  trackTitles,
  type JukeboxTrack,
  arcadeView,
  targetInteractable,
  creditEntries,
  creditsSummary,
  levelForXp,
  levelUpLine,
  journalNotes,
  parseSave,
  serializeSave,
  autosaveNeeded,
  stableHash,
} from "./core";
import { loadContent } from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { combineInputFrames, GamepadInput } from "./platform/gamepad";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView } from "./render/view";
import { preventPinchZoom } from "./platform/gestures";
import { createDialogueBox, createNoticeMarks, createPrompt } from "./ui/sticker";
import { evaluateBattlePortraits } from "./ui/battle-portraits";
import {
  createBattleHud,
  createCommandMenu,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  createRewardSticker,
  talkChoicesShown,
} from "./ui/battle";
import { createJournal } from "./ui/journal";
import { Preferences } from "@capacitor/preferences";
import { createTitleScreen, type TitleChoiceId } from "./ui/title";
import { createCredits } from "./ui/credits";
import {
  continueDetail,
  titleFlow,
  type TitleInput,
  type TitleMode,
} from "./shell/title-flow";
import { creditsConfirmAllowed } from "./shell/credits-flow";
import {
  battleCheckOverlay,
  buildDialogueView,
  buildJournalView,
  buildRewardStickerView,
  createMoleHoleHandler,
  createShellAssets,
  FAE_ATLAS,
  FISH_ATLAS,
} from "./shell/assets";
import { createAudio, type CompanionAudioEffect } from "./platform/audio";
import { createHaptics } from "./platform/haptics";
import { findPettableCompanion, findRestSpot } from "./render/companions";
import type { AudioLevel } from "./platform/audio-settings";
import { createGameSettings } from "./platform/game-settings";
import { areaBannerInfo, createAreaBanner } from "./ui/area-banner";
import { createHudHints, resolveHudInteractHint } from "./ui/hud-hints";
import { qaFlow } from "./shell/qa-flow";
import type { PackState } from "./dev/qa";

const content = loadContent();
const app = new Application();
  let state: State;
  const levelUpNotices: string[] = [];
let paused = false;

// One save slot (spec 10).
const saveKey = "cloverhollow-save";

function petEffectForCompanion(id: string): CompanionAudioEffect {
  if (id === "pond-pup") return "pet-pup";
  if (id === "acorn-squirrel") return "pet-squirrel";
  if (id === "ribbon-bunny") return "pet-bunny";
  return "pet-cat";
}

async function boot(): Promise<void> {
  preventPinchZoom();
  // Sound starts first, before anything awaits (spec 3.3): its context and its
  // key, pointer, and touch listeners exist before the page finishes loading,
  // so only a gesture made after that can have unlocked it.
  const sound = createAudio((audioState) => {
    if (import.meta.env.DEV || import.meta.env.MODE === "harness")
      console.log(
        `[cloverhollow] audio ${JSON.stringify({ state: audioState })}`,
      );
  });
  const haptics = createHaptics();
  const qaEnabled = import.meta.env.DEV || import.meta.env.MODE === "harness";
  const qaTools = qaEnabled ? await import("./dev/qa") : null;
  const qaPacks: PackState[] = qaTools?.loadQaPacks() ?? [];
  // Console saves (Milestone 67), listed in the QA menu after the packs.
  const qaSlots = qaTools === null ? [] : await qaTools.loadQaSlots();
  let qaEntries: PackState[] = [...qaPacks, ...qaSlots];
  let qaUrlPack: PackState | null = null;
  let qaError: string | null = null;
  if (qaTools !== null) {
    try {
      qaUrlPack = qaTools.qaPackFromUrl(qaPacks, window.location.search);
    } catch (error: unknown) {
      qaError = error instanceof Error ? error.message : String(error);
    }
  }
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
  // We draw from our own ticker callback (below), so Pixi's per-frame render goes.
  app.ticker.remove(app.render, app);
  const root = document.querySelector("#app");
  if (root === null) throw new Error("Missing #app root");
  root.appendChild(app.canvas);
  const keyboard = new Keyboard();
  const gamepad = new GamepadInput();
  const touch = mountTouchControls();
  const lanternButton = document.querySelector<HTMLButtonElement>(".touch-lantern");
  const fluteButton = document.querySelector<HTMLButtonElement>(".touch-flute");
  const uiRoot = document.createElement("div");
  document.body.append(uiRoot);
  const dialogueBox = createDialogueBox(uiRoot);
  const prompt = createPrompt(uiRoot);
  const noticeMarks = createNoticeMarks(uiRoot);
  const battleHud = createBattleHud(uiRoot);
  const commandMenu = createCommandMenu(uiRoot);
  const battleCheck = createBattleCheck(uiRoot);
  const echoArrows: readonly Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  battleCheck.onEchoNote((note) => {
    const direction = echoArrows[note];
    if (direction !== undefined) touch.tapArrow(direction);
  });
  const feelingBubble = createFeelingBubble(uiRoot);
  const windUpBubbles = createWindUpBubbles(uiRoot);
  const rewardSticker = createRewardSticker(uiRoot);
  // While the harness has the game paused, the frame is a pure function of a
  // state that only `step` changes, yet software-rendered Chromium spent ~60 ms
  // redrawing it every frame and every test command queued behind that draw
  // (an evaluate took 64 ms, against 5 ms drawing only on change). Paused, we
  // draw once after something changes; running, every frame as before.
  let drawPending = true;
  const invalidate = (): void => {
    drawPending = true;
  };
  const syncReducedMotion = (): void => {
    document.documentElement.dataset.reducedMotion = gameSettings.reducedMotion() ? "on" : "off";
  };
  const gameSettings = createGameSettings(() => {
    syncReducedMotion();
    invalidate();
  });
  syncReducedMotion();
  const hudHints = createHudHints(uiRoot);
  const areaBanner = createAreaBanner(uiRoot);
  const bannerDuration = 150;
  let bannerArea: string | null = null;
  let bannerStartTick = -1;
  let bannerPendingFade = false;
  const clearAreaBanner = (): void => {
    bannerArea = null;
    bannerStartTick = -1;
    bannerPendingFade = false;
  };
  const journal = createJournal(uiRoot);
  journal.onToggleAudio(() => {
    sound.toggle();
    invalidate();
  });
  journal.onSetAudioLevel((level: AudioLevel) => {
    sound.setLevel(level);
    invalidate();
  });
  journal.onToggleMusic(() => {
    sound.toggleMusic();
    invalidate();
  });
  journal.onSetMusicLevel((level: AudioLevel) => {
    sound.setMusicLevel(level);
    invalidate();
  });
  let jukeboxTrack: JukeboxTrack | null = null;
  journal.onToggleAmbience(() => {
    sound.toggleAmbience();
    invalidate();
  });
  journal.onStepTrack((delta) => {
    if (!state.journalOpen) return;
    const baseTrack = jukeboxTrack ?? soundtrackFor(content.world, state, {
      titleOpen: titleMode !== null || qaMenuOpen,
    }).track;
    const currentIndex = baseTrack === "silent" ? -1 : jukeboxTracks.indexOf(baseTrack);
    const startIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
    const nextIndex = (startIndex + delta + jukeboxTracks.length) % jukeboxTracks.length;
    const nextTrack = jukeboxTracks[nextIndex];
    if (nextTrack === undefined) return;
    jukeboxTrack = nextTrack;
    invalidate();
  });
  journal.onToggleGentleTiming(() => {
    gameSettings.toggleGentleTiming();
    invalidate();
  });
  journal.onToggleKeyHints(() => {
    gameSettings.toggleKeyHints();
    invalidate();
  });
  journal.onCycleTextSpeed(() => {
    gameSettings.cycleTextSpeed();
    invalidate();
  });
  journal.onToggleReducedMotion(() => {
    gameSettings.toggleReducedMotion();
    invalidate();
  });
  const title = createTitleScreen(uiRoot);
  const qaMenu = qaTools === null ? null : qaTools.createQaMenu(uiRoot, qaEntries);
  const qaBadge = qaTools === null ? null : qaTools.createQaBadge(uiRoot);
  if (qaTools !== null && qaError !== null) qaTools.createQaError(uiRoot, qaError);
  const credits = createCredits(uiRoot);
  const input = createInputSource(() => {
    return combineInputFrames(
      keyboard.frame(),
      touch.sample(),
      gamepad.frame(),
    );
  });
  dialogueBox.onChoose((index) => touch.tapChoice(index));
  commandMenu.onChoose((index) => touch.tapChoice(index));
  battleHud.onTogether(() => touch.tapButton("cancel"));
  battleHud.onFlute(() => touch.tapButton("flute"));
  battleHud.onLasso(() => touch.tapButton("lasso"));
  journal.onClose(() => touch.tapButton("cancel"));
  const view = new GameView(content.world, {
    debugLabel: import.meta.env.DEV || import.meta.env.MODE === "harness",
    renderer: app.renderer,
  });
  app.stage.addChild(view.root);
  const initialFixture = content.fixtures["new-game"];
  if (initialFixture === undefined) throw new Error("Missing new-game fixture");
  const fresh = createState(content.world, initialFixture);
  const speciesXp = Object.fromEntries(
    Object.values(content.world.critters).map((kind) => [
      kind.species,
      content.world.levels.critters[kind.id]?.xp ?? 0,
    ]),
  );
  const parseWorldSave = (raw: string): State | null =>
    parseSave(raw, fresh, speciesXp, content.world.levels.thresholds);
  const saved = qaUrlPack === null && qaError === null
    ? await Preferences.get({ key: saveKey }) : { value: null };
  const restored = qaUrlPack === null
    ? saved.value === null ? null : parseWorldSave(saved.value)
    : parseWorldSave(qaUrlPack.save);
  state = restored ?? fresh;
  let previousState: State = state;
  // A real boot opens on the title (spec 7.3), with the game frozen behind it:
  // no core ticks run, so Continue resumes the save exactly as it was written.
  // Fixture resets (the harness) skip it.
  let titleMode: TitleMode | null = qaError !== null ? null : qaUrlPack === null
    ? restored === null ? "fresh" : "continue"
    : null;
  let qaMenuOpen = false;
  let qaActivePack: PackState | null = qaUrlPack;
  const qaBlocked = qaError !== null;
  let qaJustPicked = false;
  let qaSelected = 0;
  let qaReturnMode: TitleMode = restored === null ? "fresh" : "continue";
  let titleSelected: TitleChoiceId =
    restored === null ? "new-game" : "continue";
  const applyTitle = (input: TitleInput): void => {
    if (titleMode === null || qaBlocked || qaActivePack !== null) return;
    const result = titleFlow(titleMode, titleSelected, input);
    titleMode = result.mode;
    titleSelected = result.selected;
    if (result.action === "new-game") {
      state = createState(content.world, initialFixture);
      previousState = state;
      clearAreaBanner();
      jukeboxTrack = null;
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
  const saveState = (snapshot: State): Promise<void> => {
    if (suppressSave || qaBlocked || qaActivePack !== null) return Promise.resolve();
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
  const save = (): Promise<void> => saveState(state);
  const pickQa = (item: PackState): void => {
    const loaded = parseWorldSave(item.save);
    if (loaded === null) throw new Error(`QA save ${item.pack.id} is invalid`);
    state = loaded; previousState = state; qaActivePack = item; qaMenuOpen = false;
    clearAreaBanner();
    titleMode = null;
    qaJustPicked = true;
    swallowed.add("confirm");
  };
  const openQa = (): void => {
    if (qaTools === null || qaBlocked || qaEntries.length === 0 || titleMode === null) return;
    qaReturnMode = titleMode; qaMenuOpen = true;
  };
  title.onQa(openQa);
  // The QA console (spec 11): open with the backtick key or a tap on the QA
  // badge, only while a pack is active. While it is open the game is frozen,
  // like the title: no core ticks run.
  let qaConsoleOpen = false;
  const qaConsole = qaTools === null ? null : qaTools.createQaConsole(uiRoot, {
    run: (line) => {
      const outcome = qaTools.runConsoleCommand({
        story: content.world.story,
        stickerIds: content.world.stickers.catalogue.map((sticker) => sticker.id),
        prizeIds: content.world.arcade.prizes.map((prize) => prize.id),
        treatIds: content.world.treats.map((treat) => treat.id),
        fishIds: content.world.arcade.fish.catches.map((item) => item.id),
        thresholds: content.world.levels.thresholds,
      }, state, line);
      if (outcome.kind === "applied") {
        state = outcome.state;
        previousState = state;
        clearAreaBanner();
        invalidate();
      }
      return outcome;
    },
    saveSlot: async (name) => {
      const tick = state.tick;
      const hash = stableHash(state);
      await qaTools.saveQaSlot({ name, tick, hash }, serializeSave(state));
      qaEntries = [...qaPacks, ...await qaTools.loadQaSlots()];
      qaMenu?.setEntries(qaEntries);
      return `Saved QA slot "${name}" (tick ${tick}).`;
    },
    saveFile: () => serializeSave(state),
    close: () => { qaConsoleOpen = false; invalidate(); },
  });
  const openQaConsole = (): void => {
    if (qaConsole === null || qaConsoleOpen || qaActivePack === null ||
        titleMode !== null || qaMenuOpen) return;
    qaConsoleOpen = true;
  };
  qaBadge?.onOpen(openQaConsole);
  qaMenu?.onChoose(pickQa);
  qaMenu?.onCancel(() => {
    qaMenuOpen = false; qaActivePack = null; titleMode = qaReturnMode;
  });
  const assets = createShellAssets({
    world: content.world,
    uiRoot,
    invalidate,
    onHole: createMoleHoleHandler(touch),
  });
  const partyCommands: Record<string, string | null> = Object.fromEntries(
    Object.entries(content.world.party).map(([id, member]) => [id, member.command?.id ?? null]),
  );
  // Boot loads only permanent core sheets + tiny ~1 KB atlas JSON metadata
  // (for journal/credits frame crops) + the initial area. No unused critter
  // images or arcade paintings are decoded up front.
  const [mapCentres] = await Promise.all([
    assets.loadMapCentres(),
    assets.preloadCoreAtlasMeta(),
    view.ready.then(async () => {
      assets.seedCoreSheets();
      const initialArea = content.world.areas[state.area];
      if (initialArea === undefined) throw new Error("Missing initial area");
      await Promise.all([
        view.setArea(initialArea).then(() => assets.cacheAreaNpcPortraits(initialArea)),
        assets.warmAreaMedia(initialArea),
        assets.warmJournalAssets(state),
        assets.decodeAtlasImage(FAE_ATLAS),
        assets.decodeAtlasImage(content.world.battle.toyAtlas),
      ]);
    }),
  ]);
  let afterTick = (_next: State): void => undefined;
  let logTitle = (_mode: TitleMode | null): void => undefined;
  let lastBattleLog = "";
  let lastBattleTalkLog = "";
  let lastBattleButtonsLog = "";
  let lastMusicLog = "";
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
    if (
      journalCache === null ||
      journalCache.ink !== state.ink ||
      journalCache.critters !== state.critters ||
      journalCache.stickers !== state.stickers ||
      journalCache.coins !== state.coins
    )
      journalCache = {
        ink: state.ink,
        critters: state.critters,
        stickers: state.stickers,
        coins: state.coins,
        notes: journalNotes(content.world, state),
      };
    return journalCache.notes;
  };
  let wasJournalOpen = false;
  let wasBattleOpen = false;
  let photoMode = false;
  document.documentElement.dataset.photo = "off";
  const canPhotoMode = (): boolean =>
    titleMode === null &&
    !qaMenuOpen &&
    !qaConsoleOpen &&
    !qaBlocked &&
    state.dialogue === null &&
    state.battle === null &&
    state.arcade === null &&
    !state.journalOpen &&
    state.finale === null;
  const setPhotoMode = (on: boolean): void => {
    const next = on && canPhotoMode();
    photoMode = next;
    document.documentElement.dataset.photo = next ? "on" : "off";
    view.setPhotoMode(next);
    invalidate();
  };
  const render = (alpha = 1): void => {
    if (photoMode && !canPhotoMode()) {
      photoMode = false;
      document.documentElement.dataset.photo = "off";
      view.setPhotoMode(false);
    }
    if (!state.journalOpen || titleMode !== null || qaMenuOpen) jukeboxTrack = null;
    const baseSoundtrack = soundtrackFor(content.world, state, {
      titleOpen: titleMode !== null || qaMenuOpen,
    });
    const soundtrack = jukeboxTrack !== null
      ? {
          ...baseSoundtrack,
          track: jukeboxTrack,
          duck: false,
          title: trackTitles[jukeboxTrack],
        }
      : baseSoundtrack;
    sound.setSoundtrack(soundtrack);
    if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
      const musicKey = `${soundtrack.track}|${soundtrack.ambience}|${soundtrack.duck}`;
      if (musicKey !== lastMusicLog) {
        console.log(`[cloverhollow] music ${JSON.stringify(soundtrack)}`);
        lastMusicLog = musicKey;
      }
    }
    const arcadeState = arcadeView(content.world, state, gameSettings.gentleTiming());
    assets.renderOverlays(arcadeState);
    if (state.journalOpen && !wasJournalOpen) {
      void assets.warmJournalAssets(state).then(() => {
        if (state.journalOpen) invalidate();
      });
    } else if (
      state.journalOpen &&
      Object.values(state.caughtFish ?? {}).some((count) => count > 0) &&
      !assets.hasAtlasMeta(FISH_ATLAS)
    ) {
      void assets.decodeAtlasImage(FISH_ATLAS).then(() => {
        if (state.journalOpen) invalidate();
      });
    }
    wasJournalOpen = state.journalOpen;
    if (arcadeState !== null) document.documentElement.dataset.arcade = "open";
    else delete document.documentElement.dataset.arcade;
    // Which game is open: Comet Cruise's steers by the touch arrows.
    if (state.arcade !== null) document.documentElement.dataset.arcadeGame = state.arcade.game;
    else delete document.documentElement.dataset.arcadeGame;
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
      { paused, alpha: paused ? 1 : alpha, previousState },
    );
    prompt.render(
      state.battle === null &&
        state.arcade === null &&
        state.finale !== "credits" &&
        titleMode === null
        ? view.promptView(state)
        : { visible: false, label: "", x: 0, y: 0 },
    );
    // The recurring critters' "?" and "!" (Milestone 51).
    noticeMarks.render(view.noticeMarks(state));
    const battle = battleView(content.world, state);
    const activeBattle = battle !== null;
    const hasLantern = content.world.storyVariable(state.ink, "has_lantern") === true;
    const hasFlute = content.world.storyVariable(state.ink, "has_flute") === true;
    const hasLasso = content.world.storyVariable(state.ink, "has_lasso") === true;
    if (lanternButton !== null) {
      lanternButton.hidden = !hasLantern;
      lanternButton.classList.toggle("is-on", state.lantern);
    }
    if (fluteButton !== null)
      fluteButton.hidden = !hasFlute;
    const touchActive = document.documentElement.dataset.touch === "on";
    const overworldFree =
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen &&
      !qaBlocked &&
      state.dialogue === null &&
      state.battle === null &&
      state.arcade === null &&
      !state.journalOpen &&
      state.finale !== "credits" &&
      levelUpNotices.length === 0;
    const interactTarget = overworldFree ? targetInteractable(content.world, state) : undefined;
    const interactHint = overworldFree
      ? resolveHudInteractHint({
          hasInteractable: interactTarget !== undefined,
          interactPrompt: interactTarget?.prompt,
          isResting: view.isResting(),
          player: state.player,
          facing: state.facing,
          pettableCompanion: interactTarget === undefined && !view.isResting()
            ? findPettableCompanion(content.world, state)
            : null,
          hasRestSpot: interactTarget === undefined && !view.isResting() &&
            findRestSpot(content.world, state) !== null,
        })
      : { canInteract: false, interactLabel: "Talk" };
    hudHints.render({
      visible: gameSettings.keyHints() && !touchActive && overworldFree,
      canInteract: interactHint.canInteract,
      interactLabel: interactHint.interactLabel,
      hasLantern,
      lanternOn: state.lantern,
      hasFlute,
      muted: sound.muted(),
    });
    if (bannerStartTick >= 0 && state.tick < bannerStartTick) clearAreaBanner();
    const bannerInfo = bannerArea !== null && bannerArea === state.area && !bannerPendingFade
      ? areaBannerInfo(content.world, state.area)
      : null;
    const bannerElapsed = bannerStartTick >= 0 ? state.tick - bannerStartTick : -1;
    if (bannerElapsed >= bannerDuration) clearAreaBanner();
    const showBanner =
      bannerInfo !== null &&
      bannerElapsed >= 0 &&
      bannerElapsed < bannerDuration &&
      state.area !== "harness" &&
      state.dialogue === null &&
      state.battle === null &&
      state.arcade === null &&
      !state.journalOpen &&
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen &&
      !qaBlocked &&
      state.finale === null &&
      state.transition === null &&
      levelUpNotices.length === 0;
    areaBanner.render({
      visible: showBanner,
      title: bannerInfo?.title ?? "",
      region: bannerInfo?.region ?? null,
      progress: showBanner ? (bannerElapsed + 1) / (bannerDuration + 1) : 0,
      qaOffset: qaActivePack !== null,
    });
    title.render({
      visible: titleMode !== null && !qaMenuOpen,
      mode: titleMode ?? "fresh",
      selected: titleSelected,
      continueDetail: continueDetail(content.world, state),
    });
    qaMenu?.render(qaMenuOpen, qaSelected);
    qaBadge?.render(qaActivePack?.pack ?? null);
    qaConsole?.render(qaConsoleOpen);
    if (qaConsoleOpen) document.documentElement.dataset.qaConsole = "open";
    else delete document.documentElement.dataset.qaConsole;
    const creditsOpen = state.finale === "credits";
    credits.render({
      visible: creditsOpen,
      entries: creditsOpen
        ? creditEntries(content.world, state).map((entry) => ({
            ...entry,
            image: assets.atlasFrame(entry.image.atlas, entry.image.frame),
          }))
        : [],
      summary: creditsOpen ? creditsSummary(content.world, state) : [],
    });
    logTitle(titleMode);
    if (titleMode !== null) document.documentElement.dataset.title = "open";
    else delete document.documentElement.dataset.title;
    if (state.finale === "credits") document.documentElement.dataset.credits = "open";
    else delete document.documentElement.dataset.credits;
    if (activeBattle) document.documentElement.dataset.battle = "open";
    else delete document.documentElement.dataset.battle;
    if (battle?.talk !== null && battle?.talk !== undefined)
      document.documentElement.dataset.talk = "open";
    else delete document.documentElement.dataset.talk;
    // Which check is in play (spec 8.1): a catch or a lean shows its touch
    // arrows.
    const checkKind = state.battle?.phase === "check" ? state.battle.check?.kind : undefined;
    if (checkKind !== undefined) document.documentElement.dataset.check = checkKind;
    else delete document.documentElement.dataset.check;
    // An arrow held as a catch, a lean, or a round of Boop-a-Mole or Comet
    // Cruise ends is hidden mid-press and may never see its pointer lifted:
    // outside one, it lets go.
    if (checkKind !== "catch" && checkKind !== "lean" && checkKind !== "echo" &&
        state.arcade?.game !== "mole" && state.arcade?.game !== "comet")
      touch.releaseArrows();
    const hideActions = state.battle?.phase === "check" ||
      state.battle?.phase === "burstResult";
    if (activeBattle && !wasBattleOpen) void assets.warmBattlePortraits(state).then(invalidate);
    wasBattleOpen = activeBattle;
    const showBattleHud = activeBattle && state.battle?.phase !== "reward" &&
      !talkChoicesShown(battle?.talk ?? null);
    const battlePortraits = showBattleHud && state.battle !== null
      ? evaluateBattlePortraits({
          battle: state.battle,
          view: battle,
          partyIds: battleParty(content.world, state.party).map((member) => member.id),
          partyCommands,
          energy: battle?.energy ?? state.battle.energy,
          resolveImage: (id) => assets.speakerPortrait(id),
        })
      : [];
    battleHud.render({
      visible: showBattleHud,
      energy: battle?.energy ?? 0,
      energyMax: battle?.energyMax ?? 0,
      level: levelForXp(content.world.levels, state.xp),
      calm: battle === null ? 0 : battle.calm / Math.max(1, battle.calmMax),
      critterName: activeBattle
        ? `Lv ${content.world.critters[state.battle?.critterId ?? ""]?.level ?? 1} · ` +
          `${content.world.critters[state.battle?.critterId ?? ""]?.name ?? ""}`
        : "",
      sparkle: hideActions ? null : (battle?.sparkle ?? null),
      fluteAssist: hideActions ? null : (battle?.fluteAssist ?? null),
      burstSoften: hideActions ? 0 : (battle?.burstSoften ?? 0),
      lassoAssist: hideActions ? null : (battle?.lassoAssist ?? null),
      lassoSteady: hideActions ? false : (battle?.lassoSteady ?? false),
      portraits: battlePortraits,
    });
    commandMenu.render({
      visible: activeBattle && state.battle?.phase === "command" && battle?.talk === null,
      commands: battle?.commands ?? [],
      selected: battle?.selected ?? 0,
      treatTray: battle?.treatTray ?? null,
    });
    // What the critter feels (spec 8.1), in the menu and over its result.
    const feelingAt = view.battleFeelingAnchor(state, window.innerWidth, window.innerHeight);
    feelingBubble.render(battle === null || battle.feelings === null || feelingAt === null
      ? null
      : { ...battle.feelings, ...feelingAt });
    // A mini-boss's wind-up shows its bubbles there instead (Milestone 50).
    windUpBubbles.render(battle === null || battle.windUp === null || feelingAt === null
      ? null
      : { ...battle.windUp, ...feelingAt });
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
    const geometry = view.battleCheckGeometry(
      state,
      window.innerWidth,
      window.innerHeight,
    );
    touch.setTraceElement(geometry?.kind === "trace" ? geometry.rect : undefined);
    battleCheck.render(battleCheckOverlay(battle, geometry, assets.toyArt));
    rewardSticker.render(
      buildRewardStickerView(content.world, state, activeBattle, arcadeState, assets),
    );
    journal.render(
      buildJournalView({
        world: content.world,
        state,
        notes: state.journalOpen ? notesNow() : [],
        mapCentres,
        art: assets,
        muted: sound.muted(),
        level: sound.level(),
        musicMuted: sound.musicMuted(),
        musicLevel: sound.musicLevel(),
        ambienceMuted: sound.ambienceMuted(),
        nowPlaying: soundtrack.title,
        gentleTiming: gameSettings.gentleTiming(),
        keyHints: gameSettings.keyHints(),
        textSpeed: gameSettings.textSpeed(),
        reducedMotion: gameSettings.reducedMotion(),
        hasLantern,
        hasFlute,
        hasLasso,
      }),
    );
    if (state.journalOpen) document.documentElement.dataset.journal = "open";
    else delete document.documentElement.dataset.journal;
    const dialogueView = buildDialogueView({
      world: content.world,
      state,
      battle,
      arcadeState,
      levelUpNotice: levelUpNotices[0] ?? null,
      speakerPortrait: assets.speakerPortrait,
    });
    if (dialogueView === null) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else {
      dialogueBox.render(dialogueView);
      document.documentElement.dataset.dialogue = "open";
    }
  };
  // The title reads its own input edges from here, never from the core state.
  let titlePrevious: ActionFrame = blankInput();
  let lastFinale: State["finale"] = null;
  let endingSnapshot: State | null = null;
  let creditsTicks = 0;
  // Buttons held when the title closed stay hidden from the game until they're
  // released, so the press that starts the game can't also act in it.
  const swallowed = new Set<"confirm" | "cancel" | "menu">();
  // The area a door's fade-out is warming. Cleared when the transition ends or
  // the game resets, so every crossing prefetches exactly once.
  let prefetchedTarget: string | undefined;
  // True while the harness drives ticks synthetically (the hook's `step`): a
  // replay crossing a dozen doors must load and warm only the area it ends in
  // (spec 11), not every room it passes through.
  let harnessStepping = false;
  const tick = (frame: ActionFrame): void => {
    if (qaJustPicked) { qaJustPicked = false; titlePrevious = frame; return; }
    if (qaMenuOpen) {
      const result = qaFlow(qaEntries.length, qaSelected, {
        up: frame.move.y < -0.5 && titlePrevious.move.y >= -0.5,
        down: frame.move.y > 0.5 && titlePrevious.move.y <= 0.5,
        confirm: frame.confirm && !titlePrevious.confirm,
        cancel: frame.cancel && !titlePrevious.cancel,
      });
      qaSelected = result.selected;
      if (!result.open) {
        qaMenuOpen = false;
        titleMode = qaReturnMode;
        qaActivePack = null;
      }
      if (result.action !== null) {
        const chosen = qaEntries[result.action];
        if (chosen === undefined) throw new Error("QA selection disappeared");
        pickQa(chosen);
      }
      titlePrevious = frame;
      return;
    }
    // The QA console holds the world still while it is open (spec 11).
    if (qaConsoleOpen) {
      titlePrevious = frame;
      return;
    }
    if (qaBlocked) {
      titlePrevious = frame;
      return;
    }
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
    const confirmEdge = input.confirm && !state.previousInput.confirm;
    let dismissedLevelUp = false;
    if (levelUpNotices.length > 0 && confirmEdge) {
      levelUpNotices.shift();
      dismissedLevelUp = true;
    }
    if (state.finale === "credits") {
      creditsTicks += 1;
      if (creditsConfirmAllowed(
        creditsTicks,
        confirmEdge,
      )) {
        // The credits follow the ending in the same session (the morning is
        // never saved), so the dream it saved is always here to wake back into.
        if (endingSnapshot === null)
          throw new Error("the credits closed with no dream to go back to");
        state = endingSnapshot;
        previousState = state;
        clearAreaBanner();
        titleMode = "continue";
        titleSelected = "continue";
        return;
      }
    }
    // The credits step the core like any other tick: it holds the world still
    // (spec 7.4), and the tick and its input stay the same as a replay's.
    const previous = state;
    const stepped = step(content.world, state, input, {
      gentleTiming: gameSettings.gentleTiming(),
      textSpeed: gameSettings.textSpeed(),
    });
    state = stepped.state;
    previousState = state.area === previous.area ? previous : state;
    const clearRest =
      input.move.x !== 0 ||
      input.move.y !== 0 ||
      input.cancel ||
      input.menu ||
      previous.area !== state.area ||
      state.dialogue !== null ||
      state.battle !== null ||
      state.arcade !== null ||
      state.journalOpen ||
      state.transition !== null ||
      state.finale !== null;
    if (clearRest && view.isResting()) {
      view.setResting(null, state.tick);
    }
    const overworldConfirm =
      confirmEdge &&
      !dismissedLevelUp &&
      previous.dialogue === null &&
      previous.battle === null &&
      previous.arcade === null &&
      !previous.journalOpen &&
      previous.transition === null &&
      previous.finale === null &&
      state.dialogue === null &&
      state.battle === null &&
      state.arcade === null &&
      !state.journalOpen &&
      state.transition === null &&
      state.finale === null &&
      previous.area === state.area;
    if (overworldConfirm) {
      if (view.isResting()) {
        view.setResting(null, state.tick);
      } else {
        const restSpot = findRestSpot(content.world, state);
        if (restSpot !== null) {
          view.setResting(restSpot, state.tick);
          sound.playEffect("rest-sit");
        } else {
          const companion = findPettableCompanion(content.world, state);
          if (companion !== null) {
            view.triggerPet(companion.id, state.tick);
            sound.playEffect(petEffectForCompanion(companion.id));
            if (!harnessStepping) haptics.trigger("light");
          }
        }
      }
    }
    if (previous.area !== state.area) {
      if (areaBannerInfo(content.world, state.area) !== null) {
        bannerArea = state.area;
        bannerStartTick = state.tick;
        bannerPendingFade = state.transition !== null;
      } else {
        clearAreaBanner();
      }
    } else if (
      previous.transition !== null &&
      state.transition === null &&
      bannerPendingFade &&
      bannerArea === state.area
    ) {
      bannerStartTick = state.tick;
      bannerPendingFade = false;
    }
    // A door's fade-out knows where it's going: warm that area's art while the
    // fade still covers the screen, so the arrival isn't a white wait on the
    // load (spec 4, transitions). The warm-up belongs to the real-time loop:
    // a synthetic step loads only the area it ends in (spec 11), and warming
    // every room a replay passes through left hundreds of megabytes of decoded
    // art in CI's software-rendered WebKit.
    if (state.transition === null) prefetchedTarget = undefined;
    else if (!harnessStepping) {
      const target =
        state.transition.phase === "out" ? state.transition.target.area : undefined;
      if (target !== undefined && target !== prefetchedTarget) {
        const targetArea = content.world.areas[target];
        if (targetArea !== undefined) {
          view.prefetch(targetArea);
          void assets.warmAreaOverlays(targetArea.id);
        }
        prefetchedTarget = target;
      }
    }
    if (state.finale !== lastFinale) {
      if (import.meta.env.DEV || import.meta.env.MODE === "harness")
        console.log(`[cloverhollow] finale ${state.finale ?? "null"}`);
      lastFinale = state.finale;
      if (state.finale === "credits") creditsTicks = 0;
    }
    for (const event of stepped.events) {
      if (event.type === "level-up") {
        const friend = event.member !== "fae";
        const name = friend ? (content.world.party[event.member]?.name ?? event.member) : "Fae";
        levelUpNotices.push(levelUpLine(name, event.from, event.to, event.deltas, friend));
      }
      if (event.type === "ending-save") {
        endingSnapshot = event.state;
        if (qaActivePack === null && !qaBlocked) void saveState(event.state);
      }
    }
    const activeTalk = state.dialogue ?? state.battle?.talk ?? null;
    const choiceIndex =
      state.dialogue?.selected ?? state.battle?.talk?.selected ?? state.battle?.selected ?? 0;
    const soundContext = {
      speaker: activeTalk?.speaker ?? null,
      text: activeTalk?.text,
      revealed: activeTalk?.revealed,
      choiceIndex,
    };
    const cues = soundCues(previous, state, content.world);
    for (const cue of cues) {
      const played = sound.play(cue, state.tick, soundContext);
      if (import.meta.env.DEV || import.meta.env.MODE === "harness")
        console.log(`[cloverhollow] sound ${JSON.stringify(played)}`);
    }
    if (!harnessStepping) {
      const soothedNow = previous.battle?.phase !== "soothed" && state.battle?.phase === "soothed";
      if (
        soothedNow ||
        cues.includes("battle-together") ||
        cues.includes("prize-won") ||
        cues.includes("fish-catch")
      ) {
        haptics.trigger("celebrate");
      } else if (cues.includes("battle-hit") && state.battle?.lastGrade === "great") {
        haptics.trigger("medium");
      } else if (
        cues.includes("claw-grab") ||
        cues.includes("mole-boop") ||
        cues.includes("fish-bite")
      ) {
        haptics.trigger("light");
      }
    }
    if (qaActivePack === null && !qaBlocked && autosaveNeeded(previous, state)) void save();
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
      const talk = state.battle?.talk ?? null;
      const talkLog = talk === null
        ? "closed"
        : `${talk.speaker ?? ""}|${talk.choices.join("|")}`;
      if (talkLog !== lastBattleTalkLog) {
        if (talk !== null)
          console.log(
            `[cloverhollow] battle-talk ${JSON.stringify({
              speaker: talk.speaker,
              choices: talk.choices,
            })}`,
          );
        lastBattleTalkLog = talkLog;
      }
    }
    afterTick(state);
  };
  let areaLoad: Promise<void> | undefined;
  // Loads whatever area the state is in. If a load for an older target is still
  // in flight, waits for it and checks again, so callers always end up with the
  // current area loaded. `fresh` loads it again even if it's the one shown.
  const ensureArea = async (fresh = false): Promise<void> => {
    let reload = fresh;
    for (;;) {
      if (areaLoad !== undefined) {
        await areaLoad;
        continue;
      }
      const area = content.world.areas[state.area];
      if (area === undefined) throw new Error(`Unknown area ${state.area}`);
      if (!reload && view.loadedAreaId() === area.id) {
        await Promise.all([
          assets.warmAreaMedia(area),
          state.battle !== null ? assets.warmBattlePortraits(state) : Promise.resolve(),
        ]);
        return;
      }
      reload = false;
      areaLoad = Promise.all([
        view.setArea(area).then(() => assets.cacheAreaNpcPortraits(area)),
        assets.warmAreaMedia(area),
        state.battle !== null ? assets.warmBattlePortraits(state) : Promise.resolve(),
      ])
        .then(() => {
          view.resetCamera();
          previousState = state;
        })
        .finally(() => {
          areaLoad = undefined;
          invalidate();
        });
    }
  };
  for (const type of ["resize", "pointerdown", "pointerup"])
    window.addEventListener(type, invalidate);
  let last = performance.now();
  let accumulator = 0;
  app.ticker.add(() => {
    gamepad.poll();
    const bumperStep = gamepad.consumeBumperStep();
    if (
      bumperStep !== 0 &&
      state.journalOpen &&
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen
    ) {
      journal.stepPage(bumperStep);
      sound.play("choice-move", state.tick);
      invalidate();
    }
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
    if (!paused || areaLoad !== undefined || drawPending) {
      drawPending = false;
      const alpha = paused || areaLoad !== undefined
        ? 1
        : Math.min(1, Math.max(0, accumulator / (1000 / 60)));
      render(alpha);
      app.render();
    }
  });
  render();
  // Photo / showcase mode (spec 4): P hides overworld chrome for unobstructed
  // storybook views; Escape exits cleanly.
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.target instanceof HTMLElement &&
        event.target.closest("input, textarea") !== null) return;
    if (state.journalOpen && titleMode === null && !qaMenuOpen && !qaConsoleOpen) {
      if (event.code === "BracketLeft" || event.code === "PageUp") {
        event.preventDefault();
        journal.stepPage(-1);
        sound.play("choice-move", state.tick);
        invalidate();
        return;
      }
      if (event.code === "BracketRight" || event.code === "PageDown") {
        event.preventDefault();
        journal.stepPage(1);
        sound.play("choice-move", state.tick);
        invalidate();
        return;
      }
    }
    if (event.code === "KeyP") {
      if (!canPhotoMode()) return;
      event.preventDefault();
      setPhotoMode(!photoMode);
      return;
    }
    if (event.code === "Escape" && photoMode) {
      event.preventDefault();
      setPhotoMode(false);
    }
  });
  // The QA keys: Q opens the save library on the title, and the backtick key
  // toggles the QA console while a pack is active (spec 11). Opening or
  // closing redraws, so the console appears over a game the harness paused.
  if (qaEnabled) window.addEventListener("keydown", (event) => {
    if (event.code === "KeyQ") {
      if (event.target instanceof HTMLElement &&
          event.target.closest("input, textarea") !== null) return;
      event.preventDefault();
      openQa();
      return;
    }
    if (event.code === "Backquote") {
      event.preventDefault();
      if (qaConsoleOpen) qaConsoleOpen = false;
      else openQaConsole();
      invalidate();
      return;
    }
    if (event.code === "Escape" && qaConsoleOpen) {
      event.preventDefault();
      qaConsoleOpen = false;
      invalidate();
    }
  });
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const { installHook } = await import("./dev/hook");
    installHook({
      input,
      get: () => state,
      tick,
      ensureArea,
      render: () => {
        render();
        invalidate();
      },
      paused: () => paused,
      setPaused: (value) => {
        paused = value;
      },
      setStepping: (value) => {
        harnessStepping = value;
      },
      reset: async (options) => {
        keyboard.clearTaps();
        gamepad.clearTaps();
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
        previousState = state;
        clearAreaBanner();
        suppressSave = false;
        prefetchedTarget = undefined;
        await Promise.all([ensureArea(), assets.warmJournalAssets(state)]);
        titleMode = null;
        jukeboxTrack = null;
        qaMenuOpen = false;
        qaActivePack = null;
        qaJustPicked = false;
        qaConsoleOpen = false;
        setPhotoMode(false);
        levelUpNotices.length = 0;
        swallowed.clear();
      },
      renderInfo: () => ({
        ...view.renderInfo(state),
        arcade: assets.overlayInfo(),
      }),
      qa: {
        active: () => qaActivePack !== null,
        packs: () => qaPacks.map((item) => item.pack),
      },
      save: {
        clear: async () => {
          if (qaActivePack !== null || qaBlocked) return;
          await saveQueue;
          await Preferences.remove({ key: saveKey });
          saveLast = null;
        },
        last: () => saveLast,
        loaded: () => qaActivePack === null && !qaBlocked ? saveLoaded : null,
      },
      sound: {
        log: sound.log,
        muted: sound.muted,
        level: sound.level,
        state: sound.state,
        music: sound.music,
      },
      settings: {
        gentleTiming: gameSettings.gentleTiming,
        setGentleTiming: (on) => {
          gameSettings.setGentleTiming(on);
          invalidate();
        },
        keyHints: gameSettings.keyHints,
        setKeyHints: (on) => {
          gameSettings.setKeyHints(on);
          invalidate();
        },
        textSpeed: gameSettings.textSpeed,
        setTextSpeed: (speed) => {
          gameSettings.setTextSpeed(speed);
          invalidate();
        },
        reducedMotion: gameSettings.reducedMotion,
        setReducedMotion: (on) => {
          gameSettings.setReducedMotion(on);
          invalidate();
        },
        photoMode: () => photoMode,
        setPhotoMode: (on) => {
          setPhotoMode(on);
        },
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
