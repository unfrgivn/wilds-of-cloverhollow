import type { State, Wild } from "./types";

export type SaveData = { version: 5; state: State };

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
};

// A save is accepted only if it has exactly the shape of a real state: every
// key of `template` (a fresh game state) present with the same primitive type,
// all the way down. Slots that are null in the template (battle, dialogue,
// transition) may hold null or an object. Arrays are checked element by
// element against the template's first element (the party, its trails), and
// the recurring critters against `wildShape`. Anything else is an old or
// broken save, and the game starts fresh rather than crashing later. The one
// exception is content growing: see the critters merge in parseSave.
export function parseSave(json: string, template: State): State | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!record(value) || value.version !== 5 || !record(value.state)) return null;
    // Set pieces added by later content start as they would in a new game, so
    // new content never throws a save away.
    const saved = value.state;
    const state = record(saved.critters)
      ? { ...saved, critters: { ...template.critters, ...saved.critters } }
      : saved;
    return isState(state, template) ? state : null;
  } catch {
    return null;
  }
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
  return JSON.stringify({ version: 5, state } satisfies SaveData);
}
