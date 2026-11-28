import {
  Assets, BlurFilter, Container, Graphics, Rectangle, Sprite, Spritesheet,
  type Renderer, type Texture,
} from "pixi.js";
import { battleFoe, type Point, type State, type World } from "../core";
import type { AreaView } from "./area-view";
import type { BattleStageMood, BattleVfxParticle } from "./battle-choreography";
import type { BattleWeatherParticle } from "./battle-weather";
import {
  computeBattleStageMoodLayout, evaluateFluteCameo, resolveBattleVfxPosition,
  resolveFluteCameoIds, type BattleVfxAnchors, type FluteCameoSparkle,
} from "./battle-stage";
import { computeBackdropTransform } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

const BATTLE_VFX_POOL_SIZE = 80;
const BATTLE_WEATHER_POOL_SIZE = 32;

export type BattleBackdropBounds = { x: number; y: number; width: number; height: number };

export function makeShadowSprite(texture: Texture, label: string): Sprite {
  const sprite = new Sprite(texture);
  sprite.label = label;
  sprite.anchor.set(0.5);
  return sprite;
}

function makeSpritePool(
  layer: Container, texture: Texture, prefix: string, count: number,
): Sprite[] {
  return Array.from({ length: count }, (_, i) => {
    const sprite = makeShadowSprite(texture, `${prefix}:${i}`);
    sprite.visible = false;
    layer.addChild(sprite);
    return sprite;
  });
}

function makeUnderlaySprite(
  texture: Texture, label: string, alpha: number, tint?: number, blendMode?: "normal" | "screen",
): Sprite {
  const sprite = makeShadowSprite(texture, label);
  if (tint !== undefined) sprite.tint = tint;
  if (blendMode !== undefined) sprite.blendMode = blendMode;
  sprite.alpha = alpha;
  return sprite;
}

function applyMoodSprite(
  sprite: Sprite,
  box: { x: number; y: number; width: number; height: number; tint: number; alpha: number },
  tint: number,
  alpha: number,
): void {
  sprite.position.set(box.x, box.y);
  sprite.width = box.width;
  sprite.height = box.height;
  sprite.tint = tint;
  sprite.alpha = alpha;
}

function hideTail(pool: readonly Sprite[], start: number): void {
  for (let i = start; i < pool.length; i += 1) {
    const sprite = pool[i];
    if (sprite !== undefined) sprite.visible = false;
  }
}

/**
 * Owns the battle/arcade blurred backdrop texture cache, wash scrim, painted
 * lighting waves/spotlight/sunburst, stage contact shadows, flute friend cameo
 * staging, and pooled stage VFX sprites.
 */
export class BattleStageRenderer {
  readonly backdropSprite = new Sprite();
  readonly wash = new Graphics();
  readonly turnIndicator = new Graphics();
  readonly targetIndicator = new Graphics();
  readonly weatherLayer = new Container();
  readonly vfxLayer = new Container();
  readonly underlaySprites: readonly Sprite[];
  readonly shadowSprites: readonly Sprite[];

  // Not clipped to the viewport, so the blur samples the whole painting.
  private readonly backdropBlur = new BlurFilter({
    strength: 4, quality: 2, resolution: 0.5, clipToViewport: false,
  });
  private backdropBounds: BattleBackdropBounds | null = null;
  private backdropTexture: Texture | undefined;
  private washKey = "";

  private readonly moodWaveA: Sprite;
  private readonly moodWaveB: Sprite;
  private readonly groundStage: Sprite;
  private readonly spotlight: Sprite;
  private readonly sunburst: Sprite;
  private readonly critterShadow: Sprite;
  private readonly extraFoeShadows: readonly [Sprite, Sprite];
  private readonly faeShadow: Sprite;
  private readonly partyShadows = new Map<string, Sprite>();
  private readonly weatherSprites: Sprite[];
  private readonly vfxSprites: Sprite[];

  private fluteSeen = false;
  private fluteCameoStartTick: number | undefined;
  private fluteCameoIds: string[] = [];

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly renderer: Renderer,
  ) {
    this.weatherLayer.label = "battle:weather";
    this.vfxLayer.label = "battle:vfx";
    this.turnIndicator.label = "battle:turn-indicator";
    this.turnIndicator.visible = false;
    // Floating die-cut golden/cream chevron pointing down at the active actor.
    this.turnIndicator
      .poly([-13, -18, 13, -18, 0, 2]).fill({ color: 0x47321f })
      .poly([-10.5, -16, 10.5, -16, 0, -0.5]).fill({ color: 0xfffdf7 })
      .poly([-7.5, -14, 7.5, -14, 0, -3.5]).fill({ color: 0xffe27a });
    // Floating coral-gold chevron above the targeted foe in multi-foe formations.
    this.targetIndicator.label = "battle:target-indicator";
    this.targetIndicator.visible = false;
    this.targetIndicator
      .poly([-14, -20, 14, -20, 0, 2]).fill({ color: 0x47321f })
      .poly([-11, -18, 11, -18, 0, -0.5]).fill({ color: 0xfffdf7 })
      .poly([-8, -16, 8, -16, 0, -3.5]).fill({ color: 0xff8b6b })
      .poly([-4.5, -14.5, 4.5, -14.5, 0, -7]).fill({ color: 0xffe27a });
    this.weatherSprites = makeSpritePool(
      this.weatherLayer, this.vfx.softGlow, "battle:weather", BATTLE_WEATHER_POOL_SIZE,
    );
    this.vfxSprites = makeSpritePool(
      this.vfxLayer, this.vfx.sparkle, "battle:vfx", BATTLE_VFX_POOL_SIZE,
    );
    this.moodWaveA = makeUnderlaySprite(this.vfx.mistWisp, "battle:mood-wave-a", 0.15, 0xfff2cf);
    this.moodWaveB = makeUnderlaySprite(this.vfx.softGlow, "battle:mood-wave-b", 0.13, 0xfff2cf);
    this.groundStage = makeUnderlaySprite(
      this.vfx.softGlow, "battle:ground-stage", 0.26, 0xfff3d4,
    );
    this.spotlight = makeUnderlaySprite(
      this.vfx.softGlow, "battle:spotlight", 0.16, 0xfff8e6, "screen",
    );
    this.sunburst = makeUnderlaySprite(
      this.vfx.sunburst, "battle:sunburst", 0.72, undefined, "normal",
    );
    this.sunburst.visible = false;

    this.critterShadow = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:critter");
    const extraShadow1 = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:foe-1");
    const extraShadow2 = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:foe-2");
    extraShadow1.visible = false;
    extraShadow2.visible = false;
    this.extraFoeShadows = [extraShadow1, extraShadow2];
    this.faeShadow = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:fae");
    for (const id of Object.keys(world.party)) {
      const shadow = makeShadowSprite(this.vfx.contactShadow, `battle:shadow:${id}`);
      shadow.visible = false;
      this.partyShadows.set(id, shadow);
    }

    this.underlaySprites = [
      this.moodWaveA, this.moodWaveB, this.spotlight, this.groundStage, this.sunburst,
    ];
    this.shadowSprites = [
      this.critterShadow, extraShadow1, extraShadow2, this.faeShadow, ...this.partyShadows.values(),
    ];
  }

  bounds(): BattleBackdropBounds | null {
    return this.backdropBounds;
  }

  /** Destroys the cached blurred backdrop texture so a restored GPU context rebuilds it. */
  invalidateBackdrop(): void {
    if (this.backdropTexture !== undefined) {
      this.backdropTexture.destroy(true);
      this.backdropTexture = undefined;
    }
    this.washKey = "";
  }

  /** Hides stage layers, clears cached backdrop texture, and resets transient VFX/cameo state. */
  hide(): void {
    this.wash.visible = false;
    this.backdropSprite.visible = false;
    this.turnIndicator.visible = false;
    this.targetIndicator.visible = false;
    for (const shadow of this.extraFoeShadows) shadow.visible = false;
    this.backdropBounds = null;
    this.resetFluteCameo();
    hideTail(this.weatherSprites, 0);
    hideTail(this.vfxSprites, 0);
    if (this.backdropTexture !== undefined) {
      this.backdropTexture.destroy(true);
      this.backdropTexture = undefined;
    }
  }

  private resetFluteCameo(): void {
    this.fluteSeen = false;
    this.fluteCameoStartTick = undefined;
    this.fluteCameoIds = [];
  }

  /*
   * The battle backdrop is the area painting itself, scaled so its painted
   * interior covers the whole canvas plus a margin (never smaller than the
   * overworld zoom), centred on the critter and clamped, softly blurred. The
   * margin keeps the blur's edge fade off-screen.
   */
  renderBackdrop(
    state: State, areaView: AreaView | undefined, width: number, height: number,
    viewWidth: number, viewHeight: number, zoom = 1,
  ): void {
    this.wash.visible = true;
    this.backdropSprite.visible = true;
    const area = areaView?.area;
    if (area === undefined) return;
    // A battle centres on its critter; the claw machine on Fae, who stands at it.
    const focus = battleFoe(this.world, state)?.point ??
      (state.arcade !== null ? state.player : undefined) ?? {
        x: area.width / 2, y: area.height / 2,
      };
    const transform = computeBackdropTransform(
      area, focus, width, height, viewWidth, viewHeight, zoom,
    );
    if (this.backdropTexture === undefined && areaView !== undefined) {
      // Blur the painting (the plate with its props) once into a small
      // texture: the backdrop is static, so each battle frame draws one sprite
      // instead of a full-screen blur (slow without a GPU, costly on a phone).
      this.backdropTexture = areaView.withScenery((ground) => {
        ground.filters = [this.backdropBlur];
        const texture = this.renderer.generateTexture({
          target: ground,
          frame: new Rectangle(0, 0, area.width, area.height),
          resolution: 0.5,
        });
        ground.filters = [];
        return texture;
      });
      this.backdropSprite.texture = this.backdropTexture;
    }
    this.backdropSprite.scale.set(transform.cover);
    this.backdropSprite.position.set(transform.x, transform.y);
    this.backdropBounds = transform.bounds;
  }

  /** Draws the light cream (or Together! twilight) scrim over the blurred backdrop. */
  drawWash(width: number, height: number, alpha: number, color = 0xfff6e6): void {
    const key = `${width}x${height}@${alpha}@${color}`;
    if (key === this.washKey) return;
    this.washKey = key;
    this.wash.clear().rect(0, 0, width, height).fill({ color, alpha });
  }

  /** Updates drifting watercolour mood washes, radial spotlight, ground ellipse, and sunburst. */
  renderLighting(
    mood: BattleStageMood, tick: number, viewWidth: number, viewHeight: number,
    faeX: number, faeY: number, critterX: number, critterY: number, reducedMotion: boolean,
    phase2Tint?: { waveA: number; waveB: number; spotlight: number },
  ): void {
    // Drifting watercolour mood washes and radial spotlight kept strictly
    // inside the central 70% so all four painted corners stay untouched.
    const moodLayout = computeBattleStageMoodLayout(
      mood, reducedMotion ? 0 : tick, viewWidth, viewHeight,
    );
    const usePhase2 = phase2Tint !== undefined && mood !== "rest" &&
      mood !== "soothed" && mood !== "together-active";
    applyMoodSprite(
      this.moodWaveA, moodLayout.waveA,
      usePhase2 ? phase2Tint.waveA : moodLayout.waveA.tint,
      usePhase2 ? Math.max(moodLayout.waveA.alpha, 0.22) : moodLayout.waveA.alpha,
    );
    applyMoodSprite(
      this.moodWaveB, moodLayout.waveB,
      usePhase2 ? phase2Tint.waveB : moodLayout.waveB.tint,
      usePhase2 ? Math.max(moodLayout.waveB.alpha, 0.19) : moodLayout.waveB.alpha,
    );
    applyMoodSprite(
      this.spotlight, moodLayout.spotlight,
      usePhase2 ? phase2Tint.spotlight : moodLayout.spotlight.tint,
      moodLayout.spotlight.alpha,
    );

    const stageCenterX = Math.max(
      viewWidth * 0.3,
      Math.min(viewWidth * 0.52, (faeX + critterX) * 0.5),
    );
    this.groundStage.position.set(stageCenterX, (faeY + critterY) * 0.5 - 4);
    this.groundStage.width = Math.min(
      viewWidth * 0.62,
      Math.max(360, (critterX - faeX) * 1.55),
    );
    this.groundStage.height = 124;
    this.groundStage.tint = 0xfff3d4;
    this.groundStage.alpha = mood === "together-active" ? 0.18 : 0.26;

    const showSunburst = mood === "together-active";
    this.sunburst.visible = showSunburst;
    if (showSunburst) {
      const sunburstScale = reducedMotion ? 2.05 : 2.05 + 0.14 * Math.sin(tick * 0.18);
      this.sunburst.position.set(faeX - 18, faeY - 64);
      this.sunburst.rotation = reducedMotion ? 0 : tick * 0.014;
      this.sunburst.scale.set(sunburstScale);
      this.sunburst.alpha = 0.88;
    }
  }

  updateCritterShadow(
    x: number, y: number, battleHeight: number, swell: number, lift: number,
  ): void {
    this.applyFoeShadow(this.critterShadow, x, y, battleHeight, swell, lift);
  }

  updateExtraFoeShadow(
    slot: 1 | 2, visible: boolean, x: number, y: number,
    battleHeight: number, swell: number, lift: number,
  ): void {
    const shadow = slot === 1 ? this.extraFoeShadows[0] : this.extraFoeShadows[1];
    shadow.visible = visible;
    if (visible) this.applyFoeShadow(shadow, x, y, battleHeight, swell, lift);
  }

  private applyFoeShadow(
    shadow: Sprite, x: number, y: number, battleHeight: number, swell: number, lift: number,
  ): void {
    const base = Math.min(190, Math.max(92, battleHeight * 0.58));
    const shadowScale = (1 + (swell - 1) * 0.65) * lift;
    shadow.position.set(x, y);
    shadow.width = base * shadowScale;
    shadow.height = base * 0.32 * (1 + (swell - 1) * 0.5) * lift;
    shadow.alpha = 0.34 * lift;
  }

  updateFaeShadow(x: number, y: number, lift: number): void {
    this.faeShadow.position.set(x, y);
    this.faeShadow.width = 68 * lift;
    this.faeShadow.height = 22 * lift;
    this.faeShadow.alpha = 0.34 * lift;
  }

  setPartyShadowsVisible(inParty: ReadonlySet<string>): void {
    for (const [id, shadow] of this.partyShadows) {
      shadow.visible = inParty.has(id);
    }
  }

  updatePartyShadow(id: string, x: number, y: number, boxWidth: number, lift: number): void {
    const shadow = this.partyShadows.get(id);
    if (shadow === undefined) return;
    const width = boxWidth * 1.15 * lift;
    shadow.position.set(x, y);
    shadow.width = width;
    shadow.height = width * 0.36;
    shadow.alpha = 0.32 * lift;
  }

  private updateIndicator(
    indicator: Graphics, head: Point | undefined, tick: number,
    reducedMotion: boolean, yOffset: number, period: number,
  ): void {
    if (head === undefined) {
      indicator.visible = false;
      return;
    }
    const bob = reducedMotion ? 0 : Math.sin(tick / period) * 5;
    indicator.visible = true;
    indicator.position.set(head.x, head.y + yOffset + bob);
  }

  updateTurnIndicator(head: Point | undefined, tick: number, reducedMotion: boolean): void {
    this.updateIndicator(this.turnIndicator, head, tick, reducedMotion, 0, 10);
  }

  updateTargetIndicator(head: Point | undefined, tick: number, reducedMotion: boolean): void {
    this.updateIndicator(this.targetIndicator, head, tick, reducedMotion, -8, 8);
  }

  /** Renders Flute Friend on-stage cameo sprites + shadows and returns cameo sparkle particles. */
  renderFluteCameo(
    state: State, battle: NonNullable<State["battle"]>, faeX: number, faeY: number,
    partySprites: ReadonlyMap<string, Sprite>,
  ): FluteCameoSparkle[] {
    if (this.fluteCameoStartTick !== undefined && state.tick < this.fluteCameoStartTick) {
      this.resetFluteCameo();
    }
    const showingFluteLine = battle.fluteUsed === true && battle.phase === "command" &&
      battle.message.startsWith("Fae plays her flute!");
    if (battle.fluteUsed !== true) {
      this.resetFluteCameo();
    } else if (!this.fluteSeen || (showingFluteLine && this.fluteCameoIds.length === 0)) {
      this.fluteSeen = true;
      this.fluteCameoIds = resolveFluteCameoIds(this.world, state.ink, battle.message);
      this.fluteCameoStartTick = state.tick;
    } else if (showingFluteLine) {
      this.fluteCameoStartTick = state.tick;
    }
    const cameoElapsed =
      this.fluteCameoStartTick === undefined ? -1 : state.tick - this.fluteCameoStartTick;
    const cameo = evaluateFluteCameo({
      ids: this.fluteCameoIds, showingFluteLine, cameoElapsed,
      tick: state.tick, faeX, faeY, party: this.world.party,
    });
    for (const actor of cameo.actors) {
      const sprite = partySprites.get(actor.id);
      const memberSheet = Assets.get<Spritesheet | undefined>(`${actor.id}-sheet`);
      if (sprite === undefined || memberSheet === undefined) continue;
      const frames = memberSheet.animations.walk_left ?? memberSheet.animations.idle_down;
      const frame = frames?.[Math.floor(state.tick / 6) % frames.length];
      if (frame === undefined) continue;
      sprite.visible = true;
      sprite.texture = frame;
      if (frame.defaultAnchor !== undefined) sprite.anchor.copyFrom(frame.defaultAnchor);
      sprite.scale.set(-actor.baseScale, actor.baseScale);
      sprite.position.set(actor.x, actor.y + actor.hopY);
      sprite.rotation = actor.rotation;
      sprite.alpha = actor.alpha;
      const shadow = this.partyShadows.get(actor.id);
      if (shadow !== undefined) {
        shadow.visible = true;
        shadow.position.set(actor.x, actor.y);
        shadow.width = actor.shadowWidth;
        shadow.height = actor.shadowHeight;
        shadow.alpha = actor.shadowAlpha;
      }
    }
    return cameo.sparkles;
  }

  private paintPooledSprite(
    sprite: Sprite, texture: Texture, blend: "normal" | "add", tint: number, alpha: number,
    scaleX: number, scaleY: number, rotation: number, x: number, y: number,
  ): void {
    sprite.visible = true;
    sprite.texture = texture;
    sprite.blendMode = blend;
    sprite.tint = tint;
    sprite.alpha = alpha;
    sprite.scale.set(scaleX, scaleY);
    sprite.rotation = rotation;
    sprite.position.set(x, y);
  }

  /** Updates pooled outdoor cozy weather sprites behind combatants (zero allocations). */
  renderWeather(particles: readonly BattleWeatherParticle[]): void {
    let slot = 0;
    for (const p of particles) {
      const sprite = this.weatherSprites[slot];
      if (sprite === undefined) break;
      if (p.alpha <= 0.01) continue;
      slot += 1;
      this.paintPooledSprite(
        sprite, this.vfx[p.texture], p.blend, p.tint, p.alpha, p.scaleX, p.scaleY, p.rotation,
        p.x, p.y,
      );
    }
    hideTail(this.weatherSprites, slot);
  }

  /** Updates pooled battle VFX sprites from choreography particles and flute cameo sparkles. */
  renderVfx(
    particles: readonly BattleVfxParticle[],
    sparkles: readonly FluteCameoSparkle[],
    anchors: BattleVfxAnchors,
  ): void {
    let slot = 0;
    for (const p of particles) {
      const sprite = this.vfxSprites[slot];
      if (sprite === undefined) break;
      if (p.alpha <= 0.01) continue;
      slot += 1;
      const pos = resolveBattleVfxPosition(p, anchors);
      this.paintPooledSprite(
        sprite, this.vfx[p.texture], p.blend, p.tint, p.alpha, p.scaleX, p.scaleY, p.rotation,
        pos.x, pos.y,
      );
    }
    for (const s of sparkles) {
      const sprite = this.vfxSprites[slot];
      if (sprite === undefined) break;
      slot += 1;
      this.paintPooledSprite(
        sprite, this.vfx.sparkle, "normal", s.tint, s.alpha, s.scale, s.scale, s.rotation,
        s.x, s.y,
      );
    }
    hideTail(this.vfxSprites, slot);
  }
}
