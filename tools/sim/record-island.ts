#!/usr/bin/env bun
// Records the Starlight Island & Bubblegum Bay Rowboat Crossing run:
// chains from golden-flute.json (in Meadow Park with Maddie, Sue, Jordan,
// blacklight lantern, and silver flute), exits south-west to Cloverhollow
// Plaza, rides the bus to Bubblegum Bay, clears roaming bay critters, walks to
// bay-boats, rows out to Starlight Island (island.pier), plays the 4-note
// Seashell Chime puzzle at the NW tide pool with the flute harmony (+20 coins,
// island_shells_solved), visits the NE Tide-Pool Lighthouse for the snack tin
// (+2 snacks, island_visited, island_lighthouse_checked), uncorks the SE
// Message-in-a-Bottle (+15 coins, island_bottle_found), switches on Jordan's
// blacklight lantern to read the glowing Starlight Runes (+10 coins,
// island_glow_read), and rows cleanly back to Bubblegum Bay (bay.boats).
//
//   bun tools/sim/record-island.ts > tests/sim/scripts/new-game/island.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-flute.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
const waitFade = (): void => {
  for (let count = 0; count < 90 && play.state().transition !== null; count += 1) play.idle(1);
  if (play.state().transition !== null) throw new Error("transition never finished");
};

if (play.state().area !== "park") throw new Error("golden-flute didn't end in park");
must("sue_joined", "sue_joined missing");
must("has_lantern", "has_lantern missing");
must("has_flute", "has_flute missing");

// Exit Meadow Park south-west into Cloverhollow Plaza, clearing any wild critter on the way.
play.clear();
play.navigate({ x: 240, y: 920 }, 12);
play.leave({ x: 0, y: 1 }, "plaza");
if (play.state().area !== "plaza") throw new Error("didn't exit park to plaza");

// Ride the bus from Cloverhollow Plaza to Bubblegum Bay (choice 1: Bubblegum Bay!).
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [1]);
waitFade();
if (play.state().area !== "bay") throw new Error("bus didn't carry Fae to bay");

// Calm roaming bay critters so the walk along the beach to bay-boats is smooth.
play.clear();

// Walk to bay-boats and row out to Starlight Island (choice 1: Row out to Starlight Island!).
play.navigate({ x: 1350, y: 690 }, 10);
play.face("up");
play.talk("bay-boats", [1]);
waitFade();
if (play.state().area !== "island") throw new Error("rowboat didn't carry Fae to island");

// Play the 4-note Seashell Chime puzzle at the NW tide pool (with flute harmony -> +20 coins).
play.navigate({ x: 545, y: 520 }, 8);
play.face("up");
play.talk("island-shells", [0]);
must("island_shells_solved", "didn't mark island_shells_solved");

// Climb up to the NE coral-striped Tide-Pool Lighthouse for the Sea-Breeze Snack Tin (+2 snacks).
play.navigate({ x: 1205, y: 472 }, 8);
play.face("up");
play.talk("island-lighthouse");
must("island_visited", "didn't mark island_visited");
must("island_lighthouse_checked", "didn't mark island_lighthouse_checked");

// Walk south to the SE Message-in-a-Bottle beside the driftwood log (+15 coins).
play.navigate({ x: 1255, y: 868 }, 8);
play.face("up");
play.talk("island-bottle");
must("island_bottle_found", "didn't mark island_bottle_found");

// Switch on Jordan's blacklight lantern and read the bioluminescent Starlight Runes (+10 coins).
play.lantern();
play.navigate({ x: 1030, y: 440 }, 8);
play.face("left");
play.talk("glow:island-beacon-glow");
must("island_glow_read", "didn't mark island_glow_read");
play.lantern();

// Walk down onto the SW wooden landing pier and row cleanly back to Bubblegum Bay (bay.boats).
play.navigate({ x: 405, y: 810 }, 8);
play.face("left");
play.talk("island-boat", [0]);
waitFade();

const end = play.state();
if (end.area !== "bay") throw new Error("rowboat didn't carry Fae back to bay");
console.error(
  `island: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
