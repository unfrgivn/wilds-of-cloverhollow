import type { Box } from "./dom";
import type { HudInputMode } from "./hud-hints";
import type { TacoCalibration, TacoTopping, TacoView } from "../core";

export type TacoBowlLayout = {
  topping: TacoTopping;
  label: string;
  arrow: string;
  box: Box;
};

export type TacoLayerLayout = {
  frame: TacoTopping | "lime";
  box: Box;
  zIndex: number;
};

export type TacoLayout = {
  scale: number;
  width: number;
  height: number;
  radius: number;
  servingWindow: Box;
  placemat: Box;
  ticket: Box;
  hud: Box;
  escape: Box;
  orderBanner: Box;
  shell: Box;
  layers: TacoLayerLayout[];
  bowls: TacoBowlLayout[];
  front: Box;
};

const box = (x: number, y: number, width: number, height: number): Box => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
});

const BOWL_SPECS: readonly {
  topping: TacoTopping;
  arrow: string;
  padArrow: string;
  x: number;
  y: number;
  w: number;
  h: number;
}[] = [
  { topping: "beans", arrow: "↑", padArrow: "▲", x: 76, y: 504, w: 244, h: 192 },
  { topping: "cheese", arrow: "→", padArrow: "▶", x: 1280, y: 504, w: 244, h: 192 },
  { topping: "salsa", arrow: "↓", padArrow: "▼", x: 1234, y: 724, w: 244, h: 192 },
  { topping: "avocado", arrow: "←", padArrow: "◀", x: 122, y: 724, w: 244, h: 192 },
];

export function layoutTaco(
  view: TacoView,
  calibration: TacoCalibration,
  scale: number,
  inputMode: HudInputMode = "keyboard",
): TacoLayout {
  const { size, servingWindow, placemat, front } = calibration;

  // During shift result, lift the celebratory taco into the clear serving
  // window above the bottom dialogue box so nothing clips the shell.
  const isResult = view.phase === "result";
  const shellW = isResult ? 316 : 368;
  const shellH = isResult ? 290 : 334;
  const shellX = Math.round((size.w - shellW) / 2);
  const shellY = isResult ? 520 : 590;

  const currentRecipe = view.currentOrder?.recipe ?? [];
  const stackedCount = isResult && view.served > 0
    ? currentRecipe.length
    : Math.min(view.stepIndex, currentRecipe.length);
  const layers: TacoLayerLayout[] = [];
  const layerSize = isResult ? 132 : 148;
  const troughCenterX = size.w / 2 - 4;
  const troughCenterY = isResult ? 644 : 736;

  // Distribute fillings snugly along the taco shell's diagonal open crease
  // (bottom-left to top-right) so 3-, 4-, and 5-topping orders look stuffed
  // inside the shell instead of towering upward.
  for (let index = 0; index < stackedCount; index += 1) {
    const topping = currentRecipe[index];
    if (topping === undefined) continue;
    const t = stackedCount <= 1 ? 0.5 : index / (stackedCount - 1);
    const cx = troughCenterX + (t - 0.5) * (isResult ? 96 : 114);
    const cy = troughCenterY + (0.5 - t) * (isResult ? 34 : 42) - (index % 2) * 14;
    layers.push({
      frame: topping,
      box: box(
        (cx - layerSize / 2) * scale,
        (cy - layerSize / 2) * scale,
        layerSize * scale,
        layerSize * scale,
      ),
      zIndex: 4 + index,
    });
  }
  if (view.phase === "order-clear" || (isResult && view.served > 0)) {
    const limeSize = isResult ? 116 : 128;
    const limeCx = troughCenterX + 14;
    const limeCy = troughCenterY - (isResult ? 66 : 78);
    layers.push({
      frame: "lime",
      box: box(
        (limeCx - limeSize / 2) * scale,
        (limeCy - limeSize / 2) * scale,
        limeSize * scale,
        limeSize * scale,
      ),
      zIndex: 12,
    });
  }

  const bowls: TacoBowlLayout[] = BOWL_SPECS.map((spec) => ({
    topping: spec.topping,
    label: view.toppings[spec.topping],
    arrow: inputMode === "gamepad" ? spec.padArrow : spec.arrow,
    box: box(spec.x * scale, spec.y * scale, spec.w * scale, spec.h * scale),
  }));

  const bannerY = isResult ? 436 : 448;
  const bannerH = isResult ? 76 : 82;

  return {
    scale,
    width: Math.round(size.w * scale),
    height: Math.round(size.h * scale),
    radius: Math.round(24 * scale),
    servingWindow: box(
      servingWindow.x * scale,
      servingWindow.y * scale,
      servingWindow.w * scale,
      servingWindow.h * scale,
    ),
    placemat: box(
      placemat.x * scale,
      placemat.y * scale,
      placemat.w * scale,
      placemat.h * scale,
    ),
    // Clipped directly onto the shutter rail at y=232.
    ticket: box(248 * scale, 232 * scale, 660 * scale, 198 * scale),
    hud: box(936 * scale, 236 * scale, 424 * scale, 112 * scale),
    escape: box(1038 * scale, 362 * scale, 322 * scale, 68 * scale),
    orderBanner: box(540 * scale, bannerY * scale, 520 * scale, bannerH * scale),
    shell: box(shellX * scale, shellY * scale, shellW * scale, shellH * scale),
    layers,
    bowls,
    front: box(front.x * scale, front.y * scale, front.w * scale, front.h * scale),
  };
}
