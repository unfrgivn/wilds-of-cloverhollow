import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createState, journalNotes, step, type State } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Contract for Milestone 52: the recorded clubhouse kitchen, on from the lasso
// run (the classroom). Home, where Mom gives the club her microwave and her toy
// chest and Fae takes a box of dino nuggets; the bus up the mountain, the old
// trail, the clubhouse; the nuggets cooked golden; the keepsake chest opened.
describe("kitchen replay", () => {
  it("gets the microwave and the chest, cooks the nuggets golden, and opens the chest", () => {
    const content = loadContent();
    const world = content.world;
    const fixture = content.fixtures["pass-party"];
    if (fixture === undefined) throw new Error("pass-party fixture missing");
    let state: State = createState(world, fixture);
    const lasso = parseScript(JSON.parse(readFileSync(
      "tests/sim/scripts/pass-party/lasso.json", "utf8")), "lasso.json");
    const lassoEnd = lasso.reduce((sum, segment) => sum + segment.ticks, 0);
    const areas: string[] = [];
    const knots: string[] = [];
    const microwave: string[] = [];
    const paid: { phase: string | null; snacks: number }[] = [];
    let chest: string[] = [];
    const path = "tests/sim/scripts/pass-party/kitchen.json";
    for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
      for (let tick = 0; tick < segment.ticks; tick += 1) {
        const before = state;
        state = step(world, state, segment.frame).state;
        if (state.tick <= lassoEnd) continue;
        if (areas.at(-1) !== state.area) areas.push(state.area);
        const knot = state.dialogue?.knot;
        if (knot !== undefined && before.dialogue?.knot !== knot) knots.push(knot);
        if (knot === "club_chest" && state.dialogue !== null &&
          chest.at(-1) !== state.dialogue.text) chest = [...chest, state.dialogue.text];
        const open = state.arcade?.game === "cook" ? state.arcade : null;
        const shown = open === null ? "closed" : `${open.phase} ${open.cooked}`;
        const was = before.arcade?.game === "cook" ? before.arcade.phase : "closed";
        if ((open?.phase ?? "closed") !== was) microwave.push(shown);
        if (state.snacks !== before.snacks)
          paid.push({ phase: open?.phase ?? null, snacks: state.snacks - before.snacks });
      }
    expect(areas).toEqual(["classroom", "school", "plaza", "kitchen", "plaza", "pass", "woods",
      "clubhouse"]);
    expect(knots).toEqual(["mom", "fridge", "bus_stop", "club_fridge", "club_chest"]);
    // Pressed, held to the box's minute, let go: golden, three snacks, closed.
    const minute = world.arcade.cook.dishes.nuggets.time * world.arcade.cook.ticksPerSecond;
    expect(microwave).toEqual(["ready 0", "cooking 1", `ding ${minute}`, `result ${minute}`,
      "closed"]);
    expect(paid).toEqual([{ phase: "result", snacks: 3 }]);
    expect(chest).toEqual([
      "Fae lifts the lid of the old toy chest. Everything she's found on her adventures is " +
      "in here!",
      "The purple thread from the Pond Pup's tennis ball. It came from a purple hood!",
      "The note from under the comics: \"NEXT STOP: THE ARCADE. FIZZ THE HIGH SCORES!\"",
      "The purple marker the hooded kid dropped at school.",
      "The Star Racer token from the hooded kid's stash. I'll give it back when I find them!",
      "The old tin the Pond Pup fetched out of the park pond.",
      "The treasure map from the bottle by Sue's dock. X marked the spot!",
      "A bow from the tail of Rosie's kite. She gave it to me for getting it down!",
      "Fae closes the lid gently.",
    ]);
    const story = (name: string): unknown => world.storyVariable(state.ink, name);
    expect([story("has_microwave"), story("has_chest"), story("has_nuggets"),
      story("meals_cooked")]).toEqual([true, true, false, "1"]);
    expect({ area: state.area, dialogue: state.dialogue, arcade: state.arcade })
      .toEqual({ area: "clubhouse", dialogue: null, arcade: null });
    expect(journalNotes(world, state)).toEqual(expect.arrayContaining([
      "Mom's freezer has dino nuggets and mac n cheese for the clubhouse microwave.",
      "Mom gave our club her old toy chest. My treasures from my adventures are in it!",
    ]));
    // A long replay (the whole chain to here): room on a busy machine.
  }, 30_000);
});
