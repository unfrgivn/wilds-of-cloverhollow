import {
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Point,
  type State,
  type World,
} from "../core";

export type Size = { width: number; height: number };
export type CameraDirective = { focus?: Point; zoom?: number; shake?: number };
export type CameraFraming = "follow" | "dialogue" | "directive";
export type CameraTraumaState = { trauma: number; seed: number; lastTick: number };

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

/**
 * Purely extracts current Ink tags from serialized `state.ink` JSON without
 * importing `inkjs`. Supports both modern `flows[currentFlowName].outputStream`
 * (`"#" ... "/#"`) and legacy top-level `outputStream` / `{ "#": "..." }`.
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

/** Centers the camera on `focus` and clamps inside area bounds at `zoom`. */
export function centerCameraOn(
  focus: Point,
  view: Size,
  area: Size,
  zoom = 1,
): Point {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return clampCameraToArea(
    { x: focus.x - view.width / (2 * safeZoom), y: focus.y - view.height / (2 * safeZoom) },
    view,
    area,
    safeZoom,
  );
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
