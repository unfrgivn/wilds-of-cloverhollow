import "./fish.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, measure, pixels, place, setStyle, setText, type Box } from "./dom";
import { layoutFish, type FishLayout } from "./fish-layout";
import type { FishCalibration, FishPhase, FishView } from "../core";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  parent: SVGElement,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.appendChild(node);
  return node;
}

export type FishInfo = {
  game: "fish";
  phase: FishPhase;
  stage: Box;
  water: Box;
  bobber: { x: number; y: number; visible: boolean };
  power: number;
  reelProgress: number;
  inZone: boolean;
  caught: string | null;
  catchCard: Box | null;
  caughtSpecies: number;
  totalSpecies: number;
  front: string;
};

// Bubblegum Bay fishing dock close-up (spec 8.2): painted dock vista with live
// SVG fishing rod, arching Bezier line, cork bobber, water ripples, fish shadow,
// Catch Book species header, Cast Power Gauge, Reel-In Meter, and Catch Card.
export function createFish(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: FishCalibration,
  image: string,
): { render: (view: FishView | null) => void; info: () => FishInfo | null } {
  const overlay = element("section", "fish-overlay", root);
  overlay.setAttribute("aria-label", "Bubblegum Bay fishing dock");
  overlay.hidden = true;

  const stage = element("div", "fish-stage", overlay);
  stage.style.backgroundImage = `url("${image}")`;

  // Live SVG fishing rig in image coordinates (1600 x 1048).
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("fish-svg");
  svg.setAttribute("viewBox", `0 0 ${calibration.size.w} ${calibration.size.h}`);
  svg.setAttribute("aria-hidden", "true");
  stage.appendChild(svg);

  // Subtle dark-teal watercolor fish shadow beneath the water surface.
  const shadowGroup = svgElement("g", svg);
  svgElement("ellipse", shadowGroup, {
    cx: "0", cy: "0", rx: "30", ry: "11", fill: "#286675",
  });
  svgElement("path", shadowGroup, {
    d: "M -24 0 L -42 -11 L -38 0 L -42 11 Z", fill: "#286675",
  });

  // Expanding concentric cream ripple rings.
  const rippleGroup = svgElement("g", svg);
  const rippleNodes: SVGEllipseElement[] = [
    svgElement("ellipse", rippleGroup, {
      fill: "none", stroke: "#fffdf2", "stroke-width": "4.5",
    }),
    svgElement("ellipse", rippleGroup, {
      fill: "none", stroke: "#fffdf2", "stroke-width": "3.5",
    }),
    svgElement("ellipse", rippleGroup, {
      fill: "none", stroke: "#fffdf2", "stroke-width": "3",
    }),
  ];

  // Hand-crafted wooden fishing rod with cork grip, brass reel, and guide rings.
  const rodGroup = svgElement("g", svg);
  const rodOutline = svgElement("path", rodGroup, {
    fill: "none", stroke: "#5c3d2e", "stroke-width": "21", "stroke-linecap": "round",
  });
  const rodWood = svgElement("path", rodGroup, {
    fill: "none", stroke: "#d9924c", "stroke-width": "13", "stroke-linecap": "round",
  });
  const rodHighlight = svgElement("path", rodGroup, {
    fill: "none", stroke: "#f8d49a", "stroke-width": "4", "stroke-linecap": "round",
  });
  const rodGrip = svgElement("path", rodGroup, {
    fill: "none", stroke: "#7a4e32", "stroke-width": "24", "stroke-linecap": "round",
  });
  const rodGripHi = svgElement("path", rodGroup, {
    fill: "none", stroke: "#b97a49", "stroke-width": "14", "stroke-linecap": "round",
  });
  const rodReel = svgElement("g", rodGroup);
  svgElement("circle", rodReel, {
    cx: "0", cy: "0", r: "18", fill: "#f2c357", stroke: "#5c3d2e", "stroke-width": "4",
  });
  svgElement("circle", rodReel, {
    cx: "0", cy: "0", r: "7", fill: "#fff4d4", stroke: "#5c3d2e", "stroke-width": "3",
  });
  svgElement("line", rodReel, {
    x1: "0", y1: "0", x2: "19", y2: "13", stroke: "#5c3d2e", "stroke-width": "4.5",
    "stroke-linecap": "round",
  });
  svgElement("circle", rodReel, {
    cx: "20", cy: "14", r: "4.5", fill: "#7a4e32", stroke: "#5c3d2e", "stroke-width": "2.5",
  });
  const rodRing = svgElement("circle", rodGroup, {
    r: "6", fill: "none", stroke: "#f7cf65", "stroke-width": "3.5",
  });
  const rodEyelet = svgElement("circle", rodGroup, {
    r: "7", fill: "#f7cf65", stroke: "#5c3d2e", "stroke-width": "3.5",
  });

  // Live quadratic Bezier fishing line.
  const lineShadow = svgElement("path", svg, {
    fill: "none", stroke: "#5c3d2e", "stroke-width": "4.5", "stroke-linecap": "round",
    opacity: "0.7",
  });
  const lineGlow = svgElement("path", svg, {
    fill: "none", stroke: "#fff8eb", "stroke-width": "2", "stroke-linecap": "round",
    opacity: "0.85",
  });

  // Crisp hand-crafted SVG red-and-cream cork bobber + bite splash droplets.
  const bobberGroup = svgElement("g", svg);
  const splashGroup = svgElement("g", bobberGroup);
  svgElement("path", splashGroup, {
    d: "M -28 -6 Q -42 -28 -52 -16 M 28 -6 Q 42 -28 52 -16 M 0 -22 Q 4 -44 12 -34",
    fill: "none", stroke: "#fffdf5", "stroke-width": "5", "stroke-linecap": "round",
  });
  svgElement("circle", splashGroup, { cx: "-46", cy: "-30", r: "5", fill: "#fffdf5" });
  svgElement("circle", splashGroup, { cx: "46", cy: "-28", r: "5", fill: "#fffdf5" });
  svgElement("circle", splashGroup, { cx: "16", cy: "-42", r: "4", fill: "#fffdf5" });
  svgElement("circle", bobberGroup, {
    cx: "0", cy: "-21", r: "5", fill: "#f7cf65", stroke: "#5c3d2e", "stroke-width": "3",
  });
  svgElement("path", bobberGroup, {
    d: "M -20 0 A 20 20 0 0 1 20 0 Z", fill: "#e85a50", stroke: "#5c3d2e", "stroke-width": "4",
  });
  svgElement("path", bobberGroup, {
    d: "M -20 0 A 20 20 0 0 0 20 0 Z", fill: "#fff6df", stroke: "#5c3d2e", "stroke-width": "4",
  });
  svgElement("ellipse", bobberGroup, {
    cx: "-7", cy: "-9", rx: "5.5", ry: "3", fill: "#ffffff", opacity: "0.85",
  });

  // Top-left Bubblegum Bay Catch Book pill.
  const book = element("div", "fish-book", stage);
  const bookMeta = element("div", "fish-book-meta", book);
  const bookTitle = element("span", "fish-book-title", bookMeta);
  setText(bookTitle, "CATCH BOOK");
  const bookCount = element("span", "fish-book-count", bookMeta);
  const bookSlots = element("div", "fish-book-slots", book);
  const slotNodes: { wrap: HTMLDivElement; sprite: HTMLDivElement; frame: string }[] = [];

  // Top-right escape pill.
  const escape = element("div", "fish-escape", stage);
  const escapeText = element("span", "fish-escape-text", escape);
  setText(escapeText, "Esc · Pack up");

  // Left Cast Power Gauge (aim phase).
  const powerGauge = element("div", "fish-power", stage);
  const powerRare = element("span", "fish-power-label is-rare", powerGauge);
  setText(powerRare, "RARE");
  const powerTrack = element("div", "fish-power-track", powerGauge);
  element("div", "fish-power-rare-line", powerTrack);
  const powerPointer = element("div", "fish-power-pointer", powerTrack);
  const powerFoot = element("span", "fish-power-label", powerGauge);
  setText(powerFoot, "CAST");

  // Right Watercolor Reel-In Meter (reeling phase).
  const reelMeter = element("div", "fish-reel", stage);
  const reelTitle = element("span", "fish-reel-title", reelMeter);
  setText(reelTitle, "REEL!");
  const reelBody = element("div", "fish-reel-body", reelMeter);
  const reelColumn = element("div", "fish-reel-column", reelBody);
  const reelZone = element("div", "fish-reel-zone", reelColumn);
  const zoneBobber = element("span", "fish-reel-bobber", reelZone);
  zoneBobber.setAttribute("aria-hidden", "true");
  const reelFish = element("div", "fish-reel-fish", reelColumn);
  const fishIcon = document.createElementNS(SVG_NS, "svg");
  fishIcon.setAttribute("viewBox", "0 0 40 40");
  svgElement("path", fishIcon, {
    d: "M 13 20 L 3 10 L 6 20 L 3 30 Z",
    fill: "#e85a50", stroke: "#3d281c", "stroke-width": "2.8", "stroke-linejoin": "round",
  });
  svgElement("ellipse", fishIcon, {
    cx: "23", cy: "20", rx: "13", ry: "9.5",
    fill: "#f06855", stroke: "#3d281c", "stroke-width": "2.8",
  });
  svgElement("ellipse", fishIcon, {
    cx: "24", cy: "23", rx: "8", ry: "4", fill: "#fff5dc", opacity: "0.85",
  });
  svgElement("circle", fishIcon, { cx: "29", cy: "17.5", r: "2.6", fill: "#2d1a12" });
  svgElement("circle", fishIcon, { cx: "29.9", cy: "16.6", r: "1", fill: "#ffffff" });
  reelFish.appendChild(fishIcon);
  const reelProgressCol = element("div", "fish-reel-progress-col", reelBody);
  const reelStar = element("span", "fish-reel-star", reelProgressCol);
  setText(reelStar, "★");
  const reelProgressTrack = element("div", "fish-reel-progress-track", reelProgressCol);
  const reelProgressFill = element("div", "fish-reel-progress-fill", reelProgressTrack);

  // ! BITE ! pop sticker.
  const biteBadge = element("div", "fish-bite-badge", stage);
  const biteText = element("span", "fish-bite-text", biteBadge);
  setText(biteText, "! BITE !");

  // Watercolor Catch Reveal Medallion (result phase, when caught).
  const catchCard = element("div", "fish-catch-card", stage);
  const catchMedallion = element("div", "fish-catch-medallion", catchCard);
  const catchSprite = element("div", "fish-catch-sprite", catchMedallion);
  const catchInfo = element("div", "fish-catch-info", catchCard);
  const catchNew = element("span", "fish-catch-new", catchInfo);
  setText(catchNew, "NEW CATCH!");
  const catchName = element("div", "fish-catch-name", catchInfo);
  const catchPills = element("div", "fish-catch-pills", catchInfo);
  const catchRarity = element("span", "fish-pill", catchPills);
  const catchCoins = element("span", "fish-pill is-reward", catchPills);
  const catchSnacks = element("span", "fish-pill is-reward", catchPills);

  // Bottom wooden dock caption bar.
  const front = element("div", "fish-front", stage);
  const frontPill = element("div", "fish-front-pill", front);
  const frontText = element("span", "fish-front-text", frontPill);

  let lastKey = "";
  let lastFrontKey = "";
  let lastCatchFrame = "";
  let lastView: FishView | null = null;
  let lastLayout: FishLayout | null = null;

  const draw = (view: FishView, layout: FishLayout): void => {
    place(stage, { x: 0, y: 0, width: layout.width, height: layout.height });
    setStyle(stage, "border-radius", `${layout.radius}px`);
    stage.dataset.scale = String(layout.scale);
    stage.dataset.phase = view.phase;

    // SVG wooden fishing rod, arching Bezier line, shadow, ripples, and bobber.
    const rodVisible = view.phase !== "result";
    rodGroup.style.display = rodVisible ? "" : "none";
    if (rodVisible) {
      const flex = view.phase === "bite"
        ? 54
        : view.phase === "reeling"
          ? (view.holding ? 62 : 42)
          : view.phase === "casting"
            ? 34
            : 18;
      const midX = layout.rodBase.x * 0.44 + layout.rodTip.x * 0.56;
      const midY = layout.rodBase.y * 0.44 + layout.rodTip.y * 0.56 - flex;
      const rodPath = `M ${layout.rodBase.x.toFixed(1)} ${layout.rodBase.y.toFixed(1)} ` +
        `Q ${midX.toFixed(1)} ${midY.toFixed(1)} ` +
        `${layout.rodTip.x.toFixed(1)} ${layout.rodTip.y.toFixed(1)}`;
      rodOutline.setAttribute("d", rodPath);
      rodWood.setAttribute("d", rodPath);
      rodHighlight.setAttribute("d", rodPath);
      const gripEndX = layout.rodBase.x * 0.72 + midX * 0.28;
      const gripEndY = layout.rodBase.y * 0.72 + midY * 0.28;
      const gripPath = `M ${layout.rodBase.x.toFixed(1)} ${layout.rodBase.y.toFixed(1)} ` +
        `L ${gripEndX.toFixed(1)} ${gripEndY.toFixed(1)}`;
      rodGrip.setAttribute("d", gripPath);
      rodGripHi.setAttribute("d", gripPath);
      const reelX = gripEndX - 10;
      const reelY = gripEndY + 14;
      rodReel.setAttribute("transform", `translate(${reelX.toFixed(1)} ${reelY.toFixed(1)})`);
      const ringX = 0.25 * layout.rodBase.x + 0.5 * midX + 0.25 * layout.rodTip.x;
      const ringY = 0.25 * layout.rodBase.y + 0.5 * midY + 0.25 * layout.rodTip.y;
      rodRing.setAttribute("cx", ringX.toFixed(1));
      rodRing.setAttribute("cy", ringY.toFixed(1));
      rodEyelet.setAttribute("cx", layout.rodTip.x.toFixed(1));
      rodEyelet.setAttribute("cy", layout.rodTip.y.toFixed(1));
    }

    const lineVisible = layout.bobber.visible;
    lineShadow.style.display = lineVisible ? "" : "none";
    lineGlow.style.display = lineVisible ? "" : "none";
    if (lineVisible) {
      const linePath = `M ${layout.rodTip.x.toFixed(1)} ${layout.rodTip.y.toFixed(1)} ` +
        `Q ${layout.lineControl.x.toFixed(1)} ${layout.lineControl.y.toFixed(1)} ` +
        `${layout.bobber.x.toFixed(1)} ${(layout.bobber.y - 21).toFixed(1)}`;
      lineShadow.setAttribute("d", linePath);
      lineGlow.setAttribute("d", linePath);
    }

    shadowGroup.style.display = layout.shadow.visible ? "" : "none";
    if (layout.shadow.visible) {
      shadowGroup.setAttribute(
        "transform",
        `translate(${layout.shadow.x.toFixed(1)} ${layout.shadow.y.toFixed(1)}) ` +
          `rotate(${layout.shadow.angle.toFixed(1)})`,
      );
      shadowGroup.setAttribute("opacity", layout.shadow.opacity.toFixed(2));
    }

    rippleNodes.forEach((node, index) => {
      const ripple = layout.ripples[index];
      if (ripple === undefined) {
        node.style.display = "none";
        return;
      }
      node.style.display = "";
      node.setAttribute("cx", ripple.cx.toFixed(1));
      node.setAttribute("cy", ripple.cy.toFixed(1));
      node.setAttribute("rx", ripple.rx.toFixed(1));
      node.setAttribute("ry", ripple.ry.toFixed(1));
      node.setAttribute("opacity", ripple.opacity.toFixed(2));
    });

    bobberGroup.style.display = layout.bobber.visible ? "" : "none";
    if (layout.bobber.visible) {
      const bobberScale = layout.bobber.submerged ? 0.88 : 1;
      bobberGroup.setAttribute(
        "transform",
        `translate(${layout.bobber.x.toFixed(1)} ${layout.bobber.y.toFixed(1)}) ` +
          `scale(${bobberScale})`,
      );
      splashGroup.style.display = view.phase === "bite" || view.phase === "reeling" ? "" : "none";
    }

    // Top-left Bubblegum Bay Catch Book pill.
    place(book, layout.book);
    const padX = Math.max(6, Math.round(layout.scale * 22));
    const bookGap = Math.max(4, Math.round(layout.scale * 16));
    const slotGap = Math.max(2, Math.round(layout.scale * 9));
    setStyle(book, "padding", `2px ${padX}px`);
    setStyle(book, "gap", `${bookGap}px`);
    setStyle(bookSlots, "gap", `${slotGap}px`);
    const bookFont = Math.max(8, Math.round(layout.book.height * 0.24));
    setStyle(bookTitle, "font-size", `${Math.max(7, Math.round(bookFont * 0.85))}px`);
    setStyle(bookCount, "font-size", `${Math.max(10, Math.round(bookFont * 1.18))}px`);
    setText(bookCount, `${view.caughtSpecies} / ${view.totalSpecies}`);
    const slotSize = Math.max(16, Math.round(layout.book.height * 0.68));
    while (slotNodes.length < view.catalog.length) {
      const wrap = element("div", "fish-book-slot", bookSlots);
      const sprite = element("div", "fish-book-sprite", wrap);
      slotNodes.push({ wrap, sprite, frame: "" });
    }
    view.catalog.forEach((entry, index) => {
      const slot = slotNodes[index];
      if (slot === undefined) return;
      slot.wrap.hidden = false;
      setStyle(slot.wrap, "width", `${slotSize}px`);
      setStyle(slot.wrap, "height", `${slotSize}px`);
      slot.wrap.classList.toggle("is-caught", entry.caught);
      slot.wrap.dataset.id = entry.id;
      if (slot.frame !== entry.frame) {
        const crop = art(entry.frame);
        if (crop !== null) {
          applyAtlasCrop(slot.sprite, crop);
          slot.frame = entry.frame;
        }
      }
    });

    // Top-right escape pill (touch-aware copy).
    escape.hidden = !view.canCancel;
    place(escape, layout.escape);
    const touchOn = document.documentElement.dataset.touch === "on";
    setText(escapeText, touchOn ? "× · Pack up" : "Esc · Pack up");
    setStyle(escapeText, "font-size", `${Math.max(9, Math.round(layout.escape.height * 0.42))}px`);

    // Left Cast Power Gauge (aim phase).
    powerGauge.hidden = view.phase !== "aim";
    if (!powerGauge.hidden) {
      place(powerGauge, layout.powerGauge);
      const gaugeFont = Math.max(8, Math.round(layout.powerGauge.width * 0.22));
      setStyle(powerRare, "font-size", `${gaugeFont}px`);
      setStyle(powerFoot, "font-size", `${gaugeFont}px`);
      setStyle(powerPointer, "bottom", `${(view.power * 100).toFixed(2)}%`);
      setStyle(powerPointer, "height", `${Math.max(7, Math.round(layout.scale * 20))}px`);
    }

    // Right Watercolor Reel-In Meter (reeling phase).
    reelMeter.hidden = view.phase !== "reeling";
    if (!reelMeter.hidden) {
      place(reelMeter, layout.reelMeter);
      const reelFont = Math.max(9, Math.round(layout.reelMeter.width * 0.19));
      setStyle(reelTitle, "font-size", `${reelFont}px`);
      const bottomPct = Math.max(0, (view.hookPos - view.zoneHalf) * 100);
      const topPct = Math.min(100, (view.hookPos + view.zoneHalf) * 100);
      setStyle(reelZone, "bottom", `${bottomPct.toFixed(2)}%`);
      setStyle(reelZone, "height", `${Math.max(6, topPct - bottomPct).toFixed(2)}%`);
      reelZone.classList.toggle("is-hot", view.inZone);
      setStyle(reelFish, "bottom", `${(view.fishPos * 100).toFixed(2)}%`);
      setStyle(reelProgressFill, "height", `${(view.reelProgress * 100).toFixed(2)}%`);
    }

    // ! BITE ! pop sticker.
    biteBadge.hidden = view.phase !== "bite";
    if (!biteBadge.hidden) {
      place(biteBadge, layout.biteBadge);
      const biteFont = Math.max(12, Math.round(layout.biteBadge.height * 0.52));
      setStyle(biteText, "font-size", `${biteFont}px`);
    }

    // Watercolor Catch Reveal Medallion (result phase, when caught).
    const caught = view.phase === "result" ? view.caught : null;
    catchCard.hidden = caught === null;
    if (caught !== null) {
      place(catchCard, layout.catchCard);
      const cardH = layout.catchCard.height;
      const cardPad = Math.max(6, Math.round(layout.scale * 22));
      setStyle(catchCard, "padding", `${cardPad}px ${Math.round(cardPad * 1.2)}px`);
      setStyle(catchCard, "gap", `${Math.max(8, Math.round(layout.scale * 24))}px`);
      setStyle(catchInfo, "gap", `${Math.max(3, Math.round(layout.scale * 12))}px`);
      setStyle(catchPills, "gap", `${Math.max(3, Math.round(layout.scale * 10))}px`);
      const medallionSize = Math.max(46, Math.round(cardH * 0.7));
      setStyle(catchMedallion, "width", `${medallionSize}px`);
      setStyle(catchMedallion, "height", `${medallionSize}px`);
      if (lastCatchFrame !== caught.frame) {
        const crop = art(caught.frame);
        if (crop !== null) {
          applyAtlasCrop(catchSprite, crop);
          lastCatchFrame = caught.frame;
        }
      }
      catchNew.hidden = !caught.isNew;
      setStyle(catchNew, "font-size", `${Math.max(8, Math.round(cardH * 0.088))}px`);
      setStyle(catchName, "font-size", `${Math.max(11, Math.round(cardH * 0.14))}px`);
      setText(catchName, caught.name);
      const pillFont = Math.max(8, Math.round(cardH * 0.082));
      const pillPadX = Math.max(4, Math.round(layout.scale * 16));
      const pillPad = `2px ${pillPadX}px`;
      catchRarity.className = `fish-pill is-${caught.rarity}`;
      setStyle(catchRarity, "font-size", `${pillFont}px`);
      setStyle(catchRarity, "padding", pillPad);
      setText(
        catchRarity,
        caught.rarity === "rare" ? "RARE!" : caught.rarity.toUpperCase(),
      );
      setStyle(catchCoins, "font-size", `${pillFont}px`);
      setStyle(catchCoins, "padding", pillPad);
      setText(catchCoins, `+${caught.coins} Coins`);
      catchSnacks.hidden = caught.snacks <= 0;
      setStyle(catchSnacks, "font-size", `${pillFont}px`);
      setStyle(catchSnacks, "padding", pillPad);
      setText(catchSnacks, `+${caught.snacks} Snack${caught.snacks === 1 ? "" : "s"}`);
    }

    // Bottom wooden dock caption bar (hidden during result when dialogue takes over).
    front.hidden = view.phase === "result" || view.hint === "";
    place(front, layout.front);
    setText(frontText, view.hint);
    const frontKey = `${view.hint}|${layout.front.width}|${layout.front.height}`;
    if (!front.hidden && frontKey !== lastFrontKey) {
      lastFrontKey = frontKey;
      const tall = Math.max(10, Math.floor(layout.front.height * 0.4));
      setStyle(frontText, "font-size", `${tall}px`);
      const maxWidth = Math.max(1, front.clientWidth * 0.86 - 32);
      const room = maxWidth / Math.max(1, frontText.scrollWidth);
      if (room < 1) setStyle(frontText, "font-size", `${Math.max(9, Math.floor(tall * room))}px`);
    }
  };

  document.fonts.addEventListener("loadingdone", () => {
    lastFrontKey = "";
    if (lastView !== null && lastLayout !== null) draw(lastView, lastLayout);
  });

  return {
    render: (view) => {
      overlay.hidden = view === null;
      lastView = view;
      if (view === null) {
        lastKey = "";
        return;
      }
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom);
      const touch = document.documentElement.dataset.touch === "on" ? "1" : "0";
      const key = `${width}x${height} ${touch} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const scale = Math.max(
        0.01,
        Math.min(width / calibration.size.w, height / calibration.size.h),
      );
      lastLayout = layoutFish(view, calibration, scale);
      draw(view, lastLayout);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      const stageBox = measure(stage);
      const waterBox = {
        x: stageBox.x + lastLayout.water.x,
        y: stageBox.y + lastLayout.water.y,
        width: lastLayout.water.width,
        height: lastLayout.water.height,
      };
      return {
        game: "fish",
        phase: lastView.phase,
        stage: stageBox,
        water: waterBox,
        bobber: {
          x: Math.round(stageBox.x + lastLayout.bobber.x * lastLayout.scale),
          y: Math.round(stageBox.y + lastLayout.bobber.y * lastLayout.scale),
          visible: lastLayout.bobber.visible,
        },
        power: lastView.power,
        reelProgress: lastView.reelProgress,
        inZone: lastView.inZone,
        caught: lastView.caught?.id ?? null,
        catchCard: catchCard.hidden ? null : measure(catchCard),
        caughtSpecies: lastView.caughtSpecies,
        totalSpecies: lastView.totalSpecies,
        front: front.hidden ? "" : frontText.textContent ?? "",
      };
    },
  };
}
