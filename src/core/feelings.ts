import { battleParty } from "./party";
import type { Critter, FeelingId, State, WindUp, World } from "./types";

// Feelings (spec 8, Milestone 42). Once a second friend fights beside Fae, a
// chaos critter shows what it feels each turn, and the command that answers
// it adds `feelingBonus` calm. The battle keeps three in a row (this turn's,
// the next, and the turn after, which the lantern can peek at), drawn from
// the seeded PRNG one per turn. A mini-boss's wind-up (Milestone 50) shows
// several at once, as bubbles each answer pops.

/**
 * Feelings show once two friends fight beside Fae, each with a battle
 * command (spec 8): from Sue's arrival on. A party member without one
 * doesn't count.
 */
export function feelingsOn(world: World, state: State): boolean {
  return battleParty(world, state.party).length >= 2;
}

/** Whether Fae has the command that answers a feeling now (and a snack to give). */
function answerable(world: World, state: State, answer: string): boolean {
  if (answer === "soothe") return true;
  if (answer === "snack") return state.snacks > 0;
  return battleParty(world, state.party)
    .some((member) => world.party[member.id]?.command?.id === answer);
}

/**
 * The kind's feelings Fae can answer now (in content order): the ones a
 * turn's feeling and a wind-up's bubbles are drawn from.
 */
export function openFeelings(world: World, state: State, critter: Critter): FeelingId[] {
  return critter.feelings.filter((feeling) =>
    answerable(world, state, world.battle.feelings[feeling].answer));
}

/**
 * The feeling one PRNG value (0..1) picks from `open`, spread evenly; null
 * when it's empty.
 */
export function pickFeeling(open: FeelingId[], value: number): FeelingId | null {
  return open[Math.min(open.length - 1, Math.floor(value * open.length))] ?? null;
}

/**
 * The feeling one PRNG value (0..1) picks: from the kind's feelings that Fae
 * can answer now, spread evenly; null when she can answer none of them.
 */
export function feelingFromDraw(
  world: World,
  state: State,
  critter: Critter,
  value: number,
): FeelingId | null {
  return pickFeeling(openFeelings(world, state, critter), value);
}

/** Whether a command answers a feeling. */
export function answers(
  world: World,
  feeling: FeelingId | null | undefined,
  command: string,
): boolean {
  return feeling !== null && feeling !== undefined &&
    world.battle.feelings[feeling].answer === command;
}

/**
 * Whether a wind-up starts on `turn` (spec 8, Milestone 50): on its `start`
 * turn, then every `every` turns.
 */
export function windUpStarts(windUp: WindUp | null, turn: number): boolean {
  return windUp !== null && turn >= windUp.start && (turn - windUp.start) % windUp.every === 0;
}

/**
 * The bubble a command pops in a wind-up: the first one not yet popped that
 * it answers, or -1.
 */
export function bubbleAnswered(
  world: World,
  windUp: { feelings: FeelingId[]; popped: boolean[] },
  command: string,
): number {
  return windUp.feelings.findIndex((feeling, index) =>
    windUp.popped[index] !== true && answers(world, feeling, command));
}
