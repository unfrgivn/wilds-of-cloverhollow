import type { Point, World } from "../core";
import type { BattleStageMood, BattleVfxParticle } from "./battle-choreography";

export const FLUTE_CAMEO_DURATION = 45;

export type BattleStageMoodStyle = {
  waveA: number;
  waveB: number;
  alpha: number;
  pulse: boolean;
  spotlightTint: number;
};

export const BATTLE_STAGE_MOODS: Record<BattleStageMood, BattleStageMoodStyle> = {
  "calm-normal": {
    waveA: 0xfff2cf,
    waveB: 0xfff2cf,
    alpha: 0.15,
    pulse: false,
    spotlightTint: 0xfff8e6,
  },
  windup: {
    waveA: 0xe5c4ff,
    waveB: 0xffc8d8,
    alpha: 0.2,
    pulse: false,
    spotlightTint: 0xf7e8ff,
  },
  "together-ready": {
    waveA: 0xffe794,
    waveB: 0xfff4c2,
    alpha: 0.22,
    pulse: false,
    spotlightTint: 0xfff3c8,
  },
  "together-active": {
    waveA: 0x5c3e80,
    waveB: 0xf7c33e,
    alpha: 0.3,
    pulse: true,
    spotlightTint: 0xffe484,
  },
  soothed: {
    waveA: 0xc4f2dc,
    waveB: 0xfff2c2,
    alpha: 0.24,
    pulse: false,
    spotlightTint: 0xf2fff7,
  },
};

export type StageLayerPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
  alpha: number;
};

export function computeBattleStageMoodLayout(
  mood: BattleStageMood,
  tick: number,
  viewWidth: number,
  viewHeight: number,
): {
  waveA: StageLayerPlacement;
  waveB: StageLayerPlacement;
  spotlight: StageLayerPlacement;
} {
  const stageMood = BATTLE_STAGE_MOODS[mood];
  const driftA = Math.sin(tick * 0.025);
  const driftB = Math.cos(tick * 0.019);
  const pulseBoost = stageMood.pulse ? 1 + 0.08 * Math.sin(tick * 0.22) : 1;
  return {
    waveA: {
      x: viewWidth * 0.45 + driftA * 32,
      y: viewHeight * 0.42 + driftB * 14,
      width: viewWidth * 0.54 * pulseBoost,
      height: viewHeight * 0.36 * pulseBoost,
      tint: stageMood.waveA,
      alpha: stageMood.alpha,
    },
    waveB: {
      x: viewWidth * 0.43 + driftB * 36,
      y: viewHeight * 0.5 + driftA * 14,
      width: viewWidth * 0.5 * pulseBoost,
      height: viewHeight * 0.34 * pulseBoost,
      tint: stageMood.waveB,
      alpha: stageMood.alpha * 0.85,
    },
    spotlight: {
      x: viewWidth * 0.44,
      y: viewHeight * 0.46,
      width: viewWidth * 0.68 * pulseBoost,
      height: viewHeight * 0.62 * pulseBoost,
      tint: stageMood.spotlightTint,
      alpha: stageMood.pulse ? 0.44 : 0.16,
    },
  };
}

export function resolveFluteCameoIds(world: World, ink: string, message: string): string[] {
  const cameoIds: string[] = [];
  if (message.includes("Pond Pup")) cameoIds.push("pond-pup");
  if (message.includes("Acorn Squirrel")) cameoIds.push("acorn-squirrel");
  if (message.includes("Ribbon Bunny")) cameoIds.push("ribbon-bunny");
  if (cameoIds.length === 0) {
    if (world.storyVariable(ink, "pup_friend") === true) cameoIds.push("pond-pup");
    if (world.storyVariable(ink, "squirrel_friend") === true) cameoIds.push("acorn-squirrel");
    if (world.storyVariable(ink, "bunny_friend") === true) cameoIds.push("ribbon-bunny");
  }
  return cameoIds;
}

export type FluteCameoActor = {
  id: string;
  x: number;
  y: number;
  hopY: number;
  rotation: number;
  baseScale: number;
  alpha: number;
  shadowWidth: number;
  shadowHeight: number;
  shadowAlpha: number;
};

export type FluteCameoSparkle = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  alpha: number;
  tint: number;
};

function liftShadowScale(offsetY: number): number {
  const lift = Math.max(0, -offsetY);
  return Math.max(0.76, 1 - lift * 0.02);
}

export function evaluateFluteCameo(input: {
  ids: readonly string[];
  showingFluteLine: boolean;
  cameoElapsed: number;
  tick: number;
  faeX: number;
  faeY: number;
  party: World["party"];
}): { actors: FluteCameoActor[]; sparkles: FluteCameoSparkle[] } {
  const { ids, showingFluteLine, cameoElapsed, tick, faeX, faeY, party } = input;
  const active =
    (showingFluteLine || (cameoElapsed >= 0 && cameoElapsed < FLUTE_CAMEO_DURATION)) &&
    ids.length > 0;
  if (!active) return { actors: [], sparkles: [] };

  const cameoAlpha = showingFluteLine
    ? 1
    : Math.max(0, Math.min(1, (FLUTE_CAMEO_DURATION - cameoElapsed) / 8));
  const actors: FluteCameoActor[] = [];
  const sparkles: FluteCameoSparkle[] = [];

  ids.forEach((id, idx) => {
    const content = party[id];
    if (content === undefined) return;
    const baseScale = ((content.scale ?? 0.5) / 0.5) * 0.58;
    const hopY = -Math.abs(Math.sin((tick + idx * 4) / 6)) * 16;
    const cameoX = faeX + 106 + idx * 48;
    const cameoY = faeY + 16 - idx * 8;
    const lift = liftShadowScale(hopY);
    const shadowWidth = content.box.width * 1.15 * lift;
    actors.push({
      id,
      x: cameoX,
      y: cameoY,
      hopY,
      rotation: Math.sin((tick + idx * 4) / 6) * 0.08,
      baseScale,
      alpha: cameoAlpha,
      shadowWidth,
      shadowHeight: shadowWidth * 0.36,
      shadowAlpha: 0.3 * cameoAlpha * lift,
    });
    for (let s = 0; s < 4; s += 1) {
      const angle = (s / 4) * Math.PI * 2 + tick * 0.14 + idx;
      sparkles.push({
        x: cameoX + Math.cos(angle) * 34,
        y: cameoY - 46 + hopY * 0.5 + Math.sin(angle) * 20,
        scale: 0.42 + (s % 2) * 0.16,
        rotation: tick * 0.1 + s,
        alpha: 0.94 * cameoAlpha,
        tint: s % 2 === 0 ? 0x67d5c4 : 0xf5b82e,
      });
    }
  });

  return { actors, sparkles };
}

export type BattleVfxAnchors = {
  fae: Point;
  critter: Point;
  party: ReadonlyMap<string, Point>;
};

export function resolveBattleVfxPosition(
  particle: BattleVfxParticle,
  anchors: BattleVfxAnchors,
): Point {
  let baseX = anchors.critter.x;
  let baseY = anchors.critter.y;
  if (particle.anchor === "fae") {
    baseX = anchors.fae.x;
    baseY = anchors.fae.y;
  } else if (particle.anchor === "between") {
    const t = particle.t ?? 0.5;
    baseX = anchors.fae.x + (anchors.critter.x - anchors.fae.x) * t;
    baseY = anchors.fae.y + (anchors.critter.y - anchors.fae.y) * t;
  } else if (particle.anchor === "party" && particle.actorId !== undefined) {
    const actorAnchor = anchors.party.get(particle.actorId);
    if (actorAnchor !== undefined) {
      baseX = actorAnchor.x;
      baseY = actorAnchor.y;
    }
  }
  return { x: baseX + particle.offsetX, y: baseY + particle.offsetY };
}
