import "./arcade-popups.css";
import { element, setText } from "./dom";

export type ArcadePopupKind = "normal" | "big" | "rare" | "boop" | "star";

export type ArcadePopupSpec = {
  kind: ArcadePopupKind;
  text: string;
};

export type ArcadeRecordBadge = {
  best: number;
  isNewBest: boolean;
};

export type ArcadePopupLayer = {
  spawn: (spec: ArcadePopupSpec) => void;
  clear: () => void;
};

/**
 * Pure classifiers for live minigame score pops. Every classifier returns null
 * on initial open (`prev === null`), close, reset, or non-increasing values so
 * static gallery screenshots never spawn popups.
 */
export function classifySkeePopup(
  prevScore: number | null,
  nextScore: number,
): ArcadePopupSpec | null {
  if (prevScore === null || nextScore <= prevScore) return null;
  const delta = Math.round(nextScore - prevScore);
  if (delta <= 0) return null;
  if (delta >= 100) return { kind: "rare", text: "+100 ★!" };
  if (delta >= 50) return { kind: "big", text: `+${delta}!` };
  return { kind: "normal", text: `+${delta}` };
}

export function classifyMolePopup(
  prevBoops: number | null,
  nextBoops: number,
): ArcadePopupSpec | null {
  if (prevBoops === null || nextBoops <= prevBoops) return null;
  return { kind: "boop", text: "BOOP! +2" };
}

export function classifyCometPopup(
  prevCaught: number | null,
  nextCaught: number,
): ArcadePopupSpec | null {
  if (prevCaught === null || nextCaught <= prevCaught) return null;
  return { kind: "star", text: "★ +1" };
}

export function classifyFishPopup(
  prevPhase: string | null,
  nextPhase: string,
  rare: boolean,
  caught: boolean,
): ArcadePopupSpec | null {
  if (prevPhase === null || prevPhase === "result" || nextPhase !== "result" || !caught) {
    return null;
  }
  return rare ? { kind: "rare", text: "★ RARE!" } : { kind: "normal", text: "NICE CATCH!" };
}

export type CookPopupRating = "under" | "golden" | "over" | "burnt" | "frozen";

export function classifyCookPopup(
  prevPhase: string | null,
  nextPhase: string,
  rating: CookPopupRating | null,
): ArcadePopupSpec | null {
  if (prevPhase === null || prevPhase === nextPhase || nextPhase !== "result") {
    return null;
  }
  return rating === "golden" ? { kind: "rare", text: "★ GOLDEN!" } : null;
}

export type ClawPopupOutcome = "grabbed" | "stuck" | "empty";

export function classifyClawPopup(
  prevPhase: string | null,
  nextPhase: string,
  outcome: ClawPopupOutcome | null,
): ArcadePopupSpec | null {
  if (prevPhase === null || prevPhase === nextPhase) return null;
  if (nextPhase === "lifting" && outcome === "grabbed") {
    return { kind: "star", text: "GOT IT! ★" };
  }
  if (nextPhase === "lifting" && outcome === "stuck") {
    return { kind: "normal", text: "TUG!" };
  }
  if (nextPhase === "result" && outcome === "grabbed") {
    return { kind: "rare", text: "★ PRIZE!" };
  }
  return null;
}

export function classifyTacoPopup(
  prevScore: number | null,
  prevPhase: string | null,
  nextScore: number,
  nextPhase: string,
  spotless: boolean,
): ArcadePopupSpec | null {
  if (prevPhase === null || prevScore === null) return null;
  if (prevPhase !== "result" && nextPhase === "result" && spotless) {
    return { kind: "rare", text: "★ SPOTLESS!" };
  }
  if (prevPhase !== "order-clear" && nextPhase === "order-clear") {
    return { kind: "star", text: "ORDER UP! ★" };
  }
  if (nextScore > prevScore) {
    return { kind: "boop", text: `+${nextScore - prevScore}` };
  }
  return null;
}

export function formatArcadeBestText(record: ArcadeRecordBadge): string {
  return record.isNewBest ? `★ NEW BEST! ${record.best}` : `Best: ${record.best}`;
}

export function updateArcadeBestBadge(
  node: HTMLElement,
  visible: boolean,
  record: ArcadeRecordBadge | null,
): void {
  const show = visible && record !== null && record.best > 0;
  node.hidden = !show;
  if (!show || record === null) return;
  node.classList.toggle("is-new-best", record.isNewBest);
  node.dataset.newBest = record.isNewBest ? "true" : "false";
  setText(node, formatArcadeBestText(record));
}

function isReducedMotion(): boolean {
  return (
    document.documentElement.dataset.reducedMotion === "on" ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

export function createArcadePopupLayer(host: HTMLElement): ArcadePopupLayer {
  const layer = element("div", "arcade-popups", host);
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-atomic", "false");
  type ActivePopup = { node: HTMLElement; timer: number };
  const active = new Set<ActivePopup>();
  let sequence = 0;

  const clear = (): void => {
    for (const entry of active) {
      window.clearTimeout(entry.timer);
      entry.node.remove();
    }
    active.clear();
  };

  const spawn = (spec: ArcadePopupSpec): void => {
    const node = element("div", `arcade-popup is-${spec.kind}`);
    node.dataset.popupKind = spec.kind;
    setText(node, spec.text);
    const slot = sequence % 3;
    sequence += 1;
    const dx = slot === 1 ? 10 : 0;
    const dy = slot * 46;
    node.style.setProperty("--arcade-popup-dx", `${dx}px`);
    node.style.setProperty("--arcade-popup-dy", `${dy}px`);
    layer.append(node);
    const entry: ActivePopup = { node, timer: 0 };
    const remove = (): void => {
      if (!active.has(entry)) return;
      active.delete(entry);
      window.clearTimeout(entry.timer);
      node.remove();
    };
    node.addEventListener("animationend", remove, { once: true });
    entry.timer = window.setTimeout(remove, isReducedMotion() ? 520 : 900);
    active.add(entry);
  };

  return { spawn, clear };
}
