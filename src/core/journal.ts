import { runInk } from "./ink";
import { inkFacts } from "./sim";
import type { State, World } from "./types";

export type LandProgress = { owned: number; total: number };
export type BusRoute = { from: string; to: string; open: boolean };

export function mapLandName(
  land: { id: string; name: string; revealVariable?: string },
  currentLand: string | null,
  isSet: (variable: string) => boolean,
): string {
  return (land.revealVariable !== undefined && currentLand !== land.id &&
    !isSet(land.revealVariable))
    ? "???"
    : land.name;
}

/**
 * Counts owned vs total discoverable stickers per land from the world's areas,
 * critter set pieces, recurring dens, and sticker catalogue.
 */
export function landStickerProgress(
  world: Pick<World, "areas" | "critters" | "lands" | "stickers">,
  state: Pick<State, "stickers">,
): Record<string, LandProgress> {
  const validIds = new Set(world.stickers.catalogue.map((entry) => entry.id));
  const speciesToSticker = new Map<string, string>();
  for (const entry of world.stickers.catalogue) {
    const critter = world.critters[entry.critter];
    if (critter !== undefined) speciesToSticker.set(critter.species, entry.id);
  }
  const perLand = new Map<string, Set<string>>();
  for (const land of world.lands) perLand.set(land.id, new Set());
  for (const area of Object.values(world.areas)) {
    if (area.land === undefined) continue;
    const bucket = perLand.get(area.land);
    if (bucket === undefined) continue;
    const kinds = [
      ...area.critters.map((piece) => piece.id),
      ...(area.recurring?.dens.flatMap((den) => den.kinds) ?? []),
    ];
    for (const kind of kinds) {
      const critter = world.critters[kind];
      if (critter === undefined) continue;
      const stickerId = speciesToSticker.get(critter.species) ?? critter.sticker.id;
      if (validIds.has(stickerId)) bucket.add(stickerId);
    }
  }
  const ownedSet = new Set(state.stickers);
  const result: Record<string, LandProgress> = {};
  for (const land of world.lands) {
    const ids = perLand.get(land.id) ?? new Set<string>();
    let owned = 0;
    for (const id of ids) if (ownedSet.has(id)) owned += 1;
    result[land.id] = { owned, total: ids.size };
  }
  return result;
}

/**
 * The bus network connecting the world's bus-stop lands, with each route's
 * open status driven by the story's bus stop unlock rules.
 */
export function mapBusRoutes(
  lands: readonly { id: string; busStop: boolean }[],
  isSet: (variable: string) => boolean,
  hasSticker: (id: string) => boolean,
): BusRoute[] {
  const stops = new Set(lands.filter((land) => land.busStop).map((land) => land.id));
  const bayOpen = isSet("club_open");
  const passOpen = hasSticker("bay-bluebird");
  const routes: BusRoute[] = [];
  if (stops.has("cloverhollow") && stops.has("bay"))
    routes.push({ from: "cloverhollow", to: "bay", open: bayOpen });
  if (stops.has("cloverhollow") && stops.has("pass"))
    routes.push({ from: "cloverhollow", to: "pass", open: passOpen });
  if (stops.has("bay") && stops.has("pass"))
    routes.push({ from: "bay", to: "pass", open: bayOpen && passOpen });
  return routes;
}

// Fae's notes, newest first: the `journal` knot's lines for the current story
// state. Runs on a copy of the Ink state and keeps no result, so reading the
// journal never changes the game.
export function journalNotes(world: World, state: State): string[] {
  const facts = inkFacts(world, state);
  const notes: string[] = [];
  let result = runInk(world.story, state.ink, { type: "start", knot: "journal" }, facts);
  for (let count = 0; count < 20; count += 1) {
    if (result.line !== null)
      notes.push(result.line.text);
    if (result.ended) break;
    result = runInk(world.story, result.ink, { type: "next" }, facts);
  }
  return notes;
}

export function autosaveNeeded(previous: State, next: State): boolean {
  if (previous.finale !== null || next.finale !== null) return false;
  return (
    (previous.area !== next.area && next.transition === null) ||
    (previous.transition?.phase === "in" && next.transition === null) ||
    (previous.battle !== null && next.battle === null) ||
    (previous.arcade !== null && next.arcade === null) ||
    (previous.dialogue !== null && next.dialogue === null) ||
    (previous.journalOpen && !next.journalOpen)
  );
}
