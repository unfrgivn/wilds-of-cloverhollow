import type { Texture } from "pixi.js";
import type { CanvasFactory, TextureFactory } from "./keepsake-textures";

export type EmoteTextureKey =
  | "emoteQuestion"
  | "emoteExclaim"
  | "emoteNote"
  | "emoteZzz"
  | "emoteHeart"
  | "emoteSparkle"
  | "emoteWave"
  | "emoteWorry";

export const EMOTE_TEXTURE_KEYS: readonly EmoteTextureKey[] = [
  "emoteQuestion",
  "emoteExclaim",
  "emoteNote",
  "emoteZzz",
  "emoteHeart",
  "emoteSparkle",
  "emoteWave",
  "emoteWorry",
];

// Shared hand-inked puffy comic bubble base on a 48x48 offscreen canvas.
function drawComicBubble(
  ctx: CanvasRenderingContext2D,
  topColor: string,
  bottomColor: string,
): void {
  const trace = (dy: number): void => {
    ctx.beginPath();
    ctx.moveTo(24, 6 + dy);
    ctx.bezierCurveTo(36, 6 + dy, 42, 12.5 + dy, 42, 22 + dy);
    ctx.bezierCurveTo(42, 31 + dy, 36.5, 36.5 + dy, 28, 37.5 + dy);
    ctx.lineTo(24, 43.2 + dy);
    ctx.lineTo(20, 37.5 + dy);
    ctx.bezierCurveTo(11.5, 36.5 + dy, 6, 31 + dy, 6, 22 + dy);
    ctx.bezierCurveTo(6, 12.5 + dy, 12, 6 + dy, 24, 6 + dy);
    ctx.closePath();
  };
  // Soft warm shadow beneath the die-cut bubble.
  trace(2.2);
  ctx.fillStyle = "rgba(71, 50, 31, 0.18)";
  ctx.fill();
  // Creamy watercolor bubble body + warm-brown hand-inked outline.
  trace(0);
  const fill = ctx.createRadialGradient(19, 14, 2, 24, 23, 22);
  fill.addColorStop(0, topColor);
  fill.addColorStop(1, bottomColor);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  // Subtle upper-left cream shine.
  ctx.fillStyle = "rgba(255, 253, 247, 0.65)";
  ctx.beginPath();
  ctx.ellipse(16, 13, 4.6, 2.3, -0.45, 0, Math.PI * 2);
  ctx.fill();
}

// 48x48 cream puff comic bubble with hand-inked warm-brown "?".
function buildEmoteQuestion(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#FFFDF6", "#FAF3DF");
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(19.2, 17.5);
  ctx.bezierCurveTo(19.4, 12.2, 29, 12, 29, 17.2);
  ctx.bezierCurveTo(29, 21, 24, 21.4, 24, 25.4);
  ctx.stroke();
  ctx.fillStyle = "#47321F";
  ctx.beginPath();
  ctx.arc(24, 30.8, 2.2, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 sunny butter-gold starburst bubble with hand-inked warm-brown "!".
function buildEmoteExclaim(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  const points = 8;
  const traceBurst = (dy: number): void => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? 20.5 : 14.5;
      const px = 24 + Math.cos(angle) * r;
      const py = 23 + dy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  traceBurst(2);
  ctx.fillStyle = "rgba(71, 50, 31, 0.2)";
  ctx.fill();
  traceBurst(0);
  const fill = ctx.createRadialGradient(21, 17, 2, 24, 23, 21);
  fill.addColorStop(0, "#FFF2B2");
  fill.addColorStop(0.55, "#FFE27A");
  fill.addColorStop(1, "#F6CA52");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  // Crisp tapered "!" stroke and dot.
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(24, 13.5);
  ctx.lineTo(24, 24.8);
  ctx.stroke();
  ctx.fillStyle = "#47321F";
  ctx.beginPath();
  ctx.arc(24, 30.8, 2.3, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

// 48x48 pastel mint-cream bubble with warm-brown eighth note "♪".
function buildEmoteNote(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#F3FCF7", "#E3F6EC");
  ctx.save();
  ctx.fillStyle = "#47321F";
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Tilted note head.
  ctx.beginPath();
  ctx.ellipse(20.5, 28.4, 4.4, 3.2, -0.35, 0, Math.PI * 2);
  ctx.fill();
  // Stem + curved flag.
  ctx.beginPath();
  ctx.moveTo(24.2, 27.2);
  ctx.lineTo(24.2, 13.8);
  ctx.bezierCurveTo(28.5, 14.4, 31.8, 17.6, 30.6, 22);
  ctx.stroke();
  ctx.restore();
  return toTexture(canvas);
}

// 48x48 dreamy lavender-cream bubble with soft purple-brown sleepy "z".
function buildEmoteZzz(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#F8F4FE", "#EFE8FB");
  ctx.strokeStyle = "#5B4374";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Main cozy "z".
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16.5, 19);
  ctx.lineTo(25.5, 19);
  ctx.lineTo(16.8, 29.5);
  ctx.lineTo(26, 29.5);
  ctx.stroke();
  // Tiny companion sleepy "z" tucked upper right.
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(28, 13.5);
  ctx.lineTo(33.2, 13.5);
  ctx.lineTo(28.2, 19.2);
  ctx.lineTo(33.5, 19.2);
  ctx.stroke();
  return toTexture(canvas);
}

// 48x48 blush-cream bubble with warm coral-pink heart "♥".
function buildEmoteHeart(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#FFF5F8", "#FDE8EE");
  ctx.save();
  ctx.translate(24, 23.2);
  ctx.beginPath();
  ctx.moveTo(0, 8.8);
  ctx.bezierCurveTo(-9.5, 3, -11.5, -5.5, -5.6, -8.5);
  ctx.bezierCurveTo(-2.4, -10.2, 0, -7, 0, -4.6);
  ctx.bezierCurveTo(0, -7, 2.4, -10.2, 5.6, -8.5);
  ctx.bezierCurveTo(11.5, -5.5, 9.5, 3, 0, 8.8);
  ctx.closePath();
  ctx.fillStyle = "#E87594";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 253, 248, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-4, -3.8, 2.1, 1.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 48x48 warm lavender-gold cream bubble with hand-inked golden 4-point star + 2 tiny sparkles.
function buildEmoteSparkle(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#FAF5FE", "#EFE6FA");
  const drawStar = (cx: number, cy: number, r: number, waist: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx + waist, cy - waist, cx + r, cy);
    ctx.quadraticCurveTo(cx + waist, cy + waist, cx, cy + r);
    ctx.quadraticCurveTo(cx - waist, cy + waist, cx - r, cy);
    ctx.quadraticCurveTo(cx - waist, cy - waist, cx, cy - r);
    ctx.closePath();
  };
  ctx.save();
  drawStar(22.5, 22.8, 9.2, 2.5);
  const starFill = ctx.createRadialGradient(21, 20.5, 1, 22.5, 22.8, 9.5);
  starFill.addColorStop(0, "#FFF4B5");
  starFill.addColorStop(0.55, "#F9D154");
  starFill.addColorStop(1, "#E7AE32");
  ctx.fillStyle = starFill;
  ctx.fill();
  ctx.lineWidth = 1.7;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  ctx.fillStyle = "#FBE07A";
  ctx.lineWidth = 1.3;
  drawStar(33.2, 15.2, 3.8, 1.1);
  ctx.fill();
  ctx.stroke();
  drawStar(13.8, 29.2, 3.1, 0.9);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return toTexture(canvas);
}

// 48x48 warm peach-cream speech bubble with 3 cheerful hand-inked welcome wave arcs.
function buildEmoteWave(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#FFF8EF", "#FBE9D4");
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#EE9A64";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(15.2, 26.8);
  ctx.quadraticCurveTo(19, 21.4, 16.4, 15.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(23.5, 28.4);
  ctx.quadraticCurveTo(25.2, 21.2, 23.5, 14.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(31.8, 26.8);
  ctx.quadraticCurveTo(28.4, 21.4, 31.2, 15.4);
  ctx.stroke();
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(15.6, 26.5);
  ctx.quadraticCurveTo(18.6, 21.4, 16.5, 15.6);
  ctx.moveTo(23.8, 28.2);
  ctx.quadraticCurveTo(25.2, 21.2, 23.8, 14.4);
  ctx.moveTo(31.8, 26.5);
  ctx.quadraticCurveTo(28.8, 21.4, 31.1, 15.6);
  ctx.stroke();
  ctx.restore();
  return toTexture(canvas);
}

// 48x48 pale periwinkle-cream bubble with cozy blue-grey sweat-drop and startled squiggle.
function buildEmoteWorry(makeCanvas: CanvasFactory, toTexture: TextureFactory): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  drawComicBubble(ctx, "#F3F6FD", "#E4ECFA");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(20.5, 13);
  ctx.bezierCurveTo(25.8, 19.5, 27.2, 24.4, 25.4, 28.1);
  ctx.bezierCurveTo(23.8, 31.2, 17.2, 31.2, 15.6, 28.1);
  ctx.bezierCurveTo(13.8, 24.4, 15.2, 19.5, 20.5, 13);
  ctx.closePath();
  const dropFill = ctx.createRadialGradient(18.6, 21.5, 1, 20.5, 24, 9);
  dropFill.addColorStop(0, "#CFE4FA");
  dropFill.addColorStop(0.55, "#8AB3E2");
  dropFill.addColorStop(1, "#6C95C8");
  ctx.fillStyle = dropFill;
  ctx.fill();
  ctx.lineWidth = 1.9;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#47321F";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 253, 248, 0.85)";
  ctx.beginPath();
  ctx.ellipse(18.3, 23.6, 1.5, 2.7, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#47321F";
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(29.8, 16.4);
  ctx.lineTo(33.2, 19.2);
  ctx.lineTo(29.8, 22.2);
  ctx.lineTo(33.2, 25.2);
  ctx.stroke();
  ctx.restore();
  return toTexture(canvas);
}

export function createEmoteTextures(
  makeCanvas: CanvasFactory,
  toTexture: TextureFactory,
): Record<EmoteTextureKey, Texture> {
  return {
    emoteQuestion: buildEmoteQuestion(makeCanvas, toTexture),
    emoteExclaim: buildEmoteExclaim(makeCanvas, toTexture),
    emoteNote: buildEmoteNote(makeCanvas, toTexture),
    emoteZzz: buildEmoteZzz(makeCanvas, toTexture),
    emoteHeart: buildEmoteHeart(makeCanvas, toTexture),
    emoteSparkle: buildEmoteSparkle(makeCanvas, toTexture),
    emoteWave: buildEmoteWave(makeCanvas, toTexture),
    emoteWorry: buildEmoteWorry(makeCanvas, toTexture),
  };
}
