export type JournalNavDirection = "up" | "down" | "left" | "right";
export type JournalNavPage = "notes" | "map" | "options";

/** Steps an index forward or backward across a list with wrap-around. */
export function cycleIndex(current: number, length: number, delta: -1 | 1): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return delta > 0 ? 0 : length - 1;
  return (((current + delta) % length) + length) % length;
}

/** Converts a right-stick vertical axis reading into a smooth per-tick pixel scroll delta. */
export function computeJournalScrollDelta(
  axisY: number,
  deadZone = 0.25,
  maxPixelsPerTick = 9,
): number {
  if (maxPixelsPerTick <= 0 || deadZone >= 1) return 0;
  const magnitude = Math.abs(axisY);
  if (magnitude <= deadZone) return 0;
  const scaled = ((magnitude - deadZone) / (1 - deadZone)) * maxPixelsPerTick;
  const clamped = Math.min(maxPixelsPerTick, scaled);
  return axisY < 0 ? -clamped : clamped;
}

/** Returns true when a Journal DOM control is visible and enabled for focus cycling. */
export function isElementVisible(node: HTMLElement): boolean {
  return (
    !node.hidden &&
    node.closest("[hidden]") === null &&
    node.getAttribute("aria-disabled") !== "true"
  );
}

export type JournalNavHost = {
  book: HTMLElement;
  notesPage: HTMLElement;
  stickersPage: HTMLElement;
  optionsPage: HTMLElement;
  soundPage: HTMLElement;
  playPage: HTMLElement;
  jukebox: HTMLElement;
  mapRoot: HTMLElement;
  sliderSteppers: ReadonlyMap<EventTarget, (direction: -1 | 1) => void>;
  getPage: () => JournalNavPage;
  setPage: (page: JournalNavPage) => void;
  hasOpenOverlay: () => boolean;
  handleOverlayKeydown: (event: KeyboardEvent) => boolean;
  stepMapLandFocus: (delta: -1 | 1) => boolean;
  stepTrack: (delta: -1 | 1) => void;
};

const navPages: readonly JournalNavPage[] = ["notes", "map", "options"];

function scrollPane(pane: HTMLElement, dy: number): boolean {
  if (pane.scrollHeight <= pane.clientHeight + 1) return false;
  const before = pane.scrollTop;
  const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
  pane.scrollTop = Math.max(0, Math.min(maxScroll, before + dy));
  return pane.scrollTop !== before;
}

function focusControl(target: HTMLElement | undefined): boolean {
  if (target === undefined) return false;
  target.focus();
  target.scrollIntoView({ block: "nearest" });
  return true;
}

/** Creates the keyboard and gamepad navigation controller for an open Journal book. */
export function createJournalNavController(host: JournalNavHost): {
  scrollActivePage: (deltaY: number) => boolean;
  navigateFocus: (direction: JournalNavDirection) => boolean;
  activateFocused: () => boolean;
  handleKeydown: (event: KeyboardEvent) => void;
} {
  const optionsControls = (): HTMLElement[] =>
    [
      ...host.optionsPage.querySelectorAll<HTMLElement>("button:not([hidden]):not(:disabled)"),
    ].filter(isElementVisible);

  const inspectableSlots = (): HTMLElement[] =>
    [...host.stickersPage.querySelectorAll<HTMLElement>(".journal-slot.is-inspectable")].filter(
      isElementVisible,
    );

  const scrollActivePage = (deltaY: number): boolean => {
    if (host.book.hidden || host.hasOpenOverlay() || deltaY === 0) return false;
    const page = host.getPage();
    const active = document.activeElement;
    if (page === "notes") {
      const focusInNotes = active instanceof Node && host.notesPage.contains(active);
      const primary = focusInNotes ? host.notesPage : host.stickersPage;
      const fallback = focusInNotes ? host.stickersPage : host.notesPage;
      if (primary.scrollHeight > primary.clientHeight + 1) return scrollPane(primary, deltaY);
      return scrollPane(fallback, deltaY);
    }
    if (page === "options") {
      const focusInPlay = active instanceof Node && host.playPage.contains(active);
      const primary = focusInPlay ? host.playPage : host.soundPage;
      const fallback = focusInPlay ? host.soundPage : host.playPage;
      if (primary.scrollHeight > primary.clientHeight + 1) return scrollPane(primary, deltaY);
      return scrollPane(fallback, deltaY);
    }
    return false;
  };

  const navigateFocus = (direction: JournalNavDirection): boolean => {
    if (host.book.hidden || host.hasOpenOverlay()) return false;
    const page = host.getPage();
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (page === "options") {
      const delta: -1 | 1 = direction === "right" || direction === "down" ? 1 : -1;
      if ((direction === "left" || direction === "right") && active !== null) {
        const stepSlider = host.sliderSteppers.get(active);
        if (stepSlider !== undefined) {
          stepSlider(delta);
          return true;
        }
        if (host.jukebox.contains(active)) {
          host.stepTrack(delta);
          return true;
        }
      }
      const controls = optionsControls();
      const currentIndex = active === null ? -1 : controls.indexOf(active);
      return focusControl(controls[cycleIndex(currentIndex, controls.length, delta)]);
    }
    if (page === "map") {
      const delta: -1 | 1 = direction === "right" || direction === "down" ? 1 : -1;
      return host.stepMapLandFocus(delta);
    }
    if (page === "notes") {
      const slotFocused =
        active !== null &&
        host.stickersPage.contains(active) &&
        active.matches(".journal-slot.is-inspectable");
      if ((direction === "up" || direction === "down") && !slotFocused) {
        return scrollActivePage(direction === "down" ? 72 : -72);
      }
      const inspectables = inspectableSlots();
      if (inspectables.length === 0) return false;
      const delta: -1 | 1 = direction === "right" || direction === "down" ? 1 : -1;
      const currentIndex = active === null ? -1 : inspectables.indexOf(active);
      return focusControl(inspectables[cycleIndex(currentIndex, inspectables.length, delta)]);
    }
    return false;
  };

  const activateFocused = (): boolean => {
    if (host.book.hidden || host.hasOpenOverlay()) return false;
    const active = document.activeElement;
    if (active instanceof HTMLElement && host.book.contains(active) && isElementVisible(active)) {
      if (
        active instanceof HTMLButtonElement ||
        active.matches(".journal-slot.is-inspectable, .journal-map-land.is-revealed")
      ) {
        active.click();
        return true;
      }
    } else if (host.getPage() === "options") {
      return focusControl(optionsControls()[0]);
    }
    return false;
  };

  const ownsArrowHorizontal = (target: EventTarget | null): boolean => {
    const page = host.getPage();
    if (page === "map" && target instanceof Node && host.mapRoot.contains(target)) return true;
    return (
      page === "notes" &&
      target instanceof HTMLElement &&
      target.matches(".journal-slot.is-inspectable")
    );
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (host.book.hidden) return;
    if (host.handleOverlayKeydown(event)) return;
    if (event.target !== null && host.sliderSteppers.has(event.target)) return;
    if (
      event.target instanceof Node &&
      host.jukebox.contains(event.target) &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      ownsArrowHorizontal(event.target)
    ) {
      return;
    }
    if (
      !event.defaultPrevented &&
      (event.key === "Enter" || event.key === " ") &&
      document.activeElement instanceof HTMLElement &&
      host.book.contains(document.activeElement) &&
      activateFocused()
    ) {
      event.preventDefault();
      return;
    }
    const page = host.getPage();
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      const next = navPages[Math.min(navPages.length - 1, navPages.indexOf(page) + 1)];
      if (next !== undefined) host.setPage(next);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      const prev = navPages[Math.max(0, navPages.indexOf(page) - 1)];
      if (prev !== undefined) host.setPage(prev);
    }
  };

  return { scrollActivePage, navigateFocus, activateFocused, handleKeydown };
}
