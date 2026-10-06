import { readFileSync } from "node:fs";
import {
  createState,
  distanceToPolygon,
  pointInPolygon,
  step,
  type Critter,
  type PartyContent,
  type Point,
  type World,
} from "../../src/core";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// A two-member party through the harness: Maddie, then a content-less second
// member who chains behind her. Every tick, every member must be on the floor
// and out of the blockers, and nobody may teleport. Maddie must walk exactly
// where she walks alone.
const content = loadContent();
const scout: PartyContent = {
  id: "scout",
  name: "Scout",
  atlas: "assets/characters/scout/scout.json",
  box: { width: 50, height: 140 },
  walkCycleUnits: 84,
  sits: false,
  start: false,
  command: { id: "whistle", label: "Whistle", resting: "catching breath" },
};
const whistle = { calm: 25, great: 10, good: 5, rest: 2 };
const whistleLines = {
  great: "Scout whistles a bright tune.",
  good: "Scout whistles.",
  miss: "Scout squeaks.",
};
const withScout = (critter: Critter): Critter => ({
  ...critter,
  commands: { ...critter.commands, friends: { ...critter.commands.friends, whistle } },
  lines: { ...critter.lines, friends: { ...critter.lines.friends, whistle: whistleLines } },
});
const twoWorld: World = {
  ...content.world,
  party: { ...content.world.party, scout },
  critters: Object.fromEntries(
    Object.entries(content.world.critters).map(([id, critter]) => [id, withScout(critter)]),
  ),
};
const fixture = content.fixtures.harness;
if (fixture === undefined) throw new Error("harness fixture missing");
const path = "tests/sim/scripts/harness/harness-600.json";
const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
const radius = content.world.tunables.follow.radius - 0.01;
const maxStep = (content.world.tunables.walkSpeed / 60) * content.world.tunables.follow.catchUp
  + 1e-9;
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

let alone = createState(content.world, fixture);
let together = createState(twoWorld, { ...fixture, party: ["maddie", "scout"] });
if (together.party.map((member) => member.id).join(",") !== "maddie,scout")
  throw new Error("the party did not spawn as maddie,scout");
for (const segment of script)
  for (let tick = 0; tick < segment.ticks; tick += 1) {
    const previous = together.party.map((member) => ({ x: member.x, y: member.y }));
    alone = step(content.world, alone, segment.frame).state;
    together = step(twoWorld, together, segment.frame).state;
    const area = twoWorld.areas[together.area];
    if (area === undefined) throw new Error(`unknown area ${together.area}`);
    together.party.forEach((member, index) => {
      if (!pointInPolygon(member, area.walkable) ||
          distanceToPolygon(member, area.walkable) < radius)
        throw new Error(`${member.id} left the floor at tick ${together.tick}`);
      for (const blocker of area.blockers)
        if (pointInPolygon(member, blocker) || distanceToPolygon(member, blocker) < radius)
          throw new Error(`${member.id} entered a blocker at tick ${together.tick}`);
      const was = previous[index];
      if (was !== undefined && distance(was, member) > maxStep)
        throw new Error(`${member.id} teleported at tick ${together.tick}`);
    });
    if (JSON.stringify(together.party[0]) !== JSON.stringify(alone.party[0]))
      throw new Error(`Maddie walked differently with a second member at tick ${together.tick}`);
  }
const [maddie, second] = together.party;
if (maddie === undefined || second === undefined) throw new Error("party short");
if (distance(second, together.player) <= distance(maddie, together.player))
  throw new Error("the second member ended up ahead of Maddie");
const behind = distance(second, maddie).toFixed(1);
console.log(`party-chain: tick ${together.tick} ok, scout ${behind} behind Maddie`);
