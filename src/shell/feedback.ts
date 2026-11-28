import {
  cookZone,
  isBossPhase2,
  isDualComboCommand,
  isMiniBossId,
  journalNotes,
  jukeboxTracks,
  levelUpLine,
  soundtrackFor,
  trackTitles,
  type ActionFrame,
  type Battle,
  type CheckState,
  type Event,
  type JukeboxTrack,
  type SoundCue,
  type SoundtrackState,
  type State,
  type World,
} from "../core";
import type { SoundPlayContext } from "../platform/audio";
import type { HapticKind } from "../platform/haptics";
import type { MinigameRecordsController } from "../platform/minigame-records";
import type { ArcadeRecordBadge } from "../ui/arcade-popups";
import type { JukeboxMeta } from "../ui/journal";
import { parseRichText, resolveRichTextProgress } from "../ui/rich-text";
import { extractInkExpression } from "./view-models";

export {
  captureAreaPostcard,
  createAreaBannerTracker,
  createNpcChatterSync,
  createRibbonCelebrationSync,
  createToolEventChimeSync,
  deliverAreaPostcard,
  isOverworldConfirm,
  performOverworldConfirm,
  petEffectForCompanion,
  shouldPlayToolEventChime,
  type AreaBannerTracker,
  type RibbonCelebrationSync,
} from "./overworld-feedback";

export type ArcadeRecordsStore = Pick<MinigameRecordsController, "submit" | "bestOf">;

export type ArcadeOutcome = {
  record: ArcadeRecordBadge | null;
  fishStreak: number;
  goldenCooked: boolean;
};

const CELEBRATE_HAPTIC_CUES: ReadonlySet<SoundCue> = new Set<SoundCue>([
  "battle-together",
  "prize-won",
  "fish-catch",
  "level-up",
  "sticker",
  "skee-hundred",
  "taco-order",
]);

const MEDIUM_HAPTIC_CUES: ReadonlySet<SoundCue> = new Set<SoundCue>([
  "comet-bump",
  "lasso-twirl",
  "cook-ding",
  "taco-oops",
  "battle-faint",
]);

const LIGHT_HAPTIC_CUES: ReadonlySet<SoundCue> = new Set<SoundCue>([
  "battle-recover",
  "claw-grab",
  "mole-boop",
  "taco-top",
  "fish-bite",
  "skee-score",
  "comet-star",
  "flute",
  "lantern-on",
  "coin",
  "item",
]);

function recordChanged(
  previous: Readonly<Record<string, string>> | undefined,
  next: Readonly<Record<string, string>> | undefined,
): boolean {
  if (previous === next) return false;
  const prevKeys = previous === undefined ? [] : Object.keys(previous);
  const nextKeys = next === undefined ? [] : Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return true;
  for (const key of nextKeys) {
    if (previous?.[key] !== next?.[key]) return true;
  }
  return false;
}

function countWhackHits(check: CheckState | null | undefined): number {
  if (check?.kind !== "whack") return 0;
  let count = 0;
  for (const result of check.results) {
    if (result === "hit") count += 1;
  }
  return count;
}

function foeInBossPhase2(
  critterId: string,
  calm: number,
  calmMax: number,
  phase: Battle["phase"],
  talkMode: boolean,
): boolean {
  return (
    isMiniBossId(critterId) &&
    !talkMode &&
    calm >= Math.ceil(calmMax * 0.5) &&
    calm < calmMax &&
    phase !== "soothed" &&
    phase !== "reward" &&
    phase !== "rest" &&
    phase !== "run"
  );
}

function enteredBossPhase2(
  previous: Battle | null,
  next: Battle | null,
  world?: Pick<World, "critters">,
): boolean {
  if (previous === null || next === null) return false;
  if (previous.foes !== undefined && next.foes !== undefined) {
    return next.foes.some((foe, index) => {
      const prevFoe = previous.foes?.[index];
      if (prevFoe === undefined || prevFoe.critterId !== foe.critterId) return false;
      return (
        !foeInBossPhase2(
          prevFoe.critterId,
          prevFoe.calm,
          prevFoe.calmMax,
          previous.phase,
          previous.talkMode === true,
        ) &&
        foeInBossPhase2(
          foe.critterId,
          foe.calm,
          foe.calmMax,
          next.phase,
          next.talkMode === true,
        )
      );
    });
  }
  if (previous.critterId !== next.critterId || world === undefined) return false;
  const critter = world.critters[next.critterId];
  if (critter === undefined) return false;
  return (
    !isBossPhase2(critter, previous.calm, previous.phase, previous.talkMode === true) &&
    isBossPhase2(critter, next.calm, next.phase, next.talkMode === true)
  );
}

/** True when the player switched the active target foe in a multi-foe battle command phase. */
export function didSwitchBattleTarget(
  previous: Pick<State, "battle">,
  next: Pick<State, "battle">,
): boolean {
  const prevBattle = previous.battle;
  const nextBattle = next.battle;
  if (prevBattle === null || nextBattle === null) return false;
  if (prevBattle.phase !== "command" || nextBattle.phase !== "command") return false;
  if ((nextBattle.foes?.length ?? 0) <= 1) return false;
  const prevIndex = prevBattle.targetIndex ?? 0;
  const nextIndex = nextBattle.targetIndex ?? 0;
  if (prevIndex === nextIndex) return false;
  return prevBattle.foes?.[prevIndex]?.soothed === nextBattle.foes?.[prevIndex]?.soothed;
}

/** Projects a simulation tick's transitions and sound cues to a tactile haptic kind. */
export function hapticForTick(
  previous: Pick<State, "battle"> & Partial<Pick<State, "area" | "puzzleArea" | "encore">>,
  next: Pick<State, "battle"> & Partial<Pick<State, "area" | "puzzleArea" | "encore">>,
  cues: readonly SoundCue[],
  options?: { goldenCooked?: boolean; world?: Pick<World, "critters"> },
): HapticKind | null {
  const sameArea =
    previous.area === undefined || next.area === undefined || previous.area === next.area;
  const prevSolved = previous.puzzleArea?.lastSolved;
  const nextSolved = next.puzzleArea?.lastSolved;
  const puzzleSolvedNow =
    sameArea &&
    nextSolved !== undefined &&
    (prevSolved === undefined ||
      prevSolved.id !== nextSolved.id ||
      prevSolved.tick !== nextSolved.tick);
  const encoreTrophyEarned =
    (next.encore?.trophies.length ?? 0) > (previous.encore?.trophies.length ?? 0);
  const soothedNow = previous.battle?.phase !== "soothed" && next.battle?.phase === "soothed";
  const dualComboStarted =
    isDualComboCommand(next.battle?.command) &&
    (previous.battle?.command !== next.battle?.command ||
      (previous.battle?.phase !== "check" &&
        next.battle?.phase === "check" &&
        next.battle.check?.side === "critter"));
  const bossPhase2Started = enteredBossPhase2(previous.battle, next.battle, options?.world);
  if (
    options?.goldenCooked === true ||
    soothedNow ||
    dualComboStarted ||
    bossPhase2Started ||
    puzzleSolvedNow ||
    encoreTrophyEarned ||
    cues.some((cue) => CELEBRATE_HAPTIC_CUES.has(cue))
  ) {
    return "celebrate";
  }
  if (
    (cues.includes("battle-hit") && next.battle?.lastGrade === "great") ||
    cues.some((cue) => MEDIUM_HAPTIC_CUES.has(cue))
  ) {
    return "medium";
  }
  const mirrorRotated =
    sameArea &&
    next.puzzleArea?.mirrors !== undefined &&
    recordChanged(previous.puzzleArea?.mirrors, next.puzzleArea.mirrors);
  const plateChanged =
    sameArea && recordChanged(previous.puzzleArea?.heldPlates, next.puzzleArea?.heldPlates);
  const lassoFired =
    sameArea &&
    next.puzzleArea?.lasso !== undefined &&
    next.puzzleArea.lasso.tick === 0 &&
    (previous.puzzleArea?.lasso === undefined || previous.puzzleArea.lasso.tick !== 0);
  const prevChime = previous.puzzleArea?.recentChime;
  const nextChime = next.puzzleArea?.recentChime;
  const fluteChimed =
    sameArea &&
    nextChime !== undefined &&
    (prevChime === undefined ||
      prevChime.note !== nextChime.note ||
      prevChime.tick !== nextChime.tick);
  const whackHit = countWhackHits(next.battle?.check) > countWhackHits(previous.battle?.check);
  const spinSnagTurn =
    next.battle?.check?.kind === "spin-snag" &&
    previous.battle?.check?.kind === "spin-snag" &&
    next.battle.check.turns > previous.battle.check.turns;
  const targetSwitched = didSwitchBattleTarget(previous, next);
  if (
    mirrorRotated ||
    plateChanged ||
    lassoFired ||
    fluteChimed ||
    whackHit ||
    spinSnagTurn ||
    targetSwitched ||
    cues.some((cue) => LIGHT_HAPTIC_CUES.has(cue))
  ) {
    return "light";
  }
  return null;
}

/** Extracts active dialogue or battle speaker and cursor context for voice/choice synthesis. */
export function buildSoundContext(
  state: Pick<State, "dialogue" | "battle"> & Partial<Pick<State, "ink">>,
): SoundPlayContext {
  const activeTalk = state.dialogue ?? state.battle?.talk ?? null;
  const choiceIndex =
    state.dialogue?.selected ?? state.battle?.talk?.selected ?? state.battle?.selected ?? 0;
  if (activeTalk === null) {
    return { speaker: null, text: undefined, revealed: undefined, choiceIndex };
  }
  const parsed = parseRichText(activeTalk.text);
  const progress = resolveRichTextProgress(parsed, activeTalk.revealed);
  const expression = extractInkExpression(state.ink);
  return {
    speaker: activeTalk.speaker,
    text: parsed.plain,
    revealed: parsed.hasMarkup ? progress.visibleChars : activeTalk.revealed,
    choiceIndex,
    ...(expression === "neutral" ? {} : { expression }),
    ...(progress.inPause ? { inPause: true } : {}),
  };
}

/**
 * Resolves minigame result-phase transitions into personal-best record badges,
 * updated fishing streak counts, and Golden Chef completion flags.
 */
export function resolveArcadeOutcome(
  world: Pick<World, "arcade">,
  previous: Pick<State, "area" | "arcade">,
  next: Pick<State, "area" | "arcade">,
  gentleTiming: boolean,
  records: ArcadeRecordsStore,
  fishStreak: number,
  currentRecord: ArcadeRecordBadge | null = null,
): ArcadeOutcome {
  let nextStreak = previous.area !== next.area ? 0 : fishStreak;
  const nextArcade = next.arcade;
  if (nextArcade === null || nextArcade.phase !== "result") {
    return { record: null, fishStreak: nextStreak, goldenCooked: false };
  }
  if (
    previous.arcade === null ||
    previous.arcade.game !== nextArcade.game ||
    previous.arcade.phase === "result"
  ) {
    return { record: currentRecord, fishStreak: nextStreak, goldenCooked: false };
  }
  if (nextArcade.game === "skee") {
    const total = nextArcade.throws.reduce((sum, item) => sum + item.points, 0);
    return {
      record: records.submit("skee", total),
      fishStreak: nextStreak,
      goldenCooked: false,
    };
  }
  if (nextArcade.game === "mole") {
    return {
      record: records.submit("mole", nextArcade.booped),
      fishStreak: nextStreak,
      goldenCooked: false,
    };
  }
  if (nextArcade.game === "comet") {
    return {
      record: records.submit("comet", nextArcade.caught),
      fishStreak: nextStreak,
      goldenCooked: false,
    };
  }
  if (nextArcade.game === "fish") {
    if (nextArcade.caught !== null) {
      nextStreak += 1;
      return {
        record: records.submit("fish", nextStreak),
        fishStreak: nextStreak,
        goldenCooked: false,
      };
    }
    const best = records.bestOf("fish");
    return {
      record: best > 0 ? { best, isNewBest: false } : null,
      fishStreak: 0,
      goldenCooked: false,
    };
  }
  if (nextArcade.game === "cook") {
    const zone = cookZone(world.arcade.cook, nextArcade.dish, nextArcade.cooked, gentleTiming);
    if (zone === "golden") {
      return {
        record: records.submit("cook", records.bestOf("cook") + 1),
        fishStreak: nextStreak,
        goldenCooked: true,
      };
    }
    const best = records.bestOf("cook");
    return {
      record: best > 0 ? { best, isNewBest: false } : null,
      fishStreak: nextStreak,
      goldenCooked: false,
    };
  }
  if (nextArcade.game === "taco") {
    if (nextArcade.score > 0) {
      return {
        record: records.submit("taco", nextArcade.score),
        fishStreak: nextStreak,
        goldenCooked: false,
      };
    }
    const best = records.bestOf("taco");
    return {
      record: best > 0 ? { best, isNewBest: false } : null,
      fishStreak: nextStreak,
      goldenCooked: false,
    };
  }
  return { record: currentRecord, fishStreak: nextStreak, goldenCooked: false };
}

/** Formats all level-up events emitted by a simulation tick into dialogue notice lines. */
export function collectLevelUpNotices(
  world: Pick<World, "party">,
  events: readonly Event[],
): string[] {
  const notices: string[] = [];
  for (const event of events) {
    if (event.type !== "level-up") continue;
    const friend = event.member !== "fae";
    const name = friend ? (world.party[event.member]?.name ?? event.member) : "Fae";
    notices.push(levelUpLine(name, event.from, event.to, event.deltas, friend));
  }
  return notices;
}

/** True when player input or an overlay transition should stand Fae up from a rest spot. */
export function shouldClearRest(
  input: ActionFrame,
  previous: Pick<State, "area">,
  next: State,
): boolean {
  return (
    input.move.x !== 0 ||
    input.move.y !== 0 ||
    input.cancel ||
    input.menu ||
    previous.area !== next.area ||
    next.dialogue !== null ||
    next.battle !== null ||
    next.arcade !== null ||
    next.journalOpen ||
    next.transition !== null ||
    next.finale !== null
  );
}

/** Steps the Journal Music Box track forward or backward with wrap-around. */
export function stepJukeboxTrack(
  world: World,
  state: State,
  current: JukeboxTrack | null,
  delta: -1 | 1,
  titleOpen: boolean,
): JukeboxTrack | null {
  const baseTrack = current ?? soundtrackFor(world, state, { titleOpen }).track;
  const currentIndex = baseTrack === "silent" ? -1 : jukeboxTracks.indexOf(baseTrack);
  const startIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
  const nextIndex = (startIndex + delta + jukeboxTracks.length) % jukeboxTracks.length;
  return jukeboxTracks[nextIndex] ?? null;
}

/** Computes the active soundtrack and Journal Music Box metadata for the current frame. */
export function resolveSoundtrack(
  world: World,
  state: State,
  jukeboxTrack: JukeboxTrack | null,
  titleOpen: boolean,
): { soundtrack: SoundtrackState; jukebox: JukeboxMeta } {
  const base = soundtrackFor(world, state, { titleOpen });
  const soundtrack: SoundtrackState =
    jukeboxTrack !== null
      ? { ...base, track: jukeboxTrack, duck: false, title: trackTitles[jukeboxTrack] }
      : base;
  const index =
    jukeboxTrack !== null
      ? jukeboxTracks.indexOf(jukeboxTrack)
      : soundtrack.track === "silent"
        ? -1
        : jukeboxTracks.indexOf(soundtrack.track);
  return {
    soundtrack,
    jukebox: { active: jukeboxTrack !== null, index, total: jukeboxTracks.length },
  };
}

/** Memoizes Ink-derived Journal notes across the state slices that affect them. */
export function createJournalNotesCache(world: World): (state: State) => string[] {
  let cache: {
    ink: string;
    critters: State["critters"];
    stickers: State["stickers"];
    coins: number;
    notes: string[];
  } | null = null;
  return (state) => {
    if (
      cache === null ||
      cache.ink !== state.ink ||
      cache.critters !== state.critters ||
      cache.stickers !== state.stickers ||
      cache.coins !== state.coins
    ) {
      cache = {
        ink: state.ink,
        critters: state.critters,
        stickers: state.stickers,
        coins: state.coins,
        notes: journalNotes(world, state),
      };
    }
    return cache.notes;
  };
}
