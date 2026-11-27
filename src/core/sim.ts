import type {
  Npc,
  Direction,
  ActionFrame,
  Area,
  Event,
  Fixture,
  Point,
  State,
  World,
  Battle,
  BattleView,
  CheckSide,
  CheckSpec,
  CheckState,
  Critter,
  FeelingId,
  FluteAssistKind,
  Grade,
  TreatTrayItem,
} from "./types";
import { createInkState, runInk, setInkVariables, storyHasKnot, type InkFacts } from "./ink";
import { sceneryArea } from "./props";
import {
  checkDraws,
  checkHint,
  createCheck,
  echoNoteFromEdge,
  gentleCheckSpec,
  laneFromStick,
  leanFromStick,
  pickFromDraw,
  stepCheck,
  viewCheck,
} from "./checks";
import {
  answers,
  bubbleAnswered,
  feelingFromDraw,
  feelingsOn,
  openFeelings,
  pickFeeling,
  windUpStarts,
} from "./feelings";
import {
  closestPointOnPolygon,
  distanceToPolygon,
  pointInPolygon,
  resolveCollision,
  resolveMove,
} from "./geometry";
import {
  battleParty,
  faeBox,
  haltedParty,
  hiddenFraction,
  npcVisible,
  partyCommand,
  partyLeader,
  partySlots,
  restingParty,
  spawnParty,
  stepParty,
  syncParty,
  visibleFollowerSlot,
} from "./party";
import {
  battleFoe,
  calmedCritters,
  presentCritters,
  rollWild,
  sendHome,
  stepWild,
  touchingCritter,
} from "./roam";
import { firstTouch, oldFriend } from "./encounter";
import { burstDamage, calmExperience, levelForXp, levelUpDelta, statsForCommand } from "./levels";
import { openArcade, stepArcade, isArcadeGameId, type ArcadeGameId } from "./arcade";
import { nextRandom } from "./random";

export {
  battleFoe,
  battleParty,
  closestPointOnPolygon,
  distanceToPolygon,
  faeBox,
  hiddenFraction,
  npcVisible,
  partyCommand,
  partyLeader,
  partySlots,
  pointInPolygon,
  presentCritters,
  resolveCollision,
  resolveMove,
  rollWild,
  stepParty,
  stepWild,
  syncParty,
  touchingCritter,
  visibleFollowerSlot,
};

// No `lantern`: it's optional, present only while pressed, so a blank frame,
// a recorded one, and a real key's frame all have the same shape, and a save's
// last input matches a new game's (spec 3.2, 10).
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
  const ids =
    fixture.party ??
    Object.values(world.party)
      .filter((member) => member.start)
      .map((member) => member.id);
  const ink = setInkVariables(
    createInkState(world.story, seed), fixture.variables ?? {},
  );
  const state: State = {
    tick: 0,
    area: area.id,
    player: { x: spawn.x, y: spawn.y },
    facing: spawn.facing,
    rng: seed >>> 0,
    previousInput: blankInput(),
    motion: { distance: 0, moving: false },
    transition: null,
    party: spawnParty(world, ink, area, spawn, ids),
    xp: 0,
    ink,
    dialogue: null,
    critters: Object.fromEntries(
      Object.values(world.areas).flatMap((each) => each.critters)
        .map((piece) => [piece.id, "chaos"]),
    ),
    wild: [],
    calms: {},
    stickers: [],
    safeSpot: { area: area.id, spawn: fixture.spawn },
    battle: null,
    arcade: null,
    prizes: [],
    tickets: 0,
    journalOpen: false,
    lantern: false,
    coins: 0,
    snacks: 2,
    finale: null,
  };
  return { ...state, ...rollWild(world, state, area) };
}

// One snack for `price` coins, if Fae can pay (spec 7, a `buy:` line).
export function purchaseSnack(state: State, price: number): State {
  return price < 0 || state.coins < price
    ? state
    : { ...state, coins: state.coins - price, snacks: state.snacks + 1 };
}

export function totalTreatCount(treats: State["treats"]): number {
  if (treats === undefined) return 0;
  let total = 0;
  for (const count of Object.values(treats)) total += count;
  return total;
}

export function addTreat(state: State, id: string, delta = 1): State {
  if (delta <= 0) return state;
  const current = state.treats?.[id] ?? 0;
  const nextCount = Math.min(99, current + delta);
  return { ...state, treats: { ...(state.treats ?? {}), [id]: nextCount } };
}

export function consumeTreat(state: State, id: string): State {
  const current = state.treats?.[id] ?? 0;
  if (current <= 0) return state;
  const remaining: Record<string, number> = {};
  for (const [key, count] of Object.entries(state.treats ?? {})) {
    const updated = key === id ? count - 1 : count;
    if (updated > 0) remaining[key] = updated;
  }
  if (Object.keys(remaining).length === 0) {
    const { treats: _removed, ...rest } = state;
    return rest;
  }
  return { ...state, treats: remaining };
}

export function purchaseTreat(state: State, id: string, price: number): State {
  if (price < 0 || state.coins < price) return state;
  return addTreat({ ...state, coins: state.coins - price }, id, 1);
}

// Draws `count` feelings for a battle's critter, one PRNG value each, in
// order (spec 8).
function drawFeelings(
  world: World,
  state: State,
  critter: Critter,
  count: number,
): [(FeelingId | null)[], State] {
  let rolled = state;
  const drawn: (FeelingId | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    const [value, after] = nextRandom(rolled);
    drawn.push(feelingFromDraw(world, rolled, critter, value));
    rolled = after;
  }
  return [drawn, rolled];
}

// Draws a wind-up's bubbles (spec 8): one PRNG value each, picked evenly from
// the kind's feelings Fae can answer that it isn't showing yet, until there
// are `count` or none are left.
function drawWindUp(
  world: World,
  state: State,
  critter: Critter,
  count: number,
): [FeelingId[], State] {
  let open = openFeelings(world, state, critter);
  let rolled = state;
  const drawn: FeelingId[] = [];
  while (drawn.length < count && open.length > 0) {
    const [value, after] = nextRandom(rolled);
    const feeling = pickFeeling(open, value);
    if (feeling === null) break;
    drawn.push(feeling);
    open = open.filter((item) => item !== feeling);
    rolled = after;
  }
  return [drawn, rolled];
}

// A message that isn't the check's own result: the check and its grade go.
function moveOn(battle: Battle, text: string, phase: Battle["phase"]): Battle {
  return { ...battleMessage(battle, text, phase), check: null, lastGrade: null };
}

// A new turn (spec 8). A wind-up puffs on, or starts on its turn with its
// bubbles drawn while the feelings wait; otherwise the feelings move up one
// and one more is drawn.
function nextTurn(world: World, state: State, battle: Battle, critter: Critter): State {
  const turn = battle.turn + 1;
  const talk = critter.talk;
  const talkMode = talk !== null && battle.calm >= talk.talkAt;
  if (talkMode && talk === null) throw new Error(`Critter ${critter.id} has no Talk content`);
  const label = talkMode ? talk.prompt : critter.lines.command;
  const fresh = { ...moveOn(battle, label, "command"), turn, answered: false, talkMode };
  if (talkMode)
    return { ...state, battle: { ...fresh, feelings: [], windUp: null } };
  // After a caught opening's burst, turn 1's feelings are the first drawn.
  if (battle.turn === 0) return { ...state, battle: fresh };
  const going = battle.windUp;
  if (going !== null && going.left > 1)
    return {
      ...state,
      battle: {
        ...fresh,
        message: critter.windUp?.lines.puffing ?? critter.lines.command,
        windUp: { ...going, left: going.left - 1 },
      },
    };
  if (critter.windUp !== null && windUpStarts(critter.windUp, turn)) {
    const [feelings, rolled] = drawWindUp(world, state, critter, critter.windUp.bubbles);
    if (feelings.length > 0)
      return {
        ...rolled,
        battle: {
          ...fresh,
          message: critter.windUp.lines.start,
          windUp: { feelings, popped: feelings.map(() => false), left: feelings.length },
        },
      };
  }
  const [drawn, rolled] = battle.feelings.length === 0
    ? [[], state]
    : drawFeelings(world, state, critter, 1);
  return {
    ...rolled,
    battle: { ...fresh, windUp: null, feelings: [...battle.feelings.slice(1), ...drawn] },
  };
}

function moveDirection(move: Point): Direction | undefined {
  if (move.x === 0 && move.y === 0) return undefined;
  if (Math.abs(move.x) >= Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

export function targetInteractable(
  world: World,
  state: State,
): Area["interactables"][number] | Area["glows"][number] | undefined {
  if (state.transition !== null || state.dialogue !== null) return undefined;
  const area = world.areas[state.area];
  if (area === undefined) return undefined;
  const facing = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[state.facing];
  const calmCritters = presentCritters(world, state)
    .filter((critter) => critter.mood === "calm")
    .map((critter) => ({
      id: `critter:${critter.key}`,
      knot: critter.kind.calmKnot,
      point: critter.point,
      prompt: critter.kind.calmPrompt,
    }));
  const people = area.npcs
    .filter((npc) => npcVisible(world, state, npc))
    .map((npc) => ({
      id: `npc:${npc.id}`,
      knot: npc.knot,
      point: npc.point,
      prompt: npc.prompt,
    }));
  const glows = state.lantern
    ? area.glows.filter((glow): glow is Area["glows"][number] & { knot: string } =>
      glow.knot !== undefined).map((glow) => ({ ...glow, id: `glow:${glow.id}` }))
    : [];
  return [...area.interactables, ...glows, ...calmCritters, ...people]
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

function solidArea(world: World, state: State, area: Area): Area {
  const scenery = sceneryArea(world, state.ink, area);
  return {
    ...scenery,
    blockers: [
      ...scenery.blockers,
      ...area.npcs
        .filter((npc) => npcVisible(world, state, npc))
        .map((npc) => npc.footprint),
    ],
  };
}

// What the story's externals answer from (spec 7, 8): coins() from Fae's
// purse, and calmed(name) for a species once she owns its sticker (she has
// calmed one of them, anywhere) and for a set piece by its own mood.
export function inkFacts(world: World, state: State): InkFacts {
  return {
    calmed: calmedCritters(world, state),
    coins: state.coins,
    snacks: state.snacks,
    prizes: state.prizes,
    tickets: state.tickets,
    plushesLeft: world.arcade.claw.heap.filter((plush) => !state.prizes.includes(plush.prize))
      .length,
  };
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

// Soothe, then one command per party member in party order, then Snack and
// Run (spec 8). A friend's command rests for its content turns after use.
export function battleCommands(
  world: World,
  state: State,
): BattleView["commands"] {
  const battle = state.battle;
  if (battle === null) return [];
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return [];
  const talkMode = battle.talkMode === true ||
    (critter.talk !== null && battle.calm >= critter.talk.talkAt);
  if (talkMode && critter.talk !== null)
    return [{
      id: "talk", label: critter.talk.label, detail: null, disabled: false, feeling: null,
    }];
  // What the critter feels, on the command that answers it (its badge):
  // this turn's feeling, or each of a wind-up's bubbles not yet popped.
  const going = battle.windUp;
  const showing = going === null
    ? [battle.feelings[0] ?? null]
    : going.feelings.filter((_, index) => going.popped[index] !== true);
  const feeling = (id: string): FeelingId | null =>
    showing.find((item) => answers(world, item, id)) ?? null;
  const friends = battleParty(world, state.party).flatMap((member) => {
    const command = world.party[member.id]?.command;
    if (command === undefined || command === null) return [];
    const rest = battle.rest[command.id] ?? 0;
    return [
      {
        id: command.id,
        label: command.label,
        detail: rest > 0 ? command.resting : null,
        disabled: rest > 0,
        feeling: feeling(command.id),
      },
    ];
  });
  const totalSnacks = state.snacks + totalTreatCount(state.treats);
  return [
    {
      id: "soothe",
      label: world.battle.commands.soothe.label,
      detail: null,
      disabled: false,
      feeling: feeling("soothe"),
    },
    ...friends,
    {
      id: "snack",
      label: world.battle.commands.snack.label,
      detail: world.battle.commands.snack.snackDetail.replace("N", String(totalSnacks)),
      disabled: totalSnacks === 0,
      feeling: feeling("snack"),
    },
    ...(critter.canRun ? [{
      id: "run",
      label: world.battle.commands.run.label,
      detail: null,
      disabled: false,
      feeling: null,
    }] : []),
  ];
}

function treatTrayItems(world: World, state: State, critter: Critter): TreatTrayItem[] {
  const items: TreatTrayItem[] = [];
  if (state.snacks > 0) {
    items.push({
      id: "snack",
      label: "Plain Snack",
      count: state.snacks,
      favourite: false,
      description: `+${critter.commands.snack.energy} leaves, +${critter.commands.snack.calm} calm`,
    });
  }
  const knownSpecies = state.stickers.includes(critter.sticker.id);
  for (const treat of world.treats) {
    const count = state.treats?.[treat.id] ?? 0;
    if (count <= 0) continue;
    items.push({
      id: treat.id,
      label: treat.name,
      count,
      favourite: knownSpecies && treat.favourites.includes(critter.species),
      description: treat.description,
    });
  }
  items.push({ id: "back", label: "Back", count: 0, favourite: false, description: "" });
  return items;
}

function closeTreatMenu(battle: Battle): Battle {
  const { treatMenu: _menu, treatSelected: _selected, ...rest } = battle;
  return rest;
}

// A turn passes: every resting friend is one turn closer to ready. Entries at
// zero are dropped, so "missing" is the only way to spell "ready".
function restTurn(rest: Battle["rest"]): Battle["rest"] {
  return Object.fromEntries(
    Object.entries(rest).flatMap(([id, turns]) =>
      turns > 1 ? [[id, turns - 1]] : [],
    ),
  );
}

// The numbers and lines a Fae-side check resolves with: a friend's
// command, or Soothe for anything else.
function critterSideCommand(
  critter: Critter,
  command: string | null,
): { numbers: { calm: number; great: number; good: number }; lines: Record<Grade, string> } {
  if (command !== null) {
    const numbers = critter.commands.friends[command];
    const lines = critter.lines.friends[command];
    if (numbers !== undefined && lines !== undefined) return { numbers, lines };
  }
  return { numbers: critter.commands.soothe, lines: critter.lines.soothe };
}

function inTalkMode(battle: Battle, critter: Critter): boolean {
  return battle.talkMode === true ||
    (battle.talk !== undefined && battle.talk !== null) ||
    (critter.talk !== null && battle.calm >= critter.talk.talkAt);
}

function nextSparkle(
  world: World,
  state: State,
  battle: Battle,
  result: Grade,
  fromTogether: boolean,
): number | undefined {
  const current = battle.sparkle ?? 0;
  if (result !== "great" || fromTogether || battleParty(world, state.party).length < 2)
    return current > 0 ? current : undefined;
  const charged = Math.min(world.battle.together.chargeMax, current + 1);
  return charged > 0 ? charged : undefined;
}

function togetherCalm(world: World, state: State, result: Grade): number {
  let teamPower = statsForCommand(
    world.levels,
    "soothe",
    levelForXp(world.levels, state.xp),
  ).power;
  for (const member of battleParty(world, state.party)) {
    const commandId = world.party[member.id]?.command?.id;
    if (commandId === undefined) continue;
    teamPower += statsForCommand(
      world.levels,
      commandId,
      levelForXp(world.levels, member.xp),
    ).power;
  }
  if (result === "great") return teamPower + world.battle.feelingBonus;
  if (result === "good") return Math.round(teamPower * 0.75);
  return Math.round(teamPower * 0.5);
}

function fluteAssistKind(
  hasPup: boolean,
  hasSquirrel: boolean,
  hasBunny: boolean,
): FluteAssistKind | null {
  if (hasPup && hasSquirrel && hasBunny) return "all";
  if (hasPup && hasSquirrel) return "both";
  if (hasPup && hasBunny) return "pupBunny";
  if (hasSquirrel && hasBunny) return "squirrelBunny";
  if (hasPup) return "pup";
  if (hasSquirrel) return "squirrel";
  if (hasBunny) return "bunny";
  return null;
}

function fluteAssistView(
  world: World,
  state: State,
  battle: Battle,
  critter: Critter,
): BattleView["fluteAssist"] {
  if (world.storyVariable(state.ink, "has_flute") !== true) return null;
  const hasPup = world.storyVariable(state.ink, "pup_friend") === true;
  const hasSquirrel = world.storyVariable(state.ink, "squirrel_friend") === true;
  const hasBunny = world.storyVariable(state.ink, "bunny_friend") === true;
  const kind = fluteAssistKind(hasPup, hasSquirrel, hasBunny);
  if (kind === null) return null;
  const label = kind === "pup"
    ? "Pond Pup"
    : kind === "squirrel"
      ? "Acorn Squirrel"
      : kind === "bunny"
        ? "Ribbon Bunny"
        : "Flute Friends";
  const available = battle.fluteUsed !== true && !inTalkMode(battle, critter) &&
    battle.phase === "command";
  return { available, label, kind };
}

function lassoAssistView(
  world: World,
  state: State,
  battle: Battle,
  critter: Critter,
): BattleView["lassoAssist"] {
  if (world.storyVariable(state.ink, "has_lasso") !== true) return null;
  const available = battle.lassoUsed !== true && !inTalkMode(battle, critter) &&
    (battle.talk ?? null) === null && battle.phase === "command";
  const windUp = battle.windUp !== null && battle.windUp.popped.some((popped) => !popped);
  return { available, windUp };
}

export function battleView(world: World, state: State): BattleView | null {
  const battle = state.battle;
  if (battle === null) return null;
  const critter = world.critters[battle.critterId];
  if (critter === undefined) return null;
  const check = battle.check;
  // The friend acting in a Fae-side check (null for Soothe, Together!, and bursts).
  const acting =
    check?.side === "critter"
      ? battleParty(world, state.party).findIndex(
          (member) => world.party[member.id]?.command?.id === battle.command,
        )
      : -1;
  const actor = acting >= 0 ? acting : null;
  const checkView = check === null ? null : viewCheck(check, actor);
  const hint = check === null
    ? null
    : battle.command === "together" && check.kind === "chain"
      ? (check.tick < (check.spec.arrivals[0] ?? 0) ? world.battle.together.hint : null)
      : checkHint(check, world.battle.hints);
  // The bubble shows in the menu, and over the result (with its heart, if
  // the choice answered it); never over a check, which needs the room. A
  // wind-up's bubbles take its place.
  const [now = null, coming = null, after = null] = battle.feelings;
  const shown = battle.phase === "command" || battle.phase === "result";
  const going = battle.windUp;
  const windUp = going !== null && shown
    ? {
        bubbles: going.feelings.map((id, index) => ({
          id,
          label: world.battle.feelings[id].label,
          popped: going.popped[index] === true,
        })),
      }
    : null;
  const feelings = going === null && battle.feelings.length > 0 && shown
    ? {
        now: now === null ? null : { id: now, label: world.battle.feelings[now].label },
        next: coming,
        later: battle.lanternPeek ? after : null,
        answered: battle.answered,
      }
    : null;
  const talkActive = inTalkMode(battle, critter);
  const sparkleCount = battle.sparkle ?? 0;
  const sparkleMax = world.battle.together.chargeMax;
  const sparkle = battleParty(world, state.party).length < 2 || talkActive
    ? null
    : {
        count: sparkleCount,
        max: sparkleMax,
        ready: sparkleCount >= sparkleMax && battle.phase === "command",
      };
  const trayItems = battle.phase === "command" && battle.treatMenu === true
    ? treatTrayItems(world, state, critter)
    : null;
  const treatTray = trayItems === null
    ? null
    : {
        items: trayItems,
        selected: Math.max(0, Math.min(trayItems.length - 1, battle.treatSelected ?? 0)),
      };
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
    check: checkView,
    hint,
    feelings,
    windUp,
    puff: going === null ? 0 : going.feelings.length - going.left + 1,
    lastGrade: battle.lastGrade,
    rewardSticker: battle.rewardSticker,
    talk: battle.talk ?? null,
    sparkle,
    fluteAssist: fluteAssistView(world, state, battle, critter),
    burstSoften: battle.burstSoften ?? 0,
    lassoAssist: lassoAssistView(world, state, battle, critter),
    lassoSteady: battle.lassoSteady === true,
    treatTray,
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

function startCheck(
  battle: Battle,
  side: CheckSide,
  spec: CheckSpec,
  big = false,
  picks: number[] = [],
): Battle {
  return {
    ...battle,
    phase: "check",
    check: createCheck(spec, side, big, picks),
    phaseTicks: 0,
    lastGrade: null,
    message: "",
    revealed: 0,
  };
}

function talkLine(
  result: ReturnType<typeof runInk>,
  previous: NonNullable<Battle["talk"]> | null,
): NonNullable<Battle["talk"]> {
  const line = result.line;
  return {
    knot: previous?.knot ?? "",
    turn: previous?.turn ?? 0,
    speaker: line?.speaker ?? null,
    text: line?.text ?? "",
    revealed: 0,
    choices: result.choices,
    selected: 0,
    ended: result.ended,
    grade: null,
  };
}

function taggedGrade(result: ReturnType<typeof runInk>): Grade | null {
  const tag = result.line?.tags.find((item) => /^grade:\s*(great|good|miss)\s*$/.test(item.trim()));
  const grade = tag?.trim().slice("grade:".length).trim();
  return grade === "great" || grade === "good" || grade === "miss" ? grade : null;
}

function talkContent(critter: Critter): NonNullable<Critter["talk"]> {
  if (critter.talk === null) throw new Error(`Critter ${critter.id} has no Talk content`);
  return critter.talk;
}

// A kind with Talk content cannot be soothed by ordinary commands before its
// questions are answered. The final graded answer is the only thing that may
// fill the last point of its meter.
function calmLimit(critter: Critter): number {
  return critter.talk === null ? critter.calmMax : critter.calmMax - 1;
}

export type StepOptions = {
  gentleTiming?: boolean;
};

function battleStep(
  world: World,
  state: State,
  input: ActionFrame,
  gentleTiming: boolean,
): State {
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
    party: restingParty(state.party),
  };
  let next = { ...battle, phaseTicks: battle.phaseTicks + 1 };
  if (next.phase === "talk" && next.talk !== undefined && next.talk !== null) {
    const talk = next.talk;
    if (talk.revealed < talk.text.length)
      return {
        ...nextBase,
        battle: {
          ...next,
          talk: {
            ...talk,
            revealed: confirm
              ? talk.text.length
              : Math.min(talk.text.length, talk.revealed + world.tunables.interact.revealPerTick),
          },
        },
      };
    const count = talk.choices.length;
    const tapped = input.choose !== undefined && input.choose >= 0 && input.choose < count
      ? input.choose : undefined;
    const chosen = tapped ?? (confirm && count > 0 ? talk.selected : undefined);
    if (chosen !== undefined) {
      const result = runInk(
        world.story, state.ink, { type: "choose", index: chosen }, inkFacts(world, state),
      );
      const grade = taggedGrade(result);
      const amount = grade === null ? 0 : talkContent(critter).calm[grade];
      const completedTalk = talk.turn === talkContent(critter).knots.length - 1;
      const updated = { ...talkLine(result, talk), knot: talk.knot, turn: talk.turn, grade };
      return {
        ...nextBase,
        ink: result.ink,
        battle: {
          ...next,
          talk: updated,
          calm: completedTalk ? critter.calmMax : Math.min(
            calmLimit(critter), next.calm + amount,
          ),
          lastGrade: grade,
        },
      };
    }
    if (count > 0) {
      const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
      const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
      if (up || down)
        return {
          ...nextBase,
          battle: {
            ...next,
            talk: { ...talk, selected: (talk.selected + (down ? 1 : -1) + count) % count },
          },
        };
      return { ...nextBase, battle: next };
    }
    if (!confirm) return { ...nextBase, battle: next };
    const result = runInk(world.story, state.ink, { type: "next" }, inkFacts(world, state));
    if (result.line !== null || result.choices.length > 0)
      return { ...nextBase, ink: result.ink, battle: { ...next, talk: talkLine(result, talk) } };
    const completed = { ...next, talk: null, lastGrade: talk.grade };
    if (completed.calm >= critter.calmMax)
      return {
        ...nextBase,
        battle: moveOn({ ...completed, talkMode: false }, critter.lines.soothed, "soothed"),
      };
    return nextTurn(world, nextBase, { ...completed, phase: "command" }, critter);
  }
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
      "fizzle",
      "run",
      "soothed",
      "reward",
      "rest",
    ].includes(next.phase)
  ) {
    if (!confirm) return { ...nextBase, battle: next };
    if (next.phase === "intro") {
      // The first turn: three feelings in a row, once a friend has joined. A
      // critter that caught Fae bursts first, on turn 0 (Milestone 51).
      const talkValue = critter.talk;
      const talkMode = talkValue !== null && next.calm >= talkValue.talkAt;
      if (talkMode && talkValue === null)
        throw new Error(`Critter ${critter.id} has no Talk content`);
      const [feelings, rolled] = !talkMode && feelingsOn(world, state)
        ? drawFeelings(world, nextBase, critter, 3)
        : [[], nextBase];
      const opening = next.turn === 0
        ? moveOn(next, critter.lines.burst, "burst")
        : moveOn(next, talkMode ? talkValue.prompt : critter.lines.command, "command");
      return { ...rolled, battle: { ...opening, feelings: talkMode ? [] : feelings, talkMode } };
    }
    else if (next.phase === "result") {
      // Calm enough, it's soothed, any wind-up over with it. In a wind-up it
      // puffs on with no burst until its last turn; then, every bubble
      // popped, it fizzles, else it lets go (spec 8).
      const going = next.windUp;
      if (next.calm >= critter.calmMax)
        next = { ...moveOn(next, critter.lines.soothed, "soothed"), windUp: null };
      else if (going !== null && going.left > 1) return nextTurn(world, nextBase, next, critter);
      else if (going !== null && going.popped.every((popped) => popped))
        next = {
          ...moveOn(next, critter.windUp?.lines.fizzle ?? critter.lines.burst, "fizzle"),
          windUp: null,
        };
      else next = moveOn(next, critter.lines.burst, "burst");
    }
    else if (next.phase === "burst") {
      // After a wind-up its size is set: big if nothing was popped, else
      // small. Otherwise the big roll comes first. Then one draw per catch
      // toy (its lane) or lean puff (its force).
      const letGo = next.windUp;
      const [roll, afterRoll]: [number, State] =
        letGo === null ? nextRandom(nextBase) : [1, nextBase];
      const rolledBig = letGo === null
        ? roll < critter.burst.bigChance
        : letGo.popped.every((popped) => !popped);
      const steady = next.lassoSteady === true;
      const big = steady ? false : rolledBig;
      const baseSpec = big ? (critter.burst.big ?? critter.burst.check) : critter.burst.check;
      const spec = gentleTiming ? gentleCheckSpec(baseSpec) : baseSpec;
      let rolled = afterRoll;
      const picks: number[] = [];
      for (let item = 0; item < checkDraws(spec); item += 1) {
        const [value, after] = nextRandom(rolled);
        picks.push(pickFromDraw(spec, value));
        rolled = after;
      }
      const { lassoSteady: _lassoSteady, ...withoutSteady } = next;
      return {
        ...rolled,
        battle: {
          ...startCheck(steady ? withoutSteady : next, "fae", spec, big, picks),
          windUp: null,
        },
      };
    }
    else if (next.phase === "burstResult" && next.energy <= 0)
      next = moveOn(next, critter.lines.rest, "rest");
    else if (next.phase === "burstResult" || next.phase === "fizzle")
      return nextTurn(world, nextBase, next, critter);
    else if (next.phase === "soothed") {
      // Every calm pays; the sticker comes once per species (spec 8).
      const fresh = !state.stickers.includes(critter.sticker.id);
      const xp = calmExperience(world.levels, critter.id, critter.windUp !== null,
        critter.id === "hooded-kid");
      let line = (fresh ? world.battle.rewards.sticker : world.battle.rewards.coins)
        .replace("{sticker}", critter.sticker.name)
        .replace("{coins}", String(critter.coins));
      line = `${line.replace(/[.!]$/, "")}, +${xp} XP!`;
      next = {
        ...battleMessage(next, line, "reward"),
        rewardSticker: fresh ? critter.sticker.id : null,
      };
    } else if (next.phase === "reward") {
      const den = next.den;
      const xp = calmExperience(world.levels, critter.id, critter.windUp !== null,
        critter.id === "hooded-kid");
      const battleIds = next.command === "together"
        ? new Set(battleParty(world, state.party).map((member) => member.id))
        : null;
      const ownerId = battleIds !== null
        ? undefined
        : state.party.find((candidate) =>
            world.party[candidate.id]?.command?.id === next.command)?.id;
      return afterCalm(world, {
        ...nextBase,
        ...(den === null
          ? { critters: { ...state.critters, [next.critterId]: "calm" } }
          : { wild: state.wild.map((item) =>
              item.den === den ? { ...item, mood: "calm" } : item) }),
        coins: state.coins + critter.coins,
        xp: state.xp + xp,
        party: state.party.map((member) =>
          (battleIds !== null ? battleIds.has(member.id) : member.id === ownerId)
            ? { ...member, xp: member.xp + xp } : member),
        calms: { ...state.calms, [critter.species]: (state.calms[critter.species] ?? 0) + 1 },
        stickers: next.rewardSticker === null
          ? state.stickers
          : [...state.stickers, next.rewardSticker],
        battle: null,
      });
    } else if (next.phase === "run") {
      const den = next.den;
      const area = world.areas[state.area];
      const away: Record<Direction, Direction> =
        { up: "down", down: "up", left: "right", right: "left" };
      return {
        ...nextBase,
        player: { ...next.entry },
        facing: away[state.facing],
        battle: null,
        ...(den === null || area === undefined
          ? {}
          : { wild: state.wild.map((item) =>
              item.den === den ? sendHome(world, area, item, true) : item) }),
      };
    }
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
    if (next.treatMenu === true) {
      const items = treatTrayItems(world, state, critter);
      const currentSelected = Math.max(0, Math.min(items.length - 1, next.treatSelected ?? 0));
      const cancelEdge = input.cancel && !state.previousInput.cancel;
      if (cancelEdge) return { ...nextBase, battle: closeTreatMenu(next) };
      const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
      const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
      if (up || down) {
        const nextSel = (currentSelected + (down ? 1 : -1) + items.length) % items.length;
        return { ...nextBase, battle: { ...next, treatSelected: nextSel } };
      }
      const tapped = input.choose !== undefined && input.choose >= 0 &&
        input.choose < items.length ? input.choose : undefined;
      if (tapped === undefined && !confirm) return { ...nextBase, battle: next };
      const picked = items[tapped ?? currentSelected];
      if (picked === undefined || picked.id === "back")
        return { ...nextBase, battle: closeTreatMenu(next) };
      const going = next.windUp;
      const pop = going === null ? -1 : bubbleAnswered(world, going, "snack");
      const answered = going === null ? answers(world, next.feelings[0], "snack") : pop >= 0;
      const windUp = going === null || pop < 0
        ? going
        : { ...going, popped: going.popped.map((popped, index) => popped || index === pop) };
      const closed = closeTreatMenu(next);
      if (picked.id === "snack") {
        const message = battleMessage(closed, critter.lines.snack, "result");
        return {
          ...nextBase,
          snacks: state.snacks - 1,
          battle: {
            ...message,
            answered,
            windUp,
            rest: restTurn(closed.rest),
            energy: Math.min(
              critter.energyMax,
              closed.energy + critter.commands.snack.energy,
            ),
            calm: Math.min(
              calmLimit(critter),
              closed.calm + critter.commands.snack.calm +
                (answered ? world.battle.feelingBonus : 0),
            ),
          },
        };
      }
      const treat = world.treats.find((item) => item.id === picked.id);
      if (treat === undefined) return { ...nextBase, battle: closed };
      const isFav = treat.favourites.includes(critter.species);
      const calmGain = (isFav ? treat.favouriteCalm : treat.calm) +
        (answered ? world.battle.feelingBonus : 0);
      const message = battleMessage(
        closed,
        isFav ? treat.favouriteLine : treat.useLine,
        "result",
      );
      return {
        ...consumeTreat(nextBase, treat.id),
        battle: {
          ...message,
          answered,
          windUp,
          rest: restTurn(closed.rest),
          energy: Math.min(critter.energyMax, closed.energy + treat.energy),
          calm: Math.min(calmLimit(critter), closed.calm + calmGain),
        },
      };
    }
    // The lantern, once Fae has it, shows the turn-after feeling too, for the
    // rest of the battle (spec 8); not in a wind-up, whose bubbles hide it.
    const lanternEdge = input.lantern === true && state.previousInput.lantern !== true;
    if (lanternEdge && !next.lanternPeek && next.feelings.length > 0 && next.windUp === null &&
        world.storyVariable(state.ink, "has_lantern") === true)
      return { ...nextBase, battle: { ...next, lanternPeek: true } };
    const talkActive = inTalkMode(next, critter);
    // Flute Friends in battle (spec 8): once per battle, befriended animals help
    // on a fresh flute press without consuming Fae's turn.
    const fluteEdge = input.flute === true && state.previousInput.flute !== true;
    if (fluteEdge && next.fluteUsed !== true && !talkActive &&
        world.storyVariable(state.ink, "has_flute") === true) {
      const hasPup = world.storyVariable(state.ink, "pup_friend") === true;
      const hasSquirrel = world.storyVariable(state.ink, "squirrel_friend") === true;
      const hasBunny = world.storyVariable(state.ink, "bunny_friend") === true;
      const kind = fluteAssistKind(hasPup, hasSquirrel, hasBunny);
      if (kind !== null) {
        const assist = world.battle.fluteAssist;
        const calmGain = (hasPup ? assist.pupCalm : 0) + (hasBunny ? assist.bunnyCalm : 0);
        const energyGain = hasSquirrel ? assist.squirrelEnergy : 0;
        const softenGain = hasSquirrel ? assist.squirrelSoften : 0;
        const togetherGain = hasBunny && battleParty(world, state.party).length >= 2
          ? assist.bunnyTogether
          : 0;
        const nextCalm = Math.min(calmLimit(critter), next.calm + calmGain);
        const nextEnergy = Math.min(critter.energyMax, next.energy + energyGain);
        const nextSparkleCount = togetherGain > 0
          ? Math.min(world.battle.together.chargeMax, (next.sparkle ?? 0) + togetherGain)
          : next.sparkle;
        const line = assist.lines[kind];
        const updated: Battle = {
          ...next,
          calm: nextCalm,
          energy: nextEnergy,
          fluteUsed: true,
          ...(softenGain > 0 ? { burstSoften: (next.burstSoften ?? 0) + softenGain } : {}),
          ...(nextSparkleCount !== undefined ? { sparkle: nextSparkleCount } : {}),
        };
        if (nextCalm >= critter.calmMax)
          return {
            ...nextBase,
            battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
          };
        return {
          ...nextBase,
          battle: battleMessage(updated, line, "command"),
        };
      }
    }
    // Coach Ash's rainbow lasso in battle (spec 8): once per battle, pops an
    // active wind-up bubble or snags coins and steadies the next burst without
    // consuming Fae's turn.
    const lassoEdge = input.lasso === true && state.previousInput.lasso !== true;
    if (lassoEdge && next.lassoUsed !== true && !talkActive && (next.talk ?? null) === null &&
        world.storyVariable(state.ink, "has_lasso") === true) {
      const assist = world.battle.lassoAssist;
      const nextCalm = Math.min(calmLimit(critter), next.calm + assist.calm);
      const going = next.windUp;
      const popIndex = going?.popped.findIndex((popped) => !popped) ?? -1;
      if (going !== null && popIndex >= 0) {
        const windUp = {
          ...going,
          popped: going.popped.map((popped, index) => popped || index === popIndex),
        };
        const updated: Battle = {
          ...next,
          calm: nextCalm,
          windUp,
          lassoUsed: true,
        };
        if (nextCalm >= critter.calmMax)
          return {
            ...nextBase,
            battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
          };
        return {
          ...nextBase,
          battle: battleMessage(updated, assist.lines.windUp, "command"),
        };
      }
      const updated: Battle = {
        ...next,
        calm: nextCalm,
        lassoUsed: true,
        lassoSteady: true,
      };
      const rewardedBase = { ...nextBase, coins: state.coins + assist.coins };
      if (nextCalm >= critter.calmMax)
        return {
          ...rewardedBase,
          battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
        };
      return {
        ...rewardedBase,
        battle: battleMessage(updated, assist.lines.snag, "command"),
      };
    }
    // Together! party sparkle finisher (spec 8): once charged, a fresh cancel
    // press launches the star chain check, pops all wind-up bubbles, and ticks
    // resting friends without resting anyone.
    const cancelEdge = input.cancel && !state.previousInput.cancel;
    if (cancelEdge && !talkActive && battleParty(world, state.party).length >= 2 &&
        (next.sparkle ?? 0) >= world.battle.together.chargeMax) {
      const going = next.windUp;
      const windUp = going === null
        ? null
        : { ...going, popped: going.popped.map(() => true) };
      const baseSpec = world.battle.together.check;
      const spec = gentleTiming ? gentleCheckSpec(baseSpec) : baseSpec;
      const { sparkle: _sparkle, ...withoutSparkle } = next;
      return {
        ...nextBase,
        battle: startCheck(
          {
            ...withoutSparkle,
            command: "together",
            answered: true,
            windUp,
            rest: restTurn(next.rest),
          },
          "critter",
          spec,
        ),
      };
    }
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
    if (chosen.id === "talk" && critter.talk !== null) {
      const content = talkContent(critter);
      const turn = next.talkTurns ?? 0;
      const knot = content.knots[turn];
      if (knot === undefined)
        throw new Error(`Talk turn ${turn} is out of range for ${critter.id}`);
      const result = runInk(
        world.story, state.ink, { type: "start", knot }, inkFacts(world, state),
      );
      return {
        ...nextBase,
        ink: result.ink,
        battle: {
          ...next,
          phase: "talk",
          message: "",
          revealed: 0,
          talk: {
            ...talkLine(result, {
              knot, turn, speaker: null, text: "", revealed: 0, choices: [], selected: 0,
              ended: false, grade: null,
            }),
            knot,
            turn,
          },
          check: null,
          feelings: [],
          windUp: null,
          talkMode: true,
          talkTurns: turn + 1,
          phaseTicks: 0,
        },
      };
    }
    // Whether this turn's choice answers what the critter feels: this
    // turn's feeling, or in a wind-up the first bubble it pops.
    const going = next.windUp;
    const pop = going === null ? -1 : bubbleAnswered(world, going, chosen.id);
    const answered = going === null ? answers(world, next.feelings[0], chosen.id) : pop >= 0;
    const windUp = going === null || pop < 0
      ? going
      : { ...going, popped: going.popped.map((popped, index) => popped || index === pop) };
    if (chosen.id === "snack") {
      if (totalTreatCount(state.treats) > 0) {
        return {
          ...nextBase,
          battle: { ...next, treatMenu: true, treatSelected: 0 },
        };
      }
      const message = battleMessage(next, critter.lines.snack, "result");
      return {
        ...nextBase,
        snacks: state.snacks - 1,
        battle: {
          ...message,
          answered,
          windUp,
          rest: restTurn(next.rest),
          energy: Math.min(
            critter.energyMax,
            next.energy + critter.commands.snack.energy,
          ),
          calm: Math.min(
            calmLimit(critter),
            next.calm + critter.commands.snack.calm +
              (answered ? world.battle.feelingBonus : 0),
          ),
        },
      };
    }
    const friend = critter.commands.friends[chosen.id];
    const partyOwner = state.party.find(
      (member) => world.party[member.id]?.command?.id === chosen.id,
    );
    const friendContent =
      partyOwner === undefined ? undefined : world.party[partyOwner.id];
    const baseSpec = friendContent?.command?.check ?? world.battle.commands.soothe.check;
    const spec = gentleTiming ? gentleCheckSpec(baseSpec) : baseSpec;
    return {
      ...nextBase,
      battle: startCheck(
        {
          ...next,
          command: chosen.id,
          answered,
          windUp,
          rest:
            friend === undefined
              ? restTurn(next.rest)
              : { ...restTurn(next.rest), [chosen.id]: friend.rest },
        },
        "critter",
        spec,
      ),
    };
  }
  if (next.phase === "check" && next.check !== null) {
    const check = next.check;
    const stepped = stepCheck(check, {
      confirmEdge: confirm,
      confirmHeld: input.confirm,
      lane: laneFromStick(input.move.y),
      lean: leanFromStick(input.move.x),
      move: input.move,
      pointer: input.pointer,
      echoNote: echoNoteFromEdge(state.previousInput.move, input.move),
    });
    const result = stepped.grade;
    // The check stays in the battle through its result, as it ended: the
    // last beat popped, the meter where it was let go.
    const ended = { ...next, check: stepped.check };
    if (result === null) return { ...nextBase, battle: ended };
    if (check.side === "critter") {
      if (next.command === "together") {
        const calm = Math.min(calmLimit(critter), next.calm + togetherCalm(world, state, result));
        return {
          ...nextBase,
          battle: battleMessage(
            {
              ...ended,
              calm,
              lastGrade: result,
            },
            world.battle.together.lines[result],
            "result",
          ),
        };
      }
      const command = critterSideCommand(critter, next.command);
      const owner = next.command === null ? undefined : state.party.find((member) =>
        world.party[member.id]?.command?.id === next.command);
      const actorStats = statsForCommand(world.levels, next.command ?? "soothe",
        levelForXp(world.levels, owner?.xp ?? state.xp));
      const bonus =
        result === "great"
          ? command.numbers.great
          : result === "good"
            ? command.numbers.good
            : 0;
      const calm = Math.min(
        calmLimit(critter),
        next.calm + (next.command === "soothe" || next.command === null
          ? actorStats.power : command.numbers.calm) +
          (bonus > 0 ? actorStats.magic : 0) +
          (next.answered ? world.battle.feelingBonus : 0),
      );
      const sparkle = nextSparkle(world, state, next, result, false);
      const { sparkle: _oldSparkle, ...withoutSparkle } = ended;
      return {
        ...nextBase,
        battle: battleMessage(
          {
            ...withoutSparkle,
            ...(sparkle === undefined ? {} : { sparkle }),
            calm,
            lastGrade: result,
          },
          command.lines[result],
          "result",
        ),
      };
    }
    const baseDamage = burstDamage(world.levels, critter.id, result, check.big,
      statsForCommand(world.levels, "soothe", levelForXp(world.levels, state.xp)).guard);
    const soften = next.burstSoften ?? 0;
    const softened = baseDamage > 0 && soften > 0;
    const damage = softened ? Math.max(0, baseDamage - soften) : baseDamage;
    const sparkle = nextSparkle(world, state, next, result, false);
    const { sparkle: _oldSparkle, burstSoften: _oldSoften, ...withoutExtras } = ended;
    return {
      ...nextBase,
      battle: battleMessage(
        {
          ...withoutExtras,
          ...(sparkle === undefined ? {} : { sparkle }),
          ...(!softened && next.burstSoften !== undefined
            ? { burstSoften: next.burstSoften }
            : {}),
          energy: next.energy - damage,
          lastGrade: result,
        },
        critter.lines.burstResult[result],
        "burstResult",
      ),
    };
  }
  return { ...nextBase, battle: next };
}

// A line tagged `travel: <area>.<spawn>` sends Fae there when the
// conversation closes; the target carries forward through the lines after it.
function dialogueState(
  knot: string,
  result: ReturnType<typeof runInk>,
  carried?: { area: string; spawn: string },
  carriedPlay?: { game: ArcadeGameId; price: number },
): State["dialogue"] {
  const tag = result.line?.tags.find((item) => item.startsWith("travel:"));
  const play = result.line?.tags.map((item) =>
    /^play:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(item.trim())).find((item) => item !== null);
  let playValue = carriedPlay;
  const ending = result.line?.tags.includes("ending") || false;
  const credits = result.line?.tags.includes("credits") || false;
  const game = play?.[1];
  if (game !== undefined && isArcadeGameId(game))
    playValue = { game, price: Number(play?.[2]) };
  const [area, spawn, ...rest] = tag?.slice("travel:".length).trim().split(".") ?? [];
  const travel = area !== undefined && spawn !== undefined && rest.length === 0
    ? { area, spawn }
    : carried;
  return {
    knot,
    speaker: result.line?.speaker ?? null,
    text: result.line?.text ?? "",
    revealed: 0,
    choices: result.choices,
    selected: 0,
    ended: result.ended,
    ...(result.line?.sound === undefined ? {} : { sound: result.line.sound }),
    ...(travel === undefined ? {} : { travel }),
    ...(playValue === undefined ? {} : { play: playValue }),
    ...(ending ? { ending: true } : {}),
    ...(credits ? { credits: true } : {}),
  };
}

// A line's item tags act as it's shown (spec 7): `buy: snack <price>` sells
// Fae a snack; `gift: snack <count>` and `gift: coins <count>` give her snacks
// (the clubhouse fridge) or coins (the pond's tin); `feed: snack <count>` gives
// snacks away (a treat for a friend), never below none; `trade: <prize>
// <price>` buys a prize at the ticket counter. The loader allows no other item
// or format.
function applyItemTags(state: State, tags: string[]): State {
  let next = state;
  for (const raw of tags) {
    const tag = raw.trim();
    const price = /^buy:\s*snack\s+(\d+)$/.exec(tag)?.[1];
    if (price !== undefined) next = purchaseSnack(next, Number(price));
    const treat = /^buy-treat:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
    if (treat?.[1] !== undefined && treat[2] !== undefined)
      next = purchaseTreat(next, treat[1], Number(treat[2]));
    const gift = /^gift:\s*(snack|coins)\s+(\d+)$/.exec(tag);
    if (gift?.[1] === "snack") next = { ...next, snacks: next.snacks + Number(gift[2]) };
    if (gift?.[1] === "coins") next = { ...next, coins: next.coins + Number(gift[2]) };
    const fed = /^feed:\s*snack\s+(\d+)$/.exec(tag)?.[1];
    if (fed !== undefined) next = { ...next, snacks: Math.max(0, next.snacks - Number(fed)) };
    // A prize from the ticket counter, if Fae has the tickets and not the prize.
    const trade = /^trade:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
    const prize = trade?.[1];
    const tickets = Number(trade?.[2]);
    if (prize !== undefined && next.tickets >= tickets && !next.prizes.includes(prize))
      next = { ...next, tickets: next.tickets - tickets, prizes: [...next.prizes, prize] };
  }
  return next;
}

/*
 * The story hears about every calm (spec 7): after a battle ends in a calm,
 * the core runs the story's `on_calm` knot, if it has one, with the facts as
 * they are now. The knot only updates variables (the clubhouse garden counts
 * calms); one that prints a line or offers a choice changes nothing.
 */
export const CALM_HOOK = "on_calm";

function afterArrival(world: World, state: State): State {
  const area = world.areas[state.area];
  if (area?.land !== "hills" || !storyHasKnot(world.story, "arrive_hills")) return state;
  const result = runInk(world.story, state.ink, { type: "start", knot: "arrive_hills" },
    inkFacts(world, state));
  return result.line === null && result.choices.length === 0 && result.ended
    ? { ...state, ink: result.ink }
    : state;
}

function afterCalm(world: World, state: State): State {
  if (!storyHasKnot(world.story, CALM_HOOK)) return state;
  const result = runInk(world.story, state.ink, { type: "start", knot: CALM_HOOK },
    inkFacts(world, state));
  return result.line === null && result.choices.length === 0 && result.ended
    ? { ...state, ink: result.ink }
    : state;
}

// Opens a conversation at `knot`: a look point's, a person's, or the flute's.
// Its opening line's item tags act at once (spec 7).
function openTalk(world: World, state: State, input: ActionFrame, knot: string): State {
  const result = runInk(world.story, state.ink, { type: "start", knot }, inkFacts(world, state));
  return applyItemTags({
    ...state,
    tick: state.tick + 1,
    ink: result.ink,
    previousInput: { ...input },
    dialogue: dialogueState(knot, result),
    motion: { ...state.motion, moving: false },
    party: haltedParty(state.party),
  }, result.line?.tags ?? []);
}

export function startDialogue(world: World, state: State, knot: string): State {
  return openTalk(world, state, blankInput(), knot);
}

export const FLUTE_KNOT = "flute";

function closeDialogue(world: World, state: State): { state: State; events: Event[] } {
  const dialogue = state.dialogue;
  if (dialogue === null) return { state, events: [] };
  const play = dialogue.play;
  const opened = play !== undefined && state.arcade === null && state.coins >= play.price
    ? openArcade(world, state, play.game, play.price) : state;
  if (dialogue.ending === true) {
    const snapshot: State = {
      ...state,
      dialogue: null,
      transition: null,
      battle: null,
      arcade: null,
      finale: null,
    };
    const bedroom = world.areas.bedroom;
    const spawn = bedroom?.spawns.bed;
    if (bedroom === undefined || spawn === undefined)
      throw new Error("Ending content invariant missing bedroom bed spawn");
    if (!storyHasKnot(world.story, "morning_start"))
      throw new Error("Ending content invariant missing morning_start knot");
    if (!storyHasKnot(world.story, "mom"))
      throw new Error("Ending content invariant missing mom knot");
    const morningInk = runInk(
      world.story,
      snapshot.ink,
      { type: "start", knot: "morning_start" },
      inkFacts(world, snapshot),
    ).ink;
    const live = {
      ...snapshot,
      area: "bedroom",
      player: { x: spawn.x, y: spawn.y },
      facing: spawn.facing,
      safeSpot: { area: "bedroom", spawn: "bed" },
      party: spawnParty(world, morningInk, bedroom, spawn, ["maddie"]),
      ink: morningInk,
      finale: "morning" as const,
      dialogue: null,
    };
    const wake = runInk(
      world.story,
      live.ink,
      { type: "start", knot: "mom" },
      inkFacts(world, live),
    );
    const morning = { ...live, ink: wake.ink, dialogue: dialogueState("mom", wake) };
    return { state: morning, events: [{ type: "ending-save", state: snapshot }] };
  }
  if (dialogue.credits === true)
    return { state: { ...state, dialogue: null, finale: "credits" }, events: [] };
  return { state: {
    ...opened,
    dialogue: null,
    transition:
      dialogue.travel === undefined
        ? opened.transition
        : { target: dialogue.travel, phase: "out", elapsed: 0 },
  }, events: [] };
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
function dialogueStep(
  world: World,
  state: State,
  input: ActionFrame,
): { state: State; events: Event[] } {
  const dialogue = state.dialogue;
  if (dialogue === null) return { state, events: [] };
  const previous = state.previousInput;
  const confirm = input.confirm && !previous.confirm;
  const next: State = {
    ...state,
    tick: state.tick + 1,
    previousInput: { ...input },
    party: restingParty(state.party),
  };
  if (dialogue.revealed < dialogue.text.length) {
    const revealed = confirm
      ? dialogue.text.length
      : Math.min(
          dialogue.text.length,
          dialogue.revealed + world.tunables.interact.revealPerTick,
        );
    return { state: { ...next, dialogue: { ...dialogue, revealed } }, events: [] };
  }
  const count = dialogue.choices.length;
  if (count === 0) {
    if (!confirm) return { state: next, events: [] };
    if (dialogue.ended) return closeDialogue(world, next);
    const result = runInk(
      world.story,
      state.ink,
      { type: "next" },
      inkFacts(world, state),
    );
    const following = result.line === null && result.choices.length === 0
      ? null
      : dialogueState(dialogue.knot, result, dialogue.travel, dialogue.play);
    const advanced = applyItemTags({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(world, advanced)
      : { state: { ...advanced, dialogue: following }, events: [] };
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
      inkFacts(world, state),
    );
    const following = result.line === null && result.choices.length === 0
      ? null
      : dialogueState(dialogue.knot, result, dialogue.travel, dialogue.play);
    const advanced = applyItemTags({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(world, advanced)
      : { state: { ...advanced, dialogue: following }, events: [] };
  }
  const up = input.move.y < -0.5 && previous.move.y >= -0.5;
  const down = input.move.y > 0.5 && previous.move.y <= 0.5;
  if (!up && !down) return { state: next, events: [] };
  const selected = (dialogue.selected + (down ? 1 : -1) + count) % count;
  return { state: { ...next, dialogue: { ...dialogue, selected } }, events: [] };
}

function stepTick(
  world: World,
  state: State,
  input: ActionFrame,
  gentleTiming: boolean,
): { state: State; events: Event[] } {
  if (state.finale === "credits")
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        party: restingParty(state.party),
      },
      events: [],
    };
  const area = world.areas[state.area];
  if (area === undefined) throw new Error(`Unknown state area: ${state.area}`);
  if (state.battle !== null)
    return { state: battleStep(world, state, input, gentleTiming), events: [] };
  if (state.arcade !== null) {
    const nextBase = { ...state, tick: state.tick + 1, previousInput: { ...input },
      motion: { ...state.motion, moving: false }, party: restingParty(state.party) };
    const stepped = stepArcade(world, state, input, gentleTiming);
    return {
      state: {
        ...nextBase,
        arcade: stepped.arcade,
        prizes: stepped.prizes,
        tickets: stepped.tickets,
        snacks: stepped.snacks,
        ...(stepped.coins === undefined ? {} : { coins: stepped.coins }),
        ...(stepped.rng === undefined ? {} : { rng: stepped.rng }),
        ...(stepped.caughtFish === undefined ? {} : { caughtFish: stepped.caughtFish }),
      },
      events: [],
    };
  }
  if (state.dialogue !== null)
    return dialogueStep(world, state, input);
  const menuEdge = input.menu && !state.previousInput.menu;
  const cancelEdge = input.cancel && !state.previousInput.cancel;
  const lanternEdge = input.lantern === true && state.previousInput.lantern !== true;
  const fluteEdge = input.flute === true && state.previousInput.flute !== true;
  if (state.journalOpen) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: cancelEdge || menuEdge ? false : true,
        previousInput: { ...input },
        party: restingParty(state.party),
        motion: { ...state.motion, moving: false },
      },
      events: [],
    };
  }
  if (lanternEdge && state.finale === null && state.transition === null) {
    const hasLantern = world.storyVariable(state.ink, "has_lantern") === true;
    if (hasLantern) return {
      state: {
        ...state,
        tick: state.tick + 1,
        lantern: !state.lantern,
        previousInput: { ...input },
      },
      events: [],
    };
  }
  // The flute plays its own knot: a friend called, or sent home (spec 5).
  if (fluteEdge && state.finale === null && state.transition === null &&
      world.storyVariable(state.ink, "has_flute") === true &&
      storyHasKnot(world.story, FLUTE_KNOT))
    return { state: openTalk(world, state, input, FLUTE_KNOT), events: [] };
  if (menuEdge && state.transition === null) {
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        journalOpen: true,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        party: restingParty(state.party),
      },
      events: [],
    };
  }
  if (state.transition !== null) {
    const transition = state.transition;
    const elapsed = transition.elapsed + 1;
    const held = moveDirection(input.move);
    const limit = world.tunables.doorFadeTicks;
    if (transition.phase === "out" && elapsed >= limit) {
      const targetArea = world.areas[transition.target.area];
      if (targetArea === undefined) throw new Error("Unknown transition area");
      const spawn = targetArea.spawns[transition.target.spawn];
      if (spawn === undefined) throw new Error("Unknown transition spawn");
      const arrived: State = {
        ...state,
        tick: state.tick + 1,
        area: targetArea.id,
        player: { x: spawn.x, y: spawn.y },
        facing: spawn.facing,
        previousInput: { ...input },
        motion: { ...state.motion, moving: false },
        transition: { target: transition.target, phase: "in", elapsed: 0 },
        party: spawnParty(
          world,
          state.ink,
          targetArea,
          spawn,
          state.party.map((member) => member.id),
        ),
        safeSpot: { area: targetArea.id, spawn: transition.target.spawn },
        backLink: held === undefined ? undefined : { area: state.area, direction: held },
      };
      // Every arrival rolls the area's critters fresh (a rest arrives too).
      const revealed = afterArrival(world, arrived);
      return { state: { ...revealed, ...rollWild(world, revealed, targetArea) }, events: [] };
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
        backLink: state.backLink?.direction === held ? state.backLink : undefined,
      },
      events: [],
    };
  }
  if (input.confirm && !state.previousInput.confirm) {
    const target = targetInteractable(world, state);
    if (target !== undefined && target.knot !== undefined)
      return { state: openTalk(world, state, input, target.knot), events: [] };
  }
  const length = Math.sqrt(
    input.move.x * input.move.x + input.move.y * input.move.y,
  );
  const scale = length > 1 ? 1 / length : 1;
  const speed = world.tunables.walkSpeed / 60;
  // People who are there are solid, for Fae and for her party alike.
  const solid = solidArea(world, state, area);
  const player = resolveMove(
    state.player,
    {
      x: state.player.x + input.move.x * scale * speed,
      y: state.player.y + input.move.y * scale * speed,
    },
    solid,
    world.tunables.playerRadius,
  );
  const displacementX = player.x - state.player.x;
  const displacementY = player.y - state.player.y;
  const displacement = Math.sqrt(
    displacementX * displacementX + displacementY * displacementY,
  );
  const moved = stepWild(world, state, area, player, true);
  let facing = state.facing;
  if (Math.abs(input.move.x) >= Math.abs(input.move.y) && input.move.x !== 0)
    facing = input.move.x < 0 ? "left" : "right";
  else if (input.move.y !== 0) facing = input.move.y < 0 ? "up" : "down";
  const events: Event[] = [];
  for (const button of ["confirm", "cancel", "menu"] as const) {
    if (input[button] && !state.previousInput[button])
      events.push({ type: "button", button });
  }
  // The back-link rule (spec 6): after Fae arrives through a door, the way
  // straight back to where she came from stays shut while she keeps holding
  // the direction she arrived holding; letting go or turning opens it again.
  const backLink = state.backLink?.direction === moveDirection(input.move)
    ? state.backLink
    : undefined;
  const trigger = area.triggers.find(
    (item) =>
      !pointInPolygon(state.player, item.polygon) &&
      pointInPolygon(player, item.polygon) &&
      item.target.area !== backLink?.area,
  );
  // A door that needs a story variable (spec 6): while the variable isn't
  // true, crossing in plays its knot instead of leaving. Fae still steps into
  // the doorway, so the outside-to-inside rule plays it again only after she
  // steps out and back in.
  const locked =
    trigger?.requires !== undefined &&
    world.storyVariable(state.ink, trigger.requires.variable) !== true
      ? trigger.requires
      : undefined;
  const door = locked === undefined ? trigger : undefined;
  const knock =
    locked === undefined
      ? undefined
      : {
          knot: locked.knot,
          result: runInk(
            world.story,
            state.ink,
            { type: "start", knot: locked.knot },
            inkFacts(world, state),
          ),
        };
  const touched = touchingCritter(world, state, moved.wild, player);
  const wildTouch = touched?.wildTouch;
  const critter = touched?.critter;
  if (critter !== undefined) {
    // Meeting a recurring critter (Milestone 51): one of a species Fae knows
    // well calms at once, soothed and paid; else whoever got the jump shows
    // in the opening. A set piece always opens plainly.
    const friend = wildTouch !== undefined && oldFriend(world, state, critter);
    const jump = wildTouch === undefined
      ? "even"
      : firstTouch(wildTouch, world.tunables.roam, state.player, player);
    const named = (line: string): string => line.replace("{name}", critter.name);
    const { firstTouch: touchContent, oldFriends } = world.battle;
    const battle: Battle = {
      critterId: critter.id,
      den: wildTouch?.den ?? null,
      entry: { ...state.player },
      phase: friend ? "soothed" : "intro",
      message: friend
        ? named(oldFriends.line)
        : jump === "even"
          ? critter.lines.intro
          : named(touchContent.lines[jump]),
      revealed: 0,
      selected: 0,
      command: null,
      energy: critter.energyMax,
      calm: friend
        ? critter.calmMax
        : jump === "surprised"
          ? Math.min(critter.calmMax - 1, touchContent.surprise)
          : 0,
      rest: {},
      check: null,
      lastGrade: null,
      feelings: [],
      answered: false,
      lanternPeek: false,
      turn: !friend && jump === "caught" ? 0 : 1,
      windUp: null,
      talkMode: false,
      talk: null,
      talkTurns: 0,
      rewardSticker: null,
      phaseTicks: 0,
    };
    // A recurring critter met Fae where it stood; a set piece keeps her
    // on the tick before she reached it.
    return {
      state: {
        ...state,
        tick: state.tick + 1,
        previousInput: { ...input },
        ...(wildTouch === undefined ? {} : { player }),
        wild: moved.wild.map((item) =>
          item === wildTouch ? sendHome(world, area, item, false) : item),
        rng: moved.rng,
        battle,
        motion: { ...state.motion, moving: false },
      },
      events,
    };
  }
  const party =
    trigger === undefined
      ? stepParty(world, solid, state, player, displacement > 0.0001)
      : haltedParty(state.party);
  const nextState: State = {
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
      dialogue:
        knock === undefined
          ? state.dialogue
          : dialogueState(knock.knot, knock.result),
      party,
      wild: moved.wild,
      rng: moved.rng,
      backLink,
    };
  return {
    state: knock === undefined
      ? nextState
      : applyItemTags(nextState, knock.result.line?.tags ?? []),
    events,
  };
}

export function step(
  world: World,
  state: State,
  input: ActionFrame,
  options?: StepOptions,
): { state: State; events: Event[] } {
  const result = stepTick(world, state, input, options?.gentleTiming === true);
  const joined = syncParty(world, result.state);
  const events = [...result.events];
  const addLevelEvent = (member: string, beforeXp: number, afterXp: number): void => {
    const delta = levelUpDelta(world.levels, beforeXp, afterXp);
    if (delta.levels === 0) return;
    events.push({ type: "level-up", member, from: delta.before, to: delta.after,
      deltas: {
        power: delta.afterStats.power - delta.beforeStats.power,
        magic: delta.afterStats.magic - delta.beforeStats.magic,
        life: delta.afterStats.life - delta.beforeStats.life,
        guard: delta.afterStats.guard - delta.beforeStats.guard,
      } });
  };
  addLevelEvent("fae", state.xp, joined.xp);
  for (const member of joined.party) {
    const before = state.party.find((item) => item.id === member.id)?.xp;
    if (before !== undefined) addLevelEvent(member.id, before, member.xp);
  }
  return { state: joined, events };
}

export function levelUpEvents(world: World, before: State, after: State): Event[] {
  const events: Event[] = [];
  const add = (member: string, previousXp: number, nextXp: number): void => {
    const delta = levelUpDelta(world.levels, previousXp, nextXp);
    if (delta.levels === 0) return;
    events.push({ type: "level-up", member, from: delta.before, to: delta.after,
      deltas: { power: delta.afterStats.power - delta.beforeStats.power,
        magic: delta.afterStats.magic - delta.beforeStats.magic,
        life: delta.afterStats.life - delta.beforeStats.life,
        guard: delta.afterStats.guard - delta.beforeStats.guard } });
  };
  add("fae", before.xp, after.xp);
  for (const member of after.party) {
    const previous = before.party.find((item) => item.id === member.id);
    if (previous !== undefined) add(member.id, previous.xp, member.xp);
  }
  return events;
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
