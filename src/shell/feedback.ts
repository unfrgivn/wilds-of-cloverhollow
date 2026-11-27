import {
  cookZone,
  journalNotes,
  jukeboxTracks,
  levelUpLine,
  soundtrackFor,
  trackTitles,
  type ActionFrame,
  type Event,
  type JukeboxTrack,
  type SoundCue,
  type SoundtrackState,
  type State,
  type World,
} from "../core";
import type { CompanionAudioEffect, SoundPlayContext } from "../platform/audio";
import type { HapticKind } from "../platform/haptics";
import type { MinigameRecordsController } from "../platform/minigame-records";
import type { ArcadeRecordBadge } from "../ui/arcade-popups";
import { areaBannerInfo, type AreaBannerView } from "../ui/area-banner";
import type { JukeboxMeta } from "../ui/journal";
import {
  composePostcardFrame,
  postcardMetadata,
  triggerPostcardDownload,
  type PostcardCapture,
} from "../ui/postcard";

export type ArcadeRecordsStore = Pick<MinigameRecordsController, "submit" | "bestOf">;

export type ArcadeOutcome = {
  record: ArcadeRecordBadge | null;
  fishStreak: number;
  goldenCooked: boolean;
};

/** Selects the cozy pet sound effect matching a party companion id. */
export function petEffectForCompanion(id: string): CompanionAudioEffect {
  if (id === "pond-pup") return "pet-pup";
  if (id === "acorn-squirrel") return "pet-squirrel";
  if (id === "ribbon-bunny") return "pet-bunny";
  return "pet-cat";
}

/** Projects a simulation tick's transitions and sound cues to a tactile haptic kind. */
export function hapticForTick(
  previous: Pick<State, "battle">,
  next: Pick<State, "battle">,
  cues: readonly SoundCue[],
  options?: { goldenCooked?: boolean },
): HapticKind | null {
  const soothedNow = previous.battle?.phase !== "soothed" && next.battle?.phase === "soothed";
  if (
    options?.goldenCooked === true ||
    soothedNow ||
    cues.includes("battle-together") ||
    cues.includes("prize-won") ||
    cues.includes("fish-catch")
  ) {
    return "celebrate";
  }
  if (cues.includes("battle-hit") && next.battle?.lastGrade === "great") {
    return "medium";
  }
  if (
    cues.includes("claw-grab") ||
    cues.includes("mole-boop") ||
    cues.includes("fish-bite")
  ) {
    return "light";
  }
  return null;
}

/** Extracts active dialogue or battle speaker and cursor context for voice/choice synthesis. */
export function buildSoundContext(
  state: Pick<State, "dialogue" | "battle">,
): SoundPlayContext {
  const activeTalk = state.dialogue ?? state.battle?.talk ?? null;
  const choiceIndex =
    state.dialogue?.selected ?? state.battle?.talk?.selected ?? state.battle?.selected ?? 0;
  return {
    speaker: activeTalk?.speaker ?? null,
    text: activeTalk?.text,
    revealed: activeTalk?.revealed,
    choiceIndex,
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

/** True when a free-overworld confirm edge should inspect resting or companion petting. */
export function isOverworldConfirm(
  confirmEdge: boolean,
  dismissedLevelUp: boolean,
  previous: State,
  next: State,
): boolean {
  return (
    confirmEdge &&
    !dismissedLevelUp &&
    previous.dialogue === null &&
    previous.battle === null &&
    previous.arcade === null &&
    !previous.journalOpen &&
    previous.transition === null &&
    previous.finale === null &&
    next.dialogue === null &&
    next.battle === null &&
    next.arcade === null &&
    !next.journalOpen &&
    next.transition === null &&
    next.finale === null &&
    previous.area === next.area
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

export type AreaBannerTracker = {
  clear: () => void;
  update: (world: World, previous: State, next: State) => void;
  view: (
    world: World,
    state: State,
    eligible: boolean,
    qaOffset: boolean,
  ) => AreaBannerView;
};

/** Tracks arrival banner lifecycle across area crossings and fade-ins. */
export function createAreaBannerTracker(duration = 150): AreaBannerTracker {
  let area: string | null = null;
  let startTick = -1;
  let pendingFade = false;

  const clear = (): void => {
    area = null;
    startTick = -1;
    pendingFade = false;
  };

  return {
    clear,
    update: (world, previous, next) => {
      if (previous.area !== next.area) {
        if (areaBannerInfo(world, next.area) !== null) {
          area = next.area;
          startTick = next.tick;
          pendingFade = next.transition !== null;
        } else {
          clear();
        }
      } else if (
        previous.transition !== null &&
        next.transition === null &&
        pendingFade &&
        area === next.area
      ) {
        startTick = next.tick;
        pendingFade = false;
      }
    },
    view: (world, state, eligible, qaOffset) => {
      if (startTick >= 0 && state.tick < startTick) clear();
      const info =
        area !== null && area === state.area && !pendingFade
          ? areaBannerInfo(world, state.area)
          : null;
      const elapsed = startTick >= 0 ? state.tick - startTick : -1;
      if (elapsed >= duration) clear();
      const visible =
        eligible &&
        info !== null &&
        elapsed >= 0 &&
        elapsed < duration &&
        state.area !== "harness" &&
        state.dialogue === null &&
        state.battle === null &&
        state.arcade === null &&
        !state.journalOpen &&
        state.finale === null &&
        state.transition === null;
      return {
        visible,
        title: info?.title ?? "",
        region: info?.region ?? null,
        progress: visible ? (elapsed + 1) / (duration + 1) : 0,
        qaOffset,
      };
    },
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

/** Composes a framed Postcard PNG from a rendered canvas and triggers optional download. */
export function captureAreaPostcard(
  world: Pick<World, "areas" | "lands">,
  areaId: string,
  sourceCanvas: HTMLCanvasElement,
  download = true,
): PostcardCapture | null {
  const area = world.areas[areaId];
  const areaName = area?.name ?? areaId;
  const land =
    area?.land === undefined
      ? undefined
      : world.lands.find((entry) => entry.id === area.land);
  const meta = postcardMetadata(areaId, areaName, land?.name ?? "");
  const composed = composePostcardFrame(sourceCanvas, meta.caption, meta.subcaption);
  if (composed === null) return null;
  if (download) triggerPostcardDownload(composed.dataUrl, meta.filename);
  return {
    filename: meta.filename,
    caption: meta.caption,
    width: composed.width,
    height: composed.height,
    dataUrl: composed.dataUrl,
  };
}
