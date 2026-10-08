import "../ui/sticker.css";
import { createDialogueBox, createPrompt, type DialogueView, type PromptView } from "../ui/sticker";
import { mountTouchControls } from "../ui/touch-controls";
import {
  createBattleHud,
  createCommandMenu,
  createRewardSticker,
  createTimingRing,
  type TimingRingView,
} from "../ui/battle";
import { createJournal, type JournalView } from "../ui/journal";
import { createTitleScreen, type TitleView } from "../ui/title";

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
      renderRing: (view: TimingRingView) => void;
      renderState: () => void;
    };
  }
}
const state = params.get("state") ?? "short";
const battleState = state.startsWith("battle-");
const journalState = state.startsWith("journal-");
const titleState = state.startsWith("title-");
const dialogueShown = battleState ? state === "battle-command"
  : state !== "prompt" && !journalState && !titleState;
if (battleState) document.documentElement.dataset.battle = "open";
if (dialogueShown) document.documentElement.dataset.dialogue = "open";
if (journalState) document.documentElement.dataset.journal = "open";
if (titleState) document.documentElement.dataset.title = "open";
const defaultView: DialogueView = { speaker: "Maddie", text: "The fountain is singing today!",
  revealed: 32, choices: [], selected: -1, canAdvance: true };
const views: Record<string, DialogueView> = {
  short: defaultView,
  long: { speaker: "Fae", text: "The town feels different. Maybe we should ask around and " +
    "find out what happened before the sun goes down.", revealed: 109, choices: [], selected: -1,
    canAdvance: true },
  "long-max": { speaker: "Fae",
    text: "Painted windows whisper clues about gentle magic in Cloverhollow today.",
    revealed: 71, choices: [], selected: -1, canAdvance: true },
  revealing: { speaker: "Sue", text: "I saw a curious sparkle by the old notice board.",
    revealed: 18,
    choices: [], selected: -1, canAdvance: false },
  "speaker-board": { speaker: "NOTICE BOARD", text: "A hand-painted note flutters in the breeze.",
    revealed: 100, choices: [], selected: -1, canAdvance: true },
  "two-choices": { speaker: "Fae", text: "What should we do first?", revealed: 100,
    choices: [{ text: "Investigate the window" }, { text: "Go to school" }], selected: 0,
    canAdvance: false },
  "three-choices": { speaker: "Maddie", text: "Which sticker should we take?", revealed: 100,
    choices: [{ text: "A bright leaf" }, { text: "A tiny moon" }, { text: "A friendly star" }],
    selected: 1, canAdvance: false },
  "touch-overlap": { speaker: "Fae", text: "The controls stay clear while we talk.", revealed: 100,
    choices: [{ text: "Okay!" }], selected: 0, canAdvance: false },
  prompt: { speaker: null, text: "", revealed: 0, choices: [], selected: -1, canAdvance: false },
};
const battleHud = createBattleHud(stage);
const commands = createCommandMenu(stage);
const ring = createTimingRing(stage);
const reward = createRewardSticker(stage);
const journal = createJournal(stage);
const title = createTitleScreen(stage);
title.onChoose((id) => { root.dataset.titleChosen = id; });
journal.onClose(() => { root.dataset.journalClosed = "true"; });
commands.onChoose((index) => {
  root.dataset.battleChosen = String(index);
});
dialogue.onChoose((index) => {
  root.dataset.chosen = String(index);
});
const battleMessage: DialogueView = { speaker: null, text: "What should Fae do?",
  revealed: 100, choices: [], selected: -1, canAdvance: false };
const frogRing = { x: 600, y: 170, radius: 74, progress: .62, target: .65 };
const faeRing = { x: 190, y: 300, radius: 66, progress: .38, target: .5 };
function renderGalleryState(): void {
  const titleView: TitleView = { visible: titleState,
    mode: state === "title-confirm" ? "confirm" :
      state === "title-fresh" ? "fresh" : "continue",
    selected: state === "title-confirm" ? "confirm-no" :
      state === "title-fresh" ? "new-game" : "continue",
    continueDetail: "Town plaza · 1 sticker" };
  title.render(titleView);
  const notes = state === "journal-empty" ? [] : state === "journal-notes" ? [
    "The fountain hummed at sunset.", "Ask Maddie about the sparkle.",
    "The notice board has a new note.", "Follow the painted path north.",
    "Keep Oliver's birthday sticker safe.",
  ] : Array.from({ length: 14 }, (_, index) => `A fresh clue, number ${index + 1}.`);
  const stickerIds = ["frog", "star", "leaf", "moon", "gem", "shell", "rainbow", "acorn",
    "kite", "bell", "cloud"];
  const stickers = stickerIds.map((id) => ({
    id,
    name: id === "frog" ? "Fountain Frog" : id,
    owned: id === "frog" && state !== "journal-empty",
    image: id === "frog" ? { src: "assets/critters/frog/frog.png",
      frame: { x: 0, y: 512, w: 512, h: 512 }, atlas: { w: 1536, h: 1024 } } : null,
  }));
  const journalView: JournalView = { visible: journalState, notes, stickers,
    lands: [
      { id: "cloverhollow", name: "Cloverhollow", busStop: true, x: 1224, y: 1327 },
      { id: "bay", name: "Bubblegum Bay", busStop: true, x: 1992, y: 828 },
      { id: "pass", name: "Pinecone Pass", busStop: true, x: 1110, y: 204 },
      { id: "trail", name: "Cliffside Trail", busStop: false, x: 1812, y: 420 },
      { id: "forest", name: "The Forest", busStop: false, x: 240, y: 420 },
      { id: "enchanted", name: "The Enchanted Forest", busStop: false, x: 1156, y: 720 },
    ], currentLand: "cloverhollow", coins: 8, snacks: 2, muted: false };
  journal.render(journalView);
  // The battle is over once the reward shows, so the HUD steps aside.
  battleHud.render({ visible: battleState && state !== "battle-reward", energy: 3,
    energyMax: 5, calm: .45,
    critterName: "Fizzy Frog" });
  // `?party=N` previews a bigger party's menu: N friend commands between
  // Soothe and Snack (two columns on phones, one from 1000 px).
  const friends = Math.max(1, Number(params.get("party") ?? "1"));
  const commandList = [
    { id: "soothe", label: "Soothe", detail: null, disabled: false },
    { id: "play", label: "Play", detail: "resting", disabled: true },
    ...Array.from({ length: friends - 1 }, (_, index) => ({
      id: `friend-${index}`, label: ["Whistle", "Dig", "Dance"][index % 3] ?? "Help",
      detail: null, disabled: false,
    })),
    { id: "snack", label: "Snack", detail: "×2", disabled: false },
    { id: "run", label: "Run", detail: null, disabled: false },
  ];
  commands.render({ visible: state === "battle-command", selected: 2, commands: commandList });
  ring.render({
    ...(state === "battle-burst" ? faeRing : frogRing),
    visible: state === "battle-timing" || state === "battle-grade" || state === "battle-burst",
    grade: state === "battle-grade" ? "great" : null,
  });
  reward.render({ visible: state === "battle-reward", title: "NEW STICKER!",
    name: "Fountain Frog", image: { src: "assets/critters/frog/frog.png",
      frame: { x: 0, y: 512, w: 512, h: 512 }, atlas: { w: 1536, h: 1024 } } });
  prompt.render({ label: "TALK", x: window.innerWidth / 2, y: window.innerHeight / 2,
    visible: state === "prompt" });
  if (!dialogueShown) dialogue.hide();
  else if (battleState) dialogue.render(battleMessage);
  else dialogue.render(views[state] ?? defaultView);
}
window.__stickerGallery = {
  render: (view) => dialogue.render(view),
  renderPrompt: (view) => prompt.render(view),
  renderRing: (view) => ring.render(view),
  renderState: renderGalleryState,
};
renderGalleryState();
window.addEventListener("resize", renderGalleryState);
void document.fonts.ready.then(() => new Promise<void>((resolve) => {
  window.requestAnimationFrame(() => resolve());
})).then(renderGalleryState);
