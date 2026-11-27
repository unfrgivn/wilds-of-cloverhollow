#!/usr/bin/env bun
// Records Cloverhollow's Final Two Plaza Shops run: chains from
// golden-arcade.json (in the arcade with Maddie, Sue, Jordan, coins, and
// Jordan's blacklight lantern), exits out onto Cloverhollow Plaza, enters
// Cloverhollow Grocery Market via market-door, talks to Grocer Pippin for his
// free Orchard Apple sample & buys an Orchard Apple, turns on the blacklight
// lantern to read the glowing recipe note (market-list-glow, +10 coins), exits
// back to Cloverhollow Plaza (with den 0 kept safely quiet on shop exit!),
// enters Sweet Scoop Ice Cream Parlor via parlor-door, talks to Scooper Penny
// to mix a free Strawberry Swirl Dream Sundae & buys a Berry Swirl Cone, turns
// on the blacklight lantern to read the glowing Secret Sundae Club doodle
// (parlor-secret-glow, +10 coins), and exits back onto Cloverhollow Plaza.
//
//   bun tools/sim/record-plaza-shops.ts > tests/sim/scripts/new-game/plaza-shops.json
import { readFileSync } from "node:fs";
import { createState } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const path = "tests/sim/scripts/new-game/golden-arcade.json";
for (const segment of parseScript(JSON.parse(readFileSync(path, "utf8")), path))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "arcade") throw new Error("golden-arcade didn't end in arcade");

// Exit Cloverhollow Arcade onto Cloverhollow Plaza.
play.navigate({ x: 230, y: 470 });
play.through("plaza");
if (play.state().area !== "plaza") throw new Error("didn't exit arcade to plaza");

// Walk around the south side of the fountain and up to Cloverhollow Grocery Market's door.
play.navigate({ x: 1320, y: 860 }, 10);
play.navigate({ x: 460, y: 860 }, 10);
play.navigate({ x: 540, y: 390 }, 10);
play.navigate({ x: 695, y: 378 }, 8);
play.leave({ x: 0, y: -1 }, "market");
if (play.state().area !== "market") throw new Error("didn't enter Cloverhollow Grocery Market");

// Talk to Grocer Pippin for his free Orchard Apple sample and buy an Orchard Apple (choice 0).
play.navigate({ x: 825, y: 576 }, 6);
play.face("up");
play.talk("npc:pippin", [0]);
must("market_visited", "didn't mark market_visited");

// Switch on the blacklight lantern and read the glowing Cloverhollow Recipe Note.
play.lantern();
play.navigate({ x: 505, y: 440 }, 8);
play.face("up");
play.talk("glow:market-list-glow");
must("market_note_read", "didn't read market-list-glow");
play.lantern();

// Exit Cloverhollow Grocery Market back onto Cloverhollow Plaza (den 0 stays quiet on arrival!).
play.navigate({ x: 235, y: 505 }, 8);
play.leave({ x: -1, y: -1 }, "plaza");
if (play.state().area !== "plaza") throw new Error("didn't exit market back to plaza");

// Walk straight east across the north apron to Sweet Scoop Ice Cream Parlor's door.
play.navigate({ x: 938, y: 376 }, 8);
play.leave({ x: 0, y: -1 }, "parlor");
if (play.state().area !== "parlor") throw new Error("didn't enter Sweet Scoop Ice Cream Parlor");

// Talk to Scooper Penny: pick Strawberry Swirl! (0) then buy a Berry Swirl Cone (0).
play.navigate({ x: 545, y: 562 }, 6);
play.face("up");
play.talk("npc:penny", [0, 0]);
must("parlor_visited", "didn't mark parlor_visited");

// Switch on the blacklight lantern and read the glowing Secret Sundae Club doodle.
play.lantern();
play.navigate({ x: 865, y: 632 }, 8);
play.face("right");
play.talk("glow:parlor-secret-glow");
must("parlor_note_read", "didn't read parlor-secret-glow");
play.lantern();

// Exit Sweet Scoop Ice Cream Parlor back onto Cloverhollow Plaza.
play.navigate({ x: 215, y: 515 }, 8);
play.leave({ x: -1, y: -1 }, "plaza");

const end = play.state();
if (end.area !== "plaza") throw new Error("didn't exit parlor back to plaza");
if ((end.treats?.["orchard-apple"] ?? 0) !== 1) throw new Error("missing Orchard Apple purchase");
if ((end.treats?.["berry-cone"] ?? 0) !== 1) throw new Error("missing Berry Swirl Cone purchase");
console.error(
  `plaza-shops: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, ` +
    `treats ${JSON.stringify(end.treats)}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
