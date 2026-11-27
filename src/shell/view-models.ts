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
  type BattleView,
  type Point,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import type { AudioLevel } from "../platform/audio-settings";
import type { MinigameRecords } from "../platform/minigame-records";
import { findPettableCompanion, findRestSpot } from "../render/companions";
import type { BattleCheckGeometry } from "../render/view";
import type { AtlasFrame, AtlasImage } from "../ui/atlas";
import {
  battleCommandPreview,
  battlePeekData,
  battleTalkDialogueView,
  talkChoicesShown,
  type BattleCheckView as BattleCheckOverlayView,
  type BattleHudView,
} from "../ui/battle";
import { evaluateBattlePortraits } from "../ui/battle-portraits";
import type { CreditsView } from "../ui/credits";
import {
  resolveHudInteractHint,
  type HudHintsView,
  type HudInputMode,
} from "../ui/hud-hints";
import type { JournalInputMode, JournalView, JukeboxMeta } from "../ui/journal";
import { speakerAccent } from "../ui/portraits";
import type { DialogueView } from "../ui/sticker";

export type StickerPrizeArt = {
  stickerArt: (critterId: string, frameName: string) => AtlasImage | null;
  prizeArt: (frameName: string) => AtlasImage | null;
};

export type JournalArt = StickerPrizeArt & {
  fishArt: (frameName: string) => AtlasImage | null;
};

export type AtlasFrameResolver = {
  atlasFrame: (file: string, frameName: string) => AtlasImage | null;
};

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
  art: StickerPrizeArt,
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
  art: JournalArt;
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
  canPhoto?: boolean;
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
    ...(params.canPhoto === undefined ? {} : { canPhoto: params.canPhoto }),
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
  inputMode?: HudInputMode;
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
          fluteUsed: state.battle.fluteUsed === true,
          lassoUsed: state.battle.lassoUsed === true,
          lanternPeek: state.battle.lanternPeek === true,
          togetherActive:
            state.battle.command === "together" &&
            state.battle.phase === "check" &&
            state.battle.check?.side === "critter",
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
    inputMode: params.inputMode,
  };
}

/** Projects the credits finale state and cropped character frames onto CreditsView. */
export function buildCreditsView(
  world: World,
  state: State,
  art: AtlasFrameResolver,
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
