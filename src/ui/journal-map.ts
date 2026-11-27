import { element, setAttribute, setText, syncAttachedAfter } from "./dom";
import type { BusRoute, LandProgress } from "../core/journal";
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
};

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

export function createJournalMapPage(onOpenTreasures: () => void): JournalMapPage {
  const mapPage = element("section", "journal-map-page");
  const mapStage = element("div", "journal-map-stage");
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
  mapStage.append(map);

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
  mapPage.append(mapStage, mapFooter);

  let mapSignature = "";
  let routeSignature = "";
  let badgeSignature = "";
  let selectedLandId: string | null = null;
  let hoveredLandId: string | null = null;
  let latestView: JournalMapView | null = null;

  mapTreasuresBtn.addEventListener("click", () => {
    onOpenTreasures();
  });

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
  };

  return {
    root: mapPage,
    resetSelection: () => {
      selectedLandId = null;
      hoveredLandId = null;
    },
    render: (view, counts) => {
      latestView = view;
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
            item.addEventListener("click", () => {
              selectedLandId = selectedLandId === land.id ? null : land.id;
              if (latestView !== null) syncMapDetail(latestView);
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
          setAttribute(stop, "aria-label", `Bus stop: ${land.name}`);
          stop.append(busStopIcon());
          item.prepend(stop);
        });
      }

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

      const completedLands = view.lands.filter((land) => {
        if (land.name === "???") return false;
        const progress = view.landProgress[land.id];
        return progress !== undefined && progress.total > 0 && progress.owned >= progress.total;
      });
      const nextBadgeSignature = completedLands
        .map((land) => `${land.id}:${land.x}:${land.y}`)
        .join("|");
      if (nextBadgeSignature !== badgeSignature) {
        badgeSignature = nextBadgeSignature;
        mapBadges.replaceChildren();
        for (const land of completedLands) {
          const badge = element("span", "journal-map-complete");
          badge.textContent = "✓";
          badge.style.left = `${(land.x / 2400) * 100}%`;
          badge.style.top = `${(land.y / 1610) * 100}%`;
          setAttribute(badge, "data-land", land.id);
          setAttribute(badge, "aria-label", `${land.name} stickers complete`);
          mapBadges.append(badge);
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
        star.style.top = `${(here.y / 1610) * 100 - 7}%`;
      }
    },
  };
}
