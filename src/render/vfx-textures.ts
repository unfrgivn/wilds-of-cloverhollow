import { CanvasSource, Texture } from "pixi.js";

export type VfxTextureKey =
  | "contactShadow"
  | "softGlow"
  | "sparkle"
  | "petal"
  | "waterGlint"
  | "mistWisp"
  | "sunbeam"
  | "sunburst"
  | "paperGrain"
  | "puff"
  | "heart"
  | "energyRing"
  | "emoteQuestion"
  | "emoteExclaim"
  | "emoteNote"
  | "emoteZzz"
  | "emoteHeart"
  | "keepsakeCrystal"
  | "keepsakePin"
  | "keepsakeGeode"
  | "keepsakeFeather"
  | "keepsakeTaco";

export type VfxTextures = Record<VfxTextureKey, Texture> & {
  destroy: () => void;
};

type CanvasContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

function makeCanvas(width: number, height: number): CanvasContext {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("2D canvas context unavailable for VFX textures");
  return { canvas, ctx };
}

function toTexture(
  canvas: HTMLCanvasElement,
  addressMode: "clamp-to-edge" | "repeat" = "clamp-to-edge",
): Texture {
  return new Texture({
    source: new CanvasSource({
      resource: canvas,
      addressMode,
      scaleMode: "linear",
    }),
  });
}

// 96x48 elliptical multi-stop radial wash in warm plum-brown #52455F.
function buildContactShadow(): Texture {
  const { canvas, ctx } = makeCanvas(96, 48);
  ctx.save();
  ctx.translate(48, 24);
  ctx.scale(1, 0.5);
  const wash = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
  wash.addColorStop(0, "rgba(68, 53, 82, 1)");
  wash.addColorStop(0.45, "rgba(78, 63, 92, 0.85)");
  wash.addColorStop(0.72, "rgba(86, 71, 100, 0.42)");
  wash.addColorStop(0.9, "rgba(92, 78, 106, 0.1)");
  wash.addColorStop(1, "rgba(82, 69, 95, 0)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 128x128 smooth radial white/warm glow for tinting into halos and light pools.
function buildSoftGlow(): Texture {
  const { canvas, ctx } = makeCanvas(128, 128);
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.24, "rgba(255, 253, 246, 0.72)");
  glow.addColorStop(0.54, "rgba(255, 252, 242, 0.26)");
  glow.addColorStop(0.82, "rgba(255, 250, 240, 0.05)");
  glow.addColorStop(1, "rgba(255, 250, 240, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas);
}

// 48x48 chubby soft 4-point concave diamond flare matching vfx_particles.png.
function buildSparkle(): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  const halo = ctx.createRadialGradient(24, 24, 1, 24, 24, 22);
  halo.addColorStop(0, "rgba(255, 252, 236, 0.65)");
  halo.addColorStop(0.45, "rgba(255, 246, 214, 0.24)");
  halo.addColorStop(1, "rgba(255, 246, 214, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 48, 48);

  const rx = 15;
  const ry = 19;
  const waist = 4.2;
  ctx.save();
  ctx.translate(24, 24);
  ctx.beginPath();
  ctx.moveTo(0, -ry);
  ctx.quadraticCurveTo(waist, -waist, rx, 0);
  ctx.quadraticCurveTo(waist, waist, 0, ry);
  ctx.quadraticCurveTo(-waist, waist, -rx, 0);
  ctx.quadraticCurveTo(-waist, -waist, 0, -ry);
  ctx.closePath();
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  core.addColorStop(0, "rgba(255, 255, 255, 1)");
  core.addColorStop(0.48, "rgba(255, 252, 238, 0.92)");
  core.addColorStop(1, "rgba(255, 244, 212, 0.15)");
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 32x32 soft organic watercolor teardrop/petal silhouette, tintable.
function buildPetal(): Texture {
  const { canvas, ctx } = makeCanvas(32, 32);
  ctx.save();
  ctx.translate(16, 16);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.bezierCurveTo(7.5, -6, 10, 3.5, 4.5, 9.5);
  ctx.bezierCurveTo(1.5, 12, -2.5, 12, -5, 9.2);
  ctx.bezierCurveTo(-10, 3.2, -7.2, -5.8, 0, -11);
  ctx.closePath();
  const fill = ctx.createRadialGradient(-2, -2, 1, 0, 1, 13);
  fill.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  fill.addColorStop(0.62, "rgba(255, 255, 255, 0.86)");
  fill.addColorStop(0.92, "rgba(255, 255, 255, 0.45)");
  fill.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 48x24 soft luminous horizontal water shimmer diamond/ellipse.
function buildWaterGlint(): Texture {
  const { canvas, ctx } = makeCanvas(48, 24);
  ctx.save();
  ctx.translate(24, 12);
  ctx.scale(1, 0.44);
  const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
  halo.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  halo.addColorStop(0.45, "rgba(255, 255, 255, 0.36)");
  halo.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(24, 12);
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.quadraticCurveTo(4.5, -2.2, 20, 0);
  ctx.quadraticCurveTo(4.5, 2.2, 0, 6.5);
  ctx.quadraticCurveTo(-4.5, 2.2, -20, 0);
  ctx.quadraticCurveTo(-4.5, -2.2, 0, -6.5);
  ctx.closePath();
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  core.addColorStop(0, "rgba(255, 255, 255, 1)");
  core.addColorStop(0.55, "rgba(255, 255, 255, 0.7)");
  core.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 160x80 soft horizontal cloud-ribbon gradient for drifting mist and smoke.
function buildMistWisp(): Texture {
  const { canvas, ctx } = makeCanvas(160, 80);
  const puffs: readonly [number, number, number, number, number][] = [
    [52, 42, 44, 24, 0.62],
    [82, 36, 52, 28, 0.78],
    [110, 44, 42, 22, 0.58],
    [76, 48, 56, 20, 0.5],
  ];
  for (const [cx, cy, rx, ry, peak] of puffs) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const puff = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
    puff.addColorStop(0, `rgba(255, 255, 255, ${peak})`);
    puff.addColorStop(0.52, `rgba(255, 255, 255, ${peak * 0.42})`);
    puff.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return toTexture(canvas);
}

// 128x256 soft diagonal warm sunlight shaft fading smoothly on all edges.
function buildSunbeam(): Texture {
  const { canvas, ctx } = makeCanvas(128, 256);
  const image = ctx.createImageData(128, 256);
  const data = image.data;
  for (let y = 0; y < 256; y += 1) {
    const v = y / 255;
    // Smooth fade in at top, long warm body, gentle fade out at bottom.
    const fadeTop = Math.min(1, v / 0.22);
    const fadeBottom = Math.min(1, (1 - v) / 0.34);
    const vFade = fadeTop * fadeTop * (3 - 2 * fadeTop) *
      fadeBottom * fadeBottom * (3 - 2 * fadeBottom);
    const center = 36 + v * 56;
    const halfWidth = 22 + v * 14;
    for (let x = 0; x < 128; x += 1) {
      const dist = Math.abs(x - center) / halfWidth;
      const primary = dist >= 1 ? 0 : (1 - dist * dist) * (1 - dist * dist);
      const secondaryDist = Math.abs(x - (center + 16)) / (halfWidth * 0.55);
      const secondary = secondaryDist >= 1
        ? 0
        : (1 - secondaryDist * secondaryDist) * 0.35;
      // Keep strict 0 alpha along the left/right edges so no seam shows.
      const edgeX = Math.min(1, Math.min(x, 127 - x) / 10);
      const alpha = Math.min(1, (primary + secondary) * vFade * edgeX);
      const offset = (y * 128 + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 250;
      data[offset + 2] = 232;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas);
}

// 256x256 hand-painted watercolor radial sunburst: 12 alternating soft tapered
// rays (6 primary + 6 secondary) from cream-gold center to feathered gold edge.
function buildSunburst(): Texture {
  const size = 256;
  const half = size * 0.5;
  const maxR = 126;
  const { canvas, ctx } = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    const dy = y - half + 0.5;
    for (let x = 0; x < size; x += 1) {
      const dx = x - half + 0.5;
      const r = Math.hypot(dx, dy);
      const rn = r / maxR;
      if (rn >= 1) continue;
      const theta = Math.atan2(dy, dx);
      const wave = Math.cos(6 * theta);
      const primaryAng = Math.pow(Math.max(0, wave), 2.8);
      const secondaryAng = Math.pow(Math.max(0, -wave), 3.6);
      const primaryRad = (1 - rn * rn) * (1 - 0.18 * rn);
      const primaryRay = primaryAng * primaryRad * 0.92;
      const secRn = rn / 0.86;
      const secondaryRay = secRn >= 1
        ? 0
        : secondaryAng * (1 - secRn * secRn) * 0.62;
      const coreFalloff = Math.max(0, 1 - rn / 0.3);
      const coreGlow = coreFalloff * coreFalloff * 0.92;
      const alpha = Math.min(0.94, Math.max(coreGlow, primaryRay + secondaryRay));
      // Warm cream-gold center (255, 248, 208) -> mid gold (255, 220, 102) -> (255, 204, 72).
      const tMid = Math.min(1, rn * 1.8);
      const tOuter = Math.max(0, (rn - 0.55) / 0.45);
      const g = Math.round((248 + (220 - 248) * tMid) + (204 - 220) * tOuter);
      const b = Math.round((208 + (102 - 208) * tMid) + (72 - 102) * tOuter);
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas);
}

// 256x256 seamless cold-press watercolor paper tooth via deterministic LCG + toroidal blur.
function buildPaperGrain(): Texture {
  const size = 256;
  const { canvas, ctx } = makeCanvas(size, size);
  const raw = new Float32Array(size * size);
  const blurred = new Float32Array(size * size);
  let seed = 0x5f3759df;
  for (let i = 0; i < raw.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    raw[i] = seed / 0xffffffff;
  }
  // Low-frequency cold-press tooth (32x32 periodic lattice, bilinearly sampled).
  const coarse = 32;
  const tooth = new Float32Array(coarse * coarse);
  for (let i = 0; i < tooth.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    tooth[i] = seed / 0xffffffff;
  }
  // One toroidal 3x3 weighted smooth pass keeps the grain soft and seamless.
  for (let y = 0; y < size; y += 1) {
    const ym = (y + size - 1) & 255;
    const yp = (y + 1) & 255;
    for (let x = 0; x < size; x += 1) {
      const xm = (x + size - 1) & 255;
      const xp = (x + 1) & 255;
      const sum =
        (raw[ym * size + xm] ?? 0) +
        (raw[ym * size + x] ?? 0) * 2 +
        (raw[ym * size + xp] ?? 0) +
        (raw[y * size + xm] ?? 0) * 2 +
        (raw[y * size + x] ?? 0) * 4 +
        (raw[y * size + xp] ?? 0) * 2 +
        (raw[yp * size + xm] ?? 0) +
        (raw[yp * size + x] ?? 0) * 2 +
        (raw[yp * size + xp] ?? 0);
      blurred[y * size + x] = sum / 16;
    }
  }
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    const cy = (y / size) * coarse;
    const y0 = Math.floor(cy) & (coarse - 1);
    const y1 = (y0 + 1) & (coarse - 1);
    const fy = cy - Math.floor(cy);
    for (let x = 0; x < size; x += 1) {
      const cx = (x / size) * coarse;
      const x0 = Math.floor(cx) & (coarse - 1);
      const x1 = (x0 + 1) & (coarse - 1);
      const fx = cx - Math.floor(cx);
      const top = (tooth[y0 * coarse + x0] ?? 0) * (1 - fx) +
        (tooth[y0 * coarse + x1] ?? 0) * fx;
      const bot = (tooth[y1 * coarse + x0] ?? 0) * (1 - fx) +
        (tooth[y1 * coarse + x1] ?? 0) * fx;
      const coarseVal = top * (1 - fy) + bot * fy;
      const fineVal = blurred[y * size + x] ?? 0.5;
      const combined = fineVal * 0.55 + coarseVal * 0.45;
      // Map into warm light grey-cream 228..255 for gentle multiply paper tooth.
      const base = Math.round(228 + combined * 27);
      const offset = (y * size + x) * 4;
      data[offset] = Math.min(255, base);
      data[offset + 1] = Math.min(255, Math.max(228, base - 1));
      data[offset + 2] = Math.min(255, Math.max(228, base - 3));
      data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas, "repeat");
}

// 64x64 soft multi-lobe gouache cloud puff: cream #FAF3DF -> sand #E4CFAF -> taupe #C3A27D.
function buildPuff(): Texture {
  const { canvas, ctx } = makeCanvas(64, 64);
  const lobes: readonly [number, number, number, number][] = [
    [24, 34, 18, 0.84],
    [40, 34, 17, 0.82],
    [32, 26, 20, 0.92],
    [32, 38, 18, 0.76],
    [22, 27, 13, 0.68],
    [42, 28, 13, 0.68],
  ];
  for (const [cx, cy, r, peak] of lobes) {
    const wash = ctx.createRadialGradient(cx - r * 0.16, cy - r * 0.18, 1, cx, cy, r);
    wash.addColorStop(0, `rgba(250, 243, 223, ${peak})`);
    wash.addColorStop(0.52, `rgba(228, 207, 175, ${peak * 0.78})`);
    wash.addColorStop(0.82, `rgba(195, 162, 125, ${peak * 0.34})`);
    wash.addColorStop(1, "rgba(195, 162, 125, 0)");
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas);
}

// 48x48 chubby soft watercolor heart, tintable for pastel rainbow bursts.
function buildHeart(): Texture {
  const { canvas, ctx } = makeCanvas(48, 48);
  const halo = ctx.createRadialGradient(24, 24, 2, 24, 24, 22);
  halo.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  halo.addColorStop(0.65, "rgba(255, 255, 255, 0.14)");
  halo.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 48, 48);

  ctx.save();
  ctx.translate(24, 25);
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.bezierCurveTo(-15, 5, -18, -9, -9, -14);
  ctx.bezierCurveTo(-4, -17, 0, -12, 0, -8);
  ctx.bezierCurveTo(0, -12, 4, -17, 9, -14);
  ctx.bezierCurveTo(18, -9, 15, 5, 0, 14);
  ctx.closePath();
  const fill = ctx.createRadialGradient(-4, -5, 1, 0, 0, 18);
  fill.addColorStop(0, "rgba(255, 255, 255, 1)");
  fill.addColorStop(0.68, "rgba(255, 253, 250, 0.92)");
  fill.addColorStop(0.95, "rgba(255, 248, 244, 0.65)");
  fill.addColorStop(1, "rgba(255, 248, 244, 0)");
  ctx.fillStyle = fill;
  ctx.fill();
  // Soft painterly upper-left highlight.
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-6.5, -6.5, 3.4, 2.2, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return toTexture(canvas);
}

// 96x96 luminous soft aqua/mint energy ripple #D4FCF2 -> #67D5C4 -> transparent.
function buildEnergyRing(): Texture {
  const { canvas, ctx } = makeCanvas(96, 96);
  const ring = ctx.createRadialGradient(48, 48, 8, 48, 48, 46);
  ring.addColorStop(0, "rgba(212, 252, 242, 0)");
  ring.addColorStop(0.42, "rgba(103, 213, 196, 0.08)");
  ring.addColorStop(0.64, "rgba(103, 213, 196, 0.56)");
  ring.addColorStop(0.76, "rgba(212, 252, 242, 0.95)");
  ring.addColorStop(0.86, "rgba(103, 213, 196, 0.55)");
  ring.addColorStop(0.96, "rgba(103, 213, 196, 0.12)");
  ring.addColorStop(1, "rgba(103, 213, 196, 0)");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(48, 48, 46, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(canvas);
}

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
function buildEmoteQuestion(): Texture {
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
function buildEmoteExclaim(): Texture {
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
function buildEmoteNote(): Texture {
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
function buildEmoteZzz(): Texture {
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
function buildEmoteHeart(): Texture {
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

// 48x48 hand-inked Shimmering Star Crystal keepsake (aqua/mint facets + star glint).
function buildKeepsakeCrystal(): Texture {
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
function buildKeepsakePin(): Texture {
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
function buildKeepsakeGeode(): Texture {
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
function buildKeepsakeFeather(): Texture {
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
function buildKeepsakeTaco(): Texture {
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
  for (const [tx, ty] of [[18, 21], [25, 19], [31, 22]] as const) {
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
  for (const [sx, sy] of [[17, 29], [23, 32], [29, 28], [33, 31]] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas);
}

export function createVfxTextures(): VfxTextures {
  const textures: Record<VfxTextureKey, Texture> = {
    contactShadow: buildContactShadow(),
    softGlow: buildSoftGlow(),
    sparkle: buildSparkle(),
    petal: buildPetal(),
    waterGlint: buildWaterGlint(),
    mistWisp: buildMistWisp(),
    sunbeam: buildSunbeam(),
    sunburst: buildSunburst(),
    paperGrain: buildPaperGrain(),
    puff: buildPuff(),
    heart: buildHeart(),
    energyRing: buildEnergyRing(),
    emoteQuestion: buildEmoteQuestion(),
    emoteExclaim: buildEmoteExclaim(),
    emoteNote: buildEmoteNote(),
    emoteZzz: buildEmoteZzz(),
    emoteHeart: buildEmoteHeart(),
    keepsakeCrystal: buildKeepsakeCrystal(),
    keepsakePin: buildKeepsakePin(),
    keepsakeGeode: buildKeepsakeGeode(),
    keepsakeFeather: buildKeepsakeFeather(),
    keepsakeTaco: buildKeepsakeTaco(),
  };
  return {
    ...textures,
    destroy: () => {
      for (const texture of Object.values(textures)) texture.destroy(true);
    },
  };
}
