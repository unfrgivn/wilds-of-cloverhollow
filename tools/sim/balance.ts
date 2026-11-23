import { readFileSync } from "node:fs";
import { createState, step } from "../../src/core";
import { levelForXp, statsForCommand } from "../../src/core/levels";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";

// Replay the careful-player routes used by the story, then compare the Fae
// level with the local encounter. The golden-path runs (Milestone 68) make
// each checkpoint the honest playthrough's own state, from a new game to the
// kid, exposing the XP that chapter really earns.
const content = loadContent();
const routes = [
  ["new-game", "new-game/chapter-one.json", "fountain-frog"],
  ["new-game", "new-game/east-road.json", "frog"],
  ["bay", "bay/lifeguard.json", "lifeguard"],
  ["new-game", "new-game/golden-jordan.json", "raccoon"],
  ["new-game", "new-game/golden-arcade.json", "arcade-keeper"],
  ["new-game", "new-game/golden-music.json", "music-bird"],
  ["new-game", "new-game/golden-field.json", "oak-squirrel"],
  ["new-game", "new-game/golden-art.json", "art-teacher"],
  ["new-game", "new-game/golden-forest.json", "owl"],
  ["new-game", "new-game/golden-kid.json", "hooded-kid"],
] as const;

for (const [fixtureName, path, critterId] of routes) {
  const fixture = content.fixtures[fixtureName];
  const critter = content.world.critters[critterId];
  if (fixture === undefined || critter === undefined) throw new Error(`${path}: missing content`);
  let state = createState(content.world, fixture);
  const script = parseScript(JSON.parse(readFileSync(`tests/sim/scripts/${path}`, "utf8")), path);
  for (const segment of script)
    for (let tick = 0; tick < segment.ticks; tick += 1)
      state = step(content.world, state, segment.frame).state;
  const faeLevel = levelForXp(content.world.levels, state.xp);
  const gap = critter.level - faeLevel;
  // "About a level" means one level either way for ordinary critters. Named
  // encounters (mini-bosses and the hooded kid) may be at most two ahead, but
  // there are no chapter-end exemptions. The careful route calms each recurring
  // critter that chases Fae once on that visit, rather than farming encounters.
  const named = critter.windUp !== null || critter.talk !== null;
  const upperGap = named ? 2 : 1;
  if (gap > upperGap || gap < -1)
    throw new Error(`${path}: Fae level ${faeLevel}, ${critter.name} level ${critter.level}`);
  console.log(`${path}: Fae ${faeLevel} (${state.xp} XP), ` +
    `${critter.name} ${critter.level}, gap ${gap}`);
}

for (const level of [1, 5, 9, 14]) {
  const power = statsForCommand(content.world.levels, "soothe", level).power;
  const commands = Math.ceil(100 / power);
  if (commands < 3 || commands > 5)
    throw new Error(`equal-level calm takes ${commands} commands at level ${level}`);
  console.log(`equal-level level ${level}: ${commands} Soothe commands`);
}
