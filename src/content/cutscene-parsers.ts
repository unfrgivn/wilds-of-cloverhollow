import {
  isSoundCue,
  storyHasKnot,
  type Area,
  type CharacterContent,
  type CutsceneCameraTarget,
  type CutsceneEffectKind,
  type CutsceneEmoteKind,
  type CutscenePose,
  type CutsceneScript,
  type CutsceneStep,
  type CutsceneTrigger,
  type PartyContent,
} from "../core";
import {
  boolean,
  direction,
  field,
  integerIn,
  isPositive,
  nonEmptyString,
  point,
  pointField,
  positive,
  record,
} from "./parsers";

export type CutsceneValidationContext = {
  areas: Record<string, Area>;
  characters: Record<string, CharacterContent>;
  party: Record<string, PartyContent>;
  story: Record<string, unknown>;
  storyVariable: (name: string) => unknown;
};

const POSES: readonly CutscenePose[] = [
  "idle",
  "hop",
  "cheer",
  "shock",
  "toss",
  "taunt",
  "wave",
  "sit",
];

const EMOTES: readonly CutsceneEmoteKind[] = [
  "exclaim",
  "question",
  "heart",
  "sparkle",
  "note",
  "wave",
  "worry",
  "zzz",
];

const EFFECTS: readonly CutsceneEffectKind[] = [
  "purple-fizz",
  "purple-puff",
  "sparkle-burst",
  "pinecone-burst",
];

function isPose(value: unknown): value is CutscenePose {
  return POSES.some((item) => item === value);
}

function isEmote(value: unknown): value is CutsceneEmoteKind {
  return EMOTES.some((item) => item === value);
}

function isEffect(value: unknown): value is CutsceneEffectKind {
  return EFFECTS.some((item) => item === value);
}

function isActorTarget(value: string): value is `actor:${string}` {
  return value.startsWith("actor:") && value.slice("actor:".length).trim().length > 0;
}

function parseCameraTarget(
  value: unknown,
  file: string,
  label: string,
): CutsceneCameraTarget {
  if (value === "fae") return "fae";
  if (typeof value === "string" && isActorTarget(value)) return value;
  field(point(value), file, label);
  return { x: value.x, y: value.y };
}

function parseTrigger(
  raw: unknown,
  file: string,
  ctx: CutsceneValidationContext,
): CutsceneTrigger | undefined {
  if (raw === undefined) return undefined;
  field(record(raw), file, "trigger");
  const kind = raw.kind;
  if (kind === "manual") return { kind: "manual" };
  field(kind === "area-enter" || kind === "after-knot", file, "trigger.kind");
  const area = nonEmptyString(raw, "area", file, "trigger.area");
  field(ctx.areas[area] !== undefined, file, `trigger.area (${area})`);
  const requiresVariable = raw.requiresVariable;
  if (requiresVariable !== undefined) {
    field(
      typeof requiresVariable === "string" && ctx.storyVariable(requiresVariable) !== undefined,
      file,
      `trigger.requiresVariable (${String(requiresVariable)})`,
    );
  }
  const forbidsVariable = raw.forbidsVariable;
  if (forbidsVariable !== undefined) {
    field(
      typeof forbidsVariable === "string" && ctx.storyVariable(forbidsVariable) !== undefined,
      file,
      `trigger.forbidsVariable (${String(forbidsVariable)})`,
    );
  }
  const once = raw.once;
  field(once === undefined || typeof once === "boolean", file, "trigger.once");
  const common = {
    area,
    ...(typeof requiresVariable === "string" ? { requiresVariable } : {}),
    ...(typeof forbidsVariable === "string" ? { forbidsVariable } : {}),
    ...(typeof once === "boolean" ? { once } : {}),
  };
  if (kind === "after-knot") {
    const knot = nonEmptyString(raw, "knot", file, "trigger.knot");
    field(storyHasKnot(ctx.story, knot), file, `trigger.knot (${knot})`);
    return { kind: "after-knot", knot, ...common };
  }
  return { kind: "area-enter", ...common };
}

function parseStep(
  raw: unknown,
  file: string,
  label: string,
  ctx: CutsceneValidationContext,
): CutsceneStep {
  field(record(raw), file, label);
  const type = raw.type;
  if (type === "moveActor") {
    const actor = nonEmptyString(raw, "actor", file, `${label}.actor`);
    const to = pointField(raw, "to", file, `${label}.to`);
    const speed = positive(raw, "speed", file, `${label}.speed`);
    const facing = raw.facing;
    field(facing === undefined || direction(facing), file, `${label}.facing`);
    return {
      type,
      actor,
      to,
      speed,
      ...(direction(facing) ? { facing } : {}),
    };
  }
  if (type === "face") {
    const actor = nonEmptyString(raw, "actor", file, `${label}.actor`);
    const dir = raw.direction;
    field(direction(dir), file, `${label}.direction`);
    return { type, actor, direction: dir };
  }
  if (type === "pose") {
    const actor = nonEmptyString(raw, "actor", file, `${label}.actor`);
    const pose = raw.pose;
    field(isPose(pose), file, `${label}.pose`);
    const rawTicks = raw.ticks;
    let ticks: number | undefined;
    if (rawTicks !== undefined) {
      ticks = integerIn(raw, "ticks", 0, file, `${label}.ticks`);
    }
    const effect = raw.effect;
    field(effect === undefined || isEffect(effect), file, `${label}.effect`);
    return {
      type,
      actor,
      pose,
      ...(ticks === undefined ? {} : { ticks }),
      ...(isEffect(effect) ? { effect } : {}),
    };
  }
  if (type === "emote") {
    const actor = nonEmptyString(raw, "actor", file, `${label}.actor`);
    const kind = raw.kind;
    field(isEmote(kind), file, `${label}.kind`);
    const ticks = integerIn(raw, "ticks", 0, file, `${label}.ticks`);
    return { type, actor, kind, ticks };
  }
  if (type === "wait") {
    const ticks = integerIn(raw, "ticks", 0, file, `${label}.ticks`);
    return { type, ticks };
  }
  if (type === "cameraPan") {
    const to = parseCameraTarget(raw.to, file, `${label}.to`);
    const ticks = integerIn(raw, "ticks", 0, file, `${label}.ticks`);
    const zoom = raw.zoom;
    field(zoom === undefined || isPositive(zoom), file, `${label}.zoom`);
    return {
      type,
      to,
      ticks,
      ...(isPositive(zoom) ? { zoom } : {}),
    };
  }
  if (type === "sfx") {
    const cue = nonEmptyString(raw, "cue", file, `${label}.cue`);
    field(isSoundCue(cue), file, `${label}.cue (${cue})`);
    return { type, cue };
  }
  if (type === "sayKnot") {
    const knot = nonEmptyString(raw, "knot", file, `${label}.knot`);
    field(storyHasKnot(ctx.story, knot), file, `${label}.knot (${knot})`);
    return { type, knot };
  }
  if (type === "parallel") {
    const rawSteps = raw.steps;
    field(Array.isArray(rawSteps) && rawSteps.length > 0, file, `${label}.steps`);
    const steps = rawSteps.map((child, idx) =>
      parseStep(child, file, `${label}.steps[${idx}]`, ctx),
    );
    return { type, steps };
  }
  if (type === "setFlag") {
    const flag = nonEmptyString(raw, "flag", file, `${label}.flag`);
    const value = boolean(raw, "value", file, `${label}.value`);
    const scope = raw.scope;
    field(
      scope === undefined || scope === "ink" || scope === "cutscene",
      file,
      `${label}.scope`,
    );
    if (scope === "ink") {
      field(ctx.storyVariable(flag) !== undefined, file, `${label}.flag (${flag})`);
    }
    return {
      type,
      flag,
      value,
      ...(scope === "ink" || scope === "cutscene" ? { scope } : {}),
    };
  }
  if (type === "spawnTempActor") {
    const id = nonEmptyString(raw, "id", file, `${label}.id`);
    const sprite = nonEmptyString(raw, "sprite", file, `${label}.sprite`);
    field(
      ctx.characters[sprite] !== undefined || ctx.party[sprite] !== undefined,
      file,
      `${label}.sprite (${sprite})`,
    );
    const at = pointField(raw, "at", file, `${label}.at`);
    const facing = raw.facing;
    field(facing === undefined || direction(facing), file, `${label}.facing`);
    const scale = raw.scale;
    field(scale === undefined || isPositive(scale), file, `${label}.scale`);
    const effect = raw.effect;
    field(effect === undefined || isEffect(effect), file, `${label}.effect`);
    return {
      type,
      id,
      sprite,
      at,
      ...(direction(facing) ? { facing } : {}),
      ...(isPositive(scale) ? { scale } : {}),
      ...(isEffect(effect) ? { effect } : {}),
    };
  }
  if (type === "despawnTempActor") {
    const id = nonEmptyString(raw, "id", file, `${label}.id`);
    const effect = raw.effect;
    field(effect === undefined || isEffect(effect), file, `${label}.effect`);
    return {
      type,
      id,
      ...(isEffect(effect) ? { effect } : {}),
    };
  }
  if (type === "propState") {
    const propId = nonEmptyString(raw, "propId", file, `${label}.propId`);
    const state = nonEmptyString(raw, "state", file, `${label}.state`);
    return { type, propId, state };
  }
  throw new Error(`${file}: invalid ${label}.type (${String(type)})`);
}

function fileStem(file: string): string {
  const base = file.split("/").pop() ?? "";
  return base.endsWith(".json") ? base.slice(0, -5) : base;
}

export function parseCutscene(
  raw: unknown,
  file: string,
  ctx: CutsceneValidationContext,
): CutsceneScript {
  field(record(raw), file, "cutscene");
  const id = nonEmptyString(raw, "id", file, "id");
  field(/^[a-z][a-z0-9-]*$/.test(id), file, `id (${id})`);
  const stem = fileStem(file);
  field(stem.length === 0 || id === stem, file, `id (must match filename ${stem})`);
  const area = nonEmptyString(raw, "area", file, "area");
  field(ctx.areas[area] !== undefined, file, `area (${area})`);
  const trigger = parseTrigger(raw.trigger, file, ctx);
  const rawSteps = raw.steps;
  field(Array.isArray(rawSteps) && rawSteps.length > 0, file, "steps");
  const steps = rawSteps.map((step, index) => parseStep(step, file, `steps[${index}]`, ctx));
  return {
    id,
    area,
    ...(trigger === undefined ? {} : { trigger }),
    steps,
  };
}
