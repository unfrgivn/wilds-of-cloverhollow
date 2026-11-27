#!/usr/bin/env bun
// Records the Wildlife Sanctuary run: chains from m81-festival.json (in Clover
// Hills with Maddie, Sue, Jordan, and 8 calmed valley animals), walks east into
// the Wildlife Sanctuary, verifies the 8 calmed animals visibly populate the
// meadow while uncalmed species stay hidden, talks to Ranger Fern for the 8+
// milestone reward (+25 coins, +2 snacks), reads the Sanctuary Board, pets
// Fountain Frog and Starry Owl, enjoys the Sanctuary Meadow Picnic (+1 snack),
// and walks back out through the SW archway to Clover Hills.
//
//   bun tools/sim/record-sanctuary.ts > tests/sim/scripts/new-game/sanctuary.json
import { readFileSync } from "node:fs";
import { blankInput, createState, npcVisible } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/m81-festival.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
if (play.state().area !== "hills") throw new Error("m81-festival didn't end in hills");

// Walk north-east across Clover Hills to the sunlit east meadow exit into sanctuary.
play.navigate({ x: 1525, y: 408 }, 8);
play.leave({ x: 1, y: 0 }, "sanctuary");
if (play.state().area !== "sanctuary") throw new Error("didn't enter Wildlife Sanctuary");

const sanctuary = world.areas.sanctuary;
if (sanctuary === undefined) throw new Error("sanctuary area missing");
const visibleNow = sanctuary.npcs
  .filter((npc) => npcVisible(world, play.state(), npc))
  .map((npc) => npc.id)
  .sort();
if (visibleNow.length !== 9)
  throw new Error(`expected 9 visible NPCs in sanctuary, got ${visibleNow.length}`);

// Greet Ranger Fern from south-west (~58u apart, clear of her hat brim) for the 8+ reward.
const coinsBefore = play.state().coins;
const snacksBefore = play.state().snacks;
play.navigate({ x: 622, y: 792 }, 2);
play.tick({ ...blankInput(), move: { x: 1, y: 0 } });
play.talk("npc:fern");
must("sanctuary_visited", "sanctuary_visited not set");
must("sanctuary_reward_8", "sanctuary_reward_8 not awarded");
must("sanctuary_reward_3", "sanctuary_reward_3 not set");
if (play.state().coins !== coinsBefore + 25)
  throw new Error(`expected +25 coins from Ranger Fern, got ${play.state().coins - coinsBefore}`);
if (play.state().snacks !== snacksBefore + 2)
  throw new Error(`expected +2 snacks from Ranger Fern, got ${play.state().snacks - snacksBefore}`);

// Read the live Sanctuary Resident Board.
play.approach("sanctuary-board", "down");
play.talk("sanctuary-board");

// Walk up the sunlit west path and pet Fountain Frog from ~57u due east (side-by-side!).
play.navigate({ x: 423, y: 454 }, 2);
play.tick({ ...blankInput(), move: { x: -1, y: 0 } });
play.talk("npc:sanctuary-frog");

// Stroll across the sunny meadow and pet Starry Owl from its left side!
play.approach("npc:sanctuary-moon-owl", "right");
play.talk("npc:sanctuary-moon-owl");

// Sit on the red-and-cream gingham picnic blanket for the Sanctuary Meadow Picnic (+1 snack).
const snacksPrePicnic = play.state().snacks;
play.approach("sanctuary-picnic");
play.talk("sanctuary-picnic");
must("sanctuary_picnic_basket", "picnic basket snack not awarded");
if (play.state().snacks !== snacksPrePicnic + 1)
  throw new Error("picnic didn't award +1 snack");

// Walk back out through the SW timber archway to Clover Hills.
play.navigate({ x: 350, y: 795 }, 8);
play.leave({ x: -1, y: 1 }, "hills");
const end = play.state();
if (end.area !== "hills") throw new Error("didn't return to Clover Hills");

console.error(
  `sanctuary: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, visible ${visibleNow.length}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
