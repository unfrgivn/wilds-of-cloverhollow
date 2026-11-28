import {
  blankInput,
  createState,
  isCutsceneSeen,
  pointInPolygon,
  sceneryArea,
  soundCues,
  stableHash,
  startCutscene,
  step,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

const CUTSCENE_ID = "plaza-hood-sighting";
const MAX_TICKS = 1000;

type Milestones = {
  hoodedKidSpawned: boolean;
  hoodedKidMoved: boolean;
  purpleFizzSeen: boolean;
  purplePuffSeen: boolean;
  exclaimSeen: boolean;
  sparkleSeen: boolean;
  sfxCues: string[];
  cameraPanned: boolean;
  hoodedKidDespawned: boolean;
};

type PassResult = {
  hash: string;
  tick: number;
  seen: boolean;
  milestones: Milestones;
};

function assertInBounds(world: World, state: State): void {
  const rawArea = world.areas[state.area];
  if (rawArea === undefined) throw new Error(`Unknown area: ${state.area}`);
  const area = sceneryArea(world, state.ink, rawArea);
  const actors = [
    { label: "fae", point: state.player },
    ...state.party.map((member) => ({ label: member.id, point: member })),
  ];
  for (const actor of actors) {
    if (!pointInPolygon(actor.point, area.walkable)) {
      throw new Error(
        `${actor.label} left walkable area at tick ${state.tick} ` +
          `(${actor.point.x}, ${actor.point.y})`,
      );
    }
    for (const blocker of area.blockers) {
      if (pointInPolygon(actor.point, blocker)) {
        throw new Error(
          `${actor.label} entered blocker at tick ${state.tick} ` +
            `(${actor.point.x}, ${actor.point.y})`,
        );
      }
    }
  }
}

function runPass(): PassResult {
  const content = loadContent();
  const fixture = content.fixtures.plaza;
  if (fixture === undefined) throw new Error("plaza fixture missing");
  const { world } = content;

  let prev = startCutscene(world, createState(world, fixture, 1), CUTSCENE_ID);
  if (prev.cutscene === undefined) throw new Error(`${CUTSCENE_ID} failed to start`);

  let hoodedStart: { x: number; y: number } | null = null;
  let initialCamera: { x: number; y: number } | null = null;
  const sfxObserved = new Set<string>();
  const milestones: Milestones = {
    hoodedKidSpawned: false,
    hoodedKidMoved: false,
    purpleFizzSeen: false,
    purplePuffSeen: false,
    exclaimSeen: false,
    sparkleSeen: false,
    sfxCues: [],
    cameraPanned: false,
    hoodedKidDespawned: false,
  };

  for (let i = 0; i < MAX_TICKS && prev.cutscene !== undefined; i += 1) {
    const next = step(world, prev, blankInput()).state;
    assertInBounds(world, next);
    for (const cue of soundCues(prev, next, world)) {
      sfxObserved.add(cue);
    }
    const cs = next.cutscene;
    if (cs !== undefined) {
      const hooded = cs.tempActors.find((actor) => actor.id === "hooded-kid");
      if (hooded !== undefined) {
        if (!milestones.hoodedKidSpawned) {
          milestones.hoodedKidSpawned = true;
          hoodedStart = { x: hooded.x, y: hooded.y };
        } else if (
          hoodedStart !== null &&
          (Math.abs(hooded.x - hoodedStart.x) > 1 || Math.abs(hooded.y - hoodedStart.y) > 1)
        ) {
          milestones.hoodedKidMoved = true;
        }
      } else if (milestones.hoodedKidSpawned) {
        milestones.hoodedKidDespawned = true;
      }
      if (cs.effects.some((effect) => effect.kind === "purple-fizz")) {
        milestones.purpleFizzSeen = true;
      }
      if (cs.effects.some((effect) => effect.kind === "purple-puff")) {
        milestones.purplePuffSeen = true;
      }
      if (cs.emotes.some((emote) => emote.kind === "exclaim")) {
        milestones.exclaimSeen = true;
      }
      if (cs.emotes.some((emote) => emote.kind === "sparkle")) {
        milestones.sparkleSeen = true;
      }
      if (cs.camera !== null) {
        if (initialCamera === null) {
          initialCamera = { x: cs.camera.x, y: cs.camera.y };
        } else if (
          Math.abs(cs.camera.x - initialCamera.x) > 1 ||
          Math.abs(cs.camera.y - initialCamera.y) > 1
        ) {
          milestones.cameraPanned = true;
        }
      }
    }
    prev = next;
  }

  milestones.sfxCues = [...sfxObserved].sort();
  if (prev.cutscene !== undefined) {
    throw new Error(`${CUTSCENE_ID} did not finish within ${MAX_TICKS} ticks`);
  }
  const seen = isCutsceneSeen(prev, CUTSCENE_ID);
  if (!seen) throw new Error(`${CUTSCENE_ID} was not recorded in cutscenesSeen`);

  const requiredFlags: [string, boolean][] = [
    ["hoodedKidSpawned", milestones.hoodedKidSpawned],
    ["hoodedKidMoved", milestones.hoodedKidMoved],
    ["purpleFizzSeen", milestones.purpleFizzSeen],
    ["purplePuffSeen", milestones.purplePuffSeen],
    ["exclaimSeen", milestones.exclaimSeen],
    ["sparkleSeen", milestones.sparkleSeen],
    ["cameraPanned", milestones.cameraPanned],
    ["hoodedKidDespawned", milestones.hoodedKidDespawned],
  ];
  for (const [name, ok] of requiredFlags) {
    if (!ok) throw new Error(`Missing milestone: ${name}`);
  }
  for (const cue of ["lantern-on", "flute-blue", "lantern-off"]) {
    if (!sfxObserved.has(cue)) throw new Error(`Missing expected SFX cue: ${cue}`);
  }

  return {
    hash: stableHash(prev),
    tick: prev.tick,
    seen,
    milestones,
  };
}

const first = runPass();
const second = runPass();
if (first.hash !== second.hash || first.tick !== second.tick) {
  throw new Error(
    `Determinism mismatch: pass 1 (${first.tick}, ${first.hash}) vs ` +
      `pass 2 (${second.tick}, ${second.hash})`,
  );
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(first));
} else {
  console.log(
    `cutscene-plaza-hood: tick ${first.tick}, hash ${first.hash.slice(0, 12)}, ` +
      `seen=${String(first.seen)}, sfx=[${first.milestones.sfxCues.join(",")}] ok`,
  );
}
