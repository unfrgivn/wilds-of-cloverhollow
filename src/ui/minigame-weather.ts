import "./minigame-weather.css";
import { weatherForArea, type CozyWeatherKind } from "../core/weather";
import { getCozyWeatherMode } from "../platform/weather-prefs";
import { element, setAttribute, setText, svgElement } from "./dom";

export type MinigameWeatherVariant = "fish" | "taco";

export type MinigameWeatherLayer = {
  fx: HTMLDivElement;
  pill: HTMLDivElement;
  sync: (areaId: string, tick: number, visible: boolean) => void;
};

type ActiveWeatherKind = Exclude<CozyWeatherKind, "clear">;
type SvgSpec = readonly ["path" | "circle" | "ellipse", Readonly<Record<string, string>>];

const FISH_FLAVORS: Readonly<Record<ActiveWeatherKind, string>> = {
  sunshower: "+15% bite charm",
  "breeze-petals": "+8% gentle charm",
  "snow-flurry": "+5% crisp clarity",
  "twilight-fireflies": "+12% dusk charm",
};

const TACO_FLAVORS: Readonly<Record<ActiveWeatherKind, string>> = {
  sunshower: "Cozy awning",
  "breeze-petals": "Breezy window",
  "snow-flurry": "Warm griddle",
  "twilight-fireflies": "Lantern shift",
};

const EMBLEM_SHAPES: Readonly<Record<ActiveWeatherKind, readonly SvgSpec[]>> = {
  sunshower: [
    ["path", { d: "M4 13.5 A8 8 0 0 1 20 13.5", fill: "none", stroke: "#ff9ebb",
      "stroke-width": "2.2", "stroke-linecap": "round" }],
    ["path", { d: "M6.2 13.5 A5.8 5.8 0 0 1 17.8 13.5", fill: "none", stroke: "#ffe580",
      "stroke-width": "2", "stroke-linecap": "round" }],
    ["path", { d: "M8.3 13.5 A3.7 3.7 0 0 1 15.7 13.5", fill: "none", stroke: "#9fd8ff",
      "stroke-width": "1.8", "stroke-linecap": "round" }],
    ["path", { d: "M4 13.5 A8 8 0 0 1 20 13.5", fill: "none", stroke: "#47321f",
      "stroke-width": "1", "stroke-linecap": "round" }],
    ["path", { d: "M8 16.5 L7 20 M12.5 16.2 L11.5 20.2 M17 16.5 L16 20",
      stroke: "#64b8e8", "stroke-width": "1.8", "stroke-linecap": "round" }],
  ],
  "breeze-petals": [
    ["path", { d: "M3.5 10.5 H14.5 C17 10.5 17.6 7.8 15.4 7.2 C13.9 6.8 13.2 7.8 13.5 8.8",
      fill: "none", stroke: "#47321f", "stroke-width": "1.5", "stroke-linecap": "round" }],
    ["path", { d: "M5 14.5 H17 C19.2 14.5 19.8 17 17.6 17.6",
      fill: "none", stroke: "#47321f", "stroke-width": "1.5", "stroke-linecap": "round" }],
    ["ellipse", { cx: "8", cy: "6.4", rx: "2.5", ry: "1.6", transform: "rotate(-22 8 6.4)",
      fill: "#ffb8d0", stroke: "#47321f", "stroke-width": "1.1" }],
    ["ellipse", { cx: "18.8", cy: "9.8", rx: "2.2", ry: "1.5", transform: "rotate(20 18.8 9.8)",
      fill: "#fff0b8", stroke: "#47321f", "stroke-width": "1.1" }],
    ["ellipse", { cx: "9.5", cy: "18.5", rx: "2.3", ry: "1.5", transform: "rotate(-16 9.5 18.5)",
      fill: "#b8f0cc", stroke: "#47321f", "stroke-width": "1.1" }],
  ],
  "snow-flurry": [
    ["path", { d: "M12 4 V20 M5.1 8 L18.9 16 M18.9 8 L5.1 16",
      stroke: "#47321f", "stroke-width": "1.6", "stroke-linecap": "round" }],
    ["circle", { cx: "12", cy: "12", r: "2.7", fill: "#d8f0ff", stroke: "#47321f",
      "stroke-width": "1.3" }],
    ["circle", { cx: "5.5", cy: "18.5", r: "1.4", fill: "#ffffff", stroke: "#47321f",
      "stroke-width": "1" }],
    ["circle", { cx: "18.8", cy: "5.5", r: "1.4", fill: "#d8f0ff", stroke: "#47321f",
      "stroke-width": "1" }],
  ],
  "twilight-fireflies": [
    ["path", { d: "M13.2 5 A7 7 0 1 0 18.8 15.6 A5.5 5.5 0 1 1 13.2 5 Z",
      fill: "#e2d4ff", stroke: "#47321f", "stroke-width": "1.4", "stroke-linejoin": "round" }],
    ["circle", { cx: "17.6", cy: "7.8", r: "2.1", fill: "#ffe97a", stroke: "#47321f",
      "stroke-width": "1.1" }],
    ["circle", { cx: "14.8", cy: "12", r: "1.7", fill: "#c4f78a", stroke: "#47321f",
      "stroke-width": "1" }],
    ["circle", { cx: "19.2", cy: "12.4", r: "1.3", fill: "#fff5b8", stroke: "#47321f",
      "stroke-width": "0.95" }],
  ],
};

/** Pure flavor subtitle for outdoor minigame weather pills, or `""` on clear skies. */
export function minigameWeatherFlavor(
  variant: MinigameWeatherVariant,
  kind: CozyWeatherKind,
): string {
  if (kind === "clear") return "";
  return variant === "fish" ? FISH_FLAVORS[kind] : TACO_FLAVORS[kind];
}

/** Hand-inked inline SVG emblem for active outdoor minigame weather (zero `<text>` nodes). */
export function minigameWeatherIcon(kind: ActiveWeatherKind): SVGSVGElement {
  const svg = svgElement("svg", "minigame-weather-svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of EMBLEM_SHAPES[kind]) {
    const node = svgElement(tag, "", svg);
    node.removeAttribute("class");
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  }
  return svg;
}

/**
 * Mounts subtle outdoor watercolor weather FX + compact die-cut sky pill inside
 * Fishing or Taco Truck stage frames. Hidden completely when sky is `"clear"`.
 */
export function createMinigameWeatherLayer(
  host: HTMLElement,
  variant: MinigameWeatherVariant,
): MinigameWeatherLayer {
  const fx = element("div", `minigame-weather-fx is-${variant}`, host);
  fx.setAttribute("aria-hidden", "true");
  fx.hidden = true;
  const pill = element("div", `minigame-weather-pill is-${variant}`, host);
  pill.setAttribute("aria-live", "polite");
  pill.hidden = true;
  const iconSlot = element("span", "minigame-weather-icon", pill);
  iconSlot.setAttribute("aria-hidden", "true");
  const copy = element("span", "minigame-weather-copy", pill);
  const label = element("span", "minigame-weather-label", copy);
  const flavor = element("span", "minigame-weather-flavor", copy);
  let renderedKind: ActiveWeatherKind | null = null;

  return {
    fx,
    pill,
    sync: (areaId, tick, visible) => {
      if (!visible) {
        fx.hidden = true;
        pill.hidden = true;
        return;
      }
      const info = weatherForArea(areaId, tick, getCozyWeatherMode());
      if (info.kind === "clear") {
        fx.hidden = true;
        pill.hidden = true;
        return;
      }
      fx.hidden = false;
      pill.hidden = false;
      if (renderedKind !== info.kind) {
        renderedKind = info.kind;
        setAttribute(fx, "data-weather", info.kind);
        setAttribute(pill, "data-weather", info.kind);
        iconSlot.replaceChildren(minigameWeatherIcon(info.kind));
        setText(label, info.label);
        const tag = minigameWeatherFlavor(variant, info.kind);
        setText(flavor, tag);
        flavor.hidden = tag.length === 0;
      }
    },
  };
}
