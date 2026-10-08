#!/usr/bin/env bun
// Records a walk round an indoor room's props (Milestone 33), for the kit
// e2e: from the room's fixture, to the spot where a prop hides the most of
// Fae (she's behind it), then to the spot in front of that prop where her
// picture overlaps it the most, then toward its footprint's nearest point,
// where its footprint stops her. Each stop is held 30 ticks so a watcher can
// look. A room where no prop
// can hide her (all its furniture backs onto the walls) skips the first stop.
// The prop and both spots come from the content (tools/art/prop-spots.ts), so
// the walk follows the kit when it changes; it keeps clear of set-piece
// critters, whose touch would start a battle.
//
//   bun tools/sim/record-kits.ts <room>
//     > tests/sim/scripts/<room's fixture>/kit-<room>.json
import {
  createState, distanceToPolygon, presentCritters, propState, type Point,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { propSpots } from "../art/prop-spots";
import { createRecorder } from "./recorder";

// The fixture each room is walked from.
const kitFixtures: Record<string, string> = {
  bedroom: "new-game",
  kitchen: "kitchen",
  school: "school",
  classroom: "classroom",
  gym: "gym",
  arcade: "arcade",
};

const room = process.argv[2] ?? "";
const fixtureName = kitFixtures[room];
const { world, fixtures } = loadContent();
const fixture = fixtureName === undefined ? undefined : fixtures[fixtureName];
const area = world.areas[room];
if (fixture === undefined || area === undefined)
  throw new Error(`usage: bun tools/sim/record-kits.ts ${Object.keys(kitFixtures).join("|")}`);
const play = createRecorder(world, createState(world, fixture));
const start = play.state();
const critters = presentCritters(world, start);
const clear = (feet: Point): boolean => critters.every((critter) =>
  Math.hypot(feet.x - critter.point.x, feet.y - critter.point.y) >
    critter.kind.touchRadius + world.tunables.playerRadius + 40);
const spots = propSpots(world, area, start.ink, clear);
const hiding = spots.filter((spot) => spot.behind !== undefined && spot.front !== undefined)
  .sort((a, b) => (b.behind?.covered ?? 0) - (a.behind?.covered ?? 0))[0];
const chosen = hiding ?? spots.filter((spot) => spot.front !== undefined)
  .sort((a, b) => (b.front?.overlap ?? 0) - (a.front?.overlap ?? 0))[0];
if (chosen?.front === undefined) throw new Error(`${room}: no prop to walk up to`);
if (chosen.behind !== undefined) {
  play.navigate(chosen.behind.feet, 3);
  play.idle(30);
}
play.navigate(chosen.front.feet, 3);
play.idle(30);
// Toward the nearest point of its footprint's outline, on the 8 arrow keys.
const prop = area.props.find((item) => item.id === chosen.id);
if (prop === undefined) throw new Error(`${room}: no prop ${chosen.id}`);
const feet = play.state().player;
const closest = (a: Point, b: Point): Point => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const along = Math.max(0, Math.min(1,
    ((feet.x - a.x) * dx + (feet.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + along * dx, y: a.y + along * dy };
};
const nearest = propState(world, start.ink, prop).footprint.flatMap((polygon) =>
  polygon.map(([x, y], index) => {
    const [nx, ny] = polygon[(index + 1) % polygon.length] ?? [x, y];
    return closest({ x, y }, { x: nx, y: ny });
  }))
  .sort((a, b) => Math.hypot(a.x - feet.x, a.y - feet.y) - Math.hypot(b.x - feet.x, b.y - feet.y))
  .at(0);
if (nearest === undefined) throw new Error(`${room}: ${chosen.id} has no footprint`);
const toward = (gap: number): number => Math.abs(gap) < 8 ? 0 : Math.sign(gap);
play.hold({ x: toward(nearest.x - feet.x), y: toward(nearest.y - feet.y) }, 30);
play.idle(30);
const gap = Math.min(...propState(world, start.ink, prop).footprint
  .map((polygon) => distanceToPolygon(play.state().player, polygon)));
if (gap > world.tunables.playerRadius + 1)
  throw new Error(`${room}: walking toward ${chosen.id} stopped ${gap.toFixed(1)} from it`);
const end = play.state();
if (end.area !== room || end.battle !== null || end.dialogue !== null)
  throw new Error(`${room}: the walk went somewhere else`);
console.error(`kit-${room}: ${chosen.id}, ` +
  `${chosen.behind === undefined ? "no spot behind" : `behind at (${chosen.behind.feet.x}, ` +
  `${chosen.behind.feet.y}) ${Math.round(chosen.behind.covered * 100)}% hidden`}, ` +
  `in front at (${chosen.front.feet.x}, ${chosen.front.feet.y}), ` +
  `stopped at (${end.player.x.toFixed(1)}, ${end.player.y.toFixed(1)}); ` +
  `${end.tick} ticks, ${play.script.length} segments`);
console.log(JSON.stringify(play.script, null, 2));
