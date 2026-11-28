import type { Texture } from "pixi.js";
import type { CanvasFactory, TextureFactory } from "./keepsake-textures";

export type ExpansionKeepsakeTextureKey =
  | "keepsakeSketch"
  | "keepsakeAurora"
  | "keepsakeShell"
  | "keepsakeRibbon";

function drawHalo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  rgb: string,
  peak: number,
): void {
  const halo = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  halo.addColorStop(0, `rgba(${rgb}, ${peak})`);
  halo.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 48, 48);
}

function tracePoly(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
): void {
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function traceStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// 48x48 hand-inked Rocket Doodle & Clover keepsake (pinned cream sketch + lilac rocket + clover).
function buildKeepsakeSketch(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 24, 4, 22, "216, 184, 255", 0.36);

  // Cream parchment sketch card pinned at the top with a rose-coral thumbtack.
  const page = ctx.createLinearGradient(8, 7, 38, 41);
  page.addColorStop(0, "#FFFDF4");
  page.addColorStop(1, "#F3E5C5");
  ctx.fillStyle = page;
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.roundRect(7.5, 7.5, 30, 33.5, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#E87594";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(22.5, 8.5, 3.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Golden rocket exhaust sparks + coral fins + lilac rocket hull + aqua porthole.
  ctx.strokeStyle = "#F6C95E";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(13, 31);
  ctx.lineTo(16.5, 27.5);
  ctx.moveTo(14, 33);
  ctx.lineTo(18, 30.5);
  ctx.stroke();

  ctx.fillStyle = "#E87594";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 1.5;
  tracePoly(ctx, [[15, 27.5], [12.5, 24], [17.5, 23]]);
  ctx.fill();
  ctx.stroke();
  tracePoly(ctx, [[21, 31.5], [24.5, 34], [25.5, 29]]);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(15.5, 28.5);
  ctx.bezierCurveTo(17, 21.5, 22.5, 16, 29.5, 14.5);
  ctx.bezierCurveTo(28, 21.5, 22.5, 27, 15.5, 28.5);
  ctx.closePath();
  const hull = ctx.createLinearGradient(16, 28, 29, 15);
  hull.addColorStop(0, "#B895E8");
  hull.addColorStop(1, "#EFE2FF");
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.lineWidth = 1.9;
  ctx.stroke();

  ctx.fillStyle = "#89DFD0";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(22.5, 21.5, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  traceStar(ctx, 13.5, 17.4, 4, 2.9, 1);
  ctx.fillStyle = "#FFE37D";
  ctx.fill();

  // Rosie's pressed 4-leaf garden clover sprig tucked into the bottom-right corner.
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 33);
  ctx.quadraticCurveTo(34.5, 39, 37.5, 42.5);
  ctx.stroke();
  const leaves: readonly [number, number, string][] = [
    [35, 28.8, "#86CF84"],
    [39.2, 33, "#72BF74"],
    [35, 37.2, "#86CF84"],
    [30.8, 33, "#72BF74"],
  ];
  for (const [lx, ly, color] of leaves) {
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#D9F7BE";
  ctx.beginPath();
  ctx.arc(35, 33, 1.5, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 hand-inked Alpine Aurora Sketch keepsake (indigo night card + aurora ribbons + pines).
function buildKeepsakeAurora(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 24, 4, 22, "184, 168, 255", 0.42);

  // Rounded deep twilight-indigo night sky card.
  const sky = ctx.createLinearGradient(7, 8, 41, 40);
  sky.addColorStop(0, "#2A2F61");
  sky.addColorStop(1, "#434A86");
  ctx.fillStyle = sky;
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(6.5, 8, 35, 32, 5.5);
  ctx.fill();
  ctx.stroke();

  // Sweeping mint, lavender, and butter-gold crayon aurora bands.
  const ribbons: readonly [string, number, number, number, number, number, number, number][] = [
    ["rgba(140, 232, 216, 0.72)", 5, 9.5, 24, 16, 14, 27, 14],
    ["rgba(216, 184, 255, 0.88)", 4.4, 9.5, 28, 17, 19, 29, 18.5],
    ["rgba(255, 227, 125, 0.9)", 2.6, 11, 30.5, 19, 24, 31, 22],
  ];
  for (const [stroke, width, x0, y0, cx1, cy1, x1, y1] of ribbons) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx1, cy1, x1, y1);
    ctx.quadraticCurveTo(35, y1 - 3, 38.5, y1 + 2);
    ctx.stroke();
  }

  // Tiny night stars gleaming above the aurora.
  traceStar(ctx, 14, 15.6, 4, 2.7, 0.9);
  ctx.fillStyle = "#FFF6C4";
  ctx.fill();
  for (const [sx, sy, sr] of [[24, 12, 1.2], [35, 12.5, 1.4]] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp snowy ridge & three alpine pine silhouettes along the base.
  ctx.fillStyle = "#E6F2FF";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(7.5, 34.5);
  ctx.quadraticCurveTo(18, 31, 25, 34);
  ctx.quadraticCurveTo(33, 31.5, 40.5, 34.5);
  ctx.lineTo(40.5, 38.8);
  ctx.lineTo(7.5, 38.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const pines: readonly [number, number, number, string][] = [
    [17, 27, 35, "#4F746C"],
    [25.5, 25.5, 36, "#3F625C"],
    [33.5, 28, 35.5, "#4F746C"],
  ];
  for (const [px, topY, baseY, fill] of pines) {
    ctx.fillStyle = fill;
    ctx.lineWidth = 1.3;
    tracePoly(ctx, [[px - 3, baseY], [px, topY], [px + 3, baseY]]);
    ctx.fill();
    ctx.stroke();
  }
  return toTexture(canvas);
}

// 48x48 hand-inked Starlight Shell Shard keepsake (pastel pearlescent scallop + star glint).
function buildKeepsakeShell(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 24, 4, 22, "156, 242, 235", 0.42);

  // Scalloped hinge base.
  ctx.fillStyle = "#F7C8D8";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.1;
  tracePoly(ctx, [[18, 37], [30, 37], [27.5, 41], [20.5, 41]]);
  ctx.fill();
  ctx.stroke();

  // Pearlescent pastel-pink & seafoam scalloped fan.
  ctx.beginPath();
  ctx.moveTo(19, 37);
  ctx.bezierCurveTo(11, 33, 7.5, 26, 9.5, 19);
  ctx.bezierCurveTo(11.5, 14, 15.5, 12, 18.5, 13);
  ctx.bezierCurveTo(20, 9.5, 24, 8.5, 24, 8.5);
  ctx.bezierCurveTo(24, 8.5, 28, 9.5, 29.5, 13);
  ctx.bezierCurveTo(32.5, 12, 36.5, 14, 38.5, 19);
  ctx.bezierCurveTo(40.5, 26, 37, 33, 29, 37);
  ctx.closePath();
  const pearl = ctx.createLinearGradient(10, 10, 38, 38);
  pearl.addColorStop(0, "#FFE5EE");
  pearl.addColorStop(0.5, "#C7F4EC");
  pearl.addColorStop(1, "#F3DCFF");
  ctx.fillStyle = pearl;
  ctx.fill();
  ctx.lineWidth = 2.3;
  ctx.stroke();

  // Radiating shell flutes.
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#D996B2";
  ctx.beginPath();
  ctx.moveTo(21, 36);
  ctx.quadraticCurveTo(14, 28, 15.5, 15.5);
  ctx.moveTo(27, 36);
  ctx.quadraticCurveTo(34, 28, 32.5, 15.5);
  ctx.stroke();
  ctx.strokeStyle = "#92C9BE";
  ctx.beginPath();
  ctx.moveTo(24, 36);
  ctx.lineTo(24, 12.5);
  ctx.stroke();

  // Golden starlight glint + white pearl highlight.
  traceStar(ctx, 31.5, 20.6, 4, 5.2, 1.8);
  ctx.fillStyle = "#FFF4B8";
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(16.5, 21, 1.8, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 hand-inked Jubilee Festival Ribbon keepsake (gold rosette + coral/mint tails + star).
function buildKeepsakeRibbon(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 22, 4, 22, "255, 217, 102", 0.42);

  // Twin notched festival ribbon tails in coral-rose and sunlit mint.
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.1;
  ctx.fillStyle = "#EE849E";
  tracePoly(ctx, [[18.5, 27], [11.5, 42.5], [18, 39.5], [22.5, 43], [23.5, 29]]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7FD1A8";
  tracePoly(ctx, [[29.5, 27], [36.5, 42.5], [30, 39.5], [25.5, 43], [24.5, 29]]);
  ctx.fill();
  ctx.stroke();

  // Fluted sunlit golden rosette medallion.
  traceStar(ctx, 24, 20, 10, 14, 11.4);
  const rosette = ctx.createRadialGradient(21, 16, 2, 24, 20, 15);
  rosette.addColorStop(0, "#FFF3B0");
  rosette.addColorStop(0.6, "#F8C846");
  rosette.addColorStop(1, "#DFA034");
  ctx.fillStyle = rosette;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Warm cream inner ring + 5-point jubilee star center + soft specular glint.
  ctx.fillStyle = "#FFF6D4";
  ctx.strokeStyle = "#C48A1C";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(24, 20, 8.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  traceStar(ctx, 24, 20, 5, 6.4, 2.9);
  ctx.fillStyle = "#FFE37D";
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#7D521B";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(18.5, 14.5, 2.4, 1.3, -0.52, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

export function createExpansionKeepsakeTextures(
  makeCanvas: CanvasFactory,
  toTexture: TextureFactory,
): Record<ExpansionKeepsakeTextureKey, Texture> {
  return {
    keepsakeSketch: buildKeepsakeSketch(makeCanvas, toTexture),
    keepsakeAurora: buildKeepsakeAurora(makeCanvas, toTexture),
    keepsakeShell: buildKeepsakeShell(makeCanvas, toTexture),
    keepsakeRibbon: buildKeepsakeRibbon(makeCanvas, toTexture),
  };
}
