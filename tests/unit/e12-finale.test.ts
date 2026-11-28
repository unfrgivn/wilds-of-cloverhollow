import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  startDialogue,
  step,
  type ActionFrame,
  type State,
} from "../../src/core";
import { createInkState, runInk, setInkVariables, type InkFacts } from "../../src/core/ink";
import { parseCameraTags } from "../../src/render/camera";
import { buildCreditsView, type AtlasFrameResolver } from "../../src/shell/view-models";
import { atlasImage } from "../../src/ui/atlas";
import { DEFAULT_ENDING_POSTCARD } from "../../src/ui/credits";
import { parseExpressionTag } from "../../src/ui/portraits";
import { stripRichText } from "../../src/ui/rich-text";
import maddieAtlas from "../../public/assets/characters/maddie/maddie.json";

const content = loadContent();
const { world } = content;
const newGameFixture = content.fixtures["new-game"];
if (newGameFixture === undefined) throw new Error("new-game fixture missing");
const fresh = createState(world, newGameFixture);

type TranscriptLine = {
  text: string;
  speaker: string | null;
  tags: string[];
  sound: string | null;
};

type KnotRun = {
  lines: TranscriptLine[];
  choices: string[];
  ink: string;
  ended: boolean;
};

type KnotOptions = {
  vars?: Record<string, boolean | number>;
  facts?: Partial<InkFacts>;
  choices?: readonly number[];
  ink?: string;
};

const defaultFacts: InkFacts = {
  calmed: {},
  coins: 0,
  snacks: 2,
  prizes: [],
  plushesLeft: 0,
  tickets: 0,
};

function playKnot(knot: string, options: KnotOptions = {}): KnotRun {
  const baseInk = options.ink ?? createInkState(world.story, 1);
  const startInk = options.vars === undefined ? baseInk : setInkVariables(baseInk, options.vars);
  const facts: InkFacts = { ...defaultFacts, ...options.facts };
  let result = runInk(world.story, startInk, { type: "start", knot }, facts);
  const lines: TranscriptLine[] = [];
  const planned = options.choices ?? [];
  let choiceCursor = 0;

  for (let guard = 0; guard < 60; guard += 1) {
    if (result.line !== null) {
      lines.push({
        text: result.line.text,
        speaker: result.line.speaker,
        tags: result.line.tags,
        sound: result.line.sound ?? null,
      });
    }
    if (result.ended) {
      return { lines, choices: result.choices, ink: result.ink, ended: true };
    }
    if (result.choices.length > 0) {
      const pick = planned[choiceCursor];
      if (pick === undefined) {
        return { lines, choices: result.choices, ink: result.ink, ended: false };
      }
      choiceCursor += 1;
      result = runInk(world.story, result.ink, { type: "choose", index: pick }, facts);
      continue;
    }
    result = runInk(world.story, result.ink, { type: "next" }, facts);
  }
  throw new Error(`Knot ${knot} did not finish within 60 steps`);
}

function joinedText(run: KnotRun): string {
  return run.lines.map((line) => line.text).join(" ");
}

function hasGrade(run: KnotRun, grade: "great" | "good" | "miss"): boolean {
  return run.lines.some((line) =>
    line.tags.some((tag) => tag.trim() === `grade: ${grade}`),
  );
}

const confirmFrame = (): ActionFrame => ({ ...blankInput(), confirm: true });

function advanceDialogue(state: State): State {
  let current = state;
  for (let guard = 0; guard < 50 && current.dialogue !== null; guard += 1) {
    current = step(world, current, confirmFrame()).state;
    current = step(world, current, blankInput()).state;
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const realAtlasResolver: AtlasFrameResolver = {
  atlasFrame: (file, frameName) => {
    if (file === "characters/maddie/maddie.json") {
      return atlasImage(maddieAtlas, "assets/characters/maddie/maddie.png", frameName);
    }
    return null;
  },
};

describe("E12 3-tool seal ritual & Enchanted Forest restoration", () => {
  it("mist_flowers reveals runes, sets found_mist_way, emits cues, and hides identity", () => {
    const withJordan = playKnot("mist_flowers", { vars: { jordan_joined: true } });
    const withoutJordan = playKnot("mist_flowers", { vars: { jordan_joined: false } });
    const replay = playKnot("mist_flowers", { ink: withJordan.ink });

    expect(withJordan.ended).toBe(true);
    expect(world.storyVariable(withJordan.ink, "found_mist_way")).toBe(true);
    expect(joinedText(withJordan)).toContain("silver runes");
    expect(joinedText(withJordan)).toContain("stepping stones");

    const opening = withJordan.lines[0];
    expect(opening?.sound).toBe("chime-blue");
    expect(parseCameraTags(opening?.tags ?? []).zoom).toBe(1.09);

    const jordanLine = withJordan.lines.find((line) => line.speaker === "Jordan");
    expect(jordanLine?.text).toContain("Grandma's lantern found the secret rune path");
    expect(withoutJordan.lines.some((line) => line.speaker === "Jordan")).toBe(false);

    const maddieLine = withJordan.lines.find((line) => line.speaker === "Maddie");
    expect(maddieLine?.text).toContain("whiskers glow soft lavender");

    for (const run of [withJordan, withoutJordan, replay]) {
      expect(joinedText(run)).not.toMatch(/\b(kid|milo)\b/i);
    }
  });

  it("gully_bridge parts thorny mist-veil with lasso cues, Sue beat, and zero spoilers", () => {
    const withSue = playKnot("gully_bridge", {
      vars: { has_lasso: true, sue_joined: true },
    });
    const solo = playKnot("gully_bridge", {
      vars: { has_lasso: true, sue_joined: false },
    });
    const noLasso = playKnot("gully_bridge", { vars: { has_lasso: false } });
    const afterBridge = playKnot("gully_bridge", { ink: withSue.ink });

    expect(withSue.ended).toBe(true);
    expect(world.storyVariable(withSue.ink, "rope_bridge")).toBe(true);
    expect(world.storyVariable(noLasso.ink, "rope_bridge")).toBe(false);
    expect(joinedText(withSue)).toContain("thorny mist-veil");

    const sueLine = withSue.lines.find((line) => line.speaker === "Sue");
    expect(sueLine?.text).toContain("rainbow lasso");
    expect(solo.lines.some((line) => line.speaker === "Sue")).toBe(false);

    const sounds = withSue.lines.map((line) => line.sound).filter((s) => s !== null);
    expect(sounds).toContain("chime-yellow");
    expect(sounds).toContain("chime-green");
    const shakes = withSue.lines
      .map((line) => parseCameraTags(line.tags).shake)
      .filter((s) => s !== undefined);
    expect(shakes).toContain(0.35);

    for (const run of [withSue, solo, noLasso, afterBridge]) {
      expect(joinedText(run)).not.toMatch(/\b(kid|milo)\b/i);
    }
  });

  it("mist_seal opens on Red-Yellow-Blue-Red, weaves all three tools, and hides identity", () => {
    const solved = playKnot("mist_seal", {
      vars: { has_flute: true, sue_joined: true, jordan_joined: true },
      choices: [0, 1, 3, 0],
    });
    const wrong = playKnot("mist_seal", {
      vars: { has_flute: true },
      choices: [2, 2, 2, 2],
    });
    const noFlute = playKnot("mist_seal", { vars: { has_flute: false } });

    expect(solved.ended).toBe(true);
    expect(world.storyVariable(solved.ink, "seal_open")).toBe(true);
    expect(world.storyVariable(wrong.ink, "seal_open")).toBe(false);

    const solvedText = joinedText(solved);
    expect(solvedText).toContain("Lantern runes, rainbow lasso sparks, and flute music");
    expect(solvedText).toContain("Glowing fairies swirl awake");

    const sounds = solved.lines.map((line) => line.sound).filter((s) => s !== null);
    expect(sounds).toContain("chime-yellow");
    expect(sounds).toContain("chime-blue");
    expect(sounds).toContain("chime-green");

    for (const run of [solved, wrong, noFlute]) {
      expect(joinedText(run)).not.toMatch(/\b(kid|milo)\b/i);
    }
  });

  it("transforms mystic_pond and ancient_tree from fizzy/scribbled to golden-pastel calm", () => {
    const pondBefore = playKnot("mystic_pond", { vars: { milo_revealed: false } });
    const treeBefore = playKnot("ancient_tree", { vars: { milo_revealed: false } });
    const pondAfter = playKnot("mystic_pond", { vars: { milo_revealed: true } });
    const treeAfter = playKnot("ancient_tree", { vars: { milo_revealed: true } });

    expect(joinedText(pondBefore)).toContain("fizzing bright purple");
    expect(joinedText(pondAfter)).toContain("shimmers clear and golden");
    expect(joinedText(pondAfter)).not.toContain("fizzing");

    expect(joinedText(treeBefore)).toContain("Tangled purple scribbles");
    expect(joinedText(treeAfter)).toContain("Golden-pastel light");
    expect(joinedText(treeAfter)).not.toContain("scribbles");
  });
});

describe("E12 clue-powered kid_talk_1..3 & identity secrecy", () => {
  it("adapts kid_talk_1 choice 0 to art-teacher, saw_hood, and default; preserves choice 1", () => {
    const artClue = playKnot("kid_talk_1", {
      facts: { calmed: { "art-teacher": true } },
      choices: [0],
    });
    const hallClue = playKnot("kid_talk_1", {
      vars: { saw_hood: true },
      choices: [0],
    });
    const fallback = playKnot("kid_talk_1", { choices: [0] });
    const goodChoice = playKnot("kid_talk_1", { choices: [1] });

    expect(hasGrade(artClue, "great")).toBe(true);
    expect(joinedText(artClue)).toContain("Ms. Rowan's missing purple markers");

    expect(hasGrade(hallClue, "great")).toBe(true);
    expect(joinedText(hallClue)).toContain("purple marker I dropped in the hall");

    expect(hasGrade(fallback, "great")).toBe(true);
    expect(joinedText(fallback)).toContain("You figured THAT out?!");

    expect(hasGrade(goodChoice, "good")).toBe(true);
    expect(goodChoice.lines[goodChoice.lines.length - 1]?.text).toBe(
      "Maybe. Lots of kids play Star Racer.",
    );
  });

  it("adapts kid_talk_2 choice 0 to milo_loft_glow_read, club_open, and default", () => {
    const loftClue = playKnot("kid_talk_2", {
      vars: { milo_loft_glow_read: true },
      choices: [0],
    });
    const clubClue = playKnot("kid_talk_2", {
      vars: { club_open: true, milo_loft_glow_read: false },
      choices: [0],
    });
    const fallback = playKnot("kid_talk_2", { choices: [0] });

    expect(hasGrade(loftClue, "great")).toBe(true);
    expect(joinedText(loftClue)).toContain("rocket sketches");

    expect(hasGrade(clubClue, "great")).toBe(true);
    expect(joinedText(clubClue)).toContain("school name tag and my star doodles");

    expect(hasGrade(fallback, "great")).toBe(true);
    expect(joinedText(fallback)).toContain("paper planes and star doodles");
  });

  it("names Milo in kid_talk_3 choice 0 with pause and whisper kinetic markup", () => {
    const prompt = playKnot("kid_talk_3");
    expect(prompt.choices[0]).toContain("Milo");

    const reveal = playKnot("kid_talk_3", { choices: [0] });
    expect(hasGrade(reveal, "great")).toBe(true);
    const reply = reveal.lines[reveal.lines.length - 1]?.text ?? "";
    expect(reply).toContain("{pause:8}");
    expect(reply).toContain("{whisper}");
    expect(reply).toContain("{/whisper}");
  });

  it("never mentions Milo in kid_talk_1 or kid_talk_2 across every branch and choice", () => {
    const talk1Configs: KnotOptions[] = [
      {},
      { vars: { saw_hood: true } },
      { facts: { calmed: { "art-teacher": true } } },
    ];
    for (const config of talk1Configs) {
      const open = playKnot("kid_talk_1", config);
      expect(joinedText(open)).not.toMatch(/milo/i);
      for (const label of open.choices) expect(label).not.toMatch(/milo/i);
      for (let choice = 0; choice < open.choices.length; choice += 1) {
        const branch = playKnot("kid_talk_1", { ...config, choices: [choice] });
        expect(joinedText(branch)).not.toMatch(/milo/i);
      }
    }

    const talk2Configs: KnotOptions[] = [
      {},
      { vars: { club_open: true } },
      { vars: { milo_loft_glow_read: true } },
      { vars: { club_open: true, milo_loft_glow_read: true } },
    ];
    for (const config of talk2Configs) {
      const open = playKnot("kid_talk_2", config);
      expect(joinedText(open)).not.toMatch(/milo/i);
      for (const label of open.choices) expect(label).not.toMatch(/milo/i);
      for (let choice = 0; choice < open.choices.length; choice += 1) {
        const branch = playKnot("kid_talk_2", { ...config, choices: [choice] });
        expect(joinedText(branch)).not.toMatch(/milo/i);
      }
    }
  });
});

describe("E12 hood-drop reconciliation & golden bloom", () => {
  it("plays milo_calm with hood-drop, reassurance, Maddie, conditionals, expr tags & glow", () => {
    const full = playKnot("milo_calm", {
      vars: { milo_loft_glow_read: true, sue_joined: true, jordan_joined: true },
    });
    const minimal = playKnot("milo_calm", {
      vars: { milo_loft_glow_read: false, sue_joined: false, jordan_joined: false },
    });

    expect(full.ended).toBe(true);
    expect(world.storyVariable(full.ink, "milo_revealed")).toBe(true);

    const text = joinedText(full);
    expect(text).toContain("pulls back the purple hood");
    expect(text).toContain("getting left behind");
    expect(text).toContain("wanted someone to notice me");
    expect(text).toContain("I always notice you, Milo");
    expect(text).toContain("golden-pastel watercolor light");

    const faeReassurance = full.lines.find(
      (line) => line.speaker === "Fae" && line.text.includes("I always notice you, Milo"),
    );
    expect(faeReassurance).toBeDefined();

    const maddieBeat = full.lines.find(
      (line) =>
        line.speaker === "Maddie" && line.text.includes("rubs her soft cheek against Milo's"),
    );
    expect(maddieBeat).toBeDefined();

    expect(text).toContain("Your rocket sketches are amazing too");
    expect(joinedText(minimal)).not.toContain("Your rocket sketches are amazing too");

    expect(full.lines.some((line) => line.speaker === "Sue")).toBe(true);
    expect(minimal.lines.some((line) => line.speaker === "Sue")).toBe(false);

    expect(full.lines.some((line) => line.speaker === "Jordan")).toBe(true);
    expect(minimal.lines.some((line) => line.speaker === "Jordan")).toBe(false);

    const expressions = new Set(
      full.lines
        .map((line) => parseExpressionTag(line.tags))
        .filter((expr) => expr !== null),
    );
    expect(expressions.has("worried")).toBe(true);
    expect(expressions.has("happy")).toBe(true);
    expect(expressions.has("surprised")).toBe(true);
  });

  it("bathes Cloverhollow in golden light, whispers Mom's voice, and wakes into bedroom", () => {
    const endingRun = playKnot("tree_ending");
    expect(endingRun.ended).toBe(true);
    expect(joinedText(endingRun)).toContain("golden-pastel light");

    const momLine = endingRun.lines.find((line) => line.speaker === "Mom");
    expect(momLine?.text).toContain("{whisper}");
    expect(momLine?.text).toContain("Time to wake up");

    const lastLine = endingRun.lines[endingRun.lines.length - 1];
    expect(lastLine?.tags.some((tag) => tag.trim() === "ending")).toBe(true);

    const forest = createState(world, {
      area: "enchanted",
      spawn: "mist",
      party: ["maddie", "sue", "jordan"],
    });
    const started = startDialogue(world, forest, "tree_ending");
    let current = started;
    let wokeInBedroom = false;
    for (let guard = 0; guard < 40 && current.dialogue !== null; guard += 1) {
      current = step(world, current, confirmFrame()).state;
      if (current.area === "bedroom" && current.finale === "morning") {
        wokeInBedroom = true;
        break;
      }
      current = step(world, current, blankInput()).state;
    }

    expect(wokeInBedroom).toBe(true);
    expect(current.area).toBe("bedroom");
    expect(current.finale).toBe("morning");
    expect(current.party.map((member) => member.id)).toEqual(["maddie"]);
    expect(world.storyVariable(current.ink, "awake")).toBe(true);
    expect(world.storyVariable(current.ink, "dreaming")).toBe(false);
    expect(current.dialogue?.knot).toBe("mom");
  });
});

describe("E12 enriched waking-up morning vs Act 1", () => {
  it("switches desk, journal, cat_bed, breakfast, fridge, oliver, and mom when awake", () => {
    const act1Desk = playKnot("desk", { vars: { awake: false } });
    const morningDeskJoined = playKnot("desk", {
      vars: { awake: true, sue_joined: true, jordan_joined: true },
    });
    const morningDeskSolo = playKnot("desk", {
      vars: { awake: true, sue_joined: false, jordan_joined: false },
    });
    expect(joinedText(act1Desk)).toContain("Maddie as a dragon");
    expect(joinedText(morningDeskJoined)).toContain("cozy frog by a fountain");
    expect(joinedText(morningDeskJoined)).toContain("bay dock");
    expect(joinedText(morningDeskJoined)).toContain("snowy pines");
    expect(joinedText(morningDeskJoined)).toContain("glowing golden tree");
    expect(joinedText(morningDeskJoined)).toContain("Sue and Jordan");
    expect(joinedText(morningDeskSolo)).not.toContain("Sue and Jordan");

    const act1Journal = playKnot("pillow_journal", { vars: { awake: false } });
    const morningJournal = playKnot("pillow_journal", { vars: { awake: true } });
    expect(joinedText(act1Journal)).toContain("under my pillow where it belongs");
    expect(joinedText(morningJournal)).toContain("clover doodles, star maps");

    const act1CatBed = playKnot("cat_bed", { vars: { awake: false } });
    const morningCatBed = playKnot("cat_bed", { vars: { awake: true } });
    expect(joinedText(act1CatBed)).toContain("full of orange fur");
    expect(joinedText(morningCatBed)).toContain("padding at my heels");
    expect(morningCatBed.lines.some((line) => line.speaker === "Maddie")).toBe(true);

    const act1Breakfast = playKnot("breakfast", { vars: { awake: false } });
    const morningBreakfast = playKnot("breakfast", { vars: { awake: true } });
    expect(joinedText(act1Breakfast)).toContain("Three plates, three cups");
    expect(joinedText(morningBreakfast)).toContain("Warm blueberry pancakes, sunny maple syrup");

    const act1Fridge = playKnot("fridge", { vars: { awake: false } });
    const morningFridge = playKnot("fridge", { vars: { awake: true } });
    expect(joinedText(act1Fridge)).toContain("shopping lists");
    expect(joinedText(morningFridge)).toContain("sunlit four-leaf clover");

    const act1Oliver = playKnot("oliver", { vars: { awake: false } });
    const morningOliver = playKnot("oliver", { vars: { awake: true } });
    expect(joinedText(act1Oliver)).toContain("shakes his rattle");
    expect(joinedText(morningOliver)).toContain("fridge drawings");
    expect(joinedText(morningOliver)).toContain("glowing golden tree");

    const act1Mom = playKnot("mom", { vars: { awake: false } });
    const morningMom = playKnot("mom", { vars: { awake: true } });
    const morningMomAgain = playKnot("mom", { ink: morningMom.ink });
    expect(act1Mom.choices).toEqual(["Eat a pancake", "Give Mom a hug"]);
    expect(joinedText(morningMom)).toContain("Wake up, sleepyhead");
    expect(joinedText(morningMom)).toContain("Milo just stopped by");
    expect(joinedText(morningMomAgain)).toContain("Milo's waiting by the front door");
  });

  it("plays front_door_morning_notice and front_door_morning cleanly into credits", () => {
    const notice = playKnot("front_door_morning_notice", { vars: { awake: true } });
    expect(joinedText(notice)).toContain("Milo");
    expect(joinedText(notice)).toContain("purple hoodie");

    const doorRun = playKnot("front_door_morning", { vars: { awake: true } });
    expect(doorRun.ended).toBe(true);
    const text = joinedText(doorRun);
    expect(text).toContain("real purple hoodie");
    expect(text).toContain("rocket sketchbook");
    expect(text).toContain("grins shyly");
    expect(text).toContain("Want to walk to school together");

    const maddieLead = doorRun.lines.find(
      (line) => line.speaker === "Maddie" && line.text.includes("open front door"),
    );
    expect(maddieLead).toBeDefined();

    const lastLine = doorRun.lines[doorRun.lines.length - 1];
    expect(lastLine?.tags.some((tag) => tag.trim() === "credits")).toBe(true);

    const morningState: State = {
      ...fresh,
      area: "kitchen",
      finale: "morning",
      ink: setInkVariables(fresh.ink, { awake: true, dreaming: false }),
    };
    const finished = advanceDialogue(
      startDialogue(world, morningState, "front_door_morning"),
    );
    expect(finished.finale).toBe("credits");
    expect(finished.dialogue).toBeNull();
  });
});

describe("E12 2-line mobile dialogue fit guard", () => {
  it("keeps every spoken line across E12 finale & morning knots concise for 874x402", () => {
    const entry = (label: string, knot: string, options?: KnotOptions) => ({
      label,
      run: playKnot(knot, options),
    });
    const coreRuns: readonly { label: string; run: KnotRun }[] = [
      entry("mist_flowers", "mist_flowers", { vars: { jordan_joined: true } }),
      entry("mist_flowers.again", "mist_flowers", { vars: { found_mist_way: true } }),
      entry("mist_band.closed", "mist_band", { vars: { found_mist_way: false } }),
      entry("mist_band.open", "mist_band", { vars: { found_mist_way: true } }),
      entry("gully_bridge.no_lasso", "gully_bridge", { vars: { has_lasso: false } }),
      entry("gully_bridge.lasso", "gully_bridge", { vars: { has_lasso: true, sue_joined: true } }),
      entry("gully_bridge.again", "gully_bridge", { vars: { rope_bridge: true } }),
      entry("mist_seal.no_flute", "mist_seal", { vars: { has_flute: false } }),
      entry("mist_seal.solved", "mist_seal", {
        vars: { has_flute: true, sue_joined: true, jordan_joined: true },
        choices: [0, 1, 3, 0],
      }),
      entry("mist_seal.wrong", "mist_seal", { vars: { has_flute: true }, choices: [2, 2, 2, 2] }),
      entry("mist_seal.again", "mist_seal", { vars: { seal_open: true } }),
      entry("mystic_pond.before", "mystic_pond", { vars: { heard_wish: true } }),
      entry("mystic_pond.after", "mystic_pond", { vars: { milo_revealed: true } }),
      entry("ancient_tree.before", "ancient_tree", { vars: { heard_wish: true } }),
      entry("ancient_tree.after", "ancient_tree", { vars: { milo_revealed: true } }),
      entry("kid_talk_1.art", "kid_talk_1", {
        facts: { calmed: { "art-teacher": true } },
        choices: [0],
      }),
      entry("kid_talk_1.hall", "kid_talk_1", { vars: { saw_hood: true }, choices: [0] }),
      entry("kid_talk_1.default", "kid_talk_1", { choices: [0] }),
      entry("kid_talk_1.good", "kid_talk_1", { choices: [1] }),
      entry("kid_talk_1.miss", "kid_talk_1", { choices: [2] }),
      entry("kid_talk_2.loft", "kid_talk_2", { vars: { milo_loft_glow_read: true }, choices: [0] }),
      entry("kid_talk_2.club", "kid_talk_2", { vars: { club_open: true }, choices: [0] }),
      entry("kid_talk_2.default", "kid_talk_2", { choices: [0] }),
      entry("kid_talk_2.good", "kid_talk_2", { choices: [1] }),
      entry("kid_talk_2.miss", "kid_talk_2", { choices: [2] }),
      entry("kid_talk_3.great", "kid_talk_3", { choices: [0] }),
      entry("kid_talk_3.good", "kid_talk_3", { choices: [1] }),
      entry("kid_talk_3.miss", "kid_talk_3", { choices: [2] }),
      entry("milo_calm", "milo_calm", {
        vars: { milo_loft_glow_read: true, sue_joined: true, jordan_joined: true },
      }),
      entry("milo_calm.again_yes", "milo_calm", { vars: { milo_revealed: true }, choices: [0] }),
      entry("milo_calm.again_no", "milo_calm", { vars: { milo_revealed: true }, choices: [1] }),
      entry("tree_ending", "tree_ending"),
      entry("mom.morning", "mom", { vars: { awake: true } }),
      entry("desk.morning", "desk", { vars: { awake: true, sue_joined: true } }),
      entry("pillow_journal.morning", "pillow_journal", { vars: { awake: true } }),
      entry("cat_bed.morning", "cat_bed", { vars: { awake: true } }),
      entry("breakfast.morning", "breakfast", { vars: { awake: true } }),
      entry("fridge.morning", "fridge", { vars: { awake: true } }),
      entry("oliver.morning", "oliver", { vars: { awake: true } }),
      entry("front_door_morning_notice", "front_door_morning_notice", { vars: { awake: true } }),
      entry("front_door_morning", "front_door_morning", { vars: { awake: true } }),
    ];

    for (const { label, run } of coreRuns) {
      for (const line of run.lines) {
        const plain = stripRichText(line.text);
        expect(plain.length, `${label}: ${plain}`).toBeLessThanOrEqual(112);
      }
    }
  });
});

describe("E12 ending postcard asset & buildCreditsView", () => {
  it("ships a valid, lightweight WebP ending postcard and matching recipe + review image", () => {
    const postcardPath = "public/assets/ending/morning-postcard.webp";
    const recipePath = "art/recipes/ending-postcard.json";
    const reviewPath = "art/review/e12-ending-postcard.jpg";

    expect(existsSync(postcardPath)).toBe(true);
    const bytes = readFileSync(postcardPath);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(bytes.byteLength).toBeLessThan(250 * 1024);

    expect(existsSync(recipePath)).toBe(true);
    const parsed: unknown = JSON.parse(readFileSync(recipePath, "utf8"));
    expect(isRecord(parsed)).toBe(true);
    if (!isRecord(parsed)) throw new Error("ending-postcard recipe must be a JSON object");
    expect(parsed.output).toBe(postcardPath);
    expect(Array.isArray(parsed.review)).toBe(true);
    if (!Array.isArray(parsed.review)) throw new Error("recipe review must be an array");
    expect(parsed.review).toContain(reviewPath);

    expect(existsSync(reviewPath)).toBe(true);
    const reviewBytes = readFileSync(reviewPath);
    expect(reviewBytes[0]).toBe(0xff);
    expect(reviewBytes[1]).toBe(0xd8);
  });

  it("attaches DEFAULT_ENDING_POSTCARD in buildCreditsView only when finale is credits", () => {
    const dreamView = buildCreditsView(world, { ...fresh, finale: null }, realAtlasResolver);
    expect(dreamView.visible).toBe(false);
    expect(dreamView.postcard).toBeNull();
    expect(dreamView.entries).toEqual([]);

    const morningView = buildCreditsView(
      world,
      { ...fresh, finale: "morning" },
      realAtlasResolver,
    );
    expect(morningView.visible).toBe(false);
    expect(morningView.postcard).toBeNull();

    const creditsView = buildCreditsView(
      world,
      { ...fresh, finale: "credits" },
      realAtlasResolver,
    );
    expect(creditsView.visible).toBe(true);
    expect(creditsView.postcard).toEqual(DEFAULT_ENDING_POSTCARD);
    expect(creditsView.entries.length).toBeGreaterThan(0);
  });
});
