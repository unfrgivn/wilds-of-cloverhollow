import "../ui/sticker.css";
import {
  createDialogueBox,
  createPrompt,
  type DialogueView,
  type PromptView,
} from "../ui/sticker";
import { mountTouchControls } from "../ui/touch-controls";
import type { AtlasImage } from "../ui/atlas";
import {
  createBattleHud,
  createCommandMenu,
  createRewardSticker,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  battleTalkDialogueView,
  talkChoicesShown,
  type BattleCheckView,
  type BattleCommand,
  type TimingGrade,
} from "../ui/battle";
import { createJournal, type JournalView } from "../ui/journal";
import { createArcade } from "../ui/arcade";
import { createTitleScreen, type TitleView } from "../ui/title";
import { createCredits } from "../ui/credits";
import {
  loadContent, parseClawCalibration, parseCookCalibration, parseMoleCalibration,
  parseCometCalibration,
  parseSkeeCalibration,
} from "../content/load";
import { createState, creditEntries, inkFacts, runInk } from "../core";
import { atlasImage, type AtlasJson } from "../ui/atlas";
import { clawGalleryView } from "./claw-gallery";
import type { BattleTalk } from "../core";
import { cookGalleryView } from "./cook-gallery";
import { moleGalleryView } from "./mole-gallery";
import { cometGalleryView } from "./comet-gallery";
import { skeeGalleryView } from "./skee-gallery";
import calibrationData from "../../public/assets/arcade/claw-machine.json";
import skeeCalibrationData from "../../public/assets/arcade/skee-lane.json";
import moleCalibrationData from "../../public/assets/arcade/mole-cabinet.json";
import cometCalibrationData from "../../public/assets/arcade/comet-cabinet.json";
import cookCalibrationData from "../../public/assets/arcade/microwave.json";
import foodAtlas from "../../public/assets/arcade/cook-food.json";
import moleAtlas from "../../public/assets/arcade/moles.json";
import cometAtlas from "../../public/assets/arcade/comet.json";
import prizeAtlas from "../../public/assets/prizes/prizes.json";
import toysJson from "../../public/assets/battle/toys/toys.json";

const root = document.querySelector<HTMLElement>("#gallery");
if (root === null) throw new Error("Missing gallery root");
document.body.className = "gallery-body";
document.body.style.backgroundColor = "#b8d5c0";
document.body.style.backgroundImage =
  "linear-gradient(#ffffff22, #ffffff22), url('assets/areas/plaza/ground_1_0.webp')";
document.body.style.backgroundSize = "cover";
const params = new URLSearchParams(window.location.search);
const insetValues = params.get("insets")?.split(",").map(Number);
if (insetValues?.length === 4 && insetValues.every(Number.isFinite)) {
  const [top, right, bottom, left] = insetValues;
  document.documentElement.style.setProperty("--safe-top", `${top}px`);
  document.documentElement.style.setProperty("--safe-right", `${right}px`);
  document.documentElement.style.setProperty("--safe-bottom", `${bottom}px`);
  document.documentElement.style.setProperty("--safe-left", `${left}px`);
}
if (params.get("touch") === "1") {
  mountTouchControls();
}
const stage = document.createElement("div");
stage.className = "gallery-stage";
root.append(stage);
const dialogue = createDialogueBox(stage);
const credits = createCredits(root);
const prompt = createPrompt(stage);
declare global {
  interface Window {
    __stickerGallery: {
      render: (view: DialogueView) => void;
      renderPrompt: (view: PromptView) => void;
      renderCheck: (view: BattleCheckView | null) => void;
      renderState: () => void;
    };
  }
}
const state = params.get("state") ?? "short";
const creditsState = state === "credits" || state === "credits-short";
// The claw machine's states come from real game states (src/dev/claw-gallery.ts).
const content = loadContent();
const creditsFixture = content.fixtures["new-game"];
if (creditsFixture === undefined) throw new Error("Missing new-game fixture");
const creditsBase = createState(content.world, creditsFixture);
const atlasFiles = {
  ...import.meta.glob<AtlasJson>("../../public/assets/characters/*/*.json",
    { eager: true, import: "default" }),
  ...import.meta.glob<AtlasJson>("../../public/assets/critters/*/*.json",
    { eager: true, import: "default" }),
};
const joinedInk = (ink: string, knot: string): string => {
  let result = runInk(content.world.story, ink, { type: "start", knot },
    inkFacts(content.world, { ...creditsBase, ink }));
  for (let index = 0; index < 20; index += 1) {
    if (result.choices.length > 0)
      return runInk(content.world.story, result.ink,
        { type: "choose", index: 0 },
        inkFacts(content.world, { ...creditsBase, ink: result.ink })).ink;
    if (result.ended) return result.ink;
    result = runInk(content.world.story, result.ink, { type: "next" },
      inkFacts(content.world, { ...creditsBase, ink: result.ink }));
  }
  throw new Error(`Could not complete gallery knot ${knot}`);
};
// The largest credits: every friend Fae can make (Sue and Jordan join, and both
// flute friends are befriended) and every sticker in the catalogue.
const joinedState = state === "credits"
  ? { ...creditsBase, ink: ["sue", "jordan", "pup_calm.befriend", "squirrel_calm.befriend"]
      .reduce(joinedInk, creditsBase.ink) }
  : creditsBase;
const creditsGameState = {
  ...joinedState,
  finale: "credits" as const,
  stickers: state === "credits-short"
    ? ["fountain-frog"]
    : content.world.stickers.catalogue.map((sticker) => sticker.id),
};
const creditsEntries = creditEntries(content.world, creditsGameState);
const creditImage = (image: { atlas: string; frame: string }) => {
  const key = Object.keys(atlasFiles).find((path) => path.endsWith(image.atlas));
  const sheet = key === undefined ? undefined : atlasFiles[key];
  if (sheet === undefined) throw new Error(`Missing gallery atlas ${image.atlas}`);
  return atlasImage(sheet, image.atlas.replace(".json", ".png"), image.frame);
};
const arcadeFixture = content.fixtures.arcade;
if (arcadeFixture === undefined) throw new Error("Missing the arcade fixture");
const clawView = clawGalleryView(content.world, arcadeFixture, state);
const skeeView = skeeGalleryView(content.world, arcadeFixture, state);
const moleView = moleGalleryView(content.world, arcadeFixture, state);
const cometView = cometGalleryView(content.world, arcadeFixture, state);
const cookView = cookGalleryView(content.world, arcadeFixture, state);
const gameView = clawView ?? skeeView ?? moleView ?? cometView ?? cookView;
const battleState = state.startsWith("battle-");
const journalState = state.startsWith("journal-");
const arcadeState = state.startsWith("arcade-") || state.startsWith("skee-") ||
  state.startsWith("mole-") || state.startsWith("comet-") || state.startsWith("cook-");
const titleState = state.startsWith("title-");
const dialogueShown = battleState
  ? state === "battle-command" || state === "battle-feelings" || state === "battle-windup" ||
    state === "battle-talk" || state === "battle-talk-reply" || state === "battle-level-up" ||
    state === "battle-reward"
  : state !== "prompt" && !journalState && !titleState && !creditsState &&
    (!arcadeState || state === "arcade-result" || state === "skee-result" ||
    state === "mole-result" || state === "comet-result" || state === "cook-result" ||
    state === "cook-burnt");
if (battleState) document.documentElement.dataset.battle = "open";
if (state === "battle-talk" || state === "battle-talk-reply")
  document.documentElement.dataset.talk = "open";
// A catch or a lean shows its touch arrows (spec 8.1).
if (state === "battle-catch") document.documentElement.dataset.check = "catch";
if (state === "battle-lean") document.documentElement.dataset.check = "lean";
if (state.startsWith("battle-trace")) document.documentElement.dataset.check = "trace";
if (dialogueShown) document.documentElement.dataset.dialogue = "open";
if (journalState) document.documentElement.dataset.journal = "open";
if (arcadeState) document.documentElement.dataset.arcade = "open";
if (gameView !== null) document.documentElement.dataset.arcadeGame = gameView.game;
if (titleState) document.documentElement.dataset.title = "open";
const defaultView: DialogueView = {
  speaker: "Maddie",
  text: "The fountain is singing today!",
  revealed: 32,
  choices: [],
  selected: -1,
  canAdvance: true,
};
const views: Record<string, DialogueView> = {
  short: defaultView,
  long: {
    speaker: "Fae",
    text:
      "The town feels different. Maybe we should ask around and " +
      "find out what happened before the sun goes down.",
    revealed: 109,
    choices: [],
    selected: -1,
    canAdvance: true,
  },
  "long-max": {
    speaker: "Fae",
    text: "Painted windows whisper clues about gentle magic in Cloverhollow today.",
    revealed: 71,
    choices: [],
    selected: -1,
    canAdvance: true,
  },
  revealing: {
    speaker: "Sue",
    text: "I saw a curious sparkle by the old notice board.",
    revealed: 18,
    choices: [],
    selected: -1,
    canAdvance: false,
  },
  "speaker-board": {
    speaker: "NOTICE BOARD",
    text: "A hand-painted note flutters in the breeze.",
    revealed: 100,
    choices: [],
    selected: -1,
    canAdvance: true,
  },
  "two-choices": {
    speaker: "Fae",
    text: "What should we do first?",
    revealed: 100,
    choices: [{ text: "Investigate the window" }, { text: "Go to school" }],
    selected: 0,
    canAdvance: false,
  },
  "three-choices": {
    speaker: "Maddie",
    text: "Which sticker should we take?",
    revealed: 100,
    choices: [
      { text: "A bright leaf" },
      { text: "A tiny moon" },
      { text: "A friendly star" },
    ],
    selected: 1,
    canAdvance: false,
  },
  "five-choices": {
    speaker: "Fae",
    text: "Which bar first?",
    revealed: 100,
    choices: [
      { text: "Red" },
      { text: "Yellow" },
      { text: "Green" },
      { text: "Blue" },
      { text: "Stop" },
    ],
    selected: 0,
    canAdvance: false,
  },
  "touch-overlap": {
    speaker: "Fae",
    text: "The controls stay clear while we talk.",
    revealed: 100,
    choices: [{ text: "Okay!" }],
    selected: 0,
    canAdvance: false,
  },
  prompt: {
    speaker: null,
    text: "",
    revealed: 0,
    choices: [],
    selected: -1,
    canAdvance: false,
  },
};
const battleHud = createBattleHud(stage);
const commands = createCommandMenu(stage);
const check = createBattleCheck(stage);
const feelingBubble = createFeelingBubble(stage);
const windUpBubbles = createWindUpBubbles(stage);
const reward = createRewardSticker(stage);
const journal = createJournal(stage);
// A prize's art: its frame in the prize atlas.
const prizeFrames = new Map(
  Object.entries(prizeAtlas.frames).map(([name, entry]) => [name, entry.frame]),
);
const galleryPrizeArt = (frame: string): AtlasImage | null => {
  const rect = prizeFrames.get(frame);
  return rect === undefined ? null : {
    src: "assets/prizes/prizes.png",
    frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    atlas: { w: prizeAtlas.meta.size.w, h: prizeAtlas.meta.size.h },
  };
};
// A mole's art: its frame in the moles' atlas.
const moleFrames = new Map(
  Object.entries(moleAtlas.frames).map(([name, entry]) => [name, entry.frame]),
);
const galleryMoleArt = (frame: string): AtlasImage | null => {
  const rect = moleFrames.get(frame);
  return rect === undefined ? null : {
    src: "assets/arcade/moles.png",
    frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    atlas: { w: moleAtlas.meta.size.w, h: moleAtlas.meta.size.h },
  };
};
const cometFrames = new Map(
  Object.entries(cometAtlas.frames).map(([name, entry]) => [name, entry.frame]),
);
const galleryCometArt = (frame: string): AtlasImage | null => {
  const rect = cometFrames.get(frame);
  return rect === undefined ? null : {
    src: "assets/arcade/comet.png", frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    atlas: { w: cometAtlas.meta.size.w, h: cometAtlas.meta.size.h },
  };
};
const arcade = createArcade(stage, galleryPrizeArt, {
  calibration: parseClawCalibration(calibrationData, "public/assets/arcade/claw-machine.json"),
  image: "assets/arcade/claw-machine.webp",
}, {
  calibration: parseSkeeCalibration(skeeCalibrationData, "public/assets/arcade/skee-lane.json"),
  image: "assets/arcade/skee-lane.webp",
}, {
  calibration: parseMoleCalibration(moleCalibrationData, "public/assets/arcade/mole-cabinet.json"),
  image: "assets/arcade/mole-cabinet.webp",
  art: galleryMoleArt,
  // The gallery's states are fixed: a tap on a hole has nothing to play.
  onHole: () => undefined,
}, {
  calibration: parseCometCalibration(cometCalibrationData,
    "public/assets/arcade/comet-cabinet.json"),
  image: "assets/arcade/comet-cabinet.webp",
  art: galleryCometArt,
}, {
  calibration: parseCookCalibration(cookCalibrationData, "public/assets/arcade/microwave.json"),
  image: "assets/arcade/microwave.webp",
  art: (frame) => {
    const rect = Object.entries(foodAtlas.frames).find(([name]) => name === frame)?.[1].frame;
    return rect === undefined ? null : {
      src: "assets/arcade/cook-food.png",
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      atlas: { w: foodAtlas.meta.size.w, h: foodAtlas.meta.size.h },
    };
  },
});
const title = createTitleScreen(stage);
title.onChoose((id) => {
  root.dataset.titleChosen = id;
});
journal.onClose(() => {
  root.dataset.journalClosed = "true";
});
journal.onSetAudioLevel(() => undefined);
commands.onChoose((index) => {
  root.dataset.battleChosen = String(index);
});
dialogue.onChoose((index) => {
  root.dataset.chosen = String(index);
});
const battleMessage: DialogueView = {
  speaker: null,
  text: state === "battle-reward" ? "+8 coins, +40 XP!" :
    state === "battle-level-up" ? "Fae reached level 5! Power +2, Magic +1, Life +1." :
      "What should Fae do?",
  revealed: 100,
  choices: [],
  selected: -1,
  canAdvance: false,
};
const windUpMessage: DialogueView = {
  ...battleMessage,
  text: "The gull puffs up bigger and bigger! It's feeling everything at once!",
};
// Talk's two moments, as the core holds them (the lines are kid_talk_2's),
// projected through the game's own view.
const talkQuestion: BattleTalk = {
  knot: "kid_talk_2",
  turn: 1,
  speaker: "Hooded Kid",
  text: "Nobody ever notices me anyway...",
  revealed: 100,
  choices: [
    "I notice you! The paper planes, the star doodles...",
    "Everybody noticed the scribbles.",
    "Maybe nobody likes purple?",
  ],
  selected: 1,
  ended: false,
  grade: null,
};
const talkReply: BattleTalk = {
  knot: "kid_talk_2",
  turn: 1,
  speaker: "Hooded Kid",
  text: "You... you saw those?",
  revealed: 9,
  choices: [],
  selected: 0,
  ended: false,
  grade: "great",
};
const galleryTalk = state === "battle-talk" ? talkQuestion
  : state === "battle-talk-reply" ? talkReply : null;
const frogRing = { x: 600, y: 170, radius: 74, progress: 0.62, target: 0.65 };
const faeRing = { x: 190, y: 300, radius: 66, progress: 0.38, target: 0.5 };
function renderGalleryState(): void {
  const titleView: TitleView = {
    visible: titleState,
    mode:
      state === "title-confirm"
        ? "confirm"
        : state === "title-fresh"
          ? "fresh"
          : "continue",
    selected:
      state === "title-confirm"
        ? "confirm-no"
        : state === "title-fresh"
          ? "new-game"
          : "continue",
    continueDetail: "Town plaza · 1 sticker",
  };
  title.render(titleView);
  const notes =
    state === "journal-empty"
      ? []
      : state === "journal-notes"
        ? [
            "The fountain hummed at sunset.",
            "Ask Maddie about the sparkle.",
            "The notice board has a new note.",
            "Follow the painted path north.",
            "Keep Oliver's birthday sticker safe.",
          ]
        : Array.from(
            { length: 14 },
            (_, index) => `A fresh clue, number ${index + 1}.`,
          );
  const stickerIds = [
    "frog",
    "star",
    "leaf",
    "moon",
    "gem",
    "shell",
    "rainbow",
    "acorn",
    "kite",
    "bell",
    "cloud",
  ];
  const stickers = stickerIds.map((id) => ({
    id,
    name: id === "frog" ? "Fountain Frog" : id,
    owned: id === "frog" && state !== "journal-empty",
    image:
      id === "frog"
        ? {
            src: "assets/critters/frog/frog.png",
            frame: { x: 0, y: 512, w: 512, h: 512 },
            atlas: { w: 1536, h: 1024 },
          }
        : null,
  }));
  const journalView: JournalView = {
    visible: journalState,
    notes,
    stickers,
    lands: [
      {
        id: "cloverhollow",
        name: "Cloverhollow",
        busStop: true,
        x: 1224,
        y: 1327,
      },
      { id: "bay", name: "Bubblegum Bay", busStop: true, x: 1992, y: 828 },
      { id: "pass", name: "Pinecone Pass", busStop: true, x: 1110, y: 204 },
      { id: "trail", name: "Cliffside Trail", busStop: false, x: 1812, y: 420 },
      { id: "forest", name: "The Forest", busStop: false, x: 240, y: 420 },
      {
        id: "enchanted",
        // The view carries each land's display name (`mapLandName`): the
        // gallery's journal shows the forest still sealed.
        name: "???",
        busStop: false,
        x: 1156,
        y: 720,
      },
    ],
    currentLand: "cloverhollow",
    coins: 8,
    tickets: state === "journal-empty" ? 0 : 23,
    snacks: 2,
    muted: false,
    level: 1,
    members: [
      { id: "fae", name: "Fae", level: 5, xp: 360, startXp: 340, nextXp: 464,
        stats: { power: 28, magic: 2, life: 6, guard: 0 }, friend: false },
      { id: "maddie", name: "Maddie", level: 5, xp: 360, startXp: 340, nextXp: 464,
        stats: { power: 33, magic: 2, life: 6, guard: 0 }, friend: true },
    ],
    // Every prize in the catalogue; outside the empty journal, the frog and
    // the pup are won.
    prizes: content.world.arcade.prizes.map((prize) => {
      const owned = state !== "journal-empty" &&
        (prize.id === "frog-plush" || prize.id === "pup-plush");
      return { id: prize.id, name: prize.name, owned,
        image: owned ? galleryPrizeArt(prize.frame) : null };
    }),
  };
  journal.render(journalView);
  // The battle is over once the reward shows, so the HUD steps aside; it does
  // too while a Talk question's answers are on screen.
  battleHud.render({
    visible: battleState && state !== "battle-reward" && !talkChoicesShown(galleryTalk),
    energy: 3,
    energyMax: state === "battle-windup" ? 12 : 5,
    level: state === "battle-windup" ? 6 : 1,
    calm: 0.45,
    critterName: state === "battle-windup" ? "Grumpy Gull" : "Fizzy Frog",
  });
  // `?party=N` previews a bigger party's menu: N friend commands between
  // Soothe and Snack (two columns on phones, one from 1000 px).
  const friends = Math.max(1, Number(params.get("party") ?? "1"));
  const commandList: BattleCommand[] = [
    { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
    { id: "play", label: "Play", detail: "resting", disabled: true, feeling: null },
    ...Array.from({ length: friends - 1 }, (_, index) => ({
      id: `friend-${index}`,
      label: ["Whistle", "Dig", "Dance"][index % 3] ?? "Help",
      detail: null,
      disabled: false,
      feeling: null,
    })),
    { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: null },
    { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
  ];
  // A zoomy critter: Play wears its badge, Sue rests; the lantern has peeked.
  const feelingCommands: BattleCommand[] = [
    { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: null },
    { id: "play", label: "Play", detail: null, disabled: false, feeling: "zoomy" },
    { id: "cast", label: "Cast", detail: "reeling in", disabled: true, feeling: null },
    { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: null },
    { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
  ];
  // A gull winding up, grumpy and hungry at once: Soothe and Snack wear the
  // bubbles' badges.
  const windUpCommands: BattleCommand[] = [
    { id: "soothe", label: "Soothe", detail: null, disabled: false, feeling: "grumpy" },
    { id: "play", label: "Play", detail: null, disabled: false, feeling: null },
    { id: "cast", label: "Cast", detail: "reeling in", disabled: true, feeling: null },
    { id: "snack", label: "Snack", detail: "×2", disabled: false, feeling: "hungry" },
    { id: "run", label: "Run", detail: null, disabled: false, feeling: null },
  ];
  const feelings = state === "battle-feelings";
  const windUp = state === "battle-windup";
  commands.render({
    visible: state === "battle-command" || feelings || windUp,
    selected: feelings ? 1 : windUp ? 0 : 2,
    commands: feelings ? feelingCommands : windUp ? windUpCommands : commandList,
  });
  // Between the party (left) and the frog (centre), as the game places it.
  const cloudAt = { x: Math.round(innerWidth * 0.36), y: 96 };
  feelingBubble.render(feelings
    ? { now: { id: "zoomy", label: "Zoomy" }, next: "curious", later: "hungry", answered: false,
      ...cloudAt }
    : state === "battle-feelings-heart"
      ? { now: { id: "zoomy", label: "Zoomy" }, next: "curious", later: null, answered: true,
        ...cloudAt }
      : null);
  windUpBubbles.render(windUp
    ? { bubbles: [{ id: "grumpy", label: "Grumpy", popped: false },
      { id: "hungry", label: "Hungry", popped: false }], ...cloudAt }
    : null);
  // Rings go through the game's own check overlay, like every other check.
  const ringCheck = (ring: typeof frogRing, grade: TimingGrade | null): BattleCheckView => ({
    kind: "ring",
    ...ring,
    grade,
    hint: null,
    hintAt: { x: ring.x, y: ring.y + ring.radius + 16 },
  });
  // The pup's two tennis balls in the toy atlas (assets/battle/toys).
  const tennisBall = (index: 0 | 1): AtlasImage => atlasImage(
    toysJson,
    "assets/battle/toys/toys.png",
    index === 0 ? "tennis-ball-01" : "tennis-ball-02",
  );
  const galleryChecks: Record<string, BattleCheckView> = {
    "battle-timing": ringCheck(frogRing, null),
    "battle-grade": ringCheck(frogRing, "great"),
    "battle-burst": ringCheck(faeRing, null),
    "battle-charge": {
      kind: "charge",
      x: 320,
      y: 130,
      width: 34,
      height: 180,
      fill: 0.55,
      good: [0.42, 0.68],
      great: [0.52, 0.6],
      grade: null,
      hint: "Hold, then let go in the green!",
      hintAt: { x: 337, y: 335 },
    },
    "battle-chain": {
      kind: "chain",
      from: { x: 190, y: 90 },
      to: { x: 190, y: 230 },
      radius: 34,
      look: "pinecone",
      beats: [
        { appeared: true, progress: 0.22, result: "pending" },
        { appeared: true, progress: 1, result: "hit" },
      ],
      grade: null,
      hint: "Press as each one lands!",
      hintAt: { x: 190, y: 282 },
    },
    "battle-chain-burst": {
      kind: "chain",
      from: { x: 600, y: 170 },
      to: { x: 190, y: 230 },
      radius: 50,
      look: "bubble",
      beats: [
        { appeared: true, progress: 0.42, result: "pending" },
        { appeared: true, progress: 0.7, result: "pending" },
      ],
      grade: null,
      hint: "Press as each one lands!",
      hintAt: { x: 190, y: 300 },
    },
    "battle-catch": {
      kind: "catch",
      lanes: [150, 200, 250],
      fromX: 560,
      catcherX: 250,
      radius: 22,
      catcher: 1,
      toys: [
        { appeared: true, progress: 0.82, lane: 1, result: "pending", image: tennisBall(0),
          width: 31, height: 33 },
        { appeared: true, progress: 0.4, lane: 0, result: "pending", image: tennisBall(1),
          width: 32, height: 32 },
      ],
      grade: null,
      hint: "Hold up or down to catch each one!",
      hintAt: { x: 405, y: 280 },
    },
    // The phone's real lean (Fae at x 190, feet at 229, 78 px tall): the
    // first puff held, the second, a strong one, pushing her back.
    "battle-lean": {
      kind: "lean",
      track: { x: 190, y: 116, width: 125, height: 12 },
      balance: -0.32,
      wind: { x: 268, rows: [147, 167, 186, 206], length: 56 },
      puffs: [
        { blowing: false, progress: 1, force: 0.4, result: "hit" },
        { blowing: true, progress: 0.45, force: 0.6, result: "pending" },
      ],
      grade: null,
      hint: null,
      hintAt: { x: 315, y: 243 },
    },
    "battle-trace": {
      kind: "trace",
      rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 180, y: 180 },
      points: [{ x: 120, y: 160 }, { x: 330, y: 180 }, { x: 520, y: 370 },
        { x: 730, y: 250 }, { x: 870, y: 700 }],
      checkpoint: 0, dry: .18,
      results: ["pending", "pending", "pending", "pending", "pending"],
      grade: null, hint: "Trace the purple scribble before the paint dries!",
      hintAt: { x: 480, y: 410 },
    },
    "battle-trace-mid": {
      kind: "trace",
      rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 520, y: 370 },
      points: [{ x: 120, y: 160 }, { x: 330, y: 180 }, { x: 520, y: 370 },
        { x: 730, y: 250 }, { x: 870, y: 700 }],
      checkpoint: 3, dry: .52,
      results: ["hit", "hit", "hit", "pending", "pending"],
      grade: null, hint: null, hintAt: { x: 480, y: 410 },
    },
    "battle-trace-dry": {
      kind: "trace",
      rect: { x: 330, y: 96, width: 300, height: 300 },
      brush: { x: 730, y: 250 },
      points: [{ x: 120, y: 160 }, { x: 330, y: 180 }, { x: 520, y: 370 },
        { x: 730, y: 250 }, { x: 870, y: 700 }],
      checkpoint: 4, dry: 1,
      results: ["hit", "hit", "hit", "hit", "miss"],
      grade: "good", hint: null, hintAt: { x: 480, y: 410 },
    },
  };
  check.render(galleryChecks[state] ?? null);
  const prize = clawView?.prize ?? null;
  reward.render(prize !== null ? {
    visible: true, title: prize.title, name: prize.name, image: galleryPrizeArt(prize.frame),
  } : {
    visible: state === "battle-reward",
    title: "NEW STICKER!",
    name: "Fountain Frog",
    image: {
      src: "assets/critters/frog/frog.png",
      frame: { x: 0, y: 512, w: 512, h: 512 },
      atlas: { w: 1536, h: 1024 },
    },
  });
  credits.render({
    visible: creditsState,
    entries: creditsEntries.map((entry) => ({ ...entry, image: creditImage(entry.image) })),
  });
  if (creditsState) document.documentElement.dataset.credits = "open";
  else delete document.documentElement.dataset.credits;
  arcade.render(gameView);
  prompt.render({
    label: "TALK",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    visible: state === "prompt",
  });
  if (!dialogueShown) dialogue.hide();
  else if (battleState) dialogue.render(
    state === "battle-windup" ? windUpMessage :
      galleryTalk !== null ? battleTalkDialogueView(galleryTalk) : battleMessage,
  );
  else if (gameView !== null)
    dialogue.render({
      speaker: null,
      text: gameView.message,
      revealed: gameView.revealed,
      choices: [],
      selected: -1,
      canAdvance: true,
    });
  else dialogue.render(views[state] ?? defaultView);
}
window.__stickerGallery = {
  render: (view) => dialogue.render(view),
  renderPrompt: (view) => prompt.render(view),
  renderCheck: (view) => check.render(view),
  renderState: renderGalleryState,
};
renderGalleryState();
window.addEventListener("resize", renderGalleryState);
// The arcade's paintings and atlases are CSS backgrounds, which neither the
// fonts nor a frame wait for: decode the ones this state shows (the first
// seven, all at once, took Chromium about 0.1 s a page, in every state), then
// mark the page ready for its screenshots.
const arcadeArt = ["assets/arcade/claw-machine.webp", "assets/arcade/skee-lane.webp",
  "assets/arcade/mole-cabinet.webp", "assets/arcade/moles.png", "assets/prizes/prizes.png",
  "assets/arcade/microwave.webp", "assets/arcade/cook-food.png",
  "assets/arcade/comet-cabinet.webp", "assets/arcade/comet.png"];
const backgrounds = [...document.body.querySelectorAll<HTMLElement>("*")]
  .filter((element) => element.checkVisibility())
  .map((element) => getComputedStyle(element).backgroundImage);
const decoded = (src: string): Promise<void> => {
  const image = new Image();
  image.src = src;
  return image.decode();
};
void Promise.all([document.fonts.ready, ...arcadeArt
  .filter((src) => backgrounds.some((image) => image.includes(src))).map(decoded)])
  .then(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      }),
  )
  .then(() => {
    renderGalleryState();
    root.dataset.ready = "true";
  });
