import { CanvasSource, Texture } from "pixi.js";

export type VfxTextureKey =
  | "contactShadow"
  | "softGlow"
  | "sparkle"
  | "petal"
  | "waterGlint"
  | "mistWisp"
  | "sunbeam"
  | "paperGrain"
  | "puff"
  | "heart"
  | "energyRing";

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

export function createVfxTextures(): VfxTextures {
  const textures: Record<VfxTextureKey, Texture> = {
    contactShadow: buildContactShadow(),
    softGlow: buildSoftGlow(),
    sparkle: buildSparkle(),
    petal: buildPetal(),
    waterGlint: buildWaterGlint(),
    mistWisp: buildMistWisp(),
    sunbeam: buildSunbeam(),
    paperGrain: buildPaperGrain(),
    puff: buildPuff(),
    heart: buildHeart(),
    energyRing: buildEnergyRing(),
  };
  return {
    ...textures,
    destroy: () => {
      for (const texture of Object.values(textures)) texture.destroy(true);
    },
  };
}
