import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Spritesheet,
  type Renderer,
  type Texture,
} from "pixi.js";
import { battleFoe, type State, type World } from "../core";
import type { AreaView } from "./area-view";
import type { BattleStageMood, BattleVfxParticle } from "./battle-choreography";
import {
  computeBattleStageMoodLayout,
  evaluateFluteCameo,
  resolveBattleVfxPosition,
  resolveFluteCameoIds,
  type BattleVfxAnchors,
  type FluteCameoSparkle,
} from "./battle-stage";
import { computeBackdropTransform } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

const BATTLE_VFX_POOL_SIZE = 64;

export type BattleBackdropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function makeShadowSprite(texture: Texture, label: string): Sprite {
  const sprite = new Sprite(texture);
  sprite.label = label;
  sprite.anchor.set(0.5);
  return sprite;
}

/**
 * Owns the battle/arcade blurred backdrop texture cache, wash scrim, painted
 * lighting waves/spotlight/sunburst, stage contact shadows, flute friend cameo
 * staging, and pooled stage VFX sprites.
 */
export class BattleStageRenderer {
  readonly backdropSprite = new Sprite();
  readonly wash = new Graphics();
  readonly vfxLayer = new Container();
  readonly underlaySprites: readonly Sprite[];
  readonly shadowSprites: readonly Sprite[];

  // Not clipped to the viewport, so the blur samples the whole painting.
  private readonly backdropBlur = new BlurFilter({
    strength: 4,
    quality: 2,
    resolution: 0.5,
    clipToViewport: false,
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
  private readonly faeShadow: Sprite;
  private readonly partyShadows = new Map<string, Sprite>();
  private readonly vfxSprites: Sprite[] = [];

  private fluteSeen = false;
  private fluteCameoStartTick: number | undefined;
  private fluteCameoIds: string[] = [];

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly renderer: Renderer,
  ) {
    this.vfxLayer.label = "battle:vfx";
    for (let i = 0; i < BATTLE_VFX_POOL_SIZE; i += 1) {
      const particle = new Sprite(this.vfx.sparkle);
      particle.label = `battle:vfx:${i}`;
      particle.anchor.set(0.5);
      particle.visible = false;
      this.vfxSprites.push(particle);
      this.vfxLayer.addChild(particle);
    }

    this.moodWaveA = new Sprite(this.vfx.mistWisp);
    this.moodWaveA.label = "battle:mood-wave-a";
    this.moodWaveA.anchor.set(0.5);
    this.moodWaveA.tint = 0xfff2cf;
    this.moodWaveA.alpha = 0.15;

    this.moodWaveB = new Sprite(this.vfx.softGlow);
    this.moodWaveB.label = "battle:mood-wave-b";
    this.moodWaveB.anchor.set(0.5);
    this.moodWaveB.tint = 0xfff2cf;
    this.moodWaveB.alpha = 0.13;

    this.groundStage = new Sprite(this.vfx.softGlow);
    this.groundStage.label = "battle:ground-stage";
    this.groundStage.anchor.set(0.5);
    this.groundStage.tint = 0xfff3d4;
    this.groundStage.alpha = 0.26;

    this.spotlight = new Sprite(this.vfx.softGlow);
    this.spotlight.label = "battle:spotlight";
    this.spotlight.anchor.set(0.5);
    this.spotlight.tint = 0xfff8e6;
    this.spotlight.blendMode = "screen";
    this.spotlight.alpha = 0.16;

    this.sunburst = new Sprite(this.vfx.sunburst);
    this.sunburst.label = "battle:sunburst";
    this.sunburst.anchor.set(0.5);
    this.sunburst.blendMode = "normal";
    this.sunburst.alpha = 0.72;
    this.sunburst.visible = false;

    this.critterShadow = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:critter");
    this.faeShadow = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:fae");
    for (const id of Object.keys(world.party)) {
      const shadow = makeShadowSprite(this.vfx.contactShadow, `battle:shadow:${id}`);
      shadow.visible = false;
      this.partyShadows.set(id, shadow);
    }

    this.underlaySprites = [
      this.moodWaveA,
      this.moodWaveB,
      this.spotlight,
      this.groundStage,
      this.sunburst,
    ];
    this.shadowSprites = [
      this.critterShadow,
      this.faeShadow,
      ...this.partyShadows.values(),
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
    this.backdropBounds = null;
    this.fluteSeen = false;
    this.fluteCameoStartTick = undefined;
    this.fluteCameoIds = [];
    for (const sprite of this.vfxSprites) sprite.visible = false;
    if (this.backdropTexture !== undefined) {
      this.backdropTexture.destroy(true);
      this.backdropTexture = undefined;
    }
  }

  /*
   * The battle backdrop is the area painting itself, scaled so its painted
   * interior covers the whole canvas plus a margin (never smaller than the
   * overworld zoom), centred on the critter and clamped, softly blurred. The
   * margin keeps the blur's edge fade off-screen.
   */
  renderBackdrop(
    state: State,
    areaView: AreaView | undefined,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
    zoom = 1,
  ): void {
    this.wash.visible = true;
    this.backdropSprite.visible = true;
    const area = areaView?.area;
    if (area === undefined) return;
    // A battle centres on its critter; the claw machine on Fae, who stands at it.
    const focus = battleFoe(this.world, state)?.point ??
      (state.arcade !== null ? state.player : undefined) ?? {
        x: area.width / 2,
        y: area.height / 2,
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
    mood: BattleStageMood,
    tick: number,
    viewWidth: number,
    viewHeight: number,
    faeX: number,
    faeY: number,
    critterX: number,
    critterY: number,
    reducedMotion: boolean,
  ): void {
    // Drifting watercolour mood washes and radial spotlight kept strictly
    // inside the central 70% so all four painted corners stay untouched.
    const moodLayout = computeBattleStageMoodLayout(
      mood,
      reducedMotion ? 0 : tick,
      viewWidth,
      viewHeight,
    );
    this.moodWaveA.position.set(moodLayout.waveA.x, moodLayout.waveA.y);
    this.moodWaveA.width = moodLayout.waveA.width;
    this.moodWaveA.height = moodLayout.waveA.height;
    this.moodWaveA.tint = moodLayout.waveA.tint;
    this.moodWaveA.alpha = moodLayout.waveA.alpha;

    this.moodWaveB.position.set(moodLayout.waveB.x, moodLayout.waveB.y);
    this.moodWaveB.width = moodLayout.waveB.width;
    this.moodWaveB.height = moodLayout.waveB.height;
    this.moodWaveB.tint = moodLayout.waveB.tint;
    this.moodWaveB.alpha = moodLayout.waveB.alpha;

    this.spotlight.position.set(moodLayout.spotlight.x, moodLayout.spotlight.y);
    this.spotlight.width = moodLayout.spotlight.width;
    this.spotlight.height = moodLayout.spotlight.height;
    this.spotlight.tint = moodLayout.spotlight.tint;
    this.spotlight.alpha = moodLayout.spotlight.alpha;

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
    x: number,
    y: number,
    battleHeight: number,
    swell: number,
    lift: number,
  ): void {
    const base = Math.min(190, Math.max(92, battleHeight * 0.58));
    const shadowScale = (1 + (swell - 1) * 0.65) * lift;
    this.critterShadow.position.set(x, y);
    this.critterShadow.width = base * shadowScale;
    this.critterShadow.height = base * 0.32 * (1 + (swell - 1) * 0.5) * lift;
    this.critterShadow.alpha = 0.34 * lift;
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

  /** Renders Flute Friend on-stage cameo sprites + shadows and returns cameo sparkle particles. */
  renderFluteCameo(
    state: State,
    battle: NonNullable<State["battle"]>,
    faeX: number,
    faeY: number,
    partySprites: ReadonlyMap<string, Sprite>,
  ): FluteCameoSparkle[] {
    if (this.fluteCameoStartTick !== undefined && state.tick < this.fluteCameoStartTick) {
      this.fluteSeen = false;
      this.fluteCameoStartTick = undefined;
      this.fluteCameoIds = [];
    }
    const showingFluteLine =
      battle.fluteUsed === true &&
      battle.phase === "command" &&
      battle.message.startsWith("Fae plays her flute!");
    if (battle.fluteUsed !== true) {
      this.fluteSeen = false;
      this.fluteCameoStartTick = undefined;
      this.fluteCameoIds = [];
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
      ids: this.fluteCameoIds,
      showingFluteLine,
      cameoElapsed,
      tick: state.tick,
      faeX,
      faeY,
      party: this.world.party,
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

  /** Updates pooled battle VFX sprites from choreography particles and flute cameo sparkles. */
  renderVfx(
    particles: readonly BattleVfxParticle[],
    sparkles: readonly FluteCameoSparkle[],
    anchors: BattleVfxAnchors,
  ): void {
    let slot = 0;
    for (const particle of particles) {
      if (slot >= this.vfxSprites.length) break;
      const sprite = this.vfxSprites[slot];
      if (sprite === undefined || particle.alpha <= 0.01) continue;
      slot += 1;
      sprite.visible = true;
      sprite.texture = this.vfx[particle.texture];
      sprite.blendMode = particle.blend;
      sprite.tint = particle.tint;
      sprite.alpha = particle.alpha;
      sprite.scale.set(particle.scaleX, particle.scaleY);
      sprite.rotation = particle.rotation;
      const pos = resolveBattleVfxPosition(particle, anchors);
      sprite.position.set(pos.x, pos.y);
    }
    for (const spark of sparkles) {
      if (slot >= this.vfxSprites.length) break;
      const sprite = this.vfxSprites[slot];
      if (sprite === undefined) break;
      slot += 1;
      sprite.visible = true;
      sprite.texture = this.vfx.sparkle;
      sprite.blendMode = "normal";
      sprite.tint = spark.tint;
      sprite.alpha = spark.alpha;
      sprite.scale.set(spark.scale, spark.scale);
      sprite.rotation = spark.rotation;
      sprite.position.set(spark.x, spark.y);
    }
    for (let i = slot; i < this.vfxSprites.length; i += 1) {
      const sprite = this.vfxSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }
}
