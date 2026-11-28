import type { CheckState, Direction, State, World } from "./types";
import { levelForXp } from "./levels";
import { surfaceAt } from "./surfaces";

export type SoundCue =
  | "dialogue-open" | "dialogue-advance" | "dialogue-blip" | "dialogue-close"
  | "choice-move" | "choice-select" | "journal-open" | "journal-close"
  | `footstep-${import("./surfaces").Surface}`
  | "door" | "area-arrive" | "coin" | "item" | "sticker"
  | "lantern-on" | "lantern-off" | "battle-start" | "battle-command"
  | "battle-together" | "battle-hit" | "battle-recover" | "battle-win" | "battle-run"
  | "battle-rest" | "battle-faint" | "battle-beat"
  | "level-up"
  | "claw-move" | "claw-drop" | "claw-grab" | "claw-miss" | "prize-won"
  | "skee-aim" | "skee-roll" | "skee-score" | "skee-hundred" | "tickets-won"
  | "mole-pop" | "mole-boop" | "mole-whiff"
  | "comet-move" | "comet-star" | "comet-bump"
  | "cook-start" | "cook-frozen" | "cook-ding"
  | "fish-cast" | "fish-nibble" | "fish-bite" | "fish-reel" | "fish-catch"
  | "taco-top" | "taco-oops" | "taco-order"
  | "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute"
  | "flute-red" | "flute-yellow" | "flute-green" | "flute-blue"
  | "lasso-twirl";

export type StorySound = "chime-red" | "chime-yellow" | "chime-green" | "chime-blue" | "flute"
  | "flute-red" | "flute-yellow" | "flute-green" | "flute-blue";

export const storySounds: readonly StorySound[] = [
  "chime-red", "chime-yellow", "chime-green", "chime-blue", "flute",
  "flute-red", "flute-yellow", "flute-green", "flute-blue",
];

export function isStorySound(value: string): value is StorySound {
  return storySounds.some((sound) => sound === value);
}

const allSoundCues: Readonly<Record<SoundCue, true>> = {
  "dialogue-open": true, "dialogue-advance": true, "dialogue-blip": true, "dialogue-close": true,
  "choice-move": true, "choice-select": true, "journal-open": true, "journal-close": true,
  "footstep-grass": true, "footstep-sand": true, "footstep-wood": true, "footstep-snow": true,
  "footstep-stone": true, "footstep-tile": true, "footstep-carpet": true,
  door: true, "area-arrive": true, coin: true, item: true, sticker: true,
  "lantern-on": true, "lantern-off": true, "battle-start": true, "battle-command": true,
  "battle-together": true, "battle-hit": true, "battle-recover": true, "battle-win": true,
  "battle-run": true, "battle-rest": true, "battle-faint": true, "battle-beat": true,
  "level-up": true,
  "claw-move": true, "claw-drop": true, "claw-grab": true, "claw-miss": true, "prize-won": true,
  "skee-aim": true, "skee-roll": true, "skee-score": true, "skee-hundred": true,
  "tickets-won": true,
  "mole-pop": true, "mole-boop": true, "mole-whiff": true,
  "comet-move": true, "comet-star": true, "comet-bump": true,
  "cook-start": true, "cook-frozen": true, "cook-ding": true,
  "fish-cast": true, "fish-nibble": true, "fish-bite": true, "fish-reel": true, "fish-catch": true,
  "taco-top": true, "taco-oops": true, "taco-order": true,
  "chime-red": true, "chime-yellow": true, "chime-green": true, "chime-blue": true, flute: true,
  "flute-red": true, "flute-yellow": true, "flute-green": true, "flute-blue": true,
  "lasso-twirl": true,
};

export function isSoundCue(value: string): value is SoundCue {
  return Object.hasOwn(allSoundCues, value);
}

/** Sound is a projection of state changes, never a second game state machine. */
export function soundCues(
  previous: State,
  next: State,
  world: Pick<World, "surfaces" | "arcade" | "levels" | "tunables">,
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
  if (next.snacks > previous.snacks ||
      treatCount(next.treats) > treatCount(previous.treats))
    cues.push("item");
  if (next.stickers.length > previous.stickers.length) cues.push("sticker");
  if ((next.encore?.trophies.length ?? 0) > (previous.encore?.trophies.length ?? 0)) {
    cues.push("prize-won");
  }
  if (levelForXp(world.levels, next.xp) > levelForXp(world.levels, previous.xp) ||
      next.party.some((member) => {
        const old = previous.party.find((candidate) => candidate.id === member.id);
        return old !== undefined && levelForXp(world.levels, member.xp) >
          levelForXp(world.levels, old.xp);
      })) cues.push("level-up");
  const stride = world.tunables.walkCycleUnits / 2;
  if (next.motion.moving &&
      Math.floor(next.motion.distance / stride) >
        Math.floor(previous.motion.distance / stride)) {
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
    const prevCheck = previous.battle.check;
    const nextCheck = next.battle.check;
    if (hits(nextCheck) > hits(prevCheck)) cues.push("battle-beat");
    if (nextCheck?.kind === "echo" && nextCheck.activeNote !== null) {
      const demoEnd = nextCheck.spec.notes * (nextCheck.spec.demoTicks + nextCheck.spec.gapTicks);
      const demoStart = nextCheck.tick <= demoEnd && nextCheck.activeTicks === 1;
      const echoed = prevCheck?.kind === "echo" && nextCheck.entered > prevCheck.entered;
      if (demoStart || echoed) {
        const chime = echoChimes[nextCheck.activeNote];
        if (chime !== undefined) cues.push(chime);
      }
    }
    const startedTogether = next.battle.command === "together" &&
      (previous.battle.command !== "together" ||
        (previous.battle.phase !== "check" && next.battle.phase === "check" &&
          next.battle.check?.side === "critter"));
    if (startedTogether) cues.push("battle-together");
    else if (previous.battle.command !== next.battle.command && next.battle.command !== null)
      cues.push("battle-command");
    if (previous.battle.fluteUsed !== true && next.battle.fluteUsed === true)
      cues.push("flute");
    if (previous.battle.lassoUsed !== true && next.battle.lassoUsed === true)
      cues.push("lasso-twirl");
    if (previous.battle.phase !== next.battle.phase &&
        (next.battle.phase === "result" || next.battle.phase === "burstResult")) {
      cues.push(
        next.battle.phase === "result" && next.battle.command === "recover"
          ? "battle-recover"
          : "battle-hit",
      );
    }
  }
  if (next.battle?.phase === "rest" && previous.battle?.phase !== "rest") {
    cues.push("battle-faint");
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
  if (game?.game === "cook" && newPhase) {
    if (game.phase === "cooking") cues.push("cook-start");
    if (game.phase === "paused") cues.push("cook-frozen");
    if (game.phase === "ding") cues.push("cook-ding");
  }
  if (game?.game === "fish") {
    const was = previous.arcade?.game === "fish" ? previous.arcade : null;
    if (newPhase && game.phase === "casting") cues.push("fish-cast");
    if (was !== null && game.phase === "waiting" && game.nibblesLeft < was.nibblesLeft)
      cues.push("fish-nibble");
    if (newPhase && game.phase === "bite") cues.push("fish-bite");
    if (newPhase && game.phase === "reeling") cues.push("fish-reel");
    if (newPhase && game.phase === "result" && game.caught !== null) cues.push("fish-catch");
  }
  if (game?.game === "taco") {
    const was = previous.arcade?.game === "taco" ? previous.arcade : null;
    if (was !== null && game.stepIndex > was.stepIndex) cues.push("taco-top");
    if (was !== null && game.mistakes > was.mistakes) cues.push("taco-oops");
    if (newPhase && game.phase === "order-clear") cues.push("taco-order");
    if (
      newPhase &&
      game.phase === "result" &&
      game.served >= game.orders.length &&
      game.mistakes === 0
    ) {
      cues.push("prize-won");
    }
  }
  if (
    next.tick > previous.tick &&
    next.cutscene !== undefined &&
    next.cutscene.tick > (previous.cutscene?.tick ?? -1)
  ) {
    cues.push(...next.cutscene.tickSfx);
  }
  if (previous.area === next.area) {
    const prevPuzzle = previous.puzzleArea;
    const nextPuzzle = next.puzzleArea;
    if (
      nextPuzzle?.lasso !== undefined &&
      nextPuzzle.lasso.tick === 0 &&
      (prevPuzzle?.lasso === undefined || prevPuzzle.lasso.tick !== 0)
    ) {
      cues.push("lasso-twirl");
    }
    const nextChime = nextPuzzle?.recentChime;
    const prevChime = prevPuzzle?.recentChime;
    if (
      nextChime !== undefined &&
      (prevChime?.tick !== nextChime.tick || prevChime.note !== nextChime.note)
    ) {
      cues.push(fluteChimeCue(nextChime.note));
    }
    const mirrorChanged = recordDiffers(prevPuzzle?.mirrors, nextPuzzle?.mirrors);
    const holdChanged = recordDiffers(prevPuzzle?.heldPlates, nextPuzzle?.heldPlates);
    if (mirrorChanged || holdChanged) {
      cues.push("choice-select");
    }
    const nextSolved = nextPuzzle?.lastSolved;
    const prevSolved = prevPuzzle?.lastSolved;
    if (
      nextSolved !== undefined &&
      (prevSolved?.id !== nextSolved.id || prevSolved.tick !== nextSolved.tick)
    ) {
      cues.push(cues.includes("sticker") ? "chime-yellow" : "sticker");
    }
  }
  return cues;
}

function fluteChimeCue(note: Direction): SoundCue {
  if (note === "up") return "flute-red";
  if (note === "right") return "flute-yellow";
  if (note === "down") return "flute-green";
  return "flute-blue";
}

function recordDiffers(
  before: Record<string, string> | undefined,
  after: Record<string, string> | undefined,
): boolean {
  if (before === after) return false;
  const a = before ?? {};
  const b = after ?? {};
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return true;
  return keysA.some((key) => a[key] !== b[key]);
}

function treatCount(treats: State["treats"]): number {
  if (treats === undefined) return 0;
  let total = 0;
  for (const count of Object.values(treats)) total += count;
  return total;
}

const echoChimes: readonly SoundCue[] = [
  "chime-red", "chime-yellow", "chime-green", "chime-blue",
];

// How many beats, toys, puffs, or peeks a check has cleared so far;
// other checks none.
function hits(check: CheckState | null): number {
  if (check?.kind === "peekaboo") return check.peeksCleared;
  return check?.kind === "chain" || check?.kind === "catch" ||
    check?.kind === "lean" || check?.kind === "trace"
    ? check.results.filter((result) => result === "hit").length
    : 0;
}
