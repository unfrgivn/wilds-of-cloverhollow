#!/usr/bin/env bun
// Records the Milo's Sketch Loft & Rosie's Flower Cottage neighborhood run:
// chains from golden-arcade.json (in the arcade with Maddie, Sue, Jordan,
// hall pass, coins, and Jordan's blacklight lantern), exits onto Cloverhollow
// Plaza, walks southeast into Meadow Park, enters Milo's Sketch Loft via the
// WNW fence gap, inspects Milo's art desk (+10 coins, milo_loft_visited),
// turns on the blacklight lantern to read the glowing invisible-ink rocket
// margin note (milo-loft-glow, +10 coins), exits back onto Meadow Park, walks
// north into Rosie's Flower Cottage via the NNW sunlit gap, talks to Rosie
// from cleanly below facing "up" (Sunlit Clover Tea Snack +1 snack,
// rosie_cottage_visited), turns on the blacklight lantern to read Rosie's
// Four-Leaf Clover Fairy Doodle (rosie-cottage-glow, +10 coins), and exits
// back onto Meadow Park.
//
//   bun tools/sim/record-milo-rosie.ts > tests/sim/scripts/new-game/milo-rosie.json
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

// Exit Cloverhollow Arcade onto Cloverhollow Plaza and walk SE into Meadow Park.
play.navigate({ x: 230, y: 470 });
play.through("plaza");
if (play.state().area !== "plaza") throw new Error("didn't exit arcade to plaza");

play.navigate({ x: 1320, y: 860 }, 10);
play.navigate({ x: 1470, y: 950 }, 12);
play.leave({ x: 0, y: 1 }, "park");
if (play.state().area !== "park") throw new Error("didn't enter Meadow Park");

// Walk west along Meadow Park's open grassy shoulder (well clear of both dens!)
// and enter Milo's Sketch Loft through the WNW fence gap.
play.navigate({ x: 240, y: 740 }, 12);
play.navigate({ x: 185, y: 580 }, 12);
play.navigate({ x: 185, y: 475 }, 8);
play.leave({ x: -1, y: 0 }, "milo-house");
if (play.state().area !== "milo-house") throw new Error("didn't enter Milo's Sketch Loft");

// Inspect Milo's art desk (milo_loft_visited + 10 stray coins).
play.approach("milo-desk", "down");
play.talk("milo-desk");
must("milo_loft_visited", "didn't mark milo_loft_visited");
must("milo_desk_checked", "didn't mark milo_desk_checked");

// Switch on blacklight lantern and read Milo's invisible-ink rocket margin note (+10 coins).
play.lantern();
play.navigate({ x: 815, y: 535 }, 6);
play.face("right");
play.talk("glow:milo-loft-glow");
must("milo_loft_glow_read", "didn't read milo-loft-glow");
play.lantern();

// Exit Milo's Sketch Loft back onto Meadow Park.
play.navigate({ x: 240, y: 520 }, 8);
play.leave({ x: -1, y: -1 }, "park");
if (play.state().area !== "park") throw new Error("didn't exit milo-house back to park");

// Walk northeast behind the NW fence to the sunlit meadow gap into Rosie's Flower Cottage.
play.navigate({ x: 245, y: 380 }, 10);
play.navigate({ x: 465, y: 310 }, 10);
play.leave({ x: 0, y: -1 }, "rosie-cottage");
if (play.state().area !== "rosie-cottage") throw new Error("didn't enter Rosie's Flower Cottage");

// Walk to Rosie's left side facing "right" so both Fae and Rosie are 100% unoccluded, then talk!
play.navigate({ x: 725, y: 515 }, 6);
play.face("right");
play.talk("npc:rosie");
must("rosie_cottage_visited", "didn't mark rosie_cottage_visited");

// Switch on blacklight lantern and read Rosie's Four-Leaf Clover Fairy Doodle (+10 coins).
play.lantern();
play.navigate({ x: 465, y: 535 }, 6);
play.face("left");
play.talk("glow:rosie-cottage-glow");
must("rosie_cottage_glow_read", "didn't read rosie-cottage-glow");
play.lantern();

// Exit Rosie's Flower Cottage back onto Meadow Park.
play.navigate({ x: 240, y: 505 }, 8);
play.leave({ x: -1, y: -1 }, "park");

const end = play.state();
if (end.area !== "park") throw new Error("didn't exit rosie-cottage back to park");
console.error(
  `milo-rosie: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
