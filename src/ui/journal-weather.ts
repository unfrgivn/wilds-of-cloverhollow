import "./journal-weather.css";
import { element, setAttribute, setText } from "./dom";
import {
  COZY_WEATHER_MODES, weatherEffects, weatherModeLabel, type CozyWeatherMode,
} from "../core/weather";
import {
  getCozyWeatherMode, setCozyWeatherMode, subscribeCozyWeather,
} from "../platform/weather-prefs";

const svgNamespace = "http://www.w3.org/2000/svg";

export type JournalWeatherAlmanac = {
  overlay: HTMLDivElement;
  treasuresBtn: HTMLButtonElement;
  open: (returnTarget?: HTMLElement | null) => void;
  sync: () => void;
  close: () => void;
  clear: () => void;
  isOpen: () => boolean;
  handleKeydown: (event: KeyboardEvent) => boolean;
};

const MODE_META: Readonly<Record<CozyWeatherMode, { sub: string; accent: string }>> = {
  clear: { sub: "Sunny & calm", accent: "#f3c95b" },
  auto: { sub: "Biome schedule", accent: "#8cc59e" },
  sunshower: { sub: "5-band rainbow", accent: "#7cc8f0" },
  "breeze-petals": { sub: "Floating petals", accent: "#f4a8c4" },
  "snow-flurry": { sub: "Alpine flakes", accent: "#9dd6f5" },
  "twilight-fireflies": { sub: "Glowing dusk", accent: "#d9d25c" },
};

const EMBLEM_MARKUP: Readonly<Record<CozyWeatherMode, string>> = {
  clear:
    '<circle cx="16" cy="16" r="6.4" fill="#ffe175" stroke="#47321f" stroke-width="1.7"/>' +
    '<path d="M 16 4.2 V 7.2 M 16 24.8 V 27.8 M 4.2 16 H 7.2 M 24.8 16 H 27.8 ' +
    "M 7.6 7.6 L 9.8 9.8 M 22.2 22.2 L 24.4 24.4 M 24.4 7.6 L 22.2 9.8 " +
    'M 9.8 22.2 L 7.6 24.4" stroke="#47321f" stroke-width="1.7" stroke-linecap="round"/>',
  sunshower:
    '<path d="M 5.5 18 A 10.5 10.5 0 0 1 26.5 18" fill="none" stroke="#ff9ebb" ' +
    'stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M 8.2 18 A 7.8 7.8 0 0 1 23.8 18" fill="none" stroke="#ffe580" ' +
    'stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M 10.8 18 A 5.2 5.2 0 0 1 21.2 18" fill="none" stroke="#9fd8ff" ' +
    'stroke-width="2.2" stroke-linecap="round"/>' +
    '<path d="M 5.5 18 A 10.5 10.5 0 0 1 26.5 18" fill="none" stroke="#47321f" ' +
    'stroke-width="1.15" stroke-linecap="round"/>' +
    '<path d="M 10.5 22 L 9.2 26.5 M 16.5 21.5 L 15.2 26.8 M 22.5 22 L 21.2 26.5" ' +
    'stroke="#64b8e8" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M 10.5 22 L 9.2 26.5 M 16.5 21.5 L 15.2 26.8 M 22.5 22 L 21.2 26.5" ' +
    'stroke="#47321f" stroke-width="0.9" stroke-linecap="round"/>',
  "breeze-petals":
    '<path d="M 4.5 13.5 H 19.5 C 22.5 13.5 23.5 10 20.5 9.2 C 18.6 8.7 17.5 10 18 11.4" ' +
    'fill="none" stroke="#47321f" stroke-width="1.65" stroke-linecap="round"/>' +
    '<path d="M 6.5 18.5 H 22.5 C 25.2 18.5 26 21.8 23.2 22.5" fill="none" ' +
    'stroke="#47321f" stroke-width="1.65" stroke-linecap="round"/>' +
    '<ellipse cx="10.2" cy="8.5" rx="3.2" ry="2.1" transform="rotate(-24 10.2 8.5)" ' +
    'fill="#ffb8d0" stroke="#47321f" stroke-width="1.3"/>' +
    '<ellipse cx="25.2" cy="12.5" rx="2.9" ry="1.9" transform="rotate(22 25.2 12.5)" ' +
    'fill="#fff0b8" stroke="#47321f" stroke-width="1.3"/>' +
    '<ellipse cx="12.5" cy="24.5" rx="3" ry="2" transform="rotate(-18 12.5 24.5)" ' +
    'fill="#b8f0cc" stroke="#47321f" stroke-width="1.3"/>',
  "snow-flurry":
    '<path d="M 16 5.5 V 26.5 M 6.8 10.8 L 25.2 21.2 M 25.2 10.8 L 6.8 21.2" ' +
    'stroke="#47321f" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M 13.5 8 L 16 10.2 L 18.5 8 M 13.5 24 L 16 21.8 L 18.5 24" ' +
    'fill="none" stroke="#47321f" stroke-width="1.45" stroke-linecap="round"/>' +
    '<circle cx="16" cy="16" r="3.4" fill="#d8f0ff" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="7" cy="24.5" r="1.7" fill="#ffffff" stroke="#47321f" stroke-width="1.15"/>' +
    '<circle cx="25.2" cy="7.2" r="1.7" fill="#d8f0ff" stroke="#47321f" stroke-width="1.15"/>',
  "twilight-fireflies":
    '<path d="M 17.5 6.8 A 9.2 9.2 0 1 0 24.8 20.6 A 7.2 7.2 0 1 1 17.5 6.8 Z" ' +
    'fill="#e2d4ff" stroke="#47321f" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="23.2" cy="10.2" r="2.7" fill="#ffe97a" stroke="#47321f" stroke-width="1.25"/>' +
    '<circle cx="19.5" cy="15.8" r="2.1" fill="#c4f78a" stroke="#47321f" stroke-width="1.15"/>' +
    '<circle cx="25.4" cy="16.2" r="1.7" fill="#fff5b8" stroke="#47321f" stroke-width="1.1"/>',
  auto:
    '<path d="M 16 7.5 V 26.5 M 11.5 26.5 H 20.5" stroke="#47321f" stroke-width="1.8" ' +
    'stroke-linecap="round"/>' +
    '<path d="M 6.5 14.2 H 24.8 M 21.8 11.4 L 25.5 14.2 L 21.8 17" fill="none" ' +
    'stroke="#47321f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polygon points="6.2,11.6 10.6,14.2 6.2,16.8" fill="#9fd8ff" stroke="#47321f" ' +
    'stroke-width="1.4" stroke-linejoin="round"/>' +
    '<circle cx="16" cy="7.2" r="3" fill="#ffe175" stroke="#47321f" stroke-width="1.45"/>',
};

/** Pure inner SVG markup for a hand-inked Cloverhollow weather emblem (zero `<text>` nodes). */
export function weatherEmblemMarkup(mode: CozyWeatherMode): string {
  return EMBLEM_MARKUP[mode];
}

/** Builds a hand-inked inline SVG weather emblem (zero `<text>` nodes). */
export function createWeatherEmblem(
  mode: CozyWeatherMode,
  className = "journal-weather-emblem",
): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = EMBLEM_MARKUP[mode];
  return svg;
}

function isFocusable(node: HTMLElement | null): node is HTMLElement {
  return node !== null && node.isConnected && node.closest("[hidden]") === null;
}

function makeEffectRow(
  parent: Element,
  keyLabel: string,
): HTMLSpanElement {
  const row = element("div", "journal-weather-effect-row", parent);
  element("span", "journal-weather-effect-key", row).textContent = keyLabel;
  return element("span", "journal-weather-effect-val", row);
}

function makeButton(className: string, ariaLabel?: string, text = ""): HTMLButtonElement {
  const btn = element("button", className);
  btn.type = "button";
  if (ariaLabel !== undefined) btn.setAttribute("aria-label", ariaLabel);
  if (text !== "") btn.textContent = text;
  return btn;
}

/** Creates the storybook Valley Sky Almanac modal for Fae's Journal. */
export function createJournalWeatherAlmanac(options?: {
  onBeforeOpen?: () => void;
  onVisibilityChange?: (open: boolean) => void;
  onClose?: () => void;
}): JournalWeatherAlmanac {
  const overlay = element("div", "journal-weather-overlay");
  overlay.hidden = true;
  const card = element("article", "journal-weather-card", overlay);
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Valley Sky Almanac");

  const head = element("div", "journal-weather-head", card);
  const titleWrap = element("div", "journal-weather-title-wrap", head);
  const title = element("h3", "journal-weather-title");
  title.textContent = "VALLEY SKY ALMANAC";
  const activePill = element("span", "journal-weather-pill");
  titleWrap.append(createWeatherEmblem("auto"), title, activePill);
  const closeBtn = makeButton("journal-weather-close", "Close Valley Sky Almanac", "×");
  head.append(closeBtn);

  const grid = element("div", "journal-weather-grid", card);
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Valley sky mode");
  const modeButtons = new Map<CozyWeatherMode, HTMLButtonElement>();
  for (const mode of COZY_WEATHER_MODES) {
    const btn = makeButton("journal-weather-option");
    setAttribute(btn, "data-weather-mode", mode);
    setAttribute(btn, "aria-pressed", "false");
    const copy = element("span", "journal-weather-option-copy");
    element("span", "journal-weather-option-label", copy).textContent = weatherModeLabel(mode);
    element("span", "journal-weather-option-sub", copy).textContent = MODE_META[mode].sub;
    btn.append(createWeatherEmblem(mode, "journal-weather-option-svg"), copy);
    btn.addEventListener("click", () => setCozyWeatherMode(mode));
    modeButtons.set(mode, btn);
    grid.append(btn);
  }

  const effectsCard = element("section", "journal-weather-effects", card);
  effectsCard.setAttribute("aria-live", "polite");
  const effectsHead = element("div", "journal-weather-effects-head", effectsCard);
  const effectsEyebrow = element("span", "journal-weather-effects-eyebrow", effectsHead);
  element("span", "journal-weather-effects-note", effectsHead).textContent =
    "Indoors stays sheltered & cozy";
  const fishVal = makeEffectRow(effectsCard, "Fish Forecast");
  const gardenVal = makeEffectRow(effectsCard, "Garden Dew");
  const moodVal = makeEffectRow(effectsCard, "Valley Mood");

  const treasuresBtn = makeButton(
    "journal-weather-btn", "Open Valley Sky Almanac", "☀ Sky Almanac",
  );

  let openState = false;
  let returnFocusEl: HTMLElement | null = null;

  const sync = (): void => {
    const active = getCozyWeatherMode();
    setText(activePill, weatherModeLabel(active));
    setAttribute(card, "data-weather-mode", active);
    for (const [mode, btn] of modeButtons) {
      setAttribute(btn, "aria-pressed", String(mode === active));
    }
    effectsCard.style.borderLeftColor = MODE_META[active].accent;
    if (active === "auto") {
      setText(effectsEyebrow, "SKY FORECAST · AUTO BIOME CYCLE");
      setText(fishVal, "Rotates every 60s across Town, Woods, Coast, Alpine & Enchanted.");
      setText(gardenVal, "+1 Garden Dew whenever a Rainbow Sunshower rolls through.");
      setText(moodVal, "Alpine peaks catch snow flurries while Woods glow with fireflies.");
      return;
    }
    const fx = weatherEffects(active);
    setText(effectsEyebrow, `SKY FORECAST · ${weatherModeLabel(active).toUpperCase()}`);
    setText(fishVal, fx.fishFlavor);
    setText(
      gardenVal,
      fx.gardenDewBonus > 0
        ? `+${fx.gardenDewBonus} Clubhouse Garden Dew bonus during sunshowers!`
        : "Steady cozy growth (sunshowers bring +1 extra garden dew).",
    );
    setText(moodVal, fx.moodNote);
  };

  const clear = (): void => {
    returnFocusEl = null;
    if (!openState && overlay.hidden) return;
    openState = false;
    overlay.hidden = true;
  };

  const close = (): void => {
    if (!openState && overlay.hidden) return;
    const target = returnFocusEl;
    clear();
    options?.onClose?.();
    options?.onVisibilityChange?.(false);
    if (isFocusable(target)) target.focus({ preventScroll: true });
  };

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  subscribeCozyWeather(sync);
  sync();

  const open = (returnTarget?: HTMLElement | null): void => {
    const wasOpen = openState;
    options?.onBeforeOpen?.();
    if (!openState) {
      returnFocusEl = returnTarget ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    openState = true;
    overlay.hidden = false;
    sync();
    card.focus({ preventScroll: true });
    if (!wasOpen) options?.onVisibilityChange?.(true);
  };
  const handleKeydown = (event: KeyboardEvent): boolean => {
    if (!openState) return false;
    if (["Escape", "x", "X", "b", "B"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    return true;
  };
  return {
    overlay, treasuresBtn, open, sync, close, clear,
    isOpen: () => openState, handleKeydown,
  };
}
