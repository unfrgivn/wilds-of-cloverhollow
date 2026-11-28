import { Sprite, type Graphics, type Texture } from "pixi.js";
import {
  isPuzzleSolved, mirrorOrientation, type Area, type Direction, type Point, type Polygon,
  type PrismEmitterDef, type PrismMirrorDef, type PrismOrientation, type PrismReceiverDef,
  type PushableDef, type ResonanceBellDef, type State, type World,
} from "../core";

export const BEAM_GLOW_POOL_SIZE = 20;
export const SOLVE_SPARKLE_COUNT = 14;
export const SOLVE_BURST_TICKS = 36;
export const LASSO_RAINBOW: readonly number[] = [
  0xf48fb1, 0xffcc80, 0xfff59d, 0xa5d6a7, 0x90caf9,
];
export const SPARKLE_TINTS: readonly number[] = [
  0xffe885, 0xf7b2d9, 0xa8e6cf, 0xb8d8ff, 0xfff6cc,
];
export const NOTE_COLORS: Readonly<Record<Direction, number>> = {
  up: 0xf27474, right: 0xf5cb5c, down: 0x6bc78b, left: 0x6cb5f5,
};

export type PrismBeamsSnapshot = {
  segments: { from: Point; to: Point }[];
  activeEmitters: string[];
  energizedReceivers: string[];
};

export type PuzzleFxDrawContext = {
  beamGraphics: Graphics;
  lassoGraphics: Graphics;
  beamGlowPool: readonly Sprite[];
  solveSparklePool: readonly Sprite[];
  crystals: readonly { kind: "emitter" | "receiver"; def: PrismEmitterDef | PrismReceiverDef }[];
  mirrors: readonly { def: PrismMirrorDef }[];
  bells: readonly { def: ResonanceBellDef }[];
  grappleCount: number;
};

export function polygonCenter(polygon: Polygon): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const pt of polygon) { sx += pt[0]; sy += pt[1]; }
  return { x: sx / polygon.length, y: sy / polygon.length };
}

export function pushableFrame(kind: PushableDef["kind"]): string {
  return kind === "rock" ? "push-rock" : kind === "snowball" ? "push-snowball" : "push-crate";
}

export function mirrorArms(orientation: PrismOrientation): [Point, Point] {
  if (orientation === "ne") return [{ x: 0, y: -1 }, { x: 1, y: 0 }];
  if (orientation === "se") return [{ x: 0, y: 1 }, { x: 1, y: 0 }];
  if (orientation === "sw") return [{ x: 0, y: 1 }, { x: -1, y: 0 }];
  return [{ x: 0, y: -1 }, { x: -1, y: 0 }];
}

export function goalAnchor(area: Area, state: State, goalId: string): Point {
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

export function placeShadow(
  shadow: Sprite, x: number, y: number, width: number, height: number, alpha: number,
): void {
  shadow.position.set(x, y + 1);
  shadow.width = width;
  shadow.height = height;
  shadow.alpha = alpha;
}

export function createFxSprite(texture: Texture, label: string, tint = 0xffffff): Sprite {
  const sprite = new Sprite(texture);
  sprite.label = label;
  sprite.anchor.set(0.5);
  sprite.blendMode = "add";
  sprite.tint = tint;
  sprite.visible = false;
  return sprite;
}

export function drawPrismBeams(
  beamGraphics: Graphics,
  beamGlowPool: readonly Sprite[],
  area: Area,
  state: State,
  beams: PrismBeamsSnapshot,
  crystals: PuzzleFxDrawContext["crystals"],
  mirrors: PuzzleFxDrawContext["mirrors"],
  pulse: number,
): number {
  let glowUsed = 0;
  const placeGlow = (x: number, y: number, scale: number, tint: number, alphaVal: number) => {
    const sprite = beamGlowPool[glowUsed];
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
    beamGraphics
      .moveTo(x1, y1).lineTo(x2, y2)
      .stroke({ width: 12, color: 0xb98eff, alpha: 0.55, cap: "round" })
      .moveTo(x1, y1).lineTo(x2, y2)
      .stroke({ width: 4, color: 0xeefcff, alpha: 0.92, cap: "round" });
    placeGlow(x2, y2, 0.56 + 0.1 * pulse, 0xd4b6ff, 0.55 + 0.15 * pulse);
  }

  for (const { kind, def } of crystals) {
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

  for (const { def } of mirrors) {
    const [a, b] = mirrorArms(mirrorOrientation(area, state, def));
    const cx = def.x;
    const cy = def.y - 26;
    const len = 18;
    beamGraphics
      .moveTo(cx + a.x * len, cy + a.y * len).lineTo(cx, cy)
      .lineTo(cx + b.x * len, cy + b.y * len)
      .stroke({ width: 5, color: 0xffe28a, alpha: 0.88, cap: "round", join: "round" })
      .moveTo(cx + a.x * len, cy + a.y * len).lineTo(cx, cy)
      .lineTo(cx + b.x * len, cy + b.y * len)
      .stroke({ width: 2.2, color: 0xc2f7ff, alpha: 0.96, cap: "round", join: "round" })
      .circle(cx + a.x * len, cy + a.y * len, 3.2).fill({ color: 0xeefcff, alpha: 0.95 })
      .circle(cx + b.x * len, cy + b.y * len, 3.2).fill({ color: 0xeefcff, alpha: 0.95 });
  }

  for (let i = glowUsed; i < beamGlowPool.length; i += 1) {
    const sprite = beamGlowPool[i];
    if (sprite !== undefined) sprite.visible = false;
  }
  return glowUsed;
}

export function drawFluteResonance(
  beamGraphics: Graphics,
  world: World,
  area: Area,
  state: State,
  bells: PuzzleFxDrawContext["bells"],
  pulse: number,
  reducedMotion: boolean,
): void {
  const solvedBells = state.puzzleArea?.solvedBells ?? [];
  for (const { def } of bells) {
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
      beamGraphics
        .circle(dotX, dotY, 5.4).fill({ color: 0x47321f, alpha: bellSolved ? 0.55 : 0.85 })
        .circle(dotX, dotY, 4.0).fill({
          color: bellSolved ? 0xffe58a : NOTE_COLORS[note],
          alpha: bellSolved ? 0.68 + 0.2 * pulse : 0.96,
        });
    }
  }
}

export function drawSolveBurst(
  solveSparklePool: readonly Sprite[],
  area: Area,
  state: State,
  paused: boolean,
  reducedMotion: boolean,
): boolean {
  const solved = state.puzzleArea?.lastSolved;
  const age = solved === undefined ? -1 : state.tick - solved.tick;
  if (solved === undefined || reducedMotion || paused || age < 0 || age >= SOLVE_BURST_TICKS) {
    for (const sp of solveSparklePool) sp.visible = false;
    return false;
  }
  const u = age / SOLVE_BURST_TICKS;
  const center = goalAnchor(area, state, solved.id);
  for (let i = 0; i < solveSparklePool.length; i += 1) {
    const sp = solveSparklePool[i];
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

export function drawLassoArc(
  lassoGraphics: Graphics,
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

  lassoGraphics
    .moveTo(fromX, fromY)
    .quadraticCurveTo(ctrlX, ctrlY, tipX, tipY)
    .stroke({ width: 15, color: 0x47321f, alpha: 0.38, cap: "round" });

  for (let b = 0; b < LASSO_RAINBOW.length; b += 1) {
    const offset = (b - 2) * 2.2;
    lassoGraphics
      .moveTo(fromX, fromY + offset)
      .quadraticCurveTo(ctrlX, ctrlY + offset, tipX, tipY + offset)
      .stroke({ width: 3.2, color: LASSO_RAINBOW[b] ?? 0xfff59d, alpha: 0.96, cap: "round" });
  }

  const spin = reducedMotion ? 0 : tick * 0.45;
  const rx = 12 + Math.cos(spin) * 2.5;
  const ry = 7 + Math.sin(spin) * 1.6;
  lassoGraphics
    .ellipse(tipX, tipY, rx, ry)
    .stroke({ width: 3.4, color: 0xf5cb5c, alpha: 0.95 })
    .ellipse(tipX, tipY, rx * 0.84, ry * 0.84)
    .stroke({ width: 1.6, color: 0xfff8dc, alpha: 0.95 });
}

export function drawPuzzleFx(
  ctx: PuzzleFxDrawContext,
  world: World,
  area: Area,
  state: State,
  beams: PrismBeamsSnapshot,
  pulse: number,
  paused: boolean,
  reducedMotion: boolean,
): boolean {
  ctx.beamGraphics.clear();
  ctx.lassoGraphics.clear();
  const glowUsed = drawPrismBeams(
    ctx.beamGraphics, ctx.beamGlowPool, area, state, beams, ctx.crystals, ctx.mirrors, pulse,
  );
  drawFluteResonance(ctx.beamGraphics, world, area, state, ctx.bells, pulse, reducedMotion);
  const lasso = state.puzzleArea?.lasso;
  if (lasso !== undefined) {
    drawLassoArc(ctx.lassoGraphics, lasso, state.player, state.tick, reducedMotion);
  }
  const sparkleActive = drawSolveBurst(ctx.solveSparklePool, area, state, paused, reducedMotion);
  return (
    beams.segments.length > 0 ||
    ctx.mirrors.length > 0 ||
    ctx.bells.length > 0 ||
    ctx.grappleCount > 0 ||
    glowUsed > 0 ||
    lasso !== undefined ||
    sparkleActive
  );
}
