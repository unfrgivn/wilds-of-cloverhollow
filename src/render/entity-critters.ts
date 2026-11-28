import { Assets, Container, Sprite, Spritesheet, Texture } from "pixi.js";
import {
  npcFacing, presentCritters,
  type Area, type Direction, type Point, type State, type World,
} from "../core";
import { ambientFor, type AmbientFlyer } from "../content/ambient";
import { flyerAt } from "./ambient";
import type { Rect } from "./area-view";
import { makeShadowSprite, placeAura } from "./battle-view";
import { interpolatePoint } from "./camera";
import { composePose, idleBreathing, NEUTRAL_POSE } from "./motion";
import { sanctuaryCritterHopPose } from "./micro-delights";
import {
  computeCritterShadow, computeFlyerVisual, computeRoamerBobAndFacing,
  type ShadowTransform,
} from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

export type EntityLayerContainers = {
  depth: Container;
  shadowLayer: Container;
  ambientLayer: Container;
  emissiveLayer: Container;
};

export type CritterFrameInfo = {
  id: string;
  kind: string;
  frame: string;
  x: number;
  y: number;
};

export type AmbientFrameInfo = {
  id: string;
  x: number;
  y: number;
  frame: number;
};

export function applyShadow(sprite: Sprite, shadow: ShadowTransform): void {
  sprite.position.set(shadow.x, shadow.y);
  sprite.width = shadow.width;
  sprite.height = shadow.height;
  sprite.alpha = shadow.alpha;
}

export function spriteFigures(sprites: readonly Sprite[]): Rect[] {
  return sprites
    .filter((sprite) => sprite.visible && sprite.texture !== Texture.EMPTY)
    .map((sprite) => {
      const { width, height } = sprite;
      const anchorX = sprite.scale.x < 0 ? 1 - sprite.anchor.x : sprite.anchor.x;
      const anchorY = sprite.scale.y < 0 ? 1 - sprite.anchor.y : sprite.anchor.y;
      const x0 = sprite.x - anchorX * width;
      const y0 = sprite.y - anchorY * height;
      return { x0, y0, x1: x0 + width, y1: y0 + height };
    });
}

export type CalmedCritterNpcParams = {
  world: World;
  state: State;
  npc: Area["npcs"][number];
  npcIndex: number;
  sprite: Sprite;
  shadow: Sprite | null;
  livePos: Point;
  shadowAlpha: number;
  livingMotion: boolean;
  reducedMotion: boolean;
  overrideFacing?: Direction;
  sanctuaryHop: { npcId: string; elapsed: number } | null;
};

export function renderCalmedCritterNpc(
  p: CalmedCritterNpcParams,
): { id: string; frame: string; facing: string } | null {
  if (p.npc.visibleWhenCalmed === undefined) return null;
  const critter = p.world.critters[p.npc.visibleWhenCalmed];
  const sheet = critter === undefined ? undefined : Assets.get<Spritesheet>(critter.atlas);
  const texture = sheet?.textures.calm_idle_01;
  if (critter === undefined || texture === undefined) return null;
  const facing = p.overrideFacing ?? npcFacing(p.state, p.npc);
  const talking = p.state.dialogue !== null && p.state.dialogue.knot === p.npc.knot;
  const flipX = talking ? p.state.player.x > p.livePos.x : facing === "right";
  const scale = critter.overworldHeight / critter.figureHeight;
  const idlePose = !p.livingMotion
    ? NEUTRAL_POSE
    : idleBreathing(p.state.tick, (p.npcIndex + 1) * 1.1, 0.012);
  const hopPose = p.sanctuaryHop !== null && p.sanctuaryHop.npcId === p.npc.id
    ? sanctuaryCritterHopPose(p.npc.id, p.sanctuaryHop.elapsed, p.reducedMotion)
    : NEUTRAL_POSE;
  const pose = composePose(idlePose, hopPose);
  p.sprite.texture = texture;
  p.sprite.anchor.set(0.5, 504 / 512);
  p.sprite.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
  p.sprite.position.set(p.livePos.x + pose.offsetX, p.livePos.y + pose.offsetY);
  p.sprite.rotation = pose.rotation;
  p.sprite.zIndex = p.livePos.y;
  if (p.shadow !== null) {
    applyShadow(
      p.shadow,
      computeCritterShadow(p.livePos, critter.overworldHeight, pose.offsetY, p.shadowAlpha),
    );
  }
  return { id: p.npc.id, frame: "calm_idle_01", facing };
}

/**
 * Owns overworld chaos/calm critter sprites (bodies, auras, contact shadows)
 * and ambient flyer pools (sprites, butterfly shadows, fairy-light glows).
 */
export class OverworldCritterAmbientLayer {
  private critterSprites: { id: string; body: Sprite; aura: Sprite; shadow: Sprite }[] = [];
  private critterKeys = "";
  private critterFrames: CritterFrameInfo[] = [];
  private ambientSprites: {
    flyer: AmbientFlyer;
    sprite: Sprite;
    shadow: Sprite | null;
    glow: Sprite | null;
  }[] = [];
  private ambientFrames: AmbientFrameInfo[] = [];

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly layers: EntityLayerContainers,
  ) {}

  clearArea(): void {
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
      sprite.shadow.destroy();
    }
    this.critterSprites = [];
    this.critterKeys = "";
  }

  mountAmbient(area: Area): void {
    for (const entry of this.ambientSprites) {
      entry.sprite.destroy();
      entry.shadow?.destroy();
      entry.glow?.destroy();
    }
    this.ambientSprites = ambientFor(area).map((flyer) => {
      const sprite = new Sprite();
      sprite.label = `ambient:${flyer.id}`;
      sprite.anchor.set(0.5);
      this.layers.ambientLayer.addChild(sprite);
      let shadow: Sprite | null = null;
      if (flyer.animation.startsWith("butterfly")) {
        shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:ambient:${flyer.id}`);
        shadow.visible = false;
        this.layers.shadowLayer.addChild(shadow);
      }
      let glow: Sprite | null = null;
      if (flyer.animation === "fairy_light") {
        glow = new Sprite(this.vfx.softGlow);
        glow.label = `glow:ambient:${flyer.id}`;
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        glow.visible = false;
        this.layers.emissiveLayer.addChild(glow);
      }
      return { flyer, sprite, shadow, glow };
    });
  }

  figures(): Rect[] {
    return spriteFigures(this.critterSprites.flatMap(({ body, aura }) => [body, aura]));
  }

  syncCritters(present: ReturnType<typeof presentCritters>): void {
    const keys = present.map((critter) => `${critter.key}=${critter.kind.id}`).join("|");
    if (keys === this.critterKeys) return;
    this.critterKeys = keys;
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
      sprite.shadow.destroy();
    }
    this.critterSprites = present.map((critter) => {
      const body = new Sprite();
      body.label = `critter:${critter.key}`;
      const aura = new Sprite();
      aura.label = `critter:${critter.key}:aura`;
      const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:critter:${critter.key}`);
      this.layers.depth.addChild(aura, body);
      this.layers.shadowLayer.addChild(shadow);
      return { id: critter.key, body, aura, shadow };
    });
  }

  renderCritters(
    state: State,
    hasArea: boolean,
    shadowAlpha: number,
    previousState: State | undefined,
    alpha: number,
    livingMotion: boolean,
    reducedMotion = false,
  ): void {
    const present = hasArea ? presentCritters(this.world, state) : [];
    this.syncCritters(present);
    const frames: CritterFrameInfo[] = [];
    for (const [index, { id, body, aura, shadow }] of this.critterSprites.entries()) {
      const critter = present[index];
      if (critter === undefined) continue;
      const content = critter.kind;
      const logicalPoint = critter.point;
      const roamer = critter.wild;
      const prevWild = roamer === null || previousState === undefined
        ? undefined
        : previousState.wild.find((w) => w.den === roamer.den && w.kind === roamer.kind);
      const point = prevWild !== undefined && alpha < 1
        ? interpolatePoint(prevWild, logicalPoint, alpha)
        : logicalPoint;
      const sheet = Assets.get<Spritesheet>(content.atlas);
      if (sheet === undefined) continue;
      const { calm, frame, flipX, pose } = computeRoamerBobAndFacing(
        critter, state, index, point, this.world.tunables.roam.noticeTicks, livingMotion,
      );
      const texture = sheet.textures[frame];
      const auraTexture = sheet.textures.chaos_aura_01;
      if (texture === undefined || auraTexture === undefined) continue;
      const scale = content.overworldHeight / content.figureHeight;
      body.texture = texture;
      body.anchor.set(0.5, 504 / 512);
      body.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
      body.position.set(point.x + pose.offsetX, point.y + pose.offsetY);
      body.rotation = pose.rotation;
      body.zIndex = point.y;
      applyShadow(
        shadow, computeCritterShadow(point, content.overworldHeight, pose.offsetY, shadowAlpha),
      );
      aura.visible = !calm;
      aura.texture = auraTexture;
      placeAura(
        aura, { x: point.x + pose.offsetX, y: point.y + pose.offsetY }, scale,
        content.auraCentre, content.bodyCentre, flipX,
      );
      aura.zIndex = point.y - 0.5;
      aura.alpha = reducedMotion ? 0.65 : 0.65 + Math.sin(state.tick / 18) * 0.2;
      aura.rotation = reducedMotion ? 0 : state.tick / 180;
      frames.push({ id, kind: content.id, frame, x: logicalPoint.x, y: logicalPoint.y });
    }
    this.critterFrames = frames;
  }

  renderAmbient(state: State, area: Area, reducedMotion: boolean): void {
    const sheet = Assets.get<Spritesheet>("ambient-sheet");
    const visible = state.battle === null && state.arcade === null;
    const showEffects = visible && area.id !== "harness";
    if (!visible) {
      for (const { sprite, shadow, glow } of this.ambientSprites) {
        sprite.visible = false;
        if (shadow !== null) shadow.visible = false;
        if (glow !== null) glow.visible = false;
      }
      this.ambientFrames = [];
      return;
    }
    const frames: AmbientFrameInfo[] = [];
    for (const { flyer, sprite, shadow, glow } of this.ambientSprites) {
      const names = sheet?.data.animations?.[flyer.animation] ?? [];
      const rawPosition = flyerAt(flyer, reducedMotion ? 0 : state.tick, Math.max(1, names.length));
      const position = reducedMotion ? { ...rawPosition, frame: 0 } : rawPosition;
      const frameName = names[position.frame] ?? names[0];
      const texture = frameName === undefined ? undefined : sheet?.textures[frameName];
      sprite.visible = texture !== undefined;
      if (texture === undefined) {
        if (shadow !== null) shadow.visible = false;
        if (glow !== null) glow.visible = false;
        continue;
      }
      sprite.texture = texture;
      sprite.position.set(position.x, position.y);
      const scale = flyer.size / 96;
      sprite.scale.set(position.flip ? -scale : scale, scale);
      const visual = computeFlyerVisual(
        flyer, position, reducedMotion ? 0 : state.tick, reducedMotion,
      );
      if (shadow !== null) {
        shadow.visible = showEffects && visual.shadow !== null;
        if (visual.shadow !== null) applyShadow(shadow, visual.shadow);
      }
      if (glow !== null) {
        glow.visible = showEffects && visual.glow !== null;
        if (visual.glow !== null) {
          glow.position.set(visual.glow.x, visual.glow.y);
          glow.width = visual.glow.width;
          glow.height = visual.glow.height;
          glow.alpha = visual.glow.alpha;
          glow.tint = visual.glow.tint;
        }
      }
      frames.push({ id: flyer.id, x: position.x, y: position.y, frame: position.frame });
    }
    this.ambientFrames = frames;
  }

  get critters(): CritterFrameInfo[] { return this.critterFrames; }
  get ambient(): AmbientFrameInfo[] { return this.ambientFrames; }
}
