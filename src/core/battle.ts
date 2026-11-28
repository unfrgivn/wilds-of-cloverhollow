import type {
  ActionFrame, Battle, CheckSide, CheckSpec, Critter, Direction, FeelingId, Point, State, Wild,
  World,
} from "./types";
import {
  addTreat, applyPlainSnack, battleMessage, consumeTreat, moveOn, purchaseTreat, restTurn,
  stepFluteAssist, stepLassoAssist, stepTalkPhase, stepTreatMenu,
} from "./battle-assists";
import {
  activeFoeIndices, activeTargetIndex, advanceMultiFoeTurn, allFoesSoothed, applyMultiFoeReward,
  applySkillToFoes, battleEnergyMax, buildFormationBattle, creditBattlePartyXp, cycleTargetIndex,
  formationById, formationRewards, initMultiFoeFeelings, resolveBiomeFormation,
  resolveDualComboCheck, syncBattleTarget, updateTargetFoe,
} from "./battle-formations";
import {
  activeBlessingEffects, applyBlessingCheckSpec, applyCalmSparkleBonus, effectiveRoamTunables,
} from "./blessings";
import { isBossPhase2, upgradeBossPhase2Check } from "./boss-ai";
import { dualComboById, isDualComboCommand } from "./combos";
import {
  checkDraws, createCheck, echoNoteFromEdge, gentleCheckSpec, laneFromStick, leanFromStick,
  pickFromDraw, stepCheck,
} from "./checks";
import { firstTouch, oldFriend } from "./encounter";
import {
  applyEncoreCheckSpec, encoreExitState, encoreFeelingBonus, encoreSoothedBattle,
  encoreVictoryState, encoreWindUpSpec, hasEncoreModifier, withEncoreTalkInk,
} from "./encore";
import {
  feelingFromDraw, feelingsOn, openFeelings, pickFeeling, windUpStarts,
} from "./feelings";
import { runInk, storyHasKnot } from "./ink";
import { burstDamage, levelForXp, statsForCommand } from "./levels";
import { battleParty, restingParty } from "./party";
import { nextRandom } from "./random";
import { inkFacts, sendHome } from "./roam";
import {
  activeBattleActor, answerFeeling, battleCalmXp, battleCommands, battleTurnRoster, battleView,
  calmLimit, critterSideCommand, inTalkMode, nextCommand, nextSparkle, recoverMessage,
  revealCharacters, talkContent, talkLine, togetherCalm, totalTreatCount, type TextSpeed,
} from "./battle-view";

export {
  activeBattleActor, addTreat, battleCommands, battleTurnRoster, battleView, consumeTreat,
  purchaseTreat, revealCharacters, totalTreatCount, type TextSpeed,
};

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

function firstEnabledCommand(commands: ReturnType<typeof battleCommands>): number {
  const index = commands.findIndex((command) => !command.disabled);
  return index >= 0 ? index : 0;
}

// A new turn (spec 8). A wind-up puffs on, or starts on its turn with its
// bubbles drawn while the feelings wait; otherwise the feelings move up one
// and one more is drawn.
function nextTurn(world: World, state: State, battle: Battle, critter: Critter): State {
  const turn = battle.turn + 1;
  const talk = critter.talk;
  const talkMode = talk !== null && battle.calm >= talk.talkAt;
  if (talkMode && talk === null) throw new Error(`Critter ${critter.id} has no Talk content`);
  const roster = battleTurnRoster(world, state);
  const actorIndex = talkMode || battle.turn === 0
    ? 0
    : ((battle.actorIndex ?? 0) + 1) % roster.length;
  const label = talkMode ? talk.prompt : critter.lines.command;
  const fresh: Battle = {
    ...moveOn(battle, label, "command"),
    turn,
    actorIndex,
    answered: false,
    talkMode,
  };
  const withSelected = (nextBattle: Battle): Battle => ({
    ...nextBattle,
    selected: firstEnabledCommand(battleCommands(world, { ...state, battle: nextBattle })),
  });
  if (talkMode)
    return { ...state, battle: withSelected({ ...fresh, feelings: [], windUp: null }) };
  // After a caught opening's burst, turn 1's feelings are the first drawn.
  if (battle.turn === 0) return { ...state, battle: withSelected(fresh) };
  if (fresh.foes !== undefined) {
    const advanced = advanceMultiFoeTurn(world, state, fresh, turn);
    return {
      ...advanced.state,
      battle: withSelected({ ...advanced.battle, message: advanced.message }),
    };
  }
  const going = battle.windUp;
  if (going !== null && going.left > 1)
    return {
      ...state,
      battle: withSelected({
        ...fresh,
        message: critter.windUp?.lines.puffing ?? critter.lines.command,
        windUp: { ...going, left: going.left - 1 },
      }),
    };
  const effectiveWindUp = encoreWindUpSpec(critter.windUp, battle.encore?.modifiers ?? []);
  if (effectiveWindUp !== null && windUpStarts(effectiveWindUp, turn)) {
    const [feelings, rolled] = drawWindUp(world, state, critter, effectiveWindUp.bubbles);
    if (feelings.length > 0)
      return {
        ...rolled,
        battle: withSelected({
          ...fresh,
          message: effectiveWindUp.lines.start,
          windUp: { feelings, popped: feelings.map(() => false), left: feelings.length },
        }),
      };
  }
  const [drawn, rolled] = battle.feelings.length === 0
    ? [[], state]
    : drawFeelings(world, state, critter, 1);
  return {
    ...rolled,
    battle: withSelected({
      ...fresh,
      windUp: null,
      feelings: [...battle.feelings.slice(1), ...drawn],
    }),
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
  const runOnce = (current: State): State => {
    const result = runInk(
      world.story,
      current.ink,
      { type: "start", knot: CALM_HOOK },
      inkFacts(world, current),
    );
    return result.line === null && result.choices.length === 0 && result.ended
      ? { ...current, ink: result.ink }
      : current;
  };
  let next = runOnce(state);
  const boost = activeBlessingEffects(world, next).gardenGrowthBoost;
  for (let extra = 0; extra < boost; extra += 1) {
    if (
      world.storyVariable(next.ink, "garden_planted") === true &&
      world.storyVariable(next.ink, "garden_ripe") !== true
    ) {
      next = runOnce(next);
    }
  }
  return next;
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

export function startFormationBattle(
  world: World,
  state: State,
  formationIdOrCritterIds: string | readonly string[],
  textSpeed?: TextSpeed,
): Battle {
  if (typeof formationIdOrCritterIds === "string") {
    const formation = formationById(formationIdOrCritterIds);
    if (formation === null) {
      throw new Error(`Unknown battle formation: ${formationIdOrCritterIds}`);
    }
    return buildFormationBattle(world, state, formation.critterIds, {
      formationId: formation.id,
      title: formation.title,
      signatureBurst: formation.signatureBurst,
      bigSignatureBurst: formation.bigSignatureBurst,
      instantText: textSpeed === "instant",
    });
  }
  return buildFormationBattle(world, state, formationIdOrCritterIds, {
    instantText: textSpeed === "instant",
  });
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
    : firstTouch(wildTouch, effectiveRoamTunables(world, state), state.player, player);
  const formation = friend ? null : resolveBiomeFormation(world, state, critter, wildTouch);
  if (formation !== null) {
    const ordered = [critter.id, ...formation.critterIds.filter((id) => id !== critter.id)];
    return buildFormationBattle(world, state, ordered, {
      den: wildTouch?.den ?? null,
      entry: state.player,
      formationId: formation.id,
      title: formation.title,
      signatureBurst: formation.signatureBurst,
      bigSignatureBurst: formation.bigSignatureBurst,
      surpriseCalm: jump === "surprised" ? world.battle.firstTouch.surprise : undefined,
      turn: jump === "caught" ? 0 : 1,
      instantText: textSpeed === "instant",
    });
  }
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
    actorIndex: 0,
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
    return stepTalkPhase(
      world, state, nextBase, next, critter, input, confirm, textSpeed, nextTurn,
    );
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
      if (next.foes !== undefined) {
        const openingMulti = next.turn === 0
          ? moveOn(next, critter.lines.burst, "burst")
          : moveOn(next, talkMode ? talkValue.prompt : critter.lines.command, "command");
        const [withFeelings, rolledMulti] = initMultiFoeFeelings(world, nextBase, {
          ...openingMulti,
          actorIndex: 0,
          talkMode,
        });
        const selectedMulti = withFeelings.phase === "command"
          ? firstEnabledCommand(battleCommands(world, { ...rolledMulti, battle: withFeelings }))
          : 0;
        return { ...rolledMulti, battle: { ...withFeelings, selected: selectedMulti } };
      }
      const [feelings, rolledFeelings] = !talkMode && feelingsOn(world, state)
        ? drawFeelings(world, nextBase, critter, 3) : [[], nextBase];
      const effWindUp = encoreWindUpSpec(critter.windUp, next.encore?.modifiers ?? []);
      const surgeStart = !talkMode && next.turn === 1 && feelingsOn(world, state) &&
        effWindUp !== null && windUpStarts(effWindUp, 1);
      const [surgeBubbles, rolled] = surgeStart && effWindUp !== null
        ? drawWindUp(world, rolledFeelings, critter, effWindUp.bubbles) : [[], rolledFeelings];
      const hasSurge = surgeStart && surgeBubbles.length > 0 && effWindUp !== null;
      const opening = next.turn === 0
        ? moveOn(next, critter.lines.burst, "burst")
        : moveOn(
            next,
            talkMode ? talkValue.prompt : hasSurge ? effWindUp.lines.start : critter.lines.command,
            "command",
          );
      const entered: Battle = {
        ...opening, actorIndex: 0, feelings: talkMode ? [] : feelings, talkMode,
        windUp: hasSurge
          ? { feelings: surgeBubbles, popped: surgeBubbles.map(() => false),
              left: surgeBubbles.length }
          : null,
      };
      const selected = entered.phase === "command"
        ? firstEnabledCommand(battleCommands(world, { ...rolled, battle: entered })) : 0;
      return { ...rolled, battle: { ...entered, selected } };
    } else if (next.phase === "result") {
      if (next.foes !== undefined) {
        if (allFoesSoothed(next.foes)) {
          next = { ...moveOn(next, critter.lines.soothed, "soothed"), windUp: null };
        } else {
          const active = syncBattleTarget(next, next.foes, activeTargetIndex(next, next.foes));
          const activeCritter = world.critters[active.critterId] ?? critter;
          const going = active.windUp;
          if (going !== null && going.left > 1) {
            return nextTurn(world, nextBase, active, activeCritter);
          }
          if (going !== null && going.popped.every((popped) => popped)) {
            const fizzled = updateTargetFoe(active, { windUp: null });
            next = {
              ...moveOn(
                fizzled,
                activeCritter.windUp?.lines.fizzle ?? activeCritter.lines.burst,
                "fizzle",
              ),
              windUp: null,
            };
          } else next = moveOn(active, activeCritter.lines.burst, "burst");
        }
      } else {
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
    } else if (next.phase === "burst") {
      const letGo = next.windUp;
      const [roll, afterRoll]: [number, State] =
        letGo === null ? nextRandom(nextBase) : [1, nextBase];
      const rolledBig = letGo === null
        ? roll < critter.burst.bigChance
        : letGo.popped.every((popped) => !popped);
      const steady = next.lassoSteady === true;
      const big = steady ? false : rolledBig;
      const regularBurst = next.signatureBurst ?? critter.burst.check;
      const bigBurst = next.bigSignatureBurst ?? next.signatureBurst ??
        critter.burst.big ?? critter.burst.check;
      const rawSpec = big ? bigBurst : regularBurst;
      const phasedSpec = isBossPhase2(critter, next.calm, next.phase, inTalkMode(next, critter))
        ? upgradeBossPhase2Check(rawSpec, critter.id)
        : rawSpec;
      const encoreSpec = applyEncoreCheckSpec(
        phasedSpec, next.encore?.modifiers ?? [], gentleTiming,
      );
      const spec = applyBlessingCheckSpec(encoreSpec, activeBlessingEffects(world, state));
      let rolled = afterRoll;
      const picks: number[] = [];
      for (let item = 0; item < checkDraws(spec); item += 1) {
        const [value, after] = nextRandom(rolled);
        picks.push(pickFromDraw(spec, value));
        rolled = after;
      }
      const { lassoSteady: _lassoSteady, ...withoutSteady } = next;
      const cleared = steady ? withoutSteady : next;
      const withClearedWindUp = cleared.foes === undefined
        ? cleared
        : updateTargetFoe(cleared, { windUp: null });
      return {
        ...rolled,
        battle: {
          ...startCheck(withClearedWindUp, "fae", spec, big, picks),
          windUp: null,
        },
      };
    } else if (next.phase === "burstResult" && next.energy <= 0)
      next = moveOn(next, critter.lines.rest, "rest");
    else if (next.phase === "burstResult" || next.phase === "fizzle")
      return nextTurn(world, nextBase, next, critter);
    else if (next.phase === "soothed") {
      const encoreNext = encoreSoothedBattle(state, next);
      if (encoreNext !== null) next = encoreNext;
      else if (next.foes !== undefined) {
        const rewards = formationRewards(world, state, next.foes);
        const fresh = rewards.primaryStickerName !== null;
        const rawLine = (fresh ? world.battle.rewards.sticker : world.battle.rewards.coins)
          .replace("{sticker}", rewards.primaryStickerName ?? critter.sticker.name)
          .replace("{coins}", String(rewards.coins));
        const line = `${rawLine.replace(/[.!]$/, "")}, +${rewards.xp} XP!`;
        next = {
          ...battleMessage(next, line, "reward"),
          rewardSticker: rewards.newStickers[0] ?? null,
        };
      } else {
        // Every calm pays; the sticker comes once per species (spec 8).
        const fresh = !state.stickers.includes(critter.sticker.id);
        const xp = battleCalmXp(world, critter);
        const coinsReward = critter.coins + activeBlessingEffects(world, state).jubileeCoinBonus;
        const rawLine = (fresh ? world.battle.rewards.sticker : world.battle.rewards.coins)
          .replace("{sticker}", critter.sticker.name)
          .replace("{coins}", String(coinsReward));
        const line = `${rawLine.replace(/[.!]$/, "")}, +${xp} XP!`;
        next = {
          ...battleMessage(next, line, "reward"),
          rewardSticker: fresh ? critter.sticker.id : null,
        };
      }
    } else if (next.phase === "reward") {
      const encoreWon = encoreVictoryState(nextBase, state, next);
      if (encoreWon !== null) return encoreWon;
      if (next.foes !== undefined) {
        return afterCalm(world, applyMultiFoeReward(world, state, nextBase, next));
      }
      const den = next.den;
      const xp = battleCalmXp(world, critter);
      const coinsReward = critter.coins + activeBlessingEffects(world, state).jubileeCoinBonus;
      return afterCalm(world, {
        ...nextBase,
        ...(den === null
          ? { critters: { ...state.critters, [next.critterId]: "calm" } }
          : { wild: state.wild.map((item) =>
              item.den === den ? { ...item, mood: "calm" } : item) }),
        coins: state.coins + coinsReward,
        xp: state.xp + xp,
        party: creditBattlePartyXp(world, state, next.command, xp),
        calms: { ...state.calms, [critter.species]: (state.calms[critter.species] ?? 0) + 1 },
        stickers: next.rewardSticker === null
          ? state.stickers
          : [...state.stickers, next.rewardSticker],
        battle: null,
      });
    } else if (next.phase === "run") {
      const encoreExit = encoreExitState(nextBase, next);
      if (encoreExit !== null) return encoreExit;
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
      const encoreExit = encoreExitState(nextBase, next);
      if (encoreExit !== null) return encoreExit;
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
      return stepTreatMenu(world, state, nextBase, next, critter, input, confirm);
    }
    const lanternEdge = input.lantern === true && state.previousInput.lantern !== true;
    if (lanternEdge && !next.lanternPeek && next.feelings.length > 0 && next.windUp === null &&
        world.storyVariable(state.ink, "has_lantern") === true)
      return { ...nextBase, battle: { ...next, lanternPeek: true } };
    const talkActive = inTalkMode(next, critter);
    const fluteEdge = input.flute === true && state.previousInput.flute !== true;
    if (fluteEdge && next.fluteUsed !== true && !talkActive) {
      const assisted = stepFluteAssist(world, state, nextBase, next, critter);
      if (assisted !== null) return assisted;
    }
    const lassoEdge = input.lasso === true && state.previousInput.lasso !== true;
    if (lassoEdge && next.lassoUsed !== true && !talkActive && (next.talk ?? null) === null &&
        world.storyVariable(state.ink, "has_lasso") === true) {
      return stepLassoAssist(world, state, nextBase, next, critter);
    }
    // Multi-critter target cycling (Track E7): Left/Right or direct `input.target`.
    if (!talkActive && next.foes !== undefined && activeFoeIndices(next.foes).length >= 2) {
      const currentTarget = activeTargetIndex(next, next.foes);
      if (
        input.target !== undefined &&
        input.target !== currentTarget &&
        next.foes[input.target]?.soothed === false
      ) {
        return { ...nextBase, battle: syncBattleTarget(next, next.foes, input.target) };
      }
      const leftEdge = input.move.x < -0.5 && state.previousInput.move.x >= -0.5;
      const rightEdge = input.move.x > 0.5 && state.previousInput.move.x <= 0.5;
      if (leftEdge || rightEdge) {
        const nextTarget = cycleTargetIndex(next.foes, currentTarget, rightEdge ? 1 : -1);
        return { ...nextBase, battle: syncBattleTarget(next, next.foes, nextTarget) };
      }
    }
    const cancelEdge = input.cancel && !state.previousInput.cancel;
    if (cancelEdge && !talkActive && battleParty(world, state.party).length >= 2 &&
        (next.sparkle ?? 0) >= world.battle.together.chargeMax) {
      const going = next.windUp;
      const windUp = going === null ? null : { ...going, popped: going.popped.map(() => true) };
      const poppedFoes = next.foes?.map((foe) =>
        foe.windUp === null
          ? foe
          : { ...foe, windUp: { ...foe.windUp, popped: foe.windUp.popped.map(() => true) } },
      );
      const baseSpec = world.battle.together.check;
      const encoreSpec = applyEncoreCheckSpec(baseSpec, next.encore?.modifiers ?? [], gentleTiming);
      const spec = applyBlessingCheckSpec(encoreSpec, activeBlessingEffects(world, state));
      const { sparkle: _sparkle, ...withoutSparkle } = next;
      return {
        ...nextBase,
        battle: startCheck(
          {
            ...withoutSparkle,
            ...(poppedFoes === undefined ? {} : { foes: poppedFoes }),
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
    if (chosen.id === "recover") {
      const actor = activeBattleActor(world, { ...state, battle: next });
      const nextRest = restTurn(next.rest);
      const ownCmdId = actor.id === "fae" ? undefined : world.party[actor.id]?.command?.id;
      if (ownCmdId !== undefined) delete nextRest[ownCmdId];
      const healBonus = activeBlessingEffects(world, state).snackHealBonus;
      return {
        ...nextBase,
        battle: {
          ...moveOn(next, recoverMessage(actor), "result"),
          command: "recover",
          answered: false,
          rest: nextRest,
          energy: Math.min(battleEnergyMax(world, next, critter), next.energy + 1 + healBonus),
        },
      };
    }
    if (chosen.id === "talk" && critter.talk !== null) {
      const content = talkContent(critter);
      const turn = next.talkTurns ?? 0;
      const knot = content.knots[turn];
      if (knot === undefined)
        throw new Error(`Talk turn ${turn} is out of range for ${critter.id}`);
      const result = runInk(
        world.story, next.encore?.talkInk ?? state.ink, { type: "start", knot },
        inkFacts(world, state),
      );
      const synced = withEncoreTalkInk(next, result.ink);
      return {
        ...nextBase,
        ink: synced.preserveStoryInk ? state.ink : result.ink,
        battle: {
          ...synced.battle,
          phase: "talk", message: "", revealed: 0,
          talk: {
            ...talkLine(result, {
              knot, turn, speaker: null, text: "", revealed: 0, choices: [], selected: 0,
              ended: false, grade: null,
            }),
            knot, turn,
          },
          check: null, feelings: [], windUp: null, talkMode: true,
          talkTurns: turn + 1, phaseTicks: 0,
        },
      };
    }
    if (chosen.id === "snack") {
      if (hasEncoreModifier(next, "pure-heart")) return { ...nextBase, battle: next };
      if (totalTreatCount(state.treats) > 0)
        return { ...nextBase, battle: { ...next, treatMenu: true, treatSelected: 0 } };
      const { answered, windUp } = answerFeeling(world, next, chosen.id);
      return applyPlainSnack(world, state, nextBase, next, critter, answered, windUp);
    }
    if (isDualComboCommand(chosen.id)) {
      const combo = dualComboById(chosen.id);
      if (combo !== null) {
        const remainingSparkle = Math.max(0, (next.sparkle ?? 0) - combo.cost);
        const { sparkle: _sparkle, ...withoutSparkle } = next;
        const spec = gentleTiming ? gentleCheckSpec(combo.check) : combo.check;
        return {
          ...nextBase,
          battle: startCheck(
            {
              ...withoutSparkle,
              ...(remainingSparkle > 0 ? { sparkle: remainingSparkle } : {}),
              command: combo.id,
              answered: false,
              rest: restTurn(next.rest),
            },
            "critter",
            spec,
          ),
        };
      }
    }
    const friend = critter.commands.friends[chosen.id];
    const partyOwner = state.party.find(
      (member) => world.party[member.id]?.command?.id === chosen.id,
    );
    const friendContent = partyOwner === undefined ? undefined : world.party[partyOwner.id];
    const baseSpec = friendContent?.command?.check ?? world.battle.commands.soothe.check;
    const encoreSpec = applyEncoreCheckSpec(baseSpec, next.encore?.modifiers ?? [], gentleTiming);
    const spec = applyBlessingCheckSpec(encoreSpec, activeBlessingEffects(world, state));
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
      previousMove: state.previousInput.move,
      choose: input.choose,
      pointer: input.pointer,
      echoNote: echoNoteFromEdge(state.previousInput.move, input.move),
    });
    const result = stepped.grade;
    const ended = { ...next, check: stepped.check };
    if (result === null) return { ...nextBase, battle: ended };
    if (check.side === "critter") {
      const sparkleBonus = activeBlessingEffects(world, state).calmSparkleBonus;
      if (isDualComboCommand(next.command)) {
        const combo = dualComboById(next.command);
        if (combo !== null) {
          return resolveDualComboCheck(world, state, nextBase, ended, critter, combo, result);
        }
      }
      if (next.command === "together") {
        const gain = applyCalmSparkleBonus(togetherCalm(world, state, result), sparkleBonus);
        if (ended.foes !== undefined) {
          const targetIdx = activeTargetIndex(ended, ended.foes);
          const applied = applySkillToFoes(world, ended.foes, targetIdx, "together", gain, result);
          const synced = syncBattleTarget(ended, applied.foes, targetIdx, false);
          return {
            ...nextBase,
            battle: battleMessage(
              { ...synced, lastGrade: result },
              world.battle.together.lines[result],
              "result",
            ),
          };
        }
        const calm = Math.min(calmLimit(critter), next.calm + gain);
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
      const resolved = result === "miss"
        ? { answered: false, windUp: next.windUp }
        : answerFeeling(world, next, next.command ?? "soothe");
      const rawCalmGain = (next.command === "soothe" || next.command === null
        ? actorStats.power : command.numbers.calm) +
        (bonus > 0 ? actorStats.magic : 0) +
        (resolved.answered ? encoreFeelingBonus(world, next) : 0);
      const primaryGain = result === "miss"
        ? 0
        : applyCalmSparkleBonus(rawCalmGain, sparkleBonus);
      const sparkle = nextSparkle(world, state, next, result, false);
      const { sparkle: _oldSparkle, ...withoutSparkle } = ended;
      if (ended.foes !== undefined) {
        const targetIdx = activeTargetIndex(ended, ended.foes);
        const withWindUp = ended.foes.map((foe, idx) =>
          idx === targetIdx ? { ...foe, windUp: resolved.windUp } : foe);
        const applied = applySkillToFoes(
          world,
          withWindUp,
          targetIdx,
          next.command ?? "soothe",
          primaryGain,
          result,
        );
        const synced = syncBattleTarget(
          { ...withoutSparkle, ...(sparkle === undefined ? {} : { sparkle }) },
          applied.foes,
          targetIdx,
          false,
        );
        return {
          ...nextBase,
          battle: battleMessage(
            { ...synced, answered: resolved.answered, lastGrade: result },
            command.lines[result],
            "result",
          ),
        };
      }
      const calm = result === "miss"
        ? next.calm
        : Math.min(calmLimit(critter), next.calm + primaryGain);
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
