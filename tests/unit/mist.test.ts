import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hiddenPositions } from "../../src/content/area-checks";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import {
  blankInput, createState, journalNotes, mapLandName, soundCues, step,
  targetInteractable, type ActionFrame, type Point, type State,
} from "../../src/core";
import { createInkState, runInk, type InkFacts } from "../../src/core/ink";

const content = loadContent();
const { world } = content;
const facts: InkFacts = {
  calmed: {}, coins: 0, snacks: 0, prizes: [], plushesLeft: 0, tickets: 0,
};
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function replay(path: string, until?: string): State {
  const fixture = content.fixtures["pass-party"];
  if (fixture === undefined) throw new Error("pass-party fixture missing");
  let state = createState(world, fixture);
  for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path)) {
    for (let tick = 0; tick < segment.ticks; tick += 1) {
      const next = step(world, state, segment.frame).state;
      if (until !== undefined && next.dialogue?.knot === until) return state;
      state = next;
    }
  }
  return state;
}

function walk(state: State, move: Point, ticks: number): State {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1)
    next = step(world, next, press({ move })).state;
  return next;
}

function readDialogue(state: State, choices: number[] = []): State {
  let next = state;
  let choice = 0;
  for (let tick = 0; tick < 900 && next.dialogue !== null; tick += 1) {
    const dialogue = next.dialogue;
    const frame = dialogue.revealed < dialogue.text.length
      ? press({ confirm: tick % 2 === 1 })
      : dialogue.choices.length > 0
        ? press({ choose: choices[choice++] ?? 0 })
        : press({ confirm: tick % 2 === 1 });
    next = step(world, next, frame).state;
  }
  if (next.dialogue !== null) throw new Error("dialogue did not close");
  return next;
}

function at(area: string, spawn: string, state: State): State {
  const point = world.areas[area]?.spawns[spawn];
  if (point === undefined) throw new Error(`no ${area}.${spawn}`);
  return { ...state, area, player: point, transition: null, dialogue: null, facing: point.facing };
}

function atPoint(state: State, point: Point, facing: State["facing"]): State {
  return { ...state, player: point, transition: null, dialogue: null, facing,
    previousInput: blankInput() };
}

function toggleLantern(state: State): State {
  return step(world, state, press({ lantern: true })).state;
}

function play(knot: string, choices: number[] = []): { lines: string[]; tags: string[][] } {
  let ink = createInkState(world.story, 1);
  const lines: string[] = [];
  const tags: string[][] = [];
  let choice = 0;
  let command: { type: "start"; knot: string } | { type: "next" } |
    { type: "choose"; index: number } = { type: "start", knot };
  for (let count = 0; count < 40; count += 1) {
    const result = runInk(world.story, ink, command, facts);
    ink = result.ink;
    if (result.line !== null) {
      lines.push(result.line.text);
      tags.push(result.line.tags);
    }
    if (result.ended) break;
    if (result.choices.length > 0) {
      command = { type: "choose", index: choices[choice++] ?? 0 };
    } else {
      command = { type: "next" };
    }
  }
  return { lines, tags };
}

describe("Misty Path content", () => {
  it("keeps the crossing geometry clear of every prop", () => {
    const area = world.areas.mist;
    if (area === undefined) throw new Error("mist area missing");
    expect(hiddenPositions(area, world.tunables.playerRadius)).toEqual([]);
    expect(area.crossings?.map((crossing) => crossing.opens))
      .toEqual(["found_mist_way", "rope_bridge"]);
    expect(area.props.map((prop) => prop.id)).not.toContain("plateau-mushrooms");
  });

  it("keeps the mist knots gentle, tagged, and unnamed", () => {
    const closed = play("mist_closed");
    expect(closed.lines).toEqual([
      "A little dirt path winds off between the misty trees. Something purple is tucked " +
      "beside the old stump.",
    ]);
    const flowers = play("mist_flowers");
    expect(flowers.lines[1]).toContain("stepping stones");
    expect(play("mist_seal").lines[0]).toContain("bell flowers");
    for (const knot of ["mist_closed", "mist_flowers", "mist_band", "gully_bridge", "mist_seal"])
      expect(play(knot).lines.join(" ")).not.toMatch(/\b(kid|Milo)\b/i);
  });

  it("names the Enchanted Forest only after the way is found or reached", () => {
    const enchanted = world.lands.find((land) => land.id === "enchanted");
    if (enchanted === undefined) throw new Error("enchanted land missing");
    expect(mapLandName(enchanted, "cloverhollow", () => false)).toBe("???");
    expect(mapLandName(enchanted, "cloverhollow", () => true)).toBe("The Enchanted Forest");
    expect(mapLandName(enchanted, "enchanted", () => false)).toBe("The Enchanted Forest");
    const bay = world.lands.find((land) => land.id === "bay");
    if (bay === undefined) throw new Error("bay land missing");
    expect(mapLandName(bay, "cloverhollow", () => false)).toBe("Bubblegum Bay");
  });
});

describe("Misty Path rules through the core", () => {
  const fieldRun = "tests/sim/scripts/pass-party/field.json";
  const lassoRun = "tests/sim/scripts/pass-party/lasso.json";

  it("keeps the field door shut until the stash is found, and returns", () => {
    const beforeStash = atPoint(replay(fieldRun, "hood_stash"), { x: 1550, y: 950 }, "right");
    const shut = walk(beforeStash, { x: 1, y: 0 }, 80);
    expect({ area: shut.area, knot: shut.dialogue?.knot }).toEqual({
      area: "field", knot: "mist_closed",
    });

    const found = atPoint(replay(fieldRun), { x: 1550, y: 950 }, "right");
    const open = walk(found, { x: 1, y: 0 }, 80);
    expect(open.area).toBe("mist");
    let landed = open;
    for (let tick = 0; tick < 60 && landed.transition !== null; tick += 1)
      landed = step(world, landed, blankInput()).state;
    expect(landed.area).toBe("mist");
    expect(landed.player.x).toBeLessThan(400);

    const back = walk(at("mist", "field", landed), { x: -1, y: 0 }, 80);
    expect(back.area).toBe("field");
  }, 30_000);

  it("requires the lantern and stepping stones to cross the mist band", () => {
    let state = at("mist", "field", replay(lassoRun));
    state = walk(state, { x: 1, y: 0 }, 140);
    expect(state.player.x).toBeLessThan(380);

    state = atPoint(state, { x: 320, y: 570 }, "right");
    expect(targetInteractable(world, state)?.id).not.toBe("glow:mist-flower-4");
    state = toggleLantern(state);
    expect(targetInteractable(world, state)?.id).toBe("glow:mist-flower-4");
    state = readDialogue(step(world, state, press({ confirm: true })).state);
    for (let tick = 0; tick < 60 && state.transition !== null; tick += 1)
      state = step(world, state, blankInput()).state;
    expect({ area: state.area, spawn: state.player }).toMatchObject({
      area: "mist", spawn: { x: 630, y: 585 },
    });
    state = walk(state, { x: -1, y: 0 }, 120);
    expect(state.player.x).toBeLessThan(380);
  }, 30_000);

  it("pulls the gully bridge across and walks both sides with real steps", () => {
    let state = at("mist", "stones", replay(lassoRun));
    state = walk(state, { x: 1, y: 0 }, 60);
    expect(state.player.x).toBeLessThan(795);
    state = atPoint(state, { x: 745, y: 580 }, "right");
    expect(targetInteractable(world, state)?.id).toBe("gully-posts");
    state = readDialogue(step(world, state, press({ confirm: true })).state);
    expect(world.storyVariable(state.ink, "rope_bridge")).toBe(true);
    state = walk(state, { x: 1, y: 0 }, 120);
    expect(state.player.x).toBeGreaterThan(945);
  }, 30_000);

  it("plays every seal note through dialogue and only opens on red-yellow-blue-red", () => {
    const attempt = (initial: State, choices: number[]): {
      state: State; lines: string[]; sounds: string[];
    } => {
      let state = atPoint(initial, { x: 1260, y: 565 }, "right");
      state = step(world, state, press({ confirm: true })).state;
      const lines: string[] = [];
      const sounds: string[] = [];
      let choice = 0;
      for (let tick = 0; tick < 500 && state.dialogue !== null; tick += 1) {
        const before = state;
        const dialogue = state.dialogue;
        const frame = dialogue.revealed < dialogue.text.length
          ? press({ confirm: tick % 2 === 1 })
          : dialogue.choices.length > 0
            ? press({ choose: choices[choice++] ?? 4 })
            : press({ confirm: tick % 2 === 1 });
        state = step(world, state, frame).state;
        sounds.push(...soundCues(before, state, world));
        if (state.dialogue?.text !== dialogue.text && before.dialogue?.text !== undefined)
          lines.push(before.dialogue.text);
      }
      return { state, lines, sounds };
    };
    let state = at("mist", "forest", replay(lassoRun));
    const stopped = attempt(state, [4]);
    expect(stopped.state.dialogue).toBeNull();
    expect(world.storyVariable(stopped.state.ink, "seal_open")).toBe(false);
    const green = attempt(state, [2, 0, 1, 3]);
    expect(green.state.dialogue).toBeNull();
    expect(world.storyVariable(green.state.ink, "seal_open")).toBe(false);
    expect(green.lines).toContain(
      "The bells give a gentle wobble. They only ring for a song I already know...",
    );
    expect(green.sounds).toContain("flute-green");
    state = green.state;
    const wrong = attempt(state, [0, 1, 3, 3]);
    expect(world.storyVariable(wrong.state.ink, "seal_open")).toBe(false);
    state = wrong.state;
    const right = attempt(state, [0, 1, 3, 0]);
    expect(world.storyVariable(right.state.ink, "seal_open")).toBe(true);
    expect(right.sounds).toEqual(expect.arrayContaining([
      "flute-red", "flute-yellow", "flute-blue",
    ]));
    expect(right.lines).toContain(
      "The mist wall parts, and a warm forest glow shines through the arch.",
    );
    expect(world.storyVariable(right.state.ink, "seal_open")).toBe(true);
    expect(attempt(right.state, []).lines).toContain(
      "The forest glows warmly beyond the bell-flower arch.",
    );
  }, 30_000);

  it("adds the Misty Path journal notes newest first as each rule advances", () => {
    const flowers = journalNotes(world,
      replay("tests/sim/scripts/pass-party/mist.json", "gully_bridge"));
    const final = journalNotes(world, replay("tests/sim/scripts/pass-party/mist.json"));
    expect(flowers[0]).toContain("stepping stones");
    expect(final.slice(0, 3)).toEqual([
      "The bell-flower seal opened, and a warm forest glow shone beyond the stones.",
      "I pulled the old rope bridge across the misty gully with my lasso.",
      "Bluebells lit stepping stones through the mist, one hop at a time!",
    ]);
  });
});
