import {
  creditEntries, critterFieldNote, inkFacts, runInk,
  type BattleTalk, type CreditEntry, type State, type World,
} from "../core";
import type { AtlasImage } from "../ui/atlas";
import {
  battleTalkDialogueView, talkChoicesShown, type BattleCheckView, type BattleCommand,
  type BattleHudView, type CommandMenuView, type FeelingBubbleView, type TimingGrade,
  type WindUpView,
} from "../ui/battle";
import type { JournalView } from "../ui/journal";
import type { DialogueView } from "../ui/sticker";
import type { TitleView } from "../ui/title";

export const GALLERY_DEFAULT_DIALOGUE: DialogueView = {
  speaker: "Maddie", text: "The fountain is singing today!", revealed: 32,
  choices: [], selected: -1, canAdvance: true,
};

export const GALLERY_DIALOGUE_VIEWS: Readonly<Record<string, DialogueView>> = {
  short: GALLERY_DEFAULT_DIALOGUE,
  long: {
    speaker: "Fae",
    text:
      "The town feels different. Maybe we should ask around and " +
      "find out what happened before the sun goes down.",
    revealed: 109, choices: [], selected: -1, canAdvance: true,
  },
  "long-max": {
    speaker: "Fae",
    text: "Painted windows whisper clues about gentle magic in Cloverhollow today.",
    revealed: 71, choices: [], selected: -1, canAdvance: true,
  },
  revealing: {
    speaker: "Sue", text: "I saw a curious sparkle by the old notice board.",
    revealed: 18, choices: [], selected: -1, canAdvance: false,
  },
  "speaker-board": {
    speaker: "NOTICE BOARD", text: "A hand-painted note flutters in the breeze.",
    revealed: 100, choices: [], selected: -1, canAdvance: true,
  },
  "two-choices": {
    speaker: "Fae", text: "What should we do first?", revealed: 100,
    choices: [{ text: "Investigate the window" }, { text: "Go to school" }],
    selected: 0, canAdvance: false,
  },
  "three-choices": {
    speaker: "Maddie", text: "Which sticker should we take?", revealed: 100,
    choices: [{ text: "A bright leaf" }, { text: "A tiny moon" }, { text: "A friendly star" }],
    selected: 1, canAdvance: false,
  },
  "five-choices": {
    speaker: "Fae", text: "Which bar first?", revealed: 100,
    choices: [
      { text: "Red" }, { text: "Yellow" }, { text: "Green" }, { text: "Blue" }, { text: "Stop" },
    ],
    selected: 0, canAdvance: false,
  },
  "touch-overlap": {
    speaker: "Fae", text: "The controls stay clear while we talk.", revealed: 100,
    choices: [{ text: "Okay!" }], selected: 0, canAdvance: false,
  },
  prompt: { speaker: null, text: "", revealed: 0, choices: [], selected: -1, canAdvance: false },
};

const TALK_QUESTION: BattleTalk = {
  knot: "kid_talk_2", turn: 1, speaker: "Hooded Kid", text: "Nobody ever notices me anyway...",
  revealed: 100, selected: 1, ended: false, grade: null,
  choices: [
    "I notice you! The paper planes, the star doodles...",
    "Everybody noticed the scribbles.",
    "Maybe nobody likes purple?",
  ],
};

const TALK_REPLY: BattleTalk = {
  knot: "kid_talk_2", turn: 1, speaker: "Hooded Kid", text: "You... you saw those?",
  revealed: 9, choices: [], selected: 0, ended: false, grade: "great",
};

const FROG_RING = { x: 600, y: 170, radius: 74, progress: 0.62, target: 0.65 };
const FAE_RING = { x: 190, y: 300, radius: 66, progress: 0.38, target: 0.5 };
const STICKER_IDS: readonly string[] = [
  "frog", "star", "leaf", "moon", "gem", "shell", "rainbow", "acorn", "kite", "bell", "cloud",
];

const FEELING_COMMANDS: readonly BattleCommand[] = [
  { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
  { id: "play", label: "Play", detail: null, disabled: false, feeling: "zoomy" },
  { id: "cast", label: "Cast", detail: "reeling in", disabled: true, feeling: null },
  { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: null },
  { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
];

const WIND_UP_COMMANDS: readonly BattleCommand[] = [
  { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: "grumpy" },
  { id: "play", label: "Play", detail: null, disabled: false, feeling: null },
  { id: "cast", label: "Cast", detail: "reeling in", disabled: true, feeling: null },
  { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: "hungry" },
  { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
];

const TRACE_POINTS = [
  { x: 120, y: 160 }, { x: 330, y: 180 }, { x: 520, y: 370 },
  { x: 730, y: 250 }, { x: 870, y: 700 },
];

export function buildGalleryCreditsEntries(
  state: string, world: World, creditsBase: State,
): CreditEntry[] {
  const joinedInk = (ink: string, knot: string): string => {
    let result = runInk(
      world.story, ink, { type: "start", knot }, inkFacts(world, { ...creditsBase, ink }),
    );
    for (let index = 0; index < 20; index += 1) {
      if (result.choices.length > 0) {
        return runInk(
          world.story, result.ink, { type: "choose", index: 0 },
          inkFacts(world, { ...creditsBase, ink: result.ink }),
        ).ink;
      }
      if (result.ended) return result.ink;
      result = runInk(
        world.story, result.ink, { type: "next" },
        inkFacts(world, { ...creditsBase, ink: result.ink }),
      );
    }
    throw new Error(`Could not complete gallery knot ${knot}`);
  };
  const joinedState: State = state === "credits"
    ? {
        ...creditsBase,
        ink: ["sue", "jordan", "pup_calm.befriend", "squirrel_calm.befriend", "bunny_calm.befriend"]
          .reduce(joinedInk, creditsBase.ink),
      }
    : creditsBase;
  const creditsGameState: State = {
    ...joinedState,
    finale: "credits",
    stickers: state === "credits-short"
      ? ["fountain-frog"]
      : world.stickers.catalogue.map((sticker) => sticker.id),
  };
  return creditEntries(world, creditsGameState);
}

export function buildGalleryTitleView(state: string, titleState: boolean): TitleView {
  return {
    visible: titleState,
    mode: state === "title-confirm" ? "confirm" : state === "title-fresh" ? "fresh" : "continue",
    selected: state === "title-confirm"
      ? "confirm-no"
      : state === "title-fresh" ? "new-game" : "continue",
    continueDetail: "Town plaza · 1 sticker",
  };
}

export function buildGalleryJournalView(options: {
  state: string;
  journalState: boolean;
  world: World;
  creditsBase: State;
  frogAtlasSrc: string;
  galleryPrizeArt: (frame: string) => AtlasImage | null;
}): JournalView {
  const { state, journalState, world, creditsBase, frogAtlasSrc, galleryPrizeArt } = options;
  const notes = state === "journal-empty"
    ? []
    : state === "journal-notes"
      ? [
          "The fountain hummed at sunset.",
          "Ask Maddie about the sparkle.",
          "The notice board has a new note.",
          "Follow the painted path north.",
          "Keep Oliver's birthday sticker safe.",
        ]
      : Array.from({ length: 14 }, (_, index) => `A fresh clue, number ${index + 1}.`);
  const frogFieldNote = critterFieldNote(
    world,
    { ...creditsBase, stickers: ["fountain-frog"], calms: { frog: 1 } },
    "fountain-frog",
  );
  const stickers = STICKER_IDS.map((id) => ({
    id,
    name: id === "frog" ? "Fountain Frog" : id,
    owned: id === "frog" && state !== "journal-empty",
    image: id === "frog"
      ? { src: frogAtlasSrc, frame: { x: 0, y: 512, w: 512, h: 512 }, atlas: { w: 1536, h: 1024 } }
      : null,
    fieldNote: id === "frog" && state !== "journal-empty" ? frogFieldNote : null,
  }));
  return {
    visible: journalState, notes, stickers,
    lands: [
      { id: "cloverhollow", name: "Cloverhollow", busStop: true, x: 1224, y: 1327 },
      { id: "bay", name: "Bubblegum Bay", busStop: true, x: 1992, y: 828 },
      { id: "pass", name: "Pinecone Pass", busStop: true, x: 1110, y: 204 },
      { id: "trail", name: "Cliffside Trail", busStop: false, x: 1812, y: 420 },
      { id: "forest", name: "The Forest", busStop: false, x: 240, y: 420 },
      { id: "enchanted", name: "???", busStop: false, x: 1156, y: 720 },
    ],
    currentLand: "cloverhollow",
    landProgress: {
      cloverhollow: { owned: 1, total: 9 }, bay: { owned: 0, total: 4 },
      pass: { owned: 0, total: 3 }, trail: { owned: 0, total: 3 },
      forest: { owned: 0, total: 2 }, enchanted: { owned: 0, total: 1 },
    },
    busRoutes: [
      { from: "cloverhollow", to: "bay", open: true },
      { from: "cloverhollow", to: "pass", open: false },
      { from: "bay", to: "pass", open: false },
    ],
    stickersOwned: state === "journal-empty" ? 0 : 1,
    stickersTotal: world.stickers.catalogue.length,
    prizesOwned: state === "journal-empty" ? 0 : 2,
    prizesTotal: world.arcade.prizes.length,
    coins: 8, tickets: state === "journal-empty" ? 0 : 23, snacks: 2,
    muted: false, level: 1, musicMuted: false, musicLevel: 0.75, ambienceMuted: false,
    nowPlaying: "Cloverhollow Town", gentleTiming: false, keyHints: false,
    textSpeed: "cozy", reducedMotion: false, hasLantern: true, hasFlute: true,
    members: [
      {
        id: "fae", name: "Fae", level: 5, xp: 360, startXp: 340, nextXp: 464,
        stats: { power: 28, magic: 2, life: 6, guard: 0 }, friend: false,
      },
      {
        id: "maddie", name: "Maddie", level: 5, xp: 360, startXp: 340, nextXp: 464,
        stats: { power: 33, magic: 2, life: 6, guard: 0 }, friend: true,
      },
    ],
    prizes: world.arcade.prizes.map((prize) => {
      const owned = state !== "journal-empty" &&
        (prize.id === "frog-plush" || prize.id === "pup-plush");
      return { id: prize.id, name: prize.name, owned,
        image: owned ? galleryPrizeArt(prize.frame) : null };
    }),
  };
}

export function galleryBattleTalk(state: string): BattleTalk | null {
  return state === "battle-talk" ? TALK_QUESTION
    : state === "battle-talk-reply" ? TALK_REPLY : null;
}

export function galleryBattleDialogue(state: string, talk: BattleTalk | null): DialogueView {
  if (state === "battle-windup") {
    return {
      speaker: null,
      text: "The gull puffs up bigger and bigger! It's feeling everything at once!",
      revealed: 100, choices: [], selected: -1, canAdvance: false,
    };
  }
  if (talk !== null) return battleTalkDialogueView(talk);
  return {
    speaker: null,
    text: state === "battle-reward" ? "+8 coins, +40 XP!"
      : state === "battle-level-up" ? "Fae reached level 5! Power +2, Magic +1, Life +1."
        : "What should Fae do?",
    revealed: 100, choices: [], selected: -1, canAdvance: false,
  };
}

export function buildGalleryBattleHudView(
  state: string, battleState: boolean, talk: BattleTalk | null,
): BattleHudView {
  return {
    visible: battleState && state !== "battle-reward" && !talkChoicesShown(talk),
    energy: 3, energyMax: state === "battle-windup" ? 12 : 5,
    level: state === "battle-windup" ? 6 : 1, calm: 0.45,
    critterName: state === "battle-windup" ? "Grumpy Gull"
      : state === "battle-echo" ? "Bouncy Lamb" : "Fizzy Frog",
    sparkle: state === "battle-together" ? { count: 3, max: 3, ready: true } : null,
    fluteAssist: state === "battle-together"
      ? { available: true, label: "Flute Friends", kind: "both" } : null,
    burstSoften: 0,
    lassoAssist: state === "battle-together" ? { available: true, windUp: false } : null,
    lassoSteady: false,
  };
}

export function buildGalleryCommandMenuView(state: string, friends: number): CommandMenuView {
  const commandList: BattleCommand[] = [
    { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
    { id: "play", label: "Play", detail: "resting", disabled: true, feeling: null },
    ...Array.from({ length: friends - 1 }, (_, index) => ({
      id: `friend-${index}`, label: ["Whistle", "Dig", "Dance"][index % 3] ?? "Help",
      detail: null, disabled: false, feeling: null,
    })),
    { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: null },
    { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
  ];
  const feelings = state === "battle-feelings";
  const together = state === "battle-together";
  const windUp = state === "battle-windup";
  return {
    visible: state === "battle-command" || feelings || together || windUp,
    selected: feelings || together ? 1 : windUp ? 0 : 2,
    commands: feelings || together
      ? [...FEELING_COMMANDS]
      : windUp ? [...WIND_UP_COMMANDS] : commandList,
  };
}

export function buildGalleryFeelingBubble(
  state: string, cloudAt: { x: number; y: number },
): FeelingBubbleView | null {
  if (state === "battle-feelings" || state === "battle-together") {
    return {
      now: { id: "zoomy", label: "Zoomy" }, next: "curious", later: "hungry",
      answered: false, ...cloudAt,
    };
  }
  if (state === "battle-feelings-heart") {
    return {
      now: { id: "zoomy", label: "Zoomy" }, next: "curious", later: null,
      answered: true, ...cloudAt,
    };
  }
  return null;
}

export function buildGalleryWindUpBubbles(
  state: string, cloudAt: { x: number; y: number },
): WindUpView | null {
  if (state !== "battle-windup") return null;
  return {
    bubbles: [
      { id: "grumpy", label: "Grumpy", popped: false },
      { id: "hungry", label: "Hungry", popped: false },
    ],
    ...cloudAt,
  };
}

function ringCheck(ring: typeof FROG_RING, grade: TimingGrade | null): BattleCheckView {
  return {
    kind: "ring", ...ring, grade, hint: null,
    hintAt: { x: ring.x, y: ring.y + ring.radius + 16 },
  };
}

export function buildGalleryBattleCheck(
  state: string,
  viewport: { width: number; height: number },
  tennisBall: (index: 0 | 1) => AtlasImage,
): BattleCheckView | null {
  const { width, height } = viewport;
  const checks: Record<string, BattleCheckView> = {
    "battle-timing": ringCheck(FROG_RING, null),
    "battle-grade": ringCheck(FROG_RING, "great"),
    "battle-burst": ringCheck(FAE_RING, null),
    "battle-charge": {
      kind: "charge", x: 320, y: 130, width: 34, height: 180, fill: 0.55,
      good: [0.42, 0.68], great: [0.52, 0.6], grade: null,
      hint: "Hold, then let go in the green!", hintAt: { x: 337, y: 335 },
    },
    "battle-chain": {
      kind: "chain", from: { x: 190, y: 90 }, to: { x: 190, y: 230 }, radius: 34, look: "pinecone",
      beats: [
        { appeared: true, progress: 0.22, result: "pending" },
        { appeared: true, progress: 1, result: "hit" },
      ],
      grade: null, hint: "Press as each one lands!", hintAt: { x: 190, y: 282 },
    },
    "battle-chain-burst": {
      kind: "chain", from: { x: 600, y: 170 }, to: { x: 190, y: 230 }, radius: 50, look: "bubble",
      beats: [
        { appeared: true, progress: 0.42, result: "pending" },
        { appeared: true, progress: 0.7, result: "pending" },
      ],
      grade: null, hint: "Press as each one lands!", hintAt: { x: 190, y: 300 },
    },
    "battle-catch": {
      kind: "catch", lanes: [150, 200, 250], fromX: 560, catcherX: 250, radius: 22, catcher: 1,
      toys: [
        { appeared: true, progress: 0.82, lane: 1, result: "pending", image: tennisBall(0),
          width: 31, height: 33 },
        { appeared: true, progress: 0.4, lane: 0, result: "pending", image: tennisBall(1),
          width: 32, height: 32 },
      ],
      grade: null, hint: "Hold up or down to catch each one!", hintAt: { x: 405, y: 280 },
    },
    "battle-lean": {
      kind: "lean", track: { x: 190, y: 116, width: 125, height: 12 }, balance: -0.32,
      wind: { x: 268, rows: [147, 167, 186, 206], length: 56 },
      puffs: [
        { blowing: false, progress: 1, force: 0.4, result: "hit" },
        { blowing: true, progress: 0.45, force: 0.6, result: "pending" },
      ],
      grade: null, hint: null, hintAt: { x: 315, y: 243 },
    },
    "battle-peekaboo": {
      kind: "peekaboo", track: { x: 192, y: 131, width: 136, height: 14 }, progress: 0.58,
      status: "watching", peeks: ["cleared", "pending"],
      grade: null, hint: null, hintAt: { x: 315, y: 243 },
    },
    "battle-trace": {
      kind: "trace", rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 180, y: 180 }, points: TRACE_POINTS, checkpoint: 0, dry: 0.18,
      results: ["pending", "pending", "pending", "pending", "pending"],
      grade: null, hint: "Trace the purple scribble before the paint dries!",
      hintAt: { x: 480, y: 410 },
    },
    "battle-trace-mid": {
      kind: "trace", rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 520, y: 370 }, points: TRACE_POINTS, checkpoint: 3, dry: 0.52,
      results: ["hit", "hit", "hit", "pending", "pending"],
      grade: null, hint: null, hintAt: { x: 480, y: 410 },
    },
    "battle-trace-dry": {
      kind: "trace", rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 730, y: 250 }, points: TRACE_POINTS, checkpoint: 4, dry: 1,
      results: ["hit", "hit", "hit", "hit", "miss"],
      grade: "good", hint: null, hintAt: { x: 480, y: 410 },
    },
    "battle-echo": {
      kind: "echo",
      x: Math.min(width - (width >= 1000 ? 164 : 206), Math.round(width * 0.77)),
      y: Math.max(166, Math.round(height * 0.34)),
      phase: "input", sequence: [0, 1, 2, 3], results: ["hit", "pending", "pending", "pending"],
      litNote: 1, demoIndex: -1, entered: 1, time: 0.68, grade: null,
      hint: "Listen, then echo the chimes!",
      hintAt: {
        x: Math.min(width - 130, Math.max(130, Math.round(width * 0.36))),
        y: Math.min(height - 46, Math.max(268, Math.round(height * 0.57 + 0.18 * height * 0.194))),
      },
    },
  };
  return checks[state] ?? null;
}
