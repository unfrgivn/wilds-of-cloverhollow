import {
  battleParty,
  carriedTreats,
  creditEntries,
  creditsSummary,
  critterFieldNote,
  heartToHeartSummary,
  journalFish,
  journalKeepsakes,
  journalProgress,
  journalStarGems,
  landAtlasSummaries,
  landFieldGuide,
  landStickerProgress,
  levelForXp,
  mapBusRoutes,
  mapLandName,
  starGemsFound,
  statsForCommand,
  storySoFar,
  targetInteractable,
  treasuresSummary,
  valleyCompletion,
  type ArcadeView,
  type BattleView,
  type HeartToHeartSummary,
  type Point,
  type State,
  type TextSpeed,
  type World,
} from "../core";
import { encoreJournalSummary, type JournalEncoreSummary } from "../core/encore";
import {
  countDecorCustomizations,
  countEncoreTrophies,
  countSolvedPuzzles,
  evaluateMeritRibbons,
} from "../core/ribbons";
import type { AudioLevel } from "../platform/audio-settings";
import type { MinigameRecords } from "../platform/minigame-records";
import { findPettableCompanion, findRestSpot } from "../render/companions";
import { findNearbySanctuaryCritter, findPebbleSkipSpot } from "../render/micro-delights";
import type { BattleCheckGeometry } from "../render/view";
import type { AtlasFrame, AtlasImage } from "../ui/atlas";
import {
  battleCommandPreview,
  battlePeekData,
  battleTalkDialogueView,
  talkChoicesShown,
  type BattleCheckView as BattleCheckOverlayView,
  type BattleFoePlateItem,
  type BattleHudView,
  type BattleIntentItem,
  type CommandMenuView,
} from "../ui/battle";
import { evaluateBattlePortraits } from "../ui/battle-portraits";
import { DEFAULT_ENDING_POSTCARD, type CreditsView } from "../ui/credits";
import {
  resolveHudInteractHint,
  type HudHintsView,
  type HudInputMode,
} from "../ui/hud-hints";
import type { JournalInputMode, JournalView, JukeboxMeta } from "../ui/journal";
import {
  resolveExpressionTag,
  speakerAccent,
  type PortraitExpression,
} from "../ui/portraits";
import type { DialogueView, SpeakerSide } from "../ui/sticker";

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

const BATTLE_ARROW_CHECKS = new Set([
  "catch", "lean", "echo", "which-one", "whack", "spin-snag",
]);

/** Returns true for battle check kinds that actively consume directional arrows. */
export function keepsBattleArrows(checkKind: string | undefined): boolean {
  return checkKind !== undefined && BATTLE_ARROW_CHECKS.has(checkKind);
}

/** Projects battle command list onto CommandMenuView with resolved Dual Combo art. */
export function buildCommandMenuView(
  state: Pick<State, "battle">,
  battle: BattleView | null,
  checkV2Art: (frameName: string) => AtlasImage | null,
): CommandMenuView {
  return {
    visible: battle !== null && state.battle?.phase === "command" && battle.talk === null,
    commands: (battle?.commands ?? []).map((cmd) => ({
      ...cmd,
      ...(cmd.combo === true && cmd.comboEmblem !== undefined
        ? { comboArt: checkV2Art(cmd.comboEmblem) }
        : {}),
    })),
    selected: battle?.selected ?? 0,
    activeActor: battle?.activeActor,
    treatTray: battle?.treatTray ?? null,
  };
}

/** Projects core battle check state + canvas geometry onto the DOM battle check overlay view. */
export function battleCheckOverlay(
  battle: BattleView | null,
  geometry: BattleCheckGeometry | null,
  resolveToy: (frameName: string) => AtlasImage | null,
  resolveCheckV2: (frameName: string) => AtlasImage | null = () => null,
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
  if (check.kind === "which-one" && geometry.kind === "which-one") {
    return {
      ...geometry,
      ...shared,
      phase: check.phase,
      hidingCup: check.hidingCup,
      cupSlots: check.cupSlots,
      activeSwap: check.activeSwap,
      cursor: check.cursor,
      picked: check.picked,
      targetSlot: check.targetSlot,
      time: check.time,
      revealProgress: check.revealProgress,
      cups: [
        resolveCheckV2("cup-mint"),
        resolveCheckV2("cup-butter"),
        resolveCheckV2("cup-sky"),
      ],
      star: resolveCheckV2("cup-star"),
    };
  }
  if (check.kind === "whack" && geometry.kind === "whack") {
    return {
      ...geometry,
      ...shared,
      activeSlot: check.activeSlot,
      activeIndex: check.activeIndex,
      activeProgress: check.activeProgress,
      results: check.results,
      lastSwing: check.lastSwing,
      art: {
        slot: resolveCheckV2("ticket-slot"),
        pop: resolveCheckV2("ticket-pop"),
        hit: resolveCheckV2("ticket-hit"),
      },
    };
  }
  if (check.kind === "spin-snag" && geometry.kind === "spin-snag") {
    return {
      ...geometry,
      ...shared,
      phase: check.phase,
      turns: check.turns,
      spinsNeeded: check.spinsNeeded,
      lastSector: check.lastSector,
      spinTime: check.spinTime,
      snagProgress: check.snagProgress,
      snagTarget: check.snagTarget,
      greatWindow: check.greatWindow,
      goodWindow: check.goodWindow,
      coil: resolveCheckV2("lasso-coil"),
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
export function buildJournalView(
  params: JournalViewParams,
): JournalView & {
  heartToHearts?: HeartToHeartSummary;
  encoreSummary?: JournalEncoreSummary;
  encoreTrophies?: number;
  decorCount?: number;
  puzzlesSolved?: number;
} {
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
      ? mapBusRoutes(world.lands, isStorySet)
      : [],
    storySoFar: open ? storySoFar(world, state) : undefined,
    atlasPins: open ? landAtlasSummaries(world, state) : [],
    stickersOwned: state.stickers.length,
    stickersTotal: world.stickers.catalogue.length,
    prizesOwned: state.prizes.length,
    prizesTotal: world.arcade.prizes.length,
    coins: state.coins,
    snacks: state.snacks,
    tickets: state.tickets,
    gems: open ? starGemsFound(world, state) : undefined,
    starGems: open ? journalStarGems(world, state) : undefined,
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
    heartToHearts: open ? heartToHeartSummary(world, state) : undefined,
    encoreSummary: open ? encoreJournalSummary(world, state) : undefined,
    encoreTrophies: open ? countEncoreTrophies(state.encore) : 0,
    decorCount: open ? countDecorCustomizations(state.decor) : 0,
    puzzlesSolved: open ? countSolvedPuzzles(state.puzzles) : 0,
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

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

let lastInkTagsInput = "";
let lastInkTagsOutput: readonly string[] = [];

/**
 * Purely extracts the active Ink line's `# ...` tags from serialized `state.ink`
 * JSON without mutating simulation state or instantiating a Story.
 */
export function extractInkCurrentTags(inkJson: string | undefined): readonly string[] {
  if (inkJson === undefined || inkJson.length === 0) return [];
  if (inkJson === lastInkTagsInput) return lastInkTagsOutput;
  let parsed: unknown;
  try {
    parsed = JSON.parse(inkJson);
  } catch {
    return [];
  }
  if (!isJsonRecord(parsed)) return [];
  let stream: unknown;
  const flows = parsed.flows;
  if (isJsonRecord(flows)) {
    const flowName =
      typeof parsed.currentFlowName === "string" && parsed.currentFlowName.length > 0
        ? parsed.currentFlowName
        : "DEFAULT_FLOW";
    const flow = flows[flowName];
    if (isJsonRecord(flow)) stream = flow.outputStream;
  }
  if (!Array.isArray(stream)) stream = parsed.outputStream;
  if (!Array.isArray(stream)) {
    lastInkTagsInput = inkJson;
    lastInkTagsOutput = [];
    return lastInkTagsOutput;
  }
  const tags: string[] = [];
  for (let index = 0; index < stream.length; index += 1) {
    if (stream[index] !== "#") continue;
    let text = "";
    let cursor = index + 1;
    while (cursor < stream.length) {
      const part = stream[cursor];
      if (part === "/#") break;
      if (typeof part === "string" && part.startsWith("^")) {
        text += part.slice(1);
      }
      cursor += 1;
    }
    const trimmed = text.trim();
    if (trimmed.length > 0) tags.push(trimmed);
    index = cursor;
  }
  lastInkTagsInput = inkJson;
  lastInkTagsOutput = tags;
  return tags;
}

/** Extracts the active line's `# expr:` portrait expression from serialized Ink state. */
export function extractInkExpression(inkJson: string | undefined): PortraitExpression {
  return resolveExpressionTag(extractInkCurrentTags(inkJson));
}

const PARTY_SPEAKER_IDS: Readonly<Record<string, string>> = {
  maddie: "maddie",
  sue: "sue",
  jordan: "jordan",
  "pond pup": "pond-pup",
  "acorn squirrel": "acorn-squirrel",
  "ribbon bunny": "ribbon-bunny",
};

/**
 * Projects a world-anchored speech-tail side (`left` | `right` | `center`) for
 * the active dialogue speaker without touching camera or core simulation state.
 */
export function resolveDialogueSpeakerSide(
  world: Partial<Pick<World, "areas" | "party">>,
  state: Partial<Pick<State, "area" | "player" | "facing" | "party" | "dialogue">>,
  speaker: string | null,
  inBattle: boolean,
): SpeakerSide | null {
  if (speaker === null) return null;
  const accent = speakerAccent(speaker);
  if (accent === "default") return null;
  const key = speaker.trim().toLowerCase();
  if (inBattle) {
    return key === "fae" || PARTY_SPEAKER_IDS[key] !== undefined ? "left" : "right";
  }

  const player = state.player;
  const dialogue = state.dialogue;
  const area = state.area !== undefined ? world.areas?.[state.area] : undefined;
  const npcPartner = area?.npcs.find((npc) => npc.knot === dialogue?.knot)?.point ?? null;
  const partnerPoint = dialogue?.partnerPoint ?? npcPartner;

  const sideFromDelta = (deltaX: number): SpeakerSide =>
    deltaX < -16 ? "left" : deltaX > 16 ? "right" : "center";

  const partyId = PARTY_SPEAKER_IDS[key];
  if (partyId !== undefined && player !== undefined) {
    const member = state.party?.find((entry) => entry.id === partyId);
    if (member !== undefined) return sideFromDelta(member.x - player.x);
  }

  if (key === "fae") {
    if (player !== undefined && partnerPoint !== null) {
      return sideFromDelta(player.x - partnerPoint.x);
    }
    if (player !== undefined && area !== undefined && area.width > 0) {
      const ratio = player.x / area.width;
      if (ratio < 0.4) return "left";
      if (ratio > 0.56) return "right";
      return "center";
    }
    if (state.facing === "left") return "left";
    if (state.facing === "right") return "right";
    return "center";
  }

  if (player !== undefined && partnerPoint !== null) {
    return sideFromDelta(partnerPoint.x - player.x);
  }
  return "center";
}

export type DialogueViewParams = {
  world: Pick<World, "battle"> & Partial<Pick<World, "areas" | "party">>;
  state: Pick<State, "battle" | "dialogue"> &
    Partial<Pick<State, "ink" | "area" | "player" | "facing" | "party">>;
  battle: BattleView | null;
  arcadeState: ArcadeView | null;
  levelUpNotice: string | null;
  speakerPortrait: (
    speaker: string | null,
    expression?: PortraitExpression,
  ) => AtlasImage | null;
  tags?: readonly string[];
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
    const tags = params.tags ?? extractInkCurrentTags(state.ink);
    const expression = resolveExpressionTag(tags);
    return {
      ...talkView,
      portrait: speakerPortrait(talkView.speaker, expression),
      accent: speakerAccent(talkView.speaker),
      expression,
      speakerSide: resolveDialogueSpeakerSide(world, state, talkView.speaker, true),
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
        ? battleCommandPreview(
            activeCmd,
            battle.critterName,
            feelingLabel,
            (battle.foes?.length ?? 1) > 1,
          )
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
  const tags = params.tags ?? extractInkCurrentTags(state.ink);
  const expression = resolveExpressionTag(tags);
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
    portrait: speakerPortrait(state.dialogue.speaker, expression),
    accent: speakerAccent(state.dialogue.speaker),
    expression,
    speakerSide: resolveDialogueSpeakerSide(world, state, state.dialogue.speaker, false),
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
  const freeAction = overworldFree && interactTarget === undefined && !isResting;
  const interactHint = overworldFree
    ? resolveHudInteractHint({
        hasInteractable: interactTarget !== undefined,
        interactPrompt: interactTarget?.prompt,
        isResting,
        player: state.player,
        facing: state.facing,
        pettableCompanion: freeAction ? findPettableCompanion(world, state) : null,
        hasRestSpot: freeAction && findRestSpot(world, state) !== null,
        hasPebbleSkip: freeAction && findPebbleSkipSpot(world, state) !== null,
        hasSanctuaryPet: freeAction && findNearbySanctuaryCritter(world, state) !== null,
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
  checkV2Art?: (frameName: string) => AtlasImage | null;
  inputMode?: HudInputMode;
};

/** Projects core battle state, party portraits, and Field Guide peek onto BattleHudView. */
export function buildBattleHudView(params: BattleHudViewParams): BattleHudView {
  const {
    world, state, battle, partyCommands, paused, canPeek, peekOpen, speakerPortrait, checkV2Art,
  } = params;
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
  const bossPhase2 = battle?.bossPhase2 ?? null;
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
          comboActive:
            state.battle.phase === "check" &&
            state.battle.command !== null &&
            state.battle.command.startsWith("combo:") &&
            state.battle.check?.side === "critter",
          recovered: state.battle.phase === "result" && state.battle.command === "recover",
          bossPhase2: bossPhase2 !== null,
        }
      : null;
  const critter = world.critters[state.battle?.critterId ?? ""];
  const resolveIntent = (
    intent: NonNullable<BattleView["intent"]> | null | undefined,
  ): BattleIntentItem | null =>
    intent === null || intent === undefined
      ? null
      : {
          kind: intent.kind,
          label: intent.label,
          detail: intent.detail,
          art: checkV2Art?.(intent.frame) ?? null,
        };
  const multiFoes: BattleFoePlateItem[] | undefined =
    battle?.foes !== undefined && battle.foes.length > 1
      ? battle.foes.map((foe) => ({
          index: foe.index,
          critterId: foe.critterId,
          name: foe.name,
          calm: foe.calm,
          calmMax: foe.calmMax,
          soothed: foe.soothed,
          targeted: foe.targeted,
          intent: resolveIntent(foe.intent),
        }))
      : undefined;
  const bossIntent = bossPhase2 === null ? null : resolveIntent(battle?.intent);
  const targetedFoe =
    multiFoes === undefined
      ? undefined
      : (multiFoes.find((foe) => foe.targeted && !foe.soothed) ??
        multiFoes.find((foe) => !foe.soothed) ??
        multiFoes[0]);
  const peekIntent = targetedFoe !== undefined ? targetedFoe.intent : bossIntent;
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
    peek: peekOpen
      ? battlePeekData(world, state, {
          inputMode: params.inputMode,
          intentLabel: peekIntent?.label ?? null,
          intentDetail: peekIntent?.detail ?? null,
          phase2Title: bossPhase2?.phaseTitle ?? null,
          phase2Rhythm: bossPhase2?.rhythmLabel ?? null,
        })
      : null,
    inputMode: params.inputMode,
    ...(multiFoes === undefined ? {} : { foes: multiFoes }),
    bossPhase2: bossPhase2 === null
      ? null
      : {
          bossId: bossPhase2.bossId,
          bossName: bossPhase2.bossName,
          phaseTitle: bossPhase2.phaseTitle,
          signatureLine: bossPhase2.signatureLine,
          accentHex: bossPhase2.accentHex,
          rhythmLabel: bossPhase2.rhythmLabel,
        },
    bossIntent,
  };
}

/** Projects the credits finale state and cropped character frames onto CreditsView. */
export function buildCreditsView(
  world: World,
  state: State,
  art: AtlasFrameResolver,
  records?: MinigameRecords,
): CreditsView {
  const visible = state.finale === "credits";
  const ribbons = visible ? evaluateMeritRibbons(world, state, records) : null;
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
    summary: visible
      ? creditsSummary(world, state, {
          ribbonsEarned: ribbons?.earned,
          ribbonsTotal: ribbons?.total,
        })
      : [],
    postcard: visible ? DEFAULT_ENDING_POSTCARD : null,
  };
}
