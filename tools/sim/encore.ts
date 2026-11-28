import {
  battleCommands,
  blankInput,
  createState,
  encoreSummary,
  stableHash,
  startEncoreBattle,
  step,
  targetInteractable,
  type ActionFrame,
  type EncoreModifierId,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const festival = fixtures.festival;
if (festival === undefined) throw new Error("missing festival fixture");
const festivalFixture = festival;

const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function playCheck(worldRef: World, initial: State): State {
  let state = initial;
  for (let guard = 0; guard < 600 && state.battle?.phase === "check"; guard += 1) {
    const check = state.battle.check;
    if (check === null) break;
    if (check.kind === "ring") {
      const hit = check.tick + 1 === check.spec.targetTick;
      state = step(worldRef, state, hit ? press({ confirm: true }) : blankInput()).state;
    } else if (check.kind === "charge") {
      const hold = check.tick >= check.spec.waitTicks && check.held < check.spec.targetTick;
      state = step(worldRef, state, hold ? press({ confirm: true }) : blankInput()).state;
    } else if (check.kind === "chain") {
      const hit = check.spec.arrivals.some(
        (arrival, idx) => check.results[idx] === "pending" && check.tick + 1 === arrival,
      );
      state = step(worldRef, state, hit ? press({ confirm: true }) : blankInput()).state;
    } else if (check.kind === "lean") {
      const blowing = check.spec.starts.some(
        (start, idx) =>
          check.results[idx] === "pending" &&
          check.tick >= start &&
          check.tick < start + check.spec.puffTicks,
      );
      const x = blowing ? 1 : check.balance > 6 ? -1 : 0;
      state = step(worldRef, state, press({ move: { x, y: 0 } })).state;
    } else {
      state = step(worldRef, state, blankInput()).state;
    }
  }
  return state;
}

function runEncoreSim(): { hash: string; tick: number; coins: number; stars: number } {
  let state = createState(world, festivalFixture, 7);
  // Walk north-east across the sunlit Sanctuary meadow to the Dream Memory Shrine at (770, 395).
  for (let i = 0; i < 400 && targetInteractable(world, state)?.id !== "dream-shrine"; i += 1) {
    const dx = 770 - state.player.x;
    const dy = 438 - state.player.y;
    const move = Math.abs(dx) > 10
      ? { x: dx > 0 ? 1 : -1, y: 0 }
      : Math.abs(dy) > 10
        ? { x: 0, y: dy > 0 ? 1 : -1 }
        : { x: 0, y: -1 };
    state = step(world, state, press({ move })).state;
  }
  if (targetInteractable(world, state)?.id !== "dream-shrine") {
    throw new Error(`failed to target dream-shrine (at ${state.player.x}, ${state.player.y})`);
  }

  // Talk to the Dream Memory Shrine and pick "Open Dream Memory Shrine" -> open-encore-shrine event
  let openedShrine = false;
  for (let i = 0; i < 160 && !openedShrine; i += 1) {
    const frame = i % 2 === 0 ? press({ confirm: true }) : blankInput();
    const res = step(world, state, frame, { textSpeed: "instant" });
    state = res.state;
    if (res.events.some((ev) => ev.type === "open-encore-shrine")) openedShrine = true;
  }
  if (!openedShrine) throw new Error("dream_shrine did not emit open-encore-shrine");

  const inkBefore = state.ink;
  const crittersBefore = stableHash(state.critters);
  const coinsBefore = state.coins;
  const modifiers: EncoreModifierId[] = ["brisk-breeze", "windup-surge", "pure-heart"];

  // Launch a 3-Star Challenge rematch against Grumpy Gull
  state = startEncoreBattle(world, state, "gull", modifiers, "instant");
  if (state.battle === null) throw new Error("failed to launch Encore battle");

  for (let guard = 0; guard < 1800 && state.battle !== null; guard += 1) {
    const b = state.battle;
    if (b.phase === "check") {
      state = playCheck(world, state);
      continue;
    }
    if (b.phase === "command") {
      const cmds = battleCommands(world, state);
      const feelingIdx = cmds.findIndex(
        (cmd) => !cmd.disabled && cmd.feeling !== null && cmd.id !== "snack",
      );
      const primaryIdx = cmds.findIndex(
        (cmd) => !cmd.disabled && cmd.id !== "recover" && cmd.id !== "snack" && cmd.id !== "run",
      );
      const pick = feelingIdx >= 0 ? feelingIdx : Math.max(0, primaryIdx);
      state = step(world, state, press({ choose: pick }), { textSpeed: "instant" }).state;
      state = step(world, state, blankInput(), { textSpeed: "instant" }).state;
      continue;
    }
    state = step(world, state, press({ confirm: true }), { textSpeed: "instant" }).state;
    state = step(world, state, blankInput(), { textSpeed: "instant" }).state;
  }

  if (state.battle !== null) throw new Error("Encore battle did not complete within budget");
  if (state.ink !== inkBefore) throw new Error("Encore mutated state.ink");
  if (stableHash(state.critters) !== crittersBefore) {
    throw new Error("Encore mutated state.critters");
  }
  const summary = encoreSummary(world, state);
  if (summary.starsEarned !== 3 || summary.trophiesEarned !== 1) {
    throw new Error(`unexpected Encore summary: ${JSON.stringify(summary)}`);
  }
  if (state.coins !== coinsBefore + 45) {
    throw new Error(`expected +45 coins, got ${state.coins - coinsBefore}`);
  }
  return {
    hash: stableHash(state),
    tick: state.tick,
    coins: state.coins,
    stars: summary.starsEarned,
  };
}

const first = runEncoreSim();
const second = runEncoreSim();
if (first.hash !== second.hash) {
  throw new Error(`non-deterministic Encore sim: ${first.hash} vs ${second.hash}`);
}
console.log(
  `encore: tick ${first.tick}, 3-star Gull trophy won (+${first.coins} coins), ` +
    `deterministic (${first.hash})`,
);
