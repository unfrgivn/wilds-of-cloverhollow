#!/usr/bin/env bun
// Records the Other Kids' Houses run: chains from golden-lantern.json (already
// at Pinecone Pass with Maddie, Sue, Jordan, and the blacklight lantern),
// walks west into Jordan's Mountain Cabin, inspects his botany/cocoa table for
// the Pressed Alpine Clover & cocoa snack, turns on the blacklight lantern to
// read his glowing trail-blaze map, exits back to Pinecone Pass, rides the Star
// Bus down to Bubblegum Bay, walks NW into Sue's Beach Cottage, inspects her
// tackle workbench for the Sea-Glass Compass & coins, grabs coastal snacks from
// the wicker basket, reads her glowing star chart under the blacklight lantern,
// and exits back onto Bubblegum Bay.
//
//   bun tools/sim/record-friend-homes.ts > tests/sim/scripts/new-game/friend-homes.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-lantern.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "pass") throw new Error("golden-lantern didn't end in pass");

// Pinecone Pass -> walk west along the snow trail into Jordan's Mountain Cabin.
play.navigate({ x: 265, y: 580 }, 10);
play.leave({ x: -1, y: 0 }, "jordan-cabin");
if (play.state().area !== "jordan-cabin") throw new Error("didn't enter Jordan's Mountain Cabin");

// Inspect Jordan's botany & cocoa table (Pressed Alpine Clover + 1 cocoa snack).
play.approach("jordan-table", "down");
play.talk("jordan-table");
must("jordan_cabin_visited", "didn't visit Jordan's cabin");
must("jordan_clover", "didn't receive Jordan's Pressed Alpine Clover");

// Switch on blacklight lantern and read Jordan's glowing trail-blaze mountain map.
play.lantern();
play.navigate({ x: 870, y: 512 }, 6);
play.face("right");
play.talk("glow:jordan-map-glow");
must("jordan_note_read", "didn't read Jordan's glowing mountain map");
play.lantern();

// Exit Jordan's Mountain Cabin back onto Pinecone Pass.
play.navigate({ x: 245, y: 525 }, 8);
play.leave({ x: -1, y: -1 }, "pass");
if (play.state().area !== "pass") throw new Error("didn't exit Jordan's cabin to pass");

// Walk to the Pinecone Pass Star Bus stop and ride down to Bubblegum Bay.
play.approach("pass-bus-stop", "down");
play.talk("pass-bus-stop", [1]);
play.idle(60);
if (play.state().area !== "bay") throw new Error("Star Bus didn't take Fae to Bubblegum Bay");

// Walk NW along the sandy cove into Sue's Beach Cottage.
play.navigate({ x: 285, y: 145 }, 10);
play.leave({ x: 0, y: -1 }, "sue-cottage");
if (play.state().area !== "sue-cottage") throw new Error("didn't enter Sue's Beach Cottage");

// Inspect Sue's tackle workbench (Golden Starfish Crown tip + Sea-Glass Compass + 10 coins).
play.approach("sue-workbench", "down");
play.talk("sue-workbench");
must("sue_cottage_visited", "didn't visit Sue's cottage");
must("sue_compass", "didn't receive Sue's Sea-Glass Compass");

// Grab 2 free beach snacks from Sue's depth-sorted wicker snack basket.
play.approach("sue-snacks", "left");
play.talk("sue-snacks");
must("sue_basket_taken", "didn't take coastal snacks from Sue's basket");

// Switch on blacklight lantern and read Sue's glowing Bay Explorers Club star chart.
play.lantern();
play.navigate({ x: 610, y: 478 }, 10);
play.navigate({ x: 800, y: 478 }, 6);
play.face("right");
play.talk("glow:sue-secret-note");
must("sue_note_read", "didn't read Sue's glowing star chart");
play.lantern();

// Exit Sue's Beach Cottage back onto Bubblegum Bay.
play.navigate({ x: 245, y: 520 }, 8);
play.leave({ x: -1, y: -1 }, "bay");

const end = play.state();
if (end.area !== "bay") throw new Error("didn't exit Sue's cottage back to bay");
console.error(
  `friend-homes: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
