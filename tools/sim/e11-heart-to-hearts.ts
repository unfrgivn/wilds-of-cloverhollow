import {
  battleCommands,
  blankInput,
  buildNavField,
  createState,
  findPath,
  HEART_TO_HEARTS,
  journalNotes,
  LULLABY_FLUTE_SPOTS,
  sceneryArea,
  stableHash,
  step,
  targetInteractable,
  type ActionFrame,
  type Area,
  type Fixture,
  type Point,
  type Polygon,
  type State,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world } = loadContent();

const START_FIXTURE: Fixture = {
  area: "bedroom",
  spawn: "bed",
  seed: 11,
  party: ["maddie", "sue", "jordan"],
  calms: { "fountain-frog": 1 },
  variables: {
    dreaming: true,
    ate_breakfast: true,
    sue_joined: true,
    jordan_joined: true,
    has_lantern: true,
    has_flute: true,
    visited_bay: true,
    visited_pass: true,
    rode_bus: true,
  },
};

const press = (frame: Partial<ActionFrame>): ActionFrame => ({
  ...blankInput(),
  ...frame,
});

function advance(state: State, input: ActionFrame): State {
  return step(world, state, input).state;
}

function polygonCenter(poly: Polygon): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of poly) {
    sx += x;
    sy += y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

function fleeBattleIfAny(initial: State): State {
  let state = initial;
  if (state.battle === null) return state;
  const prompted = (): boolean =>
    state.battle?.phase === "command" && state.battle.revealed >= state.battle.message.length;
  for (let tick = 0; tick < 400 && !prompted(); tick += 1) {
    state = advance(state, press({ confirm: tick % 2 === 0 }));
  }
  const runIdx = battleCommands(world, state).findIndex((cmd) => cmd.id === "run");
  if (!prompted() || runIdx < 0) throw new Error("wild battle did not offer Run");
  state = advance(state, blankInput());
  state = advance(state, press({ choose: runIdx }));
  for (let tick = 0; tick < 400 && state.battle !== null; tick += 1) {
    state = advance(state, press({ confirm: tick % 2 === 0 }));
  }
  if (state.battle !== null) throw new Error("wild battle did not close after Run");
  return state;
}

function navAreaFor(state: State): Area {
  const raw = world.areas[state.area];
  if (raw === undefined) throw new Error(`unknown area ${state.area}`);
  const scenery = sceneryArea(world, state.ink, raw);
  return {
    ...scenery,
    blockers: [
      ...scenery.blockers,
      ...raw.npcs.filter((npc) => npc.stroll === undefined).map((npc) => npc.footprint),
    ],
  };
}

function walkToPoint(initial: State, goal: Point, arriveRadius = 18): State {
  let state = fleeBattleIfAny(initial);
  const startArea = state.area;
  const field = buildNavField(navAreaFor(state), world.tunables.playerRadius + 2);
  const path = findPath(field, state.player, goal, 12_000);
  const waypoints = path.length > 0 ? [...path, goal] : [goal];

  for (const waypoint of waypoints) {
    for (let tick = 0; tick < 600; tick += 1) {
      if (state.area !== startArea || state.transition !== null) return state;
      if (state.battle !== null) {
        state = fleeBattleIfAny(state);
        continue;
      }
      const dx = waypoint.x - state.player.x;
      const dy = waypoint.y - state.player.y;
      const dist = Math.hypot(dx, dy);
      const isFinal = waypoint === waypoints[waypoints.length - 1];
      if (dist <= (isFinal ? arriveRadius : 14)) break;
      state = advance(state, press({ move: { x: dx / dist, y: dy / dist } }));
    }
  }
  return state;
}

function walkToTarget(initial: State, targetPoint: Point, expectedId: string): State {
  let state = initial;
  const offsets: readonly Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 42 },
    { x: 0, y: -42 },
    { x: 42, y: 0 },
    { x: -42, y: 0 },
    { x: 0, y: 66 },
    { x: 0, y: -66 },
    { x: 66, y: 0 },
    { x: -66, y: 0 },
  ];
  for (const offset of offsets) {
    const stand = { x: targetPoint.x + offset.x, y: targetPoint.y + offset.y };
    state = walkToPoint(state, stand, 16);
    const dx = targetPoint.x - state.player.x;
    const dy = targetPoint.y - state.player.y;
    if (Math.hypot(dx, dy) > 1) {
      const faceDir =
        Math.abs(dx) >= Math.abs(dy)
          ? { x: dx > 0 ? 1 : -1, y: 0 }
          : { x: 0, y: dy > 0 ? 1 : -1 };
      state = advance(state, press({ move: faceDir }));
    }
    state = advance(state, blankInput());
    if (targetInteractable(world, state)?.id === expectedId) return state;
  }
  throw new Error(
    `failed to target ${expectedId} in ${state.area} from (${state.player.x}, ${state.player.y})`,
  );
}

function walkThroughTrigger(initial: State, triggerId: string, expectedArea: string): State {
  const area = world.areas[initial.area];
  const trigger = area?.triggers.find((item) => item.id === triggerId);
  if (trigger === undefined) throw new Error(`missing trigger ${initial.area}.${triggerId}`);
  const center = polygonCenter(trigger.polygon);
  let state = walkToPoint(initial, center, 4);
  for (let tick = 0; tick < 240; tick += 1) {
    if (state.transition !== null || state.area === expectedArea) break;
    const dx = center.x - state.player.x;
    const dy = center.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const move = dist > 0.5 ? { x: dx / dist, y: dy / dist } : { x: 0, y: -1 };
    state = advance(state, press({ move }));
  }
  for (let tick = 0; tick < 240; tick += 1) {
    if (state.transition === null && state.area === expectedArea) break;
    state = advance(state, blankInput());
  }
  if (state.area !== expectedArea || state.transition !== null) {
    throw new Error(`trigger ${triggerId} did not enter ${expectedArea} (at ${state.area})`);
  }
  return state;
}

function finishDialogue(
  initial: State,
  chooseIndex: (choices: readonly string[]) => number = () => 0,
): State {
  let state = initial;
  for (let tick = 0; tick < 800 && state.dialogue !== null; tick += 1) {
    const dlg = state.dialogue;
    if (dlg.revealed < dlg.text.length) {
      state = advance(state, blankInput());
      state = advance(state, press({ confirm: true }));
      continue;
    }
    if (dlg.choices.length > 0) {
      const idx = chooseIndex(dlg.choices);
      if (idx < 0 || idx >= dlg.choices.length) {
        throw new Error(`invalid choice index ${idx} for [${dlg.choices.join(", ")}]`);
      }
      state = advance(state, blankInput());
      state = advance(state, press({ choose: idx }));
      continue;
    }
    state = advance(state, blankInput());
    state = advance(state, press({ confirm: true }));
  }
  if (state.dialogue !== null) throw new Error(`dialogue ${state.dialogue.knot} did not close`);
  return state;
}

function interactAndFinish(
  initial: State,
  targetPoint: Point,
  expectedId: string,
  expectedKnot: string,
  chooseIndex?: (choices: readonly string[]) => number,
): State {
  let state = walkToTarget(initial, targetPoint, expectedId);
  state = advance(state, press({ confirm: true }));
  if (state.dialogue?.knot !== expectedKnot) {
    throw new Error(
      `expected knot ${expectedKnot} for ${expectedId}, got ${state.dialogue?.knot ?? "none"}`,
    );
  }
  return finishDialogue(state, chooseIndex);
}

function rideBus(
  initial: State,
  busPoint: Point,
  busTargetId: string,
  busKnot: string,
  destinationPattern: RegExp,
  expectedArea: string,
): State {
  let state = interactAndFinish(initial, busPoint, busTargetId, busKnot, (choices) => {
    const idx = choices.findIndex((choice) => destinationPattern.test(choice));
    if (idx < 0) throw new Error(`bus choice ${destinationPattern} not in [${choices.join(", ")}]`);
    return idx;
  });
  for (let tick = 0; tick < 240; tick += 1) {
    if (state.transition === null && state.area === expectedArea) break;
    state = advance(state, blankInput());
  }
  if (state.area !== expectedArea || state.transition !== null) {
    throw new Error(`bus ride did not arrive at ${expectedArea} (at ${state.area})`);
  }
  return state;
}

function pick(pattern: RegExp): (choices: readonly string[]) => number {
  return (choices) => {
    const idx = choices.findIndex((choice) => pattern.test(choice));
    if (idx < 0) throw new Error(`no choice matched ${pattern} in [${choices.join(", ")}]`);
    return idx;
  };
}

function mustFindPoint(areaId: string, kind: "npc" | "glow" | "interactable", id: string): Point {
  const area = world.areas[areaId];
  if (area === undefined) throw new Error(`missing area ${areaId}`);
  const list =
    kind === "npc" ? area.npcs : kind === "glow" ? area.glows : area.interactables;
  const item = list.find((entry) => entry.id === id);
  if (item === undefined) throw new Error(`missing ${kind} ${areaId}.${id}`);
  return item.point;
}

function runScenario(): { tick: number; hash: string } {
  let state = createState(world, START_FIXTURE);

  // 1. Complete Fae & Maddie's Heart-to-Heart in bedroom via real confirm & choice ticks.
  const faeMaddie = HEART_TO_HEARTS.find((spec) => spec.id === "fae-maddie");
  const sueJordan = HEART_TO_HEARTS.find((spec) => spec.id === "sue-jordan");
  const lullabyPlaza = LULLABY_FLUTE_SPOTS.find((spot) => spot.id === "lullaby-plaza");
  if (faeMaddie === undefined || sueJordan === undefined || lullabyPlaza === undefined) {
    throw new Error("missing E11 spec");
  }

  state = interactAndFinish(
    state,
    faeMaddie.point,
    "heart:fae-maddie",
    "h2h_fae_maddie",
    pick(/star cape/i),
  );
  if (world.storyVariable(state.ink, "h2h_fae_maddie_done") !== true) {
    throw new Error("h2h_fae_maddie_done was not set");
  }

  // 2. Walk bedroom -> kitchen -> plaza -> cafe through real doors.
  state = walkThroughTrigger(state, "hall-door", "kitchen");
  state = walkThroughTrigger(state, "front-door", "plaza");
  state = walkThroughTrigger(state, "cafe-door", "cafe");

  // 3. Complete Sue & Jordan's Heart-to-Heart in cafe.
  state = interactAndFinish(
    state,
    sueJordan.point,
    "heart:sue-jordan",
    "h2h_sue_jordan",
    pick(/Combine them/i),
  );
  if (world.storyVariable(state.ink, "h2h_sue_jordan_done") !== true) {
    throw new Error("h2h_sue_jordan_done was not set");
  }
  if ((state.treats?.["cocoa-sundae"] ?? 0) < 1) {
    throw new Error("cocoa-sundae reward missing after Sue & Jordan Heart-to-Heart");
  }

  // 4. Start Grandpa Barnaby's Star Chart and Toby's Sleepy Lullaby in cafe.
  state = interactAndFinish(
    state,
    mustFindPoint("cafe", "npc", "barnaby"),
    "npc:barnaby",
    "barnaby",
    pick(/old Star Chart/i),
  );
  if (world.storyVariable(state.ink, "star_chart_quest") !== true) {
    throw new Error("star_chart_quest did not start");
  }

  state = interactAndFinish(
    state,
    mustFindPoint("cafe", "npc", "toby"),
    "npc:toby",
    "toby",
    pick(/sleepy town-square lullaby/i),
  );
  if (world.storyVariable(state.ink, "lullaby_quest") !== true) {
    throw new Error("lullaby_quest did not start");
  }

  // 5. Exit cafe -> plaza and trigger Toby's Sleepy Lullaby via real flute: true tick.
  state = walkThroughTrigger(state, "door", "plaza");
  state = walkToPoint(state, lullabyPlaza.point, 45);
  state = advance(state, blankInput());
  state = advance(state, press({ flute: true }));
  if (state.dialogue?.knot !== "lullaby_plaza") {
    throw new Error(`flute near lullaby-plaza opened ${state.dialogue?.knot ?? "nothing"}`);
  }
  state = finishDialogue(state, pick(/Harmony Flute/i));
  if (world.storyVariable(state.ink, "lullaby_note_plaza") !== true) {
    throw new Error("lullaby_note_plaza was not recorded");
  }

  // 6. Toggle Blacklight Lantern ON via real lantern: true tick and trace Star Chart I in plaza.
  state = advance(state, blankInput());
  state = advance(state, press({ lantern: true }));
  if (!state.lantern) throw new Error("blacklight lantern did not switch on");

  state = interactAndFinish(
    state,
    mustFindPoint("plaza", "glow", "star-chart-plaza"),
    "glow:star-chart-plaza",
    "star_chart_plaza_glow",
  );
  if (world.storyVariable(state.ink, "star_chart_plaza") !== true) {
    throw new Error("star_chart_plaza was not recorded");
  }

  // 7. Ride Star-Line Bus plaza -> bay and trace Star Chart II.
  state = rideBus(
    state,
    mustFindPoint("plaza", "npc", "bus-stop"),
    "npc:bus-stop",
    "bus_stop",
    /Bubblegum Bay/i,
    "bay",
  );
  state = interactAndFinish(
    state,
    mustFindPoint("bay", "glow", "star-chart-bay"),
    "glow:star-chart-bay",
    "star_chart_bay_glow",
  );
  if (world.storyVariable(state.ink, "star_chart_bay") !== true) {
    throw new Error("star_chart_bay was not recorded");
  }

  // 8. Ride Star-Line Bus bay -> pass and trace Star Chart III.
  state = rideBus(
    state,
    mustFindPoint("bay", "npc", "bus-stop"),
    "npc:bus-stop",
    "bay_bus_stop",
    /Pinecone Pass/i,
    "pass",
  );
  state = interactAndFinish(
    state,
    mustFindPoint("pass", "glow", "star-chart-pass"),
    "glow:star-chart-pass",
    "star_chart_pass_glow",
  );
  if (world.storyVariable(state.ink, "star_chart_pass") !== true) {
    throw new Error("star_chart_pass was not recorded");
  }

  // 9. Ride Star-Line Bus pass -> plaza -> cafe and turn in Grandpa Barnaby's Star Chart.
  state = rideBus(
    state,
    mustFindPoint("pass", "interactable", "pass-bus-stop"),
    "pass-bus-stop",
    "pass_bus_stop",
    /Cloverhollow/i,
    "plaza",
  );
  state = walkThroughTrigger(state, "cafe-door", "cafe");
  state = interactAndFinish(
    state,
    mustFindPoint("cafe", "npc", "barnaby"),
    "npc:barnaby",
    "barnaby",
  );
  if (world.storyVariable(state.ink, "star_chart_done") !== true) {
    throw new Error("star_chart_done was not completed at Barnaby");
  }

  const notes = journalNotes(world, state);
  const expectedNotes = [
    /page one of my journal with Maddie/i,
    /Coast-Meets-Mountain Snack Treaty/i,
    /restore Grandpa Barnaby's observatory Star Chart/i,
    /Toby's Sleepy Lullaby \(1\/3\)/i,
  ];
  for (const pattern of expectedNotes) {
    if (!notes.some((note) => pattern.test(note))) {
      throw new Error(`expected journal note matching ${pattern}`);
    }
  }

  return { tick: state.tick, hash: stableHash(state) };
}

const first = runScenario();
const second = runScenario();
if (first.hash !== second.hash || first.tick !== second.tick) {
  throw new Error(
    `e11 sim is not deterministic: ${first.tick}/${first.hash} != ${second.tick}/${second.hash}`,
  );
}
console.log(
  `e11-heart-to-hearts: tick ${first.tick} ok, 2 H2Hs + Star Chart + Flute Lullaby, ` +
    `deterministic (${first.hash})`,
);
