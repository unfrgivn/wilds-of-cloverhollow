import { Assets, Container, Graphics, Sprite, type Spritesheet, type Texture } from "pixi.js";
import {
  isPressurePlateActive, isPuzzleSolved, isSteppingStoneGroupLit, mirrorOrientation,
  pushablePosition, tracePrismBeams, type Area, type Direction, type GrapplePostDef,
  type Point, type Polygon, type PressurePlateDef, type PrismEmitterDef, type PrismMirrorDef,
  type PrismOrientation, type PrismReceiverDef, type PushableDef, type ResonanceBellDef,
  type State, type SteppingStoneGroupDef, type VineBridgeDef, type World,
} from "../core";
import { makeShadowSprite } from "./battle-view";
import { interpolatePoint } from "./camera";
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

const BEAM_GLOW_POOL_SIZE = 20;
const SOLVE_SPARKLE_COUNT = 14;
const SOLVE_BURST_TICKS = 36;
const LASSO_RAINBOW: readonly number[] = [0xf48fb1, 0xffcc80, 0xfff59d, 0xa5d6a7, 0x90caf9];
const SPARKLE_TINTS: readonly number[] = [0xffe885, 0xf7b2d9, 0xa8e6cf, 0xb8d8ff, 0xfff6cc];
const NOTE_COLORS: Readonly<Record<Direction, number>> = {
  up: 0xf27474, right: 0xf5cb5c, down: 0x6bc78b, left: 0x6cb5f5,
};

function polygonCenter(polygon: Polygon): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const pt of polygon) { sx += pt[0]; sy += pt[1]; }
  return { x: sx / polygon.length, y: sy / polygon.length };
}

function pushableFrame(kind: PushableDef["kind"]): string {
  return kind === "rock" ? "push-rock" : kind === "snowball" ? "push-snowball" : "push-crate";
}

function mirrorArms(orientation: PrismOrientation): [Point, Point] {
  if (orientation === "ne") return [{ x: 0, y: -1 }, { x: 1, y: 0 }];
  if (orientation === "se") return [{ x: 0, y: 1 }, { x: 1, y: 0 }];
  if (orientation === "sw") return [{ x: 0, y: 1 }, { x: -1, y: 0 }];
  return [{ x: 0, y: -1 }, { x: -1, y: 0 }];
}

function goalAnchor(area: Area, state: State, goalId: string): Point {
  const puzzles = area.puzzles;
  const goal = puzzles?.goals?.find((item) => item.id === goalId);
  if (puzzles === undefined || goal === undefined) return state.player;
  const bell = puzzles.bells?.find((item) => item.id === goal.requireBells?.[0]);
  if (bell !== undefined) return { x: bell.x, y: bell.y - 34 };
  const recv = puzzles.receivers?.find((item) => item.id === goal.requireReceivers?.[0]);
  if (recv !== undefined) return { x: recv.x, y: recv.y - 24 };
  const post = puzzles.grapples?.find((item) => item.id === goal.requireLevers?.[0]);
  if (post !== undefined) return { x: post.x, y: post.y - 26 };
  const plate = puzzles.plates?.find((item) => item.id === goal.requirePlates?.[0]);
  if (plate !== undefined) return { x: plate.x, y: plate.y - 12 };
  return { x: state.player.x, y: state.player.y - 28 };
}

function placeShadow(
  shadow: Sprite, x: number, y: number, width: number, height: number, alpha: number,
): void {
  shadow.position.set(x, y + 1);
  shadow.width = width;
  shadow.height = height;
  shadow.alpha = alpha;
}

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
      const glow = this.makeFxSprite(this.vfx.softGlow, `puzzle:beam-glow:${i}`);
      this.beamGlowPool.push(glow);
      this.fxLayer.addChild(glow);
    }
    for (let i = 0; i < SOLVE_SPARKLE_COUNT; i += 1) {
      const sp = this.makeFxSprite(this.vfx.sparkle, `puzzle:solve-sparkle:${i}`);
      this.solveSparklePool.push(sp);
      this.fxLayer.addChild(sp);
    }
  }

  private makeFxSprite(texture: Texture, label: string, tint = 0xffffff): Sprite {
    const sprite = new Sprite(texture);
    sprite.label = label;
    sprite.anchor.set(0.5);
    sprite.blendMode = "add";
    sprite.tint = tint;
    sprite.visible = false;
    return sprite;
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
      const glow = this.track(this.makeFxSprite(this.vfx.softGlow, `puzzle:plate-glow:${def.id}`,
        0xffe484));
      glow.position.set(def.x, def.y);
      const holdRing = this.track(
        this.makeFxSprite(this.vfx.energyRing, `puzzle:plate-hold:${def.id}`, 0xf4a8d8),
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
          this.makeFxSprite(this.vfx.softGlow, `puzzle:stone-glow:${group.id}:${index}`, 0xc9a0ff),
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
        this.makeFxSprite(this.vfx.softGlow, `puzzle:bridge-glow:${def.id}`, 0xffe999),
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
        this.makeFxSprite(this.vfx.sparkle, `puzzle:grapple-glint:${def.id}`, 0xffe888),
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
    this.updateFx(world, area, state, beams, pulse, paused, reducedMotion);
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

  private updateFx(
    world: World,
    area: Area,
    state: State,
    beams: {
      segments: { from: Point; to: Point }[];
      activeEmitters: string[];
      energizedReceivers: string[];
    },
    pulse: number,
    paused: boolean,
    reducedMotion: boolean,
  ): void {
    this.beamGraphics.clear();
    this.lassoGraphics.clear();
    let glowUsed = 0;
    const placeGlow = (x: number, y: number, scale: number, tint: number, alphaVal: number) => {
      const sprite = this.beamGlowPool[glowUsed];
      if (sprite === undefined) return;
      glowUsed += 1;
      sprite.visible = true;
      sprite.position.set(x, y);
      sprite.scale.set(scale);
      sprite.tint = tint;
      sprite.alpha = alphaVal;
    };

    for (const seg of beams.segments) {
      const x1 = seg.from.x;
      const y1 = seg.from.y - 24;
      const x2 = seg.to.x;
      const y2 = seg.to.y - 24;
      this.beamGraphics
        .moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 12, color: 0xb98eff, alpha: 0.55, cap: "round" })
        .moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ width: 4, color: 0xeefcff, alpha: 0.92, cap: "round" });
      placeGlow(x2, y2, 0.56 + 0.1 * pulse, 0xd4b6ff, 0.55 + 0.15 * pulse);
    }

    for (const { kind, def } of this.crystals) {
      const lit =
        kind === "emitter"
          ? beams.activeEmitters.includes(def.id)
          : beams.energizedReceivers.includes(def.id);
      if (lit) {
        placeGlow(
          def.x, def.y - 24, 0.85 + 0.14 * pulse,
          kind === "emitter" ? 0xd8a8ff : 0xffe694, 0.45 + 0.2 * pulse,
        );
      }
    }

    for (const { def } of this.mirrors) {
      const [a, b] = mirrorArms(mirrorOrientation(area, state, def));
      const cx = def.x;
      const cy = def.y - 26;
      const len = 18;
      this.beamGraphics
        .moveTo(cx + a.x * len, cy + a.y * len).lineTo(cx, cy)
        .lineTo(cx + b.x * len, cy + b.y * len)
        .stroke({ width: 5, color: 0xffe28a, alpha: 0.88, cap: "round", join: "round" })
        .moveTo(cx + a.x * len, cy + a.y * len).lineTo(cx, cy)
        .lineTo(cx + b.x * len, cy + b.y * len)
        .stroke({ width: 2.2, color: 0xc2f7ff, alpha: 0.96, cap: "round", join: "round" })
        .circle(cx + a.x * len, cy + a.y * len, 3.2).fill({ color: 0xeefcff, alpha: 0.95 })
        .circle(cx + b.x * len, cy + b.y * len, 3.2).fill({ color: 0xeefcff, alpha: 0.95 });
    }

    const solvedBells = state.puzzleArea?.solvedBells ?? [];
    for (const { def } of this.bells) {
      const bellSolved =
        solvedBells.includes(def.id) ||
        (area.puzzles?.goals ?? []).some(
          (g) => (g.requireBells ?? []).includes(def.id) && isPuzzleSolved(world, state, g.id),
        );
      const startX = def.x - ((def.sequence.length - 1) * 14) * 0.5;
      for (let i = 0; i < def.sequence.length; i += 1) {
        const note = def.sequence[i];
        if (note === undefined) continue;
        const bob = reducedMotion ? 0 : Math.sin(state.tick * 0.08 + i * 1.1) * 2.4;
        const dotX = startX + i * 14;
        const dotY = def.y - 68 + bob;
        this.beamGraphics
          .circle(dotX, dotY, 5.4).fill({ color: 0x47321f, alpha: bellSolved ? 0.55 : 0.85 })
          .circle(dotX, dotY, 4.0).fill({
            color: bellSolved ? 0xffe58a : NOTE_COLORS[note],
            alpha: bellSolved ? 0.68 + 0.2 * pulse : 0.96,
          });
      }
    }

    for (let i = glowUsed; i < this.beamGlowPool.length; i += 1) {
      const sprite = this.beamGlowPool[i];
      if (sprite !== undefined) sprite.visible = false;
    }

    const lasso = state.puzzleArea?.lasso;
    if (lasso !== undefined) this.drawLassoArc(lasso, state.player, state.tick, reducedMotion);

    const sparkleActive = this.updateSolveSparkles(area, state, paused, reducedMotion);
    this.fxLayer.visible =
      beams.segments.length > 0 ||
      this.mirrors.length > 0 ||
      this.bells.length > 0 ||
      this.grapples.length > 0 ||
      glowUsed > 0 ||
      lasso !== undefined ||
      sparkleActive;
  }

  private updateSolveSparkles(
    area: Area,
    state: State,
    paused: boolean,
    reducedMotion: boolean,
  ): boolean {
    const solved = state.puzzleArea?.lastSolved;
    const age = solved === undefined ? -1 : state.tick - solved.tick;
    if (solved === undefined || reducedMotion || paused || age < 0 || age >= SOLVE_BURST_TICKS) {
      for (const sp of this.solveSparklePool) sp.visible = false;
      return false;
    }
    const u = age / SOLVE_BURST_TICKS;
    const center = goalAnchor(area, state, solved.id);
    for (let i = 0; i < this.solveSparklePool.length; i += 1) {
      const sp = this.solveSparklePool[i];
      if (sp === undefined) continue;
      const angle = (i / SOLVE_SPARKLE_COUNT) * Math.PI * 2 + u * 0.85;
      const radius = 14 + u * (54 + (i % 3) * 14);
      sp.visible = true;
      sp.position.set(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius * 0.72 - u * 16,
      );
      sp.scale.set((0.46 + (i % 3) * 0.14) * (1 - u * 0.45));
      sp.rotation = angle + u * 2.2;
      sp.tint = SPARKLE_TINTS[i % SPARKLE_TINTS.length] ?? 0xffe885;
      sp.alpha = Math.sin(u * Math.PI) * 0.95;
    }
    return true;
  }

  private drawLassoArc(
    lasso: NonNullable<NonNullable<State["puzzleArea"]>["lasso"]>,
    player: Point,
    tick: number,
    reducedMotion: boolean,
  ): void {
    const progress = Math.min(1, (lasso.tick + 1) / Math.max(1, lasso.duration));
    const reach =
      lasso.kind === "swing"
        ? 1
        : progress < 0.38
          ? 0.48 + (progress / 0.38) * 0.52
          : 1 - ((progress - 0.38) / 0.62) * 0.18;
    const fromX = lasso.kind === "swing" ? player.x : lasso.from.x;
    const fromY = (lasso.kind === "swing" ? player.y : lasso.from.y) - 24;
    const tipX = fromX + (lasso.to.x - fromX) * reach;
    const tipY = fromY + (lasso.to.y - 22 - fromY) * reach;
    const ctrlX = (fromX + tipX) * 0.5;
    const ctrlY = (fromY + tipY) * 0.5 - 32 * Math.sin(Math.min(1, progress * 1.15) * Math.PI);

    this.lassoGraphics
      .moveTo(fromX, fromY)
      .quadraticCurveTo(ctrlX, ctrlY, tipX, tipY)
      .stroke({ width: 15, color: 0x47321f, alpha: 0.38, cap: "round" });

    for (let b = 0; b < LASSO_RAINBOW.length; b += 1) {
      const offset = (b - 2) * 2.2;
      this.lassoGraphics
        .moveTo(fromX, fromY + offset)
        .quadraticCurveTo(ctrlX, ctrlY + offset, tipX, tipY + offset)
        .stroke({ width: 3.2, color: LASSO_RAINBOW[b] ?? 0xfff59d, alpha: 0.96, cap: "round" });
    }

    const spin = reducedMotion ? 0 : tick * 0.45;
    const rx = 12 + Math.cos(spin) * 2.5;
    const ry = 7 + Math.sin(spin) * 1.6;
    this.lassoGraphics
      .ellipse(tipX, tipY, rx, ry)
      .stroke({ width: 3.4, color: 0xf5cb5c, alpha: 0.95 })
      .ellipse(tipX, tipY, rx * 0.84, ry * 0.84)
      .stroke({ width: 1.6, color: 0xfff8dc, alpha: 0.95 });
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
