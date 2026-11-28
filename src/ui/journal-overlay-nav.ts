import { cycleIndex, isElementVisible, type JournalNavDirection } from "./journal-nav";

const OVERLAY_STEP_SCROLL_PX = 72;

function isCloseButton(btn: HTMLButtonElement): boolean {
  const aria = btn.getAttribute("aria-label") ?? "";
  return (
    btn.className.includes("-close") ||
    aria.startsWith("Close ") ||
    btn.textContent?.trim() === "×"
  );
}

function isOverlayButtonVisible(btn: HTMLButtonElement): boolean {
  if (btn.disabled || !isElementVisible(btn)) return false;
  if (typeof window === "undefined" || !btn.isConnected) return true;
  const style = window.getComputedStyle(btn);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (style.position !== "fixed" && btn.offsetParent === null) {
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && btn.ownerDocument.body.offsetWidth > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Returns all visible, enabled `<button>` controls inside an open Journal modal
 * overlay, ordering primary action buttons ahead of any close (`×`) button.
 */
export function focusableOverlayButtons(root: HTMLElement): HTMLButtonElement[] {
  const primary: HTMLButtonElement[] = [];
  const closeButtons: HTMLButtonElement[] = [];
  for (const btn of root.querySelectorAll<HTMLButtonElement>("button")) {
    if (!isOverlayButtonVisible(btn)) continue;
    if (isCloseButton(btn)) closeButtons.push(btn);
    else primary.push(btn);
  }
  return [...primary, ...closeButtons];
}

function overlayScrollCandidates(root: HTMLElement): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const grid of root.querySelectorAll<HTMLElement>("[class*='-grid']")) {
    candidates.add(grid);
  }
  for (const card of root.querySelectorAll<HTMLElement>("[role='dialog'], [class*='-card']")) {
    candidates.add(card);
  }
  candidates.add(root);
  return [...candidates];
}

/**
 * Scrolls the first overflowing container inside an open Journal modal overlay
 * (checking `[grid, card, root]`) by `deltaY` pixels, clamped to valid bounds.
 */
export function scrollOverlayContainer(root: HTMLElement, deltaY: number): boolean {
  if (deltaY === 0 || !Number.isFinite(deltaY)) return false;
  for (const container of overlayScrollCandidates(root)) {
    if (container.scrollHeight <= container.clientHeight + 1) continue;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const before = container.scrollTop;
    const next = Math.max(0, Math.min(maxScroll, before + deltaY));
    if (next === before) continue;
    container.scrollTop = next;
    if (container.scrollTop !== before) return true;
  }
  return false;
}

/**
 * Steps focus across visible buttons inside an open Journal modal overlay, or
 * scrolls/steps card tiles vertically when the modal has only a close button.
 */
export function stepOverlayFocus(root: HTMLElement, direction: JournalNavDirection): boolean {
  const buttons = focusableOverlayButtons(root);
  const delta: -1 | 1 = direction === "right" || direction === "down" ? 1 : -1;
  if (buttons.length > 1) {
    const active = document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : null;
    const currentIndex = active === null ? -1 : buttons.indexOf(active);
    const next = buttons[cycleIndex(currentIndex, buttons.length, delta)];
    if (next === undefined) return false;
    next.focus({ preventScroll: true });
    next.scrollIntoView?.({ block: "nearest" });
    return true;
  }
  if (direction === "up" || direction === "down") {
    const stepPx = direction === "down" ? OVERLAY_STEP_SCROLL_PX : -OVERLAY_STEP_SCROLL_PX;
    if (scrollOverlayContainer(root, stepPx)) return true;
  }
  const tiles = [...root.querySelectorAll<HTMLElement>("[tabindex='0']")].filter(isElementVisible);
  if (tiles.length > 1) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = active === null ? -1 : tiles.indexOf(active);
    const next = tiles[cycleIndex(currentIndex, tiles.length, delta)];
    if (next !== undefined) {
      next.focus({ preventScroll: true });
      next.scrollIntoView?.({ block: "nearest" });
      return true;
    }
  }
  return false;
}

/**
 * Activates the currently focused enabled button inside an open Journal modal
 * overlay, or focuses the first non-close interactive button so the player sees
 * what is highlighted before activating.
 */
export function activateOverlayButton(root: HTMLElement): boolean {
  const active = document.activeElement;
  if (
    active instanceof HTMLButtonElement &&
    root.contains(active) &&
    isOverlayButtonVisible(active)
  ) {
    active.click();
    return true;
  }
  const primary = focusableOverlayButtons(root).find((btn) => !isCloseButton(btn));
  if (primary !== undefined) {
    primary.focus({ preventScroll: true });
    primary.scrollIntoView?.({ block: "nearest" });
    return true;
  }
  return false;
}
