export type BattlePopupKind =
  | "normal"
  | "big"
  | "fav"
  | "pop"
  | "energy"
  | "assist"
  | "steady"
  | "peek";

export type BattlePopupSide = "critter" | "fae";

export type BattlePopupSpec = {
  kind: BattlePopupKind;
  text: string;
  side: BattlePopupSide;
};

export type BattlePopupSnapshot = {
  battleKey: string;
  calm: number;
  energy: number;
  poppedCount: number;
  message: string;
  tick?: number;
  paused?: boolean;
  fluteUsed?: boolean;
  lassoUsed?: boolean;
  lanternPeek?: boolean;
  togetherActive?: boolean;
  recovered?: boolean;
  bossPhase2?: boolean;
};

/**
 * Pure diff helper comparing the previous and current live battle snapshots to
 * classify Paper-Mario die-cut popups. Returns an empty list on battle open,
 * close, critter switch, or tick rewind so static renders never spawn popups.
 */
export function classifyBattlePopup(
  prev: BattlePopupSnapshot | null,
  next: BattlePopupSnapshot | null,
): BattlePopupSpec[] {
  if (prev === null || next === null) return [];
  if (prev.battleKey !== next.battleKey) return [];
  if (prev.tick !== undefined && next.tick !== undefined && next.tick < prev.tick) {
    return [];
  }

  const popups: BattlePopupSpec[] = [];
  const deltaCalm = Math.round(next.calm - prev.calm);
  if (deltaCalm > 0) {
    const isFav = deltaCalm >= 45 || /favou?rite/i.test(next.message);
    if (isFav) {
      popups.push({ kind: "fav", text: `+${deltaCalm} ♥`, side: "critter" });
    } else if (deltaCalm >= 28) {
      popups.push({ kind: "big", text: `+${deltaCalm} ★`, side: "critter" });
    } else {
      popups.push({ kind: "normal", text: `+${deltaCalm}`, side: "critter" });
    }
  }

  const deltaPopped = next.poppedCount - prev.poppedCount;
  if (deltaPopped > 0) {
    popups.push({ kind: "pop", text: "POP!", side: "critter" });
  }

  const deltaEnergy = Math.round(next.energy - prev.energy);
  if (deltaEnergy > 0) {
    popups.push({ kind: "energy", text: `+${deltaEnergy} ⚡`, side: "fae" });
  }

  if (!prev.recovered && next.recovered === true && next.energy <= prev.energy) {
    popups.push({ kind: "energy", text: "READY! ✦", side: "fae" });
  }

  if (!prev.fluteUsed && next.fluteUsed === true) {
    popups.push({ kind: "assist", text: "FLUTE! ♪", side: "fae" });
  }

  if (!prev.lassoUsed && next.lassoUsed === true) {
    popups.push({ kind: "steady", text: "STEADY! ✦", side: "critter" });
  }

  if (!prev.lanternPeek && next.lanternPeek === true) {
    popups.push({ kind: "peek", text: "MOOD PEEK! ✦", side: "critter" });
  }

  if (!prev.togetherActive && next.togetherActive === true) {
    popups.push({ kind: "big", text: "TOGETHER! ★", side: "fae" });
  }

  if (!prev.bossPhase2 && next.bossPhase2 === true) {
    popups.push({ kind: "big", text: "PHASE 2! ★", side: "critter" });
  }

  return popups;
}
