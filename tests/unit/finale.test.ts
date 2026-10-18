import { describe, expect, it } from "vitest";
import {
  autosaveNeeded,
  blankInput,
  creditEntries,
  createState,
  parseSave,
  serializeSave,
  stableHash,
  startDialogue,
  step,
  inkFacts,
  runInk,
  npcVisible,
  type ActionFrame,
  type State,
} from "../../src/core";
import {
  endingContentErrors, loadContent, parsePartyMember, storyTagErrors,
} from "../../src/content/load";
import { titleFlow } from "../../src/shell/title-flow";
import { creditsConfirmAllowed } from "../../src/shell/credits-flow";
import { atlasImage } from "../../src/ui/atlas";
import maddieAtlas from "../../public/assets/characters/maddie/maddie.json";
import squirrelJson from "../../content/party/acorn-squirrel.json";

const content = loadContent();
const fixture = content.fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const fresh = createState(content.world, fixture);

const confirm = (): ActionFrame => ({ ...blankInput(), confirm: true });
const advanceDialogue = (state: State): { state: State; ending: State | null } => {
  let current = state;
  let ending: State | null = null;
  for (let index = 0; index < 40 && current.dialogue !== null; index += 1) {
    const shown = step(content.world, current, confirm());
    current = shown.state;
    for (const event of shown.events)
      if (event.type === "ending-save") {
        expect(ending).toBeNull();
        ending = event.state;
        return { state: current, ending };
      }
    current = step(content.world, current, blankInput()).state;
  }
  return { state: current, ending };
};
// The real wake-up: the ending's last line under the tree, then Mom's.
const wake = (): State => {
  const forest = createState(content.world, { area: "enchanted", spawn: "mist" });
  const ending = advanceDialogue(startDialogue(content.world, forest, "tree_ending"));
  return advanceDialogue(ending.state).state;
};

describe("the dream's end", () => {
  it("upgrades version 8, refuses a finale save, and round-trips the dream", () => {
    const old = JSON.stringify({ version: 8, state: fresh });
    expect(parseSave(old, fresh)?.finale).toBeNull();
    for (const finale of ["morning", "credits"] as const)
      expect(parseSave(JSON.stringify({ version: 9, state: { ...fresh, finale } }), fresh))
        .toBeNull();
    const restored = parseSave(serializeSave(fresh), fresh);
    expect(restored).not.toBeNull();
    expect(stableHash(restored)).toBe(stableHash(fresh));
  });

  it("saves the live forest state once, then opens Mom's morning", () => {
    const forest = createState(content.world, {
      area: "enchanted", spawn: "mist", party: ["maddie", "sue", "jordan"],
    });
    const started = startDialogue(content.world, forest, "tree_ending");
    const result = advanceDialogue(started);
    expect(result.ending).toEqual(expect.objectContaining({
      area: "enchanted",
      player: forest.player,
      safeSpot: forest.safeSpot,
      dialogue: null,
      transition: null,
      battle: null,
      arcade: null,
      finale: null,
    }));
    expect(result.state.area).toBe("bedroom");
    expect(result.state.safeSpot).toEqual({ area: "bedroom", spawn: "bed" });
    expect(result.state.finale).toBe("morning");
    expect(result.state.party.map((member) => member.id)).toEqual(["maddie"]);
    expect(content.world.storyVariable(result.state.ink, "awake")).toBe(true);
    expect(content.world.storyVariable(result.state.ink, "dreaming")).toBe(false);
    expect(result.state.dialogue?.knot).toBe("mom");
    expect(result.ending).not.toBeNull();
    const restored = parseSave(serializeSave(result.ending!), fresh);
    expect(stableHash(restored)).toBe(stableHash(result.ending));
  });

  it("does not autosave any morning activity", () => {
    const morning = { ...fresh, finale: "morning" as const };
    expect(autosaveNeeded(morning, { ...morning, area: "kitchen" })).toBe(false);
    expect(autosaveNeeded(morning, { ...morning, dialogue: null })).toBe(false);
    expect(autosaveNeeded(morning, { ...morning, journalOpen: true })).toBe(false);
  });

  it("builds credits from the party and owned species stickers", () => {
    const join = (ink: string, knot: string): string => {
      let result = runInk(content.world.story, ink, { type: "start", knot },
        inkFacts(content.world, { ...fresh, ink }));
      for (let index = 0; index < 20; index += 1) {
        if (result.choices.length > 0)
          return runInk(content.world.story, result.ink,
            { type: "choose", index: 0 },
            inkFacts(content.world, { ...fresh, ink: result.ink })).ink;
        result = runInk(content.world.story, result.ink, { type: "next" },
          inkFacts(content.world, { ...fresh, ink: result.ink }));
      }
      throw new Error(`could not join ${knot}`);
    };
    const state = {
      ...fresh,
      ink: join(join(fresh.ink, "sue"), "jordan"),
      stickers: ["fountain-frog", "cozy-cat"],
    };
    expect(creditEntries(content.world, state).map((entry) => entry.name)).toEqual([
      "Maddie", "Sue", "Jordan", "Fountain Frog", "Cozy Cat",
    ]);
    expect(() => creditEntries(content.world, { ...state, stickers: ["unknown"] }))
      .toThrow("Unknown credit sticker");
  });

  it("credits a flute friend once befriended, not just for following", () => {
    // Story flags set in the saved Ink state: the moments that set them (the
    // bonds, the flute) are Milestones 47's and 60's and are tested there.
    const withFlags = (...names: string[]): State => {
      const saved: unknown = JSON.parse(fresh.ink);
      if (typeof saved !== "object" || saved === null || !("variablesState" in saved) ||
        typeof saved.variablesState !== "object" || saved.variablesState === null)
        throw new Error("no variables in the saved story");
      const variables: Record<string, unknown> = { ...saved.variablesState };
      for (const name of names) {
        if (content.world.storyVariable(fresh.ink, name) !== false)
          throw new Error(`no flag ${name}`);
        variables[name] = true;
      }
      return { ...fresh, ink: JSON.stringify({ ...saved, variablesState: variables }) };
    };
    const friends = (state: State): string[] => creditEntries(content.world, state)
      .filter((entry) => entry.section === "friends").map((entry) => entry.name);
    expect(friends(withFlags("pup_with_me", "squirrel_with_me"))).toEqual(["Maddie"]);
    expect(friends(withFlags("pup_friend", "squirrel_friend")))
      .toEqual(["Maddie", "Pond Pup", "Acorn Squirrel"]);
    // Every flute friend names its own befriended variable.
    const nameless = Object.fromEntries(Object.entries(squirrelJson)
      .filter(([key]) => key !== "befriended"));
    expect(parsePartyMember(squirrelJson, "acorn-squirrel.json").befriended)
      .toBe("squirrel_friend");
    expect(() => parsePartyMember(nameless, "acorn-squirrel.json"))
      .toThrow(/flute\/befriended/);
  });

  it("rejects finale tags with arguments", () => {
    expect(storyTagErrors(["ending now", "credits: later"], content.world.areas))
      .toHaveLength(2);
  });

  it("closes the morning door scene into credits and title Continue", () => {
    let state = startDialogue(
      content.world,
      { ...fresh, finale: "morning" },
      "front_door_morning",
    );
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      state = step(content.world, state, confirm()).state;
      state = step(content.world, state, blankInput()).state;
    }
    expect(state.finale).toBe("credits");
    expect(titleFlow("continue", "continue", {
      up: false, down: false, left: false, right: false,
      confirm: true, cancel: false,
    })).toEqual({ mode: null, selected: "continue", action: "continue" });
  });

  it("holds the confirm beat after credits open", () => {
    expect(creditsConfirmAllowed(1, true)).toBe(false);
    expect(creditsConfirmAllowed(12, true)).toBe(true);
    expect(creditsConfirmAllowed(12, false)).toBe(false);
  });

  it("freezes the world while credits are showing", () => {
    const credits = { ...fresh, finale: "credits" as const };
    const stepped = step(content.world, credits, {
      ...blankInput(), move: { x: 1, y: 1 }, menu: true, cancel: true,
      lantern: true, flute: true,
    }).state;
    expect(stepped.player).toEqual(credits.player);
    expect(stepped.area).toBe(credits.area);
    expect(stepped.journalOpen).toBe(false);
    expect(stepped.dialogue).toBeNull();
  });

  it("resolves a real atlas frame and rejects unknown frames", () => {
    expect(atlasImage(maddieAtlas, "assets/characters/maddie/maddie.png", "down_idle_01"))
      .toEqual({
        src: "assets/characters/maddie/maddie.png",
        frame: { x: 0, y: 0, w: 256, h: 256 },
        atlas: { w: 1280, h: 1280 },
      });
    expect(() => atlasImage(maddieAtlas, "maddie.png", "missing")).toThrow("Unknown atlas frame");
  });

  it("ignores the lantern and flute presses during the morning", () => {
    const morning = { ...fresh, finale: "morning" as const };
    const lantern = step(content.world, morning, { ...blankInput(), lantern: true }).state;
    const flute = step(content.world, morning, { ...blankInput(), flute: true }).state;
    expect(lantern.lantern).toBe(false);
    expect(flute.dialogue).toBeNull();
  });

  it("shows Milo only in the morning and closes his talk into credits", () => {
    const forest = createState(content.world, { area: "kitchen", spawn: "stairs" });
    const morning = { ...forest, finale: "morning" as const,
      ink: startDialogue(content.world, forest, "morning_start").ink };
    const kitchen = content.world.areas.kitchen;
    if (kitchen === undefined) throw new Error("kitchen missing");
    const milo = kitchen.npcs.find((npc) => npc.id === "milo-hoodie");
    if (milo === undefined) throw new Error("Milo NPC missing");
    expect(npcVisible(content.world, forest, milo)).toBe(false);
    expect(npcVisible(content.world, morning, milo)).toBe(true);
    let state = startDialogue(content.world, morning, "front_door_morning");
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      state = step(content.world, state, confirm()).state;
      state = step(content.world, state, blankInput()).state;
    }
    expect(state.finale).toBe("credits");
  });

  it("walks the morning stairs both ways without touching Mom", () => {
    const forest = createState(content.world, { area: "bedroom", spawn: "bed" });
    const morning: State = { ...forest, finale: "morning" };
    let state = morning;
    for (let index = 0; index < 80; index += 1)
      state = step(content.world, state, { ...blankInput(), move: { x: 0, y: -1 } }).state;
    for (let index = 0; index < 40; index += 1)
      state = step(content.world, state, blankInput()).state;
    expect(state.area).toBe("kitchen");
    for (let index = 0; index < 50; index += 1)
      state = step(content.world, state, { ...blankInput(), move: { x: 0, y: 1 } }).state;
    for (let index = 0; index < 150; index += 1)
      state = step(content.world, state, { ...blankInput(), move: { x: -1, y: 0 } }).state;
    for (let index = 0; index < 40; index += 1)
      state = step(content.world, state, blankInput()).state;
    expect(state.area).toBe("bedroom");
    const mom = content.world.areas.bedroom?.npcs.find((npc) => npc.id === "mom");
    if (mom === undefined) throw new Error("Mom NPC missing");
    expect(Math.abs(state.player.y - mom.point.y)).toBeGreaterThan(20);
  });

  it("keeps the front door shut in the morning and open in the dream", () => {
    const kitchen = (ink: string, finale: State["finale"]): State => ({
      ...createState(content.world, { area: "kitchen", spawn: "front-door" }), ink, finale,
    });
    // Holds right, into the front door, until a line or a door stops her.
    const intoDoor = (state: State): State => {
      let current = state;
      for (let index = 0; index < 120 && current.dialogue === null &&
        current.transition === null; index += 1)
        current = step(content.world, current, { ...blankInput(), move: { x: 1, y: 0 } }).state;
      return current;
    };
    // The real wake-up, then Fae by the kitchen's front door.
    const woken = wake();
    expect(woken).toMatchObject({ finale: "morning", dialogue: null });
    const morning = intoDoor(kitchen(woken.ink, "morning"));
    expect(morning.area).toBe("kitchen");
    expect(morning.transition).toBeNull();
    expect(morning.dialogue?.knot).toBe("front_door_morning_notice");
    // The same steps in the dream go out to the plaza.
    let dream = intoDoor(kitchen(fresh.ink, null));
    expect(dream.dialogue).toBeNull();
    for (let index = 0; index < 60 && dream.transition !== null; index += 1)
      dream = step(content.world, dream, blankInput()).state;
    expect(dream.area).toBe("plaza");
  });

  it("has Mom wake Fae once, then send her to Milo", () => {
    // Both Moms (the bedroom's and the kitchen's) talk with the `mom` knot.
    const again = startDialogue(content.world, wake(), "mom");
    expect(again.dialogue?.text)
      .toBe("Milo's waiting by the front door, sweetie. Have fun at school!");
    expect(advanceDialogue(again).state.dialogue).toBeNull();
  });

  it("reports missing ending content invariants", () => {
    const errors = endingContentErrors({ ...content.world.story, root: [] }, {});
    expect(errors).toEqual([]);
    const bedroom = content.world.areas.bedroom;
    if (bedroom === undefined) throw new Error("bedroom missing");
    const missing = endingContentErrors(content.world.story, {
      bedroom: { ...bedroom, spawns: {} },
    });
    expect(missing).toContain("ending requires bedroom spawn bed");
  });
});
