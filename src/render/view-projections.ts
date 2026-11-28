import {
  targetInteractable, targetPuzzleAction, wildMarks,
  type Area, type CreditEntry, type NpcLifeSnapshot, type Point, type State, type World,
} from "../core";
import type { NpcChatterView } from "../ui/npc-chatter";
import type { AtmosphereOptions } from "./atmosphere-recipes";
import type { BattleRenderInfo } from "./battle-view";
import {
  cutsceneCameraPoint, interpolatePoint, smoothFollowCamera, worldToScreen,
} from "./camera";
import type { PinnedPostcardRenderInfo } from "./clubhouse-display";
import { findPettableCompanion, findRestSpot, type RestSpot } from "./companions";
import type { CutsceneRenderInfo } from "./cutscene-render";
import type {
  AmbientFrameInfo, CritterFrameInfo, NpcFrameInfo, PartyFrameInfo,
} from "./entity-layer";
import { transitionZoom } from "./fade";
import { findPebbleSkipSpot } from "./micro-delights";
import type { NpcLifeRenderInfo } from "./npc-life";
import type { MicroDelightsRenderInfo } from "./micro-delights-render";
import { computeLanternBlend, PET_REACTION_DURATION } from "./overworld-render";
import type { PuzzleRenderInfo } from "./puzzles-render";
import type { TimeOfDayPhase } from "./time-of-day";

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PromptScreenView = {
  visible: boolean;
  label: string;
  x: number;
  y: number;
  tone?: "default" | "heart";
};

export type NoticeMarkView = {
  key: string;
  mark: "?" | "!";
  x: number;
  y: number;
};

export type OverworldCameraFrame = {
  canInterpolate: boolean;
  alpha: number;
  playerPos: Point;
  camera: Point;
  zoomScale: number;
  zoomOffsetX: number;
  zoomOffsetY: number;
};

export type GameViewRenderInfo = {
  area: string;
  finale: State["finale"];
  credits: { entries: CreditEntry[] } | null;
  drawOrder: { label: string; zIndex: number }[];
  animation: string;
  frame: number;
  paperFlipScaleX: number;
  party: PartyFrameInfo[];
  fade: number;
  cachedAreaTextures: string[];
  prompt: PromptScreenView;
  dialogue: {
    open: boolean;
    speaker: string | null;
    revealed: number;
    length: number;
    choices: string[];
    selected: number;
  };
  critters: CritterFrameInfo[];
  npcs: NpcFrameInfo[];
  npcLife: NpcLifeRenderInfo;
  ambient: AmbientFrameInfo[];
  canopies: { id: string; alpha: number }[];
  props: {
    id: string;
    state: string;
    flat: boolean;
    hidden: boolean;
    strips: { left: number; right: number; zIndex: number }[];
  }[];
  lantern: { on: boolean; glows: string[] };
  marks: NoticeMarkView[];
  clubhouseDisplay: number;
  pinnedPostcard: PinnedPostcardRenderInfo | null;
  atmosphereParticles: number;
  footstepPuffs: number;
  starGemGlints: number;
  petting: string | null;
  resting: string | null;
  timeOfDay: TimeOfDayPhase;
  photoMode: boolean;
  microDelights: MicroDelightsRenderInfo;
  puzzles: PuzzleRenderInfo;
  battle: BattleRenderInfo;
  cutscene: CutsceneRenderInfo | null;
};

/** Computes the letterboxed viewport rectangle inside the canvas. */
export function computeViewportRect(
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
): ViewportRect {
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const viewW = viewWidth * scale;
  const viewH = viewHeight * scale;
  return {
    x: (width - viewW) / 2,
    y: (height - viewH) / 2,
    width: viewW,
    height: viewH,
  };
}

/** Computes camera position, player interpolation, and door-transition zoom transform. */
export function computeOverworldCameraFrame(params: {
  area: Area;
  state: State;
  previousState: State | undefined;
  previousCamera: Point | undefined;
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  resolution: number;
  doorFadeTicks: number;
  paused: boolean;
  reducedMotion: boolean;
  alpha: number;
}): OverworldCameraFrame {
  const {
    area,
    state,
    previousState,
    previousCamera,
    width,
    height,
    viewWidth,
    viewHeight,
    resolution,
    doorFadeTicks,
    paused,
    reducedMotion,
  } = params;
  const canInterpolate =
    !paused &&
    previousState !== undefined &&
    previousState.area === state.area &&
    state.transition === null;
  const alpha = canInterpolate ? Math.max(0, Math.min(1, params.alpha)) : 1;
  const playerPos = canInterpolate
    ? interpolatePoint(previousState.player, state.player, alpha)
    : state.player;
  const snapCamera =
    paused ||
    reducedMotion ||
    previousCamera === undefined ||
    state.transition !== null ||
    area.id === "harness";
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const csCam = state.cutscene?.camera;
  let camera: Point;
  let cutsceneZoom = 1;
  if (csCam !== null && csCam !== undefined) {
    const prevCam = previousState?.cutscene?.camera;
    const canInterpCam = canInterpolate && prevCam !== null && prevCam !== undefined;
    const camFocus = canInterpCam
      ? interpolatePoint(prevCam, csCam, alpha)
      : { x: csCam.x, y: csCam.y };
    const camZoom = canInterpCam
      ? prevCam.zoom + (csCam.zoom - prevCam.zoom) * alpha
      : csCam.zoom;
    camera = cutsceneCameraPoint(camFocus, { width: viewWidth, height: viewHeight }, area);
    cutsceneZoom =
      area.id === "harness" || reducedMotion
        ? 1
        : Math.max(0.85, Math.min(1.35, camZoom));
  } else {
    camera = smoothFollowCamera(
      previousCamera,
      playerPos,
      state.facing,
      { width: viewWidth, height: viewHeight },
      area,
      { x: 80, y: 60 },
      snapCamera,
    );
  }
  const letterboxX = (width - viewWidth * scale) / 2;
  const letterboxY = (height - viewHeight * scale) / 2;
  const offsetX = Math.round((letterboxX - camera.x * scale) * resolution) / resolution;
  const offsetY = Math.round((letterboxY - camera.y * scale) * resolution) / resolution;
  const doorZoom =
    area.id === "harness" || reducedMotion
      ? 1
      : transitionZoom(state.transition, doorFadeTicks);
  const zoom = doorZoom * cutsceneZoom;
  const zoomScale = scale * zoom;
  const centerX = width / 2;
  const centerY = height / 2;
  const zoomOffsetX = zoom === 1 ? offsetX : centerX + (offsetX - centerX) * zoom;
  const zoomOffsetY = zoom === 1 ? offsetY : centerY + (offsetY - centerY) * zoom;
  return { canInterpolate, alpha, playerPos, camera, zoomScale, zoomOffsetX, zoomOffsetY };
}

/** True when no modal overlay, battle, minigame, or door fade obscures free walking. */
export function isOverworldClear(
  state: Pick<
    State,
    "battle" | "arcade" | "dialogue" | "transition" | "journalOpen" | "finale" | "cutscene"
  >,
): boolean {
  return (
    state.battle === null &&
    state.arcade === null &&
    state.dialogue === null &&
    state.transition === null &&
    !state.journalOpen &&
    state.finale === null &&
    state.cutscene === undefined
  );
}

/** Evaluates whether a companion pet reaction stays active for the current frame. */
export function resolveActivePetReaction(
  reaction: { id: string; startTick: number } | null,
  state: State,
): { id: string; elapsed: number } | null {
  if (reaction === null) return null;
  const elapsed = state.tick - reaction.startTick;
  if (!isOverworldClear(state) || elapsed < 0 || elapsed >= PET_REACTION_DURATION) {
    return null;
  }
  return { id: reaction.id, elapsed };
}

/** Evaluates whether Fae's current resting spot stays active for the current frame. */
export function resolveActiveRestSpot(
  resting: { spot: RestSpot; startTick: number } | null,
  state: State,
): { spot: RestSpot; elapsed: number } | null {
  if (resting === null) return null;
  const elapsed = state.tick - resting.startTick;
  if (
    !isOverworldClear(state) ||
    state.motion.moving ||
    state.area !== resting.spot.area ||
    elapsed < 0
  ) {
    return null;
  }
  return { spot: resting.spot, elapsed };
}

/** Computes texture URLs and entity aliases to unload outside the current + previous window. */
export function computeAreaEvictions(params: {
  residentUrls: readonly string[];
  previousUrls: readonly string[];
  nextUrls: readonly string[];
  residentEntityAliases: readonly string[];
  previousEntities: readonly string[];
  nextEntities: readonly string[];
  permanentAliases: ReadonlySet<string>;
}): { evictedUrls: string[]; unloadKeys: string[] } {
  const prevUrlSet = new Set(params.previousUrls);
  const evictedUrls = params.residentUrls.filter(
    (url) => !params.nextUrls.includes(url) && !prevUrlSet.has(url),
  );
  const keepEntities = new Set([...params.previousEntities, ...params.nextEntities]);
  const entityEvictions = params.residentEntityAliases.filter(
    (alias) => !keepEntities.has(alias) && !params.permanentAliases.has(alias),
  );
  return { evictedUrls, unloadKeys: [...evictedUrls, ...entityEvictions] };
}

/** Evaluates story-reactive biome atmosphere options for the current area and Ink flags. */
export function computeStoryAtmosphereOptions(
  world: Pick<World, "storyVariable">,
  state: Pick<State, "ink" | "critters" | "stickers">,
  areaId: string,
  reducedMotion = false,
): AtmosphereOptions | undefined {
  const flag = (name: string): boolean => world.storyVariable(state.ink, name) === true;
  const busterReward = flag("buster_reward");
  const clubhouseBloom =
    areaId === "clubhouse" && (flag("garden_sprouted") || flag("garden_ripe"));
  const cafeCinnamonSteam =
    areaId === "cafe" &&
    flag("spice_returned") &&
    (busterReward ||
      state.critters["taco-chef"] === "calm" ||
      state.stickers.includes("taco-chef"));
  const plazaStarGlow = areaId === "plaza" && busterReward;
  const passHearthWisps = areaId === "pass" && flag("sanctuary_gift");
  const sanctuaryFestival = areaId === "sanctuary" && flag("milo_revealed");
  const sunberryHarvests = world.storyVariable(state.ink, "sunberry_harvests");
  const sunberryCount =
    typeof sunberryHarvests === "number"
      ? sunberryHarvests
      : typeof sunberryHarvests === "string"
        ? Number(sunberryHarvests)
        : 0;
  const marketOrchardGlow =
    areaId === "market" &&
    flag("market_note_read") &&
    Number.isFinite(sunberryCount) &&
    sunberryCount > 0;
  const parlorSundaeSparkle = areaId === "parlor" && flag("parlor_note_read") && busterReward;
  const cavernChimeShimmer = areaId === "cavern" && flag("cavern_chime_rung") && busterReward;
  const musicRoomHarmony = areaId === "music" && flag("has_flute") && busterReward;
  const artRoomPaletteGlow = areaId === "art-room" && flag("art_open") && busterReward;
  const options: AtmosphereOptions = {
    ...(clubhouseBloom ? { clubhouseBloom: true } : {}),
    ...(cafeCinnamonSteam ? { cafeCinnamonSteam: true } : {}),
    ...(plazaStarGlow ? { plazaStarGlow: true } : {}),
    ...(passHearthWisps ? { passHearthWisps: true } : {}),
    ...(marketOrchardGlow ? { marketOrchardGlow: true } : {}),
    ...(parlorSundaeSparkle ? { parlorSundaeSparkle: true } : {}),
    ...(cavernChimeShimmer ? { cavernChimeShimmer: true } : {}),
    ...(musicRoomHarmony ? { musicRoomHarmony: true } : {}),
    ...(artRoomPaletteGlow ? { artRoomPaletteGlow: true } : {}),
    ...(sanctuaryFestival ? { sanctuaryFestival: true } : {}),
    ...(reducedMotion ? { reducedMotion: true } : {}),
  };
  return Object.keys(options).length === 0 ? undefined : options;
}

/** Projects the active overworld interaction prompt into CSS screen coordinates. */
export function computePromptScreenView(
  world: World, state: State, camera: Point | undefined,
  viewWidth: number, viewHeight: number, canvasWidth: number, canvasHeight: number,
): PromptScreenView {
  if (camera === undefined) return { visible: false, label: "", x: 0, y: 0 };
  const project = (worldPoint: Point): Point =>
    worldToScreen(worldPoint, camera, viewWidth, viewHeight, canvasWidth, canvasHeight);
  const interactable = targetInteractable(world, state);
  const target = interactable ?? targetPuzzleAction(world, state);
  if (target !== undefined) {
    const point = project(target.point);
    const isHeart = target.prompt === "Heart";
    return {
      visible: true,
      label: isHeart ? "♥ HEART" : (target.prompt ?? "Look").toUpperCase(),
      x: point.x, y: point.y,
      ...(isHeart ? { tone: "heart" } : {}),
    };
  }
  if (
    !isOverworldClear(state) ||
    findPettableCompanion(world, state) !== null ||
    findRestSpot(world, state) !== null
  ) {
    return { visible: false, label: "", x: 0, y: 0 };
  }
  const skipSpot = findPebbleSkipSpot(world, state);
  if (skipSpot !== null) {
    const point = project({ x: skipSpot.x, y: skipSpot.y });
    return { visible: true, label: "SKIP", x: point.x, y: point.y };
  }
  return { visible: false, label: "", x: 0, y: 0 };
}

/** Projects the active ambient NPC chatter bubble into CSS px, or returns null when hidden. */
export function computeNpcChatterScreenAnchor(
  world: Pick<World, "party">,
  state: Pick<
    State,
    "battle" | "arcade" | "dialogue" | "journalOpen" | "transition" | "finale"
  >,
  chatter: NpcLifeSnapshot["chatter"],
  suppressNpcId: string | null,
  camera: Point | undefined,
  viewWidth: number,
  viewHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom = 1,
): NpcChatterView | null {
  if (
    chatter === null ||
    camera === undefined ||
    chatter.alpha <= 0.01 ||
    chatter.npcId === suppressNpcId ||
    state.battle !== null ||
    state.arcade !== null ||
    state.dialogue !== null ||
    state.journalOpen ||
    state.transition !== null ||
    state.finale === "credits"
  ) {
    return null;
  }
  const partyMember = world.party[chatter.npcId];
  const headOffset =
    partyMember !== undefined
      ? partyMember.box.height + 18
      : chatter.adult
        ? 190
        : 158;
  const point = worldToScreen(
    { x: chatter.x, y: chatter.y - headOffset },
    camera,
    viewWidth,
    viewHeight,
    canvasWidth,
    canvasHeight,
    zoom,
  );
  return {
    visible: true,
    npcId: chatter.npcId,
    speakerName: chatter.speakerName,
    text: chatter.text,
    tone: chatter.tone,
    x: point.x,
    y: point.y,
    alpha: chatter.alpha,
  };
}

/** Projects recurring critters' "?" and "!" notice marks into CSS screen coordinates. */
export function computeNoticeMarkViews(
  world: World,
  state: State,
  camera: Point | undefined,
  viewWidth: number,
  viewHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): NoticeMarkView[] {
  if (
    camera === undefined ||
    state.battle !== null ||
    state.dialogue !== null ||
    state.arcade !== null ||
    state.journalOpen ||
    state.transition !== null
  ) {
    return [];
  }
  return wildMarks(world, state).flatMap((item) => {
    const kind = world.critters[item.kind];
    if (kind === undefined) return [];
    const head = { x: item.point.x, y: item.point.y - kind.overworldHeight - 6 };
    const point = worldToScreen(head, camera, viewWidth, viewHeight, canvasWidth, canvasHeight);
    return [{ key: item.key, mark: item.mark, x: point.x, y: point.y }];
  });
}

export type LanternVisualFrame = {
  on: boolean;
  blend: number;
  showDusk: boolean;
  tintAlpha: number;
  centerX: number;
  centerY: number;
  spotlightAlpha: number;
};

/** Evaluates blacklight lantern dusk blend, spotlight center, and alpha for the current frame. */
export function computeLanternVisuals(
  state: Pick<State, "lantern" | "battle" | "arcade" | "tick">,
  playerPos: Point,
  previousBlend: number,
  previousTick: number | undefined,
  snapLantern: boolean,
  reducedMotion: boolean,
): LanternVisualFrame {
  const on = state.lantern && state.battle === null && state.arcade === null;
  const blend = computeLanternBlend(previousBlend, previousTick, state.tick, on, snapLantern);
  const showDusk = blend > 0.001 && state.battle === null && state.arcade === null;
  const pulse = reducedMotion ? 0.36 : 0.36 + 0.04 * Math.sin(state.tick / 16);
  return {
    on,
    blend,
    showDusk,
    tintAlpha: 0.63 * blend,
    centerX: playerPos.x,
    centerY: playerPos.y - 46,
    spotlightAlpha: pulse * blend,
  };
}

/** Projects the active dialogue slice into `GameViewRenderInfo["dialogue"]`. */
export function computeDialogueRenderInfo(
  state: Pick<State, "dialogue">,
): GameViewRenderInfo["dialogue"] {
  return {
    open: state.dialogue !== null,
    speaker: state.dialogue?.speaker ?? null,
    revealed: state.dialogue?.revealed ?? 0,
    length: state.dialogue?.text.length ?? 0,
    choices: state.dialogue?.choices ?? [],
    selected: state.dialogue?.selected ?? 0,
  };
}
