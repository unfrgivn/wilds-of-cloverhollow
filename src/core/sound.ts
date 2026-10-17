import type { CheckState, State, World } from "./types";
import { surfaceAt } from "./surfaces";

export type SoundCue =
  | "dialogue-open" | "dialogue-advance" | "dialogue-blip" | "dialogue-close"
  | "choice-move" | "choice-select" | "journal-open" | "journal-close"
  | `footstep-${import("./surfaces").Surface}`
  | "door" | "area-arrive" | "coin" | "item" | "sticker"
  | "lantern-on" | "lantern-off" | "battle-start" | "battle-command"
  | "battle-hit" | "battle-win" | "battle-run" | "battle-rest"
  | "battle-beat"
  | "claw-move" | "claw-drop" | "claw-grab" | "claw-miss" | "prize-won"
  | "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute";

export type StorySound = "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute";

export const storySounds: readonly StorySound[] = [
  "chime-red", "chime-yellow", "chime-green", "chime-blue", "flute",
];

export function isStorySound(value: string): value is StorySound {
  return storySounds.some((sound) => sound === value);
}

/** Sound is a projection of state changes, never a second game state machine. */
export function soundCues(
  previous: State,
  next: State,
  world: Pick<World, "surfaces">,
): SoundCue[] {
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
  if (newDialogue !== null && newDialogue.sound !== undefined &&
      (oldDialogue === null || previous.ink !== next.ink ||
        oldDialogue.sound !== newDialogue.sound))
    cues.push(newDialogue.sound);
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
  // The lantern's peek at a battle's feelings sounds like switching it on.
  if (previous.battle !== null && next.battle !== null &&
      !previous.battle.lanternPeek && next.battle.lanternPeek)
    cues.push("lantern-on");
  if (previous.lantern && !next.lantern) cues.push("lantern-off");
  if (next.coins > previous.coins) cues.push("coin");
  if (next.snacks > previous.snacks) cues.push("item");
  if (next.stickers.length > previous.stickers.length) cues.push("sticker");
  if (next.motion.moving && next.motion.distance > previous.motion.distance &&
      next.tick % 8 === 0) {
    const map = world.surfaces[next.area];
    if (map === undefined) throw new Error(`unknown area ${next.area}`);
    cues.push(`footstep-${surfaceAt(map, next.player)}`);
  }

  if (previous.battle === null && next.battle !== null) cues.push("battle-start");
  if (previous.battle !== null && next.battle === null) {
    if (previous.battle.phase === "reward") cues.push("battle-win");
    else if (previous.battle.phase === "run") cues.push("battle-run");
    else if (previous.battle.phase === "rest") cues.push("battle-rest");
  }
  if (previous.battle !== null && next.battle !== null) {
    // A beat popped or a toy caught (a new check starts back at none).
    if (hits(next.battle.check) > hits(previous.battle.check)) cues.push("battle-beat");
    if (previous.battle.command !== next.battle.command && next.battle.command !== null)
      cues.push("battle-command");
    if (previous.battle.phase !== next.battle.phase &&
        (next.battle.phase === "result" || next.battle.phase === "burstResult"))
      cues.push("battle-hit");
  }
  if (previous.arcade?.phase !== next.arcade?.phase) {
    const phase = next.arcade?.phase;
    if (phase === "sliding" || phase === "pushing") cues.push("claw-move");
    if (phase === "dropping") cues.push("claw-drop");
    if (phase === "lifting")
      cues.push(next.arcade?.outcome === "grabbed" ? "claw-grab" : "claw-miss");
    if (phase === "result" && next.arcade?.outcome === "grabbed") cues.push("prize-won");
  }
  return cues;
}

// How many beats or toys a chain or catch has hit so far; other checks none.
function hits(check: CheckState | null): number {
  return check?.kind === "chain" || check?.kind === "catch"
    ? check.results.filter((result) => result === "hit").length
    : 0;
}
