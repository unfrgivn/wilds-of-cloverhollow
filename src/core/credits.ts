import type { State, World } from "./types";

export type CreditImage = { atlas: string; frame: string };
export type CreditEntry = { section: "friends" | "met"; name: string; image: CreditImage };

export function creditEntries(world: World, state: State): CreditEntry[] {
  // A friend is in the credits if they start with Fae, or once the story says
  // they became her friend: `befriended` (a flute friend's `joins` only says
  // it's following now), else the variable that adds them to the party.
  const friends = Object.values(world.party).filter((member) => {
    if (member.start) return true;
    const flag = member.befriended ?? member.joins;
    return flag !== null && world.storyVariable(state.ink, flag) === true;
  });
  const entries: CreditEntry[] = friends.map((member) => ({
    section: "friends",
    name: member.name,
    image: { atlas: member.atlas, frame: "down_idle_01" },
  }));
  for (const id of state.stickers) {
    const sticker = world.stickers.catalogue.find((item) => item.id === id);
    if (sticker === undefined) throw new Error(`Unknown credit sticker: ${id}`);
    const critter = world.critters[sticker.critter];
    if (critter === undefined) throw new Error(`Unknown credit critter: ${sticker.critter}`);
    entries.push({ section: "met", name: sticker.name,
      image: { atlas: critter.atlas, frame: sticker.frame } });
  }
  return entries;
}
