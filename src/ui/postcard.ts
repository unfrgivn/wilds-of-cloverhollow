import type { CozyWeatherKind } from "../core/weather";
import { element, svgElement } from "./dom";

export type PostcardMetadata = {
  filename: string;
  caption: string;
  subcaption: string;
};

export type PostcardCapture = {
  filename: string;
  caption: string;
  subcaption: string;
  width: number;
  height: number;
  dataUrl: string;
};

export type ComposedPostcard = {
  dataUrl: string;
  width: number;
  height: number;
};

export type PostcardShareApi = {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
};

export type PostcardDeliveryResult = "shared" | "cancelled" | "downloaded";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
export const PHOTO_TOAST_DURATION_MS = 1800;

function slugAreaId(areaId: string): string {
  const cleaned = areaId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "cloverhollow";
}

/** Pure formatter for active companion display names stamped on Photo Mode postcards. */
export function formatPostcardCompanions(names: readonly string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  if (unique.length === 0) return "";
  if (unique.length === 1) return `with ${unique[0]}`;
  if (unique.length === 2) return `with ${unique[0]} & ${unique[1]}`;
  if (unique.length > 4) {
    return `with ${unique[0]}, ${unique[1]}, ${unique[2]} & friends`;
  }
  const head = unique.slice(0, -1).join(", ");
  const last = unique[unique.length - 1];
  return `with ${head} & ${last}`;
}

const POSTCARD_WEATHER_LABELS: Readonly<Record<Exclude<CozyWeatherKind, "clear">, string>> = {
  sunshower: "Rainbow Sunshower",
  "breeze-petals": "Petal Breeze",
  "snow-flurry": "Snow Flurry",
  "twilight-fireflies": "Twilight Fireflies",
};

/** Returns the cozy weather stamp for Photo Mode postcards, or `""` for clear/sheltered skies. */
export function postcardWeatherLabel(weather?: CozyWeatherKind): string {
  if (weather === undefined || weather === "clear") return "";
  return POSTCARD_WEATHER_LABELS[weather];
}

/** Pure formatter for Photo Mode postcard filenames, captions, and region labels. */
export function postcardMetadata(
  areaId: string,
  areaName: string,
  landName: string,
  partyNames?: readonly string[],
  weather?: CozyWeatherKind,
): PostcardMetadata {
  const slug = slugAreaId(areaId);
  const cleanArea = areaName.trim().length > 0 ? areaName.trim() : "Cloverhollow";
  const cleanLand = landName.trim();
  const companions = partyNames === undefined ? "" : formatPostcardCompanions(partyNames);
  const weatherLabel = postcardWeatherLabel(weather);
  const baseSub =
    cleanLand.length > 0 && companions.length > 0
      ? `${cleanLand} · ${companions}`
      : cleanLand.length > 0
        ? cleanLand
        : companions;
  const subcaption =
    weatherLabel.length > 0
      ? baseSub.length > 0
        ? `${baseSub} · ${weatherLabel}`
        : weatherLabel
      : baseSub;
  return {
    filename: `cloverhollow-postcard-${slug}.png`,
    caption: `${cleanArea} · Wilds of Cloverhollow`,
    subcaption,
  };
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

function formatStampText(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length === 0) return "Wilds of Cloverhollow";
  if (/wilds of cloverhollow/i.test(trimmed)) return trimmed;
  return `Wilds of Cloverhollow · ${trimmed}`;
}

/**
 * Composes a live WebGL snapshot onto an offscreen 2D canvas framed inside a
 * warm cream watercolor postcard border with thin hand-inked rules and a
 * bottom-right storybook stamp.
 */
export function composePostcardFrame(
  sourceCanvas: HTMLCanvasElement,
  caption: string,
  subcaption = "",
): ComposedPostcard | null {
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;
  if (srcWidth <= 0 || srcHeight <= 0) return null;

  const padX = Math.max(24, Math.round(srcWidth * 0.032));
  const padTop = padX;
  const padBottom = Math.max(60, Math.round(srcHeight * 0.095));
  const width = srcWidth + padX * 2;
  const height = srcHeight + padTop + padBottom;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;

  // Cozy warm cream watercolor paper stock.
  ctx.fillStyle = "#fbf6e8";
  ctx.fillRect(0, 0, width, height);

  // Subtle inner cream mat trim and hand-drawn outer border.
  const outerInset = Math.max(8, Math.round(padX * 0.26));
  const outerRadius = Math.max(10, Math.round(padX * 0.34));
  ctx.strokeStyle = "#e6dac0";
  ctx.lineWidth = Math.max(2, Math.round(padX * 0.08));
  drawRoundedRect(
    ctx,
    outerInset,
    outerInset,
    width - outerInset * 2,
    height - outerInset * 2,
    outerRadius,
  );
  ctx.stroke();

  ctx.strokeStyle = "#47321f";
  ctx.lineWidth = Math.max(2, Math.round(srcWidth * 0.002));
  drawRoundedRect(
    ctx,
    outerInset + 4,
    outerInset + 4,
    width - (outerInset + 4) * 2,
    height - (outerInset + 4) * 2,
    Math.max(8, outerRadius - 3),
  );
  ctx.stroke();

  // Live painting window with a crisp hand-inked inner rule.
  ctx.drawImage(sourceCanvas, padX, padTop, srcWidth, srcHeight);
  ctx.strokeStyle = "#47321f";
  ctx.lineWidth = Math.max(2, Math.round(srcWidth * 0.0022));
  ctx.strokeRect(padX, padTop, srcWidth, srcHeight);

  // Bottom strip: clover emblem + region subcaption on left, storybook stamp on right.
  const stripMidY = padTop + srcHeight + padBottom * 0.52;
  const fontSize = Math.max(16, Math.round(padBottom * 0.34));
  const subFontSize = Math.max(13, Math.round(padBottom * 0.25));
  const cloverSize = Math.max(10, Math.round(padBottom * 0.19));

  drawCloverStamp(ctx, padX + cloverSize + 4, stripMidY, cloverSize);

  const stampText = formatStampText(caption);
  ctx.fillStyle = "#47321f";
  ctx.font = `800 ${fontSize}px Nunito, "Trebuchet MS", sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const stampWidth = ctx.measureText(stampText).width;
  ctx.fillText(stampText, width - padX - 4, stripMidY);

  const cleanSub = subcaption.trim();
  if (cleanSub.length > 0) {
    const subX = padX + cloverSize * 2 + 16;
    const maxSubWidth = Math.max(120, width - padX - 20 - stampWidth - subX);
    ctx.fillStyle = "#6f5947";
    ctx.font = `700 ${subFontSize}px Nunito, "Trebuchet MS", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(cleanSub.toUpperCase(), subX, stripMidY, maxSubWidth);
  }

  const dataUrl = canvas.toDataURL("image/png");
  if (!dataUrl.startsWith("data:image/png;base64,")) return null;
  return { dataUrl, width, height };
}

/** Composes a framed Cloverhollow Postcard PNG and returns its data URL. */
export function composePostcard(
  sourceCanvas: HTMLCanvasElement,
  caption: string,
): string | null {
  return composePostcardFrame(sourceCanvas, caption)?.dataUrl ?? null;
}

/** Triggers a browser file download for a composed postcard data URL. */
export function triggerPostcardDownload(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
}

/** Decodes a PNG base64 data URL into a File for Web Share API delivery, or null if invalid. */
export function dataUrlToPngFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return null;
  const encoded = dataUrl.slice(PNG_DATA_URL_PREFIX.length).trim();
  if (encoded.length === 0) return null;
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    return null;
  }
  if (binary.length === 0) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: "image/png" });
}

function defaultShareApi(): PostcardShareApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  const api: PostcardShareApi = {};
  if (typeof navigator.canShare === "function") {
    api.canShare = (data) => navigator.canShare(data);
  }
  if (typeof navigator.share === "function") {
    api.share = (data) => navigator.share(data);
  }
  return api;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) return error.name === "AbortError";
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/** Delivers a postcard PNG via Web Share API on touch/iOS, falling back to browser download. */
export async function deliverPostcard(
  capture: Pick<PostcardCapture, "dataUrl" | "filename" | "caption">,
  options?: {
    preferShare?: boolean;
    shareApi?: PostcardShareApi;
    downloadFallback?: (dataUrl: string, filename: string) => void;
  },
): Promise<PostcardDeliveryResult> {
  const downloadFallback = options?.downloadFallback ?? triggerPostcardDownload;
  if (options?.preferShare === true) {
    const shareApi = options.shareApi ?? defaultShareApi();
    const file = dataUrlToPngFile(capture.dataUrl, capture.filename);
    if (file !== null && typeof shareApi?.share === "function") {
      try {
        const canShare =
          shareApi.canShare === undefined || shareApi.canShare({ files: [file] });
        if (canShare) {
          await shareApi.share({
            files: [file],
            title: capture.caption,
            text: "Postcard from Wilds of Cloverhollow",
          });
          return "shared";
        }
      } catch (error: unknown) {
        if (isAbortError(error)) return "cancelled";
      }
    }
  }
  downloadFallback(capture.dataUrl, capture.filename);
  return "downloaded";
}

/** Formats the short Photo Mode confirmation pill label after saving or sharing a postcard. */
export function postcardToastMessage(
  delivery: Exclude<PostcardDeliveryResult, "cancelled">,
  caption: string,
  weather?: CozyWeatherKind,
): string {
  const shortCaption = caption.replace(/\s*·\s*Wilds of Cloverhollow$/i, "").trim();
  const label = shortCaption.length > 0 ? shortCaption : caption.trim() || "Wilds of Cloverhollow";
  const verb = delivery === "shared" ? "shared" : "saved";
  const weatherLabel = postcardWeatherLabel(weather);
  return weatherLabel.length > 0
    ? `Postcard ${verb} · ${label} · ${weatherLabel}`
    : `Postcard ${verb} · ${label}`;
}

/** Gentle non-blocking confirmation pill shown after snapping a Photo Mode postcard. */
export function createPhotoToast(root: HTMLElement): {
  show: (text: string) => void;
  hide: () => void;
} {
  const node = element("div", "photo-toast", root);
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.hidden = true;
  let timer = 0;

  const hide = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    node.classList.remove("is-visible");
    node.hidden = true;
  };

  const show = (text: string): void => {
    window.clearTimeout(timer);
    node.textContent = text;
    node.hidden = false;
    node.classList.remove("is-visible");
    void node.offsetWidth;
    node.classList.add("is-visible");
    timer = window.setTimeout(hide, PHOTO_TOAST_DURATION_MS);
  };

  return { show, hide };
}

/** Crisp warm-cream shutter flash overlay used when snapping a Photo Mode postcard. */
export function createShutterFlash(root: HTMLElement): {
  trigger: () => void;
  hide: () => void;
  count: () => number;
} {
  const node = element("div", "photo-shutter-flash");
  node.setAttribute("aria-hidden", "true");
  node.dataset.shutterCount = "0";
  node.hidden = true;
  root.append(node);
  let timer = 0;
  let count = 0;

  const finish = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    node.classList.remove("is-flashing");
    node.hidden = true;
  };

  node.addEventListener("animationend", finish);

  return {
    trigger: () => {
      window.clearTimeout(timer);
      count += 1;
      node.dataset.shutterCount = String(count);
      node.hidden = false;
      node.classList.remove("is-flashing");
      // Force layout restart so rapid consecutive snaps re-trigger the flash.
      void node.offsetWidth;
      node.classList.add("is-flashing");
      timer = window.setTimeout(finish, 280);
    },
    hide: finish,
    count: () => count,
  };
}

/** Hand-inked inline SVG camera icon shared by touch Photo Mode controls (zero `<text>` nodes). */
export function cameraIcon(): SVGSVGElement {
  const icon = svgElement("svg", "photo-touch-camera-icon");
  icon.setAttribute("viewBox", "0 0 28 28");
  icon.setAttribute("aria-hidden", "true");
  const body = svgElement("path", "photo-camera-body", icon);
  body.setAttribute(
    "d",
    "M4.5 10.5 C4.5 9.2 5.6 8.2 6.9 8.2 H9.3 L10.7 6.1 C11.1 5.5 11.7 5.2 12.4 5.2 H15.6 " +
      "C16.3 5.2 16.9 5.5 17.3 6.1 L18.7 8.2 H21.1 C22.4 8.2 23.5 9.2 23.5 10.5 V19.6 " +
      "C23.5 20.9 22.4 22 21.1 22 H6.9 C5.6 22 4.5 20.9 4.5 19.6 Z",
  );
  const lens = svgElement("circle", "photo-camera-lens", icon);
  lens.setAttribute("cx", "14");
  lens.setAttribute("cy", "15");
  lens.setAttribute("r", "4.1");
  const glint = svgElement("circle", "photo-camera-glint", icon);
  glint.setAttribute("cx", "12.5");
  glint.setAttribute("cy", "13.5");
  glint.setAttribute("r", "1.1");
  const flash = svgElement("circle", "photo-camera-flash", icon);
  flash.setAttribute("cx", "19.8");
  flash.setAttribute("cy", "11.2");
  flash.setAttribute("r", "1.15");
  return icon;
}

/** Hand-inked inline SVG sky cycler icon shared by Photo Mode touch controls (zero `<text>`). */
export function weatherSkyIcon(): SVGSVGElement {
  const icon = svgElement("svg", "photo-touch-sky-icon");
  icon.setAttribute("viewBox", "0 0 28 28");
  icon.setAttribute("aria-hidden", "true");
  const sun = svgElement("circle", "photo-sky-sun", icon);
  sun.setAttribute("cx", "18.2");
  sun.setAttribute("cy", "10.2");
  sun.setAttribute("r", "4.4");
  const rays = svgElement("path", "photo-sky-rays", icon);
  rays.setAttribute("d", "M18.2 3.4 V4.9 M23.4 5.4 L22.3 6.5 M24.8 10.2 H23.3");
  const cloud = svgElement("path", "photo-sky-cloud", icon);
  cloud.setAttribute(
    "d",
    "M7.6 21.4 H19.2 C21.3 21.4 22.9 19.8 22.9 17.8 C22.9 15.9 21.5 14.4 19.6 14.2 " +
      "C19.1 11.7 16.9 9.9 14.2 9.9 C11.3 9.9 8.9 12.1 8.7 14.9 " +
      "C6.6 15.2 5.1 16.9 5.1 18.9 C5.1 20.3 6.2 21.4 7.6 21.4 Z",
  );
  const sparkle = svgElement("path", "photo-sky-sparkle", icon);
  sparkle.setAttribute(
    "d",
    "M6.8 6.2 L7.6 8.1 L9.5 8.9 L7.6 9.7 L6.8 11.6 L6 9.7 L4.1 8.9 L6 8.1 Z",
  );
  return icon;
}

/**
 * Touch-only Photo Mode camera bar (Milestones 118 & 218): warm cream die-cut
 * circular Cycle Sky + Snap Postcard + Exit buttons shown strictly when both
 * data-touch="on" and data-photo="on" are set on :root, completely excluded
 * from Pixi WebGL capture.
 */
export function createPhotoTouchBar(
  root: HTMLElement,
  handlers: { onSnap: () => void; onClose: () => void; onCycleWeather?: () => void },
): {
  element: HTMLDivElement;
  onCycleWeather: (handler: () => void) => void;
  setCanWeather: (can: boolean) => void;
} {
  const bar = element("div", "photo-touch-bar", root);
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Photo mode controls");

  let cycleWeatherHandler: () => void = handlers.onCycleWeather ?? (() => undefined);
  const weather = element("button", "photo-touch-btn photo-touch-weather", bar);
  weather.type = "button";
  weather.setAttribute("aria-label", "Cycle Cozy Weather");
  weather.title = "Cycle sky";
  weather.append(weatherSkyIcon());
  weather.addEventListener("click", () => cycleWeatherHandler());

  const snap = element("button", "photo-touch-btn photo-touch-snap", bar);
  snap.type = "button";
  snap.setAttribute("aria-label", "Snap postcard");
  snap.append(cameraIcon());
  snap.addEventListener("click", () => handlers.onSnap());

  const close = element("button", "photo-touch-btn photo-touch-close", bar);
  close.type = "button";
  close.setAttribute("aria-label", "Exit photo mode");
  close.textContent = "×";
  close.addEventListener("click", () => handlers.onClose());

  return {
    element: bar,
    onCycleWeather: (handler) => {
      cycleWeatherHandler = handler;
    },
    setCanWeather: (can) => {
      weather.hidden = !can;
    },
  };
}
