import type { Battle, BattleView } from "../core";
import type { AtlasImage } from "./atlas";

export type BattlePortraitMood =
  | "cozy"
  | "eager"
  | "cheering"
  | "flustered"
  | "radiant";

export type BattlePortraitItem = {
  id: string;
  name: string;
  mood: BattlePortraitMood;
  active: boolean;
  image: AtlasImage | null;
};

function memberName(id: string): string {
  if (id === "fae") return "Fae";
  if (id.length === 0) return "";
  return `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

function actorForCommand(
  commandId: string | null,
  fighters: readonly string[],
  partyCommands: Readonly<Record<string, string | null>>,
): string | null {
  if (commandId === null) return null;
  if (commandId === "soothe" || commandId === "snack" || commandId === "talk") return "fae";
  for (const id of fighters) {
    if (partyCommands[id] === commandId) return id;
  }
  return null;
}

/**
 * Pure emotion evaluator for battle party medallions (spec 8.1): computes the
 * fighting party strip (`Fae` plus active battle friends, excluding flute
 * friends) and assigns each member an expressive mood from the current battle
 * state.
 */
export function evaluateBattlePortraits(input: {
  battle: Battle;
  view: BattleView | null;
  partyIds: readonly string[];
  partyCommands: Readonly<Record<string, string | null>>;
  energy: number;
  resolveImage: (id: string) => AtlasImage | null;
}): BattlePortraitItem[] {
  const { battle, view, partyIds, partyCommands, energy, resolveImage } = input;
  const fighters: string[] = [];
  for (const id of partyIds) {
    if (id === "fae") continue;
    if ((partyCommands[id] ?? null) === null) continue;
    if (!fighters.includes(id)) fighters.push(id);
  }
  const members = ["fae", ...fighters];

  let selectedActorId: string | null = null;
  if (battle.phase === "command") {
    if (battle.treatMenu === true) {
      selectedActorId = "fae";
    } else {
      const highlighted = view?.commands[battle.selected]?.id ?? null;
      selectedActorId = actorForCommand(highlighted, fighters, partyCommands);
    }
  } else if (battle.phase === "check" || battle.phase === "result") {
    selectedActorId = actorForCommand(battle.command, fighters, partyCommands);
  }

  const togetherActive =
    battle.command === "together" &&
    (battle.phase === "check" || battle.phase === "result");
  const isRadiant = view?.sparkle?.ready === true || togetherActive;
  const isCheering =
    battle.phase === "soothed" ||
    battle.phase === "reward" ||
    (battle.phase === "result" && battle.lastGrade === "great");
  const isFlustered =
    (battle.phase === "burstResult" && battle.lastGrade !== "great") ||
    (energy <= 1 && battle.phase !== "soothed" && battle.phase !== "reward");

  return members.map((id) => {
    const active = togetherActive || id === selectedActorId;
    let mood: BattlePortraitMood;
    if (isRadiant) {
      mood = "radiant";
    } else if (isCheering) {
      mood = "cheering";
    } else if (isFlustered) {
      mood = "flustered";
    } else if (
      id === selectedActorId &&
      (battle.phase === "command" || battle.phase === "check")
    ) {
      mood = "eager";
    } else {
      mood = "cozy";
    }
    return {
      id,
      name: memberName(id),
      mood,
      active,
      image: resolveImage(id),
    };
  });
}
