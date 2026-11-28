import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  autosaveNeeded,
  createState,
  type Battle,
  type BattleTalk,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import {
  battleStageMood,
  computeBattleChoreography,
} from "../../src/render/battle-choreography";
import { fadeAlpha, transitionZoom } from "../../src/render/fade";
import {
  battleMeterRemaining,
  battleTalkDialogueView,
  talkChoicesShown,
} from "../../src/ui/battle";

const question: BattleTalk = {
  knot: "kid_talk_2", turn: 2, speaker: "Hooded Kid",
  text: "Nobody ever notices me anyway...", revealed: 100,
  choices: ["I notice you!", "Everybody noticed the scribbles."],
  selected: 1, ended: false, grade: null,
};

describe("battle Talk dialogue projection", () => {
  it("holds choices until the line is fully revealed", () => {
    const view = battleTalkDialogueView({ ...question, revealed: 8 });
    expect(view.speaker).toBe("Hooded Kid");
    expect(view.choices).toEqual([]);
    expect(view.canAdvance).toBe(false);
  });

  it("projects revealed choices and the selected sticker", () => {
    const view = battleTalkDialogueView(question);
    expect(view.choices).toEqual([
      { text: "I notice you!" },
      { text: "Everybody noticed the scribbles." },
    ]);
    expect(view.selected).toBe(1);
    expect(view.canAdvance).toBe(false);
  });

  it("puts the HUD aside only while a question's answers are on screen", () => {
    expect(talkChoicesShown(null)).toBe(false);
    expect(talkChoicesShown({ ...question, revealed: 8 })).toBe(false);
    expect(talkChoicesShown(question)).toBe(true);
    expect(talkChoicesShown({ ...question, text: "You... you saw those?", choices: [] }))
      .toBe(false);
  });
});

describe("countdown battle meter", () => {
  it("counts remaining fizz down from 1 to 0 as calm rises, clamped to [0, 1]", () => {
    expect(battleMeterRemaining(0)).toBe(1);
    expect(battleMeterRemaining(0.25)).toBe(0.75);
    expect(battleMeterRemaining(0.5)).toBe(0.5);
    expect(battleMeterRemaining(0.75)).toBe(0.25);
    expect(battleMeterRemaining(1)).toBe(0);
    expect(battleMeterRemaining(-0.4)).toBe(1);
    expect(battleMeterRemaining(1.6)).toBe(0);
  });

  it("initializes .battle-calm-fill at full width and renders fizz countdown attributes", () => {
    const css = readFileSync("src/ui/battle.css", "utf8");
    expect(css).toMatch(/\.battle-calm-fill\s*\{[^}]*width:\s*100%;/);
    const ts = readFileSync("src/ui/battle.ts", "utf8");
    expect(ts).toContain("const remainingFraction = battleMeterRemaining(view.calm);");
    expect(ts).toContain('setAttribute(track, "aria-label", `${view.critterName} fizz`);');
    expect(ts).toContain('calmHeart.classList.toggle("is-warm", calmFraction >= 0.75);');
    expect(ts).toContain("String(Math.round(remainingFraction * 100))");
    expect(ts).toContain("fill.style.width = `${remainingFraction * 100}%`;");
  });
});

function restBattle(phaseTicks: number): Battle {
  return {
    critterId: "fountain-frog",
    den: null,
    entry: { x: 500, y: 500 },
    phase: "rest",
    message: "Fae needs a quick breather!",
    revealed: 26,
    selected: 0,
    command: null,
    energy: 0,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: "miss",
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 2,
    windUp: null,
    rewardSticker: null,
    phaseTicks,
  };
}

describe("cozy faint choreography, dark rest fade, and deferred autosave", () => {
  const partyIds = ["maddie", "sue"] as const;
  const partyCommands: Record<string, string | null> = {
    maddie: "play",
    sue: "cast",
  };

  it("choreographs dizzy sway -> sideways slump -> resting breath with overhead stars", () => {
    const swayBattle = restBattle(5);
    expect(battleStageMood(swayBattle, null)).toBe("rest");
    const sway = computeBattleChoreography(swayBattle, null, 10, partyIds, partyCommands, false);
    expect(sway.stageMood).toBe("rest");
    expect(Math.abs(sway.fae.offsetX)).toBeGreaterThan(0);
    expect(Math.abs(sway.fae.rotation)).toBeGreaterThan(0);
    expect(sway.fae.offsetY).toBeGreaterThan(0);
    expect(sway.fae.offsetY).toBeLessThan(3);

    const slump = computeBattleChoreography(
      restBattle(23),
      null,
      28,
      partyIds,
      partyCommands,
      false,
    );
    expect(slump.fae.offsetX).toBeCloseTo(-5, 3);
    expect(slump.fae.offsetY).toBeCloseTo(10.5, 3);
    expect(slump.fae.rotation).toBeCloseTo(-0.44, 3);
    expect(slump.fae.scaleX).toBeCloseTo(1.04, 3);
    expect(slump.fae.scaleY).toBeCloseTo(0.95, 3);

    const restA = computeBattleChoreography(
      restBattle(40),
      null,
      0,
      partyIds,
      partyCommands,
      false,
    );
    const restB = computeBattleChoreography(
      restBattle(48),
      null,
      31,
      partyIds,
      partyCommands,
      false,
    );
    expect(restA.fae.offsetX).toBe(-10);
    expect(restA.fae.offsetY).toBe(18);
    expect(restA.fae.rotation).toBe(-0.88);
    expect(restB.fae.scaleX).toBeGreaterThan(restA.fae.scaleX);
    expect(restB.fae.scaleY).toBeLessThan(restA.fae.scaleY);

    for (const id of partyIds) {
      expect(restA.party[id]).toEqual({
        offsetX: -3,
        offsetY: 4,
        scaleX: 1.02,
        scaleY: 0.95,
        rotation: -0.08,
      });
    }

    const stars = restA.vfx.filter(
      (particle) => particle.texture === "sparkle" && particle.anchor === "fae",
    );
    expect(stars).toHaveLength(3);
    for (const star of stars) {
      expect(star.alpha).toBeCloseTo(0.78, 3);
      expect(star.offsetY).toBeLessThan(0);
    }
  });

  it("holds a calm static slump and 2 overhead stars under reducedMotion", () => {
    const a = computeBattleChoreography(restBattle(4), null, 10, partyIds, partyCommands, true);
    const b = computeBattleChoreography(restBattle(44), null, 90, partyIds, partyCommands, true);
    expect(a.stageMood).toBe("rest");
    expect(a.fae).toEqual({
      offsetX: -8,
      offsetY: 16,
      scaleX: 1.06,
      scaleY: 0.92,
      rotation: -0.78,
      tintFlash: 0,
    });
    expect(b.fae).toEqual(a.fae);
    for (const id of partyIds) {
      expect(a.party[id]).toEqual({
        offsetX: 0,
        offsetY: 3,
        scaleX: 1,
        scaleY: 0.96,
        rotation: -0.05,
      });
      expect(b.party[id]).toEqual(a.party[id]);
    }
    const stars = a.vfx.filter(
      (particle) => particle.texture === "sparkle" && particle.anchor === "fae",
    );
    expect(stars).toHaveLength(2);
    expect(b.vfx).toEqual(a.vfx);
  });

  it("holds a full blackout plateau and disables zoom for tone: dark transitions", () => {
    const dark = (phase: "out" | "in", elapsed: number): State["transition"] => ({
      target: { area: "plaza", spawn: "fountain" },
      phase,
      elapsed,
      tone: "dark",
    });
    const door = (phase: "out" | "in", elapsed: number): State["transition"] => ({
      target: { area: "plaza", spawn: "fountain" },
      phase,
      elapsed,
    });

    expect(fadeAlpha(dark("out", 0), 18)).toBe(0);
    expect(fadeAlpha(dark("out", 6), 18)).toBeGreaterThan(0);
    expect(fadeAlpha(dark("out", 6), 18)).toBeLessThan(1);
    // Reaches full 1.0 blackout by 65% of out (11.7 ticks for doorFadeTicks = 18).
    expect(fadeAlpha(dark("out", 12), 18)).toBe(1);
    expect(fadeAlpha(dark("out", 18), 18)).toBe(1);
    // Holds full 1.0 blackout through first 35% of in (6.3 ticks).
    expect(fadeAlpha(dark("in", 0), 18)).toBe(1);
    expect(fadeAlpha(dark("in", 6), 18)).toBe(1);
    expect(fadeAlpha(dark("in", 12), 18)).toBeGreaterThan(0);
    expect(fadeAlpha(dark("in", 12), 18)).toBeLessThan(1);
    expect(fadeAlpha(dark("in", 18), 18)).toBe(0);

    // No page-turn zoom during dark rest blackout; normal door fade still zooms.
    expect(transitionZoom(dark("out", 9), 18)).toBe(1);
    expect(transitionZoom(dark("in", 9), 18)).toBe(1);
    expect(transitionZoom(door("out", 9), 18)).toBeGreaterThan(1);
    expect(transitionZoom(door("in", 9), 18)).toBeLessThan(1);
  });

  it("defers autosave across rest -> dark transition until respawn completes", () => {
    const content = loadContent();
    const fixture = content.fixtures.plaza;
    if (fixture === undefined) throw new Error("plaza fixture missing");
    const base = createState(content.world, fixture);
    const resting: State = { ...base, battle: restBattle(30), transition: null };
    const fadingOut: State = {
      ...base,
      battle: null,
      transition: { target: base.safeSpot, phase: "out", elapsed: 0, tone: "dark" },
    };
    const fadingIn: State = {
      ...base,
      battle: null,
      transition: { target: base.safeSpot, phase: "in", elapsed: 0, tone: "dark" },
    };
    const respawned: State = { ...base, battle: null, transition: null };

    expect(autosaveNeeded(resting, fadingOut)).toBe(false);
    expect(autosaveNeeded(fadingOut, fadingIn)).toBe(false);
    expect(autosaveNeeded(fadingIn, respawned)).toBe(true);
  });
});
