import {
  calmedFact,
  isSpeciesCalmed,
  type Point,
  type State,
  type World,
} from "../core";
import {
  isRestorationZoneId,
  RESTORATION_ZONE_IDS,
  RESTORATION_ZONES,
  type BloomDecalFrame,
  type ChaosDecalFrame,
  type RestorationDecalSpec,
  type RestorationZoneId,
  type RestorationZoneSpec,
} from "./restoration-zones";

export {
  isRestorationZoneId,
  RESTORATION_ZONE_IDS,
  RESTORATION_ZONES,
  type BloomDecalFrame,
  type ChaosDecalFrame,
  type RestorationDecalSpec,
  type RestorationZoneId,
  type RestorationZoneSpec,
};

export const RESTORATION_PULSE_TICKS = 90;
export const RESTORATION_PETAL_COUNT = 32;

export type RestorationStatus = {
  readonly zone: RestorationZoneId;
  readonly anchor: Point;
  readonly restored: boolean;
  readonly ringColor: number;
  readonly ringAccent: number;
  readonly decals: readonly RestorationDecalSpec[];
};

export type RestorationPulseState = {
  readonly areaId: string;
  readonly wasRestored: boolean;
  readonly pulseStartTick: number | null;
  readonly lastTick: number;
};

export type RestorationPulseStep = {
  readonly next: RestorationPulseState;
  readonly calmPulse: number;
  readonly wiping: boolean;
};

export type DecalVisual = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly chaosFrame: ChaosDecalFrame;
  readonly chaosAlpha: number;
  readonly chaosScale: number;
  readonly chaosRotation: number;
  readonly chaosBlend: "normal" | "multiply";
  readonly chaosTint: number;
  readonly bloomFrame: BloomDecalFrame;
  readonly bloomAlpha: number;
  readonly bloomScale: number;
  readonly bloomRotation: number;
  readonly bloomBlend: "normal" | "add";
  readonly bloomTint: number;
};

export type RestorationRingVisual = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly thickness: number;
  readonly alpha: number;
  readonly outerColor: number;
  readonly innerColor: number;
  readonly glowRadius: number;
  readonly glowAlpha: number;
};

export type RestorationPetalVisual = {
  readonly texture: "petal" | "sparkle";
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly alpha: number;
  readonly rotation: number;
  readonly tint: number;
  readonly blend: "normal" | "add";
};

export type RestorationFrame = {
  readonly zone: RestorationZoneId;
  readonly restored: boolean;
  readonly calmPulse: number;
  readonly wiping: boolean;
  readonly decals: readonly DecalVisual[];
  readonly ring: RestorationRingVisual;
  readonly petals: readonly RestorationPetalVisual[];
};

const PETAL_TINTS: readonly number[] = [0xe86b99, 0xf2a83c, 0x54b885, 0x5aa6e8, 0xa474e0];

function inkTrue(world: World, state: State, name: string): boolean {
  return world.storyVariable(state.ink, name) === true;
}

/**
 * Projects an area's deterministic chaos-vs-restored state solely from existing
 * core `state.critters`, `state.calms`, `state.stickers`, and `state.ink` facts
 * (zero new core fields or save-version changes).
 */
export function evaluateAreaRestoration(
  world: World,
  state: State,
  areaId = state.area,
): RestorationStatus | null {
  if (!isRestorationZoneId(areaId)) return null;
  const spec = RESTORATION_ZONES[areaId];
  let restored = false;

  switch (areaId) {
    case "plaza":
      restored = calmedFact(world, state, "fountain-frog");
      break;
    case "park":
      restored = isSpeciesCalmed(world, state, "pup");
      break;
    case "bay": {
      const bluebirdCalm =
        isSpeciesCalmed(world, state, "bluebird") || inkTrue(world, state, "bluebird_calmed");
      const lifeguardChaotic =
        inkTrue(world, state, "lifeguard_back") && !calmedFact(world, state, "lifeguard");
      restored = bluebirdCalm && !lifeguardChaotic;
      break;
    }
    case "pass": {
      const hamsterCalm =
        isSpeciesCalmed(world, state, "hamster") || inkTrue(world, state, "lodge_open");
      const keeperChaotic =
        inkTrue(world, state, "keeper_back") && !calmedFact(world, state, "lodge-keeper");
      restored = hamsterCalm && !keeperChaotic;
      break;
    }
    case "woods": {
      const owlCalm =
        isSpeciesCalmed(world, state, "owl") || inkTrue(world, state, "clubhouse_claimed");
      const moonOwlChaotic =
        inkTrue(world, state, "moon_owl_out") && !calmedFact(world, state, "moon-owl");
      restored = owlCalm && !moonOwlChaotic;
      break;
    }
    case "school":
      restored = calmedFact(world, state, "principal");
      break;
    case "hills": {
      const wildCalm =
        isSpeciesCalmed(world, state, "lamb") ||
        isSpeciesCalmed(world, state, "hedgehog") ||
        calmedFact(world, state, "taco-chef");
      const chefChaotic =
        inkTrue(world, state, "taco_chef_out") && !calmedFact(world, state, "taco-chef");
      restored = wildCalm && !chefChaotic;
      break;
    }
    case "cavern":
      restored =
        (isSpeciesCalmed(world, state, "bat") && isSpeciesCalmed(world, state, "crystal-mole")) ||
        inkTrue(world, state, "cavern_chime_rung");
      break;
    case "enchanted":
      restored =
        world.storyVariable(state.ink, "forest_fizzy") === false ||
        calmedFact(world, state, "hooded-kid");
      break;
  }

  return {
    zone: spec.id,
    anchor: spec.anchor,
    restored,
    ringColor: spec.ringColor,
    ringAccent: spec.ringAccent,
    decals: spec.decals,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  const inv = 1 - c;
  return 1 - inv * inv * inv;
}

function easeOutBack(t: number): number {
  const c = clamp01(t);
  const c1 = 1.45;
  const c3 = c1 + 1;
  const inv = c - 1;
  return 1 + c3 * inv * inv * inv + c1 * inv * inv;
}

function hashSeed(text: string, index: number): number {
  let hash = Math.imul(index + 1, 2654435761) >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return hash / 0x100000000;
}

/**
 * Pure state-transition step for the 90-frame Watercolor Wash-Bloom Wipe (`calmPulse`).
 * - Instant (`calmPulse` snaps to 0 or 1, zero wipe) under Reduced Motion, paused
 *   harness mode, fresh arrival, area switch, or harness reset/rewind.
 * - Holds state untouched while battle/arcade hides the overworld so the wash-bloom
 *   wipe plays cleanly the moment Fae returns to the overworld after calming chaos.
 */
export function advanceRestorationPulse(
  previous: RestorationPulseState | null,
  areaId: string,
  restored: boolean,
  tick: number,
  options: { instant: boolean; overworldVisible: boolean },
): RestorationPulseStep {
  const step = (
    wasRestored: boolean,
    pulseStartTick: number | null,
    calmPulse: number,
    wiping: boolean,
  ): RestorationPulseStep => ({
    next: { areaId, wasRestored, pulseStartTick, lastTick: tick },
    calmPulse,
    wiping,
  });

  if (
    !options.overworldVisible &&
    previous !== null &&
    previous.areaId === areaId &&
    tick >= previous.lastTick
  ) {
    const settled = previous.wasRestored ? 1 : 0;
    const calmPulse = previous.pulseStartTick !== null
      ? clamp01((tick - previous.pulseStartTick) / RESTORATION_PULSE_TICKS)
      : settled;
    return step(previous.wasRestored, previous.pulseStartTick, calmPulse, false);
  }

  const resetContext =
    previous === null || previous.areaId !== areaId || tick < previous.lastTick;
  if (options.instant || resetContext) return step(restored, null, restored ? 1 : 0, false);
  if (!restored) return step(false, null, 0, false);
  // Live transition from chaotic -> restored in the same area: begin the 90-frame wipe!
  if (!previous.wasRestored) return step(true, tick, 0, true);
  if (previous.pulseStartTick !== null) {
    const elapsed = tick - previous.pulseStartTick;
    if (elapsed >= RESTORATION_PULSE_TICKS) return step(true, null, 1, false);
    return step(true, previous.pulseStartTick, clamp01(elapsed / RESTORATION_PULSE_TICKS), true);
  }
  return step(true, null, 1, false);
}

/** Computes the furthest decal distance from the zone anchor so the wipe clears every patch. */
export function restorationMaxRadius(status: RestorationStatus): number {
  let furthest = 320;
  for (const item of status.decals) {
    const dist = Math.hypot(item.x - status.anchor.x, item.y - status.anchor.y);
    if (dist > furthest) furthest = dist;
  }
  return furthest + 180;
}

/**
 * Evaluates all per-decal transforms, the expanding watercolor wash-bloom ring,
 * and the drifting petal/sparkle burst for the current frame.
 */
export function evaluateRestorationFrame(
  status: RestorationStatus,
  calmPulse: number,
  wiping: boolean,
  tick: number,
  steadyVisuals: boolean,
): RestorationFrame {
  const pulse = clamp01(calmPulse);
  const maxRadius = restorationMaxRadius(status);
  const waveBand = 160;
  const waveRadius = easeOutCubic(pulse) * (maxRadius + waveBand);

  const decals: DecalVisual[] = status.decals.map((spec, index) => {
    const phase = hashSeed(spec.id, index) * Math.PI * 2;
    const liveBreath = steadyVisuals ? 0 : Math.sin(tick * 0.045 + phase);
    const liveTilt = steadyVisuals ? 0 : Math.sin(tick * 0.032 + phase) * 0.025;
    const base = {
      id: spec.id,
      x: spec.x,
      y: spec.y,
      chaosFrame: spec.chaosFrame,
      chaosBlend: spec.chaosBlend,
      chaosTint: spec.chaosTint,
      bloomFrame: spec.bloomFrame,
      bloomBlend: spec.bloomBlend,
      bloomTint: spec.bloomTint,
    };

    if (!status.restored) {
      const shimmer = spec.chaosFrame === "chaos_fizzy_doodle" ? 1 + liveBreath * 0.04 : 1;
      return {
        ...base,
        chaosAlpha: clamp01(spec.chaosAlpha * shimmer),
        chaosScale: spec.scale * (1 + liveBreath * 0.015),
        chaosRotation: spec.chaosRotation + liveTilt * 0.5,
        bloomAlpha: 0,
        bloomScale: 0,
        bloomRotation: spec.bloomRotation,
      };
    }

    if (!wiping || pulse >= 1) {
      const dewShimmer =
        spec.bloomFrame === "bloom_sunbeam_dew" ? 1 + liveBreath * 0.09 : 1;
      const sway = spec.bloomFrame === "bloom_sunbeam_dew" ? 0 : liveTilt;
      return {
        ...base,
        chaosAlpha: 0,
        chaosScale: 0,
        chaosRotation: spec.chaosRotation,
        bloomAlpha: clamp01(spec.bloomAlpha * dewShimmer),
        bloomScale: spec.scale * (1 + liveBreath * 0.015),
        bloomRotation: spec.bloomRotation + sway,
      };
    }

    const dist = Math.hypot(spec.x - status.anchor.x, spec.y - status.anchor.y);
    const localT = clamp01((waveRadius - dist) / waveBand);
    const peel = clamp01(localT / 0.55);
    const unfurl = clamp01((localT - 0.25) / 0.75);

    return {
      ...base,
      chaosAlpha: spec.chaosAlpha * (1 - smoothstep(peel)),
      chaosScale: spec.scale * (1 - 0.18 * peel),
      chaosRotation: spec.chaosRotation + peel * 0.12,
      bloomAlpha: spec.bloomAlpha * smoothstep(unfurl),
      bloomScale: unfurl <= 0 ? 0 : spec.scale * (0.45 + 0.55 * easeOutBack(unfurl)),
      bloomRotation: spec.bloomRotation + (1 - smoothstep(unfurl)) * 0.08,
    };
  });

  const showFx = wiping && !steadyVisuals && pulse > 0 && pulse < 1;
  const envelope = Math.sin(pulse * Math.PI);
  const ring: RestorationRingVisual = {
    visible: showFx,
    x: status.anchor.x,
    y: status.anchor.y,
    radius: Math.max(24, waveRadius),
    thickness: 46 + 26 * envelope,
    alpha: showFx ? envelope * 0.78 : 0,
    outerColor: status.ringColor,
    innerColor: status.ringAccent,
    glowRadius: Math.max(70, waveRadius * 0.85),
    glowAlpha: showFx ? envelope * 0.34 : 0,
  };

  const petals: RestorationPetalVisual[] = [];
  if (showFx) {
    for (let i = 0; i < RESTORATION_PETAL_COUNT; i += 1) {
      const stagger = (i % 8) * 0.032;
      const local = clamp01((pulse - stagger) / Math.max(0.2, 1 - stagger));
      if (local <= 0 || local >= 1) continue;
      const angle = (i / RESTORATION_PETAL_COUNT) * Math.PI * 2 + hashSeed(status.zone, i) * 0.42;
      const bandFactor = i % 2 === 0
        ? 0.78 + hashSeed(`${status.zone}:spd`, i) * 0.24
        : 0.46 + hashSeed(`${status.zone}:spd`, i) * 0.34;
      const radius = waveRadius * bandFactor + 20;
      const flutter = Math.sin(local * Math.PI * 3 + i * 1.3) * 22;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);
      const isSparkle = i % 4 === 0;
      const fade = Math.sin(local * Math.PI);
      petals.push({
        texture: isSparkle ? "sparkle" : "petal",
        x: status.anchor.x + Math.cos(angle) * radius + perpX * flutter,
        y: status.anchor.y + Math.sin(angle) * radius + perpY * flutter - local * 34,
        scale: (isSparkle ? 0.72 : 1.18) + hashSeed(`${status.zone}:sc`, i) * 0.52,
        alpha: fade * (isSparkle ? 0.95 : 0.96),
        rotation: angle + local * (isSparkle ? 1.5 : 3.6),
        tint: PETAL_TINTS[i % PETAL_TINTS.length] ?? 0xf2a83c,
        blend: isSparkle ? "add" : "normal",
      });
    }
  }

  return {
    zone: status.zone,
    restored: status.restored,
    calmPulse: pulse,
    wiping: showFx,
    decals,
    ring,
    petals,
  };
}
