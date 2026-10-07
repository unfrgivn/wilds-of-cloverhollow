import { runInk } from "./ink";
import { calmedFacts } from "./sim";
import type { State, World } from "./types";

// Fae's notes, newest first: the `journal` knot's lines for the current story
// state. Runs on a copy of the Ink state and keeps no result, so reading the
// journal never changes the game.
export function journalNotes(world: World, state: State): string[] {
  const calmed = calmedFacts(state);
  const notes: string[] = [];
  let result = runInk(
    world.story,
    state.ink,
    { type: "start", knot: "journal" },
    calmed,
  );
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null)
      notes.push(result.line.text);
    if (result.ended) break;
    result = runInk(world.story, result.ink, { type: "next" }, calmed);
  }
  return notes;
}

export function autosaveNeeded(previous: State, next: State): boolean {
  return (
    (previous.area !== next.area && next.transition === null) ||
    (previous.transition?.phase === "in" && next.transition === null) ||
    (previous.battle !== null && next.battle === null) ||
    (previous.dialogue !== null && next.dialogue === null) ||
    (previous.journalOpen && !next.journalOpen)
  );
}
