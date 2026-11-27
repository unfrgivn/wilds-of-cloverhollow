import {
  faeBox,
  type Area,
  type Critter,
  type Direction,
  type Npc,
  type PartyContent,
  type PartyMember,
  type Point,
  type PresentCritter,
  type State,
  type Surface,
  type Tunables,
  type World,
} from "../core";
import { assetUrl } from "../platform/assets";
import type { AmbientFlyer } from "../content/ambient";
import { facingToward } from "./animation";
import { interpolatePoint } from "./camera";
import type { RestSpot } from "./companions";
import {
  companionIdlePose,
  composePose,
  fairyHover,
  idleBreathing,
  NEUTRAL_POSE,
  roamerHop,
  sitSquash,
  walkPose,
  type MotionPose,
} from "./motion";

export const PET_REACTION_DURATION = 42;
export const PET_SPARKLE_TINTS: readonly number[] = [0xff9ebc, 0xf6c94c, 0x67d5c4];
export const LANTERN_MOTE_COUNT = 12;
export const LANTERN_MOTE_TINTS: readonly number[] = [0xd4b0ff, 0xe9d8ff, 0xb69eff];

export const INDOOR_AREAS = new Set([
  "bedroom",
  "kitchen",
  "school",
  "east-hall",
  "classroom",
  "gym",
  "music",
  "art-room",
  "arcade",
  "lodge",
  "clubhouse",
  "cafe",
  "market",
  "parlor",
  "sue-cottage",
  "jordan-cabin",
  "milo-house",
  "rosie-cottage",
]);

export const ADULT_NPCS = new Set([
  "mom",
  "dad",
  "teacher",
  "nurse",
  "coach",
  "music-teacher",
  "fern",
  "chef",
  "barnaby",
  "bree",
  "buster",
  "bay-keeper",
  "pass-keeper",
  "pippin",
  "penny",
]);

export const SURFACE_PUFFS: Record<Surface, { tint: number; alpha: number }> = {
  sand: { tint: 0xebd7b8, alpha: 0.45 },
  stone: { tint: 0xebd7b8, alpha: 0.45 },
  snow: { tint: 0xffffff, alpha: 0.55 },
  grass: { tint: 0xd3e8a8, alpha: 0.42 },
  wood: { tint: 0xefe2cc, alpha: 0.2 },
  tile: { tint: 0xefe2cc, alpha: 0.2 },
  carpet: { tint: 0xefe2cc, alpha: 0.2 },
};

export type EntityAtlas = { alias: string; src: string };

export type FootstepPuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornTick: number;
  life: number;
  tint: number;
  baseAlpha: number;
  baseScale: number;
  rotation: number;
};

export type ShadowTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
};

export type FlyerGlowTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  tint: number;
};

export type FlyerVisual = {
  shadow: ShadowTransform | null;
  glow: FlyerGlowTransform | null;
};

function flyerPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return ((hash >>> 0) / 0x100000000) * Math.PI * 2;
}

export function computeFlyerVisual(
  flyer: Pick<AmbientFlyer, "id" | "animation" | "size">,
  position: Point,
  tick: number,
  reducedMotion: boolean,
): FlyerVisual {
  if (flyer.animation.startsWith("butterfly")) {
    return {
      shadow: {
        x: position.x,
        y: position.y + 18,
        width: flyer.size * 0.72,
        height: flyer.size * 0.28,
        alpha: 0.16,
      },
      glow: null,
    };
  }
  if (flyer.animation === "fairy_light") {
    const phase = flyerPhase(flyer.id);
    const alpha = reducedMotion
      ? 0.44
      : 0.34 + 0.24 * (0.5 + 0.5 * Math.sin(tick * 0.08 + phase));
    return {
      shadow: null,
      glow: {
        x: position.x,
        y: position.y,
        width: flyer.size * 2.6,
        height: flyer.size * 2.6,
        alpha,
        tint: 0xffe484,
      },
    };
  }
  return { shadow: null, glow: null };
}

export type CompanionEmoteSpec = {
  textureKey: "emoteHeart" | "sparkle" | "emoteNote";
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
  tint: number;
  blend: "normal" | "add";
};

export function facingBackVector(facing: Direction): Point {
  if (facing === "left") return { x: 1, y: 0 };
  if (facing === "right") return { x: -1, y: 0 };
  if (facing === "up") return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

export function liftShadowScale(offsetY: number): number {
  const lift = Math.max(0, -offsetY);
  return Math.max(0.76, 1 - lift * 0.02);
}

export function warmFlashTint(flash: number): number {
  if (flash <= 0.005) return 0xffffff;
  const t = Math.min(1, Math.max(0, flash));
  const r = 255;
  const g = Math.round(255 - (255 - 0xb4) * t);
  const b = Math.round(255 - (255 - 0xa2) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Unique per-area NPC and critter spritesheets, excluding party members
 * (which stay resident across areas). Loaded with the area and evicted on the
 * same current + previous residency window as AreaView textures (spec 4).
 */
export function areaEntityAtlases(world: World, area: Area): EntityAtlas[] {
  const seen = new Set<string>();
  const result: EntityAtlas[] = [];
  const add = (alias: string, atlas: string): void => {
    if (seen.has(alias)) return;
    seen.add(alias);
    result.push({ alias, src: assetUrl(atlas) });
  };
  for (const npc of area.npcs) {
    if (world.party[npc.id] !== undefined) continue;
    if (npc.visibleWhenCalmed !== undefined) {
      const critter = world.critters[npc.visibleWhenCalmed];
      if (critter !== undefined) add(critter.atlas, critter.atlas);
      continue;
    }
    const character = world.characters[npc.id];
    if (character !== undefined) add(`${npc.id}-sheet`, character.atlas);
  }
  const critterIds = [
    ...area.critters.map((piece) => piece.id),
    ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
  ];
  for (const id of critterIds) {
    const critter = world.critters[id];
    if (critter !== undefined) add(critter.atlas, critter.atlas);
  }
  return result;
}

export function computeFaePose(
  state: State,
  livingMotion: boolean,
  walkCycleUnits: number,
  playerPos: Point,
  activeRest: { spot: RestSpot; elapsed: number } | null,
  activePet: { id: string; elapsed: number } | null,
): MotionPose {
  let pose: MotionPose = !livingMotion
    ? NEUTRAL_POSE
    : state.motion.moving
      ? walkPose(state.motion.distance, walkCycleUnits, true)
      : activeRest !== null
        ? {
            offsetX: 0,
            offsetY: 3,
            scaleX: 1.04 - Math.sin(activeRest.elapsed * 0.055) * 0.01,
            scaleY: 0.94 + Math.sin(activeRest.elapsed * 0.055) * 0.015,
            rotation: Math.sin(activeRest.elapsed * 0.04) * 0.025,
          }
        : idleBreathing(state.tick, 0);
  if (livingMotion && activePet !== null && activePet.elapsed < 22 && !state.motion.moving) {
    const petMember = state.party.find((item) => item.id === activePet.id);
    const nodDir = petMember !== undefined && petMember.x < playerPos.x ? -1 : 1;
    const nod = Math.sin((activePet.elapsed / 22) * Math.PI) * 0.05 * nodDir;
    pose = { ...pose, rotation: pose.rotation + nod };
  }
  return pose;
}

export type PartyFollowerTransform = {
  animation: string;
  frame: number;
  mirror: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  zIndex: number;
  shadow: ShadowTransform;
};

export function computePartyFollowerTransform(
  member: PartyMember,
  content: PartyContent,
  state: State,
  index: number,
  pos: Point,
  partner: Point | null,
  shadowAlpha: number,
  livingMotion: boolean,
  follow: Tunables["follow"],
  activePet: { id: string; elapsed: number } | null,
  frameCountFor: (animation: string) => number,
): PartyFollowerTransform {
  const beingPetted = activePet !== null && activePet.id === member.id;
  const settled = !content.sits && !member.motion.moving &&
    member.stillTicks >= follow.settleDelayTicks;
  const facing = beingPetted && !member.motion.moving
    ? facingToward(member, state.player)
    : settled
      ? (partner !== null ? facingToward(member, partner) : state.facing)
      : member.facing;
  const side = facing === "right" ? "left" : facing;
  const mirror = facing === "right";
  const resting = !member.motion.moving &&
    (!content.sits || member.stillTicks >= follow.sitDelayTicks);
  const animation = resting ? `idle_${side}` : `walk_${side}`;
  const frameCount = frameCountFor(animation);
  const frame = member.motion.moving && frameCount > 0
    ? Math.floor((member.motion.distance / content.walkCycleUnits) * frameCount) % frameCount
    : 0;

  let pose: MotionPose = NEUTRAL_POSE;
  if (livingMotion) {
    const isSideBounder = member.id === "acorn-squirrel" &&
      (member.facing === "left" || member.facing === "right");
    if (member.motion.moving) {
      pose = walkPose(member.motion.distance, content.walkCycleUnits, true, isSideBounder);
    } else {
      pose = companionIdlePose(member.id, member.stillTicks, state.tick, index);
      if (content.sits) {
        pose = composePose(pose, sitSquash(member.stillTicks, follow.sitDelayTicks));
      }
    }
    if (beingPetted) {
      const e = activePet.elapsed;
      const decay = Math.max(0, 1 - e / PET_REACTION_DURATION);
      const hop = Math.abs(Math.sin(e / 4.2));
      pose = composePose(pose, {
        offsetX: 0,
        offsetY: -hop * 14 * (0.45 + 0.55 * decay),
        scaleX: 1 + (0.08 * (1 - hop) - 0.06 * hop) * decay,
        scaleY: 1 + (0.08 * hop - 0.06 * (1 - hop)) * decay,
        rotation: Math.sin(e / 3.8) * 0.12 * decay,
      });
    }
  }
  const baseScale = content.scale ?? 0.5;
  const shadowScale = liftShadowScale(pose.offsetY);
  const shadowWidth = content.box.width * 0.92 * shadowScale;
  return {
    animation,
    frame,
    mirror,
    x: pos.x + pose.offsetX,
    y: pos.y + pose.offsetY,
    scaleX: (mirror ? -baseScale : baseScale) * pose.scaleX,
    scaleY: baseScale * pose.scaleY,
    rotation: pose.rotation,
    zIndex: pos.y,
    shadow: {
      x: pos.x,
      y: pos.y,
      width: shadowWidth,
      height: shadowWidth * 0.38,
      alpha: shadowAlpha * shadowScale,
    },
  };
}

export function resolveNpcTextureFrame(
  animations: Record<string, string[]> | undefined,
  facing: Direction,
  idleTicks: readonly number[],
  tick: number,
): { animation: string; mirror: boolean; frameName: string | undefined } {
  const wanted = `idle_${facing}`;
  const mirror =
    facing === "right" &&
    animations?.[wanted] === undefined &&
    animations?.idle_left !== undefined;
  const animation = mirror
    ? "idle_left"
    : animations?.[wanted] !== undefined
      ? wanted
      : "idle_down";
  const names = animations?.[animation] ?? [];
  let index = 0;
  if (animation === "idle_down" && names.length === idleTicks.length && idleTicks.length > 0) {
    const cycle = idleTicks.reduce((sum, ticks) => sum + ticks, 0);
    let left = tick % cycle;
    while (left >= (idleTicks[index] ?? cycle)) {
      left -= idleTicks[index] ?? cycle;
      index += 1;
    }
  }
  return { animation, mirror, frameName: names[index] ?? names[0] };
}

export function computeNpcOverworldHeight(npc: Npc, critter: Critter | undefined): number {
  if (critter !== undefined) return critter.overworldHeight;
  if (npc.id === "oliver" || npc.id.startsWith("fairy-")) return 72;
  return ADULT_NPCS.has(npc.id) ? 132 : 114;
}

export function computeNpcPose(
  npcId: string,
  npcIndex: number,
  tick: number,
  livingMotion: boolean,
): MotionPose {
  if (!livingMotion || npcId === "bus-stop") return NEUTRAL_POSE;
  if (npcId.startsWith("fairy-")) return fairyHover(tick, npcIndex);
  return idleBreathing(tick, (npcIndex + 1) * 0.9);
}

export function computeNpcShadow(
  npcId: string,
  point: Point,
  pose: MotionPose,
  shadowAlpha: number,
  adultOverride?: boolean,
): ShadowTransform {
  if (npcId.startsWith("fairy-")) {
    const altScale = liftShadowScale(pose.offsetY);
    return {
      x: point.x,
      y: point.y + 8,
      width: 28 * altScale,
      height: 12 * altScale,
      alpha: 0.24 * altScale,
    };
  }
  const isAdult = adultOverride ?? ADULT_NPCS.has(npcId);
  const width = npcId === "oliver" ? 34 : isAdult ? 52 : 48;
  const hopScale = liftShadowScale(pose.offsetY);
  return {
    x: point.x,
    y: point.y,
    width: width * hopScale,
    height: width * 0.38 * hopScale,
    alpha: shadowAlpha * hopScale,
  };
}

export function computeRoamerBobAndFacing(
  critter: PresentCritter,
  state: State,
  index: number,
  point: Point,
  noticeTicks: number,
  livingMotion: boolean,
): { calm: boolean; frame: "calm_idle_01" | "chaos_idle_01"; flipX: boolean; pose: MotionPose } {
  const calm = critter.mood === "calm";
  const frame = calm ? "calm_idle_01" : "chaos_idle_01";
  const roamer = critter.wild;
  const talking = calm && state.dialogue !== null && state.dialogue.knot === critter.kind.calmKnot;
  const flipX = talking
    ? state.player.x > point.x
    : roamer !== null && roamer.facing === "right";
  const pose = !livingMotion
    ? NEUTRAL_POSE
    : roamer !== null
      ? roamerHop(
          state.tick,
          roamer.moving,
          roamer.notice >= noticeTicks,
          roamer.notice,
          noticeTicks,
          roamer.facing,
        )
      : idleBreathing(state.tick, (index + 1) * 1.1, calm ? 0.012 : 0.02);
  return { calm, frame, flipX, pose };
}

export function computeCritterShadow(
  point: Point,
  overworldHeight: number,
  offsetY: number,
  shadowAlpha: number,
): ShadowTransform {
  const baseWidth = Math.min(76, Math.max(36, overworldHeight * 0.56));
  const hopScale = liftShadowScale(offsetY);
  return {
    x: point.x,
    y: point.y,
    width: baseWidth * hopScale,
    height: baseWidth * 0.38 * hopScale,
    alpha: shadowAlpha * hopScale,
  };
}

export function spawnFootstepPuffs(
  playerPos: Point,
  facing: Direction,
  surface: Surface,
  stride: number,
  tick: number,
): FootstepPuff[] {
  const style = SURFACE_PUFFS[surface];
  const back = facingBackVector(facing);
  const side = stride % 2 === 0 ? 1 : -1;
  const perpX = -back.y;
  const perpY = back.x;
  return [
    {
      x: playerPos.x + back.x * 8 + perpX * side * 6,
      y: playerPos.y - 2 + back.y * 5 + perpY * side * 3,
      vx: back.x * 0.45 + perpX * side * 0.25,
      vy: back.y * 0.25 - 0.35,
      bornTick: tick,
      life: 18,
      tint: style.tint,
      baseAlpha: style.alpha,
      baseScale: 0.24,
      rotation: (stride * 0.7) % (Math.PI * 2),
    },
    {
      x: playerPos.x + back.x * 14 - perpX * side * 5,
      y: playerPos.y - 1 + back.y * 7 - perpY * side * 3,
      vx: back.x * 0.6 - perpX * side * 0.18,
      vy: back.y * 0.2 - 0.45,
      bornTick: tick,
      life: 18,
      tint: style.tint,
      baseAlpha: style.alpha * 0.85,
      baseScale: 0.18,
      rotation: (stride * 1.3 + 1.1) % (Math.PI * 2),
    },
  ];
}

export function spawnNpcFootstepPuff(
  pos: Point,
  facing: Direction,
  surface: Surface,
  stride: number,
  tick: number,
): FootstepPuff {
  const style = SURFACE_PUFFS[surface];
  const back = facingBackVector(facing);
  const side = stride % 2 === 0 ? 1 : -1;
  const perpX = -back.y;
  const perpY = back.x;
  return {
    x: pos.x + back.x * 7 + perpX * side * 5,
    y: pos.y - 1 + back.y * 4 + perpY * side * 2.5,
    vx: back.x * 0.32 + perpX * side * 0.18,
    vy: back.y * 0.18 - 0.25,
    bornTick: tick,
    life: 16,
    tint: style.tint,
    baseAlpha: style.alpha * 0.72,
    baseScale: 0.19,
    rotation: (stride * 0.9 + 0.5) % (Math.PI * 2),
  };
}

export function computeLanternMote(
  index: number,
  count: number,
  centerX: number,
  centerY: number,
  tick: number,
  blend: number,
  reducedMotion = false,
): { x: number; y: number; scale: number; alpha: number } {
  const baseRadius = 46 + ((index * 53) % 165);
  if (reducedMotion) {
    const angle = (index / count) * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * baseRadius,
      y: centerY + Math.sin(angle) * baseRadius * 0.72,
      scale: 0.24 + (index % 3) * 0.11,
      alpha: 0.42 * blend,
    };
  }
  const speed = 0.012 + (index % 4) * 0.004;
  const angle = (index / count) * Math.PI * 2 + tick * speed * (index % 2 === 0 ? 1 : -1);
  const radius = baseRadius + Math.sin(tick * 0.03 + index * 1.7) * 16;
  const twinkle = 0.5 + 0.5 * Math.sin(tick * 0.08 + index * 1.9);
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius * 0.72,
    scale: 0.24 + (index % 3) * 0.11,
    alpha: (0.24 + 0.36 * twinkle) * blend,
  };
}

export function computeCompanionEmoteSpecs(
  petPos: Point | null,
  petHeight: number,
  petElapsed: number | null,
  playerPos: Point,
  restElapsed: number | null,
  reducedMotion = false,
): CompanionEmoteSpec[] {
  const items: CompanionEmoteSpec[] = [];
  if (petPos !== null && petElapsed !== null) {
    const offsets: readonly [number, number, number][] = [
      [-16, 0, 0.72],
      [0, 7, 0.82],
      [16, 14, 0.68],
    ];
    offsets.forEach(([dx, delay, baseScale], idx) => {
      const age = petElapsed - delay;
      const life = PET_REACTION_DURATION - delay;
      if (age < 0 || age >= life) return;
      const fadeIn = Math.min(1, (age + 1) / 5);
      const fadeOut = Math.min(1, (life - age) / 10);
      if (reducedMotion) {
        items.push({
          textureKey: "emoteHeart",
          x: petPos.x + dx,
          y: petPos.y - petHeight - 18,
          scale: baseScale,
          alpha: 0.96 * fadeIn * fadeOut,
          rotation: 0,
          tint: 0xffffff,
          blend: "normal",
        });
        items.push({
          textureKey: "sparkle",
          x: petPos.x - dx * 1.1,
          y: petPos.y - petHeight - 8,
          scale: 0.5,
          alpha: 0.94 * fadeIn * fadeOut,
          rotation: 0,
          tint: PET_SPARKLE_TINTS[idx % PET_SPARKLE_TINTS.length] ?? 0xff9ebc,
          blend: "normal",
        });
        return;
      }
      const progress = age / life;
      items.push({
        textureKey: "emoteHeart",
        x: petPos.x + dx + Math.sin(progress * Math.PI * 2 + idx) * 4,
        y: petPos.y - petHeight - 14 - age * 1.15,
        scale: baseScale * (0.72 + 0.28 * fadeIn),
        alpha: 0.96 * fadeIn * fadeOut,
        rotation: Math.sin(progress * Math.PI * 2 + idx) * 0.14,
        tint: 0xffffff,
        blend: "normal",
      });
      items.push({
        textureKey: "sparkle",
        x: petPos.x - dx * 1.1 + Math.cos(progress * Math.PI * 2 + idx) * 6,
        y: petPos.y - petHeight - 4 - age * 0.95,
        scale: 0.46 + 0.18 * (1 - progress),
        alpha: 0.94 * fadeIn * fadeOut,
        rotation: age * 0.08 + idx,
        tint: PET_SPARKLE_TINTS[idx % PET_SPARKLE_TINTS.length] ?? 0xff9ebc,
        blend: "normal",
      });
    });
  }
  if (restElapsed !== null) {
    if (reducedMotion) {
      items.push({
        textureKey: "emoteNote",
        x: playerPos.x + 12,
        y: playerPos.y - faeBox.height - 22,
        scale: 0.66,
        alpha: 0.85,
        rotation: 0,
        tint: 0xffffff,
        blend: "normal",
      });
    } else {
      const cycle = (restElapsed % 90) / 90;
      const envelope = Math.sin(cycle * Math.PI);
      items.push({
        textureKey: "emoteNote",
        x: playerPos.x + 12 + Math.sin(cycle * Math.PI * 2) * 6,
        y: playerPos.y - faeBox.height - 18 - cycle * 22,
        scale: 0.56 + 0.18 * envelope,
        alpha: 0.9 * envelope,
        rotation: Math.sin(cycle * Math.PI * 2) * 0.14,
        tint: 0xffffff,
        blend: "normal",
      });
    }
  }
  return items;
}

export type BackdropTransform = {
  cover: number;
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number };
};

export function computeBackdropTransform(
  area: { width: number; height: number },
  focus: Point,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  zoom: number,
): BackdropTransform {
  const insetX = area.width * 0.08;
  const insetY = area.height * 0.08;
  const margin = 32;
  const baseCover = Math.max(
    (width + margin * 2) / (area.width - insetX * 2),
    (height + margin * 2) / (area.height - insetY * 2),
    Math.min(width / viewWidth, height / viewHeight),
  );
  const cover = baseCover * zoom;
  const clamp = (value: number, low: number, high: number): number =>
    Math.min(high, Math.max(low, value));
  const x = clamp(
    width / 2 - focus.x * cover,
    width + margin - (area.width - insetX) * cover,
    -margin - insetX * cover,
  );
  const y = clamp(
    height / 2 - focus.y * cover,
    height + margin - (area.height - insetY) * cover,
    -margin - insetY * cover,
  );
  return { cover, x, y, bounds: { x, y, width: area.width * cover, height: area.height * cover } };
}

export function computeLanternBlend(
  currentBlend: number,
  lastTick: number | undefined,
  tick: number,
  on: boolean,
  snap: boolean,
): number {
  const target = on ? 1 : 0;
  if (snap || lastTick === undefined || tick < lastTick || tick - lastTick > 18) return target;
  if (tick > lastTick) {
    const gap = target - currentBlend;
    return currentBlend + Math.sign(gap) * Math.min(Math.abs(gap), 0.12 * (tick - lastTick));
  }
  return currentBlend;
}

export function computeGlowTransform(
  glow: Area["glows"][number],
  player: Point,
  tick: number,
  index: number,
  lanternBlend: number,
  reducedMotion = false,
): { scaleX: number; scaleY: number; alpha: number } {
  const dx = glow.point.x - player.x;
  const dy = glow.point.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const proximity = dist >= 320 ? 0.78 : 0.78 + 0.22 * (1 - dist / 320);
  const pulse = reducedMotion ? 0.88 : 0.84 + Math.sin(tick / 24 + index * 1.15) * 0.12;
  const s = reducedMotion ? 0.5 : 0.5 * (1 + 0.025 * Math.sin(tick / 18 + index * 1.15));
  return {
    scaleX: glow.flip === true ? -s : s,
    scaleY: s,
    alpha: Math.min(1, pulse * proximity) * Math.max(0.35, lanternBlend),
  };
}

export type StarGemGlint = {
  id: string;
  x: number;
  y: number;
  haloSize: number;
  haloAlpha: number;
  haloTint: number;
  starScale: number;
  starAlpha: number;
  starRotation: number;
};

const STAR_GEM_KNOT_VARIABLES: Readonly<Record<string, string>> = {
  park_gem: "gem_park",
  bay_gem: "gem_bay",
  trail_gem: "gem_trail",
  pass_gem: "gem_pass",
  cavern_gem: "gem_cavern",
  woods_gem: "gem_woods",
  hills_gem: "gem_hills",
};

const STAR_GEM_HALO_PALETTE: readonly [number, number, number] = [
  0xd4b2ff,
  0x9be7f2,
  0xffe58f,
];

function lerpTint(from: number, to: number, t: number): number {
  const r0 = (from >> 16) & 0xff;
  const g0 = (from >> 8) & 0xff;
  const b0 = from & 0xff;
  const r1 = (to >> 16) & 0xff;
  const g1 = (to >> 8) & 0xff;
  const b1 = to & 0xff;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return (r << 16) | (g << 8) | b;
}

function prismaticHaloTint(tick: number): number {
  const phase = ((tick * 0.025) % 3 + 3) % 3;
  const index = Math.floor(phase);
  const nextIndex = (index + 1) % 3;
  const frac = phase - index;
  const smooth = frac * frac * (3 - 2 * frac);
  const from = STAR_GEM_HALO_PALETTE[index] ?? 0xffe58f;
  const to = STAR_GEM_HALO_PALETTE[nextIndex] ?? 0xffe58f;
  return lerpTint(from, to, smooth);
}

/**
 * Pure evaluator for prismatic overworld Star Gem glints in the current area.
 * Open-air interactable gems shimmer whenever uncollected; blacklight-secret glow
 * gems (`park_gem`, `cavern_gem`) shimmer only while Fae's lantern is active.
 */
export function evaluateStarGemGlints(
  world: World,
  state: State,
  reducedMotion: boolean,
): StarGemGlint[] {
  if (state.battle !== null || state.arcade !== null || state.area === "harness") return [];
  const area = world.areas[state.area];
  if (area === undefined) return [];

  const tick = state.tick;
  const bobY = reducedMotion ? 0 : Math.sin(tick * 0.09) * 3;
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(tick * 0.11);
  const haloSize = 38 + 8 * pulse;
  const haloAlpha = reducedMotion ? 0.42 : 0.36 + 0.18 * pulse;
  const haloTint = reducedMotion ? 0xffe58f : prismaticHaloTint(tick);
  const starScale = 0.34 + 0.12 * pulse;
  const starAlpha = 0.88;
  const fullTurn = Math.PI * 2;
  const starRotation = reducedMotion ? 0 : ((tick * 0.035) % fullTurn + fullTurn) % fullTurn;

  const glints: StarGemGlint[] = [];
  for (const item of area.interactables) {
    const variable = STAR_GEM_KNOT_VARIABLES[item.knot];
    if (variable === undefined) continue;
    if (world.storyVariable(state.ink, variable) === true) continue;
    glints.push({
      id: item.id,
      x: item.point.x,
      y: item.point.y - 12 + bobY,
      haloSize,
      haloAlpha,
      haloTint,
      starScale,
      starAlpha,
      starRotation,
    });
  }
  if (state.lantern) {
    for (const glow of area.glows) {
      if (glow.knot === undefined) continue;
      const variable = STAR_GEM_KNOT_VARIABLES[glow.knot];
      if (variable === undefined) continue;
      if (world.storyVariable(state.ink, variable) === true) continue;
      glints.push({
        id: glow.id,
        x: glow.point.x,
        y: glow.point.y - 12 + bobY,
        haloSize,
        haloAlpha,
        haloTint,
        starScale,
        starAlpha,
        starRotation,
      });
    }
  }
  return glints;
}

export function computeOverworldEmoteInputs(
  world: World,
  state: State,
  present: readonly PresentCritter[],
  previousState: State | undefined,
  alpha: number,
): {
  roamers: {
    x: number;
    y: number;
    height: number;
    notice: number;
    noticeTicks: number;
    chasing: boolean;
  }[];
  calmedCritters: { x: number; y: number; height: number; index: number }[];
  nappingMembers: { x: number; y: number; height: number; stillTicks: number; index: number }[];
} {
  const noticeTicks = world.tunables.roam.noticeTicks;
  const roamers: {
    x: number;
    y: number;
    height: number;
    notice: number;
    noticeTicks: number;
    chasing: boolean;
  }[] = [];
  const calmedCritters: { x: number; y: number; height: number; index: number }[] = [];
  present.forEach((critter, index) => {
    const roamer = critter.wild;
    const prevWild = roamer === null || previousState === undefined
      ? undefined
      : previousState.wild.find(
          (item) => item.den === roamer.den && item.kind === roamer.kind,
        );
    const pt = prevWild !== undefined && alpha < 1
      ? interpolatePoint(prevWild, critter.point, alpha)
      : critter.point;
    if (roamer !== null && critter.mood === "chaos") {
      roamers.push({
        x: pt.x,
        y: pt.y,
        height: critter.kind.overworldHeight,
        notice: roamer.notice,
        noticeTicks,
        chasing: roamer.notice >= noticeTicks,
      });
    } else if (critter.mood === "calm") {
      calmedCritters.push({
        x: pt.x,
        y: pt.y,
        height: critter.kind.overworldHeight,
        index,
      });
    }
  });
  const nappingMembers: {
    x: number;
    y: number;
    height: number;
    stillTicks: number;
    index: number;
  }[] = [];
  state.party.forEach((member, index) => {
    if (member.id !== "maddie") return;
    const content = world.party[member.id];
    if (content === undefined) return;
    const prevMember = previousState?.party.find((item) => item.id === member.id);
    const pos = prevMember !== undefined && alpha < 1
      ? interpolatePoint(prevMember, member, alpha)
      : member;
    nappingMembers.push({
      x: pos.x,
      y: pos.y,
      height: content.box.height,
      stillTicks: member.stillTicks,
      index,
    });
  });
  return { roamers, calmedCritters, nappingMembers };
}
