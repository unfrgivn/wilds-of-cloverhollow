import type {
  Battle,
  BattleFoeView,
  BattleView,
  Critter,
  FeelingId,
  FluteAssistKind,
  Grade,
  State,
  TreatTrayItem,
  World,
} from "./types";
import {
  activeTargetIndex,
  battleEnergyMax,
  battleFoes,
  commandTargetScope,
} from "./battle-formations";
import { bossPhase2View, resolveEnemyIntent } from "./boss-ai";
import { checkHint, viewCheck } from "./checks";
import { availableDualCombos, dualComboById, isDualComboCommand } from "./combos";
import { encoreFeelingBonus, hasEncoreModifier } from "./encore";
import { answers, bubbleAnswered } from "./feelings";
import type { runInk } from "./ink";
import { calmExperience, levelForXp, statsForCommand } from "./levels";
import { battleParty } from "./party";

export type TextSpeed = "cozy" | "brisk" | "instant";

export type FluteAssistFriends = {
  kind: FluteAssistKind;
  hasPup: boolean;
  hasSquirrel: boolean;
  hasBunny: boolean;
};

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

export function recoverMessage(actor: { id: string; name: string }): string {
  if (actor.id === "fae") return "Fae takes a slow, steady breath and catches her energy.";
  if (actor.id === "maddie") return "Maddie curls up for a quick stretch, tail wagging again!";
  if (actor.id === "sue") return "Sue reels in her line and takes a calm breath.";
  if (actor.id === "jordan") return "Jordan gathers his pinecones and shakes out his hands.";
  return `${actor.name} takes a calm breath and regains energy.`;
}

export function restTurn(rest: Battle["rest"]): Battle["rest"] {
  return Object.fromEntries(
    Object.entries(rest).flatMap(([id, turns]) => (turns > 1 ? [[id, turns - 1]] : [])),
  );
}

export function inTalkMode(battle: Battle, critter: Critter): boolean {
  return battle.talkMode === true ||
    (battle.talk !== undefined && battle.talk !== null) ||
    (critter.talk !== null && battle.calm >= critter.talk.talkAt);
}

export function talkContent(critter: Critter): NonNullable<Critter["talk"]> {
  if (critter.talk === null) throw new Error(`Critter ${critter.id} has no Talk content`);
  return critter.talk;
}

// A kind with Talk content cannot be soothed by ordinary commands before its
// questions are answered. The final graded answer is the only thing that may
// fill the last point of its meter.
export function calmLimit(critter: Critter): number {
  return critter.talk === null ? critter.calmMax : critter.calmMax - 1;
}

export function battleCalmXp(world: World, critter: Critter): number {
  return calmExperience(
    world.levels,
    critter.id,
    critter.windUp !== null,
    critter.id === "hooded-kid",
  );
}

// The numbers and lines a Fae-side check resolves with: a friend's
// command, or Soothe for anything else.
export function critterSideCommand(
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

export function nextSparkle(
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

export function togetherCalm(world: World, state: State, result: Grade): number {
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
  if (result === "great") return teamPower + encoreFeelingBonus(world, state.battle);
  if (result === "good") return Math.round(teamPower * 0.75);
  return Math.round(teamPower * 0.5);
}

export function answerFeeling(
  world: World,
  battle: Battle,
  commandId: string,
): { answered: boolean; windUp: Battle["windUp"] } {
  const going = battle.windUp;
  const pop = going === null ? -1 : bubbleAnswered(world, going, commandId);
  const answered = going === null ? answers(world, battle.feelings[0], commandId) : pop >= 0;
  const windUp = going === null || pop < 0
    ? going
    : { ...going, popped: going.popped.map((popped, index) => popped || index === pop) };
  return { answered, windUp };
}

export function fluteAssistKind(
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

export function fluteAssistFriends(world: World, state: State): FluteAssistFriends | null {
  if (world.storyVariable(state.ink, "has_flute") !== true) return null;
  const hasPup = world.storyVariable(state.ink, "pup_friend") === true;
  const hasSquirrel = world.storyVariable(state.ink, "squirrel_friend") === true;
  const hasBunny = world.storyVariable(state.ink, "bunny_friend") === true;
  const kind = fluteAssistKind(hasPup, hasSquirrel, hasBunny);
  if (kind === null) return null;
  return { kind, hasPup, hasSquirrel, hasBunny };
}

export function fluteAssistView(
  world: World,
  state: State,
  battle: Battle,
  critter: Critter,
): BattleView["fluteAssist"] {
  const friends = fluteAssistFriends(world, state);
  if (friends === null) return null;
  const { kind } = friends;
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

export function lassoAssistView(
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

export function treatTrayItems(world: World, state: State, critter: Critter): TreatTrayItem[] {
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

export function battleTurnRoster(
  world: World,
  state: State,
): { id: string; name: string }[] {
  return [
    { id: "fae", name: "Fae" },
    ...battleParty(world, state.party).map((member) => ({
      id: member.id,
      name: world.party[member.id]?.name ?? member.id,
    })),
  ];
}

export function activeBattleActor(
  world: World,
  state: State,
): { id: string; name: string; index: number } {
  const roster = battleTurnRoster(world, state);
  const fae = roster[0] ?? { id: "fae", name: "Fae" };
  const battle = state.battle;
  if (battle === null) return { ...fae, index: 0 };
  const critter = world.critters[battle.critterId];
  if (critter !== undefined && inTalkMode(battle, critter)) {
    return { ...fae, index: 0 };
  }
  const raw = battle.actorIndex ?? 0;
  const index = ((raw % roster.length) + roster.length) % roster.length;
  const actor = roster[index] ?? fae;
  return { ...actor, index };
}

// Per-member battle commands (spec 8): outside Talk mode, only the active
// actor's signature action (Soothe for Fae; Cast, Juggle, or Play for a party
// member) plus Recover, Snack, and Run (when `critter.canRun`).
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
  const actor = activeBattleActor(world, state);
  const memberCommand = actor.id === "fae" ? null : (world.party[actor.id]?.command ?? null);
  const primary = memberCommand === null
    ? {
        id: "soothe",
        label: world.battle.commands.soothe.label,
        detail: null,
        disabled: false,
        feeling: feeling("soothe"),
        targetScope: commandTargetScope("soothe"),
      }
    : (() => {
        const rest = battle.rest[memberCommand.id] ?? 0;
        return {
          id: memberCommand.id,
          label: memberCommand.label,
          detail: rest > 0 ? memberCommand.resting : null,
          disabled: rest > 0,
          feeling: feeling(memberCommand.id),
          targetScope: commandTargetScope(memberCommand.id),
        };
      })();
  const totalSnacks = state.snacks + totalTreatCount(state.treats);
  const pureHeart = hasEncoreModifier(battle, "pure-heart");
  const canRun = critter.canRun || battle.encore !== undefined;
  const dualCombos = availableDualCombos(world, state, battle, actor.id).map((combo) => ({
    id: combo.id,
    label: combo.label,
    detail: `★${combo.cost}`,
    disabled: false,
    feeling: null,
    combo: true,
    comboCost: combo.cost,
    comboEmblem: combo.emblem,
    targetScope: combo.targetScope,
  }));
  const runCommands: BattleView["commands"] = canRun
    ? [{
        id: "run",
        label: world.battle.commands.run.label,
        detail: battle.encore !== undefined ? "Exit dream" : null,
        disabled: false,
        feeling: null,
        targetScope: "single",
      }]
    : [];
  return [
    primary,
    {
      id: "recover",
      label: "Recover",
      detail: "+1 leaf",
      disabled: false,
      feeling: null,
      targetScope: "single",
    },
    {
      id: "snack",
      label: world.battle.commands.snack.label,
      detail: pureHeart
        ? "Pure Heart"
        : world.battle.commands.snack.snackDetail.replace("N", String(totalSnacks)),
      disabled: pureHeart || totalSnacks === 0,
      feeling: pureHeart ? null : feeling("snack"),
      targetScope: "single",
    },
    ...runCommands,
    ...dualCombos,
  ];
}

export function nextCommand(
  selected: number,
  delta: number,
  commands: BattleView["commands"],
): number {
  let result = selected;
  for (let count = 0; count < commands.length; count += 1) {
    result = (result + delta + commands.length) % commands.length;
    if (!commands[result]?.disabled) return result;
  }
  return selected;
}

export function talkLine(
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

export function taggedGrade(result: ReturnType<typeof runInk>): Grade | null {
  const tag = result.line?.tags.find((item) => /^grade:\s*(great|good|miss)\s*$/.test(item.trim()));
  const grade = tag?.trim().slice("grade:".length).trim();
  return grade === "great" || grade === "good" || grade === "miss" ? grade : null;
}

export function revealCharacters(
  world: Pick<World, "tunables">,
  textSpeed: TextSpeed | undefined,
  revealed: number,
  total: number,
): number {
  if (textSpeed === "instant") return total;
  if (textSpeed === "brisk") {
    return Math.min(total, revealed + world.tunables.interact.revealPerTick * 2.5);
  }
  return Math.min(total, revealed + world.tunables.interact.revealPerTick);
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
  const comboSpec = isDualComboCommand(battle.command) ? dualComboById(battle.command) : null;
  const hint = check === null
    ? null
    : battle.command === "together" && check.kind === "chain"
      ? (check.tick < (check.spec.arrivals[0] ?? 0) ? world.battle.together.hint : null)
      : comboSpec !== null && check.kind === "chain"
        ? (check.tick < (check.spec.arrivals[0] ?? 0) ? comboSpec.hint : null)
        : comboSpec !== null && check.kind === "ring"
          ? (check.tick < 18 ? comboSpec.hint : null)
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
  const turnActor = activeBattleActor(world, state);
  const foes = battleFoes(world, battle);
  const targetIndex = activeTargetIndex(battle, foes);
  const foeViews: BattleFoeView[] = foes.map((foe, index) => {
    const entry = world.critters[foe.critterId] ?? critter;
    const foeNow = foe.feelings[0] ?? null;
    const foeFeeling = foe.windUp === null && foeNow !== null && shown
      ? { id: foeNow, label: world.battle.feelings[foeNow].label }
      : null;
    const foeWindUp = foe.windUp !== null && shown
      ? {
          bubbles: foe.windUp.feelings.map((id, bubbleIndex) => ({
            id,
            label: world.battle.feelings[id].label,
            popped: foe.windUp?.popped[bubbleIndex] === true,
          })),
        }
      : null;
    return {
      index,
      critterId: entry.id,
      name: entry.name,
      calm: foe.calm,
      calmMax: foe.calmMax,
      soothed: foe.soothed,
      targeted: index === targetIndex,
      battleHeight: entry.battleHeight,
      auraCentre: entry.auraCentre,
      bodyCentre: entry.bodyCentre,
      feeling: foeFeeling,
      windUp: foeWindUp,
      intent: resolveEnemyIntent(world, battle, entry, foe, index, foes.length),
    };
  });
  const intent = foeViews[targetIndex]?.intent ?? null;
  const bossPhase2 = bossPhase2View(battle, critter, talkActive);
  return {
    critterId: critter.id,
    critterName: critter.name,
    battleHeight: critter.battleHeight,
    auraCentre: critter.auraCentre,
    bodyCentre: critter.bodyCentre,
    phase: battle.phase,
    activeActor: { id: turnActor.id, name: turnActor.name },
    message: battle.message,
    revealed: battle.revealed,
    commands: battleCommands(world, state),
    selected: battle.selected,
    energy: battle.energy,
    energyMax: battleEnergyMax(world, battle, critter),
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
    ...(battle.encore === undefined
      ? {}
      : { encore: { bossId: battle.encore.bossId, modifiers: battle.encore.modifiers } }),
    foes: foeViews,
    targetIndex,
    formationId: battle.formationId ?? null,
    intent,
    bossPhase2,
  };
}
