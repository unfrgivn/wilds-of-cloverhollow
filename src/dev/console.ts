import { inkVariable, setInkVariables } from "../core/ink";
import { STAR_GEM_VARIABLES } from "../core/journal";
import { addTreat } from "../core/sim";
import type { State } from "../core/types";

// The QA console's commands (Milestone 67, spec 11). Pure functions over the
// real state; the DOM console in qa.ts is a thin shell over them. QA mode
// only, never in a production build.

// What the commands may touch, taken from the game's own content: the
// compiled story (a variable must be declared in it), every sticker and prize
// id, and the level table's thresholds.
export type ConsoleContext = {
  story: Record<string, unknown>;
  stickerIds: string[];
  prizeIds: string[];
  treatIds: string[];
  fishIds: string[];
  thresholds: number[];
};

export type ConsoleOutcome =
  | { kind: "applied"; state: State; message: string }
  | { kind: "save"; name: string }
  | { kind: "export" }
  | { kind: "help"; message: string }
  | { kind: "error"; message: string };

// The tools Fae carries, and the story variable each sets. A closed set: the
// console refuses any other story variable (spec 11).
type ToolName = "lantern" | "lasso" | "flute" | "map";
const toolVariables: Record<ToolName, string> = {
  lantern: "has_lantern",
  lasso: "has_lasso",
  flute: "has_flute",
  map: "has_map",
};

// Closed set of quest keepsake story variables for Clubhouse display QA.
const keepsakeVariables: readonly string[] = [
  "cavern_chime_rung",
  "spice_returned",
  "gem_reward_all",
  "sanctuary_reward_14",
  "sue_compass",
  "jordan_clover",
  "buster_reward",
];

// The supplies' caps are the layouts the journal and the battle menu were
// tested at (999 coins beside the ♪ pill, 99 snacks, 999 tickets).
type SupplyName = "coins" | "snacks" | "tickets";
const supplyCaps: Record<SupplyName, number> = { coins: 999, snacks: 99, tickets: 999 };

const CONSOLE_HELP = [
  "help               this list",
  "xp <who> <n>       set XP (who: fae or a party member id)",
  "level <who> <n>    set level 1-99 (XP moves to its threshold)",
  "coins <n>          set coins (0-999)",
  "snacks <n>         set snacks (0-99)",
  "tickets <n>        set tickets (0-999)",
  "treats all|<id>    grant specialty treats",
  "stickers all|<id>  grant stickers",
  "prizes all|<id>    grant prizes",
  "fish all|clear     catch all or clear fish",
  "gems all|clear     collect all or clear Star Gems",
  "lantern on|off     carry the lantern",
  "lasso on|off       carry the lasso",
  "flute on|off       carry the flute",
  "map on|off         carry the map",
  "keepsakes on|off   toggle quest keepsakes",
  "garden ripe        ripen the clubhouse garden for Golden Sunberry harvest",
  "save <name>        keep this state in a QA-only slot",
  "export             show this state as a save file",
].join("\n");

function parseCount(token: string | undefined): number | null {
  if (token === undefined || !/^\d+$/.test(token)) return null;
  return Number(token);
}

type XpTarget = { fae: true } | { fae: false; index: number };

function xpTarget(state: State, who: string): XpTarget | null {
  if (who === "fae") return { fae: true };
  const index = state.party.findIndex((member) => member.id === who);
  return index === -1 ? null : { fae: false, index };
}

function unknownMember(state: State, who: string): ConsoleOutcome {
  const known = ["fae", ...state.party.map((member) => member.id)];
  return { kind: "error", message: `Unknown member "${who}". Try ${known.join(", ")}.` };
}

function withXp(state: State, target: XpTarget, xp: number): State {
  if (target.fae) return { ...state, xp };
  return {
    ...state,
    party: state.party.map((member, index) => index === target.index ? { ...member, xp } : member),
  };
}

function xpCommand(context: ConsoleContext, state: State, args: string[]): ConsoleOutcome {
  const [who, raw] = args;
  if (who === undefined || raw === undefined)
    return { kind: "error", message: "Usage: xp <fae|member> <n>." };
  const value = parseCount(raw);
  if (value === null) return { kind: "error", message: `"${raw}" is not a whole number.` };
  const cap = context.thresholds[context.thresholds.length - 1] ?? 0;
  if (value > cap)
    return { kind: "error", message: `XP stops at ${cap}, level 99's threshold.` };
  const target = xpTarget(state, who);
  if (target === null) return unknownMember(state, who);
  return { kind: "applied", state: withXp(state, target, value), message: `${who} xp = ${value}.` };
}

function levelCommand(context: ConsoleContext, state: State, args: string[]): ConsoleOutcome {
  const [who, raw] = args;
  if (who === undefined || raw === undefined)
    return { kind: "error", message: "Usage: level <fae|member> <n>." };
  const value = parseCount(raw);
  if (value === null) return { kind: "error", message: `"${raw}" is not a whole number.` };
  if (value < 1 || value > 99)
    return { kind: "error", message: "Levels run from 1 to 99." };
  const threshold = context.thresholds[value - 1];
  if (threshold === undefined)
    return { kind: "error", message: `levels.json has no threshold for level ${value}.` };
  const target = xpTarget(state, who);
  if (target === null) return unknownMember(state, who);
  return {
    kind: "applied",
    state: withXp(state, target, threshold),
    message: `${who} is level ${value} (xp = ${threshold}).`,
  };
}

function supplyCommand(state: State, args: string[], name: SupplyName): ConsoleOutcome {
  const [raw] = args;
  if (raw === undefined) return { kind: "error", message: `Usage: ${name} <n>.` };
  const value = parseCount(raw);
  if (value === null) return { kind: "error", message: `"${raw}" is not a whole number.` };
  const cap = supplyCaps[name];
  if (value > cap) return { kind: "error", message: `${name} stops at ${cap}.` };
  const next: State = name === "coins" ? { ...state, coins: value }
    : name === "snacks" ? { ...state, snacks: value }
    : { ...state, tickets: value };
  return { kind: "applied", state: next, message: `${name} = ${value}.` };
}

function collectionCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
  kind: "stickers" | "prizes",
): ConsoleOutcome {
  const [id] = args;
  if (id === undefined) return { kind: "error", message: `Usage: ${kind} all|<id>.` };
  const known = kind === "stickers" ? context.stickerIds : context.prizeIds;
  const held = kind === "stickers" ? state.stickers : state.prizes;
  const noun = kind === "stickers" ? "Sticker" : "Prize";
  const home = kind === "stickers" ? "in the album" : "on the shelf";
  if (id === "all") {
    const owned = new Set(held);
    const added = known.filter((entry) => !owned.has(entry));
    if (added.length === 0)
      return { kind: "applied", state, message: `Every ${noun.toLowerCase()} is already ${home}.` };
    const next: State = kind === "stickers"
      ? { ...state, stickers: [...held, ...added] }
      : { ...state, prizes: [...held, ...added] };
    return {
      kind: "applied",
      state: next,
      message: `+${added.length} ${kind}, ${held.length + added.length} of ${known.length}.`,
    };
  }
  if (!known.includes(id))
    return { kind: "error", message: `No ${noun.toLowerCase()} "${id}". Try "${kind} all".` };
  if (held.includes(id))
    return { kind: "applied", state, message: `${noun} "${id}" is already ${home}.` };
  const next: State = kind === "stickers"
    ? { ...state, stickers: [...held, id] }
    : { ...state, prizes: [...held, id] };
  return { kind: "applied", state: next, message: `${noun} "${id}" added.` };
}

function toolCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
  tool: ToolName,
): ConsoleOutcome {
  const [raw] = args;
  if (raw === undefined) return { kind: "error", message: `Usage: ${tool} on|off.` };
  const setting = raw.toLowerCase();
  if (setting !== "on" && setting !== "off")
    return { kind: "error", message: `"${raw}" is not on or off.` };
  const variable = toolVariables[tool];
  // A name the story doesn't declare reads as undefined (core/ink): the
  // console refuses anything but the four closed variables.
  if (inkVariable(context.story, state.ink, variable) === undefined)
    return { kind: "error", message: `${variable} is not a story variable.` };
  const on = setting === "on";
  return {
    kind: "applied",
    state: { ...state, ink: setInkVariables(state.ink, { [variable]: on }) },
    message: `${variable} = ${on}.`,
  };
}

function keepsakesCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
): ConsoleOutcome {
  const [raw] = args;
  if (raw === undefined) return { kind: "error", message: "Usage: keepsakes on|off." };
  const setting = raw.toLowerCase();
  if (setting !== "on" && setting !== "off")
    return { kind: "error", message: `"${raw}" is not on or off.` };
  const on = setting === "on";
  const updates: Record<string, boolean> = {};
  for (const variable of keepsakeVariables) {
    if (inkVariable(context.story, state.ink, variable) === undefined)
      return { kind: "error", message: `${variable} is not a story variable.` };
    updates[variable] = on;
  }
  return {
    kind: "applied",
    state: { ...state, ink: setInkVariables(state.ink, updates) },
    message: `keepsakes = ${on}.`,
  };
}

function gardenCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
): ConsoleOutcome {
  const [raw] = args;
  if (raw?.toLowerCase() !== "ripe")
    return { kind: "error", message: "Usage: garden ripe." };
  const updates: Record<string, boolean | number> = {
    fridge_fixed: true,
    garden_planted: true,
    garden_sprouted: true,
    garden_ripe: true,
    fridge_baskets: 1,
  };
  for (const variable of Object.keys(updates)) {
    if (inkVariable(context.story, state.ink, variable) === undefined)
      return { kind: "error", message: `${variable} is not a story variable.` };
  }
  return {
    kind: "applied",
    state: { ...state, ink: setInkVariables(state.ink, updates) },
    message: "Clubhouse garden is ripe with a Golden Sunberry bloom.",
  };
}

function treatCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
): ConsoleOutcome {
  const [id] = args;
  if (id === undefined) return { kind: "error", message: "Usage: treats all|<id>." };
  if (id === "all") {
    let next = state;
    for (const treatId of context.treatIds) next = addTreat(next, treatId, 1);
    return {
      kind: "applied",
      state: next,
      message: `+1 of all ${context.treatIds.length} treats.`,
    };
  }
  if (!context.treatIds.includes(id))
    return { kind: "error", message: `No treat "${id}". Try "treats all".` };
  const next = addTreat(state, id, 1);
  return { kind: "applied", state: next, message: `${id} = ${next.treats?.[id] ?? 0}.` };
}

function fishCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
): ConsoleOutcome {
  const [raw] = args;
  if (raw === undefined) return { kind: "error", message: "Usage: fish all|clear." };
  const setting = raw.toLowerCase();
  if (setting === "all") {
    const caughtFish: Record<string, number> = {};
    for (const id of context.fishIds) {
      caughtFish[id] = Math.max(1, state.caughtFish?.[id] ?? 0);
    }
    return {
      kind: "applied",
      state: { ...state, caughtFish },
      message: `Caught all ${context.fishIds.length} fish.`,
    };
  }
  if (setting === "clear") {
    const { caughtFish: _dropped, ...rest } = state;
    return { kind: "applied", state: rest, message: "Cleared caught fish." };
  }
  return { kind: "error", message: `"${raw}" is not all or clear.` };
}

function gemsCommand(
  context: ConsoleContext,
  state: State,
  args: string[],
): ConsoleOutcome {
  const [raw] = args;
  if (raw === undefined) return { kind: "error", message: "Usage: gems all|clear." };
  const setting = raw.toLowerCase();
  if (setting !== "all" && setting !== "clear")
    return { kind: "error", message: `"${raw}" is not all or clear.` };
  const collected = setting === "all";
  const updates: Record<string, boolean> = {};
  for (const variable of STAR_GEM_VARIABLES) {
    if (inkVariable(context.story, state.ink, variable) === undefined)
      return { kind: "error", message: `${variable} is not a story variable.` };
    updates[variable] = collected;
  }
  return {
    kind: "applied",
    state: { ...state, ink: setInkVariables(state.ink, updates) },
    message: collected
      ? `Collected all ${STAR_GEM_VARIABLES.length} Star Gems.`
      : "Cleared Star Gems.",
  };
}

function saveCommand(args: string[]): ConsoleOutcome {
  const [name] = args;
  if (name === undefined || !/^[a-z0-9][a-z0-9-]{0,23}$/.test(name))
    return {
      kind: "error",
      message: "Slot names are lowercase letters, digits, and dashes, 24 at most.",
    };
  return { kind: "save", name };
}

export function runConsoleCommand(
  context: ConsoleContext,
  state: State,
  line: string,
): ConsoleOutcome {
  const tokens = line.trim().split(/\s+/);
  const command = tokens[0] ?? "";
  const args = tokens.slice(1);
  switch (command.toLowerCase()) {
    case "": return { kind: "error", message: "Type help for the command list." };
    case "help": return { kind: "help", message: CONSOLE_HELP };
    case "xp": return xpCommand(context, state, args);
    case "level": return levelCommand(context, state, args);
    case "coins": return supplyCommand(state, args, "coins");
    case "snacks": return supplyCommand(state, args, "snacks");
    case "tickets": return supplyCommand(state, args, "tickets");
    case "treats": return treatCommand(context, state, args);
    case "stickers": return collectionCommand(context, state, args, "stickers");
    case "prizes": return collectionCommand(context, state, args, "prizes");
    case "fish": return fishCommand(context, state, args);
    case "gems": return gemsCommand(context, state, args);
    case "lantern": return toolCommand(context, state, args, "lantern");
    case "lasso": return toolCommand(context, state, args, "lasso");
    case "flute": return toolCommand(context, state, args, "flute");
    case "map": return toolCommand(context, state, args, "map");
    case "keepsakes": return keepsakesCommand(context, state, args);
    case "garden": return gardenCommand(context, state, args);
    case "save": return saveCommand(args);
    case "export": return { kind: "export" };
    default:
      return { kind: "error", message: `Unknown command "${command}". Type help.` };
  }
}
