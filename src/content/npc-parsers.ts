import type {
  Area,
  CharacterContent,
  Critter,
  NpcAmbientRule,
  NpcBanterPair,
  NpcChatterTone,
  NpcCondition,
  NpcDialogueTurn,
  NpcEmoteKind,
  NpcPartyBanter,
  NpcPersonality,
  NpcProfile,
  NpcProfilesContent,
  NpcStoryStage,
  NpcStroll,
  NpcToolEvent,
  NpcToolEventTone,
  NpcToolTrigger,
  PartyContent,
  Point,
} from "../core";
import { field, record, strings } from "./parsers";

const npcPersonalities: readonly NpcPersonality[] = [
  "gardener", "sailor", "naturalist", "cozy", "scholar", "ranger", "kid-bouncy",
  "artist", "shepherd", "chef", "teacher", "family", "fairy", "mystic",
];

function isNpcPersonality(value: unknown): value is NpcPersonality {
  return npcPersonalities.some((item) => item === value);
}

const npcEmotes: readonly NpcEmoteKind[] = ["wave", "sparkle", "worry", "note", "heart"];

function isNpcEmote(value: unknown): value is NpcEmoteKind {
  return npcEmotes.some((item) => item === value);
}

const npcStoryStages: readonly NpcStoryStage[] = [
  "morning", "fountain_chaos", "park_trail", "school_mystery", "bay_pass",
  "clubhouse", "recess", "finale_ready", "forest_calm", "awake",
];

function isNpcStoryStage(value: unknown): value is NpcStoryStage {
  return npcStoryStages.some((item) => item === value);
}

const npcChatterTones: readonly NpcChatterTone[] = [
  "normal", "lantern", "worry", "warm", "banter", "music",
];

function isNpcChatterTone(value: unknown): value is NpcChatterTone {
  return npcChatterTones.some((item) => item === value);
}

const npcToolTriggers: readonly NpcToolTrigger[] = ["lantern", "flute", "lasso"];

function isNpcToolTrigger(value: unknown): value is NpcToolTrigger {
  return npcToolTriggers.some((item) => item === value);
}

const npcToolEventTones: readonly NpcToolEventTone[] = ["lantern", "music", "warm"];

function isNpcToolEventTone(value: unknown): value is NpcToolEventTone {
  return npcToolEventTones.some((item) => item === value);
}

function knownCalmNames(
  areas: Record<string, Area>,
  critters: Record<string, Critter>,
): Set<string> {
  const known = new Set<string>();
  for (const area of Object.values(areas))
    for (const piece of area.critters) known.add(piece.id);
  for (const critter of Object.values(critters)) known.add(critter.species);
  return known;
}

export function parseNpcStroll(
  raw: unknown,
  npcPoint: Point,
  file: string,
  label: string,
): NpcStroll | undefined {
  if (raw === undefined) return undefined;
  field(record(raw), file, label);
  const rawWaypoints = raw.waypoints;
  field(Array.isArray(rawWaypoints) && rawWaypoints.length >= 2, file, `${label}.waypoints`);
  const waypoints: Point[] = rawWaypoints.map((entry, index): Point => {
    field(
      record(entry) &&
        typeof entry.x === "number" &&
        Number.isFinite(entry.x) &&
        typeof entry.y === "number" &&
        Number.isFinite(entry.y),
      file,
      `${label}.waypoints[${index}]`,
    );
    return { x: entry.x, y: entry.y };
  });
  const first = waypoints[0];
  field(
    first !== undefined && first.x === npcPoint.x && first.y === npcPoint.y,
    file,
    `${label}.waypoints[0] (must match npc.point)`,
  );
  const speed = raw.speed;
  field(
    typeof speed === "number" && Number.isFinite(speed) && speed > 0 && speed <= 2,
    file,
    `${label}.speed`,
  );
  const pauseTicks = raw.pauseTicks;
  field(
    typeof pauseTicks === "number" && Number.isInteger(pauseTicks) && pauseTicks >= 30,
    file,
    `${label}.pauseTicks`,
  );
  return { waypoints, speed, pauseTicks };
}

export function npcScheduleErrors(
  areas: Record<string, Area>,
  critters: Record<string, Critter>,
  storyVariable: (name: string) => unknown,
): string[] {
  const errors: string[] = [];
  const calms = knownCalmNames(areas, critters);
  for (const area of Object.values(areas)) {
    for (const npc of area.npcs) {
      if (npc.visibleWhile !== undefined && storyVariable(npc.visibleWhile) === undefined)
        errors.push(`${area.id}/${npc.id}: undeclared visibleWhile ${npc.visibleWhile}`);
      if (npc.hiddenWhile !== undefined && storyVariable(npc.hiddenWhile) === undefined)
        errors.push(`${area.id}/${npc.id}: undeclared hiddenWhile ${npc.hiddenWhile}`);
      if (npc.visibleAfterCalm !== undefined && !calms.has(npc.visibleAfterCalm))
        errors.push(`${area.id}/${npc.id}: unknown visibleAfterCalm ${npc.visibleAfterCalm}`);
      if (npc.hiddenAfterCalm !== undefined && !calms.has(npc.hiddenAfterCalm))
        errors.push(`${area.id}/${npc.id}: unknown hiddenAfterCalm ${npc.hiddenAfterCalm}`);
    }
  }
  return errors;
}

function parseNpcCondition(
  value: unknown,
  file: string,
  label: string,
  calms: Set<string>,
  party: Record<string, PartyContent>,
  storyVariable: (name: string) => unknown,
): NpcCondition | undefined {
  if (value === undefined) return undefined;
  field(record(value), file, label);
  const condition: NpcCondition = {};
  const checkVar = (key: "variable" | "notVariable"): void => {
    const raw = value[key];
    if (raw === undefined) return;
    field(typeof raw === "string" && storyVariable(raw) !== undefined,
      file, `${label}.${key} (${String(raw)})`);
    condition[key] = raw;
  };
  const checkCalm = (key: "calmed" | "notCalmed"): void => {
    const raw = value[key];
    if (raw === undefined) return;
    field(typeof raw === "string" && calms.has(raw), file, `${label}.${key} (${String(raw)})`);
    condition[key] = raw;
  };
  checkVar("variable");
  checkVar("notVariable");
  checkCalm("calmed");
  checkCalm("notCalmed");
  if (value.withParty !== undefined) {
    field(typeof value.withParty === "string" && party[value.withParty] !== undefined,
      file, `${label}.withParty`);
    condition.withParty = value.withParty;
  }
  const checkBool = (
    key: "lanternOn" | "areaCalm" | "chaosNearby" | "justCalmed" | "recentFlute" | "hasTreats",
  ): void => {
    const raw = value[key];
    if (raw === undefined) return;
    field(typeof raw === "boolean", file, `${label}.${key}`);
    condition[key] = raw;
  };
  checkBool("lanternOn");
  checkBool("areaCalm");
  checkBool("chaosNearby");
  checkBool("justCalmed");
  checkBool("recentFlute");
  checkBool("hasTreats");
  const checkCount = (key: "minStickers" | "minGems" | "minBossesCalmed"): void => {
    const raw = value[key];
    if (raw === undefined) return;
    field(typeof raw === "number" && Number.isInteger(raw) && raw >= 0, file, `${label}.${key}`);
    condition[key] = raw;
  };
  checkCount("minStickers");
  checkCount("minGems");
  checkCount("minBossesCalmed");
  if (value.storyStage !== undefined) {
    field(isNpcStoryStage(value.storyStage), file, `${label}.storyStage`);
    condition.storyStage = value.storyStage;
  }
  return condition;
}

export function parseNpcProfiles(
  raw: unknown,
  characters: Record<string, CharacterContent>,
  areas: Record<string, Area>,
  critters: Record<string, Critter>,
  party: Record<string, PartyContent>,
  storyVariable: (name: string) => unknown,
  file = "content/npc-profiles.json",
): NpcProfilesContent {
  field(record(raw) && Array.isArray(raw.profiles) && Array.isArray(raw.banter),
    file, "profiles/banter");
  const calms = knownCalmNames(areas, critters);
  const seenProfiles = new Set<string>();
  const profiles: NpcProfile[] = raw.profiles.map((entry, index): NpcProfile => {
    const label = `profiles[${index}]`;
    field(record(entry), file, label);
    const id = entry.id;
    field(typeof id === "string" && id.length > 0 && id !== "bus-stop" &&
      characters[id] !== undefined && !seenProfiles.has(id), file, `${label}.id (${String(id)})`);
    seenProfiles.add(id);
    const name = entry.name;
    field(typeof name === "string" && name.trim().length > 0, file, `${label}.name`);
    const adult = entry.adult;
    field(typeof adult === "boolean", file, `${label}.adult`);
    const personality = entry.personality;
    field(isNpcPersonality(personality), file, `${label}.personality`);
    const greetRange = entry.greetRange;
    field(typeof greetRange === "number" && Number.isFinite(greetRange) && greetRange > 0,
      file, `${label}.greetRange`);
    const lookAroundTicks = entry.lookAroundTicks;
    field(typeof lookAroundTicks === "number" && Number.isInteger(lookAroundTicks) &&
      lookAroundTicks > 0, file, `${label}.lookAroundTicks`);
    const favoriteParty = entry.favoriteParty;
    field(strings(favoriteParty), file, `${label}.favoriteParty`);
    for (const memberId of favoriteParty)
      field(party[memberId] !== undefined, file, `${label}.favoriteParty (${memberId})`);
    const rawRules = entry.rules;
    field(Array.isArray(rawRules), file, `${label}.rules`);
    const seenRules = new Set<string>();
    const rules: NpcAmbientRule[] = rawRules.map((rawRule, ruleIndex): NpcAmbientRule => {
      const ruleLabel = `${label}.rules[${ruleIndex}]`;
      field(record(rawRule), file, ruleLabel);
      const ruleId = rawRule.id;
      field(typeof ruleId === "string" && ruleId.trim().length > 0 && !seenRules.has(ruleId),
        file, `${ruleLabel}.id`);
      seenRules.add(ruleId);
      const text = rawRule.text;
      field(typeof text === "string" && text.trim().length >= 1 && text.length <= 60,
        file, `${ruleLabel}.text`);
      const priority = rawRule.priority;
      field(typeof priority === "number" && Number.isFinite(priority),
        file, `${ruleLabel}.priority`);
      const emote = rawRule.emote;
      field(emote === undefined || isNpcEmote(emote), file, `${ruleLabel}.emote`);
      const when = parseNpcCondition(
        rawRule.when, file, `${ruleLabel}.when`, calms, party, storyVariable,
      );
      return {
        id: ruleId,
        text,
        priority,
        ...(emote === undefined ? {} : { emote }),
        ...(when === undefined ? {} : { when }),
      };
    });
    return {
      id,
      name,
      adult,
      personality,
      greetRange,
      lookAroundTicks,
      favoriteParty: [...favoriteParty],
      rules,
    };
  });
  const seenBanter = new Set<string>();
  const banter: NpcBanterPair[] = raw.banter.map((entry, index): NpcBanterPair => {
    const label = `banter[${index}]`;
    field(record(entry), file, label);
    const id = entry.id;
    field(typeof id === "string" && id.trim().length > 0 && !seenBanter.has(id),
      file, `${label}.id`);
    seenBanter.add(id);
    const areaId = entry.area;
    field(typeof areaId === "string" && areas[areaId] !== undefined, file, `${label}.area`);
    const area = areas[areaId];
    const speakers = entry.speakers;
    field(strings(speakers) && speakers.length === 2, file, `${label}.speakers`);
    const [first, second] = speakers;
    field(first !== undefined && second !== undefined && first !== second &&
      characters[first] !== undefined && characters[second] !== undefined &&
      area.npcs.some((npc) => npc.id === first) && area.npcs.some((npc) => npc.id === second),
    file, `${label}.speakers`);
    const lines = entry.lines;
    field(strings(lines) && lines.length === 2, file, `${label}.lines`);
    const [firstLine, secondLine] = lines;
    field(firstLine !== undefined && secondLine !== undefined &&
      firstLine.trim().length >= 1 && firstLine.length <= 60 &&
      secondLine.trim().length >= 1 && secondLine.length <= 60, file, `${label}.lines`);
    const when = parseNpcCondition(
      entry.when, file, `${label}.when`, calms, party, storyVariable,
    );
    return {
      id,
      area: areaId,
      speakers: [first, second],
      lines: [firstLine, secondLine],
      ...(when === undefined ? {} : { when }),
    };
  });

  const parseTurns = (
    rawTurns: unknown,
    label: string,
    allowedSpeaker: (speaker: string) => boolean,
  ): NpcDialogueTurn[] => {
    field(Array.isArray(rawTurns) && rawTurns.length >= 1 && rawTurns.length <= 2,
      file, `${label}.turns`);
    return rawTurns.map((rawTurn, turnIndex): NpcDialogueTurn => {
      const turnLabel = `${label}.turns[${turnIndex}]`;
      field(record(rawTurn), file, turnLabel);
      const speaker = rawTurn.speaker;
      field(typeof speaker === "string" && allowedSpeaker(speaker),
        file, `${turnLabel}.speaker (${String(speaker)})`);
      const text = rawTurn.text;
      field(typeof text === "string" && text.trim().length >= 1 && text.length <= 48,
        file, `${turnLabel}.text`);
      return { speaker, text };
    });
  };

  const rawPartyBanter = raw.partyBanter ?? [];
  field(Array.isArray(rawPartyBanter), file, "partyBanter");
  const seenPartyBanter = new Set<string>();
  const partyBanter: NpcPartyBanter[] = rawPartyBanter.map((entry, index): NpcPartyBanter => {
    const label = `partyBanter[${index}]`;
    field(record(entry), file, label);
    const id = entry.id;
    field(typeof id === "string" && id.trim().length > 0 && !seenPartyBanter.has(id),
      file, `${label}.id`);
    seenPartyBanter.add(id);
    const areaId = entry.area;
    field(typeof areaId === "string" && areas[areaId] !== undefined, file, `${label}.area`);
    const turns = parseTurns(entry.turns, label, (speaker) => party[speaker] !== undefined);
    const tone = entry.tone;
    field(tone === undefined || isNpcChatterTone(tone), file, `${label}.tone`);
    const when = parseNpcCondition(
      entry.when, file, `${label}.when`, calms, party, storyVariable,
    );
    return {
      id,
      area: areaId,
      turns,
      ...(tone === undefined ? {} : { tone }),
      ...(when === undefined ? {} : { when }),
    };
  });

  const rawToolEvents = raw.toolEvents ?? [];
  field(Array.isArray(rawToolEvents), file, "toolEvents");
  const seenToolEvents = new Set<string>();
  const toolEvents: NpcToolEvent[] = rawToolEvents.map((entry, index): NpcToolEvent => {
    const label = `toolEvents[${index}]`;
    field(record(entry), file, label);
    const id = entry.id;
    field(typeof id === "string" && id.trim().length > 0 && !seenToolEvents.has(id),
      file, `${label}.id`);
    seenToolEvents.add(id);
    const areaId = entry.area;
    field(typeof areaId === "string" && areas[areaId] !== undefined, file, `${label}.area`);
    const area = areas[areaId];
    const trigger = entry.trigger;
    field(isNpcToolTrigger(trigger), file, `${label}.trigger`);
    const radius = entry.radius;
    field(typeof radius === "number" && Number.isFinite(radius) && radius > 0,
      file, `${label}.radius`);
    const tone = entry.tone;
    field(isNpcToolEventTone(tone), file, `${label}.tone`);
    const turns = parseTurns(
      entry.turns,
      label,
      (speaker) =>
        area.npcs.some((npc) => npc.id === speaker) || party[speaker] !== undefined,
    );
    const hasAreaNpcs = area.npcs.some(
      (npc) => npc.id !== "bus-stop" && !npc.id.startsWith("sanctuary-"),
    );
    field(
      !hasAreaNpcs || turns.some((turn) => area.npcs.some((npc) => npc.id === turn.speaker)),
      file,
      `${label}.turns (needs an area NPC speaker)`,
    );
    const when = parseNpcCondition(
      entry.when, file, `${label}.when`, calms, party, storyVariable,
    );
    return {
      id,
      area: areaId,
      trigger,
      radius,
      tone,
      turns,
      ...(when === undefined ? {} : { when }),
    };
  });

  return { profiles, banter, partyBanter, toolEvents };
}
