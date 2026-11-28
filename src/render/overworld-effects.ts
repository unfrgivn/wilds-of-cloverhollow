import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Spritesheet,
  type Texture,
} from "pixi.js";
import {
  effectiveAreaNpcs,
  hasPlushPedestals,
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Area,
  type NpcEmoteKind,
  type NpcLifeSnapshot,
  type Point,
  type State,
  type World,
} from "../core";
import { makeShadowSprite } from "./battle-view";
import { interpolatePoint } from "./camera";
import {
  evaluateBedroomDisplay,
  evaluateClubhouseDecor,
  evaluateClubhouseDisplay,
  evaluateSunberryMotes,
  type ClubhouseDecorVisuals,
  type RoomDisplayPlacement,
} from "./clubhouse-display";
import type { RestSpot } from "./companions";
import { evaluateOverworldEmotes } from "./emotes";
import {
  classifyFootstepEffect,
  computeGrassTuftSway,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  GroundReactivityController,
  isNearWaterShore,
  sampleNearbyGrassTufts,
  type FootstepVfxKind,
  type FootstepVfxStyle,
  type GrassMover,
  type GrassSwayResult,
  type GrassTuftPlacement,
} from "./ground-reactivity";
import {
  computeCompanionEmoteSpecs,
  computeLanternMote,
  computeNpcOverworldHeight,
  computeOverworldEmoteInputs,
  evaluateStarGemGlints,
  LANTERN_MOTE_COUNT,
  LANTERN_MOTE_TINTS,
} from "./overworld-render";
import { storyTimeOfDay } from "./time-of-day";
import type { VfxTextures } from "./vfx-textures";

export {
  classifyFootstepEffect,
  computeGrassTuftSway,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  isNearWaterShore,
  sampleNearbyGrassTufts,
  type FootstepVfxKind,
  type FootstepVfxStyle,
  type GrassMover,
  type GrassSwayResult,
  type GrassTuftPlacement,
};

export const CLUBHOUSE_PRIZES_ALIAS = "clubhouse-prizes";
const EMOTE_POOL_SIZE = 24;

type EmoteSpriteItem = {
  texture: Texture;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
  tint: number;
  blend: "normal" | "add";
};

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Owns pooled overworld visual effects: living ground reactivity (delegated to
 * `GroundReactivityController`), blacklight lantern motes, prismatic Star Gem
 * glints, Clubhouse Living Display perches, overworld emotes, and time-of-day
 * grading.
 */
export class OverworldEffectsController {
  readonly grassLayer: Container;
  readonly footstepLayer: Container;
  readonly clubhouseRugLayer = new Container();
  readonly clubhouseBannerLayer = new Container();
  readonly lanternMoteLayer = new Container();
  readonly emoteLayer = new Container();
  readonly timeOfDayLayer = new Container();

  private readonly ground: GroundReactivityController;
  private readonly lanternMotes: Sprite[] = [];

  private readonly starGemLayer = new Container();
  private readonly starGemPool: { halo: Sprite; star: Sprite }[] = [];
  private activeStarGemGlints = 0;

  private readonly clubhouseRugGraphics = new Graphics();
  private readonly clubhouseBannerGraphics = new Graphics();
  private readonly clubhouseFairyBulbs: Sprite[] = [];
  private clubhouseDecorSwatch = "";
  private readonly clubhousePrizePool: {
    container: Container;
    shadow: Sprite;
    pedestal: Graphics;
    item: Sprite;
  }[] = [];
  private readonly clubhouseKeepsakePool: {
    container: Container;
    shadow: Sprite;
    glow: Sprite;
    item: Sprite;
    sparkle: Sprite;
  }[] = [];
  private readonly clubhouseSunberryPool: Sprite[] = [];
  private activeClubhouseDisplay = 0;

  private readonly emoteSprites: Sprite[] = [];
  private activeDialoguePartner: {
    npcId: string | null;
    x: number;
    y: number;
    height: number;
  } | null = null;
  private recentTalk: {
    npcId: string | null;
    x: number;
    y: number;
    height: number;
    startTick: number;
  } | null = null;
  private lastEmoteArea = "";
  private lastEmoteTick: number | undefined;

  private readonly timeOfDayTint = new Graphics();
  private readonly timeOfDaySun: Sprite;
  private timeOfDayCachedKey = "";

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly depthLayer: Container,
    emissiveLayer: Container,
  ) {
    this.ground = new GroundReactivityController(this.world, this.vfx);
    this.grassLayer = this.ground.grassLayer;
    this.footstepLayer = this.ground.footstepLayer;

    this.clubhouseRugLayer.label = "clubhouse:rug";
    this.clubhouseRugLayer.visible = false;
    this.clubhouseRugLayer.addChild(this.clubhouseRugGraphics);

    this.clubhouseBannerLayer.label = "clubhouse:decor-banners";
    this.clubhouseBannerLayer.visible = false;
    this.clubhouseBannerLayer.addChild(this.clubhouseBannerGraphics);
    for (let i = 0; i < 12; i += 1) {
      const bulb = new Sprite(this.vfx.softGlow);
      bulb.label = `clubhouse:fairy-bulb:${i}`;
      bulb.anchor.set(0.5);
      bulb.blendMode = "add";
      bulb.visible = false;
      this.clubhouseFairyBulbs.push(bulb);
      this.clubhouseBannerLayer.addChild(bulb);
    }

    this.lanternMoteLayer.label = "lantern:motes";
    for (let i = 0; i < LANTERN_MOTE_COUNT; i += 1) {
      const mote = new Sprite(this.vfx.sparkle);
      mote.label = `lantern:mote:${i}`;
      mote.anchor.set(0.5);
      mote.blendMode = "add";
      mote.tint = LANTERN_MOTE_TINTS[i % LANTERN_MOTE_TINTS.length] ?? 0xd4b0ff;
      this.lanternMotes.push(mote);
      this.lanternMoteLayer.addChild(mote);
    }

    this.starGemLayer.label = "star-gems";
    emissiveLayer.addChild(this.starGemLayer);

    this.emoteLayer.label = "emotes";
    for (let i = 0; i < EMOTE_POOL_SIZE; i += 1) {
      const bubble = new Sprite(this.vfx.emoteQuestion);
      bubble.label = `emote:${i}`;
      bubble.anchor.set(0.5);
      bubble.visible = false;
      this.emoteSprites.push(bubble);
      this.emoteLayer.addChild(bubble);
    }

    this.timeOfDaySun = new Sprite(this.vfx.softGlow);
    this.timeOfDaySun.label = "time-of-day:sun";
    this.timeOfDaySun.anchor.set(0.5);
    this.timeOfDaySun.blendMode = "add";
    this.timeOfDayLayer.label = "time-of-day";
    this.timeOfDayLayer.visible = false;
    this.timeOfDayLayer.addChild(this.timeOfDayTint, this.timeOfDaySun);
  }

  get footstepPuffCount(): number {
    return this.ground.footstepPuffCount;
  }

  get lastFootstepKind(): FootstepVfxKind | null {
    return this.ground.lastFootstepKind;
  }

  get grassTuftCount(): number {
    return this.ground.grassTuftCount;
  }

  get starGemGlintCount(): number {
    return this.activeStarGemGlints;
  }

  get clubhouseDisplayCount(): number {
    return this.activeClubhouseDisplay;
  }

  clearFootsteps(): void {
    this.ground.clearFootsteps();
  }

  clearGrassTufts(): void {
    this.ground.clearGrassTufts();
  }

  clearStarGemGlints(): void {
    for (const entry of this.starGemPool) {
      entry.halo.visible = false;
      entry.star.visible = false;
    }
    this.activeStarGemGlints = 0;
  }

  clearEmotes(): void {
    this.activeDialoguePartner = null;
    this.recentTalk = null;
    this.lastEmoteTick = undefined;
    for (const sprite of this.emoteSprites) sprite.visible = false;
  }

  hideClubhouseDisplay(): void {
    for (const entry of this.clubhousePrizePool) {
      entry.container.visible = false;
      entry.pedestal.visible = false;
    }
    for (const entry of this.clubhouseKeepsakePool) entry.container.visible = false;
    for (const mote of this.clubhouseSunberryPool) mote.visible = false;
    this.clubhouseRugLayer.visible = false;
    this.clubhouseBannerLayer.visible = false;
    for (const bulb of this.clubhouseFairyBulbs) bulb.visible = false;
    this.activeClubhouseDisplay = 0;
  }

  invalidateTimeOfDay(): void {
    this.timeOfDayCachedKey = "";
  }

  updateFootsteps(
    state: State,
    areaId: string,
    playerPos: Point,
    reducedMotion: boolean,
  ): void {
    this.ground.updateFootsteps(state, areaId, playerPos, reducedMotion);
  }

  updateGrassTufts(
    state: State,
    area: Area,
    playerPos: Point,
    reducedMotion: boolean,
    paused: boolean,
  ): void {
    this.ground.updateGrassTufts(state, area, playerPos, reducedMotion, paused);
  }

  updateLanternMotes(
    centerX: number,
    centerY: number,
    tick: number,
    blend: number,
    reducedMotion = false,
  ): void {
    for (let i = 0; i < this.lanternMotes.length; i += 1) {
      const mote = this.lanternMotes[i];
      if (mote === undefined) continue;
      const spec = computeLanternMote(
        i, this.lanternMotes.length, centerX, centerY, tick, blend, reducedMotion,
      );
      mote.position.set(spec.x, spec.y);
      mote.scale.set(spec.scale);
      mote.alpha = spec.alpha;
    }
  }

  updateStarGemGlints(state: State, reducedMotion: boolean): void {
    const glints = evaluateStarGemGlints(this.world, state, reducedMotion);
    for (let i = 0; i < glints.length; i += 1) {
      const glint = glints[i];
      if (glint === undefined) continue;
      let entry = this.starGemPool[i];
      if (entry === undefined) {
        const halo = new Sprite(this.vfx.softGlow);
        halo.label = `stargem:halo:${i}`;
        halo.anchor.set(0.5);
        halo.blendMode = "add";
        const star = new Sprite(this.vfx.starGemCharm);
        star.label = `stargem:star:${i}`;
        star.anchor.set(0.5);
        star.blendMode = "normal";
        star.tint = 0xffffff;
        this.starGemLayer.addChild(halo, star);
        entry = { halo, star };
        this.starGemPool.push(entry);
      }
      entry.halo.visible = true;
      entry.halo.position.set(glint.x, glint.y);
      entry.halo.width = glint.haloSize;
      entry.halo.height = glint.haloSize;
      entry.halo.alpha = glint.haloAlpha;
      entry.halo.tint = glint.haloTint;

      entry.star.visible = true;
      entry.star.position.set(glint.x, glint.y);
      entry.star.scale.set(glint.starScale * 1.15);
      entry.star.alpha = glint.starAlpha;
      entry.star.rotation = glint.starRotation;
      entry.star.tint = 0xffffff;
    }
    for (let i = glints.length; i < this.starGemPool.length; i += 1) {
      const entry = this.starGemPool[i];
      if (entry !== undefined) {
        entry.halo.visible = false;
        entry.star.visible = false;
      }
    }
    this.activeStarGemGlints = glints.length;
  }

  private renderPrizePlacements(
    placements: readonly RoomDisplayPlacement[],
    labelPrefix: "clubhouse" | "bedroom",
  ): number {
    const prizeSheet = Assets.get<Spritesheet | undefined>(CLUBHOUSE_PRIZES_ALIAS);
    let prizeShown = 0;
    for (const placement of placements) {
      const texture = prizeSheet?.textures[placement.frame];
      if (texture === undefined) continue;
      let entry = this.clubhousePrizePool[prizeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:prize:${prizeShown}`);
        const pedestal = new Graphics();
        pedestal.label = `pedestal:prize:${prizeShown}`;
        pedestal
          .ellipse(0, -0.5, 16.5, 5.8)
          .fill({ color: 0xd9a84e, alpha: 0.85 })
          .stroke({ width: 1.1, color: 0x47321f, alpha: 0.65 })
          .ellipse(0, -1.8, 13.5, 4.4)
          .fill({ color: 0x994968, alpha: 0.86 })
          .ellipse(-2.5, -2.8, 6.5, 1.9)
          .fill({ color: 0xc97b9b, alpha: 0.45 });
        pedestal.visible = false;
        const item = new Sprite();
        container.addChild(shadow, pedestal, item);
        this.depthLayer.addChild(container);
        entry = { container, shadow, pedestal, item };
        this.clubhousePrizePool.push(entry);
      }
      entry.container.visible = true;
      entry.container.label = `${labelPrefix}:prize:${placement.id}`;
      entry.container.position.set(placement.x, placement.y);
      entry.container.zIndex = placement.zIndex;

      entry.shadow.position.set(0, -1);
      entry.shadow.width = 48 * (placement.scale / 0.3);
      entry.shadow.height = 16 * (placement.scale / 0.3);
      entry.shadow.alpha = 0.24;

      entry.pedestal.visible = placement.pedestal;
      if (placement.pedestal) {
        const pedScale = placement.scale / 0.24;
        entry.pedestal.scale.set(pedScale);
      }

      entry.item.texture = texture;
      if (texture.defaultAnchor !== undefined) {
        entry.item.anchor.copyFrom(texture.defaultAnchor);
      } else {
        entry.item.anchor.set(0.5, 0.9375);
      }
      entry.item.position.set(0, placement.pedestal ? -3 : 0);
      entry.item.scale.set(placement.scale);
      entry.item.rotation = placement.rotation;
      prizeShown += 1;
    }
    for (let i = prizeShown; i < this.clubhousePrizePool.length; i += 1) {
      const entry = this.clubhousePrizePool[i];
      if (entry !== undefined) {
        entry.container.visible = false;
        entry.pedestal.visible = false;
      }
    }
    return prizeShown;
  }

  private drawClubhouseDecorGraphics(decor: NonNullable<ClubhouseDecorVisuals>): void {
    const { rug, pennants, ropeSegments } = decor;
    const rg = this.clubhouseRugGraphics;
    rg.clear();
    const shadowPoly = rug.outerPoly.map(([x, y]) => ({ x, y: y + 3 }));
    const outerPts = rug.outerPoly.map(([x, y]) => ({ x, y }));
    const innerPts = rug.innerPoly.map(([x, y]) => ({ x, y }));
    rg.poly(shadowPoly, true).fill({ color: 0x47321f, alpha: 0.14 });
    rg.poly(outerPts, true)
      .fill({ color: rug.borderTint, alpha: 0.78 })
      .stroke({ width: 1.5, color: 0x47321f, alpha: 0.48 });
    rg.poly(innerPts, true)
      .fill({ color: rug.fillTint, alpha: 0.76 })
      .stroke({ width: 1.4, color: 0xfff8e6, alpha: 0.55 });
    for (const [x0, y0, x1, y1] of rug.tasselPoints) {
      rg.moveTo(x0, y0).lineTo(x1, y1).stroke({
        width: 2, color: 0xf7ebd2, alpha: 0.78, cap: "round",
      });
    }
    const [cx, cy] = rug.center;
    if (rug.motifStyle === "meadow") {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        rg.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 5.5, 5.2, 3)
          .fill({ color: 0xfff9d4, alpha: 0.92 });
      }
      rg.ellipse(cx, cy, 6.5, 3.6).fill({ color: rug.accentTint, alpha: 0.96 });
    } else if (rug.motifStyle === "starlight") {
      rg.poly([
        cx, cy - 11, cx + 6, cy - 2, cx + 22, cy, cx + 6, cy + 2,
        cx, cy + 11, cx - 6, cy + 2, cx - 22, cy, cx - 6, cy - 2,
      ], true).fill({ color: rug.accentTint, alpha: 0.92 });
      rg.circle(cx - 28, cy + 6, 2.2).fill({ color: 0xfff4d6, alpha: 0.85 });
      rg.circle(cx + 28, cy - 6, 2.2).fill({ color: 0xfff4d6, alpha: 0.85 });
    } else if (rug.motifStyle === "beach") {
      for (const offset of [-10, 10]) {
        rg.moveTo(cx - 32, cy + offset + 12)
          .lineTo(cx, cy + offset)
          .lineTo(cx + 32, cy + offset - 12)
          .stroke({ width: 3, color: 0xfff1e6, alpha: 0.82, cap: "round" });
      }
      rg.ellipse(cx, cy, 12, 6).fill({ color: rug.accentTint, alpha: 0.88 });
    } else {
      rg.moveTo(cx - 34, cy + 17).lineTo(cx + 34, cy - 17)
        .stroke({ width: 5, color: rug.borderTint, alpha: 0.42 });
      rg.moveTo(cx - 24, cy - 12).lineTo(cx + 24, cy + 12)
        .stroke({ width: 5, color: rug.accentTint, alpha: 0.56 });
      rg.poly([cx, cy - 8, cx + 16, cy, cx, cy + 8, cx - 16, cy], true)
        .fill({ color: 0xffdfb5, alpha: 0.85 });
    }

    const bg = this.clubhouseBannerGraphics;
    bg.clear();
    for (const seg of ropeSegments) {
      bg.moveTo(seg.x0, seg.y0).lineTo(seg.x1, seg.y1).stroke({
        width: 2, color: 0x6b4c35, alpha: 0.85, cap: "round",
      });
    }
    for (const flag of pennants) {
      bg.poly([
        flag.baseA[0], flag.baseA[1],
        flag.baseB[0], flag.baseB[1],
        flag.tip[0], flag.tip[1],
      ], true)
        .fill({ color: flag.tint, alpha: 0.92 })
        .stroke({ width: 1.5, color: 0x47321f, alpha: 0.72 });
      const mx = (flag.baseA[0] + flag.baseB[0] + flag.tip[0]) / 3;
      const my = (flag.baseA[1] + flag.baseB[1] + flag.tip[1]) / 3;
      bg.circle(mx, my, 1.8).fill({ color: 0xfffaf0, alpha: 0.78 });
    }
  }

  private renderClubhouseDecor(state: State, reducedMotion: boolean): void {
    const decor = evaluateClubhouseDecor(state, reducedMotion);
    if (decor === null) {
      this.clubhouseRugLayer.visible = false;
      this.clubhouseBannerLayer.visible = false;
      for (const bulb of this.clubhouseFairyBulbs) bulb.visible = false;
      return;
    }
    if (this.clubhouseDecorSwatch !== decor.swatch) {
      this.clubhouseDecorSwatch = decor.swatch;
      this.drawClubhouseDecorGraphics(decor);
    }
    this.clubhouseRugLayer.visible = true;
    this.clubhouseBannerLayer.visible = true;
    for (let i = 0; i < this.clubhouseFairyBulbs.length; i += 1) {
      const sprite = this.clubhouseFairyBulbs[i];
      const spec = decor.fairyBulbs[i];
      if (sprite === undefined) continue;
      if (spec === undefined) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.position.set(spec.x, spec.y);
      sprite.tint = spec.tint;
      sprite.scale.set(spec.scale);
      sprite.alpha = spec.alpha;
    }
  }

  renderClubhouseDisplay(state: State, area: Area, reducedMotion: boolean): void {
    const roomVisible =
      (area.id === "clubhouse" || area.id === "bedroom") &&
      state.battle === null &&
      state.arcade === null;
    if (!roomVisible) {
      this.hideClubhouseDisplay();
      return;
    }

    if (area.id === "bedroom") {
      this.clubhouseRugLayer.visible = false;
      this.clubhouseBannerLayer.visible = false;
      for (const bulb of this.clubhouseFairyBulbs) bulb.visible = false;
      for (const entry of this.clubhouseKeepsakePool) entry.container.visible = false;
      for (const mote of this.clubhouseSunberryPool) mote.visible = false;
      const placements = evaluateBedroomDisplay(this.world, state);
      this.activeClubhouseDisplay = this.renderPrizePlacements(placements, "bedroom");
      return;
    }

    const display = evaluateClubhouseDisplay(this.world, state);
    const pedestal = hasPlushPedestals(state);
    const prizeShown = this.renderPrizePlacements(
      display.prizes.map((placement) => ({ ...placement, pedestal })),
      "clubhouse",
    );
    this.renderClubhouseDecor(state, reducedMotion);

    let keepsakeShown = 0;
    for (const placement of display.keepsakes) {
      let entry = this.clubhouseKeepsakePool[keepsakeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(
          this.vfx.contactShadow,
          `shadow:keepsake:${keepsakeShown}`,
        );
        const glow = new Sprite(this.vfx.softGlow);
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        const item = new Sprite();
        item.anchor.set(0.5, 0.85);
        const sparkle = new Sprite(this.vfx.sparkle);
        sparkle.anchor.set(0.5);
        sparkle.blendMode = "normal";
        container.addChild(shadow, glow, item, sparkle);
        this.depthLayer.addChild(container);
        entry = { container, shadow, glow, item, sparkle };
        this.clubhouseKeepsakePool.push(entry);
      }
      const phase = state.tick * 0.055 + keepsakeShown * 1.4;
      const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(phase);
      entry.container.visible = true;
      entry.container.label = `clubhouse:keepsake:${placement.id}`;
      entry.container.position.set(placement.x, placement.y);
      entry.container.zIndex = placement.zIndex;

      entry.shadow.position.set(0, -1);
      entry.shadow.width = 26 * placement.scale;
      entry.shadow.height = 10 * placement.scale;
      entry.shadow.alpha = 0.22;

      entry.glow.position.set(0, -14 * placement.scale);
      entry.glow.tint = placement.sparkleTint;
      entry.glow.scale.set(0.42 * placement.scale * (0.94 + 0.12 * pulse));
      entry.glow.alpha = 0.18 + 0.1 * pulse;

      entry.item.texture = this.vfx[placement.texture];
      entry.item.scale.set(placement.scale);
      entry.item.position.set(0, 0);

      entry.sparkle.position.set(
        10 * placement.scale + (reducedMotion ? 0 : Math.sin(phase * 0.9) * 3),
        -24 * placement.scale + (reducedMotion ? 0 : Math.cos(phase * 1.1) * 2.5),
      );
      entry.sparkle.tint = placement.sparkleTint;
      entry.sparkle.scale.set(0.32 + 0.16 * pulse);
      entry.sparkle.alpha = 0.55 + 0.4 * pulse;
      keepsakeShown += 1;
    }
    for (let i = keepsakeShown; i < this.clubhouseKeepsakePool.length; i += 1) {
      const entry = this.clubhouseKeepsakePool[i];
      if (entry !== undefined) entry.container.visible = false;
    }

    const sunberryMotes = evaluateSunberryMotes(this.world, state, reducedMotion);
    for (let i = 0; i < sunberryMotes.length; i += 1) {
      const mote = sunberryMotes[i];
      if (mote === undefined) continue;
      let sprite = this.clubhouseSunberryPool[i];
      if (sprite === undefined) {
        sprite = new Sprite(this.vfx.sparkle);
        sprite.anchor.set(0.5);
        sprite.blendMode = "add";
        sprite.label = `clubhouse:sunberry:${i}`;
        this.depthLayer.addChild(sprite);
        this.clubhouseSunberryPool.push(sprite);
      }
      sprite.visible = true;
      sprite.position.set(mote.x, mote.y);
      sprite.zIndex = mote.zIndex;
      sprite.scale.set(mote.scale);
      sprite.alpha = mote.alpha;
      sprite.tint = mote.tint;
    }
    for (let i = sunberryMotes.length; i < this.clubhouseSunberryPool.length; i += 1) {
      const sprite = this.clubhouseSunberryPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }

    this.activeClubhouseDisplay = prizeShown + keepsakeShown;
  }

  renderEmotes(
    state: State,
    area: Area,
    playerPos: Point,
    previousState: State | undefined,
    alpha: number,
    activePet: { id: string; elapsed: number } | null,
    activeRest: { spot: RestSpot; elapsed: number } | null,
    npcLife: NpcLifeSnapshot,
    reducedMotion = false,
  ): void {
    const active =
      area.id !== "harness" &&
      state.battle === null &&
      state.arcade === null;
    if (!active) {
      this.emoteLayer.visible = false;
      for (const sprite of this.emoteSprites) sprite.visible = false;
      if (
        area.id !== this.lastEmoteArea ||
        (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick) ||
        state.battle !== null ||
        state.arcade !== null
      ) {
        this.activeDialoguePartner = null;
        this.recentTalk = null;
      }
      this.lastEmoteArea = area.id;
      this.lastEmoteTick = state.tick;
      return;
    }

    if (
      area.id !== this.lastEmoteArea ||
      (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick)
    ) {
      this.activeDialoguePartner = null;
      this.recentTalk = null;
    }

    const present = presentCritters(this.world, state);
    if (state.dialogue !== null) {
      const knot = state.dialogue.knot;
      const npc = effectiveAreaNpcs(this.world, state, area).find(
        (item) =>
          item.id !== "bus-stop" &&
          npcVisible(this.world, state, item) &&
          item.knot === knot,
      );
      if (npc !== undefined) {
        const critter =
          npc.visibleWhenCalmed === undefined
            ? undefined
            : this.world.critters[npc.visibleWhenCalmed];
        const profile = this.world.npcProfiles[npc.id];
        const height =
          critter !== undefined
            ? critter.overworldHeight
            : npc.id === "oliver" || npc.id.startsWith("fairy-")
              ? 84
              : profile !== undefined
                ? profile.adult
                  ? 174
                  : 146
                : computeNpcOverworldHeight(npc, critter);
        const live =
          reducedMotion && npc.stroll !== undefined
            ? npc.point
            : npcLivePoint(state, npc);
        this.activeDialoguePartner = { npcId: npc.id, x: live.x, y: live.y, height };
      } else {
        const calm = present
          .filter((item) => item.mood === "calm" && item.kind.calmKnot === knot)
          .sort(
            (a, b) =>
              (a.point.x - state.player.x) ** 2 +
              (a.point.y - state.player.y) ** 2 -
              ((b.point.x - state.player.x) ** 2 + (b.point.y - state.player.y) ** 2),
          )[0];
        if (calm !== undefined) {
          this.activeDialoguePartner = {
            npcId: null,
            x: calm.point.x,
            y: calm.point.y,
            height: calm.kind.overworldHeight,
          };
        }
      }
    } else if (this.activeDialoguePartner !== null) {
      this.recentTalk = { ...this.activeDialoguePartner, startTick: state.tick };
      this.activeDialoguePartner = null;
    }

    let recentTalk: { x: number; y: number; height: number; elapsed: number } | null = null;
    let recentTalkNpcId: string | null = null;
    if (this.recentTalk !== null) {
      const elapsed = state.tick - this.recentTalk.startTick;
      if (elapsed >= 0 && elapsed < 38) {
        recentTalk = {
          x: this.recentTalk.x,
          y: this.recentTalk.y,
          height: this.recentTalk.height,
          elapsed,
        };
        recentTalkNpcId = this.recentTalk.npcId;
      } else {
        this.recentTalk = null;
      }
    }

    const { roamers, calmedCritters, nappingMembers } = computeOverworldEmoteInputs(
      this.world,
      state,
      present,
      previousState,
      alpha,
    );

    const activeChatterNpcId =
      npcLife.chatter !== null && npcLife.chatter.alpha > 0.01
        ? npcLife.chatter.npcId
        : null;
    const npcEmotes: {
      id: string;
      x: number;
      y: number;
      height: number;
      kind: NpcEmoteKind;
      index: number;
    }[] = [];
    npcLife.npcs.forEach((entry, index) => {
      if (entry.emote === null) return;
      if (entry.id === activeChatterNpcId || entry.id === recentTalkNpcId) return;
      const height =
        entry.id === "oliver" || entry.id.startsWith("fairy-")
          ? 84
          : entry.adult
            ? 174
            : 146;
      const npcObj =
        !reducedMotion && previousState !== undefined && alpha < 1
          ? area.npcs.find((item) => item.id === entry.id && item.stroll !== undefined)
          : undefined;
      const pos =
        npcObj !== undefined && previousState !== undefined
          ? interpolatePoint(npcLivePoint(previousState, npcObj), entry, alpha)
          : { x: entry.x, y: entry.y };
      npcEmotes.push({
        id: entry.id,
        x: pos.x,
        y: pos.y,
        height,
        kind: entry.emote,
        index,
      });
    });
    const maddieNapping = nappingMembers.some((member) => member.stillTicks >= 240);
    npcLife.party.forEach((entry, index) => {
      if (entry.emote === null || entry.id === activeChatterNpcId) return;
      if (entry.id === "maddie" && maddieNapping) return;
      const showPartyEmote =
        entry.attention === "party-chat" ||
        npcLife.activeToolEventId !== null;
      if (!showPartyEmote) return;
      const content = this.world.party[entry.id];
      if (content === undefined) return;
      const member = state.party.find((item) => item.id === entry.id);
      const prevMember = previousState?.party.find((item) => item.id === entry.id);
      const pos =
        member !== undefined && prevMember !== undefined && alpha < 1
          ? interpolatePoint(prevMember, member, alpha)
          : member ?? { x: entry.x, y: entry.y };
      npcEmotes.push({
        id: entry.id,
        x: pos.x,
        y: pos.y,
        height: content.box.height,
        kind: entry.emote,
        index: npcLife.npcs.length + index,
      });
    });

    const emotes = evaluateOverworldEmotes({
      areaId: area.id,
      tick: state.tick,
      player: playerPos,
      dialogueOpen: state.dialogue !== null || state.transition !== null || state.journalOpen,
      roamers,
      calmedCritters,
      nappingMembers,
      recentTalk,
      npcEmotes,
      reducedMotion,
    });

    const items: EmoteSpriteItem[] = emotes.map((emote) => ({
      texture: this.vfx[emote.texture],
      x: emote.x,
      y: emote.y,
      scale: emote.scale,
      alpha: emote.alpha,
      rotation: emote.rotation,
      tint: 0xffffff,
      blend: "normal",
    }));

    let petPos: Point | null = null;
    let petHeight = 0;
    if (activePet !== null) {
      const member = state.party.find((entry) => entry.id === activePet.id);
      const content = this.world.party[activePet.id];
      if (member !== undefined && content !== undefined) {
        const prevMember = previousState?.party.find((entry) => entry.id === activePet.id);
        petPos =
          prevMember !== undefined && alpha < 1
            ? interpolatePoint(prevMember, member, alpha)
            : member;
        petHeight = content.box.height;
      }
    }
    for (const spec of computeCompanionEmoteSpecs(
      petPos,
      petHeight,
      activePet?.elapsed ?? null,
      playerPos,
      activeRest?.elapsed ?? null,
      reducedMotion,
    )) {
      items.push({
        texture: this.vfx[spec.textureKey],
        x: spec.x,
        y: spec.y,
        scale: spec.scale,
        alpha: spec.alpha,
        rotation: spec.rotation,
        tint: spec.tint,
        blend: spec.blend,
      });
    }

    this.emoteLayer.visible = items.length > 0;
    for (let i = 0; i < this.emoteSprites.length; i += 1) {
      const sprite = this.emoteSprites[i];
      if (sprite === undefined) continue;
      const item = items[i];
      if (item === undefined || item.alpha <= 0.01) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.texture = item.texture;
      sprite.position.set(item.x, item.y);
      sprite.scale.set(item.scale);
      sprite.alpha = item.alpha;
      sprite.rotation = item.rotation;
      sprite.tint = item.tint;
      sprite.blendMode = item.blend;
    }
    this.lastEmoteArea = area.id;
    this.lastEmoteTick = state.tick;
  }

  renderTimeOfDay(state: State, viewportRect: ViewportRect): void {
    const grade = storyTimeOfDay(this.world, state);
    const show = grade.alpha > 0 || grade.sunAlpha > 0;
    this.timeOfDayLayer.visible = show;
    if (!show) return;
    const { x, y, width, height } = viewportRect;
    const key = `${x}|${y}|${width}|${height}|${grade.tint}`;
    if (this.timeOfDayCachedKey !== key) {
      this.timeOfDayCachedKey = key;
      this.timeOfDayTint.clear().rect(x, y, width, height).fill(grade.tint);
    }
    this.timeOfDayTint.alpha = grade.alpha;
    this.timeOfDaySun.tint = grade.sunTint;
    this.timeOfDaySun.alpha = grade.sunAlpha;
    this.timeOfDaySun.position.set(x + width * 0.16, y + height * 0.12);
    this.timeOfDaySun.width = width * 0.95;
    this.timeOfDaySun.height = height * 0.85;
    this.timeOfDaySun.rotation = -0.22;
  }
}
