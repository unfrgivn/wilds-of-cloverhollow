import { Assets, type Spritesheet } from "pixi.js";
import {
  battleParty,
  CLUBHOUSE_VISITORS,
  type ArcadeView,
  type Area,
  type ClawView,
  type CometView,
  type CookView,
  type EchoNote,
  type FishView,
  type MoleHole,
  type MoleView,
  type Point,
  type SkeeView,
  type State,
  type TacoTopping,
  type TacoView,
  type World,
} from "../core";
import {
  parseClawCalibration,
  parseCometCalibration,
  parseCookCalibration,
  parseFishCalibration,
  parseMapCentres,
  parseMoleCalibration,
  parseSkeeCalibration,
  parseTacoCalibration,
} from "../content/load";
import { assetUrl } from "../platform/assets";
import type { ArcadeInfo } from "../ui/arcade";
import type { ArcadeRecordBadge } from "../ui/arcade-popups";
import {
  atlasImage,
  atlasImagePath,
  parseAtlasJson,
  type AtlasImage,
  type AtlasJson,
} from "../ui/atlas";
import { createClaw, type ClawInfo } from "../ui/claw";
import { createComet, type CometInfo } from "../ui/comet";
import { createCook, type CookInfo } from "../ui/cook";
import { createFish, type FishInfo } from "../ui/fish";
import type { HudInputMode } from "../ui/hud-hints";
import { createMole, type MoleInfo } from "../ui/mole";
import {
  cropPortraitFrame,
  PORTRAITS_ATLAS,
  speakerPortraitSource,
  type PortraitExpression,
} from "../ui/portraits";
import { createSkee, type SkeeInfo } from "../ui/skee";
import { createTaco, type TacoInfo } from "../ui/taco";

export {
  battleCheckOverlay,
  buildBattleHudView,
  buildCommandMenuView,
  buildCreditsView,
  buildDialogueView,
  buildHudHintsView,
  buildJournalView,
  buildRewardStickerView,
  cropCreditFrame,
  keepsBattleArrows,
  type AtlasFrameResolver,
  type BattleHudViewParams,
  type DialogueViewParams,
  type HudHintsViewParams,
  type JournalArt,
  type JournalViewParams,
  type RewardStickerView,
  type StickerPrizeArt,
} from "./view-models";

export const MOLE_ATLAS = "assets/arcade/moles.json";
export const FOOD_ATLAS = "assets/arcade/cook-food.json";
export const FISH_ATLAS = "assets/arcade/fish-catches.json";
export const TACO_ATLAS = "assets/arcade/taco-ingredients.json";
export const COMET_ATLAS = "assets/arcade/comet.json";
export const FAE_ATLAS = "assets/characters/fae/fae.json";
export const BATTLE_CHECKS_V2_ATLAS = "assets/battle/battle-checks-v2.json";

export type MoleHoleTouch = {
  setButton: (button: "confirm", down: boolean) => void;
  tapButton: (button: "confirm") => void;
  holdArrow: (direction: Point) => void;
  tapArrow: (direction: Point) => void;
  releaseArrow: (direction: Point) => void;
};

const HOLE_ARROWS: Readonly<Record<Exclude<MoleHole, "middle">, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const TOPPING_ARROWS: Readonly<Record<TacoTopping, Point>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

const ECHO_ARROWS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export type BattleCheckTouchSink = {
  setButton: (button: "confirm", down: boolean) => void;
  tapButton: (button: "confirm") => void;
  tapChoice: (index: number) => void;
  tapArrow: (direction: Point) => void;
  setPointerArrow: (direction: Point | null) => void;
  beginTrace: (event: PointerEvent) => void;
  moveTrace: (event: PointerEvent) => void;
  endTrace: (event: PointerEvent) => void;
};

export type BattleCheckBindTarget = {
  onConfirmHold: (callback: (held: boolean) => void) => void;
  onDirectionHold: (callback: (dir: Point) => void) => void;
  onEchoNote: (callback: (note: EchoNote) => void) => void;
  onCheckChoice: (callback: (index: number) => void) => void;
  onSpinArrow: (callback: (dir: Point) => void) => void;
  onSnagConfirm: (callback: () => void) => void;
  onSpinPointer: (callback: (phase: "down" | "move" | "up", event: PointerEvent) => void) => void;
};

/** Wires all v1 + v2 battle check overlay callbacks onto TouchInput and returns confirm-hold. */
export function bindBattleCheckTouch(
  battleCheck: BattleCheckBindTarget,
  touch: BattleCheckTouchSink,
): (held: boolean) => void {
  const handleConfirmHold = (held: boolean): void => {
    touch.setButton("confirm", held);
    if (held) touch.tapButton("confirm");
  };
  battleCheck.onConfirmHold(handleConfirmHold);
  battleCheck.onDirectionHold((dir) => {
    touch.setPointerArrow(dir.x === 0 && dir.y === 0 ? null : dir);
  });
  battleCheck.onEchoNote((note) => {
    const direction = ECHO_ARROWS[note];
    if (direction !== undefined) touch.tapArrow(direction);
  });
  battleCheck.onCheckChoice((index) => touch.tapChoice(index));
  battleCheck.onSpinArrow((dir) => touch.tapArrow(dir));
  battleCheck.onSnagConfirm(() => touch.tapButton("confirm"));
  battleCheck.onSpinPointer((phase, event) => {
    if (phase === "down") touch.beginTrace(event);
    else if (phase === "move") touch.moveTrace(event);
    else touch.endTrace(event);
  });
  return handleConfirmHold;
}

/** Maps Taco Truck bowl taps to 1-tick directional arrow presses. */
export function createTacoToppingHandler(
  touch: Pick<MoleHoleTouch, "tapArrow">,
): (topping: TacoTopping) => void {
  return (topping) => touch.tapArrow(TOPPING_ARROWS[topping]);
}

/** Maps Boop-a-Mole touch holes to directional arrows and confirm presses. */
export function createMoleHoleHandler(
  touch: MoleHoleTouch,
): (hole: MoleHole, down: boolean) => void {
  return (hole, down) => {
    if (hole === "middle") {
      touch.setButton("confirm", down);
      if (down) touch.tapButton("confirm");
    } else if (down) {
      touch.holdArrow(HOLE_ARROWS[hole]);
      touch.tapArrow(HOLE_ARROWS[hole]);
    } else {
      touch.releaseArrow(HOLE_ARROWS[hole]);
    }
  };
}

/** Unique critter & NPC atlas JSON paths whose DOM images an area needs warmed. */
export function areaMediaAtlases(
  world: Pick<World, "critters" | "characters">,
  area: Pick<Area, "critters" | "recurring" | "npcs"> & { id?: string },
): string[] {
  const atlases = new Set<string>();
  const areaCritters = new Set([
    ...area.critters.map((piece) => piece.id),
    ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
    ...area.npcs.flatMap((npc) =>
      npc.visibleWhenCalmed === undefined ? [] : [npc.visibleWhenCalmed]),
  ]);
  for (const id of areaCritters) {
    const critter = world.critters[id];
    if (critter !== undefined) atlases.add(critter.atlas);
  }
  for (const npc of area.npcs) {
    const character = world.characters[npc.id];
    if (character !== undefined) atlases.add(character.atlas);
  }
  if (area.id === "clubhouse") {
    for (const visitor of CLUBHOUSE_VISITORS) {
      const character = world.characters[visitor.id];
      if (character !== undefined) atlases.add(character.atlas);
    }
  }
  return [...atlases];
}

/** Unique atlas JSON paths for every sticker, prize, and fish currently owned in the journal. */
export function ownedJournalAtlases(
  world: Pick<World, "stickers" | "critters" | "arcade">,
  state: Pick<State, "stickers" | "prizes" | "caughtFish">,
): string[] {
  const atlases = new Set<string>();
  for (const id of state.stickers) {
    const sticker = world.stickers.catalogue.find((item) => item.id === id);
    const critter = sticker === undefined ? undefined : world.critters[sticker.critter];
    if (critter !== undefined) atlases.add(critter.atlas);
  }
  if (state.prizes.length > 0) atlases.add(world.arcade.atlas);
  if (Object.values(state.caughtFish ?? {}).some((count) => count > 0)) atlases.add(FISH_ATLAS);
  return [...atlases];
}

/** Unique atlas JSON paths needed for Fae and the active battle party's portraits. */
export function battlePortraitAtlases(
  world: World,
  state: Pick<State, "party">,
): string[] {
  const atlases = new Set<string>([FAE_ATLAS]);
  for (const member of battleParty(world, state.party)) {
    const info = world.party[member.id];
    if (info !== undefined) atlases.add(info.atlas);
  }
  return [...atlases];
}

type Overlay<V, I> = {
  render: (view: V | null) => void;
  info: () => I | null;
};

type RecordOverlay<V, I> = {
  render: (view: V | null, record?: ArcadeRecordBadge | null) => void;
  info: () => I | null;
};

type InputModeOverlay<V, I> = {
  render: (
    view: V | null,
    record?: ArcadeRecordBadge | null,
    inputMode?: HudInputMode,
  ) => void;
  info: () => I | null;
};

export type ShellAssetsOptions = {
  world: World;
  uiRoot: HTMLElement;
  invalidate: () => void;
  onHole: (hole: MoleHole, down: boolean) => void;
  onConfirmHold?: (held: boolean) => void;
  onLaneStep?: (delta: -1 | 1) => void;
  onPickTopping?: (topping: TacoTopping) => void;
  onCancel?: () => void;
};

export type ShellAssets = {
  loadMapCentres: () => Promise<Record<string, Point>>;
  ensureAtlasMeta: (file: string) => Promise<AtlasJson>;
  hasAtlasMeta: (file: string) => boolean;
  domAtlas: (file: string) => Promise<AtlasJson>;
  decodeAtlasImage: (file: string) => Promise<void>;
  atlasFrame: (file: string, frameName: string) => AtlasImage | null;
  stickerArt: (critterId: string, frameName: string) => AtlasImage | null;
  prizeArt: (frameName: string) => AtlasImage | null;
  speakerPortrait: (speaker: string | null, expression?: PortraitExpression) => AtlasImage | null;
  fishArt: (frameName: string) => AtlasImage | null;
  toyArt: (frameName: string) => AtlasImage | null;
  checkV2Art: (frameName: string) => AtlasImage | null;
  seedCoreSheets: () => void;
  cacheAreaNpcPortraits: (area: Area) => void;
  preloadCoreAtlasMeta: () => Promise<void>;
  warmBootBattleAtlases: () => Promise<void>;
  ensureClawOverlay: () => Promise<void>;
  ensureSkeeOverlay: () => Promise<void>;
  ensureMoleOverlay: () => Promise<void>;
  ensureCometOverlay: () => Promise<void>;
  ensureArcadeOverlay: () => Promise<void>;
  ensureCookOverlay: () => Promise<void>;
  ensureFishOverlay: () => Promise<void>;
  ensureTacoOverlay: () => Promise<void>;
  warmAreaOverlays: (areaId: string) => Promise<void>;
  warmAreaMedia: (area: Area) => Promise<void>;
  warmJournalAssets: (snapshot: State) => Promise<void>;
  warmJournalOnRender: (
    snapshot: State,
    wasJournalOpen: boolean,
    isStillOpen: () => boolean,
  ) => void;
  warmBattlePortraits: (snapshot: State) => Promise<void>;
  warmEncoreArt: (bossIds: readonly string[]) => Promise<void>;
  renderOverlays: (
    arcadeState: ArcadeView | null,
    record?: ArcadeRecordBadge | null,
    inputMode?: HudInputMode,
  ) => void;
  overlayInfo: () => ArcadeInfo | null;
};

/**
 * Owns lazy DOM atlas metadata caching, single-decode image warming, frame crop
 * resolvers, and per-area close-up overlays so `src/main.ts` stays focused on
 * composition and lifecycle.
 */
export function createShellAssets(options: ShellAssetsOptions): ShellAssets {
  const {
    world, uiRoot, invalidate, onHole, onConfirmHold, onLaneStep, onPickTopping, onCancel,
  } = options;

  const loadMapCentres = async (): Promise<Record<string, Point>> => {
    const mapFile = "assets/ui/map/world-map.json";
    const response = await fetch(assetUrl(mapFile));
    if (!response.ok) throw new Error(`Failed to load ${mapFile}`);
    return parseMapCentres(await response.json(), mapFile);
  };

  // DOM image decode cache: each image decodes at most once, only when needed.
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

  // Tiny atlas JSON metadata cache (~1 KB per sheet, zero GPU VRAM).
  const atlasJsonCache = new Map<string, AtlasJson>();
  const atlasJsonPending = new Map<string, Promise<AtlasJson>>();
  const ensureAtlasMeta = (file: string): Promise<AtlasJson> => {
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

  const hasAtlasMeta = (file: string): boolean => atlasJsonCache.has(file);

  const domAtlas = async (file: string): Promise<AtlasJson> => {
    const data = await ensureAtlasMeta(file);
    await decodeOnce(atlasImagePath(file, data));
    return data;
  };

  const decodeAtlasImage = async (file: string): Promise<void> => {
    const cached = atlasJsonCache.get(file) ?? Assets.get<Spritesheet | undefined>(file)?.data;
    const data = cached ?? await ensureAtlasMeta(file);
    await decodeOnce(atlasImagePath(file, data));
  };

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
    return data === undefined
      ? null
      : atlasImage(data, assetUrl(atlasImagePath(file, data)), frameName);
  };

  const stickerArt = (critterId: string, frameName: string): AtlasImage | null => {
    const critter = world.critters[critterId];
    return critter === undefined ? null : atlasFrame(critter.atlas, frameName);
  };

  const resolvePortraitFromSource = (
    source: ReturnType<typeof speakerPortraitSource>,
  ): AtlasImage | null => {
    if (source === null) return null;
    const data =
      atlasJsonCache.get(source.atlas) ?? Assets.get<Spritesheet | undefined>(source.atlas)?.data;
    if (data === undefined) {
      void ensureAtlasMeta(source.atlas)
        .then((loaded) => decodeOnce(atlasImagePath(source.atlas, loaded)))
        .then(invalidate)
        .catch(() => undefined);
      return null;
    }
    if (data.frames[source.frame] === undefined) return null;
    const image = atlasImage(data, assetUrl(atlasImagePath(source.atlas, data)), source.frame);
    return { ...image, frame: cropPortraitFrame(image.frame, source.cropMode) };
  };

  const speakerPortrait = (
    speaker: string | null,
    expression?: PortraitExpression,
  ): AtlasImage | null => {
    const primary = speakerPortraitSource(world, speaker, expression);
    const resolved = resolvePortraitFromSource(primary);
    if (resolved !== null) return resolved;
    if (expression !== undefined && primary?.atlas === PORTRAITS_ATLAS) {
      return resolvePortraitFromSource(speakerPortraitSource(world, speaker));
    }
    return null;
  };

  const prizeArt = (frameName: string): AtlasImage | null =>
    atlasFrame(world.arcade.atlas, frameName);

  const fishArt = (frameName: string): AtlasImage | null => atlasFrame(FISH_ATLAS, frameName);

  const toyArt = (frameName: string): AtlasImage | null => {
    const atlas = world.battle.toyAtlas;
    const sheet = Assets.get<Spritesheet | undefined>(atlas);
    const rect = sheet?.data.frames[frameName]?.frame;
    const size = sheet?.data.meta.size;
    if (sheet === undefined || rect === undefined || size === undefined) return null;
    return {
      src: assetUrl(atlasImagePath(atlas, sheet.data)),
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      atlas: { w: size.w, h: size.h },
    };
  };

  const checkV2Art = (frameName: string): AtlasImage | null =>
    atlasFrame(BATTLE_CHECKS_V2_ATLAS, frameName);

  const seedCoreSheets = (): void => {
    const faeSheet = Assets.get<Spritesheet | undefined>("fae-sheet");
    if (faeSheet !== undefined) atlasJsonCache.set(FAE_ATLAS, faeSheet.data);
    for (const [id, member] of Object.entries(world.party)) {
      const sheet = Assets.get<Spritesheet | undefined>(`${id}-sheet`);
      if (sheet !== undefined) atlasJsonCache.set(member.atlas, sheet.data);
    }
  };

  const cacheAreaNpcPortraits = (area: Area): void => {
    const ids = area.npcs.map((npc) => npc.id);
    if (area.id === "clubhouse") {
      for (const visitor of CLUBHOUSE_VISITORS) ids.push(visitor.id);
    }
    for (const id of ids) {
      const character = world.characters[id];
      if (character === undefined || atlasJsonCache.has(character.atlas)) continue;
      const sheet = Assets.get<Spritesheet | undefined>(`${id}-sheet`);
      if (sheet !== undefined) atlasJsonCache.set(character.atlas, sheet.data);
    }
  };

  const preloadCoreAtlasMeta = async (): Promise<void> => {
    const critterJsonFiles = [
      ...new Set(Object.values(world.critters).map((critter) => critter.atlas)),
    ];
    await Promise.all([
      ensureAtlasMeta(PORTRAITS_ATLAS),
      ensureAtlasMeta(world.arcade.atlas),
      ensureAtlasMeta(BATTLE_CHECKS_V2_ATLAS),
      ...critterJsonFiles.map((file) => ensureAtlasMeta(file)),
    ]);
  };

  const warmBootBattleAtlases = async (): Promise<void> => {
    await Promise.all([
      decodeAtlasImage(FAE_ATLAS),
      decodeAtlasImage(world.battle.toyAtlas),
      decodeAtlasImage(BATTLE_CHECKS_V2_ATLAS),
    ]);
  };

  let clawOverlay: Overlay<ClawView, ClawInfo> | null = null;
  let clawLoad: Promise<void> | undefined;
  const ensureClawOverlay = (): Promise<void> => {
    if (clawOverlay !== null) return Promise.resolve();
    if (clawLoad !== undefined) return clawLoad;
    clawLoad = Promise.all([
      domAtlas(world.arcade.atlas),
      painting("assets/arcade/claw-machine.json", parseClawCalibration),
    ]).then(([, clawPainting]) => {
      clawOverlay = createClaw(
        uiRoot,
        prizeArt,
        clawPainting.calibration,
        clawPainting.image,
        onConfirmHold,
      );
    });
    return clawLoad;
  };

  let skeeOverlay: RecordOverlay<SkeeView, SkeeInfo> | null = null;
  let skeeLoad: Promise<void> | undefined;
  const ensureSkeeOverlay = (): Promise<void> => {
    if (skeeOverlay !== null) return Promise.resolve();
    if (skeeLoad !== undefined) return skeeLoad;
    skeeLoad = painting("assets/arcade/skee-lane.json", parseSkeeCalibration).then(
      (skeePainting) => {
        skeeOverlay = createSkee(
          uiRoot,
          skeePainting.calibration,
          skeePainting.image,
          onConfirmHold,
        );
      },
    );
    return skeeLoad;
  };

  let moleOverlay: InputModeOverlay<MoleView, MoleInfo> | null = null;
  let moleLoad: Promise<void> | undefined;
  const ensureMoleOverlay = (): Promise<void> => {
    if (moleOverlay !== null) return Promise.resolve();
    if (moleLoad !== undefined) return moleLoad;
    moleLoad = Promise.all([
      domAtlas(MOLE_ATLAS),
      painting("assets/arcade/mole-cabinet.json", parseMoleCalibration),
    ]).then(([, molePainting]) => {
      moleOverlay = createMole(
        uiRoot,
        (frameName) => atlasFrame(MOLE_ATLAS, frameName),
        molePainting.calibration,
        molePainting.image,
        onHole,
      );
    });
    return moleLoad;
  };

  let cometOverlay: RecordOverlay<CometView, CometInfo> | null = null;
  let cometLoad: Promise<void> | undefined;
  const ensureCometOverlay = (): Promise<void> => {
    if (cometOverlay !== null) return Promise.resolve();
    if (cometLoad !== undefined) return cometLoad;
    cometLoad = Promise.all([
      domAtlas(COMET_ATLAS),
      painting("assets/arcade/comet-cabinet.json", parseCometCalibration),
    ]).then(([, cometPainting]) => {
      cometOverlay = createComet(
        uiRoot,
        (frameName) => atlasFrame(COMET_ATLAS, frameName),
        cometPainting.calibration,
        cometPainting.image,
        onConfirmHold,
        onLaneStep,
      );
    });
    return cometLoad;
  };

  const ensureArcadeOverlay = (): Promise<void> =>
    Promise.all([
      ensureClawOverlay(),
      ensureSkeeOverlay(),
      ensureMoleOverlay(),
      ensureCometOverlay(),
    ]).then(() => undefined);

  let cookOverlay: RecordOverlay<CookView, CookInfo> | null = null;
  let cookLoad: Promise<void> | undefined;
  const ensureCookOverlay = (): Promise<void> => {
    if (cookOverlay !== null) return Promise.resolve();
    if (cookLoad !== undefined) return cookLoad;
    cookLoad = Promise.all([
      domAtlas(FOOD_ATLAS),
      painting("assets/arcade/microwave.json", parseCookCalibration),
    ]).then(([, cookPainting]) => {
      cookOverlay = createCook(
        uiRoot,
        (frameName) => atlasFrame(FOOD_ATLAS, frameName),
        cookPainting.calibration,
        cookPainting.image,
        onConfirmHold,
      );
    });
    return cookLoad;
  };

  let fishOverlay: InputModeOverlay<FishView, FishInfo> | null = null;
  let fishLoad: Promise<void> | undefined;
  const ensureFishOverlay = (): Promise<void> => {
    if (fishOverlay !== null) return Promise.resolve();
    if (fishLoad !== undefined) return fishLoad;
    fishLoad = Promise.all([
      domAtlas(FISH_ATLAS),
      painting("assets/arcade/fishing-dock.json", parseFishCalibration),
    ]).then(([, fishPainting]) => {
      fishOverlay = createFish(
        uiRoot,
        (frameName) => atlasFrame(FISH_ATLAS, frameName),
        fishPainting.calibration,
        fishPainting.image,
        onConfirmHold,
      );
    });
    return fishLoad;
  };

  let tacoOverlay: InputModeOverlay<TacoView, TacoInfo> | null = null;
  let tacoLoad: Promise<void> | undefined;
  const ensureTacoOverlay = (): Promise<void> => {
    if (tacoOverlay !== null) return Promise.resolve();
    if (tacoLoad !== undefined) return tacoLoad;
    tacoLoad = Promise.all([
      domAtlas(TACO_ATLAS),
      painting("assets/arcade/taco-truck.json", parseTacoCalibration),
    ]).then(([, tacoPainting]) => {
      tacoOverlay = createTaco(
        uiRoot,
        (frameName) => atlasFrame(TACO_ATLAS, frameName),
        tacoPainting.calibration,
        tacoPainting.image,
        onPickTopping,
        onConfirmHold,
        onCancel,
      );
    });
    return tacoLoad;
  };

  const warmAreaOverlays = (areaId: string): Promise<void> => {
    if (areaId === "arcade") return ensureArcadeOverlay();
    if (areaId === "clubhouse") return ensureCookOverlay();
    if (areaId === "bay") return ensureFishOverlay();
    if (areaId === "hills") return ensureTacoOverlay();
    return Promise.resolve();
  };

  const warmAreaMedia = async (area: Area): Promise<void> => {
    const loads: Promise<unknown>[] = [
      warmAreaOverlays(area.id),
      decodeAtlasImage(PORTRAITS_ATLAS),
    ];
    for (const atlas of areaMediaAtlases(world, area)) {
      loads.push(decodeAtlasImage(atlas));
    }
    await Promise.all(loads);
  };

  const warmJournalAssets = async (snapshot: State): Promise<void> => {
    await Promise.all(ownedJournalAtlases(world, snapshot).map((atlas) => decodeAtlasImage(atlas)));
  };

  const warmJournalOnRender = (
    snapshot: State,
    wasJournalOpen: boolean,
    isStillOpen: () => boolean,
  ): void => {
    if (snapshot.journalOpen && !wasJournalOpen) {
      void warmJournalAssets(snapshot).then(() => {
        if (isStillOpen()) invalidate();
      });
    } else if (
      snapshot.journalOpen &&
      Object.values(snapshot.caughtFish ?? {}).some((count) => count > 0) &&
      !hasAtlasMeta(FISH_ATLAS)
    ) {
      void decodeAtlasImage(FISH_ATLAS).then(() => {
        if (isStillOpen()) invalidate();
      });
    }
  };

  const warmBattlePortraits = async (snapshot: State): Promise<void> => {
    await Promise.all([
      decodeAtlasImage(BATTLE_CHECKS_V2_ATLAS),
      ...battlePortraitAtlases(world, snapshot).map((atlas) => decodeAtlasImage(atlas)),
    ]);
  };

  const warmEncoreArt = async (bossIds: readonly string[]): Promise<void> => {
    const atlases = new Set<string>();
    for (const id of bossIds) {
      const critter = world.critters[id];
      if (critter !== undefined) atlases.add(critter.atlas);
    }
    await Promise.all([...atlases].map((atlas) => decodeAtlasImage(atlas)));
  };

  const renderOverlays = (
    arcadeState: ArcadeView | null,
    record: ArcadeRecordBadge | null = null,
    inputMode: HudInputMode = "keyboard",
  ): void => {
    if (arcadeState !== null) {
      if (arcadeState.game === "claw" && clawOverlay === null)
        void ensureClawOverlay().then(invalidate);
      else if (arcadeState.game === "skee" && skeeOverlay === null)
        void ensureSkeeOverlay().then(invalidate);
      else if (arcadeState.game === "mole" && moleOverlay === null)
        void ensureMoleOverlay().then(invalidate);
      else if (arcadeState.game === "comet" && cometOverlay === null)
        void ensureCometOverlay().then(invalidate);
      else if (arcadeState.game === "cook" && cookOverlay === null)
        void ensureCookOverlay().then(invalidate);
      else if (arcadeState.game === "fish" && fishOverlay === null)
        void ensureFishOverlay().then(invalidate);
      else if (arcadeState.game === "taco" && tacoOverlay === null)
        void ensureTacoOverlay().then(invalidate);
    }
    clawOverlay?.render(arcadeState?.game === "claw" ? arcadeState : null);
    skeeOverlay?.render(
      arcadeState?.game === "skee" ? arcadeState : null,
      arcadeState?.game === "skee" ? record : null,
    );
    moleOverlay?.render(
      arcadeState?.game === "mole" ? arcadeState : null,
      arcadeState?.game === "mole" ? record : null,
      inputMode,
    );
    cometOverlay?.render(
      arcadeState?.game === "comet" ? arcadeState : null,
      arcadeState?.game === "comet" ? record : null,
    );
    cookOverlay?.render(
      arcadeState?.game === "cook" ? arcadeState : null,
      arcadeState?.game === "cook" ? record : null,
    );
    fishOverlay?.render(
      arcadeState?.game === "fish" ? arcadeState : null,
      arcadeState?.game === "fish" ? record : null,
      inputMode,
    );
    tacoOverlay?.render(
      arcadeState?.game === "taco" ? arcadeState : null,
      arcadeState?.game === "taco" ? record : null,
      inputMode,
    );
  };

  const overlayInfo = (): ArcadeInfo | null =>
    clawOverlay?.info() ??
    skeeOverlay?.info() ??
    moleOverlay?.info() ??
    cometOverlay?.info() ??
    cookOverlay?.info() ??
    fishOverlay?.info() ??
    tacoOverlay?.info() ??
    null;

  return {
    loadMapCentres, ensureAtlasMeta, hasAtlasMeta, domAtlas, decodeAtlasImage, atlasFrame,
    stickerArt, prizeArt, speakerPortrait, fishArt, toyArt, checkV2Art, seedCoreSheets,
    cacheAreaNpcPortraits, preloadCoreAtlasMeta, warmBootBattleAtlases,
    ensureClawOverlay, ensureSkeeOverlay, ensureMoleOverlay, ensureCometOverlay,
    ensureArcadeOverlay, ensureCookOverlay, ensureFishOverlay, ensureTacoOverlay,
    warmAreaOverlays, warmAreaMedia, warmJournalAssets, warmJournalOnRender,
    warmBattlePortraits, warmEncoreArt, renderOverlays, overlayInfo,
  };
}
