import type { State } from "./types";

export type SaveData = { version: 1; state: State };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// A save is accepted only if it has exactly the shape of a real state: every
// key of `template` (a fresh game state) present with the same primitive type,
// all the way down. Slots that are null in the template (battle, dialogue,
// transition) may hold null or an object. Anything else is an old or broken
// save, and the game starts fresh rather than crashing later. The one
// exception is content growing: see the critters merge in parseSave.
export function parseSave(json: string, template: State): State | null {
  try {
    const value: unknown = JSON.parse(json);
    if (!record(value) || value.version !== 1 || !record(value.state)) return null;
    // Critters added by later content start as they would in a new game, so
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
  if (Array.isArray(template)) return Array.isArray(value);
  if (record(template)) {
    if (!record(value)) return false;
    return Object.entries(template).every(([key, child]) => sameShape(child, value[key]));
  }
  return typeof template === typeof value;
}

function isState(value: unknown, template: State): value is State {
  return sameShape(template, value);
}

export function serializeSave(state: State): string {
  return JSON.stringify({ version: 1, state } satisfies SaveData);
}
