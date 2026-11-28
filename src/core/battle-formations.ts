import type {
  Battle,
  BattleFoe,
  CheckSpec,
  CommandTargetScope,
  Critter,
  FeelingId,
  Grade,
  Point,
  State,
  Wild,
  World,
} from "./types";
import {
  dualComboById,
  dualComboCalm,
  isDualComboCommand,
  popWindUpBubbles,
  type DualComboSpec,
} from "./combos";
import { oldFriend } from "./encounter";
import { feelingFromDraw, feelingsOn, openFeelings, pickFeeling, windUpStarts } from "./feelings";
import { calmExperience } from "./levels";
import { battleParty } from "./party";
import { nextRandom } from "./random";

export type BiomeFormation = {
  id: string;
  area: string;
  title: string;
  critterIds: readonly string[];
  signatureBurst?: CheckSpec;
  bigSignatureBurst?: CheckSpec;
};

export const BIOME_FORMATIONS: readonly BiomeFormation[] = [
  {
    id: "bay-pair",
    area: "bay",
    title: "Bay Splash Duo",
    critterIds: ["pup", "crab"],
  },
  {
    id: "woods-pair",
    area: "woods",
    title: "Woodland Mischief Duo",
    critterIds: ["raccoon", "squirrel"],
    signatureBurst: {
      kind: "which-one",
      showTicks: 32,
      shuffles: 4,
      swapTicks: 20,
      pickTicks: 120,
    },
    bigSignatureBurst: {
      kind: "which-one",
      showTicks: 28,
      shuffles: 5,
      swapTicks: 18,
      pickTicks: 110,
    },
  },
  {
    id: "pass-pair",
    area: "pass",
    title: "Snowdrift Duo",
    critterIds: ["penguin", "hamster"],
  },
  {
    id: "cavern-pair",
    area: "cavern",
    title: "Crystal Echo Duo",
    critterIds: ["bat", "crystal-mole"],
  },
  {
    id: "bay-trio",
    area: "bay",
    title: "Bubblegum Beach Jam",
    critterIds: ["pup", "crab", "bluebird"],
  },
  {
    id: "woods-trio",
    area: "woods",
    title: "Whispering Woods Ruckus",
    critterIds: ["raccoon", "squirrel", "bunny"],
    signatureBurst: {
      kind: "which-one",
      showTicks: 30,
      shuffles: 4,
      swapTicks: 19,
      pickTicks: 120,
    },
    bigSignatureBurst: {
      kind: "which-one",
      showTicks: 26,
      shuffles: 5,
      swapTicks: 17,
      pickTicks: 110,
    },
  },
  {
    id: "pass-trio",
    area: "pass",
    title: "Pinecone Avalanche Trio",
    critterIds: ["penguin", "hamster", "bluebird"],
  },
  {
    id: "arcade-encore",
    area: "arcade",
    title: "Mr. Pip's Jackpot Encore",
    critterIds: ["arcade-keeper", "pup"],
    signatureBurst: {
      kind: "whack",
      pops: 5,
      stayTicks: 28,
      gapTicks: 8,
    },
    bigSignatureBurst: {
      kind: "whack",
      pops: 6,
      stayTicks: 24,
      gapTicks: 7,
    },
  },
];

export function formationById(id: string): BiomeFormation | null {
  return BIOME_FORMATIONS.find((item) => item.id === id) ?? null;
}

export function allFormations(): readonly BiomeFormation[] {
  return BIOME_FORMATIONS;
}

export function formationPartnersForArea(areaId: string): BiomeFormation[] {
  return BIOME_FORMATIONS.filter((item) => item.area === areaId);
}

/**
 * Resolves a biome pair or trio formation for repeat visits so first-visit
 * single-foe story encounters and recorded golden sims remain 100% unchanged.
 */
export function resolveBiomeFormation(
  world: World,
  state: State,
  leadCritter: Critter,
  wildTouch: Wild | undefined,
): BiomeFormation | null {
  if (wildTouch === undefined) return null;
  if (oldFriend(world, state, leadCritter)) return null;
  const partyCount = battleParty(world, state.party).length;
  if (partyCount < 2) return null;
  const calms = state.calms[leadCritter.species] ?? 0;
  if (calms < 1) return null;
  const inArea = BIOME_FORMATIONS.filter(
    (item) =>
      item.area === state.area &&
      item.critterIds[0] === leadCritter.id &&
      item.critterIds.every((id) => {
        const entry = world.critters[id];
        return entry !== undefined && (state.calms[entry.species] ?? 0) >= 1;
      }),
  );
  if (inArea.length === 0) return null;
  if (calms === 2 && partyCount >= 3) {
    const trio = inArea.find((item) => item.critterIds.length === 3);
    if (trio !== undefined) return trio;
  }
  const pair = inArea.find((item) => item.critterIds.length === 2);
  return pair ?? inArea[0] ?? null;
}

export function battleFoes(world: World, battle: Battle): BattleFoe[] {
  if (battle.foes !== undefined && battle.foes.length > 0) return battle.foes;
  const critter = world.critters[battle.critterId];
  const calmMax = critter?.calmMax ?? 100;
  return [
    {
      critterId: battle.critterId,
      calm: battle.calm,
      calmMax,
      soothed: battle.calm >= calmMax,
      feelings: battle.feelings,
      windUp: battle.windUp,
    },
  ];
}

export function activeFoeIndices(foes: readonly BattleFoe[]): number[] {
  const indices: number[] = [];
  for (let index = 0; index < foes.length; index += 1) {
    if (foes[index]?.soothed === false) indices.push(index);
  }
  return indices;
}

export function activeTargetIndex(battle: Battle, foes: readonly BattleFoe[]): number {
  const chosen = battle.targetIndex;
  if (
    chosen !== undefined &&
    chosen >= 0 &&
    chosen < foes.length &&
    foes[chosen]?.soothed === false
  ) {
    return chosen;
  }
  const active = activeFoeIndices(foes);
  return active[0] ?? 0;
}

export function cycleTargetIndex(
  foes: readonly BattleFoe[],
  current: number,
  delta: number,
): number {
  const active = activeFoeIndices(foes);
  if (active.length <= 1) return active[0] ?? current;
  const pos = active.indexOf(current);
  if (pos < 0) return active[0] ?? 0;
  return active[(pos + delta + active.length) % active.length] ?? current;
}

export function allFoesSoothed(foes: readonly BattleFoe[]): boolean {
  return foes.length > 0 && foes.every((foe) => foe.soothed);
}

export function commandTargetScope(commandId: string): CommandTargetScope {
  if (commandId === "cast") return "splash";
  if (commandId === "juggle") return "ricochet";
  if (
    commandId === "together" ||
    commandId === "combo:bubblegum-lasso-spin" ||
    commandId === "combo:rainbow-splash-juggle" ||
    commandId === "combo:cloverhollow-harmony"
  ) {
    return "all";
  }
  return "single";
}

function foeCalmLimit(world: World, foe: BattleFoe): number {
  const critter = world.critters[foe.critterId];
  return critter !== undefined && critter.talk !== null ? critter.calmMax - 1 : foe.calmMax;
}

export function applySkillToFoes(
  world: World,
  foes: readonly BattleFoe[],
  targetIndex: number,
  commandId: string,
  primaryCalm: number,
  grade: Grade,
): { foes: BattleFoe[]; deltas: number[] } {
  const deltas = foes.map(() => 0);
  if (primaryCalm <= 0 || foes.length === 0) {
    return { foes: foes.map((foe) => ({ ...foe })), deltas };
  }
  const scope = commandTargetScope(commandId);
  const safeTarget =
    targetIndex >= 0 && targetIndex < foes.length && foes[targetIndex]?.soothed === false
      ? targetIndex
      : (activeFoeIndices(foes)[0] ?? 0);
  if (foes[safeTarget]?.soothed === false) deltas[safeTarget] = primaryCalm;
  if (scope === "splash") {
    const splash = Math.max(1, Math.round(primaryCalm * 0.5));
    for (let index = 0; index < foes.length; index += 1) {
      if (foes[index]?.soothed === false && Math.abs(index - safeTarget) === 1) {
        deltas[index] = splash;
      }
    }
  } else if (scope === "ricochet") {
    const others: number[] = [];
    for (let offset = 1; offset < foes.length; offset += 1) {
      const idx = (safeTarget + offset) % foes.length;
      if (foes[idx]?.soothed === false) others.push(idx);
    }
    if (grade === "great") {
      if (others[0] !== undefined) deltas[others[0]] = Math.max(1, Math.round(primaryCalm * 0.65));
      if (others[1] !== undefined) deltas[others[1]] = Math.max(1, Math.round(primaryCalm * 0.4));
    } else if (grade === "good") {
      if (others[0] !== undefined) deltas[others[0]] = Math.max(1, Math.round(primaryCalm * 0.45));
    }
  } else if (scope === "all") {
    const full = commandId === "together" || commandId === "combo:cloverhollow-harmony";
    const secondary = full ? primaryCalm : Math.max(1, Math.round(primaryCalm * 0.85));
    for (let index = 0; index < foes.length; index += 1) {
      if (index !== safeTarget && foes[index]?.soothed === false) deltas[index] = secondary;
    }
  }
  const updated = foes.map((foe, index): BattleFoe => {
    const gain = deltas[index] ?? 0;
    if (gain <= 0 || foe.soothed) return { ...foe };
    const calm = Math.min(foeCalmLimit(world, foe), foe.calm + gain);
    return { ...foe, calm, soothed: calm >= foe.calmMax };
  });
  return { foes: updated, deltas };
}

export function applyFluteChorusToFoes(
  world: World,
  foes: readonly BattleFoe[],
  calmGain: number,
): BattleFoe[] {
  if (calmGain <= 0) return foes.map((foe) => ({ ...foe }));
  return foes.map((foe): BattleFoe => {
    if (foe.soothed) return { ...foe };
    const calm = Math.min(foeCalmLimit(world, foe), foe.calm + calmGain);
    return { ...foe, calm, soothed: calm >= foe.calmMax };
  });
}

export type FormationRewardSummary = {
  coins: number;
  xp: number;
  newStickers: string[];
  primaryStickerName: string | null;
  calmIncrements: Record<string, number>;
};

export function formationRewards(
  world: World,
  state: State,
  foes: readonly BattleFoe[],
): FormationRewardSummary {
  let coins = 0;
  let xp = 0;
  const newStickers: string[] = [];
  let primaryStickerName: string | null = null;
  const calmIncrements: Record<string, number> = {};
  for (const foe of foes) {
    const critter = world.critters[foe.critterId];
    if (critter === undefined) continue;
    coins += critter.coins;
    xp += calmExperience(
      world.levels,
      critter.id,
      critter.windUp !== null,
      critter.id === "hooded-kid",
    );
    calmIncrements[critter.species] = (calmIncrements[critter.species] ?? 0) + 1;
    if (!state.stickers.includes(critter.sticker.id) && !newStickers.includes(critter.sticker.id)) {
      newStickers.push(critter.sticker.id);
      if (primaryStickerName === null) primaryStickerName = critter.sticker.name;
    }
  }
  return { coins, xp, newStickers, primaryStickerName, calmIncrements };
}

export function battleEnergyMax(world: World, battle: Battle, critter: Critter): number {
  if (battle.foes === undefined || battle.foes.length === 0) return critter.energyMax;
  let maxEnergy = critter.energyMax;
  for (const foe of battle.foes) {
    const entry = world.critters[foe.critterId];
    if (entry !== undefined && entry.energyMax > maxEnergy) maxEnergy = entry.energyMax;
  }
  return maxEnergy;
}

export function syncBattleTarget(
  battle: Battle,
  foes: BattleFoe[],
  targetIndex: number,
  preferActive = true,
): Battle {
  const index = preferActive
    ? activeTargetIndex({ ...battle, targetIndex }, foes)
    : Math.max(0, Math.min(foes.length - 1, targetIndex));
  const target = foes[index];
  if (target === undefined) return { ...battle, foes, targetIndex: index };
  return {
    ...battle,
    critterId: target.critterId,
    calm: target.calm,
    feelings: target.feelings,
    windUp: target.windUp,
    foes,
    targetIndex: index,
  };
}

export function updateTargetFoe(
  battle: Battle,
  patch: Partial<Pick<BattleFoe, "calm" | "feelings" | "windUp">>,
): Battle {
  if (battle.foes === undefined) return battle;
  const index = activeTargetIndex(battle, battle.foes);
  const foes = battle.foes.map((foe, idx): BattleFoe => {
    if (idx !== index) return foe;
    const calm = patch.calm ?? foe.calm;
    return {
      ...foe,
      calm,
      soothed: calm >= foe.calmMax,
      feelings: patch.feelings ?? foe.feelings,
      windUp: patch.windUp !== undefined ? patch.windUp : foe.windUp,
    };
  });
  return syncBattleTarget(battle, foes, index, false);
}

export type FormationBattleOptions = {
  den?: number | null;
  entry?: Point;
  formationId?: string;
  title?: string;
  signatureBurst?: CheckSpec;
  bigSignatureBurst?: CheckSpec;
  surpriseCalm?: number;
  turn?: number;
  instantText?: boolean;
};

export function buildFormationBattle(
  world: World,
  state: State,
  critterIds: readonly string[],
  options: FormationBattleOptions = {},
): Battle {
  if (critterIds.length === 0) throw new Error("Formation battle requires at least one critter");
  const critters: Critter[] = critterIds.map((id) => {
    const entry = world.critters[id];
    if (entry === undefined) throw new Error(`Unknown formation critter: ${id}`);
    return entry;
  });
  const lead = critters[0];
  if (lead === undefined) throw new Error("Formation battle missing lead critter");
  const foes: BattleFoe[] = critters.map((critter, index) => {
    const calm = index === 0 && options.surpriseCalm !== undefined
      ? Math.min(critter.calmMax - 1, Math.max(0, options.surpriseCalm))
      : 0;
    return {
      critterId: critter.id,
      calm,
      calmMax: critter.calmMax,
      soothed: false,
      feelings: [],
      windUp: null,
    };
  });
  const names = critters.map((item) => item.name).join(" & ");
  const message = options.title !== undefined
    ? `${options.title}! ${names} bounce into view!`
    : critters.length === 1
      ? lead.lines.intro
      : `${names} bounce into view together!`;
  const maxEnergy = critters.reduce((best, item) => Math.max(best, item.energyMax), lead.energyMax);
  return {
    critterId: lead.id,
    den: options.den ?? null,
    entry: options.entry !== undefined ? { ...options.entry } : { ...state.player },
    phase: "intro",
    message,
    revealed: options.instantText === true ? message.length : 0,
    selected: 0,
    command: null,
    energy: maxEnergy,
    calm: foes[0]?.calm ?? 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: options.turn ?? 1,
    actorIndex: 0,
    windUp: null,
    talkMode: false,
    talk: null,
    talkTurns: 0,
    rewardSticker: null,
    phaseTicks: 0,
    foes,
    targetIndex: 0,
    ...(options.formationId === undefined ? {} : { formationId: options.formationId }),
    ...(options.signatureBurst === undefined ? {} : { signatureBurst: options.signatureBurst }),
    ...(options.bigSignatureBurst === undefined
      ? {}
      : { bigSignatureBurst: options.bigSignatureBurst }),
  };
}

function drawFoeFeelings(
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

function drawFoeWindUp(
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

export function initMultiFoeFeelings(
  world: World,
  state: State,
  battle: Battle,
): [Battle, State] {
  if (battle.foes === undefined) return [battle, state];
  let rolled = state;
  const enabled = feelingsOn(world, state);
  const foes = battle.foes.map((foe): BattleFoe => {
    const entry = world.critters[foe.critterId];
    if (!enabled || entry === undefined || foe.soothed) return { ...foe, feelings: [] };
    const [drawn, after] = drawFoeFeelings(world, rolled, entry, 3);
    rolled = after;
    return { ...foe, feelings: drawn };
  });
  return [syncBattleTarget(battle, foes, activeTargetIndex(battle, foes)), rolled];
}

export function advanceMultiFoeTurn(
  world: World,
  state: State,
  battle: Battle,
  turn: number,
): { battle: Battle; state: State; message: string } {
  const foes = battle.foes ?? [];
  const targetIdx = activeTargetIndex(battle, foes);
  let rolled = state;
  let message = world.critters[foes[targetIdx]?.critterId ?? battle.critterId]?.lines.command ?? "";
  const updatedFoes = foes.map((foe, index): BattleFoe => {
    if (foe.soothed) return { ...foe, windUp: null };
    const entry = world.critters[foe.critterId];
    if (entry === undefined) return foe;
    if (foe.windUp !== null && foe.windUp.left > 1) {
      if (index === targetIdx) {
        message = entry.windUp?.lines.puffing ?? entry.lines.command;
      }
      return { ...foe, windUp: { ...foe.windUp, left: foe.windUp.left - 1 } };
    }
    if (entry.windUp !== null && windUpStarts(entry.windUp, turn)) {
      const [bubbles, after] = drawFoeWindUp(world, rolled, entry, entry.windUp.bubbles);
      rolled = after;
      if (bubbles.length > 0) {
        if (index === targetIdx) message = entry.windUp.lines.start;
        return {
          ...foe,
          windUp: { feelings: bubbles, popped: bubbles.map(() => false), left: bubbles.length },
        };
      }
    }
    const [drawn, after] = foe.feelings.length === 0
      ? [[], rolled]
      : drawFoeFeelings(world, rolled, entry, 1);
    rolled = after;
    return {
      ...foe,
      windUp: null,
      feelings: [...foe.feelings.slice(1), ...drawn],
    };
  });
  const synced = syncBattleTarget(battle, updatedFoes, targetIdx);
  return { battle: synced, state: rolled, message };
}

export function resolveDualComboCheck(
  world: World,
  state: State,
  nextBase: State,
  ended: Battle,
  critter: Critter,
  combo: DualComboSpec,
  result: Grade,
): State {
  const calmGain = dualComboCalm(world, state, combo, result);
  const popCount = result === "miss" ? 0 : combo.popBubbles;
  const maxEnergy = battleEnergyMax(world, ended, critter);
  const nextEnergy = Math.min(maxEnergy, ended.energy + combo.energyGain);
  const nextSoften = (ended.burstSoften ?? 0) + combo.burstSoften;
  const bonusCoins = result === "great" ? combo.bonusCoinsOnGreat : 0;
  const baseWithCoins = bonusCoins > 0
    ? { ...nextBase, coins: state.coins + bonusCoins }
    : nextBase;
  const msg = combo.lines[result];
  if (ended.foes !== undefined) {
    const targetIdx = activeTargetIndex(ended, ended.foes);
    const poppedFoes = ended.foes.map((foe, idx): BattleFoe => {
      if (popCount <= 0) return foe;
      if (popCount >= 99 || idx === targetIdx) {
        return { ...foe, windUp: popWindUpBubbles(foe.windUp, popCount) };
      }
      return foe;
    });
    const applied = applySkillToFoes(world, poppedFoes, targetIdx, combo.id, calmGain, result);
    const synced = syncBattleTarget(ended, applied.foes, targetIdx, false);
    return {
      ...baseWithCoins,
      battle: {
        ...synced,
        phase: "result",
        message: msg,
        revealed: 0,
        phaseTicks: 0,
        energy: nextEnergy,
        ...(nextSoften > 0 ? { burstSoften: nextSoften } : {}),
        lastGrade: result,
      },
    };
  }
  const limit = critter.talk === null ? critter.calmMax : critter.calmMax - 1;
  const windUp = popCount > 0 ? popWindUpBubbles(ended.windUp, popCount) : ended.windUp;
  return {
    ...baseWithCoins,
    battle: {
      ...ended,
      phase: "result",
      message: msg,
      revealed: 0,
      phaseTicks: 0,
      calm: Math.min(limit, ended.calm + calmGain),
      energy: nextEnergy,
      windUp,
      ...(nextSoften > 0 ? { burstSoften: nextSoften } : {}),
      lastGrade: result,
    },
  };
}

export function creditBattlePartyXp(
  world: World,
  state: State,
  command: string | null,
  xp: number,
): State["party"] {
  let recipients: Set<string> | null = null;
  if (command === "together") {
    recipients = new Set(battleParty(world, state.party).map((member) => member.id));
  } else if (isDualComboCommand(command)) {
    const combo = dualComboById(command);
    if (combo !== null) recipients = new Set(combo.partners);
  }
  const ownerId = recipients !== null
    ? undefined
    : state.party.find((candidate) => world.party[candidate.id]?.command?.id === command)?.id;
  return state.party.map((member) =>
    (recipients !== null ? recipients.has(member.id) : member.id === ownerId)
      ? { ...member, xp: member.xp + xp }
      : member);
}

export function applyMultiFoeReward(
  world: World,
  state: State,
  nextBase: State,
  battle: Battle,
): State {
  const foes = battleFoes(world, battle);
  const rewards = formationRewards(world, state, foes);
  const den = battle.den;
  const nextCalms = { ...state.calms };
  for (const [species, count] of Object.entries(rewards.calmIncrements)) {
    nextCalms[species] = (nextCalms[species] ?? 0) + count;
  }
  const nextCritters = { ...state.critters };
  if (den === null) {
    for (const foe of foes) {
      if (nextCritters[foe.critterId] !== undefined) nextCritters[foe.critterId] = "calm";
    }
  }
  const stickers = rewards.newStickers.length === 0
    ? state.stickers
    : [...state.stickers, ...rewards.newStickers];
  return {
    ...nextBase,
    ...(den === null
      ? { critters: nextCritters }
      : {
          wild: state.wild.map((item) =>
            item.den === den ? { ...item, mood: "calm" } : item),
        }),
    coins: state.coins + rewards.coins,
    xp: state.xp + rewards.xp,
    party: creditBattlePartyXp(world, state, battle.command, rewards.xp),
    calms: nextCalms,
    stickers,
    battle: null,
  };
}
