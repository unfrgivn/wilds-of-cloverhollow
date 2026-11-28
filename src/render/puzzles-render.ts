import { Assets, Container, Graphics, Sprite, type Spritesheet } from "pixi.js";
import {
  isPressurePlateActive, isPuzzleSolved, isSteppingStoneGroupLit, mirrorOrientation,
  pushablePosition, tracePrismBeams, type Area, type GrapplePostDef, type PressurePlateDef,
  type PrismEmitterDef, type PrismMirrorDef, type PrismReceiverDef, type PushableDef,
  type ResonanceBellDef, type State, type SteppingStoneGroupDef, type VineBridgeDef, type World,
} from "../core";
import { makeShadowSprite } from "./battle-view";
import { interpolatePoint } from "./camera";
import {
  BEAM_GLOW_POOL_SIZE, createFxSprite, drawPuzzleFx, placeShadow, polygonCenter, pushableFrame,
  SOLVE_SPARKLE_COUNT,
} from "./puzzles-render-fx";
import type { VfxTextures } from "./vfx-textures";

export const PUZZLE_ATLAS_ALIAS = "puzzle-props-sheet";
export const PUZZLE_ATLAS_URL = "assets/puzzles/puzzles.json";

export type PuzzleRenderInfo = {
  solved: string[]; activeBeams: number; fluteWheelOpen: boolean;
  lassoActive: boolean; dashing: boolean;
};

export type PuzzleUpdateOptions = {
  prev?: State; alpha: number; paused: boolean; reducedMotion: boolean; shadowAlpha: number;
};

type PlateEntry = { def: PressurePlateDef; sprite: Sprite; glow: Sprite; holdRing: Sprite };
type StoneEntry = { group: SteppingStoneGroupDef; sprites: { sprite: Sprite; glow: Sprite }[] };
type BridgeEntry = { def: VineBridgeDef; sprite: Sprite; glow: Sprite };
type PushableEntry = { def: PushableDef; sprite: Sprite; shadow: Sprite };
type CrystalEntry = {
  kind: "emitter" | "receiver"; def: PrismEmitterDef | PrismReceiverDef;
  sprite: Sprite; shadow: Sprite;
};
type MirrorEntry = { def: PrismMirrorDef; sprite: Sprite; shadow: Sprite };
type GrappleEntry = { def: GrapplePostDef; sprite: Sprite; shadow: Sprite; glint: Sprite };
type BellEntry = { def: ResonanceBellDef; sprite: Sprite; shadow: Sprite };

/**
 * Painted PixiJS 8 renderer for Elevation E5 spatial puzzles: ground-plane
 * pressure plates, lantern stepping stones, vine bridges, Y-sorted pushables,
 * prism crystals/mirrors, grapple posts, resonance bells, blacklight beams,
 * rainbow lasso arcs, and pooled solve sparkles.
 */
export class PuzzleRenderer {
  readonly groundLayer = new Container();
  readonly fxLayer = new Container();

  private readonly beamGraphics = new Graphics();
  private readonly lassoGraphics = new Graphics();
  private readonly beamGlowPool: Sprite[] = [];
  private readonly solveSparklePool: Sprite[] = [];
  private readonly ownedSprites: Sprite[] = [];

  private plates: PlateEntry[] = [];
  private stones: StoneEntry[] = [];
  private bridges: BridgeEntry[] = [];
  private pushables: PushableEntry[] = [];
  private crystals: CrystalEntry[] = [];
  private mirrors: MirrorEntry[] = [];
  private grapples: GrappleEntry[] = [];
  private bells: BellEntry[] = [];

  constructor(
    private readonly vfx: VfxTextures,
    private readonly layers: { depth: Container; shadowLayer: Container },
  ) {
    this.groundLayer.label = "puzzles:ground";
    this.groundLayer.visible = false;
    this.fxLayer.label = "puzzles:fx";
    this.fxLayer.visible = false;
    this.beamGraphics.label = "puzzles:beams";
    this.lassoGraphics.label = "puzzles:lasso";
    this.fxLayer.addChild(this.beamGraphics, this.lassoGraphics);

    for (let i = 0; i < BEAM_GLOW_POOL_SIZE; i += 1) {
      const glow = createFxSprite(this.vfx.softGlow, `puzzle:beam-glow:${i}`);
      this.beamGlowPool.push(glow);
      this.fxLayer.addChild(glow);
    }
    for (let i = 0; i < SOLVE_SPARKLE_COUNT; i += 1) {
      const sp = createFxSprite(this.vfx.sparkle, `puzzle:solve-sparkle:${i}`);
      this.solveSparklePool.push(sp);
      this.fxLayer.addChild(sp);
    }
  }

  private track(sprite: Sprite): Sprite {
    this.ownedSprites.push(sprite);
    return sprite;
  }

  private addDepthProp(
    label: string,
    id: string,
    x: number,
    y: number,
    scale: number,
    anchorY: number,
  ): { sprite: Sprite; shadow: Sprite } {
    const sprite = this.track(new Sprite());
    sprite.label = label;
    sprite.anchor.set(0.5, anchorY);
    sprite.scale.set(scale);
    sprite.position.set(x, y);
    sprite.zIndex = y;
    const shadow = this.track(makeShadowSprite(this.vfx.contactShadow, `shadow:puzzle:${id}`));
    this.layers.depth.addChild(sprite);
    this.layers.shadowLayer.addChild(shadow);
    return { sprite, shadow };
  }

  clear(): void {
    for (const sprite of this.ownedSprites) sprite.destroy();
    this.ownedSprites.length = 0;
    this.plates = [];
    this.stones = [];
    this.bridges = [];
    this.pushables = [];
    this.crystals = [];
    this.mirrors = [];
    this.grapples = [];
    this.bells = [];
    this.hideFx();
    this.groundLayer.visible = false;
  }

  mountArea(area: Area): void {
    this.clear();
    const puzzles = area.puzzles;
    if (puzzles === undefined) return;

    for (const def of puzzles.plates ?? []) {
      const glow = this.track(
        createFxSprite(this.vfx.softGlow, `puzzle:plate-glow:${def.id}`, 0xffe484),
      );
      glow.position.set(def.x, def.y);
      const holdRing = this.track(
        createFxSprite(this.vfx.energyRing, `puzzle:plate-hold:${def.id}`, 0xf4a8d8),
      );
      holdRing.position.set(def.x, def.y);
      const sprite = this.track(new Sprite());
      sprite.label = `puzzle:plate:${def.id}`;
      sprite.anchor.set(0.5);
      sprite.scale.set(0.28);
      sprite.position.set(def.x, def.y);
      this.groundLayer.addChild(glow, sprite, holdRing);
      this.plates.push({ def, sprite, glow, holdRing });
    }

    for (const group of puzzles.steppingStones ?? []) {
      const sprites = group.stones.map((pt, index) => {
        const glow = this.track(
          createFxSprite(this.vfx.softGlow, `puzzle:stone-glow:${group.id}:${index}`, 0xc9a0ff),
        );
        glow.position.set(pt.x, pt.y);
        const sprite = this.track(new Sprite());
        sprite.label = `puzzle:stone:${group.id}:${index}`;
        sprite.anchor.set(0.5);
        sprite.scale.set(0.24);
        sprite.position.set(pt.x, pt.y);
        sprite.visible = false;
        this.groundLayer.addChild(glow, sprite);
        return { sprite, glow };
      });
      this.stones.push({ group, sprites });
    }

    for (const def of puzzles.bridges ?? []) {
      const point = def.visualPoint ?? polygonCenter(def.polygon);
      const glow = this.track(
        createFxSprite(this.vfx.softGlow, `puzzle:bridge-glow:${def.id}`, 0xffe999),
      );
      glow.position.set(point.x, point.y);
      const sprite = this.track(new Sprite());
      sprite.label = `puzzle:bridge:${def.id}`;
      sprite.anchor.set(0.5);
      sprite.position.set(point.x, point.y);
      this.groundLayer.addChild(glow, sprite);
      this.bridges.push({ def, sprite, glow });
    }

    for (const def of puzzles.pushables ?? []) {
      const pair = this.addDepthProp(`puzzle:pushable:${def.id}`, def.id, def.x, def.y, 0.24, 0.82);
      this.pushables.push({ def, ...pair });
    }
    for (const def of puzzles.emitters ?? []) {
      const pair = this.addDepthProp(`puzzle:emitter:${def.id}`, def.id, def.x, def.y, 0.28, 0.84);
      this.crystals.push({ kind: "emitter", def, ...pair });
    }
    for (const def of puzzles.receivers ?? []) {
      const pair = this.addDepthProp(`puzzle:receiver:${def.id}`, def.id, def.x, def.y, 0.28, 0.84);
      this.crystals.push({ kind: "receiver", def, ...pair });
    }
    for (const def of puzzles.mirrors ?? []) {
      const pair = this.addDepthProp(`puzzle:mirror:${def.id}`, def.id, def.x, def.y, 0.28, 0.84);
      this.mirrors.push({ def, ...pair });
    }
    for (const def of puzzles.grapples ?? []) {
      const pair = this.addDepthProp(`puzzle:grapple:${def.id}`, def.id, def.x, def.y, 0.28, 0.86);
      const glint = this.track(
        createFxSprite(this.vfx.sparkle, `puzzle:grapple-glint:${def.id}`, 0xffe888),
      );
      this.fxLayer.addChild(glint);
      this.grapples.push({ def, ...pair, glint });
    }
    for (const def of puzzles.bells ?? []) {
      const pair = this.addDepthProp(`puzzle:bell:${def.id}`, def.id, def.x, def.y, 0.30, 0.86);
      pair.sprite.tint =
        def.style === "seashell" ? 0xfff2f6 : def.style === "shrine" ? 0xf3eeff : 0xffffff;
      this.bells.push({ def, ...pair });
    }
  }

  private hideFx(): void {
    this.fxLayer.visible = false;
    this.beamGraphics.clear();
    this.lassoGraphics.clear();
    for (const glow of this.beamGlowPool) glow.visible = false;
    for (const sp of this.solveSparklePool) sp.visible = false;
    for (const entry of this.grapples) entry.glint.visible = false;
  }

  private hideAll(): void {
    this.groundLayer.visible = false;
    this.hideFx();
    for (const sprite of this.ownedSprites) sprite.visible = false;
  }

  update(world: World, area: Area, state: State, options: PuzzleUpdateOptions): void {
    const overworldVisible =
      area.id !== "harness" && state.battle === null && state.arcade === null;
    const hasTransient =
      state.puzzleArea?.lasso !== undefined || state.puzzleArea?.lastSolved !== undefined;
    if (!overworldVisible || (area.puzzles === undefined && !hasTransient)) {
      this.hideAll();
      return;
    }

    const sheet = Assets.get<Spritesheet | undefined>(PUZZLE_ATLAS_ALIAS);
    const { prev, alpha, paused, reducedMotion, shadowAlpha } = options;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(state.tick * 0.09);

    this.groundLayer.visible =
      this.plates.length > 0 || this.stones.length > 0 || this.bridges.length > 0;
    this.updateGround(world, area, state, sheet, pulse);

    const beams =
      (area.puzzles?.emitters?.length ?? 0) > 0
        ? tracePrismBeams(area, state)
        : { segments: [], energizedReceivers: [], activeEmitters: [] };
    this.updateDepthEntities(area, state, sheet, prev, alpha, shadowAlpha, reducedMotion, pulse,
      beams);
    this.fxLayer.visible = drawPuzzleFx(
      {
        beamGraphics: this.beamGraphics,
        lassoGraphics: this.lassoGraphics,
        beamGlowPool: this.beamGlowPool,
        solveSparklePool: this.solveSparklePool,
        crystals: this.crystals,
        mirrors: this.mirrors,
        bells: this.bells,
        grappleCount: this.grapples.length,
      },
      world, area, state, beams, pulse, paused, reducedMotion,
    );
  }

  private updateGround(
    world: World,
    area: Area,
    state: State,
    sheet: Spritesheet | undefined,
    pulse: number,
  ): void {
    const plateUp = sheet?.textures["pressure-plate-up"];
    const plateDown = sheet?.textures["pressure-plate-down"];
    const heldPlates = state.puzzleArea?.heldPlates;
    for (const { def, sprite, glow, holdRing } of this.plates) {
      const active = isPressurePlateActive(area, state, def);
      const texture = active ? plateDown : plateUp;
      sprite.visible = texture !== undefined;
      if (texture !== undefined) sprite.texture = texture;
      glow.visible = active;
      if (active) {
        glow.scale.set(0.76 + 0.1 * pulse);
        glow.alpha = 0.28 + 0.14 * pulse;
      }
      const held = heldPlates?.[def.id] !== undefined;
      holdRing.visible = held;
      if (held) {
        const ringScale = 0.68 + 0.08 * pulse;
        holdRing.scale.set(ringScale, ringScale * 0.62);
        holdRing.alpha = 0.52 + 0.18 * pulse;
      }
    }

    const stoneTex = sheet?.textures["stepping-stone"];
    for (const entry of this.stones) {
      const lit = isSteppingStoneGroupLit(world, state, entry.group);
      for (const item of entry.sprites) {
        item.sprite.visible = lit && stoneTex !== undefined;
        item.glow.visible = lit;
        if (lit && stoneTex !== undefined) {
          item.sprite.texture = stoneTex;
          item.sprite.alpha = 0.92;
          item.glow.scale.set(0.64 + 0.09 * pulse);
          item.glow.alpha = 0.28 + 0.14 * pulse;
        }
      }
    }

    const bridgeTex = sheet?.textures["vine-bridge"];
    for (const { def, sprite, glow } of this.bridges) {
      const open = isPuzzleSolved(world, state, def.opensOn);
      sprite.visible = bridgeTex !== undefined;
      if (bridgeTex !== undefined) {
        sprite.texture = bridgeTex;
        sprite.scale.set(open ? 0.42 : 0.46, open ? 0.42 : 0.50);
        sprite.tint = open ? 0xffffff : 0x5c4a62;
        sprite.alpha = open ? 0.96 : 0.92;
      }
      glow.visible = open;
      if (open) {
        glow.scale.set(0.95 + 0.1 * pulse);
        glow.alpha = 0.18 + 0.08 * pulse;
      }
    }
  }

  private updateDepthEntities(
    area: Area,
    state: State,
    sheet: Spritesheet | undefined,
    prev: State | undefined,
    alpha: number,
    shadowAlpha: number,
    reducedMotion: boolean,
    pulse: number,
    beams: { activeEmitters: string[]; energizedReceivers: string[] },
  ): void {
    for (const { def, sprite, shadow } of this.pushables) {
      const texture = sheet?.textures[pushableFrame(def.kind)];
      const curr = pushablePosition(area, state, def);
      const pos =
        prev !== undefined && prev.area === area.id && alpha < 1
          ? interpolatePoint(pushablePosition(area, prev, def), curr, alpha)
          : curr;
      const sliding = state.puzzleArea?.pushables?.[def.id]?.sliding !== undefined &&
        !reducedMotion;
      sprite.visible = texture !== undefined;
      shadow.visible = texture !== undefined;
      if (texture === undefined) continue;
      sprite.texture = texture;
      sprite.position.set(pos.x, pos.y);
      sprite.zIndex = pos.y;
      if (sliding && def.kind === "snowball") {
        const wobble = Math.sin(state.tick * 0.65);
        sprite.scale.set(0.24 * (1 + 0.06 * wobble), 0.24 * (1 - 0.05 * wobble));
        sprite.rotation = wobble * 0.14;
      } else {
        sprite.scale.set(0.24);
        sprite.rotation = 0;
      }
      placeShadow(shadow, pos.x, pos.y, 46, 17, shadowAlpha);
    }

    const crystalOff = sheet?.textures["sun-crystal-off"];
    const crystalOn = sheet?.textures["sun-crystal-on"];
    for (const { kind, def, sprite, shadow } of this.crystals) {
      const lit =
        kind === "emitter"
          ? beams.activeEmitters.includes(def.id)
          : beams.energizedReceivers.includes(def.id);
      const texture = lit ? crystalOn : crystalOff;
      sprite.visible = texture !== undefined;
      shadow.visible = texture !== undefined;
      if (texture === undefined) continue;
      sprite.texture = texture;
      placeShadow(shadow, def.x, def.y, 46, 18, shadowAlpha);
    }

    const mirrorTex = sheet?.textures["prism-mirror"];
    for (const { def, sprite, shadow } of this.mirrors) {
      sprite.visible = mirrorTex !== undefined;
      shadow.visible = mirrorTex !== undefined;
      if (mirrorTex === undefined) continue;
      const orient = mirrorOrientation(area, state, def);
      sprite.texture = mirrorTex;
      const flipX = orient === "nw" || orient === "sw" ? -1 : 1;
      const tilt = orient === "ne" || orient === "sw" ? -0.14 : 0.14;
      sprite.scale.set(0.28 * flipX, 0.28);
      sprite.rotation = tilt;
      placeShadow(shadow, def.x, def.y, 44, 17, shadowAlpha);
    }

    const postTex = sheet?.textures["grapple-post"];
    const pulled = state.puzzleArea?.pulledLevers ?? [];
    for (const { def, sprite, shadow, glint } of this.grapples) {
      sprite.visible = postTex !== undefined;
      shadow.visible = postTex !== undefined;
      if (postTex === undefined) {
        glint.visible = false;
        continue;
      }
      const isPulled = pulled.includes(def.id);
      sprite.texture = postTex;
      sprite.rotation = isPulled ? 0.16 : 0;
      placeShadow(shadow, def.x, def.y, 36, 14, shadowAlpha);
      glint.visible = true;
      glint.position.set(
        def.x + (isPulled ? 6 : 0),
        def.y - 46 - (reducedMotion ? 0 : Math.sin(state.tick * 0.08) * 2.5),
      );
      glint.scale.set(0.32 + 0.14 * pulse);
      glint.alpha = isPulled ? 0.72 : 0.44 + 0.25 * pulse;
    }

    const bellTex = sheet?.textures["resonance-bell"];
    for (const { def, sprite, shadow } of this.bells) {
      sprite.visible = bellTex !== undefined;
      shadow.visible = bellTex !== undefined;
      if (bellTex === undefined) continue;
      sprite.texture = bellTex;
      placeShadow(shadow, def.x, def.y, 44, 17, shadowAlpha);
    }
  }

  renderInfo(world: World, state: State): PuzzleRenderInfo {
    const area = world.areas[state.area];
    const overworldVisible =
      area !== undefined && area.id !== "harness" && state.battle === null && state.arcade === null;
    const activeBeams =
      overworldVisible && (area.puzzles?.emitters?.length ?? 0) > 0
        ? tracePrismBeams(area, state).segments.length
        : 0;
    const solved = Object.entries(state.puzzles ?? {})
      .filter(([, value]) => value === true)
      .map(([id]) => id)
      .sort();
    return {
      solved,
      activeBeams,
      fluteWheelOpen: state.puzzleArea?.fluteWheel !== undefined,
      lassoActive: state.puzzleArea?.lasso !== undefined,
      dashing: state.previousInput.dash === true && state.motion.moving,
    };
  }

  destroy(): void {
    this.clear();
    this.groundLayer.destroy({ children: true });
    this.fxLayer.destroy({ children: true });
  }
}
