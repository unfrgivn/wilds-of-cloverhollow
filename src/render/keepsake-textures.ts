import type { Texture } from "pixi.js";
import {
  createExpansionKeepsakeTextures,
  type ExpansionKeepsakeTextureKey,
} from "./keepsake-textures-expansion";
import {
  createValleyKeepsakeTextures,
  type ValleyKeepsakeTextureKey,
} from "./keepsake-textures-valley";

export type KeepsakeTextureKey =
  | "keepsakeCrystal"
  | "keepsakePin"
  | "keepsakeGeode"
  | "keepsakeFeather"
  | "keepsakeTaco"
  | ValleyKeepsakeTextureKey
  | ExpansionKeepsakeTextureKey;

export const KEEPSAKE_TEXTURE_KEYS: readonly KeepsakeTextureKey[] = [
  "keepsakeCrystal",
  "keepsakePin",
  "keepsakeGeode",
  "keepsakeFeather",
  "keepsakeTaco",
  "keepsakeWreath",
  "keepsakeCompass",
  "keepsakeClover",
  "keepsakeWhistle",
  "keepsakeSketch",
  "keepsakeAurora",
  "keepsakeShell",
  "keepsakeRibbon",
];

export type CanvasContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

export type CanvasFactory = (width: number, height: number) => CanvasContext;
export type TextureFactory = (
  canvas: HTMLCanvasElement,
  addressMode?: "clamp-to-edge" | "repeat",
) => Texture;

// 48x48 hand-inked Shimmering Star Crystal keepsake (aqua/mint facets + star glint).
function buildKeepsakeCrystal(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  const halo = ctx.createRadialGradient(24, 24, 3, 24, 24, 22);
  halo.addColorStop(0, "rgba(103, 213, 196, 0.42)");
  halo.addColorStop(1, "rgba(103, 213, 196, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 48, 48);

  const drawShard = (
    points: readonly [number, number][],
    top: string,
    bottom: string,
  ): void => {
    ctx.beginPath();
    points.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    const fill = ctx.createLinearGradient(16, 8, 32, 42);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#47321F";
    ctx.stroke();
  };

  // Left and right flanking mini shards, then tall central crystal spire.
  drawShard([[14, 40], [10, 25], [16, 17], [22, 26], [20, 40]], "#C6FAF0", "#5CC4B4");
  drawShard([[27, 40], [28, 25], [34, 19], [38, 28], [33, 40]], "#D8F6FF", "#6BBCD6");
  drawShard([[18, 41], [16, 22], [24, 7], [32, 22], [30, 41]], "#E8FFF9", "#4CBFA9");

  // Inner facet highlight + crisp golden star glint.
  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.beginPath();
  ctx.moveTo(24, 10);
  ctx.lineTo(28.5, 22);
  ctx.lineTo(24, 36);
  ctx.lineTo(21.5, 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFF4B8";
  ctx.beginPath();
  ctx.moveTo(24, 17);
  ctx.lineTo(25.8, 21.5);
  ctx.lineTo(30, 23);
  ctx.lineTo(25.8, 24.5);
  ctx.lineTo(24, 29);
  ctx.lineTo(22.2, 24.5);
  ctx.lineTo(18, 23);
  ctx.lineTo(22.2, 21.5);
  ctx.closePath();
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 hand-inked Bon Appetit Star Pin keepsake (cream/gold enamel badge + coral ribbon).
function buildKeepsakePin(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Small twin coral ribbons tucked below the badge.
  ctx.fillStyle = "#E87594";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(18, 31);
  ctx.lineTo(13, 43);
  ctx.lineTo(19.5, 39.5);
  ctx.lineTo(23.5, 43);
  ctx.lineTo(23.5, 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(30, 31);
  ctx.lineTo(35, 43);
  ctx.lineTo(28.5, 39.5);
  ctx.lineTo(24.5, 43);
  ctx.lineTo(24.5, 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Round warm-gold rimmed enamel disc.
  const disc = ctx.createRadialGradient(20, 17, 2, 24, 22, 16);
  disc.addColorStop(0, "#FFFDF5");
  disc.addColorStop(0.72, "#FCEFC8");
  disc.addColorStop(1, "#F2CA66");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(24, 21.5, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Five-point butter-gold star centered in the pin.
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 10 : 4.6;
    const px = 24 + Math.cos(angle) * r;
    const py = 21.5 + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#F8C846";
  ctx.fill();
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Crisp upper-left gleam.
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(17.5, 14.5, 3.2, 1.8, -0.55, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 hand-inked Rainbow Star Geode keepsake (pebble shell + pastel amethyst/aqua core).
function buildKeepsakeGeode(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  const halo = ctx.createRadialGradient(24, 25, 2, 24, 25, 21);
  halo.addColorStop(0, "rgba(216, 184, 255, 0.38)");
  halo.addColorStop(1, "rgba(216, 184, 255, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 48, 48);

  // Outer stone shell.
  ctx.beginPath();
  ctx.moveTo(24, 9);
  ctx.bezierCurveTo(36, 9, 41, 18, 39, 29);
  ctx.bezierCurveTo(37, 38, 31, 41, 24, 41);
  ctx.bezierCurveTo(16, 41, 10, 36, 9, 27);
  ctx.bezierCurveTo(8, 17, 14, 9, 24, 9);
  ctx.closePath();
  const shell = ctx.createLinearGradient(12, 10, 36, 40);
  shell.addColorStop(0, "#D8C7AF");
  shell.addColorStop(1, "#9B8772");
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Cream banded agate ring.
  ctx.beginPath();
  ctx.ellipse(24, 25.5, 11.5, 12.2, -0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#FAF2E0";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#7D6654";
  ctx.stroke();

  // Rainbow pastel crystal cavity.
  ctx.beginPath();
  ctx.ellipse(24, 25.5, 8.6, 9.2, -0.08, 0, Math.PI * 2);
  const core = ctx.createLinearGradient(16, 17, 32, 34);
  core.addColorStop(0, "#E4C6FF");
  core.addColorStop(0.5, "#9CF2EB");
  core.addColorStop(1, "#FFE48F");
  ctx.fillStyle = core;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#5B4374";
  ctx.stroke();

  // Tiny faceted crystal points inside cavity.
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  const flecks: readonly [number, number, number][] = [
    [21, 22, 2.2],
    [26.5, 24.5, 2.6],
    [23, 29, 1.9],
  ];
  for (const [fx, fy, fr] of flecks) {
    ctx.beginPath();
    ctx.moveTo(fx, fy - fr);
    ctx.lineTo(fx + fr * 0.85, fy);
    ctx.lineTo(fx, fy + fr);
    ctx.lineTo(fx - fr * 0.85, fy);
    ctx.closePath();
    ctx.fill();
  }
  return toTexture(canvas);
}

// 48x48 hand-inked Moon Feather keepsake (pearlescent sky-lavender owl plume).
function buildKeepsakeFeather(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Soft curved plume silhouette.
  ctx.beginPath();
  ctx.moveTo(14, 39);
  ctx.bezierCurveTo(13, 27, 18, 14, 33, 8);
  ctx.bezierCurveTo(37, 17, 34, 29, 24, 36);
  ctx.bezierCurveTo(21, 38, 17, 39, 14, 39);
  ctx.closePath();
  const plume = ctx.createLinearGradient(34, 8, 14, 39);
  plume.addColorStop(0, "#F6FAFF");
  plume.addColorStop(0.55, "#C4DCFF");
  plume.addColorStop(1, "#8CA7DC");
  ctx.fillStyle = plume;
  ctx.fill();
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Warm quill stem curving through the feather.
  ctx.beginPath();
  ctx.moveTo(12, 42);
  ctx.quadraticCurveTo(21, 27, 32, 11);
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Golden crescent tip spot.
  ctx.fillStyle = "#FFE694";
  ctx.beginPath();
  ctx.arc(28.5, 16, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#C4DCFF";
  ctx.beginPath();
  ctx.arc(29.8, 15.2, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Soft barb accent lines.
  ctx.strokeStyle = "rgba(71, 50, 31, 0.45)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22, 26);
  ctx.lineTo(17, 23);
  ctx.moveTo(25, 22);
  ctx.lineTo(31, 22);
  ctx.stroke();
  ctx.restore();
  return toTexture(canvas);
}

// 48x48 hand-inked Golden Taco Badge keepsake (golden folded taco with fresh toppings).
function buildKeepsakeTaco(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Peeking leafy mint lettuce waves behind shell rim.
  ctx.fillStyle = "#7FD19C";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(11, 28);
  ctx.bezierCurveTo(10, 18, 17, 14, 21, 18);
  ctx.bezierCurveTo(23, 13, 30, 13, 31, 18);
  ctx.bezierCurveTo(35, 15, 39, 20, 37, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cheerful coral tomato dots peeking out.
  ctx.fillStyle = "#E87594";
  const tomatoes: readonly [number, number][] = [[18, 21], [25, 19], [31, 22]];
  for (const [tx, ty] of tomatoes) {
    ctx.beginPath();
    ctx.arc(tx, ty, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#47321F";
    ctx.stroke();
  }

  // Golden crispy semi-circle taco shell in front.
  ctx.beginPath();
  ctx.moveTo(8, 33);
  ctx.bezierCurveTo(8, 19, 40, 19, 40, 33);
  ctx.quadraticCurveTo(24, 38, 8, 33);
  ctx.closePath();
  const shell = ctx.createLinearGradient(12, 20, 36, 36);
  shell.addColorStop(0, "#FFF0A8");
  shell.addColorStop(0.55, "#F6C95E");
  shell.addColorStop(1, "#DFA03C");
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Warm toasted speckles on the shell.
  ctx.fillStyle = "rgba(138, 86, 36, 0.45)";
  const speckles: readonly [number, number][] = [[17, 29], [23, 32], [29, 28], [33, 31]];
  for (const [sx, sy] of speckles) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas);
}

export function createKeepsakeTextures(
  makeCanvas: CanvasFactory,
  toTexture: TextureFactory,
): Record<KeepsakeTextureKey, Texture> {
  return {
    keepsakeCrystal: buildKeepsakeCrystal(makeCanvas, toTexture),
    keepsakePin: buildKeepsakePin(makeCanvas, toTexture),
    keepsakeGeode: buildKeepsakeGeode(makeCanvas, toTexture),
    keepsakeFeather: buildKeepsakeFeather(makeCanvas, toTexture),
    keepsakeTaco: buildKeepsakeTaco(makeCanvas, toTexture),
    ...createValleyKeepsakeTextures(makeCanvas, toTexture),
    ...createExpansionKeepsakeTextures(makeCanvas, toTexture),
  };
}
