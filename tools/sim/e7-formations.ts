import {
  battleCommands,
  battleView,
  blankInput,
  createState,
  stableHash,
  step,
  whichOneTargetSlot,
  type ActionFrame,
  type CheckState,
  type Fixture,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

export type FormationSimResult = {
  id: string;
  ticks: number;
  hash: string;
  coinsGained: number;
  xpGained: number;
  seenChecks: string[];
  greatChecks: string[];
  bossPhase2Seen: boolean;
  comboLanded: string | null;
};

type FormationPlan = {
  id: string;
  fixture: Fixture;
  preferCombo?: string;
  useFluteTurn?: number;
  cycleTargetTurn1?: boolean;
};

function solveCheckFrame(check: CheckState, prev: ActionFrame): ActionFrame {
  if (check.kind === "ring") {
    return { ...blankInput(), confirm: check.tick + 1 === check.spec.targetTick && !prev.confirm };
  }
  if (check.kind === "charge") {
    if (check.held === 0 && prev.confirm) return blankInput();
    return { ...blankInput(), confirm: check.held < check.spec.targetTick };
  }
  if (check.kind === "chain") {
    const onBeat = check.spec.arrivals.includes(check.tick + 1);
    return { ...blankInput(), confirm: onBeat && !prev.confirm };
  }
  if (check.kind === "catch") {
    const nextIdx = check.spec.arrivals.findIndex((arrival) => arrival > check.tick);
    if (nextIdx >= 0 && check.spec.arrivals[nextIdx] === check.tick + 1) {
      const lane = check.lanes[nextIdx] ?? 1;
      const y = lane === 0 ? -1 : lane === 2 ? 1 : 0;
      return { ...blankInput(), move: { x: 0, y } };
    }
    return blankInput();
  }
  if (check.kind === "lean") {
    const x = check.balance <= -5 ? 1 : check.balance >= 5 ? -1 : 0;
    return { ...blankInput(), move: { x, y: 0 } };
  }
  if (check.kind === "which-one") {
    const shuffleEnd = check.spec.showTicks + check.spec.shuffles * check.spec.swapTicks;
    if (check.tick < shuffleEnd) return blankInput();
    const target = whichOneTargetSlot(check.hidingCup, check.swaps);
    if (check.cursor !== target) {
      return prev.move.x === 0 ? { ...blankInput(), move: { x: 1, y: 0 } } : blankInput();
    }
    return prev.confirm ? blankInput() : { ...blankInput(), confirm: true };
  }
  if (check.kind === "whack") {
    const stride = check.spec.stayTicks + check.spec.gapTicks;
    const idx = Math.floor(check.tick / stride);
    const inSlot = check.tick % stride;
    if (idx < check.spec.pops && inSlot === 1 && check.results[idx] === "pending") {
      const slot = check.slots[idx];
      if (slot === "middle") return { ...blankInput(), confirm: true };
      if (slot === "up") return { ...blankInput(), move: { x: 0, y: -1 } };
      if (slot === "right") return { ...blankInput(), move: { x: 1, y: 0 } };
      if (slot === "down") return { ...blankInput(), move: { x: 0, y: 1 } };
      if (slot === "left") return { ...blankInput(), move: { x: -1, y: 0 } };
    }
    return blankInput();
  }
  if (check.kind === "spin-snag") {
    if (check.turns < check.spec.spinsNeeded) {
      const sector = check.lastSector < 0 ? 0 : (check.lastSector + 1) % 4;
      const dirs = [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
      ];
      return { ...blankInput(), move: dirs[sector] ?? { x: 0, y: -1 } };
    }
    const onTarget = check.snagTick + 1 === check.spec.targetTick;
    return { ...blankInput(), confirm: onTarget && !prev.confirm };
  }
  return blankInput();
}

function playFormationOnce(world: World, plan: FormationPlan): FormationSimResult {
  let state: State = createState(world, plan.fixture);
  const startCoins = state.coins;
  const startXp = state.xp;
  const seenChecks = new Set<string>();
  const greatChecks = new Set<string>();
  let bossPhase2Seen = false;
  let comboLaunched = false;
  let comboLanded: string | null = null;
  let cycledTarget = false;
  let lastCheckKind: string | null = null;

  const maxTicks = 6000;
  for (let tick = 0; tick < maxTicks && state.battle !== null; tick += 1) {
    const battle = state.battle;
    const view = battleView(world, state);
    if (view?.bossPhase2 !== null && view?.bossPhase2 !== undefined) {
      bossPhase2Seen = true;
    }

    let frame = blankInput();
    if (battle.phase === "check" && battle.check !== null) {
      lastCheckKind = battle.check.kind;
      seenChecks.add(battle.check.kind);
      frame = solveCheckFrame(battle.check, state.previousInput);
    } else if (battle.revealed < battle.message.length) {
      frame = state.previousInput.confirm ? blankInput() : { ...blankInput(), confirm: true };
    } else if (battle.phase === "command") {
      const commands = battleCommands(world, state);
      const comboIndex =
        plan.preferCombo !== undefined && !comboLaunched
          ? commands.findIndex((c) => c.id === plan.preferCombo && !c.disabled)
          : -1;
      if (plan.cycleTargetTurn1 === true && !cycledTarget && battle.targetIndex === 0) {
        if (state.previousInput.move.x === 0) {
          frame = { ...blankInput(), move: { x: 1, y: 0 } };
          cycledTarget = true;
        }
      } else if (
        plan.useFluteTurn !== undefined &&
        battle.turn >= plan.useFluteTurn &&
        battle.fluteUsed !== true
      ) {
        frame = state.previousInput.flute === true
          ? blankInput()
          : { ...blankInput(), flute: true };
      } else if (comboIndex >= 0) {
        if (battle.selected !== comboIndex) {
          frame = state.previousInput.move.y === 0
            ? { ...blankInput(), move: { x: 0, y: 1 } }
            : blankInput();
        } else if (!state.previousInput.confirm) {
          frame = { ...blankInput(), confirm: true };
          comboLaunched = true;
        }
      } else {
        const preferred = commands.findIndex((c) => !c.disabled);
        const goal = preferred >= 0 ? preferred : 0;
        if (battle.selected !== goal) {
          frame = state.previousInput.move.y === 0
            ? { ...blankInput(), move: { x: 0, y: 1 } }
            : blankInput();
        } else if (!state.previousInput.confirm) {
          frame = { ...blankInput(), confirm: true };
        }
      }
    } else {
      frame = state.previousInput.confirm ? blankInput() : { ...blankInput(), confirm: true };
    }

    const prevPhase = battle.phase;
    const prevCommand = battle.command;
    state = step(world, state, frame).state;

    if (prevPhase === "check" && state.battle !== null && state.battle.phase !== "check") {
      if (state.battle.lastGrade === "great" && lastCheckKind !== null) {
        greatChecks.add(lastCheckKind);
      }
      if (plan.preferCombo !== undefined && prevCommand === plan.preferCombo &&
          state.battle.lastGrade === "great") {
        comboLanded = plan.preferCombo;
      }
    }
  }

  if (state.battle !== null) {
    throw new Error(`${plan.id}: soft-lock after ${maxTicks} ticks (phase=${state.battle.phase})`);
  }
  const coinsGained = state.coins - startCoins;
  const xpGained = state.xp - startXp;
  if (coinsGained <= 0) throw new Error(`${plan.id}: expected positive coins, got ${coinsGained}`);
  if (xpGained <= 0) throw new Error(`${plan.id}: expected positive XP, got ${xpGained}`);

  const formationIds = plan.fixture.battleFormation;
  if (formationIds !== undefined) {
    const startCalms = createState(world, plan.fixture).calms;
    const totalCalmDelta = Object.entries(state.calms).reduce(
      (sum, [species, count]) => sum + (count - (startCalms[species] ?? 0)),
      0,
    );
    const expectedFoes = plan.id === "bay-trio" ? 3 : 2;
    if (totalCalmDelta < expectedFoes) {
      throw new Error(`${plan.id}: expected ${expectedFoes} foes calmed, got ${totalCalmDelta}`);
    }
  }

  return {
    id: plan.id,
    ticks: state.tick,
    hash: stableHash(state),
    coinsGained,
    xpGained,
    seenChecks: [...seenChecks].sort(),
    greatChecks: [...greatChecks].sort(),
    bossPhase2Seen,
    comboLanded,
  };
}

export function runE7FormationSim(): FormationSimResult[] {
  const { world, fixtures } = loadContent();
  const bayDuo = fixtures["bay-duo"];
  const woodsDuo = fixtures["woods-duo"];
  const arcadeEncore = fixtures["arcade-encore"];
  if (bayDuo === undefined || woodsDuo === undefined || arcadeEncore === undefined) {
    throw new Error("Missing E7 formation fixtures (bay-duo, woods-duo, arcade-encore)");
  }

  const plans: FormationPlan[] = [
    {
      id: "bay-duo",
      fixture: bayDuo,
      preferCombo: "combo:bubblegum-lasso-spin",
      useFluteTurn: 3,
    },
    {
      id: "woods-duo",
      fixture: woodsDuo,
    },
    {
      id: "arcade-encore",
      fixture: arcadeEncore,
    },
    {
      id: "bay-trio",
      fixture: { ...bayDuo, battleFormation: "bay-trio" },
      cycleTargetTurn1: true,
      useFluteTurn: 3,
    },
  ];

  const results: FormationSimResult[] = [];
  for (const plan of plans) {
    const first = playFormationOnce(world, plan);
    const second = playFormationOnce(world, plan);
    if (first.hash !== second.hash) {
      throw new Error(`${plan.id}: non-deterministic hash (${first.hash} !== ${second.hash})`);
    }
    results.push(first);
  }

  const byId = new Map(results.map((r) => [r.id, r]));
  const bay = byId.get("bay-duo");
  if (bay?.comboLanded !== "combo:bubblegum-lasso-spin" || !bay.greatChecks.includes("spin-snag")) {
    throw new Error("bay-duo did not land Dual Combo combo:bubblegum-lasso-spin (spin-snag GREAT)");
  }
  const woods = byId.get("woods-duo");
  if (!woods?.greatChecks.includes("which-one")) {
    throw new Error("woods-duo did not clear which-one with GREAT");
  }
  const arcade = byId.get("arcade-encore");
  if (!arcade?.greatChecks.includes("whack") || !arcade.bossPhase2Seen) {
    throw new Error("arcade-encore did not clear whack GREAT + Mr. Pip Boss Phase-2");
  }
  const trio = byId.get("bay-trio");
  if (trio === undefined) throw new Error("bay-trio did not complete");

  for (const res of results) {
    console.log(
      `e7-sim ${res.id}: ${res.ticks} ticks, hash=${res.hash}, ` +
        `+${res.coinsGained}c +${res.xpGained}xp, great=[${res.greatChecks.join(",")}]` +
        `${res.bossPhase2Seen ? " [Phase-2]" : ""}` +
        `${res.comboLanded !== null ? ` [${res.comboLanded}]` : ""}`,
    );
  }
  return results;
}

if (import.meta.main) {
  runE7FormationSim();
}
