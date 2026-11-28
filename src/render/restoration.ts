import { Assets, Container, Graphics, Sprite, type Spritesheet } from "pixi.js";
import type { State, World } from "../core";
import {
  advanceRestorationPulse,
  evaluateAreaRestoration,
  evaluateRestorationFrame,
  RESTORATION_PETAL_COUNT,
  type RestorationFrame,
  type RestorationPulseState,
} from "./restoration-math";
import type { VfxTextures } from "./vfx-textures";

export {
  advanceRestorationPulse,
  evaluateAreaRestoration,
  evaluateRestorationFrame,
  isRestorationZoneId,
  RESTORATION_PETAL_COUNT,
  RESTORATION_PULSE_TICKS,
  RESTORATION_ZONE_IDS,
  RESTORATION_ZONES,
  restorationMaxRadius,
  type BloomDecalFrame,
  type ChaosDecalFrame,
  type DecalVisual,
  type RestorationDecalSpec,
  type RestorationFrame,
  type RestorationPetalVisual,
  type RestorationPulseState,
  type RestorationPulseStep,
  type RestorationRingVisual,
  type RestorationStatus,
  type RestorationZoneId,
  type RestorationZoneSpec,
} from "./restoration-math";

const RING_SEGMENTS = 64;

function scallopedRingPoints(
  cx: number,
  cy: number,
  radius: number,
  phase: number,
  wobble: number,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const theta = (i / RING_SEGMENTS) * Math.PI * 2;
    const ripple =
      Math.sin(theta * 5 + phase) * wobble +
      Math.cos(theta * 9 - phase * 1.4) * (wobble * 0.55) +
      Math.sin(theta * 13 + phase * 0.7) * (wobble * 0.25);
    const rr = Math.max(12, radius + ripple);
    pts.push(cx + Math.cos(theta) * rr, cy + Math.sin(theta) * rr);
  }
  return pts;
}
export const RESTORATION_ATLAS_ALIAS = "restoration-sheet";
export const RESTORATION_ATLAS_URL = "assets/restoration/restoration.json";

/**
 * PixiJS 8 overworld restoration renderer (spec §1.3 & §4).
 * Draws hand-painted chaos scribble / crumpled-paper patches on `groundLayer`
 * (above the ground plate and below shadows/characters), then peels them back
 * with an expanding pastel watercolor wash-bloom ring and drifting petal burst
 * on `fxLayer` when the zone becomes calm, revealing blooming wildflower,
 * clover, and sunlit dew accents.
 */
export class AreaRestorationRenderer {
  readonly groundLayer = new Container();
  readonly fxLayer = new Container();

  private readonly chaosLayer = new Container();
  private readonly bloomLayer = new Container();
  private readonly chaosPool: Sprite[] = [];
  private readonly bloomPool: Sprite[] = [];

  private readonly ringGlow: Sprite;
  private readonly ringGraphics = new Graphics();
  private readonly petalLayer = new Container();
  private readonly petalPool: Sprite[] = [];

  private pulseState: RestorationPulseState | null = null;
  private visibleDecals = 0;

  constructor(private readonly vfx: VfxTextures) {
    this.groundLayer.label = "restoration:ground";
    this.chaosLayer.label = "restoration:chaos";
    this.bloomLayer.label = "restoration:bloom";
    this.groundLayer.addChild(this.chaosLayer, this.bloomLayer);
    this.groundLayer.visible = false;

    this.fxLayer.label = "restoration:fx";
    this.ringGlow = new Sprite(this.vfx.softGlow);
    this.ringGlow.label = "restoration:ring-glow";
    this.ringGlow.anchor.set(0.5);
    this.ringGlow.blendMode = "add";
    this.ringGlow.visible = false;

    this.ringGraphics.label = "restoration:ring";
    this.ringGraphics.visible = false;

    this.petalLayer.label = "restoration:petals";
    for (let i = 0; i < RESTORATION_PETAL_COUNT; i += 1) {
      const sprite = new Sprite(this.vfx.petal);
      sprite.label = `restoration:petal:${i}`;
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.petalPool.push(sprite);
      this.petalLayer.addChild(sprite);
    }

    this.fxLayer.addChild(this.ringGlow, this.ringGraphics, this.petalLayer);
    this.fxLayer.visible = false;
  }

  get activeDecalCount(): number {
    return this.visibleDecals;
  }

  clear(): void {
    this.pulseState = null;
    this.hideAll();
  }

  private hideAll(): void {
    this.groundLayer.visible = false;
    this.fxLayer.visible = false;
    this.ringGlow.visible = false;
    this.ringGraphics.visible = false;
    this.ringGraphics.clear();
    for (const sprite of this.chaosPool) sprite.visible = false;
    for (const sprite of this.bloomPool) sprite.visible = false;
    for (const sprite of this.petalPool) sprite.visible = false;
    this.visibleDecals = 0;
  }

  private ensureSprite(
    pool: Sprite[],
    container: Container,
    index: number,
    prefix: string,
  ): Sprite {
    const existing = pool[index];
    if (existing !== undefined) return existing;
    const sprite = new Sprite();
    sprite.label = `${prefix}:${index}`;
    sprite.anchor.set(0.5);
    sprite.visible = false;
    pool.push(sprite);
    container.addChild(sprite);
    return sprite;
  }

  update(
    world: World,
    state: State,
    options: { paused: boolean; reducedMotion: boolean },
  ): RestorationFrame | null {
    const status = evaluateAreaRestoration(world, state);
    const sheet = Assets.get<Spritesheet>(RESTORATION_ATLAS_ALIAS);
    if (status === null || sheet === undefined || state.area === "harness") {
      this.pulseState = null;
      this.hideAll();
      return null;
    }

    const overworldVisible = state.battle === null && state.arcade === null;
    const instant = options.paused || options.reducedMotion;
    const step = advanceRestorationPulse(
      this.pulseState,
      state.area,
      status.restored,
      state.tick,
      { instant, overworldVisible },
    );
    this.pulseState = step.next;

    if (!overworldVisible) {
      this.hideAll();
      return null;
    }

    const frame = evaluateRestorationFrame(
      status,
      step.calmPulse,
      step.wiping,
      state.tick,
      instant,
    );

    this.groundLayer.visible = true;
    let drawn = 0;
    for (let i = 0; i < frame.decals.length; i += 1) {
      const decal = frame.decals[i];
      if (decal === undefined) continue;

      const chaosSprite = this.ensureSprite(
        this.chaosPool,
        this.chaosLayer,
        i,
        "restoration:chaos",
      );
      const chaosTexture = sheet.textures[decal.chaosFrame];
      if (decal.chaosAlpha > 0.005 && decal.chaosScale > 0.005 && chaosTexture !== undefined) {
        chaosSprite.texture = chaosTexture;
        chaosSprite.position.set(decal.x, decal.y);
        chaosSprite.scale.set(decal.chaosScale);
        chaosSprite.rotation = decal.chaosRotation;
        chaosSprite.alpha = decal.chaosAlpha;
        chaosSprite.tint = decal.chaosTint;
        chaosSprite.blendMode = decal.chaosBlend;
        chaosSprite.visible = true;
        drawn += 1;
      } else {
        chaosSprite.visible = false;
      }

      const bloomSprite = this.ensureSprite(
        this.bloomPool,
        this.bloomLayer,
        i,
        "restoration:bloom",
      );
      const bloomTexture = sheet.textures[decal.bloomFrame];
      if (decal.bloomAlpha > 0.005 && decal.bloomScale > 0.005 && bloomTexture !== undefined) {
        bloomSprite.texture = bloomTexture;
        bloomSprite.position.set(decal.x, decal.y);
        bloomSprite.scale.set(decal.bloomScale);
        bloomSprite.rotation = decal.bloomRotation;
        bloomSprite.alpha = decal.bloomAlpha;
        bloomSprite.tint = decal.bloomTint;
        bloomSprite.blendMode = decal.bloomBlend;
        bloomSprite.visible = true;
        drawn += 1;
      } else {
        bloomSprite.visible = false;
      }
    }

    for (let i = frame.decals.length; i < this.chaosPool.length; i += 1) {
      const sprite = this.chaosPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    for (let i = frame.decals.length; i < this.bloomPool.length; i += 1) {
      const sprite = this.bloomPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    this.visibleDecals = drawn;

    const showFx = frame.ring.visible || frame.petals.length > 0;
    this.fxLayer.visible = showFx;
    if (!showFx) {
      this.ringGlow.visible = false;
      this.ringGraphics.visible = false;
      this.ringGraphics.clear();
      for (const sprite of this.petalPool) sprite.visible = false;
      return frame;
    }

    if (frame.ring.visible) {
      this.ringGlow.visible = true;
      this.ringGlow.position.set(frame.ring.x, frame.ring.y);
      this.ringGlow.width = frame.ring.glowRadius * 2;
      this.ringGlow.height = frame.ring.glowRadius * 2;
      this.ringGlow.tint = frame.ring.outerColor;
      this.ringGlow.alpha = frame.ring.glowAlpha;

      const r = frame.ring.radius;
      const w = frame.ring.thickness;
      const a = frame.ring.alpha;
      const phase = frame.calmPulse * 4.5;
      const wobble = Math.min(22, r * 0.045 + 6);
      this.ringGraphics.visible = true;
      this.ringGraphics
        .clear()
        // Outer scalloped pastel orchid-lavender wet-edge leading wash
        .poly(scallopedRingPoints(frame.ring.x, frame.ring.y, r + w * 0.22, phase, wobble), true)
        .stroke({ width: w * 0.58, color: frame.ring.outerColor, alpha: a * 0.56 })
        // Primary warm sunlit golden watercolor wash band
        .poly(scallopedRingPoints(frame.ring.x, frame.ring.y, r, phase + 0.9, wobble * 0.85), true)
        .stroke({ width: w * 0.36, color: 0xffe074, alpha: a * 0.72 })
        // Trailing fresh meadow-mint scalloped watercolor bloom edge
        .poly(
          scallopedRingPoints(
            frame.ring.x, frame.ring.y, Math.max(12, r - w * 0.24), phase + 1.8, wobble * 0.75,
          ),
          true,
        )
        .stroke({ width: w * 0.24, color: frame.ring.innerColor, alpha: a * 0.58 });
    } else {
      this.ringGlow.visible = false;
      this.ringGraphics.visible = false;
      this.ringGraphics.clear();
    }

    for (let i = 0; i < this.petalPool.length; i += 1) {
      const sprite = this.petalPool[i];
      const petal = frame.petals[i];
      if (sprite === undefined) continue;
      if (petal === undefined) {
        sprite.visible = false;
        continue;
      }
      sprite.texture = petal.texture === "sparkle" ? this.vfx.sparkle : this.vfx.petal;
      sprite.position.set(petal.x, petal.y);
      sprite.scale.set(petal.scale);
      sprite.rotation = petal.rotation;
      sprite.alpha = petal.alpha;
      sprite.tint = petal.tint;
      sprite.blendMode = petal.blend;
      sprite.visible = true;
    }

    return frame;
  }

  destroy(): void {
    this.groundLayer.destroy({ children: true });
    this.fxLayer.destroy({ children: true });
    this.chaosPool.length = 0;
    this.bloomPool.length = 0;
    this.petalPool.length = 0;
  }
}
