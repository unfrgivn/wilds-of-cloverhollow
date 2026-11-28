import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import { cycleIndex, isElementVisible } from "./journal-nav";
import {
  ATLAS_FILTER_SPECS,
  SVG_NAMESPACE,
  atlasFilterIcon,
  buildFilterObjectives,
  busRoutePath,
  busStopIcon,
  classifyObjective,
  createAtlasPinTray,
  resolveAtlasPins,
  type FilterButtonSpec,
  type InspectorObjective,
  type JournalMapCollectionCounts,
  type JournalMapLand,
  type JournalMapView,
} from "./journal-map-helpers";
import { matchesAtlasFilter, type AtlasFilter, type AtlasPinSummary } from "../core/journal";

export {
  busRoutePath,
  busStopIcon,
  type JournalMapCollectionCounts,
  type JournalMapLand,
  type JournalMapView,
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
  for (const spec of ATLAS_FILTER_SPECS) {
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
  filterGroup.addEventListener("keydown", (event) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    const buttons = [...filterButtons.values()]
      .map((entry) => entry.button)
      .filter(isElementVisible);
    if (buttons.length === 0) return;
    const active =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLButtonElement>(".journal-atlas-filter")
        : null;
    const currentIndex = active === null ? -1 : buttons.indexOf(active);
    const target =
      event.key === "Home"
        ? buttons[0]
        : event.key === "End"
          ? buttons[buttons.length - 1]
          : buttons[cycleIndex(currentIndex, buttons.length, event.key === "ArrowRight" ? 1 : -1)];
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    target.focus();
  });

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
  const mapRoutes = document.createElementNS(SVG_NAMESPACE, "svg");
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
    for (const container of [mapLabels, mapBadges]) {
      for (const node of container.children) {
        if (!(node instanceof HTMLElement)) continue;
        const landId = node.getAttribute("data-land");
        const pin = landId === null ? undefined : latestPins.get(landId);
        const matches = pin !== undefined && matchesAtlasFilter(pin, activeFilter);
        node.classList.toggle("is-filter-match", filtering && matches);
        node.classList.toggle("is-filter-dim", filtering && !matches);
      }
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
      const spec = ATLAS_FILTER_SPECS.find((item) => item.id === activeFilter);
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

  const stickerSuffix = (view: JournalMapView, landId: string): string => {
    const progress = view.landProgress[landId];
    return progress === undefined || progress.total === 0
      ? ""
      : ` · ${progress.owned}/${progress.total} stickers`;
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
      const text = guide !== undefined && guide.length > 0
        ? `${prefix}${guide}`
        : `${prefix}${inspected.name}${stickerSuffix(view, inspected.id)}`;
      setText(mapDetail, text);
      setAttribute(mapDetail, "title", text);
    } else {
      setText(mapDetail, `${prefix}${active.name}${stickerSuffix(view, active.id)}`);
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

  const visibleLandPins = (): HTMLElement[] =>
    [...mapLabels.querySelectorAll<HTMLElement>(".journal-map-land.is-revealed")].filter(
      isElementVisible,
    );

  const focusLandPin = (target: HTMLElement, alwaysNotify: boolean): void => {
    target.focus();
    const landId = target.matches(".journal-map-land") ? target.getAttribute("data-land") : null;
    if (landId === null) return;
    const changed = selectedLandId !== landId;
    selectedLandId = landId;
    hoveredLandId = null;
    if (latestView !== null) syncMapDetail(latestView);
    if (alwaysNotify || changed) options?.onSelectLand?.(landId);
  };

  const stepLandFocus = (delta: -1 | 1): boolean => {
    const items = visibleLandPins();
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
    const target = items[cycleIndex(currentIndex, items.length, delta)];
    if (target === undefined) return false;
    focusLandPin(target, true);
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
                return;
              }
              if (event.key !== "Home" && event.key !== "End") return;
              const pins = visibleLandPins();
              const target = event.key === "Home" ? pins[0] : pins[pins.length - 1];
              if (target === undefined) return;
              event.preventDefault();
              event.stopPropagation();
              focusLandPin(target, false);
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
          const halo = document.createElementNS(SVG_NAMESPACE, "path");
          halo.setAttribute(
            "class",
            route.open ? "journal-map-route-halo is-open" : "journal-map-route-halo",
          );
          halo.setAttribute("d", d);
          mapRoutes.append(halo);
          const line = document.createElementNS(SVG_NAMESPACE, "path");
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
        mapBadges.replaceChildren(
          ...badgedLands.map(({ land, pin, hasGem, hasBoss, hasComplete }) =>
            createAtlasPinTray(land, pin, { hasGem, hasBoss, hasComplete }),
          ),
        );
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
