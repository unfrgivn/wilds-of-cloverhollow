import type { ActionFrame, Battle, Critter, State, World } from "./types";
import {
  activeTargetIndex,
  allFoesSoothed,
  applyFluteChorusToFoes,
  battleEnergyMax,
  syncBattleTarget,
  updateTargetFoe,
} from "./battle-formations";
import {
  answerFeeling,
  calmLimit,
  fluteAssistFriends,
  revealCharacters,
  taggedGrade,
  talkContent,
  talkLine,
  treatTrayItems,
  type TextSpeed,
} from "./battle-view";
import { activeBlessingEffects } from "./blessings";
import { encoreFeelingBonus, withEncoreTalkInk } from "./encore";
import { runInk } from "./ink";
import { battleParty } from "./party";
import { inkFacts } from "./roam";

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

export function battleMessage(
  battle: Battle,
  text: string,
  phase: Battle["phase"],
): Battle {
  return { ...battle, phase, message: text, revealed: 0, phaseTicks: 0 };
}

export function moveOn(battle: Battle, text: string, phase: Battle["phase"]): Battle {
  return { ...battleMessage(battle, text, phase), check: null, lastGrade: null };
}

export function restTurn(rest: Battle["rest"]): Battle["rest"] {
  return Object.fromEntries(
    Object.entries(rest).flatMap(([id, turns]) => (turns > 1 ? [[id, turns - 1]] : [])),
  );
}

function closeTreatMenu(battle: Battle): Battle {
  const { treatMenu: _menu, treatSelected: _selected, ...rest } = battle;
  return rest;
}

export function applyPlainSnack(
  world: World,
  state: State,
  nextBase: State,
  battle: Battle,
  critter: Critter,
  answered: boolean,
  windUp: Battle["windUp"],
): State {
  const message = battleMessage(battle, critter.lines.snack, "result");
  const calm = Math.min(
    calmLimit(critter),
    battle.calm + critter.commands.snack.calm + (answered ? encoreFeelingBonus(world, battle) : 0),
  );
  const healBonus = activeBlessingEffects(world, state).snackHealBonus;
  const updated: Battle = {
    ...message,
    answered,
    windUp,
    rest: restTurn(battle.rest),
    energy: Math.min(
      battleEnergyMax(world, battle, critter),
      battle.energy + critter.commands.snack.energy + healBonus,
    ),
    calm,
  };
  return {
    ...nextBase,
    snacks: state.snacks - 1,
    battle: battle.foes === undefined ? updated : updateTargetFoe(updated, { calm, windUp }),
  };
}

export function stepTreatMenu(
  world: World,
  state: State,
  nextBase: State,
  next: Battle,
  critter: Critter,
  input: ActionFrame,
  confirm: boolean,
): State {
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
    (answered ? encoreFeelingBonus(world, closed) : 0);
  const calm = Math.min(calmLimit(critter), closed.calm + calmGain);
  const message = battleMessage(closed, isFav ? treat.favouriteLine : treat.useLine, "result");
  const healBonus = activeBlessingEffects(world, state).snackHealBonus;
  const updated: Battle = {
    ...message,
    answered,
    windUp,
    rest: restTurn(closed.rest),
    energy: Math.min(
      battleEnergyMax(world, closed, critter), closed.energy + treat.energy + healBonus,
    ),
    calm,
  };
  return {
    ...consumeTreat(nextBase, treat.id),
    battle: closed.foes === undefined ? updated : updateTargetFoe(updated, { calm, windUp }),
  };
}

export function stepFluteAssist(
  world: World,
  state: State,
  nextBase: State,
  next: Battle,
  critter: Critter,
): State | null {
  const friends = fluteAssistFriends(world, state);
  if (friends === null) return null;
  const { kind, hasPup, hasSquirrel, hasBunny } = friends;
  const assist = world.battle.fluteAssist;
  const harmonyCalm = activeBlessingEffects(world, state).fluteAssistCalmBonus;
  const calmGain = (hasPup ? assist.pupCalm : 0) + (hasBunny ? assist.bunnyCalm : 0) + harmonyCalm;
  const energyGain = hasSquirrel ? assist.squirrelEnergy : 0;
  const softenGain = hasSquirrel ? assist.squirrelSoften : 0;
  const togetherGain = hasBunny && battleParty(world, state.party).length >= 2
    ? assist.bunnyTogether
    : 0;
  const nextEnergy = Math.min(battleEnergyMax(world, next, critter), next.energy + energyGain);
  const nextSparkleCount = togetherGain > 0
    ? Math.min(world.battle.together.chargeMax, (next.sparkle ?? 0) + togetherGain)
    : next.sparkle;
  if (next.foes !== undefined) {
    const chorusFoes = applyFluteChorusToFoes(world, next.foes, calmGain);
    const synced = syncBattleTarget(next, chorusFoes, activeTargetIndex(next, chorusFoes));
    const updated: Battle = {
      ...synced,
      energy: nextEnergy,
      fluteUsed: true,
      ...(softenGain > 0 ? { burstSoften: (next.burstSoften ?? 0) + softenGain } : {}),
      ...(nextSparkleCount !== undefined ? { sparkle: nextSparkleCount } : {}),
    };
    if (allFoesSoothed(chorusFoes)) {
      return {
        ...nextBase,
        battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
      };
    }
    return { ...nextBase, battle: battleMessage(updated, assist.lines[kind], "command") };
  }
  const nextCalm = Math.min(calmLimit(critter), next.calm + calmGain);
  const updated: Battle = {
    ...next,
    calm: nextCalm,
    energy: nextEnergy,
    fluteUsed: true,
    ...(softenGain > 0 ? { burstSoften: (next.burstSoften ?? 0) + softenGain } : {}),
    ...(nextSparkleCount !== undefined ? { sparkle: nextSparkleCount } : {}),
  };
  if (nextCalm >= critter.calmMax) {
    return {
      ...nextBase,
      battle: { ...moveOn(updated, critter.lines.soothed, "soothed"), windUp: null },
    };
  }
  return { ...nextBase, battle: battleMessage(updated, assist.lines[kind], "command") };
}

export function stepLassoAssist(
  world: World,
  state: State,
  nextBase: State,
  next: Battle,
  critter: Critter,
): State {
  const assist = world.battle.lassoAssist;
  const nextCalm = Math.min(calmLimit(critter), next.calm + assist.calm);
  const going = next.windUp;
  const popIndex = going?.popped.findIndex((popped) => !popped) ?? -1;
  const finishLasso = (base: State, raw: Battle, line: string): State => {
    const synced = raw.foes === undefined
      ? raw
      : updateTargetFoe(raw, { calm: raw.calm, windUp: raw.windUp });
    const allCalm = synced.foes === undefined
      ? synced.calm >= critter.calmMax
      : allFoesSoothed(synced.foes);
    if (allCalm) {
      return {
        ...base,
        battle: { ...moveOn(synced, critter.lines.soothed, "soothed"), windUp: null },
      };
    }
    const ready = synced.foes === undefined
      ? synced
      : syncBattleTarget(synced, synced.foes, activeTargetIndex(synced, synced.foes));
    return { ...base, battle: battleMessage(ready, line, "command") };
  };
  if (going !== null && popIndex >= 0) {
    const windUp = {
      ...going,
      popped: going.popped.map((popped, index) => popped || index === popIndex),
    };
    return finishLasso(
      nextBase,
      { ...next, calm: nextCalm, windUp, lassoUsed: true },
      assist.lines.windUp,
    );
  }
  return finishLasso(
    { ...nextBase, coins: state.coins + assist.coins },
    { ...next, calm: nextCalm, lassoUsed: true, lassoSteady: true },
    assist.lines.snag,
  );
}

export function stepTalkPhase(
  world: World,
  state: State,
  nextBase: State,
  next: Battle,
  critter: Critter,
  input: ActionFrame,
  confirm: boolean,
  textSpeed: TextSpeed | undefined,
  onNextTurn: (world: World, state: State, battle: Battle, critter: Critter) => State,
): State {
  const talk = next.talk;
  if (talk === undefined || talk === null) return { ...nextBase, battle: next };
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
      next.encore?.talkInk ?? state.ink,
      { type: "choose", index: chosen },
      inkFacts(world, state),
    );
    const grade = taggedGrade(result);
    const amount = grade === null ? 0 : talkContent(critter).calm[grade];
    const completedTalk = talk.turn === talkContent(critter).knots.length - 1;
    const updated = { ...talkLine(result, talk), knot: talk.knot, turn: talk.turn, grade };
    const synced = withEncoreTalkInk(next, result.ink);
    return {
      ...nextBase,
      ink: synced.preserveStoryInk ? state.ink : result.ink,
      battle: {
        ...synced.battle,
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
  const result = runInk(
    world.story, next.encore?.talkInk ?? state.ink, { type: "next" }, inkFacts(world, state),
  );
  const synced = withEncoreTalkInk(next, result.ink);
  const nextState = { ...nextBase, ink: synced.preserveStoryInk ? state.ink : result.ink };
  if (result.line !== null || result.choices.length > 0)
    return { ...nextState, battle: { ...synced.battle, talk: talkLine(result, talk) } };
  const completed = { ...synced.battle, talk: null, lastGrade: talk.grade };
  if (completed.calm >= critter.calmMax) {
    return {
      ...nextState,
      battle: moveOn({ ...completed, talkMode: false }, critter.lines.soothed, "soothed"),
    };
  }
  return onNextTurn(world, nextState, { ...completed, phase: "command" }, critter);
}
