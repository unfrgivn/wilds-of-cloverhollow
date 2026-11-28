import { CanvasSource, Container, Sprite, Texture } from "pixi.js";
import {
  npcLivePoint,
  npcVisible,
  surfaceAt,
  type Area,
  type Point,
  type State,
  type World,
} from "../core";
import {
  classifyFootstepEffect,
  collectGrassMovers,
  computeGrassTuftSway,
  createEmptyFootstepSlot,
  emitFootstepParticles,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  forEachNearbyGrassCell,
  GRASS_MOVER_SLOTS,
  GRASS_RADIUS_DEFAULT,
  GRASS_TUFT_POOL_SIZE,
  isNearWaterShore,
  sampleNearbyGrassTufts,
  surfaceMapHasGrass,
  writeGrassTuftSway,
  type FootstepSlot,
  type FootstepVfxKind,
  type FootstepVfxStyle,
  type GrassMover,
  type GrassSwayResult,
  type GrassTuftPlacement,
} from "./ground-reactivity-math";
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

type GroundTextureSet = { tuft: Texture; flower: Texture; snowCrystal: Texture };
let cachedGroundTextures: GroundTextureSet | null = null;

function drawGrassBlades(ctx: CanvasRenderingContext2D, baseY: number): void {
  const cx = 24;
  const blades: readonly [number, number, number, number, string][] = [
    [-12, -16, -5.5, -8, "#477d3b"],
    [-4.5, -24, -1.5, -12, "#5c9949"],
    [4.5, -22, 2.0, -11, "#79b85c"],
    [12.5, -15, 6.2, -7.5, "#4e8740"],
  ];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(63, 94, 52, 0.36)";
  ctx.beginPath();
  ctx.ellipse(cx, baseY, 11, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(71, 50, 31, 0.68)";
  ctx.lineWidth = 1.3;
  for (const [tipX, tipY, ctrlX, ctrlY, fill] of blades) {
    ctx.beginPath();
    ctx.moveTo(cx + ctrlX * 0.4 - 2.4, baseY);
    ctx.quadraticCurveTo(cx + ctrlX - 0.8, baseY + ctrlY, cx + tipX, baseY + tipY);
    ctx.quadraticCurveTo(cx + ctrlX + 2.4, baseY + ctrlY + 1.5, cx + ctrlX * 0.4 + 2.4, baseY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function canvasTexture(canvas: HTMLCanvasElement): Texture {
  return new Texture({
    source: new CanvasSource({
      resource: canvas,
      addressMode: "clamp-to-edge",
      scaleMode: "linear",
    }),
  });
}

function buildGrassTuftTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 36;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  drawGrassBlades(ctx, 32);
  return canvasTexture(canvas);
}

function buildMeadowFlowerTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  drawGrassBlades(ctx, 36);
  ctx.save();
  ctx.translate(24.5, 13.5);
  ctx.fillStyle = "#fffdf4";
  ctx.strokeStyle = "rgba(71, 50, 31, 0.72)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 4.8, Math.sin(angle) * 4.4, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#f4be3a";
  ctx.beginPath();
  ctx.arc(0, 0, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return canvasTexture(canvas);
}

function buildSnowCrystalTexture(): Texture {
  if (typeof document === "undefined") return Texture.EMPTY;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return Texture.EMPTY;
  ctx.save();
  ctx.translate(16, 16);
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? 11.5 : 3.4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const fill = ctx.createRadialGradient(0, 0, 1, 0, 0, 11.5);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.55, "#c6ecff");
  fill.addColorStop(1, "#8cc8f5");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(74, 114, 164, 0.82)";
  ctx.stroke();
  ctx.restore();
  return canvasTexture(canvas);
}

function getGroundTextures(): GroundTextureSet {
  if (cachedGroundTextures !== null) return cachedGroundTextures;
  cachedGroundTextures = {
    tuft: buildGrassTuftTexture(),
    flower: buildMeadowFlowerTexture(),
    snowCrystal: buildSnowCrystalTexture(),
  };
  return cachedGroundTextures;
}

/**
 * Owns zero-allocation pooled living ground reactivity: surface- and shore-aware
 * footstep particles (32-slot circular pool) plus swaying grass tufts and meadow
 * wildflowers (28-slot pool) that bend smoothly away from Fae and party feet.
 */
export class GroundReactivityController {
  readonly grassLayer = new Container();
  readonly footstepLayer = new Container();

  private readonly textures: GroundTextureSet;
  private readonly grassTuftSprites: Sprite[] = [];
  private readonly grassMovers: GrassMover[] = [];
  private readonly grassPointScratch: Point = { x: 0, y: 0 };
  private readonly grassSwayScratch: GrassSwayResult = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    bend: 0,
  };
  private activeGrassTufts = 0;

  private readonly footstepSlots: FootstepSlot[] = [];
  private readonly footstepSprites: Sprite[] = [];
  private footstepCursor = 0;
  private activeFootstepCount = 0;
  private _lastFootstepKind: FootstepVfxKind | null = null;
  private lastFootstepArea = "";
  private lastFootstepTick: number | undefined;
  private lastFootstepDistance: number | undefined;
  private playerFootstepCount = 0;
  private readonly lastNpcFootstepStride = new Map<string, number>();

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
  ) {
    this.textures = getGroundTextures();
    this.grassLayer.label = "grass-tufts";
    this.grassLayer.visible = false;
    for (let i = 0; i < GRASS_TUFT_POOL_SIZE; i += 1) {
      const tuft = new Sprite(this.textures.tuft);
      tuft.label = `grass:tuft:${i}`;
      tuft.anchor.set(0.5, 0.92);
      tuft.visible = false;
      this.grassTuftSprites.push(tuft);
      this.grassLayer.addChild(tuft);
    }
    for (let i = 0; i < GRASS_MOVER_SLOTS; i += 1) {
      this.grassMovers.push({ x: 0, y: 0, moving: false });
    }

    this.footstepLayer.label = "footsteps";
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      this.footstepSlots.push(createEmptyFootstepSlot());
      const puff = new Sprite(this.vfx.puff);
      puff.label = `footstep:${i}`;
      puff.anchor.set(0.5);
      puff.visible = false;
      this.footstepSprites.push(puff);
      this.footstepLayer.addChild(puff);
    }
  }

  get footstepPuffCount(): number {
    return this.activeFootstepCount;
  }

  get lastFootstepKind(): FootstepVfxKind | null {
    return this._lastFootstepKind;
  }

  get grassTuftCount(): number {
    return this.activeGrassTufts;
  }

  clearFootsteps(): void {
    this.footstepCursor = 0;
    this.activeFootstepCount = 0;
    this._lastFootstepKind = null;
    this.lastFootstepTick = undefined;
    this.lastFootstepDistance = undefined;
    this.playerFootstepCount = 0;
    this.lastNpcFootstepStride.clear();
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      const slot = this.footstepSlots[i];
      if (slot !== undefined) slot.active = false;
      const sprite = this.footstepSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  clearGrassTufts(): void {
    this.activeGrassTufts = 0;
    this.grassLayer.visible = false;
    for (let i = 0; i < this.grassTuftSprites.length; i += 1) {
      const sprite = this.grassTuftSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  updateFootsteps(
    state: State,
    areaId: string,
    playerPos: Point,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) {
      this.clearFootsteps();
      return;
    }
    const active =
      areaId !== "harness" &&
      state.battle === null &&
      state.arcade === null &&
      state.transition === null;
    if (!active) {
      if (
        areaId !== this.lastFootstepArea ||
        (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)
      ) {
        this.clearFootsteps();
      }
      for (let i = 0; i < this.footstepSprites.length; i += 1) {
        const sprite = this.footstepSprites[i];
        if (sprite !== undefined) sprite.visible = false;
      }
      this.lastFootstepArea = areaId;
      this.lastFootstepTick = state.tick;
      return;
    }
    if (
      areaId !== this.lastFootstepArea ||
      (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)
    ) {
      this.clearFootsteps();
    }
    const dashing = state.previousInput.dash === true && state.motion.moving;
    const stepUnits = dashing
      ? this.world.tunables.walkCycleUnits / 3.5
      : this.world.tunables.walkCycleUnits / 2;
    const map = this.world.surfaces[areaId];
    if (
      this.lastFootstepDistance === undefined ||
      state.motion.distance < this.lastFootstepDistance
    ) {
      this.lastFootstepDistance = state.motion.distance;
    }
    if (
      state.motion.moving &&
      this.lastFootstepArea === areaId &&
      this.lastFootstepTick !== undefined
    ) {
      const delta = state.tick - this.lastFootstepTick;
      const moved = state.motion.distance - this.lastFootstepDistance;
      if (delta >= 1 && delta <= 5 && moved >= stepUnits) {
        this.lastFootstepDistance = state.motion.distance;
        this.playerFootstepCount += 1;
        const surface = map === undefined ? "grass" : surfaceAt(map, state.player);
        const kind = classifyFootstepEffect(surface, areaId, state.player);
        this._lastFootstepKind = kind;
        this.footstepCursor = emitFootstepParticles(
          this.footstepSlots, this.footstepCursor, playerPos.x, playerPos.y, state.facing,
          surface, kind, this.playerFootstepCount, state.tick, false, dashing,
        );
      }
    }
    const area = this.world.areas[areaId];
    if (area !== undefined) {
      const canEmit =
        this.lastFootstepArea === areaId &&
        this.lastFootstepTick !== undefined &&
        state.tick - this.lastFootstepTick >= 1 &&
        state.tick - this.lastFootstepTick <= 5;
      for (let i = 0; i < area.npcs.length; i += 1) {
        const npc = area.npcs[i];
        if (npc === undefined || npc.stroll === undefined || !npcVisible(this.world, state, npc)) {
          continue;
        }
        const live = npcLivePoint(state, npc);
        const npcStride = Math.floor(live.distance / 36);
        const prevNpcStride = this.lastNpcFootstepStride.get(npc.id);
        if (
          canEmit &&
          live.moving &&
          prevNpcStride !== undefined &&
          npcStride !== prevNpcStride
        ) {
          const surface = map === undefined ? "grass" : surfaceAt(map, live);
          const kind = classifyFootstepEffect(surface, areaId, live);
          this.footstepCursor = emitFootstepParticles(
            this.footstepSlots, this.footstepCursor, live.x, live.y, live.facing,
            surface, kind, npcStride, state.tick, true,
          );
        }
        this.lastNpcFootstepStride.set(npc.id, npcStride);
      }
    }
    this.lastFootstepArea = areaId;
    this.lastFootstepTick = state.tick;

    let activeCount = 0;
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      const slot = this.footstepSlots[i];
      const sprite = this.footstepSprites[i];
      if (slot === undefined || sprite === undefined || !slot.active) {
        if (sprite !== undefined) sprite.visible = false;
        continue;
      }
      const rawAge = state.tick - slot.bornTick - slot.delay;
      if (rawAge < -slot.delay || rawAge >= slot.life) {
        slot.active = false;
        sprite.visible = false;
        continue;
      }
      activeCount += 1;
      if (rawAge < 0) {
        sprite.visible = false;
        continue;
      }
      const u = rawAge / slot.life;
      const scale = slot.startScale + (slot.endScale - slot.startScale) * u;
      const texture =
        slot.texture === "snowCrystal" ? this.textures.snowCrystal : this.vfx[slot.texture];
      if (sprite.texture !== texture) sprite.texture = texture;
      if (sprite.blendMode !== slot.blend) sprite.blendMode = slot.blend;
      sprite.visible = true;
      sprite.position.set(
        slot.x + slot.vx * rawAge,
        slot.y + slot.vy * rawAge + 0.5 * slot.gravity * rawAge * rawAge,
      );
      sprite.scale.set(scale, scale * slot.scaleYRatio);
      sprite.rotation = slot.rotation + u * slot.spin * slot.life;
      sprite.tint = slot.tint;
      sprite.alpha = slot.baseAlpha * (1 - u * u);
    }
    this.activeFootstepCount = activeCount;
  }

  updateGrassTufts(
    state: State,
    area: Area,
    playerPos: Point,
    reducedMotion: boolean,
    paused: boolean,
  ): void {
    if (
      paused ||
      reducedMotion ||
      area.id === "harness" ||
      state.battle !== null ||
      state.arcade !== null ||
      state.transition !== null
    ) {
      this.clearGrassTufts();
      return;
    }
    const map = this.world.surfaces[area.id];
    if (map === undefined || !surfaceMapHasGrass(map)) {
      this.clearGrassTufts();
      return;
    }

    const moverCount = collectGrassMovers(state, playerPos, this.grassMovers);
    const used = forEachNearbyGrassCell(
      map,
      area,
      playerPos,
      GRASS_RADIUS_DEFAULT,
      this.grassPointScratch,
      (index, x, y, h1, h2, hasFlower, flowerTint, edgeAlpha) => {
        const sprite = this.grassTuftSprites[index];
        if (sprite === undefined) return false;
        const texture = hasFlower ? this.textures.flower : this.textures.tuft;
        if (sprite.texture !== texture) sprite.texture = texture;
        const baseScale = 0.82 + (((h2 >>> 8) & 0xff) / 255) * 0.4;
        const flipX = (h2 & 16) === 0 ? 1 : -1;
        const sway = writeGrassTuftSway(
          x, y, this.grassMovers, moverCount, state.tick, h1, false, this.grassSwayScratch,
        );
        sprite.visible = true;
        sprite.position.set(x, y);
        sprite.scale.set(flipX * baseScale * sway.scaleX, baseScale * sway.scaleY);
        sprite.rotation = sway.rotation;
        sprite.tint = hasFlower ? flowerTint : 0xffffff;
        sprite.alpha = 0.92 * edgeAlpha;
        return true;
      },
    );

    for (let i = used; i < this.grassTuftSprites.length; i += 1) {
      const sprite = this.grassTuftSprites[i];
      if (sprite !== undefined) sprite.visible = false;
    }
    this.activeGrassTufts = used;
    this.grassLayer.visible = used > 0;
  }
}
