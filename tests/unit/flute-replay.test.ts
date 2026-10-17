import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  battleCommands,
  createState,
  journalNotes,
  presentCritters,
  step,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 47: the recorded flute-friends run, on from the field
// run (recess). Out of school with the nurse's hall pass, to the park: the
// den's pup calmed, his tale, then a pat and a snack (he's a friend); the flute
// calls him and he follows; a battle he sits out (whatever the park rolls next:
// out to the plaza and back if it's empty); he swims out for the pond's tin;
// the flute sends him home.
describe("flute friends replay", () => {
  it("befriends the Pond Pup, calls him, fetches the tin, and sends him home", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const field = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/field.json", "utf8")), "field.json");
    const fieldEnd = field.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const parties: string[] = [];
    const battles: { critter: string; party: string[]; commands: string[] }[] = [];
    // The snack the bond takes, as the line that shares it is shown.
    let shared: { before: number; after: number } | null = null;
    let coinsBeforePond = -1;
    // When he joins: the calm pups out in the park, before and after.
    let calmPups: { before: number; after: number } | null = null;
    const calm = (at: State): number => presentCritters(world, at)
      .filter((critter) => critter.kind.id === "pup" && critter.mood === "calm").length;
    const path = "tests/sim/scripts/pass-party/flute.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= fieldEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) {
          knots.push(knot);
          if (knot === "pond") coinsBeforePond = before.coins;
        }
        if (!before.party.some((member) => member.id === "pond-pup") &&
            state.party.some((member) => member.id === "pond-pup"))
          calmPups = { before: calm(before), after: calm(state) };
        const party = state.party.map((member) => member.id).join(",");
        if (parties.at(-1) !== party) parties.push(party);
        if (before.battle === null && state.battle !== null)
          battles.push({ critter: state.battle.critterId,
            party: state.party.map((member) => member.id),
            commands: battleCommands(world, state).map((command) => command.id) });
        if (world.storyVariable(before.ink, "pup_fed") !== true &&
            world.storyVariable(state.ink, "pup_fed") === true)
          shared = { before: before.snacks, after: state.snacks };
      }
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect(areas.slice(0, 6)).toEqual(["field", "gym", "east-hall", "school", "plaza", "park"]);
    expect(areas.at(-1)).toBe("park");
    expect(knots).toEqual(["nurse", "pup_calm", "pup_calm", "flute", "pond", "flute"]);
    expect(parties).toEqual(["maddie,sue,jordan", "maddie,sue,jordan,pond-pup",
      "maddie,sue,jordan"]);
    // The calm pup Fae befriended is the one who came: he stepped out of the park.
    expect(calmPups).toEqual({ before: 1, after: 0 });
    // The park's pup first; then a battle he came along to, and sat out.
    expect(battles).toHaveLength(2);
    expect(battles[0]?.critter).toBe("pup");
    const along = battles[1];
    expect(along?.party).toContain("pond-pup");
    expect(along?.commands).toEqual(battles[0]?.commands);
    expect({ friend: story("pup_friend"), along: story("pup_with_me"), tin: story("pond_tin"),
      pass: story("hall_pass") }).toEqual({ friend: true, along: false, tin: true, pass: true });
    // A snack for the bond, twelve coins from the tin.
    expect(shared).toEqual({ before: 2, after: 1 });
    expect(state.coins - coinsBeforePond).toBe(12);
    expect({ area: state.area, dialogue: state.dialogue, battle: state.battle })
      .toEqual({ area: "park", dialogue: null, battle: null });
    expect(journalNotes(world, state).slice(0, 2)).toEqual([
      "The Pond Pup swam out into the park pond and fetched an old tin of coins!",
      "The Pond Pup is my friend! When I play my flute, he comes running.",
    ]);
  });
});
