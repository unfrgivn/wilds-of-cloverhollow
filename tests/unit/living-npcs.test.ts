import { describe, expect, it } from "vitest";
import {
  BOSS_SET_PIECES,
  bossesCalmedCount,
  calmedFact,
  createState,
  evaluateNpcLife,
  inkFacts,
  matchesNpcCondition,
  npcVisible,
  npcWorldSituation,
  reactionRippleTicks,
  runInk,
  setInkVariables,
  startDialogue,
  step,
  type ActionFrame,
  type NpcAttention,
  type NpcEmoteKind,
  type NpcLifeMemory,
  type NpcPersonality,
  type State,
} from "../../src/core";
import { loadContent, npcScheduleErrors, parseNpcProfiles } from "../../src/content/load";
import { voiceForSpeaker } from "../../src/platform/voices";
import { speakerAccent, speakerPortraitSource } from "../../src/ui/portraits";
import { npcLivingPose } from "../../src/render/motion";
import { evaluateOverworldEmotes } from "../../src/render/emotes";
import { clampChatterPosition } from "../../src/ui/npc-chatter";

const { world } = loadContent();
const none: ActionFrame = { move: { x: 0, y: 0 }, confirm: false, cancel: false, menu: false };
const settledMemory: NpcLifeMemory = {
  areaTicks: 120,
  lastCalmedTick: null,
  lastTalkNpcId: null,
  lastTalkTick: null,
};

function makeState(
  area: string,
  spawn: string,
  variables?: Record<string, boolean>,
  party?: string[],
): State {
  return createState(world, { area, spawn, seed: 1, variables, party }, 1);
}

function findNpc(areaId: string, npcId: string) {
  const area = world.areas[areaId];
  if (area === undefined) throw new Error(`missing area ${areaId}`);
  const npc = area.npcs.find((item) => item.id === npcId);
  if (npc === undefined) throw new Error(`missing npc ${areaId}/${npcId}`);
  return npc;
}

describe("Living NPC schedules and dynamic relocations", () => {
  it("calmedFact checks both set piece mood and species stickers", () => {
    const base = makeState("plaza", "front-door");
    expect(calmedFact(world, base, "fountain-frog")).toBe(false);
    expect(calmedFact(world, base, "frog")).toBe(false);
    const calmedPiece: State = {
      ...base,
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    expect(calmedFact(world, calmedPiece, "fountain-frog")).toBe(true);
    const withSticker: State = { ...base, stickers: ["fountain-frog"] };
    expect(calmedFact(world, withSticker, "frog")).toBe(true);
  });

  it("relocates Sammy from plaza to arcade once arcade-keeper is calmed", () => {
    const plazaSammy = findNpc("plaza", "sammy");
    const arcadeSammy = findNpc("arcade", "sammy");
    const before = makeState("plaza", "front-door");
    expect(npcVisible(world, before, plazaSammy)).toBe(true);
    expect(npcVisible(world, before, arcadeSammy)).toBe(false);
    const after: State = {
      ...before,
      critters: { ...before.critters, "arcade-keeper": "calm" },
    };
    expect(npcVisible(world, after, plazaSammy)).toBe(false);
    expect(npcVisible(world, after, arcadeSammy)).toBe(true);
  });

  it("relocates Leo on recess and Maya from field to art-room on art_open", () => {
    const hallLeo = findNpc("east-hall", "leo");
    const fieldLeo = findNpc("field", "leo");
    const fieldMaya = findNpc("field", "maya");
    const artMaya = findNpc("art-room", "maya");

    const morning = makeState("east-hall", "west");
    expect(npcVisible(world, morning, hallLeo)).toBe(true);
    expect(npcVisible(world, morning, fieldLeo)).toBe(false);
    expect(npcVisible(world, morning, fieldMaya)).toBe(false);
    expect(npcVisible(world, morning, artMaya)).toBe(false);

    const recess = makeState("field", "gym", { recess: true });
    expect(npcVisible(world, recess, hallLeo)).toBe(false);
    expect(npcVisible(world, recess, fieldLeo)).toBe(true);
    expect(npcVisible(world, recess, fieldMaya)).toBe(true);
    expect(npcVisible(world, recess, artMaya)).toBe(false);

    const artOpen = makeState("art-room", "door", { recess: true, art_open: true });
    expect(npcVisible(world, artOpen, fieldMaya)).toBe(false);
    expect(npcVisible(world, artOpen, artMaya)).toBe(true);
  });

  it("places all 26 living NPCs across all 29 authored placements and 51 profiles", () => {
    const placements: readonly [string, string][] = [
      ["plaza", "flora"],
      ["plaza", "sammy"],
      ["plaza", "gus"],
      ["arcade", "sammy"],
      ["arcade", "poppy"],
      ["park", "pippa"],
      ["park", "hazel"],
      ["east-hall", "leo"],
      ["east-hall", "bert"],
      ["field", "leo"],
      ["field", "maya"],
      ["art-room", "maya"],
      ["art-room", "theo"],
      ["bay", "sal"],
      ["bay", "nora"],
      ["bay", "kai"],
      ["trail", "lark"],
      ["trail", "bramble"],
      ["pass", "mina"],
      ["pass", "tuck"],
      ["lodge", "otis"],
      ["lodge", "clara"],
      ["cavern", "pebble"],
      ["cavern", "gemma"],
      ["woods", "moss"],
      ["woods", "wren"],
      ["hills", "sunny"],
      ["hills", "bram"],
      ["mist", "sage"],
    ];
    expect(placements.length).toBe(29);
    expect(Object.keys(world.npcProfiles).length).toBe(51);
    const uniqueIds = new Set<string>();
    for (const [areaId, npcId] of placements) {
      const npc = findNpc(areaId, npcId);
      expect(npc.prompt, `${areaId}/${npcId}`).toBe("Talk");
      expect(world.npcProfiles[npcId], `profile for ${npcId}`).toBeDefined();
      uniqueIds.add(npcId);
    }
    expect(uniqueIds.size).toBe(26);

    const poppy = findNpc("arcade", "poppy");
    const beforeArcade = makeState("arcade", "door");
    expect(npcVisible(world, beforeArcade, poppy)).toBe(false);
    const afterArcade: State = {
      ...beforeArcade,
      critters: { ...beforeArcade.critters, "arcade-keeper": "calm" },
    };
    expect(npcVisible(world, afterArcade, poppy)).toBe(true);

    const theo = findNpc("art-room", "theo");
    expect(npcVisible(world, makeState("art-room", "door"), theo)).toBe(false);
    expect(npcVisible(world, makeState("art-room", "door", { art_open: true }), theo)).toBe(true);
  });
});

describe("Living NPC Ink externals, knots, and spoiler safety", () => {
  it("populates live world awareness facts including bossesCalmed in inkFacts", () => {
    const base = makeState("plaza", "front-door", undefined, ["maddie", "sue"]);
    const state: State = {
      ...base,
      lantern: true,
      xp: 300,
      stickers: ["fountain-frog", "pond-pup", "bay-bluebird"],
      treats: { "clover-biscuit": 2, "berry-tart": 1 },
      critters: {
        ...base.critters,
        "arcade-keeper": "calm",
        lifeguard: "calm",
        "taco-chef": "calm",
      },
    };
    expect(BOSS_SET_PIECES.length).toBe(9);
    expect(bossesCalmedCount(world, base)).toBe(0);
    expect(bossesCalmedCount(world, state)).toBe(3);
    const facts = inkFacts(world, state);
    expect(facts.party).toEqual(["maddie", "sue"]);
    expect(facts.lantern).toBe(true);
    expect(facts.areaCalm).toBe(false);
    expect(facts.level).toBeGreaterThan(1);
    expect(facts.stickers).toBe(3);
    expect(facts.treats).toBe(3);
    expect(facts.bossesCalmed).toBe(3);
  });

  it("delivers Gus's bossesCalmed() reward once without double-gifting", () => {
    let state = makeState("plaza", "front-door");
    state = {
      ...state,
      critters: {
        ...state.critters,
        "fountain-frog": "calm",
        "arcade-keeper": "calm",
        lifeguard: "calm",
      },
    };
    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    state = startDialogue(world, state, "npc_gus");
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
    }
    expect(state.coins).toBe(coinsBefore + 10);
    expect(state.snacks).toBe(snacksBefore + 1);

    // Revisit Gus: no second mail parcel gift.
    state = startDialogue(world, state, "npc_gus");
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      const done = state.dialogue.revealed >= state.dialogue.text.length;
      if (state.dialogue.choices.length > 0 && done) {
        state = step(world, state, { ...none, confirm: true }).state;
      } else {
        state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
      }
    }
    expect(state.coins).toBe(coinsBefore + 10);
    expect(state.snacks).toBe(snacksBefore + 1);
  });

  it("delivers one-time Ink rewards via stitch visit counts without double-gifting", () => {
    let state = makeState(
      "plaza",
      "front-door",
      { garden_ripe: true },
      ["maddie", "sue"],
    );
    const snacksBefore = state.snacks;
    state = startDialogue(world, state, "npc_flora");
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
    }
    expect(state.snacks).toBe(snacksBefore + 2);

    // Revisit Flora: no second gift.
    state = startDialogue(world, state, "npc_flora");
    for (let index = 0; index < 30 && state.dialogue !== null; index += 1) {
      const done = state.dialogue.revealed >= state.dialogue.text.length;
      if (state.dialogue.choices.length > 0 && done) {
        state = step(world, state, { ...none, confirm: true }).state;
      } else {
        state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
      }
    }
    expect(state.snacks).toBe(snacksBefore + 2);
  });

  it("runs Leo's research grant only once across hall and field knots", () => {
    let state = makeState("east-hall", "west");
    state = {
      ...state,
      stickers: [
        "fountain-frog", "pond-pup", "cozy-cat",
        "bay-bluebird", "ribbon-bunny", "acorn-squirrel",
      ],
    };
    const coinsBefore = state.coins;
    state = startDialogue(world, state, "npc_leo_hall");
    for (let index = 0; index < 20 && state.dialogue !== null; index += 1) {
      state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
    }
    expect(state.coins).toBe(coinsBefore + 15);

    state = startDialogue(world, state, "npc_leo_field");
    for (let index = 0; index < 20 && state.dialogue !== null; index += 1) {
      const done = state.dialogue.revealed >= state.dialogue.text.length;
      if (state.dialogue.choices.length > 0 && done) {
        state = step(world, state, { ...none, confirm: true }).state;
      } else {
        state = step(world, state, { ...none, confirm: index % 2 === 0 }).state;
      }
    }
    expect(state.coins).toBe(coinsBefore + 15);
  });

  it("runs the cross-biome postal chain Gus -> Sal -> Mina -> Gus via stitch counts", () => {
    const pickChoice = (
      initial: State,
      knot: string,
      choiceMatch: RegExp,
    ): { state: State; lines: string[]; matched: boolean } => {
      let state = startDialogue(world, initial, knot);
      const lines: string[] = [];
      let matched = false;
      for (let i = 0; i < 80 && state.dialogue !== null; i += 1) {
        const dlg = state.dialogue;
        if (lines.at(-1) !== dlg.text) lines.push(dlg.text);
        const done = dlg.revealed >= dlg.text.length;
        if (done && dlg.choices.length > 0) {
          const idx = dlg.choices.findIndex((text) => choiceMatch.test(text));
          if (idx >= 0) matched = true;
          const choose = idx >= 0 ? idx : 0;
          state = step(world, state, { ...none, choose }).state;
        } else {
          state = step(world, state, { ...none, confirm: i % 2 === 0 }).state;
        }
      }
      return { state, lines, matched };
    };

    const base = makeState("plaza", "front-door");
    let state: State = {
      ...base,
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    // 1. Gus hands Fae the Seashell Postcard once the plaza is calm.
    const step1 = pickChoice(state, "npc_gus", /deliver mail to the bay/i);
    expect(step1.matched).toBe(true);
    state = step1.state;

    // 2. Captain Sal rewards 8 coins and hands Fae the Mountain Reply Letter.
    const coinsBeforeSal = state.coins;
    let step2 = pickChoice(state, "npc_sal", /Seashell Postcard/i);
    state = step2.state;
    // First visit to Sal triggers harbor_snack; second visit shows choices.
    if (!step2.matched) {
      step2 = pickChoice(state, "npc_sal", /Seashell Postcard/i);
      state = step2.state;
    }
    expect(step2.matched).toBe(true);
    expect(state.coins).toBe(coinsBeforeSal + 8);

    // 3. Mina rewards 20 coins and 2 snacks.
    const coinsBeforeMina = state.coins;
    const snacksBeforeMina = state.snacks;
    const step3 = pickChoice(state, "npc_mina", /Mountain Letter/i);
    expect(step3.matched).toBe(true);
    state = step3.state;
    expect(state.coins).toBe(coinsBeforeMina + 20);
    expect(state.snacks).toBe(snacksBeforeMina + 2);

    // 4. Gus names Fae Honorary Junior Mail Carrier and rewards 15 coins.
    const coinsBeforeComplete = state.coins;
    const step4 = pickChoice(state, "npc_gus", /mountain mail arrived/i);
    expect(step4.matched).toBe(true);
    state = step4.state;
    expect(state.coins).toBe(coinsBeforeComplete + 15);
    expect(step4.lines.some((line) => /Honorary Junior Mail Carrier/i.test(line))).toBe(true);

    // Revisit Gus: completion choice is gone and remembered.
    const revisit = pickChoice(state, "npc_gus", /mountain mail arrived/i);
    expect(revisit.matched).toBe(false);
    expect(revisit.lines.some((line) => /Honorary Junior Mail Carrier/i.test(line))).toBe(true);
  });

  it("runs Wren's sketchbook chain and updates Maya and Theo reactions", () => {
    const pickChoice = (
      initial: State,
      knot: string,
      choiceMatch: RegExp,
    ): { state: State; lines: string[]; matched: boolean } => {
      let state = startDialogue(world, initial, knot);
      const lines: string[] = [];
      let matched = false;
      for (let i = 0; i < 80 && state.dialogue !== null; i += 1) {
        const dlg = state.dialogue;
        if (lines.at(-1) !== dlg.text) lines.push(dlg.text);
        const done = dlg.revealed >= dlg.text.length;
        if (done && dlg.choices.length > 0) {
          const idx = dlg.choices.findIndex((text) => choiceMatch.test(text));
          if (idx >= 0) matched = true;
          state = step(world, state, { ...none, choose: idx >= 0 ? idx : 0 }).state;
        } else {
          state = step(world, state, { ...none, confirm: i % 2 === 0 }).state;
        }
      }
      return { state, lines, matched };
    };

    let state = makeState("woods", "hills");
    const start = pickChoice(state, "npc_wren", /collect valley sketches/i);
    expect(start.matched).toBe(true);
    state = start.state;

    const rubbing = pickChoice(state, "npc_pebble", /crystal rubbing/i);
    expect(rubbing.matched).toBe(true);
    state = rubbing.state;

    const clover = pickChoice(state, "npc_sunny", /pressed clover/i);
    expect(clover.matched).toBe(true);
    state = clover.state;

    const coinsBefore = state.coins;
    const snacksBefore = state.snacks;
    const finish = pickChoice(state, "npc_wren", /crystal rubbing and clover/i);
    expect(finish.matched).toBe(true);
    state = finish.state;
    expect(state.coins).toBe(coinsBefore + 18);
    expect(state.snacks).toBe(snacksBefore + 2);

    const mayaVisit = pickChoice(state, "npc_maya_art", /easel/i);
    expect(mayaVisit.lines.some((line) => /Field Compendium/i.test(line))).toBe(true);
    const theoVisit = pickChoice(state, "npc_theo", /clay sculptures/i);
    expect(theoVisit.lines.some((line) => /Field Compendium/i.test(line))).toBe(true);
  });

  it("supports cozy snack-sharing (# feed: snack 1) across five neighbors once each", () => {
    const knots = ["npc_otis", "npc_hazel", "npc_tuck", "npc_lark", "npc_clara"] as const;
    for (const knot of knots) {
      let state: State = {
        ...makeState("lodge", "door"),
        snacks: 2,
        coins: 10,
      };
      // Consume any first-visit auto-gift stitch if present (e.g. Hazel's basket_treat).
      const runShare = (current: State): { state: State; shared: boolean; lines: string[] } => {
        let next = startDialogue(world, current, knot);
        const lines: string[] = [];
        let shared = false;
        for (let i = 0; i < 80 && next.dialogue !== null; i += 1) {
          const dlg = next.dialogue;
          if (lines.at(-1) !== dlg.text) lines.push(dlg.text);
          const done = dlg.revealed >= dlg.text.length;
          if (done && dlg.choices.length > 0) {
            const idx = dlg.choices.findIndex((text) => /Share a cozy snack/i.test(text));
            if (idx >= 0) shared = true;
            next = step(world, next, { ...none, choose: idx >= 0 ? idx : 0 }).state;
          } else {
            next = step(world, next, { ...none, confirm: i % 2 === 0 }).state;
          }
        }
        return { state: next, shared, lines };
      };
      let res = runShare(state);
      if (!res.shared) {
        state = { ...res.state, snacks: 2, coins: 10 };
        res = runShare(state);
      }
      expect(res.shared, knot).toBe(true);
      expect(res.state.snacks, knot).toBe(1);
      expect(res.state.coins, knot).toBe(18);

      // Revisit: cannot share a second time.
      const again = runShare(res.state);
      expect(again.shared, `${knot} repeat`).toBe(false);
      expect(again.state.snacks, `${knot} repeat snacks`).toBe(1);
    }
  });

  it("never mentions Milo in new NPC knots or profiles before hooded-kid is calmed", () => {
    const newKnots = [
      "npc_flora", "npc_sammy_plaza", "npc_sammy_arcade", "npc_pippa",
      "npc_leo_hall", "npc_leo_field", "npc_maya_field", "npc_maya_art",
      "npc_sal", "npc_nora", "npc_lark", "npc_mina", "npc_otis",
      "npc_pebble", "npc_moss", "npc_sunny",
      "npc_gus", "npc_hazel", "npc_bram", "npc_wren", "npc_tuck", "npc_kai",
      "npc_sage", "npc_poppy", "npc_clara", "npc_bramble", "npc_gemma",
      "npc_bert", "npc_theo",
    ];
    const base = makeState("plaza", "front-door", {
      read_notice: true, saw_hood: true, recess: true, art_open: true,
      clubhouse_claimed: true, lodge_open: true, cavern_bridge_lit: true,
    }, ["maddie", "sue", "jordan"]);
    const facts = inkFacts(world, { ...base, lantern: true });

    for (const knot of newKnots) {
      // Walk opening lines and every choice branch on a state where hooded-kid is NOT calmed.
      let result = runInk(world.story, base.ink, { type: "start", knot }, facts);
      const visited: string[] = [];
      for (let count = 0; count < 20; count += 1) {
        if (result.line !== null) visited.push(result.line.text);
        if (result.choices.length > 0) {
          for (let c = 0; c < result.choices.length; c += 1) {
            let branch = runInk(world.story, result.ink, { type: "choose", index: c }, facts);
            for (let stepCount = 0; stepCount < 10; stepCount += 1) {
              if (branch.line !== null) visited.push(branch.line.text);
              if (branch.ended || branch.choices.length > 0) break;
              branch = runInk(world.story, branch.ink, { type: "next" }, facts);
            }
          }
          break;
        }
        if (result.ended) break;
        result = runInk(world.story, result.ink, { type: "next" }, facts);
      }
      expect(visited.length, knot).toBeGreaterThan(0);
      for (const line of visited) {
        expect(line, `${knot} spoiled Milo early`).not.toMatch(/\bmilo\b/i);
      }
    }

    for (const profile of Object.values(world.npcProfiles)) {
      for (const rule of profile.rules) {
        if (rule.when?.calmed !== "hooded-kid") {
          expect(rule.text, `${profile.id}/${rule.id}`).not.toMatch(/\bmilo\b/i);
        }
      }
    }
    for (const pair of world.npcBanter) {
      if (pair.when?.calmed !== "hooded-kid") {
        for (const line of pair.lines) {
          expect(line, pair.id).not.toMatch(/\bmilo\b/i);
        }
      }
    }
  });
});

describe("Living NPC deterministic brain (npc-context)", () => {
  it("derives all ten story stages in priority order", () => {
    const base = makeState("plaza", "front-door");
    const stageWith = (vars: Record<string, boolean>, calmedHood = false, calmedFrog = false) => {
      const critters: State["critters"] = { ...base.critters };
      if (calmedFrog) critters["fountain-frog"] = "calm";
      if (calmedHood) critters["hooded-kid"] = "calm";
      const state: State = {
        ...base,
        ink: setInkVariables(base.ink, vars),
        critters,
      };
      return npcWorldSituation(world, state).storyStage;
    };
    expect(stageWith({})).toBe("morning");
    expect(stageWith({ read_notice: true })).toBe("fountain_chaos");
    expect(stageWith({ read_notice: true }, false, true)).toBe("park_trail");
    expect(stageWith({ hall_pass: true }, false, true)).toBe("school_mystery");
    expect(stageWith({ sue_joined: true }, false, true)).toBe("bay_pass");
    expect(stageWith({ clubhouse_claimed: true }, false, true)).toBe("clubhouse");
    expect(stageWith({ recess: true, clubhouse_claimed: true }, false, true)).toBe("recess");
    expect(stageWith({ seal_open: true, recess: true }, false, true)).toBe("finale_ready");
    expect(stageWith({ forest_fizzy: false, seal_open: true }, true, true)).toBe("forest_calm");
    expect(stageWith({ awake: true, forest_fizzy: false }, true, true)).toBe("awake");
  });

  it("matches every NpcCondition field accurately", () => {
    const flora = findNpc("plaza", "flora");
    const base = makeState(
      "plaza",
      "front-door",
      { garden_ripe: true, gem_park: true, gem_bay: true },
      ["maddie", "ribbon-bunny"],
    );
    const state: State = {
      ...base,
      tick: 200,
      lantern: true,
      stickers: ["fountain-frog", "pond-pup", "bay-bluebird"],
      treats: { "orchard-apple": 2 },
      critters: {
        ...base.critters,
        "fountain-frog": "calm",
        "arcade-keeper": "calm",
        lifeguard: "calm",
      },
    };
    const situation = npcWorldSituation(world, state);
    expect(situation.bossesCalmedCount).toBe(2);
    expect(situation.carryingTreats).toBe(true);
    expect(situation.hasLantern).toBe(false);
    expect(situation.hasFlute).toBe(false);
    expect(situation.hasLasso).toBe(false);
    const withTools = npcWorldSituation(world, {
      ...state,
      ink: setInkVariables(state.ink, { has_lantern: true, has_flute: true, has_lasso: true }),
    });
    expect(withTools.hasLantern).toBe(true);
    expect(withTools.hasFlute).toBe(true);
    expect(withTools.hasLasso).toBe(true);
    const mem: NpcLifeMemory = {
      ...settledMemory,
      lastCalmedTick: 180,
      lastFluteTick: 150,
    };

    expect(matchesNpcCondition(world, state, situation, flora, mem, {
      variable: "garden_ripe",
      notVariable: "awake",
      calmed: "fountain-frog",
      notCalmed: "hooded-kid",
      withParty: "ribbon-bunny",
      lanternOn: true,
      areaCalm: true,
      chaosNearby: false,
      justCalmed: true,
      recentFlute: true,
      hasTreats: true,
      minStickers: 3,
      minGems: 2,
      minBossesCalmed: 2,
      storyStage: "park_trail",
    })).toBe(true);

    expect(matchesNpcCondition(world, state, situation, flora, mem, { minStickers: 4 }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, mem, { minGems: 3 }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, mem, { minBossesCalmed: 3 }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, mem, { hasTreats: false }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, mem, { storyStage: "awake" }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, settledMemory, { justCalmed: true }))
      .toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, settledMemory, {
      recentFlute: true,
    })).toBe(false);
    expect(matchesNpcCondition(world, state, situation, flora, {
      ...settledMemory,
      lastFluteTick: 10,
    }, { recentFlute: true })).toBe(false);
  });

  it("skips harness and bus-stop and preserves arrival facing grace", () => {
    const harnessState = makeState("harness", "start");
    const harnessLife = evaluateNpcLife(world, harnessState, settledMemory);
    expect(harnessLife.npcs).toEqual([]);
    expect(harnessLife.chatter).toBeNull();

    const kitchenState = makeState("kitchen", "stairs");
    const arrivalLife = evaluateNpcLife(world, kitchenState, {
      ...settledMemory,
      areaTicks: 20,
    });
    expect(arrivalLife.npcs.find((entry) => entry.id === "mom")?.facing).toBe("down");
    expect(arrivalLife.chatter).toBeNull();

    const plazaState = makeState("plaza", "front-door");
    const plazaLife = evaluateNpcLife(world, plazaState, settledMemory);
    expect(plazaLife.npcs.some((entry) => entry.id === "bus-stop")).toBe(false);
    expect(plazaLife.npcs.some((entry) => entry.id === "flora")).toBe(true);
  });

  it("prioritizes lantern-awe, chaos-worry, companion-greet, player-greet, and banter", () => {
    const flora = findNpc("plaza", "flora");
    const base = makeState("plaza", "front-door", undefined, ["maddie", "ribbon-bunny"]);
    const nearFlora: State = {
      ...base,
      tick: 24,
      player: { x: flora.point.x, y: flora.point.y + 70 },
      critters: { ...base.critters, "fountain-frog": "calm" },
    };

    // Lantern-awe overrides everything outside dialogue.
    const lanternLife = evaluateNpcLife(
      world, { ...nearFlora, lantern: true }, settledMemory,
    );
    expect(lanternLife.npcs.find((n) => n.id === "flora")?.attention).toBe("lantern-awe");
    expect(lanternLife.chatter?.tone).toBe("lantern");
    expect(lanternLife.chatter?.npcId).toBe("flora");

    // Companion greet with Ribbon Bunny in party.
    const companionLife = evaluateNpcLife(world, nearFlora, settledMemory);
    expect(companionLife.npcs.find((n) => n.id === "flora")?.attention).toBe("companion-greet");
    expect(companionLife.chatter?.tone).toBe("warm");

    // Just-calmed reaction beats companion/ambient rules.
    const justCalmedLife = evaluateNpcLife(
      world,
      { ...nearFlora, tick: 210 },
      { ...settledMemory, lastCalmedTick: 200 },
    );
    expect(justCalmedLife.chatter?.npcId).toBe("flora");
    expect(justCalmedLife.chatter?.text).toBe("The flowers perked right back up, Fae!");

    // Banter alternates speakers over the 360-tick cycle in cafe.
    const cafeBase = makeState("cafe", "door");
    const cafeNearDad: State = { ...cafeBase, player: { x: 520, y: 660 }, tick: 30 };
    const beat0 = evaluateNpcLife(world, cafeNearDad, settledMemory);
    expect(beat0.chatter?.tone).toBe("banter");
    expect(beat0.chatter?.npcId).toBe("dad");

    const pauseBeat = evaluateNpcLife(world, { ...cafeNearDad, tick: 120 }, settledMemory);
    expect(pauseBeat.chatter).toBeNull();

    const beat1 = evaluateNpcLife(world, { ...cafeNearDad, tick: 160 }, settledMemory);
    expect(beat1.chatter?.tone).toBe("banter");
    expect(beat1.chatter?.npcId).toBe("barnaby");

    // Suppresses chatter during dialogue.
    const talking = startDialogue(world, cafeNearDad, "dad");
    const talkingLife = evaluateNpcLife(world, talking, settledMemory);
    expect(talkingLife.chatter).toBeNull();
    expect(talkingLife.npcs.find((n) => n.id === "dad")?.attention).toBe("dialogue");
  });

  it("handles recentFlute music-delight priority, arrival bypass, and social-chat listener emote",
    () => {
      const bram = findNpc("hills", "bram");
      const sunny = findNpc("hills", "sunny");
      const base = makeState("hills", "park", undefined, ["maddie", "ribbon-bunny"]);
      const calmHills: State = {
        ...base,
        tick: 120,
        player: { x: bram.point.x + 120, y: bram.point.y },
        wild: [],
      };

      // Recent flute triggers music-delight attention & music chatter even during arrival grace.
      const arrivalFlute = evaluateNpcLife(world, calmHills, {
        ...settledMemory,
        areaTicks: 10,
        lastFluteTick: 100,
      });
      const bramLife = arrivalFlute.npcs.find((entry) => entry.id === "bram");
      expect(bramLife?.attention).toBe("music-delight");
      expect(bramLife?.emote).toBe("note");
      expect(arrivalFlute.chatter?.npcId).toBe("bram");
      expect(arrivalFlute.chatter?.tone).toBe("music");

      // Lantern still beats music-delight; justCalmed beats music-delight in chatter.
      const lanternAndFlute = evaluateNpcLife(
        world,
        { ...calmHills, lantern: true },
        { ...settledMemory, lastFluteTick: 100 },
      );
      expect(lanternAndFlute.npcs.find((entry) => entry.id === "bram")?.attention)
        .toBe("lantern-awe");
      expect(lanternAndFlute.chatter?.tone).toBe("lantern");

      const calmedAndFlute = evaluateNpcLife(
        world,
        calmHills,
        { ...settledMemory, lastCalmedTick: 110, lastFluteTick: 100 },
      );
      expect(calmedAndFlute.chatter?.tone).toBe("warm");

      // Social-chat gives both speaker and listening partner facing + gentle listener emote.
      const midX = (bram.point.x + sunny.point.x) / 2;
      const midY = (bram.point.y + sunny.point.y) / 2;
      const banterWatch: State = {
        ...base,
        tick: 30,
        player: { x: midX, y: midY + 230 },
        wild: [],
      };
      const banterLife = evaluateNpcLife(world, banterWatch, settledMemory);
      const sunnyEntry = banterLife.npcs.find((entry) => entry.id === "sunny");
      const bramEntry = banterLife.npcs.find((entry) => entry.id === "bram");
      expect(banterLife.chatter?.tone).toBe("banter");
      expect(banterLife.chatter?.npcId).toBe("sunny");
      expect(sunnyEntry?.attention).toBe("social-chat");
      expect(bramEntry?.attention).toBe("social-chat");
      expect(sunnyEntry?.facing).toBe("left");
      expect(bramEntry?.facing).toBe("right");
      expect(bramEntry?.emote).toBe("note");
    });

  it("applies staggered reaction ripples and celebrate attention priority", () => {
    expect(reactionRippleTicks(0)).toBe(0);
    expect(reactionRippleTicks(44)).toBe(2);
    expect(reactionRippleTicks(220)).toBe(10);
    expect(reactionRippleTicks(600)).toBe(18);

    const flora = findNpc("plaza", "flora");
    const gus = findNpc("plaza", "gus");
    const base = makeState("plaza", "front-door");
    // Place Fae right next to Flora (gap = 20, ripple = 0) and further from Gus (within 235u).
    const gusGap = Math.hypot(flora.point.x - gus.point.x, flora.point.y + 20 - gus.point.y);
    expect(gusGap).toBeGreaterThan(80);
    const plazaNearFlora: State = {
      ...base,
      tick: 300,
      lantern: true,
      player: { x: flora.point.x, y: flora.point.y + 20 },
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    const atRipple0 = evaluateNpcLife(world, plazaNearFlora, {
      ...settledMemory,
      lanternOnTick: 300,
    });
    expect(atRipple0.npcs.find((n) => n.id === "flora")?.attention).toBe("lantern-awe");

    // Check distance ripple using an NPC 150u away (ripple = 6 ticks).
    const farFlora: State = {
      ...base,
      tick: 302,
      lantern: true,
      player: { x: flora.point.x, y: flora.point.y + 150 },
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    const beforeRipple = evaluateNpcLife(world, farFlora, {
      ...settledMemory,
      lanternOnTick: 300,
    });
    expect(beforeRipple.npcs.find((n) => n.id === "flora")?.attention).not.toBe("lantern-awe");
    const afterRipple = evaluateNpcLife(world, { ...farFlora, tick: 307 }, {
      ...settledMemory,
      lanternOnTick: 300,
    });
    expect(afterRipple.npcs.find((n) => n.id === "flora")?.attention).toBe("lantern-awe");

    // Celebrate attention beats music-delight after ripple and faces Fae with heart/sparkle.
    const celebrateState: State = {
      ...base,
      tick: 320,
      lantern: false,
      player: { x: flora.point.x, y: flora.point.y + 110 },
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    const celebLife = evaluateNpcLife(world, celebrateState, {
      ...settledMemory,
      lastCalmedTick: 310,
      lastFluteTick: 305,
    });
    const floraCeleb = celebLife.npcs.find((n) => n.id === "flora");
    expect(floraCeleb?.attention).toBe("celebrate");
    expect(floraCeleb?.facing).toBe("down");
    expect(floraCeleb?.emote === "heart" || floraCeleb?.emote === "sparkle").toBe(true);
  });

  it("verifies all 26 banter pairs and foodie treats ambient notices", () => {
    expect(world.npcBanter.length).toBe(26);
    const wave2And3Banter = [
      "plaza-flora-gus",
      "park-pippa-hazel",
      "bay-sal-kai",
      "pass-mina-tuck",
      "woods-moss-wren",
      "hills-sunny-bram",
      "arcade-sammy-poppy",
      "lodge-otis-clara",
      "trail-lark-bramble-gull",
      "trail-lark-bramble-calm",
      "cavern-pebble-gemma",
      "east-hall-bert-leo",
      "art-room-maya-theo",
    ];
    for (const id of wave2And3Banter) {
      const pair = world.npcBanter.find((item) => item.id === id);
      expect(pair, id).toBeDefined();
      for (const line of pair?.lines ?? []) {
        expect(line.length, `${id}: ${line}`).toBeLessThanOrEqual(44);
      }
    }

    // Carrying treats triggers Gus's cozy foodie notice with warm tone.
    const gus = findNpc("plaza", "gus");
    const base = makeState("plaza", "front-door");
    const nearGus: State = {
      ...base,
      tick: 300,
      player: { x: gus.point.x + 80, y: gus.point.y },
      treats: { "orchard-apple": 1 },
      critters: { ...base.critters, "fountain-frog": "calm" },
    };
    const gusLife = evaluateNpcLife(world, nearGus, settledMemory);
    expect(gusLife.chatter?.npcId).toBe("gus");
    expect(gusLife.chatter?.tone).toBe("warm");
    expect(gusLife.chatter?.text).toContain("treats");
  });

  it("validates npc-profiles and schedule errors in loader", () => {
    const initialInk = makeState("plaza", "front-door").ink;
    const readVar = (name: string) => world.storyVariable(initialInk, name);
    expect(npcScheduleErrors(world.areas, world.critters, readVar)).toEqual([]);

    expect(() => parseNpcProfiles(
      {
        profiles: [{
          id: "unknown-person", name: "Ghost", adult: true, personality: "cozy",
          greetRange: 140, lookAroundTicks: 180, favoriteParty: [], rules: [],
        }],
        banter: [],
      },
      world.characters, world.areas, world.critters, world.party, readVar, "test.json",
    )).toThrow(/test\.json/);

    expect(() => parseNpcProfiles(
      {
        profiles: [{
          id: "flora", name: "Flora", adult: true, personality: "gardener",
          greetRange: 140, lookAroundTicks: 180, favoriteParty: [],
          rules: [{
            id: "bad-var", text: "Hi!", priority: 1,
            when: { variable: "not_a_real_ink_var" },
          }],
        }],
        banter: [],
      },
      world.characters, world.areas, world.critters, world.party, readVar, "test.json",
    )).toThrow(/not_a_real_ink_var/);
    expect(() => parseNpcProfiles(
      {
        profiles: [{
          id: "flora", name: "Flora", adult: true, personality: "gardener",
          greetRange: 140, lookAroundTicks: 180, favoriteParty: [],
          rules: [{
            id: "bad-boss-count", text: "Hi!", priority: 1,
            when: { minBossesCalmed: -1 },
          }],
        }],
        banter: [],
      },
      world.characters, world.areas, world.critters, world.party, readVar, "test.json",
    )).toThrow(/minBossesCalmed/);
  });
});

describe("Living NPC presentation craft (voices, portraits, motion, emotes, chatter)", () => {
  it("gives all 26 new NPCs distinct non-fallback voices, portraits, and speaker accents", () => {
    const fallback = voiceForSpeaker("totally-unknown-character");
    type AdultSpec = { id: string; speakers: readonly string[]; accent: "town" | "school" };
    const adults: readonly AdultSpec[] = [
        { id: "flora", speakers: ["Flora"], accent: "town" },
        { id: "sal", speakers: ["Captain Sal", "Sal"], accent: "town" },
        { id: "lark", speakers: ["Hiker Lark", "Lark"], accent: "town" },
        { id: "mina", speakers: ["Mina"], accent: "town" },
        { id: "otis", speakers: ["Otis"], accent: "town" },
        { id: "pebble", speakers: ["Professor Pebble", "Pebble"], accent: "town" },
        { id: "moss", speakers: ["Ranger Moss", "Moss"], accent: "town" },
        { id: "gus", speakers: ["Mailman Gus", "Gus"], accent: "town" },
        { id: "hazel", speakers: ["Grandma Hazel", "Hazel"], accent: "town" },
        { id: "bram", speakers: ["Bram"], accent: "town" },
        { id: "sage", speakers: ["Star-Watcher Sage", "Sage"], accent: "town" },
        { id: "clara", speakers: ["Clara"], accent: "town" },
        { id: "bramble", speakers: ["Bramble"], accent: "town" },
        { id: "bert", speakers: ["Custodian Bert", "Bert"], accent: "school" },
      ];
    const kids = [
      { id: "sammy", speakers: ["Sammy"] },
      { id: "pippa", speakers: ["Pippa"] },
      { id: "leo", speakers: ["Leo"] },
      { id: "maya", speakers: ["Maya"] },
      { id: "nora", speakers: ["Nora"] },
      { id: "sunny", speakers: ["Sunny"] },
      { id: "wren", speakers: ["Wren"] },
      { id: "tuck", speakers: ["Tuck"] },
      { id: "kai", speakers: ["Kai"] },
      { id: "poppy", speakers: ["Poppy"] },
      { id: "gemma", speakers: ["Gemma"] },
      { id: "theo", speakers: ["Theo"] },
    ];

    const voiceSignatures = new Set<string>();
    for (const entry of adults) {
      const primary = voiceForSpeaker(entry.speakers[0] ?? entry.id);
      expect(primary, entry.id).not.toBe(fallback);
      voiceSignatures.add(JSON.stringify(primary));
      for (const name of entry.speakers) {
        expect(voiceForSpeaker(name), name).toEqual(primary);
        expect(speakerAccent(name), name).toBe(entry.accent);
        const portrait = speakerPortraitSource(world, name);
        expect(portrait, name).not.toBeNull();
        expect(portrait?.cropMode, name).toBe("adult");
        expect(portrait?.atlas, name).toBe(world.characters[entry.id]?.atlas);
      }
    }

    for (const entry of kids) {
      const primary = voiceForSpeaker(entry.speakers[0] ?? entry.id);
      expect(primary, entry.id).not.toBe(fallback);
      voiceSignatures.add(JSON.stringify(primary));
      for (const name of entry.speakers) {
        expect(voiceForSpeaker(name), name).toEqual(primary);
        expect(speakerAccent(name), name).toBe("friend");
        const portrait = speakerPortraitSource(world, name);
        expect(portrait, name).not.toBeNull();
        expect(portrait?.cropMode, name).toBe("kid");
        expect(portrait?.atlas, name).toBe(world.characters[entry.id]?.atlas);
      }
    }
    expect(voiceSignatures.size).toBe(26);
  });

  it("computes bounded deterministic npcLivingPose across all personalities and attentions", () => {
    const personalities: readonly NpcPersonality[] = [
      "gardener", "sailor", "naturalist", "cozy", "scholar", "ranger",
      "kid-bouncy", "artist", "shepherd", "chef", "teacher", "family", "fairy", "mystic",
    ];
    const attentions: readonly NpcAttention[] = [
      "lantern-awe", "celebrate", "music-delight", "chaos-worry", "player-greet",
      "companion-greet", "social-chat", "dialogue", "idle",
    ];

    for (const personality of personalities) {
      for (const attention of attentions) {
        for (const age of [4, 10, 32]) {
          const poseA = npcLivingPose(personality, attention, 130, 2, age);
          const poseB = npcLivingPose(personality, attention, 130, 2, age);
          expect(poseA).toEqual(poseB);
          expect(Math.abs(poseA.offsetX)).toBeLessThanOrEqual(2.5);
          expect(poseA.offsetY).toBeLessThanOrEqual(0.5);
          expect(poseA.offsetY).toBeGreaterThanOrEqual(-10);
          expect(poseA.scaleX).toBeGreaterThanOrEqual(0.95);
          expect(poseA.scaleX).toBeLessThanOrEqual(1.05);
          expect(poseA.scaleY).toBeGreaterThanOrEqual(0.95);
          expect(poseA.scaleY).toBeLessThanOrEqual(1.06);
          expect(Math.abs(poseA.rotation)).toBeLessThanOrEqual(0.08);
        }
      }
    }

    // Specific lively signatures: greet hop, lantern perk, celebrate, mystic float, turn squash.
    const greetHop = npcLivingPose("gardener", "player-greet", 60, 0, 8);
    expect(greetHop.offsetY).toBeLessThan(-4);
    const lanternPerk = npcLivingPose("scholar", "lantern-awe", 60, 0, 5);
    expect(lanternPerk.offsetY).toBeLessThan(-3);
    const celebrateHop = npcLivingPose("cozy", "celebrate", 60, 0, 6);
    expect(celebrateHop.offsetY).toBeLessThan(-5);
    const musicBeat = npcLivingPose("artist", "music-delight", 14, 0, 20);
    expect(musicBeat.offsetY).toBeLessThan(-4);
    expect(Math.abs(musicBeat.rotation)).toBeGreaterThan(0.03);
    const worry = npcLivingPose("cozy", "chaos-worry", 75, 1, 10);
    expect(worry.scaleY).toBeLessThan(1);
    expect(worry.scaleX).toBeGreaterThan(1);
    const kidBounce = npcLivingPose("kid-bouncy", "idle", 7, 0, 0);
    expect(kidBounce.offsetY).toBeLessThan(-3);
    const mysticFloat = npcLivingPose("mystic", "idle", 40, 0, 0);
    expect(mysticFloat.offsetY).toBeLessThan(-0.5);

    // 6-tick Paper-Mario turn-squash pulse when turnAge < 6.
    const turnStart = npcLivingPose("cozy", "idle", 0, 0, 0, 0);
    const turnRebound = npcLivingPose("cozy", "idle", 0, 0, 0, 2);
    const turnSettled = npcLivingPose("cozy", "idle", 0, 0, 0, 6);
    const turnDefault = npcLivingPose("cozy", "idle", 0, 0, 0);
    expect(turnStart.scaleX).toBeLessThan(0.96);
    expect(turnStart.scaleY).toBeGreaterThan(1.01);
    expect(turnRebound.scaleX).toBeGreaterThan(1.005);
    expect(turnSettled).toEqual(turnDefault);
  });

  it("projects all five NPC emote kinds and enforces distance and dialogue/harness guards", () => {
    const kinds: readonly NpcEmoteKind[] = ["sparkle", "wave", "worry", "note", "heart"];
    const npcEmotes = kinds.map((kind, index) => ({
      id: `npc-${kind}`,
      x: 400 + index * 30,
      y: 400,
      height: 120,
      kind,
      index,
    }));

    const shown = evaluateOverworldEmotes({
      areaId: "plaza",
      tick: 90,
      player: { x: 420, y: 420 },
      dialogueOpen: false,
      roamers: [],
      calmedCritters: [],
      nappingMembers: [],
      npcEmotes,
    });
    expect(shown.map((item) => item.texture)).toEqual([
      "emoteSparkle",
      "emoteWave",
      "emoteWorry",
      "emoteNote",
      "emoteHeart",
    ]);

    const far = evaluateOverworldEmotes({
      areaId: "plaza",
      tick: 90,
      player: { x: 1200, y: 420 },
      dialogueOpen: false,
      roamers: [],
      calmedCritters: [],
      nappingMembers: [],
      npcEmotes,
    });
    expect(far).toEqual([]);

    const duringDialogue = evaluateOverworldEmotes({
      areaId: "plaza",
      tick: 90,
      player: { x: 420, y: 420 },
      dialogueOpen: true,
      roamers: [],
      calmedCritters: [],
      nappingMembers: [],
      npcEmotes,
    });
    expect(duringDialogue).toEqual([]);

    const inHarness = evaluateOverworldEmotes({
      areaId: "harness",
      tick: 90,
      player: { x: 420, y: 420 },
      dialogueOpen: false,
      roamers: [],
      calmedCritters: [],
      nappingMembers: [],
      npcEmotes,
    });
    expect(inHarness).toEqual([]);
  });

  it("clamps chatter bubbles and flips side placement near the top viewport edge", () => {
    const desktopInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    const centered = clampChatterPosition(640, 320, 220, 64, 1280, 720, desktopInsets);
    expect(centered).toEqual({ x: 640, y: 320, tailOffset: 0, placement: "top" });

    // Left edge with headroom above stays top-placed and shifts tail toward speaker.
    const leftMid = clampChatterPosition(20, 320, 220, 64, 1280, 720, desktopInsets);
    expect(leftMid.placement).toBe("top");
    expect(leftMid.x - 110).toBeGreaterThanOrEqual(12);
    expect(leftMid.tailOffset).toBe(-90);

    // Top-left NPC near viewport ceiling flips neatly to the right of their head.
    const topLeft = clampChatterPosition(120, 30, 220, 64, 1280, 720, desktopInsets);
    expect(topLeft.placement).toBe("right");
    expect(topLeft.x - 110).toBeGreaterThanOrEqual(120 + 34);
    expect(topLeft.y - 32).toBeGreaterThanOrEqual(12);
    expect(topLeft.tailOffset).toBe(0);

    // Top-right NPC near viewport ceiling flips neatly to the left of their head.
    const topRight = clampChatterPosition(1180, 30, 220, 64, 1280, 720, desktopInsets);
    expect(topRight.placement).toBe("left");
    expect(topRight.x + 110).toBeLessThanOrEqual(1180 - 34);
    expect(topRight.x - 110).toBeGreaterThanOrEqual(12);
    expect(topRight.y - 32).toBeGreaterThanOrEqual(12);

    const rightEdge = clampChatterPosition(1270, 718, 220, 64, 1280, 720, desktopInsets);
    expect(rightEdge.placement).toBe("top");
    expect(rightEdge.x + 110).toBeLessThanOrEqual(1280 - 12);
    expect(rightEdge.y).toBeLessThanOrEqual(720 - 18);
    expect(rightEdge.tailOffset).toBe(90);

    // Narrow 874x402 phone with notched safe-area insets.
    const phoneInsets = { top: 10, right: 44, bottom: 21, left: 44 };
    const phoneTopLeft = clampChatterPosition(50, 40, 210, 60, 874, 402, phoneInsets);
    expect(phoneTopLeft.placement).toBe("right");
    expect(phoneTopLeft.x - 105).toBeGreaterThanOrEqual(phoneInsets.left + 12);
    expect(phoneTopLeft.x + 105).toBeLessThanOrEqual(874 - phoneInsets.right - 12);
    expect(phoneTopLeft.y - 30).toBeGreaterThanOrEqual(phoneInsets.top + 12);

    const phoneRight = clampChatterPosition(860, 395, 210, 60, 874, 402, phoneInsets);
    expect(phoneRight.placement).toBe("top");
    expect(phoneRight.x + 105).toBeLessThanOrEqual(874 - phoneInsets.right - 12);
    expect(phoneRight.y).toBeLessThanOrEqual(402 - phoneInsets.bottom - 18);
    expect(Math.abs(phoneRight.tailOffset)).toBeLessThanOrEqual(105 - 20);
  });

  it("excludes sanctuary-* critters from evaluateNpcLife while keeping Ranger Fern alive", () => {
    const state = createState(
      world,
      { area: "sanctuary", spawn: "entrance", calms: { frog: 1, pup: 1, bunny: 1 } },
    );
    const snap = evaluateNpcLife(world, state, {
      areaTicks: 120,
      lastCalmedTick: null,
      lastTalkNpcId: null,
      lastTalkTick: null,
    });
    expect(snap.npcs.some((entry) => entry.id === "fern")).toBe(true);
    expect(snap.npcs.some((entry) => entry.id.startsWith("sanctuary-"))).toBe(false);
  });

  it("keeps NPC emotes steady (zero bob/tilt) under reducedMotion parity", () => {
    const emotes = evaluateOverworldEmotes({
      areaId: "plaza",
      tick: 37,
      player: { x: 475, y: 450 },
      dialogueOpen: false,
      roamers: [],
      calmedCritters: [],
      nappingMembers: [],
      npcEmotes: [
        { id: "flora", x: 475, y: 410, height: 174, kind: "worry", index: 0 },
      ],
      reducedMotion: true,
    });
    expect(emotes).toHaveLength(1);
    expect(emotes[0]?.texture).toBe("emoteWorry");
    expect(emotes[0]?.y).toBe(410 - 174 - 16);
    expect(emotes[0]?.scale).toBe(0.78);
    expect(emotes[0]?.rotation).toBe(0);
  });
});
