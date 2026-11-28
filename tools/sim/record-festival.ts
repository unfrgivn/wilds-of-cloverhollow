#!/usr/bin/env bun
// Records the Post-Finale Sunny Cloverhollow Sanctuary Celebration Festival run:
// chains directly from golden-kid.json (in the restored Enchanted Forest with
// milo_revealed = true, forest_fizzy = false, and 8+ calmed valley animals),
// walks out through Misty Path -> Playing Field -> Gym -> East Hall -> School
// -> Cloverhollow Plaza -> Meadow Park -> Clover Hills -> Wildlife Sanctuary,
// verifies all 4 festival guests (Milo, Rosie, Dad, Chef Bea) appear beside
// Ranger Fern and the calmed valley critters, talks to Dad, Milo, Rosie (+1
// snack), and Chef Bea (sampling a warm honey-clover tart!), enjoys the
// post-finale checkered Picnic Blanket with Milo (+1 snack), and raises Ranger
// Fern's Sunny Cloverhollow Festival Toast (+25 coins & +2 snacks for 8+
// critters, plus +30 coins & +2 snacks from the Festival Star Pouch!).
//
//   bun tools/sim/record-festival.ts > tests/sim/scripts/new-game/festival.json
import { readFileSync } from "node:fs";
import { blankInput, createState, npcVisible } from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures["new-game"];
if (fixture === undefined) throw new Error("new-game fixture missing");
const play = createRecorder(world, createState(world, fixture));
const basePath = "tests/sim/scripts/new-game/golden-kid.json";
for (const segment of parseScript(JSON.parse(readFileSync(basePath, "utf8")), basePath))
  for (let count = 0; count < segment.ticks; count += 1) play.tick(segment.frame);

const story = (name: string): unknown => world.storyVariable(play.state().ink, name);
const must = (name: string, what: string): void => {
  if (story(name) !== true) throw new Error(what);
};
const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};
const door = (area: string, spawn: string, to: string): void => {
  play.navigate(spawnOf(area, spawn), 8);
  play.through(to);
};

if (play.state().area !== "enchanted") throw new Error("golden-kid didn't end in enchanted");
must("milo_revealed", "milo_revealed not set after golden-kid");
if (story("forest_fizzy") !== false) throw new Error("forest_fizzy still true");

// Walk out of the restored Enchanted Forest back to Cloverhollow Plaza, Meadow Park,
// Clover Hills, and into the sunlit Wildlife Sanctuary!
door("enchanted", "mist", "mist");
door("mist", "field", "field");
door("field", "gym", "gym");
door("gym", "door", "east-hall");
door("east-hall", "west", "school");
door("school", "front-doors", "plaza");
door("plaza", "park-path", "park");
play.clear();
door("park", "hills", "hills");
play.clear();
// Dismiss any shell-side level-up notices in Clover Hills before entering Sanctuary.
for (let i = 0; i < 4; i += 1) {
  play.idle(2);
  play.tick({ ...blankInput(), confirm: true });
}
play.idle(2);
play.navigate({ x: 1525, y: 408 }, 8);
play.leave({ x: 1, y: 0 }, "sanctuary");
if (play.state().area !== "sanctuary") throw new Error("didn't enter Wildlife Sanctuary");

const sanctuary = world.areas.sanctuary;
if (sanctuary === undefined) throw new Error("sanctuary area missing");
const visibleIds = sanctuary.npcs
  .filter((npc) => npcVisible(world, play.state(), npc))
  .map((npc) => npc.id)
  .sort();
for (const guest of ["milo", "rosie", "dad", "chef", "fern"]) {
  if (!visibleIds.includes(guest)) throw new Error(`festival guest ${guest} missing`);
}

// 1. Talk to Dad in the sunlit meadow.
play.approach("npc:dad");
play.talk("npc:dad");
must("festival_dad_talked", "festival_dad_talked not set");

// 2. Talk to Milo side-by-side from his west so both sprites & his sketchbook stay crystal clear.
play.navigate({ x: 785, y: 760 }, 2);
play.tick({ ...blankInput(), move: { x: 1, y: 0 } });
play.talk("npc:milo");
must("festival_milo_talked", "festival_milo_talked not set");

// 3. Talk to Rosie weaving clover garlands (+1 snack Clover Festival Lemonade!).
const snacksBeforeRosie = play.state().snacks;
play.approach("npc:rosie");
play.talk("npc:rosie");
must("festival_rosie_gift", "festival_rosie_gift not set");
if (play.state().snacks !== snacksBeforeRosie + 1) {
  throw new Error(`expected +1 snack from Rosie, got ${play.state().snacks - snacksBeforeRosie}`);
}

// 4. Talk to Chef Bea side-by-side from her west and sample a warm honey-clover festival tart!
play.navigate({ x: 985, y: 744 }, 2);
play.tick({ ...blankInput(), move: { x: 1, y: 0 } });
play.talk("npc:chef", [0]);
must("festival_chef_talked", "festival_chef_talked not set");

// 5. Enjoy the post-finale checkered Picnic Blanket with Milo (+1 snack!).
const snacksBeforePicnic = play.state().snacks;
play.approach("sanctuary-picnic");
play.talk("sanctuary-picnic");
must("sanctuary_picnic_basket", "sanctuary_picnic_basket not set");
if (play.state().snacks !== snacksBeforePicnic + 1) {
  throw new Error("sanctuary-picnic didn't award +1 snack");
}

// 6. Raise Ranger Fern's Sunny Cloverhollow Festival Toast (+25/+30 coins & +2/+2 snacks)!
const coinsBeforeFern = play.state().coins;
const snacksBeforeFern = play.state().snacks;
play.navigate({ x: 622, y: 792 }, 4);
play.tick({ ...blankInput(), move: { x: 1, y: 0 } });
play.talk("npc:fern", [0]);
must("sanctuary_visited", "sanctuary_visited not set");
must("festival_toast_done", "festival_toast_done not set");
if (play.state().coins < coinsBeforeFern + 30) {
  throw new Error(`expected at least +30 coins from Fern toast, got ${play.state().coins}`);
}
if (play.state().snacks < snacksBeforeFern + 2) {
  throw new Error(`expected at least +2 snacks from Fern toast, got ${play.state().snacks}`);
}

const end = play.state();
console.error(
  `festival: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, visible ${visibleIds.length}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
