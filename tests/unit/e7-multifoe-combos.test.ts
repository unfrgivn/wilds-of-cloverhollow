import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { checkSpec, faeSideCheck } from "../../src/content/parsers";
import {
  BOSS_PHASE2_PROFILES,
  DUAL_COMBOS,
  allFormations,
  applyFluteChorusToFoes,
  applySkillToFoes,
  availableDualCombos,
  battleCommands,
  battleView,
  blankInput,
  bossPhase2Profile,
  checkDraws,
  checkHint,
  createCheck,
  createState,
  cycleTargetIndex,
  formationById,
  gentleCheckSpec,
  isBossPhase2,
  pickFromDraw,
  resolveBiomeFormation,
  resolveEnemyIntent,
  soundCues,
  spinSectorFromInput,
  startBattle,
  startFormationBattle,
  step,
  stepCheck,
  upgradeBossPhase2Check,
  upgradeLeanPhase2,
  viewCheck,
  whichOneTargetSlot,
  type CheckInput,
  type CheckSpec,
  type FeelingId,
  type Grade,
  type SpinSnagSpec,
  type State,
  type WhackSlot,
  type WhackSpec,
  type WhichOneSpec,
  type Wild,
} from "../../src/core";

const { world, fixtures } = loadContent();

function checkInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    confirmEdge: false,
    confirmHeld: false,
    lane: 1,
    lean: 0,
    ...overrides,
  };
}

function advanceConfirm(state: State): State {
  let cur = state;
  if (cur.previousInput.confirm) {
    cur = step(world, cur, blankInput(), { textSpeed: "instant" }).state;
  }
  if (cur.battle !== null && cur.battle.revealed < cur.battle.message.length) {
    cur = step(world, cur, { ...blankInput(), confirm: true }, { textSpeed: "instant" }).state;
    cur = step(world, cur, blankInput(), { textSpeed: "instant" }).state;
  }
  const pressed = step(world, cur, { ...blankInput(), confirm: true }, { textSpeed: "instant" });
  return step(world, pressed.state, blankInput(), { textSpeed: "instant" }).state;
}

function stepInstant(state: State, input = blankInput()): State {
  return step(world, state, input, { textSpeed: "instant" }).state;
}

function playActiveCheckToGreat(initial: State): State {
  let cur = initial;
  for (let guard = 0; guard < 320 && cur.battle?.phase === "check"; guard += 1) {
    const check = cur.battle.check;
    if (check === null) break;
    if (check.kind === "ring") {
      const press = check.tick + 1 === check.spec.targetTick;
      cur = stepInstant(cur, { ...blankInput(), confirm: press });
      continue;
    }
    if (check.kind === "charge") {
      const hold = check.held < check.spec.targetTick;
      cur = stepInstant(cur, { ...blankInput(), confirm: hold });
      continue;
    }
    if (check.kind === "chain") {
      const press = check.spec.arrivals.includes(check.tick + 1);
      cur = stepInstant(cur, { ...blankInput(), confirm: press });
      continue;
    }
    if (check.kind === "spin-snag") {
      if (check.turns < check.spec.spinsNeeded) {
        const nextSector = check.lastSector < 0 ? 0 : (check.lastSector + 1) % 4;
        const dirs = [
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
        ];
        cur = stepInstant(cur, { ...blankInput(), move: dirs[nextSector] ?? { x: 0, y: -1 } });
      } else {
        const press = check.snagTick + 1 === check.spec.targetTick;
        cur = stepInstant(cur, { ...blankInput(), confirm: press });
      }
      continue;
    }
    cur = stepInstant(cur);
  }
  return cur;
}

function whackSwingInput(slot: WhackSlot): CheckInput {
  if (slot === "middle") return checkInput({ confirmEdge: true });
  if (slot === "up") return checkInput({ move: { x: 0, y: -1 }, previousMove: { x: 0, y: 0 } });
  if (slot === "right") return checkInput({ move: { x: 1, y: 0 }, previousMove: { x: 0, y: 0 } });
  if (slot === "down") return checkInput({ move: { x: 0, y: 1 }, previousMove: { x: 0, y: 0 } });
  return checkInput({ move: { x: -1, y: 0 }, previousMove: { x: 0, y: 0 } });
}

describe("Track E7 Core: v2 battle checks (which-one, whack, spin-snag)", () => {
  it("runs which-one deterministically with keyboard/touch, 3-tier grading, and gentle", () => {
    const spec: WhichOneSpec = {
      kind: "which-one",
      showTicks: 10,
      shuffles: 4,
      swapTicks: 6,
      pickTicks: 40,
    };
    expect(checkDraws(spec)).toBe(5);
    expect(pickFromDraw(spec, 0.99)).toBe(2);
    // Deterministic seeding & no consecutive identical swaps.
    const checkA = createCheck(spec, "fae", false, [0, 1, 1, 1, 1]);
    const checkB = createCheck(spec, "fae", false, [0, 1, 1, 1, 1]);
    expect(checkA).toEqual(checkB);
    if (checkA.kind !== "which-one") throw new Error("expected which-one");
    for (let i = 1; i < checkA.swaps.length; i += 1) {
      expect(checkA.swaps[i]).not.toEqual(checkA.swaps[i - 1]);
    }
    const target = whichOneTargetSlot(checkA.hidingCup, checkA.swaps);
    let cur = checkA;
    const shuffleEnd = spec.showTicks + spec.shuffles * spec.swapTicks;
    for (let t = 0; t < shuffleEnd; t += 1) {
      const stepped = stepCheck(cur, checkInput());
      expect(stepped.grade).toBeNull();
      if (stepped.check.kind !== "which-one") throw new Error("expected which-one");
      cur = stepped.check;
    }
    const midView = viewCheck(cur, null);
    expect(midView.kind).toBe("which-one");
    if (midView.kind === "which-one") expect(midView.phase).toBe("shuffle");

    // Direct touch choose: great / good / miss.
    expect(stepCheck(cur, checkInput({ choose: target })).grade).toBe("great");
    const adj = target === 1 ? 0 : 1;
    expect(stepCheck(cur, checkInput({ choose: adj })).grade).toBe("good");
    if (target !== 1) {
      const far = target === 0 ? 2 : 0;
      expect(stepCheck(cur, checkInput({ choose: far })).grade).toBe("miss");
    } else {
      // Also verify far-slot miss on a check whose target rests on edge slot 0.
      const edgeCheck = createCheck(
        { kind: "which-one", showTicks: 2, shuffles: 2, swapTicks: 2, pickTicks: 20 },
        "fae",
        false,
        [2, 1, 2],
      );
      if (edgeCheck.kind !== "which-one") throw new Error("expected which-one");
      let edgeCur = edgeCheck;
      for (let t = 0; t < 6; t += 1) {
        const next = stepCheck(edgeCur, checkInput());
        if (next.check.kind !== "which-one") throw new Error("expected which-one");
        edgeCur = next.check;
      }
      const edgeTarget = whichOneTargetSlot(edgeCur.hidingCup, edgeCur.swaps);
      const farSlot = edgeTarget === 0 ? 2 : edgeTarget === 2 ? 0 : -1;
      if (farSlot >= 0) {
        expect(stepCheck(edgeCur, checkInput({ choose: farSlot })).grade).toBe("miss");
      }
    }

    // Keyboard Left/Right cursor navigation + confirm -> great.
    let nav = cur;
    for (let stepIdx = 0; stepIdx < 3 && nav.cursor !== target; stepIdx += 1) {
      const moved = stepCheck(
        nav,
        checkInput({ move: { x: 1, y: 0 }, previousMove: { x: 0, y: 0 } }),
      );
      if (moved.check.kind !== "which-one") throw new Error("expected which-one");
      nav = moved.check;
    }
    expect(nav.cursor).toBe(target);
    expect(stepCheck(nav, checkInput({ confirmEdge: true })).grade).toBe("great");

    // Pick timeout -> miss.
    let timed = cur;
    let timeoutGrade: Grade | null = null;
    for (let t = 0; t < spec.pickTicks + 2 && timeoutGrade === null; t += 1) {
      const next = stepCheck(timed, checkInput());
      timeoutGrade = next.grade;
      if (next.check.kind !== "which-one") throw new Error("expected which-one");
      timed = next.check;
    }
    expect(timeoutGrade).toBe("miss");

    // Gentle spec widens show/swap/pick and lowers shuffles.
    const gentle = gentleCheckSpec(spec);
    if (gentle.kind !== "which-one") throw new Error("expected which-one");
    expect(gentle.showTicks).toBe(spec.showTicks + 8);
    expect(gentle.shuffles).toBe(3);
    expect(gentle.swapTicks).toBe(spec.swapTicks + 8);
    expect(gentle.pickTicks).toBe(spec.pickTicks + 48);
  });

  it("runs whack with great/good/miss tiers, anti-mash, touch choose, seeding, and gentle", () => {
    const spec: WhackSpec = { kind: "whack", pops: 4, stayTicks: 12, gapTicks: 4 };
    expect(checkDraws(spec)).toBe(4);
    expect(pickFromDraw(spec, 0.99)).toBe(4);
    const createdA = createCheck(spec, "fae", false, [4, 4, 0, 1]);
    const createdB = createCheck(spec, "fae", false, [4, 4, 0, 1]);
    expect(createdA).toEqual(createdB);
    if (createdA.kind !== "whack") throw new Error("expected whack");
    // Consecutive duplicates shifted so slot[0] !== slot[1].
    expect(createdA.slots[0]).toBe("middle");
    expect(createdA.slots[1]).toBe("up");

    // Helper that plays whack hitting the specified pop indices.
    const runWhack = (hitIndices: readonly number[], useTouch = false): Grade | null => {
      let cur = createdA;
      let grade: Grade | null = null;
      const stride = spec.stayTicks + spec.gapTicks;
      const slotMap: Record<WhackSlot, number> = {
        up: 0, right: 1, down: 2, left: 3, middle: 4,
      };
      for (let t = 0; t < spec.pops * stride + 5 && grade === null; t += 1) {
        const idx = Math.floor(cur.tick / stride);
        const inSlot = cur.tick % stride;
        let input = checkInput();
        if (idx < spec.pops && inSlot === 0 && cur.results[idx] === "pending") {
          const slot = cur.slots[idx]!;
          if (hitIndices.includes(idx)) {
            input = useTouch ? checkInput({ choose: slotMap[slot] }) : whackSwingInput(slot);
          }
        }
        const stepped = stepCheck(cur, input);
        grade = stepped.grade;
        if (stepped.check.kind !== "whack") throw new Error("expected whack");
        cur = stepped.check;
      }
      return grade;
    };

    expect(runWhack([0, 1, 2, 3], false)).toBe("great");
    expect(runWhack([0, 1, 2, 3], true)).toBe("great");
    expect(runWhack([0, 1])).toBe("good");
    expect(runWhack([0])).toBe("miss");
    expect(runWhack([])).toBe("miss");

    // Anti-mash: swinging wrong direction marks pop as miss immediately and prevents later hit.
    const step1 = stepCheck(createdA, checkInput({ confirmEdge: true }));
    if (step1.check.kind !== "whack") throw new Error("expected whack");
    expect(step1.check.results[0]).toBe("hit");
    let cur = step1.check;
    while (cur.tick < 16) {
      const next = stepCheck(cur, checkInput());
      if (next.check.kind !== "whack") throw new Error("expected whack");
      cur = next.check;
    }
    const wrongSwing = stepCheck(
      cur,
      checkInput({ move: { x: 0, y: 1 }, previousMove: { x: 0, y: 0 } }),
    );
    if (wrongSwing.check.kind !== "whack") throw new Error("expected whack");
    expect(wrongSwing.check.results[1]).toBe("miss");
    // Trying the right direction on the next tick cannot undo the anti-mash miss!
    const retryRight = stepCheck(
      wrongSwing.check,
      checkInput({ move: { x: 0, y: -1 }, previousMove: { x: 0, y: 0 } }),
    );
    if (retryRight.check.kind !== "whack") throw new Error("expected whack");
    expect(retryRight.check.results[1]).toBe("miss");

    expect(checkHint(createdA, world.battle.hints)).toBe(world.battle.hints.whack);
    const gentle = gentleCheckSpec(spec);
    if (gentle.kind !== "whack") throw new Error("expected whack");
    expect(gentle.stayTicks).toBe(spec.stayTicks + 10);
    expect(gentle.gapTicks).toBe(spec.gapTicks + 4);
  });

  it("runs spin-snag CW, CCW, pointer circle, anti-bounce, great/good/miss, and gentle", () => {
    const spec: SpinSnagSpec = {
      kind: "spin-snag",
      spinsNeeded: 4,
      spinTicks: 60,
      snagTicks: 40,
      targetTick: 20,
      greatWindow: 4,
      goodWindow: 8,
    };
    expect(checkDraws(spec)).toBe(0);
    expect(spinSectorFromInput({ x: 500, y: 500 }, undefined)).toBe(-1);
    expect(spinSectorFromInput({ x: 500, y: 200 }, undefined)).toBe(0);
    expect(spinSectorFromInput({ x: 800, y: 500 }, undefined)).toBe(1);
    expect(spinSectorFromInput({ x: 500, y: 800 }, undefined)).toBe(2);
    expect(spinSectorFromInput({ x: 200, y: 500 }, undefined)).toBe(3);
    expect(spinSectorFromInput(undefined, { x: 0.1, y: 0.1 })).toBe(-1);

    // 1. CW arrows + opposite-axis bounce rejection + great/good/miss snags.
    let cw = createCheck(spec, "critter");
    cw = stepCheck(cw, checkInput({ move: { x: 0, y: -1 } })).check;
    // Opposite jump down -> ignored!
    cw = stepCheck(cw, checkInput({ move: { x: 0, y: 1 } })).check;
    if (cw.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(cw.turns).toBe(1);
    cw = stepCheck(cw, checkInput({ move: { x: 1, y: 0 } })).check;
    // Opposite jump left -> ignored!
    cw = stepCheck(cw, checkInput({ move: { x: -1, y: 0 } })).check;
    if (cw.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(cw.turns).toBe(2);
    cw = stepCheck(cw, checkInput({ move: { x: 0, y: 1 } })).check;
    cw = stepCheck(cw, checkInput({ move: { x: -1, y: 0 } })).check;
    if (cw.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(cw.turns).toBe(4);
    const snagView = viewCheck(cw, null);
    expect(snagView.kind).toBe("spin-snag");
    if (snagView.kind === "spin-snag") expect(snagView.phase).toBe("snag");

    // Snag at tick 20 -> great; at tick 14 (delta -6) -> good; at tick 5 (delta -15) -> miss.
    const advanceSnag = (base: typeof cw, ticks: number) => {
      let c: typeof cw = base;
      for (let t = 0; t < ticks; t += 1) {
        const next = stepCheck(c, checkInput()).check;
        if (next.kind !== "spin-snag") throw new Error("expected spin-snag");
        c = next;
      }
      return c;
    };
    expect(stepCheck(advanceSnag(cw, 19), checkInput({ confirmEdge: true })).grade).toBe("great");
    expect(stepCheck(advanceSnag(cw, 13), checkInput({ confirmEdge: true })).grade).toBe("good");
    expect(stepCheck(advanceSnag(cw, 4), checkInput({ confirmEdge: true })).grade).toBe("miss");
    // Snag timeout -> miss.
    expect(stepCheck(advanceSnag(cw, spec.snagTicks - 1), checkInput()).grade).toBe("miss");

    // 2. CCW spinning (up -> left -> down -> right).
    let ccw = createCheck(spec, "critter");
    for (const move of [
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]) {
      ccw = stepCheck(ccw, checkInput({ move })).check;
    }
    if (ccw.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(ccw.turns).toBe(4);

    // 3. Pointer circle spinning (top -> right -> bottom -> left).
    let ptr = createCheck(spec, "critter");
    for (const pointer of [
      { x: 500, y: 200 },
      { x: 800, y: 500 },
      { x: 500, y: 800 },
      { x: 200, y: 500 },
    ]) {
      ptr = stepCheck(ptr, checkInput({ pointer })).check;
    }
    if (ptr.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(ptr.turns).toBe(4);

    // 4. Spin timeout: >= half spins -> good; < half spins -> miss.
    let halfSpin = createCheck(spec, "critter");
    halfSpin = stepCheck(halfSpin, checkInput({ move: { x: 0, y: -1 } })).check;
    halfSpin = stepCheck(halfSpin, checkInput({ move: { x: 1, y: 0 } })).check;
    let halfGrade: Grade | null = null;
    for (let t = 0; t < spec.spinTicks && halfGrade === null; t += 1) {
      const next = stepCheck(halfSpin, checkInput());
      halfGrade = next.grade;
      halfSpin = next.check;
    }
    expect(halfGrade).toBe("good");

    let zeroSpin = createCheck(spec, "critter");
    let zeroGrade: Grade | null = null;
    for (let t = 0; t < spec.spinTicks + 1 && zeroGrade === null; t += 1) {
      const next = stepCheck(zeroSpin, checkInput());
      zeroGrade = next.grade;
      zeroSpin = next.check;
    }
    expect(zeroGrade).toBe("miss");

    // 5. Gentle spec widens spin/snag/windows and lowers spinsNeeded.
    const gentle = gentleCheckSpec({ ...spec, spinsNeeded: 6 });
    if (gentle.kind !== "spin-snag") throw new Error("expected spin-snag");
    expect(gentle.spinsNeeded).toBe(4);
    expect(gentle.spinTicks).toBe(spec.spinTicks + 36);
    expect(gentle.snagTicks).toBe(spec.snagTicks + 20);
    expect(gentle.greatWindow).toBeGreaterThan(spec.greatWindow);
    expect(gentle.goodWindow).toBeGreaterThan(spec.goodWindow);
  });

  it("validates v2 check specs in parsers and allows spin-snag on Fae side", () => {
    expect(world.battle.checksV2Atlas).toBe("assets/battle/battle-checks-v2.json");
    expect(
      faeSideCheck(
        {
          kind: "spin-snag",
          spinsNeeded: 4,
          spinTicks: 60,
          snagTicks: 40,
          targetTick: 20,
          greatWindow: 4,
          goodWindow: 8,
        },
        "test.json",
        "check",
      ).kind,
    ).toBe("spin-snag");
    expect(() =>
      faeSideCheck(
        { kind: "whack", pops: 4, stayTicks: 20, gapTicks: 6 },
        "test.json",
        "check",
      ),
    ).toThrow();
    expect(
      checkSpec(
        { kind: "which-one", showTicks: 24, shuffles: 3, swapTicks: 16, pickTicks: 90 },
        "test.json",
        "burst",
      ).kind,
    ).toBe("which-one");
  });
});

describe("Track E7 Core: multi-critter formations, Boss Phase-2, and Dual Combos", () => {
  it("supports all 8 authored formations (2-foe and 3-foe) plus fixture loading", () => {
    const expectedFormations: readonly [string, readonly string[]][] = [
      ["bay-pair", ["pup", "crab"]],
      ["woods-pair", ["raccoon", "squirrel"]],
      ["pass-pair", ["penguin", "hamster"]],
      ["cavern-pair", ["bat", "crystal-mole"]],
      ["bay-trio", ["pup", "crab", "bluebird"]],
      ["woods-trio", ["raccoon", "squirrel", "bunny"]],
      ["pass-trio", ["penguin", "hamster", "bluebird"]],
      ["arcade-encore", ["arcade-keeper", "pup"]],
    ];
    expect(allFormations().map((f) => f.id)).toEqual(expectedFormations.map(([id]) => id));
    const base = createState(world, fixtures["bay-duo"]!);
    for (const [id, critterIds] of expectedFormations) {
      const def = formationById(id);
      expect(def).not.toBeNull();
      const battle = startFormationBattle(world, base, id, "instant");
      expect(battle.formationId).toBe(id);
      expect(battle.foes?.map((f) => f.critterId)).toEqual([...critterIds]);
      expect(battle.foes?.every((f) => f.calm === 0 && !f.soothed)).toBe(true);
      expect(battle.targetIndex).toBe(0);
    }

    const bay = createState(world, fixtures["bay-duo"]!);
    expect(bay.battle?.formationId).toBe("bay-pair");
    expect(bay.battle?.foes?.map((f) => f.critterId)).toEqual(["pup", "crab"]);
    const woods = createState(world, fixtures["woods-duo"]!);
    expect(woods.battle?.formationId).toBe("woods-pair");
    expect(woods.battle?.signatureBurst?.kind).toBe("which-one");
    const arcade = createState(world, fixtures["arcade-encore"]!);
    expect(arcade.battle?.formationId).toBe("arcade-encore");
    expect(arcade.battle?.signatureBurst?.kind).toBe("whack");
  });

  it("cycles targets via Left/Right & tap, tracks individual calm/soothed, and splashes", () => {
    const base = createState(world, fixtures["bay-duo"]!);
    const trioBattle = startFormationBattle(world, base, "bay-trio", "instant");
    let state: State = { ...base, battle: trioBattle };
    state = advanceConfirm(state);
    expect(state.battle?.phase).toBe("command");
    expect(state.battle?.targetIndex).toBe(0);

    // Right cycles 0 -> 1 -> 2 -> 0; Left cycles 0 -> 2.
    state = stepInstant(state, { ...blankInput(), move: { x: 1, y: 0 } });
    expect(state.battle?.targetIndex).toBe(1);
    expect(state.battle?.critterId).toBe("crab");
    state = stepInstant(state);
    state = stepInstant(state, { ...blankInput(), move: { x: 1, y: 0 } });
    expect(state.battle?.targetIndex).toBe(2);
    expect(state.battle?.critterId).toBe("bluebird");
    state = stepInstant(state);
    state = stepInstant(state, { ...blankInput(), move: { x: 1, y: 0 } });
    expect(state.battle?.targetIndex).toBe(0);
    state = stepInstant(state);
    state = stepInstant(state, { ...blankInput(), move: { x: -1, y: 0 } });
    expect(state.battle?.targetIndex).toBe(2);
    // Direct tap `input.target` jumps to foe 1.
    state = stepInstant(state, { ...blankInput(), target: 1 });
    expect(state.battle?.targetIndex).toBe(1);

    // Pure skill distribution checks across 3-foe formation:
    // Sue cast adjacent splash from center (1) splashes 0 & 2; from edge (0) splashes 1 only.
    const foes = trioBattle.foes!;
    expect(applySkillToFoes(world, foes, 1, "cast", 40, "great").deltas).toEqual([20, 40, 20]);
    expect(applySkillToFoes(world, foes, 0, "cast", 40, "great").deltas).toEqual([40, 20, 0]);
    expect(applySkillToFoes(world, foes, 2, "cast", 40, "great").deltas).toEqual([0, 20, 40]);

    // Jordan juggle ricochet: great hits 100/65/40; good hits 100/45/0; miss hits 0.
    expect(applySkillToFoes(world, foes, 0, "juggle", 40, "great").deltas).toEqual([40, 26, 16]);
    expect(applySkillToFoes(world, foes, 0, "juggle", 40, "good").deltas).toEqual([40, 18, 0]);
    expect(applySkillToFoes(world, foes, 0, "juggle", 0, "miss").deltas).toEqual([0, 0, 0]);

    // Fae Flute Chorus pure + live step() applies calm to every active foe.
    const chorus = applyFluteChorusToFoes(world, foes, 25);
    expect(chorus.map((f) => f.calm)).toEqual([25, 25, 25]);
    const afterFlute = stepInstant(state, { ...blankInput(), flute: true });
    expect(afterFlute.battle?.fluteUsed).toBe(true);
    expect(afterFlute.battle?.foes?.map((f) => f.calm)).toEqual([25, 25, 25]);

    // Individual soothed state: soothing foe 1 leaves foes 0 & 2 active and skips foe 1 on cycle.
    const almostFoe1 = afterFlute.battle!.foes!.map((f, idx) =>
      idx === 1 ? { ...f, calm: f.calmMax - 5 } : f,
    );
    const sueTurn: State = {
      ...afterFlute,
      battle: {
        ...afterFlute.battle!,
        actorIndex: 1, // Sue ("cast")
        targetIndex: 1,
        critterId: "crab",
        calm: almostFoe1[1]!.calm,
        foes: almostFoe1,
      },
    };
    const castLaunched = stepInstant(sueTurn, { ...blankInput(), choose: 0 });
    expect(castLaunched.battle?.command).toBe("cast");
    const castDone = playActiveCheckToGreat(castLaunched);
    expect(castDone.battle?.phase).toBe("result");
    // Crab (idx 1) is now soothed; adjacent pup (0) and bluebird (2) gained splash calm!
    expect(castDone.battle?.foes?.[1]?.soothed).toBe(true);
    expect(castDone.battle?.foes?.[0]?.calm).toBeGreaterThan(25);
    expect(castDone.battle?.foes?.[2]?.calm).toBeGreaterThan(25);
    // Advancing result does NOT end the battle; target auto-advances off soothed foe 1.
    const afterResult = advanceConfirm(castDone);
    expect(afterResult.battle?.phase).toBe("burst");
    expect(afterResult.battle?.targetIndex).not.toBe(1);
    const withOneCalm = foes.map((f, idx) => (idx === 1 ? { ...f, soothed: true } : f));
    expect(cycleTargetIndex(withOneCalm, 0, 1)).toBe(2);
  });

  it("preserves 100% single-foe backward compatibility (battle.foes === undefined)", () => {
    const base = createState(world, fixtures["plaza-party"] ?? fixtures["bay"]!);
    const pup = world.critters["pup"]!;
    let state: State = { ...base, battle: startBattle(world, base, pup, undefined, base.player) };
    expect(state.battle?.foes).toBeUndefined();
    expect(state.battle?.formationId).toBeUndefined();
    state = advanceConfirm(state);
    expect(state.battle?.phase).toBe("command");
    expect(state.battle?.foes).toBeUndefined();
    // Run Soothe to calm pup cleanly in single-foe mode.
    state = { ...state, battle: { ...state.battle!, calm: pup.calmMax - 10 } };
    state = stepInstant(state, { ...blankInput(), choose: 0 });
    state = playActiveCheckToGreat(state);
    expect(state.battle?.foes).toBeUndefined();
    expect(state.battle?.calm).toBe(pup.calmMax);
    state = advanceConfirm(state);
    expect(state.battle?.phase).toBe("soothed");
    state = advanceConfirm(state);
    expect(state.battle?.phase).toBe("reward");
    const coinsBefore = state.coins;
    state = advanceConfirm(state);
    expect(state.battle).toBeNull();
    expect(state.coins - coinsBefore).toBe(pup.coins);
  });

  it("resolves biome formations only on repeat visits after species are calmed", () => {
    const base = createState(world, fixtures["bay"]!);
    const pup = world.critters["pup"]!;
    const wildTouch: Wild = {
      kind: "pup", den: 0, mood: "chaos", x: 100, y: 100,
      target: { x: 100, y: 100 }, pauseTicks: 0, cooldownTicks: 0,
      facing: "down", moving: false, notice: 0,
    };
    const withParty = createState(world, {
      ...fixtures["bay"]!,
      party: ["sue", "jordan", "maddie"],
    });
    expect(resolveBiomeFormation(world, withParty, pup, wildTouch)).toBeNull();
    const repeat = { ...withParty, calms: { pup: 1, crab: 1 } };
    expect(resolveBiomeFormation(world, repeat, pup, wildTouch)?.id).toBe("bay-pair");
    const trioReady = { ...withParty, calms: { pup: 2, crab: 1, bluebird: 1 } };
    expect(resolveBiomeFormation(world, trioReady, pup, wildTouch)?.id).toBe("bay-trio");
    expect(resolveBiomeFormation(world, { ...base, calms: { pup: 1, crab: 1 } }, pup, wildTouch))
      .toBeNull();
  });

  it("triggers Phase-2 across all 11 mini-bosses, upgrades checks, and shows 4 intents", () => {
    const requiredBosses = [
      "gull", "arcade-keeper", "gym-pup", "coach", "art-teacher", "lodge-keeper",
      "lifeguard", "principal", "taco-chef", "hooded-kid", "moon-owl",
    ];
    const distinctTints = new Set<number>();
    for (const id of requiredBosses) {
      const profile = bossPhase2Profile(id);
      expect(profile, `missing profile ${id}`).not.toBeNull();
      if (profile === null) continue;
      expect(profile.phaseTitle.length).toBeGreaterThan(3);
      expect(profile.signatureLine.length).toBeGreaterThan(10);
      expect(profile.accentHex).toMatch(/^#[0-9a-f]{6}$/i);
      if (id !== "coach") distinctTints.add(profile.moodTint);

      const critter = world.critters[id];
      if (critter !== undefined) {
        const threshold = Math.ceil(critter.calmMax * 0.5);
        expect(isBossPhase2(critter, threshold - 1, "command", false)).toBe(false);
        expect(isBossPhase2(critter, threshold, "command", false)).toBe(true);
        expect(isBossPhase2(critter, critter.calmMax, "command", false)).toBe(false);
        expect(isBossPhase2(critter, threshold, "command", true)).toBe(false);
        expect(isBossPhase2(critter, threshold, "soothed", false)).toBe(false);
        // Upgraded burst preserves PRNG draw count.
        const upgraded = upgradeBossPhase2Check(critter.burst.check, id);
        expect(checkDraws(upgraded)).toBe(checkDraws(critter.burst.check));
      }
    }
    expect(Object.keys(BOSS_PHASE2_PROFILES).length).toBeGreaterThanOrEqual(11);
    expect(distinctTints.size).toBe(10);

    // Verify upgradeBossPhase2Check across all check kinds.
    const checkSamples: CheckSpec[] = [
      { kind: "catch", travelTicks: 50, arrivals: [50, 74], toys: ["t1"] },
      { kind: "chain", travelTicks: 34, hitWindow: 9, arrivals: [36, 58], look: "bubble" },
      {
        kind: "trace",
        dryTicks: 140,
        brushSpeed: 28,
        reachRadius: 80,
        paths: [{ id: "arc", points: [{ x: 100, y: 100 }, { x: 800, y: 800 }] }],
      },
      {
        kind: "peekaboo",
        ticks: 120,
        goal: 60,
        warningTicks: 14,
        graceTicks: 4,
        peeks: [{ start: 20, end: 40 }],
      },
      { kind: "ring", ticks: 60, targetTick: 40, greatWindow: 6, goodWindow: 12 },
      { kind: "echo", notes: 3, demoTicks: 18, gapTicks: 6, inputTicks: 90 },
      { kind: "whack", pops: 5, stayTicks: 28, gapTicks: 8 },
      { kind: "which-one", showTicks: 30, shuffles: 4, swapTicks: 20, pickTicks: 100 },
      { kind: "lean", puffTicks: 15, starts: [20], forces: [2], steer: 5, spring: 2 },
    ];
    for (const sample of checkSamples) {
      const up = upgradeBossPhase2Check(sample, "arcade-keeper");
      expect(up.kind).toBe(sample.kind);
      expect(checkDraws(up)).toBe(checkDraws(sample));
      if (sample.kind === "catch" && up.kind === "catch") {
        expect(up.travelTicks).toBeLessThan(sample.travelTicks);
      } else if (sample.kind === "chain" && up.kind === "chain") {
        expect(up.travelTicks).toBeLessThan(sample.travelTicks);
        expect(up.hitWindow).toBeLessThan(sample.hitWindow);
      } else if (sample.kind === "trace" && up.kind === "trace") {
        expect(up.dryTicks).toBeLessThan(sample.dryTicks);
      } else if (sample.kind === "peekaboo" && up.kind === "peekaboo") {
        expect(up.warningTicks).toBeLessThan(sample.warningTicks);
      } else if (sample.kind === "ring" && up.kind === "ring") {
        expect(up.greatWindow).toBeLessThan(sample.greatWindow);
      } else if (sample.kind === "echo" && up.kind === "echo") {
        expect(up.demoTicks).toBeLessThan(sample.demoTicks);
      } else if (sample.kind === "whack" && up.kind === "whack") {
        expect(up.stayTicks).toBeLessThan(sample.stayTicks);
      } else if (sample.kind === "which-one" && up.kind === "which-one") {
        expect(up.swapTicks).toBeLessThan(sample.swapTicks);
      }
    }
    const leanUp = upgradeLeanPhase2({
      kind: "lean", puffTicks: 15, starts: [20], forces: [2], steer: 5, spring: 2,
    });
    expect(leanUp.forces).toEqual([3]);

    // Verify all 4 Enemy Intents + null suppression.
    let arcade = createState(world, fixtures["arcade-encore"]!);
    arcade = advanceConfirm(arcade);
    const halfCalm: State = {
      ...arcade,
      battle: { ...arcade.battle!, calm: 80 },
    };
    const viewPuff = battleView(world, halfCalm);
    expect(viewPuff?.bossPhase2?.bossId).toBe("arcade-keeper");
    // 1. Puffing Up (Mr. Pip winds up on turn 2, telegraphed on turn 1).
    expect(viewPuff?.intent?.kind).toBe("puffing-up");
    expect(viewPuff?.intent?.label).toBe("Puffing Up");
    expect(viewPuff?.intent?.frame).toBe("intent-puffing");

    // 2. Swirling Scribbles (Turn 2 without windUp, Phase 2 / whack burst).
    const turn2View = battleView(world, {
      ...halfCalm,
      battle: { ...halfCalm.battle!, turn: 2 },
    });
    expect(turn2View?.intent?.kind).toBe("swirling-scribbles");
    expect(turn2View?.intent?.label).toBe("Swirling Scribbles");
    expect(turn2View?.intent?.frame).toBe("intent-scribbles");

    // 3. Calling Cheer (partner foeIndex > 0 on even turn).
    const evenBattle = { ...arcade.battle!, turn: 2 };
    const cheerIntent = resolveEnemyIntent(
      world, evenBattle, world.critters["pup"]!, evenBattle.foes![1]!, 1, 2,
    );
    expect(cheerIntent?.kind).toBe("calling-cheer");
    expect(cheerIntent?.label).toBe("Calling Cheer");
    expect(cheerIntent?.frame).toBe("intent-cheer");

    // 4. Sharing Fizz (ordinary foe on odd turn without signature burst).
    let bay = createState(world, fixtures["bay-duo"]!);
    bay = advanceConfirm(bay);
    const fizzIntent = resolveEnemyIntent(
      world, bay.battle!, world.critters["pup"]!, bay.battle!.foes![0]!, 0, 2,
    );
    expect(fizzIntent?.kind).toBe("sharing-fizz");
    expect(fizzIntent?.label).toBe("Sharing Fizz");
    expect(fizzIntent?.frame).toBe("intent-fizz");

    // Soothed foe suppresses intent.
    const soothedPup = { ...bay.battle!.foes![0]!, soothed: true };
    expect(
      resolveEnemyIntent(world, bay.battle!, world.critters["pup"]!, soothedPup, 0, 2),
    ).toBeNull();
  });

  it("unlocks and executes all 4 Dual-Friend Synergy Combos with their bespoke effects", () => {
    let base = createState(world, fixtures["bay-duo"]!);
    base = advanceConfirm(base);
    expect(DUAL_COMBOS).toHaveLength(4);
    expect(battleCommands(world, base).map((c) => c.id)).toEqual([
      "soothe", "recover", "snack", "run",
    ]);
    // With only 1 sparkle: no combos unlock.
    expect(
      availableDualCombos(world, base, { ...base.battle!, sparkle: 1 }, "fae"),
    ).toEqual([]);
    // At 2 sparkle on Fae's turn: Lullaby + Lasso Spin (Harmony needs 3, Juggle needs Sue).
    expect(
      availableDualCombos(world, base, { ...base.battle!, sparkle: 2 }, "fae").map((c) => c.id),
    ).toEqual(["combo:yarn-ball-lullaby", "combo:bubblegum-lasso-spin"]);
    // With 2 sparkle on Sue's turn: Lasso Spin + Rainbow Splash-Juggle.
    expect(
      availableDualCombos(world, base, { ...base.battle!, sparkle: 2 }, "sue").map((c) => c.id),
    ).toEqual(["combo:bubblegum-lasso-spin", "combo:rainbow-splash-juggle"]);
    // Missing Maddie hides Yarn-Ball Lullaby and Cloverhollow Harmony.
    const noMaddie: State = {
      ...base,
      party: base.party.filter((m) => m.id !== "maddie"),
    };
    expect(
      availableDualCombos(world, noMaddie, { ...noMaddie.battle!, sparkle: 3 }, "fae")
        .map((c) => c.id),
    ).toEqual(["combo:bubblegum-lasso-spin"]);

    const makeWindUp = (count: number) => ({
      feelings: Array.from({ length: count }, (): FeelingId => "curious"),
      popped: Array.from({ length: count }, () => false),
      left: count,
    });

    // 1. Yarn-Ball Lullaby (Fae + Maddie, cost 2, ring, +1 leaf, +1 burstSoften, pops 1 bubble).
    const lullabyReady: State = {
      ...base,
      battle: {
        ...base.battle!,
        sparkle: 2,
        energy: 3,
        windUp: makeWindUp(2),
        foes: base.battle!.foes!.map((f, i) => (i === 0 ? { ...f, windUp: makeWindUp(2) } : f)),
      },
    };
    const lullabyIdx = battleCommands(world, lullabyReady).findIndex(
      (c) => c.id === "combo:yarn-ball-lullaby",
    );
    expect(lullabyIdx).toBeGreaterThanOrEqual(4);
    let lullaby = stepInstant(lullabyReady, { ...blankInput(), choose: lullabyIdx });
    expect(lullaby.battle?.sparkle).toBeUndefined();
    expect(lullaby.battle?.check?.kind).toBe("ring");
    lullaby = playActiveCheckToGreat(lullaby);
    expect(lullaby.battle?.phase).toBe("result");
    expect(lullaby.battle?.lastGrade).toBe("great");
    expect(lullaby.battle?.energy).toBe(4);
    expect(lullaby.battle?.burstSoften).toBe(1);
    expect(lullaby.battle?.foes?.[0]?.windUp?.popped).toEqual([true, false]);
    expect(lullaby.battle?.foes?.[0]?.calm).toBeGreaterThan(0);
    expect(lullaby.battle?.foes?.[1]?.calm).toBe(0); // single-target scope!

    // 2. Bubblegum Lasso Spin (Fae + Sue, cost 2, spin-snag, all foes, pops 1 bubble, +4 coins).
    const lassoReady: State = {
      ...base,
      coins: 10,
      battle: {
        ...base.battle!,
        sparkle: 3,
        windUp: makeWindUp(2),
        foes: base.battle!.foes!.map((f, i) => (i === 0 ? { ...f, windUp: makeWindUp(2) } : f)),
      },
    };
    const lassoIdx = battleCommands(world, lassoReady).findIndex(
      (c) => c.id === "combo:bubblegum-lasso-spin",
    );
    let lasso = stepInstant(lassoReady, { ...blankInput(), choose: lassoIdx });
    expect(lasso.battle?.sparkle).toBe(1);
    expect(lasso.battle?.check?.kind).toBe("spin-snag");
    expect(soundCues(lassoReady, lasso, world)).toContain("battle-together");
    const spunOnce = stepInstant(lasso, { ...blankInput(), move: { x: 0, y: -1 } });
    expect(soundCues(lasso, spunOnce, world)).toContain("battle-beat");
    lasso = playActiveCheckToGreat(lasso);
    expect(lasso.battle?.phase).toBe("result");
    expect(lasso.battle?.lastGrade).toBe("great");
    expect(lasso.coins).toBe(14); // +4 bonus coins on GREAT!
    expect(lasso.battle?.foes?.[0]?.calm).toBeGreaterThan(0);
    expect(lasso.battle?.foes?.[1]?.calm).toBeGreaterThan(0);
    expect(lasso.battle?.foes?.[0]?.windUp?.popped).toEqual([true, false]);

    // 3. Rainbow Splash-Juggle (Sue + Jordan, cost 2, chain, all foes, pops 2 bubbles).
    const juggleReady: State = {
      ...base,
      battle: {
        ...base.battle!,
        actorIndex: 1, // Sue
        sparkle: 2,
        windUp: makeWindUp(2),
        foes: base.battle!.foes!.map((f, i) => (i === 0 ? { ...f, windUp: makeWindUp(2) } : f)),
      },
    };
    const juggleIdx = battleCommands(world, juggleReady).findIndex(
      (c) => c.id === "combo:rainbow-splash-juggle",
    );
    expect(juggleIdx).toBeGreaterThanOrEqual(4);
    let juggle = stepInstant(juggleReady, { ...blankInput(), choose: juggleIdx });
    expect(juggle.battle?.sparkle).toBeUndefined();
    expect(juggle.battle?.check?.kind).toBe("chain");
    juggle = playActiveCheckToGreat(juggle);
    expect(juggle.battle?.phase).toBe("result");
    expect(juggle.battle?.lastGrade).toBe("great");
    expect(juggle.battle?.foes?.[0]?.calm).toBeGreaterThan(0);
    expect(juggle.battle?.foes?.[1]?.calm).toBeGreaterThan(0);
    expect(juggle.battle?.foes?.[0]?.windUp?.popped).toEqual([true, true]);

    // 4. Cloverhollow Harmony (all 4, cost 3, chain, all foes, +1 leaf, pops all bubbles).
    const almostCalmFoes = base.battle!.foes!.map((foe) => ({
      ...foe,
      calm: foe.calmMax - 15,
      windUp: makeWindUp(2),
    }));
    let harmony: State = {
      ...base,
      battle: {
        ...base.battle!,
        calm: almostCalmFoes[0]!.calm,
        windUp: almostCalmFoes[0]!.windUp,
        foes: almostCalmFoes,
        sparkle: 3,
        energy: 2,
      },
    };
    const harmonyIdx = battleCommands(world, harmony).findIndex(
      (c) => c.id === "combo:cloverhollow-harmony",
    );
    expect(harmonyIdx).toBeGreaterThanOrEqual(4);
    harmony = stepInstant(harmony, { ...blankInput(), choose: harmonyIdx });
    expect(harmony.battle?.sparkle).toBeUndefined();
    expect(harmony.battle?.check?.kind).toBe("chain");
    harmony = playActiveCheckToGreat(harmony);
    expect(harmony.battle?.phase).toBe("result");
    expect(harmony.battle?.energy).toBe(3); // +1 leaf restored!
    expect(harmony.battle?.foes?.every((f) => f.soothed)).toBe(true);
    expect(harmony.battle?.foes?.every((f) => f.windUp?.popped.every(Boolean))).toBe(true);
    // Advance result -> soothed -> reward -> overworld.
    harmony = advanceConfirm(harmony);
    expect(harmony.battle?.phase).toBe("soothed");
    harmony = advanceConfirm(harmony);
    expect(harmony.battle?.phase).toBe("reward");
    const coinsBefore = harmony.coins;
    const xpBefore = harmony.xp;
    harmony = advanceConfirm(harmony);
    expect(harmony.battle).toBeNull();
    const expectedCoins = world.critters["pup"]!.coins + world.critters["crab"]!.coins;
    expect(harmony.coins - coinsBefore).toBe(expectedCoins);
    expect(harmony.xp).toBeGreaterThan(xpBefore);
    expect(harmony.calms["pup"]).toBe(1);
    expect(harmony.calms["crab"]).toBe(1);
    expect(harmony.stickers).toContain(world.critters["pup"]!.sticker.id);
    expect(harmony.stickers).toContain(world.critters["crab"]!.sticker.id);
    for (const member of harmony.party) {
      expect(member.xp).toBeGreaterThan(0);
    }
  });
});
