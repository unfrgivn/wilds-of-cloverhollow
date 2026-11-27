import type { State, World } from "../core";

const BASE_TITLE = "Wilds of Cloverhollow";

const ARCADE_TITLES: Record<NonNullable<State["arcade"]>["game"], string> = {
  claw: "Claw Machine",
  skee: "Skee-Ball",
  mole: "Boop-a-Mole",
  comet: "Comet Cruise",
  cook: "Clubhouse Microwave",
  fish: "Bubblegum Bay Fishing",
  taco: "Chef Mateo's Taco Truck",
};

export type DocumentTitleFlags = {
  titleOpen: boolean;
  creditsOpen: boolean;
};

/** Formats the browser tab title for the active screen, battle, minigame, or area. */
export function formatDocumentTitle(
  world: Pick<World, "areas" | "critters">,
  state: Pick<State, "area" | "battle" | "arcade">,
  flags: DocumentTitleFlags,
): string {
  if (flags.titleOpen || state.area === "harness") return BASE_TITLE;
  if (flags.creditsOpen) return `Thank You for Playing · ${BASE_TITLE}`;
  if (state.battle !== null) {
    const name = world.critters[state.battle.critterId]?.name;
    return name === undefined || name === "" ? BASE_TITLE : `Calming ${name} · ${BASE_TITLE}`;
  }
  if (state.arcade !== null) {
    return `${ARCADE_TITLES[state.arcade.game]} · ${BASE_TITLE}`;
  }
  const areaName = world.areas[state.area]?.name;
  return areaName === undefined || areaName === "" ? BASE_TITLE : `${areaName} · ${BASE_TITLE}`;
}
