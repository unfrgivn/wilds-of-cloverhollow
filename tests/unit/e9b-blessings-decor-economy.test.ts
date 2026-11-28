import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, parseTreatBaskets, storyTagErrors } from "../../src/content/load";
import {
  activeBlessingEffects,
  activeClubhouseSwatch,
  activeClubhouseVisitor,
  applyBlessingCheckSpec,
  applyCalmSparkleBonus,
  availableFishToTrade,
  bedroomShelfCapacity,
  blankInput,
  blessingEffectsFromIds,
  CLUBHOUSE_SWATCH_IDS,
  CLUBHOUSE_SWATCHES,
  CLUBHOUSE_VISITORS,
  clubhouseVisitorNpc,
  createState,
  cycleClubhouseVisitor,
  effectiveAreaNpcs,
  effectiveWalkSpeed,
  eligibleClubhouseVisitors,
  equipClubhouseSwatch,
  exchangeCoinsForTickets,
  fishBiteTicksWithBlessing,
  hasPlushPedestals,
  isSwatchUnlocked,
  KEEPSAKE_BLESSING_IDS,
  normalizeDecor,
  openArcade,
  parseSave,
  plushPedestalPrice,
  purchaseTreatBasket,
  resetBedroomShelfPrizes,
  resolvedBedroomShelfPrizes,
  serializeSave,
  setInkVariables,
  stableHash,
  startDialogue,
  step,
  swatchPriceFor,
  targetInteractable,
  toggleBedroomShelfPrize,
  totalCaughtFishCount,
  tradeFishCatch,
  unlockClubhouseSwatch,
  unlockPlushPedestals,
  withDecor,
  type ActionFrame,
  type Battle,
  type CheckSpec,
  type ClubhouseSwatchId,
  type Fixture,
  type State,
  type TacoTopping,
} from "../../src/core";
import { importErrors, stripComments, stripStringLiterals } from "../../tools/purity";

const content = loadContent();
const { world } = content;
const none: ActionFrame = blankInput();
const confirmFrame: ActionFrame = { ...none, confirm: true };

function fixtureOf(name: string): Fixture {
  const fixture = content.fixtures[name];
  if (fixture === undefined) throw new Error(`missing fixture ${name}`);
  return fixture;
}

function withVars(state: State, vars: Record<string, boolean>): State {
  return { ...state, ink: setInkVariables(state.ink, vars) };
}

function press(state: State, key: "confirm" | "cancel" = "confirm"): State {
  const down = step(world, state, { ...none, [key]: true }).state;
  return step(world, down, none).state;
}

function runDialogue(
  start: State,
  knot: string,
  choices: readonly number[] = [],
): { state: State; lines: string[]; offered: string[][]; events: string[] } {
  let state = startDialogue(world, start, knot);
  const lines: string[] = [];
  const offered: string[][] = [];
  const events: string[] = [];
  let cursor = 0;
  for (let guard = 0; guard < 80 && state.dialogue !== null; guard += 1) {
    const dialogue = state.dialogue;
    if (dialogue.revealed < dialogue.text.length) {
      const res = step(world, state, confirmFrame);
      for (const ev of res.events) events.push(ev.type);
      state = step(world, res.state, none).state;
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (dialogue.choices.length > 0) {
      offered.push([...dialogue.choices]);
      const pick = choices[cursor] ?? dialogue.choices.length - 1;
      cursor += 1;
      const res = step(world, state, { ...none, choose: pick });
      for (const ev of res.events) events.push(ev.type);
      state = res.state;
      continue;
    }
    const res = step(world, state, confirmFrame);
    for (const ev of res.events) events.push(ev.type);
    state = step(world, res.state, none).state;
  }
  expect(state.dialogue).toBeNull();
  return { state, lines, offered, events };
}

function makeBattleState(
  critterId: string,
  overrides: Partial<State> = {},
  battleOverrides: Partial<Battle> = {},
): State {
  const critter = world.critters[critterId];
  if (critter === undefined) throw new Error(`missing critter ${critterId}`);
  const base = createState(world, fixtureOf("plaza"));
  const battle: Battle = {
    critterId,
    den: null,
    entry: base.player,
    phase: "command",
    message: critter.lines.command,
    revealed: critter.lines.command.length,
    selected: 0,
    command: null,
    energy: 2,
    calm: 0,
    rest: {},
    check: null,
    lastGrade: null,
    feelings: [],
    answered: false,
    lanternPeek: false,
    turn: 1,
    windUp: null,
    rewardSticker: null,
    phaseTicks: 0,
    ...battleOverrides,
  };
  return { ...base, ...overrides, battle };
}

describe("Track E9B (Step 1): All 13 Active Keepsake Dream Blessings", () => {
  const base = createState(world, fixtureOf("new-game"), 1);

  it("returns all-zero effects with zero keepsakes and exact values for all 13 combined", () => {
    const empty = blessingEffectsFromIds([]);
    expect(empty).toEqual({
      echoDemoBonusTicks: 0,
      echoInputBonusTicks: 0,
      arcadeTicketBonus: 0,
      calmSparkleBonus: 0,
      peekabooStealthGrace: 0,
      tacoTipCoins: 0,
      snackHealBonus: 0,
      fishBiteGrace: 0,
      leanStabilityBonus: 0,
      overworldSpeedBonus: 0,
      traceReachBonus: 0,
      glowVisibilityBonus: 0,
      roamNoticeGrace: 0,
      harmonyTimingBonus: 0,
      fluteAssistCalmBonus: 0,
      gardenGrowthBoost: 0,
      jubileeCoinBonus: 0,
    });
    expect(activeBlessingEffects(world, base)).toEqual(empty);

    const all = blessingEffectsFromIds(KEEPSAKE_BLESSING_IDS);
    expect(all).toEqual({
      echoDemoBonusTicks: 4,
      echoInputBonusTicks: 24,
      arcadeTicketBonus: 2,
      calmSparkleBonus: 0.05,
      peekabooStealthGrace: 0.15,
      tacoTipCoins: 1,
      snackHealBonus: 1,
      fishBiteGrace: 0.15,
      leanStabilityBonus: 1,
      overworldSpeedBonus: 0.08,
      traceReachBonus: 0.15,
      glowVisibilityBonus: 0.4,
      roamNoticeGrace: 0.15,
      harmonyTimingBonus: 1,
      fluteAssistCalmBonus: 4,
      gardenGrowthBoost: 1,
      jubileeCoinBonus: 1,
    });
  });

  it("modifies battle check specs per keepsake while preserving zero-keepsake identity", () => {
    const empty = blessingEffectsFromIds([]);
    const specs: CheckSpec[] = [
      { kind: "echo", notes: 3, demoTicks: 20, gapTicks: 8, inputTicks: 90 },
      {
        kind: "peekaboo",
        ticks: 240,
        goal: 80,
        warningTicks: 18,
        graceTicks: 4,
        peeks: [{ start: 60, end: 110 }],
      },
      { kind: "lean", puffTicks: 30, starts: [20, 70], forces: [4, 5], steer: 6, spring: 3 },
      {
        kind: "trace",
        dryTicks: 120,
        brushSpeed: 8,
        reachRadius: 40,
        paths: [{ id: "a", points: [{ x: 10, y: 10 }, { x: 90, y: 90 }] }],
      },
      { kind: "ring", ticks: 60, targetTick: 30, greatWindow: 4, goodWindow: 9 },
      {
        kind: "charge",
        waitTicks: 40,
        maxTicks: 60,
        targetTick: 35,
        greatWindow: 4,
        goodWindow: 8,
      },
      { kind: "chain", travelTicks: 24, hitWindow: 5, arrivals: [30, 60, 90], look: "star" },
      { kind: "catch", travelTicks: 24, arrivals: [30, 60], toys: ["ball"] },
    ];
    for (const spec of specs) {
      expect(applyBlessingCheckSpec(spec, empty)).toBe(spec);
    }

    const echoSpec = applyBlessingCheckSpec(specs[0]!, blessingEffectsFromIds(["star-crystal"]));
    expect(echoSpec).toMatchObject({ kind: "echo", demoTicks: 24, inputTicks: 114 });

    const peekSpec = applyBlessingCheckSpec(specs[1]!, blessingEffectsFromIds(["moon-feather"]));
    expect(peekSpec).toMatchObject({ kind: "peekaboo", warningTicks: 21, graceTicks: 5 });

    const leanSpec = applyBlessingCheckSpec(specs[2]!, blessingEffectsFromIds(["alpine-clover"]));
    expect(leanSpec).toMatchObject({ kind: "lean", steer: 7, spring: 4 });

    const traceSpec = applyBlessingCheckSpec(specs[3]!, blessingEffectsFromIds(["loft-sketch"]));
    expect(traceSpec).toMatchObject({ kind: "trace", reachRadius: 46, dryTicks: 132 });

    const shard = blessingEffectsFromIds(["shell-shard"]);
    expect(applyBlessingCheckSpec(specs[4]!, shard)).toMatchObject({
      kind: "ring",
      greatWindow: 5,
      goodWindow: 10,
    });
    expect(applyBlessingCheckSpec(specs[5]!, shard)).toMatchObject({
      kind: "charge",
      greatWindow: 5,
      goodWindow: 9,
    });
    expect(applyBlessingCheckSpec(specs[6]!, shard)).toMatchObject({
      kind: "chain",
      hitWindow: 6,
    });
  });

  it("applies calm sparkle, snack/treat/recover heal, flute assist, garden & jubilee coins", () => {
    expect(applyCalmSparkleBonus(30, 0)).toBe(30);
    expect(applyCalmSparkleBonus(30, 0.05)).toBe(32);
    expect(applyCalmSparkleBonus(10, 0.05)).toBe(11);

    // 1. Clover Wreath (+1 energy on plain snack, specialty treat, and recover).
    const plainNormal = press(makeBattleState("fountain-frog", { snacks: 2 }, {
      selected: 2,
      energy: 1,
    }));
    const plainWreath = press(withVars(
      makeBattleState("fountain-frog", { snacks: 2 }, { selected: 2, energy: 1 }),
      { sanctuary_reward_14: true },
    ));
    expect(plainWreath.battle?.energy).toBe((plainNormal.battle?.energy ?? 0) + 1);

    const recoverNormal = press(makeBattleState("fountain-frog", {}, { selected: 1, energy: 1 }));
    const recoverWreath = press(withVars(
      makeBattleState("fountain-frog", {}, { selected: 1, energy: 1 }),
      { sanctuary_reward_14: true },
    ));
    expect(recoverNormal.battle?.energy).toBe(2);
    expect(recoverWreath.battle?.energy).toBe(3);

    const treatOpen = press(withVars(
      makeBattleState(
        "fountain-frog",
        { snacks: 0, treats: { "orchard-apple": 1 } },
        { selected: 2, energy: 1 },
      ),
      { sanctuary_reward_14: true },
    ));
    const treatUsed = step(world, treatOpen, { ...none, choose: 0 }).state;
    expect(treatUsed.battle?.energy).toBe(4);

    // 2. Shell Shard (+4 calm on Flute Friends battle assist).
    const fluteBase = withVars(
      makeBattleState("fountain-frog", {}, { calm: 0 }),
      { has_flute: true, pup_friend: true },
    );
    const fluteNormal = step(world, fluteBase, { ...none, flute: true }).state;
    const fluteBlessed = step(
      world,
      withVars(fluteBase, { island_shells_solved: true }),
      { ...none, flute: true },
    ).state;
    expect(fluteBlessed.battle?.calm).toBe((fluteNormal.battle?.calm ?? 0) + 4);

    // 3. Star Geode (+5% calm sparkle on landed Soothe check).
    const runSootheGreat = (geode: boolean): number => {
      let state = withVars(
        makeBattleState("fountain-frog", {}, { selected: 0, calm: 0 }),
        geode ? { gem_reward_all: true } : {},
      );
      state = press(state);
      const spec = state.battle?.check?.kind === "ring" ? state.battle.check.spec : null;
      if (spec === null) throw new Error("expected ring check");
      for (let tick = 1; tick < spec.targetTick; tick += 1) {
        state = step(world, state, none).state;
      }
      state = step(world, state, confirmFrame).state;
      return state.battle?.calm ?? 0;
    };
    expect(runSootheGreat(true)).toBeGreaterThan(runSootheGreat(false));

    // 4. Festival Ribbon (+1 jubilee coin and +1 clubhouse garden growth boost on calm).
    const calmReward = (ribbon: boolean): { state: State; rewardLine: string } => {
      let state = withVars(
        makeBattleState(
          "fountain-frog",
          { coins: 10, stickers: ["fountain-frog"] },
          {
            phase: "soothed",
            message: "Calm!",
            revealed: 5,
          },
        ),
        {
          garden_planted: true,
          ...(ribbon ? { festival_toast_done: true } : {}),
        },
      );
      state = press(state);
      expect(state.battle?.phase).toBe("reward");
      const rewardLine = state.battle?.message ?? "";
      // First press reveals reward line; second press collects reward & runs afterCalm.
      state = press(state);
      state = press(state);
      expect(state.battle).toBeNull();
      return { state, rewardLine };
    };
    const normalAfter = calmReward(false);
    const ribbonAfter = calmReward(true);
    const frogCoins = world.critters["fountain-frog"]?.coins ?? 0;
    expect(normalAfter.rewardLine).toContain(String(frogCoins));
    expect(ribbonAfter.rewardLine).toContain(String(frogCoins + 1));
    expect(normalAfter.state.coins).toBe(10 + frogCoins);
    expect(ribbonAfter.state.coins).toBe(10 + frogCoins + 1);
    expect(Number(world.storyVariable(normalAfter.state.ink, "garden_calms"))).toBe(1);
    expect(Number(world.storyVariable(ribbonAfter.state.ink, "garden_calms"))).toBe(2);
  });

  it("applies overworld speed, wild notice grace, fish bite grace, arcade tickets & taco tips",
    () => {
      // 1. Star Whistle (+8% walk speed).
      expect(effectiveWalkSpeed(240, 0)).toBe(240);
      expect(effectiveWalkSpeed(240, 0.08)).toBeCloseTo(259.2, 5);
      const plazaNormal = createState(world, fixtureOf("plaza"), 1);
      const plazaFast = withVars(plazaNormal, { buster_reward: true });
      const movedNormal = step(world, plazaNormal, { ...none, move: { x: 1, y: 0 } }).state;
      const movedFast = step(world, plazaFast, { ...none, move: { x: 1, y: 0 } }).state;
      expect(movedFast.player.x - plazaFast.player.x).toBeGreaterThan(
        movedNormal.player.x - plazaNormal.player.x,
      );

      // 2. Aurora Rubbing (+15% wild notice grace before chase).
      const parkState = createState(world, fixtureOf("park"), 1);
      const wildCritter = {
        kind: "pup",
        den: 0,
        mood: "chaos" as const,
        x: parkState.player.x + 120,
        y: parkState.player.y,
        home: { x: parkState.player.x + 120, y: parkState.player.y },
        target: { x: parkState.player.x + 120, y: parkState.player.y },
        pauseTicks: 20,
        cooldownTicks: 0,
        facing: "left" as const,
        moving: false,
        notice: world.tunables.roam.noticeTicks - 1,
      };
      const baseWithWild: State = { ...parkState, wild: [wildCritter] };
      const auroraWithWild = withVars(baseWithWild, { summit_aurora_read: true });
      const normalStep = step(world, baseWithWild, none).state;
      const auroraStep = step(world, auroraWithWild, none).state;
      // Without aurora, critter hits noticeTicks (45) and starts chasing toward Fae!
      expect(normalStep.wild[0]?.x).toBeLessThan(wildCritter.x);
      // With aurora, noticeTicks is 52, so at notice=45 it has not started chasing yet!
      expect(auroraStep.wild[0]?.x).toBe(wildCritter.x);

      // 3. Sea-Glass Compass (+15% fish bite window).
      expect(fishBiteTicksWithBlessing(48, 20, false, 0)).toBe(48);
      expect(fishBiteTicksWithBlessing(48, 20, false, 0.15)).toBe(55);
      const bayBase = createState(world, fixtureOf("bay"), 1);
      const makeBiteState = (compass: boolean): State => {
        const opened = openArcade(world, withVars(bayBase, compass ? { sue_compass: true } : {}),
          "fish", 0);
        if (opened.arcade?.game !== "fish") throw new Error("expected fish");
        return {
          ...opened,
          arcade: { ...opened.arcade, phase: "bite", phaseTicks: 47 },
        };
      };
      const normalTimeout = step(world, makeBiteState(false), none).state;
      const compassStillWaiting = step(world, makeBiteState(true), none).state;
      expect(normalTimeout.arcade?.game === "fish" ? normalTimeout.arcade.phase : "").toBe(
        "result",
      );
      expect(
        compassStillWaiting.arcade?.game === "fish" ? compassStillWaiting.arcade.phase : "",
      ).toBe("bite");

      // 4. Star Pin (+2 bonus tickets on Skee-Ball, Boop-a-Mole, and Comet Cruise).
      const arcadeBase = createState(world, fixtureOf("arcade"), 1);
      const finishSkee = (pin: boolean): number => {
        const opened = openArcade(
          world,
          withVars({ ...arcadeBase, coins: 20 }, pin ? { spice_returned: true } : {}),
          "skee",
          2,
        );
        if (opened.arcade?.game !== "skee") throw new Error("expected skee");
        const nearEnd: State = {
          ...opened,
          arcade: {
            ...opened.arcade,
            phase: "scored",
            phaseTicks: world.arcade.skee.scoreTicks - 1,
            throws: Array.from({ length: world.arcade.skee.balls }, () => ({
              x: 0,
              y: 230,
              points: 50,
            })),
          },
        };
        return step(world, nearEnd, none).state.tickets;
      };
      expect(finishSkee(true)).toBe(finishSkee(false) + 2);

      const finishMole = (pin: boolean): number => {
        const opened = openArcade(
          world,
          withVars({ ...arcadeBase, coins: 20 }, pin ? { spice_returned: true } : {}),
          "mole",
          2,
        );
        if (opened.arcade?.game !== "mole") throw new Error("expected mole");
        const nearEnd: State = {
          ...opened,
          arcade: {
            ...opened.arcade,
            phase: "playing",
            mole: opened.arcade.order.length - 1,
            stage: "ducking",
            stageTicks: world.arcade.mole.duckTicks - 1,
            booped: 5,
          },
        };
        return step(world, nearEnd, none).state.tickets;
      };
      expect(finishMole(true)).toBe(finishMole(false) + 2);

      const finishComet = (pin: boolean): number => {
        const opened = openArcade(
          world,
          withVars({ ...arcadeBase, coins: 20 }, pin ? { spice_returned: true } : {}),
          "comet",
          2,
        );
        if (opened.arcade?.game !== "comet") throw new Error("expected comet");
        const nearEnd: State = {
          ...opened,
          arcade: {
            ...opened.arcade,
            phase: "playing",
            elapsed: 99999,
            caught: 6,
            tickets: 12,
          },
        };
        return step(world, nearEnd, none).state.tickets;
      };
      expect(finishComet(true)).toBe(finishComet(false) + 2);

      // 5. Golden Taco Badge (+1 coin/order on Taco Truck).
      const toppingMove: Record<TacoTopping, { x: number; y: number }> = {
        beans: { x: 0, y: -1 },
        cheese: { x: 1, y: 0 },
        salsa: { x: 0, y: 1 },
        avocado: { x: -1, y: 0 },
      };
      const runSpotlessTaco = (badge: boolean): number => {
        const hills = createState(world, fixtureOf("hills"), 31);
        let s = openArcade(
          world,
          { ...hills, stickers: badge ? ["taco-chef"] : [] },
          "taco",
          0,
        );
        const startCoins = s.coins;
        s = step(world, s, confirmFrame).state;
        s = step(world, s, none).state;
        for (let guard = 0; guard < 400 && s.arcade?.game === "taco"; guard += 1) {
          if (s.arcade.phase === "serving") {
            const top = s.arcade.orders[s.arcade.orderIndex]?.recipe[s.arcade.stepIndex];
            if (top === undefined) break;
            s = step(world, s, { ...none, move: toppingMove[top] }).state;
            s = step(world, s, none).state;
          } else if (s.arcade.phase === "order-clear") {
            s = step(world, s, none).state;
          } else {
            break;
          }
        }
        return s.coins - startCoins;
      };
      expect(runSpotlessTaco(false)).toBe(16);
      expect(runSpotlessTaco(true)).toBe(20);
    });

  it("preserves exact zero-keepsake hash parity for fresh state and early-game steps", () => {
    const freshA = createState(world, fixtureOf("new-game"), 1);
    const freshB = createState(world, fixtureOf("new-game"), 1);
    expect("decor" in freshA).toBe(false);
    expect(stableHash(freshA)).toBe(stableHash(freshB));
    let a = freshA;
    let b = freshB;
    for (let tick = 0; tick < 30; tick += 1) {
      const frame: ActionFrame = { ...none, move: { x: 0, y: 1 } };
      a = step(world, a, frame).state;
      b = step(world, b, frame).state;
    }
    expect(stableHash(a)).toBe(stableHash(b));
    expect("decor" in a).toBe(false);
  });
});

describe("Track E9B (Step 1): Bedroom & Clubhouse Decorating + Visiting Friends", () => {
  it("supports Clubhouse swatches, coin/ticket unlocks, pedestals, and bedroom shelf slots", () => {
    const base = createState(world, fixtureOf("clubhouse"), 1);
    expect(activeClubhouseSwatch(base)).toBe("classic");
    expect(isSwatchUnlocked(base, "classic")).toBe(true);
    expect(isSwatchUnlocked(base, "sunlit-meadow")).toBe(false);
    expect(CLUBHOUSE_SWATCH_IDS).toHaveLength(5);
    for (const id of CLUBHOUSE_SWATCH_IDS) {
      expect(CLUBHOUSE_SWATCHES[id].previewColors).toHaveLength(3);
    }

    // Cannot equip locked swatch or buy with insufficient funds.
    expect(equipClubhouseSwatch(base, "sunlit-meadow")).toBe(base);
    const shortCoins = unlockClubhouseSwatch(world, { ...base, coins: 10 }, "sunlit-meadow",
      "coins");
    expect(isSwatchUnlocked(shortCoins, "sunlit-meadow")).toBe(false);
    expect(shortCoins.coins).toBe(10);

    // Unlock all 4 non-classic swatches using a mix of coins and tickets.
    let s: State = { ...base, coins: 300, tickets: 200 };
    const purchases: readonly [ClubhouseSwatchId, "coins" | "tickets"][] = [
      ["sunlit-meadow", "coins"],
      ["starlight-cozy", "tickets"],
      ["bubblegum-beach", "coins"],
      ["pinecone-cabin", "tickets"],
    ];
    for (const [id, currency] of purchases) {
      const price = swatchPriceFor(world, id);
      const prevCoins = s.coins;
      const prevTickets = s.tickets;
      s = unlockClubhouseSwatch(world, s, id, currency);
      expect(isSwatchUnlocked(s, id)).toBe(true);
      if (currency === "coins") expect(s.coins).toBe(prevCoins - price.coins);
      else expect(s.tickets).toBe(prevTickets - price.tickets);
      s = equipClubhouseSwatch(s, id);
      expect(activeClubhouseSwatch(s)).toBe(id);
    }

    // Equip back to classic removes swatch override while retaining unlocks.
    const backToClassic = equipClubhouseSwatch(s, "classic");
    expect(activeClubhouseSwatch(backToClassic)).toBe("classic");
    expect(backToClassic.decor?.swatch).toBeUndefined();
    expect(backToClassic.decor?.unlockedSwatches).toHaveLength(4);

    // Velvet Plush Pedestals: unlock via coins or tickets, expanding shelf capacity 4 -> 5.
    expect(hasPlushPedestals(base)).toBe(false);
    expect(bedroomShelfCapacity(base)).toBe(4);
    const pedPrice = plushPedestalPrice(world);
    const pedCoins = unlockPlushPedestals(world, { ...base, coins: pedPrice.coins }, "coins");
    expect(hasPlushPedestals(pedCoins)).toBe(true);
    expect(pedCoins.coins).toBe(0);
    expect(bedroomShelfCapacity(pedCoins)).toBe(5);
    const pedTickets = unlockPlushPedestals(world, { ...base, tickets: pedPrice.tickets },
      "tickets");
    expect(hasPlushPedestals(pedTickets)).toBe(true);
    expect(pedTickets.tickets).toBe(0);

    // Bedroom shelf auto-fill, toggle, capacity cap, and reset.
    const catalogueOrder = world.arcade.prizes.map((item) => item.id).slice(0, 6);
    const [p0, p1, p2, p3, p4] = catalogueOrder;
    if (
      p0 === undefined || p1 === undefined || p2 === undefined ||
      p3 === undefined || p4 === undefined
    ) {
      throw new Error("expected at least 5 arcade prizes");
    }
    const withPrizes: State = { ...base, prizes: catalogueOrder };
    expect(resolvedBedroomShelfPrizes(world, withPrizes)).toEqual([p0, p1, p2, p3]);

    // Toggling an unowned prize is a no-op; toggling an owned prize when full drops oldest.
    expect(toggleBedroomShelfPrize(world, withPrizes, "nonexistent-plush")).toBe(withPrizes);
    const swapped = toggleBedroomShelfPrize(world, withPrizes, p4);
    expect(resolvedBedroomShelfPrizes(world, swapped)).toEqual([p1, p2, p3, p4]);
    const removed = toggleBedroomShelfPrize(world, swapped, p1);
    expect(resolvedBedroomShelfPrizes(world, removed)).toEqual([p2, p3, p4]);
    const reset = resetBedroomShelfPrizes(removed);
    expect(reset.decor).toBeUndefined();
    expect(resolvedBedroomShelfPrizes(world, reset)).toHaveLength(4);

    // With pedestals, 5 prizes display automatically on the 5 bedroom shelf anchors.
    expect(world.areas.bedroom?.shelfAnchors).toHaveLength(5);
    const withPedestals = unlockPlushPedestals(
      world,
      { ...withPrizes, coins: pedPrice.coins },
      "coins",
    );
    expect(resolvedBedroomShelfPrizes(world, withPedestals)).toHaveLength(5);
  });

  it("emits open-decor events from bedroom_shelf and club_decor interactables", () => {
    const bedroomState: State = {
      ...createState(world, fixtureOf("new-game"), 1),
      player: { x: 750, y: 455 },
      facing: "right",
    };
    expect(targetInteractable(world, bedroomState)?.id).toBe("shelf");
    const shelfTalk = runDialogue(bedroomState, "bedroom_shelf", [0]);
    expect(shelfTalk.events).toContain("open-decor");

    const clubState: State = {
      ...createState(world, fixtureOf("clubhouse"), 1),
      player: { x: 300, y: 482 },
      facing: "up",
    };
    expect(targetInteractable(world, clubState)?.id).toBe("club-decor");
    const decorTalk = runDialogue(clubState, "club_decor", [0]);
    expect(decorTalk.events).toContain("open-decor");
  });

  it("handles all 6 visiting friends eligibility, party exclusion, rotation, knots & QA safety",
    () => {
      const clubArea = world.areas.clubhouse;
      if (clubArea === undefined) throw new Error("clubhouse missing");
      const baseClub = createState(world, fixtureOf("clubhouse"), 1);

      // Before clubhouse_claimed, no visitors appear.
      const unclaimed = withVars(baseClub, { clubhouse_claimed: false, milo_revealed: true });
      expect(eligibleClubhouseVisitors(world, unclaimed)).toEqual([]);
      expect(activeClubhouseVisitor(world, unclaimed)).toBeNull();
      expect(clubhouseVisitorNpc(world, unclaimed)).toBeNull();

      // Golden Clubhouse & Golden Kitchen QA packs have zero visitors (baselines untouched!).
      for (const pack of ["clubhouse", "kitchen"] as const) {
        const raw = readFileSync(`content/qa/saves/${pack}.json`, "utf8");
        const parsed = parseSave(raw, createState(world, fixtureOf("new-game"), 1));
        expect(parsed).not.toBeNull();
        if (parsed !== null) {
          expect(eligibleClubhouseVisitors(world, parsed), pack).toEqual([]);
          expect(clubhouseVisitorNpc(world, parsed), pack).toBeNull();
        }
      }

      // Party exclusion: Sue & Jordan only visit when NOT in active party.
      const withBothInParty = withVars(
        {
          ...baseClub,
          party: [
            ...baseClub.party,
            {
              id: "sue",
              xp: 0,
              x: 687,
              y: 493,
              facing: "up",
              motion: { distance: 0, moving: false },
              stillTicks: 0,
              trail: [],
            },
            {
              id: "jordan",
              xp: 0,
              x: 687,
              y: 493,
              facing: "up",
              motion: { distance: 0, moving: false },
              stillTicks: 0,
              trail: [],
            },
          ],
        },
        { clubhouse_claimed: true, sue_joined: true, jordan_joined: true },
      );
      expect(eligibleClubhouseVisitors(world, withBothInParty)).toEqual([]);

      // All 6 eligible when party only has Maddie and story flags are unlocked.
      const allEligibleState = withVars(
        { ...baseClub, party: baseClub.party.filter((member) => member.id === "maddie") },
        {
          clubhouse_claimed: true,
          sue_joined: true,
          jordan_joined: true,
          milo_revealed: true,
          rosie_cottage_visited: true,
          barnaby_gift: true,
          sanctuary_visited: true,
        },
      );
      const eligible = eligibleClubhouseVisitors(world, allEligibleState);
      expect(eligible.map((item) => item.id)).toEqual(CLUBHOUSE_VISITORS.map((item) => item.id));

      // Deterministic rotation and cycling through all 6 visitors!
      const seen = new Set<string>();
      let cursor = allEligibleState;
      for (let i = 0; i < 6; i += 1) {
        const current = activeClubhouseVisitor(world, cursor);
        expect(current).not.toBeNull();
        if (current !== null) seen.add(current.id);
        const npc = clubhouseVisitorNpc(world, cursor);
        expect(npc?.id).toBe(current?.id);
        expect(effectiveAreaNpcs(world, cursor, clubArea)).toHaveLength(1);
        cursor = cycleClubhouseVisitor(world, cursor);
      }
      expect(seen.size).toBe(6);

      // All 6 visitor hangout knots run cleanly with warm dialogue!
      for (const visitor of CLUBHOUSE_VISITORS) {
        const talk = runDialogue(allEligibleState, visitor.knot);
        expect(talk.lines.length, visitor.knot).toBeGreaterThanOrEqual(2);
      }
    });
});

describe("Track E9B (Step 1): Economy Sinks, Fish Trade-Ins & Save Safety", () => {
  it("supports Fish-to-Tickets and Fish-to-Coins trade-ins while preserving Catch Book", () => {
    const bayBase: State = {
      ...createState(world, fixtureOf("bay"), 1),
      coins: 3,
      tickets: 5,
      caughtFish: { minnow: 2, starfish: 1 },
    };
    expect(totalCaughtFishCount(bayBase)).toBe(3);
    expect(availableFishToTrade(bayBase)).toBe(3);

    // Trade via bay_souvenirs even when coins < 9! Choice 0 = 12 tickets, Choice 1 = 14 coins.
    const tradedTickets = runDialogue(bayBase, "bay_souvenirs", [0]);
    expect(tradedTickets.state.tickets).toBe(17);
    expect(tradedTickets.state.caughtFish).toEqual({ minnow: 2, starfish: 1 });
    expect(availableFishToTrade(tradedTickets.state)).toBe(2);

    const tradedCoins = runDialogue(tradedTickets.state, "bay_souvenirs", [1]);
    expect(tradedCoins.state.coins).toBe(17);
    expect(tradedCoins.state.caughtFish).toEqual({ minnow: 2, starfish: 1 });
    expect(availableFishToTrade(tradedCoins.state)).toBe(1);

    // Direct helper rejects trading once available fish reaches 0.
    const last = tradeFishCatch(tradedCoins.state, "coins", 14);
    expect(availableFishToTrade(last)).toBe(0);
    expect(tradeFishCatch(last, "coins", 14)).toBe(last);
  });

  it("sells all 4 Specialty Treat Gift Baskets and supports Mr. Pip Coin-to-Ticket exchange",
    () => {
    expect(world.treatBaskets.map((item) => item.id)).toEqual([
      "market-basket",
      "cafe-basket",
      "parlor-basket",
      "valley-feast",
    ]);

    // 1. Market Basket via Grocer Pippin (45 coins).
    const marketStart = withVars(
      { ...createState(world, fixtureOf("market"), 1), coins: 60, snacks: 1 },
      { market_visited: true },
    );
    const boughtMarket = runDialogue(marketStart, "grocer_pippin", [3]);
    expect(boughtMarket.state.coins).toBe(15);
    expect(boughtMarket.state.snacks).toBe(3);
    expect(boughtMarket.state.treats).toEqual({ "orchard-apple": 2, "fish-cracker": 2 });

    // 2. Parlor Basket via Scooper Penny (55 coins).
    const parlorStart = withVars(
      { ...createState(world, fixtureOf("parlor"), 1), coins: 60, snacks: 0 },
      { parlor_visited: true },
    );
    const boughtParlor = runDialogue(parlorStart, "scooper_penny", [2]);
    expect(boughtParlor.state.coins).toBe(5);
    expect(boughtParlor.state.snacks).toBe(2);
    expect(boughtParlor.state.treats).toEqual({ "berry-cone": 2, "cocoa-sundae": 2 });

    // 3. Cafe Trail Basket (50 coins) & Golden Valley Feast (75 coins) via Chef Bea.
    const cafeStart = withVars(
      { ...createState(world, fixtureOf("cafe"), 1), coins: 130, snacks: 0 },
      { spice_quest: true, spice_found: true, spice_returned: true },
    );
    const boughtTrail = runDialogue(cafeStart, "chef_bea", [1]);
    expect(boughtTrail.state.coins).toBe(80);
    expect(boughtTrail.state.snacks).toBe(3);
    expect(boughtTrail.state.treats).toEqual({ "maple-brittle": 2, "sea-salt-taffy": 2 });

    const boughtFeast = runDialogue(boughtTrail.state, "chef_bea", [2]);
    expect(boughtFeast.state.coins).toBe(5);
    expect(boughtFeast.state.snacks).toBe(5);
    expect(boughtFeast.state.treats).toEqual({
      "maple-brittle": 4,
      "sea-salt-taffy": 2,
      "sunberry-nectar": 1,
      "berry-cone": 2,
    });

    // Rejects wrong price or insufficient funds.
    expect(purchaseTreatBasket(world, cafeStart, "market-basket", 10)).toBe(cafeStart);
    expect(purchaseTreatBasket(world, { ...cafeStart, coins: 10 }, "market-basket", 45).coins)
      .toBe(10);

    // 4. Mr. Pip Coin-to-Ticket exchange (25 coins -> 15 tickets) even after all 4 prizes won!
    const arcadeStart: State = {
      ...createState(world, fixtureOf("arcade"), 1),
      coins: 50,
      tickets: 0,
      prizes: ["pinwheel", "bouncy-ball", "toy-rocket", "star-racer-keychain"],
      critters: { ...createState(world, fixtureOf("arcade"), 1).critters, "arcade-keeper": "calm" },
    };
    const traded = runDialogue(arcadeStart, "ticket_counter", [0]);
    expect(traded.state.coins).toBe(25);
    expect(traded.state.tickets).toBe(15);
    expect(exchangeCoinsForTickets({ ...arcadeStart, coins: 10 }, 25, 15).coins).toBe(10);

    // Parser & tag validator reject malformed baskets and tags.
    expect(() =>
      parseTreatBaskets(
        { baskets: [{ id: "bad", name: "Bad", price: 10, snacks: 0, treats: { ghost: 1 } }] },
        "treats.json",
        world.treats,
      ),
    ).toThrow(/unknown treat/);
    expect(
      storyTagErrors(
        [
          "buy-basket: market-basket 99",
          "trade-fish: gems 10",
          "buy-tickets: 0 15",
          "open-decor: kitchen",
        ],
        world.areas,
        {},
        {},
        { "market-basket": 45 },
      ),
    ).toHaveLength(4);
  });

  it("round-trips v10 saves with omitted/populated decor and rejects malformed decor", () => {
    const fresh = createState(world, fixtureOf("new-game"), 1);
    expect("decor" in fresh).toBe(false);
    expect(normalizeDecor({ swatch: "classic", unlockedSwatches: ["classic"], visitorOffset: 0 }))
      .toBeUndefined();
    const cleaned = withDecor(fresh, { swatch: "classic" });
    expect("decor" in cleaned).toBe(false);

    const restoredFresh = parseSave(serializeSave(fresh), fresh);
    expect(restoredFresh).not.toBeNull();
    if (restoredFresh !== null) expect(stableHash(restoredFresh)).toBe(stableHash(fresh));

    const decorated = withDecor(fresh, {
      swatch: "starlight-cozy",
      unlockedSwatches: ["sunlit-meadow", "starlight-cozy"],
      pedestals: true,
      bedroomSlots: ["frog-plush", "cat-plush"],
      visitorOffset: 2,
      fishTraded: 4,
    });
    const restoredDecor = parseSave(serializeSave(decorated), fresh);
    expect(restoredDecor?.decor).toEqual(decorated.decor);

    const badPayloads = [
      { swatch: "neon-disco" },
      { unlockedSwatches: ["unknown"] },
      { pedestals: "yes" },
      { bedroomSlots: ["Bad Plush"] },
      { visitorOffset: -1 },
      { fishTraded: 1.5 },
      { unexpectedKey: true },
      "classic",
      [],
    ];
    for (const bad of badPayloads) {
      const json = JSON.stringify({ version: 10, state: { ...fresh, decor: bad } });
      expect(parseSave(json, fresh), JSON.stringify(bad)).toBeNull();
    }
  });

  it("maintains strict core purity and <= 100 column formatting on new/touched core files", () => {
    for (const file of ["src/core/blessings.ts", "src/core/decor.ts"]) {
      const source = readFileSync(file, "utf8");
      const stripped = stripComments(source);
      expect(importErrors(file, stripped), file).toEqual([]);
      expect(stripStringLiterals(stripped), file).not.toMatch(
        /\b(window|document|PIXI|Date|performance)\b/,
      );
      for (const [index, line] of source.split("\n").entries()) {
        expect(line.length, `${file}:${index + 1}`).toBeLessThanOrEqual(100);
      }
    }
  });
});
