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
  type BattleCheckView,
  type BattleCommand,
  type TimingGrade,
} from "../ui/battle";
import { createJournal, type JournalView } from "../ui/journal";
import { createArcade } from "../ui/arcade";
import { createTitleScreen, type TitleView } from "../ui/title";
import { loadContent, parseClawCalibration } from "../content/load";
import { clawGalleryView } from "./claw-gallery";
import calibrationData from "../../public/assets/arcade/claw-machine.json";
import prizeAtlas from "../../public/assets/prizes/prizes.json";

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
// The claw machine's states come from real game states (src/dev/claw-gallery.ts).
const content = loadContent();
const arcadeFixture = content.fixtures.arcade;
if (arcadeFixture === undefined) throw new Error("Missing the arcade fixture");
const clawView = clawGalleryView(content.world, arcadeFixture, state);
const battleState = state.startsWith("battle-");
const journalState = state.startsWith("journal-");
const arcadeState = state.startsWith("arcade-");
const titleState = state.startsWith("title-");
const dialogueShown = battleState
  ? state === "battle-command" || state === "battle-feelings"
  : state !== "prompt" && !journalState && !titleState &&
    (!arcadeState || state === "arcade-result");
if (battleState) document.documentElement.dataset.battle = "open";
// A catch or a lean shows its touch arrows (spec 8.1).
if (state === "battle-catch") document.documentElement.dataset.check = "catch";
if (state === "battle-lean") document.documentElement.dataset.check = "lean";
if (dialogueShown) document.documentElement.dataset.dialogue = "open";
if (journalState) document.documentElement.dataset.journal = "open";
if (arcadeState) document.documentElement.dataset.arcade = "open";
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
const calibrationFile = "public/assets/arcade/claw-machine.json";
const arcade = createArcade(stage, galleryPrizeArt,
  parseClawCalibration(calibrationData, calibrationFile), "assets/arcade/claw-machine.webp");
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
  text: "What should Fae do?",
  revealed: 100,
  choices: [],
  selected: -1,
  canAdvance: false,
};
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
        name: "The Enchanted Forest",
        busStop: false,
        x: 1156,
        y: 720,
      },
    ],
    currentLand: "cloverhollow",
    coins: 8,
    snacks: 2,
    muted: false,
    level: 1,
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
  // The battle is over once the reward shows, so the HUD steps aside.
  battleHud.render({
    visible: battleState && state !== "battle-reward",
    energy: 3,
    energyMax: 5,
    calm: 0.45,
    critterName: "Fizzy Frog",
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
  const feelings = state === "battle-feelings";
  commands.render({
    visible: state === "battle-command" || feelings,
    selected: feelings ? 1 : 2,
    commands: feelings ? feelingCommands : commandList,
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
  // Rings go through the game's own check overlay, like every other check.
  const ringCheck = (ring: typeof frogRing, grade: TimingGrade | null): BattleCheckView => ({
    kind: "ring",
    ...ring,
    grade,
    hint: null,
    hintAt: { x: ring.x, y: ring.y + ring.radius + 16 },
  });
  // The pup's two tennis balls in the toy atlas (assets/battle/toys).
  const tennisBall = (index: 0 | 1): AtlasImage => ({
    src: "assets/battle/toys/toys.png",
    frame: index === 0 ? { x: 0, y: 0, w: 69, h: 73 } : { x: 128, y: 0, w: 71, h: 72 },
    atlas: { w: 760, h: 552 },
  });
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
  arcade.render(clawView);
  prompt.render({
    label: "TALK",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    visible: state === "prompt",
  });
  if (!dialogueShown) dialogue.hide();
  else if (battleState) dialogue.render(battleMessage);
  else if (clawView !== null)
    dialogue.render({
      speaker: null,
      text: clawView.message,
      revealed: clawView.revealed,
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
// The claw machine's painting and the plushes are CSS backgrounds, which
// neither the fonts nor a frame wait for: decode them, then mark the page
// ready for its screenshots.
const decoded = (src: string): Promise<void> => {
  const image = new Image();
  image.src = src;
  return image.decode();
};
void Promise.all([document.fonts.ready, decoded("assets/arcade/claw-machine.webp"),
  decoded("assets/prizes/prizes.png")])
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
