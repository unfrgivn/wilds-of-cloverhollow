import { Assets, Container, Sprite, type Texture } from "pixi.js";
import { assetUrl } from "../platform/assets";
import { makeShadowSprite } from "./battle-view";
import {
  evaluateEncoreTrophySparkles,
  type ClubhouseEncoreTrophy,
} from "./clubhouse-display";
import type { VfxTextures } from "./vfx-textures";

export const ENCORE_TROPHY_ASSET_PATH = "assets/props/encore-shrine/star-trophy.webp";

type EncoreTrophyEntry = {
  container: Container;
  shadow: Sprite;
  halo: Sprite;
  crownHalo: Sprite;
  item: Sprite;
  sparkles: Sprite[];
};

/**
 * Lazily loads `star-trophy.webp` once an Encore trophy is earned and renders
 * the golden pedestal sprite with contact shadow, golden aura, and sparkles.
 */
export class ClubhouseEncoreTrophyRenderer {
  private entry: EncoreTrophyEntry | null = null;
  private texture: Texture | null = null;
  private loadStarted = false;

  constructor(
    private readonly vfx: VfxTextures,
    private readonly depthLayer: Container,
  ) {}

  hide(): void {
    if (this.entry !== null) this.entry.container.visible = false;
  }

  private ensureTexture(): Texture | null {
    if (this.texture !== null) return this.texture;
    const src = assetUrl(ENCORE_TROPHY_ASSET_PATH);
    const cached = Assets.get<Texture | undefined>(src);
    if (cached !== undefined) {
      this.texture = cached;
      return cached;
    }
    if (!this.loadStarted) {
      this.loadStarted = true;
      void Assets.load<Texture>({ src, data: { autoGenerateMipmaps: true } })
        .then((texture) => {
          this.texture = texture;
          if (this.entry !== null) {
            this.entry.item.texture = texture;
            this.entry.item.visible = true;
          }
        })
        .catch(() => {
          this.loadStarted = false;
        });
    }
    return null;
  }

  render(trophy: ClubhouseEncoreTrophy | null, tick: number, reducedMotion: boolean): number {
    if (trophy === null) {
      this.hide();
      return 0;
    }
    if (this.entry === null) {
      const container = new Container();
      container.label = "clubhouse:encore:star-trophy";
      const shadow = makeShadowSprite(this.vfx.contactShadow, "shadow:encore:star-trophy");
      const halo = new Sprite(this.vfx.softGlow);
      halo.anchor.set(0.5);
      halo.blendMode = "normal";
      const crownHalo = new Sprite(this.vfx.softGlow);
      crownHalo.anchor.set(0.5);
      crownHalo.blendMode = "normal";
      crownHalo.visible = false;
      const item = new Sprite();
      item.anchor.set(0.5, 0.94);
      item.visible = false;
      const sparkles: Sprite[] = [];
      for (let i = 0; i < 6; i += 1) {
        const spark = new Sprite(this.vfx.sparkle);
        spark.anchor.set(0.5);
        spark.blendMode = "normal";
        spark.visible = false;
        sparkles.push(spark);
      }
      container.addChild(shadow, halo, crownHalo, item, ...sparkles);
      this.depthLayer.addChild(container);
      this.entry = { container, shadow, halo, crownHalo, item, sparkles };
    }
    const { container, shadow, halo, crownHalo, item, sparkles } = this.entry;
    const texture = this.ensureTexture();
    const glow = evaluateEncoreTrophySparkles(trophy, tick, reducedMotion);

    container.visible = true;
    container.position.set(trophy.x, trophy.y);
    container.zIndex = trophy.zIndex;

    shadow.position.set(0, -1);
    shadow.width = 36;
    shadow.height = 12;
    shadow.alpha = 0.28;

    halo.position.set(0, -28);
    halo.tint = glow.haloTint;
    halo.scale.set(glow.haloScale);
    halo.alpha = glow.haloAlpha;

    crownHalo.visible = glow.crownGlow;
    if (glow.crownGlow) {
      crownHalo.position.set(0, -46);
      crownHalo.tint = 0xffe074;
      crownHalo.scale.set(glow.haloScale * 0.62);
      crownHalo.alpha = glow.haloAlpha * 0.72;
    }

    if (texture !== null) {
      item.texture = texture;
      item.visible = true;
    }
    item.position.set(0, 0);
    item.scale.set(trophy.scale);

    for (let i = 0; i < sparkles.length; i += 1) {
      const sprite = sparkles[i];
      const spec = glow.sparkles[i];
      if (sprite === undefined) continue;
      if (spec === undefined) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.position.set(spec.x, spec.y);
      sprite.scale.set(spec.scale);
      sprite.alpha = spec.alpha;
      sprite.tint = spec.tint;
      sprite.rotation = spec.rotation;
    }
    return 1;
  }
}
