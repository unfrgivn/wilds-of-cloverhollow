import { Assets, Container, Graphics, Sprite, Spritesheet } from "pixi.js";
import {
  cutsceneView,
  type CutsceneEffectState,
  type CutsceneTempActor,
  type CutsceneView,
  type Point,
  type State,
  type World,
} from "../core";
import { makeShadowSprite } from "./battle-view";
import { interpolatePoint } from "./camera";
import {
  CUTSCENE_LETTERBOX_MAX_PX,
  computeCutsceneBurstParticles,
  computeCutscenePoseTransform,
  computeLetterboxHeight,
  cutsceneAreaAtlases,
  cutsceneEmoteTextureKey,
  resolveCutsceneEmoteAnchor,
  resolveTempActorFrame,
  type CutsceneBurstParticle,
  type CutsceneRenderInfo,
  type CutsceneUpdateParams,
} from "./cutscene-math";
import { composePose, NEUTRAL_POSE, walkPose, type MotionPose } from "./motion";
import { isAdultNpc } from "./npc-life";
import { computeNpcShadow } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";
import type { ViewportRect } from "./view-projections";

export {
  CUTSCENE_LETTERBOX_MAX_PX,
  computeCutsceneBurstParticles,
  computeCutscenePoseTransform,
  computeLetterboxHeight,
  cutsceneAreaAtlases,
  cutsceneEmoteTextureKey,
  resolveCutsceneEmoteAnchor,
  type CutsceneBurstParticle,
  type CutsceneRenderInfo,
  type CutsceneUpdateParams,
};

const PARTICLE_POOL_SIZE = 48;
const EMOTE_POOL_SIZE = 12;

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
      const { frameName, mirror } = resolveTempActorFrame(sheet.data.animations, actor);
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
