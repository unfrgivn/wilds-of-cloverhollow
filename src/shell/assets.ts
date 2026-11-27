import { Assets, type Spritesheet } from "pixi.js";
import {
  battleParty,
  carriedTreats,
  creditEntries,
  creditsSummary,
  critterFieldNote,
  journalFish,
  journalKeepsakes,
  journalProgress,
  landFieldGuide,
  landStickerProgress,
  levelForXp,
  mapBusRoutes,
  mapLandName,
  starGemsFound,
  statsForCommand,
  targetInteractable,
  treasuresSummary,
  valleyCompletion,
  type ArcadeView,
  type Area,
  type BattleView,
  type ClawView,
  type CometView,
  type CookView,
  type FishView,
  type MoleHole,
  type MoleView,
  type Point,
  type SkeeView,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import type { AudioLevel } from "../platform/audio-settings";
import type { MinigameRecords } from "../platform/minigame-records";
import type { CreditsView } from "../ui/credits";
import type { JournalInputMode, JournalView, JukeboxMeta } from "../ui/journal";
import { findPettableCompanion, findRestSpot } from "../render/companions";
import { evaluateBattlePortraits } from "../ui/battle-portraits";
import {
  resolveHudInteractHint,
  type HudHintsView,
  type HudInputMode,
} from "../ui/hud-hints";
import {
  parseClawCalibration,
  parseCometCalibration,
  parseCookCalibration,
  parseFishCalibration,
  parseMapCentres,
  parseMoleCalibration,
  parseSkeeCalibration,
} from "../content/load";
import { assetUrl } from "../platform/assets";
import type { BattleCheckGeometry } from "../render/view";
import type { ArcadeInfo } from "../ui/arcade";
import type { ArcadeRecordBadge } from "../ui/arcade-popups";
import {
  atlasImage,
  atlasImagePath,
  parseAtlasJson,
  type AtlasFrame,
  type AtlasImage,
  type AtlasJson,
} from "../ui/atlas";
import {
  battleCommandPreview,
  battlePeekData,
  battleTalkDialogueView,
  talkChoicesShown,
  type BattleCheckView as BattleCheckOverlayView,
  type BattleHudView,
} from "../ui/battle";
import { createClaw, type ClawInfo } from "../ui/claw";
import { createComet, type CometInfo } from "../ui/comet";
import { createCook, type CookInfo } from "../ui/cook";
import { createFish, type FishInfo } from "../ui/fish";
import { createMole, type MoleInfo } from "../ui/mole";
import { cropPortraitFrame, speakerAccent, speakerPortraitSource } from "../ui/portraits";
import { createSkee, type SkeeInfo } from "../ui/skee";
import type { DialogueView } from "../ui/sticker";

export const MOLE_ATLAS = "assets/arcade/moles.json";
export const FOOD_ATLAS = "assets/arcade/cook-food.json";
export const FISH_ATLAS = "assets/arcade/fish-catches.json";
export const COMET_ATLAS = "assets/arcade/comet.json";
export const FAE_ATLAS = "assets/characters/fae/fae.json";

/**
 * Tightly crops small animal party frames (`<= 280x280`, where the figure sits in the lower half)
 * so they fill Credits cards at the same scale as larger character and critter frames.
 */
export function cropCreditFrame(frame: AtlasFrame): AtlasFrame {
  if (frame.w > 280 || frame.h > 280) return frame;
  const w = Math.max(1, Math.min(frame.w, Math.round(frame.w * 0.64)));
  const h = Math.max(1, Math.min(frame.h, Math.round(frame.h * 0.58)));
  const x = Math.max(
    frame.x,
    Math.min(frame.x + frame.w - w, Math.round(frame.x + frame.w * 0.18)),
  );
  const y = Math.max(
    frame.y,
    Math.min(frame.y + frame.h - h, Math.round(frame.y + frame.h * 0.4)),
  );
  return { x, y, w, h };
}

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
  area: Pick<Area, "critters" | "recurring" | "npcs">,
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

/** Projects core battle check state + canvas geometry onto the DOM battle check overlay view. */
export function battleCheckOverlay(
  battle: BattleView | null,
  geometry: BattleCheckGeometry | null,
  resolveToy: (frameName: string) => AtlasImage | null,
): BattleCheckOverlayView | null {
  const check = battle?.check ?? null;
  if (battle === null || check === null || geometry === null) return null;
  const shared = { grade: battle.lastGrade, hint: battle.hint };
  if (check.kind === "ring" && geometry.kind === "ring")
    return { ...geometry, ...shared, progress: check.progress, target: check.target };
  if (check.kind === "charge" && geometry.kind === "charge")
    return { ...geometry, ...shared, fill: check.fill, great: check.great, good: check.good };
  if (check.kind === "chain" && geometry.kind === "chain")
    return { ...geometry, ...shared, beats: check.beats, look: check.look };
  if (check.kind === "catch" && geometry.kind === "catch") {
    return {
      ...geometry,
      ...shared,
      catcher: check.catcher,
      toys: check.toys.map((toy) => {
        const image = resolveToy(toy.frame);
        return {
          ...toy,
          image,
          width: (image?.frame.w ?? 0) * geometry.toyScale,
          height: (image?.frame.h ?? 0) * geometry.toyScale,
        };
      }),
    };
  }
  if (check.kind === "lean" && geometry.kind === "lean")
    return { ...geometry, ...shared, balance: check.balance, puffs: check.puffs };
  if (check.kind === "trace" && geometry.kind === "trace") {
    return {
      ...geometry,
      ...shared,
      brush: check.brush,
      points: check.path.points,
      checkpoint: check.checkpoint,
      results: check.results,
      dry: check.dry,
    };
  }
  if (check.kind === "peekaboo" && geometry.kind === "peekaboo") {
    return {
      ...geometry,
      ...shared,
      progress: check.progress,
      status: check.status,
      peeks: check.peeks,
    };
  }
  if (check.kind === "echo" && geometry.kind === "echo") {
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
  }
  return null;
}

export type RewardStickerView = {
  visible: boolean;
  title: string;
  name: string;
  image: AtlasImage | null;
};

/** Projects battle reward sticker or claw prize onto the shared reward card. */
export function buildRewardStickerView(
  world: Pick<World, "critters">,
  state: Pick<State, "battle">,
  activeBattle: boolean,
  arcadeState: ArcadeView | null,
  art: Pick<ShellAssets, "stickerArt" | "prizeArt">,
): RewardStickerView {
  const rewardCritter =
    state.battle === null ? undefined : world.critters[state.battle.critterId];
  const battleReward =
    activeBattle && state.battle?.phase === "reward" && state.battle.rewardSticker !== null;
  const arcadePrize = battleReward || arcadeState?.game !== "claw" ? null : arcadeState.prize;
  if (battleReward) {
    return {
      visible: true,
      title: "NEW STICKER!",
      name: rewardCritter?.sticker.name ?? "",
      image:
        rewardCritter === undefined
          ? null
          : art.stickerArt(rewardCritter.id, rewardCritter.sticker.frame),
    };
  }
  if (arcadePrize !== null) {
    return {
      visible: true,
      title: arcadePrize.title,
      name: arcadePrize.name,
      image: art.prizeArt(arcadePrize.frame),
    };
  }
  return { visible: false, title: "", name: "", image: null };
}

export type JournalViewParams = {
  world: World;
  state: State;
  notes: string[];
  mapCentres: Record<string, Point>;
  art: Pick<ShellAssets, "stickerArt" | "prizeArt" | "fishArt">;
  muted: boolean;
  level: AudioLevel;
  musicMuted: boolean;
  musicLevel: AudioLevel;
  ambienceMuted: boolean;
  nowPlaying: string;
  jukebox?: JukeboxMeta;
  arcadeRecords?: MinigameRecords;
  gentleTiming: boolean;
  keyHints: boolean;
  textSpeed: TextSpeed;
  reducedMotion: boolean;
  hasLantern: boolean;
  hasFlute: boolean;
  hasLasso: boolean;
  inputMode?: JournalInputMode;
};

/** Builds the complete DOM JournalView from core state, map centres, and atlas resolvers. */
export function buildJournalView(params: JournalViewParams): JournalView {
  const { world, state, mapCentres, art } = params;
  const open = state.journalOpen;
  const isStorySet = (variable: string): boolean =>
    world.storyVariable(state.ink, variable) === true;
  const currentLand = world.areas[state.area]?.land ?? null;
  const faeLevel = levelForXp(world.levels, state.xp);
  return {
    visible: open,
    notes: open ? params.notes : [],
    treats: open ? carriedTreats(world, state) : [],
    stickers: open
      ? Array.from({ length: world.stickers.slots }, (_, index) => {
          const sticker = world.stickers.catalogue[index];
          if (sticker === undefined) {
            return { id: `empty-${index}`, name: "", owned: false, image: null };
          }
          const owned = state.stickers.includes(sticker.id);
          return {
            id: sticker.id,
            name: sticker.name,
            owned,
            image: owned ? art.stickerArt(sticker.critter, sticker.frame) : null,
            fieldNote: owned ? critterFieldNote(world, state, sticker.id) : null,
          };
        })
      : [],
    prizes: open
      ? world.arcade.prizes.map((prize) => {
          const owned = state.prizes.includes(prize.id);
          return {
            id: prize.id,
            name: prize.name,
            owned,
            image: owned ? art.prizeArt(prize.frame) : null,
          };
        })
      : [],
    arcadeRecords: open ? params.arcadeRecords : undefined,
    fish: open
      ? journalFish(world, state).map((item) => ({
          id: item.id,
          name: item.name,
          owned: item.owned,
          rare: item.rare,
          coins: item.coins,
          snacks: item.snacks,
          blurb: item.blurb,
          image: item.owned ? art.fishArt(item.frame) : null,
        }))
      : [],
    keepsakes: open ? journalKeepsakes(world, state) : [],
    lands: open
      ? world.lands.map((land) => ({
          ...land,
          name: mapLandName(land, currentLand, isStorySet),
          ...(mapCentres[land.id] ?? { x: 0, y: 0 }),
        }))
      : [],
    currentLand,
    landProgress: open ? landStickerProgress(world, state) : {},
    landGuides: open
      ? Object.fromEntries(
          world.lands.map((land) => [land.id, landFieldGuide(world, state, land.id)]),
        )
      : {},
    busRoutes: open
      ? mapBusRoutes(world.lands, isStorySet, (id) => state.stickers.includes(id))
      : [],
    stickersOwned: state.stickers.length,
    stickersTotal: world.stickers.catalogue.length,
    prizesOwned: state.prizes.length,
    prizesTotal: world.arcade.prizes.length,
    coins: state.coins,
    snacks: state.snacks,
    tickets: state.tickets,
    gems: open ? starGemsFound(world, state) : undefined,
    valleyComplete: open ? valleyCompletion(journalProgress(world, state)).complete : false,
    muted: params.muted,
    level: params.level,
    musicMuted: params.musicMuted,
    musicLevel: params.musicLevel,
    ambienceMuted: params.ambienceMuted,
    nowPlaying: params.nowPlaying,
    jukebox: params.jukebox,
    gentleTiming: params.gentleTiming,
    keyHints: params.keyHints,
    textSpeed: params.textSpeed,
    reducedMotion: params.reducedMotion,
    treasures: open ? treasuresSummary(world, state) : undefined,
    hasLantern: params.hasLantern,
    hasFlute: params.hasFlute,
    hasLasso: params.hasLasso,
    inputMode: params.inputMode,
    members: open
      ? [
          {
            id: "fae",
            name: "Fae",
            level: faeLevel,
            xp: state.xp,
            startXp: world.levels.thresholds[faeLevel - 1] ?? 0,
            nextXp: world.levels.thresholds[faeLevel] ?? state.xp,
            stats: statsForCommand(world.levels, "soothe", faeLevel),
            friend: false,
          },
          ...state.party.map((member) => {
            const party = world.party[member.id];
            const level = levelForXp(world.levels, member.xp);
            return {
              id: member.id,
              name: party?.name ?? member.id,
              level,
              xp: member.xp,
              startXp: world.levels.thresholds[level - 1] ?? 0,
              nextXp: world.levels.thresholds[level] ?? member.xp,
              stats: statsForCommand(world.levels, party?.command?.id ?? "soothe", level),
              friend: true,
            };
          }),
        ]
      : [],
  };
}

export type DialogueViewParams = {
  world: Pick<World, "battle">;
  state: Pick<State, "battle" | "dialogue">;
  battle: BattleView | null;
  arcadeState: ArcadeView | null;
  levelUpNotice: string | null;
  speakerPortrait: (speaker: string | null) => AtlasImage | null;
};

/** Projects active level-up, battle, arcade result, or overworld talk onto DialogueView. */
export function buildDialogueView(params: DialogueViewParams): DialogueView | null {
  const { world, state, battle, arcadeState, levelUpNotice, speakerPortrait } = params;
  const activeBattle = battle !== null;
  if (levelUpNotice !== null) {
    return {
      speaker: null,
      text: levelUpNotice,
      revealed: levelUpNotice.length,
      choices: [],
      selected: -1,
      canAdvance: true,
    };
  }
  if (activeBattle && battle.talk !== null) {
    const talkView = battleTalkDialogueView(battle.talk);
    return {
      ...talkView,
      portrait: speakerPortrait(talkView.speaker),
      accent: speakerAccent(talkView.speaker),
    };
  }
  if (activeBattle && battle.message !== "") {
    const activeCmd =
      state.battle?.phase === "command" &&
      battle.talk === null &&
      !state.battle.treatMenu &&
      battle.treatTray === null
        ? (battle.commands[battle.selected] ?? null)
        : null;
    const feelingLabel =
      activeCmd?.feeling !== null && activeCmd?.feeling !== undefined
        ? (world.battle.feelings[activeCmd.feeling]?.label ?? null)
        : null;
    const commandSubtitle =
      activeCmd !== null &&
      !battle.message.startsWith("Fae plays her flute!") &&
      !battle.message.startsWith("Fae twirls her rainbow lasso")
        ? battleCommandPreview(activeCmd, battle.critterName, feelingLabel)
        : null;
    return {
      speaker: null,
      text: battle.message,
      subtitle: commandSubtitle,
      revealed: battle.revealed,
      choices: [],
      selected: -1,
      canAdvance: state.battle?.phase !== "command" && battle.revealed >= battle.message.length,
    };
  }
  if (activeBattle) return null;
  if (arcadeState !== null && arcadeState.phase === "result") {
    return {
      speaker: null,
      text: arcadeState.message,
      revealed: arcadeState.revealed,
      choices: [],
      selected: -1,
      canAdvance: arcadeState.revealed >= arcadeState.message.length,
    };
  }
  if (arcadeState !== null || state.dialogue === null) return null;
  return {
    speaker: state.dialogue.speaker,
    text: state.dialogue.text,
    revealed: state.dialogue.revealed,
    choices:
      state.dialogue.revealed >= state.dialogue.text.length
        ? state.dialogue.choices.map((text) => ({ text }))
        : [],
    selected: state.dialogue.selected,
    canAdvance: state.dialogue.choices.length === 0,
    portrait: speakerPortrait(state.dialogue.speaker),
    accent: speakerAccent(state.dialogue.speaker),
  };
}

export type HudHintsViewParams = {
  world: World;
  state: State;
  keyHints: boolean;
  touchActive: boolean;
  overworldFree: boolean;
  isResting: boolean;
  hasLantern: boolean;
  hasFlute: boolean;
  muted: boolean;
  canPhoto: boolean;
  canBattlePeek: boolean;
  inputMode: HudInputMode;
};

/** Projects overworld context and battle Field Guide state onto HudHintsView. */
export function buildHudHintsView(params: HudHintsViewParams): HudHintsView {
  const { world, state, overworldFree, isResting } = params;
  const interactTarget = overworldFree ? targetInteractable(world, state) : undefined;
  const interactHint = overworldFree
    ? resolveHudInteractHint({
        hasInteractable: interactTarget !== undefined,
        interactPrompt: interactTarget?.prompt,
        isResting,
        player: state.player,
        facing: state.facing,
        pettableCompanion:
          interactTarget === undefined && !isResting ? findPettableCompanion(world, state) : null,
        hasRestSpot:
          interactTarget === undefined && !isResting && findRestSpot(world, state) !== null,
      })
    : { canInteract: false, interactLabel: "Talk" };
  const battlePeekHint =
    params.keyHints &&
    !params.touchActive &&
    params.canBattlePeek &&
    !(state.battle?.treatMenu ?? false);
  return {
    visible: params.keyHints && !params.touchActive && overworldFree,
    canInteract: interactHint.canInteract,
    interactLabel: interactHint.interactLabel,
    hasLantern: params.hasLantern,
    lanternOn: state.lantern,
    hasFlute: params.hasFlute,
    muted: params.muted,
    canPhoto: params.canPhoto,
    battlePeekHint,
    inputMode: params.inputMode,
  };
}

export type BattleHudViewParams = {
  world: World;
  state: State;
  battle: BattleView | null;
  partyCommands: Record<string, string | null>;
  paused: boolean;
  canPeek: boolean;
  peekOpen: boolean;
  speakerPortrait: (speaker: string | null) => AtlasImage | null;
};

/** Projects core battle state, party portraits, and Field Guide peek onto BattleHudView. */
export function buildBattleHudView(params: BattleHudViewParams): BattleHudView {
  const { world, state, battle, partyCommands, paused, canPeek, peekOpen, speakerPortrait } =
    params;
  const activeBattle = battle !== null;
  const hideActions =
    state.battle?.phase === "check" || state.battle?.phase === "burstResult";
  const showBattleHud =
    activeBattle && state.battle?.phase !== "reward" && !talkChoicesShown(battle?.talk ?? null);
  const portraits =
    showBattleHud && state.battle !== null
      ? evaluateBattlePortraits({
          battle: state.battle,
          view: battle,
          partyIds: battleParty(world, state.party).map((member) => member.id),
          partyCommands,
          energy: battle?.energy ?? state.battle.energy,
          resolveImage: speakerPortrait,
        })
      : [];
  const poppedCount = battle?.windUp?.bubbles.filter((item) => item.popped).length ?? 0;
  const popupSnapshot =
    activeBattle && state.battle !== null && state.battle.phase !== "reward" && battle !== null
      ? {
          battleKey: state.battle.critterId,
          calm: battle.calm,
          energy: battle.energy,
          poppedCount,
          message: battle.message,
          tick: state.tick,
          paused,
        }
      : null;
  const critter = world.critters[state.battle?.critterId ?? ""];
  return {
    visible: showBattleHud,
    energy: battle?.energy ?? 0,
    energyMax: battle?.energyMax ?? 0,
    level: levelForXp(world.levels, state.xp),
    calm: battle === null ? 0 : battle.calm / Math.max(1, battle.calmMax),
    critterName: activeBattle ? `Lv ${critter?.level ?? 1} · ${critter?.name ?? ""}` : "",
    sparkle: hideActions ? null : (battle?.sparkle ?? null),
    fluteAssist: hideActions ? null : (battle?.fluteAssist ?? null),
    burstSoften: hideActions ? 0 : (battle?.burstSoften ?? 0),
    lassoAssist: hideActions ? null : (battle?.lassoAssist ?? null),
    lassoSteady: hideActions ? false : (battle?.lassoSteady ?? false),
    portraits,
    popupSnapshot,
    canPeek,
    peekOpen,
    peek: peekOpen ? battlePeekData(world, state) : null,
  };
}

/** Projects the credits finale state and cropped character frames onto CreditsView. */
export function buildCreditsView(
  world: World,
  state: State,
  art: Pick<ShellAssets, "atlasFrame">,
): CreditsView {
  const visible = state.finale === "credits";
  return {
    visible,
    entries: visible
      ? creditEntries(world, state).map((entry) => {
          const image = art.atlasFrame(entry.image.atlas, entry.image.frame);
          return {
            ...entry,
            image: image === null ? null : { ...image, frame: cropCreditFrame(image.frame) },
          };
        })
      : [],
    summary: visible ? creditsSummary(world, state) : [],
  };
}

type Overlay<V, I> = {
  render: (view: V | null) => void;
  info: () => I | null;
};

type RecordOverlay<V, I> = {
  render: (view: V | null, record?: ArcadeRecordBadge | null) => void;
  info: () => I | null;
};

export type ShellAssetsOptions = {
  world: World;
  uiRoot: HTMLElement;
  invalidate: () => void;
  onHole: (hole: MoleHole, down: boolean) => void;
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
  speakerPortrait: (speaker: string | null) => AtlasImage | null;
  fishArt: (frameName: string) => AtlasImage | null;
  toyArt: (frameName: string) => AtlasImage | null;
  seedCoreSheets: () => void;
  cacheAreaNpcPortraits: (area: Area) => void;
  preloadCoreAtlasMeta: () => Promise<void>;
  ensureClawOverlay: () => Promise<void>;
  ensureSkeeOverlay: () => Promise<void>;
  ensureMoleOverlay: () => Promise<void>;
  ensureCometOverlay: () => Promise<void>;
  ensureArcadeOverlay: () => Promise<void>;
  ensureCookOverlay: () => Promise<void>;
  ensureFishOverlay: () => Promise<void>;
  warmAreaOverlays: (areaId: string) => Promise<void>;
  warmAreaMedia: (area: Area) => Promise<void>;
  warmJournalAssets: (snapshot: State) => Promise<void>;
  warmBattlePortraits: (snapshot: State) => Promise<void>;
  renderOverlays: (arcadeState: ArcadeView | null, record?: ArcadeRecordBadge | null) => void;
  overlayInfo: () => ArcadeInfo | null;
};

/**
 * Owns lazy DOM atlas metadata caching, single-decode image warming, frame crop
 * resolvers, and per-area close-up overlays so `src/main.ts` stays focused on
 * composition and lifecycle.
 */
export function createShellAssets(options: ShellAssetsOptions): ShellAssets {
  const { world, uiRoot, invalidate, onHole } = options;

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

  const speakerPortrait = (speaker: string | null): AtlasImage | null => {
    const source = speakerPortraitSource(world, speaker);
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

  const seedCoreSheets = (): void => {
    const faeSheet = Assets.get<Spritesheet | undefined>("fae-sheet");
    if (faeSheet !== undefined) atlasJsonCache.set(FAE_ATLAS, faeSheet.data);
    for (const [id, member] of Object.entries(world.party)) {
      const sheet = Assets.get<Spritesheet | undefined>(`${id}-sheet`);
      if (sheet !== undefined) atlasJsonCache.set(member.atlas, sheet.data);
    }
  };

  const cacheAreaNpcPortraits = (area: Area): void => {
    for (const npc of area.npcs) {
      const character = world.characters[npc.id];
      if (character === undefined || atlasJsonCache.has(character.atlas)) continue;
      const sheet = Assets.get<Spritesheet | undefined>(`${npc.id}-sheet`);
      if (sheet !== undefined) atlasJsonCache.set(character.atlas, sheet.data);
    }
  };

  const preloadCoreAtlasMeta = async (): Promise<void> => {
    const critterJsonFiles = [
      ...new Set(Object.values(world.critters).map((critter) => critter.atlas)),
    ];
    await Promise.all([
      ensureAtlasMeta(world.arcade.atlas),
      ...critterJsonFiles.map((file) => ensureAtlasMeta(file)),
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
      clawOverlay = createClaw(uiRoot, prizeArt, clawPainting.calibration, clawPainting.image);
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
        skeeOverlay = createSkee(uiRoot, skeePainting.calibration, skeePainting.image);
      },
    );
    return skeeLoad;
  };

  let moleOverlay: RecordOverlay<MoleView, MoleInfo> | null = null;
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
      );
    });
    return cookLoad;
  };

  let fishOverlay: RecordOverlay<FishView, FishInfo> | null = null;
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
      );
    });
    return fishLoad;
  };

  const warmAreaOverlays = (areaId: string): Promise<void> => {
    if (areaId === "arcade") return ensureArcadeOverlay();
    if (areaId === "clubhouse") return ensureCookOverlay();
    if (areaId === "bay") return ensureFishOverlay();
    return Promise.resolve();
  };

  const warmAreaMedia = async (area: Area): Promise<void> => {
    const loads: Promise<unknown>[] = [warmAreaOverlays(area.id)];
    for (const atlas of areaMediaAtlases(world, area)) {
      loads.push(decodeAtlasImage(atlas));
    }
    await Promise.all(loads);
  };

  const warmJournalAssets = async (snapshot: State): Promise<void> => {
    await Promise.all(ownedJournalAtlases(world, snapshot).map((atlas) => decodeAtlasImage(atlas)));
  };

  const warmBattlePortraits = async (snapshot: State): Promise<void> => {
    await Promise.all(
      battlePortraitAtlases(world, snapshot).map((atlas) => decodeAtlasImage(atlas)),
    );
  };

  const renderOverlays = (
    arcadeState: ArcadeView | null,
    record: ArcadeRecordBadge | null = null,
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
    }
    clawOverlay?.render(arcadeState?.game === "claw" ? arcadeState : null);
    skeeOverlay?.render(
      arcadeState?.game === "skee" ? arcadeState : null,
      arcadeState?.game === "skee" ? record : null,
    );
    moleOverlay?.render(
      arcadeState?.game === "mole" ? arcadeState : null,
      arcadeState?.game === "mole" ? record : null,
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
    );
  };

  const overlayInfo = (): ArcadeInfo | null =>
    clawOverlay?.info() ??
    skeeOverlay?.info() ??
    moleOverlay?.info() ??
    cometOverlay?.info() ??
    cookOverlay?.info() ??
    fishOverlay?.info() ??
    null;

  return {
    loadMapCentres,
    ensureAtlasMeta,
    hasAtlasMeta,
    domAtlas,
    decodeAtlasImage,
    atlasFrame,
    stickerArt,
    prizeArt,
    speakerPortrait,
    fishArt,
    toyArt,
    seedCoreSheets,
    cacheAreaNpcPortraits,
    preloadCoreAtlasMeta,
    ensureClawOverlay,
    ensureSkeeOverlay,
    ensureMoleOverlay,
    ensureCometOverlay,
    ensureArcadeOverlay,
    ensureCookOverlay,
    ensureFishOverlay,
    warmAreaOverlays,
    warmAreaMedia,
    warmJournalAssets,
    warmBattlePortraits,
    renderOverlays,
    overlayInfo,
  };
}
