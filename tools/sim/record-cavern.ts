#!/usr/bin/env bun
// Records the Crystal Cavern run: chains from golden-flute.json (in Meadow Park
// with the blacklight lantern, lasso, flute, and Pond Pup befriended), rides
// the bus to Pinecone Pass, walks up the north mountain gap into Crystal
// Cavern, calms a Duzzy Bat, uses the blacklight lantern on the glowing mural
// to light the crystal stepping stones, crosses the stream, calms a Glimmer
// Mole, lassos the Star Chime Geode, calls the Pond Pup to dive into the
// crystal spring, and returns to Pinecone Pass.
//
//   bun tools/sim/record-cavern.ts > tests/sim/scripts/new-game/cavern.json
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
if (play.state().area !== "park") throw new Error("golden-flute didn't end in park");
must("has_lantern", "no lantern");
must("has_lasso", "no lasso");
must("has_flute", "no flute");
must("pup_friend", "Pond Pup not befriended");

const spawnOf = (area: string, name: string): { x: number; y: number } => {
  const spawn = world.areas[area]?.spawns[name];
  if (spawn === undefined) throw new Error(`no ${area}.${name} spawn`);
  return spawn;
};

// Meadow Park -> Plaza -> bus to Pinecone Pass.
play.navigate(spawnOf("park", "plaza-path"), 6);
play.through("plaza");
play.approach("npc:bus-stop");
play.talk("npc:bus-stop", [0]);
play.idle(60);
if (play.state().area !== "pass") throw new Error("bus didn't reach Pinecone Pass");

// Walk up Pinecone Pass's north snow gap into Crystal Cavern.
for (let i = 0; i < 4; i += 1) {
  const blocker = play.state().wild.find((c) => c.mood === "chaos" && c.cooldownTicks === 0);
  if (blocker === undefined) break;
  play.meet(blocker.kind);
  play.battle(["run"]);
}
play.navigate({ x: 830, y: 220 }, 8);
play.leave({ x: 0, y: -1 }, "cavern");
if (play.state().area !== "cavern") throw new Error("didn't enter Crystal Cavern");

// Calm the Duzzy Bat on the west cavern floor and chat with it.
const bat = play.state().wild.find((critter) => critter.kind === "bat");
if (bat === undefined) throw new Error("no bat rolled in Crystal Cavern");
play.meet("bat");
play.battle(["juggle", "cast", "play", "soothe"]);
play.approach(`critter:wild:${bat.den}`);
play.talk(`critter:wild:${bat.den}`);

// Switch on the blacklight lantern and read the glowing mural to light the stepping stones.
play.lantern();
play.approach("glow:cavern-mural-glow", "down");
play.talk("glow:cavern-mural-glow");
must("cavern_bridge_lit", "mural didn't light the crystal stepping stones");
play.lantern();

// Cross the glowing crystal stepping stones into the east grotto.
play.navigate({ x: 1005, y: 560 }, 10);

// Calm the Glimmer Mole on the east cavern floor and chat with it.
const mole = play.state().wild.find((critter) => critter.kind === "crystal-mole");
if (mole === undefined) throw new Error("no crystal-mole rolled in Crystal Cavern");
play.meet("crystal-mole");
play.battle(["juggle", "cast", "play", "soothe"]);
play.approach(`critter:wild:${mole.den}`);
play.talk(`critter:wild:${mole.den}`);

// Lasso the golden Star Chime in the northeast arch.
play.approach("star-chime", "down");
play.talk("star-chime", [0]);
must("cavern_chime_rung", "star chime wasn't lassoed");

// Call the Pond Pup with the flute and dive into the glowing crystal spring.
play.flute([0]);
must("pup_with_me", "Pond Pup didn't answer the flute");
play.approach("crystal-spring", "up");
play.talk("crystal-spring", [0]);
must("cavern_spring_found", "crystal spring pouch wasn't fetched");

// Walk back across the crystal stepping stones and return to Pinecone Pass.
play.navigate({ x: 350, y: 810 }, 10);
play.leave({ x: 0, y: 1 }, "pass");

const end = play.state();
if (end.area !== "pass") throw new Error("didn't return to Pinecone Pass");
if (!end.stickers.includes("cozy-bat") || !end.stickers.includes("gem-mole"))
  throw new Error("missing cavern stickers");
console.error(
  `cavern: ${end.tick} ticks, ${play.script.length} segments, ` +
    `coins ${end.coins}, snacks ${end.snacks}, in ${end.area}`,
);
console.log(JSON.stringify(play.script, null, 2));
