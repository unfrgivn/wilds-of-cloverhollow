import { Assets, Container, Graphics, Sprite, Spritesheet } from "pixi.js";
import { hasPlushPedestals, type Area, type State, type World } from "../core";
import { getPinnedPostcard } from "../platform/postcard-album";
import { makeShadowSprite } from "./battle-view";
import {
  evaluateBedroomDisplay, evaluateClubhouseDecor, evaluateClubhouseDisplay,
  evaluateRoomPostcardPerch, evaluateSunberryMotes, type ClubhouseDecorVisuals,
  type PinnedPostcardRenderInfo, type RoomDisplayPlacement,
} from "./clubhouse-display";
import {
  ClubhouseEncoreTrophyRenderer,
  ENCORE_TROPHY_ASSET_PATH,
} from "./clubhouse-encore-render";
import { ClubhousePostcardRenderer } from "./clubhouse-postcard-render";
import type { VfxTextures } from "./vfx-textures";

export { ENCORE_TROPHY_ASSET_PATH };
export const CLUBHOUSE_PRIZES_ALIAS = "clubhouse-prizes";

type PrizeEntry = { container: Container; shadow: Sprite; pedestal: Graphics; item: Sprite };
type KeepsakeEntry = {
  container: Container; shadow: Sprite; glow: Sprite; item: Sprite; sparkle: Sprite;
};

/**
 * Renders Living Clubhouse & Bedroom display items: prize plushes, velvet
 * pedestals, quest keepsakes, Golden Sunberry shimmer motes, watercolor rugs,
 * roofline pennant banners, and pulsing fairy-light bulbs.
 */
export class ClubhouseDisplayRenderer {
  readonly rugLayer = new Container();
  readonly bannerLayer = new Container();

  private readonly rugGraphics = new Graphics();
  private readonly bannerGraphics = new Graphics();
  private readonly fairyBulbs: Sprite[] = [];
  private decorSwatch = "";
  private readonly prizePool: PrizeEntry[] = [];
  private readonly keepsakePool: KeepsakeEntry[] = [];
  private readonly sunberryPool: Sprite[] = [];
  private readonly encoreTrophy: ClubhouseEncoreTrophyRenderer;
  private readonly postcard: ClubhousePostcardRenderer;
  private activeDisplayCount = 0;

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly depthLayer: Container,
    onAssetReady?: () => void,
  ) {
    this.encoreTrophy = new ClubhouseEncoreTrophyRenderer(vfx, depthLayer);
    this.postcard = new ClubhousePostcardRenderer(depthLayer, onAssetReady);
    this.rugLayer.label = "clubhouse:rug";
    this.rugLayer.visible = false;
    this.rugLayer.addChild(this.rugGraphics);
    this.bannerLayer.label = "clubhouse:decor-banners";
    this.bannerLayer.visible = false;
    this.bannerLayer.addChild(this.bannerGraphics);
    for (let i = 0; i < 12; i += 1) {
      const bulb = new Sprite(this.vfx.softGlow);
      bulb.label = `clubhouse:fairy-bulb:${i}`;
      bulb.anchor.set(0.5);
      bulb.blendMode = "add";
      bulb.visible = false;
      this.fairyBulbs.push(bulb);
      this.bannerLayer.addChild(bulb);
    }
  }

  get displayCount(): number {
    return this.activeDisplayCount;
  }
  get pinnedPostcard(): PinnedPostcardRenderInfo | null {
    return this.postcard.info();
  }

  hide(): void {
    for (const entry of this.prizePool) {
      entry.container.visible = false;
      entry.pedestal.visible = false;
    }
    for (const entry of this.keepsakePool) entry.container.visible = false;
    for (const mote of this.sunberryPool) mote.visible = false;
    this.encoreTrophy.hide();
    this.postcard.hide();
    this.hideDecorLayers();
    this.activeDisplayCount = 0;
  }

  private hideDecorLayers(): void {
    this.rugLayer.visible = false;
    this.bannerLayer.visible = false;
    for (const bulb of this.fairyBulbs) bulb.visible = false;
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
      let entry = this.prizePool[prizeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:prize:${prizeShown}`);
        const pedestal = new Graphics();
        pedestal.label = `pedestal:prize:${prizeShown}`;
        pedestal
          .ellipse(0, -0.5, 16.5, 5.8).fill({ color: 0xd9a84e, alpha: 0.85 })
          .stroke({ width: 1.1, color: 0x47321f, alpha: 0.65 })
          .ellipse(0, -1.8, 13.5, 4.4).fill({ color: 0x994968, alpha: 0.86 })
          .ellipse(-2.5, -2.8, 6.5, 1.9).fill({ color: 0xc97b9b, alpha: 0.45 });
        pedestal.visible = false;
        const item = new Sprite();
        container.addChild(shadow, pedestal, item);
        this.depthLayer.addChild(container);
        entry = { container, shadow, pedestal, item };
        this.prizePool.push(entry);
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
      if (placement.pedestal) entry.pedestal.scale.set(placement.scale / 0.24);
      entry.item.texture = texture;
      if (texture.defaultAnchor !== undefined) entry.item.anchor.copyFrom(texture.defaultAnchor);
      else entry.item.anchor.set(0.5, 0.9375);
      entry.item.position.set(0, placement.pedestal ? -3 : 0);
      entry.item.scale.set(placement.scale);
      entry.item.rotation = placement.rotation;
      prizeShown += 1;
    }
    for (let i = prizeShown; i < this.prizePool.length; i += 1) {
      const entry = this.prizePool[i];
      if (entry !== undefined) { entry.container.visible = false; entry.pedestal.visible = false; }
    }
    return prizeShown;
  }

  private drawDecorGraphics(decor: NonNullable<ClubhouseDecorVisuals>): void {
    const { rug, pennants, ropeSegments } = decor;
    const rg = this.rugGraphics;
    rg.clear();
    const toPts = (poly: readonly (readonly [number, number])[], dy = 0) =>
      poly.map(([x, y]) => ({ x, y: y + dy }));
    rg.poly(toPts(rug.outerPoly, 3), true).fill({ color: 0x47321f, alpha: 0.14 });
    rg.poly(toPts(rug.outerPoly), true).fill({ color: rug.borderTint, alpha: 0.78 })
      .stroke({ width: 1.5, color: 0x47321f, alpha: 0.48 });
    rg.poly(toPts(rug.innerPoly), true).fill({ color: rug.fillTint, alpha: 0.76 })
      .stroke({ width: 1.4, color: 0xfff8e6, alpha: 0.55 });
    const tasselStroke = { width: 2, color: 0xf7ebd2, alpha: 0.78, cap: "round" as const };
    for (const [x0, y0, x1, y1] of rug.tasselPoints) {
      rg.moveTo(x0, y0).lineTo(x1, y1).stroke(tasselStroke);
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
        rg.moveTo(cx - 32, cy + offset + 12).lineTo(cx, cy + offset)
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
    const bg = this.bannerGraphics;
    bg.clear();
    const ropeStroke = { width: 2, color: 0x6b4c35, alpha: 0.85, cap: "round" as const };
    for (const seg of ropeSegments) {
      bg.moveTo(seg.x0, seg.y0).lineTo(seg.x1, seg.y1).stroke(ropeStroke);
    }
    for (const flag of pennants) {
      bg.poly([
        flag.baseA[0], flag.baseA[1], flag.baseB[0], flag.baseB[1], flag.tip[0], flag.tip[1],
      ], true).fill({ color: flag.tint, alpha: 0.92 })
        .stroke({ width: 1.5, color: 0x47321f, alpha: 0.72 });
      const mx = (flag.baseA[0] + flag.baseB[0] + flag.tip[0]) / 3;
      const my = (flag.baseA[1] + flag.baseB[1] + flag.tip[1]) / 3;
      bg.circle(mx, my, 1.8).fill({ color: 0xfffaf0, alpha: 0.78 });
    }
  }

  private renderDecor(state: State, reducedMotion: boolean): void {
    const decor = evaluateClubhouseDecor(state, reducedMotion);
    if (decor === null) { this.hideDecorLayers(); return; }
    if (this.decorSwatch !== decor.swatch) {
      this.decorSwatch = decor.swatch;
      this.drawDecorGraphics(decor);
    }
    this.rugLayer.visible = true;
    this.bannerLayer.visible = true;
    for (let i = 0; i < this.fairyBulbs.length; i += 1) {
      const sprite = this.fairyBulbs[i];
      const spec = decor.fairyBulbs[i];
      if (sprite === undefined) continue;
      if (spec === undefined) { sprite.visible = false; continue; }
      sprite.visible = true;
      sprite.position.set(spec.x, spec.y);
      sprite.tint = spec.tint;
      sprite.scale.set(spec.scale);
      sprite.alpha = spec.alpha;
    }
  }

  render(state: State, area: Area, reducedMotion: boolean): void {
    const roomVisible =
      (area.id === "clubhouse" || area.id === "bedroom") &&
      state.battle === null &&
      state.arcade === null;
    if (!roomVisible) { this.hide(); return; }
    this.postcard.update(evaluateRoomPostcardPerch(area.id, getPinnedPostcard(), reducedMotion));

    if (area.id === "bedroom") {
      this.hideDecorLayers();
      for (const entry of this.keepsakePool) entry.container.visible = false;
      for (const mote of this.sunberryPool) mote.visible = false;
      this.encoreTrophy.hide();
      this.activeDisplayCount = this.renderPrizePlacements(
        evaluateBedroomDisplay(this.world, state),
        "bedroom",
      );
      return;
    }

    const display = evaluateClubhouseDisplay(this.world, state);
    const pedestal = hasPlushPedestals(state);
    const prizeShown = this.renderPrizePlacements(
      display.prizes.map((placement) => ({ ...placement, pedestal })),
      "clubhouse",
    );
    this.renderDecor(state, reducedMotion);

    let keepsakeShown = 0;
    for (const placement of display.keepsakes) {
      let entry = this.keepsakePool[keepsakeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:keepsake:${keepsakeShown}`);
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
        this.keepsakePool.push(entry);
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
    for (let i = keepsakeShown; i < this.keepsakePool.length; i += 1) {
      const entry = this.keepsakePool[i];
      if (entry !== undefined) entry.container.visible = false;
    }
    const sunberryMotes = evaluateSunberryMotes(this.world, state, reducedMotion);
    for (let i = 0; i < sunberryMotes.length; i += 1) {
      const mote = sunberryMotes[i];
      if (mote === undefined) continue;
      let sprite = this.sunberryPool[i];
      if (sprite === undefined) {
        sprite = new Sprite(this.vfx.sparkle);
        sprite.anchor.set(0.5);
        sprite.blendMode = "add";
        sprite.label = `clubhouse:sunberry:${i}`;
        this.depthLayer.addChild(sprite);
        this.sunberryPool.push(sprite);
      }
      sprite.visible = true;
      sprite.position.set(mote.x, mote.y);
      sprite.zIndex = mote.zIndex;
      sprite.scale.set(mote.scale);
      sprite.alpha = mote.alpha;
      sprite.tint = mote.tint;
    }
    for (let i = sunberryMotes.length; i < this.sunberryPool.length; i += 1) {
      const sprite = this.sunberryPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    const encoreShown = this.encoreTrophy.render(display.encoreTrophy, state.tick, reducedMotion);
    this.activeDisplayCount = prizeShown + keepsakeShown + encoreShown;
  }
}
