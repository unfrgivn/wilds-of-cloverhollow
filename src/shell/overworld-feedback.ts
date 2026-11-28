import { targetInteractable, type State, type World } from "../core";
import { evaluateMeritRibbons, newlyEarnedRibbons, type MeritRibbonSummary } from "../core/ribbons";
import type { CozyWeatherKind } from "../core/weather";
import type { CompanionAudioEffect } from "../platform/audio";
import { findPettableCompanion, findRestSpot, type RestSpot } from "../render/companions";
import {
  findNearbySanctuaryCritter, findPebbleSkipSpot, type PebbleSkipSpot,
} from "../render/micro-delights";
import { areaBannerInfo, type AreaBannerView } from "../ui/area-banner";
import { createNpcChatter, type NpcChatterView } from "../ui/npc-chatter";
import {
  composePostcardFrame, deliverPostcard, postcardMetadata, type PostcardCapture,
  type PostcardDeliveryResult,
} from "../ui/postcard";
import { createRibbonToast } from "../ui/ribbon-toast";

/** Selects the cozy pet sound effect matching a party companion id. */
export function petEffectForCompanion(id: string): CompanionAudioEffect {
  if (id === "pond-pup") return "pet-pup";
  if (id === "acorn-squirrel") return "pet-squirrel";
  if (id === "ribbon-bunny") return "pet-bunny";
  return "pet-cat";
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

/** Composes a framed Postcard PNG from a rendered canvas. */
export function captureAreaPostcard(
  world: Pick<World, "areas" | "lands">,
  areaId: string,
  sourceCanvas: HTMLCanvasElement,
  partyNames?: readonly string[],
  weather?: CozyWeatherKind,
): PostcardCapture | null {
  const area = world.areas[areaId];
  const areaName = area?.name ?? areaId;
  const land =
    area?.land === undefined
      ? undefined
      : world.lands.find((entry) => entry.id === area.land);
  const meta = postcardMetadata(areaId, areaName, land?.name ?? "", partyNames, weather);
  const composed = composePostcardFrame(sourceCanvas, meta.caption, meta.subcaption, weather);
  if (composed === null) return null;
  return {
    filename: meta.filename,
    caption: meta.caption,
    subcaption: meta.subcaption,
    width: composed.width,
    height: composed.height,
    dataUrl: composed.dataUrl,
  };
}

/** Composes a framed Postcard PNG and optionally delivers it via share sheet or download. */
export async function deliverAreaPostcard(
  world: Pick<World, "areas" | "lands" | "party">,
  state: Pick<State, "area" | "party">,
  sourceCanvas: HTMLCanvasElement,
  options?: {
    download?: boolean;
    preferShare?: boolean;
    partyNames?: readonly string[];
    weather?: CozyWeatherKind;
    onDelivered?: (
      capture: PostcardCapture,
      delivery: Exclude<PostcardDeliveryResult, "cancelled">,
      weather?: CozyWeatherKind,
    ) => void;
  },
): Promise<PostcardCapture | null> {
  const partyNames =
    options?.partyNames ??
    state.party
      .map((member) => world.party[member.id]?.name ?? "")
      .filter((name) => name.length > 0);
  const capture = captureAreaPostcard(
    world,
    state.area,
    sourceCanvas,
    partyNames,
    options?.weather,
  );
  if (capture === null) return null;
  if (options?.download !== false) {
    const delivery = await deliverPostcard(capture, { preferShare: options?.preferShare });
    if (delivery !== "cancelled") options?.onDelivered?.(capture, delivery, options?.weather);
  }
  return capture;
}

/** True when an interactive NPC tool micro-event freshly activates. */
export function shouldPlayToolEventChime(
  prevEventId: string | null,
  nextEventId: string | null,
): boolean {
  return nextEventId !== null && nextEventId !== prevEventId;
}

/** Tracks live overworld tool micro-event transitions to trigger a celebration chime once. */
export function createToolEventChimeSync(
  onChime: () => void,
): {
  sync: (
    area: string,
    overworldActive: boolean,
    live: boolean,
    activeToolEventId: string | null,
  ) => void;
  reset: () => void;
} {
  let lastArea: string | null = null;
  let lastToolEventId: string | null = null;
  return {
    reset: () => {
      lastArea = null;
      lastToolEventId = null;
    },
    sync: (area, overworldActive, live, activeToolEventId) => {
      if (area !== lastArea) {
        lastArea = area;
        lastToolEventId = null;
      }
      if (!overworldActive) {
        lastToolEventId = null;
        return;
      }
      if (live && shouldPlayToolEventChime(lastToolEventId, activeToolEventId)) {
        onChime();
      }
      lastToolEventId = activeToolEventId;
    },
  };
}

/** Mounts ambient NPC chatter UI and plays a soft voice blip once per fresh line. */
export function createNpcChatterSync(
  world: World,
  uiRoot: HTMLElement,
  project: (
    state: State,
    width: number,
    height: number,
    suppress: string | null,
  ) => NpcChatterView | null,
  playChatter: (speaker: string) => void,
): (state: State, overworldFree: boolean, photoMode: boolean, paused: boolean) => void {
  const npcChatter = createNpcChatter(uiRoot);
  let lastChatterKey = "";
  return (state, overworldFree, photoMode, paused) => {
    const interactTarget = overworldFree ? targetInteractable(world, state) : undefined;
    const suppressNpcId =
      interactTarget !== undefined && interactTarget.id.startsWith("npc:")
        ? interactTarget.id.slice(4)
        : null;
    const chatterView =
      overworldFree && !photoMode && state.transition === null
        ? project(state, window.innerWidth, window.innerHeight, suppressNpcId)
        : null;
    npcChatter.render(chatterView);
    const chatterKey =
      chatterView !== null && chatterView.visible && chatterView.text !== ""
        ? `${chatterView.npcId}|${chatterView.text}`
        : "";
    if (chatterKey !== lastChatterKey) {
      lastChatterKey = chatterKey;
      if (!paused && state.area !== "harness" && chatterView !== null && chatterKey !== "") {
        playChatter(chatterView.speakerName);
      }
    }
  };
}

/** Handles overworld Confirm presses when no interactable is targeted. */
export function performOverworldConfirm(
  world: World,
  state: State,
  deps: {
    isResting: () => boolean;
    setResting: (spot: RestSpot | null, tick: number) => void;
    triggerPet: (id: string, tick: number) => void;
    triggerPebbleSkip?: (spot: PebbleSkipSpot, tick: number) => void;
    triggerSanctuaryHop?: (npcId: string, tick: number) => void;
    playEffect: (effect: CompanionAudioEffect) => void;
    lightHaptic: () => void;
  },
): void {
  if (deps.isResting()) {
    deps.setResting(null, state.tick);
    return;
  }
  const restSpot = findRestSpot(world, state);
  if (restSpot !== null) {
    deps.setResting(restSpot, state.tick);
    deps.playEffect("rest-sit");
    return;
  }
  const companion = findPettableCompanion(world, state);
  if (companion !== null) {
    deps.triggerPet(companion.id, state.tick);
    deps.playEffect(petEffectForCompanion(companion.id));
    deps.lightHaptic();
    return;
  }
  const skipSpot = findPebbleSkipSpot(world, state);
  if (skipSpot !== null && deps.triggerPebbleSkip !== undefined) {
    deps.triggerPebbleSkip(skipSpot, state.tick);
    deps.playEffect("pebble-skip");
    deps.lightHaptic();
    return;
  }
  const critter = findNearbySanctuaryCritter(world, state);
  if (critter !== null && deps.triggerSanctuaryHop !== undefined) {
    deps.triggerSanctuaryHop(critter.id, state.tick);
    deps.playEffect("sanctuary-hop");
    deps.lightHaptic();
  }
}

export type RibbonCelebrationSync = {
  reset: () => void;
  observe: (
    state: State,
    previousTick: number,
    records: { taco?: number },
    live: boolean,
  ) => void;
};

/**
 * Watches live real-time ticks for newly stitched Valley Merit Ribbons and
 * enqueues the die-cut RibbonToast alongside celebratory foley/haptics.
 * Paused harness steps and resets/loads never emit false toasts.
 */
export function createRibbonCelebrationSync(
  world: Pick<World, "stickers" | "arcade" | "storyVariable">,
  uiRoot: HTMLElement,
  onEarned: () => void,
): RibbonCelebrationSync {
  const toast = createRibbonToast(uiRoot);
  let lastSummary: MeritRibbonSummary | null = null;
  let lastSnapshot: {
    stickers: State["stickers"];
    prizes: State["prizes"];
    caughtFish: State["caughtFish"];
    ink: string;
    party: State["party"];
    encore: State["encore"];
    decor: State["decor"];
    puzzles: State["puzzles"];
    taco: number;
  } | null = null;

  const reset = (): void => {
    lastSummary = null;
    lastSnapshot = null;
    toast.clear();
  };

  return {
    reset,
    observe: (state, previousTick, records, live) => {
      if (!live || state.tick <= previousTick) return;
      const taco = records.taco ?? 0;
      if (
        lastSnapshot !== null &&
        lastSnapshot.stickers === state.stickers &&
        lastSnapshot.prizes === state.prizes &&
        lastSnapshot.caughtFish === state.caughtFish &&
        lastSnapshot.ink === state.ink &&
        lastSnapshot.party === state.party &&
        lastSnapshot.encore === state.encore &&
        lastSnapshot.decor === state.decor &&
        lastSnapshot.puzzles === state.puzzles &&
        lastSnapshot.taco === taco
      ) {
        return;
      }
      const nextSummary = evaluateMeritRibbons(world, state, records);
      const earned = newlyEarnedRibbons(lastSummary, nextSummary);
      if (earned.length > 0) {
        toast.enqueue(earned);
        onEarned();
      }
      lastSummary = nextSummary;
      lastSnapshot = {
        stickers: state.stickers,
        prizes: state.prizes,
        caughtFish: state.caughtFish,
        ink: state.ink,
        party: state.party,
        encore: state.encore,
        decor: state.decor,
        puzzles: state.puzzles,
        taco,
      };
    },
  };
}
