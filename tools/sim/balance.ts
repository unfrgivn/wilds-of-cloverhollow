import { readFileSync } from "node:fs";
import {
  CLUBHOUSE_SWATCH_IDS,
  createState,
  plushPedestalPrice,
  step,
  swatchPriceFor,
} from "../../src/core";
import { levelForXp, statsForCommand } from "../../src/core/levels";
import { loadContent } from "../../src/content/load";
import { parseScript } from "../../src/content/script";
import { runE7FormationSim } from "./e7-formations";

// Replay the careful-player routes used by the story, then compare the Fae
// level with the local encounter. The golden-path runs (Milestone 68) make
// each checkpoint the honest playthrough's own state, from a new game to the
// kid, exposing the XP that chapter really earns.
const content = loadContent();

type BalanceRoute = readonly [
  fixtureName: string,
  path: string,
  critterId: string,
  optional: boolean,
];

const routes: readonly BalanceRoute[] = [
  ["new-game", "new-game/chapter-one.json", "fountain-frog", false],
  ["new-game", "new-game/east-road.json", "frog", false],
  ["bay", "bay/lifeguard.json", "lifeguard", false],
  ["new-game", "new-game/golden-jordan.json", "raccoon", false],
  ["new-game", "new-game/golden-arcade.json", "arcade-keeper", false],
  ["new-game", "new-game/golden-music.json", "music-bird", false],
  ["new-game", "new-game/golden-field.json", "oak-squirrel", false],
  ["new-game", "new-game/golden-art.json", "art-teacher", false],
  ["new-game", "new-game/golden-forest.json", "owl", false],
  ["new-game", "new-game/golden-kid.json", "hooded-kid", false],
  ["new-game", "new-game/crab.json", "crab", true],
  ["new-game", "new-game/penguin.json", "penguin", true],
  ["new-game", "new-game/principal.json", "principal", true],
  ["new-game", "new-game/cavern.json", "crystal-mole", true],
  ["new-game", "new-game/m81-festival.json", "moon-owl", true],
];

for (const [fixtureName, path, critterId, optional] of routes) {
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
  // "About a level" means one level either way for ordinary critters on the
  // main golden path; named encounters (mini-bosses and the hooded kid) may be
  // at most two ahead. Optional late-game side routes allow [-2, +2].
  const named = critter.windUp !== null || critter.talk !== null;
  const lowerGap = optional ? -2 : -1;
  const upperGap = optional || named ? 2 : 1;
  if (gap > upperGap || gap < lowerGap)
    throw new Error(`${path}: Fae level ${faeLevel}, ${critter.name} level ${critter.level}`);
  const tag = optional ? " [expansion]" : "";
  console.log(`${path}${tag}: Fae ${faeLevel} (${state.xp} XP), ` +
    `${critter.name} ${critter.level}, gap ${gap}`);
}

const species = new Set<string>();
for (const [id, critter] of Object.entries(content.world.critters)) {
  const payout = content.world.levels.critters[id];
  if (payout === undefined || !Number.isFinite(payout.xp) || payout.xp <= 0)
    throw new Error(`critter ${id} has invalid XP payout`);
  if (!Number.isFinite(critter.level) || critter.level <= 0)
    throw new Error(`critter ${id} has invalid level ${critter.level}`);
  if (!Number.isFinite(critter.calmMax) || critter.calmMax <= 0)
    throw new Error(`critter ${id} has invalid calmMax ${critter.calmMax}`);
  if (!Number.isFinite(critter.energyMax) || critter.energyMax <= 0)
    throw new Error(`critter ${id} has invalid energyMax ${critter.energyMax}`);
  const stats = statsForCommand(content.world.levels, "soothe", critter.level);
  if (
    !Number.isFinite(stats.power) || stats.power <= 0 ||
    !Number.isFinite(stats.magic) || !Number.isFinite(stats.life) || !Number.isFinite(stats.guard)
  ) {
    throw new Error(`critter ${id} has non-finite stats at level ${critter.level}`);
  }
  species.add(critter.species);
}
if (species.size < 24) {
  throw new Error(`expected at least 24 critter species, found ${species.size}`);
}
console.log(
  `roster audit: ${Object.keys(content.world.critters).length} encounters across ` +
    `${species.size} species verified (positive levels, valid XP payouts, finite stats)`,
);

for (const level of [1, 5, 9, 14]) {
  const power = statsForCommand(content.world.levels, "soothe", level).power;
  const commands = Math.ceil(100 / power);
  if (commands < 3 || commands > 5)
    throw new Error(`equal-level calm takes ${commands} commands at level ${level}`);
  console.log(`equal-level level ${level}: ${commands} Soothe commands`);
}

// Economy Balance Curve audit across Acts 1-4 (Track E9B): verify milestone
// coin growth, worthwhile permanent + basket sinks >= post-finale festival
// coins, ordered fish rewards & positive trade-in rates, and balanced basket
// pricing vs. individual treats.
const replayCoins = (path: string): number => {
  const fixture = content.fixtures["new-game"];
  if (fixture === undefined) throw new Error("missing new-game fixture");
  let state = createState(content.world, fixture);
  const script = parseScript(JSON.parse(readFileSync(`tests/sim/scripts/${path}`, "utf8")), path);
  for (const segment of script) {
    for (let tick = 0; tick < segment.ticks; tick += 1) {
      state = step(content.world, state, segment.frame).state;
    }
  }
  return state.coins;
};

const actCoins = {
  act1: replayCoins("new-game/chapter-one.json"),
  act2Bay: replayCoins("new-game/golden-bay.json"),
  act2Arcade: replayCoins("new-game/golden-arcade.json"),
  act4Finale: replayCoins("new-game/golden-kid.json"),
  festival: replayCoins("new-game/festival.json"),
};
if (
  !(actCoins.act1 > 0 &&
    actCoins.act1 < actCoins.act2Bay &&
    actCoins.act2Bay < actCoins.act2Arcade &&
    actCoins.act2Arcade < actCoins.act4Finale &&
    actCoins.act4Finale < actCoins.festival)
) {
  throw new Error(`economy coin progression broke monotonicity: ${JSON.stringify(actCoins)}`);
}

const swatchCoinSinks = CLUBHOUSE_SWATCH_IDS.reduce(
  (sum, id) => sum + swatchPriceFor(content.world, id).coins,
  0,
);
const swatchTicketSinks = CLUBHOUSE_SWATCH_IDS.reduce(
  (sum, id) => sum + swatchPriceFor(content.world, id).tickets,
  0,
);
const pedestal = plushPedestalPrice(content.world);
const basketCoinSinks = content.world.treatBaskets.reduce((sum, item) => sum + item.price, 0);
const counterTicketSinks = content.world.arcade.counter.prizes.reduce(
  (sum, item) => sum + item.price,
  0,
);
const totalCoinSinks = swatchCoinSinks + pedestal.coins + basketCoinSinks;
const totalTicketSinks = swatchTicketSinks + pedestal.tickets + counterTicketSinks;
if (totalCoinSinks < actCoins.festival) {
  throw new Error(
    `worthwhile coin sinks (${totalCoinSinks}) must cover festival purse (${actCoins.festival})`,
  );
}
if (totalTicketSinks < counterTicketSinks + 150) {
  throw new Error(`worthwhile ticket sinks (${totalTicketSinks}) too narrow`);
}

const fishTrade = content.world.arcade.fish.trade;
if (
  fishTrade === undefined ||
  fishTrade.ticketsPerCatch <= 0 ||
  fishTrade.coinsPerCatch <= 0
) {
  throw new Error("fish trade-in rates must be positive");
}
const fishCoins = content.world.arcade.fish.catches.map((item) => item.coins);
for (let index = 1; index < fishCoins.length; index += 1) {
  const previous = fishCoins[index - 1] ?? 0;
  const current = fishCoins[index] ?? 0;
  if (current <= previous) {
    throw new Error(`fish catch coin curve must strictly rise: ${fishCoins.join(", ")}`);
  }
}

const treatById = new Map(content.world.treats.map((item) => [item.id, item]));
for (const basket of content.world.treatBaskets) {
  let retailValue = basket.snacks * 5;
  for (const [treatId, count] of Object.entries(basket.treats)) {
    const treat = treatById.get(treatId);
    if (treat === undefined) throw new Error(`basket ${basket.id}: unknown treat ${treatId}`);
    retailValue += treat.price * count;
  }
  if (basket.price <= 0 || basket.price < Math.floor(retailValue * 0.65) ||
      basket.price > retailValue * 1.15) {
    throw new Error(
      `basket ${basket.id} price (${basket.price}) out of balance vs retail (${retailValue})`,
    );
  }
}

console.log(
  `economy audit: Acts 1-4 coins [${actCoins.act1}, ${actCoins.act2Bay}, ` +
    `${actCoins.act2Arcade}, ${actCoins.act4Finale}, festival ${actCoins.festival}], ` +
    `sinks ${totalCoinSinks}c / ${totalTicketSinks}t, ` +
    `fish trade +${fishTrade.ticketsPerCatch}t/+${fishTrade.coinsPerCatch}c, ` +
    `${content.world.treatBaskets.length} gift baskets balanced`,
);
runE7FormationSim();
