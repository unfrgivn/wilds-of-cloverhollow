import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  blankInput,
  createState,
  isPuzzleSolved,
  stableHash,
  step,
  type ActionFrame,
  type Point,
  type State,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";

type Segment = { frame: ActionFrame; ticks: number };

class Recorder {
  readonly segments: Segment[] = [];
  state: State;

  constructor(private readonly world: World, start: State) {
    this.state = start;
  }

  push(frame: ActionFrame, ticks: number): void {
    if (ticks <= 0) return;
    for (let i = 0; i < ticks; i += 1) {
      this.state = step(this.world, this.state, frame).state;
    }
    const last = this.segments.at(-1);
    if (last !== undefined && JSON.stringify(last.frame) === JSON.stringify(frame)) {
      last.ticks += ticks;
    } else {
      this.segments.push({ frame, ticks });
    }
  }

  idle(ticks: number): void {
    this.push(blankInput(), ticks);
  }

  tap(partial: Partial<ActionFrame>, settle = 2): void {
    this.push({ ...blankInput(), ...partial }, 1);
    if (settle > 0) this.idle(settle);
  }

  walkAxis(axis: "x" | "y", target: number, dash = false): void {
    for (let guard = 0; guard < 400; guard += 1) {
      const error = target - this.state.player[axis];
      if (Math.abs(error) <= 3.5) break;
      const move: Point =
        axis === "x"
          ? { x: error > 0 ? 1 : -1, y: 0 }
          : { x: 0, y: error > 0 ? 1 : -1 };
      const before = this.state.player[axis];
      this.push({ ...blankInput(), move, ...(dash ? { dash: true } : {}) }, 1);
      if (Math.abs(this.state.player[axis] - before) < 0.05) break;
    }
  }

  face(dir: "up" | "down" | "left" | "right"): void {
    const move: Point =
      dir === "up"
        ? { x: 0, y: -1 }
        : dir === "down"
          ? { x: 0, y: 1 }
          : dir === "left"
            ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
    this.push({ ...blankInput(), move }, 1);
    this.idle(1);
  }

  write(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(this.segments, null, 2)}\n`);
  }
}

const { world, fixtures } = loadContent();

// 1. Crystal Cavern: Cozy Dash + Prism Mirrors + Blacklight Lantern Beam -> cavern_bridge_lit!
{
  const fixture = fixtures.cavern;
  if (fixture === undefined) throw new Error("cavern fixture missing");
  const rec = new Recorder(world, createState(world, fixture));
  // Dash south-east toward Mirror 1 at (720, 875), stop cleanly beside it at (685, 875).
  rec.walkAxis("y", 875, true);
  rec.walkAxis("x", 685, true);
  rec.face("right");
  // Rotate Mirror 1 twice: se -> sw -> nw (bounces rightward beam UP!)
  rec.tap({ confirm: true }, 2);
  rec.tap({ confirm: true }, 2);
  // Dash north-west around to Mirror 2 at (720, 750), stop beside it at (685, 750).
  rec.walkAxis("y", 750, true);
  rec.face("right");
  // Rotate Mirror 2 once: ne -> se (bounces upward beam RIGHT into receiver at (865, 750)!)
  rec.tap({ confirm: true }, 2);
  // Walk south-west toward Emitter at (580, 875) and turn on Blacklight Lantern!
  rec.walkAxis("x", 615, true);
  rec.walkAxis("y", 855, true);
  rec.tap({ lantern: true }, 6);
  if (!isPuzzleSolved(world, rec.state, "cavern-prism")) {
    throw new Error(`cavern-prism failed to solve! pos=${JSON.stringify(rec.state.player)}`);
  }
  if (world.storyVariable(rec.state.ink, "cavern_bridge_lit") !== true) {
    throw new Error("cavern_bridge_lit was not mirrored into Ink!");
  }
  rec.write("tests/sim/scripts/cavern/cavern-prism.json");
  console.log(
    `cavern/cavern-prism.json: tick ${rec.state.tick}, hash ${stableHash(rec.state)}`,
  );
}

// 2. Misty Path / Enchanted Forest Seal: Interactive 3-Tool Shrine Ritual!
{
  const fixture = fixtures.mist;
  if (fixture === undefined) throw new Error("mist fixture missing");
  const rec = new Recorder(world, createState(world, fixture));
  // Beat 1: Walk to mist bank, shine Blacklight Lantern to reveal & walk across stepping stones!
  rec.walkAxis("x", 320, true);
  rec.walkAxis("y", 575, true);
  rec.tap({ lantern: true }, 2);
  rec.walkAxis("x", 600, true);
  if (world.storyVariable(rec.state.ink, "found_mist_way") !== true) {
    throw new Error("mist Beat 1 (found_mist_way) did not solve!");
  }
  // Turn lantern back off cleanly.
  rec.tap({ lantern: true }, 2);
  // Beat 2: Walk to west rim of gully, face right, and fire Rainbow Lasso at mist-gully-post!
  rec.walkAxis("x", 765, true);
  rec.walkAxis("y", 580, true);
  rec.face("right");
  rec.tap({ lasso: true }, 14);
  if (world.storyVariable(rec.state.ink, "rope_bridge") !== true) {
    throw new Error("mist Beat 2 (rope_bridge) did not solve!");
  }
  // Beat 3: Dash across the rope bridge to the Enchanted Seal Shrine and chime Up-Right-Left!
  rec.walkAxis("x", 1235, true);
  rec.walkAxis("y", 535, true);
  rec.tap({ flute: true }, 2);
  // Chime Red (Up), Yellow (Right), Blue (Left)
  rec.tap({ move: { x: 0, y: -1 } }, 2);
  rec.tap({ move: { x: 1, y: 0 } }, 2);
  rec.tap({ move: { x: -1, y: 0 } }, 28);
  if (
    !isPuzzleSolved(world, rec.state, "mist-forest-seal") ||
    world.storyVariable(rec.state.ink, "seal_open") !== true
  ) {
    throw new Error("mist Beat 3 (mist-forest-seal / seal_open) did not solve!");
  }
  rec.write("tests/sim/scripts/mist/mist-3tool-seal.json");
  console.log(
    `mist/mist-3tool-seal.json: tick ${rec.state.tick}, hash ${stableHash(rec.state)}`,
  );
}

// 3. Starlight Island: Cozy Dash + Real 3-Note Seashell Flute Harmony!
{
  const fixture = fixtures.island;
  if (fixture === undefined) throw new Error("island fixture missing");
  const rec = new Recorder(world, createState(world, fixture));
  rec.walkAxis("x", 480, true);
  rec.walkAxis("y", 540, true);
  rec.tap({ flute: true }, 2);
  rec.tap({ move: { x: 0, y: -1 } }, 2);
  rec.tap({ move: { x: 1, y: 0 } }, 2);
  rec.tap({ move: { x: -1, y: 0 } }, 28);
  if (
    !isPuzzleSolved(world, rec.state, "island-seashell-harmony") ||
    world.storyVariable(rec.state.ink, "island_shells_solved") !== true
  ) {
    throw new Error("island-seashell-harmony did not solve!");
  }
  rec.write("tests/sim/scripts/island/island-flute-harmony.json");
  console.log(
    `island/island-flute-harmony.json: tick ${rec.state.tick}, hash ${stableHash(rec.state)}`,
  );
}
