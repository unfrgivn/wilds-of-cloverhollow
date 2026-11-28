import { Assets, Container, Graphics, Sprite, type Spritesheet } from "pixi.js";
import { activeBlessingEffects, type Area, type Point, type State, type World } from "../core";
import type { OverworldEffectsController } from "./overworld-effects";
import { computeGlowTransform } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";
import { computeLanternVisuals, type ViewportRect } from "./view-projections";

/**
 * Owns the overworld blacklight lantern dusk tint, additive spotlight, and
 * area glow sprite pool mounted around the emissive layer.
 */
export class LanternGlowLayer {
  readonly lanternLayer = new Container();
  readonly glowLayer = new Container();
  private readonly lanternTint = new Graphics();
  private readonly lanternWorld = new Container();
  private readonly lanternSpotlight: Sprite;
  private lanternBlend = 0;
  private lanternTick: number | undefined;
  private glowSprites: { id: string; sprite: Sprite }[] = [];
  private drawnGlows: string[] = [];

  constructor(
    private readonly world: World,
    vfx: VfxTextures,
    moteLayer: Container,
  ) {
    this.lanternSpotlight = new Sprite(vfx.softGlow);
    this.lanternSpotlight.label = "lantern:spotlight";
    this.lanternSpotlight.anchor.set(0.5);
    this.lanternSpotlight.tint = 0xb98eff;
    this.lanternSpotlight.blendMode = "add";
    this.lanternSpotlight.width = 540;
    this.lanternSpotlight.height = 480;
    this.lanternWorld.addChild(this.lanternSpotlight, moteLayer);
    this.lanternLayer.label = "lantern";
    this.lanternLayer.visible = false;
    this.lanternLayer.addChild(this.lanternTint, this.lanternWorld);
  }

  get blend(): number {
    return this.lanternBlend;
  }

  mountArea(area: Area, sheet = Assets.get<Spritesheet>("glow-sheet")): void {
    for (const entry of this.glowSprites) entry.sprite.destroy();
    this.glowSprites = area.glows.map((glow) => {
      const sprite = new Sprite(sheet?.textures[glow.frame]);
      sprite.label = `glow:${glow.id}`;
      sprite.anchor.set(0.5);
      sprite.scale.set(0.5);
      sprite.visible = false;
      sprite.blendMode = "add";
      this.glowLayer.addChild(sprite);
      return { id: glow.id, sprite };
    });
    this.lanternTick = undefined;
  }

  drawBackdrop(rect: ViewportRect): void {
    this.lanternTint.clear().rect(rect.x, rect.y, rect.width, rect.height).fill(0x140a2e);
  }

  syncTransform(x: number, y: number, scale: number): void {
    this.lanternWorld.scale.set(scale);
    this.lanternWorld.position.set(x, y);
    this.glowLayer.scale.set(scale);
    this.glowLayer.position.set(x, y);
  }

  update(
    state: State,
    area: Area | undefined,
    playerPos: Point,
    effects: Pick<OverworldEffectsController, "updateLanternMotes">,
    snapLantern = false,
    reducedMotion = false,
    sheet = Assets.get<Spritesheet>("glow-sheet"),
  ): void {
    const lantern = computeLanternVisuals(
      state, playerPos, this.lanternBlend, this.lanternTick, snapLantern, reducedMotion,
    );
    this.lanternBlend = lantern.blend;
    this.lanternTick = state.tick;
    this.lanternLayer.visible = lantern.showDusk;
    if (lantern.showDusk) {
      this.lanternTint.alpha = lantern.tintAlpha;
      this.lanternSpotlight.position.set(lantern.centerX, lantern.centerY);
      this.lanternSpotlight.alpha = lantern.spotlightAlpha;
      effects.updateLanternMotes(
        lantern.centerX, lantern.centerY, state.tick, lantern.blend, reducedMotion,
      );
    }

    const glowBonus = activeBlessingEffects(this.world, state).glowVisibilityBonus;
    const drawn: string[] = [];
    this.glowSprites.forEach(({ id, sprite }, index) => {
      const glow = area?.glows.find((item) => item.id === id);
      const texture = glow === undefined ? undefined : sheet?.textures[glow.frame];
      sprite.visible = lantern.on && glow !== undefined && texture !== undefined;
      if (texture !== undefined && glow !== undefined) {
        sprite.texture = texture;
        sprite.position.set(glow.point.x, glow.point.y);
        const transform = computeGlowTransform(
          glow, state.player, state.tick, index, this.lanternBlend, reducedMotion, glowBonus,
        );
        sprite.scale.set(transform.scaleX, transform.scaleY);
        sprite.alpha = transform.alpha;
        if (sprite.visible) drawn.push(id);
      }
    });
    this.drawnGlows = drawn;
  }

  reset(): void {
    this.lanternBlend = 0;
    this.lanternTick = undefined;
    this.drawnGlows = [];
    this.lanternLayer.visible = false;
  }

  destroy(): void {
    for (const entry of this.glowSprites) entry.sprite.destroy();
    this.glowSprites = [];
    this.drawnGlows = [];
    this.lanternTint.destroy();
    this.lanternSpotlight.destroy();
    this.lanternWorld.destroy();
    this.lanternLayer.destroy();
    this.glowLayer.destroy();
  }

  info(state: State): { on: boolean; glows: string[] } {
    return {
      on: state.lantern && state.battle === null,
      glows: this.drawnGlows.slice(),
    };
  }
}
