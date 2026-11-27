import { Application, Rectangle } from "pixi.js";
import {
  arcadeView, autosaveNeeded, battleView, blankInput, createState, drainTicks, soundCues,
  stableHash, step, type ActionFrame, type JukeboxTrack, type Point, type State,
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
  createBattleCheck, createBattleHud, createCommandMenu, createFeelingBubble,
  createRewardSticker, createWindUpBubbles,
} from "./ui/battle";
import { createJournal } from "./ui/journal";
import { createTitleScreen, type TitleChoiceId } from "./ui/title";
import { createCredits } from "./ui/credits";
import {
  continueDetail, titleEffectForTransition, titleFlow, type TitleInput, type TitleMode,
} from "./shell/title-flow";
import { creditsConfirmAllowed } from "./shell/credits-flow";
import { createAreaLoader } from "./shell/area-loader";
import { formatDocumentTitle } from "./shell/document-title";
import {
  battleCheckOverlay, buildBattleHudView, buildCreditsView, buildDialogueView,
  buildHudHintsView, buildJournalView, buildRewardStickerView, createMoleHoleHandler,
  createShellAssets, FAE_ATLAS,
} from "./shell/assets";
import {
  buildSoundContext, captureAreaPostcard, collectLevelUpNotices, createAreaBannerTracker,
  createJournalNotesCache, createNpcChatterSync, hapticForTick, isOverworldConfirm,
  petEffectForCompanion, resolveArcadeOutcome, resolveSoundtrack, shouldClearRest, stepJukeboxTrack,
} from "./shell/feedback";
import { createSaveSession, createSaveStore } from "./shell/save-storage";
import { createAudio } from "./platform/audio";
import { createHaptics } from "./platform/haptics";
import { findPettableCompanion, findRestSpot } from "./render/companions";
import type { AudioLevel } from "./platform/audio-settings";
import { createGameSettings } from "./platform/game-settings";
import { createMinigameRecords } from "./platform/minigame-records";
import type { ArcadeRecordBadge } from "./ui/arcade-popups";
import { createAreaBanner } from "./ui/area-banner";
import { createHudHints } from "./ui/hud-hints";
import { createSaveToast } from "./ui/save-toast";
import { createPhotoTouchBar, createShutterFlash, type PostcardCapture } from "./ui/postcard";
import {
  canBattlePeek, canOverworldSteer, canPhotoMode, createInputShortcuts, isBannerEligible,
  isOverworldFree, type OverlayGateContext,
} from "./shell/input-shortcuts";
import { bindOverworldPointerSteer } from "./shell/overworld-pointer";
import { bindWebGlRecovery, renderBootError, shouldFreezeLiveLoop } from "./shell/lifecycle";
import type { QaSession } from "./shell/qa-session";

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
      console.log(`[cloverhollow] audio ${JSON.stringify({ state: audioState })}`);
  });
  const haptics = createHaptics();
  const qaEnabled = import.meta.env.DEV || import.meta.env.MODE === "harness";
  const qaModule = qaEnabled ? await import("./shell/qa-session") : null;
  const qaBoot = qaModule === null ? null : await qaModule.loadQaBoot(window.location.search);
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
  const handleConfirmHold = (held: boolean): void => {
    touch.setButton("confirm", held);
    if (held) touch.tapButton("confirm");
  };
  battleCheck.onConfirmHold(handleConfirmHold);
  battleCheck.onDirectionHold((dir) => {
    touch.setPointerArrow(dir.x === 0 && dir.y === 0 ? null : dir);
  });
  const echoArrows: readonly Point[] = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
  ];
  battleCheck.onEchoNote((note) => {
    const direction = echoArrows[note];
    if (direction !== undefined) touch.tapArrow(direction);
  });
  const feelingBubble = createFeelingBubble(uiRoot);
  const windUpBubbles = createWindUpBubbles(uiRoot);
  const rewardSticker = createRewardSticker(uiRoot);
  // While the harness has the game paused, redraw only after something changes;
  // while running, draw every frame as before.
  let drawPending = true;
  const invalidate = (): void => {
    drawPending = true;
  };
  const withInvalidate = <Args extends unknown[]>(
    fn: (...args: Args) => void,
  ): ((...args: Args) => void) => (...args: Args): void => {
    fn(...args);
    invalidate();
  };
  const syncReducedMotion = (): void => {
    document.documentElement.dataset.reducedMotion = gameSettings.reducedMotion() ? "on" : "off";
  };
  const gameSettings = createGameSettings(withInvalidate(syncReducedMotion));
  const minigameRecords = createMinigameRecords(invalidate);
  let activeArcadeRecord: ArcadeRecordBadge | null = null;
  let fishStreak = 0;
  syncReducedMotion();
  const hudHints = createHudHints(uiRoot);
  const saveToast = createSaveToast(uiRoot);
  const areaBanner = createAreaBanner(uiRoot);
  const shutterFlash = createShutterFlash(uiRoot);
  const bannerTracker = createAreaBannerTracker();
  // True while the harness drives ticks synthetically (the hook's `step`).
  let harnessStepping = false;
  const lightHaptic = (): void => {
    if (!harnessStepping) haptics.trigger("light");
  };
  const playToggleFeedback = (on: boolean): void => {
    sound.playEffect(on ? "toggle-on" : "toggle-off");
    lightHaptic();
  };
  const bindToggle = (toggle: () => void, isOn: () => boolean): (() => void) =>
    withInvalidate(() => {
      toggle();
      playToggleFeedback(isOn());
    });
  const journal = createJournal(uiRoot);
  let jukeboxTrack: JukeboxTrack | null = null;
  journal.onPageChange(() => {
    sound.playEffect("page-turn");
    lightHaptic();
  });
  journal.onOverlayChange((open) => {
    sound.playEffect(open ? "card-open" : "card-close");
    if (open) lightHaptic();
  });
  journal.onToggleAudio(withInvalidate(() => {
    sound.toggle();
    if (!sound.muted()) playToggleFeedback(true);
  }));
  journal.onSetAudioLevel(withInvalidate((level: AudioLevel) => sound.setLevel(level)));
  journal.onToggleMusic(bindToggle(sound.toggleMusic, () => !sound.musicMuted()));
  journal.onSetMusicLevel(withInvalidate((level: AudioLevel) => sound.setMusicLevel(level)));
  journal.onToggleAmbience(bindToggle(sound.toggleAmbience, () => !sound.ambienceMuted()));
  journal.onStepTrack((delta) => {
    if (!state.journalOpen) return;
    const nextTrack = stepJukeboxTrack(
      content.world,
      state,
      jukeboxTrack,
      delta,
      titleMode !== null || (qa?.isMenuOpen() ?? false),
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
  journal.onToggleGentleTiming(
    bindToggle(gameSettings.toggleGentleTiming, gameSettings.gentleTiming),
  );
  journal.onToggleKeyHints(bindToggle(gameSettings.toggleKeyHints, gameSettings.keyHints));
  journal.onCycleTextSpeed(
    bindToggle(gameSettings.cycleTextSpeed, () => gameSettings.textSpeed() !== "cozy"),
  );
  journal.onToggleReducedMotion(
    bindToggle(gameSettings.toggleReducedMotion, gameSettings.reducedMotion),
  );
  const title = createTitleScreen(uiRoot);
  const credits = createCredits(uiRoot);
  dialogueBox.onChoose((index) => touch.tapChoice(index));
  dialogueBox.onAdvance(() => touch.tapButton("confirm"));
  prompt.onActivate(() => touch.tapButton("confirm"));
  commandMenu.onChoose((index) => touch.tapChoice(index));
  rewardSticker.onConfirm(() => touch.tapButton("confirm"));
  battleHud.onTogether(() => touch.tapButton("cancel"));
  battleHud.onFlute(() => touch.tapButton("flute"));
  battleHud.onLasso(() => touch.tapButton("lasso"));
  journal.onClose(() => touch.tapButton("cancel"));
  credits.onClose(() => touch.tapButton("confirm"));
  const view = new GameView(content.world, { debugLabel: qaEnabled, renderer: app.renderer });
  const syncNpcChatter = createNpcChatterSync(
    content.world, uiRoot, view.npcChatterScreen.bind(view), sound.playAmbientChatter,
  );
  app.stage.addChild(view.root);
  const initialFixture = content.fixtures["new-game"];
  if (initialFixture === undefined) throw new Error("Missing new-game fixture");
  const fresh = createState(content.world, initialFixture);
  const saveStore = createSaveStore(saveKey);
  let photoMode = false;
  let qa: QaSession | null = null;
  let titleMode: TitleMode | null = null;
  const saveSession = createSaveSession({
    store: saveStore,
    world: content.world,
    fresh,
    getState: () => state,
    isDocumentHidden: () => document.hidden,
    isPaused: () => paused,
    isHarnessStepping: () => harnessStepping,
    isTitleOpen: () => titleMode !== null,
    isPhotoMode: () => photoMode,
    isQaRestricted: () => qa?.isRestricted() ?? false,
    isQaOverlayOpen: () => qa !== null && (qa.isMenuOpen() || qa.isConsoleOpen()),
    showSaveToast: () => saveToast.show(),
  });
  const qaUrlPack = qaBoot?.urlPack ?? null;
  const qaBlocked = qaBoot !== null && qaBoot.error !== null;
  const savedRaw = qaUrlPack === null && !qaBlocked ? await saveStore.load() : null;
  const restored = qaUrlPack === null
    ? savedRaw === null ? null : saveSession.parse(savedRaw)
    : saveSession.parse(qaUrlPack.save);
  state = restored ?? fresh;
  let previousState: State = state;
  // A real boot opens on the title (spec 7.3), with the game frozen behind it.
  titleMode = qaBlocked ? null : qaUrlPack === null
    ? restored === null ? "fresh" : "continue"
    : null;
  let titleSelected: TitleChoiceId = restored === null ? "new-game" : "continue";
  const applyTitle = (input: TitleInput): void => {
    if (titleMode === null || (qa?.isRestricted() ?? false)) return;
    const before = { mode: titleMode, selected: titleSelected };
    const result = titleFlow(titleMode, titleSelected, input);
    titleMode = result.mode;
    titleSelected = result.selected;
    const effect = titleEffectForTransition(before, result);
    if (effect !== null) {
      sound.playEffect(effect);
      if (effect === "title-start") lightHaptic();
    }
    if (result.action === "new-game") {
      state = createState(content.world, initialFixture);
      previousState = state;
      bannerTracker.clear();
      saveToast.hide();
      jukeboxTrack = null;
      saveSession.clear();
    }
  };
  title.onChoose((choose) => applyTitle({
    up: false, down: false, left: false, right: false, confirm: false, cancel: false, choose,
  }));
  saveStore.setLoaded(
    restored === null ? null : { tick: restored.tick, hash: stableHash(restored) },
  );
  // Buttons held when the title closed stay hidden from the game until they're
  // released, so the press that starts the game can't also act in it.
  const swallowed = new Set<"confirm" | "cancel" | "menu">();
  qa = qaModule === null || qaBoot === null
    ? null
    : qaModule.createQaSession(qaBoot, {
      uiRoot,
      world: content.world,
      initialReturnMode: restored === null ? "fresh" : "continue",
      getState: () => state,
      setState: (next) => {
        state = next;
        previousState = next;
      },
      parseSave: saveSession.parse,
      getTitleMode: () => titleMode,
      setTitleMode: (mode) => { titleMode = mode; },
      onPickPack: () => {
        saveSession.clearDirty();
        bannerTracker.clear();
        saveToast.hide();
        overworldPointer.release();
        swallowed.add("confirm");
      },
      onConsoleApplied: () => {
        bannerTracker.clear();
        invalidate();
      },
      onReleasePointer: () => overworldPointer.release(),
      invalidate,
    });
  if (qa !== null) title.onQa(qa.openMenu);
  const assets = createShellAssets({
    world: content.world,
    uiRoot,
    invalidate,
    onHole: createMoleHoleHandler(touch),
    onConfirmHold: handleConfirmHold,
    onLaneStep: (delta) => touch.tapArrow({ x: delta, y: 0 }),
  });
  const partyCommands: Record<string, string | null> = Object.fromEntries(
    Object.entries(content.world.party).map(([id, member]) => [id, member.command?.id ?? null]),
  );
  // Boot loads only permanent core sheets + tiny ~1 KB atlas JSON metadata
  // (for journal/credits frame crops) + the initial area.
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
  const devLog = qaEnabled
    ? (await import("./dev/state-log")).createDevLoggers(content.world, uiRoot, state)
    : null;
  const notesNow = createJournalNotesCache(content.world);
  let wasJournalOpen = false;
  let wasBattleOpen = false;
  document.documentElement.dataset.photo = "off";
  const overlayContext = (): OverlayGateContext => ({
    state,
    titleMode,
    qaMenuOpen: qa?.isMenuOpen() ?? false,
    qaConsoleOpen: qa?.isConsoleOpen() ?? false,
    qaBlocked: qa?.isBlocked() ?? false,
    photoMode,
  });
  const setPhotoMode = (on: boolean, silent = false): void => {
    const next = on && canPhotoMode(overlayContext());
    const changed = next !== photoMode;
    photoMode = next;
    document.documentElement.dataset.photo = next ? "on" : "off";
    view.setPhotoMode(next);
    if (next) {
      overworldPointer.release();
      saveToast.hide();
    } else {
      shutterFlash.hide();
    }
    if (changed && !silent && titleMode === null && state.battle === null) {
      sound.playEffect(next ? "toggle-on" : "toggle-off");
      if (next) lightHaptic();
    }
    invalidate();
  };
  let battlePeekOpen = false;
  const setBattlePeek = (on: boolean): void => {
    const next = on && canBattlePeek(overlayContext());
    if (next === battlePeekOpen) return;
    battlePeekOpen = next;
    if (state.battle !== null) {
      sound.playEffect(next ? "card-open" : "card-close");
      if (next) lightHaptic();
    }
    invalidate();
  };
  battleHud.onPeekToggle(() => setBattlePeek(!battlePeekOpen));
  battleHud.onPeekClose(() => setBattlePeek(false));
  hudHints.onAction((action) => {
    if (action === "interact") touch.tapButton("confirm");
    else if (action === "journal") touch.tapButton("menu");
    else if (action === "lantern") touch.tapButton("lantern");
    else if (action === "flute") touch.tapButton("flute");
    else if (action === "photo" && canPhotoMode(overlayContext())) setPhotoMode(true);
    else if (action === "mute") { sound.toggle(); invalidate(); }
    else if (action === "battle-guide" && canBattlePeek(overlayContext())) {
      setBattlePeek(!battlePeekOpen);
    }
  });
  const overworldPointer = bindOverworldPointerSteer({
    canvas: app.canvas,
    canSteer: () => canOverworldSteer(overlayContext()),
    playerScreen: () => view.playerScreenPoint(state),
    onMove: (dir) => touch.setPointerArrow(dir.x === 0 && dir.y === 0 ? null : dir),
    onTapNearPlayer: () => {
      if (
        view.isResting() ||
        findRestSpot(content.world, state) !== null ||
        findPettableCompanion(content.world, state) !== null
      ) {
        touch.tapButton("confirm");
      }
    },
  });
  const input = createInputSource(() => {
    overworldPointer.sync();
    return combineInputFrames(keyboard.frame(), touch.sample(), gamepad.frame());
  });
  const inputShortcuts = createInputShortcuts({
    getContext: overlayContext,
    getBattlePeekOpen: () => battlePeekOpen,
    setBattlePeek,
    setPhotoMode,
    snapPostcard: () => { void snapPostcard({ download: true }); },
    journal,
    gamepad,
    clearKeyboardTaps: () => keyboard.clearTaps(),
    swallow: (button) => swallowed.add(button),
    playChoiceMove: () => { sound.play("choice-move", state.tick); },
    invalidate,
    ...(qa !== null ? { qa: qa.shortcuts() } : {}),
  });
  const areaLoader = createAreaLoader({
    getArea: (areaId) => content.world.areas[areaId],
    getState: () => state,
    loadedAreaId: () => view.loadedAreaId(),
    setArea: (area) => view.setArea(area),
    prefetchArea: (area) => view.prefetch(area),
    warmAreaOverlays: assets.warmAreaOverlays,
    cacheAreaNpcPortraits: assets.cacheAreaNpcPortraits,
    warmAreaMedia: assets.warmAreaMedia,
    warmBattlePortraits: assets.warmBattlePortraits,
    onLoaded: (loadedState) => {
      view.resetCamera();
      previousState = loadedState;
    },
    invalidate,
  });
  const syncOpenFlag = (
    name: "arcade" | "qaConsole" | "title" | "credits" | "battle" | "talk" | "journal",
    open: boolean,
  ): void => {
    if (open) document.documentElement.dataset[name] = "open";
    else delete document.documentElement.dataset[name];
  };
  let lastDocumentTitle = document.title;
  const render = (alpha = 1): void => {
    const gate = overlayContext();
    const qaMenuOpen = gate.qaMenuOpen;
    if (!canOverworldSteer(gate)) overworldPointer.release();
    if (photoMode && !canPhotoMode(gate)) {
      photoMode = false;
      document.documentElement.dataset.photo = "off";
      view.setPhotoMode(false);
      shutterFlash.hide();
    }
    if (battlePeekOpen && !canBattlePeek(gate)) battlePeekOpen = false;
    if (!state.journalOpen || titleMode !== null || qaMenuOpen) jukeboxTrack = null;
    const { soundtrack, jukebox } = resolveSoundtrack(
      content.world,
      state,
      jukeboxTrack,
      titleMode !== null || qaMenuOpen,
    );
    sound.setSoundtrack(soundtrack);
    devLog?.logMusic(soundtrack);
    const arcadeState = arcadeView(content.world, state, gameSettings.gentleTiming());
    assets.renderOverlays(arcadeState, activeArcadeRecord, inputShortcuts.inputMode());
    assets.warmJournalOnRender(state, wasJournalOpen, () => state.journalOpen);
    wasJournalOpen = state.journalOpen;
    syncOpenFlag("arcade", arcadeState !== null);
    if (state.arcade !== null) document.documentElement.dataset.arcadeGame = state.arcade.game;
    else delete document.documentElement.dataset.arcadeGame;
    view.render(state, window.innerWidth, window.innerHeight, app.renderer.resolution, {
      paused, alpha: paused ? 1 : alpha, previousState,
    });
    prompt.render(
      state.battle === null && state.arcade === null && state.finale !== "credits" &&
        titleMode === null
        ? view.promptView(state)
        : { visible: false, label: "", x: 0, y: 0 },
    );
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
    if (fluteButton !== null) fluteButton.hidden = !hasFlute;
    const touchActive = document.documentElement.dataset.touch === "on";
    const hasLevelUpNotice = levelUpNotices.length > 0;
    const overworldFree = isOverworldFree(gate, hasLevelUpNotice);
    syncNpcChatter(state, overworldFree, photoMode, paused);
    hudHints.render(buildHudHintsView({
      world: content.world, state, keyHints: gameSettings.keyHints(), touchActive, overworldFree,
      isResting: view.isResting(), hasLantern, hasFlute, muted: sound.muted(),
      canPhoto: canPhotoMode(gate) && !photoMode, canBattlePeek: canBattlePeek(gate),
      inputMode: inputShortcuts.inputMode(),
    }));
    areaBanner.render(
      bannerTracker.view(
        content.world,
        state,
        isBannerEligible(gate, hasLevelUpNotice),
        qa?.isActive() ?? false,
      ),
    );
    title.render({
      visible: titleMode !== null && !qaMenuOpen,
      mode: titleMode ?? "fresh",
      selected: titleSelected,
      continueDetail: continueDetail(content.world, state),
    });
    qa?.render();
    syncOpenFlag("qaConsole", gate.qaConsoleOpen);
    const creditsOpen = state.finale === "credits";
    const nextTitle = formatDocumentTitle(content.world, state, {
      titleOpen: titleMode !== null,
      creditsOpen,
    });
    if (nextTitle !== lastDocumentTitle) {
      lastDocumentTitle = nextTitle;
      document.title = nextTitle;
    }
    if (photoMode || titleMode !== null || activeBattle || state.journalOpen || creditsOpen) {
      saveToast.hide();
    }
    credits.render(buildCreditsView(content.world, state, assets));
    devLog?.logTitle(titleMode);
    syncOpenFlag("title", titleMode !== null);
    syncOpenFlag("credits", creditsOpen);
    syncOpenFlag("battle", activeBattle);
    syncOpenFlag("talk", battle?.talk !== null && battle?.talk !== undefined);
    const checkKind = state.battle?.phase === "check" ? state.battle.check?.kind : undefined;
    if (checkKind !== undefined) document.documentElement.dataset.check = checkKind;
    else delete document.documentElement.dataset.check;
    if (
      checkKind !== "catch" &&
      checkKind !== "lean" &&
      checkKind !== "echo" &&
      state.arcade?.game !== "mole" &&
      state.arcade?.game !== "comet" &&
      !overworldPointer.isActive()
    ) {
      touch.releaseArrows();
    }
    if (activeBattle && !wasBattleOpen) void assets.warmBattlePortraits(state).then(invalidate);
    wasBattleOpen = activeBattle;
    battleHud.render(
      buildBattleHudView({
        world: content.world,
        state,
        battle,
        partyCommands,
        paused,
        canPeek: canBattlePeek(gate),
        peekOpen: battlePeekOpen,
        speakerPortrait: assets.speakerPortrait,
        inputMode: inputShortcuts.inputMode(),
      }),
    );
    commandMenu.render({
      visible: activeBattle && state.battle?.phase === "command" && battle?.talk === null,
      commands: battle?.commands ?? [],
      selected: battle?.selected ?? 0,
      treatTray: battle?.treatTray ?? null,
    });
    const feelingAt = view.battleFeelingAnchor(state, window.innerWidth, window.innerHeight);
    feelingBubble.render(
      battlePeekOpen || battle === null || battle.feelings === null || feelingAt === null
        ? null
        : { ...battle.feelings, ...feelingAt },
    );
    windUpBubbles.render(
      battlePeekOpen || battle === null || battle.windUp === null || feelingAt === null
        ? null
        : { ...battle.windUp, ...feelingAt },
    );
    devLog?.logBattleButtons(activeBattle, state);
    const geometry = view.battleCheckGeometry(state, window.innerWidth, window.innerHeight);
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
        inputMode: inputShortcuts.inputMode(),
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
  let cancelDown = false;
  const tick = (frame: ActionFrame): void => {
    if (qa?.stepQaMenu(frame, titlePrevious) === true) {
      titlePrevious = frame;
      cancelDown = frame.cancel;
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
      cancelDown = frame.cancel;
      if (titleMode === null) {
        for (const button of ["confirm", "cancel", "menu"] as const)
          if (frame[button]) swallowed.add(button);
      }
      return;
    }
    for (const button of swallowed)
      if (!frame[button]) swallowed.delete(button);
    const cancelEdge = frame.cancel && !cancelDown;
    cancelDown = frame.cancel;
    if (cancelEdge && inputShortcuts.handleCancelEdge(swallowed.has("cancel")) === "consume-tick") {
      return;
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
      if (creditsConfirmAllowed(creditsTicks, confirmEdge)) {
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
    const previous = state;
    const stepped = step(content.world, state, input, {
      gentleTiming: gameSettings.gentleTiming(), textSpeed: gameSettings.textSpeed(),
    });
    state = stepped.state;
    view.observeNpcTick(state);
    if (!paused && !harnessStepping && state.tick !== previous.tick) saveSession.markDirty();
    previousState = state.area === previous.area ? previous : state;
    const arcadeOutcome = resolveArcadeOutcome(
      content.world, previous, state, gameSettings.gentleTiming(),
      minigameRecords, fishStreak, activeArcadeRecord,
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
            lightHaptic();
          }
        }
      }
    }
    bannerTracker.update(content.world, previous, state);
    areaLoader.syncTransition(state.transition, harnessStepping);
    if (state.finale !== lastFinale) {
      if (qaEnabled) console.log(`[cloverhollow] finale ${state.finale ?? "null"}`);
      lastFinale = state.finale;
      if (state.finale === "credits") creditsTicks = 0;
    }
    levelUpNotices.push(...collectLevelUpNotices(content.world, stepped.events));
    for (const event of stepped.events) {
      if (event.type === "ending-save") {
        endingSnapshot = event.state;
        if (!(qa?.isRestricted() ?? false)) void saveSession.saveState(event.state);
      }
    }
    const soundContext = buildSoundContext(state);
    const cues = soundCues(previous, state, content.world);
    for (const cue of cues) {
      const played = sound.play(cue, state.tick, soundContext);
      if (qaEnabled) console.log(`[cloverhollow] sound ${JSON.stringify(played)}`);
    }
    if (!harnessStepping) {
      const haptic = hapticForTick(previous, state, cues, {
        goldenCooked: arcadeOutcome.goldenCooked,
      });
      if (haptic !== null) haptics.trigger(haptic);
    }
    if (!(qa?.isRestricted() ?? false) && autosaveNeeded(previous, state)) {
      void saveSession.save();
    }
    devLog?.logBattle(state);
    devLog?.afterTick(state);
  };
  const snapPostcard = async (
    options?: { download?: boolean },
  ): Promise<PostcardCapture | null> => {
    if (!photoMode || !canPhotoMode(overlayContext())) return null;
    sound.playEffect("camera-shutter");
    shutterFlash.trigger();
    lightHaptic();
    render(1);
    app.render();
    const extracted = app.renderer.extract.canvas({
      target: app.stage,
      frame: new Rectangle(0, 0, app.screen.width, app.screen.height),
      resolution: app.renderer.resolution,
      clearColor: 0xf8edcf,
    });
    const sourceCanvas = extracted instanceof HTMLCanvasElement ? extracted : app.canvas;
    const partyNames = state.party
      .map((member) => content.world.party[member.id]?.name ?? "")
      .filter((name) => name.length > 0);
    return captureAreaPostcard(
      content.world,
      state.area,
      sourceCanvas,
      options?.download !== false,
      partyNames,
    );
  };
  createPhotoTouchBar(uiRoot, {
    onSnap: () => { void snapPostcard({ download: true }); },
    onClose: () => setPhotoMode(false),
  });
  for (const type of ["resize", "pointerdown", "pointerup"])
    window.addEventListener(type, invalidate);
  let last = performance.now();
  let accumulator = 0;
  let contextLost = false;
  app.ticker.add(() => {
    inputShortcuts.pollGamepad();
    const now = performance.now();
    accumulator += Math.min(now - last, 250);
    last = now;
    const frozen = shouldFreezeLiveLoop({
      documentHidden: document.hidden, paused, areaLoading: areaLoader.isLoading(), contextLost,
    });
    if (frozen) {
      accumulator = 0;
    } else if (!paused) {
      const drained = drainTicks(accumulator, 1000 / 60, 5);
      accumulator = drained.remainingMs;
      for (let index = 0; index < drained.ticks; index += 1) {
        tick(input.next());
        if (view.loadedAreaId() !== state.area) {
          accumulator = 0;
          void areaLoader.ensureArea();
          break;
        }
      }
    }
    const stillLoading = areaLoader.isLoading();
    if (!contextLost && ((!paused && !document.hidden) || stillLoading || drawPending)) {
      drawPending = false;
      const alpha = paused || stillLoading
        ? 1
        : Math.min(1, Math.max(0, accumulator / (1000 / 60)));
      render(alpha);
      app.render();
    }
  });
  const suspendLiveInput = (): void => {
    keyboard.clearAll(); gamepad.clearTaps(); overworldPointer.release();
    touch.releaseArrows(); accumulator = 0; saveSession.flushOnHide();
  };
  bindWebGlRecovery(app.canvas, {
    onLost: () => { contextLost = true; suspendLiveInput(); },
    onRestored: () => {
      contextLost = false; last = performance.now();
      view.invalidateBackdrop(); void areaLoader.ensureArea(true); invalidate();
    },
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspendLiveInput();
    else { last = performance.now(); accumulator = 0; invalidate(); }
  });
  window.addEventListener("pagehide", saveSession.flushOnHide);
  render();
  inputShortcuts.bind();
  if (qaEnabled) {
    const resetTransientUi = (): void => {
      titleMode = null;
      jukeboxTrack = null;
      battlePeekOpen = false;
      activeArcadeRecord = null;
      fishStreak = 0;
      setPhotoMode(false, true);
      levelUpNotices.length = 0;
      swallowed.clear();
    };
    const { installShellHook } = await import("./dev/hook");
    installShellHook({
      world: content.world,
      fixtures: content.fixtures,
      fresh,
      speciesXp: saveSession.speciesXp,
      input,
      get: () => state,
      tick,
      ensureArea: areaLoader.ensureArea,
      render: () => render(),
      invalidate,
      paused: () => paused,
      setPaused: (value) => { paused = value; },
      setStepping: (value) => { harnessStepping = value; },
      applyResetState: async (next) => {
        keyboard.clearTaps();
        gamepad.clearTaps();
        overworldPointer.release();
        saveSession.setSuppressed(true);
        saveSession.clearDirty();
        state = next;
        previousState = state;
        bannerTracker.clear();
        saveToast.hide();
        saveSession.setSuppressed(false);
        areaLoader.reset();
        await Promise.all([areaLoader.ensureArea(), assets.warmJournalAssets(state)]);
        resetTransientUi();
        qa?.reset();
        sound.clearEffects();
        inputShortcuts.resetInputMode();
        cancelDown = false;
      },
      renderInfo: () => ({ ...view.renderInfo(state), arcade: assets.overlayInfo() }),
      qa: { active: () => qa?.isActive() ?? false, packs: () => qa?.packs() ?? [] },
      isQaRestricted: () => qa?.isRestricted() ?? false,
      saveStore,
      clearSaveDirty: saveSession.clearDirty,
      applyImportedSave: async (imported) => {
        state = imported;
        previousState = state;
        saveSession.clearDirty();
        bannerTracker.clear();
        saveToast.hide();
        areaLoader.reset();
        resetTransientUi();
        await Promise.all([areaLoader.ensureArea(true), assets.warmJournalAssets(state)]);
        render();
        invalidate();
      },
      sound,
      gameSettings,
      photoMode: () => photoMode,
      setPhotoMode: (on) => setPhotoMode(on),
      snapPostcard,
      minigameRecords: () => minigameRecords.records(),
      boot: { title: () => titleMode },
    });
  }
}

boot().catch((error: unknown) => {
  // Capacitor forwards console.error to the native log, so iOS failures are visible.
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  console.error(`[cloverhollow] boot failed: ${detail}`);
  renderBootError(document.querySelector<HTMLElement>("#app"), error);
});
