import "./travel-overlay.css";
import { weatherLabel, type CozyWeatherKind } from "../core/weather";
import type { TravelMode, TravelVignetteSpec } from "../render/travel-vignette";
import { element, setAttribute, setStyle, setText, svgElement } from "./dom";
import type { HudInputMode } from "./hud-hints";
import { minigameWeatherIcon } from "./minigame-weather";

type ActiveWeatherKind = Exclude<CozyWeatherKind, "clear">;

export type TravelOverlayView = {
  visible: boolean;
  spec: TravelVignetteSpec | null;
  opacity: number;
  scale: number;
  progressPct: number;
  bobY: number;
  tiltDeg: number;
  touchActive?: boolean;
  inputMode?: HudInputMode;
  weather?: CozyWeatherKind;
};

/** Adapts the Travel Vignette skip button label for touch, gamepad, and keyboard input. */
export function travelSkipButtonLabel(options: {
  touchActive?: boolean;
  inputMode?: HudInputMode;
}): string {
  if (options.touchActive === true) return "Skip";
  if (options.inputMode === "gamepad") return "Skip · A";
  return "Skip · Z";
}

export type TravelOverlayController = {
  preload: (assetUrl: string) => void;
  render: (view: TravelOverlayView) => void;
  hide: () => void;
  isVisible: () => boolean;
  onSkip: (handler: (source: "pointer" | "key") => void) => void;
};

export function isTravelSkipKey(code: string): boolean {
  return (
    code === "KeyZ" ||
    code === "Space" ||
    code === "Enter" ||
    code === "KeyX" ||
    code === "Escape"
  );
}

function makeBusIcon(): SVGSVGElement {
  const svg = svgElement("svg", "travel-mode-icon");
  svg.setAttribute("viewBox", "0 0 24 18");
  svg.setAttribute("aria-hidden", "true");
  const body = svgElement("rect", "travel-icon-fill", svg);
  body.setAttribute("x", "2");
  body.setAttribute("y", "3");
  body.setAttribute("width", "20");
  body.setAttribute("height", "10");
  body.setAttribute("rx", "3");
  const win1 = svgElement("rect", "travel-icon-accent", svg);
  win1.setAttribute("x", "4.5");
  win1.setAttribute("y", "5.2");
  win1.setAttribute("width", "4.5");
  win1.setAttribute("height", "3.6");
  win1.setAttribute("rx", "0.8");
  const win2 = svgElement("rect", "travel-icon-accent", svg);
  win2.setAttribute("x", "10.5");
  win2.setAttribute("y", "5.2");
  win2.setAttribute("width", "4.5");
  win2.setAttribute("height", "3.6");
  win2.setAttribute("rx", "0.8");
  const win3 = svgElement("rect", "travel-icon-accent", svg);
  win3.setAttribute("x", "16.5");
  win3.setAttribute("y", "5.2");
  win3.setAttribute("width", "3.2");
  win3.setAttribute("height", "3.6");
  win3.setAttribute("rx", "0.8");
  const wheelL = svgElement("circle", "travel-icon-fill", svg);
  wheelL.setAttribute("cx", "7");
  wheelL.setAttribute("cy", "14");
  wheelL.setAttribute("r", "2.1");
  const wheelR = svgElement("circle", "travel-icon-fill", svg);
  wheelR.setAttribute("cx", "17");
  wheelR.setAttribute("cy", "14");
  wheelR.setAttribute("r", "2.1");
  return svg;
}

function makeBoatIcon(): SVGSVGElement {
  const svg = svgElement("svg", "travel-mode-icon");
  svg.setAttribute("viewBox", "0 0 24 18");
  svg.setAttribute("aria-hidden", "true");
  const hull = svgElement("path", "travel-icon-fill", svg);
  hull.setAttribute("d", "M 2.5 9.5 L 21.5 9.5 L 18.2 14 L 5.8 14 Z");
  const oar = svgElement("path", "travel-icon-stroke", svg);
  oar.setAttribute("d", "M 10.5 6.5 L 15 15.2");
  const seat = svgElement("path", "travel-icon-stroke", svg);
  seat.setAttribute("d", "M 8.2 9.5 L 8.2 6.8 L 13.4 6.8 L 13.4 9.5");
  const wave = svgElement("path", "travel-icon-stroke", svg);
  wave.setAttribute("d", "M 2 16.2 Q 5.5 14.5 9 16.2 T 16 16.2 T 22 16.2");
  return svg;
}

function makeLiftIcon(): SVGSVGElement {
  const svg = svgElement("svg", "travel-mode-icon");
  svg.setAttribute("viewBox", "0 0 24 18");
  svg.setAttribute("aria-hidden", "true");
  const cable = svgElement("path", "travel-icon-stroke", svg);
  cable.setAttribute("d", "M 1.5 4.2 L 22.5 1.8");
  const hanger = svgElement("path", "travel-icon-stroke", svg);
  hanger.setAttribute("d", "M 12 3 L 12 7");
  const cabin = svgElement("rect", "travel-icon-fill", svg);
  cabin.setAttribute("x", "5.5");
  cabin.setAttribute("y", "7");
  cabin.setAttribute("width", "13");
  cabin.setAttribute("height", "9");
  cabin.setAttribute("rx", "2.6");
  const glass = svgElement("rect", "travel-icon-accent", svg);
  glass.setAttribute("x", "7.8");
  glass.setAttribute("y", "9");
  glass.setAttribute("width", "8.4");
  glass.setAttribute("height", "3.8");
  glass.setAttribute("rx", "1");
  return svg;
}

function makeStarPin(): SVGSVGElement {
  const svg = svgElement("svg", "travel-star-svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  const star = svgElement("path", "travel-star-path", svg);
  star.setAttribute(
    "d",
    "M 9 1.6 L 11.1 6.4 L 16.4 7.1 L 12.4 10.6 L 13.6 15.8 L 9 13.1 " +
      "L 4.4 15.8 L 5.6 10.6 L 1.6 7.1 L 6.9 6.4 Z",
  );
  return svg;
}

type ModeIconSet = Record<TravelMode, SVGSVGElement>;

function mountModeIcons(parent: HTMLElement): ModeIconSet {
  const icons: ModeIconSet = {
    bus: makeBusIcon(),
    boat: makeBoatIcon(),
    lift: makeLiftIcon(),
  };
  parent.append(icons.bus, icons.boat, icons.lift);
  return icons;
}

function syncModeIcons(icons: ModeIconSet, active: TravelMode): void {
  icons.bus.toggleAttribute("hidden", active !== "bus");
  icons.boat.toggleAttribute("hidden", active !== "boat");
  icons.lift.toggleAttribute("hidden", active !== "lift");
}

export function createTravelOverlay(root: HTMLElement): TravelOverlayController {
  const overlay = element("section", "sticker-ui travel-overlay", root);
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "false");
  overlay.setAttribute("aria-live", "polite");
  overlay.hidden = true;

  const card = element("div", "travel-card", overlay);
  const artWrap = element("div", "travel-art-wrap", card);
  const art = element("img", "travel-art", artWrap);
  art.alt = "";
  art.decoding = "async";

  const weatherFx = element("div", "travel-weather-fx", artWrap);
  weatherFx.setAttribute("aria-hidden", "true");
  weatherFx.hidden = true;

  const badge = element("div", "travel-badge", artWrap);
  const badgeIconSlot = element("span", "travel-badge-icon", badge);
  const badgeIcons = mountModeIcons(badgeIconSlot);
  const badgeLabel = element("span", "travel-badge-label", badge);

  const weatherPill = element("div", "travel-weather-pill", artWrap);
  weatherPill.hidden = true;
  const weatherIconSlot = element("span", "travel-weather-icon", weatherPill);
  weatherIconSlot.setAttribute("aria-hidden", "true");
  const weatherLabelEl = element("span", "travel-weather-label", weatherPill);

  const footer = element("div", "travel-footer", card);
  const headerRow = element("div", "travel-header-row", footer);
  const caption = element("p", "travel-caption", headerRow);
  const skipButton = element("button", "travel-skip-btn", headerRow);
  skipButton.type = "button";
  skipButton.setAttribute("aria-label", "Skip travel vignette");

  const route = element("div", "travel-route", footer);
  const originEnd = element("div", "travel-endpoint is-origin", route);
  const originDot = element("span", "travel-dot is-origin", originEnd);
  originDot.setAttribute("aria-hidden", "true");
  const originLabel = element("span", "travel-stop-label", originEnd);

  const track = element("div", "travel-track", route);
  track.setAttribute("aria-hidden", "true");
  element("div", "travel-track-line", track);
  const trackFill = element("div", "travel-track-fill", track);
  const marker = element("div", "travel-marker", track);
  const markerIcons = mountModeIcons(marker);

  const destEnd = element("div", "travel-endpoint is-destination", route);
  const destLabel = element("span", "travel-stop-label", destEnd);
  const destDot = element("span", "travel-dot is-destination", destEnd);
  destDot.setAttribute("aria-hidden", "true");
  destDot.append(makeStarPin());

  const preloaded = new Set<string>();
  let visible = false;
  let lastAssetUrl = "";
  let lastMode: TravelMode | null = null;
  let lastWeather: ActiveWeatherKind | null = null;
  let skipHandler: ((source: "pointer" | "key") => void) | null = null;

  const preload = (assetUrl: string): void => {
    if (assetUrl === "" || preloaded.has(assetUrl)) return;
    preloaded.add(assetUrl);
    if (typeof Image === "undefined") return;
    const img = new Image();
    img.src = assetUrl;
    if (typeof img.decode === "function") {
      void img.decode().catch(() => undefined);
    }
  };

  const hide = (): void => {
    if (!visible && overlay.hidden) return;
    visible = false;
    overlay.hidden = true;
    overlay.removeAttribute("data-vignette-id");
    overlay.removeAttribute("data-travel-mode");
    weatherFx.hidden = true;
    weatherPill.hidden = true;
    weatherFx.removeAttribute("data-weather");
    weatherPill.removeAttribute("data-weather");
    lastWeather = null;
    delete document.documentElement.dataset.travelVignette;
  };

  const render = (view: TravelOverlayView): void => {
    if (!view.visible || view.spec === null) {
      hide();
      return;
    }
    const spec = view.spec;
    visible = true;
    overlay.hidden = false;
    document.documentElement.dataset.travelVignette = "open";
    setAttribute(overlay, "data-vignette-id", spec.id);
    setAttribute(overlay, "data-travel-mode", spec.mode);
    setStyle(card, "--travel-accent", spec.accentColor);
    setStyle(overlay, "--travel-opacity", view.opacity.toFixed(3));
    setStyle(card, "--travel-scale", view.scale.toFixed(4));

    if (lastAssetUrl !== spec.assetUrl) {
      lastAssetUrl = spec.assetUrl;
      art.src = spec.assetUrl;
    }
    if (lastMode !== spec.mode) {
      lastMode = spec.mode;
      syncModeIcons(badgeIcons, spec.mode);
      syncModeIcons(markerIcons, spec.mode);
    }

    setText(badgeLabel, spec.badgeLabel);
    setText(caption, spec.caption);
    setText(originLabel, spec.originLabel);
    setText(destLabel, spec.destinationLabel);
    setText(skipButton, travelSkipButtonLabel(view));

    const weather = view.weather;
    if (weather === undefined || weather === "clear") {
      weatherFx.hidden = true;
      weatherPill.hidden = true;
      if (lastWeather !== null) {
        weatherFx.removeAttribute("data-weather");
        weatherPill.removeAttribute("data-weather");
        lastWeather = null;
      }
    } else {
      weatherFx.hidden = false;
      weatherPill.hidden = false;
      if (lastWeather !== weather) {
        lastWeather = weather;
        setAttribute(weatherFx, "data-weather", weather);
        setAttribute(weatherPill, "data-weather", weather);
        weatherIconSlot.replaceChildren(minigameWeatherIcon(weather));
        setText(weatherLabelEl, weatherLabel(weather));
      }
    }

    const pct = Math.min(100, Math.max(0, view.progressPct));
    const pctValue = `${pct.toFixed(2)}%`;
    setStyle(trackFill, "width", pctValue);
    setStyle(marker, "--travel-pct", pctValue);
    setStyle(marker, "--travel-bob-y", `${view.bobY.toFixed(2)}px`);
    setStyle(marker, "--travel-tilt", `${view.tiltDeg.toFixed(2)}deg`);
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (!visible) return;
    event.preventDefault();
    event.stopPropagation();
    skipHandler?.("pointer");
  });

  skipButton.addEventListener("click", (event) => {
    if (!visible) return;
    event.preventDefault();
    event.stopPropagation();
    skipHandler?.("pointer");
  });

  if (typeof window !== "undefined") {
    window.addEventListener(
      "keydown",
      (event) => {
        if (!visible || event.repeat || !isTravelSkipKey(event.code)) return;
        if (document.documentElement.dataset.qaConsole === "open") return;
        if (
          event.target instanceof HTMLElement &&
          event.target.closest("input, textarea, select") !== null
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        skipHandler?.("key");
      },
      true,
    );
  }

  return {
    preload,
    render,
    hide,
    isVisible: () => visible,
    onSkip: (handler) => {
      skipHandler = handler;
    },
  };
}
