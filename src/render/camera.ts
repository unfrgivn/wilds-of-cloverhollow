import {
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Area,
  type Direction,
  type Point,
  type State,
  type World,
} from "../core";
import { transitionZoom } from "./fade";

export type Size = { width: number; height: number };
export type CameraDirective = { focus?: Point; zoom?: number; shake?: number };
export type CameraFraming = "follow" | "dialogue" | "directive";
export type CameraTraumaState = { trauma: number; seed: number; lastTick: number };

export type CameraDirectorStepParams = {
  world: World;
  area: Area;
  state: State;
  previousState: State | undefined;
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  resolution: number;
  doorFadeTicks: number;
  paused: boolean;
  reducedMotion: boolean;
  alpha: number;
  indoor?: boolean;
};

export type CameraDirectorFrame = {
  canInterpolate: boolean;
  alpha: number;
  playerPos: Point;
  camera: Point;
  zoom: number;
  baseScale: number;
  zoomScale: number;
  zoomOffsetX: number;
  zoomOffsetY: number;
  shakeOffset: Point;
  battleShake: Point;
  parallaxOver: Point;
  parallaxAmbient: Point;
  framing: CameraFraming;
};

const LOOK_AHEAD_X = 22;
const LOOK_AHEAD_Y = 14;
const CAMERA_DAMP = 0.14;
const CAMERA_SNAP_EPSILON = 0.15;
const DIALOGUE_MAX_PULL = 220;
const DIALOGUE_BOX_OFFSET_Y = 44;
const NARRATION_OFFSET_Y = 28;

export const DIALOGUE_ZOOM = 1.07;
export const MIN_CAMERA_ZOOM = 0.85;
export const MAX_CAMERA_ZOOM = 1.35;
export const CAMERA_ZOOM_DAMP = 0.12;
export const TRAUMA_DECAY_PER_TICK = 0.038;
export const MAX_SHAKE_X = 7;
export const MAX_SHAKE_Y = 5;

const CAM_TAG_RE = /^cam\s*:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/i;
const ZOOM_TAG_RE = /^zoom\s*:\s*([+-]?\d+(?:\.\d+)?)$/i;
const SHAKE_TAG_RE = /^shake\s*:\s*([+-]?\d+(?:\.\d+)?)$/i;
const IMPACT_BEAT_RE = /^(CLUNK|CRASH|BOOM|SNAP|THUMP)!/i;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function interpolatePoint(
  previous: Point,
  current: Point,
  alpha: number,
): Point {
  const t = clamp(alpha, 0, 1);
  return {
    x: previous.x + (current.x - previous.x) * t,
    y: previous.y + (current.y - previous.y) * t,
  };
}

function lookAhead(player: Point, facing: Direction): Point {
  if (facing === "left") return { x: player.x - LOOK_AHEAD_X, y: player.y };
  if (facing === "right") return { x: player.x + LOOK_AHEAD_X, y: player.y };
  if (facing === "up") return { x: player.x, y: player.y - LOOK_AHEAD_Y };
  return { x: player.x, y: player.y + LOOK_AHEAD_Y };
}

function dampAxis(
  previous: number,
  target: number,
  viewSize: number,
  areaSize: number,
): number {
  if (areaSize <= viewSize) return (areaSize - viewSize) / 2;
  const gap = target - previous;
  const next = Math.abs(gap) <= CAMERA_SNAP_EPSILON
    ? target
    : previous + gap * CAMERA_DAMP;
  return clamp(next, 0, areaSize - viewSize);
}

function axisCamera(
  previous: number | undefined,
  player: number,
  viewSize: number,
  areaSize: number,
  deadZone: number,
): number {
  if (areaSize <= viewSize) return (areaSize - viewSize) / 2;
  const centre = player - viewSize / 2;
  const minimum = centre - deadZone / 2;
  const maximum = centre + deadZone / 2;
  const camera =
    previous === undefined ? centre : clamp(previous, minimum, maximum);
  return clamp(camera, 0, areaSize - viewSize);
}

export function followCamera(
  previous: Point | undefined,
  player: Point,
  view: Size,
  area: Size,
  deadZone: Point,
): Point {
  return {
    x: axisCamera(previous?.x, player.x, view.width, area.width, deadZone.x),
    y: axisCamera(previous?.y, player.y, view.height, area.height, deadZone.y),
  };
}

export function smoothFollowCamera(
  previous: Point | undefined,
  player: Point,
  facing: Direction,
  view: Size,
  area: Size,
  deadZone: Point,
  snap: boolean,
): Point {
  if (snap || previous === undefined) {
    return followCamera(previous, player, view, area, deadZone);
  }
  const target = followCamera(
    previous,
    lookAhead(player, facing),
    view,
    area,
    deadZone,
  );
  return {
    x: dampAxis(previous.x, target.x, view.width, area.width),
    y: dampAxis(previous.y, target.y, view.height, area.height),
  };
}

export function worldToScreen(
  point: Point,
  camera: Point,
  viewWidth: number,
  viewHeight: number,
  width: number,
  height: number,
  zoom = 1,
): Point {
  const baseScale = Math.min(width / viewWidth, height / viewHeight);
  const scale = baseScale * zoom;
  const letterboxX = (width - viewWidth * baseScale) / 2;
  const letterboxY = (height - viewHeight * baseScale) / 2;
  return {
    x: letterboxX + (point.x - camera.x) * scale,
    y: letterboxY + (point.y - camera.y) * scale,
  };
}

export function screenToWorld(
  point: Point,
  camera: Point,
  viewWidth: number,
  viewHeight: number,
  width: number,
  height: number,
  zoom = 1,
): Point {
  const baseScale = Math.min(width / viewWidth, height / viewHeight);
  const scale = baseScale * zoom;
  if (!Number.isFinite(scale) || scale <= 0) return { x: camera.x, y: camera.y };
  const letterboxX = (width - viewWidth * baseScale) / 2;
  const letterboxY = (height - viewHeight * baseScale) / 2;
  return {
    x: camera.x + (point.x - letterboxX) / scale,
    y: camera.y + (point.y - letterboxY) / scale,
  };
}

/**
 * Purely extracts current Ink tags from serialized `state.ink` JSON without
 * importing `inkjs`. Supports both modern `flows[currentFlowName].outputStream`
 * (`"#"` ... `"/#"`) and legacy top-level `outputStream` / `{ "#": "..." }`.
 */
export function extractInkCurrentTags(inkJson: string): string[] {
  if (inkJson.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(inkJson);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  let stream: unknown[] | undefined;
  if (isRecord(parsed.flows)) {
    const flowName =
      typeof parsed.currentFlowName === "string"
        ? parsed.currentFlowName
        : "DEFAULT_FLOW";
    const flow = parsed.flows[flowName] ?? parsed.flows.DEFAULT_FLOW;
    if (isRecord(flow) && Array.isArray(flow.outputStream)) {
      stream = flow.outputStream;
    }
  } else if (Array.isArray(parsed.outputStream)) {
    stream = parsed.outputStream;
  }
  if (stream === undefined) return [];
  const tags: string[] = [];
  let inTag = false;
  const parts: string[] = [];
  for (const item of stream) {
    if (item === "#") {
      inTag = true;
      parts.length = 0;
    } else if (item === "/#") {
      if (inTag) {
        const joined = parts.join("").trim();
        if (joined.length > 0) tags.push(joined);
        inTag = false;
        parts.length = 0;
      }
    } else if (inTag) {
      if (typeof item === "string") {
        parts.push(item.startsWith("^") ? item.slice(1) : item);
      } else if (typeof item === "number" || typeof item === "boolean") {
        parts.push(String(item));
      }
    } else if (isRecord(item) && typeof item["#"] === "string") {
      const text = item["#"].trim();
      if (text.length > 0) tags.push(text);
    }
  }
  return tags;
}

/** Parses Ink presentation camera tags (`cam: x,y`, `zoom: z`, `shake: s`). */
export function parseCameraTags(tags: readonly string[]): CameraDirective {
  let focus: Point | undefined;
  let zoom: number | undefined;
  let shake: number | undefined;
  for (const raw of tags) {
    const trimmed = raw.trim().replace(/^#\s*/, "");
    const camMatch = CAM_TAG_RE.exec(trimmed);
    if (camMatch !== null) {
      const x = Number(camMatch[1]);
      const y = Number(camMatch[2]);
      if (Number.isFinite(x) && Number.isFinite(y)) focus = { x, y };
      continue;
    }
    const zoomMatch = ZOOM_TAG_RE.exec(trimmed);
    if (zoomMatch !== null) {
      const value = Number(zoomMatch[1]);
      if (Number.isFinite(value) && value > 0) {
        zoom = clamp(value, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
      }
      continue;
    }
    const shakeMatch = SHAKE_TAG_RE.exec(trimmed);
    if (shakeMatch !== null) {
      const value = Number(shakeMatch[1]);
      if (Number.isFinite(value) && value >= 0) {
        shake = clamp(value, 0, 1);
      }
    }
  }
  return {
    ...(focus !== undefined ? { focus } : {}),
    ...(zoom !== undefined ? { zoom } : {}),
    ...(shake !== undefined ? { shake } : {}),
  };
}

function nearestPoint(points: readonly Point[], anchor: Point): Point | undefined {
  let best: Point | undefined;
  let bestDistSq = Infinity;
  for (const pt of points) {
    const dx = pt.x - anchor.x;
    const dy = pt.y - anchor.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = pt;
    }
  }
  return best;
}

/** Resolves the desired world focus point during active dialogue. */
export function resolveDialogueFocus(
  world: World,
  state: State,
  playerPos: Point,
  directive?: CameraDirective,
): { focus: Point; framing: "directive" | "dialogue" } | null {
  const dialogue = state.dialogue;
  if (dialogue === null) return null;
  if (directive?.focus !== undefined) {
    return { focus: directive.focus, framing: "directive" };
  }
  let partner: Point | undefined = dialogue.partnerPoint;
  const area = world.areas[state.area];
  if (partner === undefined && area !== undefined) {
    const npcPoints = area.npcs
      .filter((item) => npcVisible(world, state, item) && item.knot === dialogue.knot)
      .map((item) => npcLivePoint(state, item));
    partner = nearestPoint(npcPoints, playerPos);
  }
  if (partner === undefined) {
    const calmPoints = presentCritters(world, state)
      .filter((item) => item.mood === "calm" && item.kind.calmKnot === dialogue.knot)
      .map((item) => item.point);
    partner = nearestPoint(calmPoints, playerPos);
  }
  if (partner === undefined && area !== undefined) {
    const spotPoints: Point[] = [];
    for (const item of area.interactables) {
      if (item.knot === dialogue.knot) spotPoints.push(item.point);
    }
    for (const glow of area.glows) {
      if (glow.knot === dialogue.knot) spotPoints.push(glow.point);
    }
    partner = nearestPoint(spotPoints, playerPos);
  }
  if (partner === undefined) {
    return {
      focus: { x: playerPos.x, y: playerPos.y + NARRATION_OFFSET_Y },
      framing: "dialogue",
    };
  }
  let dx = playerPos.x * 0.55 + partner.x * 0.45 - playerPos.x;
  let dy = playerPos.y * 0.55 + partner.y * 0.45 + DIALOGUE_BOX_OFFSET_Y - playerPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist > DIALOGUE_MAX_PULL) {
    const scale = DIALOGUE_MAX_PULL / dist;
    dx *= scale;
    dy *= scale;
  }
  return {
    focus: { x: playerPos.x + dx, y: playerPos.y + dy },
    framing: "dialogue",
  };
}

/** Clamps a requested zoom factor safely against the area's dimensions. */
export function clampZoomToArea(
  requestedZoom: number,
  view: Size,
  area: Size,
): number {
  if (!Number.isFinite(requestedZoom) || requestedZoom <= 0) return 1;
  if (requestedZoom >= 1) return clamp(requestedZoom, 1, MAX_CAMERA_ZOOM);
  const minSafe = Math.max(
    view.width / Math.max(1, area.width),
    view.height / Math.max(1, area.height),
  );
  if (minSafe >= 1) return 1;
  return clamp(requestedZoom, Math.max(MIN_CAMERA_ZOOM, minSafe), 1);
}

/** Clamps camera top-left inside area bounds for any active zoom factor. */
export function clampCameraToArea(
  camera: Point,
  view: Size,
  area: Size,
  zoom = 1,
): Point {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const effW = view.width / safeZoom;
  const effH = view.height / safeZoom;
  const x =
    area.width <= effW
      ? (area.width - effW) / 2
      : clamp(camera.x, 0, area.width - effW);
  const y =
    area.height <= effH
      ? (area.height - effH) / 2
      : clamp(camera.y, 0, area.height - effH);
  return { x, y };
}

export function createCameraTraumaState(): CameraTraumaState {
  return { trauma: 0, seed: 1, lastTick: 0 };
}

export function addCameraTrauma(
  current: CameraTraumaState,
  amount: number,
  tick: number,
): CameraTraumaState {
  if (!Number.isFinite(amount) || amount <= 0) return current;
  const trauma = clamp(current.trauma + amount, 0, 1);
  const mixed = (Math.imul(current.seed ^ tick, 1664525) + 1013904223) >>> 0;
  return { trauma, seed: (mixed % 10000) + 1, lastTick: tick };
}

export function stepCameraTrauma(
  current: CameraTraumaState,
  tick: number,
  options: { reducedMotion: boolean; paused: boolean; areaId: string },
): { state: CameraTraumaState; offset: Point } {
  if (options.reducedMotion || options.paused || options.areaId === "harness") {
    return {
      state: { trauma: 0, seed: current.seed, lastTick: tick },
      offset: { x: 0, y: 0 },
    };
  }
  if (tick < current.lastTick) {
    return {
      state: { trauma: 0, seed: current.seed, lastTick: tick },
      offset: { x: 0, y: 0 },
    };
  }
  const dt = Math.min(12, Math.max(0, tick - current.lastTick));
  const nextTrauma = Math.max(0, current.trauma - TRAUMA_DECAY_PER_TICK * dt);
  if (nextTrauma <= 0.0001) {
    return {
      state: { trauma: 0, seed: current.seed, lastTick: tick },
      offset: { x: 0, y: 0 },
    };
  }
  const shake = nextTrauma * nextTrauma;
  const t = tick * 1.15 + current.seed * 0.73;
  const waveX = Math.sin(t * 1.7) * 0.65 + Math.cos(t * 3.1 + 0.9) * 0.35;
  const waveY = Math.cos(t * 2.1 + 0.4) * 0.65 + Math.sin(t * 3.7 + 1.6) * 0.35;
  return {
    state: { trauma: nextTrauma, seed: current.seed, lastTick: tick },
    offset: {
      x: clamp(waveX * shake * MAX_SHAKE_X, -MAX_SHAKE_X, MAX_SHAKE_X),
      y: clamp(waveY * shake * MAX_SHAKE_Y, -MAX_SHAKE_Y, MAX_SHAKE_Y),
    },
  };
}

/** Pure state-diff detector for impacts that trigger trauma camera shake. */
export function detectTraumaImpulse(
  previous: State | undefined,
  current: State,
  directiveShake?: number,
): number {
  let impulse = 0;
  const raise = (value: number): void => {
    if (value > impulse) impulse = value;
  };
  if (previous !== undefined) {
    if (previous.battle === null && current.battle !== null) {
      raise(0.45);
    }
    if (
      current.battle?.phase === "burstResult" &&
      previous.battle?.phase !== "burstResult"
    ) {
      raise(current.battle.lastGrade === "miss" ? 0.65 : 0.32);
    }
    if (
      current.battle?.lassoUsed === true &&
      previous.battle?.lassoUsed !== true
    ) {
      raise(0.55);
    }
    if (
      current.previousInput.lasso === true &&
      previous.previousInput.lasso !== true
    ) {
      raise(0.48);
    }
    if (
      current.battle?.phase === "result" &&
      previous.battle?.phase !== "result" &&
      current.battle.lastGrade === "great"
    ) {
      raise(current.battle.command === "together" ? 0.72 : 0.36);
    }
    if (
      current.dialogue !== null &&
      current.dialogue.text !== previous.dialogue?.text &&
      IMPACT_BEAT_RE.test(current.dialogue.text)
    ) {
      raise(0.5);
    }
  }
  const newDialogueLine =
    current.dialogue !== null &&
    (previous === undefined ||
      previous.dialogue?.text !== current.dialogue.text ||
      previous.ink !== current.ink);
  if (
    newDialogueLine &&
    directiveShake !== undefined &&
    Number.isFinite(directiveShake) &&
    directiveShake > 0
  ) {
    raise(directiveShake);
  }
  return clamp(impulse, 0, 1);
}

/** Computes bounded depth-parallax offset relative to area center. */
export function computeParallaxOffset(
  camera: Point,
  area: Size,
  view: Size,
  factor: number,
  maxOffset: number,
  enabled: boolean,
): Point {
  if (!enabled || factor === 0 || maxOffset <= 0) return { x: 0, y: 0 };
  const camCenterX = camera.x + view.width / 2;
  const camCenterY = camera.y + view.height / 2;
  const dx = camCenterX - area.width / 2;
  const dy = camCenterY - area.height / 2;
  return {
    x: clamp(-dx * factor, -maxOffset, maxOffset),
    y: clamp(-dy * factor, -maxOffset, maxOffset),
  };
}

/**
 * Pixi-free presentation camera controller: manages dialogue zoom/framing,
 * Ink camera directives, damped trauma shake, and depth parallax while keeping
 * paused harness frames bit-for-bit aligned with `followCamera`.
 */
export class CameraDirector {
  private _camera: Point | undefined;
  private _zoom = 1;
  private trauma = createCameraTraumaState();
  private cachedInk = "";
  private cachedDirective: CameraDirective = {};
  private lastState: State | undefined;
  private _framing: CameraFraming = "follow";
  private _shakeOffset: Point = { x: 0, y: 0 };

  get camera(): Point | undefined {
    return this._camera;
  }

  get zoom(): number {
    return this._zoom;
  }

  get framing(): CameraFraming {
    return this._framing;
  }

  get shakeOffset(): Point {
    return this._shakeOffset;
  }

  reset(): void {
    this._camera = undefined;
    this._zoom = 1;
    this.trauma = createCameraTraumaState();
    this.cachedInk = "";
    this.cachedDirective = {};
    this.lastState = undefined;
    this._framing = "follow";
    this._shakeOffset = { x: 0, y: 0 };
  }

  private readDirective(state: State): CameraDirective {
    if (state.dialogue === null) return {};
    if (state.ink !== this.cachedInk) {
      this.cachedInk = state.ink;
      this.cachedDirective = parseCameraTags(extractInkCurrentTags(state.ink));
    }
    return this.cachedDirective;
  }

  step(params: CameraDirectorStepParams): CameraDirectorFrame {
    const {
      world,
      area,
      state,
      previousState,
      width,
      height,
      viewWidth,
      viewHeight,
      resolution,
      doorFadeTicks,
      paused,
      reducedMotion,
    } = params;
    const directive = this.readDirective(state);
    const canInterpolate =
      !paused &&
      previousState !== undefined &&
      previousState.area === state.area &&
      state.transition === null;
    const alpha = canInterpolate ? clamp(params.alpha, 0, 1) : 1;
    const playerPos = canInterpolate
      ? interpolatePoint(previousState.player, state.player, alpha)
      : state.player;

    const prevForDiff = this.lastState ?? previousState;
    const impulse = detectTraumaImpulse(prevForDiff, state, directive.shake);
    if (impulse > 0 && !paused && !reducedMotion && area.id !== "harness") {
      this.trauma = addCameraTrauma(this.trauma, impulse, state.tick);
    }
    const steppedTrauma = stepCameraTrauma(this.trauma, state.tick, {
      reducedMotion,
      paused,
      areaId: area.id,
    });
    this.trauma = steppedTrauma.state;
    this._shakeOffset = steppedTrauma.offset;
    this.lastState = state;

    const view: Size = { width: viewWidth, height: viewHeight };
    const deadZone: Point = { x: 80, y: 60 };
    const overworldClear =
      state.battle === null && state.arcade === null && state.transition === null;
    const hasDirective = directive.focus !== undefined || directive.zoom !== undefined;
    const dialogueFocus = overworldClear
      ? resolveDialogueFocus(world, state, playerPos, directive)
      : null;

    if (paused && !hasDirective) {
      this._zoom = 1;
      this._framing = "follow";
      this._camera = followCamera(this._camera, playerPos, view, area, deadZone);
    } else if (reducedMotion || area.id === "harness") {
      this._zoom = 1;
      if (
        reducedMotion &&
        area.id !== "harness" &&
        directive.focus !== undefined &&
        overworldClear
      ) {
        this._framing = "directive";
        this._camera = clampCameraToArea(
          { x: directive.focus.x - viewWidth / 2, y: directive.focus.y - viewHeight / 2 },
          view,
          area,
          1,
        );
      } else {
        this._framing = "follow";
        this._camera = followCamera(this._camera, playerPos, view, area, deadZone);
      }
    } else if (paused && hasDirective) {
      const targetZoom =
        directive.zoom !== undefined ? clampZoomToArea(directive.zoom, view, area) : 1;
      this._zoom = targetZoom;
      const effW = viewWidth / targetZoom;
      const effH = viewHeight / targetZoom;
      if (directive.focus !== undefined) {
        this._framing = "directive";
        this._camera = clampCameraToArea(
          { x: directive.focus.x - effW / 2, y: directive.focus.y - effH / 2 },
          view,
          area,
          targetZoom,
        );
      } else {
        this._framing = dialogueFocus?.framing ?? "follow";
        const anchor = dialogueFocus?.focus ?? playerPos;
        this._camera = clampCameraToArea(
          { x: anchor.x - effW / 2, y: anchor.y - effH / 2 },
          view,
          area,
          targetZoom,
        );
      }
    } else {
      const targetZoom =
        dialogueFocus !== null
          ? clampZoomToArea(directive.zoom ?? DIALOGUE_ZOOM, view, area)
          : 1;
      const prevZoom = this._zoom;
      const snapAll = this._camera === undefined || state.transition !== null;
      if (snapAll || Math.abs(targetZoom - prevZoom) <= 0.0005) {
        this._zoom = targetZoom;
      } else {
        this._zoom = prevZoom + (targetZoom - prevZoom) * CAMERA_ZOOM_DAMP;
      }
      const effView: Size = { width: viewWidth / this._zoom, height: viewHeight / this._zoom };
      const rebasedPrev =
        this._camera === undefined
          ? undefined
          : {
              x: this._camera.x + (viewWidth / prevZoom - effView.width) / 2,
              y: this._camera.y + (viewHeight / prevZoom - effView.height) / 2,
            };
      if (dialogueFocus !== null) {
        this._framing = dialogueFocus.framing;
        const targetCam = clampCameraToArea(
          {
            x: dialogueFocus.focus.x - effView.width / 2,
            y: dialogueFocus.focus.y - effView.height / 2,
          },
          view,
          area,
          this._zoom,
        );
        this._camera =
          rebasedPrev === undefined || snapAll
            ? targetCam
            : {
                x: dampAxis(rebasedPrev.x, targetCam.x, effView.width, area.width),
                y: dampAxis(rebasedPrev.y, targetCam.y, effView.height, area.height),
              };
      } else {
        this._framing = "follow";
        this._camera = smoothFollowCamera(
          rebasedPrev,
          playerPos,
          state.facing,
          effView,
          area,
          deadZone,
          snapAll,
        );
      }
    }

    const camera = this._camera;
    const baseScale = Math.min(width / viewWidth, height / viewHeight);
    const viewScale = baseScale * this._zoom;
    const letterboxX = (width - viewWidth * baseScale) / 2;
    const letterboxY = (height - viewHeight * baseScale) / 2;
    const effW = viewWidth / this._zoom;
    const effH = viewHeight / this._zoom;
    const battleShake: Point =
      state.battle !== null
        ? { x: this._shakeOffset.x * baseScale, y: this._shakeOffset.y * baseScale }
        : { x: 0, y: 0 };
    const renderCamX =
      state.battle !== null || this._shakeOffset.x === 0
        ? camera.x
        : area.width > effW
          ? clamp(camera.x + this._shakeOffset.x, 0, area.width - effW)
          : camera.x + this._shakeOffset.x;
    const renderCamY =
      state.battle !== null || this._shakeOffset.y === 0
        ? camera.y
        : area.height > effH
          ? clamp(camera.y + this._shakeOffset.y, 0, area.height - effH)
          : camera.y + this._shakeOffset.y;
    const offsetX = Math.round((letterboxX - renderCamX * viewScale) * resolution) / resolution;
    const offsetY = Math.round((letterboxY - renderCamY * viewScale) * resolution) / resolution;
    const tZoom =
      area.id === "harness" || reducedMotion
        ? 1
        : transitionZoom(state.transition, doorFadeTicks);
    const zoomScale = viewScale * tZoom;
    const centerX = width / 2;
    const centerY = height / 2;
    const zoomOffsetX = tZoom === 1 ? offsetX : centerX + (offsetX - centerX) * tZoom;
    const zoomOffsetY = tZoom === 1 ? offsetY : centerY + (offsetY - centerY) * tZoom;

    const parallaxEnabled =
      !paused &&
      !reducedMotion &&
      area.id !== "harness" &&
      state.battle === null &&
      state.arcade === null;
    const indoor = params.indoor ?? false;
    const effView: Size = { width: effW, height: effH };
    const parallaxOver = computeParallaxOffset(
      camera,
      area,
      effView,
      indoor ? 0.015 : 0.04,
      indoor ? 6 : 18,
      parallaxEnabled,
    );
    const parallaxAmbient = indoor
      ? { x: 0, y: 0 }
      : computeParallaxOffset(camera, area, effView, 0.025, 12, parallaxEnabled);

    return {
      canInterpolate,
      alpha,
      playerPos,
      camera,
      zoom: this._zoom,
      baseScale,
      zoomScale,
      zoomOffsetX,
      zoomOffsetY,
      shakeOffset: this._shakeOffset,
      battleShake,
      parallaxOver,
      parallaxAmbient,
      framing: this._framing,
    };
  }
}
