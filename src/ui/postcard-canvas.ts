import type { CozyWeatherKind } from "../core/weather";

export type ComposedPostcard = {
  dataUrl: string;
  width: number;
  height: number;
};

export type PostcardImageSource = HTMLCanvasElement | HTMLImageElement;

function isImageElement(source: PostcardImageSource): source is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement;
}

function sourceDimensions(source: PostcardImageSource): { width: number; height: number } {
  if (isImageElement(source)) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCloverStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#97c982";
  ctx.strokeStyle = "#47321f";
  ctx.lineWidth = Math.max(1.5, size * 0.14);
  const offsets: readonly [number, number][] = [
    [0, -size * 0.44],
    [size * 0.44, 0],
    [0, size * 0.44],
    [-size * 0.44, 0],
  ];
  for (const [ox, oy] of offsets) {
    ctx.beginPath();
    ctx.arc(ox, oy, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe896";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): void {
  ctx.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4 - Math.PI / 2;
    const radius = index % 2 === 0 ? outer : inner;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

const WEATHER_STAMP_FILLS: Readonly<Record<Exclude<CozyWeatherKind, "clear">, string>> = {
  sunshower: "#f3faff",
  "snow-flurry": "#eff8ff",
  "breeze-petals": "#fff4f7",
  "twilight-fireflies": "#eee9ff",
};

function drawWeatherStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  weather: Exclude<CozyWeatherKind, "clear">,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const ink = "#47321f";
  const ringWidth = Math.max(1.2, size * 0.11);

  // Delicate hand-inked circular postal cancel medallion.
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = WEATHER_STAMP_FILLS[weather];
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = ringWidth;
  ctx.stroke();

  if (weather === "sunshower") {
    ctx.lineCap = "round";
    const arcY = size * 0.14;
    const bands: readonly [number, string, number][] = [
      [size * 0.58, "#f29082", Math.max(1.6, size * 0.15)],
      [size * 0.43, "#f6da7c", Math.max(1.5, size * 0.14)],
      [size * 0.28, "#82cce8", Math.max(1.4, size * 0.13)],
    ];
    for (const [radius, color, width] of bands) {
      ctx.beginPath();
      ctx.arc(0, arcY, radius, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, arcY, size * 0.66, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.0, size * 0.08);
    ctx.stroke();

    // Two slanted sky-blue raindrops beneath the rainbow arc.
    const drops: readonly [number, number][] = [
      [-size * 0.2, size * 0.3],
      [size * 0.18, size * 0.32],
    ];
    for (const [dx, dy] of drops) {
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - size * 0.09, dy + size * 0.26);
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2.0, size * 0.18);
      ctx.stroke();
      ctx.strokeStyle = "#5cb4e6";
      ctx.lineWidth = Math.max(1.1, size * 0.1);
      ctx.stroke();
    }
  } else if (weather === "snow-flurry") {
    ctx.lineCap = "round";
    const arm = size * 0.62;
    const tickAt = size * 0.38;
    const tickLen = size * 0.16;
    const strokeFlake = (color: string, width: number): void => {
      ctx.beginPath();
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const angle = (spoke * Math.PI) / 3 - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        ctx.moveTo(0, 0);
        ctx.lineTo(cos * arm, sin * arm);
        const bx = cos * tickAt;
        const by = sin * tickAt;
        for (const side of [-1, 1] as const) {
          const branchAngle = angle + side * 0.72;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(branchAngle) * tickLen, by + Math.sin(branchAngle) * tickLen);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    strokeFlake(ink, Math.max(2.0, size * 0.17));
    strokeFlake("#86d0f8", Math.max(1.0, size * 0.09));
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.9, size * 0.07);
    ctx.stroke();
  } else if (weather === "breeze-petals") {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-size * 0.56, size * 0.34);
    ctx.bezierCurveTo(
      -size * 0.16,
      size * 0.5,
      size * 0.24,
      size * 0.28,
      size * 0.44,
      size * 0.1,
    );
    ctx.quadraticCurveTo(size * 0.6, -size * 0.04, size * 0.44, -size * 0.16);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.2, size * 0.095);
    ctx.stroke();

    const petals: readonly [number, number, number, string][] = [
      [-size * 0.28, -size * 0.16, -0.48, "#f59ebc"],
      [size * 0.04, -size * 0.3, 0.28, "#fff5e2"],
      [size * 0.14, -size * 0.02, -0.25, "#f9bfd4"],
    ];
    for (const [px, py, rot, fill] of petals) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.23, size * 0.13, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1.0, size * 0.085);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Twilight fireflies: lavender-gold crescent moon + 2 golden 4-point firefly stars.
    const moonX = -size * 0.14;
    const moonR = size * 0.46;
    const startA = 0.38 * Math.PI;
    const endA = 1.62 * Math.PI;
    ctx.beginPath();
    ctx.arc(moonX, 0, moonR, startA, endA, false);
    ctx.quadraticCurveTo(
      moonX - moonR * 0.95,
      0,
      moonX + Math.cos(startA) * moonR,
      Math.sin(startA) * moonR,
    );
    ctx.closePath();
    ctx.fillStyle = "#f7dc84";
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.1, size * 0.09);
    ctx.stroke();

    const stars: readonly [number, number, number][] = [
      [size * 0.34, -size * 0.26, size * 0.24],
      [size * 0.24, size * 0.34, size * 0.18],
    ];
    for (const [sx, sy, outer] of stars) {
      drawFourPointStar(ctx, sx, sy, outer, outer * 0.34);
      ctx.fillStyle = "#ffe470";
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(0.9, size * 0.075);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function formatStampText(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length === 0) return "Wilds of Cloverhollow";
  if (/wilds of cloverhollow/i.test(trimmed)) return trimmed;
  return `Wilds of Cloverhollow · ${trimmed}`;
}

function renderPostcardCanvas(
  source: PostcardImageSource, caption: string, subcaption = "", weather?: CozyWeatherKind,
): HTMLCanvasElement | null {
  const { width: srcWidth, height: srcHeight } = sourceDimensions(source);
  if (srcWidth <= 0 || srcHeight <= 0) return null;
  const padX = Math.max(24, Math.round(srcWidth * 0.032));
  const padTop = padX;
  const padBottom = Math.max(60, Math.round(srcHeight * 0.095));
  const width = srcWidth + padX * 2;
  const height = srcHeight + padTop + padBottom;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;

  ctx.fillStyle = "#fbf6e8";
  ctx.fillRect(0, 0, width, height);
  const outerInset = Math.max(8, Math.round(padX * 0.26));
  const outerRadius = Math.max(10, Math.round(padX * 0.34));
  ctx.strokeStyle = "#e6dac0";
  ctx.lineWidth = Math.max(2, Math.round(padX * 0.08));
  drawRoundedRect(
    ctx, outerInset, outerInset, width - outerInset * 2, height - outerInset * 2, outerRadius,
  );
  ctx.stroke();

  ctx.strokeStyle = "#47321f";
  ctx.lineWidth = Math.max(2, Math.round(srcWidth * 0.002));
  drawRoundedRect(
    ctx, outerInset + 4, outerInset + 4, width - (outerInset + 4) * 2,
    height - (outerInset + 4) * 2, Math.max(8, outerRadius - 3),
  );
  ctx.stroke();

  ctx.drawImage(source, padX, padTop, srcWidth, srcHeight);
  ctx.strokeStyle = "#47321f";
  ctx.lineWidth = Math.max(2, Math.round(srcWidth * 0.0022));
  ctx.strokeRect(padX, padTop, srcWidth, srcHeight);

  const stripMidY = padTop + srcHeight + padBottom * 0.52;
  const fontSize = Math.max(16, Math.round(padBottom * 0.34));
  const subFontSize = Math.max(13, Math.round(padBottom * 0.25));
  const cloverSize = Math.max(10, Math.round(padBottom * 0.19));
  drawCloverStamp(ctx, padX + cloverSize + 4, stripMidY, cloverSize);

  let subX = padX + cloverSize * 2 + 16;
  if (weather !== undefined && weather !== "clear") {
    const gap = Math.max(10, Math.round(cloverSize * 0.85));
    const stampSize = Math.round(cloverSize * 1.05);
    const stampX = padX + cloverSize * 2 + 4 + gap + stampSize;
    drawWeatherStamp(ctx, stampX, stripMidY, stampSize, weather);
    subX = stampX + stampSize + Math.max(12, Math.round(cloverSize * 0.95));
  }

  const stampText = formatStampText(caption);
  ctx.fillStyle = "#47321f";
  ctx.font = `800 ${fontSize}px Nunito, "Trebuchet MS", sans-serif`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  const stampWidth = ctx.measureText(stampText).width;
  ctx.fillText(stampText, width - padX - 4, stripMidY);

  const cleanSub = subcaption.trim();
  if (cleanSub.length > 0) {
    const maxSubWidth = Math.max(120, width - padX - 20 - stampWidth - subX);
    ctx.fillStyle = "#6f5947";
    ctx.font = `700 ${subFontSize}px Nunito, "Trebuchet MS", sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(cleanSub.toUpperCase(), subX, stripMidY, maxSubWidth);
  }
  return canvas;
}

/** Composes a live canvas or painted image inside a warm cream watercolor postcard border. */
export function composePostcardFrame(
  source: PostcardImageSource, caption: string, subcaption = "", weather?: CozyWeatherKind,
): ComposedPostcard | null {
  const canvas = renderPostcardCanvas(source, caption, subcaption, weather);
  if (canvas === null) return null;
  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png;base64,")) return null;
  return { dataUrl, width: canvas.width, height: canvas.height };
}

/** Composes a compact JPEG scrapbook copy (`maxWidth = 640`, quality `0.85`) for localStorage. */
export function createPostcardAlbumCopy(
  source: PostcardImageSource, caption: string, subcaption = "",
  weather?: CozyWeatherKind, maxWidth = 640,
): ComposedPostcard | null {
  const full = renderPostcardCanvas(source, caption, subcaption, weather);
  if (full === null) return null;
  let target = full;
  if (maxWidth > 0 && full.width > maxWidth) {
    const compact = document.createElement("canvas");
    compact.width = maxWidth;
    compact.height = Math.max(1, Math.round((full.height * maxWidth) / full.width));
    const ctx = compact.getContext("2d");
    if (ctx !== null) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, compact.width, compact.height);
      target = compact;
    }
  }
  const dataUrl = target.toDataURL("image/jpeg", 0.85);
  if (!/^data:image\/(?:jpeg|png);base64,/.test(dataUrl)) return null;
  return { dataUrl, width: target.width, height: target.height };
}

/** Composes a framed Cloverhollow Postcard PNG and returns its data URL. */
export function composePostcard(source: PostcardImageSource, caption: string): string | null {
  return composePostcardFrame(source, caption)?.dataUrl ?? null;
}
