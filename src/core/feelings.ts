import { battleParty } from "./party";
import type { Critter, FeelingId, State, World } from "./types";

// Feelings (spec 8, Milestone 42). Once a second friend fights beside Fae, a
// chaos critter shows what it feels each turn, and the command that answers
// it adds `feelingBonus` calm. The battle keeps three in a row (this turn's,
// the next, and the turn after, which the lantern can peek at), drawn from
// the seeded PRNG one per turn.

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
 * The feeling one PRNG value (0..1) picks: from the kind's feelings that Fae
 * can answer now, spread evenly; null when she can answer none of them.
 */
export function feelingFromDraw(
  world: World,
  state: State,
  critter: Critter,
  value: number,
): FeelingId | null {
  const open = critter.feelings.filter((feeling) =>
    answerable(world, state, world.battle.feelings[feeling].answer));
  return open[Math.min(open.length - 1, Math.floor(value * open.length))] ?? null;
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
