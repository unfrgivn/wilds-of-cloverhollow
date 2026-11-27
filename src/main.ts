import { Application, Assets, type Spritesheet } from "pixi.js";
import {
  blankInput,
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type ArcadeView,
  type Area,
  type BattleView,
  type CookView,
  type FishView,
  type MoleHole,
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
  carriedTreats,
  critterFieldNote,
  landStickerProgress,
  mapBusRoutes,
  mapLandName,
  starGemsFound,
  targetInteractable,
  creditEntries,
  levelForXp,
  levelUpLine,
  statsForCommand,
} from "./core";
import {
  loadContent,
  parseClawCalibration,
  parseMapCentres,
  parseMoleCalibration,
  parseCookCalibration,
  parseFishCalibration,
  parseSkeeCalibration,
  parseCometCalibration,
} from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { combineInputFrames, GamepadInput } from "./platform/gamepad";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView, type BattleCheckGeometry } from "./render/view";
import { atlasImage, parseAtlasJson, type AtlasImage, type AtlasJson } from "./ui/atlas";
import { preventPinchZoom } from "./platform/gestures";
import { createDialogueBox, createNoticeMarks, createPrompt } from "./ui/sticker";
import { cropPortraitFrame, speakerAccent, speakerPortraitSource } from "./ui/portraits";
import { evaluateBattlePortraits } from "./ui/battle-portraits";
import {
  createBattleHud,
  createCommandMenu,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  createRewardSticker,
  battleCommandPreview,
  battleTalkDialogueView,
  talkChoicesShown,
  type BattleCheckView as BattleCheckOverlayView,
} from "./ui/battle";
import { assetUrl } from "./platform/assets";
import { createJournal } from "./ui/journal";
import type { ArcadeInfo } from "./ui/arcade";
import { createClaw } from "./ui/claw";
import { createSkee } from "./ui/skee";
import { createMole } from "./ui/mole";
import { createComet } from "./ui/comet";
import { createCook, type CookInfo } from "./ui/cook";
import { createFish, type FishInfo } from "./ui/fish";
import {
  journalNotes,
  parseSave,
  serializeSave,
  autosaveNeeded,
  stableHash,
} from "./core";
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
import { createAudio, type CompanionAudioEffect } from "./platform/audio";
import { findPettableCompanion, findRestSpot } from "./render/companions";
import type { AudioLevel } from "./platform/audio-settings";
import { createGameSettings } from "./platform/game-settings";
import { areaBannerInfo, createAreaBanner } from "./ui/area-banner";
import { createHudHints } from "./ui/hud-hints";
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
  const gameSettings = createGameSettings(invalidate);
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
  const saved = qaUrlPack === null && qaError === null
    ? await Preferences.get({ key: saveKey }) : { value: null };
  const restored = qaUrlPack === null
    ? saved.value === null ? null : parseSave(saved.value, fresh,
      Object.fromEntries(Object.values(content.world.critters).map((kind) => [kind.species,
        content.world.levels.critters[kind.id]?.xp ?? 0])), content.world.levels.thresholds)
    : parseSave(qaUrlPack.save, fresh, Object.fromEntries(Object.values(content.world.critters).map(
      (kind) => [kind.species, content.world.levels.critters[kind.id]?.xp ?? 0])),
    content.world.levels.thresholds);
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
    const loaded = parseSave(item.save, fresh,
      Object.fromEntries(Object.values(content.world.critters).map((kind) => [kind.species,
        content.world.levels.critters[kind.id]?.xp ?? 0])), content.world.levels.thresholds);
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
  // Each land's centre on the painted map (the journal's MAP page).
  const loadMapCentres = async () => {
    const mapFile = "assets/ui/map/world-map.json";
    const response = await fetch(assetUrl(mapFile));
    if (!response.ok) throw new Error(`Failed to load ${mapFile}`);
    return parseMapCentres(await response.json(), mapFile);
  };
  // DOM image decode cache: each PNG is decoded at most once, only when its
  // area or overlay needs it, so boot doesn't decode all 25 critter PNGs.
  const decodedImages = new Map<string, Promise<void>>();
  const decodeOnce = (file: string): Promise<void> => {
    const existing = decodedImages.get(file);
    if (existing !== undefined) return existing;
    const promise = (async () => {
      const image = new Image();
      image.src = assetUrl(file);
      await image.decode();
    })();
    decodedImages.set(file, promise);
    return promise;
  };
  // Tiny atlas JSON metadata cache (~1 KB per sheet, zero GPU VRAM): lets
  // stickerArt, prizeArt, and credits crop any frame in any area regardless of
  // whether that critter's WebGL texture is currently loaded.
  const atlasJsonCache = new Map<string, AtlasJson>();
  const atlasJsonPending = new Map<string, Promise<AtlasJson>>();
  const loadAtlasJson = (file: string): Promise<AtlasJson> => {
    const cached = atlasJsonCache.get(file);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = atlasJsonPending.get(file);
    if (pending !== undefined) return pending;
    const promise = (async () => {
      const response = await fetch(assetUrl(file));
      if (!response.ok) throw new Error(`Failed to load ${file}`);
      const parsed = parseAtlasJson(await response.json(), file);
      atlasJsonCache.set(file, parsed);
      return parsed;
    })();
    atlasJsonPending.set(file, promise);
    return promise;
  };
  // A DOM-only atlas (no WebGL texture): its frame metadata + decoded PNG.
  const domAtlas = async (file: string): Promise<AtlasJson> => {
    const data = await loadAtlasJson(file);
    await decodeOnce(file.replace(".json", ".png"));
    return data;
  };
  // The moles' frames and Mom's dishes for the clubhouse microwave (spec 8.2).
  const moleAtlas = "assets/arcade/moles.json";
  const foodAtlas = "assets/arcade/cook-food.json";
  const fishAtlas = "assets/arcade/fish-catches.json";
  const cometAtlas = "assets/arcade/comet.json";
  // The arcade games' paintings and their calibrations (spec 8.2), each
  // decoded on demand before its close-up can open.
  const painting = async <T extends { image: string }>(
    file: string,
    parse: (value: unknown, file: string) => T,
  ): Promise<{ calibration: T; image: string }> => {
    const response = await fetch(assetUrl(file));
    if (!response.ok) throw new Error(`Failed to load ${file}`);
    const calibration = parse(await response.json(), file);
    const src = assetUrl(`assets/arcade/${calibration.image}`);
    await decodeOnce(`assets/arcade/${calibration.image}`);
    return { calibration, image: src };
  };
  const atlasFrame = (file: string, frameName: string): AtlasImage | null => {
    const data = atlasJsonCache.get(file) ?? Assets.get<Spritesheet | undefined>(file)?.data;
    return data === undefined ? null : atlasImage(data, assetUrl(file.replace(".json", ".png")),
      frameName);
  };
  const stickerArt = (critterId: string, frameName: string): AtlasImage | null => {
    const critter = content.world.critters[critterId];
    return critter === undefined ? null : atlasFrame(critter.atlas, frameName);
  };
  const speakerPortrait = (speaker: string | null): AtlasImage | null => {
    const source = speakerPortraitSource(content.world, speaker);
    if (source === null) return null;
    const data =
      atlasJsonCache.get(source.atlas) ?? Assets.get<Spritesheet | undefined>(source.atlas)?.data;
    if (data === undefined) {
      void loadAtlasJson(source.atlas)
        .then(() => decodeOnce(source.atlas.replace(".json", ".png")))
        .then(invalidate)
        .catch(() => undefined);
      return null;
    }
    if (data.frames[source.frame] === undefined) return null;
    const image = atlasImage(data, assetUrl(source.atlas.replace(".json", ".png")), source.frame);
    return { ...image, frame: cropPortraitFrame(image.frame, source.cropMode) };
  };
  // A prize's art: its frame in the prize atlas (spec 8.2).
  const prizeArt = (frameName: string): AtlasImage | null =>
    atlasFrame(content.world.arcade.atlas, frameName);
  // Each hole of Boop-a-Mole is a touch target (spec 8.2): the outer four
  // hold their arrow, and the middle the confirm button, while pressed; a tap
  // counts however quickly it lifts.
  const holeArrows: Record<Exclude<MoleHole, "middle">, Point> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  };
  const onHole = (hole: MoleHole, down: boolean): void => {
    if (hole === "middle") {
      touch.setButton("confirm", down);
      if (down) touch.tapButton("confirm");
    } else if (down) {
      touch.holdArrow(holeArrows[hole]);
      touch.tapArrow(holeArrows[hole]);
    } else touch.releaseArrow(holeArrows[hole]);
  };
  // Arcade and clubhouse microwave close-ups load on demand when entering
  // `arcade` or `clubhouse` (or on first open), keeping boot light on iOS.
  type ArcadeOverlay = {
    render: (view: ArcadeView | null) => void;
    info: () => ArcadeInfo | null;
  };
  type CookOverlay = {
    render: (view: CookView | null) => void;
    info: () => CookInfo | null;
  };
  type FishOverlay = {
    render: (view: FishView | null) => void;
    info: () => FishInfo | null;
  };
  let arcadeOverlay: ArcadeOverlay | null = null;
  let arcadeLoad: Promise<void> | undefined;
  const ensureArcadeOverlay = (): Promise<void> => {
    if (arcadeOverlay !== null) return Promise.resolve();
    if (arcadeLoad !== undefined) return arcadeLoad;
    arcadeLoad = Promise.all([
      domAtlas(content.world.arcade.atlas),
      domAtlas(moleAtlas),
      domAtlas(cometAtlas),
      painting("assets/arcade/claw-machine.json", parseClawCalibration),
      painting("assets/arcade/skee-lane.json", parseSkeeCalibration),
      painting("assets/arcade/mole-cabinet.json", parseMoleCalibration),
      painting("assets/arcade/comet-cabinet.json", parseCometCalibration),
    ]).then(([
      , , , clawPainting, skeePainting, molePainting, cometPainting,
    ]) => {
      const clawUp = createClaw(uiRoot, prizeArt, clawPainting.calibration, clawPainting.image);
      const skeeUp = createSkee(uiRoot, skeePainting.calibration, skeePainting.image);
      const moleUp = createMole(
        uiRoot,
        (frameName) => atlasFrame(moleAtlas, frameName),
        molePainting.calibration,
        molePainting.image,
        onHole,
      );
      const cometUp = createComet(
        uiRoot,
        (frameName) => atlasFrame(cometAtlas, frameName),
        cometPainting.calibration,
        cometPainting.image,
      );
      arcadeOverlay = {
        render: (view) => {
          clawUp.render(view?.game === "claw" ? view : null);
          skeeUp.render(view?.game === "skee" ? view : null);
          moleUp.render(view?.game === "mole" ? view : null);
          cometUp.render(view?.game === "comet" ? view : null);
        },
        info: () => clawUp.info() ?? skeeUp.info() ?? moleUp.info() ?? cometUp.info(),
      };
    });
    return arcadeLoad;
  };
  let cookOverlay: CookOverlay | null = null;
  let cookLoad: Promise<void> | undefined;
  const ensureCookOverlay = (): Promise<void> => {
    if (cookOverlay !== null) return Promise.resolve();
    if (cookLoad !== undefined) return cookLoad;
    cookLoad = Promise.all([
      domAtlas(foodAtlas),
      painting("assets/arcade/microwave.json", parseCookCalibration),
    ]).then(([, cookPainting]) => {
      cookOverlay = createCook(
        uiRoot,
        (frameName) => atlasFrame(foodAtlas, frameName),
        cookPainting.calibration,
        cookPainting.image,
      );
    });
    return cookLoad;
  };
  let fishOverlay: FishOverlay | null = null;
  let fishLoad: Promise<void> | undefined;
  const ensureFishOverlay = (): Promise<void> => {
    if (fishOverlay !== null) return Promise.resolve();
    if (fishLoad !== undefined) return fishLoad;
    fishLoad = Promise.all([
      domAtlas(fishAtlas),
      painting("assets/arcade/fishing-dock.json", parseFishCalibration),
    ]).then(([, fishPainting]) => {
      fishOverlay = createFish(
        uiRoot,
        (frameName) => atlasFrame(fishAtlas, frameName),
        fishPainting.calibration,
        fishPainting.image,
      );
    });
    return fishLoad;
  };
  // Warms only the DOM media needed for `area`: arcade/cooking close-ups for
  // those rooms, plus this area's critter PNGs so battle reward stickers never
  // flicker in WebKit. Bedroom has 0 critters, so boot decodes 0 critter PNGs.
  const cacheAreaNpcPortraits = (area: Area): void => {
    for (const npc of area.npcs) {
      const character = content.world.characters[npc.id];
      if (character === undefined || atlasJsonCache.has(character.atlas)) continue;
      const sheet = Assets.get<Spritesheet | undefined>(`${npc.id}-sheet`);
      if (sheet !== undefined) atlasJsonCache.set(character.atlas, sheet.data);
    }
  };
  const warmAreaMedia = async (area: Area): Promise<void> => {
    const loads: Promise<unknown>[] = [];
    if (area.id === "arcade") loads.push(ensureArcadeOverlay());
    if (area.id === "clubhouse") loads.push(ensureCookOverlay());
    if (area.id === "bay") loads.push(ensureFishOverlay());
    const areaCritters = new Set([
      ...area.critters.map((piece) => piece.id),
      ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
    ]);
    for (const id of areaCritters) {
      const critter = content.world.critters[id];
      if (critter !== undefined) loads.push(decodeOnce(critter.atlas.replace(".json", ".png")));
    }
    for (const npc of area.npcs) {
      const character = content.world.characters[npc.id];
      if (character !== undefined) {
        loads.push(decodeOnce(character.atlas.replace(".json", ".png")));
      }
    }
    await Promise.all(loads);
  };
  const warmOwnedJournalMedia = async (snapshot: State): Promise<void> => {
    const loads: Promise<unknown>[] = [];
    for (const id of snapshot.stickers) {
      const sticker = content.world.stickers.catalogue.find((item) => item.id === id);
      const critter = sticker === undefined ? undefined : content.world.critters[sticker.critter];
      if (critter !== undefined) loads.push(decodeOnce(critter.atlas.replace(".json", ".png")));
    }
    if (snapshot.prizes.length > 0)
      loads.push(decodeOnce(content.world.arcade.atlas.replace(".json", ".png")));
    await Promise.all(loads);
  };
  const partyCommands: Record<string, string | null> = Object.fromEntries(
    Object.entries(content.world.party).map(([id, member]) => [id, member.command?.id ?? null]),
  );
  const warmBattlePortraits = async (snapshot: State): Promise<void> => {
    const loads: Promise<unknown>[] = [decodeOnce("assets/characters/fae/fae.png")];
    for (const member of battleParty(content.world, snapshot.party)) {
      const info = content.world.party[member.id];
      if (info !== undefined) loads.push(decodeOnce(info.atlas.replace(".json", ".png")));
    }
    await Promise.all(loads);
  };
  const critterJsonFiles = [
    ...new Set(Object.values(content.world.critters).map((critter) => critter.atlas)),
  ];
  // Boot loads only permanent core sheets + tiny ~1 KB atlas JSON metadata
  // (for journal/credits frame crops) + the initial area. No unused critter
  // PNGs or arcade paintings are decoded up front.
  const [mapCentres] = await Promise.all([
    loadMapCentres(),
    loadAtlasJson(content.world.arcade.atlas),
    ...critterJsonFiles.map((file) => loadAtlasJson(file)),
    view.ready.then(async () => {
      const faeSheet = Assets.get<Spritesheet | undefined>("fae-sheet");
      if (faeSheet !== undefined) {
        atlasJsonCache.set("assets/characters/fae/fae.json", faeSheet.data);
      }
      for (const [id, member] of Object.entries(content.world.party)) {
        const sheet = Assets.get<Spritesheet | undefined>(`${id}-sheet`);
        if (sheet !== undefined) atlasJsonCache.set(member.atlas, sheet.data);
      }
      const initialArea = content.world.areas[state.area];
      if (initialArea === undefined) throw new Error("Missing initial area");
      await Promise.all([
        view.setArea(initialArea).then(() => cacheAreaNpcPortraits(initialArea)),
        warmAreaMedia(initialArea),
        warmOwnedJournalMedia(state),
        decodeOnce("assets/characters/fae/fae.png"),
        decodeOnce(content.world.battle.toyAtlas.replace(".json", ".png")),
      ]);
    }),
  ]);
  // A toy a catch throws: a crop of the toy atlas (spec 8.1).
  const toyArt = (frameName: string): AtlasImage | null => {
    const atlas = content.world.battle.toyAtlas;
    const sheet = Assets.get<Spritesheet | undefined>(atlas);
    const rect = sheet?.data.frames[frameName]?.frame;
    const size = sheet?.data.meta.size;
    if (rect === undefined || size === undefined) return null;
    return {
      src: assetUrl(atlas.replace(".json", ".png")),
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      atlas: { w: size.w, h: size.h },
    };
  };
  // The check overlay's view: the core's check with its place on screen.
  const checkOverlay = (
    battle: BattleView | null,
    geometry: BattleCheckGeometry | null,
  ): BattleCheckOverlayView | null => {
    const check = battle?.check ?? null;
    if (battle === null || check === null || geometry === null) return null;
    const shared = { grade: battle.lastGrade, hint: battle.hint };
    if (check.kind === "ring" && geometry.kind === "ring")
      return { ...geometry, ...shared, progress: check.progress, target: check.target };
    if (check.kind === "charge" && geometry.kind === "charge")
      return { ...geometry, ...shared, fill: check.fill, great: check.great, good: check.good };
    if (check.kind === "chain" && geometry.kind === "chain")
      return { ...geometry, ...shared, beats: check.beats, look: check.look };
    if (check.kind === "catch" && geometry.kind === "catch")
      return {
        ...geometry,
        ...shared,
        catcher: check.catcher,
        toys: check.toys.map((toy) => {
          const image = toyArt(toy.frame);
          return {
            ...toy,
            image,
            width: (image?.frame.w ?? 0) * geometry.toyScale,
            height: (image?.frame.h ?? 0) * geometry.toyScale,
          };
        }),
      };
    if (check.kind === "lean" && geometry.kind === "lean")
      return { ...geometry, ...shared, balance: check.balance, puffs: check.puffs };
    if (check.kind === "trace" && geometry.kind === "trace")
      return { ...geometry, ...shared, brush: check.brush, points: check.path.points,
        checkpoint: check.checkpoint, results: check.results, dry: check.dry };
    if (check.kind === "peekaboo" && geometry.kind === "peekaboo")
      return {
        ...geometry,
        ...shared,
        progress: check.progress,
        status: check.status,
        peeks: check.peeks,
      };
    if (check.kind === "echo" && geometry.kind === "echo")
      return {
        ...geometry,
        ...shared,
        phase: check.phase,
        sequence: check.sequence,
        results: check.results,
        litNote: check.litNote,
        demoIndex: check.demoIndex,
        entered: check.entered,
        time: check.time,
      };
    return null;
  };
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
    if (arcadeState !== null && arcadeState.game !== "cook" && arcadeState.game !== "fish" &&
        arcadeOverlay === null)
      void ensureArcadeOverlay().then(invalidate);
    if (arcadeState?.game === "cook" && cookOverlay === null)
      void ensureCookOverlay().then(invalidate);
    if (arcadeState?.game === "fish" && fishOverlay === null)
      void ensureFishOverlay().then(invalidate);
    arcadeOverlay?.render(
      arcadeState !== null && arcadeState.game !== "cook" && arcadeState.game !== "fish"
        ? arcadeState : null,
    );
    cookOverlay?.render(arcadeState?.game === "cook" ? arcadeState : null);
    fishOverlay?.render(arcadeState?.game === "fish" ? arcadeState : null);
    if (state.journalOpen && !wasJournalOpen) void warmOwnedJournalMedia(state);
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
      state.battle === null && state.arcade === null
        ? view.promptView(state)
        : { visible: false, label: "", x: 0, y: 0 },
    );
    // The recurring critters' "?" and "!" (Milestone 51).
    noticeMarks.render(view.noticeMarks(state));
    const battle = battleView(content.world, state);
    const activeBattle = battle !== null;
    const hasLantern = content.world.storyVariable(state.ink, "has_lantern") === true;
    const hasFlute = content.world.storyVariable(state.ink, "has_flute") === true;
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
    hudHints.render({
      visible: gameSettings.keyHints() && !touchActive && overworldFree,
      canInteract: interactTarget !== undefined,
      interactLabel: interactTarget?.prompt ?? "Talk",
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
            image: atlasFrame(entry.image.atlas, entry.image.frame),
          }))
        : [],
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
    if (activeBattle && !wasBattleOpen) void warmBattlePortraits(state).then(invalidate);
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
          resolveImage: (id) => speakerPortrait(id),
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
    battleCheck.render(checkOverlay(battle, geometry));
    // The card shows a new sticker; a species already in the album only pays.
    const rewardCritter =
      state.battle === null
        ? undefined
        : content.world.critters[state.battle.critterId];
    const battleReward =
      activeBattle &&
      state.battle?.phase === "reward" &&
      state.battle.rewardSticker !== null;
    // One reward card: a battle's new sticker, else a prize won at the arcade.
    const arcadePrize = battleReward || arcadeState?.game !== "claw" ? null : arcadeState.prize;
    rewardSticker.render(
      battleReward
        ? {
            visible: true,
            title: "NEW STICKER!",
            name: rewardCritter?.sticker.name ?? "",
            image:
              rewardCritter === undefined
                ? null
                : stickerArt(rewardCritter.id, rewardCritter.sticker.frame),
          }
        : arcadePrize !== null
          ? {
              visible: true,
              title: arcadePrize.title,
              name: arcadePrize.name,
              image: prizeArt(arcadePrize.frame),
            }
          : { visible: false, title: "", name: "", image: null },
    );
    const isStorySet = (variable: string): boolean =>
      content.world.storyVariable(state.ink, variable) === true;
    journal.render({
      visible: state.journalOpen,
      notes: state.journalOpen ? notesNow() : [],
      treats: state.journalOpen ? carriedTreats(content.world, state) : [],
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
              fieldNote: owned ? critterFieldNote(content.world, state, sticker.id) : null,
            };
          })
        : [],
      prizes: state.journalOpen
        ? content.world.arcade.prizes.map((prize) => ({
            id: prize.id,
            name: prize.name,
            owned: state.prizes.includes(prize.id),
            image: state.prizes.includes(prize.id)
              ? prizeArt(prize.frame)
              : null,
          }))
        : [],
      lands: state.journalOpen
        ? content.world.lands.map((land) => ({
            ...land,
            name: mapLandName(land, content.world.areas[state.area]?.land ?? null, isStorySet),
            ...(mapCentres[land.id] ?? { x: 0, y: 0 }),
          }))
        : [],
      currentLand: content.world.areas[state.area]?.land ?? null,
      landProgress: state.journalOpen ? landStickerProgress(content.world, state) : {},
      busRoutes: state.journalOpen
        ? mapBusRoutes(
            content.world.lands,
            isStorySet,
            (id) => state.stickers.includes(id),
          )
        : [],
      stickersOwned: state.stickers.length,
      stickersTotal: content.world.stickers.catalogue.length,
      prizesOwned: state.prizes.length,
      prizesTotal: content.world.arcade.prizes.length,
      coins: state.coins,
      snacks: state.snacks,
      tickets: state.tickets,
      gems: state.journalOpen ? starGemsFound(content.world, state) : undefined,
      muted: sound.muted(),
      level: sound.level(),
      musicMuted: sound.musicMuted(),
      musicLevel: sound.musicLevel(),
      ambienceMuted: sound.ambienceMuted(),
      nowPlaying: soundtrack.title,
      gentleTiming: gameSettings.gentleTiming(),
      keyHints: gameSettings.keyHints(),
      hasLantern,
      hasFlute,
      members: state.journalOpen
        ? [
            { id: "fae", name: "Fae", level: levelForXp(content.world.levels, state.xp),
              xp: state.xp,
              startXp: content.world.levels.thresholds[
                levelForXp(content.world.levels, state.xp) - 1] ?? 0,
              nextXp: content.world.levels.thresholds[
                levelForXp(content.world.levels, state.xp)] ?? state.xp,
              stats: statsForCommand(content.world.levels, "soothe",
                levelForXp(content.world.levels, state.xp)), friend: false },
            ...state.party.map((member) => {
              const party = content.world.party[member.id];
              const level = levelForXp(content.world.levels, member.xp);
              return { id: member.id, name: party?.name ?? member.id, level, xp: member.xp,
                startXp: content.world.levels.thresholds[level - 1] ?? 0,
                nextXp: content.world.levels.thresholds[level] ?? member.xp,
                stats: statsForCommand(content.world.levels,
                  party?.command?.id ?? "soothe", level),
                friend: true };
            }),
          ]
        : [],
    });
    if (state.journalOpen) document.documentElement.dataset.journal = "open";
    else delete document.documentElement.dataset.journal;
    if (
      activeBattle ||
      (arcadeState !== null && arcadeState.phase !== "result")
    )
      dialogueBox.hide();
    const levelUpNotice = levelUpNotices[0] ?? null;
    if (levelUpNotice !== null) {
      dialogueBox.render({ speaker: null, text: levelUpNotice, revealed: levelUpNotice.length,
        choices: [], selected: -1, canAdvance: true });
      document.documentElement.dataset.dialogue = "open";
    } else if (activeBattle && battle?.talk !== null && battle?.talk !== undefined) {
      const talkView = battleTalkDialogueView(battle.talk);
      dialogueBox.render({
        ...talkView,
        portrait: speakerPortrait(talkView.speaker),
        accent: speakerAccent(talkView.speaker),
      });
      document.documentElement.dataset.dialogue = "open";
    } else if (activeBattle && (battle?.message ?? "") !== "") {
      const activeCmd =
        state.battle?.phase === "command" &&
        battle?.talk === null &&
        !state.battle.treatMenu &&
        battle.treatTray === null
          ? (battle.commands[battle.selected] ?? null)
          : null;
      const feelingLabel =
        activeCmd?.feeling !== null && activeCmd?.feeling !== undefined
          ? (content.world.battle.feelings[activeCmd.feeling]?.label ?? null)
          : null;
      const battleText = battle?.message ?? "";
      const commandSubtitle =
        activeCmd !== null &&
        !battleText.startsWith("Fae plays her flute!") &&
        !battleText.startsWith("Fae twirls her rainbow lasso")
          ? battleCommandPreview(
              activeCmd,
              battle?.critterName ?? "the critter",
              feelingLabel,
            )
          : null;
      dialogueBox.render({
        speaker: null,
        text: battleText,
        subtitle: commandSubtitle,
        revealed: battle?.revealed ?? 0,
        choices: [],
        selected: -1,
        canAdvance: battle !== null && state.battle?.phase !== "command" &&
          battle.revealed >= battle.message.length,
      });
      document.documentElement.dataset.dialogue = "open";
    } else if (activeBattle) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else if (arcadeState !== null && arcadeState.phase === "result") {
      document.documentElement.dataset.dialogue = "open";
      dialogueBox.render({
        speaker: null,
        text: arcadeState.message,
        revealed: arcadeState.revealed,
        choices: [],
        selected: -1,
        canAdvance: arcadeState.revealed >= arcadeState.message.length,
      });
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
        portrait: speakerPortrait(state.dialogue.speaker),
        accent: speakerAccent(state.dialogue.speaker),
      });
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
          if (targetArea.id === "arcade") void ensureArcadeOverlay();
          if (targetArea.id === "clubhouse") void ensureCookOverlay();
          if (targetArea.id === "bay") void ensureFishOverlay();
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
    for (const cue of soundCues(previous, state, content.world)) {
      const played = sound.play(cue, state.tick, soundContext);
      if (import.meta.env.DEV || import.meta.env.MODE === "harness")
        console.log(`[cloverhollow] sound ${JSON.stringify(played)}`);
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
          warmAreaMedia(area),
          state.battle !== null ? warmBattlePortraits(state) : Promise.resolve(),
        ]);
        return;
      }
      reload = false;
      areaLoad = Promise.all([
        view.setArea(area).then(() => cacheAreaNpcPortraits(area)),
        warmAreaMedia(area),
        state.battle !== null ? warmBattlePortraits(state) : Promise.resolve(),
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
        await Promise.all([ensureArea(), warmOwnedJournalMedia(state)]);
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
        arcade: arcadeOverlay?.info() ?? cookOverlay?.info() ?? fishOverlay?.info() ?? null,
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
