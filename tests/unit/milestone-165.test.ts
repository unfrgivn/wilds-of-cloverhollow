import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  landFieldGuide,
  openArcade,
  setInkVariables,
  soundCues,
  soundtrackFor,
  startBattle,
  step,
  type ActionFrame,
  type Battle,
  type SoundCue,
  type State,
  type TacoTopping,
} from "../../src/core";
import * as audio from "../../src/platform/audio";
import * as audioRecipes from "../../src/platform/audio-recipes";
import { hapticForTick } from "../../src/shell/feedback";

const { world, fixtures } = loadContent();
const rawHillsFixture = fixtures["hills-calm"] ?? fixtures.hills ?? fixtures["new-game"];
const rawPlazaFixture = fixtures.plaza ?? fixtures["new-game"];
if (rawHillsFixture === undefined || rawPlazaFixture === undefined) {
  throw new Error("Missing hills or plaza fixture");
}
const hillsFixture = rawHillsFixture;
const plazaFixture = rawPlazaFixture;

const TOPPING_MOVE: Readonly<Record<TacoTopping, { x: number; y: number }>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

const confirmFrame: ActionFrame = { ...blankInput(), confirm: true };

function recipeDuration(recipe: audioRecipes.AudioRecipe): number {
  let maxEnd = 0;
  for (const segment of recipe) {
    maxEnd = Math.max(maxEnd, segment.offset + segment.duration);
  }
  return maxEnd;
}

describe("Milestone 165: Bespoke Taco Truck Audio, Battle-Faint Lullaby & Land Guides", () => {
  it("emits taco-top, taco-oops, and taco-order on live Taco Truck Kitchen transitions", () => {
    let state = openArcade(world, createState(world, hillsFixture, 21), "taco", 0, false);
    state = step(world, state, confirmFrame).state;
    state = step(world, state, blankInput()).state;
    if (state.arcade?.game !== "taco") throw new Error("expected taco game");

    const order = state.arcade.orders[0];
    if (order === undefined) throw new Error("expected first taco order");
    const firstStep = order.recipe[0];
    if (firstStep === undefined) throw new Error("expected first recipe topping");

    // Wrong topping first -> taco-oops (and never mole-whiff).
    const wrongTopping: TacoTopping = firstStep === "beans" ? "cheese" : "beans";
    const beforeOops = state;
    state = step(world, state, { ...blankInput(), move: TOPPING_MOVE[wrongTopping] }).state;
    const oopsCues = soundCues(beforeOops, state, world);
    expect(oopsCues).toContain("taco-oops");
    expect(oopsCues).not.toContain("mole-whiff");
    state = step(world, state, blankInput()).state;

    // Complete every topping in order 0 -> taco-top on each step, taco-order on order-clear.
    const orderCues: SoundCue[] = [];
    for (const topping of order.recipe) {
      const before = state;
      state = step(world, state, { ...blankInput(), move: TOPPING_MOVE[topping] }).state;
      orderCues.push(...soundCues(before, state, world));
      state = step(world, state, blankInput()).state;
    }

    expect(orderCues.filter((cue) => cue === "taco-top")).toHaveLength(order.recipe.length);
    expect(orderCues).toContain("taco-order");
    expect(orderCues).not.toContain("mole-boop");
    expect(orderCues).not.toContain("cook-ding");
  });

  it("emits battle-faint once when entering cozy battle-faint rest (phase === rest)", () => {
    const base = createState(world, plazaFixture, 7);
    const critter = world.critters["fountain-frog"];
    if (critter === undefined) throw new Error("missing fountain-frog critter");
    const started = startBattle(world, base, critter);

    // Drive a real battle burstResult with 0 energy -> confirms into phase === "rest".
    const lowEnergy: Battle = {
      ...started,
      phase: "burstResult",
      energy: 0,
      message: "Fae feels dizzy!",
      revealed: 16,
    };
    const beforeRest: State = { ...base, battle: lowEnergy };
    const enteredRest = step(world, beforeRest, confirmFrame).state;
    expect(enteredRest.battle?.phase).toBe("rest");
    expect(soundCues(beforeRest, enteredRest, world)).toContain("battle-faint");

    // Staying in phase === "rest" does not re-emit battle-faint.
    const tickingRest = step(world, enteredRest, blankInput()).state;
    expect(tickingRest.battle?.phase).toBe("rest");
    expect(soundCues(enteredRest, tickingRest, world)).not.toContain("battle-faint");

    // Confirming out of rest still emits battle-rest and starts the dark fade to safeSpot.
    if (tickingRest.battle === null) throw new Error("expected resting battle");
    const revealedRest: State = {
      ...tickingRest,
      battle: { ...tickingRest.battle, revealed: tickingRest.battle.message.length },
    };
    const leftRest = step(world, revealedRest, confirmFrame).state;
    expect(leftRest.battle).toBeNull();
    const exitCues = soundCues(revealedRest, leftRest, world);
    expect(exitCues).toContain("battle-rest");
    expect(exitCues).not.toContain("battle-faint");
  });

  it("defines valid bespoke recipes for all 4 cues with audio.ts re-export parity", () => {
    expect(audio.soundCueRecipe).toBe(audioRecipes.soundCueRecipe);

    const bespokeCues: readonly SoundCue[] = [
      "taco-top",
      "taco-oops",
      "taco-order",
      "battle-faint",
    ];
    for (const cue of bespokeCues) {
      const recipe = audio.soundCueRecipe(cue);
      expect(recipe).toBe(audioRecipes.soundCueRecipe(cue));
      expect(recipe.length, `${cue} segments`).toBeGreaterThan(0);
      expect(recipeDuration(recipe), `${cue} total duration`).toBeLessThanOrEqual(0.55);
      for (const segment of recipe) {
        expect(segment.offset, `${cue} offset`).toBeGreaterThanOrEqual(0);
        expect(segment.duration, `${cue} duration`).toBeGreaterThan(0);
        expect(segment.gain, `${cue} gain > 0`).toBeGreaterThan(0);
        expect(segment.gain, `${cue} gain <= 0.11`).toBeLessThanOrEqual(0.11);
        if (segment.wave === "noise") {
          expect(segment.lowpass, `${cue} lowpass`).toBeGreaterThan(0);
        } else {
          expect(segment.frequency, `${cue} frequency`).toBeGreaterThan(0);
          if (segment.endFrequency !== undefined) {
            expect(segment.endFrequency, `${cue} endFrequency`).toBeGreaterThan(0);
          }
        }
      }
    }

    // Check signature sonic shapes and gentle battle-faint lullaby ceiling.
    const tacoTop = audio.soundCueRecipe("taco-top");
    expect(tacoTop.some((seg) => seg.wave === "noise" && seg.lowpass === 3200)).toBe(true);
    expect(recipeDuration(tacoTop)).toBeCloseTo(0.09, 3);

    const tacoOops = audio.soundCueRecipe("taco-oops");
    expect(recipeDuration(tacoOops)).toBeCloseTo(0.11, 3);
    for (const seg of tacoOops) expect(seg.gain).toBeLessThanOrEqual(0.055);

    const tacoOrder = audio.soundCueRecipe("taco-order");
    expect(recipeDuration(tacoOrder)).toBeCloseTo(0.36, 3);
    expect(tacoOrder.some((seg) => seg.wave === "sine" && seg.frequency === 1568)).toBe(true);
    expect(tacoOrder.some((seg) => seg.wave === "sine" && seg.frequency === 3136)).toBe(true);

    const faint = audio.soundCueRecipe("battle-faint");
    expect(recipeDuration(faint)).toBeCloseTo(0.5, 3);
    for (const seg of faint) expect(seg.gain).toBeLessThanOrEqual(0.065);
  });

  it("wires taco and battle-faint haptic coverage with priority ordering", () => {
    const idle = createState(world, plazaFixture, 1);

    expect(hapticForTick(idle, idle, ["taco-order"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["taco-oops"])).toBe("medium");
    expect(hapticForTick(idle, idle, ["battle-faint"])).toBe("medium");
    expect(hapticForTick(idle, idle, ["taco-top"])).toBe("light");

    // Priority: celebrate > medium > light.
    expect(hapticForTick(idle, idle, ["taco-top", "taco-oops", "taco-order"])).toBe("celebrate");
    expect(hapticForTick(idle, idle, ["taco-top", "taco-oops"])).toBe("medium");
    expect(hapticForTick(idle, idle, ["coin", "battle-faint"])).toBe("medium");
  });

  it("ducks battle soundtrack on cozy battle-faint rest while keeping command unducked", () => {
    const base = createState(world, plazaFixture, 3);
    const frog = world.critters["fountain-frog"];
    const gull = world.critters.gull;
    if (frog === undefined || gull === undefined) throw new Error("missing battle critters");

    const commandBattle = startBattle(world, base, frog);
    const commandState: State = { ...base, battle: { ...commandBattle, phase: "command" } };
    expect(soundtrackFor(world, commandState, { titleOpen: false })).toMatchObject({
      track: "battle",
      duck: false,
    });

    const faintState: State = { ...base, battle: { ...commandBattle, phase: "rest", energy: 0 } };
    expect(soundtrackFor(world, faintState, { titleOpen: false })).toMatchObject({
      track: "battle",
      duck: true,
    });

    const bossFaint: State = {
      ...base,
      battle: { ...startBattle(world, base, gull), phase: "rest", energy: 0 },
    };
    expect(soundtrackFor(world, bossFaint, { titleOpen: false })).toMatchObject({
      track: "boss",
      duck: true,
    });
  });

  it("updates expansion Land Field Guides for hills and pass while keeping bay unchanged", () => {
    const base = createState(world, plazaFixture, 1);
    const revealed: State = {
      ...base,
      ink: setInkVariables(base.ink, { visited_hills: true }),
    };

    expect(landFieldGuide(world, revealed, "hills")).toContain("Sanctuary & Taco Truck");
    expect(landFieldGuide(world, revealed, "pass")).toContain("Lodge, Summit & Cavern");
    expect(landFieldGuide(world, revealed, "bay")).toContain("Fishing, Boats & Cottage");
  });
});
