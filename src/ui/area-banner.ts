import "./area-banner.css";
import type { World } from "../core";
import { HOME_RECORD_AREAS, trackTitles, type JukeboxTrack } from "../core/music";
import { weatherBiomeForArea, weatherLabel, type CozyWeatherKind } from "../core/weather";
import { element, setStyle, setText, svgElement } from "./dom";

export type AreaBannerContext = {
  weather?: CozyWeatherKind;
  homeRecord?: JukeboxTrack | null;
};

export type AreaBannerInfo = {
  title: string;
  region: string | null;
};

export type AreaBannerView = {
  visible: boolean;
  title: string;
  region: string | null;
  progress: number;
  qaOffset?: boolean;
};

export type AreaBannerEnvelope = {
  opacity: number;
  offsetY: number;
};

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function areaBannerInfo(
  world: World,
  areaId: string,
  options?: AreaBannerContext,
): AreaBannerInfo | null {
  if (areaId === "harness") return null;
  const area = world.areas[areaId];
  if (area === undefined) return null;
  const title = area.name;
  const land = area.land === undefined
    ? undefined
    : world.lands.find((entry) => entry.id === area.land);
  const region = land !== undefined &&
    land.name.trim().toLowerCase() !== title.trim().toLowerCase()
    ? land.name
    : null;
  let suffix: string | null = null;
  if (options?.homeRecord != null && HOME_RECORD_AREAS.has(areaId)) {
    suffix = `♪ ${trackTitles[options.homeRecord]}`;
  } else if (
    options?.weather !== undefined &&
    options.weather !== "clear" &&
    weatherBiomeForArea(areaId) !== "indoor"
  ) {
    suffix = weatherLabel(options.weather);
  }
  const finalRegion = suffix !== null
    ? (region !== null ? `${region} · ${suffix}` : suffix)
    : region;
  return { title, region: finalRegion };
}

export function areaBannerEnvelope(progress: number): AreaBannerEnvelope {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0 || clamped >= 1) {
    return { opacity: 0, offsetY: clamped <= 0 ? -14 : -10 };
  }
  if (clamped < 0.14) {
    const t = smoothstep(clamped / 0.14);
    return { opacity: t, offsetY: -14 * (1 - t) };
  }
  if (clamped <= 0.82) {
    return { opacity: 1, offsetY: 0 };
  }
  const t = smoothstep((1 - clamped) / 0.18);
  return { opacity: t, offsetY: -10 * (1 - t) };
}

function makeSprig(side: "left" | "right"): SVGSVGElement {
  const svg = svgElement("svg", `area-banner-sprig is-${side}`);
  svg.setAttribute("viewBox", "0 0 18 12");
  svg.setAttribute("aria-hidden", "true");
  const stem = svgElement("path", "area-banner-sprig-stem", svg);
  stem.setAttribute("d", "M 2 9 Q 8 6.5 16 6");
  const leafTop = svgElement("path", "area-banner-sprig-leaf", svg);
  leafTop.setAttribute(
    "d",
    "M 6.5 6.8 C 7 2.8 11.5 2.4 13 5.8 C 10.6 7.1 8.4 7.4 6.5 6.8 Z",
  );
  const leafLow = svgElement("path", "area-banner-sprig-leaf", svg);
  leafLow.setAttribute(
    "d",
    "M 8.5 7.4 C 10.2 10.5 13.8 10.2 14.4 7.3 C 12.2 6.8 10.2 6.9 8.5 7.4 Z",
  );
  const star = svgElement("path", "area-banner-sprig-star", svg);
  star.setAttribute(
    "d",
    "M 3 2.5 L 3.8 4.2 L 5.6 4.8 L 3.8 5.4 L 3 7.1 L 2.2 5.4 L 0.4 4.8 L 2.2 4.2 Z",
  );
  return svg;
}

export function createAreaBanner(root: HTMLElement): {
  render: (view: AreaBannerView) => void;
} {
  const banner = element("aside", "sticker-ui area-banner", root);
  banner.setAttribute("aria-live", "polite");
  banner.hidden = true;

  const eyebrow = element("div", "area-banner-eyebrow", banner);
  const leftEyebrowSprig = makeSprig("left");
  const regionNode = element("span", "area-banner-region");
  const rightEyebrowSprig = makeSprig("right");
  eyebrow.append(leftEyebrowSprig, regionNode, rightEyebrowSprig);

  const titleRow = element("div", "area-banner-title-row", banner);
  const leftTitleSprig = makeSprig("left");
  const titleNode = element("span", "area-banner-title");
  const rightTitleSprig = makeSprig("right");
  titleRow.append(leftTitleSprig, titleNode, rightTitleSprig);

  let lastKey = "";

  return {
    render: (view) => {
      const qaOffset = view.qaOffset === true;
      const quantized = Math.round(Math.max(0, Math.min(1, view.progress)) * 1000);
      const shown = view.visible && view.title !== "" && quantized > 0 && quantized < 1000;
      const key = shown
        ? `1|${view.title}|${view.region ?? ""}|${quantized}|${qaOffset ? 1 : 0}`
        : "0";
      if (key === lastKey) return;
      lastKey = key;

      banner.hidden = !shown;
      if (!shown) return;

      const hasRegion = view.region !== null && view.region !== "";
      eyebrow.hidden = !hasRegion;
      leftTitleSprig.classList.toggle("is-hidden", hasRegion);
      rightTitleSprig.classList.toggle("is-hidden", hasRegion);
      if (hasRegion) setText(regionNode, view.region ?? "");
      setText(titleNode, view.title);
      banner.classList.toggle("has-qa-offset", qaOffset);

      const envelope = areaBannerEnvelope(view.progress);
      setStyle(banner, "opacity", envelope.opacity.toFixed(3));
      setStyle(banner, "--area-banner-y", `${envelope.offsetY.toFixed(2)}px`);
    },
  };
}
