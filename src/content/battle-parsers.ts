import { isEncoreModifierId, ENCORE_MODIFIER_IDS } from "../core/encore";
import { runInk, storyHasKnot } from "../core/ink";
import {
  array,
  boolean,
  checkSpec,
  faeSideCheck,
  field,
  gradeMap,
  integer,
  integerIn,
  isInteger,
  isPositive,
  nonEmptyString,
  nonNegative,
  optionalString,
  pointField,
  positive,
  record,
  string,
  strings,
} from "./parsers";
import type {
  Area,
  BattleContent,
  Critter,
  Den,
  EncoreBossSpec,
  EncoreContent,
  EncoreModifierSpec,
  FeelingId,
  FriendCommand,
  Grade,
  LevelContent,
  PartyContent,
  Recurring,
  SharedCommandId,
  StickerCatalogue,
  TreatBasket,
  TreatItem,
  WindUp,
} from "../core";

// An area's recurring critters (spec 6): `after` (a calmed() fact) and the
// dens, each `{ point, radius, kinds, chance?, after? }` with `chance` in
// (0, 1] and `after` a calmed() fact that keeps that one den quiet.
export function parseRecurring(value: unknown, file: string): Recurring | undefined {
  if (value === undefined) return undefined;
  field(record(value), file, "recurring");
  const after = optionalString(value, "after", file, "recurring.after");
  const dens = value.dens;
  field(array(dens) && dens.length > 0, file, "recurring.dens");
  return {
    ...(after === undefined ? {} : { after }),
    dens: dens.map((den: unknown, index): Den => {
      const name = `recurring.dens.${index}`;
      field(record(den), file, name);
      const pt = pointField(den, "point", file, `${name}.point`);
      const radius = positive(den, "radius", file, `${name}.radius`);
      const kinds = den.kinds;
      field(strings(kinds) && kinds.length > 0, file, `${name}.kinds`);
      const chance = den.chance ?? 1;
      field(isPositive(chance) && chance <= 1, file, `${name}.chance`);
      const denAfter = optionalString(den, "after", file, `${name}.after`);
      return {
        point: pt,
        radius,
        kinds: [...kinds],
        chance,
        ...(denAfter === undefined ? {} : { after: denAfter }),
      };
    }),
  };
}

export function talkErrors(
  story: Record<string, unknown>, ink: string, critters: Critter[],
): string[] {
  return critters.flatMap((critter) => {
    if (critter.talk === null) return [];
    const errors: string[] = [];
    for (const knot of critter.talk.knots) {
      if (!storyHasKnot(story, knot)) {
        errors.push(`critter ${critter.id}: unknown talk knot ${knot}`);
        continue;
      }
      const opening = runInk(story, ink, { type: "start", knot });
      opening.choices.forEach((_, index) => {
        const answer = runInk(story, opening.ink, { type: "choose", index });
        const grades = answer.line?.tags.filter(
          (tag) => /^grade:\s*(great|good|miss)\s*$/.test(tag.trim()),
        ) ?? [];
        if (grades.length !== 1)
          errors.push(`critter ${critter.id}: ${knot} choice ${index} must have exactly one grade`);
      });
    }
    return errors;
  });
}

export function parseCritter(value: unknown, file: string): Critter {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, key: string): string => string(object, key, file);
  const nonNeg = (object: Record<string, unknown>, key: string): number =>
    nonNegative(object, key, file);
  const toyScale = value.toyScale === undefined ? 1 : value.toyScale;
  field(isPositive(toyScale), file, "toyScale");
  const id = text(value, "id");
  const level = integerIn(value, "level", 1, file, "level");
  field(level <= 99, file, "level");
  const species = text(value, "species");
  const name = text(value, "name");
  const calmName = text(value, "calmName");
  const atlas = text(value, "atlas");
  const calmKnot = text(value, "calmKnot");
  const calmPrompt = value.calmPrompt;
  field(calmPrompt === "Look" || calmPrompt === "Talk", file, "calmPrompt");
  const sticker = value.sticker;
  field(record(sticker), file, "sticker");
  const stickerValue = {
    id: text(sticker, "id"),
    name: text(sticker, "name"),
    frame: text(sticker, "frame"),
  };
  const commands = value.commands;
  field(record(commands), file, "commands");
  const command = (
    commandName: string,
    keys: string[],
  ): Record<string, number> => {
    const raw = commands[commandName];
    field(record(raw), file, `commands.${commandName}`);
    return Object.fromEntries(keys.map((key) => [key, nonNeg(raw, key)]));
  };
  const burst = value.burst;
  field(record(burst), file, "burst");
  const burstValue = {
    bigChance: nonNeg(burst, "bigChance"),
    check: checkSpec(burst.check, file, "burst.check"),
    ...(burst.big === undefined ? {} : { big: checkSpec(burst.big, file, "burst.big") }),
  };
  field(burstValue.bigChance <= 1, file, "burst.bigChance");
  if (burstValue.big !== undefined)
    field(burstValue.big.kind === burstValue.check.kind, file, "burst.big.kind");
  const lines = value.lines;
  field(record(lines), file, "lines");
  const line = (key: string): string => text(lines, key);
  const feelings = critterFeelings(value.feelings, file);
  const talkRaw = value.talk;
  let talk: Critter["talk"] = null;
  if (talkRaw !== undefined && talkRaw !== null) {
    field(record(talkRaw) && record(talkRaw.calm) && array(talkRaw.knots), file, "talk");
    const knots = talkRaw.knots;
    field(
      knots.length === 3 && knots.every((item) => typeof item === "string" && item.length > 0),
      file, "talk.knots",
    );
    const calm = talkRaw.calm;
    const calmValue = (grade: Grade): number =>
      integerIn(calm, grade, 1, file, `talk.calm.${grade}`);
    const values = { great: calmValue("great"), good: calmValue("good"), miss: calmValue("miss") };
    field(values.great >= values.good && values.good >= values.miss, file, "talk.calm order");
    const talkAt = integerIn(talkRaw, "talkAt", 1, file, "talk.talkAt");
    field(talkAt < nonNeg(value, "calmMax"), file, "talk.talkAt");
    talk = {
      label: string(talkRaw, "label", file, "talk.label"),
      prompt: nonEmptyString(talkRaw, "prompt", file, "talk.prompt"),
      talkAt,
      knots: [String(knots[0] ?? ""), String(knots[1] ?? ""), String(knots[2] ?? "")],
      calm: values,
    };
  }
  const canRun = value.canRun ?? true;
  field(typeof canRun === "boolean", file, "canRun");
  const sootheRaw = command("soothe", ["calm", "great", "good"]);
  const snackRaw = command("snack", ["calm", "energy"]);
  const friendsRaw = commands.friends;
  field(record(friendsRaw), file, "commands.friends");
  const friends: Record<string, FriendCommand> = {};
  for (const [friendId, raw] of Object.entries(friendsRaw)) {
    field(record(raw), file, `commands.friends.${friendId}`);
    friends[friendId] = {
      calm: nonNeg(raw, "calm"),
      great: nonNeg(raw, "great"),
      good: nonNeg(raw, "good"),
      rest: nonNeg(raw, "rest"),
    };
  }
  const friendLinesRaw = lines.friends;
  field(record(friendLinesRaw), file, "lines.friends");
  const friendLines: Record<string, Record<Grade, string>> = {};
  for (const [friendId, raw] of Object.entries(friendLinesRaw))
    friendLines[friendId] = gradeMap(raw, file, `lines.friends.${friendId}`);
  return {
    id,
    level,
    species,
    name,
    calmName,
    atlas,
    auraCentre: pointField(value, "auraCentre", file),
    bodyCentre: pointField(value, "bodyCentre", file),
    figureHeight: nonNeg(value, "figureHeight"),
    toyScale,
    overworldHeight: nonNeg(value, "overworldHeight"),
    battleHeight: nonNeg(value, "battleHeight"),
    touchRadius: nonNeg(value, "touchRadius"),
    calmMax: nonNeg(value, "calmMax"),
    energyMax: nonNeg(value, "energyMax"),
    coins: nonNeg(value, "coins"),
    sticker: stickerValue,
    calmKnot,
    calmPrompt,
    feelings,
    commands: {
      soothe: {
        calm: nonNeg(sootheRaw, "calm"),
        great: nonNeg(sootheRaw, "great"),
        good: nonNeg(sootheRaw, "good"),
      },
      snack: {
        calm: nonNeg(snackRaw, "calm"),
        energy: nonNeg(snackRaw, "energy"),
      },
      friends,
    },
    burst: burstValue,
    windUp: critterWindUp(value.windUp, file, feelings.length),
    talk,
    canRun,
    lines: {
      intro: line("intro"),
      command: line("command"),
      soothe: gradeMap(lines.soothe, file, "lines.soothe"),
      friends: friendLines,
      snack: line("snack"),
      burst: line("burst"),
      burstResult: gradeMap(lines.burstResult, file, "lines.burstResult"),
      soothed: line("soothed"),
      rest: line("rest"),
      run: line("run"),
    },
  };
}

export function parseBattleContent(
  value: unknown,
  file: string,
): BattleContent {
  field(record(value) && record(value.commands), file, "commands");
  const hints = value.hints;
  field(
    record(hints) &&
      typeof hints.charge === "string" &&
      typeof hints.chain === "string" &&
      typeof hints.catch === "string" &&
      typeof hints.lean === "string" &&
      typeof hints.trace === "string" &&
      typeof hints.peekaboo === "string" &&
      typeof hints.echo === "string" &&
      hints.echo.trim().length > 0 &&
      typeof hints["which-one"] === "string" &&
      hints["which-one"].trim().length > 0 &&
      typeof hints.whack === "string" &&
      hints.whack.trim().length > 0 &&
      typeof hints["spin-snag"] === "string" &&
      hints["spin-snag"].trim().length > 0,
    file,
    "hints",
  );
  const commands = value.commands;
  function command(id: "soothe"): BattleContent["commands"]["soothe"];
  function command(id: "snack"): BattleContent["commands"]["snack"];
  function command(id: "run"): BattleContent["commands"]["run"];
  function command(id: SharedCommandId): BattleContent["commands"][SharedCommandId] {
    const raw = commands[id];
    field(record(raw) && typeof raw.label === "string", file, `commands.${id}`);
    if (id === "soothe")
      return { label: raw.label, check: faeSideCheck(raw.check, file, "commands.soothe.check") };
    if (id === "snack") {
      field(typeof raw.snackDetail === "string", file, "commands.snack.snackDetail");
      return { label: raw.label, snackDetail: raw.snackDetail };
    }
    return { label: raw.label };
  }
  const rewards = value.rewards;
  field(
    record(rewards) && typeof rewards.sticker === "string" &&
      typeof rewards.coins === "string" && rewards.coins.includes("{coins}"),
    file,
    "rewards",
  );
  const toyAtlas = value.toyAtlas;
  field(typeof toyAtlas === "string" && toyAtlas.endsWith(".json"), file, "toyAtlas");
  const checksV2Atlas = value.checksV2Atlas;
  field(
    checksV2Atlas === undefined ||
      (typeof checksV2Atlas === "string" && checksV2Atlas.endsWith(".json")),
    file,
    "checksV2Atlas",
  );
  // All five feelings, each with its label and the command that answers it.
  const feelings = value.feelings;
  field(record(feelings) && Object.keys(feelings).every(isFeelingId), file, "feelings");
  const feeling = (id: FeelingId): { label: string; answer: string } => {
    const raw = feelings[id];
    field(record(raw) && typeof raw.label === "string" && raw.label !== "" &&
      typeof raw.answer === "string", file, `feelings.${id}`);
    return { label: raw.label, answer: raw.answer };
  };
  const feelingBonus = value.feelingBonus;
  field(typeof feelingBonus === "number" && Number.isInteger(feelingBonus) && feelingBonus >= 0,
    file, "feelingBonus");
  // Meeting a recurring critter (Milestone 51): lines that name it, the calm
  // a surprise is worth, and how many calms make a species old friends.
  const named = (raw: unknown, name: string): string => {
    field(typeof raw === "string" && raw.includes("{name}"), file, name);
    return raw;
  };
  const touch = value.firstTouch;
  field(record(touch) && record(touch.lines), file, "firstTouch");
  const surprise = touch.surprise;
  field(typeof surprise === "number" && Number.isInteger(surprise) && surprise > 0, file,
    "firstTouch.surprise");
  const friends = value.oldFriends;
  field(record(friends), file, "oldFriends");
  const calms = friends.calms;
  field(typeof calms === "number" && Number.isInteger(calms) && calms >= 1, file,
    "oldFriends.calms");
  const nonEmpty = (raw: unknown, name: string): string => {
    field(typeof raw === "string" && raw.trim().length > 0, file, name);
    return raw;
  };
  const togetherRaw = value.together;
  field(record(togetherRaw), file, "together");
  const chargeMax = integerIn(togetherRaw, "chargeMax", 1, file, "together.chargeMax");
  const togetherCheck = faeSideCheck(togetherRaw.check, file, "together.check");
  field(togetherCheck.kind === "chain", file, "together.check.kind");
  const togetherLines = gradeMap(togetherRaw.lines, file, "together.lines");
  field(
    togetherLines.great.trim().length > 0 &&
      togetherLines.good.trim().length > 0 &&
      togetherLines.miss.trim().length > 0,
    file,
    "together.lines",
  );
  const fluteRaw = value.fluteAssist;
  field(record(fluteRaw) && record(fluteRaw.lines), file, "fluteAssist");
  const lassoRaw = value.lassoAssist;
  field(record(lassoRaw) && record(lassoRaw.lines), file, "lassoAssist");
  return {
    toyAtlas,
    ...(checksV2Atlas === undefined ? {} : { checksV2Atlas }),
    hints: {
      charge: hints.charge,
      chain: hints.chain,
      catch: hints.catch,
      lean: hints.lean,
      trace: hints.trace,
      peekaboo: hints.peekaboo,
      echo: hints.echo,
      "which-one": hints["which-one"],
      whack: hints.whack,
      "spin-snag": hints["spin-snag"],
    },
    commands: {
      soothe: command("soothe"),
      snack: command("snack"),
      run: command("run"),
    },
    feelings: {
      zoomy: feeling("zoomy"),
      curious: feeling("curious"),
      bored: feeling("bored"),
      grumpy: feeling("grumpy"),
      hungry: feeling("hungry"),
    },
    feelingBonus,
    firstTouch: {
      surprise,
      lines: {
        surprised: named(touch.lines.surprised, "firstTouch.lines.surprised"),
        caught: named(touch.lines.caught, "firstTouch.lines.caught"),
      },
    },
    oldFriends: { calms, line: named(friends.line, "oldFriends.line") },
    rewards: { sticker: rewards.sticker, coins: rewards.coins },
    together: {
      chargeMax,
      label: nonEmpty(togetherRaw.label, "together.label"),
      hint: nonEmpty(togetherRaw.hint, "together.hint"),
      check: togetherCheck,
      lines: togetherLines,
    },
    fluteAssist: {
      pupCalm: integerIn(fluteRaw, "pupCalm", 1, file, "fluteAssist.pupCalm"),
      squirrelEnergy: integerIn(fluteRaw, "squirrelEnergy", 1, file, "fluteAssist.squirrelEnergy"),
      squirrelSoften: integerIn(fluteRaw, "squirrelSoften", 1, file, "fluteAssist.squirrelSoften"),
      bunnyCalm: integerIn(fluteRaw, "bunnyCalm", 1, file, "fluteAssist.bunnyCalm"),
      bunnyTogether: integerIn(fluteRaw, "bunnyTogether", 1, file, "fluteAssist.bunnyTogether"),
      lines: {
        pup: nonEmpty(fluteRaw.lines.pup, "fluteAssist.lines.pup"),
        squirrel: nonEmpty(fluteRaw.lines.squirrel, "fluteAssist.lines.squirrel"),
        bunny: nonEmpty(fluteRaw.lines.bunny, "fluteAssist.lines.bunny"),
        both: nonEmpty(fluteRaw.lines.both, "fluteAssist.lines.both"),
        pupBunny: nonEmpty(fluteRaw.lines.pupBunny, "fluteAssist.lines.pupBunny"),
        squirrelBunny: nonEmpty(fluteRaw.lines.squirrelBunny, "fluteAssist.lines.squirrelBunny"),
        all: nonEmpty(fluteRaw.lines.all, "fluteAssist.lines.all"),
      },
    },
    lassoAssist: {
      calm: integerIn(lassoRaw, "calm", 1, file, "lassoAssist.calm"),
      coins: integerIn(lassoRaw, "coins", 1, file, "lassoAssist.coins"),
      lines: {
        windUp: nonEmpty(lassoRaw.lines.windUp, "lassoAssist.lines.windUp"),
        snag: nonEmpty(lassoRaw.lines.snag, "lassoAssist.lines.snag"),
      },
    },
  };
}

const feelingIds: FeelingId[] = ["zoomy", "curious", "bored", "grumpy", "hungry"];
function isFeelingId(value: unknown): value is FeelingId {
  return feelingIds.some((id) => id === value);
}

// A critter kind's feelings (spec 8): one or more, none twice.
function critterFeelings(value: unknown, file: string): FeelingId[] {
  field(Array.isArray(value) && value.length > 0 && value.every(isFeelingId) &&
    new Set(value).size === value.length, file, "feelings");
  return [...value];
}

// A mini-boss's wind-up (spec 8, Milestone 50), or null without one: never on
// the first turn, at least one plain turn between two, and no more bubbles
// than the kind has feelings.
function critterWindUp(value: unknown, file: string, feelings: number): WindUp | null {
  if (value === undefined || value === null) return null;
  field(record(value), file, "windUp");
  const start = integerIn(value, "start", 2, file, "windUp.start");
  const every = integer(value, "every", file, "windUp.every");
  const bubbles = integerIn(value, "bubbles", 1, file, "windUp.bubbles");
  field(bubbles <= feelings, file, "windUp.bubbles");
  field(every > bubbles, file, "windUp.every");
  const lines = value.lines;
  field(record(lines), file, "windUp.lines");
  const line = (key: string): string => nonEmptyString(lines, key, file, `windUp.lines.${key}`);
  return {
    start,
    every,
    bubbles,
    lines: { start: line("start"), puffing: line("puffing"), fizzle: line("fizzle") },
  };
}

// Every feeling's answer is a command Fae can have: Soothe, Snack, or a
// friend's (spec 8). Run answers nothing.
export function feelingErrors(
  battle: BattleContent,
  party: Record<string, PartyContent>,
): string[] {
  const friends = Object.values(party)
    .flatMap((member) => member.command === null ? [] : [member.command.id]);
  const commands = ["soothe", "snack", ...friends];
  return Object.entries(battle.feelings).flatMap(([id, feeling]) =>
    commands.includes(feeling.answer)
      ? []
      : [`content/battle.json: feelings.${id}.answer ${feeling.answer} isn't Soothe, ` +
        "Snack, or a friend's command"]);
}

export function parsePartyMember(value: unknown, file: string): PartyContent {
  field(record(value), file, "object");
  const text = (object: Record<string, unknown>, name: string): string =>
    nonEmptyString(object, name, file, name);
  const size = (object: Record<string, unknown>, name: string): number =>
    positive(object, name, file, name);
  const memberBox = value.box;
  field(record(memberBox), file, "box");
  const flute = value.flute ?? false;
  field(typeof flute === "boolean", file, "flute");
  const command = value.command;
  field(flute ? command === null : record(command), file, "command");
  field(!flute || typeof value.joins === "string", file, "flute/joins");
  const critter = value.critter ?? null;
  field(critter === null || (flute && typeof critter === "string"), file, "critter");
  const sits = boolean(value, "sits", file);
  const start = boolean(value, "start", file);
  field(value.joins === null || typeof value.joins === "string", file, "joins");
  const befriended = optionalString(value, "befriended", file);
  field(!flute || typeof befriended === "string", file, "flute/befriended");
  field(
    (start && value.joins === null) || (!start && typeof value.joins === "string"),
    file,
    "start/joins",
  );
  const scale = value.scale;
  field(scale === undefined || isPositive(scale), file, "scale");
  return {
    id: text(value, "id"),
    name: text(value, "name"),
    atlas: text(value, "atlas"),
    box: { width: size(memberBox, "width"), height: size(memberBox, "height") },
    walkCycleUnits: size(value, "walkCycleUnits"),
    sits,
    start,
    joins: value.joins,
    ...(befriended === undefined ? {} : { befriended }),
    flute,
    critter,
    command: record(command)
      ? {
          id: text(command, "id"),
          label: text(command, "label"),
          resting: text(command, "resting"),
          check: faeSideCheck(command.check, file, "command.check"),
        }
      : null,
    ...(scale === undefined ? {} : { scale }),
  };
}

export function partyJoinErrors(
  party: Record<string, PartyContent>,
  storyVariable: (name: string) => unknown,
): string[] {
  return Object.values(party).flatMap((member) =>
    [
      ...(member.joins !== null && storyVariable(member.joins) === undefined
        ? [`party ${member.id}: joins variable ${member.joins} is not declared`] : []),
      ...(member.befriended !== undefined && storyVariable(member.befriended) === undefined
        ? [`party ${member.id}: befriended variable ${member.befriended} is not declared`] : []),
    ],
  );
}

// Every critter must answer every party command (numbers and lines), and no
// party command may shadow a shared one.
export function partyErrors(
  party: Record<string, PartyContent>,
  critters: Record<string, Critter>,
): string[] {
  const shared: SharedCommandId[] = ["soothe", "snack", "run"];
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const member of Object.values(party)) {
    if (member.critter !== null && critters[member.critter] === undefined)
      errors.push(`party ${member.id}: no critter ${member.critter}`);
    if (member.command === null) continue;
    const commandId = member.command.id;
    if (shared.some((id) => id === commandId))
      errors.push(`party ${member.id}: command ${commandId} is a shared command`);
    const owner = seen.get(commandId);
    if (owner !== undefined)
      errors.push(`party ${member.id}: command ${commandId} is also ${owner}'s`);
    seen.set(commandId, member.id);
    for (const critter of Object.values(critters)) {
      if (critter.commands.friends[commandId] === undefined)
        errors.push(`critter ${critter.id}: no commands.friends.${commandId}`);
      if (critter.lines.friends[commandId] === undefined)
        errors.push(`critter ${critter.id}: no lines.friends.${commandId}`);
    }
  }
  return errors;
}

// Critter kinds and where they're out (spec 8): every set piece is a kind
// placed once, dens list only the other kinds, a species has one sticker and
// it's in the album, and `after` names a calmed() fact (a set piece or a
// species).
export function critterErrors(
  areas: Record<string, Area>,
  critters: Record<string, Critter>,
  stickers: StickerCatalogue,
): string[] {
  const errors: string[] = [];
  const placed = new Map<string, string>();
  for (const area of Object.values(areas))
    for (const piece of area.critters) {
      if (critters[piece.id] === undefined)
        errors.push(`${area.id}: set piece ${piece.id} isn't a critter kind`);
      const other = placed.get(piece.id);
      if (other !== undefined) errors.push(`${area.id}: set piece ${piece.id} is in ${other} too`);
      placed.set(piece.id, area.id);
    }
  const species = new Map<string, string>();
  for (const kind of Object.values(critters)) {
    const sticker = species.get(kind.species);
    if (sticker !== undefined && sticker !== kind.sticker.id)
      errors.push(`critter ${kind.id}: species ${kind.species} has two stickers, ` +
        `${sticker} and ${kind.sticker.id}`);
    species.set(kind.species, kind.sticker.id);
    if (!stickers.catalogue.some((entry) => entry.id === kind.sticker.id))
      errors.push(`critter ${kind.id}: sticker ${kind.sticker.id} isn't in the album`);
  }
  for (const entry of stickers.catalogue)
    if (critters[entry.critter]?.sticker.id !== entry.id)
      errors.push(`sticker ${entry.id}: critter ${entry.critter} doesn't carry it`);
  if (stickers.catalogue.length > stickers.slots)
    errors.push(`stickers: ${stickers.catalogue.length} stickers for ${stickers.slots} slots`);
  for (const area of Object.values(areas)) {
    const after = area.recurring?.after;
    if (after !== undefined && !placed.has(after) && !species.has(after))
      errors.push(`${area.id}: recurring.after ${after} is neither a set piece nor a species`);
    area.recurring?.dens.forEach((den, index) => {
      for (const kind of den.kinds)
        if (critters[kind] === undefined || placed.has(kind))
          errors.push(`${area.id}: den ${index} lists ${kind}, which isn't a recurring kind`);
      if (den.after !== undefined && !placed.has(den.after) && !species.has(den.after))
        errors.push(`${area.id}: den ${index} after ${den.after} is neither a set piece ` +
          `nor a species`);
    });
    for (const npc of area.npcs) {
      if (npc.visibleWhenCalmed !== undefined && critters[npc.visibleWhenCalmed] === undefined)
        errors.push(`${area.id}: npc ${npc.id} visibleWhenCalmed ${npc.visibleWhenCalmed} ` +
          `isn't a critter kind`);
    }
  }
  return errors;
}

export function parseStickers(value: unknown, file: string): StickerCatalogue {
  field(
    record(value) &&
      typeof value.slots === "number" &&
      Array.isArray(value.catalogue),
    file,
    "stickers",
  );
  field(value.slots >= 0, file, "slots");
  const catalogue = value.catalogue.map((item, index) => {
    field(
      record(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.critter === "string" &&
        typeof item.frame === "string",
      file,
      `catalogue.${index}`,
    );
    return {
      id: item.id,
      name: item.name,
      critter: item.critter,
      frame: item.frame,
    };
  });
  return { slots: value.slots, catalogue };
}

export function parseLevels(value: unknown, file: string): LevelContent {
  field(record(value), file, "object");
  const rawThresholds = value.thresholds;
  field(
    array(rawThresholds) &&
      rawThresholds.length === 99 &&
      rawThresholds.every((item): item is number => isInteger(item) && item >= 0),
    file,
    "thresholds",
  );
  const rawStats = value.stats;
  field(record(rawStats), file, "stats");
  const stat = (name: string): number => integerIn(rawStats, name, 0, file, `stats.${name}`);
  const rawCritters = value.critters;
  field(record(rawCritters), file, "critters");
  const critters: LevelContent["critters"] = {};
  for (const [id, raw] of Object.entries(rawCritters)) {
    field(record(raw), file, `critters.${id}`);
    const intVal = (name: string): number =>
      integerIn(raw, name, 0, file, `critters.${id}.${name}`);
    const level = integerIn(raw, "level", 1, file, `critters.${id}.level`);
    field(level <= 99, file, `critters.${id}.level`);
    critters[id] = {
      level, calmMax: intVal("calmMax"), burst: intVal("burst"),
      bigBurst: intVal("bigBurst"), xp: intVal("xp"),
    };
  }
  const rawCommands = rawStats.commands;
  field(record(rawCommands), file, "stats.commands");
  const commands: LevelContent["stats"]["commands"] = {};
  for (const [id, raw] of Object.entries(rawCommands)) {
    field(record(raw), file, `stats.commands.${id}`);
    const intVal = (name: string): number =>
      integerIn(raw, name, 0, file, `stats.commands.${id}.${name}`);
    commands[id] = {
      powerBase: intVal("powerBase"), powerPerLevel: intVal("powerPerLevel"),
      magicBase: intVal("magicBase"), magicPerLevel: intVal("magicPerLevel"),
    };
  }
  return {
    thresholds: [...rawThresholds],
    stats: {
      lifeBase: stat("lifeBase"), lifeEvery: stat("lifeEvery"), guardEvery: stat("guardEvery"),
      commands,
    },
    critters,
  };
}

export function parseTreats(
  value: unknown,
  file: string,
  critters: Record<string, Critter>,
): TreatItem[] {
  field(record(value) && array(value.treats) && value.treats.length > 0, file, "treats");
  const species = new Set(Object.values(critters).map((critter) => critter.species));
  const seen = new Set<string>();
  return value.treats.map((item, index): TreatItem => {
    const label = `treats[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(/^[a-z][a-z0-9-]*$/.test(id) && id !== "snack" && id !== "back", file, `${label}.id`);
    field(!seen.has(id), file, `${label}.id (duplicate ${id})`);
    seen.add(id);
    const price = integerIn(item, "price", 1, file, `${label}.price`);
    const energy = integerIn(item, "energy", 1, file, `${label}.energy`);
    const calm = integerIn(item, "calm", 1, file, `${label}.calm`);
    const favouriteCalm = integerIn(item, "favouriteCalm", calm, file, `${label}.favouriteCalm`);
    const rawFavourites = item.favourites;
    field(strings(rawFavourites) && rawFavourites.length > 0, file, `${label}.favourites`);
    const favSeen = new Set<string>();
    for (const entry of rawFavourites) {
      field(species.has(entry), file, `${label}.favourites (unknown species ${entry})`);
      field(!favSeen.has(entry), file, `${label}.favourites (duplicate species ${entry})`);
      favSeen.add(entry);
    }
    return {
      id,
      name: nonEmptyString(item, "name", file, `${label}.name`),
      price,
      energy,
      calm,
      favouriteCalm,
      favourites: [...rawFavourites],
      description: nonEmptyString(item, "description", file, `${label}.description`),
      useLine: nonEmptyString(item, "useLine", file, `${label}.useLine`),
      favouriteLine: nonEmptyString(item, "favouriteLine", file, `${label}.favouriteLine`),
    };
  });
}

export function parseEncoreContent(
  value: unknown,
  file: string,
  critters: Record<string, Critter>,
): EncoreContent {
  field(record(value), file, "object");
  const baseCoins = integerIn(value, "baseCoins", 0, file, "baseCoins");
  const coinsPerStar = integerIn(value, "coinsPerStar", 0, file, "coinsPerStar");
  const pureHeartFeelingBonus = integerIn(
    value, "pureHeartFeelingBonus", 1, file, "pureHeartFeelingBonus",
  );
  const rawModifiers = value.modifiers;
  field(
    array(rawModifiers) && rawModifiers.length === ENCORE_MODIFIER_IDS.length,
    file,
    "modifiers",
  );
  const seenMod = new Set<string>();
  const modifiers: EncoreModifierSpec[] = rawModifiers.map((item, index) => {
    const label = `modifiers[${index}]`;
    field(record(item), file, label);
    const id = item.id;
    field(isEncoreModifierId(id), file, `${label}.id`);
    field(!seenMod.has(id), file, `${label}.id (duplicate ${id})`);
    seenMod.add(id);
    return {
      id,
      name: nonEmptyString(item, "name", file, `${label}.name`),
      shortLabel: nonEmptyString(item, "shortLabel", file, `${label}.shortLabel`),
      description: nonEmptyString(item, "description", file, `${label}.description`),
    };
  });
  const rawBosses = value.bosses;
  field(array(rawBosses) && rawBosses.length > 0, file, "bosses");
  const seenBoss = new Set<string>();
  const seenTrophy = new Set<string>();
  const bosses: EncoreBossSpec[] = rawBosses.map((item, index) => {
    const label = `bosses[${index}]`;
    field(record(item), file, label);
    const critterId = nonEmptyString(item, "critterId", file, `${label}.critterId`);
    field(critters[critterId] !== undefined, file, `${label}.critterId (unknown ${critterId})`);
    field(!seenBoss.has(critterId), file, `${label}.critterId (duplicate ${critterId})`);
    seenBoss.add(critterId);
    const trophyId = nonEmptyString(item, "trophyId", file, `${label}.trophyId`);
    field(/^[a-z][a-z0-9-]*$/.test(trophyId), file, `${label}.trophyId`);
    field(!seenTrophy.has(trophyId), file, `${label}.trophyId (duplicate ${trophyId})`);
    seenTrophy.add(trophyId);
    return {
      critterId,
      title: nonEmptyString(item, "title", file, `${label}.title`),
      calmTitle: nonEmptyString(item, "calmTitle", file, `${label}.calmTitle`),
      region: nonEmptyString(item, "region", file, `${label}.region`),
      blurb: nonEmptyString(item, "blurb", file, `${label}.blurb`),
      encoreIntro: nonEmptyString(item, "encoreIntro", file, `${label}.encoreIntro`),
      trophyId,
      trophyName: nonEmptyString(item, "trophyName", file, `${label}.trophyName`),
      isFinale: boolean(item, "isFinale", file, `${label}.isFinale`),
    };
  });
  return { baseCoins, coinsPerStar, pureHeartFeelingBonus, modifiers, bosses };
}

export function parseTreatBaskets(
  value: unknown,
  file: string,
  treats: readonly TreatItem[],
): TreatBasket[] {
  field(record(value), file, "object");
  if (value.baskets === undefined) return [];
  field(array(value.baskets), file, "baskets");
  const knownTreats = new Set(treats.map((item) => item.id));
  const seen = new Set<string>();
  return value.baskets.map((item, index): TreatBasket => {
    const label = `baskets[${index}]`;
    field(record(item), file, label);
    const id = nonEmptyString(item, "id", file, `${label}.id`);
    field(/^[a-z][a-z0-9-]*$/.test(id), file, `${label}.id`);
    field(!seen.has(id), file, `${label}.id (duplicate ${id})`);
    seen.add(id);
    const name = nonEmptyString(item, "name", file, `${label}.name`);
    const price = integerIn(item, "price", 1, file, `${label}.price`);
    const snacks = integerIn(item, "snacks", 0, file, `${label}.snacks`);
    field(record(item.treats) && !Array.isArray(item.treats), file, `${label}.treats`);
    const bundled: Record<string, number> = {};
    let totalTreats = 0;
    for (const [treatId, count] of Object.entries(item.treats)) {
      field(knownTreats.has(treatId), file, `${label}.treats (unknown treat ${treatId})`);
      field(isInteger(count) && count >= 1 && count <= 20, file, `${label}.treats.${treatId}`);
      bundled[treatId] = count;
      totalTreats += count;
    }
    field(totalTreats > 0, file, `${label}.treats (must include at least one treat)`);
    return { id, name, price, treats: bundled, snacks };
  });
}
