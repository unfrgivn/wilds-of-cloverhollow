import { describe, expect, it } from "vitest";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent, loadStoryFromDisk } from "../../src/content/load";
import {
  miloSecrecyErrors,
  STORY_EXPRESSIONS,
  STORY_POSES,
  storyTagErrors,
  storyTags,
} from "../../src/content/story-checks";
import {
  blankInput,
  createState,
  distanceToPolygon,
  findLullabyFluteSpot,
  HEART_TO_HEARTS,
  heartToHeartSpotsInArea,
  heartToHeartSummary,
  journalNotes,
  LULLABY_FLUTE_SPOTS,
  pointInPolygon,
  runInk,
  sceneryArea,
  setInkVariables,
  startDialogue,
  step,
  targetInteractable,
  type ActionFrame,
  type Direction,
  type InkFacts,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { computePromptScreenView } from "../../src/render/view-projections";
import { speakerPortraitSource } from "../../src/ui/portraits";

type PlayedLine = {
  speaker: string | null;
  text: string;
};

type PlayedDialogue = {
  state: State;
  lines: PlayedLine[];
  choiceSets: string[][];
};

type WalkedLine = {
  knot: string;
  speaker: string | null;
  text: string;
  tags: string[];
};

const press = (frame: Partial<ActionFrame>): ActionFrame => ({
  ...blankInput(),
  ...frame,
});

const treatCount = (state: State, id: string): number => state.treats?.[id] ?? 0;

function withVars(state: State, vars: Record<string, boolean | number>): State {
  return { ...state, ink: setInkVariables(state.ink, vars) };
}

function isWalkableStandingSpot(
  world: World,
  state: State,
  areaId: string,
  candidate: Point,
): boolean {
  const raw = world.areas[areaId];
  if (raw === undefined) return false;
  const area = sceneryArea(world, state.ink, raw);
  const radius = world.tunables.playerRadius;
  if (!pointInPolygon(candidate, area.walkable)) return false;
  if (distanceToPolygon(candidate, area.walkable) < radius) return false;
  const solids = [
    ...area.blockers,
    ...area.npcs.map((npc) => npc.footprint),
  ];
  return solids.every(
    (poly) => !pointInPolygon(candidate, poly) && distanceToPolygon(candidate, poly) >= radius,
  );
}

function placeFacingTarget(
  world: World,
  state: State,
  areaId: string,
  targetPoint: Point,
  expectedId?: string,
): State {
  const candidates: readonly { dx: number; dy: number; facing: Direction }[] = [
    { dx: 0, dy: 0, facing: "down" },
    { dx: 0, dy: 28, facing: "up" },
    { dx: 0, dy: -28, facing: "down" },
    { dx: 28, dy: 0, facing: "left" },
    { dx: -28, dy: 0, facing: "right" },
    { dx: 0, dy: 52, facing: "up" },
    { dx: 0, dy: -52, facing: "down" },
    { dx: 52, dy: 0, facing: "left" },
    { dx: -52, dy: 0, facing: "right" },
    { dx: 0, dy: 72, facing: "up" },
    { dx: 0, dy: -72, facing: "down" },
    { dx: 72, dy: 0, facing: "left" },
    { dx: -72, dy: 0, facing: "right" },
  ];
  for (const offset of candidates) {
    const player = { x: targetPoint.x + offset.dx, y: targetPoint.y + offset.dy };
    if (!isWalkableStandingSpot(world, state, areaId, player)) continue;
    const placed: State = {
      ...state,
      area: areaId,
      player,
      facing: offset.facing,
      previousInput: blankInput(),
      dialogue: null,
      transition: null,
      battle: null,
      arcade: null,
      journalOpen: false,
    };
    if (expectedId === undefined || targetInteractable(world, placed)?.id === expectedId) {
      return placed;
    }
  }
  throw new Error(
    `Could not find walkable standing spot in ${areaId} for (${targetPoint.x}, ${targetPoint.y})` +
      (expectedId === undefined ? "" : ` targeting ${expectedId}`),
  );
}

function playDialogue(
  world: World,
  initial: State,
  knot: string,
  chooseIndex: (choices: readonly string[], text: string) => number = () => 0,
): PlayedDialogue {
  let state = startDialogue(world, initial, knot);
  const lines: PlayedLine[] = [];
  const choiceSets: string[][] = [];
  let lastLineKey = "";
  const record = (current: State): void => {
    const dlg = current.dialogue;
    if (dlg === null) return;
    const key = `${dlg.speaker ?? ""}|${dlg.text}|${dlg.choices.join("/")}`;
    if (key === lastLineKey) return;
    lastLineKey = key;
    lines.push({ speaker: dlg.speaker, text: dlg.text });
    if (dlg.choices.length > 0) choiceSets.push([...dlg.choices]);
  };
  record(state);
  for (let guard = 0; guard < 600 && state.dialogue !== null; guard += 1) {
    const dlg = state.dialogue;
    if (dlg.revealed < dlg.text.length) {
      state = step(world, state, blankInput()).state;
      state = step(world, state, press({ confirm: true })).state;
      record(state);
      continue;
    }
    if (dlg.choices.length > 0) {
      const picked = chooseIndex(dlg.choices, dlg.text);
      if (picked < 0 || picked >= dlg.choices.length) {
        throw new Error(`Choice picker returned invalid index ${picked} for ${knot}`);
      }
      state = step(world, state, blankInput()).state;
      state = step(world, state, press({ choose: picked })).state;
      record(state);
      continue;
    }
    state = step(world, state, blankInput()).state;
    state = step(world, state, press({ confirm: true })).state;
    record(state);
  }
  expect(state.dialogue, `dialogue ${knot} should close cleanly`).toBeNull();
  return { state, lines, choiceSets };
}

function playOpenDialogue(
  world: World,
  initial: State,
  chooseIndex: (choices: readonly string[], text: string) => number = () => 0,
): PlayedDialogue {
  let state = initial;
  const lines: PlayedLine[] = [];
  const choiceSets: string[][] = [];
  let lastLineKey = "";
  const record = (current: State): void => {
    const dlg = current.dialogue;
    if (dlg === null) return;
    const key = `${dlg.speaker ?? ""}|${dlg.text}|${dlg.choices.join("/")}`;
    if (key === lastLineKey) return;
    lastLineKey = key;
    lines.push({ speaker: dlg.speaker, text: dlg.text });
    if (dlg.choices.length > 0) choiceSets.push([...dlg.choices]);
  };
  record(state);
  for (let guard = 0; guard < 600 && state.dialogue !== null; guard += 1) {
    const dlg = state.dialogue;
    if (dlg.revealed < dlg.text.length) {
      state = step(world, state, blankInput()).state;
      state = step(world, state, press({ confirm: true })).state;
      record(state);
      continue;
    }
    if (dlg.choices.length > 0) {
      const picked = chooseIndex(dlg.choices, dlg.text);
      state = step(world, state, blankInput()).state;
      state = step(world, state, press({ choose: picked })).state;
      record(state);
      continue;
    }
    state = step(world, state, blankInput()).state;
    state = step(world, state, press({ confirm: true })).state;
    record(state);
  }
  expect(state.dialogue).toBeNull();
  return { state, lines, choiceSets };
}

function pickChoiceMatching(pattern: RegExp): (choices: readonly string[]) => number {
  return (choices) => {
    const idx = choices.findIndex((choice) => pattern.test(choice));
    if (idx < 0) {
      throw new Error(`No choice matched ${pattern} in [${choices.join(", ")}]`);
    }
    return idx;
  };
}

function collectKnotBranches(
  story: Record<string, unknown>,
  ink: string,
  knot: string,
  facts?: InkFacts,
): WalkedLine[] {
  const collected: WalkedLine[] = [];
  const visit = (result: ReturnType<typeof runInk>, depth: number, steps: number): void => {
    if (steps > 90) return;
    if (result.line !== null) {
      collected.push({
        knot,
        speaker: result.line.speaker,
        text: result.line.text,
        tags: [...result.line.tags],
      });
    }
    if (result.ended) return;
    if (result.choices.length > 0) {
      if (depth >= 4) return;
      result.choices.forEach((_, index) => {
        const picked = runInk(story, result.ink, { type: "choose", index }, facts);
        visit(picked, depth + 1, steps + 1);
      });
      return;
    }
    const next = runInk(story, result.ink, { type: "next" }, facts);
    visit(next, depth, steps + 1);
  };
  visit(runInk(story, ink, { type: "start", knot }, facts), 0, 0);
  return collected;
}

const E11_PRE_REVEAL_H2H_KNOTS = [
  "h2h_fae_maddie",
  "h2h_fae_sue",
  "h2h_fae_jordan",
  "h2h_sue_jordan",
  "h2h_clubhouse_trio",
] as const;

const E11_QUEST_KNOTS = [
  "barnaby",
  "barnaby_star_chart_prompt",
  "barnaby_star_chart",
  "star_chart_plaza_glow",
  "star_chart_bay_glow",
  "star_chart_pass_glow",
  "rosie_home",
  "rosie_kite_chain_prompt",
  "rosie_kite_chain",
  "kite_ribbon_park",
  "kite_ribbon_lane",
  "kite_ribbon_crossing",
  "kite_ribbon_boardwalk",
  "toby",
  "toby_lullaby_prompt",
  "toby_lullaby",
  "lullaby_plaza",
  "lullaby_park",
  "lullaby_woods",
  "chef_bea",
  "bea_spice_run",
  "spice_sea_salt",
  "spice_pine_sugar",
  "spice_woodland_mint",
] as const;

const E11_ALL_KNOTS = [
  ...E11_PRE_REVEAL_H2H_KNOTS,
  "h2h_sanctuary_encore",
  ...E11_QUEST_KNOTS,
] as const;

describe("Elevation Track E11: Party Heart-to-Hearts", () => {
  const { world, fixtures } = loadContent();
  const newGameFixture = fixtures["new-game"];
  if (newGameFixture === undefined) throw new Error("missing new-game fixture");
  const baseState = createState(world, newGameFixture);

  it("enforces unlock milestones for all 6 Heart-to-Hearts and locks all during finale", () => {
    expect(HEART_TO_HEARTS).toHaveLength(6);

    const initialSummary = heartToHeartSummary(world, baseState);
    expect(initialSummary.total).toBe(6);
    expect(initialSummary.completed).toBe(0);
    expect(initialSummary.entries.every((entry) => !entry.unlocked && !entry.completed)).toBe(true);

    const byId = Object.fromEntries(HEART_TO_HEARTS.map((spec) => [spec.id, spec]));
    const faeMaddie = byId["fae-maddie"];
    const faeSue = byId["fae-sue"];
    const faeJordan = byId["fae-jordan"];
    const sueJordan = byId["sue-jordan"];
    const clubhouseTrio = byId["clubhouse-trio"];
    const sanctuaryEncore = byId["sanctuary-encore"];
    if (
      faeMaddie === undefined ||
      faeSue === undefined ||
      faeJordan === undefined ||
      sueJordan === undefined ||
      clubhouseTrio === undefined ||
      sanctuaryEncore === undefined
    ) {
      throw new Error("missing Heart-to-Heart spec");
    }

    // 1. Fae & Maddie unlocks via breakfast, clubhouse, or fountain-frog sticker.
    expect(faeMaddie.unlocked(world, baseState)).toBe(false);
    expect(faeMaddie.unlocked(world, withVars(baseState, { ate_breakfast: true }))).toBe(true);
    expect(faeMaddie.unlocked(world, withVars(baseState, { clubhouse_claimed: true }))).toBe(true);
    expect(faeMaddie.unlocked(world, { ...baseState, stickers: ["fountain-frog"] })).toBe(true);

    // 2. Fae & Sue requires sue_joined + bay milestone.
    expect(faeSue.unlocked(world, withVars(baseState, { sue_joined: true }))).toBe(false);
    expect(faeSue.unlocked(world, { ...baseState, stickers: ["bay-bluebird"] })).toBe(false);
    expect(
      faeSue.unlocked(
        world,
        withVars({ ...baseState, stickers: ["bay-bluebird"] }, { sue_joined: true }),
      ),
    ).toBe(true);
    expect(
      faeSue.unlocked(
        world,
        withVars({ ...baseState, stickers: ["lifeguard"] }, { sue_joined: true }),
      ),
    ).toBe(true);
    expect(
      faeSue.unlocked(world, withVars(baseState, { sue_joined: true, bluebird_calmed: true })),
    ).toBe(true);

    // 3. Fae & Jordan requires jordan_joined + (has_lantern || hiker-hamster sticker).
    expect(faeJordan.unlocked(world, withVars(baseState, { jordan_joined: true }))).toBe(false);
    expect(faeJordan.unlocked(world, withVars(baseState, { has_lantern: true }))).toBe(false);
    expect(
      faeJordan.unlocked(world, withVars(baseState, { jordan_joined: true, has_lantern: true })),
    ).toBe(true);
    expect(
      faeJordan.unlocked(
        world,
        withVars({ ...baseState, stickers: ["hiker-hamster"] }, { jordan_joined: true }),
      ),
    ).toBe(true);

    // 4. Sue & Jordan requires both sue_joined and jordan_joined.
    expect(sueJordan.unlocked(world, withVars(baseState, { sue_joined: true }))).toBe(false);
    expect(sueJordan.unlocked(world, withVars(baseState, { jordan_joined: true }))).toBe(false);
    expect(
      sueJordan.unlocked(world, withVars(baseState, { sue_joined: true, jordan_joined: true })),
    ).toBe(true);

    // 5. Clubhouse Trio requires clubhouse_claimed + sue_joined + jordan_joined.
    expect(
      clubhouseTrio.unlocked(world, withVars(baseState, { sue_joined: true, jordan_joined: true })),
    ).toBe(false);
    expect(
      clubhouseTrio.unlocked(
        world,
        withVars(baseState, { clubhouse_claimed: true, sue_joined: true }),
      ),
    ).toBe(false);
    expect(
      clubhouseTrio.unlocked(
        world,
        withVars(baseState, {
          clubhouse_claimed: true,
          sue_joined: true,
          jordan_joined: true,
        }),
      ),
    ).toBe(true);

    // 6. Sanctuary Encore unlocks ONLY when milo_revealed is true.
    const almostRevealed = withVars(
      {
        ...baseState,
        calms: { "hooded-kid": 1 },
        critters: { ...baseState.critters, "hooded-kid": "calm" },
        stickers: ["fountain-frog"],
      },
      {
        ate_breakfast: true,
        sue_joined: true,
        jordan_joined: true,
        clubhouse_claimed: true,
        has_lantern: true,
        bluebird_calmed: true,
        milo_revealed: false,
      },
    );
    expect(sanctuaryEncore.unlocked(world, almostRevealed)).toBe(false);

    const allUnlocked = withVars(almostRevealed, { milo_revealed: true });
    expect(sanctuaryEncore.unlocked(world, allUnlocked)).toBe(true);
    expect(
      heartToHeartSummary(world, allUnlocked).entries.every((entry) => entry.unlocked),
    ).toBe(true);

    // Finale lock: morning and credits disable every Heart-to-Heart and area spot.
    for (const finale of ["morning", "credits"] as const) {
      const duringFinale: State = { ...allUnlocked, finale };
      for (const spec of HEART_TO_HEARTS) {
        expect(spec.unlocked(world, duringFinale)).toBe(false);
        expect(heartToHeartSpotsInArea(world, duringFinale, spec.area)).toEqual([]);
      }
      expect(heartToHeartSpotsInArea(world, duringFinale, "park")).toEqual([]);
    }
  });

  it("targets all 6 Heart-to-Heart spots (including park altSpot) and warm heart prompt", () => {
    const unlockedAll = withVars(baseState, {
      ate_breakfast: true,
      sue_joined: true,
      bluebird_calmed: true,
      jordan_joined: true,
      has_lantern: true,
      clubhouse_claimed: true,
      milo_revealed: true,
    });

    for (const spec of HEART_TO_HEARTS) {
      const placed = placeFacingTarget(
        world,
        unlockedAll,
        spec.area,
        spec.point,
        `heart:${spec.id}`,
      );
      const target = targetInteractable(world, placed);
      expect(target?.id).toBe(`heart:${spec.id}`);
      expect(target?.knot).toBe(spec.knot);
      expect(target?.prompt).toBe("Heart");

      const prompt = computePromptScreenView(
        world,
        placed,
        { x: placed.player.x, y: placed.player.y },
        1280,
        720,
        1280,
        720,
      );
      expect(prompt.visible).toBe(true);
      expect(prompt.label).toBe("♥ HEART");
      expect(prompt.tone).toBe("heart");
    }

    // Contrast: normal interactable does NOT carry tone: "heart".
    const bedroomWindow = world.areas.bedroom?.interactables.find((item) => item.id === "window");
    expect(bedroomWindow).toBeDefined();
    if (bedroomWindow !== undefined) {
      const placedNormal = placeFacingTarget(
        world,
        unlockedAll,
        "bedroom",
        bedroomWindow.point,
        "window",
      );
      const normalPrompt = computePromptScreenView(
        world,
        placedNormal,
        { x: placedNormal.player.x, y: placedNormal.player.y },
        1280,
        720,
        1280,
        720,
      );
      expect(normalPrompt.visible).toBe(true);
      expect(normalPrompt.label).toBe("LOOK");
      expect(normalPrompt.tone).toBeUndefined();
    }

    // Park altSpot for Fae & Maddie exists while unseen and disappears once completed.
    const faeMaddie = HEART_TO_HEARTS.find((spec) => spec.id === "fae-maddie");
    expect(faeMaddie?.altSpot).toBeDefined();
    if (faeMaddie?.altSpot === undefined) return;

    const atParkUnseen = placeFacingTarget(
      world,
      unlockedAll,
      faeMaddie.altSpot.area,
      faeMaddie.altSpot.point,
      "heart:fae-maddie",
    );
    expect(targetInteractable(world, atParkUnseen)?.id).toBe("heart:fae-maddie");
    expect(heartToHeartSpotsInArea(world, unlockedAll, "park")).toHaveLength(1);

    const afterDone = withVars(unlockedAll, { h2h_fae_maddie_done: true });
    expect(heartToHeartSpotsInArea(world, afterDone, "park")).toEqual([]);
    const atParkDone: State = { ...atParkUnseen, ink: afterDone.ink };
    expect(targetInteractable(world, atParkDone)?.id).not.toBe("heart:fae-maddie");

    // Primary bedroom spot remains targetable for replay after completion.
    const atBedroomDone = placeFacingTarget(
      world,
      afterDone,
      faeMaddie.area,
      faeMaddie.point,
      "heart:fae-maddie",
    );
    expect(targetInteractable(world, atBedroomDone)?.id).toBe("heart:fae-maddie");
  });

  it("plays Fae & Maddie Heart-to-Heart across both branches, gifts, and clean replay", () => {
    const start = withVars(baseState, { ate_breakfast: true });

    const branch1 = playDialogue(world, start, "h2h_fae_maddie", pickChoiceMatching(/star cape/i));
    const joined1 = branch1.lines.map((line) => line.text).join(" ");
    expect(joined1).toMatch(/Mom and Dad gave me this notebook/i);
    expect(joined1).toMatch(/Baby Oliver had just come home/i);
    expect(joined1).toMatch(/first night.*tiny kitten.*curled up/i);
    expect(joined1).toMatch(/gold star cape/i);
    expect(world.storyVariable(branch1.state.ink, "h2h_fae_maddie_done")).toBe(true);
    expect(branch1.state.coins).toBe(start.coins + 10);
    expect(branch1.state.snacks).toBe(start.snacks + 2);

    const branch2 = playDialogue(
      world,
      start,
      "h2h_fae_maddie",
      pickChoiceMatching(/honey biscuits/i),
    );
    expect(branch2.lines.map((line) => line.text).join(" ")).toMatch(/crispy clover biscuits/i);
    expect(world.storyVariable(branch2.state.ink, "h2h_fae_maddie_done")).toBe(true);
    expect(branch2.state.coins).toBe(start.coins + 10);
    expect(branch2.state.snacks).toBe(start.snacks + 2);

    // Replay does not re-grant gifts.
    const replay = playDialogue(world, branch1.state, "h2h_fae_maddie");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.lines.map((line) => line.text).join(" ")).toMatch(/favorite page/i);
    expect(replay.state.coins).toBe(branch1.state.coins);
    expect(replay.state.snacks).toBe(branch1.state.snacks);
  });

  it("plays Fae & Sue Heart-to-Heart across both branches, awards taffy + 12 coins", () => {
    const start = withVars(baseState, { sue_joined: true, bluebird_calmed: true });

    const branch1 = playDialogue(world, start, "h2h_fae_sue", pickChoiceMatching(/nervous/i));
    const joined1 = branch1.lines.map((line) => line.text).join(" ");
    expect(joined1).toMatch(/sea-glass compass/i);
    expect(joined1).toMatch(/Being brave doesn't mean the waves stop looking huge/i);
    expect(joined1).toMatch(/tide-jitters/i);
    expect(world.storyVariable(branch1.state.ink, "h2h_fae_sue_done")).toBe(true);
    expect(treatCount(branch1.state, "sea-salt-taffy")).toBe(
      treatCount(start, "sea-salt-taffy") + 1,
    );
    expect(branch1.state.coins).toBe(start.coins + 12);

    const branch2 = playDialogue(world, start, "h2h_fae_sue", pickChoiceMatching(/bay tide/i));
    expect(branch2.lines.map((line) => line.text).join(" ")).toMatch(/sea foam pause/i);
    expect(treatCount(branch2.state, "sea-salt-taffy")).toBe(
      treatCount(start, "sea-salt-taffy") + 1,
    );
    expect(branch2.state.coins).toBe(start.coins + 12);

    const replay = playDialogue(world, branch1.state, "h2h_fae_sue");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.lines.map((line) => line.text).join(" ")).toMatch(/Steady needle/i);
    expect(replay.state.coins).toBe(branch1.state.coins);
    expect(treatCount(replay.state, "sea-salt-taffy")).toBe(
      treatCount(branch1.state, "sea-salt-taffy"),
    );
  });

  it("plays Fae & Jordan Heart-to-Heart across both branches, awards brittle + 12 coins", () => {
    const start = withVars(baseState, { jordan_joined: true, has_lantern: true });

    const branch1 = playDialogue(world, start, "h2h_fae_jordan", pickChoiceMatching(/trail map/i));
    const joined1 = branch1.lines.map((line) => line.text).join(" ");
    expect(joined1).toMatch(/cheerful mountain guide/i);
    expect(joined1).toMatch(/pack gets kinda heavy/i);
    expect(joined1).toMatch(/need a breather/i);
    expect(joined1).toMatch(/map pouch/i);
    expect(world.storyVariable(branch1.state.ink, "h2h_fae_jordan_done")).toBe(true);
    expect(treatCount(branch1.state, "maple-brittle")).toBe(
      treatCount(start, "maple-brittle") + 1,
    );
    expect(branch1.state.coins).toBe(start.coins + 12);

    const branch2 = playDialogue(world, start, "h2h_fae_jordan", pickChoiceMatching(/pine snow/i));
    expect(branch2.lines.map((line) => line.text).join(" ")).toMatch(/counting mileposts/i);
    expect(treatCount(branch2.state, "maple-brittle")).toBe(
      treatCount(start, "maple-brittle") + 1,
    );
    expect(branch2.state.coins).toBe(start.coins + 12);

    const replay = playDialogue(world, branch1.state, "h2h_fae_jordan");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.lines.map((line) => line.text).join(" ")).toMatch(/Best trail breather/i);
    expect(replay.state.coins).toBe(branch1.state.coins);
    expect(treatCount(replay.state, "maple-brittle")).toBe(
      treatCount(branch1.state, "maple-brittle"),
    );
  });

  it("plays Sue & Jordan Heart-to-Heart across all 3 votes, awards sundae + 12 coins", () => {
    const start = withVars(baseState, { sue_joined: true, jordan_joined: true });

    const taffy = playDialogue(
      world,
      start,
      "h2h_sue_jordan",
      pickChoiceMatching(/Vote Team Sea-Salt Taffy/i),
    );
    expect(taffy.choiceSets[0]).toHaveLength(3);
    const taffyText = taffy.lines.map((line) => line.text).join(" ");
    expect(taffyText).toMatch(/sea-salt taffy/i);
    expect(taffyText).toMatch(/marshmallow cocoa/i);
    expect(taffyText).toMatch(/Bubblegum Bay takes the trophy/i);
    expect(world.storyVariable(taffy.state.ink, "h2h_sue_jordan_done")).toBe(true);
    expect(treatCount(taffy.state, "cocoa-sundae")).toBe(treatCount(start, "cocoa-sundae") + 1);
    expect(taffy.state.coins).toBe(start.coins + 12);

    const cocoa = playDialogue(
      world,
      start,
      "h2h_sue_jordan",
      pickChoiceMatching(/Vote Team Marshmallow Cocoa/i),
    );
    expect(cocoa.lines.map((line) => line.text).join(" ")).toMatch(/gold medal/i);
    expect(treatCount(cocoa.state, "cocoa-sundae")).toBe(treatCount(start, "cocoa-sundae") + 1);
    expect(cocoa.state.coins).toBe(start.coins + 12);

    const combo = playDialogue(
      world,
      start,
      "h2h_sue_jordan",
      pickChoiceMatching(/Combine them/i),
    );
    expect(combo.lines.map((line) => line.text).join(" ")).toMatch(/unstoppable combo/i);
    expect(treatCount(combo.state, "cocoa-sundae")).toBe(treatCount(start, "cocoa-sundae") + 1);
    expect(combo.state.coins).toBe(start.coins + 12);

    const replay = playDialogue(world, combo.state, "h2h_sue_jordan");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.lines.map((line) => line.text).join(" ")).toMatch(/Snack Treaty/i);
    expect(replay.state.coins).toBe(combo.state.coins);
    expect(treatCount(replay.state, "cocoa-sundae")).toBe(
      treatCount(combo.state, "cocoa-sundae"),
    );
  });

  it("plays Clubhouse Trio pre-reveal (ZERO Milo mention) and post-reveal with rewards", () => {
    const preReveal = withVars(baseState, {
      clubhouse_claimed: true,
      sue_joined: true,
      jordan_joined: true,
      milo_revealed: false,
    });

    const preToast = playDialogue(
      world,
      preReveal,
      "h2h_clubhouse_trio",
      pickChoiceMatching(/Raise a toast/i),
    );
    const preText = preToast.lines.map((line) => line.text).join(" ");
    expect(preText).toMatch(/kid in the purple hood/i);
    expect(preText).not.toMatch(/\bmilo\b/i);
    expect(preToast.choiceSets.flat().join(" ")).not.toMatch(/\bmilo\b/i);
    expect(preText).toMatch(/found family/i);
    expect(world.storyVariable(preToast.state.ink, "h2h_clubhouse_trio_done")).toBe(true);
    expect(treatCount(preToast.state, "sunberry-nectar")).toBe(
      treatCount(preReveal, "sunberry-nectar") + 1,
    );
    expect(preToast.state.snacks).toBe(preReveal.snacks + 2);
    expect(preToast.state.coins).toBe(preReveal.coins + 15);

    const preMaddie = playDialogue(
      world,
      withVars(preReveal, { meals_cooked: 1 }),
      "h2h_clubhouse_trio",
      pickChoiceMatching(/Slip Maddie/i),
    );
    const preMaddieText = preMaddie.lines.map((line) => line.text).join(" ");
    expect(preMaddieText).toMatch(/microwave dino snacks/i);
    expect(preMaddieText).toMatch(/turbo-purr/i);
    expect(preMaddieText).not.toMatch(/\bmilo\b/i);

    // Post-reveal reflects warmly on Milo across both choices and awards the same gift bundle.
    const postReveal = withVars(preReveal, { milo_revealed: true });
    const postToast = playDialogue(
      world,
      postReveal,
      "h2h_clubhouse_trio",
      pickChoiceMatching(/Raise a toast/i),
    );
    const postText = postToast.lines.map((line) => line.text).join(" ");
    expect(postText).toMatch(/actually listened to Milo/i);
    expect(postText).toMatch(/comic sketchbook/i);
    expect(treatCount(postToast.state, "sunberry-nectar")).toBe(
      treatCount(postReveal, "sunberry-nectar") + 1,
    );
    expect(postToast.state.snacks).toBe(postReveal.snacks + 2);
    expect(postToast.state.coins).toBe(postReveal.coins + 15);

    const postMaddie = playDialogue(
      world,
      postReveal,
      "h2h_clubhouse_trio",
      pickChoiceMatching(/Slip Maddie/i),
    );
    expect(postMaddie.lines.map((line) => line.text).join(" ")).toMatch(/turbo-purr/i);
    expect(world.storyVariable(postMaddie.state.ink, "h2h_clubhouse_trio_done")).toBe(true);

    const replay = playDialogue(world, postToast.state, "h2h_clubhouse_trio");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.state.coins).toBe(postToast.state.coins);
    expect(replay.state.snacks).toBe(postToast.state.snacks);
    expect(treatCount(replay.state, "sunberry-nectar")).toBe(
      treatCount(postToast.state, "sunberry-nectar"),
    );
  });

  it("plays Sanctuary Encore across all 3 branches, awards 25 coins + sunberry-nectar", () => {
    const start = withVars(baseState, { milo_revealed: true });

    const frogBranch = playDialogue(
      world,
      start,
      "h2h_sanctuary_encore",
      pickChoiceMatching(/Fountain Frog/i),
    );
    expect(frogBranch.choiceSets[0]).toHaveLength(3);
    const frogText = frogBranch.lines.map((line) => line.text).join(" ");
    const speakers = new Set(frogBranch.lines.map((line) => line.speaker));
    expect(speakers.has("Fae")).toBe(true);
    expect(speakers.has("Maddie")).toBe(true);
    expect(speakers.has("Sue")).toBe(true);
    expect(speakers.has("Jordan")).toBe(true);
    expect(speakers.has("Milo")).toBe(true);
    expect(frogText).toMatch(/laughing/i);
    expect(frogText).toMatch(/bubblegum/i);
    expect(world.storyVariable(frogBranch.state.ink, "h2h_sanctuary_encore_done")).toBe(true);
    expect(frogBranch.state.coins).toBe(start.coins + 25);
    expect(treatCount(frogBranch.state, "sunberry-nectar")).toBe(
      treatCount(start, "sunberry-nectar") + 1,
    );

    const crewBranch = playDialogue(
      world,
      start,
      "h2h_sanctuary_encore",
      pickChoiceMatching(/Meeting Sue by the bay/i),
    );
    expect(crewBranch.lines.map((line) => line.text).join(" ")).toMatch(/sea-glass compass/i);
    expect(crewBranch.state.coins).toBe(start.coins + 25);
    expect(treatCount(crewBranch.state, "sunberry-nectar")).toBe(
      treatCount(start, "sunberry-nectar") + 1,
    );

    const treeBranch = playDialogue(
      world,
      start,
      "h2h_sanctuary_encore",
      pickChoiceMatching(/Reaching Milo under the Ancient Tree/i),
    );
    expect(treeBranch.lines.map((line) => line.text).join(" ")).toMatch(/paint the background/i);
    expect(treeBranch.state.coins).toBe(start.coins + 25);

    const replay = playDialogue(world, frogBranch.state, "h2h_sanctuary_encore");
    expect(replay.choiceSets).toEqual([]);
    expect(replay.lines.map((line) => line.text).join(" ")).toMatch(/Best dream adventure/i);
    expect(replay.state.coins).toBe(frogBranch.state.coins);
    expect(treatCount(replay.state, "sunberry-nectar")).toBe(
      treatCount(frogBranch.state, "sunberry-nectar"),
    );
  });

  it("records heartfelt Journal entries for all 6 Heart-to-Hearts and gates Sanctuary note", () => {
    // Pre-reveal: even if all 6 done flags were set, Sanctuary Encore note stays hidden.
    const preRevealDone = withVars(baseState, {
      h2h_fae_maddie_done: true,
      h2h_fae_sue_done: true,
      h2h_fae_jordan_done: true,
      h2h_sue_jordan_done: true,
      h2h_clubhouse_trio_done: true,
      h2h_sanctuary_encore_done: true,
      milo_revealed: false,
    });
    const preNotes = journalNotes(world, preRevealDone);
    expect(preNotes.some((n) => /page one of my journal with Maddie/i.test(n))).toBe(true);
    expect(preNotes.some((n) => /sea-glass compass/i.test(n))).toBe(true);
    expect(preNotes.some((n) => /pressure to be the cheerful guide/i.test(n))).toBe(true);
    expect(preNotes.some((n) => /Coast-Meets-Mountain Snack Treaty/i.test(n))).toBe(true);
    expect(preNotes.some((n) => /Clubhouse Snack Night/i.test(n))).toBe(true);
    expect(preNotes.some((n) => /wildest dream-adventure moments/i.test(n))).toBe(false);
    expect(preNotes.join(" ")).not.toMatch(/\bmilo\b/i);

    // Post-reveal: all 6 Heart-to-Heart journal memories appear.
    const postRevealDone = withVars(preRevealDone, { milo_revealed: true });
    const postNotes = journalNotes(world, postRevealDone);
    expect(postNotes.some((n) => /Milo, and I laughed in the sunlit Wildlife Sanctuary/i.test(n)))
      .toBe(true);
    const h2hMemories = postNotes.filter((n) => n.startsWith("Heart-to-Heart Memory:"));
    expect(h2hMemories).toHaveLength(6);
  });
});

describe("Elevation Track E11: Interactive Multi-Step Living NPC Quests", () => {
  const { world, fixtures } = loadContent();
  const newGameFixture = fixtures["new-game"];
  if (newGameFixture === undefined) throw new Error("missing new-game fixture");
  const baseState = createState(world, newGameFixture);

  it("completes Grandpa Barnaby's Star Chart with Blacklight Lantern gating and notes", () => {
    // Locked before has_lantern.
    const beforeLantern = playDialogue(world, baseState, "barnaby");
    expect(beforeLantern.choiceSets).toEqual([]);
    expect(world.storyVariable(beforeLantern.state.ink, "star_chart_quest")).toBe(false);

    // Starts via barnaby when has_lantern is true.
    const withLantern = withVars(baseState, { has_lantern: true });
    const started = playDialogue(
      world,
      withLantern,
      "barnaby",
      pickChoiceMatching(/old Star Chart/i),
    );
    expect(world.storyVariable(started.state.ink, "star_chart_quest")).toBe(true);
    expect(
      journalNotes(world, started.state).some((n) =>
        /Grandpa Barnaby's Star Chart \(0\/3\)/i.test(n),
      ),
    ).toBe(true);

    // All 3 glows require state.lantern === true to be targetable via targetInteractable.
    const starGlows = [
      {
        area: "plaza",
        id: "star-chart-plaza",
        knot: "star_chart_plaza_glow",
        flag: "star_chart_plaza",
      },
      {
        area: "bay",
        id: "star-chart-bay",
        knot: "star_chart_bay_glow",
        flag: "star_chart_bay",
      },
      {
        area: "pass",
        id: "star-chart-pass",
        knot: "star_chart_pass_glow",
        flag: "star_chart_pass",
      },
    ] as const;

    let state = started.state;
    starGlows.forEach((entry, index) => {
      const glow = world.areas[entry.area]?.glows.find((item) => item.id === entry.id);
      expect(glow).toBeDefined();
      if (glow === undefined) return;

      const withLightOn = placeFacingTarget(
        world,
        { ...state, lantern: true },
        entry.area,
        glow.point,
        `glow:${entry.id}`,
      );
      expect(targetInteractable(world, withLightOn)?.id).toBe(`glow:${entry.id}`);

      // Same spot with lantern OFF must NOT target the glow.
      const withLightOff: State = { ...withLightOn, lantern: false };
      expect(targetInteractable(world, withLightOff)?.id).not.toBe(`glow:${entry.id}`);

      const readGlow = playDialogue(world, withLightOn, entry.knot);
      state = readGlow.state;
      expect(world.storyVariable(state.ink, entry.flag)).toBe(true);
      expect(
        journalNotes(world, state).some((n) =>
          n.includes(`Grandpa Barnaby's Star Chart (${index + 1}/3)`),
        ),
      ).toBe(true);

      // Re-reading glow hits clean after branch.
      const reread = playDialogue(world, state, entry.knot);
      expect(reread.lines.length).toBeGreaterThan(0);
    });

    // Return to Barnaby for completion rewards (+25 coins, +2 snacks).
    const beforeTurnInCoins = state.coins;
    const beforeTurnInSnacks = state.snacks;
    const completed = playDialogue(world, state, "barnaby");
    expect(world.storyVariable(completed.state.ink, "star_chart_done")).toBe(true);
    expect(completed.state.coins).toBe(beforeTurnInCoins + 25);
    expect(completed.state.snacks).toBe(beforeTurnInSnacks + 2);

    const doneNotes = journalNotes(world, completed.state);
    expect(doneNotes.some((n) => /restore Grandpa Barnaby's observatory Star Chart/i.test(n))).toBe(
      true,
    );
    expect(doneNotes.some((n) => /Grandpa Barnaby's Star Chart \(/i.test(n))).toBe(false);

    // Subsequent talk celebrates without re-granting rewards.
    const postTalk = playDialogue(world, completed.state, "barnaby");
    expect(postTalk.lines.map((line) => line.text).join(" ")).toMatch(
      /restored Cloverhollow Star Chart/i,
    );
    expect(postTalk.state.coins).toBe(completed.state.coins);
    expect(postTalk.state.snacks).toBe(completed.state.snacks);
  });

  it("completes Rosie's Runaway Kite Chain with pre-lasso teases, 4 snags, and rewards", () => {
    const ribbonSpots = [
      { area: "park", id: "kite-ribbon-park", knot: "kite_ribbon_park", flag: "kite_tail_park" },
      { area: "lane", id: "kite-ribbon-lane", knot: "kite_ribbon_lane", flag: "kite_tail_lane" },
      {
        area: "crossing",
        id: "kite-ribbon-crossing",
        knot: "kite_ribbon_crossing",
        flag: "kite_tail_crossing",
      },
      {
        area: "boardwalk",
        id: "kite-ribbon-boardwalk",
        knot: "kite_ribbon_boardwalk",
        flag: "kite_tail_boardwalk",
      },
    ] as const;

    // Before has_lasso: Rosie does not offer the quest, and all 4 spots only tease.
    const rosieEarly = playDialogue(world, baseState, "rosie_home");
    expect(rosieEarly.choiceSets).toEqual([]);
    expect(world.storyVariable(rosieEarly.state.ink, "kite_chain_quest")).toBe(false);

    for (const spot of ribbonSpots) {
      const interactable = world.areas[spot.area]?.interactables.find((i) => i.id === spot.id);
      expect(interactable).toBeDefined();
      if (interactable === undefined) return;
      const placed = placeFacingTarget(world, baseState, spot.area, interactable.point, spot.id);
      expect(targetInteractable(world, placed)?.id).toBe(spot.id);
      const teased = playDialogue(world, placed, spot.knot);
      expect(teased.choiceSets).toEqual([]);
      expect(world.storyVariable(teased.state.ink, spot.flag)).toBe(false);
    }

    // With has_lasso: start quest at rosie_home.
    const withLasso = withVars(rosieEarly.state, { has_lasso: true });
    const started = playDialogue(
      world,
      withLasso,
      "rosie_home",
      pickChoiceMatching(/runaway kite ribbons/i),
    );
    expect(world.storyVariable(started.state.ink, "kite_chain_quest")).toBe(true);
    expect(
      journalNotes(world, started.state).some((n) =>
        /Rosie's Runaway Kite Chain \(0\/4\)/i.test(n),
      ),
    ).toBe(true);

    // Snag all 4 ribbons; verify "Not now" leaves flag false before snagging.
    let state = started.state;
    ribbonSpots.forEach((spot, index) => {
      const declined = playDialogue(world, state, spot.knot, pickChoiceMatching(/Not now/i));
      expect(world.storyVariable(declined.state.ink, spot.flag)).toBe(false);

      const snagged = playDialogue(world, state, spot.knot, pickChoiceMatching(/Lasso-snag/i));
      state = snagged.state;
      expect(world.storyVariable(state.ink, spot.flag)).toBe(true);
      expect(
        journalNotes(world, state).some((n) =>
          n.includes(`Rosie's Runaway Kite Chain (${index + 1}/4)`),
        ),
      ).toBe(true);
    });

    // Return to Rosie for +25 coins, +1 berry-cone, +1 snack.
    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    const conesBefore = treatCount(state, "berry-cone");
    const completed = playDialogue(world, state, "rosie_home");
    expect(world.storyVariable(completed.state.ink, "kite_chain_done")).toBe(true);
    expect(completed.state.coins).toBe(coinsBefore + 25);
    expect(treatCount(completed.state, "berry-cone")).toBe(conesBefore + 1);
    expect(completed.state.snacks).toBe(snacksBefore + 1);

    const doneNotes = journalNotes(world, completed.state);
    expect(
      doneNotes.some((n) => /lassoed all four of Rosie's runaway pastel kite ribbons/i.test(n)),
    ).toBe(true);
    expect(doneNotes.some((n) => /Rosie's Runaway Kite Chain \(/i.test(n))).toBe(false);
  });

  it("completes Toby's Sleepy Lullaby via real flute step() and direct confirm", () => {
    // Locked before has_flute.
    const tobyBefore = playDialogue(world, baseState, "toby");
    expect(tobyBefore.choiceSets).toEqual([]);
    expect(world.storyVariable(tobyBefore.state.ink, "lullaby_quest")).toBe(false);

    // Tease landmark before has_flute.
    const plazaTease = playDialogue(world, baseState, "lullaby_plaza");
    expect(plazaTease.choiceSets).toEqual([]);
    expect(world.storyVariable(plazaTease.state.ink, "lullaby_note_plaza")).toBe(false);

    // Before lullaby_quest: pressing flute: true right next to lullaby-plaza opens normal `flute`.
    const plazaSpot = LULLABY_FLUTE_SPOTS.find((spot) => spot.id === "lullaby-plaza");
    const parkSpot = LULLABY_FLUTE_SPOTS.find((spot) => spot.id === "lullaby-park");
    const woodsSpot = LULLABY_FLUTE_SPOTS.find((spot) => spot.id === "lullaby-woods");
    if (plazaSpot === undefined || parkSpot === undefined || woodsSpot === undefined) {
      throw new Error("missing LULLABY_FLUTE_SPOTS entry");
    }

    const withFlute = withVars(baseState, { has_flute: true });
    const nearPlazaPreQuest = placeFacingTarget(world, withFlute, "plaza", plazaSpot.point);
    expect(findLullabyFluteSpot(world, nearPlazaPreQuest)).toBeUndefined();
    const preQuestFlute = step(world, nearPlazaPreQuest, press({ flute: true })).state;
    expect(preQuestFlute.dialogue?.knot).toBe("flute");

    // Start quest at Toby.
    const started = playDialogue(
      world,
      withFlute,
      "toby",
      pickChoiceMatching(/sleepy town-square lullaby/i),
    );
    expect(world.storyVariable(started.state.ink, "lullaby_quest")).toBe(true);
    expect(
      journalNotes(world, started.state).some((n) => /Toby's Sleepy Lullaby \(0\/3\)/i.test(n)),
    ).toBe(true);

    // Range boundary: 115 units hits spot, 116 units misses and opens normal `flute`.
    const inRangeState: State = {
      ...started.state,
      area: "plaza",
      player: { x: plazaSpot.point.x + 115, y: plazaSpot.point.y },
    };
    expect(findLullabyFluteSpot(world, inRangeState)?.id).toBe("lullaby-plaza");
    const outOfRangeState: State = {
      ...started.state,
      area: "plaza",
      player: { x: plazaSpot.point.x + 116, y: plazaSpot.point.y },
    };
    expect(findLullabyFluteSpot(world, outOfRangeState)).toBeUndefined();
    const awayFlute = step(world, outOfRangeState, press({ flute: true })).state;
    expect(awayFlute.dialogue?.knot).toBe("flute");

    // Verify all 3 musical landmarks work BOTH via direct Confirm AND via real Harmony Flute.
    const allThreeSpots = [plazaSpot, parkSpot, woodsSpot] as const;
    for (const spot of allThreeSpots) {
      const placedConfirm = placeFacingTarget(world, started.state, spot.area, spot.point, spot.id);
      expect(targetInteractable(world, placedConfirm)?.id).toBe(spot.id);
      const viaConfirm = step(world, placedConfirm, press({ confirm: true })).state;
      expect(viaConfirm.dialogue?.knot).toBe(spot.knot);
      const confirmDone = playOpenDialogue(world, viaConfirm, pickChoiceMatching(/Harmony Flute/i));
      expect(world.storyVariable(confirmDone.state.ink, spot.doneVariable)).toBe(true);
    }

    // Complete all 3 sequentially via real Harmony Flute press (`flute: true`).
    let lullabyState = started.state;
    allThreeSpots.forEach((spot, index) => {
      const placedFlute = placeFacingTarget(world, lullabyState, spot.area, spot.point, spot.id);
      const opened = step(world, placedFlute, press({ flute: true })).state;
      expect(opened.dialogue?.knot).toBe(spot.knot);
      const played = playOpenDialogue(world, opened, pickChoiceMatching(/Harmony Flute/i));
      lullabyState = played.state;
      expect(world.storyVariable(lullabyState.ink, spot.doneVariable)).toBe(true);
      expect(
        journalNotes(world, lullabyState).some((n) =>
          n.includes(`Toby's Sleepy Lullaby (${index + 1}/3)`),
        ),
      ).toBe(true);
      // Pressing flute again near the now-recorded landmark falls back to normal `flute`.
      const fallback = step(
        world,
        step(world, lullabyState, blankInput()).state,
        press({ flute: true }),
      ).state;
      expect(fallback.dialogue?.knot).toBe("flute");
    });

    // Return to Toby for +25 coins, +1 orchard-apple, +1 snack.
    const coinsBefore = lullabyState.coins;
    const snacksBefore = lullabyState.snacks;
    const applesBefore = treatCount(lullabyState, "orchard-apple");
    const completed = playDialogue(world, lullabyState, "toby");
    expect(world.storyVariable(completed.state.ink, "lullaby_done")).toBe(true);
    expect(completed.state.coins).toBe(coinsBefore + 25);
    expect(treatCount(completed.state, "orchard-apple")).toBe(applesBefore + 1);
    expect(completed.state.snacks).toBe(snacksBefore + 1);

    const doneNotes = journalNotes(world, completed.state);
    expect(doneNotes.some((n) => /composed the Sleepy Cloverhollow Lullaby/i.test(n))).toBe(true);
    expect(doneNotes.some((n) => /Toby's Sleepy Lullaby \(/i.test(n))).toBe(false);
  });

  it("completes Chef Bea's Valley Spice Run with milestone gating, 3 spices, and rewards", () => {
    // Not offered before spice_returned even if visited_pass is true.
    const noSpiceReturned = playDialogue(
      world,
      withVars(baseState, { spice_quest: true, visited_pass: true }),
      "chef_bea",
      pickChoiceMatching(/Just saying hi/i),
    );
    expect(noSpiceReturned.choiceSets.flat().some((c) => /Valley Spice Run/i.test(c))).toBe(false);

    // Not offered when spice_returned is true but neither visited_pass nor jordan_joined.
    const noPassOrJordan = playDialogue(
      world,
      withVars(baseState, { spice_quest: true, spice_found: true, spice_returned: true }),
      "chef_bea",
      pickChoiceMatching(/Just saying hi/i),
    );
    expect(noPassOrJordan.choiceSets.flat().some((c) => /Valley Spice Run/i.test(c))).toBe(false);

    // Offered with spice_returned && jordan_joined.
    const viaJordan = playDialogue(
      world,
      withVars(baseState, {
        spice_quest: true,
        spice_found: true,
        spice_returned: true,
        jordan_joined: true,
      }),
      "chef_bea",
      pickChoiceMatching(/Valley Spice Run/i),
    );
    expect(world.storyVariable(viaJordan.state.ink, "valley_spice_quest")).toBe(true);

    // Offered with spice_returned && visited_pass.
    const viaPass = playDialogue(
      world,
      withVars(baseState, {
        spice_quest: true,
        spice_found: true,
        spice_returned: true,
        visited_pass: true,
      }),
      "chef_bea",
      pickChoiceMatching(/Valley Spice Run/i),
    );
    expect(world.storyVariable(viaPass.state.ink, "valley_spice_quest")).toBe(true);
    expect(
      journalNotes(world, viaPass.state).some((n) =>
        /Chef Bea's Valley Spice Run \(0\/3\)/i.test(n),
      ),
    ).toBe(true);

    // Spice spots tease before spice_returned / valley_spice_quest.
    const spiceSpots = [
      { area: "bay", id: "spice-sea-salt", knot: "spice_sea_salt", flag: "valley_spice_salt" },
      { area: "pass", id: "spice-pine-sugar", knot: "spice_pine_sugar", flag: "valley_spice_pine" },
      {
        area: "woods",
        id: "spice-woodland-mint",
        knot: "spice_woodland_mint",
        flag: "valley_spice_mint",
      },
    ] as const;

    for (const spot of spiceSpots) {
      const early = playDialogue(world, baseState, spot.knot);
      expect(world.storyVariable(early.state.ink, spot.flag)).toBe(false);
    }

    // Collect all 3 regional spices and verify targeting + journal progression.
    let state = viaPass.state;
    spiceSpots.forEach((spot, index) => {
      const interactable = world.areas[spot.area]?.interactables.find((i) => i.id === spot.id);
      expect(interactable).toBeDefined();
      if (interactable === undefined) return;
      const placed = placeFacingTarget(world, state, spot.area, interactable.point, spot.id);
      expect(targetInteractable(world, placed)?.id).toBe(spot.id);
      const gathered = playDialogue(world, placed, spot.knot);
      state = gathered.state;
      expect(world.storyVariable(state.ink, spot.flag)).toBe(true);
      expect(
        journalNotes(world, state).some((n) =>
          n.includes(`Chef Bea's Valley Spice Run (${index + 1}/3)`),
        ),
      ).toBe(true);
    });

    // Return to Chef Bea for +30 coins, +2 snacks, +1 sunberry-nectar.
    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    const nectarBefore = treatCount(state, "sunberry-nectar");
    const completed = playDialogue(
      world,
      state,
      "chef_bea",
      pickChoiceMatching(/Valley Spice Run/i),
    );
    expect(world.storyVariable(completed.state.ink, "valley_spice_done")).toBe(true);
    expect(completed.state.coins).toBe(coinsBefore + 30);
    expect(completed.state.snacks).toBe(snacksBefore + 2);
    expect(treatCount(completed.state, "sunberry-nectar")).toBe(nectarBefore + 1);

    const doneNotes = journalNotes(world, completed.state);
    expect(doneNotes.some((n) => /Three-Biome Cloverhollow Festival Tart/i.test(n))).toBe(true);
    expect(doneNotes.some((n) => /Chef Bea's Valley Spice Run \(/i.test(n))).toBe(false);

    // Valley Spice Run choice no longer appears after completion.
    const afterDone = playDialogue(
      world,
      completed.state,
      "chef_bea",
      pickChoiceMatching(/Just saying hi/i),
    );
    expect(afterDone.choiceSets.flat().some((c) => /Valley Spice Run/i.test(c))).toBe(false);
  });
});

describe("Elevation Track E11: Ink Direction, Milo Secrecy, Portraits, and Walkability", () => {
  const { world, fixtures } = loadContent();
  const story = loadStoryFromDisk();
  const newGameFixture = fixtures["new-game"];
  if (newGameFixture === undefined) throw new Error("missing new-game fixture");
  const baseState = createState(world, newGameFixture);

  it("validates # expr: and # pose: tags on the compiled story and rejects bad values", () => {
    const prices = Object.fromEntries(
      world.arcade.counter.prizes.map((item) => [item.prize, item.price]),
    );
    const treatPrices = Object.fromEntries(world.treats.map((item) => [item.id, item.price]));

    expect(storyTagErrors(storyTags(story), world.areas, prices, treatPrices)).toEqual([]);

    // Accepts every canonical expression and pose.
    const canonicalTags = [
      ...STORY_EXPRESSIONS.map((expr) => `expr: ${expr}`),
      ...STORY_POSES.map((pose) => `pose: ${pose}`),
    ];
    expect(storyTagErrors(canonicalTags, world.areas, prices, treatPrices)).toEqual([]);

    // Rejects invalid expressions and poses.
    const badTags = ["expr: grumpy", "expr: ", "pose: backflip", "pose: "];
    const errors = storyTagErrors(badTags, world.areas, prices, treatPrices);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toMatch(/unknown expression/i);
    expect(errors[1]).toMatch(/unknown expression/i);
    expect(errors[2]).toMatch(/unknown pose/i);
    expect(errors[3]).toMatch(/unknown pose/i);

    // E11 knots emit rich valid # expr: and # pose: direction tags.
    const richInk = setInkVariables(baseState.ink, {
      ate_breakfast: true,
      sue_joined: true,
      bluebird_calmed: true,
      jordan_joined: true,
      has_lantern: true,
      has_lasso: true,
      has_flute: true,
      clubhouse_claimed: true,
      spice_returned: true,
      visited_pass: true,
      milo_revealed: true,
    });
    const exprTags = new Set<string>();
    const poseTags = new Set<string>();
    const allE11Tags: string[] = [];
    for (const knot of E11_ALL_KNOTS) {
      for (const line of collectKnotBranches(story, richInk, knot)) {
        for (const tag of line.tags) {
          allE11Tags.push(tag);
          if (tag.startsWith("expr:")) exprTags.add(tag.slice("expr:".length).trim());
          if (tag.startsWith("pose:")) poseTags.add(tag.slice("pose:".length).trim());
        }
      }
    }
    expect(storyTagErrors(allE11Tags, world.areas, prices, treatPrices)).toEqual([]);
    expect(exprTags.size).toBeGreaterThanOrEqual(4);
    expect(poseTags.size).toBeGreaterThanOrEqual(5);
    expect(poseTags.has("tool_lantern")).toBe(true);
    expect(poseTags.has("tool_lasso")).toBe(true);
    expect(poseTags.has("tool_flute")).toBe(true);
  });

  it("enforces zero Milo secrecy leaks across all pre-reveal E11 knots and journal", () => {
    const preRevealFacts: InkFacts = {
      calmed: {
        "fountain-frog": true,
        bluebird: true,
        hamster: true,
        bat: true,
        owl: true,
        principal: true,
        "hooded-kid": true,
      },
      coins: 50,
      snacks: 3,
      prizes: [],
      plushesLeft: 0,
      tickets: 0,
      party: ["maddie", "sue", "jordan"],
      lantern: true,
      areaCalm: true,
      level: 5,
      stickers: 10,
      treats: 3,
      bossesCalmed: 5,
    };

    const preRevealInProgress = setInkVariables(baseState.ink, {
      milo_revealed: false,
      ate_breakfast: true,
      sue_joined: true,
      bluebird_calmed: true,
      jordan_joined: true,
      clubhouse_claimed: true,
      has_lantern: true,
      has_lasso: true,
      has_flute: true,
      spice_quest: true,
      spice_found: true,
      spice_returned: true,
      visited_pass: true,
      star_chart_quest: true,
      kite_chain_quest: true,
      lullaby_quest: true,
      valley_spice_quest: true,
    });

    expect(
      miloSecrecyErrors(
        story,
        preRevealInProgress,
        [...E11_PRE_REVEAL_H2H_KNOTS, ...E11_QUEST_KNOTS, "journal"],
        preRevealFacts,
      ),
    ).toEqual([]);

    // Also check all-complete pre-reveal state (Sanctuary Encore stays gated on milo_revealed).
    const preRevealCompleted = setInkVariables(preRevealInProgress, {
      h2h_fae_maddie_done: true,
      h2h_fae_sue_done: true,
      h2h_fae_jordan_done: true,
      h2h_sue_jordan_done: true,
      h2h_clubhouse_trio_done: true,
      h2h_sanctuary_encore_done: true,
      star_chart_plaza: true,
      star_chart_bay: true,
      star_chart_pass: true,
      kite_tail_park: true,
      kite_tail_lane: true,
      kite_tail_crossing: true,
      kite_tail_boardwalk: true,
      lullaby_note_plaza: true,
      lullaby_note_park: true,
      lullaby_note_woods: true,
      valley_spice_salt: true,
      valley_spice_pine: true,
      valley_spice_mint: true,
    });

    expect(
      miloSecrecyErrors(
        story,
        preRevealCompleted,
        [...E11_PRE_REVEAL_H2H_KNOTS, ...E11_QUEST_KNOTS, "journal"],
        preRevealFacts,
      ),
    ).toEqual([]);
  });

  it("resolves valid portraits for every non-sign speaker across all E11 knots", () => {
    const signSpeakers = new Set([
      "sign",
      "notice board",
      "chalkboard",
      "sanctuary board",
      "flyer",
      "glow note",
      "trail note",
    ]);
    const richInk = setInkVariables(baseState.ink, {
      ate_breakfast: true,
      sue_joined: true,
      bluebird_calmed: true,
      jordan_joined: true,
      clubhouse_claimed: true,
      has_lantern: true,
      has_lasso: true,
      has_flute: true,
      spice_quest: true,
      spice_found: true,
      spice_returned: true,
      visited_pass: true,
      milo_revealed: true,
    });
    const fullPartyFacts: InkFacts = {
      calmed: {},
      coins: 50,
      snacks: 2,
      prizes: [],
      plushesLeft: 0,
      tickets: 0,
      party: ["maddie", "sue", "jordan"],
    };

    const speakers = new Set<string>();
    for (const knot of E11_ALL_KNOTS) {
      for (const line of collectKnotBranches(story, richInk, knot, fullPartyFacts)) {
        if (line.speaker !== null) speakers.add(line.speaker);
      }
    }
    expect(speakers.size).toBeGreaterThanOrEqual(8);
    for (const speaker of speakers) {
      if (signSpeakers.has(speaker.trim().toLowerCase())) continue;
      const portrait = speakerPortraitSource(world, speaker);
      expect(portrait, `expected portrait for speaker "${speaker}"`).not.toBeNull();
    }
  });

  it("verifies area connectivity and walkable reachability for every E11 spot and glow", () => {
    expect(
      areaConnectionErrors(world.areas, world.tunables, world.critters, world.party),
    ).toEqual([]);

    const unlocked = withVars(baseState, {
      ate_breakfast: true,
      sue_joined: true,
      bluebird_calmed: true,
      jordan_joined: true,
      has_lantern: true,
      clubhouse_claimed: true,
      milo_revealed: true,
    });

    for (const spec of HEART_TO_HEARTS) {
      const primary = placeFacingTarget(world, unlocked, spec.area, spec.point, `heart:${spec.id}`);
      expect(targetInteractable(world, primary)?.id).toBe(`heart:${spec.id}`);
      if (spec.altSpot !== undefined) {
        const alt = placeFacingTarget(
          world,
          unlocked,
          spec.altSpot.area,
          spec.altSpot.point,
          `heart:${spec.id}`,
        );
        expect(targetInteractable(world, alt)?.id).toBe(`heart:${spec.id}`);
      }
    }

    const e11Interactables = [
      { area: "park", id: "kite-ribbon-park" },
      { area: "lane", id: "kite-ribbon-lane" },
      { area: "crossing", id: "kite-ribbon-crossing" },
      { area: "boardwalk", id: "kite-ribbon-boardwalk" },
      { area: "plaza", id: "lullaby-plaza" },
      { area: "park", id: "lullaby-park" },
      { area: "woods", id: "lullaby-woods" },
      { area: "bay", id: "spice-sea-salt" },
      { area: "pass", id: "spice-pine-sugar" },
      { area: "woods", id: "spice-woodland-mint" },
    ] as const;

    for (const entry of e11Interactables) {
      const item = world.areas[entry.area]?.interactables.find((i) => i.id === entry.id);
      expect(item, `${entry.area}.${entry.id} exists`).toBeDefined();
      if (item === undefined) continue;
      const placed = placeFacingTarget(world, unlocked, entry.area, item.point, entry.id);
      expect(targetInteractable(world, placed)?.id).toBe(entry.id);
    }

    const e11Glows = [
      { area: "plaza", id: "star-chart-plaza" },
      { area: "bay", id: "star-chart-bay" },
      { area: "pass", id: "star-chart-pass" },
    ] as const;

    for (const entry of e11Glows) {
      const glow = world.areas[entry.area]?.glows.find((g) => g.id === entry.id);
      expect(glow, `${entry.area}.${entry.id} glow exists`).toBeDefined();
      if (glow === undefined) continue;
      const placed = placeFacingTarget(
        world,
        { ...unlocked, lantern: true },
        entry.area,
        glow.point,
        `glow:${entry.id}`,
      );
      expect(targetInteractable(world, placed)?.id).toBe(`glow:${entry.id}`);
    }
  });
});
