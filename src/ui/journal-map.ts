import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import { cycleIndex, isElementVisible } from "./journal-nav";
import {
  matchesAtlasFilter,
  type AtlasFilter,
  type AtlasPinSummary,
  type BusRoute,
  type LandProgress,
  type StorySoFar,
} from "../core/journal";
import type { TreasuresSummary } from "../core/treasures";

const svgNamespace = "http://www.w3.org/2000/svg";

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

export type JournalMapPage = {
  root: HTMLElement;
  render: (view: JournalMapView, counts: JournalMapCollectionCounts) => void;
  resetSelection: () => void;
  stepLandFocus: (delta: -1 | 1) => boolean;
};

export type JournalMapOptions = {
  onSelectLand?: (landId: string | null) => void;
  onFilterChange?: (filter: AtlasFilter) => void;
};

type ObjectiveKind = "boss" | "gem" | "bus" | "garden" | "complete" | "sticker";

type InspectorObjective = {
  kind: ObjectiveKind;
  text: string;
};

type FilterButtonSpec = {
  id: AtlasFilter;
  label: string;
  hasCount: boolean;
  title: string;
};

const FILTER_SPECS: readonly FilterButtonSpec[] = [
  { id: "all", label: "All", hasCount: false, title: "All Valley Lands" },
  { id: "gems", label: "Gems", hasCount: true, title: "Unfound Star Gems" },
  { id: "bosses", label: "Boss", hasCount: true, title: "Active Chaos Bosses" },
  { id: "bus", label: "Bus", hasCount: true, title: "Star-Line Bus Stops" },
];

// The bus line's stop sign, as on the sprite: a gold star on a blue roundel
// atop a pole.
export function busStopIcon(): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 30");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<rect x="9" y="14" width="2" height="15" rx="1" fill="#8a8f98" stroke="#47321f" ' +
    'stroke-width="0.8"/>' +
    '<circle cx="10" cy="9" r="8" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
    '<path d="M10 3.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6L10 11.8l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" ' +
    'fill="#f2c94c" stroke="#47321f" stroke-width="0.5"/>';
  return svg;
}

function atlasFilterIcon(filter: AtlasFilter): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", "journal-atlas-filter-icon");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  if (filter === "all") {
    svg.innerHTML =
      '<circle cx="9" cy="9" r="7.2" fill="#fffaf2" stroke="#47321f" stroke-width="1.4"/>' +
      '<path d="M9 3.1l1.7 4.2 4.2 1.7-4.2 1.7L9 14.9l-1.7-4.2L3.1 9l4.2-1.7z" ' +
      'fill="#f2c94c" stroke="#47321f" stroke-width="1.1" stroke-linejoin="round"/>';
  } else if (filter === "gems") {
    svg.innerHTML =
      '<path d="M9 2.2l5.6 4.4-5.6 9.2-5.6-9.2z" fill="#b580e8" stroke="#47321f" ' +
      'stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M9 2.2l2.4 4.4L9 15.8 6.6 6.6z" fill="#e8d4ff" opacity="0.72"/>';
  } else if (filter === "bosses") {
    svg.innerHTML =
      '<path d="M9 2l1.8 3.2 3.6-.8-1.1 3.4 2.9 2.2-3.5 1 .4 3.6-3.1-1.9-3.1 1.9.4-3.6-3.5-1 ' +
      '2.9-2.2-1.1-3.4 3.6.8z" fill="#eb82a8" stroke="#47321f" stroke-width="1.2" ' +
      'stroke-linejoin="round"/>' +
      '<circle cx="9" cy="9.2" r="2.1" fill="#fff5d8" stroke="#47321f" stroke-width="1"/>';
  } else {
    svg.innerHTML =
      '<rect x="8.2" y="10.2" width="1.6" height="6.2" rx="0.8" fill="#8a8f98" stroke="#47321f" ' +
      'stroke-width="0.7"/>' +
      '<circle cx="9" cy="6.8" r="5.1" fill="#3f7fc0" stroke="#47321f" stroke-width="1.2"/>' +
      '<path d="M9 3.6l1 2.1 2.3.3-1.6 1.6.4 2.2L9 8.7l-2.1 1.1.4-2.2-1.6-1.6 2.3-.3z" ' +
      'fill="#f2c94c"/>';
  }
  return svg;
}

function atlasBadgeIcon(
  kind: "gem" | "boss" | "complete-full" | "complete-stickers",
): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  if (kind === "gem") {
    svg.innerHTML =
      '<path d="M8 1.8l4.8 3.8L8 14.2 3.2 5.6z" fill="#b580e8" stroke="#47321f" ' +
      'stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M8 1.8l2 3.8L8 14.2 6 5.6z" fill="#f3e8ff" opacity="0.78"/>';
  } else if (kind === "boss") {
    svg.innerHTML =
      '<path d="M8 1.8l1.6 2.8 3.1-.7-.9 3 2.5 1.9-3 .9.3 3.1L8 11.2 4.4 12.8l.3-3.1-3-.9 ' +
      '2.5-1.9-.9-3 3.1.7z" fill="#eb7fa8" stroke="#47321f" stroke-width="1.15" ' +
      'stroke-linejoin="round"/>' +
      '<circle cx="8" cy="8.2" r="1.9" fill="#fff5d8" stroke="#47321f" stroke-width="0.9"/>';
  } else if (kind === "complete-full") {
    svg.innerHTML =
      '<path d="M8 1.7l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.4l-3.8 2 .7-4.2-3.1-3 4.3-.6z" ' +
      'fill="#f2c94c" stroke="#47321f" stroke-width="1.2" stroke-linejoin="round"/>';
  } else {
    svg.innerHTML =
      '<path d="M3.2 8.4l3.1 3.1 6.5-6.6" fill="none" stroke="#47321f" stroke-width="2.1" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>';
  }
  return svg;
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

function resolveAtlasPins(view: JournalMapView): Map<string, AtlasPinSummary> {
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

function classifyObjective(text: string, pin: AtlasPinSummary): ObjectiveKind {
  if (text.endsWith(" waiting")) return "boss";
  if (text.includes("Star Gem")) return "gem";
  if (text.startsWith("Bus stop")) return "bus";
  if (pin.gardenNote !== null && text === pin.gardenNote) return "garden";
  if (text.includes("100% complete") || text.includes("All stickers found")) return "complete";
  return "sticker";
}

function buildFilterObjectives(
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

export function createJournalMapPage(
  onOpenTreasures: () => void,
  options?: JournalMapOptions,
): JournalMapPage {
  const mapPage = element("section", "journal-map-page");

  const storyBanner = element("div", "journal-atlas-story");
  storyBanner.setAttribute("role", "region");
  storyBanner.setAttribute("aria-label", "Story so far");
  storyBanner.hidden = true;
  const storyChapter = element("span", "journal-atlas-chapter");
  const storyGoal = element("span", "journal-atlas-goal");
  storyBanner.append(storyChapter, storyGoal);

  const mapStage = element("div", "journal-map-stage");

  const atlasRail = element("aside", "journal-atlas-rail");
  atlasRail.setAttribute("aria-label", "Valley Atlas controls");
  const filterGroup = element("div", "journal-atlas-filters");
  filterGroup.setAttribute("role", "group");
  filterGroup.setAttribute("aria-label", "Atlas pin filters");

  const filterButtons = new Map<
    AtlasFilter,
    { button: HTMLButtonElement; count: HTMLSpanElement | null; spec: FilterButtonSpec }
  >();
  for (const spec of FILTER_SPECS) {
    const button = element("button", "journal-atlas-filter");
    button.type = "button";
    setAttribute(button, "data-filter", spec.id);
    setAttribute(button, "aria-pressed", String(spec.id === "all"));
    const label = element("span", "journal-atlas-filter-label");
    label.textContent = spec.label;
    let count: HTMLSpanElement | null = null;
    if (spec.hasCount) {
      count = element("span", "journal-atlas-filter-count");
      count.textContent = "0";
      button.append(atlasFilterIcon(spec.id), label, count);
    } else {
      button.append(atlasFilterIcon(spec.id), label);
    }
    filterGroup.append(button);
    filterButtons.set(spec.id, { button, count, spec });
  }

  const inspector = element("div", "journal-atlas-inspector");
  inspector.setAttribute("aria-live", "polite");
  const inspectorHead = element("div", "journal-atlas-inspector-head");
  const inspectorEyebrow = element("span", "journal-atlas-eyebrow");
  const inspectorTitle = element("span", "journal-atlas-inspector-title");
  const inspectorStat = element("span", "journal-atlas-inspector-stat");
  inspectorHead.append(inspectorEyebrow, inspectorTitle, inspectorStat);
  const inspectorList = element("ul", "journal-atlas-objectives");
  inspector.append(inspectorHead, inspectorList);
  atlasRail.append(filterGroup, inspector);

  const mapCanvasWrap = element("div", "journal-map-canvas-wrap");
  const map = element("div", "journal-map");
  const mapRoutes = document.createElementNS(svgNamespace, "svg");
  mapRoutes.setAttribute("class", "journal-map-routes");
  mapRoutes.setAttribute("viewBox", "0 0 2400 1610");
  mapRoutes.setAttribute("aria-hidden", "true");
  const mapLabels = element("div", "journal-map-labels");
  const mapBadges = element("div", "journal-map-badges");
  const star = element("div", "journal-map-star");
  star.textContent = "★";
  star.setAttribute("aria-label", "You are here");
  map.append(mapRoutes, mapLabels, mapBadges, star);
  mapCanvasWrap.append(map);
  mapStage.append(atlasRail, mapCanvasWrap);

  const mapFooter = element("div", "journal-map-footer");
  const mapDetail = element("span", "journal-map-detail");
  const mapSummary = element("div", "journal-map-summary");
  const mapMasterCrest = element("span", "journal-master-crest");
  mapMasterCrest.textContent = "★ 100% Valley Explorer!";
  const mapStickersPill = element("span", "journal-map-pill");
  setAttribute(mapStickersPill, "data-stat", "stickers");
  const mapPrizesPill = element("span", "journal-map-pill");
  setAttribute(mapPrizesPill, "data-stat", "prizes");
  const mapFishPill = element("span", "journal-map-pill");
  setAttribute(mapFishPill, "data-stat", "fish");
  const mapKeepsakesPill = element("span", "journal-map-pill");
  setAttribute(mapKeepsakesPill, "data-stat", "keepsakes");
  const mapTreasuresBtn = element("button", "journal-treasures-btn");
  mapTreasuresBtn.type = "button";
  mapTreasuresBtn.hidden = true;
  mapTreasuresBtn.setAttribute("aria-label", "Open field treasures");
  const mapLegend = element("span", "journal-map-legend");
  mapLegend.append(busStopIcon(), "Bus");
  mapSummary.append(mapStickersPill, mapPrizesPill, mapTreasuresBtn, mapLegend);
  mapFooter.append(mapDetail, mapSummary);
  mapPage.append(storyBanner, mapStage, mapFooter);

  let mapSignature = "";
  let routeSignature = "";
  let badgeSignature = "";
  let inspectorSignature = "";
  let selectedLandId: string | null = null;
  let hoveredLandId: string | null = null;
  let activeFilter: AtlasFilter = "all";
  let latestView: JournalMapView | null = null;
  let latestPins: Map<string, AtlasPinSummary> = new Map();

  mapTreasuresBtn.addEventListener("click", () => {
    onOpenTreasures();
  });

  const syncFilterButtons = (pins: readonly AtlasPinSummary[]): void => {
    for (const [id, entry] of filterButtons) {
      const active = activeFilter === id;
      entry.button.classList.toggle("is-active", active);
      setAttribute(entry.button, "aria-pressed", String(active));
      if (entry.count !== null) {
        const matchCount = pins.filter((pin) => matchesAtlasFilter(pin, id)).length;
        setText(entry.count, String(matchCount));
        setAttribute(entry.button, "aria-label", `${entry.spec.title} (${matchCount})`);
      } else {
        setAttribute(entry.button, "aria-label", entry.spec.title);
      }
    }
  };

  const syncFilterHighlights = (): void => {
    const filtering = activeFilter !== "all";
    setAttribute(map, "data-atlas-filter", activeFilter);
    mapRoutes.classList.toggle("is-bus-focus", activeFilter === "bus");
    for (const node of mapLabels.children) {
      if (!(node instanceof HTMLElement)) continue;
      const landId = node.getAttribute("data-land");
      const pin = landId === null ? undefined : latestPins.get(landId);
      const matches = pin !== undefined && matchesAtlasFilter(pin, activeFilter);
      node.classList.toggle("is-filter-match", filtering && matches);
      node.classList.toggle("is-filter-dim", filtering && !matches);
    }
    for (const node of mapBadges.children) {
      if (!(node instanceof HTMLElement)) continue;
      const landId = node.getAttribute("data-land");
      const pin = landId === null ? undefined : latestPins.get(landId);
      const matches = pin !== undefined && matchesAtlasFilter(pin, activeFilter);
      node.classList.toggle("is-filter-match", filtering && matches);
      node.classList.toggle("is-filter-dim", filtering && !matches);
    }
  };

  const syncInspector = (view: JournalMapView): void => {
    const inspectId = hoveredLandId ?? selectedLandId;
    const inspectedPin =
      inspectId === null ? undefined : latestPins.get(inspectId);
    const activeInspected = inspectedPin?.revealed === true ? inspectedPin : undefined;
    const currentPin =
      view.currentLand === null ? undefined : latestPins.get(view.currentLand);
    const activeCurrent = currentPin?.revealed === true ? currentPin : undefined;

    let eyebrow = "HERE";
    let title = "Cloverhollow";
    let stat = "";
    let items: InspectorObjective[] = [];

    if (activeFilter !== "all" && activeInspected === undefined) {
      const spec = FILTER_SPECS.find((item) => item.id === activeFilter);
      const allPins = [...latestPins.values()];
      const matching = allPins.filter((pin) => matchesAtlasFilter(pin, activeFilter));
      eyebrow = "FILTER";
      title = spec?.title ?? "Atlas Filter";
      stat = `${matching.length} ${matching.length === 1 ? "land" : "lands"}`;
      items = buildFilterObjectives(activeFilter, matching);
    } else {
      const target = activeInspected ?? activeCurrent;
      if (target !== undefined) {
        eyebrow =
          activeInspected !== undefined && activeInspected.landId !== view.currentLand
            ? "PIN"
            : "HERE";
        title = target.name;
        stat = target.landComplete
          ? "★ 100%"
          : target.stickers.total > 0
            ? `${target.stickers.owned}/${target.stickers.total}`
            : "";
        items = target.objectives.map((text) => ({
          kind: classifyObjective(text, target),
          text,
        }));
      }
    }

    setText(inspectorEyebrow, eyebrow);
    setAttribute(inspectorEyebrow, "data-mode", eyebrow.toLowerCase());
    setText(inspectorTitle, title);
    setText(inspectorStat, stat);
    inspectorStat.hidden = stat.length === 0;

    const nextSig = items.map((item) => `${item.kind}:${item.text}`).join("|");
    if (nextSig !== inspectorSignature) {
      inspectorSignature = nextSig;
      inspectorList.replaceChildren(
        ...items.map((item) => {
          const li = element("li", "journal-atlas-objective");
          setAttribute(li, "data-kind", item.kind);
          li.textContent = item.text;
          return li;
        }),
      );
    }
  };

  const syncMapDetail = (view: JournalMapView): void => {
    const inspectId = hoveredLandId ?? selectedLandId;
    const inspected = inspectId === null
      ? undefined
      : view.lands.find((land) => land.id === inspectId && land.name !== "???");
    const current = view.lands.find((land) => land.id === view.currentLand);
    const active = inspected ?? current;
    const prefix = inspected !== undefined && inspected.id !== view.currentLand ? "" : "Here: ";
    if (active === undefined) {
      setText(mapDetail, "Cloverhollow World");
      if (mapDetail.hasAttribute("title")) mapDetail.removeAttribute("title");
    } else if (inspected !== undefined) {
      const guide = view.landGuides?.[inspected.id];
      if (guide !== undefined && guide.length > 0) {
        const text = `${prefix}${guide}`;
        setText(mapDetail, text);
        setAttribute(mapDetail, "title", text);
      } else {
        const progress = view.landProgress[inspected.id];
        const suffix =
          progress === undefined || progress.total === 0
            ? ""
            : ` · ${progress.owned}/${progress.total} stickers`;
        const text = `${prefix}${inspected.name}${suffix}`;
        setText(mapDetail, text);
        setAttribute(mapDetail, "title", text);
      }
    } else {
      const progress = view.landProgress[active.id];
      const suffix =
        progress === undefined || progress.total === 0
          ? ""
          : ` · ${progress.owned}/${progress.total} stickers`;
      setText(mapDetail, `${prefix}${active.name}${suffix}`);
      if (mapDetail.hasAttribute("title")) mapDetail.removeAttribute("title");
    }
    for (const node of mapLabels.children) {
      if (!(node instanceof HTMLElement)) continue;
      const landId = node.getAttribute("data-land");
      node.classList.toggle("is-selected", landId !== null && landId === selectedLandId);
    }
    syncFilterHighlights();
    syncInspector(view);
  };

  for (const [id, entry] of filterButtons) {
    entry.button.addEventListener("click", () => {
      activeFilter = id !== "all" && activeFilter === id ? "all" : id;
      syncFilterButtons([...latestPins.values()]);
      if (latestView !== null) syncMapDetail(latestView);
      else syncFilterHighlights();
      options?.onFilterChange?.(activeFilter);
    });
  }

  const syncBusStops = (view: JournalMapView): void => {
    for (const stop of mapLabels.querySelectorAll<HTMLElement>(".journal-map-stop")) {
      const landId = stop.getAttribute("data-land");
      if (landId === null) continue;
      const land = view.lands.find((entry) => entry.id === landId);
      const pin = latestPins.get(landId);
      const status = pin?.busStop === "on-foot" ? "on-foot" : "unlocked";
      setAttribute(stop, "data-bus-status", status);
      stop.classList.toggle("is-on-foot", status === "on-foot");
      const name = land?.name ?? landId;
      setAttribute(
        stop,
        "aria-label",
        status === "on-foot" ? `Bus stop (on foot): ${name}` : `Bus stop unlocked: ${name}`,
      );
    }
  };

  const stepLandFocus = (delta: -1 | 1): boolean => {
    const items: HTMLElement[] = [
      ...mapLabels.querySelectorAll<HTMLElement>(".journal-map-land.is-revealed"),
    ].filter(isElementVisible);
    if (isElementVisible(mapTreasuresBtn)) items.push(mapTreasuresBtn);
    for (const entry of filterButtons.values()) {
      if (isElementVisible(entry.button)) items.push(entry.button);
    }
    if (items.length === 0) return false;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let currentIndex = active === null ? -1 : items.indexOf(active);
    if (currentIndex === -1 && selectedLandId !== null) {
      currentIndex = items.findIndex((node) => node.getAttribute("data-land") === selectedLandId);
    }
    const nextIndex = cycleIndex(currentIndex, items.length, delta);
    const target = items[nextIndex];
    if (target === undefined) return false;
    target.focus();
    const landId = target.matches(".journal-map-land") ? target.getAttribute("data-land") : null;
    if (landId !== null) {
      selectedLandId = landId;
      hoveredLandId = null;
      if (latestView !== null) syncMapDetail(latestView);
      options?.onSelectLand?.(landId);
    }
    return true;
  };

  return {
    root: mapPage,
    stepLandFocus,
    resetSelection: () => {
      selectedLandId = null;
      hoveredLandId = null;
      activeFilter = "all";
      syncFilterButtons([...latestPins.values()]);
      if (latestView !== null) syncMapDetail(latestView);
      else syncFilterHighlights();
    },
    render: (view, counts) => {
      latestView = view;
      latestPins = resolveAtlasPins(view);
      const pinList = [...latestPins.values()];

      if (view.storySoFar !== undefined) {
        storyBanner.hidden = false;
        setText(storyChapter, view.storySoFar.chapter);
        setText(storyGoal, view.storySoFar.goal);
      } else {
        storyBanner.hidden = true;
      }

      syncFilterButtons(pinList);

      const nextMapSignature = view.lands
        .map((land) => `${land.id}:${land.name}:${land.busStop}:${land.x}:${land.y}`)
        .join("|");
      if (nextMapSignature !== mapSignature) {
        mapSignature = nextMapSignature;
        mapLabels.replaceChildren();
        view.lands.forEach((land: JournalMapLand) => {
          const item = element("span", "journal-map-land");
          item.textContent = land.name;
          item.style.left = `${(land.x / 2400) * 100}%`;
          item.style.top = `${(land.y / 1610) * 100}%`;
          setAttribute(item, "data-land", land.id);
          const revealed = land.name !== "???";
          if (revealed) {
            item.classList.add("is-revealed");
            setAttribute(item, "tabindex", "0");
            setAttribute(item, "role", "button");
            const toggleSelect = (): void => {
              selectedLandId = selectedLandId === land.id ? null : land.id;
              if (latestView !== null) syncMapDetail(latestView);
              options?.onSelectLand?.(selectedLandId);
            };
            item.addEventListener("click", toggleSelect);
            item.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleSelect();
              }
            });
            item.addEventListener("pointerenter", () => {
              hoveredLandId = land.id;
              if (latestView !== null) syncMapDetail(latestView);
            });
            item.addEventListener("pointerleave", () => {
              if (hoveredLandId === land.id) {
                hoveredLandId = null;
                if (latestView !== null) syncMapDetail(latestView);
              }
            });
          }
          mapLabels.append(item);
          if (!land.busStop) return;
          // The bus line's sign (a gold star on a blue roundel) leads the name.
          const stop = element("span", "journal-map-stop");
          setAttribute(stop, "data-land", land.id);
          stop.append(busStopIcon());
          item.prepend(stop);
        });
      }
      syncBusStops(view);

      const landLookup = new Map(view.lands.map((land) => [land.id, land]));
      const nextRouteSignature = view.busRoutes
        .map((route) => {
          const a = landLookup.get(route.from);
          const b = landLookup.get(route.to);
          return (
            `${route.from}-${route.to}:${route.open}:` +
            `${a?.x ?? 0},${a?.y ?? 0}:${b?.x ?? 0},${b?.y ?? 0}`
          );
        })
        .join("|");
      if (nextRouteSignature !== routeSignature) {
        routeSignature = nextRouteSignature;
        mapRoutes.replaceChildren();
        for (const route of view.busRoutes) {
          const from = landLookup.get(route.from);
          const to = landLookup.get(route.to);
          if (from === undefined || to === undefined) continue;
          const d = busRoutePath(from, to);
          const halo = document.createElementNS(svgNamespace, "path");
          halo.setAttribute(
            "class",
            route.open ? "journal-map-route-halo is-open" : "journal-map-route-halo",
          );
          halo.setAttribute("d", d);
          mapRoutes.append(halo);
          const line = document.createElementNS(svgNamespace, "path");
          line.setAttribute(
            "class",
            route.open ? "journal-map-route is-open" : "journal-map-route",
          );
          line.setAttribute("data-route", `${route.from}-${route.to}`);
          line.setAttribute("data-open", String(route.open));
          line.setAttribute("d", d);
          mapRoutes.append(line);
        }
      }

      const badgedLands = view.lands.flatMap((land) => {
        const pin = latestPins.get(land.id);
        if (pin === undefined || !pin.revealed) return [];
        const hasGem = pin.gemsRemaining > 0;
        const hasBoss = pin.hasUncalmedBoss;
        const hasComplete = pin.stickersComplete || pin.landComplete;
        if (!hasGem && !hasBoss && !hasComplete) return [];
        return [{ land, pin, hasGem, hasBoss, hasComplete }];
      });
      const nextBadgeSignature = badgedLands
        .map(
          ({ land, pin, hasGem, hasBoss, hasComplete }) =>
            `${land.id}:${land.x}:${land.y}:${hasGem ? pin.gemsRemaining : 0}:` +
            `${hasBoss ? pin.activeBosses.map((boss) => boss.id).join(",") : ""}:` +
            `${hasComplete ? (pin.landComplete ? "full" : "stickers") : "none"}`,
        )
        .join("|");
      if (nextBadgeSignature !== badgeSignature) {
        badgeSignature = nextBadgeSignature;
        mapBadges.replaceChildren();
        for (const { land, pin, hasGem, hasBoss, hasComplete } of badgedLands) {
          const tray = element("span", "journal-atlas-pin-tray");
          setAttribute(tray, "data-land", land.id);
          tray.style.left = `${(land.x / 2400) * 100}%`;
          tray.style.top = `${(land.y / 1610) * 100}%`;
          if (hasGem) {
            const gemBadge = element("span", "journal-atlas-badge is-gem");
            setAttribute(gemBadge, "data-badge", "gem");
            setAttribute(gemBadge, "data-land", land.id);
            const gemNoun = pin.gemsRemaining === 1 ? "Gem" : "Gems";
            setAttribute(
              gemBadge,
              "aria-label",
              `${land.name}: ${pin.gemsRemaining} Star ${gemNoun} hidden`,
            );
            gemBadge.append(atlasBadgeIcon("gem"));
            tray.append(gemBadge);
          }
          if (hasBoss) {
            const bossBadge = element("span", "journal-atlas-badge is-boss");
            setAttribute(bossBadge, "data-badge", "boss");
            setAttribute(bossBadge, "data-land", land.id);
            setAttribute(
              bossBadge,
              "aria-label",
              `${land.name}: ${pin.activeBosses.map((boss) => boss.name).join(", ")} waiting`,
            );
            bossBadge.append(atlasBadgeIcon("boss"));
            tray.append(bossBadge);
          }
          if (hasComplete) {
            const completeKind = pin.landComplete ? "full" : "stickers";
            const completeBadge = element(
              "span",
              "journal-atlas-badge is-complete journal-map-complete",
            );
            setAttribute(completeBadge, "data-badge", "complete");
            setAttribute(completeBadge, "data-land", land.id);
            setAttribute(completeBadge, "data-complete-kind", completeKind);
            setAttribute(
              completeBadge,
              "aria-label",
              pin.landComplete
                ? `${land.name} calm and 100% complete`
                : `${land.name} stickers complete`,
            );
            completeBadge.append(
              atlasBadgeIcon(pin.landComplete ? "complete-full" : "complete-stickers"),
            );
            tray.append(completeBadge);
          }
          mapBadges.append(tray);
        }
      }

      const showMasterCrest = view.valleyComplete === true;
      if (showMasterCrest) {
        if (!mapMasterCrest.isConnected) mapSummary.prepend(mapMasterCrest);
      } else if (mapMasterCrest.isConnected) {
        mapMasterCrest.remove();
      }
      mapFooter.classList.toggle("has-master-crest", showMasterCrest);
      setText(mapStickersPill, `Stickers ${view.stickersOwned}/${view.stickersTotal}`);
      setText(mapPrizesPill, `Prizes ${view.prizesOwned}/${view.prizesTotal}`);
      const showFish = counts.fishOwned > 0;
      syncAttachedAfter(mapPrizesPill, mapFishPill, showFish);
      if (showFish) setText(mapFishPill, `Fish ${counts.fishOwned}/${counts.fishTotal}`);
      const showKeepsakes = counts.keepsakesOwned > 0;
      syncAttachedAfter(showFish ? mapFishPill : mapPrizesPill, mapKeepsakesPill, showKeepsakes);
      if (showKeepsakes) {
        setText(mapKeepsakesPill, `Keepsakes ${counts.keepsakesOwned}/${counts.keepsakesTotal}`);
      }
      const treasures = view.treasures;
      const showTreasures = treasures !== undefined && treasures.hasAny;
      mapTreasuresBtn.hidden = !showTreasures;
      if (showTreasures) {
        setText(
          mapTreasuresBtn,
          `Treasures · ${treasures.unlockedKeepsakes}/${treasures.totalKeepsakes}`,
        );
      }
      syncMapDetail(view);

      const here = view.lands.find((land) => land.id === view.currentLand);
      star.hidden = here === undefined;
      setAttribute(star, "data-land", here?.id ?? "");
      if (here !== undefined) {
        // Just above the land's name, so the name stays readable.
        star.style.left = `${(here.x / 2400) * 100}%`;
        star.style.top = `${(here.y / 1610) * 100 - 8.5}%`;
      }
    },
  };
}
