import { Container, Sprite } from "pixi.js";
import type { VfxTextures } from "./vfx-textures";
import {
  evaluateAtmosphere,
  resolveStoryAtmosphereOptions,
  type AtmosphereBlend,
  type AtmosphereLayer,
  type AtmosphereOptions,
  type AtmosphereParticle,
  type AtmosphereTextureKey,
} from "./atmosphere-recipes";

export {
  evaluateAtmosphere,
  resolveStoryAtmosphereOptions,
  type AtmosphereBlend,
  type AtmosphereLayer,
  type AtmosphereOptions,
  type AtmosphereParticle,
  type AtmosphereTextureKey,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class BiomeAtmosphere {
  readonly under = new Container();
  readonly over = new Container();
  readonly emissive = new Container();
  private readonly underPool: Sprite[] = [];
  private readonly overPool: Sprite[] = [];
  private readonly emissivePool: Sprite[] = [];
  private visibleCount = 0;

  constructor(private readonly textures: VfxTextures) {
    this.under.label = "atmosphere:under";
    this.over.label = "atmosphere:over";
    this.emissive.label = "atmosphere:emissive";
  }

  get activeCount(): number {
    return this.visibleCount;
  }

  update(
    areaId: string,
    width: number,
    height: number,
    tick: number,
    visible: boolean,
    duskBlend = 0,
    options?: AtmosphereOptions,
  ): void {
    const show = visible && areaId !== "harness";
    this.under.visible = show;
    this.over.visible = show;
    this.emissive.visible = show;
    if (!show) {
      this.visibleCount = 0;
      return;
    }

    const particles = evaluateAtmosphere(areaId, width, height, tick, options);
    this.visibleCount = particles.length;
    const duskBoost = 1 + clamp01(duskBlend) * 0.65;
    let underUsed = 0;
    let overUsed = 0;
    let emissiveUsed = 0;
    for (const particle of particles) {
      let pool: Sprite[];
      let container: Container;
      let index: number;
      if (particle.layer === "under") {
        pool = this.underPool;
        container = this.under;
        index = underUsed;
        underUsed += 1;
      } else if (particle.layer === "emissive") {
        pool = this.emissivePool;
        container = this.emissive;
        index = emissiveUsed;
        emissiveUsed += 1;
      } else {
        pool = this.overPool;
        container = this.over;
        index = overUsed;
        overUsed += 1;
      }

      let sprite = pool[index];
      if (sprite === undefined) {
        sprite = new Sprite();
        sprite.anchor.set(0.5);
        pool.push(sprite);
        container.addChild(sprite);
      }
      sprite.visible = true;
      sprite.texture = this.textures[particle.texture];
      sprite.blendMode = particle.blend;
      sprite.position.set(particle.x, particle.y);
      sprite.scale.set(particle.scaleX, particle.scaleY);
      sprite.rotation = particle.rotation;
      sprite.alpha =
        particle.layer === "emissive" ? clamp01(particle.alpha * duskBoost) : particle.alpha;
      sprite.tint = particle.tint;
    }
    for (let i = underUsed; i < this.underPool.length; i += 1) {
      const sprite = this.underPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    for (let i = overUsed; i < this.overPool.length; i += 1) {
      const sprite = this.overPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    for (let i = emissiveUsed; i < this.emissivePool.length; i += 1) {
      const sprite = this.emissivePool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  destroy(): void {
    this.under.destroy({ children: true });
    this.over.destroy({ children: true });
    this.emissive.destroy({ children: true });
    this.underPool.length = 0;
    this.overPool.length = 0;
    this.emissivePool.length = 0;
  }
}
