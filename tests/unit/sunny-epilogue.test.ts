import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  areaConnectionErrors,
  hiddenPositions,
  propBlockerErrors,
  propDrawingErrors,
} from "../../src/content/area-checks";
import {
  createState,
  inkFacts,
  journalNotes,
  npcVisible,
  runInk,
  setInkVariables,
  type State,
} from "../../src/core";
import { evaluateAtmosphere } from "../../src/render/atmosphere";
import { storyTimeOfDay } from "../../src/render/time-of-day";

const { world, fixtures } = loadContent();
const sanctuary = world.areas.sanctuary;
if (sanctuary === undefined) throw new Error("sanctuary area missing");

const FESTIVAL_GUEST_IDS = ["milo", "rosie", "dad", "chef"] as const;

function runKnot(
  state: State,
  knot: string,
  choices: readonly number[] = [],
): {
  ink: string;
  lines: string[];
  speakers: (string | null)[];
  sounds: string[];
  tags: string[];
  firstChoices: string[];
} {
  const facts = inkFacts(world, state);
  let result = runInk(world.story, state.ink, { type: "start", knot }, facts);
  const queue = [...choices];
  const lines: string[] = [];
  const speakers: (string | null)[] = [];
  const sounds: string[] = [];
  const tags: string[] = [];
  let firstChoices: string[] = [];
  const collect = (): void => {
    if (result.line !== null) {
      lines.push(result.line.text);
      speakers.push(result.line.speaker);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
      tags.push(...result.line.tags);
    }
    if (firstChoices.length === 0 && result.choices.length > 0) {
      firstChoices = [...result.choices];
    }
  };
  collect();
  for (let guard = 0; guard < 80 && !result.ended; guard += 1) {
    if (result.choices.length > 0) {
      const pick = queue.shift() ?? result.choices.length - 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
    } else {
      result = runInk(world.story, result.ink, { type: "next" }, facts);
    }
    collect();
  }
  return { ink: result.ink, lines, speakers, sounds, tags, firstChoices };
}

function festivalState(): State {
  const fixture = fixtures.festival;
  if (fixture === undefined) throw new Error("festival fixture missing");
  return createState(world, fixture);
}

describe("Post-Finale Sunny Cloverhollow Epilogue & Sanctuary Celebration Festival", () => {
  it("gates the 4 Sanctuary festival guests strictly on milo_revealed with zero overlaps", () => {
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
    expect(propDrawingErrors(sanctuary)).toEqual([]);
    expect(propBlockerErrors(sanctuary)).toEqual([]);
    expect(hiddenPositions(sanctuary, world.tunables.playerRadius)).toEqual([]);

    // Exact 53 living NPC profiles preserved!
    expect(Object.keys(world.npcProfiles)).toHaveLength(53);

    const fresh = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    for (const id of FESTIVAL_GUEST_IDS) {
      const npc = sanctuary.npcs.find((entry) => entry.id === id);
      expect(npc, `${id} missing in sanctuary`).toBeDefined();
      expect(npc?.visibleWhile).toBe("milo_revealed");
      if (npc !== undefined) expect(npcVisible(world, fresh, npc)).toBe(false);
    }

    // Even if hooded-kid is calmed, guests stay hidden until milo_revealed is true.
    const calmedOnly: State = {
      ...fresh,
      calms: { ...fresh.calms, "hooded-kid": 1 },
      critters: { ...fresh.critters, "hooded-kid": "calm" },
    };
    for (const id of FESTIVAL_GUEST_IDS) {
      const npc = sanctuary.npcs.find((entry) => entry.id === id);
      if (npc !== undefined) expect(npcVisible(world, calmedOnly, npc)).toBe(false);
    }

    // Once milo_revealed is true (festival fixture), all 4 guests + Fern + 17 critters appear!
    const fest = festivalState();
    const visibleIds = sanctuary.npcs
      .filter((npc) => npcVisible(world, fest, npc))
      .map((npc) => npc.id);
    expect(visibleIds).toHaveLength(22);
    for (const id of FESTIVAL_GUEST_IDS) expect(visibleIds).toContain(id);

    // Every pair of Sanctuary NPCs maintains comfortable non-overlapping spacing.
    for (let i = 0; i < sanctuary.npcs.length; i += 1) {
      const a = sanctuary.npcs[i];
      if (a === undefined) continue;
      for (let j = i + 1; j < sanctuary.npcs.length; j += 1) {
        const b = sanctuary.npcs[j];
        if (b === undefined) continue;
        const dist = Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y);
        expect(dist, `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(90);
      }
    }
  });

  it("plays all 4 Sanctuary Festival guest knots with reactive branches and Rosie's gift", () => {
    const fest = festivalState();

    // Milo: sketchbook, Sketch Loft reaction, Star Racer reaction, chime-yellow.
    const milo1 = runKnot(fest, "festival_milo");
    expect(world.storyVariable(milo1.ink, "festival_milo_talked")).toBe(true);
    expect(milo1.sounds).toContain("chime-yellow");
    expect(milo1.lines.join(" ")).toContain("watercolor sketchbook");
    expect(milo1.lines.join(" ")).toContain("Sketch Loft");
    expect(milo1.lines.join(" ")).toContain("Star Racer");

    // Rosie: pressed-clover garlands, +1 snack Clover Festival Lemonade, Flower Cottage reaction.
    const rosie1 = runKnot({ ...fest, ink: milo1.ink }, "festival_rosie");
    expect(world.storyVariable(rosie1.ink, "festival_rosie_gift")).toBe(true);
    expect(rosie1.tags).toContain("gift: snack 1");
    expect(rosie1.sounds).toContain("chime-green");
    expect(rosie1.lines.join(" ")).toContain("Clover Festival Lemonade");
    expect(rosie1.lines.join(" ")).toContain("Flower Cottage");
    const rosie2 = runKnot({ ...fest, ink: rosie1.ink }, "festival_rosie");
    expect(rosie2.tags).not.toContain("gift: snack 1");

    // Dad: dynamic sanctuary_count() and Chef Mateo's Clover Hills fiesta tacos.
    const dad = runKnot({ ...fest, ink: rosie1.ink }, "festival_dad");
    expect(world.storyVariable(dad.ink, "festival_dad_talked")).toBe(true);
    expect(dad.lines.join(" ")).toContain("17 calm critters");
    expect(dad.lines.join(" ")).toContain("fiesta tacos");

    // Chef Bea: honey-clover tarts choice -> Maddie purr & chat branch.
    const chefTart = runKnot({ ...fest, ink: dad.ink }, "festival_chef", [0]);
    expect(world.storyVariable(chefTart.ink, "festival_chef_talked")).toBe(true);
    expect(chefTart.firstChoices).toEqual([
      "Sample a warm honey-clover festival tart!",
      "Chat about the festival",
    ]);
    expect(chefTart.speakers).toContain("Maddie");
    expect(chefTart.lines.join(" ")).toContain("purr");

    const chefChat = runKnot({ ...fest, ink: dad.ink }, "festival_chef", [1]);
    expect(chefChat.lines.join(" ")).toContain("Bon Appetit Cafe");
  });

  it("offers Ranger Fern's Grand Festival Toast (+30 coins, +2 snacks) with safe replay", () => {
    // Start with sanctuary_reward_14 already awarded so we isolate the Festival Toast gift.
    const fest = festivalState();
    const ready: State = {
      ...fest,
      ink: setInkVariables(fest.ink, {
        sanctuary_visited: true,
        sanctuary_reward_3: true,
        sanctuary_reward_8: true,
        sanctuary_reward_14: true,
      }),
    };

    const toast = runKnot(ready, "ranger_fern", [0]);
    expect(toast.firstChoices).toEqual([
      "Raise a Sunny Cloverhollow Festival Toast!",
      "Enjoy the sunny meadow",
    ]);
    expect(world.storyVariable(toast.ink, "festival_toast_done")).toBe(true);
    expect(toast.tags).toContain("gift: coins 30");
    expect(toast.tags).toContain("gift: snack 2");
    expect(toast.sounds).toContain("chime-red");
    for (const speaker of [
      "Ranger Fern",
      "Milo",
      "Rosie",
      "Dad",
      "Chef Bea",
      "Sue",
      "Jordan",
      "Maddie",
      "Fae",
    ]) {
      expect(toast.speakers, `missing speaker ${speaker}`).toContain(speaker);
    }

    // Replaying the toast gives zero duplicate coins or snacks!
    const replay = runKnot({ ...ready, ink: toast.ink }, "ranger_fern", [0]);
    expect(replay.firstChoices).toEqual([
      "Replay the Sunny Cloverhollow Festival Toast!",
      "Enjoy the sunny meadow",
    ]);
    expect(replay.tags.filter((tag) => tag.startsWith("gift:"))).toEqual([]);
    expect(replay.speakers).toContain("Milo");

    // Pre-finale ranger_fern never shows the festival toast menu or Milo.
    const preFinale = createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 });
    const preFern = runKnot(preFinale, "ranger_fern");
    expect(preFern.firstChoices).toEqual([]);
    expect(preFern.lines.join(" ").toLowerCase()).not.toContain("milo");
  });

  it("adds post-finale echoes in sanctuary_picnic, mom, buster, club_chest, and journal", () => {
    const fest = festivalState();

    // Post-finale sanctuary_picnic adds Milo sketching Maddie in the sun.
    const picnic = runKnot(fest, "sanctuary_picnic");
    expect(picnic.speakers).toContain("Milo");
    expect(picnic.lines.join(" ")).toContain("Maddie");

    // Pre-finale sanctuary_picnic never mentions Milo.
    const prePicnic = runKnot(
      createState(world, { area: "sanctuary", spawn: "entrance", seed: 1 }),
      "sanctuary_picnic",
    );
    expect(prePicnic.lines.join(" ").toLowerCase()).not.toContain("milo");

    // Mom.again invites Fae to the Sanctuary Festival once milo_revealed.
    const momState: State = {
      ...fest,
      ink: setInkVariables(fest.ink, { ate_breakfast: true, has_microwave: true }),
    };
    const mom = runKnot(momState, "mom");
    expect(mom.lines.join(" ")).toContain("Sanctuary Festival");

    // Buster celebrates Sunny Cloverhollow from Alpine Summit to Starlight Island to Sanctuary.
    const busterState: State = {
      ...fest,
      ink: setInkVariables(fest.ink, { buster_reward: true }),
    };
    const buster = runKnot(busterState, "buster");
    expect(buster.lines.join(" ")).toContain("Alpine Summit");
    expect(buster.lines.join(" ")).toContain("Starlight Island");
    expect(buster.lines.join(" ")).toContain("Wildlife Sanctuary");

    // Club chest celebrates all world-expansion adventures and the festival ribbon.
    const chestState: State = {
      ...fest,
      ink: setInkVariables(fest.ink, { has_chest: true, festival_toast_done: true }),
    };
    const chest = runKnot(chestState, "club_chest");
    const chestText = chest.lines.join(" ");
    expect(chestText).toContain("Milo's Sketch Loft");
    expect(chestText).toContain("Rosie's Flower Cottage");
    expect(chestText).toContain("Alpine Summit Overlook");
    expect(chestText).toContain("Starlight Island");
    expect(chestText).toContain("Sanctuary Celebration Festival");

    // Journal records the Sanctuary Festival invitation before toast and celebration after toast.
    const preToastNotes = journalNotes(world, fest);
    expect(preToastNotes[0]).toContain("Wildlife Sanctuary");
    expect(preToastNotes[0]).toContain("Celebration Festival");

    const postToastNotes = journalNotes(world, chestState);
    expect(postToastNotes[0]).toContain("Sunny Cloverhollow Festival Toast");
    expect(postToastNotes[0]).toContain("Milo");
  });

  it("shifts post-finale Sanctuary lighting to golden-meadow and adds festival atmosphere", () => {
    const preFinale = createState(world, {
      area: "sanctuary",
      spawn: "entrance",
      seed: 1,
      variables: { has_lantern: true },
    });
    expect(storyTimeOfDay(world, preFinale).phase).toBe("golden-hour");

    const postFinale = festivalState();
    expect(storyTimeOfDay(world, postFinale).phase).toBe("golden-meadow");

    // Early guards still hold (lantern active -> neutral day).
    expect(storyTimeOfDay(world, { ...postFinale, lantern: true }).phase).toBe("day");

    // Atmosphere: pre-finale sanctuary is untouched; sanctuaryFestival adds 14 sparkles/petals.
    const base = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 120);
    const disabled = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 120, {
      sanctuaryFestival: false,
    });
    expect(disabled).toEqual(base);

    const active = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 120, {
      sanctuaryFestival: true,
    });
    expect(active).toHaveLength(base.length + 14);
    expect(active.slice(0, base.length)).toEqual(base);

    const reducedA = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 30, {
      sanctuaryFestival: true,
      reducedMotion: true,
    });
    const reducedB = evaluateAtmosphere("sanctuary", sanctuary.width, sanctuary.height, 240, {
      sanctuaryFestival: true,
      reducedMotion: true,
    });
    expect(reducedA).toEqual(reducedB);
  });
});
