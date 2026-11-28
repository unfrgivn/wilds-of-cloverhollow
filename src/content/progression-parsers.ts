import { isEncoreModifierId, ENCORE_MODIFIER_IDS } from "../core/encore";
import {
  array,
  boolean,
  faeSideCheck,
  field,
  integerIn,
  isInteger,
  isPositive,
  nonEmptyString,
  optionalString,
  positive,
  record,
  strings,
} from "./parsers";
import type {
  Critter,
  EncoreBossSpec,
  EncoreContent,
  EncoreModifierSpec,
  LevelContent,
  PartyContent,
  SharedCommandId,
  StickerCatalogue,
  TreatBasket,
  TreatItem,
} from "../core";

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
