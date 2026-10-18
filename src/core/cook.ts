import type {
  ActionFrame, ArcadeStep, CookContent, CookDish, CookZone, State, World,
} from "./types";

// The clubhouse microwave (spec 8.2): a box of Mom's dino nuggets or mac n
// cheese, cooked in one go or a few. A press starts the microwave and holding
// keeps it going; letting go stops it. Still frozen, it waits for the next hold;
// otherwise it dings, and how long it cooked decides how it came out.
//
//   ready ──press──▶ cooking ──let go, still frozen──▶ paused ──press──▶ cooking
//   cooking ──let go / held to the stop──▶ ding ▶ result ──press (show it all), press──▶ closed
export type CookPhase = "ready" | "cooking" | "paused" | "ding" | "result";
export type CookGame = {
  game: "cook";
  dish: CookDish;
  phase: CookPhase;
  phaseTicks: number;
  // Ticks the microwave has run, all told: what's judged when it stops.
  cooked: number;
  message: string;
  revealed: number;
};

export function newCook(dish: CookDish): CookGame {
  return { game: "cook", dish, phase: "ready", phaseTicks: 0, cooked: 0, message: "",
    revealed: 0 };
}

// How a dish came out, cooked `cooked` ticks (past its frozen time).
export function cookZone(cook: CookContent, dish: CookDish, cooked: number): CookZone {
  const seconds = cooked / cook.ticksPerSecond;
  const { time, burnt } = cook.dishes[dish];
  if (seconds >= burnt) return "burnt";
  if (Math.abs(seconds - time) <= cook.golden) return "golden";
  return seconds < time ? "under" : "over";
}

// Seconds as the microwave's display shows them: 1:05.
export function cookTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// One tick of the microwave. Like the other games, it returns only what it owns;
// the simulation keeps the world around it frozen.
export function stepCook(
  world: World,
  state: State,
  game: CookGame,
  input: ActionFrame,
): ArcadeStep {
  const cook = world.arcade.cook;
  const dish = cook.dishes[game.dish];
  const press = input.confirm && !state.previousInput.confirm;
  const kept = { prizes: state.prizes, tickets: state.tickets, snacks: state.snacks };
  const to = (phase: CookGame["phase"], changes: Partial<CookGame> = {}): ArcadeStep =>
    ({ arcade: { ...game, ...changes, phase, phaseTicks: 0 }, ...kept });
  const stay = (changes: Partial<CookGame> = {}): ArcadeStep =>
    ({ arcade: { ...game, ...changes, phaseTicks: game.phaseTicks + 1 }, ...kept });
  switch (game.phase) {
    case "ready":
    case "paused":
      return press ? to("cooking", { cooked: game.cooked + 1 }) : stay();
    case "cooking": {
      if (input.confirm) {
        const cooked = game.cooked + 1;
        return cooked >= dish.stop * cook.ticksPerSecond ? to("ding", { cooked })
          : stay({ cooked });
      }
      return game.cooked < dish.frozen * cook.ticksPerSecond ? to("paused") : to("ding");
    }
    case "ding": {
      if (game.phaseTicks + 1 < cook.dingTicks) return stay();
      // Out it comes: the snacks it makes go in Fae's backpack.
      const zone = cookZone(cook, game.dish, game.cooked);
      const paid = cook.snacks[zone];
      const message = cook.lines[zone].replace("{snacks}", String(paid));
      return {
        arcade: { ...game, phase: "result", phaseTicks: 0, message, revealed: 0 },
        ...kept,
        snacks: state.snacks + paid,
      };
    }
    case "result": {
      if (game.revealed < game.message.length) {
        const revealed = press ? game.message.length
          : Math.min(game.message.length, game.revealed + world.tunables.interact.revealPerTick);
        return { arcade: { ...game, revealed }, ...kept };
      }
      return { arcade: press ? null : game, ...kept };
    }
  }
}

// What the microwave's close-up draws (spec 8.2). How the food looks is a
// function of how long it's cooked alone, so what's drawn is what's judged.
export type CookView = {
  game: "cook";
  dish: CookDish;
  label: string;
  phase: CookPhase;
  // The timer, as the display shows it, and the box's time.
  display: string;
  boxTime: string;
  // Frosted until it's half done (1 to 0), steaming from then on, darkening
  // past golden (0 to 1 at burnt), and smoking once it's burnt.
  frost: number;
  steam: boolean;
  darkness: number;
  smoke: boolean;
  // The light's on and the button's held down while it cooks.
  cooking: boolean;
  // Ticks cooked, which the steam and smoke drift by.
  cooked: number;
  // How it came out, once it's dinged.
  zone: CookZone | null;
  hint: string | null;
  message: string;
  revealed: number;
};

export function cookView(world: World, game: CookGame): CookView {
  const cook = world.arcade.cook;
  const dish = cook.dishes[game.dish];
  const seconds = game.cooked / cook.ticksPerSecond;
  const golden = dish.time + cook.golden;
  const boxTime = cookTime(dish.time);
  return {
    game: "cook",
    dish: game.dish,
    label: dish.label,
    phase: game.phase,
    display: cookTime(seconds),
    boxTime,
    frost: Math.max(0, 1 - seconds / dish.frozen),
    steam: seconds >= dish.frozen,
    darkness: Math.min(1, Math.max(0, (seconds - golden) / (dish.burnt - golden))),
    smoke: seconds >= dish.burnt,
    cooking: game.phase === "cooking",
    cooked: game.cooked,
    zone: game.phase === "ding" || game.phase === "result"
      ? cookZone(cook, game.dish, game.cooked) : null,
    hint: game.phase === "ready" ? cook.lines.start.replace("{time}", boxTime)
      : game.phase === "paused" ? cook.lines.frozen : null,
    message: game.message,
    revealed: game.revealed,
  };
}
