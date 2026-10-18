import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  autosaveNeeded, createState, npcVisible, parseSave, serializeSave, stableHash, step,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 56: the recorded ending, on from the kid run. Milo's
// last talk under the restored Ancient Tree, the dream saved once, Fae awake in
// her bed with Maddie, the kitchen with Milo by the door, and the credits.
describe("the ending's recording", () => {
  it("saves the dream once, wakes Fae, and closes on the credits", () => {
    const content = loadContent();
    const { world } = content;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    const path = "tests/sim/scripts/pass-party/ending.json";
    let state: State = createState(world, fixture);
    const snapshots: State[] = [];
    let wake: State | null = null;
    let kitchen: State | null = null;
    const morningParties = new Set<string>();
    let morningSaves = 0;
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        const result = step(world, state, segment.frame);
        state = result.state;
        for (const event of result.events)
          if (event.type === "ending-save") snapshots.push(event.state);
        if (state.finale !== null) {
          if (autosaveNeeded(before, state)) morningSaves += 1;
          morningParties.add(state.party.map((member) => member.id).join(","));
        }
        if (wake === null && state.finale === "morning") wake = state;
        if (kitchen === null && state.finale === "morning" && state.area === "kitchen" &&
          state.transition === null) kitchen = state;
      }
    expect(state.tick).toBe(19337);

    // One save at the dream's end: the forest as it is, Milo calm, no fizz.
    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];
    if (snapshot === undefined) throw new Error("no dream snapshot");
    expect(snapshot).toMatchObject({
      area: "enchanted", finale: null, dialogue: null, battle: null, arcade: null,
    });
    expect(snapshot.critters["hooded-kid"]).toBe("calm");
    expect(world.storyVariable(snapshot.ink, "forest_fizzy")).toBe(false);
    const saved = parseSave(serializeSave(snapshot), createState(world, fixture));
    expect(saved === null ? null : stableHash(saved)).toBe(stableHash(snapshot));

    // Awake: the bedroom, Mom's wake-up open, and Maddie alone.
    if (wake === null) throw new Error("Fae never woke up");
    expect(wake.area).toBe("bedroom");
    expect(wake.dialogue?.knot).toBe("mom");
    expect(world.storyVariable(wake.ink, "awake")).toBe(true);
    expect(world.storyVariable(wake.ink, "dreaming")).toBe(false);
    // Jordan stays a friend in the story (in this chain Sue starts with the
    // fixture's party instead), and nobody walks back into the party.
    expect(world.storyVariable(wake.ink, "jordan_joined")).toBe(true);
    expect([...morningParties]).toEqual(["maddie"]);
    expect(morningSaves).toBe(0);

    // The kitchen, Milo by the door; his last line opens the credits.
    if (kitchen === null) throw new Error("Fae never reached the kitchen");
    const milo = world.areas.kitchen?.npcs.find((npc) => npc.id === "milo-hoodie");
    if (milo === undefined) throw new Error("Milo isn't in the kitchen's people");
    expect(npcVisible(world, kitchen, milo)).toBe(true);
    expect(state).toMatchObject({ area: "kitchen", finale: "credits", dialogue: null });
  });
});
