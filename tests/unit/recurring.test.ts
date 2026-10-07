import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  inkFacts,
  nextRandom,
  rollWild,
  step,
  type ActionFrame,
  type Area,
  type State,
  type World,
} from "../../src/core";
import { critterErrors, loadContent } from "../../src/content/load";
import { areaConnectionErrors } from "../../src/content/area-checks";

// Contract for recurring critters (Milestone 28), EarthBound style. Critters
// are species placed many times: every time Fae arrives in an area, its dens
// roll their chaos critters fresh from the seeded PRNG in the state. One she
// calms stays calm only until she leaves. Every calm pays its coins; each
// species gives its sticker once. Story set pieces (the fountain frog, the
// school raccoon, the grumpy gull) are unique and never respawn.

const content = loadContent();
const world = content.world;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

// The state a step later, after a door into `area` at `spawn` has faded out.
function arrive(state: State, area: string, spawn: string): State {
  const fading: State = { ...state, transition: { target: { area, spawn }, phase: "out",
    elapsed: world.tunables.doorFadeTicks - 1 } };
  return step(world, fading, blankInput()).state;
}

describe("the arrival roll", () => {
  const park = areaFor("park");

  it("draws twice per den, in den order, whatever comes out", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    const dens = park.recurring?.dens.length ?? 0;
    expect(dens).toBe(2);
    for (const rng of [1, 77, 4242, 99999, 3141592653]) {
      const rolled = rollWild(world, { ...base, rng }, park);
      let expected = { ...base, rng };
      for (let draw = 0; draw < dens * 2; draw += 1) expected = nextRandom(expected)[1];
      expect(rolled.rng, `rng ${rng}`).toBe(expected.rng);
    }
  });

  it("is the same roll for the same PRNG state (replays stay exact)", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    expect(rollWild(world, base, park)).toEqual(rollWild(world, base, park));
  });

  it("takes each den's kinds and chance: the park always has a pup, sometimes more", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    const outs = new Map<string, number>();
    for (let rng = 1; rng <= 400; rng += 1) {
      const { wild } = rollWild(world, { ...base, rng: Math.imul(rng, 2654435761) >>> 0 }, park);
      expect(wild.find((critter) => critter.den === 0)?.kind).toBe("pup");
      for (const critter of wild.filter((item) => item.den === 1))
        outs.set(critter.kind, (outs.get(critter.kind) ?? 0) + 1);
      for (const critter of wild) {
        const den = park.recurring?.dens[critter.den];
        expect(den?.kinds).toContain(critter.kind);
        expect({ x: critter.x, y: critter.y, mood: critter.mood })
          .toEqual({ x: den?.point.x, y: den?.point.y, mood: "chaos" });
      }
    }
    // Den 1 (cats and raccoons, chance 0.6) is out about 60% of the time.
    const total = (outs.get("cat") ?? 0) + (outs.get("raccoon") ?? 0);
    expect(total).toBeGreaterThan(400 * 0.45);
    expect(total).toBeLessThan(400 * 0.75);
    expect(outs.get("cat")).toBeGreaterThan(40);
    expect(outs.get("raccoon")).toBeGreaterThan(40);
  });

  it("keeps the plaza quiet, drawing nothing, until the fountain frog is calm", () => {
    const plaza = areaFor("plaza");
    const quiet = createState(world, { area: "plaza", spawn: "fountain", seed: 3 });
    expect(rollWild(world, quiet, plaza)).toEqual({ wild: [], rng: quiet.rng });
    const calm: State = { ...quiet, critters: { ...quiet.critters, "fountain-frog": "calm" } };
    const rolled = rollWild(world, calm, plaza);
    expect(rolled.rng).not.toBe(quiet.rng);
    for (const critter of rolled.wild) expect(["raccoon", "pup", "cat"]).toContain(critter.kind);
  });

  it("happens on every arrival: through a door, and back again", () => {
    let state = createState(world, { area: "park", spawn: "plaza-path", seed: 9 });
    const before = state.rng;
    state = arrive(state, "plaza", "park-path");
    expect(state.wild, "the plaza is quiet until its frog is calm").toEqual([]);
    expect(state.rng, "and draws nothing").toBe(before);
    state = arrive(state, "park", "plaza-path");
    expect(state.rng).not.toBe(before);
    expect(state.wild.map((critter) => critter.kind)).toContain("pup");
    expect(state.wild.every((critter) => critter.mood === "chaos")).toBe(true);
  });
});

describe("a calmed recurring critter", () => {
  // Fae in the park, the pond's pup out, calm.
  function calmPark(): State {
    const start = createState(world, { area: "park", spawn: "plaza-path", seed: 1 });
    return { ...start, wild: start.wild.map((critter) =>
      critter.den === 0 ? { ...critter, mood: "calm" } : critter) };
  }

  it("stays calm while Fae stays, and never battles", () => {
    let state = calmPark();
    const pup = state.wild.find((critter) => critter.den === 0);
    if (pup === undefined) throw new Error("no pup");
    state = { ...state, player: { x: pup.x - 90, y: pup.y }, facing: "right" };
    for (let tick = 0; tick < 60; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.battle).toBeNull();
    expect(state.wild.find((critter) => critter.den === 0)?.mood).toBe("calm");
  });

  it("is gone when Fae leaves: the next arrival rolls it fresh, in chaos", () => {
    const state = arrive(calmPark(), "park", "plaza-path");
    expect(state.wild.find((critter) => critter.den === 0)).toMatchObject({
      kind: "pup", mood: "chaos" });
  });

  it("is rolled fresh after a rest in the same area too (a rest is an arrival)", () => {
    const start = calmPark();
    const rested: State = { ...start, transition: { target: start.safeSpot, phase: "out",
      elapsed: world.tunables.doorFadeTicks - 1 } };
    const after = step(world, rested, blankInput()).state;
    expect(after.area).toBe("park");
    expect(after.wild.find((critter) => critter.den === 0)?.mood).toBe("chaos");
  });
});

describe("what the story asks", () => {
  it("answers calmed(species) from the stickers, and a set piece from its own mood", () => {
    const fresh = createState(world, { area: "bay", spawn: "plaza-road", seed: 1 });
    // A bay frog calmed: the frogs' sticker (the fountain frog's), but the
    // fountain frog himself is still fizzy.
    const facts = inkFacts(world, { ...fresh, stickers: ["fountain-frog"] }).calmed;
    expect(facts).toMatchObject({ frog: true, "fountain-frog": false });
    expect(facts["pup"]).toBeUndefined();
    const calm = inkFacts(world, { ...fresh,
      critters: { ...fresh.critters, "fountain-frog": "calm" } }).calmed;
    expect(calm["fountain-frog"]).toBe(true);
  });
});

describe("content checks", () => {
  const { critters, stickers, areas } = world;

  it("pass for the shipped content", () => {
    expect(critterErrors(areas, critters, stickers)).toEqual([]);
  });

  it("refuse a den of story set pieces, a set piece placed twice, and an unknown `after`", () => {
    const plaza = areaFor("plaza");
    const broken: World["areas"] = {
      ...areas,
      plaza: { ...plaza, recurring: { after: "dragon", dens: [{ point: { x: 800, y: 395 },
        radius: 90, kinds: ["fountain-frog"], chance: 1 }] } },
      park: { ...areaFor("park"), critters: [{ id: "gull", point: { x: 880, y: 600 } }] },
    };
    expect(critterErrors(broken, critters, stickers)).toEqual([
      "trail: set piece gull is in park too",
      "plaza: recurring.after dragon is neither a set piece nor a species",
      "plaza: den 0 lists fountain-frog, which isn't a recurring kind",
    ]);
  });

  it("refuse two stickers for one species", () => {
    const frog = critters["frog"];
    if (frog === undefined) throw new Error("no frog");
    const odd = { ...critters, frog: { ...frog, sticker: { ...frog.sticker, id: "bay-frog" } } };
    expect(critterErrors(areas, odd, stickers)).toEqual(expect.arrayContaining([
      "critter frog: species frog has two stickers, fountain-frog and bay-frog",
      "critter frog: sticker bay-frog isn't in the album",
    ]));
  });

  it("refuse a den where Fae would arrive in its critters' sight", () => {
    const park = areaFor("park");
    const spawn = park.spawns["plaza-path"];
    if (spawn === undefined) throw new Error("no spawn");
    const near: Area = { ...park, recurring: { dens: [{
      point: { x: spawn.x + 120, y: spawn.y - 100 }, radius: 60, kinds: ["pup"], chance: 1 }] } };
    expect(areaConnectionErrors({ park: near }, world.tunables, critters, world.party))
      .toContain("park: den 0 is within 250 of spawn plaza-path");
  });

  it("refuse a den mostly behind scenery, where its critters can't be seen", () => {
    // Behind the park's play tower, where a den once was.
    const park = areaFor("park");
    const hidden: Area = { ...park, recurring: { dens: [{
      point: { x: 1150, y: 380 }, radius: 80, kinds: ["cat"], chance: 1 }] } };
    expect(areaConnectionErrors({ park: hidden }, world.tunables, critters, world.party))
      .toContain("park: den 0 is mostly behind scenery");
  });
});
