import { Assets, Container, Graphics, Sprite, Spritesheet } from "pixi.js";
import {
  cutsceneSpriteIds,
  cutsceneView,
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
import { makeShadowSprite } from "./battle-view";
import { interpolatePoint } from "./camera";
import type { EmoteTextureKey } from "./emotes";
import { composePose, NEUTRAL_POSE, walkPose, type MotionPose } from "./motion";
import { isAdultNpc } from "./npc-life";
import { computeNpcShadow, type EntityAtlas } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";
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

const PARTICLE_POOL_SIZE = 48;
const EMOTE_POOL_SIZE = 12;

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

function resolveTempActorFrame(
  sheet: Spritesheet,
  actor: CutsceneTempActor,
): { frameName: string | undefined; mirror: boolean } {
  const animations = sheet.data.animations;
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

export class CutsceneRenderController {
  readonly emoteLayer = new Container();
  readonly letterboxLayer = new Container();

  private readonly particleLayer = new Container();
  private readonly particleSprites: Sprite[] = [];
  private readonly emoteSprites: Sprite[] = [];
  private readonly tempSprites = new Map<string, { sprite: Sprite; shadow: Sprite }>();
  private readonly letterboxBars = new Graphics();
  private readonly skipBar = new Graphics();
  private currentLetterboxPx = 0;
  private cachedBarKey = "";
  private cachedSkipKey = "";

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly layers: {
      depth: Container;
      shadowLayer: Container;
      emissiveLayer: Container;
    },
  ) {
    this.emoteLayer.label = "cutscene:emotes";
    this.emoteLayer.visible = false;
    for (let i = 0; i < EMOTE_POOL_SIZE; i += 1) {
      const bubble = new Sprite(this.vfx.emoteExclaim);
      bubble.label = `cutscene:emote:${i}`;
      bubble.anchor.set(0.5);
      bubble.visible = false;
      this.emoteSprites.push(bubble);
      this.emoteLayer.addChild(bubble);
    }

    this.particleLayer.label = "cutscene:particles";
    this.particleLayer.visible = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i += 1) {
      const particle = new Sprite(this.vfx.sparkle);
      particle.label = `cutscene:particle:${i}`;
      particle.anchor.set(0.5);
      particle.visible = false;
      this.particleSprites.push(particle);
      this.particleLayer.addChild(particle);
    }
    this.layers.emissiveLayer.addChild(this.particleLayer);

    this.letterboxBars.label = "cutscene:letterbox:bars";
    this.skipBar.label = "cutscene:letterbox:skip";
    this.letterboxLayer.label = "cutscene:letterbox";
    this.letterboxLayer.visible = false;
    this.letterboxLayer.addChild(this.letterboxBars, this.skipBar);
  }

  clearArea(): void {
    for (const entry of this.tempSprites.values()) {
      entry.sprite.destroy();
      entry.shadow.destroy();
    }
    this.tempSprites.clear();
    for (const sprite of this.particleSprites) sprite.visible = false;
    for (const sprite of this.emoteSprites) sprite.visible = false;
    this.particleLayer.visible = false;
    this.emoteLayer.visible = false;
    this.letterboxLayer.visible = false;
    this.currentLetterboxPx = 0;
    this.cachedBarKey = "";
    this.cachedSkipKey = "";
  }

  update(params: CutsceneUpdateParams): void {
    const {
      state,
      previousState,
      alpha,
      playerPos,
      shadowAlpha,
      livingMotion,
      reducedMotion,
      viewportRect,
      overworldVisible,
    } = params;
    const view = cutsceneView(state);
    if (view === null) {
      if (this.tempSprites.size > 0) {
        for (const entry of this.tempSprites.values()) {
          entry.sprite.destroy();
          entry.shadow.destroy();
        }
        this.tempSprites.clear();
      }
      if (this.particleLayer.visible) {
        for (const sprite of this.particleSprites) sprite.visible = false;
        this.particleLayer.visible = false;
      }
      if (this.emoteLayer.visible) {
        for (const sprite of this.emoteSprites) sprite.visible = false;
        this.emoteLayer.visible = false;
      }
      this.letterboxLayer.visible = false;
      this.currentLetterboxPx = 0;
      return;
    }

    this.updateTempActors(
      view.tempActors,
      previousState?.cutscene?.tempActors,
      alpha,
      shadowAlpha,
      livingMotion,
      reducedMotion,
    );
    this.updateParticles(view.effects, reducedMotion, overworldVisible);
    this.updateEmotes(state, view, playerPos, reducedMotion, overworldVisible);
    this.updateLetterbox(view, viewportRect, reducedMotion, overworldVisible);
  }

  private updateTempActors(
    actors: readonly CutsceneTempActor[],
    prevActors: readonly CutsceneTempActor[] | undefined,
    alpha: number,
    shadowAlpha: number,
    livingMotion: boolean,
    reducedMotion: boolean,
  ): void {
    const activeIds = new Set(actors.map((actor) => actor.id));
    for (const [id, entry] of this.tempSprites.entries()) {
      if (!activeIds.has(id)) {
        entry.sprite.destroy();
        entry.shadow.destroy();
        this.tempSprites.delete(id);
      }
    }
    for (const actor of actors) {
      let entry = this.tempSprites.get(actor.id);
      if (entry === undefined) {
        const sprite = new Sprite();
        sprite.label = `cutscene:temp:${actor.id}`;
        const shadow = makeShadowSprite(
          this.vfx.contactShadow,
          `shadow:cutscene:${actor.id}`,
        );
        this.layers.depth.addChild(sprite);
        this.layers.shadowLayer.addChild(shadow);
        entry = { sprite, shadow };
        this.tempSprites.set(actor.id, entry);
      }
      const sheet = Assets.get<Spritesheet | undefined>(`${actor.sprite}-sheet`);
      if (sheet === undefined) {
        entry.sprite.visible = false;
        entry.shadow.visible = false;
        continue;
      }
      const { frameName, mirror } = resolveTempActorFrame(sheet, actor);
      const texture = frameName === undefined ? undefined : sheet.textures[frameName];
      if (texture === undefined) {
        entry.sprite.visible = false;
        entry.shadow.visible = false;
        continue;
      }
      const prev = prevActors?.find((item) => item.id === actor.id);
      const pos: Point =
        prev !== undefined && alpha < 1
          ? interpolatePoint(prev, actor, alpha)
          : { x: actor.x, y: actor.y };
      let pose: MotionPose =
        actor.moving && livingMotion ? walkPose(actor.distance, 72, true) : NEUTRAL_POSE;
      if (actor.pose !== undefined) {
        pose = composePose(
          pose,
          computeCutscenePoseTransform(actor.pose, actor.poseTicks ?? 0, reducedMotion),
        );
      }
      entry.sprite.visible = true;
      entry.sprite.texture = texture;
      if (texture.defaultAnchor !== undefined) {
        entry.sprite.anchor.copyFrom(texture.defaultAnchor);
      } else {
        entry.sprite.anchor.set(0.5, 0.94);
      }
      const scale = actor.scale;
      entry.sprite.scale.set((mirror ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
      entry.sprite.position.set(pos.x + pose.offsetX, pos.y + pose.offsetY);
      entry.sprite.rotation = pose.rotation;
      entry.sprite.zIndex = pos.y;

      const shadow = computeNpcShadow(
        actor.sprite,
        pos,
        pose,
        shadowAlpha,
        isAdultNpc(this.world, actor.sprite),
      );
      entry.shadow.visible = true;
      entry.shadow.position.set(shadow.x, shadow.y);
      entry.shadow.width = shadow.width;
      entry.shadow.height = shadow.height;
      entry.shadow.alpha = shadow.alpha;
    }
  }

  private updateParticles(
    effects: readonly CutsceneEffectState[],
    reducedMotion: boolean,
    overworldVisible: boolean,
  ): void {
    if (!overworldVisible || effects.length === 0) {
      for (const sprite of this.particleSprites) sprite.visible = false;
      this.particleLayer.visible = false;
      return;
    }
    const items: CutsceneBurstParticle[] = [];
    for (const effect of effects) {
      items.push(...computeCutsceneBurstParticles(effect, reducedMotion));
    }
    this.particleLayer.visible = items.length > 0;
    for (let i = 0; i < this.particleSprites.length; i += 1) {
      const sprite = this.particleSprites[i];
      if (sprite === undefined) continue;
      const item = items[i];
      if (item === undefined || item.alpha <= 0.01) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.texture = item.shape === "puff" ? this.vfx.puff : this.vfx.sparkle;
      sprite.position.set(item.x, item.y);
      sprite.scale.set(item.scale);
      sprite.alpha = item.alpha;
      sprite.rotation = item.rotation;
      sprite.tint = item.tint;
      sprite.blendMode = item.additive ? "add" : "normal";
    }
  }

  private updateEmotes(
    state: State,
    view: CutsceneView,
    playerPos: Point,
    reducedMotion: boolean,
    overworldVisible: boolean,
  ): void {
    if (!overworldVisible || view.emotes.length === 0) {
      for (const sprite of this.emoteSprites) sprite.visible = false;
      this.emoteLayer.visible = false;
      return;
    }
    let shown = 0;
    for (const emote of view.emotes) {
      if (shown >= this.emoteSprites.length) break;
      const anchor = resolveCutsceneEmoteAnchor(this.world, state, emote.actor, playerPos);
      const sprite = this.emoteSprites[shown];
      if (anchor === null || sprite === undefined) continue;
      const remaining = emote.duration - emote.elapsed;
      const fadeOut = remaining < 6 ? Math.max(0, remaining / 6) : 1;
      sprite.visible = true;
      sprite.texture = this.vfx[cutsceneEmoteTextureKey(emote.kind)];
      if (reducedMotion) {
        sprite.position.set(anchor.x, anchor.y);
        sprite.scale.set(0.9);
        sprite.alpha = 0.95 * fadeOut;
        sprite.rotation = 0;
      } else {
        const pop = Math.min(1, (emote.elapsed + 1) / 6);
        const scale =
          emote.elapsed < 6
            ? 0.55 + pop * 0.45
            : emote.elapsed < 10
              ? 1 - ((emote.elapsed - 6) / 4) * 0.08
              : 0.92;
        const bob = Math.sin(emote.elapsed * 0.25) * 2.5;
        const fadeIn = Math.min(1, (emote.elapsed + 1) / 4);
        sprite.position.set(anchor.x, anchor.y + bob);
        sprite.scale.set(scale);
        sprite.alpha = 0.96 * fadeIn * fadeOut;
        sprite.rotation = Math.sin(emote.elapsed * 0.22) * 0.07;
      }
      shown += 1;
    }
    for (let i = shown; i < this.emoteSprites.length; i += 1) {
      const sprite = this.emoteSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    this.emoteLayer.visible = shown > 0;
  }

  private updateLetterbox(
    view: CutsceneView,
    rect: ViewportRect,
    reducedMotion: boolean,
    overworldVisible: boolean,
  ): void {
    const barH = computeLetterboxHeight(view, rect.height, reducedMotion);
    if (!overworldVisible || barH <= 0 || rect.width <= 0 || rect.height <= 0) {
      this.letterboxLayer.visible = false;
      this.currentLetterboxPx = 0;
      return;
    }
    this.letterboxLayer.visible = true;
    this.currentLetterboxPx = barH;
    const barKey = `${rect.x}|${rect.y}|${rect.width}|${rect.height}|${barH}`;
    if (barKey !== this.cachedBarKey) {
      this.cachedBarKey = barKey;
      const bottomY = rect.y + rect.height - barH;
      this.letterboxBars
        .clear()
        .rect(rect.x, rect.y, rect.width, barH)
        .fill({ color: 0x281c16, alpha: 1 })
        .rect(rect.x, rect.y + barH - 2, rect.width, 2)
        .fill({ color: 0xf8edcf, alpha: 0.92 })
        .rect(rect.x, rect.y + barH - 4, rect.width, 1)
        .fill({ color: 0xd9b98b, alpha: 0.55 })
        .rect(rect.x, bottomY, rect.width, barH)
        .fill({ color: 0x281c16, alpha: 1 })
        .rect(rect.x, bottomY, rect.width, 2)
        .fill({ color: 0xf8edcf, alpha: 0.92 })
        .rect(rect.x, bottomY + 3, rect.width, 1)
        .fill({ color: 0xd9b98b, alpha: 0.55 });
    }
    const skip = Math.max(0, Math.min(1, view.skipProgress));
    const skipKey = `${barKey}|${skip.toFixed(3)}`;
    if (skipKey !== this.cachedSkipKey) {
      this.cachedSkipKey = skipKey;
      this.skipBar.clear();
      if (skip > 0) {
        const pillW = Math.min(92, Math.max(48, Math.round(rect.width * 0.09)));
        const pillH = Math.min(6, Math.max(4, Math.floor(barH * 0.3)));
        const pillX = rect.x + rect.width - pillW - 14;
        const pillY = rect.y + rect.height - barH + Math.round((barH - pillH) / 2);
        const radius = pillH / 2;
        const fillW = Math.max(pillH, Math.round(pillW * skip));
        this.skipBar
          .roundRect(pillX, pillY, pillW, pillH, radius)
          .fill({ color: 0xf8edcf, alpha: 0.35 })
          .roundRect(pillX, pillY, fillW, pillH, radius)
          .fill({ color: 0xf4c868, alpha: 0.95 });
      }
    }
  }

  renderInfo(state: State): CutsceneRenderInfo | null {
    const view = cutsceneView(state);
    if (view === null) return null;
    return {
      id: view.id,
      tick: view.tick,
      stepIndex: view.stepIndex,
      letterboxPx: this.currentLetterboxPx,
      camera: view.camera === null ? null : { ...view.camera },
      tempActors: view.tempActors.map((actor) => ({
        id: actor.id,
        sprite: actor.sprite,
        x: actor.x,
        y: actor.y,
        facing: actor.facing,
      })),
      emotes: view.emotes.map((emote) => ({ actor: emote.actor, kind: emote.kind })),
      effects: view.effects.map((effect) => ({
        kind: effect.kind,
        x: effect.x,
        y: effect.y,
      })),
      skipProgress: view.skipProgress,
    };
  }
}
