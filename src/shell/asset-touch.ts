import {
  battleParty,
  CLUBHOUSE_VISITORS,
  type Area,
  type EchoNote,
  type MoleHole,
  type Point,
  type State,
  type TacoTopping,
  type World,
} from "../core";

export const MOLE_ATLAS = "assets/arcade/moles.json";
export const FOOD_ATLAS = "assets/arcade/cook-food.json";
export const FISH_ATLAS = "assets/arcade/fish-catches.json";
export const TACO_ATLAS = "assets/arcade/taco-ingredients.json";
export const COMET_ATLAS = "assets/arcade/comet.json";
export const FAE_ATLAS = "assets/characters/fae/fae.json";
export const BATTLE_CHECKS_V2_ATLAS = "assets/battle/battle-checks-v2.json";

export type MoleHoleTouch = {
  setButton: (button: "confirm", down: boolean) => void;
  tapButton: (button: "confirm") => void;
  holdArrow: (direction: Point) => void;
  tapArrow: (direction: Point) => void;
  releaseArrow: (direction: Point) => void;
};

const HOLE_ARROWS: Readonly<Record<Exclude<MoleHole, "middle">, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const TOPPING_ARROWS: Readonly<Record<TacoTopping, Point>> = {
  beans: { x: 0, y: -1 },
  cheese: { x: 1, y: 0 },
  salsa: { x: 0, y: 1 },
  avocado: { x: -1, y: 0 },
};

const ECHO_ARROWS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export type BattleCheckTouchSink = {
  setButton: (button: "confirm", down: boolean) => void;
  tapButton: (button: "confirm") => void;
  tapChoice: (index: number) => void;
  tapArrow: (direction: Point) => void;
  setPointerArrow: (direction: Point | null) => void;
  beginTrace: (event: PointerEvent) => void;
  moveTrace: (event: PointerEvent) => void;
  endTrace: (event: PointerEvent) => void;
};

export type BattleCheckBindTarget = {
  onConfirmHold: (callback: (held: boolean) => void) => void;
  onDirectionHold: (callback: (dir: Point) => void) => void;
  onEchoNote: (callback: (note: EchoNote) => void) => void;
  onCheckChoice: (callback: (index: number) => void) => void;
  onSpinArrow: (callback: (dir: Point) => void) => void;
  onSnagConfirm: (callback: () => void) => void;
  onSpinPointer: (callback: (phase: "down" | "move" | "up", event: PointerEvent) => void) => void;
};

/** Wires all v1 + v2 battle check overlay callbacks onto TouchInput and returns confirm-hold. */
export function bindBattleCheckTouch(
  battleCheck: BattleCheckBindTarget,
  touch: BattleCheckTouchSink,
): (held: boolean) => void {
  const handleConfirmHold = (held: boolean): void => {
    touch.setButton("confirm", held);
    if (held) touch.tapButton("confirm");
  };
  battleCheck.onConfirmHold(handleConfirmHold);
  battleCheck.onDirectionHold((dir) => {
    touch.setPointerArrow(dir.x === 0 && dir.y === 0 ? null : dir);
  });
  battleCheck.onEchoNote((note) => {
    const direction = ECHO_ARROWS[note];
    if (direction !== undefined) touch.tapArrow(direction);
  });
  battleCheck.onCheckChoice((index) => touch.tapChoice(index));
  battleCheck.onSpinArrow((dir) => touch.tapArrow(dir));
  battleCheck.onSnagConfirm(() => touch.tapButton("confirm"));
  battleCheck.onSpinPointer((phase, event) => {
    if (phase === "down") touch.beginTrace(event);
    else if (phase === "move") touch.moveTrace(event);
    else touch.endTrace(event);
  });
  return handleConfirmHold;
}

/** Maps Taco Truck bowl taps to 1-tick directional arrow presses. */
export function createTacoToppingHandler(
  touch: Pick<MoleHoleTouch, "tapArrow">,
): (topping: TacoTopping) => void {
  return (topping) => touch.tapArrow(TOPPING_ARROWS[topping]);
}

/** Maps Boop-a-Mole touch holes to directional arrows and confirm presses. */
export function createMoleHoleHandler(
  touch: MoleHoleTouch,
): (hole: MoleHole, down: boolean) => void {
  return (hole, down) => {
    if (hole === "middle") {
      touch.setButton("confirm", down);
      if (down) touch.tapButton("confirm");
    } else if (down) {
      touch.holdArrow(HOLE_ARROWS[hole]);
      touch.tapArrow(HOLE_ARROWS[hole]);
    } else {
      touch.releaseArrow(HOLE_ARROWS[hole]);
    }
  };
}

/** Unique critter & NPC atlas JSON paths whose DOM images an area needs warmed. */
export function areaMediaAtlases(
  world: Pick<World, "critters" | "characters">,
  area: Pick<Area, "critters" | "recurring" | "npcs"> & { id?: string },
): string[] {
  const atlases = new Set<string>();
  const areaCritters = new Set([
    ...area.critters.map((piece) => piece.id),
    ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
    ...area.npcs.flatMap((npc) =>
      npc.visibleWhenCalmed === undefined ? [] : [npc.visibleWhenCalmed]),
  ]);
  for (const id of areaCritters) {
    const critter = world.critters[id];
    if (critter !== undefined) atlases.add(critter.atlas);
  }
  for (const npc of area.npcs) {
    const character = world.characters[npc.id];
    if (character !== undefined) atlases.add(character.atlas);
  }
  if (area.id === "clubhouse") {
    for (const visitor of CLUBHOUSE_VISITORS) {
      const character = world.characters[visitor.id];
      if (character !== undefined) atlases.add(character.atlas);
    }
  }
  return [...atlases];
}

/** Unique atlas JSON paths for every sticker, prize, and fish currently owned in the journal. */
export function ownedJournalAtlases(
  world: Pick<World, "stickers" | "critters" | "arcade">,
  state: Pick<State, "stickers" | "prizes" | "caughtFish">,
): string[] {
  const atlases = new Set<string>();
  for (const id of state.stickers) {
    const sticker = world.stickers.catalogue.find((item) => item.id === id);
    const critter = sticker === undefined ? undefined : world.critters[sticker.critter];
    if (critter !== undefined) atlases.add(critter.atlas);
  }
  if (state.prizes.length > 0) atlases.add(world.arcade.atlas);
  if (Object.values(state.caughtFish ?? {}).some((count) => count > 0)) atlases.add(FISH_ATLAS);
  return [...atlases];
}

/** Unique atlas JSON paths needed for Fae and the active battle party's portraits. */
export function battlePortraitAtlases(
  world: World,
  state: Pick<State, "party">,
): string[] {
  const atlases = new Set<string>([FAE_ATLAS]);
  for (const member of battleParty(world, state.party)) {
    const info = world.party[member.id];
    if (info !== undefined) atlases.add(info.atlas);
  }
  return [...atlases];
}
