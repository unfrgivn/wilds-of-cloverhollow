import {
  cutsceneSpriteIds,
  faeBox,
  npcLivePoint,
  type Area,
  type CutsceneEffectKind,
  type CutsceneEffectState,
  type CutsceneEmoteKind,
  type CutscenePose,
  type CutsceneTempActor,
  type CutsceneView,
  type Direction,
  type Point,
  type State,
  type World,
} from "../core";
import { assetUrl } from "../platform/assets";
import type { EmoteTextureKey } from "./emotes";
import { NEUTRAL_POSE, type MotionPose } from "./motion";
import { isAdultNpc } from "./npc-life";
import type { EntityAtlas } from "./overworld-render";
import type { ViewportRect } from "./view-projections";

export const CUTSCENE_LETTERBOX_MAX_PX = 24;

export type CutsceneRenderInfo = {
  id: string;
  tick: number;
  stepIndex: number;
  letterboxPx: number;
  camera: { x: number; y: number; zoom: number } | null;
  tempActors: { id: string; sprite: string; x: number; y: number; facing: Direction }[];
  emotes: { actor: string; kind: CutsceneEmoteKind }[];
  effects: { kind: CutsceneEffectKind; x: number; y: number }[];
  skipProgress: number;
};

export type CutsceneBurstParticle = {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
  tint: number;
  shape: "puff" | "sparkle";
  additive: boolean;
};

export type CutsceneUpdateParams = {
  state: State;
  previousState: State | undefined;
  alpha: number;
  playerPos: Point;
  shadowAlpha: number;
  livingMotion: boolean;
  reducedMotion: boolean;
  viewportRect: ViewportRect;
  overworldVisible: boolean;
};

const CUTSCENE_EMOTE_TEXTURES: Record<CutsceneEmoteKind, EmoteTextureKey> = {
  exclaim: "emoteExclaim",
  question: "emoteQuestion",
  heart: "emoteHeart",
  sparkle: "emoteSparkle",
  note: "emoteNote",
  wave: "emoteWave",
  worry: "emoteWorry",
  zzz: "emoteZzz",
};

export function computeLetterboxHeight(
  view: CutsceneView | null,
  viewportHeight: number,
  reducedMotion: boolean,
): number {
  if (view === null) return 0;
  const cap = Math.min(
    CUTSCENE_LETTERBOX_MAX_PX,
    Math.max(12, Math.round(viewportHeight * 0.06)),
  );
  if (reducedMotion) return cap;
  return Math.round(cap * Math.max(0, Math.min(1, view.letterbox)));
}

export function computeCutscenePoseTransform(
  pose: CutscenePose,
  elapsed: number,
  reducedMotion: boolean,
): MotionPose {
  if (pose === "idle") return { ...NEUTRAL_POSE };
  if (reducedMotion) {
    if (pose === "hop" || pose === "cheer") {
      return { offsetX: 0, offsetY: -2, scaleX: 1, scaleY: 1, rotation: 0 };
    }
    if (pose === "taunt") {
      return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0.06 };
    }
    if (pose === "toss") {
      return { offsetX: 2, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0.07 };
    }
    if (pose === "wave") {
      return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0.04 };
    }
    if (pose === "sit") {
      return { offsetX: 0, offsetY: 3, scaleX: 1.04, scaleY: 0.94, rotation: 0 };
    }
    return { ...NEUTRAL_POSE };
  }
  if (pose === "hop") {
    const bounce = Math.abs(Math.sin(elapsed * 0.32));
    return {
      offsetX: 0,
      offsetY: -bounce * 16,
      scaleX: 1 + 0.06 * (1 - bounce) - 0.05 * bounce,
      scaleY: 1 + 0.07 * bounce - 0.05 * (1 - bounce),
      rotation: 0,
    };
  }
  if (pose === "cheer") {
    const wave = Math.sin(elapsed * 0.28);
    const bounce = Math.abs(wave);
    return {
      offsetX: 0,
      offsetY: -bounce * 12,
      scaleX: 1 - 0.03 * bounce,
      scaleY: 1 + 0.045 * bounce,
      rotation: wave * 0.06,
    };
  }
  if (pose === "shock") {
    const pop = Math.max(0, Math.sin(Math.min(1, elapsed / 10) * Math.PI));
    return {
      offsetX: 0,
      offsetY: -pop * 11,
      scaleX: 0.94,
      scaleY: 1.07,
      rotation: -0.05 * pop,
    };
  }
  if (pose === "toss") {
    const flick = Math.sin(elapsed * 0.35);
    return {
      offsetX: flick * 4,
      offsetY: -Math.abs(flick) * 5,
      scaleX: 1,
      scaleY: 1,
      rotation: flick * 0.14,
    };
  }
  if (pose === "taunt") {
    const sway = Math.sin(elapsed * 0.26);
    return {
      offsetX: 0,
      offsetY: -Math.abs(sway) * 4,
      scaleX: 1,
      scaleY: 1,
      rotation: sway * 0.12,
    };
  }
  if (pose === "wave") {
    const sway = Math.sin(elapsed * 0.25);
    return {
      offsetX: 0,
      offsetY: -Math.abs(sway) * 3,
      scaleX: 1,
      scaleY: 1,
      rotation: sway * 0.08,
    };
  }
  return { offsetX: 0, offsetY: 3, scaleX: 1.05, scaleY: 0.93, rotation: 0 };
}

export function cutsceneEmoteTextureKey(kind: CutsceneEmoteKind): EmoteTextureKey {
  return CUTSCENE_EMOTE_TEXTURES[kind];
}

type BurstSpec = {
  count: number;
  tints: readonly number[];
  puffEvery: number;
  spread: number;
  lift: number;
  swirl: number;
  baseScale: number;
};

const BURST_SPECS: Record<CutsceneEffectKind, BurstSpec> = {
  "purple-fizz": {
    count: 9,
    tints: [0xb580ff, 0xd9a8ff, 0xff94dc],
    puffEvery: 3,
    spread: 44,
    lift: 28,
    swirl: 2.1,
    baseScale: 0.72,
  },
  "purple-puff": {
    count: 10,
    tints: [0x9c65e8, 0xc495ff, 0xebd6ff],
    puffEvery: 2,
    spread: 58,
    lift: 22,
    swirl: 0.9,
    baseScale: 0.96,
  },
  "sparkle-burst": {
    count: 8,
    tints: [0xffe58c, 0xfff6d4, 0xffc7e0],
    puffEvery: 0,
    spread: 46,
    lift: 26,
    swirl: 0.65,
    baseScale: 0.68,
  },
  "pinecone-burst": {
    count: 8,
    tints: [0xdff2ff, 0xfff6cf, 0xf7c985],
    puffEvery: 0,
    spread: 54,
    lift: 30,
    swirl: 0.75,
    baseScale: 0.52,
  },
};

export function computeCutsceneBurstParticles(
  effect: CutsceneEffectState,
  reducedMotion: boolean,
): CutsceneBurstParticle[] {
  const progress = Math.max(0, Math.min(1, effect.elapsed / Math.max(1, effect.duration)));
  const fade = Math.max(0, 1 - progress);
  if (fade <= 0.001) return [];
  const spec = BURST_SPECS[effect.kind];
  const originX = effect.x;
  const originY = effect.y - 32;
  const easeOut = 1 - (1 - progress) * (1 - progress);
  const particles: CutsceneBurstParticle[] = [];

  for (let i = 0; i < spec.count; i += 1) {
    const baseAngle = (i / spec.count) * Math.PI * 2 - Math.PI / 2;
    const isPuff = spec.puffEvery > 0 && i % spec.puffEvery === 0;
    const tint = spec.tints[i % spec.tints.length] ?? 0xffffff;
    if (reducedMotion) {
      const radius = isPuff ? 18 : 28;
      particles.push({
        x: originX + Math.cos(baseAngle) * radius,
        y: originY + Math.sin(baseAngle) * radius * 0.78,
        scale: spec.baseScale * (isPuff ? 0.9 : 0.68),
        alpha: (isPuff ? 0.72 : 0.88) * fade,
        rotation: 0,
        tint,
        shape: isPuff ? "puff" : "sparkle",
        additive: !isPuff,
      });
      continue;
    }
    const radialWeight = 0.72 + ((i * 37) % 10) * 0.04;
    const angle = baseAngle + progress * spec.swirl * (i % 2 === 0 ? 1 : -0.7);
    const startRadius = isPuff ? 10 : effect.kind === "pinecone-burst" ? 28 : 14;
    const radius = startRadius + easeOut * spec.spread * radialWeight;
    const liftY = easeOut * spec.lift * (0.65 + (i % 3) * 0.22);
    const popScale = isPuff
      ? spec.baseScale * (0.65 + easeOut * 0.75)
      : spec.baseScale * (0.55 + Math.sin(progress * Math.PI) * 0.55);
    particles.push({
      x: originX + Math.cos(angle) * radius,
      y: originY + Math.sin(angle) * radius * 0.75 - liftY,
      scale: popScale,
      alpha: (isPuff ? 0.78 : 0.94) * fade * (1 - progress * 0.2),
      rotation: angle * 0.5 + progress * (isPuff ? 0.6 : 1.8),
      tint,
      shape: isPuff ? "puff" : "sparkle",
      additive: !isPuff,
    });
  }
  return particles;
}

export function resolveCutsceneEmoteAnchor(
  world: World,
  state: State,
  actorKey: string,
  playerPos: Point,
): { x: number; y: number } | null {
  if (actorKey === "fae") {
    return { x: playerPos.x, y: playerPos.y - (faeBox.height + 24) };
  }
  if (actorKey.startsWith("party:")) {
    const key = actorKey.slice("party:".length);
    const member = /^\d+$/.test(key)
      ? state.party[Number(key)]
      : state.party.find((item) => item.id === key);
    if (member === undefined) return null;
    const content = world.party[member.id];
    const height = content?.sits
      ? Math.max(88, content.box.height + 28)
      : Math.max(148, (content?.box.height ?? 116) + 22);
    return { x: member.x, y: member.y - (height + 18) };
  }
  if (actorKey.startsWith("npc:")) {
    const id = actorKey.slice("npc:".length);
    const override = state.cutscene?.actorOverrides[actorKey];
    const npc = world.areas[state.area]?.npcs.find((item) => item.id === id);
    let pos: Point | null = null;
    if (override?.x !== undefined && override.y !== undefined) {
      pos = { x: override.x, y: override.y };
    } else if (npc !== undefined) {
      const live = npcLivePoint(state, npc);
      pos = { x: live.x, y: live.y };
    }
    if (pos === null) return null;
    const headOffset =
      npc?.visibleWhenCalmed !== undefined
        ? (world.critters[npc.visibleWhenCalmed]?.overworldHeight ?? 114) + 18
        : id === "oliver" || id.startsWith("fairy-")
          ? 102
          : isAdultNpc(world, id)
            ? 192
            : 164;
    return { x: pos.x, y: pos.y - headOffset };
  }
  const tempId = actorKey.startsWith("temp:") ? actorKey.slice("temp:".length) : actorKey;
  const temp = state.cutscene?.tempActors.find((item) => item.id === tempId);
  if (temp === undefined) return null;
  const partyContent = world.party[temp.sprite];
  const baseHeight =
    partyContent !== undefined
      ? partyContent.box.height
      : isAdultNpc(world, temp.sprite)
        ? 174
        : 146;
  const headOffset = Math.round(baseHeight * (temp.scale / 0.5)) + 18;
  return { x: temp.x, y: temp.y - headOffset };
}

export function cutsceneAreaAtlases(
  world: World,
  area: Area,
  existing: readonly EntityAtlas[],
): EntityAtlas[] {
  const seen = new Set(existing.map((entry) => entry.alias));
  const extra: EntityAtlas[] = [];
  for (const script of Object.values(world.cutscenes)) {
    if (script.area !== area.id) continue;
    for (const spriteId of cutsceneSpriteIds(script)) {
      if (world.party[spriteId] !== undefined) continue;
      const alias = `${spriteId}-sheet`;
      if (seen.has(alias)) continue;
      const character = world.characters[spriteId];
      if (character !== undefined) {
        seen.add(alias);
        extra.push({ alias, src: assetUrl(character.atlas) });
      }
    }
  }
  return extra;
}

export function resolveTempActorFrame(
  animations: Readonly<Record<string, readonly string[]>> | undefined,
  actor: CutsceneTempActor,
): { frameName: string | undefined; mirror: boolean } {
  if (actor.moving && animations !== undefined) {
    const wanted = `walk_${actor.facing}`;
    const mirror =
      actor.facing === "right" &&
      animations[wanted] === undefined &&
      animations.walk_left !== undefined;
    const anim = mirror
      ? "walk_left"
      : animations[wanted] !== undefined
        ? wanted
        : undefined;
    if (anim !== undefined) {
      const names = animations[anim] ?? [];
      if (names.length > 0) {
        const index = Math.floor(actor.distance / (72 / names.length)) % names.length;
        return { frameName: names[index] ?? names[0], mirror };
      }
    }
  }
  const wantedIdle = `idle_${actor.facing}`;
  const hasExplicitRight = actor.facing === "right" && animations?.[wantedIdle] !== undefined;
  const mirror = actor.facing === "right" && !hasExplicitRight;
  const idleAnim =
    actor.facing === "right" && animations?.idle_left !== undefined && !hasExplicitRight
      ? "idle_left"
      : animations?.[wantedIdle] !== undefined
        ? wantedIdle
        : "idle_down";
  const names = animations?.[idleAnim] ?? [];
  return { frameName: names[0], mirror };
}
