#!/usr/bin/env bun
// Records the Alpine Summit Overlook & Rideable Pinecone Pass Ski Lift run:
// chains from golden-lodge.json (inside Mountain Lodge with Maddie, Sue, Jordan,
// blacklight lantern, and Mrs. Flurry calmed), exits Mountain Lodge onto Pinecone
// Pass, clears any roaming critters along the slope, walks up to the ski-lift,
// rides up to Alpine Summit Overlook, uses the Panoramic Valley Telescope to look
// east toward Bubblegum Bay (+10 coins, summit_visited), grabs Mrs. Flurry's warm
// cocoa from the thermos bench (+2 snacks, summit_cocoa_taken), switches on the
// blacklight lantern to read the glowing Aurora Cairn (+15 coins,
// summit_aurora_read), and rides the ski lift cleanly back down to Pinecone Pass.
//
//   bun tools/sim/record-summit.ts > tests/sim/scripts/new-game/summit.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-lodge.json";
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

if (play.state().area !== "lodge") throw new Error("golden-lodge didn't end in lodge");

// Exit Mountain Lodge back onto Pinecone Pass.
play.navigate({ x: 250, y: 540 }, 10);
play.leave({ x: -1, y: -1 }, "pass");
if (play.state().area !== "pass") throw new Error("didn't exit lodge to pass");

// Calm any wild critters in the pass so the walk up to the ski lift is unhurried.
play.clear();

// Walk up to the Pinecone Pass ski lift and ride up to Alpine Summit Overlook!
play.approach("ski-lift", "down");
play.talk("ski-lift", [0]);
waitFade();
if (play.state().area !== "summit") throw new Error("ski lift didn't carry Fae to summit");

// Walk to the north-northeast Panoramic Valley Telescope and look east toward Bubblegum Bay (+10c).
play.approach("summit-telescope", "down");
play.talk("summit-telescope", [1, 3]);
must("summit_visited", "didn't mark summit_visited");
must("summit_telescope_used", "didn't mark summit_telescope_used");

// Walk to the warming-hut wooden bench thermos for Mrs. Flurry's warm cocoa (+2 snacks).
play.navigate({ x: 1240, y: 840 }, 8);
play.face("up");
play.talk("summit-thermos");
must("summit_cocoa_taken", "didn't mark summit_cocoa_taken");

// Switch on Jordan's blacklight lantern and read the glowing Aurora Cairn (+15 coins).
play.lantern();
play.navigate({ x: 582, y: 560 }, 6);
play.face("left");
play.talk("glow:summit-cairn-glow");
must("summit_aurora_read", "didn't mark summit_aurora_read");
play.lantern();

// Ride the ski lift cleanly back down to Pinecone Pass (pass.ski-lift).
play.navigate({ x: 465, y: 875 }, 6);
play.face("left");
play.talk("summit-lift", [0]);
waitFade();

const end = play.state();
if (end.area !== "pass") throw new Error("ski lift didn't carry Fae back down to pass");
console.error(
  `summit: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
