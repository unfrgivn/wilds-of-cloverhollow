import "./npc-chatter.css";
import { element, setAttribute, setStyle, setText, svgElement } from "./dom";
import type { Insets } from "./sticker";

export type NpcChatterTone =
  | "normal"
  | "lantern"
  | "worry"
  | "warm"
  | "banter"
  | "music";

export type NpcChatterView = {
  visible: boolean;
  npcId: string;
  speakerName: string;
  text: string;
  tone: NpcChatterTone;
  x: number;
  y: number;
  alpha: number;
};

export type NpcChatterPlacement = "top" | "left" | "right";

const EDGE_MARGIN_X = 12;
const EDGE_MARGIN_TOP = 12;
const EDGE_MARGIN_BOTTOM = 18;
const TAIL_CORNER_INSET = 20;
const TOP_HEADROOM = 6;
const SIDE_GAP = 34;
const SIDE_HEAD_OFFSET_Y = 28;

export function clampChatterPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  insets: Insets,
): { x: number; y: number; tailOffset: number; placement: NpcChatterPlacement } {
  const halfW = width / 2;
  const leftLimit = insets.left + EDGE_MARGIN_X;
  const rightLimit = viewportWidth - insets.right - EDGE_MARGIN_X;
  const minX = leftLimit + halfW;
  const maxX = rightLimit - halfW;
  const minY = insets.top + EDGE_MARGIN_TOP + height;
  const maxY = viewportHeight - insets.bottom - EDGE_MARGIN_BOTTOM;

  if (y < minY + TOP_HEADROOM) {
    const rightCenter = Math.max(minX, x + SIDE_GAP + halfW);
    const leftCenter = Math.min(maxX, x - SIDE_GAP - halfW);
    const fitsRight = rightCenter + halfW <= rightLimit;
    const fitsLeft = leftCenter - halfW >= leftLimit;
    if (fitsRight || fitsLeft) {
      const placement: NpcChatterPlacement = fitsRight ? "right" : "left";
      const sideX = fitsRight ? rightCenter : leftCenter;
      const halfH = height / 2;
      const sideMinY = insets.top + EDGE_MARGIN_TOP + halfH;
      const sideMaxY = viewportHeight - insets.bottom - EDGE_MARGIN_BOTTOM - halfH;
      const sideY = sideMinY > sideMaxY
        ? sideMaxY
        : Math.min(sideMaxY, Math.max(sideMinY, y + SIDE_HEAD_OFFSET_Y));
      return { x: sideX, y: sideY, tailOffset: 0, placement };
    }
  }

  const clampedX = minX > maxX
    ? (minX + maxX) / 2
    : Math.min(maxX, Math.max(minX, x));
  const clampedY = minY > maxY
    ? maxY
    : Math.min(maxY, Math.max(minY, y));

  const maxTail = Math.max(0, halfW - TAIL_CORNER_INSET);
  const tailOffset = Math.min(maxTail, Math.max(-maxTail, x - clampedX));
  return { x: clampedX, y: clampedY, tailOffset, placement: "top" };
}

function buildToneIcon(): {
  svg: SVGSVGElement;
  setTone: (tone: NpcChatterTone) => void;
} {
  const svg = svgElement("svg", "npc-chatter-icon");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");

  const lantern = svgElement("g", "npc-chatter-icon-group", svg);
  const star = svgElement("path", "npc-chatter-icon-star", lantern);
  star.setAttribute(
    "d",
    "M 6 1 L 7.4 4.6 L 11 6 L 7.4 7.4 L 6 11 L 4.6 7.4 L 1 6 L 4.6 4.6 Z",
  );

  const warm = svgElement("g", "npc-chatter-icon-group", svg);
  const heart = svgElement("path", "npc-chatter-icon-heart", warm);
  heart.setAttribute(
    "d",
    "M 6 10.4 C 2.2 7.8 1.2 4.8 3.2 2.8 C 4.5 1.6 5.6 2.6 6 3.7 " +
      "C 6.4 2.6 7.5 1.6 8.8 2.8 C 10.8 4.8 9.8 7.8 6 10.4 Z",
  );

  const worry = svgElement("g", "npc-chatter-icon-group", svg);
  const swirl = svgElement("path", "npc-chatter-icon-worry", worry);
  swirl.setAttribute(
    "d",
    "M 6.2 6.2 C 6.2 5.1 7.6 5.1 7.6 6.3 C 7.6 8 4.6 8.2 4.4 6 " +
      "C 4.2 3.4 8.8 2.8 9.4 5.8 C 9.9 8.6 5.8 10.5 3.1 8.8",
  );

  const banter = svgElement("g", "npc-chatter-icon-group", svg);
  const backBubble = svgElement("path", "npc-chatter-icon-banter-back", banter);
  backBubble.setAttribute(
    "d",
    "M 5.4 2.2 H 9.2 C 10.2 2.2 10.8 2.9 10.8 3.9 V 6 C 10.8 7 10.2 7.6 9.2 7.6 " +
      "H 8.4 L 9.1 9.2 L 7 7.6 H 5.4 C 4.4 7.6 3.8 7 3.8 6 V 3.9 C 3.8 2.9 4.4 2.2 5.4 2.2 Z",
  );
  const frontBubble = svgElement("path", "npc-chatter-icon-banter-front", banter);
  frontBubble.setAttribute(
    "d",
    "M 2.6 4.2 H 6.6 C 7.5 4.2 8.1 4.8 8.1 5.8 V 7.5 C 8.1 8.4 7.5 9 6.6 9 " +
      "H 5 L 3.1 10.4 L 3.6 9 H 2.6 C 1.7 9 1.2 8.4 1.2 7.5 V 5.8 C 1.2 4.8 1.7 4.2 2.6 4.2 Z",
  );

  const music = svgElement("g", "npc-chatter-icon-group", svg);
  const noteHead = svgElement("ellipse", "npc-chatter-icon-note-head", music);
  noteHead.setAttribute("cx", "4.3");
  noteHead.setAttribute("cy", "8.6");
  noteHead.setAttribute("rx", "2.1");
  noteHead.setAttribute("ry", "1.55");
  noteHead.setAttribute("transform", "rotate(-20 4.3 8.6)");
  const noteStem = svgElement("path", "npc-chatter-icon-note-stem", music);
  noteStem.setAttribute("d", "M 6.1 8.1 V 2.4 C 8.3 2.7 9.9 4.2 9.4 6.2");

  const normal = svgElement("g", "npc-chatter-icon-group", svg);
  const leaves: readonly [number, number][] = [
    [6, 3.6],
    [3.8, 6.2],
    [8.2, 6.2],
    [6, 8.2],
  ];
  for (const [cx, cy] of leaves) {
    const petal = svgElement("circle", "npc-chatter-icon-clover", normal);
    petal.setAttribute("cx", String(cx));
    petal.setAttribute("cy", String(cy));
    petal.setAttribute("r", "2.1");
  }

  const groups: Record<NpcChatterTone, SVGGElement> = {
    lantern,
    warm,
    worry,
    banter,
    music,
    normal,
  };

  let activeTone: NpcChatterTone | null = null;
  const setTone = (tone: NpcChatterTone): void => {
    if (tone === activeTone) return;
    activeTone = tone;
    for (const [key, group] of Object.entries(groups)) {
      if (key === tone) group.removeAttribute("hidden");
      else group.setAttribute("hidden", "");
    }
  };
  setTone("normal");
  return { svg, setTone };
}

function buildTail(): SVGSVGElement {
  const svg = svgElement("svg", "npc-chatter-tail");
  svg.setAttribute("viewBox", "0 0 14 10");
  svg.setAttribute("aria-hidden", "true");
  const rim = svgElement("path", "npc-chatter-tail-rim", svg);
  rim.setAttribute("d", "M 2 1 C 4.2 5.4, 5.6 8.2, 7.2 9.2 C 8.4 6.2, 10 3.6, 12 1 Z");
  const fill = svgElement("path", "npc-chatter-tail-fill", svg);
  fill.setAttribute("d", "M 2.2 0.8 C 4.2 5.2, 5.6 7.8, 7.2 8.8 C 8.4 6, 10 3.4, 11.8 0.8");
  const cover = svgElement("rect", "npc-chatter-tail-cover", svg);
  cover.setAttribute("x", "1");
  cover.setAttribute("y", "-2.4");
  cover.setAttribute("width", "12");
  cover.setAttribute("height", "3.8");
  return svg;
}

export function createNpcChatter(root: HTMLElement): {
  render: (view: NpcChatterView | null) => void;
} {
  const bubble = element("aside", "sticker-ui npc-chatter", root);
  bubble.setAttribute("aria-live", "off");
  bubble.hidden = true;

  const header = element("div", "npc-chatter-header", bubble);
  const icon = buildToneIcon();
  header.append(icon.svg);
  const speaker = element("span", "npc-chatter-speaker", header);
  const text = element("div", "npc-chatter-text", bubble);
  bubble.append(buildTail());

  const probe = element("div", "", root);
  probe.style.cssText =
    "position:fixed;inset:0;visibility:hidden;pointer-events:none;" +
    "padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);";
  const currentInsets = (): Insets => {
    const style = getComputedStyle(probe);
    const parse = (value: string): number => Number.parseFloat(value) || 0;
    return {
      top: parse(style.paddingTop),
      right: parse(style.paddingRight),
      bottom: parse(style.paddingBottom),
      left: parse(style.paddingLeft),
    };
  };

  let lastKey = "";
  let lastView: NpcChatterView | null = null;

  const apply = (view: NpcChatterView | null): void => {
    const shown =
      view !== null &&
      view.visible &&
      view.text !== "" &&
      view.alpha > 0.01;
    bubble.hidden = !shown;
    if (!shown) return;
    setAttribute(bubble, "data-tone", view.tone);
    setAttribute(bubble, "data-npc", view.npcId);
    icon.setTone(view.tone);
    setText(speaker, view.speakerName);
    setText(text, view.text);
    // Measure unconstrained at origin so right-edge coordinates never squeeze wrapping.
    setStyle(bubble, "left", "0px");
    setStyle(bubble, "top", "0px");
    const insets = currentInsets();
    const pos = clampChatterPosition(
      view.x,
      view.y,
      bubble.offsetWidth,
      bubble.offsetHeight,
      window.innerWidth,
      window.innerHeight,
      insets,
    );
    setAttribute(bubble, "data-side", pos.placement);
    setStyle(bubble, "left", `${pos.x.toFixed(1)}px`);
    setStyle(bubble, "top", `${pos.y.toFixed(1)}px`);
    setStyle(bubble, "--tail-offset", `${pos.tailOffset.toFixed(1)}px`);
    setStyle(bubble, "opacity", Math.max(0, Math.min(1, view.alpha)).toFixed(3));
  };

  const invalidate = (): void => {
    lastKey = "";
    if (lastView !== null && lastView.visible) apply(lastView);
  };
  window.addEventListener("resize", invalidate);
  document.fonts?.addEventListener("loadingdone", invalidate);

  return {
    render: (view) => {
      lastView = view;
      const shown =
        view !== null &&
        view.visible &&
        view.text !== "" &&
        view.alpha > 0.01;
      const key = shown
        ? `1|${view.npcId}|${view.speakerName}|${view.text}|${view.tone}|` +
          `${Math.round(view.x * 2)}|${Math.round(view.y * 2)}|` +
          `${Math.round(view.alpha * 1000)}|${window.innerWidth}x${window.innerHeight}`
        : "0";
      if (key === lastKey) return;
      lastKey = key;
      apply(view);
    },
  };
}
