import type { Texture } from "pixi.js";
import type { CanvasFactory, TextureFactory } from "./keepsake-textures";

export type ValleyKeepsakeTextureKey =
  | "keepsakeWreath"
  | "keepsakeCompass"
  | "keepsakeClover"
  | "keepsakeWhistle";

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

// 48x48 hand-inked Sanctuary Clover Wreath keepsake (braided sage-green clover
// ring with pastel buttercup, rose, and lavender wildflower blossoms).
function buildKeepsakeWreath(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 24, 4, 23, "168, 230, 207", 0.42);

  // Braided sage-green clover leaves arranged in a cozy ring.
  const leafCount = 10;
  for (let i = 0; i < leafCount; i += 1) {
    const angle = (i * Math.PI * 2) / leafCount - Math.PI / 2;
    const lx = 24 + Math.cos(angle) * 13.4;
    const ly = 23 + Math.sin(angle) * 13.4;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + Math.PI / 2);
    const leafFill = ctx.createRadialGradient(-1, -1, 1, 0, 0, 7.5);
    leafFill.addColorStop(0, i % 2 === 0 ? "#C2ECB8" : "#A7DFAD");
    leafFill.addColorStop(1, i % 2 === 0 ? "#6EB876" : "#5AA667");
    ctx.fillStyle = leafFill;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#47321F";
    ctx.stroke();
    // Tiny inner leaf vein accent.
    ctx.strokeStyle = "rgba(71, 50, 31, 0.3)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-3.2, 0);
    ctx.lineTo(3.2, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Pastel wildflower blossoms: buttercup, rose, and lavender around the ring.
  const blossoms: readonly [number, number, string][] = [
    [24, 9.5, "#FFE37D"],
    [36.5, 16.5, "#F49CB4"],
    [36.5, 30, "#D4B6FA"],
    [11.5, 30, "#FFE37D"],
    [11.5, 16.5, "#D4B6FA"],
    [30.5, 11.5, "#F49CB4"],
  ];
  for (const [bx, by, petalColor] of blossoms) {
    ctx.fillStyle = petalColor;
    ctx.strokeStyle = "#47321F";
    ctx.lineWidth = 1.1;
    for (let p = 0; p < 5; p += 1) {
      const pa = (p * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(pa) * 2.5, by + Math.sin(pa) * 2.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#FFF7CC";
    ctx.beginPath();
    ctx.arc(bx, by, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small fluttering rose-coral ribbon bow tucked at the bottom of the wreath.
  ctx.fillStyle = "#E8849F";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(24, 36);
  ctx.lineTo(17.5, 43.5);
  ctx.lineTo(22.2, 41.5);
  ctx.lineTo(24, 37.5);
  ctx.lineTo(25.8, 41.5);
  ctx.lineTo(30.5, 43.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(20.2, 36.2, 3.6, 2.3, -0.35, 0, Math.PI * 2);
  ctx.ellipse(27.8, 36.2, 3.6, 2.3, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#FFF3C4";
  ctx.beginPath();
  ctx.arc(24, 36.2, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  return toTexture(canvas);
}

// 48x48 hand-inked Sea-Glass Compass keepsake (seafoam aqua glass dial, warm
// brass bezel + hanging bail, and coral/gold compass needle pointing toward the bay).
function buildKeepsakeCompass(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 25, 4, 22, "122, 226, 216", 0.42);

  // Top brass bail loop.
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.arc(24, 8.5, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#F0C762";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(24, 8.5, 4, 0, Math.PI * 2);
  ctx.stroke();

  // Warm brass compass case.
  const rim = ctx.createRadialGradient(20, 20, 3, 24, 26, 16);
  rim.addColorStop(0, "#FFF1B5");
  rim.addColorStop(0.65, "#F0C762");
  rim.addColorStop(1, "#D69D3A");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(24, 26, 15.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Frosted seafoam-aqua sea-glass face.
  const dial = ctx.createRadialGradient(20, 21, 1.5, 24, 26, 12);
  dial.addColorStop(0, "#E4FFF9");
  dial.addColorStop(0.55, "#9BECE2");
  dial.addColorStop(1, "#69D4C8");
  ctx.fillStyle = dial;
  ctx.beginPath();
  ctx.arc(24, 26, 11.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Four cardinal pips (N/E/S/W).
  ctx.fillStyle = "#47321F";
  const pips: readonly [number, number][] = [[24, 17.2], [32.8, 26], [24, 34.8], [15.2, 26]];
  for (const [px, py] of pips) {
    ctx.beginPath();
    ctx.arc(px, py, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Coral + butter-gold compass needle pointing toward Bubblegum Bay.
  ctx.fillStyle = "#E87594";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(31.4, 18.6);
  ctx.lineTo(25.8, 27.8);
  ctx.lineTo(22.2, 24.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#FCE488";
  ctx.beginPath();
  ctx.moveTo(16.6, 33.4);
  ctx.lineTo(22.2, 24.2);
  ctx.lineTo(25.8, 27.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Brass center pivot pin + soft sea-glass gleam arc.
  ctx.fillStyle = "#FFF5CC";
  ctx.beginPath();
  ctx.arc(24, 26, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(24, 26, 9.2, Math.PI * 1.15, Math.PI * 1.44);
  ctx.stroke();

  return toTexture(canvas);
}

// 48x48 hand-inked Pressed Alpine Clover keepsake (warm ivory botany card with
// pastel tape corners holding a vivid sage-green four-leaf alpine clover).
function buildKeepsakeClover(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  drawHalo(ctx, 24, 24, 4, 22, "162, 206, 143", 0.4);

  // Warm ivory pressed-botany specimen card.
  const card = ctx.createLinearGradient(9, 6, 39, 42);
  card.addColorStop(0, "#FFFDF5");
  card.addColorStop(1, "#F4E7C8");
  ctx.fillStyle = card;
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.roundRect(9, 6, 30, 36, 4.5);
  ctx.fill();
  ctx.stroke();

  // Delicate inner botanical border.
  ctx.save();
  ctx.setLineDash([2.4, 2.2]);
  ctx.strokeStyle = "#C8AE82";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(12.5, 9.5, 23, 29, 2.5);
  ctx.stroke();
  ctx.restore();

  // Gentle curved clover stem.
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(24, 23);
  ctx.quadraticCurveTo(23.5, 31, 27, 36.2);
  ctx.stroke();

  // Four vivid sage-green alpine clover leaflets.
  const leafAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  leafAngles.forEach((angle, idx) => {
    ctx.save();
    ctx.translate(24, 22.5);
    ctx.rotate(angle);
    const fill = ctx.createRadialGradient(5, 0, 1, 6, 0, 8);
    fill.addColorStop(0, idx % 2 === 0 ? "#B7ECA6" : "#A2DF96");
    fill.addColorStop(1, idx % 2 === 0 ? "#6EB874" : "#5CA765");
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#47321F";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(6.5, -4.5, 11, -2.5, 9, 0);
    ctx.bezierCurveTo(11, 2.5, 6.5, 4.5, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Soft golden-green leaf heart center.
  ctx.fillStyle = "#D9F7BE";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(24, 22.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pastel lavender masking-tape corners holding the pressed card.
  const drawTape = (pts: readonly [number, number][]): void => {
    ctx.beginPath();
    pts.forEach(([tx, ty], i) => {
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.closePath();
    ctx.fillStyle = "#E8D6F5";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#47321F";
    ctx.stroke();
  };
  drawTape([[10.5, 8.5], [17, 6.5], [15.5, 11], [9, 13]]);
  drawTape([[32.5, 37], [39, 35], [37.5, 39.5], [31, 41.5]]);

  return toTexture(canvas);
}

// 48x48 hand-inked Golden Star-Line Whistle keepsake (conductor whistle + periwinkle lanyard).
function buildKeepsakeWhistle(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawHalo(ctx, 25, 25, 3, 21, "255, 217, 102", 0.38);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Coiled periwinkle Star-Line lanyard cord looping behind the whistle ring.
  ctx.beginPath();
  ctx.moveTo(13, 25);
  ctx.bezierCurveTo(4, 17, 7, 5, 20, 6);
  ctx.bezierCurveTo(31, 7, 32, 16, 25, 21);
  ctx.lineWidth = 5.2;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = "#7393E5";
  ctx.stroke();

  // Small brass lanyard loop ring on the rear of the whistle.
  ctx.beginPath();
  ctx.arc(13, 26.5, 4.4, 0, Math.PI * 2);
  ctx.lineWidth = 4.4;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "#F4BE3F";
  ctx.stroke();

  // Classic conductor pea-whistle silhouette: round chamber + tapered mouthpiece.
  ctx.beginPath();
  ctx.moveTo(15.5, 27.5);
  ctx.bezierCurveTo(15.5, 19.5, 23, 16, 29.5, 19.2);
  ctx.lineTo(41, 15.8);
  ctx.quadraticCurveTo(44, 17.8, 42.8, 22.2);
  ctx.lineTo(35.5, 25.8);
  ctx.bezierCurveTo(36.4, 34, 29.6, 39.8, 22.5, 38.8);
  ctx.bezierCurveTo(17, 38, 15, 33, 15.5, 27.5);
  ctx.closePath();
  const brass = ctx.createLinearGradient(16, 15, 39, 39);
  brass.addColorStop(0, "#FFF2A8");
  brass.addColorStop(0.48, "#F4BA38");
  brass.addColorStop(1, "#C67F1E");
  ctx.fillStyle = brass;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#47321F";
  ctx.stroke();

  // Dark acoustic notch along the top of the mouthpiece.
  ctx.fillStyle = "#47321F";
  ctx.beginPath();
  ctx.moveTo(28.5, 19.5);
  ctx.lineTo(33.2, 18.1);
  ctx.lineTo(32.8, 21.8);
  ctx.lineTo(29.2, 22.3);
  ctx.closePath();
  ctx.fill();

  // Warm cream specular highlight along the upper curve of the chamber.
  ctx.fillStyle = "rgba(255, 253, 242, 0.8)";
  ctx.beginPath();
  ctx.ellipse(22, 23.2, 3.6, 1.8, -0.45, 0, Math.PI * 2);
  ctx.fill();

  // Tiny gleaming 5-point Star-Line emblem embossed on the brass side.
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 4.6 : 2.1;
    const px = 25.5 + Math.cos(angle) * r;
    const py = 29.8 + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#FFF8D4";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#7D521B";
  ctx.stroke();

  return toTexture(canvas);
}

export function createValleyKeepsakeTextures(
  makeCanvas: CanvasFactory,
  toTexture: TextureFactory,
): Record<ValleyKeepsakeTextureKey, Texture> {
  return {
    keepsakeWreath: buildKeepsakeWreath(makeCanvas, toTexture),
    keepsakeCompass: buildKeepsakeCompass(makeCanvas, toTexture),
    keepsakeClover: buildKeepsakeClover(makeCanvas, toTexture),
    keepsakeWhistle: buildKeepsakeWhistle(makeCanvas, toTexture),
  };
}
