import { setInkVariables } from "./ink";
import { npcLivePoint } from "./npc-stroll";
import { haltedParty } from "./party";
import type {
  ActionFrame,
  CutsceneActorOverride,
  CutsceneCameraTarget,
  CutsceneEffectKind,
  CutsceneEffectState,
  CutsceneEmoteState,
  CutscenePose,
  CutsceneScript,
  CutsceneState,
  CutsceneStep,
  CutsceneStepProgress,
  CutsceneTempActor,
  CutsceneView,
  Direction,
  Event,
  Point,
  State,
  World,
} from "./types";

export const CUTSCENE_SKIP_HOLD_TICKS = 30;
export const CUTSCENE_LETTERBOX_TICKS = 12;
export const CUTSCENE_EFFECT_TICKS = 28;

export type OpenCutsceneKnot = (world: World, state: State, knot: string) => State;

export function isCutsceneSeen(state: State, id: string): boolean {
  return state.cutscenesSeen?.includes(id) === true;
}

function markCutsceneSeen(state: State, id: string): string[] {
  const existing = state.cutscenesSeen ?? [];
  return existing.includes(id) ? existing : [...existing, id];
}

function finishCutscene(state: State, id: string): State {
  const { cutscene: _cutscene, ...rest } = state;
  return {
    ...rest,
    motion: { ...state.motion, moving: false },
    party: haltedParty(state.party),
    cutscenesSeen: markCutsceneSeen(state, id),
  };
}

function dominantDirection(dx: number, dy: number, fallback: Direction): Direction {
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function findPartyIndex(state: State, key: string): number {
  if (/^\d+$/.test(key)) {
    const index = Number(key);
    return index >= 0 && index < state.party.length ? index : -1;
  }
  return state.party.findIndex((member) => member.id === key);
}

type ResolvedActor =
  | { kind: "fae"; key: "fae" }
  | { kind: "party"; index: number; id: string; key: string }
  | { kind: "npc"; id: string; key: string }
  | { kind: "temp"; index: number; id: string; key: string };

function resolveActor(state: State, ref: string): ResolvedActor | undefined {
  if (ref === "fae") return { kind: "fae", key: "fae" };
  if (ref.startsWith("party:")) {
    const index = findPartyIndex(state, ref.slice("party:".length));
    const member = index >= 0 ? state.party[index] : undefined;
    if (member === undefined) return undefined;
    return { kind: "party", index, id: member.id, key: `party:${member.id}` };
  }
  if (ref.startsWith("npc:")) {
    const id = ref.slice("npc:".length);
    return { kind: "npc", id, key: `npc:${id}` };
  }
  const tempActors = state.cutscene?.tempActors ?? [];
  const tempId = ref.startsWith("temp:") ? ref.slice("temp:".length) : ref;
  const tempIndex = tempActors.findIndex((actor) => actor.id === tempId);
  if (tempIndex >= 0) return { kind: "temp", index: tempIndex, id: tempId, key: `temp:${tempId}` };
  return undefined;
}

function canonicalActorKey(state: State, ref: string): string {
  return resolveActor(state, ref)?.key ?? ref;
}

function getActorPosition(world: World, state: State, ref: string): Point | undefined {
  const actor = resolveActor(state, ref);
  if (actor === undefined) return undefined;
  if (actor.kind === "fae") return { x: state.player.x, y: state.player.y };
  if (actor.kind === "party") {
    const member = state.party[actor.index];
    return member === undefined ? undefined : { x: member.x, y: member.y };
  }
  if (actor.kind === "temp") {
    const temp = state.cutscene?.tempActors[actor.index];
    return temp === undefined ? undefined : { x: temp.x, y: temp.y };
  }
  const override = state.cutscene?.actorOverrides[actor.key];
  if (override?.x !== undefined && override.y !== undefined)
    return { x: override.x, y: override.y };
  const area = world.areas[state.area];
  const npc = area?.npcs.find((item) => item.id === actor.id);
  if (npc === undefined) return undefined;
  const live = npcLivePoint(state, npc);
  return { x: live.x, y: live.y };
}

function getActorFacing(world: World, state: State, ref: string): Direction {
  const actor = resolveActor(state, ref);
  if (actor === undefined) return "down";
  if (actor.kind === "fae") return state.facing;
  if (actor.kind === "party") return state.party[actor.index]?.facing ?? "down";
  if (actor.kind === "temp") return state.cutscene?.tempActors[actor.index]?.facing ?? "down";
  const override = state.cutscene?.actorOverrides[actor.key];
  if (override?.facing !== undefined) return override.facing;
  const area = world.areas[state.area];
  const npc = area?.npcs.find((item) => item.id === actor.id);
  return npc === undefined ? "down" : npcLivePoint(state, npc).facing;
}

function withCutscene(state: State, patch: Partial<CutsceneState>): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  return { ...state, cutscene: { ...cs, ...patch } };
}

function addEffect(state: State, kind: CutsceneEffectKind, at: Point): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const next: CutsceneEffectState = {
    kind,
    x: at.x,
    y: at.y,
    elapsed: 0,
    duration: CUTSCENE_EFFECT_TICKS,
  };
  return withCutscene(state, { effects: [...cs.effects, next] });
}

function setActorPose(state: State, ref: string, pose: CutscenePose | undefined): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const actor = resolveActor(state, ref);
  if (actor === undefined) return state;
  if (actor.kind === "temp") {
    const tempActors = cs.tempActors.map((item, idx): CutsceneTempActor => {
      if (idx !== actor.index) return item;
      const { pose: _p, poseTicks: _pt, ...base } = item;
      return pose === undefined || pose === "idle"
        ? base
        : { ...base, pose, poseTicks: 0 };
    });
    return withCutscene(state, { tempActors });
  }
  const existing = cs.actorOverrides[actor.key] ?? {};
  const { pose: _p, poseTicks: _pt, ...base } = existing;
  const nextOverride: CutsceneActorOverride =
    pose === undefined || pose === "idle" ? base : { ...base, pose, poseTicks: 0 };
  const overrides: Record<string, CutsceneActorOverride> = { ...cs.actorOverrides };
  if (Object.keys(nextOverride).length === 0) delete overrides[actor.key];
  else overrides[actor.key] = nextOverride;
  return withCutscene(state, { actorOverrides: overrides });
}

function setActorFacing(world: World, state: State, ref: string, direction: Direction): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const actor = resolveActor(state, ref);
  if (actor === undefined) return state;
  if (actor.kind === "fae") return { ...state, facing: direction };
  if (actor.kind === "party") {
    const party = state.party.map((member, idx) =>
      idx === actor.index ? { ...member, facing: direction } : member,
    );
    return { ...state, party };
  }
  if (actor.kind === "temp") {
    const tempActors = cs.tempActors.map((item, idx) =>
      idx === actor.index ? { ...item, facing: direction } : item,
    );
    return withCutscene(state, { tempActors });
  }
  const existing = cs.actorOverrides[actor.key];
  const basePos =
    existing?.x !== undefined && existing.y !== undefined
      ? { x: existing.x, y: existing.y }
      : getActorPosition(world, state, ref);
  const nextOverride: CutsceneActorOverride = {
    ...existing,
    ...(basePos === undefined ? {} : { x: basePos.x, y: basePos.y }),
    facing: direction,
  };
  return withCutscene(state, {
    actorOverrides: { ...cs.actorOverrides, [actor.key]: nextOverride },
  });
}

function moveActorTo(
  world: World,
  state: State,
  ref: string,
  to: Point,
  facing: Direction,
  moved: number,
  moving: boolean,
): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const actor = resolveActor(state, ref);
  if (actor === undefined) return state;
  if (actor.kind === "fae") {
    return {
      ...state,
      player: { x: to.x, y: to.y },
      facing,
      motion: { distance: state.motion.distance + moved, moving },
    };
  }
  if (actor.kind === "party") {
    const party = state.party.map((member, idx) =>
      idx !== actor.index
        ? member
        : {
            ...member,
            x: to.x,
            y: to.y,
            facing,
            motion: { distance: member.motion.distance + moved, moving },
            stillTicks: 0,
            trail: [{ x: to.x, y: to.y }],
          },
    );
    return { ...state, party };
  }
  if (actor.kind === "temp") {
    const tempActors = cs.tempActors.map((item, idx) =>
      idx !== actor.index
        ? item
        : {
            ...item,
            x: to.x,
            y: to.y,
            facing,
            moving,
            distance: item.distance + moved,
          },
    );
    return withCutscene(state, { tempActors });
  }
  const existing = cs.actorOverrides[actor.key];
  const prevDist = existing?.distance ?? 0;
  const nextOverride: CutsceneActorOverride = {
    ...existing,
    x: to.x,
    y: to.y,
    facing,
    moving,
    distance: prevDist + moved,
  };
  return withCutscene(state, {
    actorOverrides: { ...cs.actorOverrides, [actor.key]: nextOverride },
  });
}

function resolveCameraTarget(world: World, state: State, target: CutsceneCameraTarget): Point {
  if (target === "fae") return { x: state.player.x, y: state.player.y };
  if (typeof target === "string") {
    const actorRef = target.slice("actor:".length);
    return getActorPosition(world, state, actorRef) ?? { x: state.player.x, y: state.player.y };
  }
  return target;
}

function applyFlagStep(
  world: World,
  state: State,
  flag: string,
  value: boolean,
  scope?: "ink" | "cutscene",
): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const writeInk =
    scope === "ink" || (scope === undefined && world.storyVariable(state.ink, flag) !== undefined);
  const ink = writeInk ? setInkVariables(state.ink, { [flag]: value }) : state.ink;
  return {
    ...state,
    ink,
    cutscene: { ...cs, flags: { ...cs.flags, [flag]: value } },
  };
}

function applySpawnTemp(
  world: World,
  state: State,
  step: Extract<CutsceneStep, { type: "spawnTempActor" }>,
  withEffect: boolean,
): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const defaultScale =
    world.characters[step.sprite]?.scale ?? world.party[step.sprite]?.scale ?? 0.5;
  const created: CutsceneTempActor = {
    id: step.id,
    sprite: step.sprite,
    x: step.at.x,
    y: step.at.y,
    facing: step.facing ?? "down",
    scale: step.scale ?? defaultScale,
    moving: false,
    distance: 0,
  };
  const tempActors = [...cs.tempActors.filter((item) => item.id !== step.id), created];
  let next = withCutscene(state, { tempActors });
  if (withEffect && step.effect !== undefined) next = addEffect(next, step.effect, step.at);
  return next;
}

function applyDespawnTemp(
  state: State,
  step: Extract<CutsceneStep, { type: "despawnTempActor" }>,
  withEffect: boolean,
): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  const existing = cs.tempActors.find((item) => item.id === step.id);
  const tempActors = cs.tempActors.filter((item) => item.id !== step.id);
  let next = withCutscene(state, { tempActors });
  if (withEffect && step.effect !== undefined && existing !== undefined)
    next = addEffect(next, step.effect, { x: existing.x, y: existing.y });
  return next;
}

type StepResult = {
  state: State;
  progress: CutsceneStepProgress;
  done: boolean;
};

const stepDone = (state: State): StepResult => ({
  state,
  progress: { kind: "done" },
  done: true,
});

function advanceStep(
  world: World,
  state: State,
  step: CutsceneStep,
  progress: CutsceneStepProgress,
  openKnot: OpenCutsceneKnot,
): StepResult {
  const cs = state.cutscene;
  if (cs === undefined) return stepDone(state);

  if (step.type === "moveActor") {
    const pos = getActorPosition(world, state, step.actor);
    if (pos === undefined) return stepDone(state);
    const dx = step.to.x - pos.x;
    const dy = step.to.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const currentFacing = getActorFacing(world, state, step.actor);
    if (dist <= step.speed) {
      const arrivalFacing = step.facing ?? dominantDirection(dx, dy, currentFacing);
      return stepDone(
        moveActorTo(world, state, step.actor, step.to, arrivalFacing, dist, dist > 0.0001),
      );
    }
    const ratio = step.speed / dist;
    const stepPoint = { x: pos.x + dx * ratio, y: pos.y + dy * ratio };
    const transitFacing = dominantDirection(dx, dy, currentFacing);
    const next = moveActorTo(world, state, step.actor, stepPoint, transitFacing, step.speed, true);
    return { state: next, progress: { kind: "move" }, done: false };
  }

  if (step.type === "face") {
    return stepDone(setActorFacing(world, state, step.actor, step.direction));
  }

  if (step.type === "pose") {
    if (step.ticks === undefined) {
      let next = setActorPose(state, step.actor, step.pose);
      if (step.effect !== undefined) {
        const at = getActorPosition(world, next, step.actor);
        if (at !== undefined) next = addEffect(next, step.effect, at);
      }
      return stepDone(next);
    }
    if (progress.kind === "idle") {
      let next = step.ticks > 0 ? setActorPose(state, step.actor, step.pose) : state;
      if (step.effect !== undefined) {
        const at = getActorPosition(world, next, step.actor);
        if (at !== undefined) next = addEffect(next, step.effect, at);
      }
      if (step.ticks <= 1) {
        if (step.ticks <= 0) next = setActorPose(next, step.actor, undefined);
        return stepDone(next);
      }
      return { state: next, progress: { kind: "ticks", elapsed: 1 }, done: false };
    }
    const elapsed = (progress.kind === "ticks" ? progress.elapsed : 0) + 1;
    if (elapsed >= step.ticks) return stepDone(setActorPose(state, step.actor, undefined));
    return { state, progress: { kind: "ticks", elapsed }, done: false };
  }

  if (step.type === "emote") {
    if (step.ticks <= 0) return stepDone(state);
    if (progress.kind === "idle") {
      const key = canonicalActorKey(state, step.actor);
      const created: CutsceneEmoteState = {
        actor: key,
        kind: step.kind,
        elapsed: 0,
        duration: step.ticks,
      };
      const emotes = [...cs.emotes.filter((item) => item.actor !== key), created];
      const next = withCutscene(state, { emotes });
      if (step.ticks <= 1) return stepDone(next);
      return { state: next, progress: { kind: "ticks", elapsed: 1 }, done: false };
    }
    const elapsed = (progress.kind === "ticks" ? progress.elapsed : 0) + 1;
    if (elapsed >= step.ticks) return stepDone(state);
    return { state, progress: { kind: "ticks", elapsed }, done: false };
  }

  if (step.type === "wait") {
    if (step.ticks <= 0) return stepDone(state);
    const elapsed = (progress.kind === "ticks" ? progress.elapsed : 0) + 1;
    if (elapsed >= step.ticks) return stepDone(state);
    return { state, progress: { kind: "ticks", elapsed }, done: false };
  }

  if (step.type === "cameraPan") {
    const fromX = progress.kind === "camera" ? progress.fromX : (cs.camera?.x ?? state.player.x);
    const fromY = progress.kind === "camera" ? progress.fromY : (cs.camera?.y ?? state.player.y);
    const fromZoom = progress.kind === "camera" ? progress.fromZoom : (cs.camera?.zoom ?? 1);
    const elapsed = (progress.kind === "camera" ? progress.elapsed : 0) + 1;
    const target = resolveCameraTarget(world, state, step.to);
    const targetZoom = step.zoom ?? 1;
    const t = step.ticks <= 0 ? 1 : Math.min(1, elapsed / step.ticks);
    const camera = {
      x: fromX + (target.x - fromX) * t,
      y: fromY + (target.y - fromY) * t,
      zoom: fromZoom + (targetZoom - fromZoom) * t,
    };
    const next = withCutscene(state, { camera });
    if (elapsed >= step.ticks) return stepDone(next);
    return {
      state: next,
      progress: { kind: "camera", elapsed, fromX, fromY, fromZoom },
      done: false,
    };
  }

  if (step.type === "sfx") {
    return stepDone(withCutscene(state, { tickSfx: [...cs.tickSfx, step.cue] }));
  }
  if (step.type === "setFlag") {
    return stepDone(applyFlagStep(world, state, step.flag, step.value, step.scope));
  }
  if (step.type === "spawnTempActor") return stepDone(applySpawnTemp(world, state, step, true));
  if (step.type === "despawnTempActor") return stepDone(applyDespawnTemp(state, step, true));
  if (step.type === "propState") {
    return stepDone(withCutscene(state, {
      propOverrides: { ...cs.propOverrides, [step.propId]: step.state },
    }));
  }

  if (step.type === "sayKnot") {
    if (progress.kind === "dialogue" && progress.opened) return { state, progress, done: false };
    const opened = openKnot(world, state, step.knot);
    if (opened.dialogue === null) return stepDone(withCutscene(opened, { dialogueWaiting: false }));
    return {
      state: withCutscene(opened, { dialogueWaiting: true }),
      progress: { kind: "dialogue", opened: true },
      done: false,
    };
  }

  if (step.steps.length === 0) return stepDone(state);
  const children: CutsceneStepProgress[] =
    progress.kind === "parallel"
      ? progress.children.slice()
      : step.steps.map(() => ({ kind: "idle" }));
  const doneFlags: boolean[] =
    progress.kind === "parallel" ? progress.done.slice() : step.steps.map(() => false);
  let current = state;
  for (let i = 0; i < step.steps.length; i += 1) {
    if (doneFlags[i]) continue;
    const childStep = step.steps[i];
    const childProgress = children[i] ?? { kind: "idle" };
    if (childStep === undefined) continue;
    const result = advanceStep(world, current, childStep, childProgress, openKnot);
    current = result.state;
    children[i] = result.progress;
    doneFlags[i] = result.done;
    if (current.cutscene?.dialogueWaiting === true) break;
  }
  const allDone = doneFlags.every(Boolean);
  return {
    state: current,
    progress: allDone ? { kind: "done" } : { kind: "parallel", children, done: doneFlags },
    done: allDone,
  };
}

type FastForwardResult = {
  state: State;
  pausedAtDialogue: boolean;
  progress: CutsceneStepProgress;
};

const ffDone = (state: State): FastForwardResult => ({
  state,
  pausedAtDialogue: false,
  progress: { kind: "done" },
});

function fastForwardStep(
  world: World,
  state: State,
  step: CutsceneStep,
  currentProgress: CutsceneStepProgress | undefined,
  openKnot: OpenCutsceneKnot,
): FastForwardResult {
  const cs = state.cutscene;
  if (cs === undefined || currentProgress?.kind === "done") return ffDone(state);

  if (step.type === "moveActor") {
    const pos = getActorPosition(world, state, step.actor);
    if (pos === undefined) return ffDone(state);
    const dx = step.to.x - pos.x;
    const dy = step.to.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const facing =
      step.facing ?? dominantDirection(dx, dy, getActorFacing(world, state, step.actor));
    return ffDone(moveActorTo(world, state, step.actor, step.to, facing, dist, false));
  }

  if (step.type === "face") return ffDone(setActorFacing(world, state, step.actor, step.direction));
  if (step.type === "pose") {
    const pose = step.ticks === undefined ? step.pose : undefined;
    return ffDone(setActorPose(state, step.actor, pose));
  }
  if (step.type === "emote" || step.type === "wait" || step.type === "sfx") return ffDone(state);
  if (step.type === "cameraPan") {
    const target = resolveCameraTarget(world, state, step.to);
    const camera = { x: target.x, y: target.y, zoom: step.zoom ?? 1 };
    return ffDone(withCutscene(state, { camera }));
  }
  if (step.type === "setFlag") {
    return ffDone(applyFlagStep(world, state, step.flag, step.value, step.scope));
  }
  if (step.type === "spawnTempActor") return ffDone(applySpawnTemp(world, state, step, false));
  if (step.type === "despawnTempActor") return ffDone(applyDespawnTemp(state, step, false));
  if (step.type === "propState") {
    return ffDone(withCutscene(state, {
      propOverrides: { ...cs.propOverrides, [step.propId]: step.state },
    }));
  }

  if (step.type === "sayKnot") {
    const opened = openKnot(world, state, step.knot);
    if (opened.dialogue === null) return ffDone(withCutscene(opened, { dialogueWaiting: false }));
    return {
      state: withCutscene(opened, {
        dialogueWaiting: true,
        cancelHoldTicks: 0,
        emotes: [],
        effects: [],
      }),
      pausedAtDialogue: true,
      progress: { kind: "dialogue", opened: true },
    };
  }

  const children: CutsceneStepProgress[] =
    currentProgress?.kind === "parallel"
      ? currentProgress.children.slice()
      : step.steps.map(() => ({ kind: "idle" }));
  const doneFlags: boolean[] =
    currentProgress?.kind === "parallel"
      ? currentProgress.done.slice()
      : step.steps.map(() => false);
  let current = state;
  for (let i = 0; i < step.steps.length; i += 1) {
    if (doneFlags[i]) continue;
    const childStep = step.steps[i];
    if (childStep === undefined) continue;
    const res = fastForwardStep(world, current, childStep, children[i], openKnot);
    current = res.state;
    children[i] = res.progress;
    if (res.pausedAtDialogue) {
      return {
        state: current,
        pausedAtDialogue: true,
        progress: { kind: "parallel", children, done: doneFlags },
      };
    }
    doneFlags[i] = true;
  }
  return { state: current, pausedAtDialogue: false, progress: { kind: "done" } };
}

function fastForwardCutscene(
  world: World,
  state: State,
  script: CutsceneScript,
  openKnot: OpenCutsceneKnot,
): State {
  const cs = state.cutscene;
  if (cs === undefined) return state;
  let current = withCutscene(state, { cancelHoldTicks: 0, emotes: [], effects: [] });
  for (let i = cs.stepIndex; i < script.steps.length; i += 1) {
    const step = script.steps[i];
    if (step === undefined) continue;
    const prevProgress = i === cs.stepIndex ? cs.progress : undefined;
    const res = fastForwardStep(world, current, step, prevProgress, openKnot);
    current = res.state;
    if (res.pausedAtDialogue) {
      return withCutscene(current, {
        stepIndex: i,
        progress: res.progress,
        cancelHoldTicks: 0,
        dialogueWaiting: true,
      });
    }
  }
  return finishCutscene(current, script.id);
}

export function startCutscene(world: World, state: State, id: string): State {
  const script = world.cutscenes[id];
  if (
    script === undefined ||
    state.cutscene !== undefined ||
    state.battle !== null ||
    state.arcade !== null
  ) {
    return state;
  }
  if (script.steps.length === 0) {
    return {
      ...state,
      motion: { ...state.motion, moving: false },
      party: haltedParty(state.party),
      cutscenesSeen: markCutsceneSeen(state, id),
    };
  }
  const cutscene: CutsceneState = {
    id,
    tick: 0,
    stepIndex: 0,
    progress: { kind: "idle" },
    camera: null,
    tempActors: [],
    actorOverrides: {},
    emotes: [],
    effects: [],
    propOverrides: {},
    flags: {},
    tickSfx: [],
    cancelHoldTicks: 0,
    dialogueWaiting: false,
  };
  return {
    ...state,
    motion: { ...state.motion, moving: false },
    party: haltedParty(state.party),
    cutscene,
  };
}

function prepareTickCutscene(cs: CutsceneState, input: ActionFrame): CutsceneState {
  const effects = cs.effects
    .map((item) => ({ ...item, elapsed: item.elapsed + 1 }))
    .filter((item) => item.elapsed < item.duration);
  const emotes = cs.emotes
    .map((item) => ({ ...item, elapsed: item.elapsed + 1 }))
    .filter((item) => item.elapsed < item.duration);
  const tempActors = cs.tempActors.map((actor) => ({
    ...actor,
    moving: false,
    ...(actor.pose === undefined ? {} : { poseTicks: (actor.poseTicks ?? 0) + 1 }),
  }));
  const actorOverrides: Record<string, CutsceneActorOverride> = {};
  for (const [key, override] of Object.entries(cs.actorOverrides)) {
    actorOverrides[key] = {
      ...override,
      ...(override.moving === undefined ? {} : { moving: false }),
      ...(override.pose === undefined ? {} : { poseTicks: (override.poseTicks ?? 0) + 1 }),
    };
  }
  return {
    ...cs,
    tick: cs.tick + 1,
    tickSfx: [],
    effects,
    emotes,
    tempActors,
    actorOverrides,
    cancelHoldTicks: input.cancel ? cs.cancelHoldTicks + 1 : 0,
  };
}

export function stepCutscene(
  world: World,
  state: State,
  input: ActionFrame,
  openKnot: OpenCutsceneKnot,
): { state: State; events: Event[] } {
  const cs = state.cutscene;
  if (cs === undefined) return { state, events: [] };
  const script = world.cutscenes[cs.id];
  if (script === undefined) {
    return { state: finishCutscene(state, cs.id), events: [] };
  }
  const nextCutscene = prepareTickCutscene(cs, input);
  const prepared: State = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    party: haltedParty(state.party),
    cutscene: nextCutscene,
  };
  if (nextCutscene.cancelHoldTicks >= CUTSCENE_SKIP_HOLD_TICKS) {
    return { state: fastForwardCutscene(world, prepared, script, openKnot), events: [] };
  }
  const step = script.steps[nextCutscene.stepIndex];
  if (step === undefined) {
    return { state: finishCutscene(prepared, script.id), events: [] };
  }
  const result = advanceStep(world, prepared, step, nextCutscene.progress, openKnot);
  if (result.done) {
    const nextIndex = nextCutscene.stepIndex + 1;
    if (nextIndex >= script.steps.length) {
      return { state: finishCutscene(result.state, script.id), events: [] };
    }
    return {
      state: withCutscene(result.state, {
        stepIndex: nextIndex,
        progress: { kind: "idle" },
      }),
      events: [],
    };
  }
  return {
    state: withCutscene(result.state, { progress: result.progress }),
    events: [],
  };
}

function completeWaitingDialogue(
  progress: CutsceneStepProgress,
): { progress: CutsceneStepProgress; completed: boolean; stepDone: boolean } {
  if (progress.kind === "dialogue" && progress.opened) {
    return { progress: { kind: "done" }, completed: true, stepDone: true };
  }
  if (progress.kind === "parallel") {
    const children = progress.children.slice();
    const done = progress.done.slice();
    let completed = false;
    for (let i = 0; i < children.length; i += 1) {
      if (done[i]) continue;
      const child = children[i];
      if (child === undefined) continue;
      const res = completeWaitingDialogue(child);
      if (res.completed) {
        children[i] = res.progress;
        if (res.stepDone) done[i] = true;
        completed = true;
        break;
      }
    }
    const allDone = done.every(Boolean);
    return {
      progress: allDone ? { kind: "done" } : { kind: "parallel", children, done },
      completed,
      stepDone: allDone,
    };
  }
  return { progress, completed: false, stepDone: progress.kind === "done" };
}

export function resumeCutsceneAfterDialogue(world: World, state: State): State {
  const cs = state.cutscene;
  if (cs === undefined || !cs.dialogueWaiting) return state;
  const script = world.cutscenes[cs.id];
  if (script === undefined) return finishCutscene(state, cs.id);
  const resolved = completeWaitingDialogue(cs.progress);
  if (resolved.stepDone) {
    const nextIndex = cs.stepIndex + 1;
    if (nextIndex >= script.steps.length) {
      return finishCutscene(state, script.id);
    }
    return withCutscene(state, {
      stepIndex: nextIndex,
      progress: { kind: "idle" },
      dialogueWaiting: false,
    });
  }
  return withCutscene(state, {
    progress: resolved.progress,
    dialogueWaiting: false,
  });
}

export function findTriggeredCutscene(
  world: World,
  previous: State,
  next: State,
): CutsceneScript | undefined {
  if (
    next.cutscene !== undefined ||
    next.battle !== null ||
    next.arcade !== null ||
    next.dialogue !== null ||
    next.transition !== null ||
    next.finale !== null
  ) {
    return undefined;
  }
  const scripts = Object.values(world.cutscenes).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  for (const script of scripts) {
    const trigger = script.trigger;
    if (trigger === undefined || trigger.kind === "manual") continue;
    if (trigger.once !== false && isCutsceneSeen(next, script.id)) continue;
    if (
      trigger.requiresVariable !== undefined &&
      world.storyVariable(next.ink, trigger.requiresVariable) !== true
    ) {
      continue;
    }
    if (
      trigger.forbidsVariable !== undefined &&
      world.storyVariable(next.ink, trigger.forbidsVariable) === true
    ) {
      continue;
    }
    if (trigger.kind === "after-knot") {
      if (
        next.area === trigger.area &&
        previous.dialogue !== null &&
        next.dialogue === null &&
        previous.dialogue.knot === trigger.knot
      ) {
        return script;
      }
      continue;
    }
    if (trigger.kind === "area-enter") {
      const entered =
        (previous.tick === 0 && next.tick === 1) ||
        (previous.transition !== null && next.transition === null) ||
        (previous.area !== next.area && next.transition === null);
      if (next.area === trigger.area && entered) return script;
    }
  }
  return undefined;
}

export function cutsceneView(state: State): CutsceneView | null {
  const cs = state.cutscene;
  if (cs === undefined) return null;
  return {
    id: cs.id,
    tick: cs.tick,
    stepIndex: cs.stepIndex,
    letterbox: Math.min(1, cs.tick / CUTSCENE_LETTERBOX_TICKS),
    camera: cs.camera,
    tempActors: cs.tempActors,
    actorOverrides: cs.actorOverrides,
    emotes: cs.emotes,
    effects: cs.effects,
    propOverrides: cs.propOverrides,
    skipProgress: Math.min(1, cs.cancelHoldTicks / CUTSCENE_SKIP_HOLD_TICKS),
    dialogueActive: state.dialogue !== null,
  };
}

function collectSpriteIds(steps: readonly CutsceneStep[], target: Set<string>): void {
  for (const step of steps) {
    if (step.type === "spawnTempActor") target.add(step.sprite);
    else if (step.type === "parallel") collectSpriteIds(step.steps, target);
  }
}

export function cutsceneSpriteIds(script: CutsceneScript): string[] {
  const sprites = new Set<string>();
  collectSpriteIds(script.steps, sprites);
  return [...sprites];
}
