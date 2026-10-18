import { Application, Assets, type Spritesheet } from "pixi.js";
import {
  blankInput,
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type BattleView,
  type MoleHole,
  type Point,
  type State,
  battleView,
  soundCues,
  arcadeView,
  mapLandName,
} from "./core";
import {
  loadContent,
  parseClawCalibration,
  parseMapCentres,
  parseMoleCalibration,
  parseCookCalibration,
  parseSkeeCalibration,
} from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { combineInputFrames, GamepadInput } from "./platform/gamepad";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView, type BattleCheckGeometry } from "./render/view";
import type { AtlasImage } from "./ui/atlas";
import { preventPinchZoom } from "./platform/gestures";
import { createDialogueBox, createNoticeMarks, createPrompt } from "./ui/sticker";
import {
  createBattleHud,
  createCommandMenu,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  createRewardSticker,
  type BattleCheckView as BattleCheckOverlayView,
} from "./ui/battle";
import { assetUrl } from "./platform/assets";
import { createJournal } from "./ui/journal";
import { createArcade } from "./ui/arcade";
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
import { createAudio } from "./platform/audio";
import type { AudioLevel } from "./platform/audio-settings";

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
  // We draw from our own ticker callback (below), so Pixi's per-frame render goes.
  app.ticker.remove(app.render, app);
  const root = document.querySelector("#app");
  if (root === null) throw new Error("Missing #app root");
  root.appendChild(app.canvas);
  const keyboard = new Keyboard();
  const gamepad = new GamepadInput();
  const sound = createAudio((audioState) => {
    if (import.meta.env.DEV || import.meta.env.MODE === "harness")
      console.log(
        `[cloverhollow] audio ${JSON.stringify({ state: audioState })}`,
      );
  });
  const touch = mountTouchControls();
  const uiRoot = document.createElement("div");
  document.body.append(uiRoot);
  const dialogueBox = createDialogueBox(uiRoot);
  const prompt = createPrompt(uiRoot);
  const noticeMarks = createNoticeMarks(uiRoot);
  const battleHud = createBattleHud(uiRoot);
  const commandMenu = createCommandMenu(uiRoot);
  const battleCheck = createBattleCheck(uiRoot);
  const feelingBubble = createFeelingBubble(uiRoot);
  const windUpBubbles = createWindUpBubbles(uiRoot);
  const rewardSticker = createRewardSticker(uiRoot);
  const journal = createJournal(uiRoot);
  journal.onToggleAudio(sound.toggle);
  journal.onSetAudioLevel((level: AudioLevel) => sound.setLevel(level));
  const title = createTitleScreen(uiRoot);
  const input = createInputSource(() => {
    return combineInputFrames(
      keyboard.frame(),
      touch.sample(),
      gamepad.frame(),
    );
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
  const atlases = new Set([
    ...Object.values(content.world.critters).map((critter) => critter.atlas),
    content.world.battle.toyAtlas,
  ]);
  await Promise.all(
    [...atlases].map(async (url) => {
      const atlas = new Image();
      atlas.src = assetUrl(url.replace(".json", ".png"));
      await atlas.decode();
    }),
  );
  const prizeSheet = await Assets.load<Spritesheet>(
    assetUrl(content.world.arcade.atlas),
  );
  const prizeImage = new Image();
  prizeImage.src = assetUrl(
    content.world.arcade.atlas.replace(".json", ".png"),
  );
  await prizeImage.decode();
  // The moles' frames (spec 8.2), decoded before Boop-a-Mole can open.
  const moleAtlas = "assets/arcade/moles.json";
  const moleSheet = await Assets.load<Spritesheet>(assetUrl(moleAtlas));
  const moleImage = new Image();
  moleImage.src = assetUrl(moleAtlas.replace(".json", ".png"));
  await moleImage.decode();
  // Mom's dishes for the clubhouse microwave (spec 8.2).
  const foodAtlas = "assets/arcade/cook-food.json";
  const foodSheet = await Assets.load<Spritesheet>(assetUrl(foodAtlas));
  const foodImage = new Image();
  foodImage.src = assetUrl(foodAtlas.replace(".json", ".png"));
  await foodImage.decode();
  // The arcade games' paintings and their calibrations (spec 8.2), each
  // decoded before its close-up can open.
  const painting = async <T extends { image: string }>(
    file: string,
    parse: (value: unknown, file: string) => T,
  ): Promise<{ calibration: T; image: string }> => {
    const response = await fetch(assetUrl(file));
    if (!response.ok) throw new Error(`Failed to load ${file}`);
    const calibration = parse(await response.json(), file);
    const image = new Image();
    image.src = assetUrl(`assets/arcade/${calibration.image}`);
    await image.decode();
    return { calibration, image: image.src };
  };
  const [clawPainting, skeePainting, molePainting, cookPainting] = await Promise.all([
    painting("assets/arcade/claw-machine.json", parseClawCalibration),
    painting("assets/arcade/skee-lane.json", parseSkeeCalibration),
    painting("assets/arcade/mole-cabinet.json", parseMoleCalibration),
    painting("assets/arcade/microwave.json", parseCookCalibration),
  ]);
  // A sticker's art: its critter's atlas, cropped to the frame its content
  // names, with the rect read from the atlas the view loaded.
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
    return null;
  };
  // A frame of a loaded atlas (`file`, its PNG beside it) as the DOM draws it.
  const sheetFrame = (
    sheet: Spritesheet | undefined,
    file: string,
    frameName: string,
  ): AtlasImage | null => {
    const rect = sheet?.data.frames[frameName]?.frame;
    const size = sheet?.data.meta.size;
    if (rect === undefined || size === undefined) return null;
    return {
      src: assetUrl(file.replace(".json", ".png")),
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      atlas: { w: size.w, h: size.h },
    };
  };
  const stickerArt = (critterId: string, frameName: string): AtlasImage | null => {
    const critter = content.world.critters[critterId];
    return critter === undefined ? null : sheetFrame(
      Assets.get<Spritesheet | undefined>(critter.atlas), critter.atlas, frameName);
  };
  // A prize's art: its frame in the prize atlas (spec 8.2).
  const prizeArt = (frameName: string): AtlasImage | null =>
    sheetFrame(prizeSheet, content.world.arcade.atlas, frameName);
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
  const arcade = createArcade(uiRoot, prizeArt, clawPainting, skeePainting, {
    ...molePainting,
    art: (frameName) => sheetFrame(moleSheet, moleAtlas, frameName),
    onHole,
  }, {
    ...cookPainting,
    art: (frameName) => sheetFrame(foodSheet, foodAtlas, frameName),
  });
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
  const render = (): void => {
    const arcadeState = arcadeView(content.world, state);
    arcade.render(arcadeState);
    if (arcadeState !== null) document.documentElement.dataset.arcade = "open";
    else delete document.documentElement.dataset.arcade;
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
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
    const lanternButton =
      document.querySelector<HTMLButtonElement>(".touch-lantern");
    if (lanternButton !== null) {
      lanternButton.hidden =
        content.world.storyVariable(state.ink, "has_lantern") !== true;
      lanternButton.classList.toggle("is-on", state.lantern);
    }
    const fluteButton = document.querySelector<HTMLButtonElement>(".touch-flute");
    if (fluteButton !== null)
      fluteButton.hidden = content.world.storyVariable(state.ink, "has_flute") !== true;
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
    // Which check is in play (spec 8.1): a catch or a lean shows its touch
    // arrows.
    const checkKind = state.battle?.phase === "check" ? state.battle.check?.kind : undefined;
    if (checkKind !== undefined) document.documentElement.dataset.check = checkKind;
    else delete document.documentElement.dataset.check;
    // An arrow held as a catch, a lean, or a round of Boop-a-Mole ends is
    // hidden mid-press and may never see its pointer lifted: outside one, it
    // lets go.
    if (checkKind !== "catch" && checkKind !== "lean" && state.arcade?.game !== "mole")
      touch.releaseArrows();
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
      lands: content.world.lands.map((land) => ({
        ...land,
        name: mapLandName(land, content.world.areas[state.area]?.land ?? null,
          content.world.storyVariable(state.ink, "found_mist_way") === true),
        ...(mapCentres[land.id] ?? { x: 0, y: 0 }),
      })),
      currentLand: content.world.areas[state.area]?.land ?? null,
      coins: state.coins,
      snacks: state.snacks,
      tickets: state.tickets,
      muted: sound.muted(),
      level: sound.level(),
    });
    if (state.journalOpen) document.documentElement.dataset.journal = "open";
    else delete document.documentElement.dataset.journal;
    if (
      activeBattle ||
      (arcadeState !== null && arcadeState.phase !== "result")
    )
      dialogueBox.hide();
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
    for (const cue of soundCues(previous, state, content.world)) {
      const played = sound.play(cue, state.tick);
      if (import.meta.env.DEV || import.meta.env.MODE === "harness")
        console.log(`[cloverhollow] sound ${JSON.stringify(played)}`);
    }
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
          invalidate();
        });
    }
  };
  // While the harness has the game paused, the frame is a pure function of a
  // state that only `step` changes, yet software-rendered Chromium spent ~60 ms
  // redrawing it every frame and every test command queued behind that draw
  // (an evaluate took 64 ms, against 5 ms drawing only on change). Paused, we
  // draw once after something changes; running, every frame as before.
  let drawPending = true;
  const invalidate = (): void => {
    drawPending = true;
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
      render();
      app.render();
    }
  });
  render();
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
        suppressSave = false;
        await ensureArea();
        titleMode = null;
      },
      renderInfo: () => ({ ...view.renderInfo(state), arcade: arcade.info() }),
      save: {
        clear: async () => {
          await saveQueue;
          await Preferences.remove({ key: saveKey });
          saveLast = null;
        },
        last: () => saveLast,
        loaded: () => saveLoaded,
      },
      sound: {
        log: sound.log,
        muted: sound.muted,
        level: sound.level,
        state: sound.state,
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
