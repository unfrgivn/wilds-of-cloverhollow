import "./ribbon-toast.css";
import { element, setAttribute, setText } from "./dom";
import { createMeritRibbonEmblem } from "./journal-ribbons";
import type { MeritRibbonEntry, MeritRibbonId } from "../core/ribbons";

export const RIBBON_TOAST_DURATION_MS = 3200;

export type RibbonToast = {
  enqueue: (ribbons: readonly MeritRibbonEntry[]) => void;
  clear: () => void;
  visible: () => boolean;
  currentId: () => MeritRibbonId | null;
};

/**
 * Die-cut cream-and-gold celebration pill announcing newly stitched Valley Merit
 * Ribbons during live gameplay, queueing simultaneous unlocks in tapestry order.
 */
export function createRibbonToast(root: HTMLElement): RibbonToast {
  const toast = element("div", "sticker-ui ribbon-toast", root);
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;

  const emblemWrap = element("span", "ribbon-toast-emblem", toast);
  const copy = element("span", "ribbon-toast-copy", toast);
  const eyebrow = element("span", "ribbon-toast-eyebrow", copy);
  eyebrow.textContent = "RIBBON EARNED";
  const title = element("span", "ribbon-toast-title", copy);

  const queue: MeritRibbonEntry[] = [];
  let active: MeritRibbonEntry | null = null;
  let timer: number | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const hideNow = (): void => {
    active = null;
    toast.hidden = true;
    toast.removeAttribute("data-ribbon-id");
    toast.style.removeProperty("--ribbon-accent");
  };

  const showNext = (): void => {
    clearTimer();
    const next = queue.shift();
    if (next === undefined) {
      hideNow();
      return;
    }
    const earnedRibbon: MeritRibbonEntry = next.earned ? next : { ...next, earned: true };
    active = earnedRibbon;
    setAttribute(toast, "data-ribbon-id", earnedRibbon.id);
    toast.style.setProperty("--ribbon-accent", earnedRibbon.color);
    emblemWrap.replaceChildren(createMeritRibbonEmblem(earnedRibbon));
    setText(title, `${earnedRibbon.title} ★`);
    toast.hidden = false;
    timer = window.setTimeout(() => {
      timer = null;
      showNext();
    }, RIBBON_TOAST_DURATION_MS);
  };

  const enqueue = (ribbons: readonly MeritRibbonEntry[]): void => {
    for (const ribbon of ribbons) {
      const alreadyActive = active?.id === ribbon.id;
      const alreadyQueued = queue.some((item) => item.id === ribbon.id);
      if (!alreadyActive && !alreadyQueued) queue.push(ribbon);
    }
    if (active === null && queue.length > 0) showNext();
  };

  const clear = (): void => {
    clearTimer();
    queue.length = 0;
    hideNow();
  };

  return {
    enqueue,
    clear,
    visible: () => !toast.hidden && active !== null,
    currentId: () => active?.id ?? null,
  };
}
