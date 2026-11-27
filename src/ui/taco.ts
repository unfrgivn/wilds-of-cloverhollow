import "./taco.css";
import {
  classifyTacoPopup,
  createArcadePopupLayer,
  type ArcadeRecordBadge,
} from "./arcade-popups";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { element, measure, pixels, place, setStyle, setText, type Box } from "./dom";
import type { HudInputMode } from "./hud-hints";
import { bindPointerHold } from "./pointer-hold";
import { layoutTaco, type TacoLayout } from "./taco-layout";
import {
  tacoToppings,
  type TacoCalibration,
  type TacoPhase,
  type TacoTopping,
  type TacoView,
} from "../core";

export type TacoInfo = {
  game: "taco";
  phase: TacoPhase;
  stage: Box;
  ticket: Box;
  hud: Box;
  shell: Box;
  bowls: { topping: TacoTopping; box: Box }[];
  orderBanner: Box | null;
  served: number;
  totalOrders: number;
  orderIndex: number;
  stepIndex: number;
  timeLeft: number;
  score: number;
  front: string;
};

// Chef Mateo's Taco Truck Kitchen close-up (spec 8.2): painted serving counter,
// hanging customer order ticket, shift timer & score pill, live taco assembly
// on the woven placemat, four direct-click/tap painted topping bowls, and the
// bottom counter caption bar.
export function createTaco(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  calibration: TacoCalibration,
  image: string,
  onPickTopping: (topping: TacoTopping) => void = () => undefined,
  onConfirmHold: (held: boolean) => void = () => undefined,
  onCancel: () => void = () => undefined,
): {
  render: (
    view: TacoView | null,
    record?: ArcadeRecordBadge | null,
    inputMode?: HudInputMode,
  ) => void;
  info: () => TacoInfo | null;
} {
  const overlay = element("section", "taco-overlay", root);
  overlay.setAttribute("aria-label", "Chef Mateo's Taco Truck Kitchen");
  overlay.hidden = true;
  const popups = createArcadePopupLayer(overlay);

  const stage = element("div", "taco-stage", overlay);
  stage.style.backgroundImage = `url("${image}")`;

  let lastView: TacoView | null = null;
  const pointerHold = bindPointerHold(
    stage,
    (held) => onConfirmHold(held),
    () => !overlay.hidden && (lastView?.phase === "ready" || lastView?.phase === "result"),
  );

  // Hanging customer order ticket (top-left inside sunny serving window).
  const ticket = element("div", "taco-ticket", stage);
  const ticketHead = element("div", "taco-ticket-head", ticket);
  const ticketOrder = element("span", "taco-ticket-order", ticketHead);
  const ticketSteps = element("div", "taco-ticket-steps", ticket);
  type StepNode = {
    wrap: HTMLDivElement;
    sprite: HTMLDivElement;
    check: HTMLSpanElement;
    frame: string;
  };
  const stepNodes: StepNode[] = [];

  // Top-right shift timer & orders/score pill.
  const hud = element("div", "taco-hud", stage);
  const timerCell = element("div", "taco-hud-cell", hud);
  const timerLabel = element("span", "taco-hud-label", timerCell);
  setText(timerLabel, "TIME");
  const timerValue = element("span", "taco-hud-value is-timer", timerCell);
  element("div", "taco-hud-divider", hud);
  const ordersCell = element("div", "taco-hud-cell", hud);
  const ordersLabel = element("span", "taco-hud-label", ordersCell);
  setText(ordersLabel, "ORDERS");
  const ordersValue = element("span", "taco-hud-value", ordersCell);
  element("div", "taco-hud-divider", hud);
  const scoreCell = element("div", "taco-hud-cell", hud);
  const scoreLabel = element("span", "taco-hud-label", scoreCell);
  setText(scoreLabel, "SCORE");
  const scoreValue = element("span", "taco-hud-value", scoreCell);

  // Touch-aware leave pill during ready.
  const escape = element("button", "taco-escape", stage);
  escape.type = "button";
  escape.setAttribute("aria-label", "Leave taco truck");
  const escapeText = element("span", "taco-escape-text", escape);
  escape.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (lastView?.phase === "ready") onCancel();
  });

  // Celebratory ORDER UP! ribbon.
  const orderBanner = element("div", "taco-order-banner", stage);
  const orderBannerText = element("span", "taco-order-banner-text", orderBanner);

  // Center live taco shell + stacked topping layers on the woven placemat.
  const shell = element("div", "taco-shell", stage);
  let shellLoaded = false;
  const layerNodes: { node: HTMLDivElement; frame: string }[] = [];

  // Four direct-click / direct-tap painted topping bowls.
  type BowlNodes = {
    topping: TacoTopping;
    button: HTMLButtonElement;
    key: HTMLSpanElement;
    sprite: HTMLDivElement;
    label: HTMLSpanElement;
    loaded: boolean;
  };
  const bowlNodes: BowlNodes[] = tacoToppings.map((topping) => {
    const button = element("button", "taco-bowl", stage);
    button.type = "button";
    button.dataset.topping = topping;
    button.setAttribute("aria-label", `Add ${topping}`);
    const sprite = element("div", "taco-bowl-sprite", button);
    const foot = element("div", "taco-bowl-foot", button);
    const key = element("span", "taco-bowl-key", foot);
    key.setAttribute("aria-hidden", "true");
    const label = element("span", "taco-bowl-label", foot);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (lastView?.phase === "serving") onPickTopping(topping);
    });
    return { topping, button, key, sprite, label, loaded: false };
  });

  // Bottom counter caption bar.
  const front = element("div", "taco-front", stage);
  const frontPill = element("div", "taco-front-pill", front);
  const frontText = element("span", "taco-front-text", frontPill);

  const frames = new Map<string, AtlasImage | null>();
  const frameArt = (name: string): AtlasImage | null => {
    const cached = frames.get(name);
    if (cached !== undefined && cached !== null) return cached;
    const loaded = art(name);
    if (loaded !== null) frames.set(name, loaded);
    return loaded;
  };

  let lastKey = "";
  let lastFrontKey = "";
  let lastLayout: TacoLayout | null = null;
  let prevPhase: string | null = null;
  let prevScore: number | null = null;

  const draw = (view: TacoView, layout: TacoLayout): void => {
    place(stage, { x: 0, y: 0, width: layout.width, height: layout.height });
    setStyle(stage, "border-radius", `${layout.radius}px`);
    stage.dataset.scale = String(layout.scale);
    stage.dataset.phase = view.phase;

    // Hanging customer order ticket.
    place(ticket, layout.ticket);
    const tPadX = Math.max(8, Math.round(layout.scale * 24));
    const tPadY = Math.max(5, Math.round(layout.scale * 16));
    setStyle(ticket, "padding", `${tPadY}px ${tPadX}px`);
    setStyle(ticket, "gap", `${Math.max(4, Math.round(layout.scale * 12))}px`);
    setStyle(ticket, "border-radius", `${Math.max(10, Math.round(layout.scale * 20))}px`);
    ticket.classList.toggle("is-oops", view.oopsTicks > 0);
    const orderNum = Math.min(view.orderIndex + 1, view.totalOrders);
    const customer = view.currentOrder?.customer ?? "Cloverhollow";
    setText(ticketOrder, `ORDER ${orderNum}/${view.totalOrders} · ${customer.toUpperCase()}`);
    const headFont = Math.max(9, Math.round(layout.ticket.height * 0.165));
    setStyle(ticketOrder, "font-size", `${headFont}px`);

    const recipe = view.currentOrder?.recipe ?? [];
    const stepGap = Math.max(4, Math.round(layout.scale * 16));
    setStyle(ticketSteps, "gap", `${stepGap}px`);
    const maxSlot = Math.floor(
      (layout.ticket.width - 2 * tPadX - Math.max(0, recipe.length - 1) * stepGap) /
        Math.max(1, recipe.length),
    );
    const stepSize = Math.max(22, Math.min(maxSlot, Math.round(layout.ticket.height * 0.56)));
    while (stepNodes.length < recipe.length) {
      const wrap = element("div", "taco-step", ticketSteps);
      const sprite = element("div", "taco-step-sprite", wrap);
      const check = element("span", "taco-step-check", wrap);
      setText(check, "✓");
      stepNodes.push({ wrap, sprite, check, frame: "" });
    }
    stepNodes.forEach((slot, index) => {
      const topping = recipe[index];
      if (topping === undefined) {
        slot.wrap.hidden = true;
        return;
      }
      slot.wrap.hidden = false;
      setStyle(slot.wrap, "width", `${stepSize}px`);
      setStyle(slot.wrap, "height", `${stepSize}px`);
      const done = view.phase === "order-clear" ||
        (view.phase === "result" && view.served > 0) ||
        index < view.stepIndex;
      const active = view.phase === "serving" && index === view.stepIndex;
      slot.wrap.classList.toggle("is-done", done);
      slot.wrap.classList.toggle("is-active", active);
      slot.wrap.classList.toggle("is-oops", active && view.oopsTicks > 0);
      slot.wrap.dataset.topping = topping;
      slot.check.hidden = !done;
      setStyle(slot.check, "font-size", `${Math.max(8, Math.round(stepSize * 0.3))}px`);
      if (slot.frame !== topping) {
        const crop = frameArt(topping);
        if (crop !== null) {
          applyAtlasCrop(slot.sprite, crop);
          slot.frame = topping;
        }
      }
    });

    // Top-right shift timer & score pill.
    place(hud, layout.hud);
    const hudPadX = Math.max(10, Math.round(layout.scale * 30));
    setStyle(hud, "padding", `2px ${hudPadX}px`);
    const labelFont = Math.max(8, Math.round(layout.hud.height * 0.21));
    const valueFont = Math.max(11, Math.round(layout.hud.height * 0.36));
    for (const node of [timerLabel, ordersLabel, scoreLabel]) {
      setStyle(node, "font-size", `${labelFont}px`);
    }
    for (const node of [timerValue, ordersValue, scoreValue]) {
      setStyle(node, "font-size", `${valueFont}px`);
    }
    const seconds = Math.ceil(view.timeLeft / 60);
    setText(timerValue, `${seconds}s`);
    timerValue.classList.toggle("is-low", view.phase === "serving" && seconds <= 5);
    setText(ordersValue, `${view.served}/${view.totalOrders}`);
    setText(scoreValue, `★ ${view.score}`);

    // Touch-aware leave pill during ready.
    escape.hidden = !view.canCancel;
    place(escape, layout.escape);
    const touchOn = document.documentElement.dataset.touch === "on";
    setText(escapeText, touchOn ? "× · Leave" : "Esc · Leave");
    setStyle(escapeText, "font-size", `${Math.max(9, Math.round(layout.escape.height * 0.42))}px`);

    // Celebratory ORDER UP! / shift summary ribbon.
    const showBanner = view.phase === "order-clear" || view.phase === "result";
    orderBanner.hidden = !showBanner;
    if (showBanner) {
      place(orderBanner, layout.orderBanner);
      const spotless = view.served >= view.totalOrders && view.mistakes === 0;
      const bannerLabel = view.phase === "order-clear"
        ? "ORDER UP! ★"
        : spotless
          ? "SPOTLESS SHIFT! ★"
          : view.served > 0
            ? `${view.served}/${view.totalOrders} SERVED! ★`
            : "LUNCH BELL!";
      setText(orderBannerText, bannerLabel);
      setStyle(
        orderBannerText,
        "font-size",
        `${Math.max(12, Math.round(layout.orderBanner.height * 0.48))}px`,
      );
    }

    // Center live taco shell + stacked toppings on woven placemat.
    place(shell, layout.shell);
    if (!shellLoaded) {
      const crop = frameArt("shell");
      if (crop !== null) {
        applyAtlasCrop(shell, crop);
        shellLoaded = true;
      }
    }
    while (layerNodes.length < layout.layers.length) {
      const node = element("div", "taco-layer", stage);
      layerNodes.push({ node, frame: "" });
    }
    layerNodes.forEach((entry, index) => {
      const spec = layout.layers[index];
      if (spec === undefined) {
        entry.node.hidden = true;
        return;
      }
      entry.node.hidden = false;
      place(entry.node, spec.box);
      setStyle(entry.node, "z-index", String(spec.zIndex));
      entry.node.dataset.frame = spec.frame;
      if (entry.frame !== spec.frame) {
        const crop = frameArt(spec.frame);
        if (crop !== null) {
          applyAtlasCrop(entry.node, crop);
          entry.frame = spec.frame;
        }
      }
    });

    // Four painted topping bowls flanking the placemat (hidden during result so
    // dialogue stays completely unobstructed).
    const hideBowls = view.phase === "result";
    bowlNodes.forEach((nodes) => {
      const spec = layout.bowls.find((item) => item.topping === nodes.topping);
      if (spec === undefined || hideBowls) {
        nodes.button.hidden = true;
        return;
      }
      nodes.button.hidden = false;
      nodes.button.disabled = view.phase !== "serving";
      place(nodes.button, spec.box);
      const bPadX = Math.max(4, Math.round(layout.scale * 14));
      const bPadY = Math.max(4, Math.round(layout.scale * 10));
      setStyle(nodes.button, "padding", `${bPadY}px ${bPadX}px`);
      setStyle(nodes.button, "border-radius", `${Math.max(12, Math.round(layout.scale * 28))}px`);
      setText(nodes.key, spec.arrow);
      setStyle(nodes.key, "font-size", `${Math.max(9, Math.round(spec.box.height * 0.17))}px`);
      setText(nodes.label, spec.label);
      setStyle(nodes.label, "font-size", `${Math.max(9, Math.round(spec.box.height * 0.185))}px`);
      if (!nodes.loaded) {
        const crop = frameArt(nodes.topping);
        if (crop !== null) {
          applyAtlasCrop(nodes.sprite, crop);
          nodes.loaded = true;
        }
      }
    });

    // Bottom counter caption bar (hidden during result when dialogue takes over).
    const frontHint = touchOn && view.phase === "serving" && view.oopsTicks === 0
      ? "Tap the matching topping bowl to build each taco!"
      : view.hint;
    front.hidden = view.phase === "result" || frontHint === "";
    place(front, layout.front);
    setText(frontText, frontHint);
    const frontKey = `${frontHint}|${layout.front.width}|${layout.front.height}`;
    if (!front.hidden && frontKey !== lastFrontKey) {
      lastFrontKey = frontKey;
      const tall = Math.max(10, Math.floor(layout.front.height * 0.4));
      setStyle(frontText, "font-size", `${tall}px`);
      const maxWidth = Math.max(1, front.clientWidth * 0.84 - 36);
      const room = maxWidth / Math.max(1, frontText.scrollWidth);
      if (room < 1) setStyle(frontText, "font-size", `${Math.max(9, Math.floor(tall * room))}px`);
    }
  };

  document.fonts.addEventListener("loadingdone", () => {
    lastFrontKey = "";
    if (lastView !== null && lastLayout !== null) draw(lastView, lastLayout);
  });

  return {
    render: (view, _record = null, inputMode = "keyboard") => {
      overlay.hidden = view === null;
      lastView = view;
      if (view === null) {
        pointerHold.release();
        lastKey = "";
        prevPhase = null;
        prevScore = null;
        popups.clear();
        return;
      }
      const spotless = view.served >= view.totalOrders && view.mistakes === 0;
      const popupSpec = classifyTacoPopup(prevScore, prevPhase, view.score, view.phase, spotless);
      prevScore = view.score;
      prevPhase = view.phase;
      if (popupSpec !== null) popups.spawn(popupSpec);
      const style = getComputedStyle(overlay);
      const width = overlay.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      const height = overlay.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom);
      const touch = document.documentElement.dataset.touch === "on" ? "1" : "0";
      const key = `${width}x${height} ${touch} ${inputMode} ${JSON.stringify(view)}`;
      if (key === lastKey) return;
      lastKey = key;
      const scale = Math.max(
        0.01,
        Math.min(width / calibration.size.w, height / calibration.size.h),
      );
      lastLayout = layoutTaco(view, calibration, scale, inputMode);
      draw(view, lastLayout);
    },
    info: () => {
      if (lastView === null || lastLayout === null) return null;
      return {
        game: "taco",
        phase: lastView.phase,
        stage: measure(stage),
        ticket: measure(ticket),
        hud: measure(hud),
        shell: measure(shell),
        bowls: bowlNodes
          .filter((item) => !item.button.hidden)
          .map((item) => ({ topping: item.topping, box: measure(item.button) })),
        orderBanner: orderBanner.hidden ? null : measure(orderBanner),
        served: lastView.served,
        totalOrders: lastView.totalOrders,
        orderIndex: lastView.orderIndex,
        stepIndex: lastView.stepIndex,
        timeLeft: lastView.timeLeft,
        score: lastView.score,
        front: front.hidden ? "" : frontText.textContent ?? "",
      };
    },
  };
}
