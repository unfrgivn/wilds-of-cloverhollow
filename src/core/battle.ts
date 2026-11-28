import type {
  ActionFrame,
  Battle,
  CheckSide,
  CheckSpec,
  Critter,
  Direction,
  FeelingId,
  Point,
  State,
  Wild,
  World,
} from "./types";
import {
  checkDraws,
  createCheck,
  echoNoteFromEdge,
  gentleCheckSpec,
  laneFromStick,
  leanFromStick,
  pickFromDraw,
  stepCheck,
} from "./checks";
import { firstTouch, oldFriend } from "./encounter";
import {
  feelingFromDraw,
  feelingsOn,
  openFeelings,
  pickFeeling,
  windUpStarts,
} from "./feelings";
import { runInk, storyHasKnot } from "./ink";
import { burstDamage, levelForXp, statsForCommand } from "./levels";
import { battleParty, restingParty } from "./party";
import { nextRandom } from "./random";
import { inkFacts, sendHome } from "./roam";
import {
  answerFeeling,
  battleCalmXp,
  battleCommands,
  battleView,
  calmLimit,
  critterSideCommand,
  fluteAssistFriends,
  inTalkMode,
  nextCommand,
  nextSparkle,
  revealCharacters,
  taggedGrade,
  talkContent,
  talkLine,
  togetherCalm,
  totalTreatCount,
  treatTrayItems,
  type TextSpeed,
} from "./battle-view";

export { battleCommands, battleView, revealCharacters, totalTreatCount, type TextSpeed };

/*
 * The story hears about every calm (spec 7): after a battle ends in a calm,
 * the core runs the story's `on_calm` knot, if it has one, with the facts as
 * they are now. The knot only updates variables (the clubhouse garden counts
 * calms); one that prints a line or offers a choice changes nothing.
 */
export const CALM_HOOK = "on_calm";

const ADVANCE_PHASES = new Set<Battle["phase"]>([
  "intro", "result", "burst", "burstResult", "fizzle", "run", "soothed", "reward", "rest",
]);

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

function battleMessage(
  battle: Battle,
  text: string,
  phase: Battle["phase"],
): Battle {
  return { ...battle, phase, message: text, revealed: 0, phaseTicks: 0 };
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

function closeTreatMenu(battle: Battle): Battle {
  const { treatMenu: _menu, treatSelected: _selected, ...rest } = battle;
  return rest;
}

// A turn passes: every resting friend is one turn closer to ready. Entries at
// zero are dropped, so "missing" is the only way to spell "ready".
function restTurn(rest: Battle["rest"]): Battle["rest"] {
  return Object.fromEntries(
    Object.entries(rest).flatMap(([id, turns]) => (turns > 1 ? [[id, turns - 1]] : [])),
  );
}

function applyPlainSnack(
  world: World,
  state: State,
  nextBase: State,
  battle: Battle,
  critter: Critter,
  answered: boolean,
  windUp: Battle["windUp"],
): State {
  const message = battleMessage(battle, critter.lines.snack, "result");
  return {
    ...nextBase,
    snacks: state.snacks - 1,
    battle: {
      ...message,
      answered,
      windUp,
      rest: restTurn(battle.rest),
      energy: Math.min(critter.energyMax, battle.energy + critter.commands.snack.energy),
      calm: Math.min(
        calmLimit(critter),
        battle.calm + critter.commands.snack.calm + (answered ? world.battle.feelingBonus : 0),
      ),
    },
  };
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

function afterCalm(world: World, state: State): State {
  if (!storyHasKnot(world.story, CALM_HOOK)) return state;
  const result = runInk(
    world.story,
    state.ink,
    { type: "start", knot: CALM_HOOK },
    inkFacts(world, state),
  );
  return result.line === null && result.choices.length === 0 && result.ended
    ? { ...state, ink: result.ink }
    : state;
}

function revealBattleInstant(state: State, instant: boolean): State {
  if (!instant || state.battle === null) return state;
  const battle = state.battle;
  const talk = battle.talk;
  return {
    ...state,
    battle: {
      ...battle,
      revealed: battle.message.length,
      ...(talk !== null && talk !== undefined
        ? { talk: { ...talk, revealed: talk.text.length } }
        : {}),
    },
  };
}

export function startBattle(
  world: World,
  state: State,
  critter: Critter,
  wildTouch?: Wild,
  player: Point = state.player,
  textSpeed?: TextSpeed,
): Battle {
  // Meeting a recurring critter (Milestone 51): one of a species Fae knows
  // well calms at once, soothed and paid; else whoever got the jump shows
  // in the opening. A set piece always opens plainly.
  const friend = wildTouch !== undefined && oldFriend(world, state, critter);
  const jump = wildTouch === undefined
    ? "even"
    : firstTouch(wildTouch, world.tunables.roam, state.player, player);
  const named = (line: string): string => line.replace("{name}", critter.name);
  const { firstTouch: touchContent, oldFriends } = world.battle;
  const message = friend
    ? named(oldFriends.line)
    : jump === "even"
      ? critter.lines.intro
      : named(touchContent.lines[jump]);
  return {
    critterId: critter.id,
    den: wildTouch?.den ?? null,
    entry: { ...state.player },
    phase: friend ? "soothed" : "intro",
    message,
    revealed: textSpeed === "instant" ? message.length : 0,
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
}

export function stepBattle(
  world: World,
  state: State,
  input: ActionFrame,
  gentleTiming = false,
  textSpeed?: TextSpeed,
): State {
  const next = stepBattleInner(world, state, input, gentleTiming, textSpeed);
  return revealBattleInstant(next, textSpeed === "instant");
}

function stepBattleInner(
  world: World,
  state: State,
  input: ActionFrame,
  gentleTiming: boolean,
  textSpeed: TextSpeed | undefined,
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
    if (talk.revealed < talk.text.length) {
      const revealed = confirm
        ? talk.text.length
        : revealCharacters(world, textSpeed, talk.revealed, talk.text.length);
      return { ...nextBase, battle: { ...next, talk: { ...talk, revealed } } };
    }
    const count = talk.choices.length;
    const tapped = input.choose !== undefined && input.choose >= 0 && input.choose < count
      ? input.choose
      : undefined;
    const chosen = tapped ?? (confirm && count > 0 ? talk.selected : undefined);
    if (chosen !== undefined) {
      const result = runInk(
        world.story,
        state.ink,
        { type: "choose", index: chosen },
        inkFacts(world, state),
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
          calm: completedTalk
            ? critter.calmMax
            : Math.min(calmLimit(critter), next.calm + amount),
          lastGrade: grade,
        },
      };
    }
    if (count > 0) {
      const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
      const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
      if (up || down) {
        const selected = (talk.selected + (down ? 1 : -1) + count) % count;
        return { ...nextBase, battle: { ...next, talk: { ...talk, selected } } };
      }
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
  if (next.revealed < next.message.length) {
    const revealed = confirm
      ? next.message.length
      : revealCharacters(world, textSpeed, next.revealed, next.message.length);
    return { ...nextBase, battle: { ...next, revealed } };
  }
  if (ADVANCE_PHASES.has(next.phase)) {
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
    } else if (next.phase === "result") {
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
    } else if (next.phase === "burst") {
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
    } else if (next.phase === "burstResult" && next.energy <= 0)
      next = moveOn(next, critter.lines.rest, "rest");
    else if (next.phase === "burstResult" || next.phase === "fizzle")
      return nextTurn(world, nextBase, next, critter);
    else if (next.phase === "soothed") {
      // Every calm pays; the sticker comes once per species (spec 8).
      const fresh = !state.stickers.includes(critter.sticker.id);
      const xp = battleCalmXp(world, critter);
      const rawLine = (fresh ? world.battle.rewards.sticker : world.battle.rewards.coins)
        .replace("{sticker}", critter.sticker.name)
        .replace("{coins}", String(critter.coins));
      const line = `${rawLine.replace(/[.!]$/, "")}, +${xp} XP!`;
      next = {
        ...battleMessage(next, line, "reward"),
        rewardSticker: fresh ? critter.sticker.id : null,
      };
    } else if (next.phase === "reward") {
      const den = next.den;
      const xp = battleCalmXp(world, critter);
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
    } else if (next.phase === "rest" && state.transition === null) {
      return {
        ...nextBase,
        battle: null,
        transition: { target: state.safeSpot, phase: "out", elapsed: 0, tone: "dark" },
      };
    }
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
      const { answered, windUp } = answerFeeling(world, next, "snack");
      const closed = closeTreatMenu(next);
      if (picked.id === "snack")
        return applyPlainSnack(world, state, nextBase, closed, critter, answered, windUp);
      const treat = world.treats.find((item) => item.id === picked.id);
      if (treat === undefined) return { ...nextBase, battle: closed };
      const isFav = treat.favourites.includes(critter.species);
      const calmGain = (isFav ? treat.favouriteCalm : treat.calm) +
        (answered ? world.battle.feelingBonus : 0);
      const message = battleMessage(closed, isFav ? treat.favouriteLine : treat.useLine, "result");
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
    if (fluteEdge && next.fluteUsed !== true && !talkActive) {
      const friends = fluteAssistFriends(world, state);
      if (friends !== null) {
        const { kind, hasPup, hasSquirrel, hasBunny } = friends;
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
        return { ...nextBase, battle: battleMessage(updated, assist.lines[kind], "command") };
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
        const updated: Battle = { ...next, calm: nextCalm, windUp, lassoUsed: true };
        if (nextCalm >= critter.calmMax)
          return {
            ...nextBase,
            battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
          };
        return { ...nextBase, battle: battleMessage(updated, assist.lines.windUp, "command") };
      }
      const updated: Battle = { ...next, calm: nextCalm, lassoUsed: true, lassoSteady: true };
      const rewardedBase = { ...nextBase, coins: state.coins + assist.coins };
      if (nextCalm >= critter.calmMax)
        return {
          ...rewardedBase,
          battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
        };
      return { ...rewardedBase, battle: battleMessage(updated, assist.lines.snag, "command") };
    }
    // Together! party sparkle finisher (spec 8): once charged, a fresh cancel
    // press launches the star chain check, pops all wind-up bubbles, and ticks
    // resting friends without resting anyone.
    const cancelEdge = input.cancel && !state.previousInput.cancel;
    if (cancelEdge && !talkActive && battleParty(world, state.party).length >= 2 &&
        (next.sparkle ?? 0) >= world.battle.together.chargeMax) {
      const going = next.windUp;
      const windUp = going === null ? null : { ...going, popped: going.popped.map(() => true) };
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
      if (chosen !== undefined && !chosen.disabled) next = { ...next, selected: input.choose };
      else return { ...nextBase, battle: next };
    }
    const up = input.move.y < -0.5 && state.previousInput.move.y >= -0.5;
    const down = input.move.y > 0.5 && state.previousInput.move.y <= 0.5;
    if (up || down)
      return {
        ...nextBase,
        battle: { ...next, selected: nextCommand(next.selected, down ? 1 : -1, commands) },
      };
    if (!confirm && input.choose === undefined) return { ...nextBase, battle: next };
    const chosen = commands[next.selected];
    if (chosen === undefined || chosen.disabled) return { ...nextBase, battle: next };
    if (chosen.id === "run")
      return { ...nextBase, battle: battleMessage(next, critter.lines.run, "run") };
    if (chosen.id === "talk" && critter.talk !== null) {
      const content = talkContent(critter);
      const turn = next.talkTurns ?? 0;
      const knot = content.knots[turn];
      if (knot === undefined)
        throw new Error(`Talk turn ${turn} is out of range for ${critter.id}`);
      const result = runInk(
        world.story,
        state.ink,
        { type: "start", knot },
        inkFacts(world, state),
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
    if (chosen.id === "snack") {
      if (totalTreatCount(state.treats) > 0)
        return { ...nextBase, battle: { ...next, treatMenu: true, treatSelected: 0 } };
      const { answered, windUp } = answerFeeling(world, next, chosen.id);
      return applyPlainSnack(world, state, nextBase, next, critter, answered, windUp);
    }
    const friend = critter.commands.friends[chosen.id];
    const partyOwner = state.party.find(
      (member) => world.party[member.id]?.command?.id === chosen.id,
    );
    const friendContent = partyOwner === undefined ? undefined : world.party[partyOwner.id];
    const baseSpec = friendContent?.command?.check ?? world.battle.commands.soothe.check;
    const spec = gentleTiming ? gentleCheckSpec(baseSpec) : baseSpec;
    const rest = friend === undefined
      ? restTurn(next.rest)
      : { ...restTurn(next.rest), [chosen.id]: friend.rest };
    return {
      ...nextBase,
      battle: startCheck(
        { ...next, command: chosen.id, answered: false, rest },
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
            { ...ended, calm, lastGrade: result },
            world.battle.together.lines[result],
            "result",
          ),
        };
      }
      const command = critterSideCommand(critter, next.command);
      const owner = next.command === null ? undefined : state.party.find((member) =>
        world.party[member.id]?.command?.id === next.command);
      const actorStats = statsForCommand(
        world.levels,
        next.command ?? "soothe",
        levelForXp(world.levels, owner?.xp ?? state.xp),
      );
      const bonus = result === "great"
        ? command.numbers.great
        : result === "good"
          ? command.numbers.good
          : 0;
      // Missing a critter-side timing check deals 0 calm and leaves feelings /
      // wind-up bubbles unpopped; landed checks (great or good) apply feeling
      // answers and calm gain.
      const resolved = result === "miss"
        ? { answered: false, windUp: next.windUp }
        : answerFeeling(world, next, next.command ?? "soothe");
      const calm = result === "miss"
        ? next.calm
        : Math.min(
            calmLimit(critter),
            next.calm + (next.command === "soothe" || next.command === null
              ? actorStats.power : command.numbers.calm) +
              (bonus > 0 ? actorStats.magic : 0) +
              (resolved.answered ? world.battle.feelingBonus : 0),
          );
      const sparkle = nextSparkle(world, state, next, result, false);
      const { sparkle: _oldSparkle, ...withoutSparkle } = ended;
      return {
        ...nextBase,
        battle: battleMessage(
          {
            ...withoutSparkle,
            ...(sparkle === undefined ? {} : { sparkle }),
            answered: resolved.answered,
            windUp: resolved.windUp,
            calm,
            lastGrade: result,
          },
          command.lines[result],
          "result",
        ),
      };
    }
    const baseDamage = burstDamage(
      world.levels,
      critter.id,
      result,
      check.big,
      statsForCommand(world.levels, "soothe", levelForXp(world.levels, state.xp)).guard,
    );
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
