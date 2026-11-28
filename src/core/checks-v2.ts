import type {
  BattleCheckView,
  BattleContent,
  BeatResult,
  CheckSide,
  Grade,
  SpinSnagSpec,
  SpinSnagState,
  WhackSlot,
  WhackSpec,
  WhackState,
  WhichOneSpec,
  WhichOneState,
} from "./types";

export type CheckV2Spec = WhichOneSpec | WhackSpec | SpinSnagSpec;
export type CheckV2State = WhichOneState | WhackState | SpinSnagState;

export type CheckV2Input = {
  confirmEdge: boolean;
  move?: { x: number; y: number };
  previousMove?: { x: number; y: number };
  choose?: number;
  pointer?: { x: number; y: number };
};

export const WHACK_SLOTS: readonly WhackSlot[] = ["up", "right", "down", "left", "middle"];

const SWAP_PAIRS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 2],
];

function gradeAimV2(delta: number, great: number, good: number): Grade {
  const absolute = Math.abs(delta);
  return absolute <= great ? "great" : absolute <= good ? "good" : "miss";
}

function gradeHitsV2(results: BeatResult[]): Grade | null {
  if (results.some((result) => result === "pending")) return null;
  const hits = results.filter((result) => result === "hit").length;
  return hits === results.length ? "great" : hits * 2 >= results.length ? "good" : "miss";
}

/** Visual slot (0..2) for each cup (0..2) after applying the first `count` swaps. */
export function whichOneSlotsAfter(
  swaps: readonly [number, number][],
  count: number,
): [number, number, number] {
  const slots: [number, number, number] = [0, 1, 2];
  const limit = Math.max(0, Math.min(swaps.length, count));
  for (let index = 0; index < limit; index += 1) {
    const pair = swaps[index];
    if (pair === undefined) continue;
    const [a, b] = pair;
    for (let cup = 0; cup < 3; cup += 1) {
      const current = slots[cup];
      if (current === a) slots[cup] = b;
      else if (current === b) slots[cup] = a;
    }
  }
  return slots;
}

/** Final visual slot (0..2) where `hidingCup` rests after all swaps complete. */
export function whichOneTargetSlot(
  hidingCup: number,
  swaps: readonly [number, number][],
): number {
  const slots = whichOneSlotsAfter(swaps, swaps.length);
  return slots[hidingCup] ?? 1;
}

/**
 * Quadrant sector (0 up, 1 right, 2 down, 3 left, or -1 inside deadzone) from
 * pointer (0..1000 centered at 500, deadzone 110) or stick/arrows (deadzone 0.35).
 * Uses dominant-axis comparison only (zero trig).
 */
export function spinSectorFromInput(
  pointer: { x: number; y: number } | undefined,
  move: { x: number; y: number } | undefined,
): number {
  if (pointer !== undefined) {
    const dx = pointer.x - 500;
    const dy = pointer.y - 500;
    if (dx * dx + dy * dy < 110 * 110) return -1;
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 0 : 2;
    return dx > 0 ? 1 : 3;
  }
  if (move !== undefined) {
    if (move.x * move.x + move.y * move.y < 0.35 * 0.35) return -1;
    if (Math.abs(move.y) >= Math.abs(move.x)) return move.y < 0 ? 0 : 2;
    return move.x > 0 ? 1 : 3;
  }
  return -1;
}

/** Fresh whack swing from confirm edge, directional edges, or direct touch slot tap. */
export function whackSwingFromInput(input: CheckV2Input): WhackSlot | null {
  if (input.choose !== undefined && input.choose >= 0 && input.choose < WHACK_SLOTS.length) {
    return WHACK_SLOTS[input.choose] ?? null;
  }
  if (input.confirmEdge) return "middle";
  const move = input.move ?? { x: 0, y: 0 };
  const prev = input.previousMove ?? { x: 0, y: 0 };
  if (move.y < -0.5 && prev.y >= -0.5) return "up";
  if (move.x > 0.5 && prev.x <= 0.5) return "right";
  if (move.y > 0.5 && prev.y <= 0.5) return "down";
  if (move.x < -0.5 && prev.x >= -0.5) return "left";
  return null;
}

export function checkDrawsV2(spec: CheckV2Spec): number {
  if (spec.kind === "which-one") return 1 + spec.shuffles;
  if (spec.kind === "whack") return spec.pops;
  return 0;
}

export function pickFromDrawV2(spec: CheckV2Spec, value: number): number {
  if (spec.kind === "whack") return Math.min(4, Math.floor(value * 5));
  return Math.min(2, Math.floor(value * 3));
}

export function gentleCheckV2Spec(spec: CheckV2Spec): CheckV2Spec {
  if (spec.kind === "which-one") {
    return {
      ...spec,
      showTicks: spec.showTicks + 8,
      shuffles: Math.max(2, spec.shuffles - 1),
      swapTicks: spec.swapTicks + 8,
      pickTicks: spec.pickTicks + 48,
    };
  }
  if (spec.kind === "whack") {
    return {
      ...spec,
      stayTicks: spec.stayTicks + 10,
      gapTicks: spec.gapTicks + 4,
    };
  }
  const snagTicks = spec.snagTicks + 20;
  const maxWin = Math.max(
    1,
    Math.min(spec.targetTick - 1, snagTicks - 1 - spec.targetTick),
  );
  const greatWindow = Math.min(
    maxWin,
    Math.max(spec.greatWindow + 2, Math.round(spec.greatWindow * 1.5)),
  );
  const goodWindow = Math.min(
    maxWin,
    Math.max(greatWindow, Math.round(spec.goodWindow * 1.5)),
  );
  return {
    ...spec,
    spinsNeeded: Math.max(4, spec.spinsNeeded - 2),
    spinTicks: spec.spinTicks + 36,
    snagTicks,
    greatWindow,
    goodWindow,
  };
}

export function createCheckV2(
  spec: CheckV2Spec,
  side: CheckSide,
  big: boolean,
  picks: number[],
): CheckV2State {
  if (spec.kind === "which-one") {
    const hidingCup = (((picks[0] ?? 1) % 3) + 3) % 3;
    const swaps: [number, number][] = [];
    let prevPairIndex = -1;
    for (let index = 0; index < spec.shuffles; index += 1) {
      let pairIndex = (((picks[index + 1] ?? index) % 3) + 3) % 3;
      if (pairIndex === prevPairIndex) pairIndex = (pairIndex + 1) % 3;
      prevPairIndex = pairIndex;
      const pair = SWAP_PAIRS[pairIndex] ?? [0, 1];
      swaps.push([pair[0], pair[1]]);
    }
    return {
      kind: "which-one",
      side,
      tick: 0,
      spec: { ...spec },
      hidingCup,
      swaps,
      cursor: 1,
      picked: null,
      big,
    };
  }
  if (spec.kind === "whack") {
    const slots: WhackSlot[] = [];
    let prevSlotIndex = -1;
    for (let index = 0; index < spec.pops; index += 1) {
      let slotIndex = (((picks[index] ?? index) % 5) + 5) % 5;
      if (slotIndex === prevSlotIndex) slotIndex = (slotIndex + 1) % 5;
      prevSlotIndex = slotIndex;
      slots.push(WHACK_SLOTS[slotIndex] ?? "middle");
    }
    return {
      kind: "whack",
      side,
      tick: 0,
      spec: { ...spec },
      slots,
      results: slots.map(() => "pending"),
      lastSwing: null,
      big,
    };
  }
  return {
    kind: "spin-snag",
    side,
    tick: 0,
    spec: { ...spec },
    lastSector: -1,
    turns: 0,
    snagTick: 0,
    big,
  };
}

function stepWhichOne(
  check: WhichOneState,
  tick: number,
  input: CheckV2Input,
): { check: WhichOneState; grade: Grade | null } {
  const shuffleEnd = check.spec.showTicks + check.spec.shuffles * check.spec.swapTicks;
  if (tick <= shuffleEnd) {
    return { check: { ...check, tick }, grade: null };
  }
  let cursor = check.cursor;
  let picked = check.picked;
  if (input.choose === 0 || input.choose === 1 || input.choose === 2) {
    cursor = input.choose;
    picked = input.choose;
  } else {
    const move = input.move ?? { x: 0, y: 0 };
    const prev = input.previousMove ?? { x: 0, y: 0 };
    const leftEdge = move.x < -0.5 && prev.x >= -0.5;
    const rightEdge = move.x > 0.5 && prev.x <= 0.5;
    if (leftEdge) cursor = (cursor + 2) % 3;
    else if (rightEdge) cursor = (cursor + 1) % 3;
    if (input.confirmEdge) picked = cursor;
  }
  if (picked !== null) {
    const targetSlot = whichOneTargetSlot(check.hidingCup, check.swaps);
    const grade: Grade =
      picked === targetSlot
        ? "great"
        : Math.abs(picked - targetSlot) === 1
          ? "good"
          : "miss";
    return { check: { ...check, tick, cursor, picked }, grade };
  }
  const timedOut = tick >= shuffleEnd + check.spec.pickTicks;
  return { check: { ...check, tick, cursor }, grade: timedOut ? "miss" : null };
}

function stepWhack(
  check: WhackState,
  tick: number,
  input: CheckV2Input,
): { check: WhackState; grade: Grade | null } {
  const { pops, stayTicks, gapTicks } = check.spec;
  const stride = stayTicks + gapTicks;
  const results = [...check.results];
  for (let index = 0; index < pops; index += 1) {
    const popEnd = index * stride + stayTicks;
    if (results[index] === "pending" && tick > popEnd) {
      results[index] = "miss";
    }
  }
  let lastSwing =
    check.lastSwing !== null && check.lastSwing.ticksLeft > 1
      ? { ...check.lastSwing, ticksLeft: check.lastSwing.ticksLeft - 1 }
      : null;
  const activeIndex = Math.floor((tick - 1) / stride);
  const inSlot = (tick - 1) % stride;
  const isActive =
    activeIndex >= 0 &&
    activeIndex < pops &&
    inSlot < stayTicks &&
    results[activeIndex] === "pending";
  const swing = whackSwingFromInput(input);
  if (swing !== null && isActive) {
    const hit = swing === check.slots[activeIndex];
    results[activeIndex] = hit ? "hit" : "miss";
    lastSwing = { slot: swing, hit, ticksLeft: 10 };
  }
  // Resolve the final pop cleanly on the last tick of its stay window.
  if (isActive && activeIndex === pops - 1 && inSlot === stayTicks - 1 &&
      results[activeIndex] === "pending") {
    results[activeIndex] = "miss";
  }
  return {
    check: { ...check, tick, results, lastSwing },
    grade: gradeHitsV2(results),
  };
}

function stepSpinSnag(
  check: SpinSnagState,
  tick: number,
  input: CheckV2Input,
): { check: SpinSnagState; grade: Grade | null } {
  const { spec } = check;
  if (check.turns < spec.spinsNeeded) {
    const sector = spinSectorFromInput(input.pointer, input.move);
    let lastSector = check.lastSector;
    let turns = check.turns;
    if (sector >= 0) {
      if (
        lastSector === -1 ||
        sector === (lastSector + 1) % 4 ||
        sector === (lastSector + 3) % 4
      ) {
        turns += 1;
        lastSector = sector;
      }
    }
    if (turns < spec.spinsNeeded && tick >= spec.spinTicks) {
      const grade: Grade = turns * 2 >= spec.spinsNeeded ? "good" : "miss";
      return { check: { ...check, tick, lastSector, turns }, grade };
    }
    return { check: { ...check, tick, lastSector, turns }, grade: null };
  }
  const snagTick = check.snagTick + 1;
  const grade = input.confirmEdge
    ? gradeAimV2(snagTick - spec.targetTick, spec.greatWindow, spec.goodWindow)
    : snagTick >= spec.snagTicks
      ? "miss"
      : null;
  return { check: { ...check, tick, snagTick }, grade };
}

export function stepCheckV2(
  check: CheckV2State,
  tick: number,
  input: CheckV2Input,
): { check: CheckV2State; grade: Grade | null } {
  if (check.kind === "which-one") return stepWhichOne(check, tick, input);
  if (check.kind === "whack") return stepWhack(check, tick, input);
  return stepSpinSnag(check, tick, input);
}

export function viewCheckV2(check: CheckV2State): BattleCheckView {
  if (check.kind === "which-one") {
    const { showTicks, shuffles, swapTicks, pickTicks } = check.spec;
    const shuffleEnd = showTicks + shuffles * swapTicks;
    const targetSlot = whichOneTargetSlot(check.hidingCup, check.swaps);
    if (check.tick <= showTicks) {
      return {
        kind: "which-one",
        side: check.side,
        phase: "show",
        hidingCup: check.hidingCup,
        cupSlots: [0, 1, 2],
        activeSwap: null,
        cursor: check.cursor,
        picked: check.picked,
        targetSlot,
        time: 1,
        revealProgress: Math.max(0, Math.min(1, check.tick / Math.max(1, showTicks))),
      };
    }
    if (check.tick <= shuffleEnd) {
      const elapsed = check.tick - showTicks - 1;
      const swapIndex = Math.floor(elapsed / Math.max(1, swapTicks));
      const inSwap = elapsed % Math.max(1, swapTicks);
      const pair = check.swaps[swapIndex] ?? [0, 1];
      return {
        kind: "which-one",
        side: check.side,
        phase: "shuffle",
        hidingCup: check.hidingCup,
        cupSlots: whichOneSlotsAfter(check.swaps, swapIndex),
        activeSwap: {
          pair: [pair[0], pair[1]],
          progress: Math.max(0, Math.min(1, (inSwap + 1) / Math.max(1, swapTicks))),
        },
        cursor: check.cursor,
        picked: check.picked,
        targetSlot,
        time: 1,
        revealProgress: 1,
      };
    }
    const remaining = 1 - (check.tick - shuffleEnd) / Math.max(1, pickTicks);
    return {
      kind: "which-one",
      side: check.side,
      phase: "pick",
      hidingCup: check.hidingCup,
      cupSlots: whichOneSlotsAfter(check.swaps, check.swaps.length),
      activeSwap: null,
      cursor: check.cursor,
      picked: check.picked,
      targetSlot,
      time: Math.max(0, Math.min(1, remaining)),
      revealProgress: 1,
    };
  }
  if (check.kind === "whack") {
    const stride = check.spec.stayTicks + check.spec.gapTicks;
    let activeSlot: WhackSlot | null = null;
    let activeIndex = -1;
    let activeProgress = 0;
    if (check.tick > 0) {
      const index = Math.floor((check.tick - 1) / stride);
      const inSlot = (check.tick - 1) % stride;
      if (
        index >= 0 &&
        index < check.slots.length &&
        inSlot < check.spec.stayTicks &&
        check.results[index] === "pending"
      ) {
        activeSlot = check.slots[index] ?? null;
        activeIndex = index;
        activeProgress = Math.max(
          0,
          Math.min(1, (inSlot + 1) / Math.max(1, check.spec.stayTicks)),
        );
      }
    }
    return {
      kind: "whack",
      side: check.side,
      activeSlot,
      activeIndex,
      activeProgress,
      results: [...check.results],
      lastSwing: check.lastSwing === null
        ? null
        : { slot: check.lastSwing.slot, hit: check.lastSwing.hit },
    };
  }
  const { spinsNeeded, spinTicks, snagTicks, targetTick, greatWindow, goodWindow } = check.spec;
  const inSnag = check.turns >= spinsNeeded;
  return {
    kind: "spin-snag",
    side: check.side,
    phase: inSnag ? "snag" : "spin",
    turns: check.turns,
    spinsNeeded,
    lastSector: check.lastSector,
    spinTime: inSnag ? 0 : Math.max(0, Math.min(1, 1 - check.tick / Math.max(1, spinTicks))),
    snagProgress: inSnag ? Math.max(0, Math.min(1, check.snagTick / Math.max(1, snagTicks))) : 0,
    snagTarget: targetTick / Math.max(1, snagTicks),
    greatWindow: [(targetTick - greatWindow) / snagTicks, (targetTick + greatWindow) / snagTicks],
    goodWindow: [(targetTick - goodWindow) / snagTicks, (targetTick + goodWindow) / snagTicks],
  };
}

export function checkHintV2(
  check: CheckV2State,
  hints: Partial<BattleContent["hints"]>,
): string | null {
  if (check.kind === "which-one") {
    return check.picked === null ? (hints["which-one"] ?? null) : null;
  }
  if (check.kind === "whack") {
    return check.results[0] === "pending" ? (hints.whack ?? null) : null;
  }
  if (check.turns === 0 || (check.turns >= check.spec.spinsNeeded && check.snagTick === 0)) {
    return hints["spin-snag"] ?? null;
  }
  return null;
}
