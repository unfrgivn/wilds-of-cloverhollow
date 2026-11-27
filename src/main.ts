import { Application, Rectangle } from "pixi.js";
import {
  blankInput,
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type Point,
  type State,
  battleView,
  soundCues,
  type JukeboxTrack,
  type SoundtrackState,
  arcadeView,
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
import {
  createBattleHud,
  createCommandMenu,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  createRewardSticker,
} from "./ui/battle";
import { createJournal } from "./ui/journal";
import { computeJournalScrollDelta } from "./ui/journal-nav";
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
  buildBattleHudView,
  buildCreditsView,
  buildDialogueView,
  buildHudHintsView,
  buildJournalView,
  buildRewardStickerView,
  createMoleHoleHandler,
  createShellAssets,
  FAE_ATLAS,
  FISH_ATLAS,
} from "./shell/assets";
import {
  buildSoundContext,
  captureAreaPostcard,
  collectLevelUpNotices,
  createAreaBannerTracker,
  createJournalNotesCache,
  hapticForTick,
  isOverworldConfirm,
  petEffectForCompanion,
  resolveArcadeOutcome,
  resolveSoundtrack,
  shouldClearRest,
  stepJukeboxTrack,
} from "./shell/feedback";
import { createSaveStore, shouldShowSaveToast } from "./shell/save-storage";
import { createAudio } from "./platform/audio";
import { createHaptics } from "./platform/haptics";
import { findPettableCompanion, findRestSpot } from "./render/companions";
import type { AudioLevel } from "./platform/audio-settings";
import { createGameSettings } from "./platform/game-settings";
import { createMinigameRecords } from "./platform/minigame-records";
import type { ArcadeRecordBadge } from "./ui/arcade-popups";
import { createAreaBanner } from "./ui/area-banner";
import { createHudHints, type HudInputMode } from "./ui/hud-hints";
import { createSaveToast } from "./ui/save-toast";
import {
  createPhotoTouchBar,
  createShutterFlash,
  type PostcardCapture,
} from "./ui/postcard";
import { qaFlow } from "./shell/qa-flow";
import { shouldFlushSaveOnHide, shouldFreezeLiveLoop } from "./shell/lifecycle";
import type { PackState } from "./dev/qa";

const content = loadContent();
const app = new Application();
let state: State;
const levelUpNotices: string[] = [];
let paused = false;

// One save slot (spec 10).
const saveKey = "cloverhollow-save";

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
  const minigameRecords = createMinigameRecords(() => {
    invalidate();
  });
  let activeArcadeRecord: ArcadeRecordBadge | null = null;
  let fishStreak = 0;
  syncReducedMotion();
  const hudHints = createHudHints(uiRoot);
  let lastInputMode: HudInputMode = "keyboard";
  const saveToast = createSaveToast(uiRoot);
  const areaBanner = createAreaBanner(uiRoot);
  const shutterFlash = createShutterFlash(uiRoot);
  const bannerTracker = createAreaBannerTracker();
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
    const nextTrack = stepJukeboxTrack(
      content.world,
      state,
      jukeboxTrack,
      delta,
      titleMode !== null || qaMenuOpen,
    );
    if (nextTrack === null) return;
    jukeboxTrack = nextTrack;
    invalidate();
  });
  journal.onResetJukebox(() => {
    if (jukeboxTrack === null) return;
    jukeboxTrack = null;
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
  const saveStore = createSaveStore(saveKey);
  const savedRaw = qaUrlPack === null && qaError === null ? await saveStore.load() : null;
  const restored = qaUrlPack === null
    ? savedRaw === null ? null : parseWorldSave(savedRaw)
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
      bannerTracker.clear();
      saveToast.hide();
      jukeboxTrack = null;
      void saveStore.clear();
      saveDirty = false;
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
  saveStore.setLoaded(
    restored === null ? null : { tick: restored.tick, hash: stableHash(restored) },
  );
  let saveDirty = false;
  let suppressSave = false;
  // True while the harness drives ticks synthetically (the hook's `step`): a
  // replay crossing a dozen doors must load and warm only the area it ends in
  // (spec 11), not every room it passes through.
  let harnessStepping = false;
  const saveState = async (
    snapshot: State,
    options?: { silent?: boolean },
  ): Promise<void> => {
    if (suppressSave || qaBlocked || qaActivePack !== null) return;
    const serialized = serializeSave(snapshot);
    const hash = stableHash(snapshot);
    if (snapshot === state) saveDirty = false;
    const silent = options?.silent ?? false;
    const liveAtStart =
      !silent && !document.hidden && !paused && !harnessStepping && titleMode === null;
    const wrote = await saveStore.write(serialized, { tick: snapshot.tick, hash });
    if (
      liveAtStart &&
      shouldShowSaveToast({
        wrote,
        silent,
        documentHidden: document.hidden,
        paused,
        harnessStepping,
        qaActive: qaActivePack !== null || qaBlocked,
        titleOpen: titleMode !== null,
        area: snapshot.area,
        photoMode,
        inBattle: state.battle !== null,
        journalOpen: state.journalOpen,
        inFinale: state.finale !== null,
      })
    ) {
      saveToast.show();
    }
  };
  const save = (): Promise<void> => saveState(state);
  const flushSaveOnHide = (): void => {
    if (
      shouldFlushSaveOnHide({
        qaActive: qaActivePack !== null || qaBlocked || qaMenuOpen || qaConsoleOpen,
        titleOpen: titleMode !== null,
        area: state.area,
        inFinale: state.finale !== null,
        inBattle: state.battle !== null,
        inArcade: state.arcade !== null,
        autosaveNeeded:
          saveDirty &&
          !paused &&
          !harnessStepping &&
          !suppressSave &&
          state.transition === null,
      })
    ) {
      void saveState(state, { silent: true });
    }
  };
  const pickQa = (item: PackState): void => {
    const loaded = parseWorldSave(item.save);
    if (loaded === null) throw new Error(`QA save ${item.pack.id} is invalid`);
    state = loaded; previousState = state; qaActivePack = item; qaMenuOpen = false;
    saveDirty = false;
    bannerTracker.clear();
    saveToast.hide();
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
        bannerTracker.clear();
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
  let logMusic = (_soundtrack: SoundtrackState): void => undefined;
  let logBattle = (_next: State): void => undefined;
  let logBattleButtons = (_active: boolean, _next: State): void => undefined;
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const {
      createBattleButtonsLogger,
      createBattleLogger,
      createMusicLogger,
      createStateLogger,
      createTitleLogger,
      logPointers,
      logTouchLayout,
    } = await import("./dev/state-log");
    logTouchLayout();
    logPointers();
    afterTick = createStateLogger(content.world);
    logTitle = createTitleLogger();
    logMusic = createMusicLogger();
    logBattle = createBattleLogger();
    logBattleButtons = createBattleButtonsLogger(uiRoot);
    afterTick(state);
  }
  const notesNow = createJournalNotesCache(content.world);
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
    if (next) saveToast.hide();
    else shutterFlash.hide();
    invalidate();
  };
  let battlePeekOpen = false;
  const canBattlePeek = (): boolean =>
    titleMode === null &&
    !qaMenuOpen &&
    !qaConsoleOpen &&
    !qaBlocked &&
    !state.journalOpen &&
    state.battle !== null &&
    state.battle.phase === "command" &&
    (state.battle.talk === undefined || state.battle.talk === null);
  const setBattlePeek = (on: boolean): void => {
    const next = on && canBattlePeek();
    if (next === battlePeekOpen) return;
    battlePeekOpen = next;
    sound.play("choice-move", state.tick);
    invalidate();
  };
  battleHud.onPeekToggle(() => setBattlePeek(!battlePeekOpen));
  battleHud.onPeekClose(() => setBattlePeek(false));
  const syncOpenFlag = (
    name: "arcade" | "qaConsole" | "title" | "credits" | "battle" | "talk" | "journal",
    open: boolean,
  ): void => {
    if (open) document.documentElement.dataset[name] = "open";
    else delete document.documentElement.dataset[name];
  };
  const render = (alpha = 1): void => {
    if (photoMode && !canPhotoMode()) {
      photoMode = false;
      document.documentElement.dataset.photo = "off";
      view.setPhotoMode(false);
      shutterFlash.hide();
    }
    if (battlePeekOpen && !canBattlePeek()) {
      battlePeekOpen = false;
    }
    if (!state.journalOpen || titleMode !== null || qaMenuOpen) jukeboxTrack = null;
    const { soundtrack, jukebox } = resolveSoundtrack(
      content.world,
      state,
      jukeboxTrack,
      titleMode !== null || qaMenuOpen,
    );
    sound.setSoundtrack(soundtrack);
    logMusic(soundtrack);
    const arcadeState = arcadeView(content.world, state, gameSettings.gentleTiming());
    assets.renderOverlays(arcadeState, activeArcadeRecord);
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
    syncOpenFlag("arcade", arcadeState !== null);
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
    hudHints.render(
      buildHudHintsView({
        world: content.world,
        state,
        keyHints: gameSettings.keyHints(),
        touchActive,
        overworldFree,
        isResting: view.isResting(),
        hasLantern,
        hasFlute,
        muted: sound.muted(),
        canPhoto: canPhotoMode() && !photoMode,
        canBattlePeek: canBattlePeek(),
        inputMode: lastInputMode,
      }),
    );
    const bannerEligible =
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen &&
      !qaBlocked &&
      levelUpNotices.length === 0;
    areaBanner.render(
      bannerTracker.view(content.world, state, bannerEligible, qaActivePack !== null),
    );
    title.render({
      visible: titleMode !== null && !qaMenuOpen,
      mode: titleMode ?? "fresh",
      selected: titleSelected,
      continueDetail: continueDetail(content.world, state),
    });
    qaMenu?.render(qaMenuOpen, qaSelected);
    qaBadge?.render(qaActivePack?.pack ?? null);
    qaConsole?.render(qaConsoleOpen);
    syncOpenFlag("qaConsole", qaConsoleOpen);
    const creditsOpen = state.finale === "credits";
    if (photoMode || titleMode !== null || activeBattle || state.journalOpen || creditsOpen) {
      saveToast.hide();
    }
    credits.render(buildCreditsView(content.world, state, assets));
    logTitle(titleMode);
    syncOpenFlag("title", titleMode !== null);
    syncOpenFlag("credits", creditsOpen);
    syncOpenFlag("battle", activeBattle);
    syncOpenFlag("talk", battle?.talk !== null && battle?.talk !== undefined);
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
    if (activeBattle && !wasBattleOpen) void assets.warmBattlePortraits(state).then(invalidate);
    wasBattleOpen = activeBattle;
    battleHud.render(
      buildBattleHudView({
        world: content.world,
        state,
        battle,
        partyCommands,
        paused,
        canPeek: canBattlePeek(),
        peekOpen: battlePeekOpen,
        speakerPortrait: assets.speakerPortrait,
      }),
    );
    commandMenu.render({
      visible: activeBattle && state.battle?.phase === "command" && battle?.talk === null,
      commands: battle?.commands ?? [],
      selected: battle?.selected ?? 0,
      treatTray: battle?.treatTray ?? null,
    });
    // What the critter feels (spec 8.1), in the menu and over its result.
    // Step aside while the Battle Field Guide Peek card is open so the cloud
    // never peeks out behind the card.
    const feelingAt = view.battleFeelingAnchor(state, window.innerWidth, window.innerHeight);
    feelingBubble.render(
      battlePeekOpen || battle === null || battle.feelings === null || feelingAt === null
        ? null
        : { ...battle.feelings, ...feelingAt },
    );
    // A mini-boss's wind-up shows its bubbles there instead (Milestone 50).
    windUpBubbles.render(
      battlePeekOpen || battle === null || battle.windUp === null || feelingAt === null
        ? null
        : { ...battle.windUp, ...feelingAt },
    );
    logBattleButtons(activeBattle, state);
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
        notes: state.journalOpen ? notesNow(state) : [],
        mapCentres,
        art: assets,
        muted: sound.muted(),
        level: sound.level(),
        musicMuted: sound.musicMuted(),
        musicLevel: sound.musicLevel(),
        ambienceMuted: sound.ambienceMuted(),
        nowPlaying: soundtrack.title,
        jukebox,
        arcadeRecords: minigameRecords.records(),
        gentleTiming: gameSettings.gentleTiming(),
        keyHints: gameSettings.keyHints(),
        textSpeed: gameSettings.textSpeed(),
        reducedMotion: gameSettings.reducedMotion(),
        hasLantern,
        hasFlute,
        hasLasso,
        inputMode: lastInputMode,
      }),
    );
    syncOpenFlag("journal", state.journalOpen);
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
  let journalCancelDown = false;
  // The area a door's fade-out is warming. Cleared when the transition ends or
  // the game resets, so every crossing prefetches exactly once.
  let prefetchedTarget: string | undefined;
  const tick = (frame: ActionFrame): void => {
    if (qaJustPicked) {
      qaJustPicked = false;
      titlePrevious = frame;
      journalCancelDown = frame.cancel;
      return;
    }
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
      journalCancelDown = frame.cancel;
      return;
    }
    // The QA console holds the world still while it is open (spec 11).
    if (qaConsoleOpen) {
      titlePrevious = frame;
      journalCancelDown = frame.cancel;
      return;
    }
    if (qaBlocked) {
      titlePrevious = frame;
      journalCancelDown = frame.cancel;
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
      journalCancelDown = frame.cancel;
      if (titleMode === null) {
        for (const button of ["confirm", "cancel", "menu"] as const)
          if (frame[button]) swallowed.add(button);
      }
      return;
    }
    for (const button of swallowed)
      if (!frame[button]) swallowed.delete(button);
    const journalCancelEdge = frame.cancel && !journalCancelDown;
    journalCancelDown = frame.cancel;
    if (
      journalCancelEdge &&
      !swallowed.has("cancel") &&
      state.journalOpen &&
      journal.hasOpenOverlay()
    ) {
      journal.dismissOverlay();
      swallowed.add("cancel");
      sound.play("choice-move", state.tick);
      invalidate();
    }
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
        bannerTracker.clear();
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
    if (!paused && !harnessStepping && state.tick !== previous.tick) saveDirty = true;
    previousState = state.area === previous.area ? previous : state;
    const arcadeOutcome = resolveArcadeOutcome(
      content.world,
      previous,
      state,
      gameSettings.gentleTiming(),
      minigameRecords,
      fishStreak,
      activeArcadeRecord,
    );
    activeArcadeRecord = arcadeOutcome.record;
    fishStreak = arcadeOutcome.fishStreak;
    if (shouldClearRest(input, previous, state) && view.isResting()) {
      view.setResting(null, state.tick);
    }
    if (isOverworldConfirm(confirmEdge, dismissedLevelUp, previous, state)) {
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
    bannerTracker.update(content.world, previous, state);
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
    levelUpNotices.push(...collectLevelUpNotices(content.world, stepped.events));
    for (const event of stepped.events) {
      if (event.type === "ending-save") {
        endingSnapshot = event.state;
        if (qaActivePack === null && !qaBlocked) void saveState(event.state);
      }
    }
    const soundContext = buildSoundContext(state);
    const cues = soundCues(previous, state, content.world);
    for (const cue of cues) {
      const played = sound.play(cue, state.tick, soundContext);
      if (import.meta.env.DEV || import.meta.env.MODE === "harness")
        console.log(`[cloverhollow] sound ${JSON.stringify(played)}`);
    }
    if (!harnessStepping) {
      const haptic = hapticForTick(previous, state, cues, {
        goldenCooked: arcadeOutcome.goldenCooked,
      });
      if (haptic !== null) haptics.trigger(haptic);
    }
    if (qaActivePack === null && !qaBlocked && autosaveNeeded(previous, state)) void save();
    logBattle(state);
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
  const snapPostcard = async (
    options?: { download?: boolean },
  ): Promise<PostcardCapture | null> => {
    if (!photoMode || !canPhotoMode()) return null;
    sound.playEffect("camera-shutter");
    shutterFlash.trigger();
    if (!harnessStepping) haptics.trigger("light");
    render(1);
    app.render();
    const extracted = app.renderer.extract.canvas({
      target: app.stage,
      frame: new Rectangle(0, 0, app.screen.width, app.screen.height),
      resolution: app.renderer.resolution,
      clearColor: 0xf8edcf,
    });
    const sourceCanvas = extracted instanceof HTMLCanvasElement ? extracted : app.canvas;
    return captureAreaPostcard(
      content.world,
      state.area,
      sourceCanvas,
      options?.download !== false,
    );
  };
  createPhotoTouchBar(uiRoot, {
    onSnap: () => {
      void snapPostcard({ download: true });
    },
    onClose: () => setPhotoMode(false),
  });
  for (const type of ["resize", "pointerdown", "pointerup"])
    window.addEventListener(type, invalidate);
  let last = performance.now();
  let accumulator = 0;
  app.ticker.add(() => {
    gamepad.poll();
    if (gamepad.consumeActivity() && lastInputMode !== "gamepad") {
      lastInputMode = "gamepad";
      invalidate();
    }
    const photoAction = gamepad.consumePhotoAction();
    if (photoAction === "toggle") {
      if (canBattlePeek()) {
        setBattlePeek(!battlePeekOpen);
      } else if (canPhotoMode() && state.transition === null) {
        setPhotoMode(!photoMode);
      }
    } else if (photoAction === "snap" && photoMode && canPhotoMode()) {
      swallowed.add("confirm");
      gamepad.clearTaps();
      void snapPostcard({ download: true });
    } else if (photoAction === "exit") {
      if (photoMode) {
        setPhotoMode(false);
        swallowed.add("cancel");
        gamepad.clearTaps();
      } else if (battlePeekOpen) {
        setBattlePeek(false);
        swallowed.add("cancel");
        gamepad.clearTaps();
      }
    }

    const bumperStep = gamepad.consumeBumperStep();
    const navStep = gamepad.consumeNavStep();
    const journalConfirmEdge = gamepad.consumeConfirmEdge();
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
    if (
      state.journalOpen &&
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen &&
      !journal.hasOpenOverlay()
    ) {
      const scrollDelta = computeJournalScrollDelta(gamepad.rightStickY());
      if (scrollDelta !== 0 && journal.scrollActivePage(scrollDelta)) {
        invalidate();
      }
      if (navStep !== null && journal.navigateFocus(navStep)) {
        sound.play("choice-move", state.tick);
        invalidate();
      }
      if (journalConfirmEdge && journal.activateFocused()) {
        sound.play("choice-move", state.tick);
        invalidate();
      }
    }
    const now = performance.now();
    accumulator += Math.min(now - last, 250);
    last = now;
    if (
      shouldFreezeLiveLoop({
        documentHidden: document.hidden,
        paused,
        areaLoading: areaLoad !== undefined,
      })
    ) {
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
    if ((!paused && !document.hidden) || areaLoad !== undefined || drawPending) {
      drawPending = false;
      const alpha = paused || areaLoad !== undefined
        ? 1
        : Math.min(1, Math.max(0, accumulator / (1000 / 60)));
      render(alpha);
      app.render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keyboard.clearAll();
      gamepad.clearTaps();
      touch.releaseArrows();
      accumulator = 0;
      flushSaveOnHide();
    } else {
      last = performance.now();
      accumulator = 0;
      invalidate();
    }
  });
  window.addEventListener("pagehide", () => {
    flushSaveOnHide();
  });
  render();
  // Photo / showcase mode (spec 4): P hides overworld chrome for unobstructed
  // storybook views; Enter/Space snaps a framed Postcard PNG; Escape exits cleanly.
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement &&
        event.target.closest("input, textarea") !== null) return;
    if (lastInputMode !== "keyboard") {
      lastInputMode = "keyboard";
      invalidate();
    }
    if (
      state.journalOpen &&
      titleMode === null &&
      !qaMenuOpen &&
      !qaConsoleOpen &&
      !journal.hasOpenOverlay()
    ) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const inSlider =
        target !== null && target.closest(".journal-opt-slider, .journal-volume-slider") !== null;
      if ((event.code === "ArrowUp" || event.code === "ArrowDown") && !inSlider) {
        if (journal.navigateFocus(event.code === "ArrowUp" ? "up" : "down")) {
          event.preventDefault();
          invalidate();
        }
        return;
      }
      if (
        !event.repeat &&
        (event.code === "ArrowLeft" || event.code === "ArrowRight") &&
        !inSlider &&
        target !== null &&
        target.closest(".journal-jukebox") === null &&
        target.closest(".journal-map-page, .journal-slot.is-inspectable") !== null
      ) {
        if (journal.navigateFocus(event.code === "ArrowLeft" ? "left" : "right")) {
          event.preventDefault();
          invalidate();
        }
        return;
      }
    }
    if (event.repeat) return;
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
    if (event.code === "KeyI" && canBattlePeek()) {
      event.preventDefault();
      setBattlePeek(!battlePeekOpen);
      return;
    }
    if (event.code === "Escape" && battlePeekOpen) {
      event.preventDefault();
      event.stopPropagation();
      setBattlePeek(false);
      swallowed.add("cancel");
      keyboard.clearTaps();
      return;
    }
    if (event.code === "KeyP") {
      if (!canPhotoMode()) return;
      event.preventDefault();
      setPhotoMode(!photoMode);
      return;
    }
    if ((event.code === "Enter" || event.code === "Space") && photoMode && canPhotoMode()) {
      event.preventDefault();
      swallowed.add("confirm");
      keyboard.clearTaps();
      void snapPostcard({ download: true });
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
        saveDirty = false;
        state = createState(content.world, fixture, options.seed);
        previousState = state;
        bannerTracker.clear();
        saveToast.hide();
        suppressSave = false;
        prefetchedTarget = undefined;
        await Promise.all([ensureArea(), assets.warmJournalAssets(state)]);
        titleMode = null;
        jukeboxTrack = null;
        qaMenuOpen = false;
        qaActivePack = null;
        qaJustPicked = false;
        qaConsoleOpen = false;
        battlePeekOpen = false;
        activeArcadeRecord = null;
        fishStreak = 0;
        setPhotoMode(false);
        lastInputMode = "keyboard";
        journalCancelDown = false;
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
          await saveStore.clear();
          saveDirty = false;
        },
        last: () => saveStore.last(),
        loaded: () => (qaActivePack === null && !qaBlocked ? saveStore.loaded() : null),
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
        snapPostcard,
        minigameRecords: () => minigameRecords.records(),
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
