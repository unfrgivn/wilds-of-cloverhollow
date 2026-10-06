// One frame of a sprite atlas, cropped into any box with CSS backgrounds.

export type AtlasFrame = { x: number; y: number; w: number; h: number };

export type AtlasImage = {
  src: string;
  frame: AtlasFrame;
  atlas: { w: number; h: number };
};

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
