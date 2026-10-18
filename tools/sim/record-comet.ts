#!/usr/bin/env bun
// Records Comet Cruise (Milestone 59) from the arcade fixture: Mr. Pip calmed,
// then a run with fourteen stars caught (the first two let go), the first rock
// bumped and the rest slipped past, and its result read and closed.
//
//   bun tools/sim/record-comet.ts > tests/sim/scripts/arcade/comet.json
import {
  blankInput, cometTravel, createState, type ActionFrame, type CometGame,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { createRecorder } from "./recorder";

const { world, fixtures } = loadContent();
const fixture = fixtures.arcade;
if (fixture === undefined) throw new Error("arcade fixture missing");
const play = createRecorder(world, createState(world, fixture));
const comet = world.arcade.comet;
const game = (): CometGame => {
  const arcade = play.state().arcade;
  if (arcade?.game !== "comet") throw new Error("no Comet Cruise round is open");
  return arcade;
};
const frame = (move: -1 | 0 | 1): ActionFrame => ({ ...blankInput(),
  move: { x: move, y: 0 } });
const steer = (target: 0 | 1 | 2): void => {
  const current = game().lane;
  if (current < target) { play.tick(frame(1)); play.idle(1); }
  else if (current > target) { play.tick(frame(-1)); play.idle(1); }
  else play.idle(1);
};

play.meet("arcade-keeper");
play.battle(["juggle", "cast"]);
play.approach("comet-cruise");
play.talk("comet-cruise", [0]);
for (let count = 0; count < 100 && game().phase === "ready"; count += 1) play.idle(1);

const letGo = new Set(game().objects.filter((object) => object.kind === "star")
  .slice(0, 2).map((object) => object.index));
const bumpIndex = game().objects.find((object) => object.kind === "rock")?.index ?? -1;
for (let count = 0; count < 10000 && game().phase === "playing"; count += 1) {
  const current = game();
  const next = current.objects
    .filter((object) => object.status === "coming")
    .sort((a, b) => a.index - b.index)[0];
  if (next === undefined) {
    play.idle(1);
    continue;
  }
  const arrival = next.spawn + cometTravel(comet, next.index);
  const target = next.kind === "rock" && next.index === bumpIndex
    ? next.lane
    : next.kind === "star" && !letGo.has(next.index)
      ? next.lane
      : next.lane === 0 ? 1 : 0;
  if (current.elapsed + comet.moveTicks >= arrival || current.lane !== target) steer(target);
  else play.idle(1);
}
if (game().phase !== "result") throw new Error("Comet Cruise did not reach its result");
for (let count = 0; count < 200 && game().revealed < game().message.length; count += 1)
  play.idle(1);
play.press();
const end = play.state();
if (end.arcade !== null || end.dialogue !== null)
  throw new Error("the result did not close, or a talk opened after it");
console.log(JSON.stringify(play.script, null, 2));
