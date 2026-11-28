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
  photoMode?: boolean;
  encoreShrineOpen?: boolean;
  decorOpen?: boolean;
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
    if (name === undefined || name === "") return BASE_TITLE;
    if (state.battle.encore !== undefined) return `Starlight Encore: ${name} · ${BASE_TITLE}`;
    if (state.battle.foes !== undefined && state.battle.foes.length > 1) {
      const activeFoes = state.battle.foes.filter((foe) => !foe.soothed).length;
      if (activeFoes > 1) return `Calming ${name} +${activeFoes - 1} · ${BASE_TITLE}`;
    }
    return `Calming ${name} · ${BASE_TITLE}`;
  }
  if (state.arcade !== null) {
    return `${ARCADE_TITLES[state.arcade.game]} · ${BASE_TITLE}`;
  }
  if (flags.encoreShrineOpen === true) return `Dream Memory Shrine · ${BASE_TITLE}`;
  const areaName = world.areas[state.area]?.name;
  const hasArea = areaName !== undefined && areaName !== "";
  if (flags.decorOpen === true) {
    return hasArea ? `Decorating ${areaName} · ${BASE_TITLE}` : `Decorating · ${BASE_TITLE}`;
  }
  if (flags.photoMode === true) {
    return hasArea ? `Photo Mode · ${areaName} · ${BASE_TITLE}` : `Photo Mode · ${BASE_TITLE}`;
  }
  return hasArea ? `${areaName} · ${BASE_TITLE}` : BASE_TITLE;
}
