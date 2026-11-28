import type { Area, Direction, Point, State, World } from "../core";
import {
  addCameraTrauma,
  CAMERA_ZOOM_DAMP,
  centerCameraOn,
  clampCameraToArea,
  clampZoomToArea,
  computeParallaxOffset,
  createCameraTraumaState,
  detectTraumaImpulse,
  DIALOGUE_ZOOM,
  extractInkCurrentTags,
  MAX_CAMERA_ZOOM,
  MAX_SHAKE_X,
  MAX_SHAKE_Y,
  MIN_CAMERA_ZOOM,
  parseCameraTags,
  resolveDialogueFocus,
  stepCameraTrauma,
  TRAUMA_DECAY_PER_TICK,
  type CameraDirective,
  type CameraFraming,
  type CameraTraumaState,
  type Size,
} from "./camera-directives";
import { transitionZoom } from "./fade";

export {
  addCameraTrauma,
  CAMERA_ZOOM_DAMP,
  clampCameraToArea,
  clampZoomToArea,
  computeParallaxOffset,
  createCameraTraumaState,
  detectTraumaImpulse,
  DIALOGUE_ZOOM,
  extractInkCurrentTags,
  MAX_CAMERA_ZOOM,
  MAX_SHAKE_X,
  MAX_SHAKE_Y,
  MIN_CAMERA_ZOOM,
  parseCameraTags,
  resolveDialogueFocus,
  stepCameraTrauma,
  TRAUMA_DECAY_PER_TICK,
  type CameraDirective,
  type CameraFraming,
  type CameraTraumaState,
  type Size,
};

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
  scenicZoom?: number;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function interpolatePoint(previous: Point, current: Point, alpha: number): Point {
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

function dampAxis(previous: number, target: number, viewSize: number, areaSize: number): number {
  if (areaSize <= viewSize) return (areaSize - viewSize) / 2;
  const gap = target - previous;
  const next = Math.abs(gap) <= CAMERA_SNAP_EPSILON ? target : previous + gap * CAMERA_DAMP;
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
  const camera =
    previous === undefined ? centre : clamp(previous, centre - deadZone / 2, centre + deadZone / 2);
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
  const target = followCamera(previous, lookAhead(player, facing), view, area, deadZone);
  return {
    x: dampAxis(previous.x, target.x, view.width, area.width),
    y: dampAxis(previous.y, target.y, view.height, area.height),
  };
}

export function cutsceneCameraPoint(focus: Point, view: Size, area: Size): Point {
  return centerCameraOn(focus, view, area, 1);
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

  get camera(): Point | undefined { return this._camera; }
  get zoom(): number { return this._zoom; }
  get framing(): CameraFraming { return this._framing; }
  get shakeOffset(): Point { return this._shakeOffset; }

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
      world, area, state, previousState, width, height,
      viewWidth, viewHeight, resolution, doorFadeTicks, paused, reducedMotion,
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

    const impulse = detectTraumaImpulse(this.lastState ?? previousState, state, directive.shake);
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
    const requestedScenicZoom =
      overworldClear && !reducedMotion && area.id !== "harness" && params.scenicZoom !== undefined
        ? clampZoomToArea(params.scenicZoom, view, area)
        : 1;
    const hasScenicZoom = requestedScenicZoom < 0.9995;
    const hasDirective = directive.focus !== undefined || directive.zoom !== undefined;
    const dialogueFocus = overworldClear
      ? resolveDialogueFocus(world, state, playerPos, directive)
      : null;

    const csCam = overworldClear ? (state.cutscene?.camera ?? null) : null;
    if (csCam !== null) {
      const prevCam = previousState?.cutscene?.camera;
      const canInterpCam = canInterpolate && prevCam !== null && prevCam !== undefined;
      const camFocus = canInterpCam
        ? interpolatePoint(prevCam, csCam, alpha)
        : { x: csCam.x, y: csCam.y };
      const rawZoom = canInterpCam
        ? prevCam.zoom + (csCam.zoom - prevCam.zoom) * alpha
        : csCam.zoom;
      const targetZoom =
        reducedMotion || area.id === "harness" ? 1 : clampZoomToArea(rawZoom, view, area);
      this._zoom = targetZoom;
      this._framing = "directive";
      this._camera = centerCameraOn(camFocus, view, area, targetZoom);
    } else if (paused && !hasDirective && !hasScenicZoom) {
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
        this._camera = centerCameraOn(directive.focus, view, area, 1);
      } else {
        this._framing = "follow";
        this._camera = followCamera(this._camera, playerPos, view, area, deadZone);
      }
    } else if (paused && (hasDirective || hasScenicZoom)) {
      const targetZoom =
        directive.zoom !== undefined
          ? clampZoomToArea(directive.zoom, view, area)
          : requestedScenicZoom;
      this._zoom = targetZoom;
      if (directive.focus !== undefined) {
        this._framing = "directive";
        this._camera = centerCameraOn(directive.focus, view, area, targetZoom);
      } else {
        this._framing = dialogueFocus?.framing ?? "follow";
        this._camera = centerCameraOn(dialogueFocus?.focus ?? playerPos, view, area, targetZoom);
      }
    } else {
      const targetZoom =
        dialogueFocus !== null
          ? clampZoomToArea(directive.zoom ?? DIALOGUE_ZOOM, view, area)
          : requestedScenicZoom;
      const prevZoom = this._zoom;
      const snapAll = this._camera === undefined || state.transition !== null;
      this._zoom =
        snapAll || Math.abs(targetZoom - prevZoom) <= 0.0005
          ? targetZoom
          : prevZoom + (targetZoom - prevZoom) * CAMERA_ZOOM_DAMP;
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
        const targetCam = centerCameraOn(dialogueFocus.focus, view, area, this._zoom);
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
          rebasedPrev, playerPos, state.facing, effView, area, deadZone, snapAll,
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
      !paused && !reducedMotion && area.id !== "harness" &&
      state.battle === null && state.arcade === null;
    const indoor = params.indoor ?? false;
    const effView: Size = { width: effW, height: effH };
    const parallaxOver = computeParallaxOffset(
      camera, area, effView, indoor ? 0.015 : 0.04, indoor ? 6 : 18, parallaxEnabled,
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
