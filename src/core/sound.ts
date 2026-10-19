import type { CheckState, State, World } from "./types";
import { levelForXp } from "./levels";
import { surfaceAt } from "./surfaces";

export type SoundCue =
  | "dialogue-open" | "dialogue-advance" | "dialogue-blip" | "dialogue-close"
  | "choice-move" | "choice-select" | "journal-open" | "journal-close"
  | `footstep-${import("./surfaces").Surface}`
  | "door" | "area-arrive" | "coin" | "item" | "sticker"
  | "lantern-on" | "lantern-off" | "battle-start" | "battle-command"
  | "battle-hit" | "battle-win" | "battle-run" | "battle-rest"
  | "battle-beat"
  | "level-up"
  | "claw-move" | "claw-drop" | "claw-grab" | "claw-miss" | "prize-won"
  | "skee-aim" | "skee-roll" | "skee-score" | "skee-hundred" | "tickets-won"
  | "mole-pop" | "mole-boop" | "mole-whiff"
  | "comet-move" | "comet-star" | "comet-bump"
  | "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute"
  | "flute-red" | "flute-yellow" | "flute-green" | "flute-blue";

export type StorySound = "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute"
  | "flute-red" | "flute-yellow" | "flute-green" | "flute-blue";

export const storySounds: readonly StorySound[] = [
  "chime-red", "chime-yellow", "chime-green", "chime-blue", "flute",
  "flute-red", "flute-yellow", "flute-green", "flute-blue",
];

export function isStorySound(value: string): value is StorySound {
  return storySounds.some((sound) => sound === value);
}

/** Sound is a projection of state changes, never a second game state machine. */
export function soundCues(
  previous: State,
  next: State,
  world: Pick<World, "surfaces" | "arcade" | "levels">,
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
  if (levelForXp(world.levels, next.xp) > levelForXp(world.levels, previous.xp) ||
      next.party.some((member) => {
        const old = previous.party.find((candidate) => candidate.id === member.id);
        return old !== undefined && levelForXp(world.levels, member.xp) >
          levelForXp(world.levels, old.xp);
      })) cues.push("level-up");
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
    // A beat popped, a toy caught, or a puff held (a new check starts back
    // at none).
    if (hits(next.battle.check) > hits(previous.battle.check)) cues.push("battle-beat");
    if (previous.battle.command !== next.battle.command && next.battle.command !== null)
      cues.push("battle-command");
    if (previous.battle.phase !== next.battle.phase &&
        (next.battle.phase === "result" || next.battle.phase === "burstResult"))
      cues.push("battle-hit");
  }
  const game = next.arcade;
  const newPhase = game !== null && previous.arcade?.phase !== game.phase;
  if (game?.game === "claw" && newPhase) {
    if (game.phase === "sliding" || game.phase === "pushing") cues.push("claw-move");
    if (game.phase === "dropping") cues.push("claw-drop");
    if (game.phase === "lifting")
      cues.push(game.outcome === "grabbed" ? "claw-grab" : "claw-miss");
    if (game.phase === "result" && game.outcome === "grabbed") cues.push("prize-won");
  }
  if (game?.game === "skee" && newPhase) {
    if (game.phase === "winding") cues.push("skee-aim");
    if (game.phase === "rolling") cues.push("skee-roll");
    if (game.phase === "scored")
      cues.push(game.throws.at(-1)?.points === world.arcade.skee.corners.points
        ? "skee-hundred" : "skee-score");
    if (game.phase === "result") cues.push("tickets-won");
  }
  // Boop-a-Mole: a mole pops up the tick it starts rising, and the hammer's
  // swing boops or squeaks the tick it lands.
  if (game?.game === "mole") {
    if (game.phase === "playing" && game.stage === "rising" && game.stageTicks === 0)
      cues.push("mole-pop");
    if (game.hammer?.ticks === 0) cues.push(game.hammer.hit ? "mole-boop" : "mole-whiff");
    if (game.phase === "result" && newPhase) cues.push("tickets-won");
  }
  if (game?.game === "comet") {
    const was = previous.arcade?.game === "comet" ? previous.arcade : null;
    if (was !== null && game.lane !== was.lane) cues.push("comet-move");
    if (was !== null && game.caught > was.caught) cues.push("comet-star");
    if (was !== null && game.bumps > was.bumps) cues.push("comet-bump");
    if (game.phase === "result" && newPhase) cues.push("tickets-won");
  }
  return cues;
}

// How many beats, toys, or puffs a chain, catch, or lean has hit so far;
// other checks none.
function hits(check: CheckState | null): number {
  return check?.kind === "chain" || check?.kind === "catch" ||
    check?.kind === "lean" || check?.kind === "trace"
    ? check.results.filter((result) => result === "hit").length
    : 0;
}
