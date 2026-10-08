import type { State } from "./types";

export type SoundCue =
  | "dialogue-open" | "dialogue-advance" | "dialogue-blip" | "dialogue-close"
  | "choice-move" | "choice-select" | "journal-open" | "journal-close"
  | "footstep" | "door" | "area-arrive" | "coin" | "item" | "sticker"
  | "lantern-on" | "lantern-off" | "battle-start" | "battle-command"
  | "battle-hit" | "battle-win" | "battle-run" | "battle-rest";

/** Sound is a projection of state changes, never a second game state machine. */
export function soundCues(previous: State, next: State): SoundCue[] {
  const cues: SoundCue[] = [];
  const oldDialogue = previous.dialogue;
  const newDialogue = next.dialogue;
  if (oldDialogue === null && newDialogue !== null) cues.push("dialogue-open");
  if (oldDialogue !== null && newDialogue === null) cues.push("dialogue-close");
  if (oldDialogue !== null && newDialogue !== null) {
    if (oldDialogue.text !== newDialogue.text) cues.push("dialogue-advance");
    else if (newDialogue.revealed > oldDialogue.revealed && next.tick % 3 === 0)
      cues.push("dialogue-blip");
    if (oldDialogue.selected !== newDialogue.selected) cues.push("choice-move");
  }
  if (oldDialogue !== null && newDialogue !== null &&
      oldDialogue.choices.length !== newDialogue.choices.length)
    cues.push("choice-select");

  if (!previous.journalOpen && next.journalOpen) cues.push("journal-open");
  if (previous.journalOpen && !next.journalOpen) cues.push("journal-close");
  if (previous.transition === null && next.transition !== null) cues.push("door");
  if ((previous.area !== next.area && next.transition === null) ||
      (previous.transition?.phase === "in" && next.transition === null))
    cues.push("area-arrive");
  if (!previous.lantern && next.lantern) cues.push("lantern-on");
  if (previous.lantern && !next.lantern) cues.push("lantern-off");
  if (next.coins > previous.coins) cues.push("coin");
  if (next.snacks > previous.snacks) cues.push("item");
  if (next.stickers.length > previous.stickers.length) cues.push("sticker");
  if (next.motion.moving && next.motion.distance > previous.motion.distance && next.tick % 8 === 0)
    cues.push("footstep");

  if (previous.battle === null && next.battle !== null) cues.push("battle-start");
  if (previous.battle !== null && next.battle === null) {
    if (previous.battle.phase === "reward") cues.push("battle-win");
    else if (previous.battle.phase === "run") cues.push("battle-run");
    else if (previous.battle.phase === "rest") cues.push("battle-rest");
  }
  if (previous.battle !== null && next.battle !== null) {
    if (previous.battle.command !== next.battle.command && next.battle.command !== null)
      cues.push("battle-command");
    if (previous.battle.phase !== next.battle.phase &&
        (next.battle.phase === "result" || next.battle.phase === "burstResult"))
      cues.push("battle-hit");
  }
  return cues;
}
