// One frame of a sprite atlas, cropped into any box with CSS backgrounds.

export type AtlasFrame = { x: number; y: number; w: number; h: number };

export type AtlasImage = {
  src: string;
  frame: AtlasFrame;
  atlas: { w: number; h: number };
};

export type AtlasJson = {
  frames: Record<string, { frame: AtlasFrame }>;
  meta: { size?: { w: number; h: number }; image?: string };
};

export function atlasImagePath(atlasJsonPath: string, sheet?: AtlasJson): string {
  const image = sheet?.meta.image;
  if (typeof image === "string" && image.length > 0) {
    const slash = atlasJsonPath.lastIndexOf("/");
    return slash >= 0 ? `${atlasJsonPath.slice(0, slash + 1)}${image}` : image;
  }
  return atlasJsonPath.replace(/\.json$/, ".png");
}

export function parseAtlasJson(value: unknown, file: string): AtlasJson {
  if (typeof value !== "object" || value === null || !("frames" in value) || !("meta" in value))
    throw new Error(`Invalid atlas JSON: ${file}`);
  const framesRaw = value.frames;
  const metaRaw = value.meta;
  if (typeof framesRaw !== "object" || framesRaw === null ||
      typeof metaRaw !== "object" || metaRaw === null)
    throw new Error(`Invalid atlas JSON: ${file}`);
  const frames: Record<string, { frame: AtlasFrame }> = {};
  for (const [name, entry] of Object.entries(framesRaw)) {
    if (typeof entry !== "object" || entry === null || !("frame" in entry)) continue;
    const rect = entry.frame;
    if (typeof rect !== "object" || rect === null) continue;
    if ("x" in rect && "y" in rect && "w" in rect && "h" in rect &&
        typeof rect.x === "number" && typeof rect.y === "number" &&
        typeof rect.w === "number" && typeof rect.h === "number")
      frames[name] = { frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } };
  }
  let size: { w: number; h: number } | undefined;
  if ("size" in metaRaw && typeof metaRaw.size === "object" && metaRaw.size !== null &&
      "w" in metaRaw.size && "h" in metaRaw.size &&
      typeof metaRaw.size.w === "number" && typeof metaRaw.size.h === "number")
    size = { w: metaRaw.size.w, h: metaRaw.size.h };
  const image = "image" in metaRaw && typeof metaRaw.image === "string" && metaRaw.image.length > 0
    ? metaRaw.image
    : undefined;
  return { frames, meta: { size, ...(image === undefined ? {} : { image }) } };
}

export function atlasImage(sheet: AtlasJson, src: string, frameName: string): AtlasImage {
  const frame = sheet.frames[frameName]?.frame;
  if (frame === undefined) throw new Error(`Unknown atlas frame: ${frameName}`);
  const size = sheet.meta.size;
  if (size === undefined) throw new Error("Atlas is missing its size");
  return { src, frame, atlas: size };
}

/*
 * Percentages keep the crop exact at any box size, as long as the box has the
 * frame's aspect ratio. background-position p% lines up the image's p% point
 * with the box's, so the offset that shows frame.x is
 * p = frame.x / (atlas.w - frame.w).
 */
export function atlasCrop(image: AtlasImage): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  aspectRatio: string;
} {
  const { frame, atlas } = image;
  const position = (offset: number, frameSize: number, atlasSize: number): string =>
    atlasSize === frameSize ? "0%" : `${(offset / (atlasSize - frameSize)) * 100}%`;
  return {
    backgroundImage: `url("${image.src}")`,
    backgroundSize: `${(atlas.w / frame.w) * 100}% ${(atlas.h / frame.h) * 100}%`,
    backgroundPosition: `${position(frame.x, frame.w, atlas.w)} ` +
      position(frame.y, frame.h, atlas.h),
    aspectRatio: `${frame.w} / ${frame.h}`,
  };
}

export function applyAtlasCrop(element: HTMLElement, image: AtlasImage): void {
  const crop = atlasCrop(image);
  element.style.backgroundImage = crop.backgroundImage;
  element.style.backgroundSize = crop.backgroundSize;
  element.style.backgroundPosition = crop.backgroundPosition;
  element.style.aspectRatio = crop.aspectRatio;
}
