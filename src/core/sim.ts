import type {
  Npc,
  Direction,
  ActionFrame,
  Area,
  Event,
  Fixture,
  Point,
  Polygon,
  Spawn,
  State,
  World,
  Battle,
  Grade,
  CritterCommandId,
  BattleView,
} from "./types";
import { createInkState, inkVariable, runInk } from "./ink";

export const blankInput = (): ActionFrame => ({
  move: { x: 0, y: 0 },
  confirm: false,
  cancel: false,
  menu: false,
});

export function createState(
  world: World,
  fixture: Fixture,
  seed = fixture.seed ?? 1,
): State {
  const area = world.areas[fixture.area];
  if (area === undefined)
    throw new Error(`Unknown fixture area: ${fixture.area}`);
  const spawn = area.spawns[fixture.spawn];
  if (spawn === undefined) throw new Error(`Unknown spawn: ${fixture.spawn}`);
  const slot = followerSlot(
    area,
    spawn,
    world.tunables.follow.slot,
    world.tunables.follow.radius,
    world.tunables.follow.heel,
  );
  if (slot === undefined)
    throw new Error(`No Maddie slot for ${fixture.area}.${fixture.spawn}`);
  return {
    tick: 0,
    area: area.id,
    player: { x: spawn.x, y: spawn.y },
    facing: spawn.facing,
    rng: seed >>> 0,
    previousInput: blankInput(),
    motion: { distance: 0, moving: false },
    transition: null,
    maddie: {
      x: slot.x,
      y: slot.y,
      facing: spawn.facing,
      motion: { distance: 0, moving: false },
      stillTicks: 0,
    },
    trail: [slot, { x: spawn.x, y: spawn.y }],
    ink: createInkState(world.story, seed),
    dialogue: null,
    critters: Object.fromEntries(
      Object.keys(world.critters).map((id) => [id, "chaos"]),
    ),
    stickers: [],
    safeSpot: { area: area.id, spawn: fixture.spawn },
    battle: null,
    journalOpen: false,
  };
}

export function nextRandom(state: State): [number, State] {
  const next = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, { ...state, rng: next }];
}

function vertex(polygon: Polygon, index: number): [number, number] {
  const value = polygon[index];
  if (value === undefined) throw new Error("Polygon has no vertices");
  return value;
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = vertex(polygon, index);
    const prior = vertex(polygon, previous);
    const crosses = current[1] > point.y !== prior[1] > point.y;
    if (
      crosses &&
      point.x <
        ((prior[0] - current[0]) * (point.y - current[1])) /
          (prior[1] - current[1]) +
          current[0]
    )
      inside = !inside;
  }
  return inside;
}

export function closestPointOnPolygon(
  point: Point,
  polygon: Polygon,
): { point: Point; distance: number } {
  let bestPoint = { x: vertex(polygon, 0)[0], y: vertex(polygon, 0)[1] };
  let best = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = vertex(polygon, index);
    const end = vertex(polygon, (index + 1) % polygon.length);
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = dx * dx + dy * dy;
    const projection =
      length === 0
        ? 0
        : ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / length;
    const t = Math.max(0, Math.min(1, projection));
    const nearest = { x: start[0] + dx * t, y: start[1] + dy * t };
    const differenceX = point.x - nearest.x;
    const differenceY = point.y - nearest.y;
    const distance = Math.sqrt(
      differenceX * differenceX + differenceY * differenceY,
    );
    if (distance < best) {
      best = distance;
      bestPoint = nearest;
    }
  }
  return { point: bestPoint, distance: best };
}

export function distanceToPolygon(point: Point, polygon: Polygon): number {
  return closestPointOnPolygon(point, polygon).distance;
}

function pushFromPolygon(
  point: Point,
  polygon: Polygon,
  radius: number,
  keepInside: boolean,
): Point {
  const inside = pointInPolygon(point, polygon);
  const closest = closestPointOnPolygon(point, polygon);
  const dx = point.x - closest.point.x;
  const dy = point.y - closest.point.y;
  const distance = closest.distance;
  if (keepInside && inside && distance >= radius) return point;
  if (!keepInside && !inside && distance >= radius) return point;
  const safeDistance = Math.max(distance, 0.0001);
  const direction = keepInside ? (inside ? 1 : -1) : inside ? -1 : 1;
  const amount =
    !keepInside && inside
      ? radius + distance
      : keepInside && !inside
        ? radius + distance
        : radius - distance + 0.001;
  return {
    x: point.x + ((direction * dx) / safeDistance) * amount,
    y: point.y + ((direction * dy) / safeDistance) * amount,
  };
}

export function resolveCollision(
  point: Point,
  area: Area,
  radius: number,
): Point {
  let result = point;
  for (let pass = 0; pass < 8; pass += 1) {
    result = pushFromPolygon(result, area.walkable, radius, true);
    for (const blocker of area.blockers)
      result = pushFromPolygon(result, blocker, radius, false);
  }
  return result;
}

function distance(a: Point, b: Point): number {
  const x = b.x - a.x;
  const y = b.y - a.y;
  return Math.sqrt(x * x + y * y);
}

export function targetInteractable(
  world: World,
  state: State,
): Area["interactables"][number] | undefined {
  if (state.transition !== null || state.dialogue !== null) return undefined;
  const area = world.areas[state.area];
  if (area === undefined) return undefined;
  const facing = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[state.facing];
  const calmCritters = area.critters.flatMap((critter) => {
    const content = world.critters[critter.id];
    return state.critters[critter.id] === "calm" && content !== undefined
      ? [
          {
            id: `critter:${critter.id}`,
            knot: content.calmKnot,
            point: critter.point,
            prompt: content.calmPrompt,
          },
        ]
      : [];
  });
  const people = area.npcs.map((npc) => ({
    id: `npc:${npc.id}`,
    knot: npc.knot,
    point: npc.point,
    prompt: npc.prompt,
  }));
  return [...area.interactables, ...calmCritters, ...people]
    .map((item) => {
      const dx = item.point.x - state.player.x;
      const dy = item.point.y - state.player.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const dot = length === 0 ? 1 : (dx * facing.x + dy * facing.y) / length;
      return { item, length, dot };
    })
    .filter(
      (item) =>
        item.length <= world.tunables.interact.range && item.dot >= 0.34,
    )
    .sort((a, b) => a.length - b.length)[0]?.item;
}

// The facts the story's calmed(id) answers from: each critter's state.
export function calmedFacts(state: State): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(state.critters).map(([id, value]) => [id, value === "calm"]),
  );
}

// Which way a person in the area looks: toward Fae while she talks to them
// (along the larger axis of the gap between them), otherwise as authored.
export function npcFacing(state: State, npc: Npc): Direction {
  if (state.dialogue === null || state.dialogue.knot !== npc.knot)
    return npc.facing;
  const dx = state.player.x - npc.point.x;
  const dy = state.player.y - npc.point.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function battleMessage(
  battle: Battle,
  text: string,
  phase: Battle["phase"],
): Battle {
  return { ...battle, phase, message: text, revealed: 0, phaseTicks: 0 };
}

export function gradeAim(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}

export function battleCommands(
  world: World,
  state: State,
): {
  id: CritterCommandId;
  label: string;
  detail: string | null;
  disabled: boolean;
}[] {
  const battle = state.battle;
  if (battle === null) return [];
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return [];
  return [
    {
      id: "soothe",
      label: world.battle.commands.soothe.label,
      detail: null,
      disabled: false,
    },
    {
      id: "play",
      label: world.battle.commands.play.label,
      detail: battle.rest > 0 ? critter.lines.playResting : null,
      disabled: battle.rest > 0,
    },
    {
      id: "snack",
      label: world.battle.commands.snack.label,
      detail: (world.battle.commands.snack.snackDetail ?? "").replace(
        "N",
        String(battle.snacks),
      ),
      disabled: battle.snacks === 0,
    },
    {
      id: "run",
      label: world.battle.commands.run.label,
      detail: null,
      disabled: false,
    },
  ];
}

export function battleView(world: World, state: State): BattleView | null {
  const battle = state.battle;
  if (battle === null) return null;
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return null;
  return {
    critterId: critter.id,
    critterName: critter.name,
    battleHeight: critter.battleHeight,
    auraCentre: critter.auraCentre,
    bodyCentre: critter.bodyCentre,
    phase: battle.phase,
    message: battle.message,
    revealed: battle.revealed,
    commands: battleCommands(world, state),
    selected: battle.selected,
    energy: battle.energy,
    energyMax: critter.energyMax,
    calm: battle.calm,
    calmMax: critter.calmMax,
    aim:
      battle.aim === null
        ? null
        : {
            side: battle.aim.side,
            progress: battle.aimTick / battle.aim.ticks,
            target: battle.aim.targetTick / battle.aim.ticks,
          },
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
  };
}

function nextCommand(
  selected: number,
  delta: number,
  commands: ReturnType<typeof battleCommands>,
): number {
  let result = selected;
  for (let count = 0; count < commands.length; count += 1) {
    result = (result + delta + commands.length) % commands.length;
    if (!commands[result]?.disabled) return result;
  }
  return selected;
}

function startAim(
  battle: Battle,
  side: "critter" | "fae",
  ticks: number,
  targetTick: number,
  greatWindow: number,
  goodWindow: number,
): Battle {
  return {
    ...battle,
    phase: "aim",
    aim: { side, ticks, targetTick, greatWindow, goodWindow },
    aimTick: 0,
    phaseTicks: 0,
    lastGrade: null,
    message: "",
    revealed: 0,
  };
}

function battleStep(world: World, state: State, input: ActionFrame): State {
  const battle = state.battle;
  if (battle === null) return state;
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return state;
  const confirm = input.confirm && !state.previousInput.confirm;
  const nextBase = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    motion: { ...state.motion, moving: false },
    maddie: {
      ...state.maddie,
      stillTicks: state.maddie.stillTicks + 1,
      motion: { ...state.maddie.motion, moving: false },
    },
  };
  let next = { ...battle, phaseTicks: battle.phaseTicks + 1 };
  if (next.revealed < next.message.length)
    return {
      ...nextBase,
      battle: {
        ...next,
        revealed: confirm
          ? next.message.length
          : Math.min(
              next.message.length,
              next.revealed + world.tunables.interact.revealPerTick,
            ),
      },
    };
  if (
    [
      "intro",
      "result",
      "burst",
      "burstResult",
      "run",
      "soothed",
      "reward",
      "rest",
    ].includes(next.phase)
  ) {
    if (!confirm) return { ...nextBase, battle: next };
    if (next.phase === "intro")
      next = {
        ...next,
        phase: "command",
        message: critter.lines.command,
        revealed: 0,
        phaseTicks: 0,
      };
    else if (next.phase === "result")
      next =
        next.calm >= critter.calmMax
          ? battleMessage(next, critter.lines.soothed, "soothed")
          : battleMessage(next, critter.lines.burst, "burst");
    else if (next.phase === "burst")
      next = startAim(
        next,
        "fae",
        critter.burst.ticks,
        critter.burst.targetTick,
        critter.burst.greatWindow,
        critter.burst.goodWindow,
      );
    else if (next.phase === "burstResult")
      next =
        next.energy <= 0
          ? battleMessage(next, critter.lines.rest, "rest")
          : {
              ...next,
              phase: "command",
              message: critter.lines.command,
              revealed: 0,
              phaseTicks: 0,
              rest: next.rest,
            };
    else if (next.phase === "soothed")
      next = battleMessage(next, critter.lines.reward, "reward");
    else if (next.phase === "reward")
      return {
        ...nextBase,
        critters: { ...state.critters, [next.critterId]: "calm" },
        stickers: state.stickers.includes(critter.sticker.id)
          ? state.stickers
          : [...state.stickers, critter.sticker.id],
        battle: null,
      };
    else if (next.phase === "run")
      return {
        ...nextBase,
        player: { ...next.entry },
        facing:
          state.facing === "up"
            ? "down"
            : state.facing === "down"
              ? "up"
              : state.facing === "left"
                ? "right"
                : "left",
        battle: null,
      };
    else if (next.phase === "rest")
      next = { ...next, phase: "rest", phaseTicks: next.phaseTicks };
    if (
      next.phase === "rest" &&
      battle.phase === "rest" &&
      state.transition === null
    )
      return {
        ...nextBase,
        battle: null,
        transition: { target: state.safeSpot, phase: "out", elapsed: 0 },
      };
    return { ...nextBase, battle: next };
  }
  if (next.phase === "command") {
    const commands = battleCommands(world, { ...state, battle: next });
    if (input.choose !== undefined) {
      const chosen = commands[input.choose];
      if (chosen !== undefined && !chosen.disabled)
        next = { ...next, selected: input.choose };
      else return { ...nextBase, battle: next };
    }
    const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
    const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
    if (up || down)
      return {
        ...nextBase,
        battle: {
          ...next,
          selected: nextCommand(next.selected, down ? 1 : -1, commands),
        },
      };
    if (!confirm && input.choose === undefined)
      return { ...nextBase, battle: next };
    const chosen = commands[next.selected];
    if (chosen === undefined || chosen.disabled)
      return { ...nextBase, battle: next };
    if (chosen.id === "run")
      return {
        ...nextBase,
        battle: battleMessage(next, critter.lines.run, "run"),
      };
    if (chosen.id === "snack") {
      const message = battleMessage(next, critter.lines.snack, "result");
      return {
        ...nextBase,
        battle: {
          ...message,
          rest: Math.max(0, next.rest - 1),
          snacks: next.snacks - 1,
          energy: Math.min(
            critter.energyMax,
            next.energy + critter.commands.snack.energy,
          ),
          calm: Math.min(
            critter.calmMax,
            next.calm + critter.commands.snack.calm,
          ),
        },
      };
    }
    const timing = critter.timing;
    return {
      ...nextBase,
      battle: startAim(
        {
          ...next,
          command: chosen.id === "play" ? "play" : "soothe",
          rest:
            chosen.id === "play"
              ? critter.commands.play.rest
              : Math.max(0, next.rest - 1),
        },
        "critter",
        timing.aimTicks,
        timing.targetTick,
        timing.greatWindow,
        timing.goodWindow,
      ),
    };
  }
  if (next.phase === "aim" && next.aim !== null) {
    const aim = next.aim;
    const press = confirm;
    const tick = next.aimTick + 1;
    const result: Grade | null =
      press || tick >= aim.ticks
        ? press
          ? gradeAim(tick - aim.targetTick, aim.greatWindow, aim.goodWindow)
          : "miss"
        : null;
    if (result === null)
      return {
        ...nextBase,
        battle: {
          ...next,
          aimTick: tick,
          aim: { ...aim },
        },
      };
    if (aim.side === "critter") {
      const command =
        next.command === "play"
          ? critter.commands.play
          : critter.commands.soothe;
      const bonus =
        result === "great"
          ? command.great
          : result === "good"
            ? command.good
            : 0;
      const calm = Math.min(critter.calmMax, next.calm + command.calm + bonus);
      return {
        ...nextBase,
        battle: battleMessage(
          {
            ...next,
            calm,
            lastGrade: result,
            rewardSticker: calm >= critter.calmMax ? critter.sticker.id : null,
          },
          critter.lines[next.command === "play" ? "play" : "soothe"][result],
          "result",
        ),
      };
    }
    const random = nextRandom(nextBase);
    const base = random[0] < critter.burst.bigChance ? 2 : 1;
    const damage =
      result === "great" ? 0 : result === "good" ? Math.max(0, base - 1) : base;
    return {
      ...random[1],
      battle: battleMessage(
        { ...next, energy: next.energy - damage, lastGrade: result },
        critter.lines.burstResult[result],
        "burstResult",
      ),
    };
  }
  return { ...nextBase, battle: next };
}

function dialogueState(
  knot: string,
  result: ReturnType<typeof runInk>,
): State["dialogue"] {
  return {
    knot,
    speaker: result.line?.speaker ?? null,
    text: result.line?.text ?? "",
    revealed: 0,
    choices: result.choices,
    selected: 0,
    ended: result.ended,
  };
}

/*
 * Dialogue state machine (spec section 7). Fae is frozen throughout; Maddie
 * keeps counting still ticks so she sits while Fae reads.
 *
 *   typing ──confirm──▶ shown (whole line at once)
 *   typing ──ticks────▶ shown (revealPerTick characters per tick)
 *   shown, choices    ──up/down──▶ move the selection (wraps)
 *   shown, choices    ──confirm / touch choose──▶ Ink choose ▶ next line
 *   shown, no choices ──confirm──▶ Ink next ▶ next line, or closed when ended
 */
function dialogueStep(world: World, state: State, input: ActionFrame): State {
  const dialogue = state.dialogue;
  if (dialogue === null) return state;
  const previous = state.previousInput;
  const confirm = input.confirm && !previous.confirm;
  const next: State = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    maddie: {
      ...state.maddie,
      stillTicks: state.maddie.stillTicks + 1,
      motion: { ...state.maddie.motion, moving: false },
    },
  };
  if (dialogue.revealed < dialogue.text.length) {
    const revealed = confirm
      ? dialogue.text.length
      : Math.min(
          dialogue.text.length,
          dialogue.revealed + world.tunables.interact.revealPerTick,
        );
    return { ...next, dialogue: { ...dialogue, revealed } };
  }
  const count = dialogue.choices.length;
  if (count === 0) {
    if (!confirm) return next;
    if (dialogue.ended) return { ...next, dialogue: null };
    const result = runInk(
      world.story,
      state.ink,
      { type: "next" },
      calmedFacts(state),
    );
    return {
      ...next,
      ink: result.ink,
      dialogue:
        result.line === null && result.choices.length === 0
          ? null
          : dialogueState(dialogue.knot, result),
    };
  }
  const tapped =
    input.choose !== undefined && input.choose >= 0 && input.choose < count
      ? input.choose
      : undefined;
  const chosen = tapped ?? (confirm ? dialogue.selected : undefined);
  if (chosen !== undefined) {
    const result = runInk(
      world.story,
      state.ink,
      {
        type: "choose",
        index: chosen,
      },
      calmedFacts(state),
    );
    return {
      ...next,
      ink: result.ink,
      dialogue:
        result.line === null && result.choices.length === 0
          ? null
          : dialogueState(dialogue.knot, result),
    };
  }
  const up = input.move.y < -0.5 && previous.move.y >= -0.5;
  const down = input.move.y > 0.5 && previous.move.y <= 0.5;
  if (!up && !down) return next;
  const selected = (dialogue.selected + (down ? 1 : -1) + count) % count;
  return { ...next, dialogue: { ...dialogue, selected } };
}

function segmentClear(area: Area, start: Point, end: Point): boolean {
  const length = distance(start, end);
  const samples = Math.max(1, Math.ceil(length / 5));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    if (
      !pointInPolygon(point, area.walkable) ||
      area.blockers.some((blocker) => pointInPolygon(point, blocker))
    )
      return false;
  }
  return true;
}

function validFollowerPoint(area: Area, point: Point, radius: number): boolean {
  return (
    pointInPolygon(point, area.walkable) &&
    distanceToPolygon(point, area.walkable) >= radius &&
    area.blockers.every(
      (blocker) =>
        !pointInPolygon(point, blocker) &&
        distanceToPolygon(point, blocker) >= radius,
    )
  );
}

export function followerSlot(
  area: Area,
  spawn: Spawn,
  slot: number,
  radius: number,
  heel = slot,
): Point | undefined {
  return visibleFollowerSlot(area, spawn, spawn, heel, slot, radius);
}

export function hiddenFraction(maddie: Point, fae: Point): number {
  if (maddie.y >= fae.y) return 0;
  const left = Math.max(maddie.x - 22, fae.x - 25);
  const right = Math.min(maddie.x + 22, fae.x + 25);
  const top = Math.max(maddie.y - 60, fae.y - 140);
  const bottom = Math.min(maddie.y, fae.y);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return (width * height) / (44 * 60);
}

export function visibleFollowerSlot(
  area: Area,
  fae: Point,
  start: Point,
  heel: number,
  slot: number,
  radius: number,
): Point | undefined {
  const sign = start.x - fae.x > 0 ? 1 : -1;
  const heelCandidates = [
    { x: fae.x + sign * heel, y: fae.y - 6 },
    { x: fae.x - sign * heel, y: fae.y - 6 },
    { x: fae.x + sign * heel, y: fae.y + 24 },
    { x: fae.x - sign * heel, y: fae.y + 24 },
  ];
  const candidates = [...heelCandidates];
  const direction = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const facings: Spawn["facing"][] = ["up", "down", "left", "right"];
  for (const facing of facings) {
    const vector = direction[facing];
    candidates.push({ x: fae.x - vector.x * slot, y: fae.y - vector.y * slot });
  }
  return candidates.find(
    (point) =>
      validFollowerPoint(area, point, radius) &&
      segmentClear(area, start, point) &&
      hiddenFraction(point, fae) === 0,
  );
}

function pathDistance(start: Point, points: Point[]): number {
  let total = 0;
  let previous = start;
  for (const point of points) {
    total += distance(previous, point);
    previous = point;
  }
  return total;
}

function updateMaddie(
  world: World,
  area: Area,
  state: State,
  player: Point,
  playerMoved: boolean,
): { maddie: State["maddie"]; trail: Point[] } {
  const tune = world.tunables.follow;
  const trail = state.trail.slice();
  const last = trail[trail.length - 1];
  if (
    playerMoved &&
    (last === undefined || distance(last, player) >= tune.trailSpacing)
  )
    trail.push({ ...player });
  while (trail.length > tune.trailMax) trail.shift();
  const route = [...trail, player];
  const direct = distance(state.maddie, player);
  if (
    !playerMoved &&
    state.maddie.stillTicks >= tune.settleDelayTicks &&
    hiddenFraction(state.maddie, player) > 0.25
  ) {
    const slot = visibleFollowerSlot(
      area,
      player,
      state.maddie,
      tune.heel,
      tune.slot,
      tune.radius,
    );
    if (slot !== undefined && segmentClear(area, state.maddie, slot)) {
      const length = distance(state.maddie, slot);
      const amount = Math.min(world.tunables.walkSpeed / 60, length);
      const ratio = length === 0 ? 0 : amount / length;
      const position = resolveCollision(
        {
          x: state.maddie.x + (slot.x - state.maddie.x) * ratio,
          y: state.maddie.y + (slot.y - state.maddie.y) * ratio,
        },
        area,
        tune.radius,
      );
      const dx = position.x - state.maddie.x;
      const dy = position.y - state.maddie.y;
      const facing =
        Math.abs(dx) >= Math.abs(dy)
          ? dx < 0
            ? "left"
            : "right"
          : dy < 0
            ? "up"
            : "down";
      const moved = distance(state.maddie, position);
      return {
        maddie: {
          x: position.x,
          y: position.y,
          facing,
          stillTicks: state.maddie.stillTicks + 1,
          motion: {
            distance: state.maddie.motion.distance + moved,
            moving: moved > 0.0001,
          },
        },
        trail,
      };
    }
  }
  if (direct <= tune.stop && segmentClear(area, state.maddie, player)) {
    return {
      maddie: {
        ...state.maddie,
        stillTicks: state.maddie.stillTicks + 1,
        motion: { ...state.maddie.motion, moving: false },
      },
      trail: trail.slice(-1),
    };
  }
  const routeLength = pathDistance(state.maddie, route);
  const moving = state.maddie.motion.moving
    ? routeLength > tune.stop
    : routeLength > tune.distance;
  if (!moving) {
    return {
      maddie: {
        ...state.maddie,
        stillTicks: state.maddie.stillTicks + 1,
        motion: { ...state.maddie.motion, moving: false },
      },
      trail,
    };
  }
  let position = { x: state.maddie.x, y: state.maddie.y };
  let remaining =
    (world.tunables.walkSpeed / 60) *
    (routeLength > tune.distance + 40 ? tune.catchUp : 1);
  const targets = route.slice();
  while (remaining > 0 && targets.length > 0) {
    const target = targets[0];
    if (target === undefined) break;
    const length = distance(position, target);
    if (length <= remaining) {
      position = target;
      remaining -= length;
      targets.shift();
      continue;
    }
    const ratio = remaining / length;
    position = {
      x: position.x + (target.x - position.x) * ratio,
      y: position.y + (target.y - position.y) * ratio,
    };
    remaining = 0;
  }
  const resolved = resolveCollision(position, area, tune.radius);
  const dx = resolved.x - state.maddie.x;
  const dy = resolved.y - state.maddie.y;
  let facing = state.maddie.facing;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0)
    facing = dx < 0 ? "left" : "right";
  else if (dy !== 0) facing = dy < 0 ? "up" : "down";
  const moved = Math.sqrt(dx * dx + dy * dy);
  // `route` ends with Fae's live position, which is a walking target but not a
  // breadcrumb: keep only the unconsumed breadcrumbs so the spacing holds.
  const unvisited =
    targets[targets.length - 1] === player ? targets.slice(0, -1) : targets;
  return {
    maddie: {
      x: resolved.x,
      y: resolved.y,
      facing,
      stillTicks: playerMoved ? 0 : state.maddie.stillTicks + 1,
      motion: {
        distance: state.maddie.motion.distance + moved,
        moving: moved > 0.0001,
      },
    },
    trail: unvisited,
  };
}

export function step(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`Unknown state area: ${state.area}`);
  if (state.battle !== null)
    return { state: battleStep(world, state, input), events: [] };
  if (state.dialogue !== null)
    return { state: dialogueStep(world, state, input), events: [] };
  const menuEdge = input.menu && !state.previousInput.menu;
  const cancelEdge = input.cancel && !state.previousInput.cancel;
  if (state.journalOpen) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: cancelEdge || menuEdge ? false : true,
        previousInput: { ...input },
        maddie: {
          ...state.maddie,
          stillTicks: state.maddie.stillTicks + 1,
          motion: { ...state.maddie.motion, moving: false },
        },
        motion: { ...state.motion, moving: false },
      },
      events: [],
    };
  }
  if (menuEdge && state.transition === null) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: true,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        maddie: {
          ...state.maddie,
          stillTicks: state.maddie.stillTicks + 1,
          motion: { ...state.maddie.motion, moving: false },
        },
      },
      events: [],
    };
  }
  if (state.transition !== null) {
    const transition = state.transition;
    const elapsed = transition.elapsed + 1;
    const limit = world.tunables.doorFadeTicks;
    if (transition.phase === "out" && elapsed >= limit) {
      const targetArea = world.areas[transition.target.area];
      if (targetArea === undefined) throw new Error("Unknown transition area");
      const spawn = targetArea.spawns[transition.target.spawn];
      if (spawn === undefined) throw new Error("Unknown transition spawn");
      const slot = followerSlot(
        targetArea,
        spawn,
        world.tunables.follow.slot,
        world.tunables.follow.radius,
        world.tunables.follow.heel,
      );
      if (slot === undefined) throw new Error("No Maddie transition slot");
      return {
        state: {
          ...state,
          tick: state.tick + 1,
          area: targetArea.id,
          player: { x: spawn.x, y: spawn.y },
          facing: spawn.facing,
          previousInput: { ...input },
          motion: { ...state.motion, moving: false },
          transition: { target: transition.target, phase: "in", elapsed: 0 },
          maddie: {
            x: slot.x,
            y: slot.y,
            facing: spawn.facing,
            motion: { distance: 0, moving: false },
            stillTicks: 0,
          },
          trail: [slot, { x: spawn.x, y: spawn.y }],
          safeSpot: { area: targetArea.id, spawn: transition.target.spawn },
        },
        events: [],
      };
    }
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        transition:
          transition.phase === "in" && elapsed >= limit
            ? null
            : { ...transition, elapsed },
      },
      events: [],
    };
  }
  if (input.confirm && !state.previousInput.confirm) {
    const target = targetInteractable(world, state);
    if (target !== undefined) {
      const result = runInk(
        world.story,
        state.ink,
        {
          type: "start",
          knot: target.knot,
        },
        calmedFacts(state),
      );
      return {
        state: {
          ...state,
          tick: state.tick + 1,
          ink: result.ink,
          previousInput: { ...input },
          dialogue: dialogueState(target.knot, result),
          motion: { ...state.motion, moving: false },
          maddie: {
            ...state.maddie,
            motion: { ...state.maddie.motion, moving: false },
          },
        },
        events: [],
      };
    }
  }
  const length = Math.sqrt(
    input.move.x * input.move.x + input.move.y * input.move.y,
  );
  const scale = length > 1 ? 1 / length : 1;
  const speed = world.tunables.walkSpeed / 60;
  const player = resolveCollision(
    {
      x: state.player.x + input.move.x * scale * speed,
      y: state.player.y + input.move.y * scale * speed,
    },
    area,
    world.tunables.playerRadius,
  );
  const displacementX = player.x - state.player.x;
  const displacementY = player.y - state.player.y;
  const displacement = Math.sqrt(
    displacementX * displacementX + displacementY * displacementY,
  );
  let facing = state.facing;
  if (Math.abs(input.move.x) >= Math.abs(input.move.y) && input.move.x !== 0)
    facing = input.move.x < 0 ? "left" : "right";
  else if (input.move.y !== 0) facing = input.move.y < 0 ? "up" : "down";
  const events: Event[] = [];
  for (const button of ["confirm", "cancel", "menu"] as const) {
    if (input[button] && !state.previousInput[button])
      events.push({ type: "button", button });
  }
  const trigger = area.triggers.find(
    (item) =>
      !pointInPolygon(state.player, item.polygon) &&
      pointInPolygon(player, item.polygon),
  );
  // A door that needs a story variable (spec 6): while the variable isn't
  // true, crossing in plays its knot instead of leaving. Fae still steps into
  // the doorway, so the outside-to-inside rule plays it again only after she
  // steps out and back in.
  const locked =
    trigger?.requires !== undefined &&
    inkVariable(world.story, state.ink, trigger.requires.variable) !== true
      ? trigger.requires
      : undefined;
  const door = locked === undefined ? trigger : undefined;
  const knock =
    locked === undefined
      ? undefined
      : {
          knot: locked.knot,
          result: runInk(world.story, state.ink, { type: "start", knot: locked.knot },
            calmedFacts(state)),
        };
  const critterEntry = area.critters.find(
    (item) =>
      state.critters[item.id] === "chaos" &&
      distance(state.player, item.point) >
        (world.critters[item.id]?.touchRadius ?? 0) &&
      distance(player, item.point) <=
        (world.critters[item.id]?.touchRadius ?? 0),
  );
  if (critterEntry !== undefined) {
    const critter = world.critters[critterEntry.id];
    if (critter !== undefined) {
      const battle: Battle = {
        critterId: critter.id,
        entry: { ...state.player },
        phase: "intro",
        message: critter.lines.intro,
        revealed: 0,
        selected: 0,
        command: null,
        energy: critter.energyMax,
        calm: 0,
        snacks: critter.snacks,
        rest: 0,
        aim: null,
        lastGrade: null,
        rewardSticker: null,
        aimTick: 0,
        phaseTicks: 0,
      };
      return {
        state: {
          ...state,
          tick: state.tick + 1,
          previousInput: { ...input },
          battle,
          motion: { ...state.motion, moving: false },
        },
        events,
      };
    }
  }
  const follower =
    trigger === undefined
      ? updateMaddie(world, area, state, player, displacement > 0.0001)
      : {
          maddie: {
            ...state.maddie,
            motion: { ...state.maddie.motion, moving: false },
          },
          trail: state.trail,
        };
  return {
    state: {
      ...state,
      tick: state.tick + 1,
      player,
      facing,
      previousInput: { ...input },
      motion: {
        distance: state.motion.distance + displacement,
        moving: trigger === undefined && displacement > 0.0001,
      },
      transition:
        door === undefined
          ? null
          : { target: door.target, phase: "out", elapsed: 0 },
      ink: knock === undefined ? state.ink : knock.result.ink,
      dialogue: knock === undefined ? state.dialogue : dialogueState(knock.knot, knock.result),
      maddie: follower.maddie,
      trail: follower.trail,
    },
    events,
  };
}

export function stableHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item !== null && typeof item === "object") {
      // Undefined values are skipped, as JSON does, so a state and its saved
      // copy hash the same.
      const entries = Object.entries(item)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      const body = entries
        .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
        .join(",");
      return `{${body}}`;
    }
    return JSON.stringify(item);
  };
  let hash = 2166136261;
  for (const character of canonical(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
