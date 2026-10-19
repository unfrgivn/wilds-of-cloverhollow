import type { State, Wild } from "./types";
import { levelForXp } from "./levels";

export type SaveData = { version: 10; state: State };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// A recurring critter's shape. A new game's template has none out (it starts
// in the bedroom), so there is no template element to check them against.
const wildShape: Wild = {
  kind: "",
  den: 0,
  mood: "chaos",
  x: 0,
  y: 0,
  target: { x: 0, y: 0 },
  pauseTicks: 0,
  cooldownTicks: 0,
  facing: "down",
  moving: false,
  notice: 0,
};

// A save is accepted only if it has exactly the shape of a real state: every
// key of `template` (a fresh game state) present with the same primitive type,
// all the way down. Slots that are null in the template (battle, dialogue,
// transition) may hold null or an object. Arrays are checked element by
// element against the template's first element (the party, its trails), and
// the recurring critters against `wildShape`. Anything else is an old or
// broken save, and the game starts fresh rather than crashing later. The one
// exception is content growing: see the critters merge in parseSave.
export function parseSave(json: string, template: State,
  experienceBySpecies: Record<string, number> = {}, thresholds: number[] = [0]): State | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!record(value) || typeof value.version !== "number" || !record(value.state)) return null;
    // Older saves since Milestone 28 carry on, gaining what later versions
    // added as a new game starts it: version 5 had no arcade game or prizes,
    // version 6 no tickets, version 7 no calm counts (they count from then on).
    const upgrades: Record<number, Record<string, unknown>> = {
      5: { arcade: null, prizes: [], tickets: 0, calms: {} },
      6: { tickets: 0, calms: {} },
      7: { calms: {} },
      8: { finale: null },
      9: { xp: 0 },
      10: {},
    };
    const added = upgrades[value.version];
    if (added === undefined) return null;
    const earned = record(value.state.calms)
      ? Object.entries(value.state.calms).reduce((total, [species, count]) =>
        total + (typeof count === "number" && Number.isInteger(count) && count > 0
          ? count * (experienceBySpecies[species] ?? 0) : 0), 0)
      : 0;
    const upgradedXp = value.version < 10 ? earned
      : typeof value.state.xp === "number" ? value.state.xp : -1;
    const faeLevel = levelForXp({ thresholds, stats: { lifeBase: 0, lifeEvery: 1, guardEvery: 1,
      commands: { soothe: { powerBase: 0, powerPerLevel: 0, magicBase: 0, magicPerLevel: 1 } } },
      critters: {} }, upgradedXp);
    const friendXp = thresholds[Math.max(0, Math.min(thresholds.length - 1, faeLevel - 1))] ?? 0;
    const oldParty = Array.isArray(value.state.party) ? value.state.party : [];
    const saved: Record<string, unknown> = {
      ...value.state,
      ...added,
      ...(value.version < 10 ? {
        xp: upgradedXp,
        party: oldParty.map((member) => record(member) ? { ...member, xp: friendXp } : member),
      } : {}),
      ...(value.version < 8 ? { wild: unnoticed(value.state.wild) } : {}),
    };
    if (saved.battle !== null || saved.arcade !== null || saved.finale !== null) return null;
    // Set pieces added by later content start as they would in a new game, so
    // new content never throws a save away.
    const state = record(saved.critters)
      ? { ...saved, critters: { ...template.critters, ...saved.critters } }
      : saved;
    return isState(state, template) ? state : null;
  } catch {
    return null;
  }
}

// Before version 8 no recurring critter had a notice count: none had
// noticed Fae.
function unnoticed(wild: unknown): unknown {
  return Array.isArray(wild)
    ? wild.map((item: unknown) => (record(item) ? { ...item, notice: 0 } : item))
    : wild;
}

function sameShape(template: unknown, value: unknown): boolean {
  if (template === null) return value === null || record(value);
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return false;
    const [first] = template;
    return first === undefined || value.every((item) => sameShape(first, item));
  }
  if (record(template)) {
    if (!record(value)) return false;
    return Object.entries(template).every(([key, child]) => sameShape(child, value[key]));
  }
  return typeof template === typeof value;
}

function isState(value: unknown, template: State): value is State {
  return sameShape(template, value) && record(value) && Array.isArray(value.wild) &&
    value.wild.every((item) => sameShape(wildShape, item));
}

export function serializeSave(state: State): string {
  return JSON.stringify({ version: 10, state } satisfies SaveData);
}
