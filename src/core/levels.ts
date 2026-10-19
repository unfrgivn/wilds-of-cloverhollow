import type { Grade } from "./types";

export type LevelStats = { power: number; magic: number; life: number; guard: number };
export type CritterLevel = {
  level: number;
  calmMax: number;
  burst: number;
  bigBurst: number;
  xp: number;
};
export type LevelContent = {
  thresholds: number[];
  stats: { lifeBase: number; lifeEvery: number; guardEvery: number;
    commands: Record<string, { powerBase: number; powerPerLevel: number;
      magicBase: number; magicPerLevel: number }> };
  critters: Record<string, CritterLevel>;
};

export function levelForXp(table: LevelContent, xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let index = 1; index < table.thresholds.length; index += 1) {
    if ((table.thresholds[index] ?? Number.MAX_SAFE_INTEGER) > safe) break;
    level = index + 1;
  }
  return Math.min(99, level);
}

export function statsForLevel(table: LevelContent, level: number): LevelStats {
  return statsForCommand(table, "soothe", level);
}

export function statsForCommand(table: LevelContent, command: string, level: number): LevelStats {
  const clamped = Math.max(1, Math.min(99, Math.floor(level)));
  const rules = table.stats;
  const commandRules = rules.commands[command] ?? rules.commands.soothe;
  if (commandRules === undefined) throw new Error("levels.json has no soothe command");
  return {
    power: commandRules.powerBase + (clamped - 1) * commandRules.powerPerLevel,
    magic: commandRules.magicBase + Math.floor((clamped - 1) / commandRules.magicPerLevel),
    life: rules.lifeBase + Math.floor((clamped - 1) / rules.lifeEvery),
    guard: Math.floor((clamped - 1) / rules.guardEvery),
  };
}

export function calmRecipients(faeXp: number, friendXp: Record<string, number>,
  commandOwner: string | null, amount: number): {
    faeXp: number; friendXp: Record<string, number>;
  } {
  return { faeXp: faeXp + amount,
    friendXp: Object.fromEntries(Object.entries(friendXp).map(([id, xp]) =>
      [id, xp + (id === commandOwner ? amount : 0)])) };
}

export function calmExperience(table: LevelContent, critterId: string, miniBoss = false,
  hoodedKid = false): number {
  const kind = table.critters[critterId];
  if (kind === undefined) return 0;
  return kind.xp * (hoodedKid ? 4 : miniBoss ? 3 : 1);
}

export function burstDamage(table: LevelContent, critterId: string, grade: Grade,
  big: boolean, guard: number): number {
  const kind = table.critters[critterId];
  if (kind === undefined || grade === "great") return 0;
  const raw = grade === "good" ? (big ? kind.bigBurst : kind.burst) - 1
    : big ? kind.bigBurst : kind.burst;
  return Math.max(grade === "miss" ? 1 : 0, raw - guard);
}

export function levelUpDelta(table: LevelContent, previousXp: number, nextXp: number) {
  const before = levelForXp(table, previousXp);
  const after = levelForXp(table, nextXp);
  return { before, after, levels: Math.max(0, after - before),
    beforeStats: statsForLevel(table, before), afterStats: statsForLevel(table, after) };
}

export function levelUpLine(name: string, from: number, to: number,
  deltas: LevelStats, friend = false): string {
  const changes = [`Power +${deltas.power}`, `Magic +${deltas.magic}`];
  if (!friend) changes.push(`Life +${deltas.life}`, `Guard +${deltas.guard}`);
  return `${name} reached level ${to}! ${changes.join(", ")}.`;
}
