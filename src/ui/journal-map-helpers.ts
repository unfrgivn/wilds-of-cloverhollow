import { element, setAttribute } from "./dom";
import type {
  AtlasFilter,
  AtlasPinSummary,
  BusRoute,
  LandProgress,
  StorySoFar,
} from "../core/journal";
import type { TreasuresSummary } from "../core/treasures";

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type JournalMapLand = {
  id: string;
  name: string;
  busStop: boolean;
  x: number;
  y: number;
};

export type JournalMapView = {
  lands: readonly JournalMapLand[];
  currentLand: string | null;
  landProgress: Readonly<Record<string, LandProgress>>;
  landGuides?: Readonly<Record<string, string>>;
  busRoutes: readonly BusRoute[];
  storySoFar?: StorySoFar;
  atlasPins?: readonly AtlasPinSummary[];
  stickersOwned: number;
  stickersTotal: number;
  prizesOwned: number;
  prizesTotal: number;
  valleyComplete?: boolean;
  treasures?: TreasuresSummary;
};

export type JournalMapCollectionCounts = {
  fishOwned: number;
  fishTotal: number;
  keepsakesOwned: number;
  keepsakesTotal: number;
};

export type ObjectiveKind = "boss" | "gem" | "bus" | "garden" | "complete" | "sticker";

export type InspectorObjective = {
  kind: ObjectiveKind;
  text: string;
};

export type FilterButtonSpec = {
  id: AtlasFilter;
  label: string;
  hasCount: boolean;
  title: string;
};

export const ATLAS_FILTER_SPECS: readonly FilterButtonSpec[] = [
  { id: "all", label: "All", hasCount: false, title: "All Valley Lands" },
  { id: "gems", label: "Gems", hasCount: true, title: "Unfound Star Gems" },
  { id: "bosses", label: "Boss", hasCount: true, title: "Active Chaos Bosses" },
  { id: "bus", label: "Bus", hasCount: true, title: "Star-Line Bus Stops" },
];

function createSvgIcon(viewBox: string, markup: string, className?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  if (className !== undefined) svg.setAttribute("class", className);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

// The bus line's stop sign, as on the sprite: a gold star on a blue roundel atop a pole.
export function busStopIcon(): SVGSVGElement {
  return createSvgIcon(
    "0 0 20 30",
    '<rect x="9" y="14" width="2" height="15" rx="1" fill="#8a8f98" stroke="#47321f" ' +
      'stroke-width="0.8"/>' +
      '<circle cx="10" cy="9" r="8" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
      '<path d="M10 3.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6L10 11.8l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" ' +
      'fill="#f2c94c" stroke="#47321f" stroke-width="0.5"/>',
  );
}

export function atlasFilterIcon(filter: AtlasFilter): SVGSVGElement {
  const markup = filter === "all"
    ? '<circle cx="9" cy="9" r="7.2" fill="#fffaf2" stroke="#47321f" stroke-width="1.4"/>' +
      '<path d="M9 3.1l1.7 4.2 4.2 1.7-4.2 1.7L9 14.9l-1.7-4.2L3.1 9l4.2-1.7z" ' +
      'fill="#f2c94c" stroke="#47321f" stroke-width="1.1" stroke-linejoin="round"/>'
    : filter === "gems"
      ? '<path d="M9 2.2l5.6 4.4-5.6 9.2-5.6-9.2z" fill="#b580e8" stroke="#47321f" ' +
        'stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M9 2.2l2.4 4.4L9 15.8 6.6 6.6z" fill="#e8d4ff" opacity="0.72"/>'
      : filter === "bosses"
        ? '<path d="M9 2l1.8 3.2 3.6-.8-1.1 3.4 2.9 2.2-3.5 1 .4 3.6-3.1-1.9-3.1 1.9.4-3.6-3.5-1 ' +
          '2.9-2.2-1.1-3.4 3.6.8z" fill="#eb82a8" stroke="#47321f" stroke-width="1.2" ' +
          'stroke-linejoin="round"/>' +
          '<circle cx="9" cy="9.2" r="2.1" fill="#fff5d8" stroke="#47321f" stroke-width="1"/>'
        : '<rect x="8.2" y="10.2" width="1.6" height="6.2" rx="0.8" fill="#8a8f98" ' +
          'stroke="#47321f" stroke-width="0.7"/>' +
          '<circle cx="9" cy="6.8" r="5.1" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
          '<path d="M9 3.6l1 2.1 2.3.3-1.6 1.6.4 2.2L9 8.7l-2.1 1.1.4-2.2-1.6-1.6 2.3-.3z" ' +
          'fill="#f2c94c"/>';
  return createSvgIcon("0 0 18 18", markup, "journal-atlas-filter-icon");
}

export function atlasBadgeIcon(
  kind: "gem" | "boss" | "complete-full" | "complete-stickers",
): SVGSVGElement {
  const markup = kind === "gem"
    ? '<path d="M8 1.8l4.8 3.8L8 14.2 3.2 5.6z" fill="#b580e8" stroke="#47321f" ' +
      'stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M8 1.8l2 3.8L8 14.2 6 5.6z" fill="#f3e8ff" opacity="0.78"/>'
    : kind === "boss"
      ? '<path d="M8 1.8l1.6 2.8 3.1-.7-.9 3 2.5 1.9-3 .9.3 3.1L8 11.2 4.4 12.8l.3-3.1-3-.9 ' +
        '2.5-1.9-.9-3 3.1.7z" fill="#eb7fa8" stroke="#47321f" stroke-width="1.15" ' +
        'stroke-linejoin="round"/>' +
        '<circle cx="8" cy="8.2" r="1.9" fill="#fff5d8" stroke="#47321f" stroke-width="0.9"/>'
      : kind === "complete-full"
        ? '<path d="M8 1.7l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.4l-3.8 2 .7-4.2-3.1-3 4.3-.6z" ' +
          'fill="#f2c94c" stroke="#47321f" stroke-width="1.2" stroke-linejoin="round"/>'
        : '<path d="M3.2 8.4l3.1 3.1 6.5-6.6" fill="none" stroke="#47321f" stroke-width="2.1" ' +
          'stroke-linecap="round" stroke-linejoin="round"/>';
  return createSvgIcon("0 0 16 16", markup);
}

export function busRoutePath(
  from: { id: string; x: number; y: number },
  to: { id: string; x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const key = [from.id, to.id].sort().join("-");
  const bend = key === "bay-cloverhollow" ? 0.16 : key === "cloverhollow-pass" ? -0.32 : 0.14;
  const cx = Math.round(mx - dy * bend);
  const cy = Math.round(my + dx * bend);
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

export function resolveAtlasPins(view: JournalMapView): Map<string, AtlasPinSummary> {
  const pins = new Map<string, AtlasPinSummary>();
  if (view.atlasPins !== undefined && view.atlasPins.length > 0) {
    for (const pin of view.atlasPins) pins.set(pin.landId, pin);
    return pins;
  }
  const openBusLands = new Set<string>(["cloverhollow"]);
  for (const route of view.busRoutes) {
    if (!route.open) continue;
    openBusLands.add(route.from);
    openBusLands.add(route.to);
  }
  for (const land of view.lands) {
    const revealed = land.name !== "???";
    const stickers = view.landProgress[land.id] ?? { owned: 0, total: 0 };
    const busStop = !land.busStop
      ? "none"
      : openBusLands.has(land.id)
        ? "unlocked"
        : "on-foot";
    const stickersComplete = revealed && stickers.total > 0 && stickers.owned >= stickers.total;
    const objectives: string[] = [];
    if (revealed) {
      if (busStop === "unlocked") objectives.push("Bus stop unlocked");
      else if (busStop === "on-foot") objectives.push("Bus stop (visit on foot)");
      if (stickersComplete) objectives.push("All stickers found ✓");
      else if (stickers.total > 0) {
        const left = stickers.total - stickers.owned;
        objectives.push(`${left} sticker${left === 1 ? "" : "s"} to find`);
      }
    }
    pins.set(land.id, {
      landId: land.id,
      name: land.name,
      revealed,
      isCurrent: view.currentLand === land.id,
      stickers,
      gemsFound: 0,
      gemsTotal: 0,
      gemsRemaining: 0,
      activeBosses: [],
      hasUncalmedBoss: false,
      busStop,
      gardenNote: null,
      stickersComplete,
      landComplete: false,
      objectives,
    });
  }
  return pins;
}

export function classifyObjective(text: string, pin: AtlasPinSummary): ObjectiveKind {
  if (text.endsWith(" waiting")) return "boss";
  if (text.includes("Star Gem")) return "gem";
  if (text.startsWith("Bus stop")) return "bus";
  if (pin.gardenNote !== null && text === pin.gardenNote) return "garden";
  if (text.includes("100% complete") || text.includes("All stickers found")) return "complete";
  return "sticker";
}

export function buildFilterObjectives(
  filter: AtlasFilter,
  matching: readonly AtlasPinSummary[],
): InspectorObjective[] {
  if (matching.length === 0) {
    if (filter === "gems") {
      return [{ kind: "complete", text: "All revealed Star Gems found ✓" }];
    }
    if (filter === "bosses") {
      return [{ kind: "complete", text: "All revealed lands calm ✓" }];
    }
    return [{ kind: "bus", text: "No bus stops revealed yet" }];
  }
  return matching.map((pin): InspectorObjective => {
    if (filter === "gems") {
      return {
        kind: "gem",
        text: `${pin.name} · ${pin.gemsRemaining} ${pin.gemsRemaining === 1 ? "gem" : "gems"}`,
      };
    }
    if (filter === "bosses") {
      return {
        kind: "boss",
        text: `${pin.name} · ${pin.activeBosses.map((boss) => boss.name).join(", ")}`,
      };
    }
    return {
      kind: "bus",
      text: `${pin.name} · ${pin.busStop === "unlocked" ? "Unlocked" : "Visit on foot"}`,
    };
  });
}

export function createAtlasPinTray(
  land: JournalMapLand,
  pin: AtlasPinSummary,
  flags: { hasGem: boolean; hasBoss: boolean; hasComplete: boolean },
): HTMLSpanElement {
  const tray = element("span", "journal-atlas-pin-tray");
  setAttribute(tray, "data-land", land.id);
  tray.style.left = `${(land.x / 2400) * 100}%`;
  tray.style.top = `${(land.y / 1610) * 100}%`;
  const appendBadge = (
    cls: string,
    kind: string,
    label: string,
    icon: "gem" | "boss" | "complete-full" | "complete-stickers",
  ): HTMLSpanElement => {
    const badge = element("span", cls);
    setAttribute(badge, "data-badge", kind);
    setAttribute(badge, "data-land", land.id);
    setAttribute(badge, "aria-label", label);
    badge.append(atlasBadgeIcon(icon));
    tray.append(badge);
    return badge;
  };
  if (flags.hasGem) {
    const gemNoun = pin.gemsRemaining === 1 ? "Gem" : "Gems";
    appendBadge(
      "journal-atlas-badge is-gem",
      "gem",
      `${land.name}: ${pin.gemsRemaining} Star ${gemNoun} hidden`,
      "gem",
    );
  }
  if (flags.hasBoss) {
    const bosses = pin.activeBosses.map((boss) => boss.name).join(", ");
    appendBadge("journal-atlas-badge is-boss", "boss", `${land.name}: ${bosses} waiting`, "boss");
  }
  if (flags.hasComplete) {
    const label = pin.landComplete
      ? `${land.name} calm and 100% complete`
      : `${land.name} stickers complete`;
    const badge = appendBadge(
      "journal-atlas-badge is-complete journal-map-complete",
      "complete",
      label,
      pin.landComplete ? "complete-full" : "complete-stickers",
    );
    setAttribute(badge, "data-complete-kind", pin.landComplete ? "full" : "stickers");
  }
  return tray;
}
