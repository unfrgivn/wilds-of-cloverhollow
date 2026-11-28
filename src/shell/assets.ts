import { Assets, type Spritesheet } from "pixi.js";
import {
  CLUBHOUSE_VISITORS,
  type ArcadeView,
  type Area,
  type ClawView,
  type CometView,
  type CookView,
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
import {
  areaMediaAtlases,
  BATTLE_CHECKS_V2_ATLAS,
  battlePortraitAtlases,
  COMET_ATLAS,
  FAE_ATLAS,
  FISH_ATLAS,
  FOOD_ATLAS,
  MOLE_ATLAS,
  ownedJournalAtlases,
  TACO_ATLAS,
} from "./asset-touch";

export {
  areaMediaAtlases,
  BATTLE_CHECKS_V2_ATLAS,
  battlePortraitAtlases,
  bindBattleCheckTouch,
  COMET_ATLAS,
  createMoleHoleHandler,
  createTacoToppingHandler,
  FAE_ATLAS,
  FISH_ATLAS,
  FOOD_ATLAS,
  MOLE_ATLAS,
  ownedJournalAtlases,
  TACO_ATLAS,
  type BattleCheckBindTarget,
  type BattleCheckTouchSink,
  type MoleHoleTouch,
} from "./asset-touch";

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

  const makeLazy = <T>(
    load: () => Promise<T>,
  ): { get: () => T | null; ensure: () => Promise<void> } => {
    let instance: T | null = null;
    let pending: Promise<void> | undefined;
    return {
      get: () => instance,
      ensure: () => {
        if (instance !== null) return Promise.resolve();
        if (pending !== undefined) return pending;
        pending = load().then((created) => {
          instance = created;
        });
        return pending;
      },
    };
  };

  const clawOverlay = makeLazy<Overlay<ClawView, ClawInfo>>(() =>
    Promise.all([
      domAtlas(world.arcade.atlas),
      painting("assets/arcade/claw-machine.json", parseClawCalibration),
    ]).then(([, p]) => createClaw(uiRoot, prizeArt, p.calibration, p.image, onConfirmHold)),
  );
  const skeeOverlay = makeLazy<RecordOverlay<SkeeView, SkeeInfo>>(() =>
    painting("assets/arcade/skee-lane.json", parseSkeeCalibration).then((p) =>
      createSkee(uiRoot, p.calibration, p.image, onConfirmHold),
    ),
  );
  const moleOverlay = makeLazy<InputModeOverlay<MoleView, MoleInfo>>(() =>
    Promise.all([
      domAtlas(MOLE_ATLAS),
      painting("assets/arcade/mole-cabinet.json", parseMoleCalibration),
    ]).then(([, p]) =>
      createMole(uiRoot, (f) => atlasFrame(MOLE_ATLAS, f), p.calibration, p.image, onHole),
    ),
  );
  const cometOverlay = makeLazy<RecordOverlay<CometView, CometInfo>>(() =>
    Promise.all([
      domAtlas(COMET_ATLAS),
      painting("assets/arcade/comet-cabinet.json", parseCometCalibration),
    ]).then(([, p]) =>
      createComet(
        uiRoot, (f) => atlasFrame(COMET_ATLAS, f), p.calibration, p.image,
        onConfirmHold, onLaneStep,
      ),
    ),
  );
  const cookOverlay = makeLazy<RecordOverlay<CookView, CookInfo>>(() =>
    Promise.all([
      domAtlas(FOOD_ATLAS),
      painting("assets/arcade/microwave.json", parseCookCalibration),
    ]).then(([, p]) =>
      createCook(uiRoot, (f) => atlasFrame(FOOD_ATLAS, f), p.calibration, p.image, onConfirmHold),
    ),
  );
  const fishOverlay = makeLazy<InputModeOverlay<FishView, FishInfo>>(() =>
    Promise.all([
      domAtlas(FISH_ATLAS),
      painting("assets/arcade/fishing-dock.json", parseFishCalibration),
    ]).then(([, p]) =>
      createFish(uiRoot, (f) => atlasFrame(FISH_ATLAS, f), p.calibration, p.image, onConfirmHold),
    ),
  );
  const tacoOverlay = makeLazy<InputModeOverlay<TacoView, TacoInfo>>(() =>
    Promise.all([
      domAtlas(TACO_ATLAS),
      painting("assets/arcade/taco-truck.json", parseTacoCalibration),
    ]).then(([, p]) =>
      createTaco(
        uiRoot, (f) => atlasFrame(TACO_ATLAS, f), p.calibration, p.image,
        onPickTopping, onConfirmHold, onCancel,
      ),
    ),
  );

  const ensureClawOverlay = clawOverlay.ensure;
  const ensureSkeeOverlay = skeeOverlay.ensure;
  const ensureMoleOverlay = moleOverlay.ensure;
  const ensureCometOverlay = cometOverlay.ensure;
  const ensureCookOverlay = cookOverlay.ensure;
  const ensureFishOverlay = fishOverlay.ensure;
  const ensureTacoOverlay = tacoOverlay.ensure;
  const ensureArcadeOverlay = (): Promise<void> =>
    Promise.all([
      ensureClawOverlay(),
      ensureSkeeOverlay(),
      ensureMoleOverlay(),
      ensureCometOverlay(),
    ]).then(() => undefined);

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
      if (arcadeState.game === "claw" && clawOverlay.get() === null)
        void ensureClawOverlay().then(invalidate);
      else if (arcadeState.game === "skee" && skeeOverlay.get() === null)
        void ensureSkeeOverlay().then(invalidate);
      else if (arcadeState.game === "mole" && moleOverlay.get() === null)
        void ensureMoleOverlay().then(invalidate);
      else if (arcadeState.game === "comet" && cometOverlay.get() === null)
        void ensureCometOverlay().then(invalidate);
      else if (arcadeState.game === "cook" && cookOverlay.get() === null)
        void ensureCookOverlay().then(invalidate);
      else if (arcadeState.game === "fish" && fishOverlay.get() === null)
        void ensureFishOverlay().then(invalidate);
      else if (arcadeState.game === "taco" && tacoOverlay.get() === null)
        void ensureTacoOverlay().then(invalidate);
    }
    clawOverlay.get()?.render(arcadeState?.game === "claw" ? arcadeState : null);
    skeeOverlay.get()?.render(
      arcadeState?.game === "skee" ? arcadeState : null,
      arcadeState?.game === "skee" ? record : null,
    );
    moleOverlay.get()?.render(
      arcadeState?.game === "mole" ? arcadeState : null,
      arcadeState?.game === "mole" ? record : null,
      inputMode,
    );
    cometOverlay.get()?.render(
      arcadeState?.game === "comet" ? arcadeState : null,
      arcadeState?.game === "comet" ? record : null,
    );
    cookOverlay.get()?.render(
      arcadeState?.game === "cook" ? arcadeState : null,
      arcadeState?.game === "cook" ? record : null,
    );
    fishOverlay.get()?.render(
      arcadeState?.game === "fish" ? arcadeState : null,
      arcadeState?.game === "fish" ? record : null,
      inputMode,
    );
    tacoOverlay.get()?.render(
      arcadeState?.game === "taco" ? arcadeState : null,
      arcadeState?.game === "taco" ? record : null,
      inputMode,
    );
  };

  const overlayInfo = (): ArcadeInfo | null =>
    clawOverlay.get()?.info() ??
    skeeOverlay.get()?.info() ??
    moleOverlay.get()?.info() ??
    cometOverlay.get()?.info() ??
    cookOverlay.get()?.info() ??
    fishOverlay.get()?.info() ??
    tacoOverlay.get()?.info() ??
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
