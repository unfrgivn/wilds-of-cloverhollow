import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  MILO_FORESHADOW_BEATS,
  MINIBOSS_VIGNETTES,
  miloArcIntegrityErrors,
  miloSecrecyErrors,
  storyTagErrors,
  storyTags,
} from "../../src/content/story-checks";
import {
  blankInput,
  createState,
  findTriggeredCutscene,
  journalNotes,
  pointInPolygon,
  sceneryArea,
  setInkVariables,
  stableHash,
  startCutscene,
  startDialogue,
  step,
  type ActionFrame,
  type State,
} from "../../src/core";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";
import { parseExpressionTag, speakerPortraitSource } from "../../src/ui/portraits";
import { parseRichText } from "../../src/ui/rich-text";
import { compileStorySource } from "../../tools/ink/compile";

const content = loadContent();
const { world } = content;
const freshInk = createInkState(world.story, 1);

const DEFAULT_FACTS: InkFacts = {
  calmed: {},
  coins: 0,
  snacks: 2,
  prizes: [],
  plushesLeft: 0,
  tickets: 0,
};

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

function requireFixture(name: string) {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`Missing fixture: ${name}`);
  return fixture;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function playKnot(knot: string, options: KnotOptions = {}): KnotRun {
  const baseInk = options.ink ?? createInkState(world.story, 1);
  const startInk = options.vars === undefined ? baseInk : setInkVariables(baseInk, options.vars);
  const facts: InkFacts = { ...DEFAULT_FACTS, ...options.facts };
  let result = runInk(world.story, startInk, { type: "start", knot }, facts);
  const lines: TranscriptLine[] = [];
  const planned = options.choices ?? [];
  let choiceCursor = 0;

  for (let guard = 0; guard < 80; guard += 1) {
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
  throw new Error(`Knot ${knot} did not finish within 80 steps`);
}

function joinedText(run: KnotRun): string {
  return run.lines.map((line) => line.text).join(" ");
}

function confirmFrame(): ActionFrame {
  return { ...blankInput(), confirm: true };
}

type SyntheticOverrides = {
  schoolLine?: string;
  plazaLine?: string;
  bayLine?: string;
  passBody?: string;
  loftLine?: string;
  journalSchool?: string;
  rowanLine?: string;
  pipBody?: string;
};

function buildSyntheticMiloInk(overrides: SyntheticOverrides = {}): string {
  const schoolLine = overrides.schoolLine ?? "Milo sketches a tiny crayon rocket by the wall.";
  const plazaLine = overrides.plazaLine ?? "Milo rolls an apple slice to a shy raccoon.";
  const bayLine = overrides.bayLine ?? "A tiny hand-drawn rocket shimmers inside the fold.";
  const passBody =
    overrides.passBody ??
    ["~ milo_beat_pass = true", "A familiar four-note hum drifts past the snowy pines."].join(
      "\n",
    );
  const loftLine = overrides.loftLine ?? "A torn sketchbook corner shows a lone caped hero.";
  const journalSchool =
    overrides.journalSchool ??
    "{milo_beat_school: Quiet Clue: A classmate sketched crayon rockets by the art wall.}";
  const rowanLine =
    overrides.rowanLine ?? "Parent Art Show is tomorrow and my markers vanished!";
  const pipBody =
    overrides.pipBody ??
    ["~ vignette_pip_seen = true", "Token jam on lane two again!"].join("\n");

  return [
    "VAR milo_revealed = false",
    "VAR milo_beat_school = false",
    "VAR milo_beat_plaza = false",
    "VAR milo_beat_bay = false",
    "VAR milo_beat_pass = false",
    "VAR milo_beat_loft = false",
    "VAR vignette_flurry_seen = false",
    "VAR vignette_rowan_seen = false",
    "VAR vignette_bell_seen = false",
    "VAR vignette_coral_seen = false",
    "VAR vignette_pip_seen = false",
    "VAR vignette_mateo_seen = false",
    "",
    "=== milo_foreshadow_school ===",
    "~ milo_beat_school = true",
    schoolLine,
    "-> DONE",
    "",
    "=== milo_foreshadow_plaza ===",
    "~ milo_beat_plaza = true",
    plazaLine,
    "-> DONE",
    "",
    "=== milo_foreshadow_bay ===",
    "~ milo_beat_bay = true",
    bayLine,
    "-> DONE",
    "",
    "=== milo_foreshadow_pass ===",
    passBody,
    "-> DONE",
    "",
    "=== milo_foreshadow_loft ===",
    "~ milo_beat_loft = true",
    loftLine,
    "-> DONE",
    "",
    "=== journal ===",
    "{milo_beat_loft: Quiet Clue: Found a torn comic hero sketch beneath rocket comics.}",
    "{milo_beat_pass: Quiet Clue: A shy four-note hum drifted past the snowy pines.}",
    "{milo_beat_bay: Quiet Clue: A crumpled wrapper held a glowing rocket doodle.}",
    "{milo_beat_plaza: Quiet Clue: A classmate shielded a trembling stray raccoon.}",
    journalSchool,
    "-> DONE",
    "",
    "=== vignette_mrs_flurry ===",
    "~ vignette_flurry_seen = true",
    "Biscuit slipped out before dawn and three kettles are whistling!",
    "-> DONE",
    "",
    "=== vignette_ms_rowan ===",
    "~ vignette_rowan_seen = true",
    rowanLine,
    "-> DONE",
    "",
    "=== vignette_mr_bell ===",
    "~ vignette_bell_seen = true",
    "The intercom is stuck and three kids lost left mittens!",
    "-> DONE",
    "",
    "=== vignette_ms_coral ===",
    "~ vignette_coral_seen = true",
    "Three runaway beach balls and gulls eyeballing the watermelon!",
    "-> DONE",
    "",
    "=== vignette_mr_pip ===",
    pipBody,
    "-> DONE",
    "",
    "=== vignette_chef_mateo ===",
    "~ vignette_mateo_seen = true",
    "One gust of hillside wind carried off forty hand-painted flyers!",
    "-> DONE",
  ].join("\n");
}

function compileSynthetic(overrides: SyntheticOverrides = {}) {
  const { story } = compileStorySource(buildSyntheticMiloInk(overrides));
  const ink = createInkState(story, 1);
  return { story, ink };
}

function assertActorsInWalkableBounds(state: State, context: string): void {
  const rawArea = world.areas[state.area];
  if (rawArea === undefined) throw new Error(`Unknown area: ${state.area}`);
  const area = sceneryArea(world, state.ink, rawArea);
  expect(
    pointInPolygon(state.player, area.walkable),
    `${context}: fae outside walkable at (${state.player.x}, ${state.player.y})`,
  ).toBe(true);
  for (const blocker of area.blockers) {
    expect(
      pointInPolygon(state.player, blocker),
      `${context}: fae inside blocker at (${state.player.x}, ${state.player.y})`,
    ).toBe(false);
  }
  for (const member of state.party) {
    expect(
      pointInPolygon(member, area.walkable),
      `${context}: ${member.id} outside walkable at (${member.x}, ${member.y})`,
    ).toBe(true);
    for (const blocker of area.blockers) {
      expect(
        pointInPolygon(member, blocker),
        `${context}: ${member.id} inside blocker at (${member.x}, ${member.y})`,
      ).toBe(false);
    }
  }
}

type CutsceneRunReport = {
  finalState: State;
  observedFlags: Record<string, boolean>;
};

function runCutsceneToCompletion(
  fixtureName: string,
  cutsceneId: string,
  initialVars: Record<string, boolean | number> = {},
): CutsceneRunReport {
  const base = createState(world, requireFixture(fixtureName), 1);
  const seeded: State =
    Object.keys(initialVars).length === 0
      ? base
      : { ...base, ink: setInkVariables(base.ink, initialVars) };
  let state = startCutscene(world, seeded, cutsceneId);
  expect(state.cutscene?.id).toBe(cutsceneId);

  const observedFlags: Record<string, boolean> = {};
  for (let tick = 0; tick < 1200 && state.cutscene !== undefined; tick += 1) {
    assertActorsInWalkableBounds(state, `${cutsceneId} tick ${tick}`);
    for (const [flag, value] of Object.entries(state.cutscene.flags)) {
      observedFlags[flag] = value;
    }
    if (state.dialogue !== null) {
      state = step(world, state, confirmFrame()).state;
      if (state.cutscene !== undefined) {
        for (const [flag, value] of Object.entries(state.cutscene.flags)) {
          observedFlags[flag] = value;
        }
      }
      state = step(world, state, blankInput()).state;
    } else {
      state = step(world, state, blankInput()).state;
    }
  }
  expect(state.cutscene, `${cutsceneId} should finish cleanly`).toBeUndefined();
  assertActorsInWalkableBounds(state, `${cutsceneId} final`);
  return { finalState: state, observedFlags };
}

describe("E10 miloArcIntegrityErrors verification & synthetic leak guards", () => {
  it("reports zero integrity errors on the compiled Cloverhollow story", () => {
    expect(miloArcIntegrityErrors(world.story, freshInk, DEFAULT_FACTS)).toEqual([]);
  });

  it("reports zero errors on a clean synthetic baseline story", () => {
    const clean = compileSynthetic();
    expect(miloArcIntegrityErrors(clean.story, clean.ink)).toEqual([]);
  });

  it("catches culprit-spoiler leaks in classmate foreshadowing beats", () => {
    const hoodLeak = compileSynthetic({
      schoolLine: "Milo hid a purple hood in his backpack.",
    });
    const hoodErrors = miloArcIntegrityErrors(hoodLeak.story, hoodLeak.ink);
    expect(hoodErrors.some((msg) => msg.includes("classmate beat leaked culprit spoiler"))).toBe(
      true,
    );

    const sodaLeak = compileSynthetic({
      plazaLine: "Milo stashed a bottle of fizzy soda behind the crates.",
    });
    const sodaErrors = miloArcIntegrityErrors(sodaLeak.story, sodaLeak.ink);
    expect(sodaErrors.some((msg) => msg.includes("classmate beat leaked culprit spoiler"))).toBe(
      true,
    );
  });

  it("catches a Milo name leak in clue beat milo_foreshadow_bay", () => {
    const bayLeak = compileSynthetic({
      bayLine: "Inside the fold is a tiny rocket signed by Milo!",
    });
    const errors = miloArcIntegrityErrors(bayLeak.story, bayLeak.ink);
    expect(errors.some((msg) => msg.includes("milo_foreshadow_bay") && msg.includes("Milo"))).toBe(
      true,
    );
  });

  it("catches a Milo name leak in a Quiet Clue journal entry", () => {
    const journalLeak = compileSynthetic({
      journalSchool:
        "{milo_beat_school: Quiet Clue: Milo was sketching crayon rockets by the art wall.}",
    });
    const errors = miloArcIntegrityErrors(journalLeak.story, journalLeak.ink);
    expect(errors.some((msg) => msg.includes("journal") && msg.includes("Milo"))).toBe(true);
  });

  it("catches a Milo name leak in a mini-boss stress vignette", () => {
    const vignetteLeak = compileSynthetic({
      rowanLine: "Milo took all thirty-two of my purple markers!",
    });
    const errors = miloArcIntegrityErrors(vignetteLeak.story, vignetteLeak.ink);
    expect(
      errors.some((msg) => msg.includes("vignette_ms_rowan") && msg.includes("Milo")),
    ).toBe(true);
  });

  it("catches missing variable flips in both foreshadowing beats and vignettes", () => {
    const missingBeatFlip = compileSynthetic({
      passBody: "A familiar four-note hum drifts past the snowy pines.",
    });
    const beatErrors = miloArcIntegrityErrors(missingBeatFlip.story, missingBeatFlip.ink);
    expect(beatErrors.some((msg) => msg.includes("did not set milo_beat_pass = true"))).toBe(true);

    const missingVignetteFlip = compileSynthetic({
      pipBody: "Token jam on lane two again!",
    });
    const vignetteErrors = miloArcIntegrityErrors(
      missingVignetteFlip.story,
      missingVignetteFlip.ink,
    );
    expect(
      vignetteErrors.some((msg) => msg.includes("did not set vignette_pip_seen = true")),
    ).toBe(true);
  });
});

describe("E10 story tags, kinetic rich-text markup, and phone readability", () => {
  const counterPrices = Object.fromEntries(
    world.arcade.counter.prizes.map((item) => [item.prize, item.price]),
  );
  const treatPrices = Object.fromEntries(world.treats.map((item) => [item.id, item.price]));
  const basketPrices = Object.fromEntries(
    world.treatBaskets.map((item) => [item.id, item.price]),
  );

  it("passes storyTagErrors with zero errors across the full compiled story", () => {
    const errors = storyTagErrors(
      storyTags(world.story),
      world.areas,
      counterPrices,
      treatPrices,
      basketPrices,
    );
    expect(errors).toEqual([]);
  });

  it("validates #expr, #pose, #sound tags and E3 kinetic markup on all 11 new knots", () => {
    const knotRuns: readonly { label: string; run: KnotRun }[] = [
      {
        label: "milo_foreshadow_school[0]",
        run: playKnot("milo_foreshadow_school", { choices: [0] }),
      },
      {
        label: "milo_foreshadow_school[1]",
        run: playKnot("milo_foreshadow_school", { choices: [1] }),
      },
      {
        label: "milo_foreshadow_plaza[0]",
        run: playKnot("milo_foreshadow_plaza", { choices: [0] }),
      },
      {
        label: "milo_foreshadow_plaza[1]",
        run: playKnot("milo_foreshadow_plaza", { choices: [1] }),
      },
      {
        label: "milo_foreshadow_bay.lantern",
        run: playKnot("milo_foreshadow_bay", { vars: { has_lantern: true, sue_joined: true } }),
      },
      {
        label: "milo_foreshadow_bay.sun",
        run: playKnot("milo_foreshadow_bay", { vars: { has_lantern: false, sue_joined: false } }),
      },
      {
        label: "milo_foreshadow_pass.jordan",
        run: playKnot("milo_foreshadow_pass", { vars: { jordan_joined: true } }),
      },
      { label: "milo_foreshadow_loft", run: playKnot("milo_foreshadow_loft") },
      ...MINIBOSS_VIGNETTES.map((v) => ({
        label: v.knot,
        run: playKnot(v.knot, { vars: { sue_joined: true, jordan_joined: true } }),
      })),
    ];

    for (const { label, run } of knotRuns) {
      expect(run.ended, `${label} should complete`).toBe(true);
      let kineticLineCount = 0;
      let exprTagCount = 0;

      for (const line of run.lines) {
        const tagErrors = storyTagErrors(
          line.tags,
          world.areas,
          counterPrices,
          treatPrices,
          basketPrices,
        );
        expect(tagErrors, `${label}: invalid tag in ${line.tags.join(", ")}`).toEqual([]);

        if (line.tags.some((t) => t.trim().startsWith("expr:"))) {
          expect(parseExpressionTag(line.tags), `${label}: invalid expr tag`).not.toBeNull();
          exprTagCount += 1;
        }

        const parsed = parseRichText(line.text);
        expect(parsed.plain.length, `${label}: empty plain line`).toBeGreaterThan(0);
        expect(
          parsed.plain.includes("{") || parsed.plain.includes("}"),
          `${label}: unparsed brace left in "${parsed.plain}"`,
        ).toBe(false);
        expect(
          parsed.plain.length,
          `${label}: line too long (${parsed.plain.length}): "${parsed.plain}"`,
        ).toBeLessThanOrEqual(165);

        if (line.text.includes("{")) {
          expect(parsed.hasMarkup, `${label}: kinetic line missing valid markup`).toBe(true);
          kineticLineCount += 1;
        }
      }

      expect(exprTagCount, `${label} should use #expr tags`).toBeGreaterThan(0);
      expect(kineticLineCount, `${label} should use E3 kinetic markup`).toBeGreaterThan(0);
    }
  });
});

describe("E10 5 Milo foreshadowing knots across every choice, variant, and journal clue", () => {
  const newGameState = createState(world, requireFixture("new-game"), 1);

  it("milo_foreshadow_school flips milo_beat_school on both choices and logs Quiet Clue", () => {
    const prompt = playKnot("milo_foreshadow_school");
    expect(prompt.choices).toHaveLength(2);

    const branch0 = playKnot("milo_foreshadow_school", { choices: [0] });
    const branch1 = playKnot("milo_foreshadow_school", { choices: [1] });

    expect(branch0.ended).toBe(true);
    expect(branch1.ended).toBe(true);
    expect(world.storyVariable(branch0.ink, "milo_beat_school")).toBe(true);
    expect(world.storyVariable(branch1.ink, "milo_beat_school")).toBe(true);
    expect(joinedText(branch0)).toContain("{pause:6}");
    expect(joinedText(branch0)).toContain("{whisper}");
    expect(joinedText(branch1)).toContain("rocket countdown");

    const notes = journalNotes(world, { ...newGameState, ink: branch0.ink });
    const clue = notes.find(
      (line) => line.startsWith("Quiet Clue:") && line.includes("crayon rockets"),
    );
    expect(clue).toBeDefined();
    for (const note of notes) expect(note).not.toMatch(/\bMilo\b/i);
  });

  it("milo_foreshadow_plaza flips milo_beat_plaza across both choices and logs Quiet Clue", () => {
    const prompt = playKnot("milo_foreshadow_plaza");
    expect(prompt.choices).toHaveLength(2);

    const branch0 = playKnot("milo_foreshadow_plaza", { choices: [0] });
    const branch1 = playKnot("milo_foreshadow_plaza", { choices: [1] });

    expect(branch0.ended).toBe(true);
    expect(branch1.ended).toBe(true);
    expect(world.storyVariable(branch0.ink, "milo_beat_plaza")).toBe(true);
    expect(world.storyVariable(branch1.ink, "milo_beat_plaza")).toBe(true);
    expect(joinedText(branch0)).toContain("quiet corner");
    expect(joinedText(branch1)).toContain("giant volume knob");

    const notes = journalNotes(world, { ...newGameState, ink: branch1.ink });
    const clue = notes.find(
      (line) => line.startsWith("Quiet Clue:") && line.includes("stray raccoon"),
    );
    expect(clue).toBeDefined();
    for (const note of notes) expect(note).not.toMatch(/\bMilo\b/i);
  });

  it("milo_foreshadow_bay handles lantern and Sue variants and never names Milo", () => {
    const variants = [
      { has_lantern: false, sue_joined: false },
      { has_lantern: true, sue_joined: false },
      { has_lantern: false, sue_joined: true },
      { has_lantern: true, sue_joined: true },
    ];

    for (const vars of variants) {
      const run = playKnot("milo_foreshadow_bay", { vars });
      expect(run.ended).toBe(true);
      expect(world.storyVariable(run.ink, "milo_beat_bay")).toBe(true);
      expect(joinedText(run)).not.toMatch(/\bMilo\b/i);
      if (vars.has_lantern) {
        expect(joinedText(run)).toContain("blacklight lantern's soft violet glow");
      } else {
        expect(joinedText(run)).toContain("bright coastal sunlight");
      }
      expect(run.lines.some((line) => line.speaker === "Sue")).toBe(vars.sue_joined);

      const notes = journalNotes(world, { ...newGameState, ink: run.ink });
      const clue = notes.find(
        (line) => line.startsWith("Quiet Clue:") && line.includes("purple-fizz wrapper"),
      );
      expect(clue).toBeDefined();
      for (const note of notes) expect(note).not.toMatch(/\bMilo\b/i);
    }
  });

  it("milo_foreshadow_pass handles Jordan variants, logs Quiet Clue, never names Milo", () => {
    const solo = playKnot("milo_foreshadow_pass", { vars: { jordan_joined: false } });
    const withJordan = playKnot("milo_foreshadow_pass", { vars: { jordan_joined: true } });

    expect(solo.ended).toBe(true);
    expect(withJordan.ended).toBe(true);
    expect(world.storyVariable(solo.ink, "milo_beat_pass")).toBe(true);
    expect(world.storyVariable(withJordan.ink, "milo_beat_pass")).toBe(true);
    expect(solo.lines.some((line) => line.speaker === "Jordan")).toBe(false);
    expect(withJordan.lines.some((line) => line.speaker === "Jordan")).toBe(true);
    expect(joinedText(solo)).not.toMatch(/\bMilo\b/i);
    expect(joinedText(withJordan)).not.toMatch(/\bMilo\b/i);

    const notes = journalNotes(world, { ...newGameState, ink: withJordan.ink });
    const clue = notes.find(
      (line) => line.startsWith("Quiet Clue:") && line.includes("four-note hum"),
    );
    expect(clue).toBeDefined();
    for (const note of notes) expect(note).not.toMatch(/\bMilo\b/i);
  });

  it("milo_foreshadow_loft flips milo_beat_loft, logs Quiet Clue, and stays spoiler-free", () => {
    const run = playKnot("milo_foreshadow_loft");
    expect(run.ended).toBe(true);
    expect(world.storyVariable(run.ink, "milo_beat_loft")).toBe(true);
    expect(joinedText(run)).toContain("purple cape");
    expect(joinedText(run)).not.toMatch(/\bMilo\b/i);

    const allInk = setInkVariables(freshInk, {
      milo_beat_school: true,
      milo_beat_plaza: true,
      milo_beat_bay: true,
      milo_beat_pass: true,
      milo_beat_loft: true,
      milo_revealed: false,
    });
    const notes = journalNotes(world, { ...newGameState, ink: allInk });
    const quietClues = notes.filter((line) => line.startsWith("Quiet Clue:"));
    expect(quietClues).toHaveLength(MILO_FORESHADOW_BEATS.length);
    for (const note of quietClues) expect(note).not.toMatch(/\bMilo\b/i);
  });
});

describe("E10 6 empathetic mini-boss pre-battle stress vignettes", () => {
  const VIGNETTE_EXPECTATIONS: readonly {
    knot: string;
    variable: string;
    bossSpeaker: string;
    companionSpeaker: "Sue" | "Jordan";
    stressHint: RegExp;
    empathyHint: RegExp;
  }[] = [
    {
      knot: "vignette_mrs_flurry",
      variable: "vignette_flurry_seen",
      bossSpeaker: "Mrs. Flurry",
      companionSpeaker: "Jordan",
      stressHint: /three kettles are whistling/i,
      empathyHint: /juggling the whole lodge alone/i,
    },
    {
      knot: "vignette_ms_rowan",
      variable: "vignette_rowan_seen",
      bossSpeaker: "Ms. Rowan",
      companionSpeaker: "Sue",
      stressHint: /Parent Art Show is TOMORROW/i,
      empathyHint: /stretched way too thin/i,
    },
    {
      knot: "vignette_mr_bell",
      variable: "vignette_bell_seen",
      bossSpeaker: "Mr. Bell",
      companionSpeaker: "Jordan",
      stressHint: /intercom is stuck/i,
      empathyHint: /cares so much about keeping the whole school/i,
    },
    {
      knot: "vignette_ms_coral",
      variable: "vignette_coral_seen",
      bossSpeaker: "Ms. Coral",
      companionSpeaker: "Sue",
      stressHint: /haven't had one quiet breath/i,
      empathyHint: /works nonstop keeping the whole beach safe/i,
    },
    {
      knot: "vignette_mr_pip",
      variable: "vignette_pip_seen",
      bossSpeaker: "Mr. Pip",
      companionSpeaker: "Sue",
      stressHint: /Token jam on Skee-Ball/i,
      empathyHint: /juggling ten broken machines/i,
    },
    {
      knot: "vignette_chef_mateo",
      variable: "vignette_mateo_seen",
      bossSpeaker: "Chef Mateo",
      companionSpeaker: "Jordan",
      stressHint: /hand-painting forty sunny flyers/i,
      empathyHint: /worked his heart out/i,
    },
  ];

  it("flips every vignette_*_seen across solo and party runs with empathy and zero leaks", () => {
    expect(VIGNETTE_EXPECTATIONS).toHaveLength(MINIBOSS_VIGNETTES.length);

    for (const spec of VIGNETTE_EXPECTATIONS) {
      const solo = playKnot(spec.knot, { vars: { sue_joined: false, jordan_joined: false } });
      const party = playKnot(spec.knot, { vars: { sue_joined: true, jordan_joined: true } });

      expect(solo.ended, `${spec.knot} solo should end`).toBe(true);
      expect(party.ended, `${spec.knot} party should end`).toBe(true);
      expect(world.storyVariable(solo.ink, spec.variable)).toBe(true);
      expect(world.storyVariable(party.ink, spec.variable)).toBe(true);

      const soloText = joinedText(solo);
      const partyText = joinedText(party);
      expect(soloText).toMatch(spec.stressHint);
      expect(soloText).toMatch(spec.empathyHint);
      expect(soloText).not.toMatch(/\bMilo\b/i);
      expect(partyText).not.toMatch(/\bMilo\b/i);

      expect(solo.lines.some((line) => line.speaker === spec.bossSpeaker)).toBe(true);
      expect(solo.lines.some((line) => line.speaker === spec.companionSpeaker)).toBe(false);
      expect(party.lines.some((line) => line.speaker === spec.companionSpeaker)).toBe(true);
    }

    const partyInk = setInkVariables(freshInk, { sue_joined: true, jordan_joined: true });
    const vignetteKnots = MINIBOSS_VIGNETTES.map((v) => v.knot);
    expect(miloSecrecyErrors(world.story, freshInk, vignetteKnots, DEFAULT_FACTS)).toEqual([]);
    expect(miloSecrecyErrors(world.story, partyInk, vignetteKnots, DEFAULT_FACTS)).toEqual([]);
  });
});

describe("E10 Acts 1-3 polished knots preservation & secrecy", () => {
  const POLISHED_KNOTS: readonly string[] = [
    "sue",
    "jordan",
    "hamster_calm",
    "frog_calm",
    "bluebird_calm",
    "gull_calm",
    "snowman",
    "school_board",
    "art_markers",
    "picnic",
    "shells",
    "bat_calm",
    "crystal_mole_calm",
  ];

  it("emits zero pre-reveal Milo leaks across all 13 polished Acts 1-3 knots", () => {
    expect(miloSecrecyErrors(world.story, freshInk, POLISHED_KNOTS, DEFAULT_FACTS)).toEqual([]);
  });

  it("preserves Sue and Jordan recruitment choices and variable flips", () => {
    const suePrompt = playKnot("sue");
    expect(suePrompt.choices).toHaveLength(2);
    for (const choice of [0, 1]) {
      const joined = playKnot("sue", { choices: [choice] });
      expect(joined.ended).toBe(true);
      expect(world.storyVariable(joined.ink, "sue_joined")).toBe(true);
      expect(
        joined.lines.some((line) => line.tags.some((t) => t.trim() === "pose: sue cheer")),
      ).toBe(true);
    }

    const jordanPrompt = playKnot("jordan");
    expect(jordanPrompt.choices).toHaveLength(2);
    for (const choice of [0, 1]) {
      const joined = playKnot("jordan", { choices: [choice] });
      expect(joined.ended).toBe(true);
      expect(world.storyVariable(joined.ink, "jordan_joined")).toBe(true);
      expect(
        joined.lines.some((line) => line.tags.some((t) => t.trim() === "pose: jordan cheer")),
      ).toBe(true);
    }
  });

  it("preserves hamster_calm lantern grant and calm/prop polish across Acts 1-3", () => {
    const hamsterFirst = playKnot("hamster_calm");
    expect(hamsterFirst.ended).toBe(true);
    expect(world.storyVariable(hamsterFirst.ink, "has_lantern")).toBe(true);
    expect(joinedText(hamsterFirst)).toContain("{color:lavender}blacklight lantern{/color}");
    const hamsterReplay = playKnot("hamster_calm", { ink: hamsterFirst.ink });
    expect(joinedText(hamsterReplay)).toContain("friendly snowballs");

    const calmKnots = [
      "frog_calm",
      "bluebird_calm",
      "gull_calm",
      "bat_calm",
      "crystal_mole_calm",
    ];
    for (const calmKnot of calmKnots) {
      const first = playKnot(calmKnot);
      const again = playKnot(calmKnot, { ink: first.ink });
      expect(first.ended, `${calmKnot} first run`).toBe(true);
      expect(again.ended, `${calmKnot} replay`).toBe(true);
      expect(joinedText(again)).not.toBe(joinedText(first));
      expect(first.lines.some((line) => parseExpressionTag(line.tags) !== null)).toBe(true);
    }

    for (const propKnot of ["snowman", "school_board", "art_markers", "picnic", "shells"]) {
      const run = playKnot(propKnot);
      expect(run.ended, `${propKnot} should complete`).toBe(true);
      expect(run.lines.some((line) => parseExpressionTag(line.tags) !== null)).toBe(true);
      for (const line of run.lines) {
        const parsed = parseRichText(line.text);
        expect(parsed.plain.includes("{") || parsed.plain.includes("}")).toBe(false);
      }
    }
  });
});

describe("E10 11 new E4 cutscenes: triggers, bounds, flags, variables, and determinism", () => {
  type CutsceneSpec = {
    id: string;
    fixture: string;
    area: string;
    triggerKind: "after-knot" | "area-enter";
    triggerKnot?: string;
    requiresVariable?: string;
    forbidsVariable: string;
    cutsceneFlag: string;
    inkVariable: string;
  };

  const E10_CUTSCENES: readonly CutsceneSpec[] = [
    {
      id: "milo-school-sketch",
      fixture: "classroom",
      area: "classroom",
      triggerKind: "after-knot",
      triggerKnot: "art_wall",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "milo_school_sketch_seen",
      inkVariable: "milo_beat_school",
    },
    {
      id: "milo-plaza-raccoon",
      fixture: "plaza",
      area: "plaza",
      triggerKind: "after-knot",
      triggerKnot: "grocery",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "milo_plaza_raccoon_seen",
      inkVariable: "milo_beat_plaza",
    },
    {
      id: "milo-bay-wrapper",
      fixture: "bay",
      area: "bay",
      triggerKind: "after-knot",
      triggerKnot: "shells",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "milo_bay_wrapper_seen",
      inkVariable: "milo_beat_bay",
    },
    {
      id: "milo-pass-melody",
      fixture: "pass",
      area: "pass",
      triggerKind: "after-knot",
      triggerKnot: "snowman",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "milo_pass_melody_seen",
      inkVariable: "milo_beat_pass",
    },
    {
      id: "milo-loft-sketch",
      fixture: "milo-house",
      area: "milo-house",
      triggerKind: "after-knot",
      triggerKnot: "milo_comics",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "milo_loft_sketch_seen",
      inkVariable: "milo_beat_loft",
    },
    {
      id: "miniboss-mrs-flurry",
      fixture: "pass",
      area: "pass",
      triggerKind: "after-knot",
      triggerKnot: "lodge_door",
      requiresVariable: "keeper_back",
      forbidsVariable: "lodge_open",
      cutsceneFlag: "miniboss_mrs_flurry_seen",
      inkVariable: "vignette_flurry_seen",
    },
    {
      id: "miniboss-ms-rowan",
      fixture: "east-hall",
      area: "east-hall",
      triggerKind: "after-knot",
      triggerKnot: "art_room",
      requiresVariable: "art_teacher_out",
      forbidsVariable: "art_open",
      cutsceneFlag: "miniboss_ms_rowan_seen",
      inkVariable: "vignette_rowan_seen",
    },
    {
      id: "miniboss-mr-bell",
      fixture: "school",
      area: "school",
      triggerKind: "after-knot",
      triggerKnot: "megaphone",
      requiresVariable: "principal_out",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "miniboss_mr_bell_seen",
      inkVariable: "vignette_bell_seen",
    },
    {
      id: "miniboss-ms-coral",
      fixture: "bay",
      area: "bay",
      triggerKind: "after-knot",
      triggerKnot: "bay_picnic",
      requiresVariable: "lifeguard_back",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "miniboss_ms_coral_seen",
      inkVariable: "vignette_coral_seen",
    },
    {
      id: "miniboss-mr-pip",
      fixture: "arcade",
      area: "arcade",
      triggerKind: "area-enter",
      requiresVariable: "clubhouse_claimed",
      forbidsVariable: "story_time",
      cutsceneFlag: "miniboss_mr_pip_seen",
      inkVariable: "vignette_pip_seen",
    },
    {
      id: "miniboss-chef-mateo",
      fixture: "hills",
      area: "hills",
      triggerKind: "after-knot",
      triggerKnot: "taco_flyer",
      requiresVariable: "taco_chef_out",
      forbidsVariable: "milo_revealed",
      cutsceneFlag: "miniboss_chef_mateo_seen",
      inkVariable: "vignette_mateo_seen",
    },
  ];

  it("registers all 11 E10 cutscenes and honors trigger, requires, forbids, and once rules", () => {
    for (const spec of E10_CUTSCENES) {
      const script = world.cutscenes[spec.id];
      expect(script, `Cutscene ${spec.id} missing from world.cutscenes`).toBeDefined();
      expect(script?.area).toBe(spec.area);

      const base = createState(world, requireFixture(spec.fixture), 1);
      const enabledVars: Record<string, boolean> = { [spec.forbidsVariable]: false };
      if (spec.requiresVariable !== undefined) {
        enabledVars[spec.requiresVariable] = true;
      }
      const readyState: State = {
        ...base,
        tick: 1,
        ink: setInkVariables(base.ink, enabledVars),
      };

      let previous: State;
      let next: State;
      if (spec.triggerKind === "after-knot") {
        if (spec.triggerKnot === undefined) throw new Error(`Missing triggerKnot for ${spec.id}`);
        previous = startDialogue(world, readyState, spec.triggerKnot);
        expect(previous.dialogue?.knot, `${spec.id} trigger knot should open`).toBe(
          spec.triggerKnot,
        );
        next = { ...readyState, dialogue: null };
      } else {
        previous = { ...readyState, tick: 0 };
        next = { ...readyState, tick: 1 };
      }

      expect(findTriggeredCutscene(world, previous, next)?.id).toBe(spec.id);

      if (spec.requiresVariable !== undefined) {
        const missingReq: State = {
          ...next,
          ink: setInkVariables(next.ink, { [spec.requiresVariable]: false }),
        };
        expect(findTriggeredCutscene(world, previous, missingReq)?.id).not.toBe(spec.id);
      }

      const forbidden: State = {
        ...next,
        ink: setInkVariables(next.ink, { [spec.forbidsVariable]: true }),
      };
      expect(findTriggeredCutscene(world, previous, forbidden)?.id).not.toBe(spec.id);

      const alreadySeen: State = {
        ...next,
        cutscenesSeen: [...(next.cutscenesSeen ?? []), spec.id],
      };
      expect(findTriggeredCutscene(world, previous, alreadySeen)?.id).not.toBe(spec.id);
    }
  });

  it("runs all 11 cutscenes deterministically inside walkable bounds with flags + vars", () => {
    for (const spec of E10_CUTSCENES) {
      const initVars: Record<string, boolean> = {};
      if (spec.requiresVariable !== undefined) {
        initVars[spec.requiresVariable] = true;
      }
      const run1 = runCutsceneToCompletion(spec.fixture, spec.id, initVars);
      const run2 = runCutsceneToCompletion(spec.fixture, spec.id, initVars);

      expect(run1.finalState.cutscenesSeen).toContain(spec.id);
      expect(run1.observedFlags[spec.cutsceneFlag]).toBe(true);
      expect(world.storyVariable(run1.finalState.ink, spec.inkVariable)).toBe(true);
      expect(run1.finalState.tick).toBe(run2.finalState.tick);
      expect(stableHash(run1.finalState)).toBe(stableHash(run2.finalState));
    }
  });
});

describe("E10 speaker portraits across all 11 new knots", () => {
  it("resolves a valid painted portrait frame for every speaker in all 11 knots", () => {
    const knotList = [
      ...MILO_FORESHADOW_BEATS.map((beat) => beat.knot),
      ...MINIBOSS_VIGNETTES.map((vignette) => vignette.knot),
    ];
    const atlasCache = new Map<string, Set<string>>();

    const loadAtlasFrames = (atlasRelPath: string): Set<string> => {
      const cached = atlasCache.get(atlasRelPath);
      if (cached !== undefined) return cached;
      const diskPath = `public/${atlasRelPath}`;
      expect(existsSync(diskPath), `Portrait atlas missing on disk: ${diskPath}`).toBe(true);
      const parsed: unknown = JSON.parse(readFileSync(diskPath, "utf8"));
      if (!isRecord(parsed) || !isRecord(parsed.frames)) {
        throw new Error(`Invalid atlas JSON shape: ${diskPath}`);
      }
      const frames = new Set(Object.keys(parsed.frames));
      atlasCache.set(atlasRelPath, frames);
      return frames;
    };

    const checkedSpeakers = new Set<string>();
    for (const knot of knotList) {
      const runs = [
        playKnot(knot, {
          vars: { sue_joined: true, jordan_joined: true, has_lantern: true },
          choices: [0],
        }),
        playKnot(knot, {
          vars: { sue_joined: false, jordan_joined: false, has_lantern: false },
          choices: [1],
        }),
      ];
      for (const run of runs) {
        for (const line of run.lines) {
          if (line.speaker === null) continue;
          checkedSpeakers.add(line.speaker);
          const baseSource = speakerPortraitSource(world, line.speaker);
          expect(
            baseSource,
            `Missing portrait for speaker "${line.speaker}" in ${knot}`,
          ).not.toBeNull();
          if (baseSource !== null) {
            const frames = loadAtlasFrames(baseSource.atlas);
            expect(
              frames.has(baseSource.frame),
              `Frame "${baseSource.frame}" missing in ${baseSource.atlas} for "${line.speaker}"`,
            ).toBe(true);
          }
          const expr = parseExpressionTag(line.tags);
          if (expr !== null) {
            const exprSource = speakerPortraitSource(world, line.speaker, expr);
            expect(
              exprSource,
              `Missing portrait for speaker "${line.speaker}" expr "${expr}" in ${knot}`,
            ).not.toBeNull();
            if (exprSource !== null) {
              const frames = loadAtlasFrames(exprSource.atlas);
              expect(
                frames.has(exprSource.frame),
                `Frame "${exprSource.frame}" missing in ${exprSource.atlas} for "${line.speaker}"`,
              ).toBe(true);
            }
          }
        }
      }
    }

    expect(checkedSpeakers.has("Milo")).toBe(true);
    expect(checkedSpeakers.has("Fae")).toBe(true);
    expect(checkedSpeakers.has("Maddie")).toBe(true);
    expect(checkedSpeakers.has("Sue")).toBe(true);
    expect(checkedSpeakers.has("Jordan")).toBe(true);
    expect(checkedSpeakers.has("Mrs. Flurry")).toBe(true);
    expect(checkedSpeakers.has("Ms. Rowan")).toBe(true);
    expect(checkedSpeakers.has("Mr. Bell")).toBe(true);
    expect(checkedSpeakers.has("Ms. Coral")).toBe(true);
    expect(checkedSpeakers.has("Mr. Pip")).toBe(true);
    expect(checkedSpeakers.has("Chef Mateo")).toBe(true);
  });
});
