import type { PartyMember, World } from "./types";

// The party in a battle: everyone with a battle command. Flute friends sit
// battles out (spec 5): they give no command, aren't drawn, and don't count
// toward feelings.
export function battleParty(world: World, party: readonly PartyMember[]): PartyMember[] {
  return party.filter((member) => (world.party[member.id]?.command ?? null) !== null);
}
