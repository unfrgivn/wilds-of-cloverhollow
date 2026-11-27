import type {
  ActionFrame,
  Area,
  Direction,
  Event,
  Fixture,
  Mood,
  Npc,
  Point,
  State,
  World,
} from "./types";
import { createInkState, runInk, setInkVariables, storyHasKnot } from "./ink";
import { sceneryArea } from "./props";
import {
  closestPointOnPolygon,
  distanceToPolygon,
  pointInPolygon,
  resolveCollision,
  resolveMove,
} from "./geometry";
import {
  BOSS_SET_PIECES,
  battleParty,
  bossesCalmedCount,
  calmedFact,
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
  inkFacts,
  presentCritters,
  rollWild,
  sendHome,
  stepWild,
  touchingCritter,
} from "./roam";
import {
  CALM_HOOK,
  addTreat,
  battleCommands,
  battleView,
  consumeTreat,
  purchaseTreat,
  revealCharacters,
  startBattle,
  stepBattle,
  totalTreatCount,
  type TextSpeed,
} from "./battle";
import { levelUpDelta } from "./levels";
import { npcLiveFootprint, npcLivePoint } from "./npc-stroll";
import { openArcade, stepArcade, isArcadeGameId, type ArcadeGameId } from "./arcade";

export {
  BOSS_SET_PIECES,
  CALM_HOOK,
  addTreat,
  battleCommands,
  battleFoe,
  battleParty,
  battleView,
  bossesCalmedCount,
  calmedFact,
  closestPointOnPolygon,
  consumeTreat,
  distanceToPolygon,
  faeBox,
  hiddenFraction,
  inkFacts,
  npcVisible,
  partyCommand,
  partyLeader,
  partySlots,
  pointInPolygon,
  presentCritters,
  purchaseTreat,
  resolveCollision,
  resolveMove,
  revealCharacters,
  rollWild,
  startBattle,
  stepBattle,
  stepParty,
  stepWild,
  syncParty,
  totalTreatCount,
  touchingCritter,
  visibleFollowerSlot,
  type TextSpeed,
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
  const critters: Record<string, Mood> = Object.fromEntries(
    Object.values(world.areas).flatMap((each) => each.critters)
      .map((piece) => [piece.id, "chaos"]),
  );
  const calms: Record<string, number> = {};
  const stickers: string[] = [];
  if (fixture.calms !== undefined) {
    for (const [key, count] of Object.entries(fixture.calms)) {
      if (count <= 0) continue;
      const kind = world.critters[key] ??
        Object.values(world.critters).find((item) => item.species === key);
      const species = kind?.species ?? key;
      calms[species] = (calms[species] ?? 0) + count;
      if (critters[key] !== undefined) critters[key] = "calm";
      if (kind !== undefined && !stickers.includes(kind.sticker.id))
        stickers.push(kind.sticker.id);
    }
  }
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
    critters,
    wild: [],
    calms,
    stickers,
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

function moveDirection(move: Point): Direction | undefined {
  if (move.x === 0 && move.y === 0) return undefined;
  if (Math.abs(move.x) >= Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

export function targetInteractable(
  world: World,
  state: State,
):
  | Area["interactables"][number]
  | Area["glows"][number]
  | { id: string; knot: string; point: Point; prompt: Npc["prompt"] }
  | undefined {
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
    .map((npc) => {
      const live = npcLivePoint(state, npc);
      return {
        id: `npc:${npc.id}`,
        knot: npc.knot,
        point: { x: live.x, y: live.y },
        prompt: npc.prompt,
      };
    });
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
        .map((npc) => npcLiveFootprint(npc, npcLivePoint(state, npc))),
    ],
  };
}

// Which way a person in the area looks: toward Fae while she talks to them
// (along the larger axis of the gap between them), otherwise along their live
// stroll facing (or as authored when stationary).
export function npcFacing(state: State, npc: Npc): Direction {
  const live = npcLivePoint(state, npc);
  if (state.dialogue === null || state.dialogue.knot !== npc.knot)
    return live.facing;
  const dx = state.player.x - live.x;
  const dy = state.player.y - live.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type StepOptions = {
  gentleTiming?: boolean;
  textSpeed?: TextSpeed;
};

// A line tagged `travel: <area>.<spawn>` sends Fae there when the
// conversation closes; the target carries forward through the lines after it.
function dialogueState(
  knot: string,
  result: ReturnType<typeof runInk>,
  carried?: { area: string; spawn: string },
  carriedPlay?: { game: ArcadeGameId; price: number },
  carriedPartnerPoint?: Point,
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
    ...(carriedPartnerPoint === undefined ? {} : { partnerPoint: carriedPartnerPoint }),
  };
}

// A line's item tags act as it's shown (spec 7): `buy: snack <price>` sells
// Fae a snack; `gift: snack <count>`, `gift: coins <count>`, and
// `gift: treat <id> <count>` give her snacks, coins, or specialty treats;
// `feed: snack <count>` gives snacks away (a treat for a friend), never below
// none; `trade: <prize> <price>` buys a prize at the ticket counter. The
// loader allows no other item or format.
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
    const giftTreat = /^gift:\s*treat\s+([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
    if (giftTreat?.[1] !== undefined && giftTreat[2] !== undefined)
      next = addTreat(next, giftTreat[1], Number(giftTreat[2]));
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

function afterArrival(world: World, state: State): State {
  const area = world.areas[state.area];
  if (area?.land !== "hills" || !storyHasKnot(world.story, "arrive_hills")) return state;
  const result = runInk(world.story, state.ink, { type: "start", knot: "arrive_hills" },
    inkFacts(world, state));
  return result.line === null && result.choices.length === 0 && result.ended
    ? { ...state, ink: result.ink }
    : state;
}

// Opens a conversation at `knot`: a look point's, a person's, or the flute's.
// Its opening line's item tags act at once (spec 7).
function openTalk(world: World, state: State, input: ActionFrame, knot: string): State {
  const result = runInk(world.story, state.ink, { type: "start", knot }, inkFacts(world, state));
  const area = world.areas[state.area];
  const partnerNpc = area?.npcs.find(
    (npc) => npc.knot === knot && npc.stroll !== undefined && npcVisible(world, state, npc),
  );
  const partnerPoint = partnerNpc === undefined
    ? undefined
    : (() => {
        const live = npcLivePoint(state, partnerNpc);
        return { x: live.x, y: live.y };
      })();
  return applyItemTags({
    ...state,
    tick: state.tick + 1,
    ink: result.ink,
    previousInput: { ...input },
    dialogue: dialogueState(knot, result, undefined, undefined, partnerPoint),
    motion: { ...state.motion, moving: false },
    party: haltedParty(state.party),
  }, result.line?.tags ?? []);
}

export function startDialogue(world: World, state: State, knot: string): State {
  return openTalk(world, state, blankInput(), knot);
}

export const FLUTE_KNOT = "flute";

function closeDialogue(
  world: World,
  state: State,
  gentleTiming = false,
): { state: State; events: Event[] } {
  const dialogue = state.dialogue;
  if (dialogue === null) return { state, events: [] };
  const play = dialogue.play;
  const opened = play !== undefined && state.arcade === null && state.coins >= play.price
    ? openArcade(world, state, play.game, play.price, gentleTiming) : state;
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
  textSpeed: TextSpeed | undefined,
  gentleTiming = false,
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
      : revealCharacters(world, textSpeed, dialogue.revealed, dialogue.text.length);
    return { state: { ...next, dialogue: { ...dialogue, revealed } }, events: [] };
  }
  const count = dialogue.choices.length;
  if (count === 0) {
    if (!confirm) return { state: next, events: [] };
    if (dialogue.ended) return closeDialogue(world, next, gentleTiming);
    const result = runInk(
      world.story,
      state.ink,
      { type: "next" },
      inkFacts(world, state),
    );
    const following = result.line === null && result.choices.length === 0
      ? null
      : dialogueState(
          dialogue.knot,
          result,
          dialogue.travel,
          dialogue.play,
          dialogue.partnerPoint,
        );
    const advanced = applyItemTags({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(world, advanced, gentleTiming)
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
      : dialogueState(
          dialogue.knot,
          result,
          dialogue.travel,
          dialogue.play,
          dialogue.partnerPoint,
        );
    const advanced = applyItemTags({ ...next, ink: result.ink }, result.line?.tags ?? []);
    return following === null
      ? closeDialogue(world, advanced, gentleTiming)
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
  textSpeed: TextSpeed | undefined,
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
    return { state: stepBattle(world, state, input, gentleTiming, textSpeed), events: [] };
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
    return dialogueStep(world, state, input, textSpeed, gentleTiming);
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
    const battle = startBattle(world, state, critter, wildTouch, player, textSpeed);
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
  const result = stepTick(
    world,
    state,
    input,
    options?.gentleTiming === true,
    options?.textSpeed,
  );
  const synced = syncParty(world, result.state);
  const joined = options?.textSpeed === "instant" && synced.dialogue !== null
    ? {
        ...synced,
        dialogue: { ...synced.dialogue, revealed: synced.dialogue.text.length },
      }
    : synced;
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
