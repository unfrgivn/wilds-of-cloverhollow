import { Container, Graphics } from "pixi.js";
import { distance, type Area, type NavField, type Point, type Polygon, type State } from "../core";
import type { NavPathSnapshot } from "../shell/nav-steer";

const EXIT_CUE_RANGE = 210;
const EXIT_CUE_MAX_ALPHA = 0.48;
const TIGHT_MARGIN = 12;
const FALSE_GAP_MIN_CLEARANCE = 8;

function polygonCentroid(polygon: Polygon): Point | null {
  if (polygon.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of polygon) {
    sumX += x;
    sumY += y;
  }
  return { x: sumX / polygon.length, y: sumY / polygon.length };
}

function drawHeatmap(graphics: Graphics, field: NavField): void {
  graphics.clear();
  const { cols, rows, cellSize, radius, clearance, reachable } = field;
  const half = cellSize * 0.5;
  const comfortable: Point[] = [];
  const tight: Point[] = [];
  const falseGap: Point[] = [];
  const unreachable: Point[] = [];

  for (let gy = 0; gy < rows; gy += 1) {
    const wy = gy * cellSize - half;
    const rowOffset = gy * cols;
    for (let gx = 0; gx < cols; gx += 1) {
      const idx = rowOffset + gx;
      const c = clearance[idx] ?? -Infinity;
      const wx = gx * cellSize - half;
      if (c >= radius) {
        if (reachable[idx] === 0) unreachable.push({ x: wx, y: wy });
        else if (c >= radius + TIGHT_MARGIN) comfortable.push({ x: wx, y: wy });
        else tight.push({ x: wx, y: wy });
      } else if (c > FALSE_GAP_MIN_CLEARANCE) {
        falseGap.push({ x: wx, y: wy });
      }
    }
  }

  const paintBucket = (cells: readonly Point[], color: number, alpha: number): void => {
    if (cells.length === 0) return;
    for (const cell of cells) graphics.rect(cell.x, cell.y, cellSize, cellSize);
    graphics.fill({ color, alpha });
  };

  paintBucket(comfortable, 0x4caf50, 0.18);
  paintBucket(tight, 0xffb300, 0.36);
  paintBucket(falseGap, 0xe53935, 0.44);
  paintBucket(unreachable, 0x8e24aa, 0.5);
}

export class NavOverlayController {
  readonly groundLayer = new Container();
  readonly debugLayer = new Container();
  private readonly exitCueGraphics = new Graphics();
  private readonly goalRingGraphics = new Graphics();
  private readonly heatmapGraphics = new Graphics();
  private readonly pathGraphics = new Graphics();
  private heatmapVisible = false;
  private cachedAreaId: string | null = null;
  private cachedField: NavField | null = null;

  constructor() {
    this.groundLayer.label = "nav-ground";
    this.groundLayer.addChild(this.exitCueGraphics, this.goalRingGraphics);
    this.debugLayer.label = "nav-debug";
    this.debugLayer.visible = false;
    this.debugLayer.addChild(this.heatmapGraphics, this.pathGraphics);
  }

  setHeatmapVisible(visible: boolean): boolean {
    this.heatmapVisible = visible;
    this.debugLayer.visible = visible;
    if (!visible) this.pathGraphics.clear();
    return this.heatmapVisible;
  }

  isHeatmapVisible(): boolean {
    return this.heatmapVisible;
  }

  clearArea(): void {
    this.exitCueGraphics.clear();
    this.goalRingGraphics.clear();
    this.heatmapGraphics.clear();
    this.pathGraphics.clear();
    this.cachedAreaId = null;
    this.cachedField = null;
  }

  render(
    area: Area,
    state: State,
    field: NavField | null,
    navSnapshot: NavPathSnapshot | null,
    photoMode: boolean,
    reducedMotion: boolean,
  ): void {
    const overworldOpen =
      area.id !== "harness" &&
      state.battle === null &&
      state.arcade === null &&
      state.dialogue === null &&
      state.transition === null &&
      !state.journalOpen &&
      state.finale === null &&
      !photoMode;

    this.renderExitCues(area, state, overworldOpen, reducedMotion);
    this.renderGoalRing(area, state, navSnapshot, overworldOpen, reducedMotion);
    this.renderDebug(area, state, field, navSnapshot);
  }

  private renderExitCues(
    area: Area,
    state: State,
    visible: boolean,
    reducedMotion: boolean,
  ): void {
    this.exitCueGraphics.clear();
    if (!visible || area.triggers.length === 0) return;

    const breath = reducedMotion ? 0 : Math.sin(state.tick * 0.08);
    const pulse = reducedMotion ? 1 : 0.85 + 0.15 * breath;

    for (const trigger of area.triggers) {
      const centroid = polygonCentroid(trigger.polygon);
      if (centroid === null) continue;
      const dist = distance(state.player, centroid);
      if (dist >= EXIT_CUE_RANGE) continue;
      const proximity = Math.max(0, Math.min(1, 1 - dist / EXIT_CUE_RANGE));
      const alpha = EXIT_CUE_MAX_ALPHA * proximity * pulse;
      if (alpha <= 0.005) continue;

      this.exitCueGraphics
        .circle(centroid.x, centroid.y, 18 + breath * 2)
        .stroke({ width: 4, color: 0xfff4d6, alpha: alpha * 0.55 });
      this.exitCueGraphics
        .circle(centroid.x, centroid.y, 14.5 + breath * 1.4)
        .stroke({ width: 2, color: 0xf4d37e, alpha });

      if (dist > 1) {
        const ux = (centroid.x - state.player.x) / dist;
        const uy = (centroid.y - state.player.y) / dist;
        const bob = reducedMotion ? 0 : breath * 2.5;
        const tipX = centroid.x + ux * (4 + bob);
        const tipY = centroid.y + uy * (4 + bob);
        const leftX = tipX - ux * 7 - uy * 5.5;
        const leftY = tipY - uy * 7 + ux * 5.5;
        const rightX = tipX - ux * 7 + uy * 5.5;
        const rightY = tipY - uy * 7 - ux * 5.5;
        this.exitCueGraphics
          .moveTo(leftX, leftY)
          .lineTo(tipX, tipY)
          .lineTo(rightX, rightY)
          .stroke({
            width: 2.2,
            color: 0xfff6dc,
            alpha: Math.min(EXIT_CUE_MAX_ALPHA, alpha * 1.05),
            cap: "round",
            join: "round",
          });
      }
    }
  }

  private renderGoalRing(
    area: Area,
    state: State,
    navSnapshot: NavPathSnapshot | null,
    visible: boolean,
    reducedMotion: boolean,
  ): void {
    this.goalRingGraphics.clear();
    if (!visible || navSnapshot === null || navSnapshot.area !== area.id) return;

    const { x, y } = navSnapshot.goal;
    const pulse = reducedMotion ? 0 : Math.sin(state.tick * 0.14);
    this.goalRingGraphics
      .circle(x, y, 13 + pulse * 1.4)
      .fill({ color: 0xf4d37e, alpha: 0.2 });
    this.goalRingGraphics
      .circle(x, y, 15.5 + pulse * 2)
      .stroke({ width: 2.5, color: 0xf4d37e, alpha: 0.85 });
    this.goalRingGraphics
      .circle(x, y, 9.5 - pulse * 0.8)
      .stroke({ width: 1.75, color: 0x5a4332, alpha: 0.72 });
    this.goalRingGraphics
      .circle(x, y, 2.2)
      .fill({ color: 0x5a4332, alpha: 0.65 });
  }

  private renderDebug(
    area: Area,
    state: State,
    field: NavField | null,
    navSnapshot: NavPathSnapshot | null,
  ): void {
    const showDebug = this.heatmapVisible && state.battle === null && state.arcade === null;
    this.debugLayer.visible = showDebug;
    if (!showDebug) return;

    if (field !== this.cachedField || area.id !== this.cachedAreaId) {
      if (field === null) this.heatmapGraphics.clear();
      else drawHeatmap(this.heatmapGraphics, field);
      this.cachedField = field;
      this.cachedAreaId = area.id;
    }

    this.pathGraphics.clear();
    if (
      navSnapshot !== null &&
      navSnapshot.area === area.id &&
      navSnapshot.waypoints.length > 0
    ) {
      this.pathGraphics.moveTo(state.player.x, state.player.y);
      for (const wp of navSnapshot.waypoints) {
        this.pathGraphics.lineTo(wp.x, wp.y);
      }
      this.pathGraphics.stroke({ width: 3, color: 0x26c6da, alpha: 0.9, cap: "round" });
      for (const wp of navSnapshot.waypoints) {
        this.pathGraphics.circle(wp.x, wp.y, 4);
      }
      this.pathGraphics.fill({ color: 0x26c6da, alpha: 0.9 });
    }
  }
}
